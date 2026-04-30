"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTimeOfDay, ThermalPeriod } from "../types";

interface Props {
  periods: ThermalPeriod[];
}

export default function ThermalChart({ periods }: Props) {
  const data = periods.map((p) => ({
    time: formatTimeOfDay(p.delivery_start),
    maxCharge: p.max_charge_mw,
    maxDischarge: p.max_discharge_mw,
    temp: p.temperature_c,
  }));

  return (
    <div className="card">
      <h3 className="section-title">Thermal envelope</h3>
      <p className="text-xs text-slate-500 -mt-2 font-mono">
        Power derate · 1% / °C above 25°C · ambient temperature overlay
      </p>

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
            <CartesianGrid stroke="#152045" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              interval={11}
            />
            <YAxis
              yAxisId="mw"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => `${v} MW`}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: "#fb7185", fontSize: 11 }}
              tickFormatter={(v) => `${v}°C`}
            />
            <Tooltip
              contentStyle={{
                background: "#0a1024",
                border: "1px solid #1c2c5e",
                borderRadius: 12,
                color: "#e2e8f0",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => {
                if (name === "Temperature")
                  return [`${Number(value).toFixed(1)} °C`, name];
                return [`${Number(value).toFixed(2)} MW`, name];
              }}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Line
              yAxisId="mw"
              type="monotone"
              dataKey="maxCharge"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Max charge"
              isAnimationActive={false}
            />
            <Line
              yAxisId="mw"
              type="monotone"
              dataKey="maxDischarge"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 3"
              name="Max discharge"
              isAnimationActive={false}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#fb7185"
              strokeWidth={2}
              dot={false}
              name="Temperature"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
