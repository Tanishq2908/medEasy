/**
 * LungCancerAnalysis.jsx
 * Model: lung_cancer_model(1).pkl  (EfficientNet-B0, PyTorch)
 * Classes (ImageFolder alphabetical): adenocarcinoma(0), large.cell.carcinoma(1), normal(2), squamous.cell.carcinoma(3)
 * Input: 224×224, Normalize([0.5,0.5,0.5],[0.5,0.5,0.5])
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Wind, Shield, Apple, CheckCircle2, Clock, Activity, ShieldCheck, TrendingUp, ShieldAlert } from 'lucide-react';
import { cn } from '../../components/Button';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { API_BASE_URL, FLASK_BASE_URL } from '../../apiConfig';

const LUNG_FRIENDLY = {
  'adenocarcinoma':          'Adenocarcinoma',
  'large.cell.carcinoma':    'Large Cell Carcinoma',
  'normal':                  'Normal',
  'squamous.cell.carcinoma': 'Squamous Cell Carcinoma',
};

const buildGroqPrompt = (modelOutput) => `You are an expert pulmonologist and oncologist.
An EfficientNet-B0 PyTorch lung CT scan model produced this classification:
${JSON.stringify(modelOutput, null, 2)}

Classification: ${modelOutput.prediction} | Raw: ${modelOutput.prediction_raw} | Risk: ${modelOutput.risk_level} | Confidence: ${(modelOutput.confidence * 100).toFixed(1)}%

Provide a clinical analysis CONSISTENT with the model's classification: "${modelOutput.prediction}".
If "Adenocarcinoma", "Large Cell Carcinoma", or "Squamous Cell Carcinoma" — treat as malignant.
If "Normal" — treat as benign.
CRITICAL RULE: If the confidence is < 60.0% (${(modelOutput.confidence * 100).toFixed(1) || 0}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary, and set the overall_verdict to "CONSULT DOCTOR".
Output strict JSON only (no markdown):
{
  "summary": "2-sentence clinical interpretation consistent with: ${modelOutput.prediction}",
  "health_score": <0-100, low if malignant>,
  "parameters": [
    {"name":"Lung Classification","value":"${modelOutput.prediction}","status":"${modelOutput.is_malignant ? 'Critical' : 'Normal'}","interpretation":"string"},
    {"name":"Malignancy Risk","value":"string","status":"${modelOutput.is_malignant ? 'Critical' : 'Normal'}","interpretation":"string"},
    {"name":"Nodule Assessment","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"},
    {"name":"Pulmonary Function Est.","value":"string","status":"Normal|Abnormal","interpretation":"string"},
    {"name":"Lymph Node Status","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"}
  ],
  "risk_assessment": {
    "cardiovascular": {"level":"Low|Moderate|High","reason":"string"},
    "metabolic": {"level":"Low|Moderate|High","reason":"string"},
    "organHealth": {"level":"${modelOutput.is_malignant ? 'High' : 'Low'}","reason":"string"}
  },
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "diet": [{"recommendation":"string","category":"string","reason":"string"}],
  "medications": [{"name":"string","dosage":"string","frequency":"string","purpose":"string"}],
  "routine": [{"time":"string","activity":"string","importance":"string"}],
  "overall_verdict": "${modelOutput.is_malignant ? 'CRITICAL' : 'STABLE'}",
  "staging_notes": "string — if malignant describe staging considerations, if normal write N/A",
  "next_steps": ["list of 3-4 urgent clinical actions"]
}`;

const VERDICT_COLOR = {
  STABLE:    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  MONITORING:'text-amber-400 border-amber-500/30 bg-amber-500/10',
  URGENT:    'text-orange-400 border-orange-500/30 bg-orange-500/10',
  CRITICAL:  'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

export default function LungCancerAnalysis({ report, token, onComplete }) {
  const [analysing,   setAnalysing]   = useState(false);
  const [analysis,    setAnalysis]    = useState(report?.aiAnalysis || null);
  const [modelOutput, setModelOutput] = useState(null);
  const [step,        setStep]        = useState('');
  const [error,       setError]       = useState(null);
  const [attempted,   setAttempted]   = useState(false);

  useEffect(() => {
    if (report && !analysis && !analysing && !attempted) {
      setAttempted(true);
      runAnalysis();
    }
  }, [report]);

  const runAnalysis = async () => {
    if (!report?.fileBase64) return;
    setAnalysing(true); setError(null);
    try {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');

      setStep('Decoding CT scan data...');
      const isPdf = report?.fileType?.includes('pdf') || report?.fileName?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        setStep('Extracting CT layers from PDF...');
        const bytes = Uint8Array.from(atob(report.fileBase64), c => c.charCodeAt(0));
        const pdf   = await pdfjs.getDocument({ data: bytes }).promise;
        const pg    = await pdf.getPage(1);
        const vp    = pg.getViewport({ scale: 2 });
        canvas.height = vp.height; canvas.width = vp.width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      } else {
        const img = await new Promise(res => {
          const i = new Image();
          i.onload = () => res(i);
          i.src = `data:${report.fileType};base64,${report.fileBase64}`;
        });
        canvas.width = img.width; canvas.height = img.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }

      const imageUrl = canvas.toDataURL('image/jpeg', 0.9);

      // ── Step 1: EfficientNet-B0 lung model via Flask
      setStep('Running EfficientNet-B0 lung cancer detection...');
      const blob     = await fetch(imageUrl).then(r => r.blob());
      const fileObj  = new File([blob], report.fileName || 'lung_ct.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', fileObj);

      const flaskRes = await fetch(`${FLASK_BASE_URL}/analyze-lung`, { method: 'POST', body: formData });
      if (!flaskRes.ok) throw new Error(`Flask lung error: ${flaskRes.status} — ${await flaskRes.text()}`);
      const flaskData = await flaskRes.json();
      if (flaskData.error) throw new Error(flaskData.error);
      setModelOutput(flaskData);

      // ── Step 2: Neural clinical narrative
      setStep('Generating oncology clinical report...');
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: buildGroqPrompt(flaskData) }]
        })
      });
      const groqData = await groqRes.json();
      if (groqData.error) throw new Error(groqData.error.message);
      const parsed = JSON.parse(groqData.choices[0].message.content);
      setAnalysis(parsed);

      setStep('Archiving to record...');
      if (token) {
        await fetch(`${API_BASE_URL}/api/lab-reports/${report._id}/analysis`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ analysis: parsed })
        }).catch(() => {});
      }
      if (onComplete) onComplete(parsed);
    } catch (e) {
      setError('Lung Analysis failed: ' + e.message);
    } finally {
      setAnalysing(false); setStep('');
    }
  };

  const isMalignant  = modelOutput?.is_malignant;
  const accentColor  = isMalignant ? '#ef4444' : '#8b5cf6';

  const riskData = analysis?.risk_assessment ? [
    { name: 'Lung',      value: analysis.risk_assessment.organHealth?.level === 'High' ? 90 : analysis.risk_assessment.organHealth?.level === 'Moderate' ? 55 : 20 },
    { name: 'Metabolic', value: analysis.risk_assessment.metabolic?.level === 'High' ? 85 : analysis.risk_assessment.metabolic?.level === 'Moderate' ? 55 : 25 },
    { name: 'Cardio',    value: analysis.risk_assessment.cardiovascular?.level === 'High' ? 85 : analysis.risk_assessment.cardiovascular?.level === 'Moderate' ? 55 : 25 },
  ] : [];

  const confidencePie = modelOutput ? [
    { name: 'Confidence',   value: Math.round(modelOutput.confidence * 100) },
    { name: 'Uncertainty',  value: 100 - Math.round(modelOutput.confidence * 100) },
  ] : [];

  if (analysing) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
        <Wind className="w-8 h-8 text-violet-500 absolute inset-0 m-auto" />
      </div>
      <div className="text-center">
        <p className="text-lg font-black uppercase tracking-tighter text-[var(--text-main)] mb-2">Lung CT Analysis</p>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 animate-pulse">{step}</p>
        {modelOutput && (
          <div className={cn('mt-4 px-6 py-3 rounded-2xl border', isMalignant ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20')}>
            <p className={cn('text-[10px] font-black uppercase tracking-widest', isMalignant ? 'text-rose-400' : 'text-emerald-400')}>
              {modelOutput.prediction}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 rounded-[24px] bg-violet-500/10 border border-violet-500/20 flex items-center gap-4">
      <AlertTriangle className="w-6 h-6 text-violet-400 shrink-0" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">Lung Analysis Error</p>
        <p className="text-sm text-violet-400/70">{error}</p>
      </div>
      <button onClick={() => { setError(null); setAttempted(false); }}
        className="ml-auto px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/30 transition-all">
        Retry
      </button>
    </div>
  );

  if (!analysis) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* Hero */}
        <div className={cn('p-8 rounded-[32px] border flex items-center gap-6 backdrop-blur-3xl shadow-xl relative overflow-hidden',
          isMalignant ? 'bg-[var(--glass-bg)] border-rose-500/30' : 'bg-[var(--glass-bg)] border-violet-500/20')}>
          <div className="absolute inset-0 bg-current opacity-5 pointer-events-none" />
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center font-black text-2xl text-white shadow-xl shrink-0"
               style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` }}>
            {analysis.health_score}
          </div>
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={cn('px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border', VERDICT_COLOR[analysis.overall_verdict] || VERDICT_COLOR.STABLE)}>
                {analysis.overall_verdict}
              </span>
              {modelOutput && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border"
                      style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}15`, color: accentColor }}>
                  {modelOutput.prediction}
                </span>
              )}
              {isMalignant && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-500/30 bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-500/20">
                  ⚠ MALIGNANCY DETECTED
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] leading-snug">{analysis.summary}</p>
          </div>
        </div>

        {/* Three column */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modelOutput && (
            <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 flex items-center gap-2">
                <Activity className="w-4 h-4" /> EfficientNet-B0 Output
              </h3>
              <div className={cn('p-4 rounded-[16px] border bg-[var(--input-bg)]', isMalignant ? 'border-rose-500/20' : 'border-emerald-500/20')}>
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] mb-1">Classification</p>
                <p className={cn('text-base font-black uppercase', isMalignant ? 'text-rose-400' : 'text-emerald-400')}>{modelOutput.prediction}</p>
              </div>

              <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">{modelOutput.reasoning}</p>
            </div>
          )}

          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Risk Profile
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer>
                <RadarChart data={riskData}>
                  <PolarGrid stroke="var(--glass-border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
                  <Radar dataKey="value" stroke={accentColor} fill={accentColor} fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)] flex flex-col items-center justify-center">
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Model certainty</p>
          </div>
        </div>

          <div className="glass-panel p-8 rounded-[32px] border-[var(--border-subtle)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Pulmonological Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.parameters.map((p, i) => (
                <div key={i} className="p-4 rounded-[16px] bg-[var(--input-bg)] border border-[var(--border-subtle)] flex justify-between items-center group hover:bg-[var(--bg-main)]/50 transition-all">
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{p.name}</p>
                    <p className="text-xs font-black text-violet-400">{p.value}</p>
                    {p.interpretation && <p className="text-[9px] text-[var(--text-muted)] mt-0.5 group-hover:text-[var(--text-main)] transition-colors">{p.interpretation}</p>}
                  </div>
                  <span className={cn('text-[8px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ml-3',
                    p.status === 'Normal' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'Critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                  )}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>

        {analysis.staging_notes && analysis.staging_notes !== 'N/A' && (
          <div className={cn('glass-panel p-6 rounded-[28px] border', isMalignant ? 'border-rose-500/20 bg-rose-500/[0.03]' : 'border-[var(--border-subtle)]')}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Staging Assessment
            </h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{analysis.staging_notes}</p>
          </div>
        )}

        {analysis.next_steps?.length > 0 && (
          <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Immediate Next Steps
            </h3>
            <div className="space-y-2">
              {analysis.next_steps.map((s, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-[14px] bg-rose-500/5 border border-rose-500/10">
                  <span className="text-rose-500 font-black shrink-0">{i + 1}.</span>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase">{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diet + Routine */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.diet?.length > 0 && (
            <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-4 flex items-center gap-2">
                <Apple className="w-4 h-4" /> Nutritional Support
              </h3>
              <div className="space-y-3">
                {analysis.diet.slice(0, 4).map((d, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-[14px] bg-emerald-500/5 border border-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{d.recommendation}</p>
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{d.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.routine?.length > 0 && (
            <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Routine Protocol
              </h3>
              <div className="space-y-3">
                {analysis.routine.map((r, i) => (
                  <div key={i} className="flex gap-4 p-3 rounded-[14px] bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] font-black text-amber-400 uppercase w-16 shrink-0">{r.time}</p>
                    <div>
                      <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{r.activity}</p>
                      {r.importance && <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{r.importance}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-[24px] border border-[var(--border-subtle)] flex items-center gap-4 opacity-40">
          <ShieldCheck className="w-6 h-6 text-violet-500 shrink-0" />
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
            Powered by lung_cancer_model.pkl (EfficientNet-B0, 224×224) → Neural Llama-4 Scout. Consult a certified oncologist before any treatment decisions.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
