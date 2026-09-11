# Doctor-AI — System Connections & Architecture

## Overview

This document explains how all components of the Doctor-AI diagnostic platform connect together, from data upload through AI analysis to the final displayed result.

---

## Tech Stack

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | React + Vite | 5173 |
| Node.js API Server | Express.js + MongoDB | 5002 |
| ML Inference Server | Python Flask | 5000 |
| Database | MongoDB Atlas | Cloud |
| AI Synthesis | Groq API (Llama-4 Scout) | External |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React Vite)                        │
│   LabPortal → PatientDashboard → LabReportView → Analysis Components │
└───────────────────┬──────────────────────────────┬───────────────────┘
                    │ HTTP REST                     │ HTTPS
                    ▼                               ▼
┌───────────────────────────┐          ┌────────────────────────────┐
│  Node.js Server :5002     │          │  Groq API (External)       │
│  MongoDB Atlas            │          │  meta-llama/llama-4-scout   │
│  - /api/auth              │          │  -17b-16e-instruct          │
│  - /api/lab-reports       │          │  (clinical report synthesis)│
│  - /api/appointments      │          └────────────────────────────┘
└───────────────────────────┘
                    ▲
                    │ multipart/form-data
                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                   Flask ML Server :5000                            │
│                                                                    │
│  /analyze-ecg     → modelsPred/ecg_model.pkl (MaxViT PyTorch)      │
│  /analyze-kidney  → modelsPred/kidney_final_detection_*.pkl        │
│  /analyze-lung    → modelsPred/lung_cancer_model (1).pkl           │
│  /analyze-brain   → modelsPred/model.pkl (brain tumor classifier)  │
│  /health          → returns JSON status of all loaded models       │
└───────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Per Test Type

### 1. Blood Test (CBC)
```
Patient views report → LabReportView dispatches → BloodTestAnalysis.jsx
  ├── [1] PDF/image → pdfjs canvas render
  ├── [2] Canvas → Tesseract.js OCR → raw text
  ├── [3] PII scrub (regex: email, phone, DOB)
  ├── [4] Black-out top 15% of image (name/header)
  └── [5] OCR text + sanitized image → Groq API → JSON result
```
**No local ML model used — purely OCR + Groq vision**

---

### 2. ECG Report
```
Patient views report → LabReportView dispatches → EcgAnalysis.jsx
  ├── [1] PDF/image → pdfjs canvas render
  ├── [2] Canvas → File object (JPEG)
  ├── [3] POST /analyze-ecg (Flask :5000) → ecg_model.pkl (MaxViT)
  │         Returns: { prediction, confidence, risk_level, reasoning }
  └── [4] Model output → Groq API prompt → full clinical JSON
```
**Model: `ecg_model.pkl` — PyTorch MaxViT vision transformer**  
**Classes: Normal, Myocardial Infarction, History of MI, Abnormal Heartbeat**

---

### 3. Kidney Stone (Ultrasound)
```
Patient views report → LabReportView dispatches → KidneyAnalysis.jsx
  ├── [1] PDF/image → pdfjs canvas render
  ├── [2] Canvas → File object (JPEG)
  ├── [3] POST /analyze-kidney (Flask :5000) → kidney_final_detection_*.pkl
  │         Returns: { prediction, confidence, risk_level, is_abnormal }
  └── [4] Model output → Groq API prompt → full clinical JSON
```
**Model: `kidney_final_detection_and_classification.pkl`**  
**Classes: Normal, Kidney Stone, Cyst, Tumor**

---

### 4. Lung Cancer (CT Scan)
```
Patient views report → LabReportView dispatches → LungCancerAnalysis.jsx
  ├── [1] PDF/image → pdfjs canvas render
  ├── [2] Canvas → File object (JPEG)
  ├── [3] POST /analyze-lung (Flask :5000) → lung_cancer_model (1).pkl
  │         Returns: { prediction, confidence, is_malignant, risk_level }
  └── [4] Model output → Groq API prompt → full oncology clinical JSON
```
**Model: `lung_cancer_model (1).pkl`**  
**Classes: Benign, Malignant, Normal**

---

### 5. Brain Tumor (MRI)
```
Patient views report → LabReportView dispatches → BrainTumorAnalysis.jsx
  ├── [1] PDF/image → pdfjs canvas render
  ├── [2] Canvas → File object (JPEG)
  ├── [3] POST /analyze-brain (Flask :5000) → model.pkl
  │         Returns: { prediction, confidence, has_tumor, risk_level }
  └── [4] Model output → Groq API prompt → full neurosurgical clinical JSON
```
**Model: `model.pkl` (brain tumor classifier)**  
**Classes: Glioma Tumor, Meningioma Tumor, No Tumor, Pituitary Tumor**

