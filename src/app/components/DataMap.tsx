"use client";

import { useState } from "react";
import InfoPopover from "./InfoPopover";

const W = 720;
const H = 360;

const project = (lon: number, lat: number): [number, number] => [
  (lon + 180) * 2,
  (90 - lat) * 2,
];

interface City {
  id: string;
  name: string;
  market: string;
  role: "primary" | "analogue";
  lat: number;
  lon: number;
  blurb: string;
}

const CITIES: City[] = [
  {
    id: "athens",
    name: "Athens",
    market: "HEnEx · Greek DAM",
    role: "primary",
    lat: 37.98,
    lon: 23.73,
    blurb:
      "Target market. The battery sits here — local DAM prices and Athens weather drive the schedule.",
  },
  {
    id: "caiso",
    name: "California",
    market: "CAISO",
    role: "analogue",
    lat: 36.78,
    lon: -119.42,
    blurb:
      "Reference market shown for context. Its weather series is ingested; the current forecaster does not train directly on CAISO prices.",
  },
  {
    id: "omie",
    name: "Madrid",
    market: "OMIE · Iberian DAM",
    role: "analogue",
    lat: 40.42,
    lon: -3.7,
    blurb:
      "Reference market shown for context. Its weather is a useful climate comparison to Athens, but not a separate price-training feed in the current code.",
  },
  {
    id: "entsoe_de",
    name: "Germany",
    market: "ENTSO-E DE",
    role: "analogue",
    lat: 51.17,
    lon: 10.45,
    blurb:
      "Reference market shown for context. Germany is displayed because it is part of the demo's reference-market story, not because German DAM prices are directly fitted in the current model.",
  },
];

// Hand-simplified equirectangular continent polygons (low-poly, stylised).
// Coordinates are pre-projected to the 720×360 viewBox.
const CONTINENTS: string[] = [
  // North America
  "M30,50 L60,44 L100,70 L110,100 L140,130 L170,144 L204,164 L204,150 L196,130 L204,110 L230,90 L250,80 L230,70 L200,70 L170,50 L100,36 L40,36 Z",
  // Greenland
  "M260,60 L310,60 L320,30 L260,16 L230,20 Z",
  // South America
  "M204,164 L220,156 L240,164 L260,180 L290,194 L290,224 L260,244 L244,260 L216,290 L216,240 L204,210 L196,190 Z",
  // Europe
  "M340,108 L370,108 L390,106 L420,106 L430,96 L440,70 L416,60 L380,64 L370,76 L350,80 L340,100 Z",
  // Africa
  "M326,150 L350,170 L380,170 L400,174 L430,156 L460,156 L460,190 L440,210 L426,240 L400,250 L390,240 L370,210 L340,170 Z",
  // Asia
  "M440,70 L480,100 L450,120 L460,140 L480,150 L500,164 L520,164 L550,156 L560,170 L580,174 L590,190 L630,196 L650,194 L640,170 L630,140 L640,120 L640,100 L670,70 L700,46 L640,36 L580,36 L520,30 L480,44 Z",
  // Australia
  "M590,206 L610,210 L640,204 L660,230 L640,256 L620,244 L590,244 L590,224 Z",
];

