from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.core.database import Base


class VoiceCapture(Base):
    """One thing the shopkeeper said (or typed) to "bol kar likhein".

    It keeps what was heard, what HisaabAI understood, and what the shopkeeper finally
    saved, so every voice entry can be checked later: play the recording, read the
    transcript, and see whether the shopkeeper had to correct anything.
    Nothing is written to the khata or the cash book until the shopkeeper confirms.
    """

    __tablename__ = "voice_captures"

    capture_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, index=True)

    source = Column(String(10), nullable=False)            # "audio" or "text"
    audio_file = Column(String(80), nullable=True)         # file name inside settings.VOICE_DIR
    audio_mime = Column(String(40), nullable=True)
    audio_seconds = Column(Float, nullable=True)

    transcript_urdu = Column(Text, nullable=True)          # Urdu script
    transcript_roman = Column(Text, nullable=True)         # Roman Urdu
    provider = Column(String(20), nullable=False)          # gemini, groq or offline
    proposal_json = Column(Text, nullable=False)           # what HisaabAI understood
    final_json = Column(Text, nullable=True)               # what the shopkeeper saved

    status = Column(String(12), nullable=False, default="pending")  # pending, saved, discarded
    intent = Column(String(12), nullable=True)             # udhaar, wasooli, kharcha (as saved)
    edited = Column(Boolean, nullable=True)                # did the shopkeeper change anything?
    saved_at = Column(DateTime, nullable=True)
    ledger_entry_id = Column(Integer, ForeignKey("customer_ledger_entries.entry_id", ondelete="SET NULL"), nullable=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.expense_id", ondelete="SET NULL"), nullable=True, index=True)
