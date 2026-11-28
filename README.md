# HisaabAI

Decision support for Pakistani general stores (karyana). HisaabAI reads a shop's sales,
stock, khata (customer credit) and supplier bills, and answers one question every
morning: **what should I do today, and why?** Built for Capital Youth Expo 2026,
Track 3: FinTech & Financial Inclusion.

It follows the shopkeeper's real day:

* **Open the shop:** count the galla (cash drawer). Any difference from the records is
  written down, so every cash number afterwards is real.
* **At the counter:** `+ Udhaar` records who took what: the items, prices and due date
  come out of stock and onto that customer's khata. Before saving, **"Udhaar dun?"**
  answers yes / careful / no with the reasons. `+ Wasooli` records repayments and how
  they came (cash, Easypaisa, JazzCash, bank); only cash goes into the galla.
* **When the order booker visits:** HisaabAI shows the distributors due today, what the
  shop owes them, and **how much it can safely order**: the lowest cash expected in the
  week after that bill falls due. It suggests the order in whole cartons, most urgent
  first, with reasons.
* **When the delivery comes (Maal aaya):** check it against the bill. Short items and
  changed rates are flagged with the new margin and a one-tap price fix; the bill is
  added to what the shop owes.
* **Ginti (stock count):** count a shelf; stock is corrected, and the shortfall is booked
  as loss or as sales nobody wrote down, so even a shop without billing gets its numbers.
* **Close the day:** count the galla again and see the whole day in register lines, then
  tomorrow's bills, booker visits and the customers to remind.
* **Business report for a loan:** six months of sales, profit after running costs, khata,
  supplier bills and record keeping, ready to print for a bank or microfinance officer.

Also: **Today's 3 jobs** (the most urgent stock, price and khata problems), margin-squeeze
alerts, a Safe Mark score for every customer, a 7-day cash outlook, and a **copilot in
Roman Urdu and English** that answers only from the shop's own records and works offline.

**No messages are sent.** Receipts, reminders and orders are drafts shown on screen, to
show the customer, read out, or copy. There is no WhatsApp or SMS integration, so no
customer number ever leaves the shop.

Every number is computed by deterministic code. The LLM only explains results; it can
never invent a number (answers that contain numbers without a tool call are discarded).

## Run it

Backend (Python 3.11+):

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # optional; defaults work
uvicorn app.main:app --port 8000 --reload
```

On first start the backend builds the demo store (about 3 seconds). API docs: http://localhost:8000/docs

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (landing page), app at /app
```

Tests and checks:

```bash
cd backend && python -m pytest tests -q        # 95 tests, run on a temporary database
cd frontend && npm run typecheck               # API types are generated from the backend
cd frontend && npm run gen:api                 # after changing a backend schema
```

## Public benchmark data (optional)

The forecaster is also tested on real retail sales: **Online Retail II** (UCI Machine
Learning Repository, CC BY 4.0), https://archive.ics.uci.edu/dataset/502/online+retail+ii

1. Download and unzip it, and put `online_retail_II.xlsx` in `backend/datasets/raw/`
   (that folder is not committed).
2. From `backend/`: `python scripts/build_public_benchmark.py datasets/raw/online_retail_II.xlsx`
3. Then: `python scripts/forecast_benchmark.py` (writes `docs/forecast_benchmark.md`).

## Demo data

The demo is a **simulated** store, "Al-Madina General Store", with 120 real Pakistani
grocery products, 15 khata customers and 8 distributors, generated from a fixed seed
(42). It covers the 12 months up to today: weekday and salary-week patterns, Ramadan,
Chaand Raat and both Eids (real 2025–2026 dates), distributor route days and lead times,
customers with different payment habits (cash and mobile wallets), itemised udhaar, the
last 30 days of galla counts (a few nights short or over), and the shop's own cash
expenses. A few demo
moments are recorded as ordinary events: a stock count that leaves Dalda oil short,
two supplier price rises not passed on, a slow-selling floor cleaner, and a customer who
stopped paying. Customer names and phone numbers are fictional.

Everything is labelled "Demo data" in the app. **Simulated results are never presented
as real-world accuracy.** The forecaster is also tested on a public dataset of real
retail sales (see `docs/forecast_benchmark.md`).

## How it is built

* `backend/app/analytics/`: inventory risk, margin squeeze, dead stock, khata aging,
  payables, cash book, cash outlook, KPIs and Today's actions. Each module states its rules.
* `backend/app/services/`: the workflows that write records: day open/close and kharcha,
  khata entry and the credit check, orders and deliveries, ginti, the business report.
* `backend/app/reorder/budget_optimizer.py`: the budget planner, also used per distributor.
* `backend/app/forecasting/`: calendar-aware smoothing and two baselines, chosen by backtest.
* `backend/app/copilot/`: allow-listed tools, Gemini/Groq function calling, offline engine.
* `backend/app/simulator/`: the demo store generator.
* `frontend/src/api/`: typed client generated from the backend's OpenAPI schema, plus
  React Query hooks.

## Disclosures (CYE rules)

* **Languages and frameworks:** Python, FastAPI, SQLAlchemy, Pydantic, NumPy, pandas,
  SQLite; TypeScript, React, Vite, Tailwind CSS, TanStack Query, React Router,
  Framer Motion, lucide-react, canvas-confetti, openapi-fetch, openapi-typescript.
* **LLM APIs (optional):** Google Gemini (`google-genai`), Groq (`groq`, Llama 3.3 70B).
  The app works fully without them.
* **Public dataset:** "Online Retail II", D. Chen, UCI Machine Learning Repository,
  https://doi.org/10.24432/C5CG6D (CC BY 4.0). Used only to evaluate the forecaster.
* **Images:** illustrations in `frontend/src/assets` were generated with Google Gemini.
  Product pack photos in `backend/static/images/products` are used for the demo only.
* **AI coding assistants:** this project was built with help from AI coding assistants
  (Claude Code by Anthropic).
