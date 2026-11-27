"""Pakistani retail calendar: Ramadan, Eid ul Fitr and Eid ul Adha.

Islamic dates depend on moon sighting, so these are the expected dates for Pakistan
and can be off by one day. They are used by the simulator (demand uplift) and by the
forecaster (calendar features), so both always agree.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

# (ramadan_start, eid_ul_fitr, eid_ul_adha), expected dates for Pakistan.
_ISLAMIC_YEARS: dict[int, tuple[date, date, date]] = {
    2024: (date(2024, 3, 12), date(2024, 4, 10), date(2024, 6, 17)),
    2025: (date(2025, 3, 2), date(2025, 3, 31), date(2025, 6, 7)),
    2026: (date(2026, 2, 19), date(2026, 3, 21), date(2026, 5, 27)),
    2027: (date(2027, 2, 9), date(2027, 3, 11), date(2027, 5, 17)),
    2028: (date(2028, 1, 29), date(2028, 2, 28), date(2028, 5, 5)),
}

EID_DAYS = 3


@dataclass(frozen=True)
class DayContext:
    """Calendar flags for one day. Every flag is a plain boolean so it is easy to explain."""

    day: date
    is_ramadan: bool
    is_pre_eid_fitr: bool  # last 7 days of Ramadan: Eid shopping
    is_eid_ul_fitr: bool
    is_pre_eid_adha: bool  # 7 days before Eid ul Adha: spices, oil
    is_eid_ul_adha: bool
    is_salary_week: bool  # 1st-7th of the month
    is_summer: bool  # May-August
    is_winter: bool  # December-February

    @property
    def label(self) -> str | None:
        if self.is_eid_ul_fitr:
            return "Eid ul Fitr"
        if self.is_eid_ul_adha:
            return "Eid ul Adha"
        if self.is_pre_eid_fitr:
            return "Chaand Raat shopping"
        if self.is_ramadan:
            return "Ramadan"
        if self.is_pre_eid_adha:
            return "Before Eid ul Adha"
        return None


def _year_dates(year: int) -> tuple[date, date, date] | None:
    return _ISLAMIC_YEARS.get(year)


def day_context(d: date) -> DayContext:
    is_ramadan = is_pre_eid_fitr = is_eid_fitr = is_pre_adha = is_eid_adha = False
    for year in (d.year - 1, d.year, d.year + 1):
        dates = _year_dates(year)
        if not dates:
            continue
        ramadan_start, eid_fitr, eid_adha = dates
        if ramadan_start <= d < eid_fitr:
            is_ramadan = True
            if d >= eid_fitr - timedelta(days=7):
                is_pre_eid_fitr = True
        if eid_fitr <= d < eid_fitr + timedelta(days=EID_DAYS):
            is_eid_fitr = True
        if eid_adha - timedelta(days=7) <= d < eid_adha:
            is_pre_adha = True
        if eid_adha <= d < eid_adha + timedelta(days=EID_DAYS):
            is_eid_adha = True

    return DayContext(
        day=d,
        is_ramadan=is_ramadan,
        is_pre_eid_fitr=is_pre_eid_fitr,
        is_eid_ul_fitr=is_eid_fitr,
        is_pre_eid_adha=is_pre_adha,
        is_eid_ul_adha=is_eid_adha,
        is_salary_week=d.day <= 7,
        is_summer=d.month in (5, 6, 7, 8),
        is_winter=d.month in (12, 1, 2),
    )


def upcoming_events(start: date, days: int = 30) -> list[dict]:
    """Named calendar events in [start, start+days), used to explain forecasts."""
    events: list[dict] = []
    for year in (start.year, start.year + 1):
        dates = _year_dates(year)
        if not dates:
            continue
        ramadan_start, eid_fitr, eid_adha = dates
        for name, d in (("Ramadan starts", ramadan_start), ("Eid ul Fitr", eid_fitr), ("Eid ul Adha", eid_adha)):
            if start <= d < start + timedelta(days=days):
                events.append({"name": name, "date": d.isoformat()})
    return events
