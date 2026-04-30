"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatEur,
  formatTimeOfDay,
  ScenarioResult,
} from "../types";
import InfoPopover from "./InfoPopover";

interface Props {
  scenarios: Record<"p10" | "p50" | "p90", ScenarioResult>;
}

function cumulative(values: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of values) {
    acc += v;
    out.push(acc);
  }
  return out;
}

export default function ScenarioChart({ scenarios }: Props) {
  const p10Pnl = cumulative(
    scenarios.p10.schedule.map(
      (r) => r.period_revenue_eur - r.period_degradation_eur,
    ),
  );
  const p50Pnl = cumulative(
    scenarios.p50.schedule.map(
      (r) => r.period_revenue_eur - r.period_degradation_eur,
    ),
  );
  const p90Pnl = cumulative(
    scenarios.p90.schedule.map(
      (r) => r.period_revenue_eur - r.period_degradation_eur,
    ),
  );

  const data = scenarios.p50.schedule.map((row, i) => ({
    time: formatTimeOfDay(row.delivery_start),
    p10: p10Pnl[i],
    p50: p50Pnl[i],
    p90: p90Pnl[i],
  }));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="section-title mb-0">Scenario P&L trajectory</h3>
            <InfoPopover title="Scenario P&L">
              <p>
                Cumulative net P&L (€) over the day, computed for each price
                scenario from the forecaster: <strong>p10</strong>{" "}
                (pessimistic), <strong>p50</strong> (median), and{" "}
                <strong>p90</strong> (optimistic).
              </p>
              <p>
                Each line answers: &quot;if the day&apos;s prices land at this
                quantile, what does the schedule earn after degradation?&quot;
                The spread between p10 and p90 is the day&apos;s revenue
                risk band.
              </p>
              <p>
                A flat segment means the battery sat idle (no profitable
                arbitrage); a steep climb is a discharge into a price spike.
              </p>
            </InfoPopover>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Cumulative net P&L across the day for each price scenario
          </p>
        </div>
        <div className="flex gap-3 text-[11px] uppercase tracking-widest">
          <span className="text-accent-rose">
            p10: {formatEur(scenarios.p10.net_pnl_eur)}
          </span>
          <span className="text-accent-neon">
            p50: {formatEur(scenarios.p50.net_pnl_eur)}
          </span>
          <span className="text-accent-green">
            p90: {formatEur(scenarios.p90.net_pnl_eur)}
          </span>
        </div>
      </div>

      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
            <CartesianGrid stroke="#15616d" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#a89a85", fontSize: 11 }}
              interval={11}
            />
            <YAxis
              tick={{ fill: "#a89a85", fontSize: 11 }}
              tickFormatter={(v) => `€${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: "#03212e",
                border: "1px solid #1f7e8a",
                borderRadius: 12,
                color: "#ffecd1",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                formatEur(Number(value), 0),
                name,
              ]}
            />
            <Legend wrapperStyle={{ color: "#a89a85", fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="p10"
              stroke="#78290f"
              strokeWidth={2}
              dot={false}
              name="p10"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#ffecd1"
              strokeWidth={2}
              dot={false}
              name="p50"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="p90"
              stroke="#3fb8c4"
              strokeWidth={2}
              dot={false}
              name="p90"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
