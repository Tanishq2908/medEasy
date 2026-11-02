import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { FileText, FlaskConical, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { ErrorNote, SectionTitle, Spinner, Stat } from '../components/ui';
import ModelLegend from '../components/ModelLegend';
import { fmt, MODEL_COLORS, scoreBand, STATUS } from '../lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState(null);
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState('');
  const [analyte, setAnalyte] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([api('/api/reports'), api('/api/trends')])
      .then(([r, t]) => {
        setReports(r.reports); setTrends(t);
        const firstAbnormal = t.analytes.find((a) => a.points.some((p) => p.status !== 'normal'));
        setAnalyte((firstAbnormal || t.analytes[0])?.key || '');
      })
      .catch((e) => setError(e.message));
  }, [user]);

  const series = useMemo(() => trends?.analytes.find((a) => a.key === analyte), [trends, analyte]);
  const riskRows = useMemo(() => {
    if (!trends) return [];
    const rows = {};
    trends.risks.forEach((r) => r.points.forEach((p) => { (rows[p.date] ||= { date: p.date })[r.key] = p.probability; }));
    return Object.values(rows).sort((a, b) => a.date.localeCompare(b.date));
  }, [trends]);

  if (!user) return <Navigate to="/login" state={{ from: '/dashboard' }} replace />;

  const latest = reports?.[0];
  const prev = reports?.[1];
  const delta = latest && prev ? latest.health_score - prev.health_score : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Hi {user.name.split(' ')[0]}</h1>
          <p className="mt-1 muted">Your lab history and how your values are trending.</p>
        </div>
        <Link to="/analyze" className="btn btn-primary"><FlaskConical className="h-4 w-4" /> Analyze new report</Link>
      </div>

      <div className="mt-6"><ErrorNote>{error}</ErrorNote></div>
      {!reports && !error && <div className="mt-8 flex items-center gap-2 muted"><Spinner /> Loading…</div>}

      {reports && reports.length === 0 && (
        <div className="card mt-8 p-10 text-center">
          <FileText className="mx-auto h-10 w-10 faint" />
          <h2 className="mt-3 text-lg font-bold">No reports yet</h2>
          <p className="mt-1 muted">Upload your first lab report to start tracking.</p>
          <Link to="/analyze" className="btn btn-primary mt-5">Analyze a report</Link>
        </div>
      )}

      {reports?.length > 0 && trends && (
        <div className="mt-8 space-y-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Reports" value={reports.length} icon={FileText} />
            <Stat label="Latest health score" value={latest.health_score} sub={scoreBand(latest.health_score).label} />
            <Stat
              label="Change since previous"
              value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
              icon={delta !== null && delta < 0 ? TrendingDown : TrendingUp}
              tone={delta === null ? undefined : delta >= 0 ? 'var(--good)' : 'var(--critical)'}
              sub={delta === null ? 'Needs two reports' : 'points'}
            />
            <Stat label="Out of range (latest)" value={latest.abnormal_count} />
          </div>

          {trends.scores.length > 1 && (
            <section>
              <SectionTitle title="Health score over time" />
              <div className="card p-4">
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={trends.scores} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" name="Health score" stroke="var(--brand)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          <section>
            <SectionTitle
              title="Track a test"
              sub="Green band = reference interval; dot colour shows whether each result was in range."
              right={(
                <div>
                  <label htmlFor="analyte" className="sr-only">Test</label>
                  <select id="analyte" className="input w-full sm:w-64" value={analyte} onChange={(e) => setAnalyte(e.target.value)}>
                    {trends.analytes.map((a) => <option key={a.key} value={a.key}>{a.name} ({a.points.length})</option>)}
                  </select>
                </div>
              )}
            />
            {series && <AnalyteChart s={series} />}
          </section>

          {trends.risks.length > 0 && trends.scores.length > 1 && (
            <section>
              <SectionTitle title="Risk estimates over time" sub="Calibrated probability from each screening model." />
              <div className="card p-4">
                <div className="h-72">
                  <ResponsiveContainer>
                    <LineChart data={riskRows} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                      <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => `${(v * 100).toFixed(1)}%`} itemStyle={{ color: 'var(--ink)' }} />
                      {trends.risks.map((r) => (
                        <Line key={r.key} dataKey={r.key} name={r.name} stroke={MODEL_COLORS[r.key]} strokeWidth={2} connectNulls
                          dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <ModelLegend keys={trends.risks.map((r) => r.key)} />
              </div>
            </section>
          )}

          <section>
            <SectionTitle title="All reports" />
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-[var(--surface-2)] text-left">
                  <tr><th className="px-4 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">Report</th><th className="px-4 py-2.5 text-right font-semibold">Score</th><th className="px-4 py-2.5 text-right font-semibold">Out of range</th><th /></tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 tnum">{r.report_date}</td>
                      <td className="px-4 py-3 font-medium">{r.title}</td>
                      <td className="px-4 py-3 text-right tnum">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: scoreBand(r.health_score).color }} />{r.health_score}
                      </td>
                      <td className="px-4 py-3 text-right tnum">{r.abnormal_count}</td>
                      <td className="px-4 py-3 text-right"><Link to={`/reports/${r.id}`} className="font-semibold text-[var(--brand)]">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AnalyteChart({ s }) {
  const values = s.points.map((p) => p.value);
  const lo = Math.min(...values, s.ref_low ?? Infinity);
  const hi = Math.max(...values, s.ref_high ?? -Infinity);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  const latest = s.points[s.points.length - 1];

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-lg font-bold">{s.name}</span>
        <span className="text-sm muted">Latest {fmt(latest.value)} {s.unit} · reference {fmt(s.ref_low)}–{fmt(s.ref_high)} {s.unit}</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={s.points} margin={{ top: 8, right: 16, left: -4, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            {s.ref_low != null && s.ref_high != null && <ReferenceArea y1={s.ref_low} y2={s.ref_high} fill="var(--good)" fillOpacity={0.12} stroke="none" />}
            <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
            <YAxis domain={[Math.max(0, lo - pad), hi + pad]} tickFormatter={(v) => fmt(v, 1)} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [`${fmt(v)} ${s.unit}`, s.name]} />
            <Line type="monotone" dataKey="value" stroke="var(--ink-3)" strokeWidth={2} dot={<StatusDot />} activeDot={{ r: 7 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {s.points.length === 1 && <p className="mt-2 text-xs faint">Only one result so far. Add more reports to see a trend.</p>}
    </div>
  );
}

function StatusDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill={STATUS[payload.status]?.color || 'var(--brand)'} stroke="var(--surface)" strokeWidth={2} />;
}
