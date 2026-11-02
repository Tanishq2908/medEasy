"""
Loads the trained lab-report risk models and scores a patient.

Per-patient output:
  probability     calibrated risk probability
  interval        95% uncertainty interval from the bootstrap ensemble
                  (spread measured on the logit scale, centred on the calibrated risk)
  level           Low / Elevated / High (Low = below the model's Youden threshold)
  confidence      0–1 confidence score = data coverage × interval tightness
  contributions   how much each provided value moved the risk versus a typical value
"""

from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
import sklearn

log = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
METRICS_PATH = os.path.join(MODELS_DIR, "metrics.json")

_lock = threading.Lock()
_models: dict[str, dict] = {}
_metrics: dict[str, Any] = {}
_state = {"status": "not_loaded", "error": None}

FEATURE_LABELS = {
    "age": "Age", "sex": "Sex (male)", "bmi": "BMI", "bp_diastolic": "Diastolic BP",
    "glucose": "Glucose", "insulin": "Insulin", "total_bilirubin": "Total Bilirubin",
    "direct_bilirubin": "Direct Bilirubin", "alp": "ALP", "alt": "ALT", "ast": "AST",
    "total_protein": "Total Protein", "albumin": "Albumin", "ag_ratio": "A/G Ratio",
    "urine_sg": "Urine Sp. Gravity", "urine_albumin": "Urine Albumin", "urea": "Urea",
    "creatinine": "Creatinine", "sodium": "Sodium", "potassium": "Potassium",
    "hemoglobin": "Hemoglobin", "hematocrit": "Hematocrit", "wbc": "WBC", "rbc": "RBC",
    "tsh": "TSH", "t3": "T3", "t4": "T4", "t4u": "T4 Uptake", "fti": "Free T4 Index",
}


def _logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def _sigmoid(z):
    return 1 / (1 + np.exp(-z))


def _load() -> None:
    global _metrics
    with open(METRICS_PATH) as f:
        _metrics = json.load(f)
    for m in _metrics["models"]:
        art = joblib.load(os.path.join(MODELS_DIR, f"{m['key']}.joblib"))
        _models[m["key"]] = art
    trained_with = _metrics.get("sklearn_version")
    if trained_with != sklearn.__version__:
        log.warning("Models trained with scikit-learn %s, running %s", trained_with, sklearn.__version__)


def ensure_loaded(retrain_on_failure: bool = True) -> None:
    """Load models once. If artifacts are missing or incompatible, retrain them."""
    with _lock:
        if _state["status"] == "ready":
            return
        try:
            _load()
            _state.update(status="ready", error=None)
            log.info("Loaded %d risk models", len(_models))
            return
        except Exception as e:  # noqa: BLE001
            _models.clear()
            _state.update(status="error", error=str(e))
            log.warning("Could not load risk models (%s)", e)
            if not retrain_on_failure:
                return
        try:
            _state["status"] = "training"
            from .ml.train import train_all
            train_all(verbose=True)
            _load()
            _state.update(status="ready", error=None)
        except Exception as e:  # noqa: BLE001
            _state.update(status="error", error=str(e))
            log.exception("Retraining failed")


def status() -> dict[str, Any]:
    return {"status": _state["status"], "error": _state["error"], "models": sorted(_models)}


def metrics() -> dict[str, Any]:
    return _metrics


def _model_meta(key: str) -> dict[str, Any]:
    return next(m for m in _metrics["models"] if m["key"] == key)


def predict_all(values: dict[str, float], age: Optional[float], sex: Optional[str]) -> list[dict[str, Any]]:
    if _state["status"] != "ready":
        return []
    inputs = dict(values)
    if age is not None:
        inputs["age"] = float(age)
    if sex in ("M", "F"):
        inputs["sex"] = 1.0 if sex == "M" else 0.0
    # derived thyroid features when the report gives T4 and T4 uptake
    if "t4" in inputs and "t4u" in inputs and "fti" not in inputs and inputs["t4u"]:
        inputs["fti"] = inputs["t4"] / inputs["t4u"]
    return [_predict(key, inputs) for key in _models]


def _predict(key: str, inputs: dict[str, float]) -> dict[str, Any]:
    art, meta = _models[key], _model_meta(key)
    feats: list[str] = art["features"]
    present = [f for f in feats if inputs.get(f) is not None]
    base = {
        "key": key, "name": meta["name"], "target": meta["target"], "algorithm": meta["algorithm"],
        "features": [{"key": f, "label": FEATURE_LABELS.get(f, f), "value": inputs.get(f)} for f in feats],
        "coverage": round(len(present) / len(feats), 3),
        "test_roc_auc": meta["test_metrics"]["roc_auc"],
        "base_rate": meta["prevalence"],
        "test_roc_auc_ci95": meta["test_metrics_ci95"]["roc_auc"],
    }
    if not any(f in present for f in meta["required_any"]) or len(present) < meta["min_features"]:
        need = " or ".join(FEATURE_LABELS.get(f, f) for f in meta["required_any"])
        return {**base, "available": False,
                "reason": f"Not enough inputs: needs {need} and at least {meta['min_features']} of the model's values."}

    row = pd.DataFrame([{f: inputs.get(f, np.nan) for f in feats}], dtype=float)
    p = float(art["model"].predict_proba(row)[:, 1][0])

    ens = np.array([m.predict_proba(row)[:, 1][0] for m in art["ensemble"]])
    spread = float(np.std(_logit(ens)))
    lo, hi = float(_sigmoid(_logit(p) - 1.96 * spread)), float(_sigmoid(_logit(p) + 1.96 * spread))

    thr = float(art["threshold"])
    level = "Low" if p < thr else ("High" if p >= max(0.7, thr + 0.2) else "Elevated")

    # contribution: risk change when this value is replaced by the population median
    contribs = []
    for f in present:
        alt = row.copy()
        alt[f] = art["train_medians"].get(f, np.nan)
        delta = p - float(art["model"].predict_proba(alt)[:, 1][0])
        contribs.append({"key": f, "label": FEATURE_LABELS.get(f, f), "value": inputs[f], "delta": round(delta, 4)})
    contribs.sort(key=lambda c: abs(c["delta"]), reverse=True)

    tightness = max(0.0, 1.0 - (hi - lo))
    confidence = round(base["coverage"] ** 0.5 * tightness, 3)

    return {
        **base, "available": True,
        "probability": round(p, 4),
        "interval": [round(lo, 4), round(hi, 4)],
        "threshold": round(thr, 4),
        "level": level,
        "confidence": confidence,
        "confidence_breakdown": {"data_coverage": base["coverage"], "interval_tightness": round(tightness, 3)},
        "contributions": contribs,
    }
