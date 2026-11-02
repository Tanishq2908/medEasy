import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardPaste, FileUp, FlaskConical, ListChecks, Pencil, Upload } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { extractText } from '../lib/extract';
import { useHealth } from '../lib/useHealth';
import { SAMPLE_REPORT } from '../lib/sample';
import ReportView from '../components/ReportView';
import { ErrorNote, Spinner } from '../components/ui';

const TABS = [
  { id: 'upload', label: 'Upload file', Icon: FileUp },
  { id: 'paste', label: 'Paste text', Icon: ClipboardPaste },
  { id: 'manual', label: 'Enter values', Icon: ListChecks },
];

export default function Analyze() {
  const { user } = useAuth();
  const health = useHealth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [tab, setTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [text, setText] = useState('');
  const [manual, setManual] = useState({});
  const [catalog, setCatalog] = useState(null);
  const [patient, setPatient] = useState(() => ({
    age: user?.birth_year ? String(new Date().getFullYear() - user.birth_year) : '',
    sex: user?.sex || '',
    bmi: '',
  }));
  const [meta, setMeta] = useState({ title: '', report_date: new Date().toISOString().slice(0, 10) });
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (tab === 'manual' && !catalog) api('/api/analytes').then(setCatalog).catch((e) => setError(e.message));
  }, [tab, catalog]);

  const busy = Boolean(step);

  const pickFile = (f) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setError('File is larger than 15 MB.'); return; }
    setFile(f); setError('');
  };

  const run = async (overrideText) => {
    setError('');
    let body = { patient, values: {}, text: '' };
    try {
      if (overrideText !== undefined) {
        body.text = overrideText;
      } else if (tab === 'upload') {
        if (!file) { setError('Choose a PDF, image or text file first.'); return; }
        const ex = await extractText(file, setStep);
        body.text = ex.text;
        setText(ex.text);
        if (ex.patient) {
          body.patient = {
            ...patient,
            age: patient.age || ex.patient.age || '',
            sex: patient.sex || ex.patient.sex || '',
          };
          setPatient(body.patient);
        }
      } else if (tab === 'paste') {
        if (text.trim().length < 5) { setError('Paste the text of your report first.'); return; }
        body.text = text;
      } else {
        const values = Object.fromEntries(Object.entries(manual).filter(([, v]) => v !== '' && v != null));
        if (!Object.keys(values).length) { setError('Enter at least one value.'); return; }
        body.values = values;
      }
      setStep('Analysing values and running risk models…');
      const d = await api('/api/analyze', {
        method: 'POST',
        body: { ...body, title: meta.title || (file?.name ?? ''), report_date: meta.report_date, save: Boolean(user) },
      });
      if (d.report?.id) { navigate(`/reports/${d.report.id}`, { state: { analysis: d } }); return; }
      setResult(d);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
      if (tab === 'upload' && body.text) setTab('paste'); // let the user correct what was read
    } finally {
      setStep('');
    }
  };

  const trySample = () => {
    setTab('paste'); setText(SAMPLE_REPORT);
    setPatient({ age: '52', sex: 'M', bmi: '' });
    setMeta((m) => ({ ...m, title: 'Sample report' }));
    run(SAMPLE_REPORT);
  };

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return catalog.categories.map((c) => [c, catalog.analytes.filter((a) => a.category === c)]);
  }, [catalog]);

  if (result) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!user && (
          <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--brand-soft)] p-4 text-sm">
            <span>This analysis isn't saved. <strong>Create a free account</strong> to keep your reports and see trends over time.</span>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={() => setResult(null)}><Pencil className="h-4 w-4" /> Edit inputs</button>
              <Link to="/signup" className="btn btn-primary btn-sm">Create account</Link>
            </div>
          </div>
        )}
        <ReportView analysis={result} title={meta.title || 'Your results'} date={meta.report_date} llmEnabled={health?.llm_enabled} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <p className="eyebrow">Step 1 of 2</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Analyze a lab report</h1>
      <p className="mt-2 muted">
        Upload a blood test report (PDF or photo), paste its text, or type values in. We recognise {catalog ? catalog.analytes.length : '45+'} common tests
        across blood count, sugar, lipids, liver, kidney, thyroid, vitamins and more.
      </p>

      <div className="card mt-6 p-4 sm:p-6">
        <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--surface-2)] p-1" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} role="tab" className="tab flex flex-1 items-center justify-center gap-2" aria-selected={tab === id} onClick={() => setTab(id)}>
              <Icon className="h-4 w-4" /> <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'upload' && (
            <div
              className={`grid place-items-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border-strong)]'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
            >
              <Upload className="h-8 w-8 faint" />
              <p className="mt-3 font-semibold">{file ? file.name : 'Drop your report here'}</p>
              <p className="mt-1 text-sm muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : 'PDF, JPG, PNG, WEBP or TXT · up to 15 MB'}</p>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*,text/plain"
                onChange={(e) => pickFile(e.target.files?.[0])} />
              <button className="btn btn-secondary btn-sm mt-4" onClick={() => fileRef.current?.click()}>{file ? 'Choose a different file' : 'Browse files'}</button>
            </div>
          )}

          {tab === 'paste' && (
            <div>
              <label htmlFor="report-text" className="label">Report text</label>
              <textarea id="report-text" className="input font-mono text-xs" rows={14} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={'Haemoglobin   13.2   g/dL   13.0 - 17.0\nGlucose Fasting   104   mg/dL   70 - 100\nTSH   2.1   uIU/mL   0.4 - 4.5'} />
              <p className="mt-1 text-xs faint">One test per line works best. You can edit text that was read from a file here.</p>
            </div>
          )}

          {tab === 'manual' && (
            <div className="space-y-5">
              {!catalog && <div className="flex items-center gap-2 muted"><Spinner /> Loading test list…</div>}
              {grouped.map(([cat, items]) => (
                <fieldset key={cat}>
                  <legend className="eyebrow mb-2">{cat}</legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((a) => (
                      <div key={a.key}>
                        <label htmlFor={`m-${a.key}`} className="label">{a.name} <span className="font-normal faint">{a.unit}</span></label>
                        <input id={`m-${a.key}`} type="number" step="any" inputMode="decimal" className="input tnum"
                          placeholder={a.ref_low != null ? `${a.ref_low}–${a.ref_high}` : ''}
                          value={manual[a.key] ?? ''} onChange={(e) => setManual((m) => ({ ...m, [a.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <div className="text-sm font-semibold">About you <span className="font-normal faint">(improves reference ranges and risk estimates)</span></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="age" className="label">Age</label>
              <input id="age" type="number" min="1" max="119" className="input" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} placeholder="Read from report if blank" />
            </div>
            <div>
              <label htmlFor="sex" className="label">Sex</label>
              <select id="sex" className="input" value={patient.sex} onChange={(e) => setPatient({ ...patient, sex: e.target.value })}>
                <option value="">Read from report</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </div>
            <div>
              <label htmlFor="bmi" className="label">BMI <span className="font-normal faint">(optional)</span></label>
              <input id="bmi" type="number" step="0.1" className="input" value={patient.bmi} onChange={(e) => setPatient({ ...patient, bmi: e.target.value })} />
            </div>
          </div>
          {user && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="title" className="label">Report name</label>
                <input id="title" className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="e.g. Annual check-up" />
              </div>
              <div>
                <label htmlFor="date" className="label">Report date</label>
                <input id="date" type="date" className="input" value={meta.report_date} onChange={(e) => setMeta({ ...meta, report_date: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <ErrorNote>{error}</ErrorNote>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={() => run()} disabled={busy}>
              {busy ? <><Spinner /> {step}</> : <><FlaskConical className="h-4 w-4" /> Analyze report</>}
            </button>
            <button className="btn btn-ghost" onClick={trySample} disabled={busy}>Try a sample report</button>
          </div>
          <p className="text-xs faint">
            {user ? 'Results are saved to your account so you can track trends.' : 'Not signed in: results are shown once and not stored.'}
            {health && health.status !== 'ok' && ' The analysis server is not responding.'}
          </p>
        </div>
      </div>
    </div>
  );
}
