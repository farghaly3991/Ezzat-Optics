import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Bot,
  RotateCcw,
  ExternalLink,
  Scale,
  Check,
  Plus,
  Flame,
  Star,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  HelpCircle,
  ShoppingBag,
  Bell,
  Phone,
  CheckCircle2,
  MessageCircle,
  Mic
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import { useGeminiVoiceInput } from '../../shared/utils/useGeminiVoiceInput';

const DEFAULT_WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'ai',
  text: `مرحباً بك! أنا مستشارك الذكي للتسوق والبحث والمقارنات 🤖\n\nيمكنني مساعدتك في:\n1. 🔍 البحث الذكي في الكتالوج بكتابة المواصفات أو الميزانية أو الماركة.\n2. ⚖️ مقارنة شاملة وعادلة بين أي منتجين واختيار الأنسب لك.\n3. 📊 استعراض المنتجات الأكثر مشاهدة، الأعلى تقييماً، أو الأكثر مبيعاً.\n\nما الذي تبحث عنه أو تود مقارنته اليوم؟`,
  suggestedActions: [
    'تكييف 1.5 حصان انفرتر',
    'قارن بين تكييف 1.5 وتكييف 2.25 حصان',
    'أجهزة لابتوب للبرمجة والعمل',
    'المنتجات الأكثر مشاهدة',
    'المنتجات الأعلى تقييماً'
  ],
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export default function AiChatModal() {
  const {
    isAiChatOpen,
    setIsAiChatOpen,
    aiChatInitialPrompt,
    setAiChatInitialPrompt,
    aiComparisonContext,
    setAiComparisonContext,
    setActiveProductModal,
    addToComparison,
    removeFromComparison,
    isInComparison,
    config,
    user,
    token,
    sessionId,
    visitorId,
    showToast
  } = useStore();

  const navigate = useNavigate();

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    isListening: isVoiceListening,
    isProcessing: isVoiceProcessing,
    toggleVoice: toggleChatVoice
  } = useGeminiVoiceInput({
    contextHint: 'search',
    onTranscript: (transcript, provider) => {
      setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
      if (showToast) {
        const src = provider === 'gemini' ? 'Gemini Audio' : 'متصفح الويب';
        showToast(`🎙️ تم التقاط (${src}): «${transcript}»`);
      }
    },
    onError: (msg) => {
      if (showToast) showToast(msg, 'error');
    }
  });
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('store_ai_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading chat history:', e);
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [compactContext, setCompactContext] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('store_ai_compact_context')) || null;
    } catch {
      return null;
    }
  });

  const [desiredForms, setDesiredForms] = useState({});

  const handleSaveDesiredProduct = async (msgId, queryText) => {
    const form = desiredForms[msgId] || {};
    const phoneToUse = (form.phone || user?.phone || localStorage.getItem('store_user_phone') || '').trim();

    if (!phoneToUse && !visitorId && !user?._id) {
      showToast('يرجى إدخال رقم الهاتف أو الواتساب للتنبيه', 'error');
      return;
    }

    setDesiredForms((prev) => ({
      ...prev,
      [msgId]: { ...prev[msgId], loading: true }
    }));

    try {
      const res = await axios.post('/api/store-public/desired-products/plan-and-save', {
        queryText: queryText || 'طلب منتج من الشات',
        phone: phoneToUse,
        customerName: user?.name || localStorage.getItem('store_user_name') || '',
        visitorId,
        channelPreference: form.channel || 'both'
      });

      if (res.data?.success) {
        if (phoneToUse) {
          localStorage.setItem('store_user_phone', phoneToUse);
        }
        setDesiredForms((prev) => ({
          ...prev,
          [msgId]: { ...prev[msgId], loading: false, submitted: true }
        }));
        showToast('تم حفظ طلبك بنجاح! سنقوم بإبلاغك فور توفره.');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ الطلب، يرجى المحاولة لاحقاً', 'error');
      setDesiredForms((prev) => ({
        ...prev,
        [msgId]: { ...prev[msgId], loading: false }
      }));
    }
  };

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('store_ai_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('Error writing chat history:', e);
    }
  }, [messages]);

  // Handle auto-scroll
  useEffect(() => {
    if (isAiChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isAiChatOpen]);

  // Handle initial prompt passed from other buttons
  useEffect(() => {
    if (isAiChatOpen && aiChatInitialPrompt) {
      handleSendMessage(aiChatInitialPrompt);
      setAiChatInitialPrompt('');
    }
  }, [isAiChatOpen, aiChatInitialPrompt]);

  // Handle comparison consultation context: load products into view and wait for user question!
  useEffect(() => {
    if (isAiChatOpen && aiComparisonContext?.products?.length >= 2) {
      const prods = aiComparisonContext.products;
      const prodNames = prods.map((p) => `«${p.name}»`).join(' و ');
      const comparisonGreetingMsg = {
        id: 'comp_greeting_' + Date.now(),
        sender: 'ai',
        mode: 'compare_consult',
        text: `لقد قمت بتحميل بيانات المقارنة المباشرة بين الأجهزة المحددة:\n${prodNames}\n\nأنا جاهز الآن للإجابة على استفسارك ومساعدتك في اتخاذ القرار الأنسب. في أي جانب ترغب في مقارنتها تحديداً؟ (مثلاً: الأداء والسرعة، الكاميرات، الشاشة، البطارية، أو أفضل قيمة مقابل السعر؟)`,
        comparisonProducts: prods,
        comparisonIds: prods.map((p) => String(p._id)),
        suggestedActions: [
          'أيهما يقدم أفضل قيمة مقابل السعر؟',
          'أيهما أفضل في الأداء والسرعة؟',
          'قارن بين الشاشات والبطاريات في الجهازين',
          'أيهما ترشح للاستخدام اليومي الشاق؟'
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, comparisonGreetingMsg]);
      setSelectedForComparison(prods.map((p) => String(p._id)));
      setAiComparisonContext(null); // Clear context so it doesn't trigger again
    }
  }, [isAiChatOpen, aiComparisonContext]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isAiChatOpen) {
        setIsAiChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiChatOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const isComparing = selectedForComparison && selectedForComparison.length >= 2;
      const res = await axios.post(
        '/api/store-public/chat',
        {
          message: text,
          history: messages.slice(-4).map((m) => ({ sender: m.sender, text: m.text })),
          compactContext,
          selectedProductIds: selectedForComparison,
          mode: isComparing ? 'compare_consult' : 'search',
          sessionId
        },
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'x-session-id': sessionId,
            'x-visitor-id': visitorId
          }
        }
      );

      const data = res.data;
      const aiMsg = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        text: data.reply || 'تمت معالجة طلبك بنجاح.',
        engine: data.engine || 'standard',
        matchedProducts: data.matchedProducts || [],
        comparisonProducts: data.comparisonProducts || [],
        comparisonIds: data.comparisonIds || [],
        suggestedActions: data.suggestedActions || [],
        intent: data.intent || 'general',
        userQueryText: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Save compact context for next turn
      if (data.compactContext) {
        setCompactContext(data.compactContext);
        try {
          localStorage.setItem('store_ai_compact_context', JSON.stringify(data.compactContext));
        } catch {}
      }

      // If AI determined comparison products, update selected list
      if (data.comparisonIds && data.comparisonIds.length >= 2) {
        setSelectedForComparison(data.comparisonIds);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg = {
        id: 'err_' + Date.now(),
        sender: 'ai',
        text: 'عذراً، حدث خطأ أثناء معالجة المحادثة. يمكنك المحاولة مجدداً أو مراجعة أقسام المتجر.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setSelectedForComparison([]);
    setCompactContext(null);
    localStorage.removeItem('store_ai_chat_history');
    localStorage.removeItem('store_ai_compact_context');
  };

  const toggleSelectForComparison = (prod) => {
    const prodId = String(prod._id);
    setSelectedForComparison((prev) => {
      if (prev.includes(prodId)) {
        return prev.filter((id) => id !== prodId);
      } else {
        if (prev.length >= 4) return prev;
        return [...prev, prodId];
      }
    });

    // Also toggle in global context
    if (isInComparison(prodId)) {
      removeFromComparison(prodId);
    } else {
      addToComparison(prodId);
    }
  };

  const handleOpenComparisonPage = (ids) => {
    const targetIds = (ids && ids.length >= 2 ? ids : selectedForComparison).join(',');
    setIsAiChatOpen(false);
    navigate(`/compare?ids=${targetIds}`);
  };

  if (!isAiChatOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Full-width Modal Container */}
      <div className="w-full h-full sm:max-w-6xl sm:h-[92vh] bg-surface border-0 sm:border border-line sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-ink">
        
        {/* Header Bar */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-line bg-surface/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-md sm:shadow-lg shadow-primary/20 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-lg font-black text-ink tracking-tight truncate">
                  مستشار التسوق والمقارنات الذكي
                </h3>
                <span className="hidden xs:inline-block text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                  Twin-Engine AI
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-ink-soft hidden sm:block truncate">
                بحث دلالي بالمواصفات والأسعار، مقارنة متعددة للمنتجات، وتحليل دقيق للقيمة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {selectedForComparison.length >= 2 && (
              <button
                onClick={() => handleOpenComparisonPage(selectedForComparison)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all animate-bounce"
              >
                <Scale className="w-4 h-4" />
                <span>فتح المقارنة ({selectedForComparison.length} منتجات)</span>
              </button>
            )}

            <button
              onClick={handleResetChat}
              title="بدء محادثة جديدة"
              className="p-1.5 sm:p-2 text-ink-soft hover:text-ink hover:bg-paper rounded-btn transition-colors shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsAiChatOpen(false)}
              className="p-1.5 sm:p-2 text-ink-soft hover:text-red-500 hover:bg-red-500/10 rounded-btn transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison floating strip if 2+ selected */}
        {selectedForComparison.length >= 2 && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Scale className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">تم تحديد {selectedForComparison.length} منتجات للمقارنة</span>
            </div>
            <button
              onClick={() => handleOpenComparisonPage(selectedForComparison)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-btn text-[11px] sm:text-xs font-black shadow-sm flex items-center gap-1 transition-all shrink-0"
            >
              <span>عرض المقارنة</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-paper/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-4 ${
                msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-xs font-black shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)]'
                    : 'bg-surface border border-line text-primary'
                }`}
              >
                {msg.sender === 'user' ? 'أنت' : <Bot className="w-5 h-5 text-primary" />}
              </div>

              {/* Message Bubble Content */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] space-y-3 ${
                  msg.sender === 'user' ? 'text-right' : 'text-right'
                }`}
              >
                {/* Text Bubble */}
                <div
                  className={`p-4 sm:p-5 rounded-3xl text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] rounded-tr-none font-medium'
                      : 'bg-surface text-ink border border-line rounded-tl-none font-normal'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Engine Badge */}
                {msg.engine && (
                  <div className="flex items-center gap-2 text-[10px] text-ink-soft font-bold px-2">
                    <span>
                      {msg.engine.includes('llm')
                        ? '⚡ إجابة مولدة بالذكاء الاصطناعي (LLM)'
                        : '🔍 بحث قياسي ذكي بالمواصفات'}
                    </span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                )}

                {/* Comparison Card / Banner if comparison detected */}
                {msg.comparisonProducts && msg.comparisonProducts.length >= 2 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-surface border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black text-ink">
                        <Scale className="w-4 h-4 text-emerald-600" />
                        <span>مقارنة مباشرة بين المنتجين المرشحين:</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        مواصفات وأسعار
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {msg.comparisonProducts.slice(0, 2).map((cp) => (
                        <div
                          key={cp._id}
                          className="p-2.5 rounded-xl bg-surface border border-line flex flex-col justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={cp.images?.[0] || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                              alt={cp.name}
                              className="w-10 h-10 rounded-lg object-cover bg-paper border border-line"
                            />
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-ink truncate">{cp.name}</h5>
                              <p className="text-xs font-black text-primary">
                                {cp.price?.toLocaleString()} {config?.currency || 'ج.م'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleOpenComparisonPage(msg.comparisonIds || msg.comparisonProducts.map((p) => p._id))}
                      className="w-full py-2.5 px-4 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Scale className="w-4 h-4" />
                      <span>فتح المقارنة الشاملة في صفحة مستقلة (جدول الفروقات) &larr;</span>
                    </button>
                  </div>
                )}

                {/* Matched Products Grid */}
                {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-extrabold text-ink-soft flex items-center gap-1.5 px-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                      <span>المنتجات المرشحة ({msg.matchedProducts.length}):</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {msg.matchedProducts.map((prod) => {
                        const isSelected = selectedForComparison.includes(String(prod._id));
                        return (
                          <div
                            key={prod._id}
                            className={`p-3 rounded-2xl bg-surface border transition-all flex flex-col justify-between space-y-2.5 shadow-sm hover:shadow-md ${
                              isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-line'
                            }`}
                          >
                            <div className="flex gap-2.5">
                              <img
                                src={prod.images?.[0] || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                                alt={prod.name}
                                className="w-14 h-14 rounded-xl object-cover bg-paper border border-line shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-black text-ink line-clamp-1">{prod.name}</h5>
                                <p className="text-[11px] text-ink-soft truncate mt-0.5">
                                  {prod.categoryId?.name || 'عام'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-xs font-black text-primary">
                                    {prod.price?.toLocaleString()} {config?.currency || 'ج.م'}
                                  </span>
                                  {prod.oldPrice > prod.price && (
                                    <span className="text-[10px] text-ink-soft line-through">
                                      {prod.oldPrice?.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Specs Preview Pill */}
                            {prod.specs && Object.keys(prod.specs).length > 0 && (
                              <div className="text-[10px] font-bold text-ink-soft bg-paper px-2 py-1 rounded-lg truncate border border-line/50">
                                {Object.entries(prod.specs).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 pt-1">
                              <button
                                onClick={() => {
                                  setActiveProductModal(prod);
                                  setIsAiChatOpen(false);
                                }}
                                className="flex-1 py-1.5 px-2 rounded-btn bg-paper hover:bg-primary hover:text-white text-ink text-[11px] font-bold transition-all border border-line flex items-center justify-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>عرض المنتج</span>
                              </button>

                              <button
                                onClick={() => toggleSelectForComparison(prod)}
                                className={`py-1.5 px-2.5 rounded-btn text-[11px] font-black transition-all flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-paper text-ink border border-line hover:border-emerald-500'
                                }`}
                                title={isSelected ? 'إلغاء من المقارنة' : 'إضافة للمقارنة'}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>محدد</span>
                                  </>
                                ) : (
                                  <>
                                    <Scale className="w-3 h-3 text-emerald-600" />
                                    <span>قارن</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Future Desired Product Request Prompt Card (When no products matched) */}
                {msg.sender === 'ai' &&
                  (!msg.matchedProducts || msg.matchedProducts.length === 0) &&
                  msg.id !== 'welcome' &&
                  !msg.comparisonProducts?.length && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-primary/5 to-surface border border-orange-500/30 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-black text-ink">
                            هل تحب إن لو توفر منتج شبه اللي أنت عاوزه ده يتم إبلاغك؟ 🎯
                          </h5>
                          <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">
                            لم نجد نتائج مطابقة تماماً حالياً في المتجر، ولكن يمكننا حفظ مواصفات طلبك بالذكاء الاصطناعي وتنبيهك فور توفر أي منتج مطابق!
                          </p>
                        </div>
                      </div>

                      {desiredForms[msg.id]?.submitted ? (
                        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-xs font-bold animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>تم تسجيل رغبتك بنجاح! سنقوم بإبلاغك عبر المتجر وواتساب فور توفر أي منتج مطابق.</span>
                        </div>
                      ) : desiredForms[msg.id]?.open ? (
                        <div className="space-y-3 pt-2 border-t border-orange-500/20">
                          <div>
                            <label className="block text-[11px] font-bold text-ink mb-1">
                              رقم الهاتف أو الواتساب للتواصل والتنبيه:
                            </label>
                            <div className="relative">
                              <input
                                type="tel"
                                value={desiredForms[msg.id]?.phone ?? ''}
                                onChange={(e) =>
                                  setDesiredForms((prev) => ({
                                    ...prev,
                                    [msg.id]: { ...prev[msg.id], phone: e.target.value }
                                  }))
                                }
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                                className="w-full pl-3 pr-8 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary text-left"
                              />
                              <Phone className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-2.5 pointer-events-none" />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={desiredForms[msg.id]?.loading}
                              onClick={() => handleSaveDesiredProduct(msg.id, msg.userQueryText || msg.text)}
                              className="py-2 px-4 rounded-btn bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>
                                {desiredForms[msg.id]?.loading
                                  ? 'جاري حفظ الطلب...'
                                  : 'تأكيد التسجيل وتنبيهي عند التوفر'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDesiredForms((prev) => ({
                                  ...prev,
                                  [msg.id]: { ...prev[msg.id], open: false }
                                }))
                              }
                              className="py-2 px-3 rounded-btn bg-paper hover:bg-surface border border-line text-ink-soft text-xs font-bold"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setDesiredForms((prev) => ({
                              ...prev,
                              [msg.id]: {
                                open: true,
                                phone: user?.phone || localStorage.getItem('store_user_phone') || '',
                                channel: 'both'
                              }
                            }))
                          }
                          className="w-full sm:w-auto py-2 px-4 rounded-btn bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>نعم، أبلغني فور توفر منتج شبه اللي طلبته</span>
                        </button>
                      )}
                    </div>
                  )}

                {/* Suggested Action Chips */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestedActions.map((actionText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(actionText)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-paper hover:bg-primary/10 hover:text-primary text-ink-soft border border-line hover:border-primary transition-all text-right"
                      >
                        💬 {actionText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-2xl bg-surface border border-line text-primary flex items-center justify-center">
                <Bot className="w-5 h-5 animate-spin text-primary" />
              </div>
              <div className="p-4 rounded-3xl bg-surface border border-line rounded-tl-none shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="text-xs font-bold text-ink-soft">
                  المساعد الذكي يبحث في المنتجات ويحلل المقارنة...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-2.5 sm:p-4 border-t border-line bg-surface shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-1.5 sm:gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="اسأل عن أي منتج، قارن، أو ابحث..."
                className="w-full bg-paper border border-line rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium outline-none focus:border-primary text-ink placeholder:text-ink-soft/60 transition-all pr-3 sm:pr-4 pl-10 sm:pl-12"
              />
              <button
                type="button"
                onClick={toggleChatVoice}
                disabled={loading || isVoiceProcessing}
                className={`absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-all ${
                  isVoiceListening
                    ? 'bg-red-500 text-white animate-pulse shadow-sm'
                    : isVoiceProcessing
                    ? 'bg-amber-500 text-white animate-spin'
                    : 'text-ink-soft hover:text-primary hover:bg-primary/10'
                }`}
                title={
                  isVoiceListening
                    ? 'جاري التسجيل الصوتي... اضغط للإيقاف'
                    : 'تحدث بالصوت (Gemini Audio + المتصفح)'
                }
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-[var(--color-primary-contrast,#ffffff)] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl font-black shadow-md transition-all shrink-0"
              title="إرسال"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
            </button>
          </form>

          {/* Quick Helper Tips footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 px-1 text-[11px] text-ink-soft font-medium">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>جرب: «قارن بين اللابتوبات» أو «أفضل هاتف للألعاب»</span>
              </span>
            </div>
            <span className="hidden sm:inline">
              يتم حفظ سياق المحادثة تلقائياً للاستفسارات اللاحقة
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
