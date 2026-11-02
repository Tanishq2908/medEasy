import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useHealth } from '../lib/useHealth';
import ReportView from '../components/ReportView';
import { ErrorNote, Spinner } from '../components/ui';

export default function ReportPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const health = useHealth();
  const navigate = useNavigate();
  const [data, setData] = useState(state?.analysis || null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    if (data?.report?.id === Number(id)) return;
    api(`/api/reports/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id, user, data]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-bold">Sign in to view saved reports</h1>
        <Link to="/login" state={{ from: `/reports/${id}` }} className="btn btn-primary mt-6">Sign in</Link>
      </div>
    );
  }

  const remove = async () => {
    if (!window.confirm('Delete this report permanently?')) return;
    try { await api(`/api/reports/${id}`, { method: 'DELETE' }); navigate('/dashboard'); } catch (e) { setError(e.message); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link to="/dashboard" className="btn btn-ghost btn-sm">← My reports</Link>
        {data && <button className="btn btn-ghost btn-sm" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</button>}
      </div>
      <ErrorNote>{error}</ErrorNote>
      {!data && !error && <div className="flex items-center gap-2 muted"><Spinner /> Loading report…</div>}
      {data && <ReportView analysis={data} title={data.report?.title} date={data.report?.report_date} llmEnabled={health?.llm_enabled} />}
    </div>
  );
}
