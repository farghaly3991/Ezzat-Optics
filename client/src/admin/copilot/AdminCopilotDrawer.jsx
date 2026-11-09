import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  RefreshCw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Glasses,
  Search,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  ArrowRight,
  Mic
} from 'lucide-react';
import axios from 'axios';
import { useGeminiVoiceInput } from '../../shared/utils/useGeminiVoiceInput';

/**
 * Lightweight Markdown & Formatted Text Component for Copilot Messages
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  // Split lines
  const lines = text.split('\n');
  const elements = [];
  let inTable = false;
  let tableHeader = [];
  let tableRows = [];

  const flushTable = (key) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 text-xs">
          <table className="w-full text-right border-collapse">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  {tableHeader.map((th, i) => (
                    <th key={i} className="p-2 border-l border-slate-200 last:border-0">{th}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2 border-l border-slate-100 last:border-0 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  };

  const formatInline = (str) => {
    // Match markdown links [label](url) including balanced parentheses inside URLs, bold **text**, inline code `code`, or bare URLs
    const tokenRegex = /(\[[^\]]+\]\(https?:\/\/(?:[^\s()]|\([^\s()]*\))+\)|\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g;
    const parts = str.split(tokenRegex);
    return parts.map((part, idx) => {
      if (!part) return null;
      const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[\s\S]+)\)$/);
      if (mdLinkMatch) {
        const [, label, url] = mdLinkMatch;
        const isWa = url.includes('wa.me') || url.includes('whatsapp');
        return (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-2.5 py-1 mx-0.5 my-0.5 rounded-lg font-bold text-[11px] shadow-xs transition-all ${
              isWa
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <span>{label}</span>
            <span>↗</span>
          </a>
        );
      }
      if (/^https?:\/\/[^\s]+$/.test(part)) {
        const cleanUrl = part.replace(/[),.;]+$/, '');
        const isWa = cleanUrl.includes('wa.me') || cleanUrl.includes('whatsapp');
        const isTracking = cleanUrl.includes('/supplier/supply-request/');
        const displayLabel = isWa
          ? '📱 فتح رسالة واتساب الجاهزة للمورد'
          : isTracking
          ? '🔗 فتح رابط تأكيد ومتابعة التوريد'
          : cleanUrl.length > 55
          ? `${cleanUrl.slice(0, 48)}...`
          : cleanUrl;
        return (
          <a
            key={idx}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-2.5 py-1 mx-0.5 my-0.5 rounded-lg font-bold text-[11px] shadow-xs transition-all ${
              isWa
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <span>{displayLabel}</span>
            <span>↗</span>
          </a>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-indigo-700 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Table line: | col1 | col2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // separator row like |---|---|
      if (trimmed.includes('---')) {
        return;
      }
      const cols = trimmed.slice(1, -1).split('|').map((c) => formatInline(c.trim()));
      if (!inTable) {
        inTable = true;
        tableHeader = cols;
      } else {
        tableRows.push(cols);
      }
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    // Horizontal divider
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={idx} className="my-3 border-slate-200" />);
      return;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={idx} className="text-xs font-black text-slate-900 mt-2.5 mb-1">{formatInline(trimmed.slice(4))}</h4>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={idx} className="text-sm font-black text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">{formatInline(trimmed.slice(3))}</h3>);
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={idx} className="text-base font-black text-indigo-900 mt-3 mb-2">{formatInline(trimmed.slice(2))}</h2>);
      return;
    }

    // Bullet points
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 my-1 text-xs text-slate-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
          <div>{formatInline(trimmed.slice(2))}</div>
        </div>
      );
      return;
    }

    // Numbered list: 1. or 1️⃣
    if (/^(\d+\.|\d+️⃣)\s+/.test(trimmed)) {
      elements.push(
        <div key={idx} className="flex items-start gap-1.5 my-1 text-xs text-slate-800 font-semibold leading-relaxed">
          <div>{formatInline(trimmed)}</div>
        </div>
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={idx} className="text-xs text-slate-700 leading-relaxed my-0.5">
        {formatInline(trimmed)}
      </p>
    );
  });

  if (inTable) {
    flushTable('end');
  }

  return <div className="space-y-0.5 font-sans" dir="rtl">{elements}</div>;
}

/**
 * Tool Execution Traces Badge Accordion
 */
