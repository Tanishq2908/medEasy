import { AlertOctagon, ArrowDown, ArrowUp, CheckCircle2 } from 'lucide-react';

export const STATUS = {
  normal: { label: 'Normal', color: 'var(--good)', soft: 'var(--good-soft)', ink: 'var(--good-ink)', Icon: CheckCircle2 },
  low: { label: 'Low', color: 'var(--warning)', soft: 'var(--warn-soft)', ink: 'var(--ink)', Icon: ArrowDown },
  high: { label: 'High', color: 'var(--serious)', soft: 'var(--serious-soft)', ink: 'var(--ink)', Icon: ArrowUp },
  critical: { label: 'Critical', color: 'var(--critical)', soft: 'var(--critical-soft)', ink: 'var(--ink)', Icon: AlertOctagon },
};

export const fmt = (v, digits = 2) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

export const pct = (v, digits = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);

export function scoreBand(score) {
  if (score >= 85) return { label: 'Good', color: 'var(--good)' };
  if (score >= 65) return { label: 'Fair', color: 'var(--warning)' };
  if (score >= 40) return { label: 'Needs attention', color: 'var(--serious)' };
  return { label: 'Poor', color: 'var(--critical)' };
}

export const MODEL_COLORS = { diabetes: 'var(--s1)', liver: 'var(--s2)', ckd: 'var(--s3)', thyroid: 'var(--s4)' };
