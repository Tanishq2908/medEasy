import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { 
  Dna, 
  Activity, 
  ShieldCheck, 
  AlertCircle, 
  TrendingUp, 
  ArrowRight, 
  Layers, 
  Zap,
  Globe,
  Heart,
  Droplets,
  Microscope,
  ChevronDown,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const chartData = [
  { name: 'Jan', value: 400, rbc: 4.5, hemoglobin: 14.2 },
  { name: 'Feb', value: 300, rbc: 4.8, hemoglobin: 14.5 },
  { name: 'Mar', value: 600, rbc: 5.1, hemoglobin: 15.0 },
  { name: 'Apr', value: 800, rbc: 5.0, hemoglobin: 14.8 },
  { name: 'May', value: 500, rbc: 4.9, hemoglobin: 14.6 },
  { name: 'Jun', value: 900, rbc: 5.2, hemoglobin: 15.2 },
];

const pieData = [
  { name: 'Healthy', value: 70, color: '#0ea5e9' },
  { name: 'Monitoring', value: 20, color: '#f59e0b' },
  { name: 'Critical', value: 10, color: '#ef4444' },
];

const DNAStrand = ({ scrollProgress }) => {
  const rotateZ = useTransform(scrollProgress, [0, 1], [0, 360]);
  const opacity = useTransform(scrollProgress, [0, 0.8, 1], [1, 0.5, 0.2]);
  const scale = useTransform(scrollProgress, [0, 0.5, 1], [1, 1.2, 0.8]);

  return (
    <motion.div 
      style={{ rotateZ, opacity, scale }}
      className="relative w-64 h-[500px] flex items-center justify-center p-12"
    >
      {[...Array(20)].map((_, i) => {
        return (
          <div
            key={i}
            className="absolute left-0 w-full flex justify-between px-4 items-center"
            style={{
              top: `${i * 5}%`,
              transform: `rotateY(${i * 18}deg)`
            }}
          >
            {/* Left Base */}
            <motion.div 
              className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]"
              style={{ x: useTransform(scrollProgress, [0, 1], [0, -i * 5]) }}
            />
            {/* Connecting Line */}
            <motion.div 
              className="h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-40"
              style={{ width: useTransform(scrollProgress, [0, 1], ['100%', '0%']) }}
            />
            {/* Right Base */}
            <motion.div 
              className="w-4 h-4 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.8)]"
              style={{ x: useTransform(scrollProgress, [0, 1], [0, i * 5]) }}
            />
          </div>
        );
      })}
    </motion.div>
  );
};

