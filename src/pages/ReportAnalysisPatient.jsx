import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowLeft, Loader2, Activity, HeartPulse, Microscope, Save, CheckCircle, Pill, Apple, Dumbbell, Clock, AlertTriangle, Shield, TrendingUp, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import * as pdfjs from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { API_BASE_URL, FLASK_BASE_URL } from '../apiConfig';

// Map ReportAnalysisPatient mode → Flask endpoint
const FLASK_ENDPOINT = {
  ecg: '/analyze-ecg-signal',
  ct:  '/analyze-lung',
  mri: '/analyze-brain',
  kidney: '/analyze-kidney',
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

// --- PRIVACY REINFORCEMENT ENGINE ---
const scrubPII = (text, patientName) => {
  if (!text) return "";
  let scrubbed = text;
  if (patientName) {
    const names = patientName.split(' ');
    names.forEach(name => {
      if (name.length > 2) {
        const re = new RegExp(name, 'gi');
        scrubbed = scrubbed.replace(re, '[ANONYMIZED_SUBJECT]');
      }
    });
  }
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  scrubbed = scrubbed.replace(/(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[REDACTED_PHONE]');
  scrubbed = scrubbed.replace(/DOB[:\s]*\d{1,2}[\/\-\s]\d{1,2}[\/\-\s]\d{2,4}/gi, 'DOB: [REDACTED_DATE]');
  return scrubbed;
};

const redactImageHeader = (canvas) => {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.15); 
  return canvas.toDataURL('image/jpeg', 0.8);
};

// --- LOCAL DIAGNOSTIC RULES (Edge Logic) ---
const checkLocalRanges = (text) => {
  const findings = [];
  const patterns = [
    { name: 'Haemoglobin', regex: /Haemoglobin.*?(\d+\.?\d*)/i, min: 13.5, max: 17.5, unit: 'g/dL' },
    { name: 'WBC Count', regex: /WBC.*?(\d+\.?\d*)/i, min: 4000, max: 11000, unit: 'cells/mcL' },
    { name: 'Platelets', regex: /Platelets.*?(\d+\.?\d*)/i, min: 150000, max: 450000, unit: 'cells/mcL' },
    { name: 'Glucose', regex: /Glucose.*?(\d+\.?\d*)/i, min: 70, max: 100, unit: 'mg/dL' }
  ];

  patterns.forEach(p => {
    const match = text.match(p.regex);
    if (match) {
      const val = parseFloat(match[1]);
      if (val < p.min || val > p.max) {
        findings.push({ parameter: p.name, value: val, status: 'Abnormal', range: `${p.min}-${p.max} ${p.unit}` });
      }
    }
  });
  return findings;
};

export default function ReportAnalysisPatient() {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);

  const [mode, setMode] = useState(searchParams.get('mode') || 'report');
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [privacyStep, setPrivacyStep] = useState('');
  const [localFindings, setLocalFindings] = useState([]);

  useEffect(() => {
    if (result && !saved && !saving) handleSave();
  }, [result]);

  useEffect(() => {
    const m = searchParams.get('mode') || 'report';
    if (m !== mode) { setMode(m); setResult(null); setSaved(false); }
  }, [location.search]);

  const handleFile = (e) => { 
    const f = e.target.files[0]; 
    if (f) { setFile(f); setError(null); setSaved(false); setLocalFindings([]); } 
  };

  const handleSave = async () => {
    if (!token || !result || saved) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/patient-diagnosis/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: JSON.stringify({
          type: mode,
          title: `Diagnostic Node - ${mode.toUpperCase()}`,
          summary: result.summary,
          parameters: result.parameters || [],
          riskAssessment: result.risk_assessment || {},
          medications: result.medications || [],
          diet: result.diet || [],
          exercise: result.exercise || [],
          overallScore: result.health_score || 75
        })
      });
      if (res.ok) setSaved(true);
    } catch (err) { console.error("Save failure:", err); }
    finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!file) { setError('Diagnostic source missing.'); return; }
    setAnalyzing(true); setError(null);
    setPrivacyStep('Initializing Neural Privacy Tunnel...');

    try {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');

      // 1. RENDER FILE TO CANVAS (white background to prevent JPEG black artifacts)
      if (file.type === 'application/pdf') {
        setPrivacyStep('Decrypting PDF Layers...');
        const ab  = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
        const pg  = await pdf.getPage(1);
        const vp  = pg.getViewport({ scale: 2 });
        canvas.height = vp.height; canvas.width = vp.width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      } else {
        setPrivacyStep('Analyzing Diagnostic Matrix...');
        const img = await new Promise(r => {
          const fr = new FileReader();
          fr.onloadend = () => { const i = new Image(); i.onload = () => r(i); i.src = fr.result; };
          fr.readAsDataURL(file);
        });
        canvas.width = img.width; canvas.height = img.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }

      // 2. SPECIALIST MODE — route through Flask neural model first
      if (FLASK_ENDPOINT[mode]) {
        setPrivacyStep(`Running ${mode.toUpperCase()} neural model...`);
        const targetHW = mode === 'kidney' ? [512, 512] : mode === 'mri' ? [299, 299] : [224, 224];
        
        const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
        const blob     = await fetch(imageUrl).then(r => r.blob());
        const fileObj  = new File([blob], file.name || `${mode}.jpg`, { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('image', fileObj);

        let flaskData;
        try {
          const flaskRes = await fetch(`${FLASK_BASE_URL}${FLASK_ENDPOINT[mode]}`, { method: 'POST', body: formData });
          if (!flaskRes.ok) throw new Error(`Model error: ${flaskRes.status}`);
          flaskData = await flaskRes.json();
          if (flaskData.error) throw new Error(flaskData.error);
        } catch (primaryErr) {
          // ECG fallback: try signal processing pipeline from notebook model
          if (mode === 'ecg') {
            console.warn('ECG MaxViT failed, trying signal processing:', primaryErr.message);
            setPrivacyStep('Engaging Signal Processing Engine (Fallback)...');
            const fbForm = new FormData();
            fbForm.append('image', fileObj);
            const fbRes = await fetch(`${FLASK_BASE_URL}/analyze-ecg-signal`, { method: 'POST', body: fbForm });
            if (!fbRes.ok) throw new Error(`Both ECG engines failed. Primary: ${primaryErr.message}`);
            flaskData = await fbRes.json();
            if (flaskData.error) throw new Error(flaskData.error);
          } else {
            throw primaryErr;
          }
        }

        const prompts = {
          ecg: `You are an expert cardiologist. A specialized ECG signal model analyzed this heartbeat:
${JSON.stringify(flaskData, null, 2)}
The model classification "${flaskData.prediction}" is GROUND TRUTH. Build a comprehensive clinical report CONSISTENT with this classification.
CRITICAL RULE: If confidence is < 0.6 (${(flaskData.confidence * 100).toFixed(1)}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary.
Output strict JSON only:
{
  "summary": "3-to-4 sentence exhaustive clinical interpretation for ECG detailing physiological implications and immediate next steps.",
  "health_score": 90,
  "parameters": [{"name":"Heart Rhythm","value":"string","status":"Normal|Abnormal|Critical"}],
  "risk_assessment": {"cardiovascular_risk":{"level":"Low|Moderate|High"}},
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "emergency_medication": [{"name":"string", "dosage":"string", "reason":"string"}],
  "diet": [{"recommendation":"string","category":"string"}],
  "special_foods": [{"name":"string", "benefit":"string"}],
  "vital_trends": [{"name":"Systolic", "value": 120}, {"name":"Diastolic", "value": 80}, {"name":"BPM", "value": 75}],
  "recovery_timeline": [{"month": "M1", "score": 60}, {"month": "M2", "score": 70}, {"month": "M3", "score": 85}, {"month": "M6", "score": 95}],
  "routine": [{"time":"string","activity":"string"}]
}`,
          mri: `You are an expert neurosurgeon. A specialized Brain MRI model returned:
${JSON.stringify(flaskData, null, 2)}
The model classification "${flaskData.prediction}" is GROUND TRUTH. 
CRITICAL RULE: If confidence is < 0.6 (${(flaskData.confidence * 100).toFixed(1)}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary.
Output strict JSON only:
{
  "summary": "3-to-4 sentence exhaustive neurological interpretation for Brain MRI detailing anatomical findings and implications.",
  "health_score": 90,
  "parameters": [{"name":"Brain Tissue","value":"string","status":"Normal|Abnormal|Critical"}],
  "risk_assessment": {"neurological_risk":{"level":"Low|Moderate|High"}},
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "emergency_medication": [{"name":"string", "dosage":"string", "reason":"string"}],
  "diet": [{"recommendation":"string","category":"string"}],
  "special_foods": [{"name":"string", "benefit":"string"}],
  "vital_trends": [{"name":"ICP", "value": 12}, {"name":"CBF", "value": 50}, {"name":"O2", "value": 98}],
  "recovery_timeline": [{"month": "M1", "score": 60}, {"month": "M2", "score": 70}, {"month": "M3", "score": 85}, {"month": "M6", "score": 95}],
  "routine": [{"time":"string","activity":"string"}]
}`,
          ct: `You are an expert pulmonologist/oncologist. A specialized Lung CT model returned:
${JSON.stringify(flaskData, null, 2)}
The model classification "${flaskData.prediction}" is GROUND TRUTH.
CRITICAL RULE: If confidence is < 0.6 (${(flaskData.confidence * 100).toFixed(1)}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary.
Output strict JSON only:
{
  "summary": "3-to-4 sentence exhaustive pulmonary interpretation for Lung CT, outlining parenchymal anomalies and oncological evaluation.",
  "health_score": 90,
  "parameters": [{"name":"Lung Parenchyma","value":"string","status":"Normal|Abnormal|Critical"}],
  "risk_assessment": {"pulmonary_risk":{"level":"Low|Moderate|High"}},
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "emergency_medication": [{"name":"string", "dosage":"string", "reason":"string"}],
  "diet": [{"recommendation":"string","category":"string"}],
  "special_foods": [{"name":"string", "benefit":"string"}],
  "vital_trends": [{"name":"SpO2", "value": 95}, {"name":"Resp Rate", "value": 16}, {"name":"FEV1", "value": 80}],
  "recovery_timeline": [{"month": "M1", "score": 60}, {"month": "M2", "score": 70}, {"month": "M3", "score": 85}, {"month": "M6", "score": 95}],
  "routine": [{"time":"string","activity":"string"}]
}`,
          kidney: `You are an expert nephrologist. A specialized Kidney Ultrasound model returned:
${JSON.stringify(flaskData, null, 2)}
The model classification "${flaskData.prediction}" is GROUND TRUTH.
CRITICAL RULE: If confidence is < 0.6 (${(flaskData.confidence * 100).toFixed(1)}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary.
Output strict JSON only:
{
  "summary": "3-to-4 sentence exhaustive renal interpretation for Kidney Ultrasound detailing cortical abnormalities or obstructions.",
  "health_score": 90,
  "parameters": [{"name":"Renal Cortex","value":"string","status":"Normal|Abnormal|Critical"}],
  "risk_assessment": {"renal_risk":{"level":"Low|Moderate|High"}},
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "emergency_medication": [{"name":"string", "dosage":"string", "reason":"string"}],
  "diet": [{"recommendation":"string","category":"string"}],
  "special_foods": [{"name":"string", "benefit":"string"}],
  "vital_trends": [{"name":"GFR", "value": 90}, {"name":"Creatinine", "value": 0.9}, {"name":"BUN", "value": 15}],
  "recovery_timeline": [{"month": "M1", "score": 60}, {"month": "M2", "score": 70}, {"month": "M3", "score": 85}, {"month": "M6", "score": 95}],
  "routine": [{"time":"string","activity":"string"}]
}`
        };

        const specialistPrompt = prompts[mode] || `You are an expert diagnostic AI. A neural model analyzed this ${mode} scan and returned:
${JSON.stringify(flaskData, null, 2)}
The model classification "${flaskData.prediction}" is GROUND TRUTH. 
CRITICAL RULE: If confidence is < 0.6 (${(flaskData.confidence * 100).toFixed(1)}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary.
Output strict JSON only: { "summary": "...", "health_score": 50, "parameters": [], "risk_assessment": {}, "threats": [], "diet": [], "routine": [] }`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: specialistPrompt }]
          })
        });
        const groqData = await groqRes.json();
        if (groqData.error) throw new Error(groqData.error.message);
        const parsed = JSON.parse(groqData.choices[0].message.content);
        setResult({ ...parsed, _model: flaskData });
        return;
      }

      // 4. GENERAL REPORT MODE (blood test, lab report) — Groq vision
      setPrivacyStep('Running Local OCR & PII Scrubber...');
      const ocrResult   = await Tesseract.recognize(canvas, 'eng');
      const extractedText = scrubPII(ocrResult.data.text, user?.name);
      setLocalFindings(checkLocalRanges(extractedText));

      setPrivacyStep('Masking Patient Identifiers...');
      const finalImgForAI = redactImageHeader(canvas);

      setPrivacyStep('AI Diagnostic Synthesis...');
      const prompt = `System: Expert Medical Diagnostic Engine. Target: [ANONYMIZED SUBJECT].
TASK: Analyze the provided lab report.
OUTPUT STRICT JSON:
- summary (string)
- health_score (number 0-100)
- parameters (array: {name, value, status['Normal'|'Abnormal']})
- risk_assessment ({cardiovascular:{level},metabolic:{level},organ_health:{level}})
- threats (array: {level, condition, description})
- diet (array: {recommendation, category})
- routine (array: {time, activity})
No PII allowed.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0.1,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: finalImgForAI } }] }],
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'Neural AI Error');
      if (!data.choices?.[0]) throw new Error('Inference failed.');
      const parsedResult = JSON.parse(data.choices[0].message.content);
      if (parsedResult.error === 'wrong_report') setError(parsedResult.message);
      else setResult(parsedResult);

    } catch (err) { setError('Neural Engine Error: ' + err.message); }
    finally { setAnalyzing(false); setPrivacyStep(''); }
  };

  const Icon = mode === 'ecg' ? HeartPulse : mode === 'mri' ? Microscope : mode === 'ct' ? Activity : FileText;

  // Chart data
  const riskData = result?.risk_assessment ? [
    { name: 'Cardio', value: result.risk_assessment.cardiovascular?.level === 'High' ? 90 : result.risk_assessment.cardiovascular?.level === 'Moderate' ? 60 : 30 },
    { name: 'Metabolic', value: result.risk_assessment.metabolic?.level === 'High' ? 90 : result.risk_assessment.metabolic?.level === 'Moderate' ? 60 : 30 },
    { name: 'Organ', value: result.risk_assessment.organ_health?.level === 'High' ? 90 : result.risk_assessment.organ_health?.level === 'Moderate' ? 60 : 30 },
  ] : [];

  const PIE_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 min-h-screen">
      <div className="fixed inset-0 bg-[var(--bg-main)] -z-20 transition-colors duration-500" />
      <div className="fixed inset-0 bg-mesh opacity-30 -z-10 pointer-events-none" />
      
      {/* Header */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center justify-between mb-12 gap-6 flex-wrap relative z-20">
        <Button variant="outline" className="flex items-center gap-3 h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-white/10 glass-panel group" onClick={() => navigate('/patient-dashboard')}>
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Diagnostic Hub
        </Button>
        <div className="flex p-1.5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-[var(--glass-border)] gap-1.5">
          {['report', 'ecg', 'ct', 'mri', 'kidney'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setResult(null); setSaved(false); }}
              className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all", mode === m ? "bg-cyan-500 text-white shadow-lg" : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5")}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
            <Lock className="w-6 h-6 text-cyan-500" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="upload" variants={fadeInUp} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0.95 }} className="space-y-10">
            <div className="glass-panel p-1 bg-gradient-to-br from-white/10 to-transparent rounded-[56px]">
              <div className="glass-panel p-20 rounded-[54px] border-none flex flex-col items-center text-center gap-10 hover:bg-white/[0.04] transition-all group relative overflow-hidden backdrop-blur-3xl shrink-0">
                <div className="absolute inset-0 bg-dashboard-grid opacity-10 pointer-events-none" />
                <div className="scanning-line" />
                
                <div className="w-32 h-32 rounded-[40px] bg-[var(--bg-main)] border-2 border-cyan-500/30 flex items-center justify-center text-cyan-500 shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-700">
                  <Icon className="w-12 h-12" />
                </div>

                <div className="max-w-2xl relative z-10">
                  <h2 className="text-5xl font-black tracking-tighter mb-4 text-gradient bg-gradient-to-r from-white to-white/40 uppercase">Initial {mode.toUpperCase()} Sequence</h2>
                  <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] opacity-40 leading-relaxed mx-auto max-w-md">Synchronize clinical media for recursive privacy-first analysis.</p>
                </div>

                <div className="w-full max-w-2xl flex flex-col gap-6 relative z-10">
                  <label className="relative block cursor-pointer group/label">
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0" accept="image/*,application/pdf" onChange={handleFile} />
                    <div className="glass-panel p-6 rounded-[28px] border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-center">
                       <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)] group-hover/label:text-cyan-400">
                        {file ? `// SYNCED: ${file.name}` : "Mount Diagnostic Sensor"}
                      </span>
                    </div>
                  </label>

                  <Button size="lg" className="h-24 rounded-[30px] font-black uppercase tracking-[0.4em] text-xs button-premium bg-cyan-600 shadow-[0_0_50px_-10px_rgba(6,182,212,0.4)] border-none relative overflow-hidden group/btn" 
                    disabled={!file || analyzing} onClick={analyze}>
                    <span className="relative z-10 flex flex-col items-center gap-2">
                       {analyzing ? (
                         <>
                           <div className="flex items-center gap-4">
                             <Loader2 className="w-5 h-5 animate-spin" />
                             <span>Neural Tunnel Engaged</span>
                           </div>
                           <span className="text-[8px] opacity-60 tracking-[0.2em]">{privacyStep}</span>
                         </>
                       ) : (
                         <span className="flex items-center gap-4">Run Diagnostic Array <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" /></span>
                       )}
                    </span>
                  </Button>
                  {error && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest relative z-10 w-full max-w-xl mx-auto shadow-2xl">
                      <AlertTriangle className="w-4 h-4 inline-block mr-3" /> {error}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
            {localFindings.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-8 rounded-[40px] border-rose-500/30 bg-rose-500/5">
                <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4" /> Local Diagnostic Exception Detected (Privacy Layer Analysis)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {localFindings.map((f, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                      <div>
                        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">{f.parameter}</p>
                        <p className="text-sm font-black text-white">{f.value}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full uppercase">{f.status}</span>
                        <p className="text-[9px] text-white/20 mt-1">Range: {f.range}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-32">
            
            {/* HERO TILE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 p-12 rounded-[48px] border border-cyan-500/30 relative overflow-hidden glass-panel">
                <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                  <div className="w-32 h-32 rounded-[32px] bg-cyan-500/10 border-2 border-cyan-500/40 text-cyan-500 flex items-center justify-center shadow-2xl">
                    <ShieldCheck className="w-16 h-16" />
                  </div>
                  <div className="flex-grow">
                     <span className="px-5 py-2 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-lg mb-4 inline-block">
                        Status Spectral Analysis: Complete
                     </span>
                     <h2 className="text-3xl font-black tracking-tighter text-white uppercase leading-tight mb-4">{result.summary}</h2>
                     <div className="flex items-center gap-6 opacity-60">
                        <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                           <Activity className="w-3 h-3" /> Predictive Score: {result.health_score}/100
                        </div>
                     </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 p-12 glass-panel rounded-[48px] border-white/10 flex flex-col justify-center gap-4">
                 <Button onClick={() => { setSaved(false); handleSave(); }} disabled={saving} className="w-full h-16 rounded-[24px] bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px]">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? 'ARCHIVE SECURED' : 'COMMIT TO ARCHIVE'}
                 </Button>
                 <Button onClick={() => { setResult(null); setSaved(false); setLocalFindings([]); }} variant="outline" className="w-full h-16 rounded-[24px] border-white/10 font-black uppercase tracking-[0.2em] text-[10px]">
                    RELOAD SENSOR
                 </Button>
              </div>
            </div>

            {/* MATRIX GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="glass-panel p-10 rounded-[40px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                    <TrendingUp className="w-4 h-4 inline-block mr-3" /> Metabolic Markers
                  </h3>
                  <div className="space-y-4">
                     {result.parameters?.slice(0, 5).map((p, i) => (
                       <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                          <div className="flex justify-between mb-1">
                             <span className="text-[10px] font-black text-white uppercase">{p.name}</span>
                             <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full uppercase", p.status === 'Normal' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>{p.status}</span>
                          </div>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Val: {p.value}</p>
                       </div>
                     ))}
                  </div>
               </div>

               <div className="glass-panel p-10 rounded-[40px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-violet-500">
                    <Shield className="w-4 h-4 inline-block mr-3" /> Risk Coefficient
                  </h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer>
                      <RadarChart data={riskData}>
                        <PolarGrid stroke="rgba(255,255,255,0.05)" />
                        <PolarAngleAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900 }} />
                        <Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {result.vital_trends && result.vital_trends.length > 0 && (
               <div className="glass-panel p-10 rounded-[40px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-blue-500">
                    <Activity className="w-4 h-4 inline-block mr-3" /> Vital Sign Projections
                  </h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer>
                      <BarChart data={result.vital_trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               )}

               <div className="glass-panel p-10 rounded-[40px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-rose-500">
                    <AlertTriangle className="w-4 h-4 inline-block mr-3" /> Pathological Alerts & Crisis Protocols
                  </h3>
                  <div className="space-y-4 mb-6">
                     {result.threats?.map((t, i) => (
                       <div key={i} className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                          <p className="text-[10px] font-black text-rose-500 uppercase mb-1">{t.level} // {t.condition}</p>
                          <p className="text-[9px] text-white/40 italic leading-tight">{t.description}</p>
                       </div>
                     ))}
                  </div>
                  
                  {result.emergency_medication && result.emergency_medication.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-rose-500/10">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 text-orange-400">Emergency Pharmaceuticals</h4>
                      <div className="space-y-3">
                         {result.emergency_medication.map((med, i) => (
                           <div key={i} className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex gap-3 items-center">
                              <Pill className="w-4 h-4 text-orange-500 shrink-0" />
                              <div>
                                <p className="text-[10px] font-black text-orange-400 uppercase">{med.name} <span className="opacity-60 font-normal">({med.dosage})</span></p>
                                <p className="text-[8px] text-white/40 mt-0.5 max-w-[200px] leading-tight">{med.reason}</p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}
               </div>
            </div>

            {/* RECOVERY PLAN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="glass-panel p-10 rounded-[48px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-emerald-500">
                    <Apple className="w-4 h-4 inline-block mr-3" /> Nutritional Optimization
                  </h3>
                   <div className="space-y-3">
                     {result.diet?.map((d, i) => (
                       <div key={i} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                          <p className="text-[10px] font-black text-white uppercase tracking-tighter mb-1">{d.recommendation}</p>
                          <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest leading-tight">{d.category}</p>
                       </div>
                     ))}
                   </div>
                   
                   {result.special_foods && result.special_foods.length > 0 && (
                     <div className="mt-6 pt-6 border-t border-emerald-500/10">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 text-emerald-400">Curated Special Foods</h4>
                        <div className="flex flex-wrap gap-2">
                           {result.special_foods.map((food, i) => (
                             <div key={i} className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-300 flex items-center gap-2 group relative">
                                {food.name}
                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 w-48 bg-black border border-emerald-500/40 p-2 rounded-xl text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">{food.benefit}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                   )}
               </div>

               {result.recovery_timeline && result.recovery_timeline.length > 0 && (
               <div className="glass-panel p-10 rounded-[48px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                    <Activity className="w-4 h-4 inline-block mr-3" /> Recovery Projection
                  </h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer>
                      <LineChart data={result.recovery_timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ stroke: 'rgba(6,182,212,0.5)', strokeWidth: 2 }} contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '12px' }} />
                        <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={4} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               )}

               <div className="glass-panel p-10 rounded-[48px] border-white/10 text-center">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-violet-500">
                    <Dumbbell className="w-4 h-4 inline-block mr-3" /> Routine Protocol
                  </h3>
                  <div className="flex flex-col gap-4">
                    {result.routine?.map((r, i) => (
                      <div key={i} className="w-full rounded-[24px] border border-dashed border-violet-500/20 bg-violet-500/5 flex items-center p-4 text-left">
                        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mr-4 shrink-0 text-[8px] font-black text-violet-500 uppercase">{r.time}</div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase leading-tight">{r.activity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
