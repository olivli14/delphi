# Greek Battery Optimizer

Day-ahead battery scheduling for the Greek electricity market. The pipeline
ingests DAM prices and weather, produces a probabilistic price forecast at
15-minute resolution, computes thermal-aware battery operating limits, and
solves a mixed-integer program (HiGHS) for the optimal charge / discharge
schedule.

## Architecture

```
backend/                FastAPI pipeline (Modules 1–4)
  ingest.py             Module 1 — DAM + Open-Meteo + analogue markets, SQLite
  forecast.py           Module 2 — LightGBM quantile (p10/p50/p90) regression
  thermal.py            Module 3 — Temperature-driven battery envelope
  optimizer.py          Module 4 — HiGHS MILP, three scenarios
  main.py               FastAPI app, exposes GET /api/optimize
  seed_data.py          Pre-computes a result so the dashboard loads instantly

api/index.py            Vercel serverless entry; re-exports the FastAPI app

src/app/page.tsx        Next.js 14 dashboard (Tailwind + Recharts, dark theme)
src/app/components/     Header, KPI cards, four charts, schedule table
public/                 Bundled seed optimisation result for first-paint

vercel.json             Single-project deployment (Next.js + Python /api)
```

## Local development

### Backend
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Pre-compute the seed result (also bootstraps the SQLite cache).
python -m backend.seed_data

# Run the API (auto-reload).
uvicorn backend.main:app --reload --port 8000
```

`GET http://localhost:8000/api/optimize` returns the full pipeline JSON.
`GET http://localhost:8000/api/seed` returns the cached seed result.

### Frontend
```bash
npm install
npm run dev
```

Open http://localhost:3000. The dashboard renders immediately from
`/seed_optimization.json`. Click **Run Optimization** to call the live API.

For local full-stack dev, `vercel dev` from the repo root serves Next.js and
the Python `/api` function together on a single port.

## Deploying to Vercel

Single Vercel project. Next.js handles all routes by default; `vercel.json`
rewrites `/api/*` to `api/index.py` so the FastAPI app handles those.

1. `vercel link` from the repository root.
2. Vercel auto-detects Next.js and the Python runtime picks up `requirements.txt`.
3. Add environment variable `ENTSOE_API_KEY` (optional — without it the
   ingestion falls back to flagged synthetic data).
4. Re-pre-compute the seed if needed and copy
   `backend/data/seed_optimization.json` to `public/seed_optimization.json`.
5. Deploy.

## Environment variables

See [`.env.example`](./.env.example).

| Variable                | Used by   | Purpose                                         |
| ----------------------- | --------- | ----------------------------------------------- |
| `ENTSOE_API_KEY`        | backend   | Live Greek DAM price ingestion                  |

## Notes on data scarcity

Because Greek standalone batteries only entered the DAM in test mode in April
2026, there is essentially no telemetry to learn from. The framework therefore:

* relies on **market signals** (DAM, weather, analogue markets) instead of
  asset history;
* derives operating limits **from the battery spec + temperature forecast**
  via a deterministic thermal model (1% derate / °C above 25°C, +0.5%
  degradation cost / °C, tightened SoC bounds at extremes);
* runs the MILP across **three price scenarios** (p10/p50/p90) so the user
  can see how robust the schedule is to forecast uncertainty;
* **flags every synthetic row** in SQLite (`is_synthetic = 1`) so a future
  data engineer can swap in real feeds without touching the optimisation logic.
