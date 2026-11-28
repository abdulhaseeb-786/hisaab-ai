"""Day sessions for the demo shop: the last month of opening and closing the galla.

Runs after the main simulation, because the expected cash at each open and close is
worked out from the records (cash_position). Most nights the galla matches exactly; on
a few it is a little short or over, the way it happens at a real counter, and that
difference is booked as a CashAdjustment.
"""

from __future__ import annotations

import random
from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from app.analytics.cash_book import cash_position
from app.models import CashAdjustment, DaySession

HISTORY_DAYS = 30
OPEN_AT = time(8, 0)
CLOSE_AT = time(22, 40)
STORE_ID = 1


def seed_day_sessions(db: Session, now: datetime, seed: int) -> None:
    rng = random.Random(seed + 2)
    today = now.date()
    for back in range(HISTORY_DAYS, 0, -1):
        day = today - timedelta(days=back)
        opened = datetime.combine(day, OPEN_AT)
        closed = datetime.combine(day, CLOSE_AT)
        open_expected = cash_position(db, STORE_ID, opened)["cash_in_hand_pkr"]
        close_expected = cash_position(db, STORE_ID, closed)["cash_in_hand_pkr"]
        diff = 0.0 if rng.random() < 0.8 else float(rng.choice([-500, -200, -100, -50, 50, 100]))
        session = DaySession(
            store_id=STORE_ID, business_date=day, opened_at=opened,
            opening_expected=open_expected, opening_counted=open_expected,
            closed_at=closed, closing_expected=close_expected, closing_counted=close_expected + diff,
        )
        db.add(session)
        db.flush()
        if diff:
            db.add(CashAdjustment(
                store_id=STORE_ID, timestamp=closed, amount=diff, session_id=session.session_id,
                reason="Cash box short at closing" if diff < 0 else "Extra cash in cash box at closing",
            ))
            db.flush()

    opened_today = datetime.combine(today, OPEN_AT)
    if now >= opened_today:
        expected = cash_position(db, STORE_ID, opened_today)["cash_in_hand_pkr"]
        db.add(DaySession(store_id=STORE_ID, business_date=today, opened_at=opened_today,
                          opening_expected=expected, opening_counted=expected))
    db.commit()
