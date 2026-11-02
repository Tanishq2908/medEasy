"""
Optional Groq LLM layer. Everything works without it; when GROQ_API_KEY is set it adds:
  * a plain-language narrative of the structured findings,
  * transcription of photographed / scanned reports (vision model),
  * answers to follow-up questions about a report.

The key lives only on the server. It is never sent to the browser.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any, Optional

import requests

log = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
TEXT_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

SYSTEM = ("You are a careful clinical lab-report assistant. You explain results in plain language for patients, "
          "never invent values that are not given, never diagnose definitively, and always recommend confirming "
          "with a doctor.")


def enabled() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def _chat(messages: list[dict], model: str, json_mode: bool = False, max_tokens: int = 1200) -> str:
    body: dict[str, Any] = {"model": model, "messages": messages, "temperature": 0.2, "max_tokens": max_tokens}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    r = requests.post(GROQ_URL, json=body, timeout=60,
                      headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"})
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _compact(analysis: dict[str, Any]) -> dict[str, Any]:
    return {
        "patient": analysis.get("patient"),
        "health_score": analysis.get("health_score"),
        "results": [{k: r[k] for k in ("name", "value", "unit", "ref_low", "ref_high", "status", "critical")}
                    for r in analysis.get("results", [])],
        "risk_models": [{"name": r["name"], "probability": r.get("probability"), "level": r.get("level")}
                        for r in analysis.get("risks", []) if r.get("available")],
    }


def narrative(analysis: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not enabled():
        return None
    prompt = (
        "Here are structured lab results with reference ranges and machine-learning risk estimates:\n"
        f"{json.dumps(_compact(analysis))}\n\n"
        "Return JSON with keys: "
        '"summary" (3-5 sentence plain-language overview), '
        '"key_insights" (array of up to 5 short strings linking related abnormal values), '
        '"lifestyle" (array of up to 6 specific, practical precautions), '
        '"questions_for_doctor" (array of up to 4 questions the patient should ask).'
    )
    try:
        out = json.loads(_chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
                               TEXT_MODEL, json_mode=True))
        return {k: out.get(k) for k in ("summary", "key_insights", "lifestyle", "questions_for_doctor")}
    except Exception as e:  # noqa: BLE001
        log.warning("Groq narrative failed: %s", e)
        return None


def transcribe_image(data: bytes, mime: str) -> Optional[str]:
    if not enabled():
        return None
    b64 = base64.b64encode(data).decode()
    msg = [{"role": "user", "content": [
        {"type": "text", "text": "Transcribe every test name, result value, unit and reference range from this lab "
                                 "report. Output one test per line as: <test name> <value> <unit> <range>. Include "
                                 "patient age and sex on the first line if visible. Output nothing else."},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
    ]}]
    try:
        return _chat(msg, VISION_MODEL, max_tokens=2000)
    except Exception as e:  # noqa: BLE001
        log.warning("Groq vision transcription failed: %s", e)
        return None


def answer(question: str, analysis: dict[str, Any], history: list[dict[str, str]]) -> Optional[str]:
    if not enabled():
        return None
    msgs = [{"role": "system", "content": SYSTEM + " Answer only about the report below in under 150 words.\n"
                                                    f"REPORT: {json.dumps(_compact(analysis))}"}]
    msgs += [{"role": h["role"], "content": h["content"][:2000]} for h in history[-6:] if h.get("role") in ("user", "assistant")]
    msgs.append({"role": "user", "content": question[:2000]})
    try:
        return _chat(msgs, TEXT_MODEL, max_tokens=500)
    except Exception as e:  # noqa: BLE001
        log.warning("Groq answer failed: %s", e)
        return None
