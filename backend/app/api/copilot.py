from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.copilot.llm_client import chat_with_copilot
from app.schemas.copilot import ChatRequest, ChatResponse

router = APIRouter(prefix="/copilot", tags=["AI Business Copilot"])

@router.post("/chat", response_model=ChatResponse)
def copilot_chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    """POST /api/copilot/chat: Tool-grounded business assistant in English and Roman Urdu (COP-01, COP-02).
    3-Tier Fallback: Gemini -> Groq -> Offline Deterministic Natural Language Generator.
    """
    return chat_with_copilot(
        db,
        message=request.message,
        language=request.language,
        history=[m.model_dump() for m in request.history],
        store_id=request.store_id
    )
