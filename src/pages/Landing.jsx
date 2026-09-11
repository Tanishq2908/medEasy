import React, { useEffect } from 'react';
import { Button } from '../components/Button';
import { ArrowRight, BarChart3, Activity, ShieldCheck, HeartPulse, UploadCloud, Brain, FileText, ChevronRight, CheckCircle2, Sparkles, Database } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Landing() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user) {
      navigate(user.role === 'doctor' ? '/hospital-dashboard' : '/patient-dashboard');
    }
  }, [token, user, navigate]);

  return (
    <div className="flex flex-col w-full min-h-screen text-[var(--text-main)] transition-colors duration-500 bg-mesh relative overflow-hidden">

      {/* Dynamic Background Blobs */}
      <div className="blob w-[500px] h-[500px] bg-cyan-500/10 -top-20 -left-20 animate-float-slow" />
      <div className="blob w-[400px] h-[400px] bg-purple-500/10 top-1/2 -right-20 animate-float-slow [animation-delay:2s]" />
      <div className="blob w-[300px] h-[300px] bg-pink-500/10 bottom-0 left-1/4 animate-float-slow [animation-delay:4s]" />

      {/* Hero */}
      <section className="relative px-6 pt-20 pb-24 lg:pt-32 lg:pb-40 flex-grow flex items-center">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-12 gap-16 items-center">

            {/* Left: Hero Copy */}
            <motion.div
              initial="initial"
              animate="animate"
              variants={staggerContainer}
              className="lg:col-span-6 space-y-10 relative z-10"
            >
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-500 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-xl">
                <Sparkles className="w-4 h-4" />
                <span>Next-Gen Health Intelligence</span>
              </motion.div>

              <motion.h1 variants={fadeInUp} className="text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[0.95]">
                Clinical AI<br />
                <span className="text-gradient">Diagnostics</span>
              </motion.h1>

              <motion.p variants={fadeInUp} className="text-xl text-[var(--text-muted)] leading-relaxed max-w-xl font-medium">
                Bridging the gap between hospitals and patients with precision AI. Transform diagnostic data into clinical-grade health strategies.
              </motion.p>

              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row flex-wrap gap-4 pt-4 text-center">
                <Link to="/signup">
                  <Button size="lg" className="button-premium w-full sm:w-auto h-16 rounded-2xl font-extrabold uppercase tracking-widest px-10 text-sm">
                    Initialize Platform <ArrowRight className="w-5 h-5 ml-3" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary" size="lg" className="glass-panel w-full sm:w-auto h-16 rounded-2xl font-extrabold uppercase tracking-widest px-10 text-sm border-white/20 hover:bg-white/10">
                    Secure Login
                  </Button>
                </Link>
                <div className="w-full sm:w-auto text-center mt-2 sm:mt-0 sm:ml-4 flex items-center justify-center">
                  <Link to="/lab-login" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors">
                    <Database className="w-3.5 h-3.5" /> Lab Portal Login
                  </Link>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: Bento Grid */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-6 grid grid-cols-2 gap-5 relative z-10"
            >

              {/* Tile 1: AI Engine (wide) */}
              <div className="col-span-2 glass-panel rounded-[32px] p-8 glass-panel-hover overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500 opacity-10 blur-[80px] -z-10 group-hover:opacity-20 transition-opacity duration-700" />
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-[var(--text-main)] mb-3 tracking-tight">Diagnostic AI Engine</h3>
                    <p className="text-base text-[var(--text-muted)] leading-relaxed max-w-md font-medium">
                      Neural interpretation of clinical lab results, pathology, and vital metrics with sub-millisecond latency.
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shrink-0 ml-4 shadow-lg shadow-cyan-500/10">
                    <Brain className="w-7 h-7 text-cyan-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                    <div className="text-[11px] font-black text-cyan-500 mb-2 flex items-center gap-2 uppercase tracking-[0.15em]">
                      <CheckCircle2 className="w-4 h-4" /> Clinical Level
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed font-semibold">
                      Validated datasets ensuring 99.8% precision in report parsing.
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                    <div className="text-[11px] font-black text-violet-500 mb-2 flex items-center gap-2 uppercase tracking-[0.15em]">
                      <BarChart3 className="w-4 h-4" /> Data Stream
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed font-semibold">
                      Longitudinal health tracking with predictive risk modeling.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tile 2: Patient Portal */}
              <div className="glass-panel rounded-[32px] p-8 glass-panel-hover flex flex-col group relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 blur-[60px] -z-10 group-hover:opacity-20 transition-opacity" />
                <UploadCloud className="w-10 h-10 text-cyan-500 mb-6" />
                <h3 className="text-xl font-black text-[var(--text-main)] mb-3 tracking-tight">Patient Cloud</h3>
                <p className="text-sm text-[var(--text-muted)] flex-grow leading-relaxed font-medium">
                  Universal uplink for imaging, physician notes, and lab data encrypted end-to-end.
                </p>
                <div className="mt-8 flex items-center text-xs text-cyan-500 font-bold uppercase tracking-[0.2em] cursor-pointer group-hover:gap-3 transition-all">
                  Open Vault <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Tile 3: Directives */}
              <div className="glass-panel rounded-[32px] p-8 glass-panel-hover flex flex-col group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 blur-[60px] -z-10 group-hover:opacity-20 transition-opacity" />
                <Activity className="w-10 h-10 text-violet-500 mb-6" />
                <h3 className="text-xl font-black text-[var(--text-main)] mb-3 tracking-tight">Health Logic</h3>
                <p className="text-sm text-[var(--text-muted)] flex-grow leading-relaxed font-medium">
                  Automated generation of preventive dietary and exercise protocols.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] rounded-full uppercase font-black tracking-widest border border-emerald-500/20">Dietary</span>
                  <span className="px-3 py-1.5 bg-cyan-500/10 text-cyan-500 text-[10px] rounded-full uppercase font-black tracking-widest border border-cyan-500/20">Cardio</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Footer */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="border-t border-white/5 bg-white/5 backdrop-blur-xl py-12 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>HIPAA Tier 1</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">
              <FileText className="w-5 h-5 text-cyan-500" />
              <span>FDA Compliant Rendering</span>
            </div>
            <div className="col-span-2 md:col-span-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">
              <svg className="w-5 h-5 text-violet-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Military Grade RSA</span>
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-[0.2em] opacity-40">
            Hacksagon Clinical AI © 2026
          </div>
        </div>
      </motion.section>
    </div>
  );
}

