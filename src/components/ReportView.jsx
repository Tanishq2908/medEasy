import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ClipboardList, Info, MessageSquare,
  Printer, Send, ShieldAlert, Sparkles, Stethoscope, TestTube2,
} from 'lucide-react';
import { api } from '../api';
import { ErrorNote, ProbabilityBar, RangeBar, ScoreRing, SectionTitle, Spinner, Stat, StatusBadge } from './ui';
import { fmt, MODEL_COLORS, pct, scoreBand } from '../lib/format';

const URGENCY = {
  urgent: { color: 'var(--critical)', soft: 'var(--critical-soft)', Icon: ShieldAlert, label: 'Urgent' },
  soon: { color: 'var(--serious)', soft: 'var(--serious-soft)', Icon: AlertTriangle, label: 'Needs attention' },
  routine: { color: 'var(--warning)', soft: 'var(--warn-soft)', Icon: Info, label: 'Routine follow-up' },
  none: { color: 'var(--good)', soft: 'var(--good-soft)', Icon: CheckCircle2, label: 'All clear' },
};

export default function ReportView({ analysis, title, date, llmEnabled }) {
  const a = analysis;
  const urgency = URGENCY[a.precautions.urgency.level];
  const band = scoreBand(a.health_score);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Lab report analysis</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title || 'Your results'}</h1>
          <p className="mt-1 text-sm muted">
            {date && <>{date} · </>}
            {a.patient.age ? `${Math.round(a.patient.age)} years` : 'Age not given'} ·{' '}
            {a.patient.sex === 'M' ? 'Male' : a.patient.sex === 'F' ? 'Female' : 'Sex not given'}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</button>
          <Link to="/analyze" className="btn btn-primary btn-sm">Analyze another</Link>
        </div>
      </div>

      {/* Urgency */}
      <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: urgency.soft }}>
        <urgency.Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: urgency.color }} />
        <div>
          <div className="font-semibold">{urgency.label}</div>
          <div className="text-sm muted">{a.precautions.urgency.message}</div>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="card flex items-center gap-5 p-5">
          <ScoreRing score={a.health_score} />
          <div>
            <div className="text-sm muted">Lab health score</div>
            <div className="mt-1 text-lg font-bold" style={{ color: band.color }}>{band.label}</div>
            <p className="mt-1 text-xs faint">Each test weighs equally; out-of-range values lose points by how far they deviate.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Tests found" value={a.counts.total} icon={TestTube2} />
          <Stat label="In range" value={a.counts.normal} icon={CheckCircle2} tone="var(--good)" />
          <Stat label="Out of range" value={a.counts.abnormal} icon={Activity} tone="var(--serious)" />
          <Stat label="Critical" value={a.counts.critical} icon={ShieldAlert} tone="var(--critical)" />
        </div>
      </div>

      {/* Summary */}
      <div className="card p-5">
        <div className="flex items-center gap-2 font-semibold">
          {a.ai ? <Sparkles className="h-4 w-4" style={{ color: 'var(--brand)' }} /> : <ClipboardList className="h-4 w-4" style={{ color: 'var(--brand)' }} />}
          Summary
        </div>
        <p className="mt-2 leading-relaxed">{a.ai?.summary || a.summary}</p>
        {a.ai?.key_insights?.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm muted">
            {a.ai.key_insights.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        )}
        {a.ai && <p className="mt-3 text-xs faint">Narrative written by an AI language model from the structured values above.</p>}
      </div>

      <CategoryOverview categories={a.categories} />
      <ResultsSection results={a.results} />
      <RiskSection risks={a.risks} />
      <PrecautionsSection precautions={a.precautions} ai={a.ai} />
      {llmEnabled && <ChatPanel analysis={a} />}

      <p className="text-xs faint">{a.disclaimer}</p>
    </div>
  );
}

