"""Write the API contract (OpenAPI JSON) for the frontend's generated types.

Run from the backend folder:   python scripts/export_openapi.py
Then in the frontend folder:   npm run gen:api

It does not start the server or touch the database.
"""

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402

target = BACKEND.parent / "frontend" / "src" / "api" / "openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {target.relative_to(BACKEND.parent)}")
