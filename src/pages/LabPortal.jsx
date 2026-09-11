import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UploadCloud, FileText, CheckCircle2, ShieldAlert,
  FlaskConical, Plus, X, Loader2, Send, User, Mail, Activity,
  Clock, ChevronRight, Trash2, Eye
} from 'lucide-react';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../apiConfig';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const TEST_TYPES = [
  'Blood Test (CBC)',
  'ECG Report',
  'Kidney Stone (Ultrasound)',
  'Lung Cancer (CT Scan)',
  'Brain Tumor (MRI)',
];

export default function LabPortal() {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const [patients, setPatients] = useState([]);        // lab appointments from backend
  const [labAppointments, setLabAppointments] = useState([]);
  const [aptsLoading, setAptsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [chartMode, setChartMode] = useState('daily');
  const [uploadedReports, setUploadedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [form, setForm] = useState({
    patientEmail: '',
    patientName: '',
    testType: TEST_TYPES[0],
    reportTitle: '',
    notes: '',
    appointmentId: null,
  });
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  // Load appointments from DATABASE
  useEffect(() => {
    localStorage.removeItem('hackathon_patients'); // clear old data
    if (!token) return;
    fetchLabAppointments();
    fetchMyUploads();
  }, [token]);

  const fetchLabAppointments = async () => {
    setAptsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments/lab`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setLabAppointments(data);
        // Also set legacy patients for compatibility with existing table code
        setPatients(data);
      }
    } catch (err) {
      console.error('Failed to load lab appointments:', err);
    } finally {
      setAptsLoading(false);
    }
  };

  const fetchMyUploads = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/lab-reports/my-uploads`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setUploadedReports(data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleLegacyUpload = (id, e) => {
    if (!e.target.files || !e.target.files[0]) return;
    const fileName = e.target.files[0].name;
    const newPatients = patients.map(p => p.id === id ? { ...p, uploaded: true, file: fileName } : p);
    setPatients(newPatients);
    localStorage.setItem('hackathon_patients', JSON.stringify(newPatients));
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      // Auto-fill title
      if (!form.reportTitle) {
        setForm(prev => ({ ...prev, reportTitle: f.name.replace(/\.[^/.]+$/, '') }));
      }
    }
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!file) { setUploadError('Please select a file.'); return; }
    if (!form.patientEmail) { setUploadError('Patient email is required.'); return; }

    setUploading(true);
    setUploadError('');

    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`${API_BASE_URL}/api/lab-reports/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({
          patientEmail: form.patientEmail,
          patientName: form.patientName,
          testType: form.testType,
          reportTitle: form.reportTitle || file.name,
          notes: form.notes,
          fileBase64: base64,
          fileType: file.type,
          fileName: file.name,
          appointmentId: form.appointmentId,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Upload failed.');

      setUploadSuccess(true);
      fetchMyUploads(); // refresh list

      // Reset after delay
      setTimeout(() => {
        setShowUpload(false);
        setUploadSuccess(false);
        setForm({ patientEmail: '', patientName: '', testType: TEST_TYPES[0], reportTitle: '', notes: '', appointmentId: null });
        setFile(null);
      }, 2000);

    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetUploadModal = () => {
    setShowUpload(false);
    setUploadSuccess(false);
    setUploadError('');
    setForm({ patientEmail: '', patientName: '', testType: TEST_TYPES[0], reportTitle: '', notes: '', appointmentId: null });
    setFile(null);
  };

  const openUploadForAppointment = (appointment) => {
    setForm({
      patientEmail: appointment.patientEmail,
      patientName: appointment.patientName,
      testType: appointment.test,
      reportTitle: '',
      notes: '',
      appointmentId: appointment._id
    });
    setFile(null);
    setUploadError('');
    setShowUpload(true);
  };


  // Stats using DB appointment data (status field from MongoDB)
  const activePatients = labAppointments.filter(p => p.status !== 'cancelled');
  const doneCount = activePatients.filter(p => p.status === 'uploaded').length;
  const pendingCount = activePatients.filter(p => p.status === 'pending').length;

  const filtered = labAppointments.filter(p => {
    const matchSearch = (p.patientName || '').toLowerCase().includes(search.toLowerCase()) ||
                        (p.bid || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
        filter === 'pending' ? p.status === 'pending' :
          filter === 'uploaded' ? p.status === 'uploaded' :
            filter === 'cancelled' ? p.status === 'cancelled' : true;
    return matchSearch && matchFilter;
  });

  const statusColor = {
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    viewed: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    analysed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  const generateChartData = () => {
    if (!labAppointments || labAppointments.length === 0) return { daily: [], hourly: [], monthly: [] };
    const daily = {}; const hourly = {}; const monthly = {};
    const daysOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const slotOrder = ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '04:30 PM', '06:00 PM'];

    labAppointments.forEach(r => {
      if (!r.date || !r.slot) return;
      // Parse date to get day/month accurately
      const d = new Date(r.date + 'T12:00:00'); 
      const day = daysOrder[d.getDay()];
      const month = monthsOrder[d.getMonth()];
      const hour = r.slot; // Map to the specific booked slot

      daily[day] = (daily[day] || 0) + 1;
      hourly[hour] = (hourly[hour] || 0) + 1;
      monthly[month] = (monthly[month] || 0) + 1;
    });

    const formatData = (obj) => Object.entries(obj).map(([name, count]) => ({ name, count }));
    
    return {
      daily: formatData(daily).sort((a,b) => daysOrder.indexOf(a.name) - daysOrder.indexOf(b.name)),
      hourly: formatData(hourly).sort((a,b) => slotOrder.indexOf(a.name) - slotOrder.indexOf(b.name)),
      monthly: formatData(monthly).sort((a,b) => monthsOrder.indexOf(a.name) - monthsOrder.indexOf(b.name))
    };
  };
  const charts = generateChartData();

  // Dynamic Chart Colors
  const chartTextColor = 'var(--text-muted)';
  const chartGridColor = 'var(--border-subtle)';
  const tooltipBg = 'var(--glass-bg)';
  const tooltipBorder = 'var(--glass-border)';

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 bg-mesh min-h-screen">
      <div className="fixed inset-0 bg-transparent -z-10" />
      <div className="blob w-[600px] h-[600px] bg-cyan-500/5 -top-40 -left-60 blur-[150px]" />
      <div className="blob w-[500px] h-[500px] bg-emerald-500/5 -bottom-40 -right-40 blur-[150px]" />

      {/* Header */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-emerald-500" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-[var(--text-main)]">Lab Portal</h1>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60">
            {user?.name} · Clinical Diagnostics Terminal
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.05 }} className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
        {[
          { label: 'Appointments', value: activePatients.length, color: 'text-cyan-400', bg: 'bg-[var(--input-bg)] border-[var(--glass-border)]' },
          { label: 'Reports Uploaded', value: uploadedReports.length, color: 'text-emerald-400', bg: 'bg-[var(--input-bg)] border-[var(--glass-border)]' },
          { label: 'Viewed by Patient', value: uploadedReports.filter(r => r.status !== 'pending').length, color: 'text-violet-400', bg: 'bg-[var(--input-bg)] border-[var(--glass-border)]' },
          { label: 'Pending Lab Upload', value: pendingCount, color: 'text-amber-400', bg: 'bg-[var(--input-bg)] border-[var(--glass-border)]' },
        ].map((stat, i) => (
          <div key={i} className={cn("glass-panel p-6 rounded-[28px] border flex flex-col items-center text-center", stat.bg)}>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">{stat.label}</p>
            <p className={cn("text-4xl font-black", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ── DATA SCIENCE GRAPHS ── */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="glass-panel p-10 rounded-[40px] border-[var(--glass-border)] mb-10 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 flex items-center gap-3">
            <Activity className="w-4 h-4" /> Data Science: Appointment Trends
          </h2>
          <div className="flex bg-[var(--input-bg)] p-1.5 rounded-2xl border border-[var(--glass-border)] w-fit">
            {['daily', 'hourly', 'monthly'].map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn("px-6 py-2.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest transition-all", 
                chartMode === m ? 'bg-violet-500/10 text-violet-500 shadow-lg border border-violet-500/20' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]')}
              >{m}</button>
            ))}
          </div>
        </div>
        
        {labAppointments.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest opacity-40">
            No booking data available
          </div>
        ) : (
          <div className="bg-[var(--input-bg)] p-8 rounded-3xl border border-[var(--input-border)]">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === 'daily' ? (
                  <BarChart data={charts.daily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                    <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4,4,0,0]} />
                  </BarChart>
                ) : chartMode === 'hourly' ? (
                  <LineChart data={charts.hourly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                    <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px' }} />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                ) : (
                  <BarChart data={charts.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                    <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </motion.div>



      {/* Legacy Appointment Table */}
      {patients.length > 0 && (
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.15 }} className="glass-panel p-10 rounded-[40px] border-[var(--glass-border)] shadow-lg">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-8 flex items-center gap-3">
            <Activity className="w-4 h-4 text-cyan-500" /> Booked Appointments
          </h2>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex bg-[var(--input-bg)] p-1.5 rounded-2xl border border-[var(--glass-border)]">
              {['all', 'pending', 'uploaded', 'cancelled'].map(f => (
                <button key={f}
                  className={cn("px-5 py-2.5 rounded-[12px] text-[10px] font-black uppercase tracking-widest flex-1", filter === f ? 'bg-cyan-500/10 text-cyan-400' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors')}
                  onClick={() => setFilter(f)}
                >{f}</button>
              ))}
            </div>
            <div className="relative flex-grow max-w-xs">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />
              <input type="text" placeholder="Search patient / ID..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-3 pl-10 pr-4 text-xs font-medium uppercase tracking-wider outline-none focus:border-cyan-500/50 transition-all text-[var(--text-main)] placeholder:text-[var(--text-muted)] placeholder:opacity-30 shadow-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--glass-border)] text-[var(--text-muted)] text-[9px] font-black uppercase tracking-[0.15em] opacity-60">
                  <th className="pb-4 px-4">Patient</th>
                  <th className="pb-4 px-4">Booking ID</th>
                  <th className="pb-4 px-4">Test</th>
                  <th className="pb-4 px-4">Status</th>
                  <th className="pb-4 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.length === 0 ? (
                  <tr><td colSpan="5" className="py-12 text-center text-[var(--text-muted)] opacity-20 text-[10px] font-black uppercase tracking-widest">No records found</td></tr>
                ) : filtered.map(p => (
                  <tr key={p._id} className="hover:bg-[var(--accent-primary)]/5 transition-colors">
                    <td className="py-5 px-4">
                      <div className="font-bold text-sm text-[var(--text-main)]">{p.patientName}</div>
                    </td>
                    <td className="py-5 px-4">
                      <span className="bg-[var(--input-bg)] px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold text-cyan-400">{p.bid}</span>
                    </td>
                    <td className="py-5 px-4">
                      <div className="text-sm font-bold text-[var(--text-main)] mb-0.5">{p.test}</div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase opacity-60">{p.date} · {p.slot}</div>
                    </td>
                    <td className="py-5 px-4">
                      {p.status === 'cancelled' ? (
                        <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Cancelled</span>
                      ) : p.status === 'uploaded' ? (
                        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Report Uploaded</span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Pending</span>
                      )}
                    </td>
                    <td className="py-5 px-4 text-right">
                      {p.status === 'cancelled' ? (
                        <span className="text-rose-500/40 text-[10px] font-black uppercase tracking-widest flex items-center justify-end gap-2"><ShieldAlert className="w-3 h-3" /> Cancelled</span>
                      ) : p.status === 'uploaded' ? (
                        <span className="text-[9px] text-[var(--text-muted)] opacity-20 font-black uppercase tracking-widest">{p.city}</span>
                      ) : (
                        <button
                          onClick={() => openUploadForAppointment(p)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/30"
                        >
                          Upload Report
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ─── Upload Modal ─── */}
      <AnimatePresence>
        {showUpload && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={resetUploadModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50"
            />
            <div className="fixed inset-0 flex items-start justify-center z-[60] p-4 overflow-y-auto">
              <div className="my-auto w-full flex items-center justify-center py-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg glass-panel rounded-[36px] border border-white/10 shadow-[0_0_100px_-20px_rgba(0,0,0,1)] overflow-hidden"
              >
                {/* Modal Header */}
                <div className="px-8 pt-8 pb-5 border-b border-[var(--glass-border)] flex items-center justify-between sticky top-0 bg-[var(--bg-main)] z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <UploadCloud className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-base font-black uppercase tracking-tighter text-[var(--text-main)]">Upload Lab Report</h2>
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60">Send directly to patient</p>
                    </div>
                  </div>
                  <button onClick={resetUploadModal} className="w-9 h-9 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--glass-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all border border-[var(--glass-border)] shadow-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {uploadSuccess ? (
                  <div className="py-20 flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black uppercase tracking-tighter text-white mb-2">Report Uploaded!</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Patient will see it on their dashboard</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUploadReport} className="p-7 space-y-4">
                    {/* Patient Name (readonly, pre-filled from appointment) */}
                    {form.patientName ? (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                        <User className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">Patient</p>
                          <p className="text-sm font-black text-[var(--text-main)]">{form.patientName}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-2 block">Patient Name *</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50" />
                          <input
                            type="text"
                            required
                            value={form.patientName}
                            onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))}
                            placeholder="Patient full name"
                            className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-3 pl-12 pr-4 text-sm font-medium text-[var(--text-main)] outline-none focus:border-emerald-500/50 transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-30 shadow-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Test Type */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-2 block">Test Type *</label>
                      <select
                        value={form.testType}
                        onChange={e => setForm(p => ({ ...p, testType: e.target.value }))}
                        className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--text-main)] outline-none focus:border-emerald-500/50 transition-all appearance-none shadow-sm"
                      >
                        {TEST_TYPES.map(t => <option key={t} value={t} className="bg-[var(--bg-main)] text-[var(--text-main)]">{t}</option>)}
                      </select>
                    </div>
                    {/* Report Title */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-2 block">Report Title *</label>
                      <input
                        type="text"
                        required
                        value={form.reportTitle}
                        onChange={e => setForm(p => ({ ...p, reportTitle: e.target.value }))}
                        placeholder="e.g. CBC Report – April 2026"
                        className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--text-main)] outline-none focus:border-emerald-500/50 transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-30 shadow-sm"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-2 block">Technician Notes (optional)</label>
                      <textarea
                        value={form.notes}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Any notes for the patient or AI..."
                        rows={2}
                        className="w-full bg-[var(--input-bg)] border border-[var(--glass-border)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--text-main)] outline-none focus:border-emerald-500/50 transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-30 shadow-sm resize-none"
                      />
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] mb-2 block">
                        Report File * (PDF or Image)
                      </label>
                      <label className="relative block cursor-pointer group">
                        <input
                          type="file"
                          ref={fileRef}
                          className="absolute inset-0 opacity-0 w-full h-full"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileSelect}
                        />
                        <div className={cn("py-5 rounded-2xl border-2 border-dashed text-center transition-all",
                          file ? "border-emerald-500/40 bg-emerald-500/5" : "border-[var(--border-subtle)] hover:border-cyan-500/30 bg-[var(--input-bg)]"
                        )}>
                          {file ? (
                            <div className="flex items-center justify-center gap-3">
                              <FileText className="w-5 h-5 text-emerald-500" />
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{file.name}</span>
                              <span className="text-[9px] text-white/30">({(file.size / 1024).toFixed(0)} KB)</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-3 opacity-40">
                              <UploadCloud className="w-5 h-5 text-[var(--text-muted)]" />
                              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Click to select file</span>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {uploadError && (
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-4 py-3 rounded-2xl border border-rose-500/20">
                        {uploadError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={uploading || !file || !form.patientEmail}
                      className="w-full h-12 rounded-[18px] bg-emerald-600 font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-3 group"
                    >
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Send to Patient</>
                      )}
                    </Button>
                  </form>
                )}
              </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
