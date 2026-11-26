# HisaabAI PRD v0.2 – Hackathon Edition (CYE 2026)

Retail decision-support for Pakistani general stores. Updated from v0.1 using the earlier evaluation and the Capital Youth Expo Hackathon (Innovation Sprint) rules.

## 0. What changed from v0.1

| Area | v0.1 | v0.2 |
| --- | --- | --- |
| Timeline | 6–12 week style plan | **2-day plan.** Submission closes Nov 28, 2026, 6:59 PM |
| Track | Not chosen | **Track 3 – FinTech & Financial Inclusion (SME solutions)**; Urdu/Roman Urdu is the differentiator |
| Data entry | CSV import = Stretch | **CSV import = Must** (products + sales, with preview and row errors) |
| Language / device | Desktop-first, English-only Must | **Mobile-first** key screens; **Roman Urdu copilot = Must** |
| Home screen | KPI dashboard | **"Today's 3 actions"** first, KPIs second |
| Supplier payables | Mentioned, not modeled | New **SupplierLedgerEntry**; shown in planner and cash outlook |
| Forecast validation | Synthetic data only | Also evaluated on **one public retail dataset**; synthetic accuracy is never used as proof |
| Ramadan / Eid | Not assumed | **Built into the simulator** and used as forecast features |
| Overdue credit | No due date = never overdue | **Default 30-day credit term** (configurable) |
| Data model | No price history, pack sizes, or open orders | Added **PriceHistory, ProductPack, received\_qty**; reorder rounds to packs |
| Seed size | 300–800 SKUs | **100–150 SKUs** (enough for realism, feasible in 2 days) |
| Merchant validation | Mentioned only | **3–5 shopkeeper conversations** are a deliverable, shown in the deck |
| Demo | 90 seconds, 8 steps | **2-minute video** (5 steps) + 5-minute core pitch expandable to 20 minutes |

## 1. Product Summary

HisaabAI turns a small shop's records (sales, stock, costs, supplier prices, customer credit) into three things an owner can act on: what to buy today within a budget, which products are losing margin, and who owes money. It is not a POS or a khata app. Numbers come from backend logic; the LLM only explains them, in English or Roman Urdu.

**One hero flow for the whole project:** *"I have PKR 50,000. What should I buy today and why?"* Everything else exists to support that answer.

## 2. Hackathon Constraints and Fit

| Rule (from the competition page) | What it means for us |
| --- | --- |
| Online build window Nov 16–28, 2026 | Core logic must be built inside the window. If any code was written before Nov 16, rebuild it or disclose it in the README. Undisclosed pre-built work = disqualification |
| Submission deadline | Page header says Nov 28, 6:59 PM; the requirements text says 11:59 PM. **Plan for 6:59 PM** and submit with buffer |
| Registration | Page lists registration closing Nov 26, 6:59 PM. If not registered, do this first |
| Team | 1–5 currently enrolled students |
| Mandatory submission | 1) Public GitHub/GitLab repo with full source and clear README; 2) live deployment link plus max 2-minute video walkthrough; 3) slide deck (PDF or PPTX) |
| Disclosure | README must list every external API and library (LLM API, chart library, forecasting libraries, public dataset, AI coding assistants) |
| Finale (Dec 2) | 20-minute live presentation + 10-minute jury Q&A. The judging text also mentions a 5-minute pitch, so prepare a 5-minute core that can expand |
| Judging | 25% each: Innovation & Creativity; Technical Execution & Functionality; Real-World Impact & Viability; Presentation, UI/UX & Pitch Clarity |

## 3. Scope

### Must (finish by end of Nov 27)

- Synthetic store simulator: 100–150 SKUs, 6–12 months of sales, purchases, stock movements, customer ledger, supplier prices, Ramadan/Eid demand effects, fixed seed, reset command, "Demo Data" label.
- CSV import for products and sales: preview before commit, row-level error report.
- Home screen: "Today's 3 actions" (e.g. buy X, fix price on Y, call customer Z) plus KPI cards. Mobile-first.
- Inventory: stock cover, stockout risk, dead-stock signal, with the reason shown.
- 7-day demand forecast with baseline comparison and a quality label.
- Margin insight: supplier cost up, selling price unchanged, with evidence.
- Budget reorder planner: enter PKR budget, get a ranked purchase list that respects budget, pack sizes, MOQ, and pending orders.
- Credit summary: balances, aging with a default 30-day term.
- Copilot: English and Roman Urdu, allow-listed read-only tools, graceful fallback if the LLM is down.
- Unit tests for calculations and budget constraint; deployed live link.

