"""
Module 1 — Data Ingestion

Fetches Greek DAM prices (via ENTSO-E when available), weather data from
Open-Meteo for Athens plus several reference geographies (CAISO, OMIE,
Germany), and persists everything in SQLite with source/timestamp provenance.

Where live data is unavailable we generate realistic synthetic series with the
same statistical properties as the published market data and flag every row
with `is_synthetic=1` so downstream consumers can tell the difference.
"""

from __future__ import annotations

import json
import math
import os
import random
import shutil
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import requests
except Exception:  # pragma: no cover - requests is in requirements.txt
    requests = None  # type: ignore


BUNDLED_DATA_DIR = Path(__file__).parent / "data"

# On Vercel (and other read-only serverless filesystems) the deploy directory
# can't be written to, so SQLite needs to live under /tmp. We copy the bundled
# market.db over on first import so historical rows are still available.
if os.environ.get("VERCEL") or not os.access(BUNDLED_DATA_DIR, os.W_OK):
    DATA_DIR = Path("/tmp/greek-battery-data")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    bundled_db = BUNDLED_DATA_DIR / "market.db"
    runtime_db = DATA_DIR / "market.db"
    if bundled_db.exists() and not runtime_db.exists():
        shutil.copy(bundled_db, runtime_db)
else:
    DATA_DIR = BUNDLED_DATA_DIR
    DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "market.db"

# Athens, Greece — used for the Greek battery's local weather forecast.
GREECE_LAT, GREECE_LON = 37.9838, 23.7275

# Reference geographies displayed in the UI and ingested for provenance.
ANALOGUE_MARKETS = {
    "CAISO": (36.7783, -119.4179),    # California
    "OMIE": (40.4168, -3.7038),       # Spain
    "ENTSOE_DE": (51.1657, 10.4515),  # Germany — central European reference
}


@dataclass
class IngestionReport:
    rows_written: int
    is_synthetic: bool
    source: str
    note: str


