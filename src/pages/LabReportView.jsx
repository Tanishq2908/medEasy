import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, FileText, ShieldAlert, FlaskConical, Cpu } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

// ── Analysis sub-components (one per test type) ──
import BloodTestAnalysis from './analysis/BloodTestAnalysis';
import EcgAnalysis from './analysis/EcgAnalysis';
import KidneyAnalysis from './analysis/KidneyAnalysis';
import LungCancerAnalysis from './analysis/LungCancerAnalysis';
import BrainTumorAnalysis from './analysis/BrainTumorAnalysis';

// Map testType string → component
const ANALYSIS_COMPONENTS = {
  'Blood Test (CBC)': BloodTestAnalysis,
  'ECG Report': EcgAnalysis,
  'Kidney Stone (Ultrasound)': KidneyAnalysis,
  'Lung Cancer (CT Scan)': LungCancerAnalysis,
  'Brain Tumor (MRI)': BrainTumorAnalysis,
};

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

export default function LabReportView() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchReport();
  }, [id, token]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/lab-reports/${id}`, {
        headers: { 'x-auth-token': token }
      });
      if (!res.ok) throw new Error('Report not found or access denied.');
      const data = await res.json();
      setReport(data);
      if (data.aiAnalysis) setAnalysis(data.aiAnalysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-6 opacity-50">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60">Fetching Clinical Report...</p>
        </div>
      </div>
    );
  }

  // ── Error state (no report) ──
  if (error && !report) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="w-20 h-20 rounded-[24px] bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-rose-400">{error}</h2>
          <Button onClick={() => navigate('/patient-dashboard')} className="h-12 px-8 rounded-2xl bg-[var(--input-bg)] border border-[var(--glass-border)] font-black uppercase tracking-widest text-[10px] text-[var(--text-main)]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-7xl mx-auto w-full relative z-10 bg-mesh min-h-screen">
      <div className="fixed inset-0 bg-transparent -z-10" />
      <div className="blob w-[600px] h-[600px] bg-cyan-500/5 -top-40 -left-40 blur-[150px]" />
      <div className="blob w-[500px] h-[500px] bg-violet-500/5 -bottom-40 -right-40 blur-[150px]" />

      {/* Header */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <Button
          variant="outline"
          onClick={() => navigate('/patient-dashboard')}
          className="flex items-center gap-3 h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-[var(--glass-border)] glass-panel group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60">Lab Report View</p>
            <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-main)]">{report?.reportTitle}</p>
          </div>
        </div>
      </motion.div>

      {/* Report Info Card */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.05 }}
        className="glass-panel p-10 rounded-[40px] mb-8 border-[var(--glass-border)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-1">Lab Facility</p>
            <p className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">{report?.labName}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-1">Test Type</p>
            <p className="text-sm font-black text-cyan-500 uppercase tracking-tight">{report?.testType}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-1">Uploaded</p>
            <p className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">{new Date(report?.uploadedAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-1">File</p>
            <p className="text-sm font-black text-[var(--text-main)] truncate">{report?.fileName}</p>
          </div>
        </div>
        {report?.notes && (
          <div className="mt-6 pt-6 border-t border-[var(--glass-border)] relative z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-2">Lab Technician Notes</p>
            <p className="text-sm text-[var(--text-main)] opacity-70 font-medium leading-relaxed">{report.notes}</p>
          </div>
        )}
      </motion.div>

      {/* Two Column: Report Preview + Pipeline Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Report Preview */}
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.1 }}
          className="glass-panel p-8 rounded-[40px] border-[var(--glass-border)] flex flex-col shadow-sm"
        >
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-6 flex items-center gap-3">
            <FileText className="w-4 h-4 text-cyan-500" /> Report Document
          </h3>
          {report?.fileBase64 ? (
            report.fileType === 'application/pdf' ? (
              <iframe
                src={`data:application/pdf;base64,${report.fileBase64}`}
                className="w-full flex-grow rounded-[24px] bg-white min-h-[500px]"
                title="Lab Report"
              />
            ) : (
              <div className="flex-grow flex items-center justify-center">
                <img
                  src={`data:${report.fileType};base64,${report.fileBase64}`}
                  alt="Lab Report"
                  className="w-full rounded-[24px] object-contain max-h-[600px]"
                />
              </div>
            )
          ) : (
            <div className="flex-grow flex items-center justify-center text-[var(--text-muted)] opacity-30">
              <p className="text-[10px] font-black uppercase tracking-widest">No file data available</p>
            </div>
          )}
        </motion.div>

        {/* Pipeline Status Card */}
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.15 }}
          className="glass-panel p-8 rounded-[40px] border-[var(--glass-border)] flex flex-col items-center justify-center gap-6 text-center shadow-lg"
        >
          <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border-2 border-cyan-500/30 flex items-center justify-center">
            <Cpu className="w-12 h-12 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-[var(--text-main)] mb-2">AI Analysis Engine</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-60 leading-relaxed">{report?.testType}</p>
            <div className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 inline-block">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-500">
                {ANALYSIS_COMPONENTS[report?.testType] ? '✓ Model pipeline ready' : '⚠ Unknown test type'}
              </p>
            </div>
          </div>
          <p className="text-[9px] text-[var(--text-muted)] opacity-40 uppercase tracking-widest max-w-xs leading-relaxed">
            Dedicated analysis model auto-starts below
          </p>
        </motion.div>
      </div>

      {/* ── ANALYSIS DISPATCHER ── */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-10 rounded-[40px] border-[var(--glass-border)] shadow-xl"
        >
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-8 flex items-center gap-3">
            <Cpu className="w-4 h-4 text-cyan-500" /> Neural Diagnostic Output — {report.testType}
          </h2>

          {ANALYSIS_COMPONENTS[report.testType] ? (
            (() => {
              const AnalysisComponent = ANALYSIS_COMPONENTS[report.testType];
              return (
                <AnalysisComponent
                  report={report}
                  token={token}
                  onComplete={(result) => setAnalysis(result)}
                />
              );
            })()
          ) : (
            <div className="py-16 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-30">
                No analysis pipeline configured for: {report.testType}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
