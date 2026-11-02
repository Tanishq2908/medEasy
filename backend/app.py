"""
MedEasy API: lab report analysis.

Run locally:   python -m backend.app          (from the repository root)
Production:    gunicorn backend.app:app

Serves the React build from ../dist when it exists, so one process hosts everything.
"""

from __future__ import annotations

import datetime as dt
import io
import json
import logging
import os
import secrets
import sqlite3
import threading
from functools import wraps
from typing import Any, Optional

import jwt
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT, ".env"))

from . import analysis, llm, risk  # noqa: E402
from .lab_catalog import ANALYTES, CATEGORY_ORDER, ref_range  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("medeasy")

DIST_DIR = os.path.join(ROOT, "dist")
DB_PATH = os.getenv("DATABASE_PATH", os.path.join(ROOT, "backend", "data", "medeasy.db"))
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)
if not os.getenv("JWT_SECRET"):
    log.warning("JWT_SECRET not set; using a random secret (logins reset on restart)")
MAX_UPLOAD_MB = 15

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*").split(",")}})


# ─────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    sex TEXT,
    birth_year INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    health_score INTEGER,
    abnormal_count INTEGER,
    analysis_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, report_date);
"""


def db() -> sqlite3.Connection:
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def _close_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)


# ─────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────
def _token(user_id: int) -> str:
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=7)
    return jwt.encode({"sub": str(user_id), "exp": exp}, JWT_SECRET, algorithm="HS256")


def _current_user() -> Optional[sqlite3.Row]:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        uid = int(jwt.decode(header[7:], JWT_SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    return db().execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _current_user()
        if user is None:
            return jsonify(error="Please sign in."), 401
        g.user = user
        return fn(*args, **kwargs)
    return wrapper


def _user_json(u: sqlite3.Row) -> dict[str, Any]:
    return {"id": u["id"], "name": u["name"], "email": u["email"], "sex": u["sex"], "birth_year": u["birth_year"]}


def _clean_sex(v: Any) -> Optional[str]:
    s = str(v or "").strip().upper()[:1]
    return s if s in ("M", "F") else None


@app.post("/api/auth/register")
def register():
    d = request.get_json(silent=True) or {}
    name, email, pw = (d.get("name") or "").strip(), (d.get("email") or "").strip().lower(), d.get("password") or ""
    if not name or "@" not in email or len(pw) < 8:
        return jsonify(error="Name, a valid email and a password of at least 8 characters are required."), 400
    birth_year = d.get("birth_year")
    try:
        birth_year = int(birth_year) if birth_year else None
    except ValueError:
        birth_year = None
    try:
        cur = db().execute(
            "INSERT INTO users (name, email, password_hash, sex, birth_year, created_at) VALUES (?,?,?,?,?,?)",
            (name, email, generate_password_hash(pw), _clean_sex(d.get("sex")), birth_year,
             dt.datetime.now(dt.timezone.utc).isoformat()))
        db().commit()
    except sqlite3.IntegrityError:
        return jsonify(error="An account with this email already exists."), 409
    user = db().execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(token=_token(user["id"]), user=_user_json(user)), 201


@app.post("/api/auth/login")
def login():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    user = db().execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if user is None or not check_password_hash(user["password_hash"], d.get("password") or ""):
        return jsonify(error="Incorrect email or password."), 401
    return jsonify(token=_token(user["id"]), user=_user_json(user))


@app.get("/api/auth/me")
@login_required
def me():
    return jsonify(user=_user_json(g.user))


# ─────────────────────────────────────────────────────────────
# Health, catalog and model metrics
# ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return jsonify(status="ok", models=risk.status(), llm_enabled=llm.enabled())


@app.get("/api/analytes")
def analytes():
    return jsonify(
        categories=CATEGORY_ORDER,
        analytes=[{"key": k, "name": v["name"], "category": v["category"], "unit": v["unit"],
                   "ref_low": ref_range(k, None)[0], "ref_high": ref_range(k, None)[1]}
                  for k, v in ANALYTES.items()],
    )


@app.get("/api/models/metrics")
def model_metrics():
    if risk.status()["status"] != "ready":
        return jsonify(error="Models are not loaded yet.", state=risk.status()), 503
    return jsonify({**risk.metrics(), "feature_labels": risk.FEATURE_LABELS})


# ─────────────────────────────────────────────────────────────
# Text extraction
# ─────────────────────────────────────────────────────────────
IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


@app.post("/api/extract")
def extract():
    f = request.files.get("file")
    if f is None or not f.filename:
        return jsonify(error="No file uploaded."), 400
    data = f.read()
    name = f.filename.lower()
    mime = (f.mimetype or "").lower()

    if name.endswith(".pdf") or mime == "application/pdf":
        import pdfplumber
        try:
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                pages = [p.extract_text(x_tolerance=1.5, y_tolerance=3) or "" for p in pdf.pages[:20]]
        except Exception as e:  # noqa: BLE001
            return jsonify(error=f"Could not read this PDF ({e})."), 400
        text = "\n".join(pages).strip()
        if len(text) >= 40:
            return jsonify(text=text, method="pdf-text", patient=analysis.parse_patient(text))
        # scanned PDF: no text layer
        return jsonify(error="This PDF has no text layer.", needs_ocr=True), 422

    if name.endswith((".txt", ".csv")) or mime.startswith("text/"):
        text = data.decode("utf-8", errors="ignore")
        return jsonify(text=text, method="text", patient=analysis.parse_patient(text))

    if mime in IMAGE_TYPES or name.endswith((".png", ".jpg", ".jpeg", ".webp")):
        text = llm.transcribe_image(data, mime or "image/jpeg")
        if text:
            return jsonify(text=text, method="vision-llm", patient=analysis.parse_patient(text))
        return jsonify(error="Server-side image reading needs GROQ_API_KEY.", needs_ocr=True), 422

    return jsonify(error="Unsupported file type. Upload a PDF, image or text file."), 415


# ─────────────────────────────────────────────────────────────
# Analysis
# ─────────────────────────────────────────────────────────────
def run_analysis(text: str, manual: dict[str, Any], patient: dict[str, Any], use_llm: bool = True) -> dict[str, Any]:
    parsed = analysis.parse_values(text) if text else {}
    for k, v in (manual or {}).items():
        if k in ANALYTES and v not in (None, ""):
            try:
                parsed[k] = {"value": float(v), "raw": "manual entry"}
            except (TypeError, ValueError):
                pass

    header = analysis.parse_patient(text) if text else {}
    age = patient.get("age") or header.get("age")
    try:
        age = float(age) if age not in (None, "") else None
    except (TypeError, ValueError):
        age = None
    sex = _clean_sex(patient.get("sex")) or header.get("sex")

    results = analysis.interpret(parsed, sex)
    values = {r["key"]: r["value"] for r in results}
    if patient.get("bmi"):
        try:
            values["bmi"] = float(patient["bmi"])
        except (TypeError, ValueError):
            pass
    risks = risk.predict_all(values, age, sex)
    score = analysis.health_score(results)

    out: dict[str, Any] = {
        "patient": {"age": age, "sex": sex},
        "results": results,
        "categories": analysis.category_summary(results),
        "health_score": score,
        "counts": {
            "total": len(results),
            "normal": sum(r["status"] == "normal" for r in results),
            "abnormal": sum(r["status"] != "normal" for r in results),
            "critical": sum(r["critical"] for r in results),
        },
        "risks": risks,
        "precautions": analysis.build_precautions(results, risks),
        "summary": analysis.template_summary(results, risks, score),
        "ai": None,
        "disclaimer": "Educational tool, not a medical device. Always confirm results with a qualified doctor.",
    }
    if use_llm and results:
        out["ai"] = llm.narrative(out)
    return out


@app.post("/api/analyze")
def analyze():
    d = request.get_json(silent=True) or {}
    text = (d.get("text") or "")[:200_000]
    manual = d.get("values") or {}
    patient = d.get("patient") or {}

    user = _current_user()
    if user is not None:
        if not patient.get("sex") and user["sex"]:
            patient["sex"] = user["sex"]
        if not patient.get("age") and user["birth_year"]:
            patient["age"] = dt.date.today().year - user["birth_year"]

    result = run_analysis(text, manual, patient, use_llm=d.get("use_llm", True))
    if not result["results"]:
        return jsonify(error="No recognisable lab values were found. Check the file, or enter values manually.",
                       analysis=result), 422

    if user is not None and d.get("save", True):
        report_date = (d.get("report_date") or dt.date.today().isoformat())[:10]
        title = (d.get("title") or "").strip()[:120] or f"Lab report {report_date}"
        cur = db().execute(
            "INSERT INTO reports (user_id, title, report_date, created_at, health_score, abnormal_count, analysis_json)"
            " VALUES (?,?,?,?,?,?,?)",
            (user["id"], title, report_date, dt.datetime.now(dt.timezone.utc).isoformat(),
             result["health_score"], result["counts"]["abnormal"], json.dumps(result)))
        db().commit()
        result["report"] = {"id": cur.lastrowid, "title": title, "report_date": report_date}
    return jsonify(result)


@app.get("/api/reports")
@login_required
def list_reports():
    rows = db().execute(
        "SELECT id, title, report_date, created_at, health_score, abnormal_count FROM reports "
        "WHERE user_id = ? ORDER BY report_date DESC, id DESC", (g.user["id"],)).fetchall()
    return jsonify(reports=[dict(r) for r in rows])


def _own_report(rid: int) -> Optional[sqlite3.Row]:
    return db().execute("SELECT * FROM reports WHERE id = ? AND user_id = ?", (rid, g.user["id"])).fetchone()


@app.get("/api/reports/<int:rid>")
@login_required
def get_report(rid: int):
    row = _own_report(rid)
    if row is None:
        return jsonify(error="Report not found."), 404
    a = json.loads(row["analysis_json"])
    a["report"] = {"id": row["id"], "title": row["title"], "report_date": row["report_date"]}
    return jsonify(a)


@app.delete("/api/reports/<int:rid>")
@login_required
def delete_report(rid: int):
    if _own_report(rid) is None:
        return jsonify(error="Report not found."), 404
    db().execute("DELETE FROM reports WHERE id = ?", (rid,))
    db().commit()
    return jsonify(ok=True)


@app.get("/api/trends")
@login_required
def trends():
    rows = db().execute("SELECT id, title, report_date, health_score, analysis_json FROM reports "
                        "WHERE user_id = ? ORDER BY report_date, id", (g.user["id"],)).fetchall()
    series: dict[str, dict[str, Any]] = {}
    scores, risk_series = [], {}
    for r in rows:
        a = json.loads(r["analysis_json"])
        scores.append({"date": r["report_date"], "report_id": r["id"], "score": r["health_score"]})
        for res in a["results"]:
            s = series.setdefault(res["key"], {"key": res["key"], "name": res["name"], "unit": res["unit"],
                                               "category": res["category"], "ref_low": res["ref_low"],
                                               "ref_high": res["ref_high"], "points": []})
            s["ref_low"], s["ref_high"] = res["ref_low"], res["ref_high"]  # latest report's interval
            s["points"].append({"date": r["report_date"], "report_id": r["id"], "value": res["value"], "status": res["status"]})
        for rk in a.get("risks", []):
            if rk.get("available"):
                risk_series.setdefault(rk["key"], {"key": rk["key"], "name": rk["name"], "points": []})["points"].append(
                    {"date": r["report_date"], "probability": rk["probability"], "low": rk["interval"][0], "high": rk["interval"][1]})
    return jsonify(scores=scores, analytes=sorted(series.values(), key=lambda s: -len(s["points"])),
                   risks=list(risk_series.values()))


@app.post("/api/chat")
def chat():
    d = request.get_json(silent=True) or {}
    q = (d.get("question") or "").strip()
    a = d.get("analysis")
    if not q or not isinstance(a, dict):
        return jsonify(error="A question and an analysis are required."), 400
    if not llm.enabled():
        return jsonify(error="The assistant needs GROQ_API_KEY to be configured on the server."), 503
    reply = llm.answer(q, a, d.get("history") or [])
    if reply is None:
        return jsonify(error="The assistant is unavailable right now. Please try again."), 502
    return jsonify(answer=reply)


# ─────────────────────────────────────────────────────────────
# Frontend (built React app)
# ─────────────────────────────────────────────────────────────
@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def spa(path: str):
    if path.startswith("api/"):
        return jsonify(error="Not found."), 404
    if not os.path.isdir(DIST_DIR):
        return jsonify(service="MedEasy API", hint="Run `npm run build` to serve the frontend from here."), 200
    full = os.path.join(DIST_DIR, path)
    if path and os.path.isfile(full):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


@app.errorhandler(413)
def too_large(_e):
    return jsonify(error=f"File too large (max {MAX_UPLOAD_MB} MB)."), 413


# ─────────────────────────────────────────────────────────────
init_db()
threading.Thread(target=risk.ensure_loaded, daemon=True).start()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG") == "1")