function ToolTraceAccordion({ traces }) {
  const [open, setOpen] = useState(false);
  if (!traces || traces.length === 0) return null;

  const toolLabels = {
    lookupEntity: 'استعلام وبحث عن كيان (Lookup)',
    getEntityRelations: 'استرجاع شبكة العلاقات والطلبات',
    getAggregatedMetrics: 'احتساب مؤشرات الأداء ومعدلات الجودة',
    getTreasurySummary: 'استعراض السيولة وحركة الخزينة',
    searchCatalogAndInventory: 'فحص الكتالوج والمخزون',
    getLowStockAndSuppliers: 'فحص نواقص المخزون والموردين المعتمدين',
    createSupplyOrderAndWhatsApp: 'إنشاء طلب توريد ورابط متابعة ورسالة واتساب للمورد',
    listPartnersLedger: 'استعراض سجل وحصص ومسحوبات الشركاء',
    recordPartnerWithdrawal: 'تسجيل مسحوبات شريك بالخزينة',
    recordExpense: 'تسجيل قيد مصروف تشغيلي معتمد',
    createPosSale: 'تنفيذ فاتورة بيع مباشرة (POS)',
    createWorkOrder: 'إصدار أمر شغل لمعمل البصريات',
    recordCustomerPrescription: 'توثيق كشف نظر طبي للعميل'
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[11px] font-bold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 p-2 rounded-xl border border-slate-200 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>خطوات الاستدلال والتنفيذ ({traces.length} أدوات منفذة)</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 pl-2 pr-1 animate-in fade-in">
          {traces.map((tr, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 text-[11px]"
            >
              <div className="mt-0.5">
                {tr.status === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-slate-800">
                    {toolLabels[tr.tool] || tr.tool}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Step {tr.step}</span>
                </div>
                {tr.args && Object.keys(tr.args).length > 0 && (
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
                    {JSON.stringify(tr.args)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modern AI Admin Executive Copilot Drawer
 */
export default function AdminCopilotDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `أهلاً بك يا مدير! أنا **المساعد التنفيذي الذكي (AI Executive Copilot)** لإدارة المركز. 👓\n\nأمتلك اتصالاً مباشراً بقواعد البيانات ومحرك العمليات. يمكنك أن تطلب مني أي تقرير مالي، فحص عميل أو كشوفات نظره، حساب معدلات الإرجاع والتالف، أو حتى تسجيل مصروف وإصدار أوامر شغل للمعامل.`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [engineStatus, setEngineStatus] = useState(null);
  const scrollRef = useRef(null);

  const {
    isListening: isVoiceListening,
    isProcessing: isVoiceProcessing,
    toggleVoice: toggleCopilotVoice
  } = useGeminiVoiceInput({
    contextHint: 'general',
    onTranscript: (transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  });

  // Suggested Prompts
  const QUICK_PROMPTS = [
    { label: '👥 حصص ومسحوبات الشركاء', query: 'اعرض لي سجل الشركاء وأصحاب المحل وحصصهم والمسحوبات' },
    { label: '📊 ملخص الخزينة والأرباح (7 أيام)', query: 'عايز ملخص الخزينة والأرباح والمبيعات لآخر 7 أيام' },
    { label: '⚠️ معدل الإرجاع ونسبة التالف', query: 'عايز أعرف معدل الإرجاع ونسبة الهالك والتالف وسداد الأقساط' },
    { label: '🔍 فحص عميل وكشف نظره', query: 'ابحث عن العميل برقم 01000000000 واعرض آخر طلب وكشف نظر' },
    { label: '💸 تسجيل مصروف تشغيلي', query: 'سجل مصروف تشغيلي بقيمة 150 جنيه بعنوان شراء أدوات صيانة' },
    { label: '📦 فحص المخزون والنواقص', query: 'اعرض لي الأصناف التي يقل رصيدها عن 5 قطع في المخزن' }
  ];

  // Fetch engine status once opened
  useEffect(() => {
    if (isOpen) {
      axios.get('/api/admin/copilot/status')
        .then((res) => setEngineStatus(res.data))
        .catch(() => {});
    }
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (textToSend = null, confirmedAction = null) => {
    const userText = confirmedAction
      ? `نعم، أؤكد واعتماد تنفيذ عملية: ${confirmedAction.title || confirmedAction.action}`
      : (textToSend || input).trim();

    if ((!userText && !confirmedAction) || loading) return;

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/admin/copilot/chat', {
        message: userText,
        history: newMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        confirmedAction: confirmedAction || undefined
      });

      if (res.data?.reply) {
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: res.data.reply,
            traces: res.data.traces || [],
            requiresConfirmation: res.data.requiresConfirmation,
            pendingAction: res.data.pendingAction,
            clarification: res.data.clarification
          }
        ]);
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `⚠️ **عذراً، حدث خطأ أثناء تنفيذ الأمر:**\n${err.response?.data?.error || err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        role: 'assistant',
        content: `تم مسح سجل المحادثة. أنا جاهز لأي استفسار أو عملية تشغيلية جديدة!`
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Container */}
      <div
        className={`relative z-10 bg-white h-full shadow-2xl flex flex-col transition-all duration-300 ease-in-out border-r border-slate-200 ${
          isExpanded ? 'w-full md:w-[850px]' : 'w-full md:w-[480px]'
        }`}
        dir="rtl"
      >
        {/* 1. Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white">المساعد التنفيذي الذكي</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 border border-white/10 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {engineStatus?.activeProvider === 'deepseek' ? 'DeepSeek V3' : engineStatus?.activeProvider === 'gemini' ? 'Gemini 1.5' : 'ReAct Core'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                COO Agentic Copilot — فحص العمليات، النقدية، وأوامر المعمل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title={isExpanded ? 'تصغير اللوحة' : 'تكبير اللوحة'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="مسح المحادثة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Chat Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-xs ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'
                }`}
              >
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-xs ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tl-xs'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tr-xs'
                }`}
              >
                {m.role === 'user' ? (
                  <div className="leading-relaxed whitespace-pre-wrap">{m.content}</div>
                ) : (
                  <>
                    <FormattedMessage text={m.content} />

                    {/* Human-in-the-Loop Confirmation Card */}
                    {m.requiresConfirmation && m.pendingAction && (
                      <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 space-y-2.5 text-slate-800 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                          <span>{m.pendingAction.title || 'اعتماد وتنفيذ العملية الإدارية'}</span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed font-medium bg-white/70 p-2.5 rounded-xl border border-amber-200/60">
                          {m.pendingAction.details}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSendMessage(null, m.pendingAction)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تأكيد واعتماد التنفيذ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMessages((prev) => [
                                ...prev,
                                { role: 'user', content: 'إلغاء العملية' },
                                { role: 'assistant', content: 'تم إلغاء تنفيذ العملية بناءً على طلبك، ولم يتم إجراء أي تغيير في البيانات أو الخزينة.' }
                              ]);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 text-xs font-bold transition-all cursor-pointer"
                          >
                            إلغاء العملية
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Interactive Clarification / Quick Answer Options */}
                    {m.clarification?.options && m.clarification.options.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 block">خيارات الرد السريع:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {m.clarification.options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleSendMessage(opt)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.traces && m.traces.length > 0 && (
                      <ToolTraceAccordion traces={m.traces} />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5 animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 shadow-xs flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="font-bold text-slate-700">جاري الاستدلال واستدعاء الأدوات التنفيذية...</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Quick Action Chips */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage(qp.query)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-bold border border-slate-200 whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              <span>{qp.label}</span>
            </button>
          ))}
        </div>

        {/* 4. Input Controls */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اطلب فحص مالي، استعلام عن عميل، تحليل مرتجع..."
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl pr-3.5 pl-9 py-2.5 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={toggleCopilotVoice}
                disabled={loading || isVoiceProcessing}
                className={`absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                  isVoiceListening
                    ? 'bg-red-500 text-white animate-pulse shadow-sm'
                    : isVoiceProcessing
                    ? 'bg-amber-500 text-white animate-spin'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title={
                  isVoiceListening
                    ? 'جاري التسجيل الصوتي... اضغط للإيقاف'
                    : 'تحدث بالصوت (Gemini Audio + المتصفح)'
                }
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
            <span>يدعم ReAct Tool Calling والعمليات التراكمية</span>
            <span className="font-mono">Audit & Telemetry Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
