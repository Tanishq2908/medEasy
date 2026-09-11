/**
 * KidneyAnalysis.jsx
 * Model: kidney_final_detection_and_classification.pkl (Keras AlexNet CNN)
 * Classes: Normal (0), Stone (1)  — alphabetical from flow_from_dataframe labels
 * Input:   512×512, rescale=1/255
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Droplets, Shield, Apple, CheckCircle2, Clock, Activity, ShieldCheck, TrendingUp } from 'lucide-react';
import { cn } from '../../components/Button';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { API_BASE_URL, FLASK_BASE_URL } from '../../apiConfig';

const buildGroqPrompt = (modelOutput) => `You are an expert nephrologist. 
A kidney ultrasound classification model produced:
${JSON.stringify(modelOutput, null, 2)}

Classification: ${modelOutput.prediction} | Risk: ${modelOutput.risk_level} | Confidence: ${(modelOutput.confidence * 100).toFixed(1)}%

Based STRICTLY on this classification, provide a clinical analysis as strict JSON (no markdown):
CRITICAL RULE: If the confidence is < 60.0% (${(modelOutput.confidence * 100).toFixed(1) || 0}%), you MUST state "Please consider consulting a doctor immediately due to low AI certainty" in the summary, and set the overall_verdict to "CONSULT DOCTOR".
{
  "summary": "2-sentence clinical interpretation consistent with classification: ${modelOutput.prediction}",
  "health_score": <number 0-100, low if Stone detected>,
  "parameters": [
    {"name":"Finding","value":"${modelOutput.prediction}","status":"${modelOutput.prediction === 'Normal' ? 'Normal' : 'Abnormal'}","interpretation":"string"},
    {"name":"Stone Risk","value":"string","status":"${modelOutput.prediction === 'Normal' ? 'Normal' : 'Abnormal'}","interpretation":"string"},
    {"name":"Kidney Function Estimate","value":"string","status":"Normal|Abnormal","interpretation":"string"},
    {"name":"Hydronephrosis Risk","value":"string","status":"Normal|Abnormal","interpretation":"string"}
  ],
  "risk_assessment": {
    "cardiovascular": {"level":"Low|Moderate|High","reason":"string"},
    "metabolic": {"level":"Low|Moderate|High","reason":"string"},
    "organHealth": {"level":"${modelOutput.prediction === 'Normal' ? 'Low' : 'High'}","reason":"string"}
  },
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "diet": [{"recommendation":"string","category":"string","reason":"string"}],
  "medications": [{"name":"string","dosage":"string","frequency":"string","purpose":"string"}],
  "routine": [{"time":"string","activity":"string","importance":"string"}],
  "overall_verdict": "${modelOutput.prediction === 'Normal' ? 'STABLE' : 'URGENT'}",
  "hydration_target_liters": 3.0,
  "follow_up": "string"
}`;

const VERDICT_COLOR = {
  STABLE:    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  MONITORING:'text-amber-400 border-amber-500/30 bg-amber-500/10',
  URGENT:    'text-orange-400 border-orange-500/30 bg-orange-500/10',
  CRITICAL:  'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

export default function KidneyAnalysis({ report, token, onComplete }) {
  const [analysing, setAnalysing]   = useState(false);
  const [analysis,  setAnalysis]    = useState(report?.aiAnalysis || null);
  const [modelOutput,setModelOutput]= useState(null);
  const [step,      setStep]        = useState('');
  const [error,     setError]       = useState(null);
  const [attempted, setAttempted]   = useState(false);

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

      setStep('Decoding ultrasound data...');
      const isPdf = report?.fileType?.includes('pdf') || report?.fileName?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        setStep('Extracting from PDF...');
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

      // ── Step 1: Local Keras kidney model via Flask
      setStep('Running kidney stone detection model (512×512)...');
      const blob    = await fetch(imageUrl).then(r => r.blob());
      const fileObj = new File([blob], report.fileName || 'kidney.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image', fileObj);

      const flaskRes = await fetch(`${FLASK_BASE_URL}/analyze-kidney`, { method: 'POST', body: formData });
      if (!flaskRes.ok) throw new Error(`Flask kidney error: ${flaskRes.status} — ${await flaskRes.text()}`);
      const flaskData = await flaskRes.json();
      if (flaskData.error) throw new Error(flaskData.error);
      setModelOutput(flaskData);

      // ── Step 2: Neural clinical narrative (model prediction is source of truth)
      setStep('Generating nephrological clinical report...');
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

      // ── Step 3: Archive
      setStep('Archiving analysis...');
      if (token) {
        await fetch(`${API_BASE_URL}/api/lab-reports/${report._id}/analysis`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ analysis: parsed })
        }).catch(() => {});
      }
      if (onComplete) onComplete(parsed);
    } catch (e) {
      setError('Kidney Analysis failed: ' + e.message);
    } finally {
      setAnalysing(false); setStep('');
    }
  };

  const riskData = analysis?.risk_assessment ? [
    { name: 'Kidney',    value: analysis.risk_assessment.organHealth?.level === 'High' ? 90 : analysis.risk_assessment.organHealth?.level === 'Moderate' ? 55 : 20 },
    { name: 'Metabolic', value: analysis.risk_assessment.metabolic?.level === 'High' ? 85 : analysis.risk_assessment.metabolic?.level === 'Moderate' ? 55 : 25 },
    { name: 'Cardio',    value: analysis.risk_assessment.cardiovascular?.level === 'High' ? 85 : analysis.risk_assessment.cardiovascular?.level === 'Moderate' ? 55 : 25 },
  ] : [];

  const hydrationPie = [
    { name: 'Current Est.', value: 1.5 },
    { name: 'Target',       value: Math.max(0, (analysis?.hydration_target_liters || 3.0) - 1.5) },
  ];

  if (analysing) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
        <Droplets className="w-8 h-8 text-amber-500 absolute inset-0 m-auto" />
      </div>
      <div className="text-center">
        <p className="text-lg font-black uppercase tracking-tighter text-[var(--text-main)] mb-2">Kidney Stone Analysis</p>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 animate-pulse">{step}</p>
        {modelOutput && (
          <div className={cn('mt-4 px-6 py-3 rounded-2xl border', modelOutput.prediction === 'Normal' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20')}>
            <p className={cn('text-[10px] font-black uppercase tracking-widest', modelOutput.prediction === 'Normal' ? 'text-emerald-400' : 'text-rose-400')}>
              {modelOutput.prediction}
            </p>
            <p className="text-[9px] text-[var(--text-muted)] uppercase mt-1">Confidence: {(modelOutput.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 rounded-[24px] bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Analysis Error</p>
        <p className="text-sm text-amber-400/70">{error}</p>
      </div>
      <button onClick={() => { setError(null); setAttempted(false); }}
        className="ml-auto px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/30 transition-all">
        Retry
      </button>
    </div>
  );

  if (!analysis) return null;

  const isStone = modelOutput?.prediction === 'Stone';
  const accentColor = isStone ? '#ef4444' : '#10b981';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* Hero */}
        <div className={cn('p-8 rounded-[32px] border flex items-center gap-6 backdrop-blur-3xl shadow-xl relative overflow-hidden',
          isStone ? 'bg-[var(--glass-bg)] border-rose-500/20' : 'bg-[var(--glass-bg)] border-emerald-500/20')}>
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
                  {modelOutput.prediction} · {(modelOutput.confidence * 100).toFixed(1)}%
                </span>
              )}
              {isStone && (
                <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-500/30 bg-rose-600/90 text-white animate-pulse shadow-lg shadow-rose-500/20">
                  ⚠ KIDNEY STONE DETECTED
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] leading-snug">{analysis.summary}</p>
          </div>
        </div>

        {/* Model + Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modelOutput && (
            <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Model Output
              </h3>
              <div className="p-4 rounded-[16px] border bg-[var(--input-bg)]"
                   style={{ borderColor: `${accentColor}30` }}>
                <p className="text-[9px] font-black uppercase text-[var(--text-muted)] mb-1">Classification</p>
                <p className="text-base font-black uppercase" style={{ color: accentColor }}>{modelOutput.prediction}</p>
              </div>
              {modelOutput.all_confidences && Object.keys(modelOutput.all_confidences).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(modelOutput.all_confidences).map(([cls, pct]) => (
                    <div key={cls} className="flex items-center gap-2">
                      <p className="text-[9px] font-black text-[var(--text-muted)] w-16 uppercase shrink-0">{cls}</p>
                      <div className="flex-grow h-1.5 rounded-full bg-[var(--bg-main)]/50">
                        <div className="h-full rounded-full transition-all shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ width: `${pct}%`, backgroundColor: accentColor }} />
                      </div>
                      <p className="text-[9px] text-[var(--text-muted)] font-black w-10 text-right">{pct}%</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">{modelOutput.reasoning}</p>
            </div>
          )}

          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-4 flex items-center gap-2">
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

          <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)] flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-4 flex items-center gap-2">
              <Droplets className="w-4 h-4" /> Hydration Target
            </h3>
            <div className="flex-grow flex flex-col items-center justify-center">
              <div className="h-[120px] w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={hydrationPie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} startAngle={90} endAngle={-270} dataKey="value">
                      <Cell fill="#3b82f6" />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                    <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-2xl font-black text-blue-400">{analysis.hydration_target_liters || 3.0}L</p>
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Daily target</p>
            </div>
          </div>
        </div>

        {/* Parameters */}
        {analysis.parameters?.length > 0 && (
          <div className="bg-[var(--glass-bg)] p-8 rounded-[32px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Nephrological Parameters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.parameters.map((p, i) => (
                <div key={i} className="p-4 rounded-[16px] bg-[var(--input-bg)] border border-[var(--glass-border)] flex justify-between items-center group hover:bg-[var(--bg-main)]/50 transition-all">
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-main)] uppercase">{p.name}</p>
                    <p className="text-xs font-black text-amber-400">{p.value}</p>
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

        {/* Threats + Diet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.threats?.length > 0 && (
            <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Clinical Alerts
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
                <Apple className="w-4 h-4" /> Kidney Diet
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

        {/* Follow-up */}
        {analysis.follow_up && (
          <div className="glass-panel p-6 rounded-[28px] border-[var(--border-subtle)] bg-[var(--bg-main)]/10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Follow-Up Protocol
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{analysis.follow_up}</p>
          </div>
        )}

        <div className="p-6 rounded-[24px] border border-[var(--border-subtle)] flex items-center gap-4 opacity-40">
          <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
            Powered by kidney_final_detection_and_classification.pkl (Keras AlexNet, 512×512) → Neural clinical synthesis. For clinical use, consult a nephrologist.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