export default function DataMap() {
  const [hover, setHover] = useState<string | null>(null);

  const athens = CITIES.find((c) => c.role === "primary")!;
  const [ax, ay] = project(athens.lon, athens.lat);
  const analogues = CITIES.filter((c) => c.role === "analogue");

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <h3 className="section-title mb-0">Data sources · reference markets</h3>
        <InfoPopover title="Reference markets">
          <p>
            The live pipeline fetches Greek DAM prices plus weather for Athens
            and several reference geographies. In the current implementation,
            the forecaster trains on Greek DAM history joined with
            Athens-local weather features.
          </p>
          <p>
            <strong className="text-accent-electric">Athens</strong> is the
            target market and battery location. The dashed lines mark reference
            markets shown in the UI; they are not evidence of cross-market
            price training by themselves.
          </p>
        </InfoPopover>
      </div>
      <p className="text-xs text-slate-600 mt-1 font-mono">
        1 target market · 3 reference markets · hover a marker for detail
      </p>

      <div className="mt-3 relative rounded-xl border border-navy-700 bg-navy-800 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern
              id="dotgrid"
              x="0"
              y="0"
              width="18"
              height="18"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.6" fill="#94b8ce" />
            </pattern>
            <radialGradient id="primaryGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="analogueGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0369a1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width={W} height={H} fill="url(#dotgrid)" />

          {[60, 120, 180, 240, 300].map((y) => (
            <line
              key={`lat-${y}`}
              x1="0"
              x2={W}
              y1={y}
              y2={y}
              stroke="#cfe1ee"
              strokeDasharray="2 6"
              strokeWidth="1"
            />
          ))}
          {[120, 240, 360, 480, 600].map((x) => (
            <line
              key={`lon-${x}`}
              y1="0"
              y2={H}
              x1={x}
              x2={x}
              stroke="#cfe1ee"
              strokeDasharray="2 6"
              strokeWidth="1"
            />
          ))}

          {CONTINENTS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="#dceaf3"
              stroke="#94b8ce"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          ))}

          {analogues.map((c) => {
            const [x, y] = project(c.lon, c.lat);
            return (
              <line
                key={`link-${c.id}`}
                x1={ax}
                y1={ay}
                x2={x}
                y2={y}
                stroke="#0369a1"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}

          {CITIES.map((c) => {
            const [x, y] = project(c.lon, c.lat);
            const isPrimary = c.role === "primary";
            const r = isPrimary ? 6 : 4.5;
            const fill = isPrimary ? "#0ea5e9" : "#0369a1";
            const glowFill = isPrimary
              ? "url(#primaryGlow)"
              : "url(#analogueGlow)";
            const labelDx = c.id === "caiso" ? -8 : 10;
            const labelAnchor = c.id === "caiso" ? "end" : "start";
            return (
              <g
                key={c.id}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={x} cy={y} r={isPrimary ? 28 : 22} fill={glowFill} />
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                {isPrimary && (
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 4}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="1"
                    opacity="0.7"
                  >
                    <animate
                      attributeName="r"
                      values={`${r + 2};${r + 12};${r + 2}`}
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.7;0;0.7"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <text
                  x={x + labelDx}
                  y={y + 4}
                  textAnchor={labelAnchor}
                  fill="#0b2545"
                  fontSize="11"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  style={{ paintOrder: "stroke" }}
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinejoin="round"
                >
                  {c.name}
                </text>
              </g>
            );
          })}
        </svg>

        {hover && (
          <div className="absolute left-3 bottom-3 max-w-[78%] rounded-xl border border-navy-700 bg-white p-3 text-xs text-slate-700 shadow-glow pointer-events-none">
            {(() => {
              const c = CITIES.find((x) => x.id === hover)!;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-block h-2 w-2 rounded-full",
                        c.role === "primary"
                          ? "bg-accent-neon"
                          : "bg-accent-electric",
                      ].join(" ")}
                    />
                    <span className="font-semibold text-navy-950">{c.name}</span>
                    <span className="text-slate-600 font-mono">
                      · {c.market}
                    </span>
                  </div>
                  <p className="mt-1.5 text-slate-700 leading-relaxed">
                    {c.blurb}
                  </p>
                  <div className="mt-1.5 text-[10px] font-mono text-slate-500">
                    {c.lat.toFixed(2)}°, {c.lon.toFixed(2)}°
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
        {CITIES.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 text-slate-700 border-b border-navy-700/60 py-1"
            onMouseEnter={() => setHover(c.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className={[
                "inline-block h-2 w-2 rounded-full shrink-0",
                c.role === "primary" ? "bg-accent-neon" : "bg-accent-electric",
              ].join(" ")}
            />
            <span className="text-navy-950 font-semibold">{c.name}</span>
            <span className="text-slate-600">· {c.market}</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">
              {c.role === "primary" ? "primary" : "reference"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
