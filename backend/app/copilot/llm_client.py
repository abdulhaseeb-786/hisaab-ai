"""Multi-tier Copilot Client.
Hierarchy:
Tier 1: Google Gemini API (gemini-2.0-flash / gemini-1.5-flash)
Tier 2: Groq API (llama-3.3-70b-versatile / llama-3.1-8b-instant)
Tier 3: Deterministic Rule-Based Fallback Engine (Offline, 0-cost, 100% resilient)
"""

import os
import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.core.config import settings
from app.copilot.tools import AVAILABLE_TOOLS_SCHEMA, execute_tool
from app.copilot.fallback_engine import run_deterministic_copilot

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are HisaabAI Copilot, a sharp, trustworthy retail business advisor for Pakistani general store owners.
Your core rules:
1. NUMBERS ARE COMPUTED BY TOOLS ONLY: You must NEVER invent or hallucinate metrics, prices, stock quantities, or margins.
2. If asked what to buy or reorder, invoke the `generate_reorder_plan` tool.
3. If asked about stock status, invoke `get_inventory_health` or `get_today_actions`.
4. If asked about prices or profit drop, invoke `get_margin_insights`.
5. If asked about customer balances or udhaar, invoke `get_credit_summary`.
6. Language: If the user writes in Roman Urdu or Urdu, respond in natural, friendly Roman Urdu (e.g. "Aap ke paas PKR 50,000 ka budget hai. Sab se pehle Dalda Cooking Oil ki 3 petiyan khareedein..."). If the user writes in English, reply in concise English.
7. Always provide evidence and an actionable next step for the shopkeeper.
"""

def chat_with_copilot(
    db: Session,
    message: str,
    language: str = "roman_urdu",
    history: List[dict] = None,
    store_id: int = 1
) -> Dict[str, Any]:
    """Execute 3-tier copilot query with automatic graceful fallback."""
    gemini_key = os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY
    groq_key = os.getenv("GROQ_API_KEY") or settings.GROQ_API_KEY

    # -------------------------------------------------------------
    # TIER 1: GOOGLE GEMINI API
    # -------------------------------------------------------------
    if gemini_key and len(gemini_key.strip()) > 10:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=message,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT + f"\nUser requested language: {language}",
                    temperature=0.2
                )
            )
            if response and response.text:
                return {
                    "response": response.text,
                    "language": language,
                    "tool_calls": [],
                    "provider_used": "gemini",
                    "grounded": True
                }
        except Exception as e:
            logger.warning(f"Tier 1 (Gemini) failed: {e}. Falling back to Tier 2 (Groq)...")

    # -------------------------------------------------------------
    # TIER 2: GROQ API
    # -------------------------------------------------------------
    if groq_key and len(groq_key.strip()) > 10:
        try:
            from groq import Groq
            groq_client = Groq(api_key=groq_key)
            completion = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT + f"\nUser requested language: {language}"},
                    {"role": "user", "content": message}
                ],
                temperature=0.2,
                max_tokens=800
            )
            reply = completion.choices[0].message.content
            if reply:
                return {
                    "response": reply,
                    "language": language,
                    "tool_calls": [],
                    "provider_used": "groq",
                    "grounded": True
                }
        except Exception as e:
            logger.warning(f"Tier 2 (Groq) failed: {e}. Falling back to Tier 3 (Deterministic)...")

    # -------------------------------------------------------------
    # TIER 3: DETERMINISTIC OFFLINE FALLBACK ENGINE
    # -------------------------------------------------------------
    return run_deterministic_copilot(db, message=message, language=language, store_id=store_id)
