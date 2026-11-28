"""Copilot with three tiers: Gemini -> Groq -> offline engine (COP-01..04).

The LLM never sees the database. It can only call the allow-listed tools in tools.py,
and it must take every number from their results. Two guards keep it honest:

1. Tool calling: the model asks for a tool, we run it, and we hand back the result.
2. Number check: if the model answers with numbers without having called any tool, the
   answer is thrown away and the offline engine answers instead (it is always grounded).

If a provider is missing, slow or fails, the next tier answers. The app never breaks
because an LLM is down.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.copilot.fallback_engine import run_deterministic_copilot
from app.copilot.tools import TOOL_LABELS, TOOLS, execute_tool, to_json, tool_declarations
from app.core import gemini_models
from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4
MAX_HISTORY = 8

SYSTEM_PROMPT = """You are HisaabAI, a friendly and sharp business helper for a Pakistani general store (karyana) owner.

Rules you must always follow:
1. Every number you say (rupees, units, days, percentages) must come from a tool result in this conversation. Never estimate, round up or invent numbers. If you need a number, call a tool.
2. If no tool can answer, say plainly that the shop's records do not have that data. Do not guess.
3. You can only read data. You cannot change prices, record payments or place orders; tell the owner which screen to use. The app's screens are exactly: Aaj (Today: open/close the day, today's jobs), Khata (customers, udhaar, wasooli), Order (order booker, whole-shop budget, Maal aaya), Stock (products, ginti), Hisaab (cash box, distributor bills, loan report), and the mic button (say or type an entry or a question). Never mention any other screen, app or POS.
4. Keep answers short and practical: the answer first, then the reason, then one clear next step. Use short bullet points. Use **bold** for key numbers.
5. Money is in Pakistani rupees, written like Rs 12,500.
6. Language: {language_rule}
7. Gross profit is not net profit (rent, salaries and bills are not deducted). Say so if it matters."""

LANGUAGE_RULES = {
    "roman_urdu": "Reply in simple, natural Roman Urdu (Urdu written in English letters), the way a shopkeeper in Islamabad talks, whatever language the question is in. Product names stay as they are.",
    "english": "Reply in simple English, even when the question is in Urdu or Roman Urdu.",
    "urdu": "Reply in Urdu script, even when the question is in Roman Urdu or English. Customer and product names may stay in English letters.",
}

NUMBER_PATTERN = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _system_prompt(language: str) -> str:
    return SYSTEM_PROMPT.format(language_rule=LANGUAGE_RULES.get(language, LANGUAGE_RULES["english"]))


def _summary(result: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in result.items():
        if isinstance(v, (int, float, str, bool)) or v is None:
            out[k] = v
        elif isinstance(v, list):
            out[f"{k}_count"] = len(v)
    return dict(list(out.items())[:8])


def _invented_numbers(text: str, tool_calls: list[dict[str, Any]]) -> bool:
    return not tool_calls and bool(NUMBER_PATTERN.search(text))


# ---- Gemini ---------------------------------------------------------------------------------

def _chat_gemini(db: Session, message: str, language: str, history: list[dict[str, str]], store_id: int) -> dict[str, Any] | None:
    from google import genai
    from google.genai import types

    client = genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=int(settings.LLM_TIMEOUT_SECONDS * 1000)),
    )
    declarations = [
        types.FunctionDeclaration(name=t["name"], description=t["description"], parameters_json_schema=t["parameters"])
        for t in tool_declarations()
    ]
    config = types.GenerateContentConfig(
        system_instruction=_system_prompt(language),
        tools=[types.Tool(function_declarations=declarations)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.2,
    )
    contents: list[Any] = []
    for turn in history[-MAX_HISTORY:]:
        role = "model" if turn["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=turn["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

    calls: list[dict[str, Any]] = []
    for _ in range(MAX_TOOL_ROUNDS):
        resp = gemini_models.generate(client, contents, config)
        function_calls = resp.function_calls or []
        if not function_calls:
            text = (resp.text or "").strip()
            return {"text": text, "calls": calls} if text else None
        contents.append(resp.candidates[0].content)
        parts = []
        for fc in function_calls:
            args = dict(fc.args or {})
            result = execute_tool(db, fc.name, args, store_id=store_id)
            calls.append({"tool_name": fc.name, "parameters": args, "result_summary": _summary(result)})
            parts.append(types.Part.from_function_response(name=fc.name, response={"result": json.loads(to_json(result))}))
        contents.append(types.Content(role="user", parts=parts))
    return None


# ---- Groq -----------------------------------------------------------------------------------

def _chat_groq(db: Session, message: str, language: str, history: list[dict[str, str]], store_id: int) -> dict[str, Any] | None:
    from groq import Groq

    client = Groq(api_key=settings.GROQ_API_KEY, timeout=settings.LLM_TIMEOUT_SECONDS, max_retries=1)
    tools = [{"type": "function", "function": t} for t in tool_declarations()]
    messages: list[dict[str, Any]] = [{"role": "system", "content": _system_prompt(language)}]
    for turn in history[-MAX_HISTORY:]:
        messages.append({"role": "assistant" if turn["role"] == "assistant" else "user", "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    calls: list[dict[str, Any]] = []
    for _ in range(MAX_TOOL_ROUNDS):
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL, messages=messages, tools=tools, tool_choice="auto",
            temperature=0.2, max_tokens=900,
        )
        msg = completion.choices[0].message
        if not msg.tool_calls:
            text = (msg.content or "").strip()
            return {"text": text, "calls": calls} if text else None
        messages.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": tc.id, "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                           for tc in msg.tool_calls],
        })
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = execute_tool(db, tc.function.name, args, store_id=store_id)
            calls.append({"tool_name": tc.function.name, "parameters": args, "result_summary": _summary(result)})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": to_json(result)})
    return None


PROVIDERS = (
    ("gemini", lambda: bool(settings.GEMINI_API_KEY.strip()), _chat_gemini),
    ("groq", lambda: bool(settings.GROQ_API_KEY.strip()), _chat_groq),
)


def provider_status() -> dict[str, Any]:
    """Which tiers are configured (never the keys themselves)."""
    return {
        "mode": settings.COPILOT_MODE,
        "gemini_configured": bool(settings.GEMINI_API_KEY.strip()),
        "groq_configured": bool(settings.GROQ_API_KEY.strip()),
        "offline_available": True,
    }


def chat_with_copilot(db: Session, message: str, language: str = "roman_urdu",
                      history: list[dict[str, str]] | None = None, store_id: int = 1) -> dict[str, Any]:
    """Answer one copilot message. See the module docstring for the tiers and guards."""
    return _label_calls(_chat(db, message, language, history, store_id))


def _chat(
    db: Session,
    message: str,
    language: str = "roman_urdu",
    history: list[dict[str, str]] | None = None,
    store_id: int = 1,
) -> dict[str, Any]:
    history = history or []
    notes: list[str] = []
    if settings.COPILOT_MODE != "offline":
        for name, configured, fn in PROVIDERS:
            if not configured():
                continue
            try:
                out = fn(db, message, language, history, store_id)
            except Exception as exc:  # network, quota, bad model name...
                logger.warning("Copilot tier %s failed: %s", name, exc.__class__.__name__)
                notes.append(f"{name} unavailable")
                continue
            if not out:
                notes.append(f"{name} gave no answer")
                continue
            if _invented_numbers(out["text"], out["calls"]):
                logger.warning("Copilot tier %s answered with numbers but no tool call; discarded", name)
                notes.append(f"{name} answer discarded (numbers without data)")
                continue
            return {
                "response": out["text"],
                "language": language,
                "tool_calls": out["calls"],
                "provider_used": name,
                "grounded": True,
                "notes": notes,
            }

    result = run_deterministic_copilot(db, message=message, language=language, store_id=store_id)
    result["notes"] = notes
    return result


def _label_calls(result: dict[str, Any]) -> dict[str, Any]:
    for call in result.get("tool_calls", []):
        call["tool_label"] = TOOL_LABELS.get(call["tool_name"], call["tool_name"])
    return result


__all__ = ["chat_with_copilot", "provider_status", "TOOLS"]
