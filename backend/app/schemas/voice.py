from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.copilot import ChatResponse
from app.schemas.credit import Bilingual, CustomerItem, PaymentMethod, PaymentRecordResponse, UdhaarItemIn, UdhaarResponse
from app.schemas.operations import ExpenseCategory, ExpenseResponse

VoiceIntent = Literal["udhaar", "wasooli", "kharcha"]
HeardIntent = Literal["udhaar", "wasooli", "kharcha", "question"]
Provider = Literal["gemini", "groq", "offline"]


class VoiceStatus(BaseModel):
    cloud_allowed: bool = Field(description="The owner agreed to send recordings to a cloud AI to be understood.")
    cloud_available: bool = Field(description="A cloud AI is configured (keys are never returned).")
    providers: list[Provider]
    max_seconds: int


class VoiceSettingsRequest(BaseModel):
    cloud_allowed: bool


class CustomerCandidate(CustomerItem):
    score: float = Field(description="How close the spoken name is, 0 to 1.")


class PersonGuess(BaseModel):
    spoken_name: Optional[str] = Field(description="The name as heard, in Roman letters.")
    spoken_name_urdu: Optional[str]
    match: Optional[CustomerCandidate] = Field(description="The khata picked for the shopkeeper, only when the match is clear.")
    candidates: list[CustomerCandidate] = Field(description="Close khatas to choose from, best first.")


class ProductOption(BaseModel):
    product_id: int
    name: str
    unit: str
    selling_price: float = Field(description="Shelf price; prices never come from speech.")
    stock_qty: float
    image_url: Optional[str]
    score: float = Field(description="How well it fits the words said, 0 to about 1.")
    qty: float = Field(description="The quantity said, in this product's own unit (e.g. '5 kilo atta' = 1 bag of 5 kg).")


class ItemHeard(BaseModel):
    words: str = Field(description="The words for this item, e.g. 'do kilo cheeni'.")
    words_urdu: Optional[str]
    qty_heard: bool = Field(description="False when no quantity was said and 1 was filled in.")
    qty_said: Optional[str] = Field(description="The words the quantity came from, e.g. 'do kilo'.")
    match: Optional[ProductOption] = Field(description="Preselected only when one product clearly fits.")
    options: list[ProductOption] = Field(description="Products that fit, best first; ties go to what sells most.")


class VoiceProposal(BaseModel):
    """What HisaabAI understood. Nothing is saved until the shopkeeper confirms."""

    capture_id: int
    source: Literal["audio", "text"]
    provider: Provider
    has_recording: bool
    transcript_urdu: Optional[str]
    transcript_roman: Optional[str]
    intent: Optional[HeardIntent] = Field(description="Empty when it was not clear. 'question': answered, nothing written.")
    question: Optional[str] = Field(default=None, description="Intent 'question': what was asked, as sent to the copilot.")
    answer: Optional[ChatResponse] = Field(default=None, description="Intent 'question': the copilot's answer (numbers only from its tools).")
    amount_pkr: Optional[float] = Field(description="Only an amount that was really said; empty otherwise.")
    amount_heard: Optional[str] = Field(description="The words the amount came from, e.g. 'paanch hazaar'.")
    extra_amount_pkr: Optional[float] = Field(default=None, description="Udhaar: amount besides the items (cash said with them). Without items, the amount.")
    items: list[ItemHeard] = Field(default_factory=list, description="Udhaar of goods: the items heard.")
    items_total_pkr: float = Field(default=0, description="Matched items at shelf prices.")
    person: PersonGuess
    cash_from_galla: bool = Field(description="Udhaar: cash handed over from the galla (naqad), not goods.")
    cash_from_galla_heard: bool = Field(description="True if 'cash' or 'saamaan' was actually said.")
    method: PaymentMethod
    expense_category: Optional[ExpenseCategory]
    reason: Optional[str]
    reason_urdu: Optional[str]
    days_ago: int = Field(ge=0, le=7)
    occurred_on: date
    due_date: Optional[date] = Field(description="Return date, only if one was said.")
    usual_due_date: date = Field(description="The return date from the shop's usual credit term.")
    cash_in_galla_pkr: float
    missing: list[Literal["intent", "amount", "person", "category", "item"]]
    notes: list[Bilingual] = Field(description="Plain notes on how it was understood (e.g. offline, amount not heard).")


class VoiceConfirmRequest(BaseModel):
    intent: VoiceIntent
    amount: float = Field(default=0, ge=0, le=10_000_000, description="Udhaar: the amount besides the items (may be 0 with items).")
    items: list[UdhaarItemIn] = Field(default_factory=list, max_length=50, description="Udhaar of goods, sold at shelf price.")
    customer_id: Optional[int] = None
    new_customer_name: Optional[str] = Field(default=None, max_length=120, description="Open a new khata with this name.")
    cash_from_galla: bool = True
    method: PaymentMethod = "cash"
    expense_category: Optional[ExpenseCategory] = None
    reason: Optional[str] = Field(default=None, max_length=100)
    days_ago: int = Field(default=0, ge=0, le=7)
    due_date: Optional[date] = None


class VoiceSaved(BaseModel):
    capture_id: int
    intent: VoiceIntent
    edited: bool = Field(description="The shopkeeper changed something HisaabAI understood.")
    customer_id: Optional[int]
    new_customer: bool
    udhaar: Optional[UdhaarResponse] = None
    payment: Optional[PaymentRecordResponse] = None
    expense: Optional[ExpenseResponse] = None


class VoiceCaptureItem(BaseModel):
    capture_id: int
    created_at: datetime
    source: Literal["audio", "text"]
    provider: Provider
    status: Literal["pending", "saved", "discarded", "answered"]
    intent: Optional[HeardIntent]
    edited: Optional[bool]
    transcript_urdu: Optional[str]
    transcript_roman: Optional[str]
    has_recording: bool


class VoiceLog(BaseModel):
    """Real usage, not simulated: how often voice entries were saved without a correction."""

    saved: int
    answered: int = Field(default=0, description="Questions asked by voice and answered.")
    saved_without_changes: int
    discarded: int
    captures: list[VoiceCaptureItem]
