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
import InfoPopover from "./InfoPopover";

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
          <div className="flex items-center gap-2">
            <h3 className="section-title mb-0">Price forecast</h3>
            <InfoPopover title="Price forecast">
              <p>
                Probabilistic day-ahead price forecast for the Greek market
                (HEnEx), 96 quarter-hour delivery periods. Y-axis is{" "}
                <strong>€/MWh</strong>; X-axis is delivery time (UTC).
              </p>
              <p>
                The cyan line is the <strong>p50 (median)</strong> expected
                price. The shaded blue band spans <strong>p10 → p90</strong>{" "}
                — the 80% confidence interval from the quantile regressor.
              </p>
              <p>
                A wide band means the model is uncertain (often around dawn
                ramp-up and evening peak). The optimizer uses all three
                quantiles to stress-test the schedule.
              </p>
            </InfoPopover>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-mono">
            DAM €/MWh · 96 × 15-minute periods · model{" "}
            <span className="text-accent-electric font-semibold">{forecast.model}</span>
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-slate-600 font-semibold">
          p10 · p50 · p90
        </span>
      </div>

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#cfe1ee" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#475569", fontSize: 11 }}
              interval={11}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 11 }}
              tickFormatter={(v) => `€${v.toFixed(0)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #cfe1ee",
                borderRadius: 12,
                color: "#0b2545",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `€${Number(value).toFixed(2)}/MWh`,
                name,
              ]}
            />
            <Legend wrapperStyle={{ color: "#475569", fontSize: 12 }} />
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
              stroke="#0369a1"
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
