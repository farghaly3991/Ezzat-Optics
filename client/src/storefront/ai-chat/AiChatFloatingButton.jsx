import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, X, MessageSquareQuote } from 'lucide-react';
import { useStore } from '../../shared/context/StoreContext';

export default function AiChatFloatingButton() {
  const { isAiChatOpen, setIsAiChatOpen, config } = useStore();
  const [showTooltip, setShowTooltip] = useState(true);

  // Auto-dismiss tooltip after 8 seconds or when opened
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 9000);
    return () => clearTimeout(timer);
  }, []);

  // Do not show AI assistant button if AI is disabled or credentials not available
  if (!config?.isAiAvailable) return null;
  if (isAiChatOpen) return null;

  return (
    <aside aria-label="المساعد الذكي" className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-40 flex flex-col items-end gap-2 pointer-events-auto">
      {/* Interactive Tooltip Callout */}
      {showTooltip && (
        <div className="relative animate-in fade-in slide-in-from-bottom-3 duration-300 max-w-xs bg-surface border-2 border-primary/40 text-ink text-xs font-bold p-3 rounded-2xl shadow-2xl flex items-start gap-2.5">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute -top-2 -left-2 w-5 h-5 bg-paper hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center text-ink-soft border border-line shadow-sm transition-colors"
            title="إغلاق التنبيه"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-black text-ink">محتار في الاختيار؟ 🤖</p>
            <p className="text-[11px] text-ink-soft font-medium leading-relaxed mt-0.5">
              اسألني عن أي منتج، قارن بين المواصفات، أو ابحث بميزانيتك!
            </p>
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => {
          setShowTooltip(false);
          setIsAiChatOpen(true);
        }}
        className="group relative flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-gradient-to-r from-primary via-indigo-600 to-primary bg-[length:200%_auto] hover:bg-right text-white font-bold text-xs shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20"
        title="فتح المساعد الذكي"
      >
        {/* Subtle pulse ring */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary to-indigo-500 opacity-40 blur-sm group-hover:opacity-80 animate-pulse -z-10" />

        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>

        <span className="tracking-tight text-white drop-shadow-sm font-bold text-xs">
          المساعد الذكي
        </span>

        <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-extrabold bg-white/25 px-1.5 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" /> AI
        </span>
      </button>
    </aside>
  );
}
