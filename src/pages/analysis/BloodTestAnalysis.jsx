/**
 * BloodTestAnalysis.jsx
 * Pipeline: PDF/Image → pdfjs render → Tesseract OCR → PII scrub → Groq Llama-4 vision → JSON result
 * Used for: Blood Test (CBC) reports
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, FlaskConical, AlertTriangle, TrendingUp, Shield, Apple, CheckCircle2, Clock, Activity, ShieldCheck } from 'lucide-react';
import { cn } from '../../components/Button';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import * as pdfjs from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

import { API_BASE_URL } from '../../apiConfig';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const scrubPII = (text) => {
  if (!text) return '';
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')
    .replace(/(\+\d{1,2}\s?)?\d{10}/g, '[REDACTED]')
    .replace(/DOB[\s:]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi, 'DOB: [REDACTED]');
};

const GROQ_PROMPT = (ocrText) => `You are an expert hematologist AI. Analyze this CBC (Complete Blood Count) lab report.

OCR-extracted text from report:
"""
${ocrText.slice(0, 4000)}
"""

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "summary": "2-sentence clinical summary",
  "health_score": 0-100,
  "parameters": [{"name":"string","value":"string","status":"Normal|Abnormal|Critical","interpretation":"string"}],
  "risk_assessment": {
    "cardiovascular": {"level":"Low|Moderate|High","reason":"string"},
    "metabolic": {"level":"Low|Moderate|High","reason":"string"},
    "organHealth": {"level":"Low|Moderate|High","reason":"string"}
  },
  "threats": [{"level":"LOW|MODERATE|HIGH|CRITICAL","condition":"string","description":"string"}],
  "diet": [{"recommendation":"string","category":"string","reason":"string"}],
  "medications": [{"name":"string","dosage":"string","frequency":"string","purpose":"string"}],
  "routine": [{"time":"string","activity":"string","importance":"string"}],
  "overall_verdict": "STABLE|MONITORING|URGENT|CRITICAL"
}`;

const VERDICT_COLOR = {
  STABLE: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  MONITORING: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  URGENT: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  CRITICAL: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
};

export default function BloodTestAnalysis({ report, token, onComplete }) {
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState(report?.aiAnalysis || null);
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
      setStep('Decoding report data...');
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      const isPdf = report?.fileType?.includes('pdf') || report?.fileName?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        setStep('Rendering PDF layers...');
        const bytes = Uint8Array.from(atob(report.fileBase64), c => c.charCodeAt(0));
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 2 });
        canvas.height = vp.height; canvas.width = vp.width;
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      } else {
        setStep('Decoding image matrix...');
        const img = await new Promise(res => {
          const i = new Image();
          i.onload = () => res(i);
          i.src = `data:${report.fileType};base64,${report.fileBase64}`;
        });
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      setStep('Running Tesseract OCR engine...');
      const ocr = await Tesseract.recognize(canvas, 'eng');
      const cleanText = scrubPII(ocr.data.text);

      setStep('Masking patient identifiers...');
      // Blackout top 15% (header with name/DOB)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.15);
      const imageUrl = canvas.toDataURL('image/jpeg', 0.85);

      setStep('Neural AI synthesis in progress...');
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [
            { type: 'text', text: GROQ_PROMPT(cleanText) },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]}]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const parsed = JSON.parse(data.choices[0].message.content);
      setAnalysis(parsed);

      // Save to backend
      setStep('Committing to archive...');
      if (token) {
        await fetch(`${API_BASE_URL}/api/lab-reports/${report._id}/analysis`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ analysis: parsed })
        });
      }
      if (onComplete) onComplete(parsed);
    } catch (e) { setError('Analysis failed: ' + e.message); }
    finally { setAnalysing(false); setStep(''); }
  };

  const riskData = analysis?.risk_assessment ? [
    { name: 'Cardio', value: analysis.risk_assessment.cardiovascular?.level === 'High' ? 85 : analysis.risk_assessment.cardiovascular?.level === 'Moderate' ? 55 : 25 },
    { name: 'Metabolic', value: analysis.risk_assessment.metabolic?.level === 'High' ? 85 : analysis.risk_assessment.metabolic?.level === 'Moderate' ? 55 : 25 },
    { name: 'Organ', value: analysis.risk_assessment.organHealth?.level === 'High' ? 85 : analysis.risk_assessment.organHealth?.level === 'Moderate' ? 55 : 25 },
  ] : [];

  const barData = analysis?.parameters?.slice(0, 8).map(p => ({
    name: p.name?.slice(0, 10),
    status: p.status === 'Normal' ? 1 : p.status === 'Abnormal' ? 2 : 3
  })) || [];

  if (analysing) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
        <FlaskConical className="w-8 h-8 text-cyan-500 absolute inset-0 m-auto" />
      </div>
      <div className="text-center">
        <p className="text-lg font-black uppercase tracking-tighter text-[var(--text-main)] mb-2">CBC Blood Analysis</p>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 animate-pulse">{step}</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 rounded-[24px] bg-rose-500/10 border border-rose-500/20 flex items-center gap-4">
      <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">Analysis Error</p>
        <p className="text-sm text-rose-400/70">{error}</p>
      </div>
      <button onClick={() => { setError(null); setAttempted(false); }} className="ml-auto px-4 py-2 rounded-xl bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/30 transition-all">Retry</button>
    </div>
  );

  if (!analysis) return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <FlaskConical className="w-12 h-12 text-cyan-500/30" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">Awaiting CBC analysis</p>
      <button onClick={() => { setAttempted(false); }} className="px-8 py-3 rounded-2xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-500/20">Run Analysis</button>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Summary Header */}
        <div className="p-8 rounded-[32px] bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center gap-6 relative overflow-hidden backdrop-blur-3xl shadow-xl">
          <div className="absolute inset-0 bg-cyan-500/5 -z-10" />
          <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-cyan-500/30 shrink-0">
            {analysis.health_score}
          </div>
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={cn('px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border', VERDICT_COLOR[analysis.overall_verdict] || VERDICT_COLOR.STABLE)}>
                {analysis.overall_verdict || 'STABLE'}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">CBC Report · Neural Llama-4 Scout</span>
            </div>
            <p className="text-sm font-bold text-[var(--text-main)] leading-snug">{analysis.summary}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Risk Profile</h3>
            <div className="h-[180px]">
              <ResponsiveContainer>
                <RadarChart data={riskData}>
                  <PolarGrid stroke="var(--glass-border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 900 }} />
                  <Radar dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-[var(--glass-bg)] p-6 rounded-[28px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-lg">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Parameter Status</h3>
            <div className="h-[180px]">
              <ResponsiveContainer>
                <BarChart data={barData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 8, fontWeight: 800 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 3]} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: 12, fontSize: 10, color: 'var(--text-main)' }} />
                  <Bar dataKey="status" radius={[4, 4, 0, 0]}>
                    {barData.map((e, i) => <Cell key={i} fill={e.status === 1 ? '#10b981' : e.status === 2 ? '#f59e0b' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Parameters */}
        {analysis.parameters?.length > 0 && (
          <div className="bg-[var(--glass-bg)] p-8 rounded-[32px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mb-6 flex items-center gap-2"><Activity className="w-4 h-4" /> Blood Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.parameters.map((p, i) => (
                <div key={i} className="p-4 rounded-[20px] bg-[var(--input-bg)] border border-[var(--glass-border)] hover:border-cyan-500/20 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-tight">{p.name}</p>
                    <span className={cn('text-[8px] font-black px-2 py-0.5 rounded-full uppercase',
                      p.status === 'Normal' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' :
                      p.status === 'Critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                    )}>{p.status}</span>
                  </div>
                  <p className="text-sm font-black text-cyan-400 mb-1">{p.value}</p>
                  {p.interpretation && <p className="text-[9px] text-[var(--text-muted)] leading-relaxed group-hover:text-[var(--text-main)] transition-colors">{p.interpretation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threats */}
        {analysis.threats?.length > 0 && (
          <div className="glass-panel p-8 rounded-[32px] border-[var(--border-subtle)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-6 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Pathological Alerts</h3>
            <div className="space-y-3">
              {analysis.threats.map((t, i) => (
                <div key={i} className={cn('p-4 rounded-[16px] border', {
                  'bg-rose-500/10 border-rose-500/20': t.level === 'CRITICAL' || t.level === 'HIGH',
                  'bg-amber-500/10 border-amber-500/20': t.level === 'MODERATE',
                  'bg-emerald-500/10 border-emerald-500/20': t.level === 'LOW',
                })}>
                  <p className={cn('text-[9px] font-black uppercase tracking-widest mb-1', {
                    'text-rose-400': t.level === 'CRITICAL' || t.level === 'HIGH',
                    'text-amber-400': t.level === 'MODERATE',
                    'text-emerald-400': t.level === 'LOW',
                  })}>{t.level} — {t.condition}</p>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diet + Medications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analysis.diet?.length > 0 && (
            <div className="glass-panel p-8 rounded-[32px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-6 flex items-center gap-2"><Apple className="w-4 h-4" /> Nutritional Directives</h3>
              <div className="space-y-3">
                {analysis.diet.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-[14px] bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-[var(--text-main)] uppercase leading-tight">{d.recommendation}</p>
                      <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">{d.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.routine?.length > 0 && (
            <div className="glass-panel p-8 rounded-[32px] border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400 mb-6 flex items-center gap-2"><Clock className="w-4 h-4" /> Daily Protocol</h3>
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

        {/* Disclaimer */}
        <div className="p-6 rounded-[24px] border border-[var(--border-subtle)] flex items-center gap-4 opacity-40">
          <ShieldCheck className="w-6 h-6 text-cyan-500 shrink-0" />
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-relaxed">
            CBC analysis generated by Tesseract OCR + Neural Llama-4 Scout. Not a substitute for licensed physician opinion.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
