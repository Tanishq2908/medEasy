"""
Train the lab-report risk models and write evaluation metrics.

Each model is trained on a public benchmark dataset whose features are values
that appear on routine lab reports. For every model this script:

  1. Makes a stratified 75/25 train/test split (fixed seed).
  2. Compares Logistic Regression, Random Forest and HistGradientBoosting
     with 5-fold stratified cross-validation (ROC-AUC) on the training split.
  3. Refits the best one, wrapped in probability calibration (sigmoid).
  4. Picks the decision threshold that maximises Youden's J on out-of-fold
     training predictions (so the test set never influences it).
  5. Evaluates on the untouched test split: ROC-AUC, PR-AUC, accuracy,
     balanced accuracy, sensitivity, specificity, precision, F1, MCC and
     Brier score, each with a 95% bootstrap confidence interval
     (1,000 resamples), plus ROC / PR / calibration curves and the
     confusion matrix.
  6. Refits a bootstrap ensemble used at inference time to put an
     uncertainty interval around each patient's predicted risk.

Run:  python -m backend.ml.train      (from the repository root)
"""

from __future__ import annotations

import json
import os
import time
import warnings
from dataclasses import dataclass, field
from typing import Callable

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
MODELS_DIR = os.path.abspath(os.path.join(HERE, "..", "models"))

SEED = 42
N_BOOT = 1000
N_ENSEMBLE = 20


# ─────────────────────────────────────────────────────────────
# Dataset loaders. Column names are the canonical analyte keys used by the
# lab-report parser (backend/lab_catalog.py), so inference is a lookup.
# ─────────────────────────────────────────────────────────────
def load_diabetes() -> tuple[pd.DataFrame, pd.Series]:
    cols = ["pregnancies", "glucose", "bp_diastolic", "skin", "insulin", "bmi", "dpf", "age", "y"]
    df = pd.read_csv(os.path.join(DATA_DIR, "diabetes.csv"), header=None, names=cols)
    # Zeros are recorded instead of missing values in this dataset.
    for c in ["glucose", "bp_diastolic", "insulin", "bmi"]:
        df.loc[df[c] == 0, c] = np.nan
    X = df[["glucose", "insulin", "bmi", "bp_diastolic", "age"]]
    return X, df["y"].astype(int)


def load_liver() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(os.path.join(DATA_DIR, "liver.csv"))
    X = pd.DataFrame({
        "age": df["Age"],
        "sex": (df["Gender"] == "Male").astype(float),
        "total_bilirubin": df["Total_Bilirubin"],
        "direct_bilirubin": df["Direct_Bilirubin"],
        "alp": df["Alkaline_Phosphotase"],
        "alt": df["Alamine_Aminotransferase"],
        "ast": df["Aspartate_Aminotransferase"],
        "total_protein": df["Total_Protiens"],
        "albumin": df["Albumin"],
        "ag_ratio": df["Albumin_and_Globulin_Ratio"],
    })
    y = (df["Dataset"] == 1).astype(int)  # 1 = liver patient
    return X, y


def load_kidney() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(os.path.join(DATA_DIR, "kidney.csv"))
    num = lambda s: pd.to_numeric(s.astype(str).str.strip().replace({"?": None, "nan": None}), errors="coerce")
    X = pd.DataFrame({
        "age": num(df["age"]),
        "bp_diastolic": num(df["bp"]),
        "urine_sg": num(df["sg"]),
        "urine_albumin": num(df["al"]),
        "glucose": num(df["bgr"]),
        "urea": num(df["bu"]),
        "creatinine": num(df["sc"]),
        "sodium": num(df["sod"]),
        "potassium": num(df["pot"]),
        "hemoglobin": num(df["hemo"]),
        "hematocrit": num(df["pcv"]),
        "wbc": num(df["wc"]),
        "rbc": num(df["rc"]),
    })
    y = (df["classification"].astype(str).str.strip() == "ckd").astype(int)
    return X, y


