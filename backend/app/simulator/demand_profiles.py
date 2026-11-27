"""Demand profiles for the simulated store.

`BASE_DAILY_UNITS` is the average number of sell units (pouches, kg, packets...) a
mid-sized Islamabad general store sells per day on a normal weekday. Seasonal and
calendar effects multiply this base. All numbers are illustrative assumptions for the
demo, not measured data.
"""

from __future__ import annotations

from app.core.calendar_pk import DayContext

BASE_DAILY_UNITS: dict[str, float] = {
    # Cooking oil & ghee
    "OIL-001": 3.0, "OIL-002": 0.4, "OIL-003": 1.5, "OIL-004": 1.6, "OIL-005": 1.0,
    "OIL-006": 1.2, "OIL-007": 1.0, "OIL-008": 0.8, "OIL-009": 0.9, "OIL-010": 0.8,
    "OIL-011": 0.3, "OIL-012": 0.08,
    # Grains & pulses
    "GRN-001": 2.5, "GRN-002": 1.5, "GRN-003": 12.0, "GRN-004": 0.4, "GRN-005": 0.3,
    "GRN-006": 4.0, "GRN-007": 2.5, "GRN-008": 1.8, "GRN-009": 2.2, "GRN-010": 1.2,
    "GRN-011": 1.5, "GRN-012": 1.2, "GRN-013": 1.5, "GRN-014": 1.5, "GRN-015": 1.0,
    "GRN-016": 3.0, "GRN-017": 0.6, "GRN-018": 0.5,
    # Tea
    "TEA-001": 2.5, "TEA-002": 0.8, "TEA-003": 0.6, "TEA-004": 1.2, "TEA-005": 1.0,
    "TEA-006": 0.4, "TEA-007": 0.8, "TEA-008": 0.4,
    # Beverages
    "BEV-001": 0.6, "BEV-002": 0.5, "BEV-003": 0.5, "BEV-004": 0.4, "BEV-005": 3.0,
    "BEV-006": 1.5, "BEV-007": 2.5, "BEV-008": 4.0,
    # Spices & condiments
    "SPC-001": 1.4, "SPC-002": 1.2, "SPC-003": 1.0, "SPC-004": 1.1, "SPC-005": 0.4,
    "SPC-006": 0.7, "SPC-007": 0.8, "SPC-008": 0.9, "SPC-009": 1.0, "SPC-010": 0.9,
    "SPC-011": 0.8, "SPC-012": 0.5, "SPC-013": 0.4, "SPC-014": 0.8, "SPC-015": 0.5,
    "SPC-016": 1.0,
    # Dairy & breakfast
    "DRY-001": 6.0, "DRY-002": 4.0, "DRY-003": 5.0, "DRY-004": 3.0, "DRY-005": 1.2,
    "DRY-006": 0.5, "DRY-007": 4.0, "DRY-008": 0.6, "DRY-009": 0.5, "DRY-010": 0.4,
    "DRY-011": 0.8, "DRY-012": 6.0, "DRY-013": 4.0, "DRY-014": 4.0, "DRY-015": 0.4,
    "DRY-016": 0.4,
    # Cleaning & laundry
    "CLN-001": 1.5, "CLN-002": 1.5, "CLN-003": 0.9, "CLN-004": 0.8, "CLN-005": 1.0,
    "CLN-006": 2.5, "CLN-007": 0.6, "CLN-008": 2.0, "CLN-009": 0.5, "CLN-010": 0.5,
    "CLN-011": 0.3, "CLN-012": 0.3, "CLN-013": 0.4, "CLN-014": 0.4, "CLN-015": 0.5,
    "CLN-016": 0.4,
    # Personal care
    "PER-001": 1.5, "PER-002": 2.0, "PER-003": 1.5, "PER-004": 1.2, "PER-005": 0.4,
    "PER-006": 0.6, "PER-007": 0.4, "PER-008": 0.4, "PER-009": 1.2, "PER-010": 0.3,
    "PER-011": 0.5, "PER-012": 0.6, "PER-013": 0.4, "PER-014": 0.5,
    # Snacks & biscuits
    "BSK-001": 6.0, "BSK-002": 1.5, "BSK-003": 5.0, "BSK-004": 4.0, "BSK-005": 3.0,
    "BSK-006": 3.0, "BSK-007": 2.0, "BSK-008": 3.0, "BSK-009": 3.0, "BSK-010": 2.0,
    "BSK-011": 0.8, "BSK-012": 0.5,
}

