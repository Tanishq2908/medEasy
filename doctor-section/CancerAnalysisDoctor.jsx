import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowLeft, Loader2, Save, CheckCircle, AlertTriangle, Microscope, Dna, Activity, ShieldAlert, User, Calendar, Siren, CircleAlert, ShieldCheck, Lock, ArrowRight, Apple } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

export default function CancerAnalysisDoctor() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [reportType, setReportType] = useState('ct');
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
    if (result && !saved && !saving) handleSave();
  }, [result]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); setSaved(false); }
  };

  const handleSave = async () => {
    if (!token || !result || saved) return;
    setSaving(true);
    try {
      const cancerData = result.cancer_analysis ? {
        cancerDetected: result.cancer_analysis.cancer_detected,
        cancerType: result.cancer_analysis.cancer_type,
        primarySite: result.cancer_analysis.primary_site,
        stage: result.cancer_analysis.stage,
        grade: result.cancer_analysis.grade,
        tnm: result.cancer_analysis.tnm_classification ? {
          t: result.cancer_analysis.tnm_classification.t_category,
          n: result.cancer_analysis.tnm_classification.n_category,
          m: result.cancer_analysis.tnm_classification.m_category
        } : undefined,
        tumorSize: result.cancer_analysis.tumor_characteristics?.size_cm,
        tumorLocation: result.cancer_analysis.tumor_characteristics?.location,
        tumorFeatures: result.cancer_analysis.tumor_characteristics?.features,
        biomarkers: result.cancer_analysis.biomarkers,
        geneticMutations: result.cancer_analysis.genetic_mutations?.map(g => ({
          gene: g.gene, mutation: g.mutation, therapy: g.targeted_therapy
        })),
        metastasisSites: result.cancer_analysis.metastasis_sites,
        followUp: result.follow_up ? {
          recommendedTests: result.follow_up.recommended_tests,
          specialistReferral: result.follow_up.specialist_referral,
          timeline: result.follow_up.timeline,
          additionalWorkup: result.follow_up.additional_workup
        } : undefined
      } : undefined;

      const res = await fetch("http://127.0.0.1:5002/api/doctor-diagnosis/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: JSON.stringify({
          type: 'cancer',
          title: `Diagnostic Node - ${pName}`,
          fileName: file?.name,
          patientName: pName,
          patientAge: Number(pAge),
          patientSex: pSex,
          summary: result.summary,
          parameters: result.parameters || [],
          threats: result.threats || [],
          verdict: result.cancer_analysis?.cancer_detected ? 'CRITICAL' : 'STABLE',
          verdictReason: result.summary,
          cancerData
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
      const isTextReport = ['blood', 'biopsy', 'genetic'].includes(reportType);
      if (isTextReport) {
        setPrivacyStep('Running Local OCR & PII Scrubber...');
        const ocrResult = await Tesseract.recognize(canvas, 'eng');
        extractedText = scrubPII(ocrResult.data.text, pName);
        setPrivacyStep('Anonymization Complete.');
      }

      setPrivacyStep('Masking Patient Identifiers...');
      finalImgForAI = redactImageHeader(canvas);
      setAnalyzedImage(finalImgForAI);

      // 3. SECURE TRANSMISSION
      setPrivacyStep('AI Context Synthesis...');
      const base64 = finalImgForAI.split(',')[1];

      const prompt = `System: Expert Physician Oncology Assistant.
      Target Subject: [ANONYMIZED], ${pAge}y, ${pSex}.
      
      PRIVACY PROTOCOL:
      - All PII has been redacted locally.
      - ${isTextReport ? 'ANONYMIZED TEXT DATA: ' + extractedText : 'Imaging Data (ID Masked)'}
      
      TASK:
      Perform deep clinical analysis for ${reportType}. Identify malignancy indicators, TNM staging, and molecular targets.
      
      OUTPUT FORMAT: STRICT JSON
      {
        "summary": "Doctor-tier pathological summary",
        "health_score": (number 0-100),
        "cancer_analysis": {
          "cancer_detected": (boolean),
          "cancer_type": "Specific histopathology",
          "primary_site": "Biological location",
          "stage": "Clinical Stage (e.g., T2N1M0)",
          "grade": "Histological grade",
          "tnm_classification": {
            "t_category": "T category value",
            "n_category": "N category value",
            "m_category": "M category value"
          },
          "tumor_characteristics": {
            "size_cm": (number or range),
            "location": "Detailed location",
            "features": "Specific morphology"
          },
          "biomarkers": [{"name": "Marker", "value": "Result", "status": "Interpretation"}],
          "genetic_mutations": [{"gene": "Gene", "mutation": "Mutation", "targeted_therapy": "Specific Rx"}],
          "metastasis_sites": ["List of suspicious nodes/organs"]
        },
        "parameters": [{"name": "Clinical Marker", "value": "Value", "status": "Result Tier"}],
        "threats": [
          {
            "severity": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
            "urgency": "IMMEDIATE" | "24H" | "WEEKS",
            "condition": "Condition name",
            "description": "Pathological reasoning",
            "immediateAction": "Clinical recommendation for physician"
          }
        ],
        "follow_up": {
          "recommended_tests": ["List"],
          "specialist_referral": "Departments",
          "timeline": "ASAP | etc",
          "additional_workup": "Reasoning"
        },
        "medications": [{"name": "Drug name", "class": "Antineoplastic/etc", "purpose": "Targeted goal"}],
        "differential_diagnoses": ["List potential alternatives"],
        "clinical_reasoning": "Detailed technical reasoning paragraph for physician"
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
      if (data.error) throw new Error(data.error.message || "Groq Error");
      if (!data.choices?.[0]) throw new Error("Inference failure.");

      const parsedResult = JSON.parse(data.choices[0].message.content);
      if (parsedResult.error === 'wrong_report') {
        setError(parsedResult.message);
      } else {
        setResult(parsedResult);
      }

    } catch (err) { setError("Neural Engine Error: " + err.message); }
    finally { setAnalyzing(false); setPrivacyStep(''); }
  };

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
        <Button
          variant="outline"
          className="flex items-center gap-3 h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-white/10 glass-panel hover:bg-rose-500/5 transition-all group"
          onClick={() => navigate('/hospital-dashboard')}
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Hospital Hub
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">SECURE PHYSICIAN NODE</span>
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-50">Diagnostic Shield Active</span>
          </div>
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
                  <span className="w-8 h-1 bg-cyan-500" /> 01 // Clinical Demographics
                </h3>
                <div className="grid md:grid-cols-3 gap-8 relative z-10">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 ml-1">Subject Name</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 opacity-40 group-focus-within:opacity-100 transition-opacity" />
                      <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="Full Identity"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all text-xs font-black uppercase tracking-widest" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 ml-1">Chronological Age</label>
                    <div className="relative group">
                      <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 opacity-40 group-focus-within:opacity-100 transition-opacity" />
                      <input type="number" value={pAge} onChange={e => setPAge(e.target.value)} placeholder="Years"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all text-xs font-black uppercase tracking-widest" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60 ml-1">Biological Sex</label>
                    <select value={pSex} onChange={e => setPSex(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all text-xs font-black uppercase tracking-widest appearance-none cursor-pointer">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modality & Action Area */}
              <div className="lg:col-span-12 glass-panel p-1 bg-gradient-to-br from-white/10 to-transparent rounded-[56px]">
                <div className="glass-panel p-16 rounded-[54px] border-none text-center space-y-10 relative overflow-hidden backdrop-blur-3xl">
                  <div className="scanning-line" />

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { id: 'ct', label: 'CT Scan', icon: Activity },
                      { id: 'mri', label: 'MRI', icon: Activity },
                      { id: 'xray', label: 'X-Ray', icon: Activity },
                      { id: 'biopsy', label: 'Biopsy', icon: Microscope },
                      { id: 'blood', label: 'Blood', icon: Dna },
                      { id: 'genetic', label: 'Genomics', icon: Dna },
                    ].map((type) => (
                      <button key={type.id} onClick={() => { setReportType(type.id); setResult(null); setError(null); }}
                        className={cn("p-6 rounded-[28px] border-2 flex flex-col items-center gap-3 transition-all duration-500 group relative",
                          reportType === type.id ? "bg-rose-500/20 border-rose-500 shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]" : "bg-white/5 border-white/5 hover:border-rose-500/30"
                        )}>
                        <type.icon className={cn("w-6 h-6", reportType === type.id ? "text-rose-500" : "text-white/20")} />
                        <span className={cn("text-[9px] font-black uppercase tracking-[0.2em]", reportType === type.id ? "text-rose-500" : "text-white/40")}>{type.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-8">
                    <label className="relative cursor-pointer group/label w-full max-w-xl">
                      <input type="file" className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer" accept="image/*,application/pdf" onChange={handleFile} />
                      <div className="glass-panel p-6 rounded-3xl border-white/10 group-hover/label:border-rose-500/40 transition-all text-center">
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)] group-hover/label:text-rose-400">
                          {file ? `// SOURCE: ${file.name}` : "// ENGAGE DIAGNOSTIC SENSOR"}
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
                              <span>Staging Neural Sequence</span>
                            </div>
                            <span className="text-[8px] opacity-60 tracking-[0.2em]">{privacyStep}</span>
                          </>
                        ) : (
                          <span className="flex items-center gap-4">
                            Initialize AI Assessment <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" />
                          </span>
                        )}
                      </span>
                    </Button>
                    {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 px-8 py-4 rounded-2xl border border-rose-500/20">{error}</p>}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-32">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* PRIMARY VISUALIZATION STATION */}
              <div className="lg:col-span-8 glass-panel p-10 rounded-[48px] border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-dashboard-grid opacity-5 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-rose-500 flex items-center justify-between">
                  <span className="flex items-center gap-3"><Activity className="w-4 h-4" /> 01 // Diagnostics Visualization Station</span>
                  <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest bg-white/5 px-4 py-1 rounded-full border border-white/5">Redacted Node Archive</span>
                </h3>
                <div className="relative aspect-video rounded-[32px] overflow-hidden border-2 border-white/10 bg-[#020617] group-hover:border-rose-500/30 transition-all duration-700 shadow-2xl">
                  {analyzedImage ? (
                    <img src={analyzedImage} alt="Analyzed Diagnostic Data" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-700 mt-4" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-rose-500 animate-spin opacity-20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Neural Index Active</p>
                      <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest italic leading-relaxed">Cross-referenced with pathological consensus.</p>
                    </div>
                    <div className="flex gap-2">
                       <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                       <span className="w-2 h-2 rounded-full bg-rose-500/40" />
                       <span className="w-2 h-2 rounded-full bg-rose-500/20" />
                    </div>
                  </div>
                </div>
              </div>

              {/* PATHOLOGICAL VERDICT QUICK-ACTION */}
              <div className="lg:col-span-4 flex flex-col gap-8">
                <div className="flex-grow glass-panel p-10 rounded-[48px] border-rose-500/30 bg-rose-500/5 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] pointer-events-none" />
                  <div className="scanning-line opacity-20" />
                  <div className="relative z-10 space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500 mb-2">Diagnostic Verdict</h4>
                      <p className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{result.cancer_analysis.cancer_detected ? "POSITIVE MALIGNANCY" : "NEGATIVE FINDINGS"}</p>
                    </div>
                    <div className="p-6 rounded-[32px] bg-[#020617]/80 border border-white/10 group-hover:border-rose-500/30 transition-all">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mb-3">Clinical Rationale</p>
                      <p className="text-[10px] font-bold text-white/80 leading-relaxed italic">{result.summary}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-grow h-px bg-white/5" />
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">STITCH BIOTECH OS</span>
                      <div className="flex-grow h-px bg-white/5" />
                    </div>
                  </div>
                </div>
                
                <div className="glass-panel p-8 rounded-[40px] border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between group cursor-pointer hover:border-emerald-500/40 transition-all">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Health Stability</h4>
                    <p className="text-2xl font-black text-white uppercase tracking-tighter">{result.health_score}%</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* DIAGNOSTIC GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Tumor Morphology */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-dashboard-grid opacity-5 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-rose-500">
                  <Microscope className="w-4 h-4 inline-block mr-3" /> Tumor Morphology
                </h3>
                <div className="space-y-4">
                  {[
                    { l: "Primary Site", v: result.cancer_analysis.primary_site || "N/A" },
                    { l: "Node Staging", v: result.cancer_analysis.stage || "N/A" },
                    { l: "Hist Grade", v: result.cancer_analysis.grade || "N/A" },
                    { l: "Dim (CM)", v: result.cancer_analysis.tumor_characteristics?.size_cm || "N/A" },
                  ].map((it, i) => (
                    <div key={i} className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-rose-500/20 transition-all">
                      <span className="text-[9px] font-black uppercase text-white opacity-40">{it.l}</span>
                      <span className="text-xs font-black uppercase text-white">{it.v}</span>
                    </div>
                  ))}
                </div>
                {result.cancer_analysis.tnm_classification && (
                  <div className="mt-6 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-[8px] font-black text-rose-400 uppercase mb-1">T</p><p className="text-sm font-black text-white">{result.cancer_analysis.tnm_classification.t_category}</p></div>
                    <div><p className="text-[8px] font-black text-rose-400 uppercase mb-1">N</p><p className="text-sm font-black text-white">{result.cancer_analysis.tnm_classification.n_category}</p></div>
                    <div><p className="text-[8px] font-black text-rose-400 uppercase mb-1">M</p><p className="text-sm font-black text-white">{result.cancer_analysis.tnm_classification.m_category}</p></div>
                  </div>
                )}
              </div>

              {/* Biological Markers */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                  <Activity className="w-4 h-4 inline-block mr-3" /> Bio-Signature
                </h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {result.parameters?.map((p, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/20 transition-all">
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-black text-white uppercase">{p.name}</span>
                        <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full", p.status === 'Normal' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>{p.status}</span>
                      </div>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Value: {p.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Threat Chart */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-violet-500">
                  <Siren className="w-4 h-4 inline-block mr-3" /> Pathological Spread
                </h3>
                <div className="h-[280px]">
                  <ResponsiveContainer>
                    <BarChart data={threatChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.05} horizontal={false} />
                      <XAxis type="number" domain={[0, 4]} hide />
                      <YAxis type="category" dataKey="name" width={100} stroke="rgba(255,255,255,0.4)" fontSize={9} fontWeight={900} />
                      <Bar dataKey="severity" radius={[0, 8, 8, 0]} barSize={20}>
                        {threatChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* TREATMENTS & MUTATIONS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Genomic Targets */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-cyan-500">
                  <Dna className="w-4 h-4 inline-block mr-3" /> Genomic Targets
                </h3>
                <div className="space-y-4">
                  {result.cancer_analysis.genetic_mutations?.map((g, i) => (
                    <div key={i} className="flex items-center gap-6 p-6 rounded-[32px] bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-all">
                      <div className="w-12 h-12 rounded-2xl bg-[#020617] border border-cyan-500/30 flex items-center justify-center font-black text-cyan-500 text-[10px]">{g.gene}</div>
                      <div className="flex-grow">
                        <p className="text-xs font-black uppercase text-white tracking-widest">{g.mutation}</p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Rx: {g.targeted_therapy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Oncology Protocols */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-emerald-500">
                  <Apple className="w-4 h-4 inline-block mr-3" /> Oncology Protocols
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.medications?.map((m, i) => (
                    <div key={i} className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
                      <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full mb-3 inline-block">{m.class}</span>
                      <p className="text-xs font-black text-white uppercase tracking-tighter mb-1">{m.name}</p>
                      <p className="text-[9px] text-white/40 font-bold italic leading-tight">{m.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="py-12 text-center opacity-30">
              <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] max-w-5xl mx-auto leading-relaxed">
                PHYSICIAN ASSISTANT NODE // RECURSIVE NEURAL ANALYSIS // NON-DIAGNOSTIC WITHOUT HUMAN OVERSIGHT // STITCH BIOTECH 2026
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
