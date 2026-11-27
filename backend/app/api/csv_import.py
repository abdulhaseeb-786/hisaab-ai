from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.importer.csv_service import TEMPLATES, commit_csv_batch, validate_and_preview_csv
from app.schemas.csv_import import CSVCommitRequest, CSVCommitResponse, CSVPreviewResponse

router = APIRouter(prefix="/import", tags=["CSV Import"])

MAX_BYTES = 2 * 1024 * 1024


@router.post("/csv", response_model=CSVPreviewResponse)
async def preview_csv(
    file: UploadFile = File(...),
    import_type: Literal["products", "sales"] = Form(default="products"),
    store_id: int = Form(default=1),
    db: Session = Depends(get_db),
):
    """Step 1: check every row and show problems by row number. Nothing is saved yet (DATA-02)."""
    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 2 MB.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="The file is not a UTF-8 CSV. Save it as 'CSV UTF-8' and try again.")
    try:
        return validate_and_preview_csv(db, text, import_type=import_type, store_id=store_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/commit", response_model=CSVCommitResponse)
def commit_csv(request: CSVCommitRequest, db: Session = Depends(get_db)):
    """Step 2: save the valid rows from the preview, all or nothing."""
    try:
        return commit_csv_batch(db, batch_token=request.batch_token, store_id=request.store_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/template/{import_type}", response_class=PlainTextResponse)
def download_template(import_type: Literal["products", "sales"]):
    """A sample CSV with the right columns."""
    return PlainTextResponse(
        TEMPLATES[import_type],
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="hisaabai_{import_type}_template.csv"'},
    )
