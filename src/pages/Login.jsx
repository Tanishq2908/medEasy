import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Activity, ShieldCheck, HeartPulse, Loader2, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
    const [agreed, setAgreed] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.msg || "Login failed");

      if (data.user.role === 'lab') {
        throw new Error("Invalid access: Lab staff must use the dedicated Lab Portal to login.");
      }
      
      login(data.user, data.token);
      if (data.user.role === 'doctor') navigate('/hospital-dashboard');
      else navigate('/patient-dashboard');
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        setError("Server busy");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex items-center justify-center p-4 bg-mesh relative overflow-hidden">
      {/* Background Blobs */}
      <div className="blob w-[600px] h-[600px] bg-cyan-500/10 -top-20 -left-20 animate-float-slow" />
      <div className="blob w-[400px] h-[400px] bg-indigo-500/10 -bottom-20 -right-20 animate-float-slow [animation-delay:2s]" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md glass-panel p-6 md:px-8 rounded-[30px] relative z-10 border-[var(--glass-border)] shadow-xl"
      >
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 text-[10px] font-black uppercase tracking-widest mb-2">
              <Activity className="w-3 h-3" /> Secure Node Access
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-[var(--text-main)]">Initialize Logic</h1>
            <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">Enter clinical credentials to sync profile</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50 group-focus-within:text-cyan-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Clinical ID (Email)"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-cyan-500/50 focus:bg-[var(--glass-bg)] text-xs font-bold uppercase tracking-widest text-[var(--text-main)] transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-50"
                  required
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50 group-focus-within:text-cyan-500 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Bio-Key (Password)"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-cyan-500/50 focus:bg-[var(--glass-bg)] text-xs font-bold uppercase tracking-widest text-[var(--text-main)] transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-50"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border ${agreed ? 'bg-cyan-600 border-cyan-600' : 'border-[var(--glass-border)] bg-[var(--input-bg)]'} transition-all flex items-center justify-center`}>
                    {agreed && <ShieldCheck className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors">Remember Sync</span>
              </label>
              <Link to="/signup" className="text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-400 transition-colors">Reset ID</Link>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3">
                <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] font-black uppercase tracking-wider text-red-500 leading-relaxed">{error}</p>
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || password.length < 6}
              className="w-full h-14 rounded-2xl bg-cyan-600 font-extrabold uppercase tracking-[0.2em] text-[10px] button-premium shadow-xl relative overflow-hidden group text-white"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sync Protocol <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
            </Button>
            {password.length > 0 && password.length < 6 && (
              <p className="text-[9px] text-red-500 font-black uppercase tracking-widest text-center mt-2 animate-pulse">At least 6 characters required</p>
            )}
          </form>

          <p className="text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] pt-2">
            New Entity? <Link to="/signup" className="text-cyan-500 hover:text-cyan-400">Initialize Profile</Link>
          </p>

          <div className="mt-4 pt-4 border-t border-[var(--glass-border)] text-center">
             <Link to="/lab-login" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 hover:text-emerald-400 transition-colors">
               Facility Staff? Access Lab Terminal
             </Link>
          </div>

          <div className="flex items-center gap-3 pt-4 opacity-30 justify-center">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em]">Stitch Medical Security Standard v4.0.2</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
