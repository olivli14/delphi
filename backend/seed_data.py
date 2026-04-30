"""
Pre-computes a realistic optimisation result for next-day delivery and writes
it to backend/data/seed_optimization.json so the Next.js dashboard can render
immediately on first load — without waiting for a fresh /api/optimize call.

Run with:  python -m backend.seed_data
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import main as backend_main  # noqa: E402


def main() -> None:
    target_day = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    result = backend_main._run_pipeline(target_day)
    out = backend_main.SEED_PATH
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    print(f"Wrote {out} ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
