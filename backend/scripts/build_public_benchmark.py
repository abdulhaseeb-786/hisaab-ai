"""Build the public benchmark dataset used to test the forecaster on real retail data.

Source: "Online Retail II" (Chen, D., 2012), UCI Machine Learning Repository,
https://doi.org/10.24432/C5CG6D, licence CC BY 4.0. Real transactions of a UK online
retailer, Dec 2009 - Dec 2011.

What this script does:
1. Reads the original Excel file (download the zip from the UCI page and unzip it).
2. Drops cancellations (invoice starting with "C") and non-positive quantities, and keeps
   United Kingdom orders.
3. Sums units per product per day, for the last 12 months of the data.
4. Keeps the 30 products sold on the most days and fills days without sales with 0.
5. Writes backend/datasets/uci_online_retail_daily_top30.csv (date, stock_code, description, units).

Usage (from the backend folder):
    python scripts/build_public_benchmark.py path/to/online_retail_II.xlsx
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "datasets" / "uci_online_retail_daily_top30.csv"
TOP_N = 30


def main(xlsx: Path) -> None:
    frames = pd.read_excel(xlsx, sheet_name=None, dtype={"Invoice": str, "StockCode": str})
    df = pd.concat(frames.values(), ignore_index=True)
    df = df[~df["Invoice"].str.startswith("C", na=False)]
    df = df[(df["Quantity"] > 0) & (df["Country"] == "United Kingdom")]
    df["date"] = pd.to_datetime(df["InvoiceDate"]).dt.normalize()

    end = df["date"].max()
    start = end - pd.Timedelta(days=364)
    df = df[df["date"] >= start]

    daily = df.groupby(["StockCode", "date"], as_index=False)["Quantity"].sum()
    active_days = daily.groupby("StockCode")["date"].nunique().sort_values(ascending=False)
    top = active_days.head(TOP_N).index

    names = (
        df[df["StockCode"].isin(top)]
        .groupby("StockCode")["Description"]
        .agg(lambda s: s.dropna().mode().iat[0] if not s.dropna().empty else "")
    )
    all_days = pd.date_range(start, end, freq="D")
    rows = []
    for code in top:
        series = daily[daily["StockCode"] == code].set_index("date")["Quantity"].reindex(all_days, fill_value=0)
        for d, units in series.items():
            rows.append({"date": d.date().isoformat(), "stock_code": code, "description": names.get(code, ""), "units": int(units)})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(OUT, index=False)
    print(f"Wrote {len(rows)} rows ({TOP_N} products x {len(all_days)} days) to {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
