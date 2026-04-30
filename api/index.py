"""
Vercel serverless entry point.

Vercel's Python runtime auto-detects ASGI apps named `app` exported from
files inside /api.  This file re-exports the FastAPI app defined in
backend/main.py so we keep all the implementation in /backend and only the
deployment shim lives here.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app  # noqa: E402

__all__ = ["app"]
