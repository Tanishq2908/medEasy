import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { ErrorNote, Spinner } from '../components/ui';

function Shell({ title, sub, children, footer }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 muted">{sub}</p>
      <div className="card mt-6 p-6">{children}</div>
      <p className="mt-4 text-center text-sm muted">{footer}</p>
    </div>
  );
}

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: form });
      signIn(d.user, d.token);
      navigate(state?.from || '/dashboard');
    } catch (ex) { setError(ex.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Sign in" sub="Access your saved reports and trends." footer={<>New here? <Link to="/signup" className="font-semibold text-[var(--brand)]">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />} Sign in</button>
      </form>
    </Shell>
  );
}

export function Signup() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', sex: '', birth_year: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const d = await api('/api/auth/register', { method: 'POST', body: form });
      signIn(d.user, d.token);
      navigate('/analyze');
    } catch (ex) { setError(ex.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Create your account" sub="Save every report and watch your values change over time." footer={<>Already registered? <Link to="/login" className="font-semibold text-[var(--brand)]">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label" htmlFor="name">Name</label><input id="name" required className="input" autoComplete="name" value={form.name} onChange={set('name')} /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" required className="input" autoComplete="email" value={form.email} onChange={set('email')} /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" minLength={8} required className="input" autoComplete="new-password" value={form.password} onChange={set('password')} /><p className="mt-1 text-xs faint">At least 8 characters.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="sex">Sex</label>
            <select id="sex" className="input" value={form.sex} onChange={set('sex')}><option value="">Prefer not to say</option><option value="F">Female</option><option value="M">Male</option></select>
          </div>
          <div><label className="label" htmlFor="by">Birth year</label><input id="by" type="number" min="1900" max={new Date().getFullYear()} className="input" value={form.birth_year} onChange={set('birth_year')} /></div>
        </div>
        <p className="text-xs faint">Sex and age select the right reference ranges and feed the risk models.</p>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />} Create account</button>
      </form>
    </Shell>
  );
}
