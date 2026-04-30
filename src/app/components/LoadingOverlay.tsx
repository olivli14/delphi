"use client";

import { useEffect, useState } from "react";

interface Step {
  label: string;
  detail: string;
  ms: number;
}

const STEPS: Step[] = [
  {
    label: "Connecting to ENTSO-E Transparency Platform",
    detail: "Authenticating · opening DAM stream for HEnEx (Greek market)",
    ms: 700,
  },
  {
    label: "Streaming day-ahead prices",
    detail: "Pulling 96 quarter-hour ticks · €/MWh · UTC delivery windows",
    ms: 700,
  },
  {
    label: "Fetching Athens weather forecast",
    detail: "Open-Meteo · temperature, wind, cloud, shortwave radiation",
    ms: 600,
  },
  {
    label: "Cross-referencing analogue markets",
    detail: "CAISO · OMIE · ENTSO-E DE — enriches the multi-market training set",
    ms: 800,
  },
  {
    label: "Training quantile price forecaster",
    detail: "Gradient-boosted regressor → p10 / p50 / p90 confidence bands",
    ms: 900,
  },
  {
    label: "Building thermal envelope",
    detail: "1% / °C derate above 25°C · per-period max charge & discharge MW",
    ms: 600,
  },
  {
    label: "Solving MILP schedule",
    detail: "96 periods × 3 scenarios · maximise (revenue − degradation cost)",
    ms: 1100,
  },
  {
    label: "Aggregating P&L, cycles & degradation",
    detail: "Composing summary KPIs and scenario trajectories",
    ms: 500,
  },
];

interface Props {
  open: boolean;
  /** Set true once the live fetch has resolved. The overlay then jumps to the
   * final "Done" state and unmounts after a short beat. */
  finished: boolean;
}

export default function LoadingOverlay({ open, finished }: Props) {
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) {
      setCurrent(0);
      setElapsed(0);
      return;
    }
    setCurrent(0);
    setElapsed(0);

    const startedAt = performance.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = (idx: number) => {
      if (cancelled) return;
      setCurrent(idx);
      if (idx >= STEPS.length - 1) return;
      timer = setTimeout(() => tick(idx + 1), STEPS[idx].ms);
    };
    tick(0);

    const elapsedTimer = setInterval(() => {
      setElapsed((performance.now() - startedAt) / 1000);
    }, 100);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(elapsedTimer);
    };
  }, [open]);

  useEffect(() => {
    if (finished) setCurrent(STEPS.length);
  }, [finished]);

  if (!open) return null;

  const total = STEPS.length;
  const progressPct = finished
    ? 100
    : Math.min(99, ((current + 1) / total) * 95);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Optimization in progress"
    >
      <div className="w-[min(560px,92vw)] rounded-2xl border border-navy-600 bg-navy-900/95 shadow-glow p-6">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent-electric opacity-60 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-electric" />
          </span>
          <h2 className="text-base md:text-lg font-semibold text-white tracking-tight">
            {finished ? "Optimization complete" : "Optimizing day-ahead schedule"}
          </h2>
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            {elapsed.toFixed(1)}s
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-400 font-mono">
          Live pipeline · Athens (Greece) · 96 × 15-minute delivery periods
        </p>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-navy-700">
          <div
            className="h-full bg-gradient-to-r from-accent-electric via-accent-neon to-accent-green transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ol className="mt-5 space-y-2.5 max-h-[46vh] overflow-auto scroll-soft pr-1">
          {STEPS.map((s, i) => {
            const state =
              i < current || finished
                ? "done"
                : i === current
                  ? "active"
                  : "pending";
            return (
              <li key={s.label} className="flex gap-3 items-start">
                <StepIcon state={state} />
                <div className="min-w-0">
                  <div
                    className={[
                      "text-sm font-medium",
                      state === "done"
                        ? "text-slate-300"
                        : state === "active"
                          ? "text-white"
                          : "text-slate-500",
                    ].join(" ")}
                  >
                    {s.label}
                  </div>
                  <div
                    className={[
                      "text-[11px] font-mono mt-0.5",
                      state === "pending" ? "text-slate-600" : "text-slate-500",
                    ].join(" ")}
                  >
                    {s.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent-green/15 text-accent-green border border-accent-green/40 text-[11px]">
        ✓
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-accent-electric/60 bg-accent-electric/10">
        <span className="block h-2 w-2 rounded-full bg-accent-electric animate-pulse" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-navy-600 bg-navy-800 text-[11px] text-slate-600">
      •
    </span>
  );
}
