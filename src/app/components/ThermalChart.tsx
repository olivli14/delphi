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
import InfoPopover from "./InfoPopover";

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
      <div className="flex items-center gap-2">
        <h3 className="section-title mb-0">Thermal envelope</h3>
        <InfoPopover title="Thermal envelope">
          <p>
            How hot it is outside changes how hard the battery can push
            charge or discharge. Above 25°C, available power derates by{" "}
            <strong>1% per °C</strong> to keep the cells inside their safe
            operating window.
          </p>
          <p>
            The blue line is the per-period <strong>max charge MW</strong>;
            the dashed green line is <strong>max discharge MW</strong>. The
            rose line is the <strong>Athens ambient temperature</strong>{" "}
            forecast (right axis, °C).
          </p>
          <p>
            On hot afternoons you&apos;ll see the power ceiling drop right when
            prices peak — a real constraint on revenue capture.
          </p>
        </InfoPopover>
      </div>
      <p className="text-xs text-slate-500 mt-1 font-mono">
        Power derate · 1% / °C above 25°C · ambient temperature overlay
      </p>

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
            <CartesianGrid stroke="#15616d" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#a89a85", fontSize: 11 }}
              interval={11}
            />
            <YAxis
              yAxisId="mw"
              tick={{ fill: "#a89a85", fontSize: 11 }}
              tickFormatter={(v) => `${v} MW`}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: "#78290f", fontSize: 11 }}
              tickFormatter={(v) => `${v}°C`}
            />
            <Tooltip
              contentStyle={{
                background: "#03212e",
                border: "1px solid #1f7e8a",
                borderRadius: 12,
                color: "#ffecd1",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => {
                if (name === "Temperature")
                  return [`${Number(value).toFixed(1)} °C`, name];
                return [`${Number(value).toFixed(2)} MW`, name];
              }}
            />
            <Legend wrapperStyle={{ color: "#a89a85", fontSize: 12 }} />
            <Line
              yAxisId="mw"
              type="monotone"
              dataKey="maxCharge"
              stroke="#ff7d00"
              strokeWidth={2}
              dot={false}
              name="Max charge"
              isAnimationActive={false}
            />
            <Line
              yAxisId="mw"
              type="monotone"
              dataKey="maxDischarge"
              stroke="#3fb8c4"
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
              stroke="#78290f"
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
