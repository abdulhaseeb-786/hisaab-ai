# HisaabAI (CYE 2026): notes for Claude

Decision support for Pakistani general-store owners. Hackathon: Capital Youth Expo 2026,
Track 3. PRD: `HisaabAI PRD v0.2 – Hackathon Edition (CYE 2026).md`. Audience is
shopkeepers: ease of use first, then hackathon polish.

## Working agreements

- **No commits, pushes or branches** unless the user asks.
- **Do not deploy** until the user says so (planned for the end).
- **The user tests by hand.** Reproduce issues on real data or a running server, fix the
  root cause, add a regression test, verify end to end, and say what still needs their
  action (for example "restart the backend").
- **The user may have servers running** (uvicorn `--reload` on :8000, Vite on :5173).
  For your own live checks, run a separate backend on another port with a scratch
  `DATABASE_URL`, and Vite with `BACKEND_URL=http://127.0.0.1:<port> npx vite --port <p>`.
- **Never read or print API keys** (`backend/.env`). `/api/store` reports only whether
  a key is configured.
- Bash heredocs with quotes break in this shell; use the Write tool or a script file.
- **No WhatsApp or SMS integration** (the user's decision: security and Meta policy).
  Every receipt, reminder, order and offer is a `MessageDraft` on screen: show, read out,
  or copy. Never add wa.me links or any sending.

## Commands

```bash
cd backend && uvicorn app.main:app --port 8000 --reload
cd backend && python -m pytest tests -q          # uses a temp DB, never hisaab_ai.db
cd backend && python -m app.simulator.reset      # rebuild demo data
cd frontend && npm run dev
cd frontend && npm run typecheck
cd frontend && npm run gen:api                   # after ANY backend schema change
cd frontend && node e2e/workflow.mjs e2e-shots   # browser walk of every workflow (scratch servers only, see file header)
```

## Architecture

- Backend: FastAPI + SQLAlchemy + SQLite. Every endpoint has a Pydantic `response_model`
  (`app/schemas/`), exported to `frontend/src/api/openapi.json` → `schema.d.ts`.
- Frontend: React 18 + TypeScript (strict) + Vite + Tailwind + TanStack Query +
  React Router. Use `@/api/queries.ts` hooks and `@/api/types.ts` aliases; never
  hand-write response shapes. Mutations invalidate store data automatically.
- Store time: all timestamps are naive Asia/Karachi; read "now" from `app/core/clock.py`.
- Calendar (Ramadan/Eid): `app/core/calendar_pk.py`, shared by simulator and forecaster.
- Demo data: `app/simulator/seed_generator.py`, seed 42, 365 days ending today. Startup
  re-seeds when the schema version or date changes (`DEMO_AUTO_REFRESH`). Bump
  `SCHEMA_VERSION` whenever models or seeded data change. `simulator/day_history.py`
  adds 30 days of galla open/close counts after the main simulation.
- Workflows that write records live in `app/services/` (`day`, `khata`, `orders`,
  `stock_count`, `report`); read-only numbers stay in `app/analytics/`. Routers:
  `api/day.py` (day loop, kharcha), `api/credit.py` (customers, udhaar, check, wasooli),
  `api/workflow.py` (orders, maal aaya, supplier payments, ginti, business report).

## Invariants

- No hard-coded business numbers in the frontend. If a screen needs a number, add it
  to an API response.
- One function per number: payables (`analytics/payables.py`), cash (`cash_book.py`),
  khata (`credit_aging.py`). Dashboard, cash outlook and copilot all call these.
- Cash book: only cash moves the galla. Wasooli and supplier payments carry `method`
  (cash / easypaisa / jazzcash / bank; NULL means cash in old rows). Galla differences
  found at open/close are `CashAdjustment` rows, so expected cash always equals the count.
- Every udhaar is itemised: a `Sale` (payment_type udhaar) with lines, stock movements, and
  a `LedgerEntry` with `sale_id` and a due date. The khata history shows the items.
- Order budget = the lowest projected cash in the week after the new bill falls due
  (delivery + credit days), minus safety cash, with orders on the way paid on their own
  due dates; suggested budget caps that at 1.5x the usual order from that distributor.
- Maal aaya updates cost price, `PriceHistory` and `SupplierProduct.unit_cost` when the
  bill rate differs by more than 0.5%, and creates the supplier bill.
- Ginti sets stock to the count; a shortfall is booked as loss (adjustment) or as cash
  sales not written down (a `Sale`), the shopkeeper's choice.
- In React, show a save result from the mutation hook in a component that stays mounted
  (not a per-call `onSuccess` in a child): saving refetches data and can unmount the child.
- Buttons inside a `<form>` that do not submit need `type="button"`.
- The reorder plan never exceeds the budget (guard + tests).
- The copilot only uses allow-listed read-only tools; LLM answers with numbers but no
  tool call are discarded.
- Simulated accuracy is never presented as real-world accuracy.
- Analytics text comes in English and Roman Urdu (`*_ur` fields); the UI uses `pick()`.

## Design system (Phase 1)

- Tokens in `frontend/tailwind.config.js`: paper `#F6F7F3`, ink `#17201B`, sabz `#0E6B3F`
  (actions), haldi `#E8A317` (money/attention), lal `#C0392B` (urgent only), neela (rules).
- Font: Atkinson Hyperlegible Next (chosen for low-vision readability; its slashed zero
  is intentional). Base size 17px. Noto Nastaliq only for the حساب wordmark.
- Signature: the ledger family. The red khata register (`RegisterBook`, closed cover =
  loading state, opens once per session) and the "parchi" slip for Today's 3 jobs. Keep the rest quiet:
  no gradients, no all-caps labels, no arrows on buttons.
- Every status = icon + words (never colour alone). Touch targets >= 44px.
- Dialogs: `components/ui/Sheet.tsx` (bottom sheet on phones, side panel on desktop).
- Navigation: bottom bar (phone) / sidebar (desktop): Aaj, Khata, Order, Stock, Hisaab.
  Budget plan (`/app/buy`) and Store map are secondary. `/app/cash` redirects to Hisaab.
- Today: day bar (open / close the galla), five quick actions (+ Udhaar, + Wasooli, Order
  booker, Maal aaya, Kharcha), the register, the 3 jobs. Entry sheets are opened through
  `UiContext` (`openDay`, `openUdhaar`, `openWasooli`, `openExpense`, `openReceive`,
  `openPaySupplier`) and mounted once in `AppShell`.
- Saved money events get a stamp (`Stamp` in `ui/Fields.tsx`): ادھار, وصول, مال آیا,
  دکان کھلی, حساب بند, گنتی.
- Tutorial: `src/onboarding/` (language pick, 4 slides with live data, spotlight tour on
  `data-tour` targets). Stored in localStorage `hisaab_onboarding_v2` (bump when the tour changes).
- Money shows as "Rs 12,500" everywhere, including backend text.

## Status

- Phase 0 (foundations and backend/frontend integration): done.
- Phase 1 (shopkeeper-first redesign and tutorial): done.
- Phase 2 (landing page at `/`, app moved to `/app`, khata register on Today, wasool
  stamp, cash week chart, animated buy list): done.
- Landing is scroll-driven (`src/landing/`): Reveal/DrawArrow/CountUp in `motion.tsx`,
  the pinned "day at the shop" story in `DayStory.tsx` (live data, real copilot answer).
  Every motion must carry meaning; all of it respects reduced motion.
- Tests are clock-aware: before the simulated shop opens (first hour in HOUR_WEIGHTS),
  "today" honestly has no sales.
- Daily workflow (features 1 to 5): done. Day open/close with galla reconciliation and
  tomorrow's plan; itemised udhaar with "Udhaar dun?" and on-screen receipts; wasooli by
  method; kharcha; order booker flow with safe budget, maal aaya with rate-change flags,
  supplier payments; ginti with inferred sales; printable business report for lenders
  (`/app/report`). Backend tests: `tests/test_workflows.py`. Browser: `frontend/e2e/workflow.mjs`.
- Voice entry "bol kar likhein", Phase A (udhaar, wasooli, kharcha): done. Backend
  `app/voice/` (`numbers.py` Urdu number words, `names.py` khata matching, `text_parser.py`
  offline tier, `llm.py` Gemini audio / Groq Whisper, `service.py` understand → confirm),
  router `api/voice.py`, model `VoiceCapture`. Frontend `src/voice/` (`VoiceSheet`, hold-to-talk
  `MicButton`, `recorder.ts` → 16 kHz WAV, `speak.ts` browser read-back, `sentence.ts`).
  Rules: nothing is saved before "Haan, likh do"; an amount is kept only if it is in the words
  heard; a shared surname is never a match; cloud needs the owner's consent
  (`Store.voice_cloud_allowed`); recordings live in `VOICE_DIR` (`backend/data/voice`, gitignored)
  and are cleared on reseed. Naqad udhaar = `LedgerEntry.kind="cash_loan"`, taken out of the
  galla by the cash book. Tests: `tests/test_voice.py`. Browser: `frontend/e2e/voice.mjs <wav>`
  (fake mic).
- Voice Phase C (questions): done. Intent "question" (offline: `text_parser._is_question`; AI:
  `question_roman`, kept in the owner's language with exact names). `service._answer_question`
  sends it to `chat_with_copilot` (same tools and number guard); nothing is written, capture
  status "answered". `answer_language` "urdu" (Urdu script) when the device has an Urdu voice, so
  it can be read aloud. The offline copilot treats a named customer + no product as a khata
  question. Browser: `frontend/e2e/voice-ask.mjs <wav>`.
- Voice Phase B (goods with items): done. `app/voice/items.py`: everyday names (`ALIASES`: cheeni,
  chawal, sabun, anday...), quantities ("do kilo", "aadha kilo", "paav", "darjan"), size-aware
  matching ("5 kilo atta" = the 5 kg bag), conversion to the product's unit ("6 anday" = 0.5
  dozen). Rules: a quantity comes only from the words said (else 1, flagged); prices are always
  shelf prices; ties ("Dalda": oil or ghee?) are never picked, the shopkeeper chooses (sorted by
  30-day sales); an AI product hint only breaks a tie; AI items not in the transcript are dropped.
  A cash-loan khata line may also carry goods: only `debit - sale.total` leaves the cash box
  (`cash_book.cash_lent`, the one function for that number). Browser: `frontend/e2e/voice-goods.mjs <wav>`.
- Gemini: Google retires model names (404) and overloads new ones (503). All calls go through
  `core/gemini_models.generate`, which falls through `GEMINI_FALLBACK_MODELS`. A busy model rests
  60 s at the back of the line (one voice question = several calls), then is first again (lite
  fallbacks hear Urdu worse).
- improve01.md (workflow rhythm), done so far: (1) product sheet has no manual "delivery":
  deliveries go through Maal aaya (pending order) or Order; manual is only corrections.
  (2) One Order screen: `?mode=budget` = whole-shop planner (`BudgetPlanner` in BuyPage.tsx),
  saved via `POST /api/orders/from-plan` (all or nothing, never over budget); `/app/buy`
  redirects; restock links use `?product=` / `?supplier=`. (3) Today follows the day state;
  `day/today` returns `tomorrow` after closing (`TomorrowBrief`, shared with DaySheet).
  (5) Welcome = one-tap language; tour is 4 steps ending on the mic. (6) Closing udhaar /
  wasooli opened from a customer returns to that customer (`returnToCustomer`).
  Tests: `tests/test_improvements.py`; browser `frontend/e2e/improve01.mjs`.
  (4) One assistant: the voice sheet handles entries and questions; phones have a raised
  centre mic above the 5 tabs (user's choice), desktop one "Talk to HisaabAI" button; no Ask
  pill, no Today banner. "Follow-up in chat" opens CopilotSheet seeded with the Q&A
  (`openCopilot(prompt, seed)`). The copilot prompt lists the app's real screens (no "POS").
  Open: polish (Hisaab tabs, Stock List/Ginti/Map switcher, job-done stamp, collection queue).
- UI wording: user-facing text says "cash box" (Roman Urdu too), not "galla"; identifiers keep `galla`.
- Public benchmark: waiting for the user to place `online_retail_II.xlsx` in
  `backend/datasets/raw/`; then run the two scripts in README. Do not download it.
