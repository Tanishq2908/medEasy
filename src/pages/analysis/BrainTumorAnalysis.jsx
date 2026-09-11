/**
 * BrainTumorAnalysis.jsx
 * Model: model.pkl  (Keras Xception)
 * Classes (tr_gen.class_indices alphabetical): glioma(0), meningioma(1), notumor(2), pituitary(3)
 * Input: 299×299, rescale=1/255
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Brain, Shield, Apple, CheckCircle2, Clock, Activity, ShieldCheck, TrendingUp, Zap, User } from 'lucide-react';
import { cn } from '../../components/Button';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { API_BASE_URL, FLASK_BASE_URL } from '../../apiConfig';

const TUMOR_COLOR = {
  'Glioma Tumor':         '#ef4444',
  'Meningioma Tumor':     '#f59e0b',
  'Pituitary Tumor':      '#8b5cf6',
  'No Tumor Detected':    '#10b981',
};

const buildGroqPrompt = (modelOutput) => `You are an expert neurosurgeon.
A Keras Xception brain MRI classifier produced:
${JSON.stringify(modelOutput, null, 2)}

Classification: ${modelOutput.prediction} | Raw: ${modelOutput.prediction_raw} | Tumor: ${modelOutput.has_tumor} | Risk: ${modelOutput.risk_level}

Provide a clinical analysis STRICTLY CONSISTENT with classification: "${modelOutput.prediction}".
CRITICAL RULE: If the confidence is < 60.0% (${(modelOutput.confidence * 100).toFixed(1) || 0}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary, and set the overall_verdict to "CONSULT DOCTOR".
Output strict JSON only (no markdown):
{
  "summary": "2-sentence MRI interpretation consistent with: ${modelOutput.prediction}",
  "health_score": <0-100, very low if Glioma, moderate if Meningioma/Pituitary, high if No Tumor>,
  "parameters": [
    {"name":"Tumor Classification","value":"${modelOutput.prediction}","status":"${modelOutput.has_tumor ? 'Critical' : 'Normal'}","interpretation":"string"},
    {"name":"Tumor Grade Estimate","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"},
    {"name":"Intracranial Pressure Risk","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"},
    {"name":"Neurological Status","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"},
    {"name":"Surgical Candidacy","value":"string","status":"Normal|Abnormal","interpretation":"string"}
  ],
  "risk_assessment": {
    "cardiovascular": {"level":"Low|Moderate|High","reason":"string"},
    "metabolic": {"level":"Low|Moderate|High","reason":"string"},
    "organHealth": {"level":"${modelOutput.has_tumor ? 'High' : 'Low'}","reason":"string"}
  },
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "diet": [{"recommendation":"string","category":"string","reason":"string"}],
  "medications": [{"name":"string","dosage":"string","frequency":"string","purpose":"string"}],
  "routine": [{"time":"string","activity":"string","importance":"string"}],
  "overall_verdict": "${modelOutput.prediction_raw === 'glioma' ? 'CRITICAL' : modelOutput.has_tumor ? 'URGENT' : 'STABLE'}",
  "tumor_details": {
    "type": "${modelOutput.prediction}",
    "location_estimate": "string",
    "prognosis": "string",
    "surgical_approach": "string or N/A if no tumor"
  },
  "specialist_team": ["list of specialists needed"]
}`;

const VERDICT_COLOR = {
  STABLE:    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  MONITORING:'text-amber-400 border-amber-500/30 bg-amber-500/10',
  URGENT:    'text-orange-400 border-orange-500/30 bg-orange-500/10',
  CRITICAL:  'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

export default function BrainTumorAnalysis({ report, token, onComplete }) {
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

      setStep('Decoding MRI scan...');
      const isPdf = report?.fileType?.includes('pdf') || report?.fileName?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        setStep('Extracting MRI from PDF...');
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

      // ── Step 1: Keras Xception brain model via Flask
      setStep('Running Xception brain tumor classifier (299×299)...');
      const blob     = await fetch(imageUrl).then(r => r.blob());
      const fileObj  = new File([blob], report.fileName || 'brain_mri.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', fileObj);

      const flaskRes = await fetch(`${FLASK_BASE_URL}/analyze-brain`, { method: 'POST', body: formData });
      if (!flaskRes.ok) throw new Error(`Flask brain error: ${flaskRes.status} — ${await flaskRes.text()}`);
      const flaskData = await flaskRes.json();
      if (flaskData.error) throw new Error(flaskData.error);
      setModelOutput(flaskData);

      // ── Step 2: Neural clinical narrative
      setStep('Generating neurosurgical analysis...');
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
      setError('Brain MRI Analysis failed: ' + e.message);
    } finally {
      setAnalysing(false); setStep('');
    }
  };

  const hasTumor   = modelOutput?.has_tumor;
  const tumorColor = TUMOR_COLOR[modelOutput?.prediction] || '#8b5cf6';

  const riskData = analysis?.risk_assessment ? [
    { name: 'Brain',     value: analysis.risk_assessment.organHealth?.level === 'High' ? 90 : analysis.risk_assessment.organHealth?.level === 'Moderate' ? 55 : 20 },
    { name: 'Metabolic', value: analysis.risk_assessment.metabolic?.level === 'High' ? 85 : analysis.risk_assessment.metabolic?.level === 'Moderate' ? 55 : 25 },
    { name: 'Cardio',    value: analysis.risk_assessment.cardiovascular?.level === 'High' ? 85 : analysis.risk_assessment.cardiovascular?.level === 'Moderate' ? 55 : 25 },
  ] : [];

  const confidencePie = modelOutput ? [
    { name: 'Confidence',  value: Math.round(modelOutput.confidence * 100) },
    { name: 'Uncertainty', value: 100 - Math.round(modelOutput.confidence * 100) },
  ] : [];

  if (analysing) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
        <Brain className="w-8 h-8 text-emerald-500 absolute inset-0 m-auto" />
      </div>
      <div className="text-center">
        <p className="text-lg font-black uppercase tracking-tighter text-[var(--text-main)] mb-2">Brain MRI Analysis</p>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 animate-pulse">{step}</p>
        {modelOutput && (
          <div className="mt-4 px-6 py-3 rounded-2xl border" style={{ backgroundColor: `${TUMOR_COLOR[modelOutput.prediction] || '#8b5cf6'}15`, borderColor: `${TUMOR_COLOR[modelOutput.prediction] || '#8b5cf6'}40` }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: TUMOR_COLOR[modelOutput.prediction] || '#8b5cf6' }}>
              {modelOutput.prediction}
            </p>
            <p className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Conf: {(modelOutput.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 rounded-[24px] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4">
      <AlertTriangle className="w-6 h-6 text-emerald-400 shrink-0" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Brain Analysis Error</p>
        <p className="text-sm text-emerald-400/70">{error}</p>
      </div>
      <button onClick={() => { setError(null); setAttempted(false); }}
        className="ml-auto px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all">
        Retry
      </button>
    </div>
  );

  if (!analysis) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* Hero */}
        <div className="p-8 rounded-[32px] border flex items-center gap-6 backdrop-blur-3xl shadow-xl relative overflow-hidden"
             style={{ backgroundColor: `var(--glass-bg)`, borderColor: `${tumorColor}30` }}>
          <div className="absolute inset-0 bg-current opacity-5 pointer-events-none" />
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center font-black text-2xl text-white shadow-xl shrink-0"
               style={{ background: `linear-gradient(135deg, ${tumorColor}, ${tumorColor}88)` }}>
            {analysis.health_score}
          </div>
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={cn('px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border', VERDICT_COLOR[analysis.overall_verdict] || VERDICT_COLOR.STABLE)}>
                {analysis.overall_verdict}
              </span>
              {modelOutput && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border"
                      style={{ borderColor: `${tumorColor}40`, backgroundColor: `${tumorColor}15`, color: tumorColor }}>
                  {modelOutput.prediction} · {(modelOutput.confidence * 100).toFixed(1)}%
                </span>
              )}
              {hasTumor && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-500/30 bg-rose-600/90 text-white animate-pulse flex items-center gap-1 shadow-lg shadow-rose-500/20">
                  <Zap className="w-3 h-3" /> TUMOR DETECTED
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] leading-snug">{analysis.summary}</p>
          </div>
        </div>

        {/* 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modelOutput && (
            <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: tumorColor }}>
                <Brain className="w-4 h-4" /> Xception Output
              </h3>
              <div className="p-4 rounded-[16px] border bg-[var(--input-bg)]" style={{ borderColor: `${tumorColor}30` }}>
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] mb-1">Tumor Type</p>
                <p className="text-sm font-black uppercase" style={{ color: tumorColor }}>{modelOutput.prediction}</p>
              </div>
              {/* All-class confidence bars */}
              {modelOutput.all_confidences && (
                <div className="space-y-2">
                  {Object.entries(modelOutput.all_confidences).map(([cls, pct]) => (
                    <div key={cls}>
                      <div className="flex justify-between mb-0.5">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase truncate max-w-[100px]">{cls}</p>
                        <p className="text-[8px] font-black text-[var(--text-muted)]">{pct}%</p>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--bg-main)]/50">
                        <div className="h-full rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ width: `${pct}%`, backgroundColor: tumorColor }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-[12px] bg-[var(--bg-main)]/50 border border-[var(--glass-border)] text-center">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Risk</p>
                  <p className="text-xs font-black text-[var(--text-main)] uppercase">{modelOutput.risk_level}</p>
                </div>
                <div className="p-3 rounded-[12px] bg-[var(--bg-main)]/50 border border-[var(--glass-border)] text-center">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Tumor</p>
                  <p className={cn('text-xs font-black uppercase', hasTumor ? 'text-rose-400' : 'text-emerald-400')}>{hasTumor ? 'YES' : 'NONE'}</p>
                </div>
              </div>
              <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">{modelOutput.reasoning}</p>
            </div>
          )}

          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2" style={{ color: tumorColor }}>
              <Shield className="w-4 h-4" /> Neural Risk Profile
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer>
                <RadarChart data={riskData}>
                  <PolarGrid stroke="var(--glass-border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
                  <Radar dataKey="value" stroke={tumorColor} fill={tumorColor} fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg flex flex-col items-center justify-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 self-start" style={{ color: tumorColor }}>Model Confidence</h3>
            <div className="h-[120px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={confidencePie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} startAngle={90} endAngle={-270} dataKey="value">
                    <Cell fill={tumorColor} />
                    <Cell fill="var(--glass-border)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-2xl font-black" style={{ color: tumorColor }}>{(modelOutput?.confidence * 100 || 0).toFixed(0)}%</p>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Certainty</p>
          </div>
        </div>

        {/* Tumor Details */}
        {analysis.tumor_details && hasTumor && (
          <div className="bg-[var(--glass-bg)] p-8 rounded-[32px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-xl" style={{ borderColor: `${tumorColor}30` }}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2" style={{ color: tumorColor }}>
              <Brain className="w-4 h-4" /> Tumor Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Type', val: analysis.tumor_details.type },
                { label: 'Location', val: analysis.tumor_details.location_estimate },
                { label: 'Prognosis', val: analysis.tumor_details.prognosis },
                { label: 'Surgical Approach', val: analysis.tumor_details.surgical_approach },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-[16px] bg-[var(--input-bg)] border border-[var(--glass-border)] group hover:bg-[var(--bg-main)]/50 transition-all">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-[10px] font-black text-[var(--text-main)] uppercase leading-tight group-hover:text-white transition-colors">{item.val || 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parameters */}
        {analysis.parameters?.length > 0 && (
          <div className="bg-[var(--glass-bg)] p-8 rounded-[32px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2" style={{ color: tumorColor }}>
              <TrendingUp className="w-4 h-4" /> Neurological Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.parameters.map((p, i) => (
                <div key={i} className="p-4 rounded-[16px] bg-[var(--input-bg)] border border-[var(--glass-border)] flex justify-between items-center group hover:bg-[var(--bg-main)]/50 transition-all">
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{p.name}</p>
                    <p className="text-xs font-black" style={{ color: tumorColor }}>{p.value}</p>
                    {p.interpretation && <p className="text-[9px] text-[var(--text-muted)] mt-0.5 group-hover:text-[var(--text-main)] transition-colors">{p.interpretation}</p>}
                  </div>
                  <span className={cn('text-[8px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ml-3 shadow-sm',
                    p.status === 'Normal' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'Critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                  )}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Specialist Team */}
        {analysis.specialist_team?.length > 0 && (
          <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2" style={{ color: tumorColor }}>
              <User className="w-4 h-4" /> Specialist Team Required
            </h3>
            <div className="flex flex-wrap gap-3">
              {analysis.specialist_team.map((s, i) => (
                <span key={i} className="px-4 py-2 rounded-[12px] text-[10px] font-black uppercase tracking-wider border"
                      style={{ borderColor: `${tumorColor}30`, backgroundColor: `${tumorColor}10`, color: tumorColor }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Threats + Diet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.threats?.length > 0 && (
            <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Neurological Alerts
              </h3>
              <div className="space-y-3">
                {analysis.threats.map((t, i) => (
                  <div key={i} className="p-3 rounded-[14px] bg-rose-500/5 border border-rose-500/10">
                    <p className="text-[9px] font-black text-rose-400 uppercase mb-1">{t.level} — {t.condition}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{t.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.diet?.length > 0 && (
            <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-4 flex items-center gap-2">
                <Apple className="w-4 h-4" /> Neuro-Nutrition
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
        </div>

        <div className="p-6 rounded-[24px] border border-[var(--border-subtle)] flex items-center gap-4 opacity-40">
          <ShieldCheck className="w-6 h-6 shrink-0" style={{ color: tumorColor }} />
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
            Powered by model.pkl (Keras Xception, 299×299) → Neural Llama-4 Scout. Screening tool only — all findings must be verified by a certified neurosurgeon.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
