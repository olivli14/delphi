"use client";

import { useEffect, useState } from "react";
import BatterySchedule from "./components/BatterySchedule";
import DataMap from "./components/DataMap";
import Header from "./components/Header";
import KPICards from "./components/KPICards";
import LoadingOverlay from "./components/LoadingOverlay";
import PriceForecast from "./components/PriceForecast";
import ScenarioChart from "./components/ScenarioChart";
import ScheduleTable from "./components/ScheduleTable";
import ThermalChart from "./components/ThermalChart";
import { OptimizationResult } from "./types";

const SEED_URL = "/seed_optimization.json";
const API_URL = "/api/optimize";

export default function Page() {
  const [data, setData] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingSeed, setUsingSeed] = useState(true);

  useEffect(() => {
    fetch(SEED_URL)
      .then((r) => r.json())
      .then((j) => {
        const seedData = j as OptimizationResult;
        setData({ ...seedData, run_type: "seed" });
      })
      .catch(() =>
        setError(
          "Could not load seed data. Run `python -m backend.seed_data` to regenerate.",
        ),
      );
  }, []);

  const runOptimization = async () => {
    setLoading(true);
    setFinished(false);
    setError(null);
    const startedAt = performance.now();
    try {
      const r = await fetch(API_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as OptimizationResult;
      setData({ ...j, run_type: "computed" });
      setUsingSeed(false);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `Live optimisation failed: ${e.message}. Showing seed result.`
          : "Live optimisation failed. Showing seed result.",
      );
    } finally {
      // Hold the overlay open long enough for the narration to land — at
      // least 4.5s — then flash a "complete" state for ~700ms before closing.
      const elapsed = performance.now() - startedAt;
      const minDuration = 4500;
      const wait = Math.max(0, minDuration - elapsed);
      setTimeout(() => {
        setFinished(true);
        setTimeout(() => setLoading(false), 700);
      }, wait);
    }
  };

  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-slate-700">
        {error ? error : "Loading seed data…"}
      </main>
    );
  }

  const ingestion = data.ingestion?.components ?? [];
  const anySynthetic = ingestion.some((c) => c.synthetic);
  const runType =
    data.run_type ?? (usingSeed ? "seed" : "computed");
  const runTypeLabel =
    runType === "seed" ? "showing precomputed seed output" : "showing freshly computed output";
  const damComponent = ingestion.find((c) => c.name === "GR DAM");
  const greekDamLabel = damComponent
    ? damComponent.synthetic
      ? "Greek DAM prices: synthetic fallback"
      : "Greek DAM prices: live ENTSO-E pull"
    : "Greek DAM prices: status unavailable";
  const forecastModelLabel =
    data.forecast.model.startsWith("sklearn-hgb-quantile")
      ? "forecast model: scikit-learn HistGradientBoosting quantile regressors"
      : `forecast model: ${data.forecast.model}`;

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <LoadingOverlay open={loading} finished={finished} />

      <Header
        generatedAt={data.generated_at}
        targetDay={data.target_day}
        runTypeLabel={runTypeLabel}
        loading={loading}
        onRun={runOptimization}
      />

      {runType === "seed" && (
        <div className="mb-4 rounded-xl border border-accent-electric/30 bg-accent-electric/5 px-4 py-2 text-xs text-slate-700 font-mono">
          Showing the bundled seed file from <code>/public/seed_optimization.json</code>.
          Click <strong>Run Optimization</strong> to call the backend and replace it
          with a fresh computed run.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-accent-rose/40 bg-accent-rose/10 px-4 py-2 text-xs text-accent-rose font-mono">
          {error}
        </div>
      )}

      <KPICards
        totalRevenue={data.summary.total_revenue_eur}
        netPnl={data.summary.net_pnl_eur}
        cycles={data.summary.cycles}
        totalDegradation={data.summary.total_degradation_eur}
      />

      <section className="mt-6">
        <div className="card">
          <h3 className="section-title">Run status</h3>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono text-slate-700">
            <li className="rounded-lg border border-navy-700/60 px-3 py-2">
              {runTypeLabel}
            </li>
            <li
              className={[
                "rounded-lg border px-3 py-2",
                damComponent?.synthetic
                  ? "border-accent-amber/40 text-accent-amber"
                  : "border-accent-green/40 text-accent-green",
              ].join(" ")}
            >
              {greekDamLabel}
            </li>
            <li className="rounded-lg border border-navy-700/60 px-3 py-2">
              {forecastModelLabel}
            </li>
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <PriceForecast forecast={data.forecast} />
        <BatterySchedule
          schedule={data.schedule}
          capacityMwh={data.thermal.spec.capacity_mwh}
        />
        <ThermalChart periods={data.thermal.periods} />
        <ScenarioChart scenarios={data.scenarios} />
      </section>

      <section className="mt-6">
        <ScheduleTable schedule={data.schedule} />
      </section>

      <section className="mt-6">
        <DataMap />
      </section>

      <section className="mt-6">
        <div className="card">
          <h3 className="section-title">Data provenance</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-700">
            {ingestion.map((c) => (
              <li
                key={c.name}
                className="flex justify-between border-b border-navy-700/60 py-1.5"
              >
                <span className="truncate">{c.name}</span>
                <span
                  className={
                    c.synthetic ? "text-accent-amber" : "text-accent-green"
                  }
                >
                  {c.synthetic ? "synthetic" : "live"} · {c.source}
                </span>
              </li>
            ))}
          </ul>
          {anySynthetic && (
            <p className="text-[11px] mt-2 text-accent-amber font-mono">
              Some sources fell back to synthetic series (statistically realistic,
              flagged in SQLite as <code>is_synthetic = 1</code>).
            </p>
          )}
        </div>
      </section>

      <footer className="mt-8 text-center text-[11px] text-slate-600 font-mono">
        Solver status:{" "}
        <span className="text-navy-950 font-semibold">{data.summary.solver_status}</span> ·
        objective {data.summary.objective_value.toFixed(2)} · forecast model{" "}
        <span className="text-navy-950 font-semibold">{data.forecast.model}</span>
      </footer>
    </main>
  );
}
