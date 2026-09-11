import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, TrendingUp, Loader2, FileText, AlertCircle, PieChart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from 'recharts';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

export default function CompareReports() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }

    const fetchComparison = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5002/api/patient-diagnosis/compare-recent`, {
          headers: { "x-auth-token": token }
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.msg || 'Failed to fetch comparison');
        }

        setComparison(data.comparison);
        setCount(data.count);
      } catch (err) {
        console.error("Failed to fetch comparison:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [token, user, navigate]);

  const chartData = React.useMemo(() => {
    if (!comparison?.table_data) return [];
    return comparison.table_data.map(row => ({
      name: row.parameter,
      r1: parseFloat(String(row.r1).replace(/[^\d.-]/g, '')) || 0,
      r2: parseFloat(String(row.r2).replace(/[^\d.-]/g, '')) || 0,
      r3: parseFloat(String(row.r3).replace(/[^\d.-]/g, '')) || 0,
      percentChange: parseFloat(String(row.percent).replace(/[^\d.-]/g, '')) || 0,
      absChange: Math.abs(parseFloat(String(row.change).replace(/[^\d.-]/g, '')) || 0),
    }));
  }, [comparison]);

  return (
    <div className="flex-grow flex flex-col px-6 py-12 text-[var(--text-main)] max-w-5xl mx-auto w-full relative z-10 min-h-screen">
      <div className="fixed inset-0 bg-[var(--bg-main)] -z-20 transition-colors duration-500" />
      <div className="fixed inset-0 bg-mesh opacity-30 -z-10 pointer-events-none" />
      <div className="blob w-[600px] h-[600px] bg-cyan-500/5 -top-40 -left-40 blur-[120px] transition-colors duration-500" />
      <div className="blob w-[600px] h-[600px] bg-purple-500/5 -bottom-40 -right-40 blur-[120px] transition-colors duration-500" />

      {/* Header */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex items-center gap-6 mb-12">
        <Button
          variant="outline"
          onClick={() => navigate('/patient-dashboard')}
          className="h-12 w-12 rounded-2xl flex items-center justify-center border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl transition-all p-0"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-muted)]" />
        </Button>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Report Comparison</h1>
          <p className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] mt-1">
            AI-Driven Timeline Analysis
          </p>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={{ delay: 0.1 }} className="bg-[var(--glass-bg)] backdrop-blur-3xl p-10 rounded-[40px] relative overflow-hidden border border-[var(--glass-border)] shadow-2xl min-h-[400px] flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] -z-10" />

        <div className="flex items-center justify-between mb-8 pb-8 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <TrendingUp className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-[0.2em]">Parameter Trajectory</h2>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-1">Cross-referencing {count || 'recent'} reports</p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3" /> Neural AI Engine
          </div>
        </div>

        <div className="flex-grow flex flex-col justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] gap-6">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-500 opacity-80" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60">Synthesizing Clinical Timeline...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-6">
              <AlertCircle className="w-16 h-16 opacity-80" />
              <p className="text-sm font-black uppercase tracking-widest">{error}</p>
            </div>
          ) : !comparison ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] gap-6">
              <FileText className="w-16 h-16 opacity-30" />
              <p className="text-sm font-black uppercase tracking-widest opacity-60">No Analysis Available</p>
            </div>
          ) : (
            <div className="animate-fade-in w-full">
              <div className="mb-8 p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-100 text-sm md:text-base leading-relaxed tracking-wide font-medium shadow-lg backdrop-blur-md">
                <span className="font-black text-indigo-400 uppercase tracking-widest text-[10px] mb-2 block flex items-center gap-2"><Activity className="w-3 h-3" /> Clinical Summary</span>
                {comparison.health_summary}
              </div>

              <div className="overflow-x-auto rounded-3xl border border-[var(--glass-border)] bg-[var(--input-bg)] shadow-2xl backdrop-blur-xl">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-[var(--bg-main)]/50 text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)] border-b border-[var(--glass-border)]">
                      <th className="px-6 py-4 max-w-[150px] truncate">Parameter</th>
                      <th className="px-6 py-4">Report 1 (New)</th>
                      <th className="px-6 py-4">Report 2</th>
                      <th className="px-6 py-4">Report 3 (Old)</th>
                      <th className="px-6 py-4">Variance</th>
                      <th className="px-6 py-4">% Change</th>
                      <th className="px-6 py-4 text-center">Trend Indicator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {comparison.table_data?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-cyan-400 tracking-wider uppercase max-w-[150px] truncate">{row.parameter}</td>
                        <td className="px-6 py-4 text-sm font-medium">{row.r1}</td>
                        <td className="px-6 py-4 text-sm font-medium">{row.r2}</td>
                        <td className="px-6 py-4 text-sm font-medium opacity-60">{row.r3 || '-'}</td>
                        <td className="px-6 py-4 text-sm font-black tracking-wider">
                          <span className={String(row.change).startsWith('+') ? 'text-emerald-400' : String(row.change).startsWith('-') ? 'text-rose-400' : 'text-gray-400'}>
                            {row.change}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-black tracking-wider opacity-80">{row.percent}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={
                            `px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${String(row.trend).toLowerCase() === 'improving' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              String(row.trend).toLowerCase() === 'declining' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`
                          }>
                            {row.trend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Visualizations Module */}
              <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Line Chart */}
                <div className="bg-[var(--glass-bg)] p-6 rounded-[32px] border border-[var(--glass-border)] relative shadow-2xl backdrop-blur-xl">
                  <h3 className="text-[10px] font-black tracking-widest uppercase text-cyan-500 mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Multi-Report Trend (Line)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => val?.substring(0, 8) + '...'} />
                        <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Line type="monotone" dataKey="r3" stroke="#94a3b8" strokeDasharray="5 5" name="Oldest (R3)" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="r2" stroke="#818cf8" name="Previous (R2)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="r1" stroke="#06b6d4" name="Latest (R1)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-[var(--glass-bg)] p-6 rounded-[32px] border border-[var(--glass-border)] relative shadow-2xl backdrop-blur-xl">
                  <h3 className="text-[10px] font-black tracking-widest uppercase text-cyan-500 mb-6 flex items-center gap-2"><PieChart className="w-4 h-4" /> Absolute Variance (Bar)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => val?.substring(0, 8) + '...'} />
                        <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'var(--glass-border)' }} contentStyle={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--glass-border)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main)' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="r2" fill="#818cf8" name="Previous (R2)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="r1" fill="#06b6d4" name="Latest (R1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Radar Chart */}
                <div className="bg-[var(--glass-bg)] p-6 rounded-[32px] border border-[var(--glass-border)] relative shadow-2xl backdrop-blur-xl">
                  <h3 className="text-[10px] font-black tracking-widest uppercase text-cyan-500 mb-6 flex items-center gap-2"><Activity className="w-4 h-4" /> Parameter Distribution (Radar)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData.slice(0, 6)}>
                        <PolarGrid stroke="var(--glass-border)" />
                        <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 9, opacity: 0.5 }} />
                        <Radar name="Latest (R1)" dataKey="r1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                        <Radar name="Previous (R2)" dataKey="r2" stroke="#818cf8" fill="#818cf8" fillOpacity={0.4} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--glass-border)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main)' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scatter Chart (Bubble) */}
                <div className="bg-[var(--glass-bg)] p-6 rounded-[32px] border border-[var(--glass-border)] relative shadow-2xl backdrop-blur-xl">
                  <h3 className="text-[10px] font-black tracking-widest uppercase text-cyan-500 mb-6 flex items-center gap-2"><Activity className="w-4 h-4" /> % Volatility (Scatter Bubble)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                        <XAxis type="category" dataKey="name" name="Parameter" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => val?.substring(0, 5) + '...'} />
                        <YAxis type="number" dataKey="percentChange" name="% Change" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} unit="%" />
                        <ZAxis type="number" dataKey="absChange" range={[50, 400]} name="Absolute Delta" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--glass-border)', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main)' }} />
                        <Scatter name="Volatility" data={chartData} fill="#f43f5e" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
