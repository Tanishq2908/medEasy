/**
 * EcgAnalysis.jsx
 * Pipeline: Image/PDF → pdfjs render → Flask /analyze-ecg (ecg_model.pkl MaxViT) → Groq narrative → JSON result
 * Used for: ECG Report test type
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, HeartPulse, AlertTriangle, Activity, Shield, Apple, CheckCircle2, Clock, TrendingUp, ShieldCheck } from 'lucide-react';
import { cn } from '../../components/Button';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { API_BASE_URL, FLASK_BASE_URL } from '../../apiConfig';

const buildGroqPrompt = (modelOutput) => `You are an expert cardiologist AI. 
A PyTorch ECG vision model (MaxViT) analyzed the ECG and produced this output:
${JSON.stringify(modelOutput, null, 2)}

The model classification "${modelOutput.prediction}" with confidence ${(modelOutput.confidence * 100).toFixed(1)}% is GROUND TRUTH. Build a clinical report CONSISTENT with this classification.
CRITICAL RULE: If the confidence is < 60.0%, you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary, and set the overall_verdict to "CONSULT DOCTOR".

Based on this ML classification, provide a comprehensive clinical ECG analysis as strict JSON (no markdown):
{
  "summary": "2-sentence clinical interpretation",
  "health_score": 0-100,
  "parameters": [
    {"name":"Heart Rhythm","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"},
    {"name":"Classification","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"},
    {"name":"Confidence Score","value":"string","status":"Normal","interpretation":"string"},
    {"name":"Risk Category","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"}
  ],
  "risk_assessment": {
    "cardiovascular": {"level":"Low|Moderate|High","reason":"string"},
    "metabolic": {"level":"Low|Moderate|High","reason":"string"},
    "organHealth": {"level":"Low|Moderate|High","reason":"string"}
  },
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "diet": [{"recommendation":"string","category":"string","reason":"string"}],
  "medications": [{"name":"string","dosage":"string","frequency":"string","purpose":"string"}],
  "routine": [{"time":"string","activity":"string","importance":"string"}],
  "overall_verdict": "STABLE|MONITORING|URGENT|CRITICAL|CONSULT DOCTOR",
  "clinical_notes": "Detailed interpretation of the ECG findings"
}`;

const VERDICT_COLOR = {
  STABLE: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  MONITORING: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  URGENT: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  CRITICAL: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

// Mock ECG waveform for visualization
const generateEcgWave = () => {
  const points = [];
  for (let i = 0; i < 60; i++) {
    let y = 50;
    if (i === 10) y = 48;
    else if (i === 11) y = 20;
    else if (i === 12) y = 55;
    else if (i === 13) y = 35;
    else if (i === 14) y = 50;
    else if (i === 18) y = 45;
    else if (i === 19) y = 55;
    else if (i === 35) y = 48;
    else if (i === 36) y = 20;
    else if (i === 37) y = 55;
    else if (i === 38) y = 35;
    else if (i === 39) y = 50;
    points.push({ t: i, v: y });
  }
  return points;
};

export default function EcgAnalysis({ report, token, onComplete }) {
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState(report?.aiAnalysis || null);
  const [modelOutput, setModelOutput] = useState(null);
  const [step, setStep] = useState('');
  const [error, setError] = useState(null);
  const [attempted, setAttempted] = useState(false);

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
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      let finalFileType = report.fileType;

      setStep('Decoding ECG data...');
      const isPdf = report?.fileType?.includes('pdf') || report?.fileName?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        setStep('Extracting ECG from PDF...');
        const bytes = Uint8Array.from(atob(report.fileBase64), c => c.charCodeAt(0));
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 2 });
        canvas.height = vp.height; canvas.width = vp.width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        finalFileType = 'image/jpeg';
      } else {
        setStep('Loading ECG image...');
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

      const imageUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Step 1: Flask ECG model
      setStep('Running MaxViT ECG neural engine...');
      const blob = await fetch(imageUrl).then(r => r.blob());
      const fileObj = new File([blob], report.fileName || 'ecg.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', fileObj);

      let flaskData;
      try {
        const flaskRes = await fetch(`${FLASK_BASE_URL}/analyze-ecg-signal`, { method: 'POST', body: formData });
        if (!flaskRes.ok) throw new Error(`ECG Signal Processing Engine Error: ${flaskRes.status}`);
        flaskData = await flaskRes.json();
        if (flaskData.error) throw new Error(flaskData.error);
      } catch (err) {
        throw err;
      }
      setModelOutput(flaskData);

      // Step 2: Groq for detailed clinical narrative
      setStep('Generating detailed clinical analysis via Neural Engine...');
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

      // Save
      setStep('Committing to archive...');
      if (token) {
        await fetch(`${API_BASE_URL}/api/lab-reports/${report._id}/analysis`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ analysis: parsed })
        });
      }
      if (onComplete) onComplete(parsed);
    } catch (e) { setError('ECG Analysis failed: ' + e.message); }
    finally { setAnalysing(false); setStep(''); }
  };

  const ecgWaveData = generateEcgWave();
  const riskData = analysis?.risk_assessment ? [
    { name: 'Cardiac', value: analysis.risk_assessment.cardiovascular?.level === 'High' ? 90 : analysis.risk_assessment.cardiovascular?.level === 'Moderate' ? 55 : 20 },
    { name: 'Metabolic', value: analysis.risk_assessment.metabolic?.level === 'High' ? 85 : analysis.risk_assessment.metabolic?.level === 'Moderate' ? 55 : 25 },
    { name: 'Organ', value: analysis.risk_assessment.organHealth?.level === 'High' ? 85 : analysis.risk_assessment.organHealth?.level === 'Moderate' ? 55 : 25 },
  ] : [];

  if (analysing) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin" />
        <HeartPulse className="w-8 h-8 text-rose-500 absolute inset-0 m-auto animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-lg font-black uppercase tracking-tighter text-[var(--text-main)] mb-2">ECG Neural Analysis</p>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 animate-pulse">{step}</p>
        {modelOutput && (
          <div className="mt-4 px-6 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Model Output: {modelOutput.prediction}</p>
            <p className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Confidence: {(modelOutput.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 rounded-[24px] bg-rose-500/10 border border-rose-500/20 flex items-center gap-4">
      <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">ECG Analysis Error</p>
        <p className="text-sm text-rose-400/70">{error}</p>
      </div>
      <button onClick={() => { setError(null); setAttempted(false); }} className="ml-auto px-4 py-2 rounded-xl bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/30 transition-all">Retry</button>
    </div>
  );

  if (!analysis) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Hero */}
        <div className="p-8 rounded-[32px] bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center gap-6 backdrop-blur-3xl shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-rose-500/5 -z-10" />
          <div className={cn('w-16 h-16 rounded-[20px] flex items-center justify-center font-black text-2xl text-white shadow-xl shrink-0',
            analysis.overall_verdict === 'STABLE' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30' :
            analysis.overall_verdict === 'CRITICAL' ? 'bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-500/30' :
            'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
          )}>
            {analysis.health_score}
          </div>
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={cn('px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border', VERDICT_COLOR[analysis.overall_verdict] || VERDICT_COLOR.STABLE)}>
                {analysis.overall_verdict || 'STABLE'}
              </span>
              {modelOutput && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-500/20 bg-rose-500/10 text-rose-400">
                  MaxViT: {(modelOutput.confidence * 100).toFixed(1)}% confidence
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] leading-snug">{analysis.summary}</p>
          </div>
        </div>

        {/* ECG Waveform Visualization */}
        <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> ECG Waveform Trace</h3>
          <div className="h-[120px]">
            <ResponsiveContainer>
              <LineChart data={ecgWaveData}>
                <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2} dot={false} animationDuration={1500} />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model output + Risk Chart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modelOutput && (
            <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Model Classification</h3>
              <div className="p-4 rounded-[16px] bg-[var(--input-bg)] border border-[var(--glass-border)]">
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Predicted Class</p>
                <p className="text-sm font-black text-rose-400 uppercase">{modelOutput.prediction}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-[12px] bg-[var(--bg-main)]/50 border border-[var(--glass-border)] text-center">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Risk</p>
                  <p className="text-xs font-black text-[var(--text-main)] uppercase">{modelOutput.risk_level}</p>
                </div>
                <div className="p-3 rounded-[12px] bg-[var(--bg-main)]/50 border border-[var(--glass-border)] text-center">
                  <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Confidence</p>
                  <p className="text-xs font-black text-cyan-400">{(modelOutput.confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
              <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">{modelOutput.reasoning}</p>
            </div>
          )}
          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Cardiac Risk Profile</h3>
            <div className="h-[180px]">
              <ResponsiveContainer>
                <RadarChart data={riskData}>
                  <PolarGrid stroke="var(--glass-border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
                  <Radar dataKey="value" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Parameters */}
        {analysis.parameters?.length > 0 && (
          <div className="bg-[var(--glass-bg)] p-8 rounded-[32px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-6 font-black uppercase">ECG Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.parameters.map((p, i) => (
                <div key={i} className="p-4 rounded-[16px] bg-[var(--input-bg)] border border-[var(--glass-border)] flex justify-between items-center group hover:bg-[var(--bg-main)]/50 transition-all">
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{p.name}</p>
                    <p className="text-xs font-black text-rose-400">{p.value}</p>
                    {p.interpretation && <p className="text-[9px] text-[var(--text-muted)] mt-0.5 group-hover:text-[var(--text-main)] transition-colors">{p.interpretation}</p>}
                  </div>
                  <span className={cn('text-[8px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ml-3',
                    p.status === 'Normal' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                    'bg-amber-500/20 text-amber-400'
                  )}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Notes */}
        {analysis.clinical_notes && (
          <div className="glass-panel p-8 rounded-[32px] border-[var(--border-subtle)] bg-[var(--bg-main)]/10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4">Clinical Interpretation</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{analysis.clinical_notes}</p>
          </div>
        )}

        {/* Threats + Diet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.threats?.length > 0 && (
            <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alerts</h3>
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
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-4 flex items-center gap-2"><Apple className="w-4 h-4" /> Cardiac Diet</h3>
              <div className="space-y-3">
                {analysis.diet.slice(0, 4).map((d, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-[14px] bg-emerald-500/5 border border-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{d.recommendation}</p>
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{d.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-[24px] border border-[var(--border-subtle)] flex items-center gap-4 opacity-40">
          <ShieldCheck className="w-6 h-6 text-rose-500 shrink-0" />
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
            ECG analysis: MaxViT PyTorch model via Flask → Neural Llama-4 Scout clinical narrative. Consult a cardiologist before clinical decisions.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
