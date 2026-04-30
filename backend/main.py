"""
FastAPI entry point — wires Modules 1–4 into a single /api/optimize endpoint.

Returns JSON containing:
  • the 96-period optimal schedule for the median price scenario
  • all three scenario schedules (p10, p50, p90)
  • summary KPI metrics (revenue, P&L, cycles, degradation)
  • the probabilistic price forecast with confidence bands
  • the temperature profile + thermal constraint envelope
  • ingestion provenance (which sources were live vs. synthetic)
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import forecast, ingest, optimizer, thermal


SEED_PATH = Path(__file__).parent / "data" / "seed_optimization.json"

app = FastAPI(title="Greek Battery Optimizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _run_pipeline(target_day: datetime) -> dict:
    ingestion = ingest.ingest_all(target_day)

    fc = forecast.forecast_for_day(target_day)
    weather = ingest.load_weather_for_day(target_day, "Athens-GR")
    spec, constraints = thermal.build_constraints(weather)

    scenarios = optimizer.solve_all_scenarios(
        fc.p10, fc.p50, fc.p90, constraints, spec
    )

    primary = scenarios["p50"]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target_day": target_day.date().isoformat(),
        "ingestion": ingestion,
        "forecast": forecast.to_dict(fc),
        "thermal": thermal.to_dict(spec, constraints),
        "weather": [{
            "delivery_start": w["delivery_start"],
            "period_index": w["period_index"],
            "temperature_c": w["temperature_c"],
            "wind_speed_ms": w["wind_speed_ms"],
            "cloud_cover_pct": w["cloud_cover_pct"],
            "radiation": w["shortwave_radiation_w_m2"],
        } for w in weather],
        "summary": {
            "total_revenue_eur": primary.total_revenue_eur,
            "total_degradation_eur": primary.total_degradation_eur,
            "net_pnl_eur": primary.net_pnl_eur,
            "cycles": primary.cycles,
            "objective_value": primary.objective_value,
            "solver_status": primary.solver_status,
            "primary_scenario": "p50",
        },
        "schedule": [row.__dict__ for row in primary.schedule],
        "scenarios": {k: optimizer.scenario_to_dict(v) for k, v in scenarios.items()},
    }


@app.get("/")
def root():
    return {"service": "greek-battery-optimizer", "status": "ok"}


@app.get("/api/health")
def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


@app.get("/api/seed")
def seed():
    """Returns the pre-computed seed optimisation so the dashboard can render
    immediately on first visit, without waiting for the live pipeline."""
    if not SEED_PATH.exists():
        raise HTTPException(status_code=404, detail="seed not generated")
    with SEED_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


@app.get("/api/optimize")
def optimize(date: Optional[str] = Query(default=None)):
    """
    Run the full pipeline for the requested ISO date (defaults to next UTC day,
    matching the day-ahead nature of the DAM).
    """
    if date:
        try:
            target_day = datetime.fromisoformat(date).replace(
                tzinfo=timezone.utc, hour=0, minute=0, second=0, microsecond=0
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"bad date: {e}") from e
    else:
        target_day = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)
    return _run_pipeline(target_day)


# Vercel's Python runtime expects a top-level callable named `app`.
__all__ = ["app"]