def load_thyroid() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(os.path.join(DATA_DIR, "thyroid.csv"))
    num = lambda s: pd.to_numeric(s, errors="coerce")
    X = pd.DataFrame({
        "age": num(df["age"]).where(lambda a: a < 110),
        "sex": (df["sex"] == "M").astype(float).where(df["sex"].isin(["M", "F"])),
        "tsh": num(df["TSH"]),
        "t3": num(df["T3"]),
        "t4": num(df["TT4"]),
        "t4u": num(df["T4U"]),
        "fti": num(df["FTI"]),
    })
    y = df["Class"].str.contains("hypothyroid").astype(int)
    return X, y


@dataclass
class Spec:
    key: str
    name: str
    target: str
    loader: Callable[[], tuple[pd.DataFrame, pd.Series]]
    dataset: str
    dataset_url: str
    required_any: list[str]          # inference needs at least one of these
    min_features: int                # ...and at least this many features overall
    notes: str = ""
    feature_labels: dict = field(default_factory=dict)


SPECS = [
    Spec(
        key="diabetes", name="Type 2 Diabetes Risk", target="Diabetes (WHO criteria)",
        loader=load_diabetes,
        dataset="Pima Indians Diabetes Database (NIDDK, via UCI)",
        dataset_url="https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database",
        required_any=["glucose"], min_features=2,
        notes="Glucose in this dataset is a 2-hour oral glucose tolerance value; "
              "fasting or random glucose from a report is used as a proxy.",
    ),
    Spec(
        key="liver", name="Liver Disease Risk", target="Diagnosed liver disease",
        loader=load_liver,
        dataset="Indian Liver Patient Dataset (ILPD, UCI)",
        dataset_url="https://archive.ics.uci.edu/dataset/225/ilpd+indian+liver+patient+dataset",
        required_any=["alt", "ast", "total_bilirubin", "alp"], min_features=3,
    ),
    Spec(
        key="ckd", name="Chronic Kidney Disease Risk", target="Chronic kidney disease",
        loader=load_kidney,
        dataset="Chronic Kidney Disease dataset (UCI)",
        dataset_url="https://archive.ics.uci.edu/dataset/336/chronic+kidney+disease",
        required_any=["creatinine", "urea"], min_features=3,
        notes="Small dataset (n=400) with clearly separated classes; near-perfect "
              "scores reflect the benchmark, not clinical-grade performance.",
    ),
    Spec(
        key="thyroid", name="Hypothyroidism Risk", target="Primary / compensated hypothyroidism",
        loader=load_thyroid,
        dataset="Thyroid Disease (hypothyroid subset, Garvan Institute via UCI)",
        dataset_url="https://archive.ics.uci.edu/dataset/102/thyroid+disease",
        required_any=["tsh"], min_features=2,
        notes="Labels were assigned largely from these same hormone levels, "
              "so the benchmark is easier than real-world screening.",
    ),
]


# ─────────────────────────────────────────────────────────────
# Candidate models
# ─────────────────────────────────────────────────────────────
def candidates() -> dict[str, Pipeline]:
    return {
        "Logistic Regression": Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=1.0)),
        ]),
        "Random Forest": Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("clf", RandomForestClassifier(
                n_estimators=120, max_depth=8, min_samples_leaf=3, class_weight="balanced",
                random_state=SEED, n_jobs=-1)),
        ]),
        "Gradient Boosting": Pipeline([
            ("clf", HistGradientBoostingClassifier(
                max_iter=250, learning_rate=0.05, max_leaf_nodes=15,
                l2_regularization=1.0, class_weight="balanced", random_state=SEED)),
        ]),
    }


def calibrated(est: Pipeline) -> CalibratedClassifierCV:
    return CalibratedClassifierCV(est, method="sigmoid", cv=5)