SCHEMA = """
CREATE TABLE IF NOT EXISTS dam_prices (
    market TEXT NOT NULL,
    delivery_start TEXT NOT NULL,
    period_index INTEGER NOT NULL,
    price_eur_mwh REAL NOT NULL,
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    PRIMARY KEY (market, delivery_start)
);

CREATE TABLE IF NOT EXISTS weather (
    location TEXT NOT NULL,
    delivery_start TEXT NOT NULL,
    period_index INTEGER NOT NULL,
    temperature_c REAL NOT NULL,
    wind_speed_ms REAL,
    cloud_cover_pct REAL,
    shortwave_radiation_w_m2 REAL,
    is_synthetic INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    PRIMARY KEY (location, delivery_start)
);

CREATE TABLE IF NOT EXISTS ingestion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component TEXT NOT NULL,
    source TEXT NOT NULL,
    is_synthetic INTEGER NOT NULL,
    rows_written INTEGER NOT NULL,
    note TEXT,
    ingested_at TEXT NOT NULL
);
"""


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    with closing(conn.cursor()) as cur:
        cur.executescript(SCHEMA)
    conn.commit()
    return conn


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _log(conn: sqlite3.Connection, component: str, report: IngestionReport) -> None:
    conn.execute(
        """
        INSERT INTO ingestion_log
            (component, source, is_synthetic, rows_written, note, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            component,
            report.source,
            int(report.is_synthetic),
            report.rows_written,
            report.note,
            _utc_now_iso(),
        ),
    )
    conn.commit()


def _greek_dam_synthetic(target_day: datetime, rng: random.Random):
    """
    Build a 96-period (15-minute) synthetic Greek DAM price series whose shape
    mirrors what HEnEx has been clearing in 2025/2026: a deep solar-driven
    midday valley, an evening peak around 19:00–21:00 local time, and a
    secondary dip overnight. Calibrated against published 2025 averages
    (~€95/MWh) and a typical intraday spread of €70–€140/MWh.
    """
    base = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = []
    for i in range(96):
        ts = base + timedelta(minutes=15 * i)
        hour = ts.hour + ts.minute / 60.0
        solar = -45.0 * math.exp(-((hour - 13.0) ** 2) / (2 * 2.5 ** 2))
        evening = 55.0 * math.exp(-((hour - 20.0) ** 2) / (2 * 1.6 ** 2))
        morning = 18.0 * math.exp(-((hour - 8.5) ** 2) / (2 * 1.2 ** 2))
        drift = 6.0 * math.sin(2 * math.pi * (target_day.timetuple().tm_yday) / 365.0)
        noise = rng.gauss(0.0, 4.5)
        price = 95.0 + solar + evening + morning + drift + noise
        rows.append((ts, i, round(price, 2)))
    return rows


def _weather_synthetic(target_day: datetime, lat: float, rng: random.Random):
    doy = target_day.timetuple().tm_yday
    season = math.cos(2 * math.pi * (doy - 200) / 365.0)
    daily_mean = 18.0 - 0.4 * (lat - 38.0) - 8.0 * season

    base = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = []
    for i in range(96):
        ts = base + timedelta(minutes=15 * i)
        hour = ts.hour + ts.minute / 60.0
        diurnal = -5.0 * math.cos(2 * math.pi * (hour - 15.0) / 24.0)
        temp = daily_mean + diurnal + rng.gauss(0.0, 0.6)
        wind = max(0.0, 4.0 + rng.gauss(0.0, 1.5))
        cloud = max(0.0, min(100.0, 35.0 + rng.gauss(0.0, 18.0)))
        clearsky = max(0.0, 850.0 * math.cos(math.pi * (hour - 12.0) / 12.0))
        if clearsky > 0:
            clearsky = clearsky ** 1.2 / 30.0
        radiation = max(0.0, clearsky * (1 - cloud / 150.0))
        rows.append((ts, i, round(temp, 2), round(wind, 2),
                     round(cloud, 1), round(radiation, 1)))
    return rows


def fetch_open_meteo(lat: float, lon: float, target_day: datetime,
                     timeout: float = 4.0):
    if requests is None:
        return None
    day = target_day.strftime("%Y-%m-%d")
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&minutely_15=temperature_2m,wind_speed_10m,cloud_cover,shortwave_radiation"
        f"&start_date={day}&end_date={day}"
        "&timezone=UTC"
    )
    try:
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        m15 = data.get("minutely_15") or {}
        times = m15.get("time") or []
        if len(times) < 96:
            return None
        rows = []
        for i in range(96):
            rows.append({
                "time": times[i],
                "temperature_c": m15["temperature_2m"][i],
                "wind_speed_ms": m15["wind_speed_10m"][i],
                "cloud_cover_pct": m15["cloud_cover"][i],
                "shortwave_radiation_w_m2": m15["shortwave_radiation"][i],
            })
        return rows
    except Exception:
        return None


def ingest_weather(target_day: datetime, location: str,
                   lat: float, lon: float) -> IngestionReport:
    conn = get_db()
    rng = random.Random(f"weather:{location}:{target_day.date().isoformat()}")
    live = fetch_open_meteo(lat, lon, target_day)

    rows_db: list[tuple] = []
    if live is not None:
        source = "open-meteo"
        is_synth = False
        for i, r in enumerate(live):
            ts = datetime.fromisoformat(r["time"]).replace(tzinfo=timezone.utc)
            rows_db.append((
                location, ts.isoformat(), i,
                float(r["temperature_c"]),
                float(r["wind_speed_ms"] or 0.0),
                float(r["cloud_cover_pct"] or 0.0),
                float(r["shortwave_radiation_w_m2"] or 0.0),
                0, source, _utc_now_iso(),
            ))
        note = "Live Open-Meteo forecast"
    else:
        source = "synthetic"
        is_synth = True
        for ts, i, t, w, c, rad in _weather_synthetic(target_day, lat, rng):
            rows_db.append((
                location, ts.isoformat(), i, t, w, c, rad,
                1, source, _utc_now_iso(),
            ))
        note = "Open-Meteo unreachable; synthetic series flagged"

    with closing(conn.cursor()) as cur:
        cur.executemany(
            """
            INSERT OR REPLACE INTO weather
                (location, delivery_start, period_index, temperature_c,
                 wind_speed_ms, cloud_cover_pct, shortwave_radiation_w_m2,
                 is_synthetic, source, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows_db,
        )
    conn.commit()

    report = IngestionReport(
        rows_written=len(rows_db),
        is_synthetic=is_synth,
        source=source,
        note=f"{note} for {location}",
    )
    _log(conn, "weather", report)
    conn.close()
    return report


def ingest_dam_prices(target_day: datetime, market: str = "GR") -> IngestionReport:
    """
    Greek HEnEx publishes DAM results without a free public JSON API. In a
    production deployment this proxies to ENTSO-E's Transparency REST API
    using ENTSOE_API_KEY. For the hackathon we keep the network call optional
    and fall back to a realistic synthetic series.
    """
    conn = get_db()
    rng = random.Random(f"dam:{market}:{target_day.date().isoformat()}")

    api_key = os.environ.get("ENTSOE_API_KEY", "").strip()
    live_rows = None
    note = ""
    if api_key and requests is not None:
        live_rows = _try_entsoe_dam(api_key, target_day)
        if live_rows is None:
            note = "ENTSO-E request failed; falling back to synthetic"
    else:
        note = "No ENTSOE_API_KEY; synthetic Greek DAM series"

    rows_db: list[tuple] = []
    if live_rows is not None:
        source = "entsoe"
        is_synth = False
        for i, (ts, price) in enumerate(live_rows):
            rows_db.append((
                market, ts.isoformat(), i, float(price),
                0, source, _utc_now_iso(),
            ))
        note = "Live ENTSO-E day-ahead prices"
    else:
        source = "synthetic"
        is_synth = True
        for ts, i, price in _greek_dam_synthetic(target_day, rng):
            rows_db.append((
                market, ts.isoformat(), i, price,
                1, source, _utc_now_iso(),
            ))

    with closing(conn.cursor()) as cur:
        cur.executemany(
            """
            INSERT OR REPLACE INTO dam_prices
                (market, delivery_start, period_index, price_eur_mwh,
                 is_synthetic, source, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows_db,
        )
    conn.commit()

    report = IngestionReport(
        rows_written=len(rows_db),
        is_synthetic=is_synth,
        source=source,
        note=note,
    )
    _log(conn, "dam_prices", report)
    conn.close()
    return report


def _try_entsoe_dam(api_key: str, target_day: datetime):
    if requests is None:
        return None
    try:
        start = target_day.strftime("%Y%m%d") + "0000"
        end = (target_day + timedelta(days=1)).strftime("%Y%m%d") + "0000"
        url = (
            "https://web-api.tp.entsoe.eu/api"
            f"?securityToken={api_key}"
            "&documentType=A44"
            "&in_Domain=10YGR-HTSO-----Y"
            "&out_Domain=10YGR-HTSO-----Y"
            f"&periodStart={start}&periodEnd={end}"
        )
        r = requests.get(url, timeout=6.0)
        r.raise_for_status()
        body = r.text
        prices: list[float] = []
        for chunk in body.split("<Point>")[1:]:
            try:
                amt_open = chunk.index("<price.amount>") + len("<price.amount>")
                amt_close = chunk.index("</price.amount>")
                prices.append(float(chunk[amt_open:amt_close]))
            except ValueError:
                continue
        if not prices:
            return None
        if len(prices) == 24:
            prices = [p for p in prices for _ in range(4)]
        if len(prices) != 96:
            return None
        base = target_day.replace(hour=0, minute=0, second=0,
                                  microsecond=0, tzinfo=timezone.utc)
        return [(base + timedelta(minutes=15 * i), prices[i]) for i in range(96)]
    except Exception:
        return None


def ingest_all(target_day: datetime | None = None) -> dict:
    target_day = target_day or datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    out = {"target_day": target_day.date().isoformat(), "components": []}

    dam = ingest_dam_prices(target_day, market="GR")
    out["components"].append({
        "name": "GR DAM",
        "rows": dam.rows_written, "synthetic": dam.is_synthetic,
        "source": dam.source, "note": dam.note,
    })

    locations = [("Athens-GR", GREECE_LAT, GREECE_LON)] + [
        (name, lat, lon) for name, (lat, lon) in ANALOGUE_MARKETS.items()
    ]
    for name, lat, lon in locations:
        rep = ingest_weather(target_day, name, lat, lon)
        out["components"].append({
            "name": f"weather:{name}",
            "rows": rep.rows_written, "synthetic": rep.is_synthetic,
            "source": rep.source, "note": rep.note,
        })
    return out


def load_dam_for_day(target_day: datetime, market: str = "GR") -> list[dict]:
    conn = get_db()
    day_start = target_day.replace(hour=0, minute=0, second=0,
                                   microsecond=0, tzinfo=timezone.utc)
    next_day = day_start + timedelta(days=1)
    cur = conn.execute(
        """
        SELECT delivery_start, period_index, price_eur_mwh, is_synthetic, source
        FROM dam_prices
        WHERE market = ? AND delivery_start >= ? AND delivery_start < ?
        ORDER BY period_index
        """,
        (market, day_start.isoformat(), next_day.isoformat()),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    if len(rows) != 96:
        ingest_dam_prices(day_start, market=market)
        return load_dam_for_day(target_day, market=market)
    return rows


def load_weather_for_day(target_day: datetime,
                         location: str = "Athens-GR") -> list[dict]:
    conn = get_db()
    day_start = target_day.replace(hour=0, minute=0, second=0,
                                   microsecond=0, tzinfo=timezone.utc)
    next_day = day_start + timedelta(days=1)
    cur = conn.execute(
        """
        SELECT delivery_start, period_index, temperature_c, wind_speed_ms,
               cloud_cover_pct, shortwave_radiation_w_m2, is_synthetic, source
        FROM weather
        WHERE location = ? AND delivery_start >= ? AND delivery_start < ?
        ORDER BY period_index
        """,
        (location, day_start.isoformat(), next_day.isoformat()),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    if len(rows) != 96:
        lat, lon = GREECE_LAT, GREECE_LON
        if location in ANALOGUE_MARKETS:
            lat, lon = ANALOGUE_MARKETS[location]
        ingest_weather(day_start, location, lat, lon)
        return load_weather_for_day(target_day, location)
    return rows


def load_history_for_training(days: int = 60) -> list[dict]:
    """
    Returns up to `days` of joined Greek DAM + Athens weather rows for use as
    a training set. When live data is unavailable each historical day is built
    synthetically with deterministic seeds so re-runs are reproducible.
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0,
                                               microsecond=0)
    out: list[dict] = []
    for d in range(days, 0, -1):
        day = today - timedelta(days=d)
        prices = load_dam_for_day(day)
        weather = load_weather_for_day(day)
        for p, w in zip(prices, weather):
            out.append({
                "delivery_start": p["delivery_start"],
                "period_index": p["period_index"],
                "price": p["price_eur_mwh"],
                "temperature_c": w["temperature_c"],
                "wind_speed_ms": w["wind_speed_ms"],
                "cloud_cover_pct": w["cloud_cover_pct"],
                "radiation": w["shortwave_radiation_w_m2"],
                "is_synthetic": p["is_synthetic"] or w["is_synthetic"],
            })
    return out


if __name__ == "__main__":
    print(json.dumps(ingest_all(), indent=2))
