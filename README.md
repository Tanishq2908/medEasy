# MedEasy: Lab Report Analysis

Upload a blood-test report (PDF, photo or text) and MedEasy will:

- **Read every value.** It recognises 45+ common tests and converts units (mmol/L, µmol/L, lakh/cumm, ng/dL, µg/dL…).
- **Interpret each result** against the report's own reference interval, or a sex-specific standard range, and flag critical values.
- **Visualise the report.** You get a health score, a per-panel overview, and a range bar for every test.
- **Screen for four conditions** (type 2 diabetes, liver disease, chronic kidney disease, hypothyroidism). Each estimate is a calibrated probability with a 95% uncertainty interval, a confidence score and a per-value explanation.
- **Recommend precautions and next steps:** lifestyle steps, follow-up tests, which specialist to see, and how urgently.
- **Track trends** across saved reports (with an account).
- **Use an LLM when one is configured (optional).** With a Groq API key it adds a plain-language summary, reads photographed reports, and answers questions about your report.

> Educational decision-support tool, not a medical device. Always confirm results with a doctor.

## Model performance

Each model was selected by 5-fold CV on a 75% training split, calibrated (Platt), thresholded by Youden's J on
out-of-fold training predictions, and then evaluated **once** on the untouched 25% test split. Brackets show 95% bootstrap
confidence intervals from 1,000 resamples. The live page `/models` shows ROC, PR and calibration curves, confusion
matrices, model comparison and permutation feature importance.

| Model | Algorithm | n (total / test) | ROC-AUC | PR-AUC | Sensitivity | Specificity | F1 | Brier |
|---|---|---|---|---|---|---|---|---|
| Type 2 Diabetes | Logistic Regression | 768 / 192 | 0.806 [0.744–0.863] | 0.651 [0.541–0.771] | 0.791 [0.686–0.880] | 0.680 [0.602–0.760] | 0.662 [0.571–0.738] | 0.173 |
| Liver Disease | Logistic Regression | 583 / 146 | 0.790 [0.718–0.858] | 0.918 [0.877–0.952] | 0.596 [0.505–0.688] | 0.881 [0.780–0.973] | 0.725 [0.645–0.792] | 0.167 |
| Chronic Kidney Disease | Random Forest | 400 / 100 | 1.000 [1.000–1.000] | 1.000 [1.000–1.000] | 1.000 [1.000–1.000] | 0.974 [0.921–1.000] | 0.992 [0.975–1.000] | 0.008 |
| Hypothyroidism | Random Forest | 3772 / 943 | 0.995 [0.990–0.998] | 0.909 [0.832–0.969] | 1.000 [1.000–1.000] | 0.982 [0.972–0.990] | 0.901 [0.847–0.946] | 0.013 |

The datasets are public benchmarks (see `backend/ml/data/README.md`). The CKD and thyroid benchmarks are easy: their labels
largely follow from the same lab values. These numbers describe benchmark performance, not clinical validation.

**Per-patient confidence.** Each risk shows a calibrated probability and a 95% interval from a 20-model bootstrap ensemble.
The interval is measured as spread on the logit scale and centred on the calibrated estimate. The confidence score is
`sqrt(input coverage) × (1 − interval width)`, so it drops when inputs are missing or the models disagree.

## Architecture

```
React (Vite, Tailwind, Recharts)  ──/api──▶  Flask
                                             ├─ analysis.py   text → values → interpretation, score, precautions
                                             ├─ lab_catalog.py 45+ analytes: aliases, units, ranges, guidance
                                             ├─ risk.py       calibrated scikit-learn models + bootstrap ensemble
                                             ├─ llm.py        optional Groq narrative / vision / Q&A
                                             └─ SQLite        accounts (JWT) and saved reports
```

In production Flask also serves the built frontend, so the whole app is one process.
PDF text is extracted on the server (pdfplumber). Scanned PDFs and photos are read by the Groq vision model when a key
is set; otherwise they are OCR'd in the browser with Tesseract.js.

## Run locally

Requires Python 3.11+ and Node 20+.

```bash
pip install -r requirements.txt
```

```bash
npm install
```

```bash
cp .env.example .env    # optional: add GROQ_API_KEY and JWT_SECRET
```

Start the API (port 5000) and the dev server (port 5173, proxies `/api`) in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev
```

Or build once and let Flask serve everything on http://localhost:5000:

```bash
npm run build && npm run dev:api
```

Use **Try a sample report** on the Analyze page, or upload `samples/sample_lab_report.pdf`.

## Tests and retraining

```bash
pip install -r requirements-dev.txt && npm run test:api
```

```bash
npm run lint
```

Retrain all models and regenerate `backend/models/metrics.json` (about 3 minutes on a laptop CPU):

```bash
npm run train
```

## Deploy (Render)

`render.yaml` defines a single web service that installs Python dependencies, builds the frontend and runs gunicorn.
Set `GROQ_API_KEY` in the Render dashboard if you want the AI features. Free instances have no persistent disk, so attach
one and point `DATABASE_PATH` at it to keep accounts and reports across deploys.

### Frontend on Vercel

`vercel.json` builds the React app and forwards `/api/*` to the Render service, so the browser only ever talks to the
Vercel domain (no CORS setup needed). If your Render service URL is not `https://medeasy.onrender.com`, change the
`destination` in `vercel.json`. React Router deep links (e.g. `/reports/3`) are rewritten to `index.html`.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Status, model readiness, whether the LLM is enabled |
| GET | `/api/analytes` | Recognised tests with units and default ranges |
| GET | `/api/models/metrics` | Full evaluation report for all models |
| POST | `/api/extract` | `multipart file` → `{text, method, patient}` |
| POST | `/api/analyze` | `{text?, values?, patient?, title?, report_date?}` → full analysis (saved when signed in) |
| POST | `/api/chat` | `{question, analysis, history}` → answer (needs `GROQ_API_KEY`) |
| POST | `/api/auth/register`, `/api/auth/login` | → `{token, user}` |
| GET | `/api/reports`, `/api/reports/:id`, `/api/trends` | History (Bearer token) |
| DELETE | `/api/reports/:id` | Delete a saved report |