### Should (only if Must is done)

- Supplier payables view and a simple 7-day cash outlook (receivables in, payables and expenses out).
- Supplier cost comparison; collection follow-up list; stock movement history.
- Urdu script UI.

### Deferred (model only, no build)

Stock adjustment workflow, role permission UI, 14/30-day cash forecast, transaction entry UI, receive-purchase-order flow, import from khata apps, WhatsApp, OCR, multi-branch.

## 4. Key Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| DATA-01 | Seeded store loads from a fixed seed; reset restores the exact state | Must |
| DATA-02 | CSV import of products and sales with preview and row-level errors | Must |
| DATA-03 | Integrity checks: sale totals, stock vs movements, ledger balances | Must |
| HOME-01 | "Today's 3 actions" ranked by a visible rule; each action has evidence and a next step | Must |
| HOME-02 | KPI cards: revenue, gross profit, inventory value at cost, receivables | Must |
| INV-01 | Product list, search, category filter, product detail | Must |
| INV-02 | Days of cover and stockout risk vs lead time plus safety stock; unknown demand handled safely | Must |
| INV-03 | Dead-stock signal with configurable lookback, never stated as certainty | Must |
| FC-01 | 7-day forecast per SKU or category; chronological split, no future leakage | Must |
| FC-02 | Baseline comparison (last-week-same-day, moving average); fallback for sparse items with reason shown | Must |
| FC-03 | Calendar features include Ramadan and Eid from the simulator's lunar-calendar dates | Must |
| PROF-01 | Product margin from PriceHistory; flag low or negative margin and cost-driven change | Must |
| REC-01 | Reorder point = lead-time demand + safety stock | Must |
| REC-02 | Order quantity = target stock − on hand − pending (ordered minus received); floor at zero; **round up to pack size and MOQ** | Must |
| REC-03 | Budget input in PKR; total spend never exceeds budget; ranking rule documented | Must |
| REC-04 | Each line shows demand, stock, lead time, cost, urgency | Must |
| CRED-01 | Balances reconcile to ledger; aging buckets use due date, or default 30-day term when none | Must |
| COP-01 | Answers only from tool outputs; shows date range and metric definition | Must |
| COP-02 | English and Roman Urdu responses; tools and calculations are language-independent | Must |
| COP-03 | No arbitrary SQL or code; unknown metrics get a clear "data not available" answer | Must |
| COP-04 | LLM outage does not break dashboard, planner, or insights | Must |
| CASH-01 | 7-day cash outlook including supplier payables, with assumptions shown | Should |

## 5. Business Rules (changes and key definitions)

| Rule | Definition |
| --- | --- |
| Gross profit | Revenue − COGS using unit cost snapshot on the sale line. Not net profit |
| Inventory value | Quantity × last recorded cost (disclosed on screen) |
| Days of cover | Stock ÷ average daily demand; "unknown" if demand is zero or too little data |
| Reorder quantity | Target stock − on hand − pending receipts, rounded up to pack size and MOQ, floor zero |
| Budget allocation | Rank by urgency (cover vs lead time) then margin contribution; add lines until budget is used; never exceed budget; compare against a simple proportional baseline in tests |
| Overdue credit | Past due date; if no due date, use the store's default credit term (30 days, configurable) from the charge date |
| Cash outlook | Opening cash + expected receivable collections − payables due − expenses; only recorded or seeded assumptions |
| Dead stock | Stock > 0 and no sales in the lookback window (a signal, not a verdict) |

## 6. Data Model (minimum)

All v0.1 entities stay (Store, Product, Sale, SaleLine, Purchase, PurchaseLine, StockMovement, Customer, LedgerEntry, Supplier, SupplierProduct, Expense, Insight, Forecast, PurchasePlan, PurchasePlanLine). Changes:

