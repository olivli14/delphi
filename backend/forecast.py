"""
Module 2 — Probabilistic Price Forecasting

Trains a quantile regression forecaster on the dataset assembled by the
ingestion module and produces a 96-period (15-minute) forecast with 10th,
50th and 90th percentile bands.

Today that dataset is Greek DAM history joined with Athens weather features.
The primary model path uses scikit-learn's HistGradientBoostingRegressor with
`loss="quantile"`.

If scikit-learn is not installed the module falls back to a ridge
regression with empirical residual quantiles stratified by period-of-day —
same input/output shape, less expressive, but always available so the
optimizer can still run end-to-end.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence

import numpy as np

from . import ingest

try:
    from sklearn.ensemble import HistGradientBoostingRegressor
    HAVE_HGB = True
    HGB_ERROR = ""
except Exception as _e:
    HistGradientBoostingRegressor = None  # type: ignore
    HAVE_HGB = False
    HGB_ERROR = f"{type(_e).__name__}: {_e}"


@dataclass
class PriceForecast:
    delivery_start: list[str]   # ISO strings, length 96
    period_index: list[int]
    p10: list[float]
    p50: list[float]
    p90: list[float]
    model: str
    trained_on_days: int


# --------------------------------------------------------------------------- #
#  Feature engineering                                                        #
# --------------------------------------------------------------------------- #
FEATURE_COLS = [
    "period_index",
    "hour_sin", "hour_cos",
    "dow_sin", "dow_cos",
    "doy_sin", "doy_cos",
    "temperature_c", "wind_speed_ms",
    "cloud_cover_pct", "radiation",
    "lag_24h", "lag_7d", "rolling_mean_3h",
]


def _row_features(row: dict, lag_24h: float, lag_7d: float,
                  rolling: float) -> list[float]:
    ts = datetime.fromisoformat(row["delivery_start"])
    hour = ts.hour + ts.minute / 60.0
    dow = ts.weekday()
    doy = ts.timetuple().tm_yday
    return [
        row["period_index"],
        math.sin(2 * math.pi * hour / 24.0),
        math.cos(2 * math.pi * hour / 24.0),
        math.sin(2 * math.pi * dow / 7.0),
        math.cos(2 * math.pi * dow / 7.0),
        math.sin(2 * math.pi * doy / 365.0),
        math.cos(2 * math.pi * doy / 365.0),
        row["temperature_c"], row["wind_speed_ms"],
        row["cloud_cover_pct"], row["radiation"],
        lag_24h, lag_7d, rolling,
    ]


def _build_dataset(history: Sequence[dict]):
    by_idx = {h["delivery_start"]: h for h in history}
    sorted_rows = sorted(history, key=lambda r: r["delivery_start"])
    X, y = [], []
    for i, row in enumerate(sorted_rows):
        if i < 7 * 96:
            continue
        ts = datetime.fromisoformat(row["delivery_start"])
        lag24 = by_idx.get((ts - timedelta(days=1)).isoformat(),
                           {"price": row["price"]})["price"]
        lag7 = by_idx.get((ts - timedelta(days=7)).isoformat(),
                          {"price": row["price"]})["price"]
        prev_window = sorted_rows[max(0, i - 12):i]
        rolling = (sum(p["price"] for p in prev_window) / len(prev_window)
                   if prev_window else row["price"])
        X.append(_row_features(row, lag24, lag7, rolling))
        y.append(row["price"])
    return np.array(X, dtype=float), np.array(y, dtype=float), sorted_rows


def _build_target_features(target_day: datetime, history: Sequence[dict],
                           target_weather: Sequence[dict]):
    by_idx = {h["delivery_start"]: h for h in history}
    sorted_rows = sorted(history, key=lambda r: r["delivery_start"])
    last_prices = [r["price"] for r in sorted_rows[-12:]] or [95.0]
    rolling = float(sum(last_prices) / len(last_prices))

    base = target_day.replace(hour=0, minute=0, second=0,
                              microsecond=0, tzinfo=timezone.utc)
    feats = []
    timestamps = []
    for i, w in enumerate(target_weather):
        ts = base + timedelta(minutes=15 * i)
        timestamps.append(ts)
        lag24 = by_idx.get((ts - timedelta(days=1)).isoformat(),
                           {"price": rolling})["price"]
        lag7 = by_idx.get((ts - timedelta(days=7)).isoformat(),
                          {"price": rolling})["price"]
        row = {
            "delivery_start": ts.isoformat(),
            "period_index": i,
            "temperature_c": w["temperature_c"],
            "wind_speed_ms": w["wind_speed_ms"],
            "cloud_cover_pct": w["cloud_cover_pct"],
            "radiation": w["shortwave_radiation_w_m2"],
            "price": rolling,
        }
        feats.append(_row_features(row, lag24, lag7, rolling))
    return np.array(feats, dtype=float), timestamps


# --------------------------------------------------------------------------- #
#  Model variants                                                              #
# --------------------------------------------------------------------------- #
def _train_hgb_quantile(X: np.ndarray, y: np.ndarray, alpha: float):
    model = HistGradientBoostingRegressor(
        loss="quantile",
        quantile=alpha,
        learning_rate=0.05,
        max_iter=300,
        max_leaf_nodes=31,
        min_samples_leaf=12,
        l2_regularization=0.0,
    )
    model.fit(X, y)
    return model


def _quantile_residual_fallback(X: np.ndarray, y: np.ndarray,
                                X_target: np.ndarray):
    """
    Lightweight fallback when HistGradientBoostingRegressor is not available.

    We:
      1. Fit a closed-form ridge regression on the training set to get a point
         forecast.
      2. Compute residuals on the train set.
      3. Take the empirical 10/50/90 percentiles of residuals stratified by
         period-of-day, and add them to the point forecast.
    """
    # Ridge regression — closed form (X^T X + λI)^-1 X^T y, λ small but non-zero.
    X1 = np.hstack([X, np.ones((X.shape[0], 1))])
    lam = 1e-2 * X1.shape[0]
    coef = np.linalg.solve(X1.T @ X1 + lam * np.eye(X1.shape[1]), X1.T @ y)
    yhat_train = X1 @ coef
    residuals = y - yhat_train

    # Stratify by period_index so quantiles capture intraday heteroskedasticity.
    period_idx_train = X[:, 0].astype(int)
    quantiles = np.zeros((96, 3))
    for p in range(96):
        mask = period_idx_train == p
        if mask.sum() < 5:
            mask = np.ones_like(period_idx_train, dtype=bool)
        rs = residuals[mask]
        quantiles[p, 0] = np.percentile(rs, 10)
        quantiles[p, 1] = np.percentile(rs, 50)
        quantiles[p, 2] = np.percentile(rs, 90)

    Xt1 = np.hstack([X_target, np.ones((X_target.shape[0], 1))])
    point = Xt1 @ coef
    p10 = point + quantiles[:, 0]
    p50 = point + quantiles[:, 1]
    p90 = point + quantiles[:, 2]
    return p10, p50, p90


# --------------------------------------------------------------------------- #
#  Public API                                                                  #
# --------------------------------------------------------------------------- #
def forecast_for_day(target_day: datetime,
                     training_days: int = 60) -> PriceForecast:
    history = ingest.load_history_for_training(days=training_days)
    target_weather = ingest.load_weather_for_day(target_day, "Athens-GR")

    X_train, y_train, _ = _build_dataset(history)
    X_target, timestamps = _build_target_features(target_day, history, target_weather)

    if HAVE_HGB and X_train.shape[0] >= 200:
        model_p10 = _train_hgb_quantile(X_train, y_train, alpha=0.10)
        model_p50 = _train_hgb_quantile(X_train, y_train, alpha=0.50)
        model_p90 = _train_hgb_quantile(X_train, y_train, alpha=0.90)
        p10 = model_p10.predict(X_target)
        p50 = model_p50.predict(X_target)
        p90 = model_p90.predict(X_target)
        model_name = "sklearn-hgb-quantile"
    else:
        p10, p50, p90 = _quantile_residual_fallback(X_train, y_train, X_target)
        if not HAVE_HGB:
            reason = f"sklearn unavailable — {HGB_ERROR}"
        else:
            reason = f"insufficient training rows ({X_train.shape[0]}<200)"
        model_name = f"ridge+empirical-quantile ({reason})"

    # Enforce monotonicity p10 <= p50 <= p90 — the quantile regressors are
    # trained independently so a small amount of crossing is possible.
    p10 = np.minimum(p10, p50)
    p90 = np.maximum(p90, p50)

    return PriceForecast(
        delivery_start=[ts.isoformat() for ts in timestamps],
        period_index=list(range(96)),
        p10=[float(v) for v in p10],
        p50=[float(v) for v in p50],
        p90=[float(v) for v in p90],
        model=model_name,
        trained_on_days=training_days,
    )


def to_dict(forecast: PriceForecast) -> dict:
    return {
        "model": forecast.model,
        "trained_on_days": forecast.trained_on_days,
        "delivery_start": forecast.delivery_start,
        "period_index": forecast.period_index,
        "p10": forecast.p10,
        "p50": forecast.p50,
        "p90": forecast.p90,
    }
