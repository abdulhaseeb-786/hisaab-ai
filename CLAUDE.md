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

## Commands

```bash
cd backend && uvicorn app.main:app --port 8000 --reload
cd backend && python -m pytest tests -q          # uses a temp DB, never hisaab_ai.db
cd backend && python -m app.simulator.reset      # rebuild demo data
cd frontend && npm run dev
cd frontend && npm run typecheck
cd frontend && npm run gen:api                   # after ANY backend schema change
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
  re-seeds when the schema version or date changes (`DEMO_AUTO_REFRESH`).

## Invariants

- No hard-coded business numbers in the frontend. If a screen needs a number, add it
  to an API response.
- One function per number: payables (`analytics/payables.py`), cash (`cash_book.py`),
  khata (`credit_aging.py`). Dashboard, cash outlook and copilot all call these.
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
- Navigation: bottom bar (phone) / sidebar (desktop): Aaj, Khareedari, Stock, Khata, Cash.
- Tutorial: `src/onboarding/` (language pick, 4 slides with live data, spotlight tour on
  `data-tour` targets). Stored in localStorage `hisaab_onboarding_v1`.
- Money shows as "Rs 12,500" everywhere, including backend text.

## Status

- Phase 0 (foundations and backend/frontend integration): done.
- Phase 1 (shopkeeper-first redesign and tutorial): done.
- Phase 2 (landing page at `/`, app moved to `/app`, khata register on Today, wasool
  stamp, cash week chart, animated buy list): done.
- Public benchmark: waiting for the user to place `online_retail_II.xlsx` in
  `backend/datasets/raw/`; then run the two scripts in README. Do not download it.
