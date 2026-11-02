import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BarChart3, FileUp, HeartPulse, LineChart, ShieldCheck, Sparkles, TestTube2 } from 'lucide-react';
import { api } from '../api';
import { MODEL_COLORS } from '../lib/format';

const PANELS = ['Complete blood count', 'Blood sugar & HbA1c', 'Lipid profile', 'Liver function', 'Kidney function',
  'Electrolytes', 'Thyroid profile', 'Vitamins & iron', 'Inflammation markers', 'Urinalysis'];

const STEPS = [
  { Icon: FileUp, title: 'Upload', text: 'Drop in a PDF or photo of your report, paste its text, or type values in.' },
  { Icon: TestTube2, title: 'Interpret', text: 'Each value is read, unit-converted and compared with its reference range.' },
  { Icon: Activity, title: 'Screen', text: 'Four calibrated ML models estimate diabetes, liver, kidney and thyroid risk with uncertainty.' },
  { Icon: HeartPulse, title: 'Act', text: 'Get precautions, follow-up tests, the right specialist, and trends across reports.' },
];

export default function Landing() {
  const [models, setModels] = useState(null);
  useEffect(() => { api('/api/models/metrics').then((d) => setModels(d.models)).catch(() => {}); }, []);

  return (
    <div>
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div>
            <span className="chip bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Sparkles className="h-3.5 w-3.5" /> Lab report analysis</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Understand every number on your lab report.</h1>
            <p className="mt-4 max-w-xl text-lg muted">
              MedEasy reads your blood test, flags what is out of range, screens for common conditions with validated
              machine-learning models, and tells you what to do next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/analyze" className="btn btn-primary h-12 px-6 text-base">Analyze a report</Link>
              <Link to="/models" className="btn btn-secondary h-12 px-6 text-base"><BarChart3 className="h-4 w-4" /> See model accuracy</Link>
            </div>
            <p className="mt-4 text-sm faint">No account needed to try. Sign up to save reports and track trends.</p>
          </div>

          <div className="card p-5">
            <div className="text-sm font-semibold">Screening models · held-out ROC-AUC (95% CI)</div>
            <ul className="mt-4 space-y-4">
              {(models || []).map((m) => (
                <li key={m.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: MODEL_COLORS[m.key] }} />{m.name.replace(' Risk', '')}</span>
                    <span className="tnum"><b>{m.test_metrics.roc_auc.toFixed(3)}</b> <span className="text-xs faint">[{m.test_metrics_ci95.roc_auc[0].toFixed(2)}–{m.test_metrics_ci95.roc_auc[1].toFixed(2)}]</span></span>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-[var(--surface-2)]">
                    <div className="absolute inset-y-0 rounded-full opacity-35" style={{ left: `${m.test_metrics_ci95.roc_auc[0] * 100}%`, width: `${(m.test_metrics_ci95.roc_auc[1] - m.test_metrics_ci95.roc_auc[0]) * 100}%`, background: MODEL_COLORS[m.key] }} />
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${m.test_metrics.roc_auc * 100}%`, background: MODEL_COLORS[m.key] }} />
                  </div>
                  <div className="mt-1 text-xs faint">{m.algorithm} · n={m.n_samples} · sensitivity {m.test_metrics.sensitivity.toFixed(2)} · specificity {m.test_metrics.specificity.toFixed(2)}</div>
                </li>
              ))}
              {!models && <li className="text-sm muted">Start the API server to load live metrics.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text }, i) => (
            <div key={title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--brand-soft)]"><Icon className="h-4.5 w-4.5 text-[var(--brand)]" /></span>
                <span className="text-xs font-semibold faint">STEP {i + 1}</span>
              </div>
              <div className="mt-3 font-semibold">{title}</div>
              <p className="mt-1 text-sm muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-6 lg:col-span-2">
            <h2 className="text-xl font-bold">What we read</h2>
            <p className="mt-1 text-sm muted">45+ tests, with unit conversion (mmol/L, µmol/L, lakh/cumm, ng/dL…) and sex-specific ranges.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PANELS.map((p) => <span key={p} className="chip bg-[var(--surface-2)] px-3 py-1 text-sm font-medium">{p}</span>)}
            </div>
          </div>
          <div className="card space-y-4 p-6">
            <div className="flex gap-3"><LineChart className="h-5 w-5 shrink-0 text-[var(--brand)]" /><div><div className="font-semibold">Trends over time</div><p className="text-sm muted">Every saved report builds your history.</p></div></div>
            <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-[var(--brand)]" /><div><div className="font-semibold">Private by default</div><p className="text-sm muted">Reports are only stored if you sign in, and only you can see them.</p></div></div>
          </div>
        </div>
      </section>
    </div>
  );
}
