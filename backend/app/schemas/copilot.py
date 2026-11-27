from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Language = Literal["roman_urdu", "english", "urdu"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    store_id: int = 1
    language: Language = "roman_urdu"
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ToolCallExecution(BaseModel):
    tool_name: str
    tool_label: str
    parameters: dict[str, Any]
    result_summary: dict[str, Any]


class ChatResponse(BaseModel):
    response: str
    language: Language
    tool_calls: list[ToolCallExecution]
    provider_used: Literal["gemini", "groq", "offline"]
    grounded: bool
    notes: list[str] = Field(default_factory=list)
