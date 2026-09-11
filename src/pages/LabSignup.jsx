import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Lock, ArrowRight, ShieldCheck, Mail, Building2, MapPin } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

const CITIES = ['Delhi', 'Mumbai', 'Gwalior', 'Kota'];

export default function LabSignup() {
    const [labId, setLabId] = useState('');
    const [labName, setLabName] = useState('');
    const [city, setCity] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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
                body: JSON.stringify({ name: labName, city, email: labId, password, role: 'lab' })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.msg || "Registration failed");

            login(data.user, data.token);
            navigate('/lab-portal');
        } catch (err) {
            if (err.message.includes('Failed to fetch')) {
                setError("Server busy");
            } else {
                setError(err.message || "Server busy");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 w-full flex items-center justify-center p-2 bg-mesh relative overflow-hidden h-screen max-h-screen">
            {/* Background Blobs - Emerald Theme for Lab */}
            <div className="blob w-[600px] h-[600px] bg-emerald-500/10 -top-20 -left-20 animate-float-slow" />
            <div className="blob w-[400px] h-[400px] bg-cyan-500/10 -bottom-20 -right-20 animate-float-slow [animation-delay:2s]" />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-md glass-panel p-5 md:px-6 rounded-[24px] relative z-10 border border-[var(--glass-border)] shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto hide-scrollbar"
            >
                <div className="text-center mb-4 shrink-0">
                    <motion.div
                        initial={{ rotate: -10, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 12 }}
                        className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/5"
                    >
                        <Database className="w-6 h-6 text-white" />
                    </motion.div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 border border-emerald-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" /> Node Registration
                    </div>

                    <h1 className="text-3xl font-black tracking-tight mb-1 text-[var(--text-main)]">New Lab Node</h1>
                    <p className="text-sm text-[var(--text-muted)] font-medium">Join the Diagnostic Routing Network</p>
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="p-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[16px] grid grid-cols-2 gap-1 mb-2">
                        <button
                            type="button"
                            onClick={() => navigate('/signup')}
                            className="py-2 mb-0 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 text-[var(--text-muted)] hover:text-cyan-500 hover:bg-cyan-500/5"
                        >
                            Patient
                        </button>
                        <button
                            type="button"
                            className="py-2 mb-0 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                        >
                            Lab
                        </button>
                    </div>

                    <div className="space-y-1.5 mt-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2">First Name of the Lab</label>
                        <div className="relative group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-emerald-500 transition-colors duration-300" />
                            <input
                                type="text"
                                required
                                value={labName}
                                onChange={(e) => setLabName(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)]/40"
                                placeholder="Diagnostics Lab"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2 flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-emerald-500" /> City
                        </label>
                        <select
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl py-3 px-4 outline-none focus:border-emerald-500/50 transition-all text-sm font-bold cursor-pointer text-[var(--text-main)] appearance-none"
                        >
                            <option value="" disabled className="bg-[var(--bg-main)] text-[var(--text-muted)]">Select your city...</option>
                            {CITIES.map(c => (
                                <option key={c} value={c} className="bg-[var(--bg-main)] text-[var(--text-main)]">{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2">Lab Identifier Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-emerald-500 transition-colors duration-300" />
                            <input
                                type="email"
                                required
                                value={labId}
                                onChange={(e) => setLabId(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)]/40"
                                placeholder="lab@facility.org"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-2">Authorization Key</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-emerald-500 transition-colors duration-300" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl py-3 pl-11 pr-4 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm font-bold text-[var(--text-main)] placeholder:text-[var(--text-muted)]/40"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || password.length < 6}
                        className="w-full mt-2 h-14 rounded-2xl flex items-center justify-center gap-2 group relative overflow-hidden bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] disabled:opacity-30"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        {loading ? (
                            <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="relative z-10 font-black uppercase tracking-[0.2em] text-xs">Register Node</span>
                                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </Button>
                    {password.length > 0 && password.length < 6 && (
                      <p className="text-[10px] text-rose-500 font-bold text-center mt-2 uppercase tracking-widest">
                        At least 6 characters required
                      </p>
                    )}

                </form>

                <div className="mt-4 text-center pt-4 border-t border-white/5 space-y-2 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        Already in the network?{' '}
                        <Link to="/lab-login" className="text-emerald-500 hover:text-emerald-400 transition-colors ml-1">Access Terminal</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
