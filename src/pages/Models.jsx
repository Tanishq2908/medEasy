import { useEffect, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Database, ExternalLink, Info } from 'lucide-react';
import { api } from '../api';
import { ErrorNote, SectionTitle, Spinner } from '../components/ui';
import ModelLegend from '../components/ModelLegend';
import { MODEL_COLORS } from '../lib/format';

const METRICS = [
  ['roc_auc', 'ROC-AUC'],
  ['pr_auc', 'PR-AUC'],
  ['accuracy', 'Accuracy'],
  ['balanced_accuracy', 'Balanced accuracy'],
  ['sensitivity', 'Sensitivity (recall)'],
  ['specificity', 'Specificity'],
  ['precision', 'Precision (PPV)'],
  ['f1', 'F1 score'],
  ['mcc', 'MCC'],
  ['brier', 'Brier (lower = better)'],
];

const f3 = (v) => (v === undefined || v === null ? '—' : Number(v).toFixed(3));

export default function Models() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState('diabetes');

  useEffect(() => {
    let tries = 0;
    const load = () => api('/api/models/metrics').then(setData).catch((e) => {
      if (e.status === 503 && tries++ < 20) setTimeout(load, 3000);
      else setError(e.message);
    });
    load();
  }, []);

  if (error) return <div className="mx-auto max-w-6xl px-4 py-8"><ErrorNote>{error}</ErrorNote></div>;
  if (!data) return <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-8 muted"><Spinner /> Loading model metrics…</div>;

  const m = data.models.find((x) => x.key === sel) || data.models[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="eyebrow">Model performance</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">How accurate are the risk models?</h1>
      <p className="mt-2 max-w-3xl muted">
        Four screening models, each evaluated once on a held-out test set it never saw during training or model selection.
        Every metric is reported with a 95% bootstrap confidence interval ({data.bootstrap_resamples.toLocaleString()} resamples).
      </p>

      <div className="card mt-6 flex gap-3 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--brand)' }} />
        <div>
          <span className="font-semibold">Evaluation protocol. </span>
          <span className="muted">{data.protocol}</span>
          <span className="faint"> Trained {data.generated_at.slice(0, 10)} with scikit-learn {data.sklearn_version}, seed {data.seed}.</span>
        </div>
      </div>

      {/* Headline table */}
      <section className="mt-10">
        <SectionTitle title="Held-out test results" sub="Point estimate with 95% CI in brackets." />
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[var(--surface-2)] text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Model</th>
                <th className="px-3 py-2.5 font-semibold">Algorithm</th>
                <th className="px-3 py-2.5 text-right font-semibold">Test n</th>
                {['ROC-AUC', 'PR-AUC', 'Sensitivity', 'Specificity', 'F1', 'Brier'].map((h) => <th key={h} className="px-3 py-2.5 text-right font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.models.map((x) => (
                <tr key={x.key} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: MODEL_COLORS[x.key] }} />{x.name}
                  </td>
                  <td className="px-3 py-3 muted">{x.algorithm}</td>
                  <td className="px-3 py-3 text-right tnum">{x.n_test}</td>
                  {['roc_auc', 'pr_auc', 'sensitivity', 'specificity', 'f1', 'brier'].map((k) => (
                    <td key={k} className="px-3 py-3 text-right tnum">
                      <div className="font-semibold">{f3(x.test_metrics[k])}</div>
                      <div className="text-[11px] faint">[{f3(x.test_metrics_ci95[k]?.[0])}, {f3(x.test_metrics_ci95[k]?.[1])}]</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Curves */}
      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        <CurveCard title="ROC curves" sub="True vs false positive rate. Dashed = chance." models={data.models} field="roc_curve" xLabel="False positive rate" yLabel="TPR" diagonal />
        <CurveCard title="Precision–recall curves" sub="Precision vs recall across thresholds." models={data.models} field="pr_curve" xLabel="Recall" yLabel="Precision" />
        <CurveCard title="Calibration" sub="Predicted vs observed risk. Dashed = perfect." models={data.models} field="calibration_curve" xKey="predicted" yKey="observed" xLabel="Predicted" yLabel="Observed" diagonal dots />
      </section>

      {/* Per-model detail */}
      <section className="mt-12">
        <SectionTitle title="Model detail" />
        <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--surface-2)] p-1" role="tablist">
          {data.models.map((x) => (
            <button key={x.key} role="tab" aria-selected={sel === x.key} className="tab flex items-center gap-2" onClick={() => setSel(x.key)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODEL_COLORS[x.key] }} />{x.name.replace(' Risk', '')}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="font-semibold">Metrics with 95% confidence intervals</div>
            <p className="text-xs faint">Dot = point estimate on the held-out test set; bar = 95% bootstrap CI. Scale 0 → 1.</p>
            <ul className="mt-4 space-y-2.5">
              {METRICS.map(([k, label]) => {
                const v = m.test_metrics[k]; const [lo, hi] = m.test_metrics_ci95[k] || [v, v];
                const x = (n) => `${Math.max(0, Math.min(1, n)) * 100}%`;
                return (
                  <li key={k} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className="truncate">{label}</span>
                    <span className="relative h-3">
                      <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--grid)]" />
                      <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})`, background: MODEL_COLORS[m.key], opacity: 0.45 }} />
                      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(v), background: MODEL_COLORS[m.key], boxShadow: '0 0 0 2px var(--surface)' }} />
                    </span>
                    <span className="whitespace-nowrap text-right tnum"><b>{f3(v)}</b> <span className="text-[11px] faint">[{f3(lo)}–{f3(hi)}]</span></span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <div className="font-semibold">Confusion matrix <span className="font-normal faint">(threshold {f3(m.threshold)})</span></div>
              <ConfusionMatrix cm={m.confusion_matrix} />
            </div>
            <div className="card p-5">
              <div className="font-semibold">Model selection</div>
              <p className="text-xs faint">5-fold cross-validated ROC-AUC on the training split (mean ± SD). The best was calibrated and kept.</p>
              <ul className="mt-3 space-y-2">
                {m.model_comparison.map((c) => (
                  <li key={c.model} className="grid grid-cols-[9.5rem_minmax(0,1fr)_7rem] items-center gap-3 text-sm">
                    <span className={c.model === m.algorithm ? 'font-semibold' : ''}>{c.model}{c.model === m.algorithm && ' ✓'}</span>
                    <span className="relative h-2.5 rounded-full bg-[var(--surface-2)]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.cv_roc_auc_mean * 100}%`, background: c.model === m.algorithm ? MODEL_COLORS[m.key] : 'var(--axis)' }} />
                    </span>
                    <span className="text-right tnum">{f3(c.cv_roc_auc_mean)} ± {f3(c.cv_roc_auc_std)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card p-5">
            <div className="font-semibold">Feature importance</div>
            <p className="text-xs faint">Drop in test ROC-AUC when each input is randomly shuffled (permutation importance, 15 repeats).</p>
            <FeatureImportance items={m.feature_importance} color={MODEL_COLORS[m.key]} labels={data.feature_labels || {}} />
          </div>

          <div className="card p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4" style={{ color: 'var(--brand)' }} /> Data</div>
            <dl className="mt-3 grid grid-cols-[8rem_minmax(0,1fr)] gap-y-2">
              <dt className="faint">Dataset</dt><dd><a href={m.dataset_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand)]">{m.dataset} <ExternalLink className="h-3 w-3" /></a></dd>
              <dt className="faint">Predicts</dt><dd>{m.target}</dd>
              <dt className="faint">Samples</dt><dd className="tnum">{m.n_samples} ({m.n_train} train / {m.n_test} test)</dd>
              <dt className="faint">Positive rate</dt><dd className="tnum">{(m.prevalence * 100).toFixed(1)}%</dd>
              <dt className="faint">Calibration</dt><dd>{m.calibration}</dd>
              <dt className="faint">Inputs</dt><dd>{m.features.map((f) => data.feature_labels?.[f] || f).join(', ')}</dd>
            </dl>
            {m.notes && <p className="mt-3 rounded-lg bg-[var(--warn-soft)] p-3">{m.notes}</p>}
            <p className="mt-3 text-xs faint">Public benchmark datasets have different populations and base rates from real patients, so these numbers describe the benchmark, not clinical validation.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function CurveCard({ title, sub, models, field, xKey = 'x', yKey = 'y', xLabel, yLabel, diagonal, dots }) {
  return (
    <div className="card p-4">
      <div className="font-semibold">{title}</div>
      <p className="text-xs faint">{sub}</p>
      <div className="mt-1 text-[11px] faint">y: {yLabel}</div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart margin={{ top: 8, right: 8, left: -20, bottom: 12 }}>
            <CartesianGrid />
            <XAxis type="number" dataKey={xKey} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickLine={false} axisLine={{ stroke: 'var(--axis)' }}
              label={{ value: xLabel, position: 'insideBottom', offset: -6, fontSize: 11 }} />
            <YAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => Number(v).toFixed(3)} labelFormatter={(v) => `${xLabel}: ${Number(v).toFixed(3)}`} itemStyle={{ color: 'var(--ink)' }} />
            {diagonal && (
              <Line data={[{ [xKey]: 0, [yKey]: 0 }, { [xKey]: 1, [yKey]: 1 }]} dataKey={yKey} stroke="var(--axis)" strokeDasharray="4 4"
                dot={false} activeDot={false} legendType="none" isAnimationActive={false} name="Reference" tooltipType="none" />
            )}
            {models.map((m) => (
              <Line key={m.key} data={m[field]} dataKey={yKey} name={m.name.replace(' Risk', '')} stroke={MODEL_COLORS[m.key]} strokeWidth={2}
                dot={dots ? { r: 3.5, strokeWidth: 2, fill: 'var(--surface)' } : false} isAnimationActive={false} type={dots ? 'linear' : 'stepAfter'} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ModelLegend />
    </div>
  );
}

function ConfusionMatrix({ cm }) {
  const total = cm.tn + cm.fp + cm.fn + cm.tp;
  const cell = (v, label, good) => (
    <div className="rounded-lg p-3 text-center" style={{ background: good ? 'var(--good-soft)' : 'var(--critical-soft)' }}>
      <div className="text-2xl font-bold tnum">{v}</div>
      <div className="text-[11px] muted">{label} · {((v / total) * 100).toFixed(1)}%</div>
    </div>
  );
  return (
    <div className="mt-3 grid grid-cols-[5.5rem_1fr_1fr] gap-2 text-sm">
      <span />
      <span className="text-center text-xs faint">Predicted negative</span>
      <span className="text-center text-xs faint">Predicted positive</span>
      <span className="self-center text-xs faint">Actual negative</span>
      {cell(cm.tn, 'True negative', true)}
      {cell(cm.fp, 'False positive', false)}
      <span className="self-center text-xs faint">Actual positive</span>
      {cell(cm.fn, 'False negative', false)}
      {cell(cm.tp, 'True positive', true)}
    </div>
  );
}

function FeatureImportance({ items, color, labels }) {
  const max = Math.max(...items.map((i) => i.importance), 0.001);
  return (
    <ul className="mt-3 space-y-2">
      {items.map((i) => (
        <li key={i.feature} className="grid grid-cols-[8rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
          <span className="truncate">{labels[i.feature] || i.feature}</span>
          <span className="relative h-2.5 rounded-full bg-[var(--surface-2)]">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(Math.max(i.importance, 0) / max) * 100}%`, background: color }} />
          </span>
          <span className="text-right tnum text-xs">{i.importance.toFixed(3)}</span>
        </li>
      ))}
    </ul>
  );
}