---

## File Map

### Frontend Pages (`src/pages/`)

| File | Role |
|------|------|
| `LabPortal.jsx` | Lab technician uploads reports — has all 5 test types in dropdown |
| `PatientDashboard.jsx` | Patient sees uploaded reports, clicks to view |
| `LabReportView.jsx` | Fetches report by ID, renders report preview + dispatches to correct analysis component |
| `ReportAnalysisPatient.jsx` | Alternative analysis view for self-uploads (uses same Groq pipeline) |
| `CancerAnalysisPatient.jsx` | Dedicated oncology page for patient self-upload cancer analysis |

### Analysis Sub-components (`src/pages/analysis/`)

| File | Test Type | ML Model Used |
|------|-----------|---------------|
| `BloodTestAnalysis.jsx` | Blood Test (CBC) | None — OCR + Groq vision |
| `EcgAnalysis.jsx` | ECG Report | `ecg_model.pkl` via Flask |
| `KidneyAnalysis.jsx` | Kidney Stone (Ultrasound) | `kidney_final_detection_and_classification.pkl` |
| `LungCancerAnalysis.jsx` | Lung Cancer (CT Scan) | `lung_cancer_model (1).pkl` |
| `BrainTumorAnalysis.jsx` | Brain Tumor (MRI) | `model.pkl` |

### Backend (`server/`)

| File | Role |
|------|------|
| `index.js` | Express server — auth, MongoDB, lab-report CRUD |
| `models/User.js` | MongoDB user schema |

### Python ML Server (`app.py`)

| Route | Model | Returns |
|-------|-------|---------|
| `GET /health` | All | Model load status |
| `POST /analyze-ecg` | `ecg_model.pkl` | prediction, confidence, risk_level, reasoning |
| `POST /analyze-kidney` | `kidney_final_detection_and_classification.pkl` | prediction, confidence, is_abnormal |
| `POST /analyze-lung` | `lung_cancer_model (1).pkl` | prediction, confidence, is_malignant |
| `POST /analyze-brain` | `model.pkl` | prediction, confidence, has_tumor |

### ML Models (`modelsPred/`)

| File | Type | Purpose |
|------|------|---------|
| `ecg_model.pkl` | PyTorch state_dict (MaxViT) | ECG rhythm classification |
| `kidney_final_detection_and_classification.pkl` | sklearn or PyTorch | Kidney stone/cyst/tumor detection |
| `lung_cancer_model (1).pkl` | sklearn or PyTorch | Lung CT malignancy detection |
| `model.pkl` | sklearn or PyTorch | Brain MRI tumor classification |

---

## Environment Variables Required

```env
# Frontend (.env or .env.local at root)
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Node.js server (server/.env)
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
PORT=5002
```

---

## How to Run All Services

```bash
# 1. Start React frontend
npm run dev                    # → http://localhost:5173

# 2. Start Node.js API
cd server && node index.js     # → http://localhost:5002

# 3. Start Flask ML server
python app.py                  # → http://localhost:5000

# 4. Verify Flask models loaded
curl http://localhost:5000/health
```

---

## Two-Stage AI Pipeline (for model-backed tests)

Every model-powered analysis follows this exact two-stage flow:

**Stage 1: Local ML Inference (Flask)**
```
Image → resize(224,224) → normalize → model.forward() → softmax → {class, confidence}
```

**Stage 2: Clinical Narrative Synthesis (Groq)**
```
Stage 1 JSON → medical prompt → Groq Llama-4 Scout → full clinical JSON
{
  summary, health_score, parameters[], risk_assessment{},
  threats[], diet[], medications[], routine[],
  overall_verdict, [organ-specific fields]
}
```

This ensures:
- **Accuracy**: A validated local model handles classification
- **Richness**: Groq adds the clinical interpretation, diet, medications, and routine that a bare classification cannot provide
- **Privacy**: No raw patient image is sent to Groq for model-backed tests (only the model's text output is)

---

## Groq Prompt Design

Each analysis component sends a specialized system prompt to Groq that:
1. Identifies the specialist role (cardiologist, nephrologist, pulmonologist, etc.)
2. Provides the ML model's JSON output as context
3. Requests a structured clinical JSON with consistent fields
4. Uses `response_format: { type: 'json_object' }` to guarantee parseable output
5. Sets `temperature: 0.1` for deterministic clinical reasoning

---

*Last updated: Doctor-AI v1.0 — Multi-Model Diagnostic Pipeline*
