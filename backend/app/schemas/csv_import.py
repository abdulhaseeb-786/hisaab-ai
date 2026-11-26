from pydantic import BaseModel
from typing import List, Dict, Any

class RowError(BaseModel):
    row_number: int
    field: str
    value: Any
    error: str

class CSVPreviewResponse(BaseModel):
    import_type: str  # products or sales
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    sample_preview: List[Dict[str, Any]]
    row_errors: List[RowError]
    batch_token: str

class CSVCommitRequest(BaseModel):
    batch_token: str
    store_id: int = 1

class CSVCommitResponse(BaseModel):
    success: bool
    rows_imported: int
    message: str
