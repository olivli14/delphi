"use client";

import { formatEur } from "../types";

interface Props {
  totalRevenue: number;
  netPnl: number;
  cycles: number;
  totalDegradation: number;
}

interface CardProps {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}

function Card({ label, value, hint, accent }: CardProps) {
  return (
    <div className="card relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mt-2">{value}</div>
      {hint ? <div className="text-xs text-slate-400 mt-1">{hint}</div> : null}
    </div>
  );
}

export default function KPICards({
  totalRevenue,
  netPnl,
  cycles,
  totalDegradation,
}: Props) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Total Revenue"
        value={formatEur(totalRevenue, 0)}
        hint="Discharge − charge × DAM price"
        accent="linear-gradient(90deg, #ff7d00, #ffecd1)"
      />
      <Card
        label="Net P&L"
        value={formatEur(netPnl, 0)}
        hint="After degradation cost"
        accent="linear-gradient(90deg, #ffecd1, #3fb8c4)"
      />
      <Card
        label="Cycles"
        value={cycles.toFixed(2)}
        hint="Equivalent full cycles / day"
        accent="linear-gradient(90deg, #3fb8c4, #ffecd1)"
      />
      <Card
        label="Degradation"
        value={formatEur(totalDegradation, 0)}
        hint="€/MWh throughput cost"
        accent="linear-gradient(90deg, #ff7d00, #78290f)"
      />
    </section>
  );
}
