from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    store_id: int = 1
    language: str = Field(default="roman_urdu")  # roman_urdu, urdu, english
    history: List[ChatMessage] = []

class ToolCallExecution(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]
    result_summary: Dict[str, Any]

class ChatResponse(BaseModel):
    response: str
    language: str
    tool_calls: List[ToolCallExecution] = []
    provider_used: str  # gemini, groq, or deterministic_fallback
    grounded: bool = True