- **PriceHistory (new):** product\_id, effective\_date, cost\_price, selling\_price. Required for margin-change detection.
- **ProductPack (new):** product\_id, pack\_unit (carton, bag, case), units\_per\_pack, sell\_unit (piece, kg, litre). Reorder quantities round to packs.
- **PurchaseLine:** add received\_qty so pending = qty − received\_qty.
- **SupplierProduct:** add pack\_size and MOQ (nullable).
- **SupplierLedgerEntry (new):** supplier\_id, timestamp, debit, credit, due\_date nullable, reference. Supports payables.
- **Store:** add default\_credit\_term\_days (default 30).
- All queries are store-scoped from day one. Demo customers use aliases only.

## 7. Data Strategy

- **Simulator (required):** one general store, 100–150 SKUs across about eight grocery and household categories, with weekday/weekend patterns, Ramadan and Eid uplift, supplier lead-time variation, credit sales and partial repayments, and expenses.
- **Seeded scenarios for the demo:** cooking oil nearing stockout, supplier price rise with unchanged shelf price, dead-stock item, overdue customer, limited purchase budget.
- **Public dataset:** use one public retail sales dataset (for example M5 or Favorita, license permitting) only for forecast evaluation. List it in the README.
- **Merchant conversations:** talk to 3–5 shopkeepers. Ask how they track stock, how they decide what to buy, whether they buy on credit from distributors, and whether they would use this on a phone. Put 2–3 findings on a slide.
- **Honesty rule:** synthetic accuracy numbers are never presented as real-world proof. State this on the slide.

## 8. Analytics and Forecast Evaluation

- Baselines first: last-week-same-day and moving average. Add exponential smoothing or a gradient-boosted model only if it beats both on held-out data.
- Chronological split only. Report MAE and WAPE, at category level and SKU level separately.
- Run the same comparison on the public dataset and report it next to the synthetic result.
- Sparse SKUs use the baseline fallback and say so in the UI.
- Stock risk, margin, dead stock, and credit are deterministic rules with visible thresholds.

## 9. Architecture and API

Modular monolith: React + TypeScript frontend (mobile-first), FastAPI backend, PostgreSQL or SQLite, Python analytics module, provider-agnostic LLM wrapper. Deploy to a public URL; keep a recorded fallback of the demo in case the live LLM fails.

| Endpoint | Purpose |
| --- | --- |
| GET /api/actions/today | Top 3 ranked actions with evidence |
| GET /api/dashboard?period= | KPIs and trends |
| GET /api/products, /api/products/{id} | Inventory and detail |
| POST /api/import/csv | Preview and commit products or sales |
| POST /api/forecast | Forecast with baseline and quality label |
| GET /api/insights | Margin, stock, credit insights |
| POST /api/reorder-plan | Budget-constrained plan with pack rounding |
| GET /api/credit/summary | Receivables and aging |
| GET /api/payables/summary | Supplier balances (Should) |
| POST /api/copilot/chat | Tool-grounded assistant, English or Roman Urdu |
| POST /api/demo/reset | Reset seeded state (guarded) |

Rules: no hard-coded metrics in the frontend; typed schemas with OpenAPI; recommendation logic testable without the UI or LLM; secrets only in environment variables.

## 10. Definition of Done

- Public repo with README: setup, run, seed/reset commands, and a disclosure list of every external API, library, dataset, and AI assistant used.
- Live deployment link works from a phone and a laptop.
- Demo data loads, is labeled, and reconciles (integrity checks pass).
- CSV import works on a sample file, including a file with bad rows.
- Today's 3 actions, inventory, forecast with baseline, margin insight, reorder planner, and credit summary all work from API data.
- Planner never exceeds the budget; unit tests cover this and the core formulas.
- Copilot answers the hero question and four more in English and Roman Urdu; an unknown question returns a data-gap message, not an invented number.
- With the LLM disabled, everything except the copilot still works.
- 2-minute video, slide deck (PDF or PPTX), and merchant-conversation slide are ready.

