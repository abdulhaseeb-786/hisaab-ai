from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.voice import VoiceConfirmRequest, VoiceLog, VoiceProposal, VoiceSaved, VoiceSettingsRequest, VoiceStatus
from app.services import khata
from app.services.day import DayError
from app.voice import service

router = APIRouter(prefix="/voice", tags=["Voice entry"])


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (service.VoiceError, khata.KhataError, DayError) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/status", response_model=VoiceStatus)
def voice_status(store_id: int = 1, db: Session = Depends(get_db)):
    """Is voice ready: has the owner allowed online AI, and is one configured? (Never the keys.)"""
    return service.status(db, store_id)


@router.patch("/settings", response_model=VoiceStatus)
def voice_settings(payload: VoiceSettingsRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """The owner's yes or no to sending recordings to an online AI to be understood."""
    return _run(service.set_cloud_allowed, db, payload.cloud_allowed, store_id)


@router.post("/understand", response_model=VoiceProposal, status_code=201)
async def understand(
    audio: Optional[UploadFile] = File(default=None, description="The recording (WAV preferred), up to 30 seconds."),
    text: Optional[str] = Form(default=None, max_length=300, description="Or the same thing typed."),
    seconds: Optional[float] = Form(default=None, ge=0, le=120),
    answer_language: Literal["roman_urdu", "english", "urdu"] = Form(default="roman_urdu", description="For questions: the answer's language ('urdu' = Urdu script, for read-aloud)."),
    store_id: int = 1,
    db: Session = Depends(get_db),
):
    """What was said, and what HisaabAI thinks should be written. Nothing is saved to the books yet.

    A question ("Imran ka kitna baqi hai?") is answered straight away by the copilot instead.
    """
    data = None
    mime = None
    if audio is not None:
        data = await audio.read(settings.VOICE_MAX_BYTES + 1)
        mime = audio.content_type
        if not data:
            data = None
    return _run(service.understand, db, audio=data, mime=mime, seconds=seconds, text=text, store_id=store_id,
                answer_language=answer_language)


@router.post("/captures/{capture_id}/confirm", response_model=VoiceSaved)
def confirm(capture_id: int, payload: VoiceConfirmRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """The shopkeeper checked it: write the udhaar, wasooli or kharcha, linked to the recording."""
    return _run(service.confirm, db, capture_id, payload.model_dump(), store_id)


@router.post("/captures/{capture_id}/discard")
def discard(capture_id: int, store_id: int = 1, db: Session = Depends(get_db)) -> dict:
    """"Rehne dein": nothing is written. The capture is kept as set aside."""
    return _run(service.discard, db, capture_id, store_id)


@router.get("/captures/{capture_id}/audio", response_class=FileResponse)
def audio(capture_id: int, store_id: int = 1, db: Session = Depends(get_db)):
    """Play back what the shopkeeper said for this entry."""
    path, mime = _run(service.recording, db, capture_id, store_id)
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "private, max-age=3600"})


@router.get("/log", response_model=VoiceLog)
def voice_log(limit: int = 20, store_id: int = 1, db: Session = Depends(get_db)):
    """Recent voice entries and how often they were saved without a correction (real use, not simulated)."""
    return service.log(db, store_id, min(max(limit, 1), 100))
