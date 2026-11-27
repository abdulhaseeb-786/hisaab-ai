from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

ImportType = Literal["products", "sales"]


class RowError(BaseModel):
    row_number: int
    field: str
    value: Any
    error: str


class CSVPreviewResponse(BaseModel):
    import_type: ImportType
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    sample_preview: list[dict[str, Any]]
    row_errors: list[RowError]
    batch_token: str
    expires_in_minutes: int


class CSVCommitRequest(BaseModel):
    batch_token: str
    store_id: int = 1


class CSVCommitResponse(BaseModel):
    success: bool
    rows_imported: int
    created: int
    updated: int
    message: str
