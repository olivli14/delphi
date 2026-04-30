"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  children: ReactNode;
  /** "left" anchors the popover to the left edge of the trigger; "right" to
   * the right edge. Use "right" near the right side of a card. */
  align?: "left" | "right";
}

export default function InfoPopover({ title, children, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`More info about ${title}`}
        aria-expanded={open}
        className={[
          "grid h-5 w-5 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
          open
            ? "border-accent-electric bg-accent-electric/15 text-accent-electric"
            : "border-navy-600 bg-navy-800 text-slate-700 hover:border-accent-electric hover:text-accent-electric",
        ].join(" ")}
      >
        i
      </button>
      {open && (
        <div
          role="dialog"
          className={[
            "absolute top-7 z-30 w-[min(320px,80vw)] rounded-xl border border-navy-700 bg-white shadow-glow p-3 text-xs text-slate-700 leading-relaxed",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          <div className="text-[11px] uppercase tracking-widest text-accent-electric mb-1.5 font-semibold">
            {title}
          </div>
          <div className="space-y-2 text-slate-700">{children}</div>
        </div>
      )}
    </span>
  );
}
