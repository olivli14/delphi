"""
Module 3 — Thermal Constraint Modelling

Translates the Open-Meteo temperature forecast for Athens into time-varying
battery operating limits:

  • Max charge / discharge power derate — 1% per °C above 25°C (per the brief).
  • Degradation cost premium — +0.5% per °C above 25°C, applied to the
    nominal €/MWh round-trip degradation cost.
  • SoC bounds tighten on hot days to leave thermal headroom and on very cold
    days to avoid lithium plating.

The output is a list of 96 dicts, one per 15-minute period, ready for the
MILP optimizer to consume.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class BatterySpec:
    capacity_mwh: float = 50.0           # E_max
    nominal_power_mw: float = 25.0       # P_max  (1C battery)
    round_trip_efficiency: float = 0.88
    soc_min_floor: float = 0.05
    soc_max_ceiling: float = 0.95
    soc_initial: float = 0.50
    soc_terminal_reserve: float = 0.30   # End-of-day reserve
    degradation_cost_per_mwh: float = 12.0  # €/MWh of throughput at 25°C
    daily_cycle_cap: float = 1.6         # Cycles/day
    period_minutes: int = 15


@dataclass
class PeriodConstraint:
    period_index: int
    delivery_start: str
    temperature_c: float
    max_charge_mw: float
    max_discharge_mw: float
    soc_min: float
    soc_max: float
    degradation_cost_eur_mwh: float
    derate_factor: float


def _derate_factor(temp_c: float) -> float:
    """
    Power derating curve.

    Above 25°C: 1% per °C, capped so we never derate below 30% of nameplate
    (which would correspond to ~95°C — extreme but bounds the model).
    Below 0°C: linear cold derate of 0.5% per °C, capped at -20°C.
    """
    if temp_c > 25.0:
        derate = 1.0 - 0.01 * (temp_c - 25.0)
        return max(0.30, derate)
    if temp_c < 0.0:
        derate = 1.0 - 0.005 * (0.0 - temp_c)
        return max(0.80, derate)
    return 1.0


def _degradation_premium(temp_c: float, base: float) -> float:
    """+0.5% / °C above 25°C, applied to the base degradation cost."""
    if temp_c <= 25.0:
        return base
    return base * (1.0 + 0.005 * (temp_c - 25.0))


def _soc_bounds(temp_c: float, spec: BatterySpec) -> tuple[float, float]:
    """
    Tighten SoC bounds on temperature extremes.  Above 35°C we cap top SoC
    to limit time spent at high SoC + high temperature (the worst combo for
    calendar ageing).  Below 0°C we lift the floor.
    """
    soc_min = spec.soc_min_floor
    soc_max = spec.soc_max_ceiling
    if temp_c > 35.0:
        soc_max -= 0.005 * min(temp_c - 35.0, 10.0)
    if temp_c < 0.0:
        soc_min += 0.002 * min(0.0 - temp_c, 20.0)
    return soc_min, soc_max


def build_constraints(weather: list[dict],
                      spec: BatterySpec | None = None
                      ) -> tuple[BatterySpec, list[PeriodConstraint]]:
    """
    Build per-period operating envelopes from weather + battery spec.

    `weather` is the 96-row Open-Meteo forecast as returned by
    `ingest.load_weather_for_day`.
    """
    spec = spec or BatterySpec()
    constraints: list[PeriodConstraint] = []
    for i, w in enumerate(weather):
        temp = float(w["temperature_c"])
        d = _derate_factor(temp)
        max_p = spec.nominal_power_mw * d
        deg = _degradation_premium(temp, spec.degradation_cost_per_mwh)
        soc_min, soc_max = _soc_bounds(temp, spec)
        constraints.append(PeriodConstraint(
            period_index=i,
            delivery_start=w["delivery_start"],
            temperature_c=round(temp, 2),
            max_charge_mw=round(max_p, 4),
            max_discharge_mw=round(max_p, 4),
            soc_min=round(soc_min, 4),
            soc_max=round(soc_max, 4),
            degradation_cost_eur_mwh=round(deg, 4),
            derate_factor=round(d, 4),
        ))
    return spec, constraints


def to_dict(spec: BatterySpec, constraints: list[PeriodConstraint]) -> dict:
    return {
        "spec": asdict(spec),
        "periods": [asdict(c) for c in constraints],
    }
