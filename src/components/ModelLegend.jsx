import { MODEL_COLORS } from '../lib/format';

const ORDER = ['diabetes', 'liver', 'ckd', 'thyroid'];
const NAMES = { diabetes: 'Type 2 Diabetes', liver: 'Liver Disease', ckd: 'Chronic Kidney Disease', thyroid: 'Hypothyroidism' };

/** Fixed-order legend for the four models; text stays in ink, the swatch carries identity. */
export default function ModelLegend({ keys = ORDER }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs muted">
      {ORDER.filter((k) => keys.includes(k)).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODEL_COLORS[k] }} />{NAMES[k]}
        </li>
      ))}
    </ul>
  );
}
