"use client";

import Link from "next/link";

interface HeaderProps {
  generatedAt: string;
  targetDay: string;
  loading: boolean;
  onRun: () => void;
}

const fmtTs = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function Header({
  generatedAt,
  targetDay,
  loading,
  onRun,
}: HeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-navy-700 pb-5 mb-6">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent-electric to-accent-neon shadow-glow grid place-items-center text-white font-black text-lg"
        >
          Δ
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-navy-950 tracking-tight">
            Delphi Prediction
          </h1>
          <p className="text-xs text-slate-600 font-mono">
            Delivery day {targetDay} · last updated {fmtTs(generatedAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/research"
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors border border-navy-700 text-navy-950 hover:border-accent-electric hover:text-accent-electric"
        >
          Research
        </Link>
        <button
          onClick={onRun}
          disabled={loading}
          className={[
            "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
            "bg-accent-electric text-white shadow-glow",
            "hover:bg-accent-neon",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {loading ? "Optimizing…" : "Run Optimization"}
        </button>
      </div>
    </header>
  );
}
