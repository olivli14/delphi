"use client";

import { useMemo, useState } from "react";
import { formatTimeOfDay, ScheduleRow } from "../types";

type SortKey =
  | "period_index"
  | "price_eur_mwh"
  | "charge_mw"
  | "discharge_mw"
  | "soc_pct"
  | "period_revenue_eur"
  | "action";

interface Props {
  schedule: ScheduleRow[];
}

const ACTION_STYLES: Record<ScheduleRow["action"], string> = {
  charge: "bg-accent-electric/15 text-accent-electric border-accent-electric/30",
  discharge: "bg-accent-green/15 text-accent-green border-accent-green/30",
  idle: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export default function ScheduleTable({ schedule }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("period_index");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const arr = [...schedule];
    arr.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [schedule, sortKey, sortDir]);

  const click = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const arrow = (k: SortKey) =>
    sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "";

  return (
    <div className="card overflow-hidden">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="section-title mb-0">Schedule (96 periods)</h3>
        <span className="text-xs text-slate-500 font-mono">
          Click headers to sort
        </span>
      </div>

      <div className="max-h-[460px] overflow-auto scroll-soft rounded-xl border border-navy-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-navy-800 backdrop-blur z-10">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-400">
              <Th onClick={() => click("period_index")} arrow={arrow("period_index")}>
                #
              </Th>
              <Th>Time</Th>
              <Th onClick={() => click("action")} arrow={arrow("action")}>
                Action
              </Th>
              <Th
                onClick={() => click("charge_mw")}
                arrow={arrow("charge_mw")}
                className="text-right"
              >
                Charge MW
              </Th>
              <Th
                onClick={() => click("discharge_mw")}
                arrow={arrow("discharge_mw")}
                className="text-right"
              >
                Discharge MW
              </Th>
              <Th
                onClick={() => click("soc_pct")}
                arrow={arrow("soc_pct")}
                className="text-right"
              >
                SoC %
              </Th>
              <Th
                onClick={() => click("price_eur_mwh")}
                arrow={arrow("price_eur_mwh")}
                className="text-right"
              >
                Price €/MWh
              </Th>
              <Th
                onClick={() => click("period_revenue_eur")}
                arrow={arrow("period_revenue_eur")}
                className="text-right"
              >
                Revenue €
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.period_index}
                className="odd:bg-navy-900/40 hover:bg-navy-700/30 border-t border-navy-700/40 transition-colors"
              >
                <td className="px-3 py-2 text-slate-400 font-mono">
                  {r.period_index.toString().padStart(2, "0")}
                </td>
                <td className="px-3 py-2 font-mono">
                  {formatTimeOfDay(r.delivery_start)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${ACTION_STYLES[r.action]}`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.charge_mw > 0 ? r.charge_mw.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.discharge_mw > 0 ? r.discharge_mw.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.soc_pct.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.price_eur_mwh.toFixed(2)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${
                    r.period_revenue_eur >= 0
                      ? "text-accent-green"
                      : "text-accent-rose"
                  }`}
                >
                  {r.period_revenue_eur.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  arrow,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  arrow?: string;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={[
        "px-3 py-2 select-none",
        onClick ? "cursor-pointer hover:text-white" : "",
        className ?? "",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {arrow ? <span className="text-accent-neon">{arrow}</span> : null}
      </span>
    </th>
  );
}
