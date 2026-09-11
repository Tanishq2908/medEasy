import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, ShieldCheck, HeartPulse, UserCircle, Loader2, Sparkles, Activity } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
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
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "Signup failed");

      login(data.user, data.token);
      if (data.user.role === 'doctor') navigate('/hospital-dashboard');
      else if (data.user.role === 'lab') navigate('/lab-portal');
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
        className="w-full max-w-md glass-panel p-5 md:px-6 rounded-[24px] relative z-10 border-[var(--glass-border)] shadow-xl my-2"
      >
        <div className="text-center mb-4">
          <motion.div
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl shadow-cyan-500/30 ring-4 ring-cyan-500/5"
          >
            <UserCircle className="w-6 h-6 text-white" />
          </motion.div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Initialize Identity
          </div>

          <h1 className="text-2xl font-black tracking-tight mb-1 text-[var(--text-main)]">Create Account</h1>
          <p className="text-sm text-[var(--text-muted)] font-medium">Join the next-gen clinical network</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-500 text-sm font-bold mb-4 text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[16px] grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setRole('patient')}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${role === 'patient' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-[var(--text-muted)] hover:text-cyan-500 hover:bg-cyan-500/5'}`}
            >
              Patient
            </button>
            <button
              type="button"
              onClick={() => navigate('/lab-signup')}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${role === 'lab' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-[var(--text-muted)] hover:text-emerald-500 hover:bg-emerald-500/5'}`}
            >
              Lab
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2">Legal Name</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50 group-focus-within:text-cyan-500 transition-colors duration-300" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2.5 pl-11 pr-4 outline-none focus:border-cyan-500/50 focus:bg-[var(--glass-bg)] transition-all text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)] placeholder:opacity-50"
                placeholder="Full Name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2">Clinical Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50 group-focus-within:text-cyan-500 transition-colors duration-300" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2.5 pl-11 pr-4 outline-none focus:border-cyan-500/50 focus:bg-[var(--glass-bg)] transition-all text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)] placeholder:opacity-50"
                placeholder="email@clinical.org"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2">Security Key</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] opacity-50 group-focus-within:text-cyan-500 transition-colors duration-300" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl py-2.5 pl-11 pr-4 outline-none focus:border-cyan-500/50 focus:bg-[var(--glass-bg)] transition-all text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)] placeholder:opacity-50"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] text-cyan-500 focus:ring-offset-0 focus:ring-cyan-500/50 cursor-pointer transition-all"
            />
            <label htmlFor="terms" className="text-[10px] font-bold text-[var(--text-muted)] cursor-pointer select-none">
              I agree to the <span className="text-cyan-400">Terms of Service</span> & <span className="text-cyan-400">Privacy Protocol</span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={loading || !agreed || password.length < 6}
            className="w-full h-11 rounded-xl button-premium transition-all flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-[10px] mt-2 disabled:opacity-30 disabled:cursor-not-allowed text-white"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              <>Construct Account <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
          {password.length > 0 && password.length < 6 && (
            <p className="text-[10px] text-rose-500 font-bold text-center mt-2 uppercase tracking-widest">
              At least 6 characters required
            </p>
          )}
        </form>

        <div className="mt-4 text-center pt-4 border-t border-[var(--glass-border)] space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Already established?{' '}
            <Link to="/login" className="text-cyan-500 hover:text-cyan-400 transition-colors ml-1">Login Here</Link>
          </p>
          <div className="pt-2">
            <Link to="/lab-signup" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 hover:text-emerald-400 transition-colors">
               Facility Staff? Access Lab Registration
             </Link>
          </div>
          <div className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] opacity-50 flex items-center justify-center gap-2">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> HIPAA Validated
          </div>
        </div>
      </motion.div>
    </div>
  );
}
