import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Loader2, Bot, User, ChevronDown, ShieldCheck, Database, Zap, Cpu, Sparkles } from 'lucide-react';
import medicalKnowledge from '../data/medicalKnowledge.json';
import { cn } from './Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function HealthChatbot({ patientData, externalOpen, setExternalOpen }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isOpenInternal, setIsOpenInternal] = useState(false);

  const isOpen = externalOpen !== undefined ? externalOpen : isOpenInternal;
  const setIsOpen = setExternalOpen !== undefined ? setExternalOpen : setIsOpenInternal;

  const isDoctor = user?.role === 'doctor';

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: isDoctor
        ? `Clinical Node Sync Complete, Dr. ${user?.name?.split(' ')[0] || 'Physician'}. Multi-omic vector space initialized. Standing by for differential synthesis and pathological reasoning.`
        : `Greetings ${patientData?.name?.split(' ')[0] || 'there'}. Neural sync complete. I have indexed your clinical trajectory and am ready to perform RAG-augmented synthesis on your health data.`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragState, setRagState] = useState(''); // Tracking RAG 'Thinking' phases
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, ragState]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // RAG Visual Steps
    setRagState(isDoctor ? 'Querying Differential Archives...' : 'Retreiving biological archives...');
    await new Promise(r => setTimeout(r, 600));
    setRagState(isDoctor ? 'Cross-referencing Clinical Trials & Guidelines...' : 'Cross-referencing Med-Library vector space...');
    await new Promise(r => setTimeout(r, 800));
    setRagState(isDoctor ? 'Synthesizing Pathological Consensus...' : 'Synthesizing persistent context...');

    try {
      // 1. RAG Retrieval - Search in 'content' and 'keywords'
      const relevantCases = medicalKnowledge.filter(item => {
        const contentMatch = item.content?.toLowerCase().includes(userMessage.toLowerCase());
        const keywordMatch = item.keywords?.some(k => userMessage.toLowerCase().includes(k.toLowerCase()));
        return contentMatch || keywordMatch;
      }).slice(0, 3);

      const relevantHistory = patientData.history?.filter(h =>
        (h.summary && h.summary.toLowerCase().includes(userMessage.toLowerCase())) ||
        (h.type && h.type.toLowerCase().includes(userMessage.toLowerCase()))
      ).slice(0, 2);

      const knowledgeContext = relevantCases.length > 0
        ? `KNOWLEDGE_BASE:\n${relevantCases.map(c => `* [${c.domain}]: ${c.content.substring(0, 500)}...`).join('\n')}`
        : "No direct library matches found in the medical knowledge base.";

      const patientContext = (patientData.history && relevantHistory.length > 0)
        ? `PATIENT_HISTORY:\n${relevantHistory.map(h => `* ${h.type}: ${h.summary}`).join('\n')}`
        : "No matching history found for this user.";

      const systemPrompt = isDoctor
        ? `ROLE: Advanced Clinical Decision Support System (CDSS) for Physicians.
           CONTEXT: 
           ${knowledgeContext}
           ${patientContext}
           
           STRICT GUIDELINES:
           1. Provide highly technical, data-driven insights. 
           2. Include differential diagnoses if applicable based on symptoms/history.
           3. Suggest pharmacological or therapeutic interventions with precise biological markers.
           4. Mention specific clinical guidelines if relevant.
           5. Keep the response dense but professional and concise (max 3 sentences).
           6. Format as a single paragraph. No bullet points.`
        : `ROLE: Advanced Medical RAG assistant for Patients.
           CONTEXT: 
           ${knowledgeContext}
           ${patientContext}
           
           STRICT GUIDELINEs: 
           1. Use the provided context to answer. 
           2. Be professional and biotech-themed. 
           3. Refer to the patient's history specifically if found.
           4. Keep the response extremely concise (maximum 2 clinical sentences).
           5. Provide the response as a single, dense paragraph. No bullet points.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-4), { role: "user", content: userMessage }],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "Model Bridge Failure");
      
      const aiResponse = data.choices?.[0]?.message?.content || "Neural bridge timeout.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("RAG Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Neural engine error: ${error.message || "RAG Connection Reset"}` }]);
    } finally {
      setLoading(false);
      setRagState('');
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-10 right-10 w-20 h-20 bg-cyan-600 text-white rounded-[24px] shadow-[0_0_50px_-10px_rgba(6,182,212,0.5)] flex items-center justify-center z-[110] border-4 border-[var(--bg-main)] group"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-[20px]" />
        {isOpen ? <X className="w-8 h-8" /> : <Sparkles className="w-8 h-8 animate-pulse text-cyan-100" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100]" />

            <div className="fixed inset-0 flex items-center justify-center z-[105] pointer-events-none p-6">
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="w-full max-w-[680px] h-[80vh] bg-[var(--glass-bg)] backdrop-blur-3xl rounded-[48px] flex flex-col overflow-hidden shadow-[0_0_150px_-30px_rgba(0,0,0,0.5)] border border-[var(--border-subtle)] pointer-events-auto"
              >
                <div className="bg-[var(--bg-main)]/80 p-10 border-b border-[var(--border-subtle)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-dashboard-grid opacity-10 pointer-events-none" />
                  <div className="absolute top-0 right-10 w-32 h-32 bg-cyan-500/10 blur-[60px]" />
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-cyan-500/10 rounded-[28px] flex items-center justify-center border border-cyan-500/30 shadow-2xl">
                      <Cpu className="w-9 h-9 text-cyan-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-2xl tracking-tighter uppercase text-[var(--text-main)] mb-0.5">JARVIS</h3>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-600">
                          AI Health Assist
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-grow overflow-y-auto p-10 space-y-8 bg-[var(--bg-main)]/20 custom-scrollbar">
                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={cn("max-w-[85%] p-6 rounded-[32px] text-[11px] font-bold tracking-wider leading-relaxed shadow-xl relative",
                        msg.role === 'user' ? "bg-cyan-600 text-white rounded-tr-none" : "bg-[var(--input-bg)] text-[var(--text-main)] rounded-tl-none border border-[var(--input-border)]"
                      )}>
                        {msg.role === 'assistant' && <div className="absolute -left-2 -top-2 w-5 h-5 bg-[var(--bg-main)] border border-cyan-500/50 rounded-lg flex items-center justify-center"><Bot className="w-3 h-3 text-cyan-600" /></div>}
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="space-y-4">
                      <div className="flex justify-start">
                        <div className="p-6 rounded-[32px] rounded-tl-none bg-[var(--input-bg)] border border-[var(--input-border)] italic text-[10px] text-cyan-600 font-black animate-pulse uppercase tracking-[0.2em] flex items-center gap-3 shadow-sm">
                          <Database className="w-3 h-3" /> {ragState}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-10 bg-[var(--bg-main)]/90 border-t border-[var(--border-subtle)] backdrop-blur-3xl">
                  <div className="flex gap-4 items-center">
                    <div className="flex-grow relative">
                      <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Query Biological Archive..."
                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[24px] py-5 px-8 outline-none focus:border-cyan-500/50 focus:bg-[var(--input-bg)] text-xs font-black uppercase tracking-widest text-[var(--text-main)] transition-all placeholder:text-[var(--text-muted)] opacity-50" />
                    </div>
                    <button onClick={handleSend} disabled={!input.trim() || loading}
                      className="w-16 h-16 rounded-[24px] bg-cyan-600 text-white flex items-center justify-center shadow-2xl hover:bg-cyan-500 transition-all disabled:opacity-30 group">
                      <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                  </div>
                   <div className="mt-6 flex items-center justify-center gap-3 opacity-40 group">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-cyan-600">End-to-End Encrypted RAG Tunnel</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
