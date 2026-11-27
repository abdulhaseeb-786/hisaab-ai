"""Store clock.

Every timestamp in the database is a *naive* datetime in the store's local time
(Asia/Karachi). All analytics must read "now" from here so that the simulator,
the analytics and the API agree on what "today" means.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings

STORE_TZ = ZoneInfo(settings.STORE_TIMEZONE)


def store_now() -> datetime:
    """Current wall-clock time in the store's timezone, as a naive datetime."""
    return datetime.now(STORE_TZ).replace(tzinfo=None, microsecond=0)


def store_today() -> date:
    return store_now().date()


def start_of_day(d: date) -> datetime:
    return datetime.combine(d, time.min)


def days_ago(n: int, ref: datetime | None = None) -> datetime:
    """Midnight `n` days before the reference day (default: today)."""
    ref_day = (ref or store_now()).date()
    return start_of_day(ref_day - timedelta(days=n))
