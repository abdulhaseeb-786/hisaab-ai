# HisaabAI Backend (CYE 2026 – Track 3: FinTech & Financial Inclusion)

Retail decision-support and business intelligence platform for Pakistani general stores (*karyana* and mini-marts).
Built as a modular FastAPI monolith with SQLite WAL mode / PostgreSQL support, deterministic analytics, 7-day demand forecasting, knapsack budget reorder optimization, and a 3-tier Roman Urdu / English AI Copilot.

---

## 1. Hackathon Mandatory Disclosures (CYE 2026 Rules)

Per Hackathon constraints (Section 2 & 10 of PRD v0.2), all external APIs, libraries, datasets, and tools used are disclosed below:

- **Programming Language & Runtime:** Python 3.13.3
- **Web Framework:** FastAPI `0.115.0+`, Uvicorn `0.30.0+`
- **Database & ORM:** SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) & Foreign Keys enabled; SQLAlchemy `2.0+`
- **Data Validation & Serializers:** Pydantic V2 (`pydantic>=2.8.0`, `pydantic-settings>=2.4.0`)
- **Scientific Computing & Analytics:** NumPy `1.26+`, Pandas `2.2+`, Scikit-learn `1.5+`
- **Testing Framework:** Pytest `8.0+`, Starlette TestClient / HTTPX `0.27+`
- **LLM APIs (3-Tier Fallback):**
  - Tier 1: Google Gemini API (`google-genai>=0.1.0`)
  - Tier 2: Groq API (`groq>=0.9.0`, Llama-3.3-70B)
  - Tier 3: Deterministic Rule-Based Fallback Engine (Offline, 0-cost, 100% resilient)
- **Benchmarking Dataset:** Public M5 Walmart Retail Dataset slice (`backend/datasets/m5_grocery_sample.csv`) used exclusively for chronological holdout forecasting evaluation (MAE and WAPE).
- **Synthetic Accuracy Disclosure:** Synthetic simulator accuracy is never claimed as real-world proof.

---

## 2. Quick Start & Setup

### A. Environment Configuration
```bash
cd backend
cp .env.example .env
```
*(Optionally add your `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env` if desired. The system automatically runs on Tier 3 offline fallback if no keys are provided).*

### B. Install Dependencies
```bash
pip install -r requirements.txt
```

### C. Seed Database (Deterministic Seed 42)
Generates 120 authentic Pakistani grocery SKUs, 9 months of transactions (~4,900 sales), Ramadan/Eid surges, and the 5 curated demo scenarios:
```bash
python -m app.simulator.reset
```

### D. Run Automated Test Suite
```bash
python -m pytest tests -v
```

### E. Run the Backend Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI/Swagger documentation is available at:
👉 **`http://localhost:8000/docs`**

---

## 3. The Hero Flow: PKR 50,000 Budget Reorder Planner

**Hero Question:** *"I have PKR 50,000. What should I buy today and why?"*

### Endpoint: `POST /api/reorder-plan`
Payload:
```json
{
  "budget_pkr": 50000.0,
  "store_id": 1,
  "target_cover_days": 14
}
```

### Response Highlights:
- **Total Allocated Spend:** PKR 40,170 $\le$ PKR 50,000 (**Budget Strictly Respected**).
- **Item #1:** Dalda Cooking Oil 1L Pouch (Critical stockout: 2.9 days cover vs 4 days lead time). Recommends 3 cartons (48 pouches), extending cover to 20.1 days.
- **Item #2:** Sunridge Chakki Atta 10kg (1 bundle / 5 bags).
- **Item #3:** Farm Fresh Eggs (1 crate / 20 dozen).
- **Item #4:** Olpers Milk 1L (1 carton / 12 packs).
- All reorder recommendations automatically round up to wholesale pack multiples (carton/peti, bori, crate) and comply with MOQs.

---

## 4. Curated Demo Scenarios (Pre-seeded with Seed 42)

1. **Impending Stockout:** Dalda Cooking Oil 1L Pouch (OIL-001) has only 8 pouches remaining (~2.9 days cover) while supplier lead time is 4 days.
2. **Margin Squeeze:** Sufi Canola Oil (OIL-004) wholesale cost rose by PKR 60 (PKR 480 $\to$ 540), but shelf selling price remained PKR 560. Margin dropped from 14.3% down to 3.6%. Recommends updating price to PKR 630.
3. **Dead Stock Signal:** Sparkle Lemon Floor Cleaner 1L (CLN-012) has 18 units in stock with zero sales in the last 45 days (PKR 5,580 tied-up capital).
4. **Overdue Khata Customer:** Customer "Tariq Mahmood (Tariq Bhai)" owes PKR 99,704 with unpaid charges dating past 200+ days. Safe Mark credit score degraded to 23/100 (High Risk).
5. **Cash Flow Outlook:** Opening cash PKR 25,000 with upcoming supplier payments and weekly operating expenses.

---

## 5. Forecasting Ablation Study

Run the comparative ablation benchmark across both the Public M5 Retail Dataset and the Pakistani Store Digital Twin:
```bash
python app/forecasting/ablation_study.py
```
Evaluates:
- Baseline 1: Naive Lag-7 ($y_{t-7}$)
- Baseline 2: 7-Day Moving Average
- Model: Exponential Smoothing with Day-of-Week and Ramadan/Eid Calendar features
- Reports **MAE** and **WAPE** chronologically with zero data leakage.

---

## 6. Complete API Endpoint Surface

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root status and project metadata |
| `GET` | `/health` | Server health check |
| `GET` | `/api/actions/today` | Top 3 ranked actions with evidence & next step |
| `GET` | `/api/dashboard` | High-level KPIs (Revenue, Profit, Margin %, Receivables) |
| `GET` | `/api/products` | Paginated product table with cover days & stockout risk |
| `GET` | `/api/products/{id}` | Detailed product history, price movements, forecast |
| `POST` | `/api/forecast` | 7-day demand forecast with baselines & WAPE label |
| `GET` | `/api/insights` | Margin squeeze, dead stock, and credit risk cards |
| `POST` | `/api/reorder-plan` | **Hero Flow:** Budget-constrained purchase plan |
| `GET` | `/api/credit/summary` | Customer receivables, aging buckets, Safe Mark rating |
| `GET` | `/api/payables/summary` | Supplier balances & upcoming due payments |
| `GET` | `/api/payables/cash-outlook` | 7-day projected cash flow position |
| `POST` | `/api/copilot/chat` | 3-tier tool-grounded assistant in English or Roman Urdu |
| `POST` | `/api/import/csv` | Preview and validate uploaded CSV data with row errors |
| `POST` | `/api/import/commit` | Commit validated CSV rows to database |
| `POST` | `/api/demo/reset` | Restore seeded state to deterministic Seed 42 |
