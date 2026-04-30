"""
Module 4 — Mixed-Integer Linear Programming Optimizer

Solves the day-ahead battery scheduling problem with HiGHS via SciPy's
`milp` interface.

Decision variables (per 15-minute period i, i = 0 … 95):
    p_c[i]  charge power           [MW]   ≥ 0
    p_d[i]  discharge power        [MW]   ≥ 0
    s[i]    state of charge        [MWh]
    z_c[i]  charge indicator       {0,1}
    z_d[i]  discharge indicator    {0,1}

Objective:  maximise  Σ Δt · price[i] · (p_d[i] - p_c[i])
                    − Σ Δt · degradation_cost[i] · (p_c[i] + p_d[i])

Subject to:
  • Energy balance:    s[i] = s[i-1] + Δt · (η · p_c[i] - p_d[i] / η)
  • SoC bounds:        soc_min[i] · E ≤ s[i] ≤ soc_max[i] · E
  • Power limits:      p_c[i] ≤ P_max[i] · z_c[i]
                       p_d[i] ≤ P_max[i] · z_d[i]
  • Mutual exclusivity: z_c[i] + z_d[i] ≤ 1
  • Daily cycle cap:   Σ Δt · (p_c[i] + p_d[i]) ≤ 2 · cycles · E
  • End-of-day SoC:    s[95] ≥ soc_terminal · E
  • Initial SoC:       s[-1] = soc_initial · E   (carried as a constant)

The solver is run three times — on p10, p50 and p90 price scenarios — and we
return all three schedules so the dashboard can render the spread.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

try:
    from scipy.optimize import milp, LinearConstraint, Bounds
    from scipy.sparse import lil_matrix, csr_matrix
    HAVE_HIGHS = True
except Exception:
    HAVE_HIGHS = False

from .thermal import BatterySpec, PeriodConstraint


N_PERIODS = 96


@dataclass
class ScheduleRow:
    period_index: int
    delivery_start: str
    price_eur_mwh: float
    charge_mw: float
    discharge_mw: float
    net_mw: float          # discharge - charge (positive = exporting)
    soc_mwh: float
    soc_pct: float
    action: str            # 'charge' | 'discharge' | 'idle'
    period_revenue_eur: float
    period_degradation_eur: float


@dataclass
class ScenarioResult:
    scenario: str          # 'p10' | 'p50' | 'p90'
    schedule: list[ScheduleRow]
    total_revenue_eur: float
    total_degradation_eur: float
    net_pnl_eur: float
    cycles: float
    objective_value: float
    solver_status: str


def _solve_milp_highs(prices: Sequence[float],
                      constraints: list[PeriodConstraint],
                      spec: BatterySpec) -> tuple[np.ndarray, np.ndarray,
                                                  np.ndarray, str, float]:
    """
    Solves the MILP using scipy.optimize.milp (HiGHS).
    Returns charge_mw, discharge_mw, soc_mwh arrays and a status string.
    """
    n = N_PERIODS
    dt = spec.period_minutes / 60.0
    eta = float(np.sqrt(spec.round_trip_efficiency))  # one-way efficiency
    E = spec.capacity_mwh
    s0 = spec.soc_initial * E

    # Variable layout: [p_c (n), p_d (n), s (n), z_c (n), z_d (n)]
    nvar = 5 * n
    PC = lambda i: i                 # noqa: E731 — short index helpers
    PD = lambda i: n + i
    S = lambda i: 2 * n + i
    ZC = lambda i: 3 * n + i
    ZD = lambda i: 4 * n + i

    # Objective (we maximise, so milp gets the negated cost vector).
    c = np.zeros(nvar)
    for i in range(n):
        c[PC(i)] = -(-prices[i] * dt) + dt * constraints[i].degradation_cost_eur_mwh
        c[PD(i)] = -(prices[i] * dt) + dt * constraints[i].degradation_cost_eur_mwh

    # Variable bounds.
    lb = np.zeros(nvar)
    ub = np.full(nvar, np.inf)
    for i in range(n):
        ub[PC(i)] = constraints[i].max_charge_mw
        ub[PD(i)] = constraints[i].max_discharge_mw
        lb[S(i)] = constraints[i].soc_min * E
        ub[S(i)] = constraints[i].soc_max * E
        ub[ZC(i)] = 1.0
        ub[ZD(i)] = 1.0
    bounds = Bounds(lb=lb, ub=ub)

    integrality = np.zeros(nvar)
    integrality[3 * n:] = 1  # z_c, z_d are binary

    # ------------------------------------------------------------------ #
    # Equality constraints — energy balance.
    # s[i] - s[i-1] - dt*eta*p_c[i] + dt*p_d[i]/eta = 0
    # For i = 0:  s[0] = s0 + dt*eta*p_c[0] - dt*p_d[0]/eta
    # ------------------------------------------------------------------ #
    eq_rows = []
    eq_rhs = []
    A_eq = lil_matrix((n, nvar))
    b_eq = np.zeros(n)
    for i in range(n):
        A_eq[i, S(i)] = 1.0
        if i > 0:
            A_eq[i, S(i - 1)] = -1.0
        A_eq[i, PC(i)] = -dt * eta
        A_eq[i, PD(i)] = dt / eta
        if i == 0:
            b_eq[i] = s0
    eq_constr = LinearConstraint(csr_matrix(A_eq), b_eq, b_eq)

    # ------------------------------------------------------------------ #
    # Inequality constraints.
    # ------------------------------------------------------------------ #
    rows = []
    lb_in: list[float] = []
    ub_in: list[float] = []

    # p_c[i] - P_max_c[i] * z_c[i] <= 0
    for i in range(n):
        row = np.zeros(nvar)
        row[PC(i)] = 1.0
        row[ZC(i)] = -constraints[i].max_charge_mw
        rows.append(row); lb_in.append(-np.inf); ub_in.append(0.0)

    # p_d[i] - P_max_d[i] * z_d[i] <= 0
    for i in range(n):
        row = np.zeros(nvar)
        row[PD(i)] = 1.0
        row[ZD(i)] = -constraints[i].max_discharge_mw
        rows.append(row); lb_in.append(-np.inf); ub_in.append(0.0)

    # z_c[i] + z_d[i] <= 1
    for i in range(n):
        row = np.zeros(nvar)
        row[ZC(i)] = 1.0
        row[ZD(i)] = 1.0
        rows.append(row); lb_in.append(-np.inf); ub_in.append(1.0)

    # Daily cycle cap:
    #   Σ dt * (p_c + p_d) <= 2 * cycles * E
    row = np.zeros(nvar)
    for i in range(n):
        row[PC(i)] = dt
        row[PD(i)] = dt
    rows.append(row); lb_in.append(-np.inf)
    ub_in.append(2.0 * spec.daily_cycle_cap * E)

    # Terminal SoC reserve.
    row = np.zeros(nvar)
    row[S(n - 1)] = 1.0
    rows.append(row); lb_in.append(spec.soc_terminal_reserve * E); ub_in.append(np.inf)

    A_ineq = csr_matrix(np.vstack(rows))
    ineq_constr = LinearConstraint(A_ineq, np.array(lb_in), np.array(ub_in))

    res = milp(
        c=c,
        constraints=[eq_constr, ineq_constr],
        bounds=bounds,
        integrality=integrality,
        options={"disp": False, "time_limit": 30.0, "mip_rel_gap": 1e-4},
    )

    if not res.success or res.x is None:
        # Fall back to a deterministic relaxation: drop binaries.
        res = milp(
            c=c,
            constraints=[eq_constr, ineq_constr],
            bounds=bounds,
            integrality=np.zeros(nvar),
            options={"disp": False, "time_limit": 10.0},
        )
        status = f"relaxed:{getattr(res, 'message', '')[:60]}"
    else:
        status = "optimal"

    x = np.asarray(res.x)
    p_c = x[:n]
    p_d = x[n:2 * n]
    s = x[2 * n:3 * n]
    obj = float(-(c @ x))  # un-negate to recover maximisation value
    return p_c, p_d, s, status, obj


def _solve_greedy_fallback(prices: Sequence[float],
                           constraints: list[PeriodConstraint],
                           spec: BatterySpec):
    """
    Threshold-based greedy fallback used only if SciPy/HiGHS is unavailable.
    Charges in the cheapest periods of the day until the daily energy budget
    is exhausted, discharges in the most expensive periods.  This is *not* a
    substitute for the MILP — it exists so the API still returns plausible
    JSON in environments without scientific dependencies installed.
    """
    n = N_PERIODS
    dt = spec.period_minutes / 60.0
    eta = float(np.sqrt(spec.round_trip_efficiency))
    E = spec.capacity_mwh
    p_c = np.zeros(n); p_d = np.zeros(n)
    s = np.zeros(n)

    daily_energy_budget_mwh = spec.daily_cycle_cap * E
    sorted_idx = np.argsort(prices)
    cheap = list(sorted_idx[: n // 4])
    pricey = list(sorted_idx[-(n // 4):])

    soc = spec.soc_initial * E
    energy_charged = 0.0
    for i in range(n):
        c = constraints[i]
        max_e = c.max_charge_mw * dt
        if i in cheap and energy_charged < daily_energy_budget_mwh:
            room = c.soc_max * E - soc
            chunk = min(max_e, room / eta)
            p_c[i] = chunk / dt if dt > 0 else 0
            soc += chunk * eta
            energy_charged += chunk
        elif i in pricey:
            avail = soc - c.soc_min * E
            chunk = min(c.max_discharge_mw * dt, avail * eta)
            p_d[i] = chunk / dt if dt > 0 else 0
            soc -= chunk / eta
        s[i] = soc

    revenue = float(sum(prices[i] * (p_d[i] - p_c[i]) * dt for i in range(n)))
    deg = float(sum(constraints[i].degradation_cost_eur_mwh
                    * (p_c[i] + p_d[i]) * dt for i in range(n)))
    return p_c, p_d, s, "greedy-fallback", revenue - deg


def solve_scenario(scenario_name: str,
                   prices: Sequence[float],
                   constraints: list[PeriodConstraint],
                   spec: BatterySpec) -> ScenarioResult:
    if HAVE_HIGHS:
        p_c, p_d, s, status, obj = _solve_milp_highs(prices, constraints, spec)
    else:
        p_c, p_d, s, status, obj = _solve_greedy_fallback(prices, constraints, spec)

    dt = spec.period_minutes / 60.0
    E = spec.capacity_mwh

    rows: list[ScheduleRow] = []
    total_revenue = 0.0
    total_deg = 0.0
    total_throughput = 0.0
    for i in range(N_PERIODS):
        rev = float(prices[i]) * (p_d[i] - p_c[i]) * dt
        deg = constraints[i].degradation_cost_eur_mwh * (p_c[i] + p_d[i]) * dt
        total_revenue += rev
        total_deg += deg
        total_throughput += (p_c[i] + p_d[i]) * dt
        if p_c[i] > 1e-3:
            action = "charge"
        elif p_d[i] > 1e-3:
            action = "discharge"
        else:
            action = "idle"
        rows.append(ScheduleRow(
            period_index=i,
            delivery_start=constraints[i].delivery_start,
            price_eur_mwh=round(float(prices[i]), 2),
            charge_mw=round(float(p_c[i]), 4),
            discharge_mw=round(float(p_d[i]), 4),
            net_mw=round(float(p_d[i] - p_c[i]), 4),
            soc_mwh=round(float(s[i]), 4),
            soc_pct=round(float(s[i] / E * 100.0), 2),
            action=action,
            period_revenue_eur=round(rev, 2),
            period_degradation_eur=round(deg, 2),
        ))

    cycles = total_throughput / (2.0 * E) if E > 0 else 0.0

    return ScenarioResult(
        scenario=scenario_name,
        schedule=rows,
        total_revenue_eur=round(total_revenue, 2),
        total_degradation_eur=round(total_deg, 2),
        net_pnl_eur=round(total_revenue - total_deg, 2),
        cycles=round(cycles, 3),
        objective_value=round(obj, 2),
        solver_status=status,
    )


def solve_all_scenarios(p10: Sequence[float], p50: Sequence[float],
                        p90: Sequence[float],
                        constraints: list[PeriodConstraint],
                        spec: BatterySpec) -> dict[str, ScenarioResult]:
    return {
        "p10": solve_scenario("p10", p10, constraints, spec),
        "p50": solve_scenario("p50", p50, constraints, spec),
        "p90": solve_scenario("p90", p90, constraints, spec),
    }


def scenario_to_dict(s: ScenarioResult) -> dict:
    return {
        "scenario": s.scenario,
        "total_revenue_eur": s.total_revenue_eur,
        "total_degradation_eur": s.total_degradation_eur,
        "net_pnl_eur": s.net_pnl_eur,
        "cycles": s.cycles,
        "objective_value": s.objective_value,
        "solver_status": s.solver_status,
        "schedule": [row.__dict__ for row in s.schedule],
    }
