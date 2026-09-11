import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, HeartPulse, Activity, Microscope, LogOut, User, ShieldAlert, Loader2, History, ArrowLeft, RefreshCw, Sparkles, ChevronRight, Database, Users, ShieldCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../components/Button';
import HealthChatbot from '../components/HealthChatbot';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } }
};

export default function HospitalDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchQueue = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:5002/api/doctor-diagnosis/all", {
        headers: { "x-auth-token": token }
      });
      const data = await response.json();
      if (Array.isArray(data)) setDiagnostics(data);
    } catch (err) {
      console.error("❌ Failed to fetch diagnostics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || user?.role !== 'doctor') {
      navigate('/login');
      return;
    }
    fetchQueue();
  }, [token, user]);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const uniquePatients = [...new Set(diagnostics.map(d => d.patientName))];
  const filteredPatients = uniquePatients.filter(name =>
    name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const patientHistory = selectedPatient
    ? diagnostics.filter(d => d.patientName === selectedPatient)
    : [];

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 bg-mesh min-h-screen">

      {/* Background Blobs */}
      <div className="blob w-[600px] h-[600px] bg-cyan-500/5 -top-40 -right-40" />
      <div className="blob w-[600px] h-[600px] bg-violet-500/5 -bottom-40 -left-40" />

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
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black tracking-tight">Dr. {user.name}</h1>
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 text-[9px] font-black uppercase tracking-widest">Master Node</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">Clinical Command Interface</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchQueue}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-[var(--text-muted)] hover:text-cyan-500 glass-panel border-white/10 transition-all group"
            title="Sync Registry"
          >
            <RefreshCw className={cn("w-5 h-5 group-hover:rotate-180 transition-transform duration-700", loading && "animate-spin")} />
          </button>

        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!selectedPatient ? (
          <motion.div
            key="registry-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5 }}
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {[
                { label: 'Neural Logs', value: diagnostics.length, icon: Database, color: 'text-cyan-500' },
                { label: 'Patient Count', value: uniquePatients.length, icon: Users, color: 'text-violet-500' },
                { label: 'System Sync', value: 'Active', icon: RefreshCw, color: 'text-emerald-500' },
                { label: 'Clinical AI', value: 'RAG Model', icon: Sparkles, color: 'text-cyan-500' }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  onClick={stat.label === 'Clinical AI' ? () => setIsChatOpen(true) : undefined}
                  className={cn(
                    "glass-panel p-8 rounded-[32px] group relative overflow-hidden transition-all duration-500",
                    stat.label === 'Clinical AI' && "cursor-pointer hover:border-cyan-500/30 hover:scale-[1.02] shadow-xl shadow-cyan-500/10"
                  )}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 opacity-0 group-hover:opacity-100 blur-[40px] transition-opacity" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <stat.icon className={cn("w-4 h-4 opacity-40", stat.color)} />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{stat.label}</p>
                    </div>
                    {stat.label === 'Clinical AI' && <Sparkles className="w-3 h-3 text-cyan-500 animate-pulse" />}
                  </div>
                  <p className="text-3xl font-black tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Diagnostic Arrays */}
            <div className="mb-12">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-6 ml-2 text-[var(--text-muted)]">Initialize Diagnostic Cycle</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { id: 'report', label: 'Report Lab', icon: FileText, color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-emerald-500/20', desc: 'Clinical Data Stream', to: '/analyze-doctor?mode=report' },
                  { id: 'ecg', label: 'ECG Array', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', desc: 'Cardiac Frequency', to: '/analyze-doctor?mode=ecg' },
                  { id: 'ct', label: 'CT Processor', icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', desc: 'Volumetric Scanning', to: '/analyze-doctor?mode=ct' },
                  { id: 'mri', label: 'MRI Engine', icon: Microscope, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20', desc: 'Magnetic Resonance', to: '/analyze-doctor?mode=mri' }
                ].map((item) => (
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
            </div>

            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="mb-12">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-6 ml-2 text-[var(--text-muted)]">Specialized & Sub-Systems</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Link
                  to="/cancer-analysis-doctor"
                  className="glass-panel p-8 rounded-[32px] border-2 border-rose-500/30 transition-all hover:border-rose-500/50 hover:scale-[1.01] group relative overflow-hidden block"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[80px] -z-10 group-hover:opacity-30 transition-opacity" />
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center shadow-xl shadow-rose-500/30 group-hover:scale-105 transition-transform duration-500">
                      <ShieldAlert className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-black uppercase tracking-wider text-rose-500">Oncology Control</h3>
                        <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase tracking-widest border border-rose-500/20">Advanced</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider opacity-60">Multi-stage cancer detection & staging.</p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/lab-portal"
                  className="glass-panel p-8 rounded-[32px] border-2 border-emerald-500/30 transition-all hover:border-emerald-500/50 hover:scale-[1.01] group relative overflow-hidden block"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] -z-10 group-hover:opacity-30 transition-opacity" />
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-500">
                      <Database className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-black uppercase tracking-wider text-emerald-500">Lab Diagnostics Portal</h3>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Active</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider opacity-60">Manage cross-facility patient reports & uploads.</p>
                    </div>
                  </div>
                </Link>
              </div>
            </motion.div>


            {/* Registry Table */}
            <div className="glass-panel rounded-[40px] overflow-hidden mb-12 border-white/5">
              <div className="p-10 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <Users className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-[0.2em]">Patient Registry</h2>
                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.1em] mt-1">{uniquePatients.length} IDENTITIES MAPPED</p>
                  </div>
                </div>
                <div className="relative w-full md:w-96 group">
                  <Search className="w-5 h-5 text-[var(--text-muted)] absolute left-5 top-1/2 -translate-y-1/2 group-focus-within:text-cyan-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search Clinical Identifiers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-14 pr-6 py-4.5 text-sm bg-white/5 border border-white/10 rounded-[20px] outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 font-bold transition-all"
                  />
                </div>
              </div>

              <div className="min-h-[400px]">
                {loading ? (
                  <div className="py-24 flex flex-col items-center gap-6">
                    <Loader2 className="w-12 h-12 animate-spin text-cyan-500 opacity-50" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40">Decrypting registry data streams...</p>
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="py-24 text-center">
                    <FileText className="w-16 h-16 text-[var(--text-muted)] opacity-5 mx-auto mb-6" />
                    <p className="text-sm text-[var(--text-muted)] font-black uppercase tracking-widest opacity-30">No Records Found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-[var(--text-muted)] text-[11px] font-black uppercase tracking-[0.3em]">
                          <th className="py-8 px-10">Subject</th>
                          <th className="py-8 px-6 text-center">Latest Module</th>
                          <th className="py-8 px-6 text-center">Metrics</th>
                          <th className="py-8 px-6 text-center">Reference</th>
                          <th className="py-8 px-10 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredPatients.map((name, idx) => {
                          const latest = diagnostics.find(d => d.patientName === name);
                          const count = diagnostics.filter(d => d.patientName === name).length;
                          return (
                            <motion.tr
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.05 * idx }}
                              key={name}
                              className="hover:bg-cyan-500/[0.03] transition-colors cursor-pointer group"
                              onClick={() => setSelectedPatient(name)}
                            >
                              <td className="py-8 px-10">
                                <p className="text-lg font-black text-[var(--text-main)] group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{name || "Anonymous Lab"}</p>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1 font-bold uppercase tracking-widest opacity-60">Sequence: {count} Clusters</p>
                              </td>
                              <td className="py-8 px-6 text-center">
                                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 tracking-[0.2em] shadow-lg shadow-cyan-500/5">
                                  {latest?.type?.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-8 px-6 text-center text-[11px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                                {latest?.patientAge || "—"} [AGE] / {latest?.patientSex?.charAt(0) || "—"} [GEN]
                              </td>
                              <td className="py-8 px-6 text-center text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-widest opacity-40">
                                {new Date(latest?.date).toLocaleDateString()}
                              </td>
                              <td className="py-8 px-10 text-right">
                                <button className="inline-flex items-center gap-2 text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all duration-300">
                                  Open Archive <ChevronRight className="w-4 h-4" />
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* History View */
          <motion.div
            key="history-view"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <div className="flex items-center gap-8 mb-10">
              <button
                onClick={() => setSelectedPatient(null)}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-cyan-500 glass-panel border-white/10 hover:shadow-cyan-500/10 transition-all"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-4xl font-black tracking-tight text-[var(--text-main)] uppercase">{selectedPatient}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] opacity-60">
                    {patientHistory.length} DIAGNOSTIC NODES MAPPED
                  </p>
                  <div className="w-1 h-1 rounded-full bg-cyan-500" />
                  <p className="text-[11px] text-cyan-500 font-black uppercase tracking-[0.3em]">History Stream Active</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {patientHistory.map((diag, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  key={diag._id}
                  className="glass-panel p-10 rounded-[32px] flex flex-col md:flex-row md:items-center gap-8 group hover:border-cyan-500/20 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={cn("w-20 h-20 rounded-[28px] flex items-center justify-center shrink-0 border-2 group-hover:scale-110 transition-transform duration-500 bg-mesh shadow-2xl",
                    diag.type === 'ecg' ? "bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-rose-500/10" :
                      diag.type === 'ct' ? "bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-amber-500/10" :
                        diag.type === 'mri' ? "bg-violet-500/10 border-violet-500/20 text-violet-500 shadow-violet-500/10" :
                          "bg-cyan-500/10 border-cyan-500/20 text-cyan-500 shadow-cyan-500/10"
                  )}>
                    {diag.type === 'ecg' ? <HeartPulse className="w-10 h-10" /> :
                      diag.type === 'mri' ? <Microscope className="w-10 h-10" /> :
                        <FileText className="w-10 h-10" />}
                  </div>
                  <div className="flex-grow min-w-0 relative z-10">
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                        diag.type === 'ecg' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                          "bg-cyan-500/10 border-cyan-500/20 text-cyan-500"
                      )}>{diag.type} ANALYSIS</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] opacity-40">{new Date(diag.date).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-black text-xl uppercase tracking-tight group-hover:text-cyan-400 transition-colors mb-2">{diag.title}</h3>
                    <p className="text-sm text-[var(--text-muted)] font-medium opacity-60 leading-relaxed max-w-3xl line-clamp-2">{diag.prediction}</p>
                  </div>
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                    <ChevronRight className="w-8 h-8 text-cyan-500 opacity-40" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* AI Assistant Chatbot */}
      <HealthChatbot
        patientData={{ name: user.name, history: diagnostics, trends: [] }}
        externalOpen={isChatOpen}
        setExternalOpen={setIsChatOpen}
      />
    </div>
  );
}