function CategoryOverview({ categories }) {
  const data = categories.map((c) => ({ name: c.category, Normal: c.normal, Low: c.low, High: c.high }));
  return (
    <section>
      <SectionTitle title="Overview by panel" sub="How many tests in each panel are in range, low or high." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card p-4">
          <div style={{ height: Math.max(180, data.length * 38 + 60) }}>
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} itemStyle={{ color: 'var(--ink)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: 'var(--ink-2)' }}>{v}</span>} />
                <Bar dataKey="Normal" stackId="a" fill="var(--good)" stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Low" stackId="a" fill="var(--warning)" stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="High" stackId="a" fill="var(--serious)" stroke="var(--surface)" strokeWidth={2} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          {categories.map((c) => {
            const b = scoreBand(c.score);
            return (
              <div key={c.category} className="card p-3">
                <div className="truncate text-sm font-semibold">{c.category}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold">{c.score}</span>
                  <span className="text-xs faint">/100</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: b.color }} />
                </div>
                <div className="mt-1.5 text-xs faint">{c.normal}/{c.total} in range</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResultsSection({ results }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const shown = results.filter((r) => filter === 'all' || r.status !== 'normal');
  const grouped = useMemo(() => {
    const g = {};
    shown.forEach((r) => { (g[r.category] ||= []).push(r); });
    return Object.entries(g);
  }, [shown]);

  return (
    <section>
      <SectionTitle
        title="All results"
        sub="Green band = reference interval. Dot = your value. Tap a row for what it means."
        right={(
          <div className="flex rounded-lg bg-[var(--surface-2)] p-1" role="tablist">
            <button className="tab" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>All ({results.length})</button>
            <button className="tab" role="tab" aria-selected={filter === 'abnormal'} onClick={() => setFilter('abnormal')}>
              Out of range ({results.filter((r) => r.status !== 'normal').length})
            </button>
          </div>
        )}
      />
      {grouped.length === 0 && <div className="card p-6 text-center muted">Every recognised value is within its reference range.</div>}
      <div className="space-y-4">
        {grouped.map(([cat, rows]) => (
          <div key={cat} className="card overflow-hidden">
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold">{cat}</div>
            <ul>
              {rows.map((r) => {
                const isOpen = open === r.key;
                return (
                  <li key={r.key} className="border-b border-[var(--border)] last:border-0">
                    <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-[var(--surface-2)] md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_7.5rem_1rem]"
                      onClick={() => setOpen(isOpen ? null : r.key)} aria-expanded={isOpen}>
                      <span className="font-medium">{r.name}</span>
                      <span className="tnum text-right md:text-left">
                        <span className="font-semibold">{fmt(r.value)}</span> <span className="text-xs faint">{r.unit}</span>
                      </span>
                      <span className="col-span-2 md:col-span-1"><RangeBar value={r.value} low={r.ref_low} high={r.ref_high} status={r.status} critical={r.critical} /></span>
                      <span className="hidden md:block"><StatusBadge status={r.status} critical={r.critical} /></span>
                      <ChevronDown className={`hidden h-4 w-4 faint transition-transform md:block ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-2 px-4 pb-4 text-sm">
                        <div className="md:hidden"><StatusBadge status={r.status} critical={r.critical} /></div>
                        <p>{r.meaning}</p>
                        {r.precautions.length > 0 && (
                          <ul className="list-disc space-y-0.5 pl-5 muted">{r.precautions.map((p) => <li key={p}>{p}</li>)}</ul>
                        )}
                        <p className="text-xs faint">
                          Reference {fmt(r.ref_low)}–{fmt(r.ref_high)} {r.unit} ({r.ref_source === 'report' ? 'from your report' : 'standard adult range'}).
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskSection({ risks }) {
  if (!risks?.length) return null;
  return (
    <section>
      <SectionTitle
        title="Machine-learning risk screening"
        sub="Calibrated probabilities from models trained on public clinical datasets, with a 95% uncertainty interval."
        right={<Link to="/models" className="btn btn-secondary btn-sm no-print">How accurate are these?</Link>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {risks.map((r) => <RiskCard key={r.key} r={r} />)}
      </div>
    </section>
  );
}

const LEVEL_TONE = { Low: 'var(--good)', Elevated: 'var(--serious)', High: 'var(--critical)' };

function RiskCard({ r }) {
  const color = MODEL_COLORS[r.key];
  if (!r.available) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /><span className="font-semibold">{r.name}</span></div>
        <p className="mt-3 text-sm muted">{r.reason}</p>
        <p className="mt-2 text-xs faint">Inputs used: {r.features.map((f) => f.label).join(', ')}</p>
      </div>
    );
  }
  const maxDelta = Math.max(...r.contributions.map((c) => Math.abs(c.delta)), 0.01);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /><span className="font-semibold">{r.name}</span></div>
          <div className="mt-0.5 text-xs faint">{r.algorithm} · test ROC-AUC {r.test_roc_auc.toFixed(3)} (95% CI {r.test_roc_auc_ci95[0].toFixed(3)}–{r.test_roc_auc_ci95[1].toFixed(3)})</div>
        </div>
        <span className="chip" style={{ background: 'var(--surface-2)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_TONE[r.level] }} />{r.level}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{pct(r.probability)}</span>
        <span className="text-sm muted">risk · 95% interval {pct(r.interval[0])}–{pct(r.interval[1])}</span>
      </div>
      <div className="mt-3"><ProbabilityBar p={r.probability} interval={r.interval} threshold={r.threshold} color={color} /></div>
      <p className="mt-1 text-xs faint">
        Vertical line = decision threshold ({pct(r.threshold)}), chosen on training data by Youden's J. The training data's base rate was {pct(r.base_rate)},
        so compare against the threshold rather than 50%.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[var(--surface-2)] p-2">
          <div className="text-lg font-bold">{pct(r.confidence)}</div><div className="text-[11px] faint">Confidence score</div>
        </div>
        <div className="rounded-lg bg-[var(--surface-2)] p-2">
          <div className="text-lg font-bold">{pct(r.confidence_breakdown.data_coverage)}</div><div className="text-[11px] faint">Inputs available</div>
        </div>
        <div className="rounded-lg bg-[var(--surface-2)] p-2">
          <div className="text-lg font-bold">{pct(r.confidence_breakdown.interval_tightness)}</div><div className="text-[11px] faint">Interval tightness</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold">What drove this estimate</div>
        <p className="text-xs faint">Change in risk if each value were replaced by a typical value.</p>
        <ul className="mt-2 space-y-1.5">
          {r.contributions.slice(0, 5).map((c) => (
            <li key={c.key} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
              <span className="truncate">{c.key === 'sex' ? 'Sex' : c.label} <span className="faint tnum">{c.key === 'sex' ? (c.value ? 'male' : 'female') : fmt(c.value)}</span></span>
              <span className="relative h-2.5">
                <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--axis)]" />
                <span className="absolute inset-y-0 rounded"
                  style={{
                    background: c.delta >= 0 ? 'var(--serious)' : 'var(--good)',
                    left: c.delta >= 0 ? '50%' : `${50 - (Math.abs(c.delta) / maxDelta) * 50}%`,
                    width: `${(Math.abs(c.delta) / maxDelta) * 50}%`,
                  }} />
              </span>
              <span className="tnum text-right">{c.delta >= 0 ? '+' : '−'}{Math.abs(c.delta * 100).toFixed(1)} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PrecautionsSection({ precautions, ai }) {
  const p = precautions;
  return (
    <section>
      <SectionTitle title="Precautions and next steps" sub="Practical guidance based on your out-of-range values and risk screening." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {p.by_category.length === 0 && <div className="card p-5 text-sm muted">No specific precautions: keep a balanced diet, stay active and repeat routine tests yearly.</div>}
          {p.by_category.map((c) => (
            <div key={c.category} className="card p-5">
              <div className="font-semibold">{c.category}</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {c.items.map((t) => (
                  <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--good)' }} /><span>{t}</span></li>
                ))}
              </ul>
            </div>
          ))}
          {ai?.lifestyle?.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" style={{ color: 'var(--brand)' }} /> Personalised lifestyle tips</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{ai.lifestyle.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4" style={{ color: 'var(--brand)' }} /> Suggested follow-up tests</div>
            {p.follow_up_tests.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{p.follow_up_tests.map((t) => <li key={t}>{t}</li>)}</ul>
            ) : <p className="mt-2 text-sm muted">None suggested by the risk screening.</p>}
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 font-semibold"><Stethoscope className="h-4 w-4" style={{ color: 'var(--brand)' }} /> Who to consult</div>
            {p.specialists.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{p.specialists.map((t) => <li key={t}>{t}</li>)}</ul>
            ) : <p className="mt-2 text-sm muted">Your general physician at your next visit.</p>}
          </div>
          {ai?.questions_for_doctor?.length > 0 && (
            <div className="card p-5">
              <div className="font-semibold">Questions to ask your doctor</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{ai.questions_for_doctor.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          <div className="card p-5 text-sm muted">
            <ul className="list-disc space-y-1 pl-5">{p.general.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatPanel({ analysis }) {
  const [history, setHistory] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ask = async (e) => {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true); setErr('');
    const next = [...history, { role: 'user', content: question }];
    setHistory(next); setQ('');
    try {
      const d = await api('/api/chat', { method: 'POST', body: { question, analysis, history } });
      setHistory([...next, { role: 'assistant', content: d.answer }]);
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="no-print">
      <SectionTitle title="Ask about this report" sub="Questions are answered using only the values in this report." />
      <div className="card p-4">
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {history.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {['Which result should I worry about most?', 'What diet changes would help?', 'Explain my liver results simply'].map((s) => (
                <button key={s} className="btn btn-secondary btn-sm" onClick={() => setQ(s)}>{s}</button>
              ))}
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-[var(--brand)] text-white' : 'bg-[var(--surface-2)]'}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm muted"><Spinner /> Thinking…</div>}
        </div>
        <ErrorNote>{err}</ErrorNote>
        <form onSubmit={ask} className="mt-3 flex gap-2">
          <label htmlFor="chat-q" className="sr-only">Your question</label>
          <input id="chat-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a question…" maxLength={500} />
          <button className="btn btn-primary" disabled={busy || !q.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
        <p className="mt-2 flex items-center gap-1 text-xs faint"><MessageSquare className="h-3 w-3" /> AI answers can be wrong. Confirm anything important with your doctor.</p>
      </div>
    </section>
  );
}