# ─────────────────────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────────────────────
def point_metrics(y: np.ndarray, p: np.ndarray, thr: float) -> dict[str, float]:
    pred = (p >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "roc_auc": roc_auc_score(y, p),
        "pr_auc": average_precision_score(y, p),
        "accuracy": accuracy_score(y, pred),
        "balanced_accuracy": balanced_accuracy_score(y, pred),
        "sensitivity": recall_score(y, pred, zero_division=0),
        "specificity": tn / (tn + fp) if (tn + fp) else 0.0,
        "precision": precision_score(y, pred, zero_division=0),
        "f1": f1_score(y, pred, zero_division=0),
        "mcc": matthews_corrcoef(y, pred),
        "brier": brier_score_loss(y, p),
    }


def bootstrap_ci(y: np.ndarray, p: np.ndarray, thr: float, n: int = N_BOOT) -> dict[str, list[float]]:
    rng = np.random.default_rng(SEED)
    samples: dict[str, list[float]] = {}
    idx = np.arange(len(y))
    for _ in range(n):
        b = rng.choice(idx, size=len(idx), replace=True)
        if len(np.unique(y[b])) < 2:
            continue
        for k, v in point_metrics(y[b], p[b], thr).items():
            samples.setdefault(k, []).append(v)
    return {k: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] for k, v in samples.items()}


def downsample_curve(x: np.ndarray, y: np.ndarray, n: int = 60) -> list[dict]:
    if len(x) > n:
        keep = np.unique(np.linspace(0, len(x) - 1, n).round().astype(int))
        x, y = x[keep], y[keep]
    return [{"x": round(float(a), 4), "y": round(float(b), 4)} for a, b in zip(x, y)]