# Monday=0 ... Sunday=6. Friday and Sunday are the busiest days for a Pakistani store.
DAY_OF_WEEK_FACTOR = [0.95, 0.92, 0.95, 1.0, 1.12, 1.06, 1.15]

# Share of a day's sales that happens in each opening hour (8am to 11pm).
HOUR_WEIGHTS: dict[int, float] = {
    8: 3, 9: 5, 10: 6, 11: 6, 12: 5, 13: 4, 14: 4, 15: 5, 16: 6, 17: 8,
    18: 10, 19: 11, 20: 10, 21: 8, 22: 5,
}

STAPLE_CATEGORIES = {"Grains & Pulses", "Cooking Oil & Ghee", "Dairy & Breakfast", "Tea & Beverages"}


def line_quantity_options(unit: str, sku: str) -> tuple[list[float], list[float]]:
    """How many units one customer buys in one line, and how likely each amount is."""
    if unit == "kg":
        return [1, 2, 3, 5], [0.45, 0.30, 0.15, 0.10]
    if sku in {"DRY-001", "DRY-002", "DRY-003", "DRY-004", "DRY-007"}:
        return [1, 2], [0.7, 0.3]
    if sku.startswith("BSK"):
        return [1, 2, 3], [0.6, 0.3, 0.1]
    if unit in {"bag", "tin"} or sku in {"OIL-011", "OIL-012"}:
        return [1, 2], [0.92, 0.08]
    return [1, 2], [0.85, 0.15]


def expected_line_quantity(unit: str, sku: str) -> float:
    values, weights = line_quantity_options(unit, sku)
    return sum(v * w for v, w in zip(values, weights)) / sum(weights)


def demand_multiplier(sku: str, category: str, ctx: DayContext) -> float:
    """Calendar and seasonal multiplier for one product on one day."""
    m = DAY_OF_WEEK_FACTOR[ctx.day.weekday()]

    if ctx.is_salary_week:
        m *= 1.12 if category in STAPLE_CATEGORIES else 1.04

    if ctx.is_eid_ul_fitr or ctx.is_eid_ul_adha:
        # Many shops close for part of Eid; drinks and snacks for guests still sell.
        if sku.startswith("BEV") or sku.startswith("BSK"):
            m *= 1.5
        else:
            m *= 0.55
    elif ctx.is_ramadan:
        ramadan = {
            "GRN-013": 2.5,  # besan for pakoras
            "BEV-001": 4.0, "BEV-004": 4.0,  # Rooh Afza, Jam-e-Shirin
            "BEV-002": 3.0, "BEV-003": 3.0,  # Tang
            "GRN-003": 1.3,
        }
        if sku in ramadan:
            m *= ramadan[sku]
        elif category == "Cooking Oil & Ghee":
            m *= 1.4
        elif category == "Dairy & Breakfast":
            m *= 1.2
        elif category == "Snacks & Biscuits":
            m *= 0.8
        else:
            m *= 1.1
        if ctx.is_pre_eid_fitr:
            if sku in {"GRN-003", "GRN-014", "GRN-015", "DRY-009", "DRY-010", "DRY-001", "DRY-003"}:
                m *= 1.8  # sheer khurma and Eid cooking
            elif sku in {"PER-011", "PER-001", "PER-003", "PER-006"}:
                m *= 1.6
            elif sku.startswith("BEV"):
                m *= 1.3

    if ctx.is_pre_eid_adha:
        if category == "Spices & Mixes":
            m *= 2.6 if sku == "SPC-014" else 2.2
        elif category == "Cooking Oil & Ghee":
            m *= 1.4
        elif sku in {"GRN-004", "GRN-005", "GRN-006"}:
            m *= 1.6

    if ctx.is_summer:
        if sku in {"BEV-005", "BEV-006", "BEV-007"}:
            m *= 1.6
        elif sku == "BEV-008":
            m *= 1.7
        elif sku in {"BEV-001", "BEV-002", "BEV-003", "BEV-004"}:
            m *= 1.4
        elif sku == "CLN-014":
            m *= 2.0
        elif category == "Tea & Beverages" and sku.startswith("TEA"):
            m *= 0.85
        elif sku == "DRY-014":
            m *= 0.85
    elif ctx.is_winter:
        if sku.startswith("TEA") or sku in {"DRY-005", "DRY-006", "DRY-007"}:
            m *= 1.2
        elif sku == "DRY-014":
            m *= 1.35
        elif sku == "DRY-008":
            m *= 1.2
        elif sku in {"BEV-005", "BEV-006", "BEV-007", "BEV-008"}:
            m *= 0.7

    return m
