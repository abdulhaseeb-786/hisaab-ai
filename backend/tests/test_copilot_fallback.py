"""Unit tests for AI Copilot Deterministic Fallback.
Requirements COP-01, COP-02, COP-04, COP-05:
- Answers hero question in Roman Urdu with grounded numbers
- Answers margin squeeze question
- Handles unknown questions with data-gap response, no fabrication
"""

from app.copilot.llm_client import chat_with_copilot

def test_copilot_hero_flow_roman_urdu(db_session):
    msg = "Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?"
    res = chat_with_copilot(db_session, message=msg, language="roman_urdu")

    assert res["grounded"] is True
    assert "Dalda Cooking Oil" in res["response"]
    assert "PKR 50,000" in res["response"]
    assert len(res["tool_calls"]) > 0
    assert res["tool_calls"][0]["tool_name"] == "generate_reorder_plan"

def test_copilot_margin_alert(db_session):
    msg = "Kahan munafa kam ho raha hai?"
    res = chat_with_copilot(db_session, message=msg, language="roman_urdu")

    assert res["grounded"] is True
    assert "Sufi Canola" in res["response"]
    assert "Margin" in res["response"]

def test_copilot_unknown_metric_data_gap(db_session):
    msg = "Tell me about tomorrow's weather in Murree"
    res = chat_with_copilot(db_session, message=msg, language="english")

    assert res["grounded"] is True
    assert "could not find recorded data" in res["response"]
