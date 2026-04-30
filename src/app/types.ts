export interface ScheduleRow {
  period_index: number;
  delivery_start: string;
  price_eur_mwh: number;
  charge_mw: number;
  discharge_mw: number;
  net_mw: number;
  soc_mwh: number;
  soc_pct: number;
  action: "charge" | "discharge" | "idle";
  period_revenue_eur: number;
  period_degradation_eur: number;
}

export interface PriceForecast {
  model: string;
  trained_on_days: number;
  delivery_start: string[];
  period_index: number[];
  p10: number[];
  p50: number[];
  p90: number[];
}

export interface ThermalPeriod {
  period_index: number;
  delivery_start: string;
  temperature_c: number;
  max_charge_mw: number;
  max_discharge_mw: number;
  soc_min: number;
  soc_max: number;
  degradation_cost_eur_mwh: number;
  derate_factor: number;
}

export interface ScenarioResult {
  scenario: "p10" | "p50" | "p90";
  total_revenue_eur: number;
  total_degradation_eur: number;
  net_pnl_eur: number;
  cycles: number;
  objective_value: number;
  solver_status: string;
  schedule: ScheduleRow[];
}

export interface OptimizationResult {
  generated_at: string;
  target_day: string;
  ingestion: {
    target_day: string;
    components: {
      name: string;
      rows: number;
      synthetic: boolean;
      source: string;
      note: string;
    }[];
  };
  forecast: PriceForecast;
  thermal: {
    spec: {
      capacity_mwh: number;
      nominal_power_mw: number;
      round_trip_efficiency: number;
      soc_min_floor: number;
      soc_max_ceiling: number;
      soc_initial: number;
      soc_terminal_reserve: number;
      degradation_cost_per_mwh: number;
      daily_cycle_cap: number;
      period_minutes: number;
    };
    periods: ThermalPeriod[];
  };
  weather: {
    delivery_start: string;
    period_index: number;
    temperature_c: number;
    wind_speed_ms: number;
    cloud_cover_pct: number;
    radiation: number;
  }[];
  summary: {
    total_revenue_eur: number;
    total_degradation_eur: number;
    net_pnl_eur: number;
    cycles: number;
    objective_value: number;
    solver_status: string;
    primary_scenario: string;
  };
  schedule: ScheduleRow[];
  scenarios: Record<"p10" | "p50" | "p90", ScenarioResult>;
}

export const formatTimeOfDay = (iso: string): string => {
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

export const formatEur = (v: number, digits = 0): string =>
  `€${v.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
