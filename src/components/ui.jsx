import { AlertOctagon } from 'lucide-react';
import { fmt, pct, scoreBand, STATUS } from '../lib/format';

export function StatusBadge({ status, critical }) {
  const s = STATUS[critical ? 'critical' : status] || STATUS.normal;
  const label = critical ? `Critical ${status}` : s.label;
  return (
    <span className="chip" style={{ background: s.soft, color: s.ink }}>
      <s.Icon className="h-3.5 w-3.5" style={{ color: s.color }} aria-hidden />
      {label}
    </span>
  );
}

/** Where a value sits relative to its reference interval. */
export function RangeBar({ value, low, high, status, critical, compact = false }) {
  const lo = low ?? 0;
  const hi = high ?? lo * 2 + 1;
  const span = Math.max(hi - lo, Math.abs(hi) * 0.2, 1e-6);
  const min = Math.min(lo - span * 0.6, value - span * 0.15);
  const max = Math.max(hi + span * 0.6, value + span * 0.15);
  const x = (v) => ((v - min) / (max - min)) * 100;
  const s = STATUS[critical ? 'critical' : status] || STATUS.normal;
  const left = x(lo);
  const width = Math.max(x(hi) - left, 1);
  const pos = Math.min(Math.max(x(value), 1.5), 98.5);

  return (
    <div className={compact ? 'w-full' : 'w-full pt-1'} aria-label={`Value ${fmt(value)}, reference ${fmt(low)} to ${fmt(high)}`}>
      <div className="relative h-2 rounded-full bg-[var(--surface-2)]">
        <div className="absolute inset-y-0 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: 'var(--band)', boxShadow: 'inset 0 0 0 1px var(--good)' }} />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${pos}%`, background: s.color, boxShadow: '0 0 0 2px var(--surface)' }}
        />
      </div>
      {!compact && (
        <div className="relative mt-1 h-4 text-[11px] faint tnum">
          {low !== null && low !== undefined && <span className="absolute -translate-x-1/2" style={{ left: `${left}%` }}>{fmt(low)}</span>}
          {high !== null && high !== undefined && <span className="absolute -translate-x-1/2" style={{ left: `${left + width}%` }}>{fmt(high)}</span>}
        </div>
      )}
    </div>
  );
}

export function ScoreRing({ score, size = 132 }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const band = scoreBand(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={band.color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-3xl font-bold leading-none">{score}</div>
          <div className="mt-1 text-xs faint">of 100</div>
        </div>
      </div>
    </div>
  );
}

/** Risk probability with its 95% interval and the model's decision threshold. */
export function ProbabilityBar({ p, interval, threshold, color = 'var(--brand)' }) {
  const [lo, hi] = interval || [p, p];
  return (
    <div className="w-full">
      <div className="relative h-3 rounded-full bg-[var(--surface-2)]">
        <div className="absolute inset-y-0 rounded-full opacity-30" style={{ left: `${lo * 100}%`, width: `${Math.max((hi - lo) * 100, 0.8)}%`, background: color }} />
        {threshold !== undefined && (
          <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-[var(--ink-2)]" style={{ left: `${threshold * 100}%` }} title={`Decision threshold ${pct(threshold)}`} />
        )}
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${p * 100}%`, background: color, boxShadow: '0 0 0 2px var(--surface)' }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] faint tnum">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm muted">
        {Icon && <Icon className="h-4 w-4" style={{ color: tone || 'var(--ink-3)' }} aria-hidden />}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs faint">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ title, sub, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {sub && <p className="mt-0.5 text-sm muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} aria-hidden />;
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg p-3 text-sm" style={{ background: 'var(--critical-soft)' }}>
      <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--critical)' }} />
      <span>{children}</span>
    </div>
  );
}
