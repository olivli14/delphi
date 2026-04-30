"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatTimeOfDay,
  PriceForecast as PriceForecastT,
} from "../types";

interface Props {
  forecast: PriceForecastT;
}

export default function PriceForecast({ forecast }: Props) {
  const data = forecast.delivery_start.map((iso, i) => ({
    time: formatTimeOfDay(iso),
    p10: forecast.p10[i],
    p50: forecast.p50[i],
    p90: forecast.p90[i],
    band: forecast.p90[i] - forecast.p10[i],
    bandLow: forecast.p10[i],
  }));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h3 className="section-title">Price forecast</h3>
          <p className="text-xs text-slate-500 -mt-2 font-mono">
            DAM €/MWh · 96 × 15-minute periods · model{" "}
            <span className="text-accent-neon">{forecast.model}</span>
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-slate-400">
          p10 · p50 · p90
        </span>
      </div>

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#152045" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              interval={11}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => `€${v.toFixed(0)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#0a1024",
                border: "1px solid #1c2c5e",
                borderRadius: 12,
                color: "#e2e8f0",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `€${Number(value).toFixed(2)}/MWh`,
                name,
              ]}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="bandLow"
              stackId="band"
              stroke="transparent"
              fill="transparent"
              name="p10"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="band"
              stackId="band"
              stroke="transparent"
              fill="url(#bandFill)"
              name="p10–p90 band"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              name="p50 (median)"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
