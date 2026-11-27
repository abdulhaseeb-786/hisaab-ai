"""Copilot: grounded answers, Roman Urdu, data gaps, and the LLM guards (COP-01..04)."""

import pytest

from app.copilot import llm_client
from app.copilot.fallback_engine import detect_intent, parse_budget
from app.copilot.llm_client import chat_with_copilot
from app.copilot.tools import TOOLS, execute_tool


@pytest.mark.parametrize("text,expected", [
    ("Mere paas 50,000 rupay hain", 50_000), ("50k ka maal", 50_000), ("50 hazar", 50_000),
    ("1 lakh mein kya", 100_000), ("Rs 25000", 25_000), ("kya khareedun", None),
])
def test_budget_parsing(text, expected):
    assert parse_budget(text) == expected


@pytest.mark.parametrize("text,intent", [
    ("Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?", "reorder"),
    ("Kahan munafa kam ho raha hai?", "margin"),
    ("Sabse ziyada udhaar kiska hai?", "credit"),
    ("Kaunsa maal phasa hua hai?", "dead_stock"),
    ("How were sales in the last 7 days?", "kpi"),
    ("Tell me about tomorrow's weather in Murree", None),
])
def test_intent_detection(text, intent):
    assert detect_intent(text) == intent


def test_hero_question_in_roman_urdu(db_session):
    res = chat_with_copilot(db_session, "Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?", "roman_urdu")
    assert res["grounded"] and res["provider_used"] == "offline"
    assert res["tool_calls"][0]["tool_name"] == "generate_reorder_plan"
    assert "Rs 50,000" in res["response"]
    assert "Dalda Cooking Oil" in res["response"]
    assert "Wajah" in res["response"]


@pytest.mark.parametrize("question,tool,must_contain", [
    ("Kahan munafa kam ho raha hai?", "get_margin_insights", "Sufi Canola"),
    ("Sabse ziyada udhaar kiska hai?", "get_credit_summary", "Tariq"),
    ("Tariq ka khata kitna hai?", "get_credit_summary", "Tariq Mahmood"),
    ("Dalda kitna bacha hai?", "get_product_details", "Dalda Cooking Oil 1L"),
    ("Kaunsa maal phasa hua hai?", "get_dead_stock", "Sparkle"),
    ("Aaj kya karun?", "get_today_actions", "Dalda"),
])
def test_four_more_questions_grounded(db_session, question, tool, must_contain):
    res = chat_with_copilot(db_session, question, "roman_urdu")
    assert res["tool_calls"] and res["tool_calls"][0]["tool_name"] == tool
    assert must_contain in res["response"]


def test_english_answer(db_session):
    res = chat_with_copilot(db_session, "How were sales in the last 7 days?", "english")
    assert res["tool_calls"][0]["parameters"] == {"period": "7d"}
    assert "Last 7 days" in res["response"]


def test_unknown_question_gets_a_data_gap_not_a_number(db_session):
    res = chat_with_copilot(db_session, "Tell me about tomorrow's weather in Murree", "english")
    assert res["tool_calls"] == []
    assert "will not guess" in res["response"]
    assert not any(ch.isdigit() for ch in res["response"])


def test_tools_are_allow_listed(db_session):
    assert execute_tool(db_session, "drop_table", {})["error"].startswith("Unknown tool")
    assert "error" in execute_tool(db_session, "generate_reorder_plan", {"budget_pkr": -1})


def test_every_tool_runs(db_session):
    args = {"generate_reorder_plan": {"budget_pkr": 30000}, "get_product_details": {"product": "Dalda"}}
    for name in TOOLS:
        result = execute_tool(db_session, name, args.get(name, {}))
        assert "error" not in result, name


class _FakeProvider:
    def __init__(self, text, call_tool=None):
        self.text, self.call_tool = text, call_tool

    def __call__(self, db, message, language, history, store_id):
        calls = []
        if self.call_tool:
            execute_tool(db, self.call_tool, {}, store_id)
            calls.append({"tool_name": self.call_tool, "parameters": {}, "result_summary": {}})
        return {"text": self.text, "calls": calls}


def test_llm_answer_with_tool_is_used(db_session, monkeypatch):
    monkeypatch.setattr(llm_client.settings, "COPILOT_MODE", "auto")
    monkeypatch.setattr(llm_client, "PROVIDERS", (("gemini", lambda: True, _FakeProvider("Aaj 3 kaam hain.", "get_today_actions")),))
    res = chat_with_copilot(db_session, "Aaj kya karun?", "roman_urdu")
    assert res["provider_used"] == "gemini"
    assert res["tool_calls"][0]["tool_label"] == "Today's actions"


def test_llm_numbers_without_tools_are_discarded(db_session, monkeypatch):
    monkeypatch.setattr(llm_client.settings, "COPILOT_MODE", "auto")
    monkeypatch.setattr(llm_client, "PROVIDERS", (("gemini", lambda: True, _FakeProvider("Aap ka profit Rs 99,999 hai.")),))
    res = chat_with_copilot(db_session, "Kahan munafa kam ho raha hai?", "roman_urdu")
    assert res["provider_used"] == "offline"
    assert "99,999" not in res["response"]
    assert any("discarded" in n for n in res["notes"])


def test_llm_failure_falls_back(db_session, monkeypatch):
    def broken(*_args, **_kw):
        raise TimeoutError("network down")
    monkeypatch.setattr(llm_client.settings, "COPILOT_MODE", "auto")
    monkeypatch.setattr(llm_client, "PROVIDERS", (("gemini", lambda: True, broken), ("groq", lambda: True, broken)))
    res = chat_with_copilot(db_session, "Kaunsa maal phasa hua hai?", "roman_urdu")
    assert res["provider_used"] == "offline"
    assert res["notes"] == ["gemini unavailable", "groq unavailable"]


@pytest.mark.parametrize("question", ["How much Dalda oil is left?", "Dalda kitna bacha hai?", "dalda stock"])
def test_product_lookup_prefers_the_product_people_buy(db_session, question):
    """Regression: 'Dalda' used to resolve to the slow 5L tin instead of the 1L pouch."""
    from app.analytics.inventory_rules import compute_inventory_health
    from app.copilot.tools import find_product
    assert find_product(compute_inventory_health(db_session), question.lower())["sku"] == "OIL-001"
