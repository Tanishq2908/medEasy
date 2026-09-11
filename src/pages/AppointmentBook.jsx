import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, Clock, CheckCircle2, ArrowRight, ShieldAlert,
    Loader2, MapPin, FlaskConical, ChevronRight, X, ArrowLeft,
    Activity, Droplets, Wind, Brain, ExternalLink, HeartPulse,
    Building2, Waves, Landmark, GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { cn } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const CITIES = ['Delhi', 'Mumbai', 'Gwalior', 'Kota'];

const TEST_OPTIONS = [
    { value: 'Blood Test (CBC)',         icon: Droplets,  model: 'Tesseract OCR + Clinical Vision',             color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { value: 'ECG Report',               icon: HeartPulse, model: 'ecg_model.pkl → MaxViT PyTorch',           color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
    { value: 'Kidney Stone (Ultrasound)',icon: Activity,   model: 'kidney_final_detection.pkl → Flask',       color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
    { value: 'Lung Cancer (CT Scan)',    icon: Wind,       model: 'lung_cancer_model.pkl → Flask',            color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
    { value: 'Brain Tumor (MRI)',        icon: Brain,      model: 'model.pkl (Brain Tumor) → Flask',          color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
];

const SLOTS = ['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '04:30 PM', '06:00 PM'];

function generateBID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rnd = '';
    for (let i = 0; i < 4; i++) rnd += chars.charAt(Math.floor(Math.random() * chars.length));
    const now = new Date();
    const dStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const tStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `BK-${rnd}-${dStr}-${tStr}`;
}

const CITY_COLORS = {
    'Delhi': 'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400',
    'Mumbai': 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
    'Gwalior': 'from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-400',
    'Kota': 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
};

export default function AppointmentBook() {
    const { user, token } = useAuth();
    const navigate = useNavigate();

    // ─── STEP FLOW: city → lab → details → confirm ───
    const [step, setStep] = useState('city'); // 'city' | 'lab' | 'details' | 'confirm'

    const [selectedCity, setSelectedCity] = useState('');
    const [availableLabs, setAvailableLabs] = useState([]);
    const [labsLoading, setLabsLoading] = useState(false);
    const [selectedLab, setSelectedLab] = useState(null);

    // Appointment form
    const [test, setTest] = useState(TEST_OPTIONS[0].value);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [slot, setSlot] = useState(SLOTS[0]);

    // Booking state
    const [booking, setBooking] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [bookedAppointment, setBookedAppointment] = useState(null);

    // Cancel
    const [cancelModal, setCancelModal] = useState({ open: false, id: null, lab: '', test: '' });
    const [cancelLoading, setCancelLoading] = useState(false);

    // Past appointments
    const [myAppointments, setMyAppointments] = useState([]);
    const [aptsLoading, setAptsLoading] = useState(true);

    // Load past appointments on mount
    useEffect(() => {
        if (!token) return;
        fetchMyAppointments();
        // Clear old localStorage data
        localStorage.removeItem('hackathon_patients');
    }, [token]);

    const fetchMyAppointments = async () => {
        setAptsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/my`, {
                headers: { 'x-auth-token': token }
            });
            if (res.ok) {
                const data = await res.json();
                setMyAppointments(data);
            }
        } catch (err) {
            console.error('Failed to load appointments:', err);
        } finally {
            setAptsLoading(false);
        }
    };

    // When city is selected, fetch labs in that city
    const handleCitySelect = async (city) => {
        setSelectedCity(city);
        setSelectedLab(null);
        setAvailableLabs([]);
        setLabsLoading(true);
        setStep('lab');
        try {
            const res = await fetch(`${API_BASE_URL}/api/labs/by-city/${city}`);
            const data = await res.json();
            setAvailableLabs(Array.isArray(data) ? data : []);
        } catch (err) {
            setAvailableLabs([]);
        } finally {
            setLabsLoading(false);
        }
    };

    const handleLabSelect = (lab) => {
        setSelectedLab(lab);
        setStep('details');
    };

    const handleBooking = async () => {
        if (!selectedLab || !test || !date || !slot) return;
        setBooking(true);
        setBookingError('');
        const bid = generateBID();
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ labId: selectedLab._id, test, date, slot, bid })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.msg || 'Booking failed');
            setBookedAppointment(data);
            setStep('confirm');
            fetchMyAppointments(); // refresh list
        } catch (err) {
            setBookingError(err.message);
        } finally {
            setBooking(false);
        }
    };

    const handleCancel = async () => {
        setCancelLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/appointments/${cancelModal.id}/cancel`, {
                method: 'PATCH',
                headers: { 'x-auth-token': token }
            });
            if (res.ok) {
                fetchMyAppointments();
                setCancelModal({ open: false, id: null, lab: '', test: '' });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCancelLoading(false);
        }
    };

    const resetFlow = () => {
        setStep('city');
        setSelectedCity('');
        setSelectedLab(null);
        setAvailableLabs([]);
        setBookedAppointment(null);
        setBookingError('');
    };

    const cityColor = CITY_COLORS[selectedCity] || 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400';

    return (
        <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-4xl mx-auto w-full relative z-10 bg-mesh min-h-screen">
            <div className="fixed inset-0 bg-transparent -z-10" />
            <div className="blob w-[600px] h-[600px] bg-cyan-500/5 -top-40 -left-60 blur-[150px]" />
            <div className="blob w-[600px] h-[600px] bg-indigo-500/5 -bottom-40 -right-60 blur-[150px]" />

            <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 text-center text-[var(--text-main)]">Book Appointment</h1>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-10">Select your city → lab → test → confirm</p>

            {/* Progress steps */}
            <div className="flex items-center justify-center gap-2 mb-10">
                {['city', 'lab', 'details', 'confirm'].map((s, i) => (
                    <React.Fragment key={s}>
                        <div className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all", 
                            step === s ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-500 shadow-sm" : 
                            ['city','lab','details','confirm'].indexOf(step) > i ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                            "border-[var(--glass-border)] text-[var(--text-muted)] opacity-40"
                        )}>
                            <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black",
                                step === s ? "bg-cyan-500 text-white" :
                                ['city','lab','details','confirm'].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-[var(--text-muted)] opacity-20"
                            )}>{i + 1}</span>
                            {s}
                        </div>
                        {i < 3 && <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-20" />}
                    </React.Fragment>
                ))}
            </div>

            <AnimatePresence mode="wait">

                {/* ── STEP 1: CITY ── */}
                {step === 'city' && (
                    <motion.div key="city" variants={fadeInUp} initial="initial" animate="animate" exit={{ opacity: 0 }}>
                        <div className="glass-panel p-10 rounded-[40px] border-[var(--glass-border)] shadow-lg">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 mb-8 flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-cyan-500" /> Select Your City
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {CITIES.map(city => (
                                    <button
                                        key={city}
                                        onClick={() => handleCitySelect(city)}
                                        className={cn("group p-8 rounded-[28px] border bg-gradient-to-br flex flex-col items-center gap-4 transition-all hover:scale-[1.03] hover:shadow-xl",
                                            CITY_COLORS[city]
                                        )}
                                    >
                                        <div className="w-16 h-16 rounded-[20px] bg-white/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                            {city === 'Delhi' ? <Building2 className="w-8 h-8"/> : city === 'Mumbai' ? <Waves className="w-8 h-8"/> : city === 'Gwalior' ? <Landmark className="w-8 h-8"/> : <GraduationCap className="w-8 h-8"/>}
                                        </div>
                                        <p className="text-base font-black uppercase tracking-tight">{city}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── STEP 2: LAB ── */}
                {step === 'lab' && (
                    <motion.div key="lab" variants={fadeInUp} initial="initial" animate="animate" exit={{ opacity: 0 }} className="space-y-4">
                        <div className="glass-panel p-10 rounded-[40px] border-white/5">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-1 flex items-center gap-3">
                                        <FlaskConical className="w-4 h-4 text-emerald-500" /> Labs in {selectedCity}
                                    </h2>
                                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Select a registered laboratory</p>
                                </div>
                                <button onClick={resetFlow} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">
                                    <ArrowLeft className="w-3 h-3" /> Change City
                                </button>
                            </div>

                            {labsLoading ? (
                                <div className="py-16 flex flex-col items-center gap-4 opacity-40">
                                    <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Scanning {selectedCity} network...</p>
                                </div>
                            ) : availableLabs.length === 0 ? (
                                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                                    <FlaskConical className="w-16 h-16 text-white/10 mx-auto mb-4" />
                                    <p className="text-sm font-black uppercase tracking-tighter text-white/20 mb-2">No Labs in {selectedCity} Yet</p>
                                    <p className="text-[10px] text-white/10 font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                                        Labs must register first before patients can book appointments with them
                                    </p>
                                    <button onClick={resetFlow} className="mt-6 text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors">
                                        ← Try another city
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {availableLabs.map(lab => (
                                        <button key={lab._id}
                                            onClick={() => handleLabSelect(lab)}
                                            className="w-full flex items-center justify-between p-6 rounded-[24px] bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition-all group text-left shadow-sm"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                                                    <FlaskConical className="w-7 h-7 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <p className="text-base font-black text-[var(--text-main)] uppercase tracking-tight mb-1">{lab.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-3 h-3 text-emerald-500" />
                                                        <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{lab.city}</p>
                                                        <span className="text-[var(--text-muted)] opacity-20">·</span>
                                                        <p className="text-[10px] text-[var(--text-muted)] opacity-50 font-mono">{lab.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                    Active
                                                </span>
                                                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] opacity-40 group-hover:text-[var(--text-main)] group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ── STEP 3: DETAILS ── */}
                {step === 'details' && selectedLab && (
                    <motion.div key="details" variants={fadeInUp} initial="initial" animate="animate" exit={{ opacity: 0 }}>
                        <div className="glass-panel p-10 rounded-[40px] border-white/5">
                            {/* Selected lab summary */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                                        <FlaskConical className="w-7 h-7 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-base font-black text-[var(--text-main)] uppercase tracking-tight">{selectedLab.name}</p>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-emerald-500" />
                                            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{selectedCity}</p>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setStep('lab')} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50 hover:opacity-100 transition-opacity">
                                    <ArrowLeft className="w-3 h-3" /> Change Lab
                                </button>
                            </div>

                            {/* Test Type Visual Selector */}
                            <div className="mb-8">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 block mb-4">Diagnostic Test</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {TEST_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setTest(opt.value)}
                                            className={cn(
                                                'flex items-center gap-3 p-4 rounded-[20px] border text-left transition-all hover:scale-[1.02]',
                                                test === opt.value
                                                    ? `${opt.bg} border-opacity-80 shadow-lg`
                                                    : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                                            )}
                                        >
                                            <opt.icon className={cn('w-6 h-6 shrink-0', test === opt.value ? opt.color : 'text-white/40')} />
                                            <div className="min-w-0">
                                                <p className={cn('text-[10px] font-black uppercase tracking-tight leading-tight', test === opt.value ? opt.color : 'text-[var(--text-main)]')}>
                                                    {opt.value}
                                                </p>
                                                <p className="text-[8px] text-[var(--text-muted)] opacity-50 uppercase tracking-wide mt-0.5 truncate">
                                                    {opt.model}
                                                </p>
                                            </div>
                                            {test === opt.value && (
                                                <CheckCircle2 className={cn('w-4 h-4 shrink-0 ml-auto', opt.color)} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                                {/* Date */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 block">Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={e => setDate(e.target.value)}
                                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl px-4 py-3.5 text-sm font-bold text-[var(--text-main)] outline-none focus:border-cyan-500/50 transition-all font-mono uppercase"
                                    />
                                </div>
                                {/* Slot */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 block">Time Slot</label>
                                    <select
                                        value={slot}
                                        onChange={e => setSlot(e.target.value)}
                                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-2xl px-4 py-3.5 text-sm font-bold text-[var(--text-main)] outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer"
                                    >
                                        {SLOTS.map(o => <option key={o} value={o} className="bg-[var(--bg-main)]">{o}</option>)}
                                    </select>
                                </div>
                            </div>

                            {bookingError && (
                                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest">
                                    {bookingError}
                                </div>
                            )}

                            <Button
                                onClick={handleBooking}
                                disabled={booking}
                                className="w-full h-16 rounded-[24px] bg-cyan-600 font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-cyan-900/40 group relative overflow-hidden border-none"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {booking ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</> : <>Confirm Appointment <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                                </span>
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* ── STEP 4: CONFIRM ── */}
                {step === 'confirm' && bookedAppointment && (
                    <motion.div key="confirm" variants={fadeInUp} initial="initial" animate="animate" exit={{ opacity: 0 }}>
                        <div className="glass-panel p-12 rounded-[40px] border-emerald-500/20 text-center shadow-lg">
                            <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center rounded-[28px] mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)]">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter text-emerald-500 mb-2">Appointment Confirmed!</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-60 mb-8">Your booking has been saved to the system</p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 text-left">
                                {[
                                    { label: 'Booking ID', value: bookedAppointment.bid, mono: true },
                                    { label: 'Lab', value: bookedAppointment.labName },
                                ].map((item, i) => (
                                    <div key={i} className="p-5 rounded-[20px] bg-[var(--input-bg)] border border-[var(--input-border)]">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 mb-1">{item.label}</p>
                                        <p className={cn("text-sm font-black text-[var(--text-main)]", item.mono && "font-mono text-cyan-500")}>{item.value}</p>
                                    </div>
                                ))}
                                {/* Test + Model Info */}
                                <div className="p-5 rounded-[20px] bg-[var(--input-bg)] border border-[var(--input-border)]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 mb-1">Test</p>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const IconObj = TEST_OPTIONS.find(o => o.value === bookedAppointment.test)?.icon || Activity;
                                            return <IconObj className="w-5 h-5 text-cyan-500" />;
                                        })()}
                                        <p className="text-sm font-black text-[var(--text-main)]">{bookedAppointment.test}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] opacity-40 uppercase tracking-widest mt-1">
                                        AI: {TEST_OPTIONS.find(o => o.value === bookedAppointment.test)?.model || 'Clinical Vision'}
                                    </p>
                                </div>
                                <div className="p-5 rounded-[20px] bg-[var(--input-bg)] border border-[var(--input-border)]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 mb-1">Date & Slot</p>
                                    <p className="text-sm font-black text-[var(--text-main)]">{bookedAppointment.date} · {bookedAppointment.slot}</p>
                                </div>
                            </div>

                            <div className="flex gap-4 justify-center">
                                <Button onClick={resetFlow} variant="outline" className="h-12 px-8 rounded-2xl border-[var(--glass-border)] font-black uppercase tracking-widest text-[10px] text-[var(--text-main)]">
                                    Book Another
                                </Button>
                                <Button onClick={() => navigate('/patient-dashboard')} className="h-12 px-8 rounded-2xl bg-cyan-600 font-black uppercase tracking-widest text-[10px]">
                                    Dashboard <ArrowRight className="w-4 h-4 inline ml-2" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── PAST APPOINTMENTS ── */}
            {myAppointments.length > 0 && (
                <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.2 }} className="glass-panel p-10 rounded-[40px] mt-10 border-[var(--glass-border)] shadow-lg">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50 mb-8 flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-cyan-500" /> Your Appointments
                    </h2>
                    {aptsLoading ? (
                        <div className="py-8 flex justify-center opacity-30">
                            <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {myAppointments.map(apt => (
                                <div key={apt._id} className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[24px] bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--accent-primary)]/30 transition-all group shadow-sm">
                                    <div className="flex items-center gap-5 mb-4 md:mb-0">
                                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                            <FlaskConical className="w-5 h-5 text-cyan-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--text-main)] mb-0.5">
                                                {apt.labName} <span className="text-[var(--text-muted)] opacity-20 mx-1">/</span>
                                                <span className="text-cyan-500">{apt.test}</span>
                                            </p>
                                            <p className="text-[10px] text-[var(--text-muted)] opacity-60 font-bold uppercase tracking-widest">
                                                {apt.city} · {apt.date} · {apt.slot}
                                            </p>
                                            <p className="text-[9px] font-mono text-[var(--text-muted)] opacity-40 mt-0.5">{apt.bid}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {apt.status === 'cancelled' ? (
                                            <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <ShieldAlert className="w-3 h-3" /> Cancelled
                                            </span>
                                        ) : apt.status === 'uploaded' ? (
                                            <div className="flex items-center gap-2">
                                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                    ✔ Report Ready
                                                </span>
                                                <button
                                                    onClick={() => navigate(`/patient-dashboard`)}
                                                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-900/30 group"
                                                >
                                                    View AI Report
                                                    <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                    Pending
                                                </span>
                                                <button
                                                    onClick={() => setCancelModal({ open: true, id: apt._id, lab: apt.labName, test: apt.test })}
                                                    className="bg-rose-500/10 text-rose-500 border border-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Cancel Modal */}
            <AnimatePresence>
                {cancelModal.open && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setCancelModal({ open: false, id: null, lab: '', test: '' })}
                            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                className="glass-panel p-8 rounded-[32px] max-w-sm w-full border border-rose-500/30 text-center"
                            >
                                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 flex items-center justify-center rounded-[20px] mx-auto mb-5 border border-rose-500/20">
                                    <ShieldAlert className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Cancel Appointment?</h3>
                                <p className="text-xs text-white/40 mb-8 font-medium leading-relaxed">
                                    Cancel <span className="text-white font-bold">{cancelModal.test}</span> at <span className="text-white font-bold">{cancelModal.lab}</span>? This action cannot be undone.
                                </p>
                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 border-white/10" onClick={() => setCancelModal({ open: false, id: null, lab: '', test: '' })} disabled={cancelLoading}>Dismiss</Button>
                                    <Button className="bg-rose-600 flex-1" onClick={handleCancel} disabled={cancelLoading}>
                                        {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