const MetricCard = ({ title, value, unit, icon: Icon, trend, status }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="glass-panel p-6 rounded-[24px] relative overflow-hidden group"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-700 
      ${status === 'alert' ? 'from-red-500' : status === 'warning' ? 'from-amber-500' : 'from-cyan-500'}`} 
    />
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${status === 'alert' ? 'bg-red-500/10 text-red-500' : status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
        <Icon className="w-6 h-6" />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-md ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h4 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{title}</h4>
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-black text-[var(--text-main)] tracking-tight">{value}</span>
      <span className="text-sm font-bold text-[var(--text-muted)]">{unit}</span>
    </div>
  </motion.div>
);

const StitchPremiumUI = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  return (
    <div ref={containerRef} className="relative min-h-[300vh] bg-[var(--bg-main)] selection:bg-cyan-500/30 selection:text-cyan-900 transition-colors duration-1000 overflow-x-hidden">
      <div className="fixed inset-0 bg-mesh pointer-events-none opacity-40" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center whitespace-nowrap bg-[var(--bg-main)]/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-[var(--glass-border)] md:border-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Microscope className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-[var(--text-main)]">MEDEZ <span className="text-cyan-500">STITCH</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-12 h-6 bg-white/10 border border-white/20 rounded-full relative p-1 cursor-pointer transition-colors"
          >
            <motion.div 
              animate={{ x: isDarkMode ? 24 : 0 }}
              className="w-4 h-4 bg-white rounded-full shadow-md"
            />
          </button>
          <button 
            onClick={() => navigate('/patient-dashboard')}
            className="button-premium text-white text-[10px] font-black px-6 py-3 rounded-xl uppercase tracking-widest hidden md:block"
          >
            Dashboard
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
          >
            <h1 className="text-6xl lg:text-8xl font-black text-[var(--text-main)] leading-[0.9] tracking-tighter mb-6">
              THE FUTURE OF <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">GENOMIC AI</span>
            </h1>
            <p className="text-xl text-[var(--text-muted)] max-w-xl leading-relaxed mb-10">
              Immersive diagnostic intelligence powered by Stitch Design. Visualize biological complexities with real-time molecular staging and pattern recognition.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => navigate('/report-analysis')}
                className="px-8 py-4 bg-[var(--text-main)] text-[var(--bg-main)] rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:scale-105 transition-all shadow-xl"
              >
                Start Analysis <ArrowRight className="w-4 h-4" />
              </button>
              <button className="px-8 py-4 glass-panel rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
                Sample Reports
              </button>
            </div>
          </motion.div>

          <div className="flex justify-center items-center h-full relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-[120px] rounded-full scale-50" />
            <DNAStrand scrollProgress={smoothProgress} />
          </div>
        </div>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[var(--text-muted)] flex flex-col items-center gap-2 opacity-50"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Scroll to Explore</span>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </section>

      {/* Dashboard Section */}
      <section className="relative min-h-screen py-32 flex items-center">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row justify-between items-end gap-8 mb-16">
            <div>
              <h2 className="text-sm font-bold text-cyan-500 uppercase tracking-[0.4em] mb-4">Biological Intelligence</h2>
              <h3 className="text-5xl font-black text-[var(--text-main)] tracking-tight">Data Dashboard</h3>
            </div>
            <p className="text-[var(--text-muted)] max-w-md text-right hidden lg:block">
              Live streaming of diagnostic markers. Real-time visualization of hematological and genetic status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <MetricCard title="Hemoglobin" value="14.2" unit="g/dL" icon={Droplets} trend={+2.4} />
            <MetricCard title="RBC Count" value="4.82" unit="M/µL" icon={Activity} trend={-1.2} status="warning" />
            <MetricCard title="Cardiac Rhythm" value="72" unit="BPM" icon={Heart} trend={+0.5} />
            <MetricCard title="Risk Index" value="12" unit="%" icon={ShieldCheck} status="alert" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass-panel p-8 rounded-[32px]">
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-xl font-bold flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-cyan-500" /> Molecular Trends
                </h4>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-500 text-[10px] font-bold">1W</button>
                  <button className="px-3 py-1 rounded-lg hover:bg-white/5 text-[10px] font-bold">1M</button>
                  <button className="px-3 py-1 rounded-lg hover:bg-white/5 text-[10px] font-bold">ALL</button>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-[32px] flex flex-col items-center justify-center">
              <h4 className="text-xl font-bold mb-8 w-full">Stability Index</h4>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 space-y-4 w-full">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-bold text-[var(--text-muted)]">{item.name}</span>
                    </div>
                    <span className="text-xs font-black text-[var(--text-main)]">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insights Section */}
      <section className="relative py-32 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold text-cyan-500 uppercase tracking-[0.4em] mb-4 text-glow-primary">AI Prediction Engine</h2>
            <h3 className="text-5xl font-black text-white tracking-tight mb-6">Diagnostic Insights</h3>
            <p className="text-slate-400">Advanced temporal reasoning identifies potential abnormalities before they become critical. Predictive modeling based on multi-omic alignment.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 rounded-[32px] bg-emerald-500/10 border border-emerald-500/20 group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500 rounded-lg text-white shadow-lg shadow-emerald-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Normal Range</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-4">Oxygen Saturation Stability</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">Current blood oxygen levels show high resilience during physical exertion. SpO2 maintained at 98% throughout the testing phase.</p>
              <button className="flex items-center gap-2 text-xs font-bold text-emerald-500 group-hover:gap-4 transition-all uppercase">Detailed Analytics <ArrowRight className="w-4 h-4" /></button>
            </div>

            <div className="p-8 rounded-[32px] bg-amber-500/10 border border-amber-500/20 group hover:border-amber-500/40 transition-all">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-500 rounded-lg text-white shadow-lg shadow-amber-500/20">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Monitoring Required</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-4">Metabolic Variability</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">Slight fluctuations detected in glucose regulation patterns. Recommendation: Continuous glucose monitoring for 24 hours.</p>
              <button className="flex items-center gap-2 text-xs font-bold text-amber-500 group-hover:gap-4 transition-all uppercase">Schedule Follow-up <ArrowRight className="w-4 h-4" /></button>
            </div>

            <div className="p-8 rounded-[32px] bg-red-500/10 border border-red-500/20 group hover:border-red-500/40 transition-all shadow-[0_0_50px_rgba(239,68,68,0.05)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-500 rounded-lg text-white shadow-lg shadow-red-500/20">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Critical Alert</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-4">Cardiovascular Anomaly</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">Irregular PR interval detected during nocturnal monitoring. Higher likelihood of premature atrial contractions. Immediate review advised.</p>
              <button className="flex items-center gap-2 text-xs font-bold text-red-500 group-hover:gap-4 transition-all uppercase">Alert Physician <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-20 border-t border-[var(--glass-border)] bg-[var(--bg-main)]">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12 mb-20 text-center md:text-left">
            <div>
              <div className="flex items-center gap-3 mb-6 justify-center md:justify-start">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg">
                  <Microscope className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-black tracking-tighter text-[var(--text-main)]">MEDEZ <span className="text-cyan-500">STITCH</span></span>
              </div>
              <p className="text-[var(--text-muted)] max-w-sm">Premium genomic intelligence and diagnostic safety protocols. Built for the next generation of healthcare.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 w-full md:w-auto">
              <div className="space-y-4">
                <h5 className="font-bold uppercase text-[10px] tracking-widest text-cyan-500">Platform</h5>
                <ul className="space-y-2 text-sm font-medium text-[var(--text-muted)]">
                  <li>Dashboard</li>
                  <li>Molecular Staging</li>
                  <li>Cardiology</li>
                  <li>Hematology</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h5 className="font-bold uppercase text-[10px] tracking-widest text-cyan-500">Legal</h5>
                <ul className="space-y-2 text-sm font-medium text-[var(--text-muted)]">
                  <li>Privacy</li>
                  <li>Terms</li>
                  <li>HIPAA</li>
                  <li>Security</li>
                </ul>
              </div>
              <div className="space-y-4 hidden md:block">
                <h5 className="font-bold uppercase text-[10px] tracking-widest text-cyan-500">Connect</h5>
                <ul className="space-y-2 text-sm font-medium text-[var(--text-muted)]">
                  <li>API Docs</li>
                  <li>Help Center</li>
                  <li>Contact</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center pt-12 border-t border-[var(--glass-border)] gap-6 opacity-60">
            <span className="text-[9px] font-bold text-[var(--text-muted)] tracking-widest uppercase">© 2026 MEDEZ STITCH. EMPOWERING BIOLOGICAL CLARITY.</span>
            <div className="flex items-center gap-4">
              <Layers className="w-4 h-4 text-[var(--text-muted)] hover:text-cyan-500 cursor-pointer transition-colors" />
              <Globe className="w-4 h-4 text-[var(--text-muted)] hover:text-cyan-500 cursor-pointer transition-colors" />
              <Zap className="w-4 h-4 text-[var(--text-muted)] hover:text-cyan-500 cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StitchPremiumUI;
