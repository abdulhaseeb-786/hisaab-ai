from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.copilot.llm_client import chat_with_copilot
from app.core.database import get_db
from app.schemas.copilot import ChatRequest, ChatResponse

router = APIRouter(prefix="/copilot", tags=["Copilot"])


@router.post("/chat", response_model=ChatResponse)
def copilot_chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Answer a question in English or Roman Urdu using only allow-listed, read-only tools (COP-01..04)."""
    return chat_with_copilot(
        db,
        message=request.message,
        language=request.language,
        history=[m.model_dump() for m in request.history],
        store_id=request.store_id,
    )
