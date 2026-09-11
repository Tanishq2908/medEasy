import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, FileText, Activity, HeartPulse, ShieldAlert, User, LogOut, Loader2, Microscope, Sparkles, ChevronRight, TrendingUp, ArrowRight, Eye, FlaskConical, ExternalLink, Droplets } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../apiConfig';
import HealthChatbot from '../components/HealthChatbot';
import { motion } from 'framer-motion';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

export default function PatientDashboard() {
  const { user, token, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [reportModal, setReportModal] = useState({ open: false, test: '', name: '', bid: '', loading: false });
  const [labReports, setLabReports] = useState([]);
  const [labReportsLoading, setLabReportsLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }

    // Clear old localStorage appointment data
    localStorage.removeItem('hackathon_patients');

    // Fetch appointments from backend
    const fetchAppointments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/appointments/my`, {
          headers: { 'x-auth-token': token }
        });
        if (res.ok) {
          const data = await res.json();
          setAppointments(data);
        }
      } catch (err) {
        console.error('Appointments fetch error:', err);
      }
    };
    fetchAppointments();

    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/patient-diagnosis/history`, {
          headers: { "x-auth-token": token }
        });
        const data = await response.json();
        if (Array.isArray(data)) setHistory(data);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setHistory(prev => [...prev]); // trigger re-render
        setLoading(false);
      }
    };

    fetchHistory();

    // Fetch lab reports
    const fetchLabReports = async () => {
      setLabReportsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/lab-reports/my-reports`, {
          headers: { 'x-auth-token': token }
        });
        if (res.ok) {
          const data = await res.json();
          setLabReports(data);
        }
      } catch (err) {
        console.error('Lab reports fetch error:', err);
      } finally {
        setLabReportsLoading(false);
      }
    };
    fetchLabReports();

    return () => {};
  }, [token, user, navigate]);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const showReport = (testType, name, bid) => {
    setReportModal({ open: true, test: testType, name, bid, loading: true });
    setTimeout(() => {
      setReportModal(prev => ({ ...prev, loading: false }));
    }, 1800);
  };

  const mockEcg = {
    model: 'MaxViT ECG Model', icon: '🫀', iconColor: 'from-cyan-400 to-blue-600',
    prediction: 'Patient with Abnormal Heartbeat', confidence: '87.4%', risk: 'Moderate',
    reasoning: 'The ECG waveform shows irregular rhythm patterns with QRS complex deviations. ST segments appear borderline with occasional premature ventricular contractions (PVCs) detected.',
    recs: ['Holter monitoring recommended for 24-48 hours', 'Avoid strenuous physical activity', 'Schedule cardiologist follow-up within 72 hours', 'Monitor blood pressure daily']
  };
  const mockAI = {
    model: 'Clinical Vision AI', icon: '🧠', iconColor: 'from-indigo-400 to-purple-600',
    prediction: 'No significant abnormalities detected', confidence: '91.2%', risk: 'Low',
    reasoning: 'The uploaded report has been analysed by the Llama 3.2 Vision model. All key biomarkers and visual indicators appear within normal clinical ranges for this patient demographic.',
    recs: ['Routine annual checkup recommended', 'Maintain current diet and lifestyle', 'Hydration and rest advised', 'Re-test if symptoms persist beyond 2 weeks']
  };

  const currentResult = (reportModal.test === 'ECG') ? mockEcg : mockAI;

  if (!user) return null;

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 bg-mesh min-h-screen">

      <div className="fixed inset-0 bg-transparent -z-10" />
      <div className="blob w-[500px] h-[500px] bg-cyan-500/5 -top-40 -left-40" />
      <div className="blob w-[500px] h-[500px] bg-purple-500/5 -bottom-40 -right-40" />

      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="flex items-center justify-between mb-12"
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20 ring-4 ring-cyan-500/10">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-black tracking-tight">{user.name}</h1>
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest">Active</div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">Patient Logic Terminal</p>
          </div>
        </div>


      </motion.div>

      {/* Diagnostic Tools */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-4 ml-2 text-[var(--text-muted)]">Core Diagnostic Arrays</h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
          {[
            { id: 'appointments', label: 'Book Appointment', icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: 'Schedule Labs & Docs', to: '/appointments/book' },
            { id: 'report', label: 'Report Lab', icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/20', desc: 'Blood & Vitals', to: '/analyze-patient?mode=report' },
            { id: 'ecg', label: 'ECG Analysis', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', desc: 'Cardiac Rhythm', to: '/analyze-patient?mode=ecg' },
            { id: 'mri', label: 'MRI Scanner', icon: Microscope, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20', desc: 'Magnetic Resonance', to: '/analyze-patient?mode=mri' },
            { id: 'ct', label: 'CT Scanner', icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', desc: '3D Imaging', to: '/analyze-patient?mode=ct' },
            { id: 'kidney', label: 'Kidney Scan', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', desc: 'Stone Detection', to: '/analyze-patient?mode=kidney' },
          ].map((item, idx) => (
            <Link
              key={item.id}
              to={item.to}
              className="glass-panel p-6 rounded-[32px] transition-all hover:scale-[1.05] hover:shadow-2xl text-center group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4 border-2 group-hover:scale-110 transition-transform duration-500 bg-mesh shadow-xl", item.bg, item.color)}>
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.1em] mb-1">{item.label}</h3>
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">{item.desc}</p>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">

        {/* Vitals Chart */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.1 }}
          className="lg:col-span-8 glass-panel p-8 rounded-[32px] flex flex-col min-h-[400px] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] -z-10 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Health Trajectory</h2>
            </div>
            <div className="text-[10px] font-black text-cyan-500 bg-cyan-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest">Real-time Feed</div>
          </div>

          <div className="flex-grow flex items-center justify-center">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-[var(--text-muted)] opacity-10 mx-auto mb-6" />
                <p className="text-base text-[var(--text-muted)] font-black uppercase tracking-widest opacity-30">Null Data Stream</p>
                <p className="text-xs text-[var(--text-muted)] opacity-20 mt-2 font-bold uppercase tracking-widest">Initialize a diagnostic scan to start tracking</p>
              </div>
            ) : (
              <div className="w-full h-full min-h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.map(h => ({
                    date: new Date(h.date).toLocaleDateString(),
                    value: Number(h.overallScore || h.health_score || 75),
                    type: h.type
                  }))} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} dy={10} />
                    <YAxis reversed={false} stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fontWeight: 800 }} tickFormatter={(val) => `${val}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--glass-bg)',
                        borderColor: 'var(--glass-border)',
                        borderRadius: '16px',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        boxShadow: 'var(--panel-shadow)',
                        backdropFilter: 'blur(10px)'
                      }}
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" animationDuration={2000} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>

        {/* AI Assistant Card */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.2 }}
          onClick={() => setIsChatOpen(true)}
          className="lg:col-span-4 glass-panel p-10 rounded-[32px] flex flex-col items-start text-left gap-6 relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/5 to-[var(--accent-secondary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="w-16 h-16 rounded-[24px] bg-[var(--accent-primary)]/10 flex items-center justify-center border-2 border-[var(--accent-primary)]/20 shadow-xl group-hover:scale-110 transition-transform duration-500">
            <Sparkles className="w-8 h-8 text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-base font-black uppercase tracking-[0.2em]">JARVIS</h2>
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest">AI Health Assist</div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-wider opacity-60 leading-relaxed">
              Retrieve clinical insights from your specific history or query our biological knowledge archives via the intelligence engine.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-black text-[var(--accent-primary)] group-hover:gap-4 transition-all uppercase tracking-widest mt-auto">
            Initialize Session <ArrowRight className="w-4 h-4" />
          </div>
        </motion.div>
      </div>

      {/* Advanced Section */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.4 }}
        className="mb-12"
      >
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-6 ml-2 text-[var(--text-muted)]">Experimental Subsystems</h2>
        <Link
          to="/cancer-analysis-patient"
          className="glass-panel p-8 rounded-[32px] border-2 border-rose-500/30 transition-all hover:border-rose-500/50 hover:scale-[1.01] group relative overflow-hidden block"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[80px] -z-10 group-hover:opacity-30 transition-opacity" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center shadow-xl shadow-rose-500/30 group-hover:scale-105 transition-transform duration-500">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-base font-black uppercase tracking-wider text-rose-500">Oncology Logic Array</h3>
                <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">Critical Access</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider opacity-60 max-w-2xl">Neural networks for multi-stage cancer detection, volumetric staging, and genomic correlation across captured clinical media.</p>
            </div>
            <div className="flex-shrink-0 group-hover:translate-x-2 transition-transform duration-300 hidden md:block">
              <ArrowRight className="w-8 h-8 text-rose-500 opacity-20" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Active Appointments */}
      {appointments.length > 0 && (
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.45 }} className="glass-panel p-10 rounded-[40px] mb-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Calendar className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-[0.2em]">Active Appointments</h2>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] opacity-60">Live Tracking</p>
            </div>
          </div>
          <div className="space-y-4">
            {appointments.map((p) => (
              <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl bg-[var(--input-bg)] border border-[var(--glass-border)] shadow-lg group hover:border-[var(--accent-primary)]/40 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--bg-main)]/50 rounded-xl flex items-center justify-center text-cyan-500 shrink-0 border border-[var(--glass-border)]"><Activity className="w-5 h-5" /></div>
                  <div>
                    <div className="text-sm font-bold tracking-tight mb-1">{p.lab} <span className="text-[var(--text-muted)] mx-2">/</span> <span className="text-cyan-400">{p.test}</span></div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-60">ID: {p.bid} · {p.doctor} · {p.date}</div>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3 w-full md:w-auto">
                  {p.cancelled ? (
                    <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Cancelled</span>
                  ) : p.uploaded ? (
                    <div className="flex items-center gap-3">
                      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">✔ Ready: {p.file}</span>
                      <button onClick={() => showReport(p.test, p.name, p.bid)} className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-colors flex items-center gap-2"><Eye className="w-3 h-3" /> Show AI Report</button>
                    </div>
                  ) : (
                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Pending Lab Upload</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Lab Reports from Facility */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.48 }}
        className="glass-panel p-10 rounded-[40px] mb-12 border-[var(--glass-border)] shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px]" />
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <FlaskConical className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-[0.2em] text-[var(--text-main)]">Lab Reports</h2>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] opacity-60">From Your Diagnostic Facility</p>
            </div>
          </div>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40">{labReports.length} Report{labReports.length !== 1 ? 's' : ''}</p>
        </div>

        {labReportsLoading ? (
          <div className="py-12 flex justify-center items-center gap-4 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Syncing lab data...</p>
          </div>
        ) : labReports.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-[var(--border-subtle)] shadow-lg rounded-[28px]">
            <FlaskConical className="w-12 h-12 text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-40">No lab reports received</p>
            <p className="text-[9px] text-[var(--text-muted)] opacity-20 mt-2 font-bold uppercase tracking-widest">Reports uploaded by your lab will appear here</p>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            {labReports.map(report => (
              <div key={report._id}
                className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[24px] bg-[var(--input-bg)] border border-[var(--glass-border)] shadow-lg hover:border-emerald-500/30 transition-all group"
              >
                <div className="flex items-center gap-5 mb-4 md:mb-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                    <FileText className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-main)] mb-0.5">{report.reportTitle}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-wider">{report.testType}</span>
                      <span className="text-[10px] text-[var(--text-muted)] opacity-60">{report.labName}</span>
                      <span className="text-[10px] text-[var(--text-muted)] opacity-40">· {new Date(report.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {report.status === 'analysed' && (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">✓ AI Analysed</span>
                  )}
                  {report.status === 'viewed' && (
                    <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Viewed</span>
                  )}
                  {report.status === 'pending' && (
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">New</span>
                  )}
                  <button
                    onClick={() => navigate(`/lab-report/${report._id}`)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/30 group-hover:shadow-emerald-900/50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View + AI Analysis
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* History Array */}
      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.5 }}
        className="glass-panel p-10 rounded-[40px] mb-12 relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <FileText className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-[0.2em]">Diagnostic Archives</h2>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-40 mt-1">{history.length} RECORDS FOUND</p>
            </div>
          </div>

          {history.length > 1 && (
            <button
              onClick={() => navigate('/compare-reports')}
              className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              Compare Clinical Timeline
            </button>
          )}
        </div>

        <div className="min-h-[200px]">
          {loading ? (
            <div className="py-16 flex flex-col justify-center items-center text-[var(--text-muted)] gap-6">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-500 opacity-50" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Decrypting clinical history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-[var(--glass-border)] shadow-lg rounded-[32px] group">
              <FileText className="w-16 h-16 text-[var(--text-muted)] opacity-5 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" />
              <p className="text-sm text-[var(--text-muted)] font-black uppercase tracking-widest opacity-30">Archives Empty</p>
              <p className="text-[10px] text-[var(--text-muted)] opacity-20 mt-3 font-bold uppercase tracking-widest">Awaiting primary diagnostic capture</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--glass-border)] shadow-lg text-[var(--text-muted)] text-[11px] font-black uppercase tracking-[0.3em]">
                    <th className="pb-6 px-6">Timestamp</th>
                    <th className="pb-6 px-6">Module</th>
                    <th className="pb-6 px-6">Insight Stream</th>
                    <th className="pb-6 px-6 text-right">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {history.map((item, idx) => (
                    <motion.tr
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      key={item._id}
                      className="hover:bg-cyan-500/[0.03] transition-colors group cursor-pointer"
                    >
                      <td className="py-6 px-6 text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-widest">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="py-6 px-6">
                        <span className="text-[11px] font-black text-cyan-400 uppercase tracking-widest px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20">{item.type?.toUpperCase() || 'REPORT'}</span>
                      </td>
                      <td className="py-6 px-6 text-xs text-[var(--text-muted)] max-w-lg font-medium opacity-60 group-hover:opacity-100 transition-opacity truncate">
                        {item.summary || item.prediction || `Neural analysis sequence completed for ${item.type?.toUpperCase()}`}
                      </td>
                      <td className="py-6 px-6 text-right">
                        <div className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                          <ChevronRight className="w-4 h-4 text-cyan-500" />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Floating AI Assistant */}
      <HealthChatbot
        patientData={{ name: user.name, history: history, trends: history }}
        externalOpen={isChatOpen}
        setExternalOpen={setIsChatOpen}
      />

      {/* Report Summary Modal from Booking/Lab Flow */}
      {reportModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-main)] p-0 rounded-[32px] w-full max-w-2xl border border-[var(--glass-border)] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentResult.iconColor} flex items-center justify-center text-2xl shadow-lg`}>{currentResult.icon}</div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">Analysed By</div>
                  <div className="font-bold text-sm text-[var(--text-main)] uppercase tracking-wider">{currentResult.model}</div>
                </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-[var(--input-bg)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]" onClick={() => setReportModal({ open: false, test: '', name: '', bid: '', loading: false })}>✕</button>
            </div>

            <div className="p-8 overflow-y-auto w-[100%] hide-scrollbar">
              {reportModal.loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <span className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mb-6"></span>
                  <div className="text-xs font-black uppercase tracking-[0.3em]">Deploying AI Matrix...</div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Patient Profile Segment</div>
                    <div className="text-lg font-bold">{reportModal.name} <span className="text-xs font-mono text-[var(--text-muted)] opacity-60 ml-3">{reportModal.bid}</span></div>
                  </div>
                  <hr className="border-[var(--border-subtle)] border-dashed" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--input-bg)] rounded-2xl p-6 border border-[var(--glass-border)]">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3 flex items-center gap-2"><Eye className="w-3 h-3 text-cyan-400" /> AI Hypothesis</div>
                      <div className="text-xl font-black uppercase tracking-tight leading-tight">{currentResult.prediction}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[var(--input-bg)] rounded-2xl p-5 border border-[var(--glass-border)] flex flex-col justify-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-1">Confidence</div>
                        <div className="text-2xl font-black text-cyan-400">{currentResult.confidence}</div>
                      </div>
                      <div className="bg-[var(--input-bg)] rounded-2xl p-5 border border-[var(--glass-border)] flex flex-col justify-center">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Risk Level</div>
                        <div>
                          <span className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border", currentResult.risk === 'Low' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20')}>{currentResult.risk}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Clinical Reasoning Protocol</div>
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{currentResult.reasoning}</p>
                  </div>

                  <div className="bg-[var(--bg-main)] rounded-3xl p-6 border border-[var(--glass-border)] shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-5">Tactical Directives</div>
                    <ul className="space-y-3">
                      {currentResult.recs.map((rec, i) => (
                        <li key={i} className="flex items-start gap-3 text-xs text-[var(--text-main)] font-medium"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0"></div> {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

