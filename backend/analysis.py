"""
Lab report text  ->  structured values  ->  interpretation, score and precautions.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from .lab_catalog import ANALYTES, CATEGORY_ORDER, normalize, ref_range

# (alias, key) pairs, longest alias first, so "free t4" wins over "t4"
# and "urine albumin" wins over "albumin".
_ALIASES = sorted(
    ((a.lower(), k) for k, v in ANALYTES.items() for a in v["aliases"]),
    key=lambda t: len(t[0]), reverse=True,
)
_ALIAS_RE = [(a, k, re.compile(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])")) for a, k in _ALIASES]

_NUM = r"(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)"
_VALUE_RE = re.compile(r"(?<![\d.])" + _NUM + r"(?![\d.,])(?!\s*[-–]\s*\d)")
_RANGE_RE = re.compile(_NUM + r"\s*[-–]\s*" + _NUM)
_LT_RE = re.compile(r"(?:<|less than|upto|up to)\s*" + _NUM, re.I)
_SKIP_LINE = re.compile(r"non[\s-]?hdl|/\s*hdl|hdl\s*/|ldl\s*/|chol\s*/", re.I)


def _f(s: str) -> float:
    return float(s.replace(",", ""))


def parse_patient(text: str) -> dict[str, Any]:
    """Pull age / sex from the report header when present."""
    info: dict[str, Any] = {}
    t = text.lower()
    m = re.search(r"(\d{1,3})\s*(?:y|yr|yrs|years)\.?\s*[/,|]\s*(male|female|m|f)\b", t)
    if m:
        info["age"], info["sex"] = int(m.group(1)), m.group(2)[0].upper()
    if "age" not in info:
        m = re.search(r"\bage\b\s*(?:/\s*(?:sex|gender))?\s*[:\-]?\s*(\d{1,3})", t)
        if m and 0 < int(m.group(1)) < 120:
            info["age"] = int(m.group(1))
    if "sex" not in info:
        m = re.search(r"\b(?:sex|gender)\b\s*[:\-]?\s*(male|female|m|f)\b", t)
        if m:
            info["sex"] = m.group(1)[0].upper()
    return info


def parse_values(text: str) -> dict[str, dict[str, Any]]:
    """
    Extract analyte values from free report text (PDF text, OCR output or pasted text).
    One analyte per line; the first numeric value after the analyte name is used.
    """
    found: dict[str, dict[str, Any]] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or len(line) > 220:
            continue
        low = line.lower()
        if _SKIP_LINE.search(low):
            continue
        for alias, key, rx in _ALIAS_RE:
            m = rx.search(low)
            if not m:
                continue
            if "ratio" in low and key != "ag_ratio":
                break
            if key in found:
                break
            rest = re.sub(r"\([^)]*\)", " ", low[m.end():])  # drop "(SGPT)", "(25-OH)" etc.
            vm = _VALUE_RE.search(rest)
            if not vm:
                break
            raw_val = _f(vm.group(1))
            val = normalize(key, raw_val, alias)
            entry: dict[str, Any] = {"value": round(val, 3), "raw": line[:160]}
            # use the report's own reference interval when it is in the same units
            if abs(val - raw_val) < 1e-9:
                after = rest[vm.end():]
                rm = _RANGE_RE.search(after)
                if rm:
                    lo, hi = _f(rm.group(1)), _f(rm.group(2))
                    if lo < hi and lo <= val * 10 and hi >= val / 10:
                        entry["report_ref"] = (lo, hi)
                else:
                    lm = _LT_RE.search(after)
                    if lm:
                        entry["report_ref"] = (0.0, _f(lm.group(1)))
            found[key] = entry
            break
    return found


def _status(key: str, value: float, lo: Optional[float], hi: Optional[float]) -> tuple[str, bool]:
    status = "normal"
    if lo is not None and value < lo:
        status = "low"
    elif hi is not None and value > hi:
        status = "high"
    crit = ANALYTES[key].get("critical")
    critical = bool(crit and ((crit[0] is not None and value < crit[0]) or (crit[1] is not None and value > crit[1])))
    return status, critical


def interpret(values: dict[str, dict[str, Any]], sex: Optional[str]) -> list[dict[str, Any]]:
    out = []
    for key, entry in values.items():
        meta = ANALYTES[key]
        lo, hi = entry.get("report_ref") or ref_range(key, sex)
        v = float(entry["value"])
        status, critical = _status(key, v, lo, hi)
        width = (hi - lo) if (lo is not None and hi is not None and hi > lo) else max(abs(hi or 1), 1)
        if status == "low":
            deviation = (lo - v) / width
        elif status == "high":
            deviation = (v - hi) / width
        else:
            deviation = 0.0
        meaning, tips = meta.get(status, ("", [])) if status != "normal" else ("Within the reference range.", [])
        out.append({
            "key": key,
            "name": meta["name"],
            "category": meta["category"],
            "value": round(v, 2),
            "unit": meta["unit"],
            "ref_low": lo,
            "ref_high": hi,
            "ref_source": "report" if entry.get("report_ref") else "standard",
            "status": status,
            "critical": critical,
            "deviation": round(deviation, 3),
            "meaning": meaning,
            "precautions": tips,
        })
    order = {c: i for i, c in enumerate(CATEGORY_ORDER)}
    out.sort(key=lambda r: (order.get(r["category"], 99), r["name"]))
    return out


def health_score(results: list[dict[str, Any]]) -> int:
    """
    0–100. Every test carries equal weight; an out-of-range test loses between half and
    all of its weight depending on how far it is from the range, and critical values
    cost an extra 5 points each.
    """
    if not results:
        return 100
    weight = 100.0 / len(results)
    score = 100.0
    for r in results:
        if r["status"] == "normal":
            continue
        score -= weight * min(1.0, 0.5 + 1.5 * r["deviation"])
        if r["critical"]:
            score -= 5
    return int(max(0, round(score)))


def category_summary(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cats: dict[str, dict[str, Any]] = {}
    for r in results:
        c = cats.setdefault(r["category"], {"category": r["category"], "total": 0, "normal": 0, "low": 0, "high": 0, "critical": 0})
        c["total"] += 1
        c[r["status"]] += 1
        c["critical"] += int(r["critical"])
    for c in cats.values():
        c["score"] = health_score([r for r in results if r["category"] == c["category"]])
    order = {c: i for i, c in enumerate(CATEGORY_ORDER)}
    return sorted(cats.values(), key=lambda c: order.get(c["category"], 99))


RISK_GUIDANCE = {
    "diabetes": {
        "precautions": ["Reduce sugar, sweetened drinks and refined carbohydrates.",
                        "Walk or exercise at least 30 minutes, 5 days a week.",
                        "Aim for 5–7% weight loss if overweight."],
        "tests": ["HbA1c", "Fasting plasma glucose", "Oral glucose tolerance test"],
        "specialist": "Endocrinologist / Diabetologist",
    },
    "liver": {
        "precautions": ["Avoid alcohol.", "Avoid unnecessary medicines and herbal supplements.",
                        "Limit fried, fatty and sugary foods; maintain a healthy weight."],
        "tests": ["Liver ultrasound", "Hepatitis B and C serology", "GGT", "Repeat LFT in 4–6 weeks"],
        "specialist": "Hepatologist / Gastroenterologist",
    },
    "ckd": {
        "precautions": ["Limit salt to under 5 g a day.", "Avoid NSAID painkillers (ibuprofen, diclofenac).",
                        "Keep blood pressure below 130/80 and control blood sugar."],
        "tests": ["eGFR", "Urine albumin-creatinine ratio", "Kidney ultrasound"],
        "specialist": "Nephrologist",
    },
    "thyroid": {
        "precautions": ["Use iodised salt.", "Take thyroid medication on an empty stomach if prescribed.",
                        "Watch for fatigue, weight change, cold intolerance."],
        "tests": ["Free T4", "Anti-TPO antibodies", "Repeat TSH in 6–8 weeks"],
        "specialist": "Endocrinologist",
    },
}

GENERAL_PRECAUTIONS = [
    "Keep a copy of this report and compare it with future tests to track trends.",
    "Share these results with your doctor; this analysis does not replace a medical consultation.",
]


def build_precautions(results: list[dict[str, Any]], risks: list[dict[str, Any]]) -> dict[str, Any]:
    by_cat: dict[str, list[str]] = {}
    for r in results:
        if r["status"] != "normal":
            for tip in r["precautions"]:
                lst = by_cat.setdefault(r["category"], [])
                if tip not in lst:
                    lst.append(tip)
    tests, specialists = [], []
    for risk in risks:
        if risk.get("available") and risk["level"] in ("Elevated", "High"):
            g = RISK_GUIDANCE[risk["key"]]
            lst = by_cat.setdefault(risk["name"], [])
            lst.extend(t for t in g["precautions"] if t not in lst)
            tests.extend(t for t in g["tests"] if t not in tests)
            if g["specialist"] not in specialists:
                specialists.append(g["specialist"])

    critical = [r for r in results if r["critical"]]
    abnormal = [r for r in results if r["status"] != "normal"]
    if critical:
        urgency = {"level": "urgent", "message": "One or more values are in a critical range. Contact a doctor today."}
    elif any(r.get("available") and r["level"] == "High" for r in risks) or len(abnormal) >= 5:
        urgency = {"level": "soon", "message": "Several findings need attention. Book a doctor's appointment within 1–2 weeks."}
    elif abnormal:
        urgency = {"level": "routine", "message": "Minor deviations. Discuss at your next routine check-up."}
    else:
        urgency = {"level": "none", "message": "All recognised values are within range. Keep up healthy habits."}

    return {
        "urgency": urgency,
        "by_category": [{"category": k, "items": v[:6]} for k, v in by_cat.items() if v],
        "follow_up_tests": tests,
        "specialists": specialists,
        "general": GENERAL_PRECAUTIONS,
    }


def template_summary(results: list[dict[str, Any]], risks: list[dict[str, Any]], score: int) -> str:
    if not results:
        return "No recognisable lab values were found in this report."
    abnormal = [r for r in results if r["status"] != "normal"]
    parts = [f"{len(results)} lab values were analysed; {len(results) - len(abnormal)} are within range"]
    if abnormal:
        names = ", ".join(f"{r['name']} ({r['status']})" for r in abnormal[:6])
        parts[0] += f" and {len(abnormal)} are outside it: {names}{'…' if len(abnormal) > 6 else ''}."
    else:
        parts[0] += "."
    elevated = [r for r in risks if r.get("available") and r["level"] != "Low"]
    if elevated:
        parts.append("The risk models flag " + ", ".join(
            f"{r['name'].replace(' Risk', '').lower()} ({round(r['probability'] * 100)}%)" for r in elevated) + ".")
    parts.append(f"Overall lab health score: {score}/100.")
    return " ".join(parts)