## 11. Two-Day Plan (ends Nov 28, 6:59 PM)

| When | Goal |
| --- | --- |
| Today, Nov 26 | Confirm registration and track; repo, schema, simulator, deploy a skeleton; agree API contract; start shopkeeper conversations |
| Nov 27 (day) | Analytics: stock risk, forecast and baselines, margin insight, planner, credit; frontend home, inventory, planner |
| Nov 27 (night) | Copilot tools and Roman Urdu prompts; CSV import; tests; **feature freeze** |
| Nov 28 (morning) | Bug fixes only; README and disclosures; record the 2-minute video |
| Nov 28 (by early afternoon) | Slide deck; submit repo, live link, video, deck. Leave several hours of buffer before 6:59 PM |

Suggested owners (adjust to team size): frontend/UX; backend and data; analytics and forecast; integration, copilot, demo and pitch.

## 12. Demo Video (2 minutes) and Pitch

**Video script (5 steps, all from seeded data, labeled Demo Data):**

1. Open home on a phone: Today's 3 actions (cooking oil nearly out, margin squeeze, overdue customer).
2. Tap cooking oil: forecast vs baseline, stock cover, stockout risk.
3. Open margin insight: supplier cost up, shelf price unchanged, evidence shown.
4. Reorder planner: enter PKR 50,000; ranked list within budget, rounded to cartons.
5. Ask the copilot in Roman Urdu: "Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?" and show the tool-backed answer.

**5-minute core pitch:** problem (shopkeepers have records but no decisions), live hero flow, how numbers are computed (not guessed), what shopkeepers told us, honest limits (synthetic data, estimates), next step (pilot with real shops). Expand to 20 minutes with architecture, forecast evaluation, and tests. Prepare for jury Q&A on data source, accuracy, and why anyone would pay.

## 13. Evaluation Against the Judging Rubric

| Criterion (25% each) | Strength in v0.2 | Biggest risk | What to do |
| --- | --- | --- | --- |
| Innovation & Creativity | Budget-constrained buying plan, evidence-backed insights, Roman Urdu copilot; Ramadan/Eid-aware | Can look like a generic dashboard | Lead with the hero flow, not the charts; show the "why" on every recommendation |
| Technical Execution & Functionality | Deterministic logic, tests, baselines, LLM fallback, live deployment | Too much scope in 2 days; LLM or hosting failing during judging | Hold the Must list; freeze Nov 27 night; keep a recorded fallback; test the live URL on mobile data |
| Real-World Impact & Viability | FinTech/SME fit; CSV import gives a path to real data; shopkeeper findings on a slide | Synthetic data; willingness to pay unproven | Do the 3–5 conversations; say clearly what is simulated; propose a small pilot |
| Presentation, UI/UX & Pitch Clarity | Mobile-first, one clear story, 2-minute video | Long feature tour instead of one story; video over 2 minutes | Rehearse the 5-step script; cut anything off the hero path |

**Overall:** the idea is strong for Track 3 and is now achievable in the time left, but only if the team builds the Must list and nothing else. The two things most likely to lose points are scope creep and unproven real-world data, so protect the freeze time and get the shopkeeper input.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Only 2 days left | Strict Must list; defer the rest; feature freeze Nov 27 night |
| Pre-window code counted as undisclosed pre-built work | Rebuild core logic in the window or disclose it clearly in the README |
| Deadline wording differs (6:59 PM vs 11:59 PM) | Treat 6:59 PM Nov 28 as final; submit early |
| LLM outage or rate limit during judging | Non-LLM features still work; recorded fallback video; cache demo answers only as a last resort and label them |
| Synthetic data looks fake | Label it, calibrate with public data, show shopkeeper findings, never claim real-world accuracy |
| Forecast not better than baseline | Show the baseline honestly; a clear comparison is still a good result |
| Registration closes today | Confirm registration before anything else |

## 15. Roadmap (not in this submission)

Pilot with 3–5 real shops using CSV import; import from khata apps; transaction entry; barcode and receipt workflows; OCR invoices; WhatsApp daily digest; supplier ordering with approval; multi-branch; other store types.
