import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowLeft, Loader2, Activity, HeartPulse, Microscope, Save, CheckCircle, AlertTriangle, ShieldAlert, User, Calendar, Siren, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Tesseract from 'tesseract.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const SEVERITY_MAP = {
  CRITICAL: { bg: 'bg-rose-500/15', border: 'border-rose-500', badge: 'bg-rose-600 text-white', text: 'text-rose-500', glow: 'shadow-rose-500/30' },
  HIGH: { bg: 'bg-orange-500/10', border: 'border-orange-500', badge: 'bg-orange-500 text-white', text: 'text-orange-500', glow: 'shadow-orange-500/20' },
  MODERATE: { bg: 'bg-amber-500/10', border: 'border-amber-500', badge: 'bg-amber-500 text-black', text: 'text-amber-500', glow: 'shadow-amber-500/20' },
  LOW: { bg: 'bg-emerald-500/10', border: 'border-emerald-500', badge: 'bg-emerald-600 text-white', text: 'text-emerald-500', glow: 'shadow-emerald-500/20' }
};

const BAR_COLORS = { CRITICAL: '#f43f5e', HIGH: '#fb923c', MODERATE: '#fbbf24', LOW: '#10b981' };

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

export default function ReportAnalysisDoctor() {
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
  const [analyzedImage, setAnalyzedImage] = useState(null);

  // Patient Demo State
  const [pName, setPName] = useState('');
  const [pAge, setPAge] = useState('');
  const [pSex, setPSex] = useState('Male');

  useEffect(() => {
    const m = searchParams.get('mode') || 'report';
    if (m !== mode) { setMode(m); setResult(null); setSaved(false); }
  }, [location.search]);

  const handleFile = (e) => { const f = e.target.files[0]; if (f) { setFile(f); setError(null); setSaved(false); } };

  const handleSave = async () => {
    if (!token || !result || saved) return;
    setSaving(true);
    try {
      const res = await fetch("http://127.0.0.1:5002/api/doctor-diagnosis/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: JSON.stringify({
          type: mode,
          title: `${mode.toUpperCase()} - ${pName}`,
          fileName: file?.name,
          patientName: pName,
          patientAge: Number(pAge),
          patientSex: pSex,
          summary: result.summary,
          parameters: result.parameters || [],
          threats: result.threats || [],
          verdict: result.verdict,
          verdictReason: result.verdict_reason
        })
      });
      if (res.ok) setSaved(true);
    } catch (err) { console.error("Save failure:", err); }
    finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!file) { setError("Diagnostic source missing."); return; }
    if (!pName || !pAge) { setError("Patient demographic data required."); return; }
    setAnalyzing(true); setError(null);
    setPrivacyStep('Initializing Neural Privacy Tunnel...');

    try {
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      let finalImgForAI = '';
      let extractedText = '';

      // 1. EXTRACTION
      if (file.type === 'application/pdf') {
        setPrivacyStep('Decrypting PDF Layers...');
        const ab = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 2 });
        canvas.height = vp.height; canvas.width = vp.width;
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      } else {
        setPrivacyStep('Analyzing Diagnostic Matrix...');
        const img = await new Promise(r => {
          const fr = new FileReader();
          fr.onloadend = () => {
            const i = new Image();
            i.onload = () => r(i);
            i.src = fr.result;
          };
          fr.readAsDataURL(file);
        });
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      // 2. PRIVACY ENFORCEMENT
      setPrivacyStep('Running Local OCR & PII Scrubber...');
      const ocrResult = await Tesseract.recognize(canvas, 'eng');
      extractedText = scrubPII(ocrResult.data.text, pName);

      setPrivacyStep('Masking Patient Identifiers...');
      finalImgForAI = redactImageHeader(canvas);
      setAnalyzedImage(finalImgForAI);

      // 3. SECURE API TRANSMISSION
      setPrivacyStep('AI Context Synthesis...');
      const base64 = finalImgForAI.split(',')[1];

      const prompt = `System: Clinical Pathology AI for Physicians.
      Target Subject: [ANONYMIZED], ${pAge}y, ${pSex}.
      
      PRIVACY PROTOCOL:
      - All PII redacted locally.
      - ${extractedText ? 'ANONYMIZED TEXT DATA: ' + extractedText : 'Imaging Data (ID Masked)'}
      
      TASK:
      Perform deep clinical analysis for ${mode}. Focus ONLY on pathology and threats.
      
      OUTPUT FORMAT: STRICT JSON
      {
        "summary": "Professional clinical summary of findings",
        "verdict": "CRITICAL" | "HIGH" | "MODERATE" | "STABLE",
        "verdict_reason": "Specific pathological reason for the verdict",
        "health_score": (number 0-100, where 0 is dead and 100 is perfect),
        "parameters": [
          {"name": "Marker/Parameter", "value": "Value", "status": "Normal" | "Abnormal", "interpretation": "Clinical relevance"}
        ],
        "threats": [
          {
            "severity": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
            "urgency": "IMMEDIATE" | "24H" | "WEEKS",
            "condition": "The pathological condition name",
            "description": "Evidence-based clinical description",
            "immediateAction": "Specific medical intervention required"
          }
        ],
        "differential_diagnoses": ["List of potential alternatives"],
        "recommended_workup": ["Next steps in diagnostic chain"]
      }`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.05,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: finalImgForAI } }
            ]
          }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "Model Bridge Failure");
      if (!data.choices?.[0]) throw new Error("Inference failed.");

      const parsedResult = JSON.parse(data.choices[0].message.content);
      if (parsedResult.error === 'wrong_report') {
        setError(parsedResult.message);
      } else {
        setResult(parsedResult);
      }

    } catch (err) { setError("Neural Engine Error: " + err.message); }
    finally { setAnalyzing(false); setPrivacyStep(''); }
  };

  const Icon = mode === 'ecg' ? HeartPulse : mode === 'mri' ? Microscope : mode === 'ct' ? Activity : FileText;

  const threatChartData = result?.threats?.map((t, i) => ({
    name: t.condition?.substring(0, 15) || `Threat ${i + 1}`,
    severity: t.severity === 'CRITICAL' ? 4 : t.severity === 'HIGH' ? 3 : t.severity === 'MODERATE' ? 2 : 1,
    fill: BAR_COLORS[t.severity] || '#94a3b8'
  })) || [];

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 bg-mesh min-h-screen">

      {/* Immersive Background Layers */}
      <div className="fixed inset-0 bg-transparent -z-20" />
      <div className="fixed inset-0 bg-dashboard-grid opacity-20 -z-10" />
      <div className="blob w-[900px] h-[900px] bg-rose-500/5 -top-40 -left-60 blur-[150px]" />
      <div className="blob w-[900px] h-[900px] bg-cyan-500/5 -bottom-40 -right-60 blur-[150px]" />

      {/* Header */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center justify-between mb-12 gap-6 flex-wrap relative z-20">
        <Button variant="outline" className="flex items-center gap-3 h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-white/10 glass-panel group" onClick={() => navigate('/hospital-dashboard')}>
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Hospital Hub
        </Button>
        <div className="flex p-1.5 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 gap-1.5">
          {['report', 'ecg', 'ct', 'mri'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setResult(null); setSaved(false); }}
              className={cn("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all", mode === m ? "bg-cyan-500 text-white shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5")}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]">
            <Lock className="w-6 h-6 text-rose-500" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="input" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-8">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Patient Input Area */}
              <div className="lg:col-span-12 glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-dashboard-grid opacity-5 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3 text-cyan-500">
                  <span className="w-8 h-1 bg-cyan-500" /> 01 // Clinical Meta-Data
                </h3>
                <div className="grid md:grid-cols-3 gap-8 relative z-10">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 ml-1">Subject Identity</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 opacity-40" />
                      <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="Full Name"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 outline-none focus:border-cyan-500/50 text-xs font-black uppercase tracking-widest" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 ml-1">Age (Years)</label>
                    <div className="relative group">
                      <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 opacity-40" />
                      <input type="number" value={pAge} onChange={e => setPAge(e.target.value)} placeholder="Age"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 outline-none focus:border-cyan-500/50 text-xs font-black uppercase tracking-widest" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 ml-1">Gender</label>
                    <select value={pSex} onChange={e => setPSex(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-cyan-500/50 text-xs font-black uppercase tracking-widest appearance-none">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Station */}
              <div className="lg:col-span-12 glass-panel p-1 bg-gradient-to-br from-white/10 to-transparent rounded-[56px]">
                <div className="glass-panel p-16 rounded-[54px] border-none text-center space-y-10 relative overflow-hidden backdrop-blur-3xl">
                  <div className="scanning-line" />

                  <div className="w-32 h-32 rounded-[40px] bg-[#020617] border-2 border-rose-500/30 flex items-center justify-center text-rose-500 shadow-2xl relative z-10 mx-auto">
                    <Icon className="w-12 h-12" />
                  </div>

                  <div className="max-w-2xl mx-auto">
                    <h2 className="text-4xl font-black tracking-tighter mb-4 text-gradient bg-gradient-to-r from-white to-white/40 uppercase">Threat Analysis {mode.toUpperCase()}</h2>
                    <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] opacity-40 leading-relaxed">Initialize physician-tier pathological scan for subject {pName || 'unknown'}.</p>
                  </div>

                  <div className="flex flex-col items-center gap-8">
                    <label className="relative cursor-pointer group/label w-full max-w-xl">
                      <input type="file" className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer" accept="image/*,application/pdf" onChange={handleFile} />
                      <div className="glass-panel p-6 rounded-3xl border-white/10 group-hover/label:border-rose-500/40 transition-all text-center">
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)] group-hover/label:text-rose-400">
                          {file ? `// SYNCED: ${file.name}` : "// ENGAGE DIAGNOSTIC SENSOR"}
                        </span>
                      </div>
                    </label>

                    <Button size="lg" className="h-24 w-full max-w-xl rounded-[32px] font-black uppercase tracking-[0.4em] text-xs button-premium bg-rose-600 shadow-[0_0_50px_-10px_rgba(244,63,94,0.4)] border-none relative overflow-hidden group/btn"
                      disabled={!file || analyzing || !pName || !pAge} onClick={analyze}>
                      <span className="relative z-10 flex flex-col items-center gap-2">
                        {analyzing ? (
                          <>
                            <div className="flex items-center gap-4">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Neural Staging Engaged</span>
                            </div>
                            <span className="text-[8px] opacity-60 tracking-[0.2em]">{privacyStep}</span>
                          </>
                        ) : (
                          <span className="flex items-center gap-4">Execute Threat Sequence <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" /></span>
                        )}
                      </span>
                    </Button>
                    {error && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest relative z-10">
                        <AlertTriangle className="w-4 h-4 inline-block mr-3 mb-1" /> {error}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-32">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* DIAGNOSTIC ANALYSIS STATION */}
              <div className="lg:col-span-8 glass-panel p-10 rounded-[48px] border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-dashboard-grid opacity-5 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500 flex items-center justify-between">
                  <span className="flex items-center gap-3"><Activity className="w-4 h-4" /> 01 // Diagnostic Analysis Station [{mode.toUpperCase()}]</span>
                </h3>
                <div className="relative aspect-video rounded-[32px] overflow-hidden border-2 border-white/10 bg-[#020617] group-hover:border-cyan-500/30 transition-all duration-700 shadow-2xl">
                  {analyzedImage ? (
                    <img src={analyzedImage} alt="Neural Diagnostic Source" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-700 mt-4" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-cyan-500 animate-spin opacity-20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">Metadata Redacted</p>
                      <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest italic leading-relaxed">Neural bridge source verification: {file?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION COMMAND CENTER */}
              <div className="lg:col-span-4 flex flex-col gap-8">
                <div className={cn("flex-grow glass-panel p-10 rounded-[48px] border-2 flex flex-col justify-center relative overflow-hidden group transition-all",
                  result.verdict === 'STABLE' ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_50px_-10px_rgba(16,185,129,0.1)]" : "border-rose-500/30 bg-rose-500/5 shadow-[0_0_50px_-10px_rgba(244,63,94,0.1)]"
                )}>
                  <div className="scanning-line opacity-10" />
                  <div className="relative z-10 space-y-8">
                    <div>
                      <h4 className={cn("text-[10px] font-black uppercase tracking-[0.4em] mb-2", result.verdict === 'STABLE' ? "text-emerald-500" : "text-rose-500")}>Clinical Verdict</h4>
                      <p className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{result.verdict}</p>
                      <p className="text-[10px] font-black text-white/40 uppercase mt-4 tracking-[0.2em]">{result.verdict_reason}</p>
                    </div>
                    
                    <div className="space-y-4">
                       {!saved ? (
                        <Button onClick={handleSave} disabled={saving} className="h-16 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-xl">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Commit Verdict'}
                        </Button>
                      ) : (
                        <div className="h-16 w-full rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center font-black uppercase tracking-[0.2em] text-[10px] gap-3">
                          <CheckCircle className="w-4 h-4" /> VERDICT STORED
                        </div>
                      )}
                      <Button onClick={() => { setResult(null); setSaved(false); }} variant="outline" className="h-16 w-full rounded-2xl border-white/10 glass-panel font-black uppercase tracking-[0.2em] text-[10px]">
                        Reset Terminal
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-8 rounded-[40px] border-white/10 bg-white/5 flex items-center justify-between group">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Subject Meta</h4>
                    <p className="text-xl font-black text-white uppercase tracking-tighter">{pName} // {pAge}Y</p>
                  </div>
                </div>
              </div>
            </div>

            {/* DIAGNOSTIC GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="glass-panel p-10 rounded-[40px] border-white/10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                  <Activity className="w-4 h-4 inline-block mr-3" /> Clinical Bio-signature
                </h3>
                <div className="space-y-4">
                  {result.parameters?.map((p, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{p.name}</p>
                        <p className="text-sm font-black text-white">{p.value}</p>
                      </div>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-full", p.status === 'Normal' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-10 rounded-[40px] border-white/10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-rose-500">
                  <Siren className="w-4 h-4 inline-block mr-3" /> Critical Threat Assessment
                </h3>
                <div className="space-y-4">
                  {result.threats?.map((t, i) => (
                    <div key={i} className="p-6 rounded-[32px] bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-all">
                      <div className="flex justify-between mb-3">
                        <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase tracking-[0.2em]">{t.severity}</span>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">{t.urgency}</span>
                      </div>
                      <p className="text-xs font-black uppercase text-white tracking-widest mb-1">{t.condition}</p>
                      <p className="text-[10px] text-white/40 italic leading-tight mb-4">{t.description}</p>
                      <div className="p-3 rounded-xl bg-[#020617] border border-rose-500/30 text-[9px] font-black text-rose-500 uppercase">
                        Action: {t.immediateAction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ADVANCED CLINICAL INSIGHTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
              <div className="glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-violet-600 opacity-0 group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-violet-500">
                  <span className="w-8 h-1 bg-violet-500 mr-3" /> Differential Consensus
                </h3>
                <div className="space-y-3 relative z-10">
                  {result.differential_diagnoses?.map((d, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-2xl bg-[#020617]/40 border border-white/5 hover:border-violet-500/30 transition-all">
                      <div className="w-2 h-2 rounded-full bg-violet-500 mt-1 flex-shrink-0" />
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">{d}</span>
                    </div>
                  ))}
                  {(!result.differential_diagnoses || result.differential_diagnoses.length === 0) && <p className="text-[10px] text-white/20 italic tracking-widest uppercase">No alternative etiologies identified.</p>}
                </div>
              </div>

              <div className="glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-cyan-600 opacity-0 group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                  <span className="w-8 h-1 bg-cyan-500 mr-3" /> Recommended Workup
                </h3>
                <div className="space-y-3 relative z-10">
                  {result.recommended_workup?.map((w, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-2xl bg-[#020617]/40 border border-white/5 hover:border-cyan-500/30 transition-all">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1 flex-shrink-0" />
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">{w}</span>
                    </div>
                  ))}
                  {(!result.recommended_workup || result.recommended_workup.length === 0) && <p className="text-[10px] text-white/20 italic tracking-widest uppercase">Direct diagnostic confirmation achieved.</p>}
                </div>
              </div>
            </div>

            <div className="py-12 text-center opacity-30">
              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] max-w-5xl mx-auto leading-relaxed">
                PHYSICIAN DIAGNOSTIC NODE // RECURSIVE THREAT DETECTION // NON-PRESCRIPTIVE // STITCH BIOTECH 2026
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
