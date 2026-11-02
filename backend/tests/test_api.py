"""Run with:  python -m pytest backend/tests -q   (from the repository root)"""

import io
import os
import tempfile

import pytest

os.environ.setdefault("DATABASE_PATH", os.path.join(tempfile.mkdtemp(), "test.db"))
os.environ.setdefault("JWT_SECRET", "test-secret-key-that-is-long-enough-for-hs256")

from backend import analysis, risk  # noqa: E402
from backend.app import app  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAMPLE = open(os.path.join(ROOT, "samples", "sample_lab_report.txt")).read()


@pytest.fixture(scope="module")
def client():
    risk.ensure_loaded(retrain_on_failure=False)
    assert risk.status()["status"] == "ready"
    return app.test_client()


def test_parser_reads_values_and_converts_units():
    v = analysis.parse_values(SAMPLE)
    assert v["hemoglobin"]["value"] == 12.1
    assert v["wbc"]["value"] == 7800            # "7,800"
    assert v["platelets"]["value"] == 210       # 2.1 lakh -> 210 x10^3/uL
    assert v["t4"]["value"] == pytest.approx(78.5, abs=0.1)  # 6.1 ug/dL -> nmol/L
    assert v["vitamin_d"]["value"] == 14.2      # not the "25" from "(25-OH)"
    assert v["hba1c"]["value"] == 7.1           # not matched as hemoglobin
    assert "hdl" in v and v["hdl"]["value"] == 36  # ratio line skipped
    assert v["hemoglobin"]["report_ref"] == (13.0, 17.0)


def test_parser_handles_alternative_units():
    v = analysis.parse_values("Glucose 7.5 mmol/L\nCreatinine 106 umol/L\nTLC 6.4 x10^3/uL\nFree T4 1.2 ng/dL\nT4 8 ug/dL")
    assert v["glucose"]["value"] == 135
    assert v["creatinine"]["value"] == pytest.approx(1.2, abs=0.01)
    assert v["wbc"]["value"] == 6400
    assert v["ft4"]["value"] == 1.2 and "t4" in v


def test_patient_header():
    assert analysis.parse_patient(SAMPLE) == {"age": 52, "sex": "M"}
    assert analysis.parse_patient("Gender: Female\nAge: 34 years") == {"age": 34, "sex": "F"}


def test_sex_specific_ranges():
    r = analysis.interpret({"hemoglobin": {"value": 12.5}}, "F")[0]
    assert r["status"] == "normal"
    r = analysis.interpret({"hemoglobin": {"value": 12.5}}, "M")[0]
    assert r["status"] == "low"


def test_critical_flag_and_urgency():
    res = analysis.interpret({"potassium": {"value": 6.8}}, None)
    assert res[0]["critical"]
    assert analysis.build_precautions(res, [])["urgency"]["level"] == "urgent"


def test_analyze_endpoint(client):
    d = client.post("/api/analyze", json={"text": SAMPLE, "use_llm": False}).get_json()
    assert d["counts"]["total"] == 30
    assert 0 <= d["health_score"] <= 100
    risks = {r["key"]: r for r in d["risks"]}
    assert set(risks) == {"diabetes", "liver", "ckd", "thyroid"}
    for r in risks.values():
        assert r["available"]
        lo, hi = r["interval"]
        assert 0 <= lo <= r["probability"] <= hi <= 1
        assert 0 <= r["confidence"] <= 1
    assert risks["thyroid"]["level"] in ("Elevated", "High")  # TSH 6.8


def test_risk_model_needs_inputs(client):
    d = client.post("/api/analyze", json={"values": {"hemoglobin": 14}, "use_llm": False}).get_json()
    assert all(not r["available"] for r in d["risks"])


def test_no_values_is_422(client):
    assert client.post("/api/analyze", json={"text": "nothing here"}).status_code == 422


def test_auth_history_and_trends(client):
    r = client.post("/api/auth/register", json={"name": "A", "email": "a@b.co", "password": "longpassword", "sex": "F"})
    assert r.status_code == 201
    h = {"Authorization": "Bearer " + r.get_json()["token"]}
    assert client.post("/api/auth/login", json={"email": "a@b.co", "password": "wrong"}).status_code == 401
    for date, glu in (("2026-01-01", 140), ("2026-06-01", 110)):
        d = client.post("/api/analyze", json={"values": {"glucose": glu}, "report_date": date, "use_llm": False}, headers=h).get_json()
        assert d["report"]["id"]
    assert len(client.get("/api/reports", headers=h).get_json()["reports"]) == 2
    t = client.get("/api/trends", headers=h).get_json()
    glucose = next(a for a in t["analytes"] if a["key"] == "glucose")
    assert [p["value"] for p in glucose["points"]] == [140, 110]
    assert client.get("/api/reports").status_code == 401


def test_extract_text_file(client):
    r = client.post("/api/extract", data={"file": (io.BytesIO(SAMPLE.encode()), "r.txt")})
    assert r.get_json()["patient"]["age"] == 52


def test_extract_pdf(client):
    with open(os.path.join(ROOT, "samples", "sample_lab_report.pdf"), "rb") as f:
        r = client.post("/api/extract", data={"file": (f, "r.pdf")})
    assert r.status_code == 200 and "Haemoglobin" in r.get_json()["text"]


def test_metrics_endpoint(client):
    m = client.get("/api/models/metrics").get_json()
    for model in m["models"]:
        lo, hi = model["test_metrics_ci95"]["roc_auc"]
        assert lo <= model["test_metrics"]["roc_auc"] <= hi
