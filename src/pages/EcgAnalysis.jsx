import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Activity, ArrowLeft, Loader2, Heart, HeartPulse, ShieldAlert, CheckCircle2, Lock, ShieldCheck, ArrowRight, Siren } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, FLASK_BASE_URL } from '../apiConfig';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

// --- PRIVACY REINFORCEMENT ENGINE ---
const redactImageHeader = (canvas) => {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.15); 
  return canvas.toDataURL('image/jpeg', 0.8);
};

export default function EcgAnalysis() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [privacyStep, setPrivacyStep] = useState('');

  React.useEffect(() => {
    if (result && !saved && !saving) handleSave();
  }, [result]);

  const handleSave = async () => {
    if (!token || !result || saved) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/patient-diagnosis/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: JSON.stringify({
          type: 'ecg',
          title: `ECG Analysis - ${user?.name || 'Patient'}`,
          fileName: file ? file.name : '',
          summary: result.prediction + " detected. " + (result.reasoning || ""),
          parameters: [{ name: "ECG Rhythm", value: result.prediction, status: result.risk_level === 'High' ? 'Critical' : result.risk_level === 'Moderate' ? 'Abnormal' : 'Normal', interpretation: result.reasoning || "Analyzed by AI" }],
          threats: result.risk_level !== 'Low' ? [{ severity: result.risk_level === 'High' ? 'CRITICAL' : 'MODERATE', condition: result.prediction, description: "Arrhythmia or Infarction detected", immediateAction: "Consult cardiologist" }] : [],
          overallScore: result.risk_level === 'High' ? 40 : result.risk_level === 'Moderate' ? 65 : 95
        })
      });
      if (res.ok) setSaved(true);
    } catch (err) { console.error("Save error:", err); }
    finally { setSaving(false); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); setSaved(false); }
  };

  const analyzeEcg = async () => {
    if (!file) { setError("Diagnostic source missing."); return; }
    setAnalyzing(true); setError(null);
    setPrivacyStep('Initializing Neural Privacy Tunnel...');

    try {
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      let finalImgForAI = '';

      // 1. EXTRACTION
      if (file.type === 'application/pdf') {
        const ab = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 2 });
        canvas.height = vp.height; canvas.width = vp.width;
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      } else {
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

      setPrivacyStep('Masking Patient Identifiers...');
      finalImgForAI = redactImageHeader(canvas);

      setPrivacyStep('Model Inference Staging...');
      const blob = await (await fetch(finalImgForAI)).blob();
      const maskedFile = new File([blob], "masked_ecg.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append('image', maskedFile);

      let data;
      try {
        setPrivacyStep('Running Signal Processing Engine...');
        const response = await fetch(`${FLASK_BASE_URL}/analyze-ecg-signal`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error(`ECG engines failed: ${response.statusText}`);
        data = await response.json();
        if (data.error) throw new Error(data.error);
      } catch (err) { throw err; }
      setResult(data);
    } catch (err) { setError("Analysis failed: " + err.message); }
    finally { setAnalyzing(false); setPrivacyStep(''); }
  };

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-5xl mx-auto w-full relative z-10 bg-mesh min-h-screen">
      
      <div className="fixed inset-0 bg-transparent -z-10" />
      <div className="blob w-[900px] h-[900px] bg-rose-500/5 -top-40 -left-60 blur-[150px]" />
      <div className="blob w-[900px] h-[900px] bg-cyan-500/5 -bottom-40 -right-60 blur-[150px]" />

      {/* Header */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center justify-between mb-12 gap-6 flex-wrap relative z-20">
        <Button variant="outline" className="flex items-center gap-3 h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-white/10 glass-panel group" onClick={() => navigate('/patient-dashboard')}>
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Diagnostic Hub
        </Button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]">
            <Lock className="w-6 h-6 text-rose-500" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="input" variants={fadeInUp} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0.95 }} className="space-y-10">
            <div className="glass-panel p-1 bg-gradient-to-br from-white/10 to-transparent rounded-[56px]">
              <div className="glass-panel p-20 rounded-[54px] border-none flex flex-col items-center text-center gap-10 hover:bg-white/[0.04] transition-all group relative overflow-hidden backdrop-blur-3xl shrink-0">
                <div className="absolute inset-0 bg-dashboard-grid opacity-10 pointer-events-none" />
                <div className="scanning-line" />
                
                <div className="w-32 h-32 rounded-[40px] bg-[#020617] border-2 border-rose-500/30 flex items-center justify-center text-rose-500 shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-700">
                  <HeartPulse className="w-12 h-12" />
                </div>

                <div className="max-w-2xl relative z-10">
                  <h2 className="text-5xl font-black tracking-tighter mb-4 text-gradient bg-gradient-to-r from-white to-white/40 uppercase">ECG Spectral Scan</h2>
                  <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] opacity-40 leading-relaxed mx-auto max-w-md">Initialize high-frequency waveform analysis with privacy-first anonymization.</p>
                </div>

                <div className="w-full max-w-xl flex flex-col gap-6 relative z-10">
                  <label className="relative block cursor-pointer group/label">
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0" accept="image/*,application/pdf" onChange={handleFileChange} />
                    <div className="glass-panel p-6 rounded-[28px] border-white/10 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all text-center">
                       <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-muted)] group-hover/label:text-rose-400">
                        {file ? `// SYNCED: ${file.name}` : "Mount ECG Sensor"}
                      </span>
                    </div>
                  </label>

                  <Button size="lg" className="h-24 rounded-[30px] font-black uppercase tracking-[0.4em] text-xs button-premium bg-rose-600 shadow-[0_0_50px_-10px_rgba(244,63,94,0.4)] border-none relative overflow-hidden group/btn" 
                    disabled={!file || analyzing} onClick={analyzeEcg}>
                    <span className="relative z-10 flex flex-col items-center gap-2">
                       {analyzing ? (
                         <>
                           <div className="flex items-center gap-4">
                             <Loader2 className="w-5 h-5 animate-spin" />
                             <span>Neural Pulse Engaged</span>
                           </div>
                           <span className="text-[8px] opacity-60 tracking-[0.2em]">{privacyStep}</span>
                         </>
                       ) : (
                         <span className="flex items-center gap-4">Initialize Model Inference <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" /></span>
                       )}
                    </span>
                  </Button>
                </div>
                {error && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 px-8 py-4 rounded-2xl border border-rose-500/20 relative z-10">{error}</p>}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 mb-20">
            
            {/* ALERT COMMAND BAR */}
            <div className={cn("p-12 rounded-[48px] border-2 relative overflow-hidden glass-panel",
              result.risk_level === 'Low' ? "bg-emerald-500/10 border-emerald-500" : "bg-rose-500/10 border-rose-500"
            )}>
              <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">
                <div className={cn("w-32 h-32 rounded-[40px] flex items-center justify-center shrink-0 border-2 shadow-2xl relative",
                   result.risk_level === 'Low' ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" : "bg-rose-500/20 border-rose-500 text-rose-500"
                )}>
                  <Activity className="w-16 h-16" />
                  {result.risk_level !== 'Low' && <div className="absolute inset-0 bg-red-500/20 animate-ping rounded-full" />}
                </div>
                <div className="flex-grow">
                   <div className="flex items-center gap-4 mb-4">
                      <span className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg",
                        result.risk_level === 'Low' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      )}>
                        {result.prediction} // {result.risk_level} Risk
                      </span>
                      <span className="px-6 py-2 rounded-xl glass-panel bg-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-white">
                        Confidence: {(Number(result.confidence) * 100).toFixed(1)}%
                      </span>
                   </div>
                   <h2 className="text-4xl font-black tracking-tighter text-white uppercase leading-tight mb-4">Diagnostic Assessment Protocol</h2>
                   <div className="flex items-center gap-6 opacity-60">
                      <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <HeartPulse className="w-3 h-3" /> Rhythm Analysis Complete
                      </div>
                   </div>
                </div>
                <div className="shrink-0 flex gap-4">
                   {!saved ? (
                     <Button onClick={handleSave} disabled={saving} className="h-16 rounded-2xl bg-emerald-600 font-black uppercase tracking-[0.2em] text-[10px] px-10">
                       {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Commit to Archive'}
                     </Button>
                   ) : (
                     <div className="h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center px-10 font-black uppercase tracking-[0.2em] text-[10px] gap-3">
                       <CheckCircle2 className="w-4 h-4" /> SECURED
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* REASONING CARD */}
            <div className="glass-panel p-12 rounded-[56px] border-white/10 relative overflow-hidden backdrop-blur-3xl">
               <div className="absolute inset-0 bg-dashboard-grid opacity-5 pointer-events-none" />
               <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-cyan-500">
                  <Siren className="w-4 h-4 inline-block mr-3" /> Clinical Reasoning Sequence
               </h3>
               <p className="text-xl font-black text-white uppercase tracking-tighter leading-relaxed">
                  {result.reasoning}
               </p>
            </div>

            {/* RECOMMENDATIONS */}
            <div className="glass-panel p-12 rounded-[56px] border-white/10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-emerald-500">
                <CheckCircle2 className="w-4 h-4 inline-block mr-3" /> Mandatory Protocols
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.recommendations?.map((item, i) => (
                  <div key={i} className="flex gap-5 p-6 rounded-[32px] bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all">
                    <div className="w-10 h-10 rounded-2xl bg-[#020617] border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                    <span className="text-[11px] font-black text-white uppercase tracking-widest leading-relaxed mt-1">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pt-8">
              <Button onClick={() => { setResult(null); setSaved(false); }} variant="outline" className="h-16 px-12 rounded-[24px] border-white/10 glass-panel font-black uppercase tracking-[0.3em] text-[10px]">
                Reset Diagnostic Array
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
