import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import HisaabAPI from '../services/api';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  RotateCcw,
  User
} from 'lucide-react';

export function CopilotDrawer({ isOpen, onClose }) {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: language === 'roman_urdu'
        ? "Assalam-o-Alaikum! Main HisaabAI Copilot hoon. Al-Madina Store ke inventory, stockout risks, khata wasooli aur budget planning ke mutaliq koi bhi sawal puchein."
        : "Hello! I am your HisaabAI Copilot. Ask me anything about Al-Madina Store's inventory, stockout risks, khata recovery, or budget planning.",
      provider: 'Deterministic Rule Engine',
      latency: '24ms',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const quickPrompts = [
    {
      urdu: "Mere paas 50,000 rupay hain, aaj kya khareedun aur kyun?",
      eng: "I have PKR 50,000. What should I buy today and why?",
    },
    {
      urdu: "Meri dukaan ka aaj ka hisaab aur 3 urgent actions batayein",
      eng: "Summarize today's store health and 3 urgent actions",
    },
    {
      urdu: "Kaunsa maal phasa hua hai (dead stock)?",
      eng: "Which items are dead stock and how to liquidate?",
    },
    {
      urdu: "Sabse khatarnak udhaar kiska hai?",
      eng: "Who are the highest risk khata defaulters?",
    },
  ];

  const handleSend = async (messageToSend) => {
    const text = messageToSend || input;
    if (!text.trim()) return;

    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    if (!messageToSend) setInput('');

    try {
      setLoading(true);
      const startTime = Date.now();
      const res = await HisaabAPI.chatCopilot(text, language);
      const latencyMs = Date.now() - startTime;

      let providerLabel = 'Tier 1: Google Gemini 1.5 Flash';
      if (res.provider_used === 'groq') {
        providerLabel = 'Tier 2: Groq Llama 3.1 8B';
      } else if (res.provider_used === 'deterministic' || res.provider_used === 'offline') {
        providerLabel = 'Tier 3: Offline Deterministic Engine';
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: res.response || 'Jawab ready hai.',
          provider: providerLabel,
          latency: `${latencyMs}ms`,
        }
      ]);
    } catch (err) {
      console.error('Copilot chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: 'Backend se rabta nahi ho saka. Baraye meherbani connection check karein.',
          provider: 'Offline Fallback',
          latency: '0ms',
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden"
        >
          {/* Header with Avatar */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl overflow-hidden border border-amber-500/40 shadow-lg shadow-amber-500/20 bg-slate-950">
                <img
                  src="/src/assets/copilot-avatar.jpg"
                  alt="HisaabAI Copilot Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/src/assets/logo-mark.svg';
                  }}
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900"></span>
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-1.5">
                  <span>HisaabAI Dukandar Copilot</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </h3>
                <span className="text-[11px] text-emerald-400 font-semibold block">
                  3-Tier Multi-LLM Fallback (Gemini • Groq • Offline)
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Message Stream */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed space-y-2 ${
                    isAssistant
                      ? 'bg-slate-950/80 border border-slate-800 text-slate-100'
                      : 'bg-emerald-600 text-white font-medium shadow-md shadow-emerald-950/30'
                  }`}>
                    <p className="whitespace-pre-line font-sans">
                      {m.text}
                    </p>

                    {isAssistant && m.provider && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                        <span className="text-emerald-400/90 font-bold">{m.provider}</span>
                        <span>{m.latency}</span>
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Al-Madina AI is analyzing store data...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/60 overflow-x-auto flex items-center gap-1.5">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(language === 'roman_urdu' ? q.urdu : q.eng)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition whitespace-nowrap shrink-0"
              >
                {language === 'roman_urdu' ? q.urdu : q.eng}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('copilot_placeholder')}
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white text-xs sm:text-sm outline-none transition"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold transition shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CopilotDrawer;
