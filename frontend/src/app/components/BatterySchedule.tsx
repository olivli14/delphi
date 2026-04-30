"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTimeOfDay, ScheduleRow } from "../types";

interface Props {
  schedule: ScheduleRow[];
  capacityMwh: number;
}

export default function BatterySchedule({ schedule, capacityMwh }: Props) {
  const data = schedule.map((row) => ({
    time: formatTimeOfDay(row.delivery_start),
    charge: -row.charge_mw,
    discharge: row.discharge_mw,
    soc: row.soc_pct,
  }));

  return (
    <div className="card">
      <h3 className="section-title">Battery schedule</h3>
      <p className="text-xs text-slate-500 -mt-2 font-mono">
        Charge (negative) · Discharge (positive) · SoC overlay · capacity{" "}
        {capacityMwh.toFixed(0)} MWh
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
              yAxisId="power"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => `${v} MW`}
            />
            <YAxis
              yAxisId="soc"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: "#fbbf24", fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
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
                if (name === "SoC")
                  return [`${Number(value).toFixed(1)}%`, name];
                return [`${Math.abs(Number(value)).toFixed(2)} MW`, name];
              }}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Bar
              yAxisId="power"
              dataKey="charge"
              fill="#3b82f6"
              name="Charge"
              isAnimationActive={false}
            />
            <Bar
              yAxisId="power"
              dataKey="discharge"
              fill="#34d399"
              name="Discharge"
              isAnimationActive={false}
            />
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="soc"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={false}
              name="SoC"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