# ─────────────────────────────────────────────────────────────
def train_one(spec: Spec) -> dict:
    t0 = time.time()
    X, y = spec.loader()
    X = X.astype(float)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=SEED)
    y_tr_np, y_te_np = y_tr.to_numpy(), y_te.to_numpy()

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    # 1) model selection by CV ROC-AUC on the training split
    comparison = []
    for name, est in candidates().items():
        oof = cross_val_predict(est, X_tr, y_tr, cv=skf, method="predict_proba")[:, 1]
        fold_aucs = [roc_auc_score(y_tr_np[va], oof[va]) for _, va in skf.split(X_tr, y_tr)]
        comparison.append({
            "model": name,
            "cv_roc_auc_mean": float(np.mean(fold_aucs)),
            "cv_roc_auc_std": float(np.std(fold_aucs)),
        })
    comparison.sort(key=lambda r: r["cv_roc_auc_mean"], reverse=True)
    best_name = comparison[0]["model"]
    best = candidates()[best_name]

    # 2) threshold from out-of-fold calibrated predictions (Youden's J)
    oof_cal = cross_val_predict(calibrated(best), X_tr, y_tr, cv=skf, method="predict_proba")[:, 1]
    fpr, tpr, thr = roc_curve(y_tr_np, oof_cal)
    j = tpr - fpr
    threshold = float(np.clip(thr[int(np.argmax(j))], 0.05, 0.95))

    # 3) final calibrated model, evaluated once on the held-out test split
    model = calibrated(best).fit(X_tr, y_tr)
    p_te = model.predict_proba(X_te)[:, 1]
    metrics = point_metrics(y_te_np, p_te, threshold)
    ci = bootstrap_ci(y_te_np, p_te, threshold)

    fpr_te, tpr_te, _ = roc_curve(y_te_np, p_te)
    prec, rec, _ = precision_recall_curve(y_te_np, p_te)
    frac_pos, mean_pred = calibration_curve(y_te_np, p_te, n_bins=8, strategy="quantile")
    cm = confusion_matrix(y_te_np, (p_te >= threshold).astype(int), labels=[0, 1])

    # 4) global feature importance (permutation on test split, ROC-AUC drop)
    from sklearn.inspection import permutation_importance
    pi = permutation_importance(model, X_te, y_te, scoring="roc_auc", n_repeats=15, random_state=SEED)
    importance = sorted(
        [{"feature": f, "importance": float(m), "std": float(s)}
         for f, m, s in zip(X.columns, pi.importances_mean, pi.importances_std)],
        key=lambda r: r["importance"], reverse=True,
    )

    # 5) final production model: refit on all data; bootstrap ensemble for per-patient intervals
    final = calibrated(best).fit(X, y)
    rng = np.random.default_rng(SEED)
    ensemble = []
    for _ in range(N_ENSEMBLE):
        b = rng.choice(len(X), size=len(X), replace=True)
        if len(np.unique(y.iloc[b])) < 2:
            continue
        ensemble.append(clone(best).fit(X.iloc[b], y.iloc[b]))

    medians = X.median(numeric_only=True).to_dict()
    artifact = {
        "key": spec.key,
        "model": final,
        "ensemble": ensemble,
        "features": list(X.columns),
        "threshold": threshold,
        "train_medians": {k: (None if pd.isna(v) else float(v)) for k, v in medians.items()},
        "sklearn_version": sklearn.__version__,
    }
    joblib.dump(artifact, os.path.join(MODELS_DIR, f"{spec.key}.joblib"), compress=3)

    r = lambda d: {k: round(float(v), 4) for k, v in d.items()}
    return {
        "key": spec.key,
        "name": spec.name,
        "target": spec.target,
        "dataset": spec.dataset,
        "dataset_url": spec.dataset_url,
        "notes": spec.notes,
        "features": list(X.columns),
        "required_any": spec.required_any,
        "min_features": spec.min_features,
        "n_samples": int(len(X)),
        "n_train": int(len(X_tr)),
        "n_test": int(len(X_te)),
        "prevalence": round(float(y.mean()), 4),
        "algorithm": best_name,
        "calibration": "Platt (sigmoid), 5-fold",
        "threshold": round(threshold, 4),
        "model_comparison": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in row.items()} for row in comparison],
        "test_metrics": r(metrics),
        "test_metrics_ci95": {k: [round(a, 4), round(b, 4)] for k, (a, b) in ci.items()},
        "confusion_matrix": {"tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1])},
        "roc_curve": downsample_curve(fpr_te, tpr_te),
        "pr_curve": downsample_curve(rec[::-1], prec[::-1]),
        "calibration_curve": [{"predicted": round(float(a), 4), "observed": round(float(b), 4)} for a, b in zip(mean_pred, frac_pos)],
        "feature_importance": importance,
        "train_seconds": round(time.time() - t0, 1),
    }


def train_all(verbose: bool = True) -> dict:
    os.makedirs(MODELS_DIR, exist_ok=True)
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sklearn_version": sklearn.__version__,
        "seed": SEED,
        "bootstrap_resamples": N_BOOT,
        "protocol": "Stratified 75/25 split; model chosen by 5-fold CV ROC-AUC on train; "
                    "Platt-calibrated; threshold by Youden's J on out-of-fold train predictions; "
                    "metrics on held-out test with 95% bootstrap CIs.",
        "models": [],
    }
    for spec in SPECS:
        res = train_one(spec)
        report["models"].append(res)
        if verbose:
            m, c = res["test_metrics"], res["test_metrics_ci95"]
            print(f"[{spec.key:8s}] {res['algorithm']:20s} ROC-AUC {m['roc_auc']:.3f} "
                  f"(95% CI {c['roc_auc'][0]:.3f}-{c['roc_auc'][1]:.3f})  F1 {m['f1']:.3f}  "
                  f"sens {m['sensitivity']:.3f}  spec {m['specificity']:.3f}  [{res['train_seconds']}s]")
    with open(os.path.join(MODELS_DIR, "metrics.json"), "w") as f:
        json.dump(report, f, indent=2)
    return report


if __name__ == "__main__":
    train_all()
