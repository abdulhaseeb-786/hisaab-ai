from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.importer.csv_service import validate_and_preview_csv, commit_csv_batch
from app.schemas.csv_import import CSVPreviewResponse, CSVCommitRequest, CSVCommitResponse

router = APIRouter(prefix="/import", tags=["CSV Import"])

@router.post("/csv", response_model=CSVPreviewResponse)
async def preview_csv_endpoint(
    file: UploadFile = File(...),
    import_type: str = Form(default="products")
):
    """POST /api/import/csv: Upload and preview CSV with row-by-row validation errors (DATA-02)."""
    try:
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8-sig")
        return validate_and_preview_csv(content_str, import_type=import_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/commit", response_model=CSVCommitResponse)
def commit_csv_endpoint(request: CSVCommitRequest, db: Session = Depends(get_db)):
    """POST /api/import/commit: Commit validated staged batch to database."""
    try:
        return commit_csv_batch(db, batch_token=request.batch_token, store_id=request.store_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
