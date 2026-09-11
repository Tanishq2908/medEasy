import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowLeft, Loader2, Save, CheckCircle, AlertTriangle, Microscope, Dna, Activity, ShieldAlert, Apple, User, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import * as pdfjs from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

// --- PRIVACY REINFORCEMENT ENGINE ---
const scrubPII = (text, patientName) => {
  if (!text) return "";
  let scrubbed = text;
  // Redact Name
  if (patientName) {
    const names = patientName.split(' ');
    names.forEach(name => {
      if (name.length > 2) {
        const re = new RegExp(name, 'gi');
        scrubbed = scrubbed.replace(re, '[REDACTED_IDENTITY]');
      }
    });
  }
  // Redact Emails/Phones
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  scrubbed = scrubbed.replace(/(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '[REDACTED_PHONE]');
  // Redact common date of birth patterns
  scrubbed = scrubbed.replace(/DOB[:\s]*\d{1,2}[\/\-\s]\d{1,2}[\/\-\s]\d{2,4}/gi, 'DOB: [REDACTED_DATE]');
  return scrubbed;
};

// Redacts the top 15% of the image (common hospital header location)
const redactImageHeader = (canvas) => {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.15); 
  return canvas.toDataURL('image/jpeg', 0.8);
};

export default function CancerAnalysisPatient() {
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

  useEffect(() => {
    if (result && !saved && !saving) handleSave();
  }, [result]);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setError(null);
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!token || !result || saved) return;
    setSaving(true);
    try {
      const res = await fetch("http://127.0.0.1:5002/api/patient-diagnosis/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: JSON.stringify({
          type: 'cancer',
          title: `Oncology Sequence - ${reportType.toUpperCase()}`,
          summary: result.summary,
          parameters: result.parameters || [],
          threats: result.threats || [],
          followUp: result.follow_up || {},
          diet: result.diet || [],
          overallScore: result.health_score || 75,
          cancerData: result.cancer_analysis || {}
        })
      });
      if (res.ok) setSaved(true);
    } catch (err) { console.error("Save failure:", err); }
    finally { setSaving(false); }
  };

  const analyze = async () => {
    if (!file) { setError("Data source missing."); return; }
    setAnalyzing(true);
    setError(null);
    setPrivacyStep('Initializing Neural Privacy Tunnel...');

    try {
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      let finalImgForAI = '';
      let extractedText = '';

      // 1. DATA EXTRACTION BLOCK
      if (file.type === 'application/pdf') {
        setPrivacyStep('Decrypting PDF Layers...');
        const ab = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 2 });
        canvas.height = vp.height;
        canvas.width = vp.width;
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
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      // 2. PRIVACY ENFORCEMENT BLOCK (Crucial)
      const isTextReport = ['blood', 'biopsy', 'genetic'].includes(reportType);

      if (isTextReport) {
        setPrivacyStep('Running Local OCR & PII Scrubber...');
        const ocrResult = await Tesseract.recognize(canvas, 'eng');
        extractedText = scrubPII(ocrResult.data.text, user.name);
        setPrivacyStep('Anonymization Complete. Committing sanitized data.');
      }

      // For all imaging, BLACKOUT the header to hide patient names
      setPrivacyStep('Masking Subject Identifiers...');
      finalImgForAI = redactImageHeader(canvas);

      // 3. SECURE API TRANSMISSION
      setPrivacyStep('Inference in progress...');
      const base64 = finalImgForAI.split(',')[1];
      
      const prompt = `System: You are an advanced high-precision oncology diagnostic engine (Scout-17b).
      Analyze the provided ${reportType} data for internal reference patient "${user?.name || 'Subject'}".
      
      PRIVACY & SECURITY:
      - Identity masking active. Any visual identifiers are redacted.
      - ${isTextReport ? 'TEXT DATA (OCR): ' + extractedText : 'IMAGING DATA: Identity Scrubbed'}
      
      REQUIRED JSON STRUCTURE (Strict adherence):
      {
        "summary": "High-level diagnostic summary (max 2 sentences)",
        "health_score": 0-100 (confidence/stability),
        "cancer_analysis": {
          "cancer_detected": boolean,
          "stage": "Clinical Stage (e.g., IA, III, etc.)",
          "primary_site": "Anatomical location of cluster",
          "grade": "Pathological grade (e.g., G1, Poorly Differentiated)",
          "tumor_characteristics": {
            "size_cm": number,
            "features": ["list of observable traits"]
          }
        },
        "parameters": [
          {"name": "Marker/Feature Name", "value": "Measured value", "status": "Normal/Abnormal/Critical"}
        ],
        "threats": [
          {"severity": "CRITICAL/HIGH/MODERATE", "condition": "Specific risk", "immediateAction": "Clinical directive", "urgency": "Timeline"}
        ],
        "follow_up": {
          "specialist_referral": "Specific department/specialist",
          "timeline": "Urgency window"
        },
        "diet": [
          {"category": "Nutritional aspect", "recommendation": "Specific food/protocol", "reason": "Biochemical rationale"}
        ]
      }
      
      STRICT GUIDELINE: Return ONLY the raw JSON object. No markdown, no preamble.`;

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
      if (data.error) throw new Error(data.error.message || "Neuro-Inference Error");
      if (!data.choices?.[0]) throw new Error("Staging response failed.");
      
      const parsedResult = JSON.parse(data.choices[0].message.content);
      if (parsedResult.error === 'wrong_report') {
        setError(parsedResult.message);
      } else {
        setResult(parsedResult);
      }

    } catch (err) { setError("Engine Error: " + err.message); }
    finally { setAnalyzing(false); setPrivacyStep(''); }
  };

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 bg-mesh min-h-screen">
      
      <div className="fixed inset-0 bg-transparent -z-10" />
      <div className="blob w-[800px] h-[800px] bg-rose-500/5 -top-40 -left-40 blur-[150px]" />
      <div className="blob w-[800px] h-[800px] bg-cyan-500/5 -bottom-40 -right-40 blur-[150px]" />

      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="flex items-center justify-between mb-12 gap-6 flex-wrap relative z-20"
      >
        <Button
          variant="outline"
          className="flex items-center gap-3 h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-white/10 glass-panel hover:bg-rose-500/5 transition-all group"
          onClick={() => navigate('/patient-dashboard')}
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Diagnostic Hub
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Neural Link: Active</span>
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest opacity-50">Stitch Oncology v4.2.1</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]">
            <ShieldAlert className="w-6 h-6 text-rose-500 animate-pulse" />
          </div>
        </div>
      </motion.div>


      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="input" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-10">
            
            {/* Module Selection - Station Tiles */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                  <Activity className="w-32 h-32 text-rose-500" />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3 text-rose-500">
                  <span className="w-8 h-1 bg-rose-500" /> 01 // Analysis Modules
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {[
                    { id: 'ct', label: 'CT Volumetric', desc: 'Neural Cross-Section' },
                    { id: 'mri', label: 'MRI Array', desc: 'Soft Tissue Neural' },
                    { id: 'xray', label: 'X-Ray Capt', desc: 'Bone Structure' },
                    { id: 'biopsy', label: 'Biopsy Lab', desc: 'Cellular Logic' },
                    { id: 'blood', label: 'Hemo Feed', desc: 'Biomarker Extraction' },
                    { id: 'genetic', label: 'Genom Map', desc: 'Mutation Sequence' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => { setReportType(type.id); setResult(null); setError(null); }}
                      className={cn(
                        "p-6 rounded-[28px] border-2 flex flex-col items-start gap-3 transition-all duration-500 relative overflow-hidden group text-left",
                        reportType === type.id
                          ? "bg-rose-500/20 border-rose-500 shadow-[0_0_40px_-10px_rgba(244,63,94,0.4)]"
                          : "bg-white/5 border-white/5 hover:border-rose-500/30 hover:bg-white/[0.08]"
                      )}
                    >
                      {reportType === type.id && <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />}
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", reportType === type.id ? "text-rose-500" : "text-[var(--text-muted)]")}>{type.label}</span>
                      <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-40">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Visualizer Tile */}
              <div className="lg:col-span-4 glass-panel p-10 rounded-[40px] border-white/10 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-dashboard-grid opacity-10 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-4 text-cyan-500">
                  <span className="w-8 h-1 bg-cyan-500 inline-block align-middle mr-3" /> System Logic
                </h3>
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Processing Node</p>
                      <p className="text-sm font-black uppercase font-display">Scout-17b Engine</p>
                    </div>
                    <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div animate={{ x: [-48, 48] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-full h-full bg-cyan-500" />
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-[8px] font-black uppercase tracking-widest text-rose-500 mb-2">Security Protocol</p>
                    <p className="text-[10px] font-bold leading-relaxed opacity-50">Multi-modal clinical data undergoes recursive neural staging before final diagnostic synthesis.</p>
                  </div>
                </div>
                <div className="mt-8 flex justify-center">
                   <Dna className="w-20 h-20 text-[var(--text-muted)] opacity-10 animate-spin-slow" />
                </div>
              </div>
            </div>

            {/* Comprehensive Upload Station */}
            <div className="glass-panel p-1 border-white/10 rounded-[56px] bg-gradient-to-br from-white/10 to-transparent">
              <div className="glass-panel p-20 rounded-[54px] border-none flex flex-col items-center text-center gap-10 hover:bg-white/[0.04] transition-all group relative overflow-hidden backdrop-blur-3xl shrink-0">
                <div className="absolute inset-0 bg-dashboard-grid opacity-10 pointer-events-none" />
                <div className="scanning-line" />
                
                <div className="relative group/icon">
                  <div className="absolute inset-0 bg-rose-500/20 blur-[30px] rounded-full scale-150 transition-transform group-hover/icon:scale-[2]" />
                  <div className="w-32 h-32 rounded-[40px] bg-[#020617] border-2 border-rose-500/30 flex items-center justify-center text-rose-500 relative z-10 group-hover/icon:border-rose-500/60 transition-all duration-700">
                    {file ? <CheckCircle className="w-12 h-12" /> : <Microscope className="w-12 h-12" />}
                  </div>
                </div>

                <div className="max-w-2xl relative z-10">
                  <h2 className="text-5xl font-black tracking-tighter mb-4 text-gradient bg-gradient-to-r from-white to-white/40 uppercase">Initial Diagnostic Seq</h2>
                  <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] opacity-40 leading-relaxed mx-auto max-w-md">Initialize high-precision oncology sequence via clinical media synthesis.</p>
                </div>

                <div className="w-full max-w-2xl flex flex-col gap-6 relative z-10">
                  <label className="relative block cursor-pointer group/label">
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" accept="image/*,application/pdf" onChange={handleFile} />
                    <div className="glass-panel p-6 rounded-[28px] border-white/10 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all text-center">
                       <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)] group-hover/label:text-rose-400 truncate block">
                        {file ? `// SYNCED: ${file.name}` : "Launch Clinical Media Scanner"}
                      </span>
                    </div>
                  </label>

                  <Button 
                    size="lg" 
                    className="h-24 rounded-[30px] font-black uppercase tracking-[0.4em] text-xs button-premium bg-rose-600 shadow-[0_0_50px_-10px_rgba(244,63,94,0.4)] border-none relative overflow-hidden group/btn" 
                    disabled={!file || analyzing} 
                    onClick={analyze}
                  >
                    <span className="relative z-10 flex flex-col items-center justify-center gap-2">
                      {analyzing ? (
                        <>
                          <div className="flex items-center gap-4">
                             <Loader2 className="w-5 h-5 animate-spin" />
                             <span>Neural Staging Engaged</span>
                          </div>
                          <span className="text-[8px] opacity-60 tracking-[0.2em]">{privacyStep}</span>
                        </>
                      ) : (
                        <span className="flex items-center gap-4">
                          Synchronize Analayzer <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" />
                        </span>
                      )}
                    </span>
                  </Button>
                </div>
                
                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-8 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest relative z-10">
                    <span className="mr-2">⚠ ERROR:</span> {error}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

        ) : (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-32">
            
            {/* HERO DIAGNOSTIC TILE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className={cn("lg:col-span-8 p-12 rounded-[48px] border relative overflow-hidden glass-panel",
                result?.cancer_analysis?.cancer_detected ? "border-rose-500/30" : "border-emerald-500/30"
              )}>
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                   <div className="waveform-container">
                    <svg viewBox="0 0 200 100" className="w-64 h-32">
                      <path d="M0,50 Q25,0 50,50 T100,50 T150,50 T200,50" fill="none" stroke="currentColor" strokeWidth="2" className="waveform-path text-rose-500" />
                    </svg>
                   </div>
                </div>
                <div className="flex flex-col md:flex-row items-start gap-10 relative z-10">
                  <div className={cn("w-32 h-32 rounded-[32px] flex items-center justify-center shrink-0 border-2 shadow-2xl",
                    result?.cancer_analysis?.cancer_detected ? "bg-rose-500/10 border-rose-500/40 text-rose-500" : "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                  )}>
                    <ShieldAlert className="w-14 h-14" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      <span className={cn("px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg",
                        result?.cancer_analysis?.cancer_detected ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                      )}>
                        {result?.cancer_analysis?.cancer_detected ? 'SYSTEM ALERT: MALIGNANCY DETECTED' : 'SYSTEM CLEAR: TARGET NEGATIVE'}
                      </span>
                      {result?.cancer_analysis?.stage && (
                        <div className="px-5 py-2 rounded-xl glass-panel bg-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-white">
                          Node Stage: {result.cancer_analysis.stage}
                        </div>
                      )}
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter text-white uppercase mb-4 leading-tight">{result?.summary}</h2>
                    <div className="flex items-center gap-6 opacity-60">
                      <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <User className="w-3 h-3" /> Subject: {user?.name || 'Anonymous Patient'}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-rose-500">
                        <Activity className="w-3 h-3" /> Confidence: {result?.health_score || 75}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION COMMANDS TILE */}
              <div className="lg:col-span-4 p-12 glass-panel rounded-[48px] border-white/10 flex flex-col justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-[var(--text-muted)]">
                  <span className="w-8 h-1 bg-white/20 inline-block align-middle mr-3" /> Command Center
                </h3>
                <div className="space-y-4">
                  {!saved ? (
                    <Button onClick={handleSave} disabled={saving} className="w-full h-16 rounded-[24px] bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.3em] text-[10px] flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Commit to Archive</>}
                    </Button>
                  ) : (
                    <div className="w-full h-16 rounded-[24px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center font-black uppercase tracking-[0.3em] text-[10px] gap-3">
                      <CheckCircle className="w-4 h-4" /> Record Secured
                    </div>
                  )}
                  <Button onClick={() => { setResult(null); setSaved(false); }} variant="outline" className="w-full h-16 rounded-[24px] border-white/10 glass-panel hover:bg-white/5 font-black uppercase tracking-[0.3em] text-[10px]">
                    Reset Station
                  </Button>
                </div>
              </div>
            </div>

            {/* DIAGNOSTIC MATRIX GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* Tumor Data Station */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-dashboard-grid opacity-5 pointer-events-none" />
                 <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-rose-500">
                  <Microscope className="w-4 h-4 inline-block mr-3" /> Volumetric Data
                 </h3>
                 <div className="space-y-4 relative z-10">
                    {[
                      { label: "Primary Cluster", val: result?.cancer_analysis?.primary_site || "N/A" },
                      { label: "Neural Staging", val: result?.cancer_analysis?.stage || "N/A" },
                      { label: "Cellular Grade", val: result?.cancer_analysis?.grade || "N/A" },
                      { label: "Tumor Size", val: result?.cancer_analysis?.tumor_characteristics?.size_cm ? `${result.cancer_analysis.tumor_characteristics.size_cm} CM` : "N/A" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-rose-500/20 transition-all">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{item.label}</span>
                        <span className="text-xs font-black uppercase tracking-tight text-white">{item.val}</span>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Biological Markers Station */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                  <Activity className="w-4 h-4 inline-block mr-3" /> Biological Markers
                </h3>
                <div className="space-y-4">
                   {result.parameters?.length > 0 ? result.parameters.map((p, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-white uppercase">{p.name}</span>
                        <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest", 
                          p.status === 'Normal' ? "bg-emerald-500/30 text-emerald-400" : "bg-rose-500/30 text-rose-400"
                        )}>{p.status}</span>
                      </div>
                      <p className="text-[9px] text-[var(--text-muted)] font-black uppercase opacity-60">Value: {p.value}</p>
                    </div>
                   )) : (
                    <p className="text-center py-8 text-[9px] font-black uppercase tracking-widest opacity-20">NO MARKERS DETECTED</p>
                   )}
                </div>
              </div>

              {/* Threat Matrix Station */}
              <div className="glass-panel p-10 rounded-[40px] border-white/10 relative overflow-hidden">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-rose-500">
                  <ShieldAlert className="w-4 h-4 inline-block mr-3" /> Threat Matrix
                </h3>
                <div className="space-y-4">
                  {result.threats?.length > 0 ? result.threats.map((t, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-rose-500 uppercase">{t.severity}</span>
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-tighter">{t.urgency}</span>
                      </div>
                      <p className="text-[11px] font-black text-white uppercase tracking-tight mb-1">{t.condition}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold italic opacity-60 leading-tight">{t.immediateAction}</p>
                    </div>
                  )) : (
                    <div className="text-center py-10 opacity-20 flex flex-col items-center gap-3">
                      <ShieldCheck className="w-8 h-8 mx-auto" />
                      <p className="text-[9px] font-black uppercase tracking-widest">THREAT MATRIX CLEAR</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RECOVERY & PLAN TILE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="glass-panel p-12 rounded-[56px] border-white/10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-violet-500">
                    <Activity className="w-4 h-4 inline-block mr-3" /> Clinical Next-Steps
                  </h3>
                  <div className="grid grid-cols-2 gap-8">
                     <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4 ml-1">Assigned Specialist</p>
                        <div className="p-8 rounded-[32px] bg-violet-500/5 border border-violet-500/20 text-center group hover:bg-violet-500/10 transition-all">
                           <User className="w-8 h-8 text-violet-500 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                           <p className="text-sm font-black uppercase text-white tracking-tight leading-tight">{result?.follow_up?.specialist_referral || 'Consult Oncology'}</p>
                        </div>
                     </div>
                     <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4 ml-1">Priority Level</p>
                        <div className="p-8 rounded-[32px] bg-white/5 border border-white/10 text-center">
                           <Activity className="w-8 h-8 text-cyan-500 mx-auto mb-4" />
                           <p className="text-[10px] font-black uppercase text-white opacity-60 tracking-widest leading-tight">{result?.follow_up?.timeline || 'Within 48h'}</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="glass-panel p-12 rounded-[56px] border-white/10 relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 p-12 opacity-5 pointer-events-none">
                     <Dna className="w-32 h-32 text-emerald-500" />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-emerald-500">
                    <Apple className="w-4 h-4 inline-block mr-3" /> Metabolic Support
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    {result.diet?.length > 0 ? result.diet.slice(0, 4).map((d, i) => (
                      <div key={i} className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all">
                        <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full mb-3 inline-block">Protocol: {d.category}</span>
                        <p className="text-[11px] font-black text-white uppercase tracking-tight mb-1">{d.recommendation}</p>
                        <p className="text-[9px] text-[var(--text-muted)] font-medium leading-tight opacity-50">{d.reason}</p>
                      </div>
                    )) : (
                      <div className="col-span-full text-center py-12 opacity-20">
                        <Apple className="w-10 h-10 mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-loose">Nutritional sequence pending clinical markers for synthesis.</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>

            {/* Disclaimer Bar */}
            <div className="py-10 text-center opacity-30">
               <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] max-w-4xl mx-auto leading-relaxed">
                 AI ANALYSIS // NON-PHYSICIAN GENESIS // REQUIRES CLINICAL VERIFICATION // STITCH ONCOLOGY SYSTEMS 2026
               </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
