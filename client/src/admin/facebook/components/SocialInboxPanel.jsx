import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  MessageSquare,
  MessageCircle,
  Phone,
  Sparkles,
  Send,
  User,
  History,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  X,
  CreditCard,
  ShieldAlert,
  ThumbsUp,
  Smile,
  Frown,
  Check,
  Key
} from 'lucide-react';
import { useStore } from '../../../shared/context/StoreContext';

export default function SocialInboxPanel({ onOpenSettings }) {
  const { token, config, showToast } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Data states
  const [interactions, setInteractions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Filters & Pagination
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'comment', 'message'
  const [intentFilter, setIntentFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [highIntentOnly, setHighIntentOnly] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'sent'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [liveAutoSync, setLiveAutoSync] = useState(true);

  // Reply Drafts state: { [interactionId]: replyText }
  const [replyDrafts, setReplyDrafts] = useState({});
  const [sendingId, setSendingId] = useState(null);

  // Customer History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Simulation Modal
  const [simulateModalOpen, setSimulateModalOpen] = useState(false);
  const [simType, setSimType] = useState('comment');
  const [simSenderName, setSimSenderName] = useState('أحمد إبراهيم');
  const [simContent, setSimContent] = useState('لو سمحت هو التليفون ده بكام؟ وفي تقسيط مباشر مع المحل؟ وده رقمي 01012345678');
  const [simPostText, setSimPostText] = useState('عرض خاص على أحدث الهواتف الذكية مع إمكانية التقسيط المباشر');
  const [simulating, setSimulating] = useState(false);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await axios.get('/api/admin/facebook/social/analytics', authHeader);
      if (res.data?.success) {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.warn('Failed to load social analytics', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [token]);

  // Fetch Interactions
  const fetchInteractions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        type: typeFilter,
        intent: intentFilter,
        sentiment: sentimentFilter,
        highIntentOnly: highIntentOnly ? 'true' : 'false',
        hasPhoneOnly: hasPhoneOnly ? 'true' : 'false',
        status: statusFilter,
        search: search.trim()
      };
      const res = await axios.get('/api/admin/facebook/social/interactions', {
        ...authHeader,
        params
      });
      if (res.data?.success) {
        setInteractions(res.data.interactions || []);
        setTotalPages(res.data.pagination?.pages || 1);
        setTotalCount(res.data.pagination?.total || 0);

        // Pre-fill reply drafts
        const drafts = {};
        (res.data.interactions || []).forEach((item) => {
          drafts[item._id] = item.reply?.sentReply || item.reply?.generatedReply || '';
        });
        setReplyDrafts((prev) => ({ ...drafts, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load social interactions', err);
      showToast('فشل في جلب التعليقات والرسائل', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, page, typeFilter, intentFilter, sentimentFilter, highIntentOnly, hasPhoneOnly, statusFilter, search]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  // Live Auto-Refresh polling every 15 seconds
  useEffect(() => {
    if (!liveAutoSync) return;
    const interval = setInterval(() => {
      fetchInteractions();
      fetchAnalytics();
    }, 15000);
    return () => clearInterval(interval);
  }, [liveAutoSync, fetchInteractions, fetchAnalytics]);

  // Send Reply Action
  const handleSendReply = async (interaction, channel = 'comment_reply') => {
    const textToSend = replyDrafts[interaction._id] || interaction.reply?.generatedReply || '';
    if (!textToSend.trim()) {
      showToast('يرجى كتابة نص الرد أولاً', 'error');
      return;
    }

    setSendingId(interaction._id);
    try {
      const res = await axios.post(
        `/api/admin/facebook/social/interactions/${interaction._id}/reply`,
        { replyText: textToSend, channel },
        authHeader
      );
      if (res.data?.success) {
        showToast(
          res.data.isLiveSent
            ? 'تم إرسال الرد بنجاح عبر فيسبوك ماستر جراف!'
            : 'تم حفظ وتأكيد الرد بنجاح في سجل المحادثة',
          'success'
        );
        fetchInteractions();
        fetchAnalytics();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'فشل إرسال الرد', 'error');
    } finally {
      setSendingId(null);
    }
  };

  // Open Customer History
  const handleOpenCustomerHistory = async (senderId, phone) => {
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await axios.get(
        `/api/admin/facebook/social/customers/${encodeURIComponent(senderId)}/history`,
        { ...authHeader, params: { phone } }
      );
      if (res.data?.success) {
        setSelectedCustomerHistory(res.data.history);
      }
    } catch (err) {
      showToast('فشل في جلب سجل العميل', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Simulate Interaction
  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!simContent.trim()) {
      showToast('يرجى إدخال نص التعليق أو الرسالة', 'error');
      return;
    }
    setSimulating(true);
    try {
      const res = await axios.post(
        '/api/admin/facebook/social/simulate',
        {
          interactionType: simType,
          content: simContent,
          facebookPostText: simPostText,
          sender: {
            name: simSenderName,
            id: `sim_sender_${Date.now()}`
          }
        },
        authHeader
      );
      if (res.data?.success) {
        showToast('تمت المحاكاة وتحليل الذكاء الاصطناعي بنجاح!', 'success');
        setSimulateModalOpen(false);
        fetchInteractions();
        fetchAnalytics();
      }
    } catch (err) {
      showToast('فشل تنفيذ المحاكاة', 'error');
    } finally {
      setSimulating(false);
    }
  };

  // Intent Badge Config
  const getIntentBadge = (intent) => {
    switch (intent) {
      case 'installment_inquiry':
        return { label: 'استفسار تقسيط مباشر', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: CreditCard };
      case 'purchase_lead':
        return { label: 'عميل جاهز للشراء', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: ShoppingBag };
      case 'product_inquiry':
        return { label: 'استفسار عن سعر/منتج', bg: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: MessageCircle };
      case 'complaint':
        return { label: 'شكوى / مشكلة', bg: 'bg-rose-500/10 text-rose-600 border-rose-500/30', icon: ShieldAlert };
      case 'greeting_or_chat':
        return { label: 'تحية وترحيب', bg: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: Smile };
      default:
        return { label: 'استفسار عام', bg: 'bg-slate-500/10 text-slate-600 border-slate-500/30', icon: MessageSquare };
    }
  };

  // Sentiment Badge Config
  const getSentimentBadge = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return { label: 'إيجابي مهتم', text: 'text-emerald-600', icon: ThumbsUp };
      case 'negative':
        return { label: 'غير راضٍ', text: 'text-rose-600', icon: Frown };
      default:
        return { label: 'محايد', text: 'text-ink-soft', icon: Smile };
    }
  };

  return (
    <div className="space-y-6 text-ink">
      {/* Facebook Not Connected Warning & Quick Config Button */}
      {!config?.isFacebookAvailable && (
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5 text-orange-700 dark:text-orange-300 font-bold">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
            <span>
              صفحة الفيسبوك غير مهيأة بعد بالـ Page ID والتوكن. يمكنك تجربة المحاكاة حالياً، أو إدخال مفاتيح الربط لتشغيل الردود الحية وربط الـ Webhook.
            </span>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-orange-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              <span>إدخال مفاتيح الربط الآن (Page ID & Token)</span>
            </button>
          )}
        </div>
      )}

      {/* 1. Header & Quick Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-soft font-bold">
            <span>إجمالي التفاعلات</span>
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-ink">{analytics?.totalInteractions ?? 0}</div>
          <div className="text-[11px] text-ink-soft">
            {analytics?.totalComments ?? 0} تعليق · {analytics?.totalMessages ?? 0} رسالة
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-600 font-bold">
            <span>عملاء جادون بالشراء</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{analytics?.highIntentLeads ?? 0}</div>
          <div className="text-[11px] text-ink-soft">مؤشر شراء مؤكد بالـ AI</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
            <span>أرقام هواتف مسحوبة</span>
            <Phone className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{analytics?.withPhoneCount ?? 0}</div>
          <div className="text-[11px] text-ink-soft">للتواصل والمبيعات المباشرة</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-blue-600 font-bold">
            <span>استفسارات التقسيط</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600">
            {analytics?.intentBreakdown?.installment_inquiry ?? 0}
          </div>
          <div className="text-[11px] text-ink-soft">حساب أقساط ومقدم فوري</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-indigo-600 font-bold">
            <span>ردود تم إرسالها</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600">{analytics?.sentRepliesCount ?? 0}</div>
          <div className="text-[11px] text-ink-soft">
            معدل الاستجابة {analytics?.autoReplyRate ?? 0}%
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex flex-col justify-between">
          <button
            type="button"
            onClick={() => setSimulateModalOpen(true)}
            className="w-full h-full py-2 px-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <PlusCircle className="w-5 h-5" />
            <span>محاكاة تفاعل جديد بالـ AI</span>
          </button>
        </div>
      </div>

      {/* 2. Top-Inquired Products Highlights */}
      {analytics?.topProducts && analytics.topProducts.length > 0 && (
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex items-center gap-3 overflow-x-auto text-xs">
          <span className="font-black text-ink flex items-center gap-1.5 whitespace-nowrap">
            <TrendingUp className="w-4 h-4 text-primary" />
            أكثر المنتجات طلباً على فيسبوك:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {analytics.topProducts.map((p, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-paper border border-line font-bold flex items-center gap-2 text-ink whitespace-nowrap"
              >
                <span>{p._id}</span>
                <span className="text-primary font-black">{p.price} ج.م</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {p.count} طلب
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Channel Type Filter */}
          <div className="flex items-center gap-1 bg-paper p-1 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              الكل ({analytics?.totalInteractions ?? 0})
            </button>
            <button
              type="button"
              onClick={() => { setTypeFilter('comment'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                typeFilter === 'comment' ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>التعليقات ({analytics?.totalComments ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => { setTypeFilter('message'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                typeFilter === 'message' ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>الرسائل ({analytics?.totalMessages ?? 0})</span>
            </button>
          </div>

          {/* Quick Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setHighIntentOnly(!highIntentOnly); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                highIntentOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-paper text-ink-soft border-line hover:border-amber-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>العملاء الجادين فقط</span>
            </button>

            <button
              type="button"
              onClick={() => { setHasPhoneOnly(!hasPhoneOnly); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                hasPhoneOnly
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-paper text-ink-soft border-line hover:border-emerald-400'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>مع أرقام هواتف فقط</span>
            </button>

            <button
              type="button"
              onClick={() => setLiveAutoSync(!liveAutoSync)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all ${
                liveAutoSync
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-paper text-ink-soft border-line'
              }`}
              title="تفعيل/تعطيل التحديث اللحظي التلقائي كل 15 ثانية"
            >
              <span className={`w-2 h-2 rounded-full ${liveAutoSync ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{liveAutoSync ? 'مباشر (Live)' : 'تحديث يدوي'}</span>
            </button>

            <button
              type="button"
              onClick={() => { fetchInteractions(); fetchAnalytics(); }}
              className="p-2 rounded-xl bg-paper hover:bg-surface border border-line text-ink-soft hover:text-ink transition-all"
              title="تحديث البيانات فوراً"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub-Filters: Search & Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-line">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث في النص، اسم العميل، الهاتف، المنتج..."
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-paper border border-line text-xs font-medium text-ink focus:border-primary outline-none"
            />
          </div>

          <select
            value={intentFilter}
            onChange={(e) => { setIntentFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-medium text-ink focus:border-primary outline-none"
          >
            <option value="all">كل تصنيفات النوايا</option>
            <option value="installment_inquiry">استفسارات التقسيط</option>
            <option value="purchase_lead">عملاء جاهزون للشراء</option>
            <option value="product_inquiry">استفسارات المنتجات والأسعار</option>
            <option value="complaint">الشكاوى والملاحظات</option>
            <option value="general_inquiry">استفسارات الفروع والمواعيد</option>
            <option value="greeting_or_chat">ترحيب وتحية</option>
          </select>

          <select
            value={sentimentFilter}
            onChange={(e) => { setSentimentFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-medium text-ink focus:border-primary outline-none"
          >
            <option value="all">كل الحالات الشعورية</option>
            <option value="positive">إيجابي مهتم</option>
            <option value="neutral">محايد</option>
            <option value="negative">غير راضٍ أو شكوى</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-medium text-ink focus:border-primary outline-none"
          >
            <option value="all">كل حالات الرد</option>
            <option value="pending">في الانتظار (لم يتم الرد)</option>
            <option value="sent">تم الرد وإغلاق المحادثة</option>
          </select>
        </div>
      </div>

      {/* 4. Interactions Feed List */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-surface border border-line space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs font-bold text-ink-soft">جاري جلب تفاعلات فيسبوك والردود الذكية...</p>
        </div>
      ) : interactions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface border border-line space-y-3">
          <MessageSquare className="w-10 h-10 text-ink-soft mx-auto opacity-40" />
          <h4 className="text-sm font-black text-ink">لا توجد تعليقات أو رسائل تطابق معايير البحث</h4>
          <p className="text-xs text-ink-soft max-w-md mx-auto">
            يمكنك محاكاة تعليق أو رسالة جديدة بالذكاء الاصطناعي لتجربة الردود المباشرة وحساب التقسيط.
          </p>
          <button
            type="button"
            onClick={() => setSimulateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>محاكاة تفاعل جديد</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {interactions.map((item) => {
            const intentInfo = getIntentBadge(item.classification?.intent);
            const sentimentInfo = getSentimentBadge(item.classification?.sentiment);
            const IntentIcon = intentInfo.icon;
            const isSent = item.reply?.status === 'sent';

            return (
              <div
                key={item._id}
                className="p-5 rounded-2xl bg-surface border border-line shadow-sm space-y-4 hover:border-primary/40 transition-all"
              >
                {/* Interaction Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-paper border border-line flex items-center justify-center font-black text-primary text-sm shadow-inner">
                      {item.sender?.name?.charAt(0) || <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-ink">{item.sender?.name || 'متابع'}</span>
                        {item.sender?.hasStoreAccount && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black">
                            عميل مسجل بالمتجر
                          </span>
                        )}
                        {item.sender?.previousInteractionsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold">
                            تفاعل سابق ({item.sender.previousInteractionsCount})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-ink-soft">
                        <span>{item.interactionType === 'message' ? 'رسالة ماسنجر' : 'تعليق على بوست'}</span>
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${intentInfo.bg}`}
                    >
                      <IntentIcon className="w-3.5 h-3.5" />
                      <span>{intentInfo.label}</span>
                    </span>

                    {item.classification?.isHighIntentLead && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 text-xs font-black flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>ليد شراء قوي</span>
                      </span>
                    )}

                    <span
                      className={`text-xs font-bold flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper border border-line ${sentimentInfo.text}`}
                    >
                      <sentimentInfo.icon className="w-3.5 h-3.5" />
                      <span>{sentimentInfo.label}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenCustomerHistory(item.sender?.id, item.sender?.extractedPhone)}
                      className="px-2.5 py-1 rounded-full bg-paper hover:bg-surface border border-line text-ink-soft hover:text-ink text-xs font-bold flex items-center gap-1 transition-all"
                      title="استعراض سجل العميل وطلباته السابقة"
                    >
                      <History className="w-3.5 h-3.5 text-primary" />
                      <span>سجل العميل</span>
                    </button>
                  </div>
                </div>

                {/* Extracted Phone Lead Notification Pill */}
                {item.sender?.extractedPhone && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <Phone className="w-4 h-4 text-emerald-600 animate-pulse" />
                      <span>رقم الهاتف المكتشف:</span>
                      <span className="font-mono font-black text-sm text-emerald-900" dir="ltr">
                        {item.sender.extractedPhone}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/2${item.sender.extractedPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1"
                      >
                        <span>محادثة واتساب</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Original Comment / Message Text Bubble */}
                <div className="p-3.5 rounded-xl bg-paper border border-line text-sm text-ink leading-relaxed">
                  <div className="text-[11px] font-bold text-ink-soft mb-1">نص التفاعل الأصلي:</div>
                  <p className="font-medium whitespace-pre-wrap">{item.content}</p>
                </div>

                {/* Grounded Matched Product Snapshot (with Live Installment Breakdown) */}
                {item.matchedProduct && (
                  <div className="p-3 rounded-xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-black text-ink">{item.matchedProduct.name}</div>
                        <div className="text-ink-soft flex items-center gap-2">
                          <span className="font-bold text-primary">{item.matchedProduct.price} ج.م</span>
                          <span>•</span>
                          <span>المخزون المتوفر: {item.matchedProduct.stockCount} قطعة</span>
                        </div>
                      </div>
                    </div>

                    {item.matchedProduct.installmentSample && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-paper border border-line font-bold text-ink">
                        <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                        <span>تقسيط المحل:</span>
                        <span className="text-emerald-600">
                          {item.matchedProduct.installmentSample.monthlyAmount} ج.م/شهر
                        </span>
                        <span className="text-ink-soft text-[10px]">
                          (مقدم {item.matchedProduct.installmentSample.downPayment} ج.م على {item.matchedProduct.installmentSample.months} شهور)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Grounded RAG Knowledge Context (if used) */}
                {item.ragKnowledge?.usedKnowledge && (
                  <div className="text-[11px] text-ink-soft flex items-center gap-1.5 px-3 py-1 rounded-lg bg-paper/60 border border-line">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>تم تدعيم الرد بمعلومات موثوقة من قاعدة بيانات المتجر:</span>
                    <span className="font-bold text-ink">{item.ragKnowledge.topic}</span>
                  </div>
                )}

                {/* Smart Reply Dispatch Box */}
                <div className="space-y-2 pt-2 border-t border-line">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Sparkles className="w-4 h-4" />
                      <span>مسودة الرد الذكي الموثق (Grounded AI Reply):</span>
                    </div>
                    <div>
                      {isSent ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>تم الإرسال بواسطة {item.reply?.sentByName || 'المشرف'}</span>
                        </span>
                      ) : (
                        <span className="text-ink-soft text-[11px]">في انتظار المراجعة والإرسال</span>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={replyDrafts[item._id] ?? ''}
                    onChange={(e) =>
                      setReplyDrafts({
                        ...replyDrafts,
                        [item._id]: e.target.value
                      })
                    }
                    placeholder="اكتب أو عدّل نص الرد هنا..."
                    className="w-full p-3 rounded-xl bg-paper border border-line text-xs font-medium text-ink focus:border-primary outline-none resize-y leading-relaxed"
                  />

                  {/* Dispatch Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] text-ink-soft">
                      {item.interactionType === 'comment'
                        ? 'يمكنك الرد كتعليق عام على البوست أو رسالة خاصة على ماسنجر'
                        : 'سيتم الإرسال مباشرة إلى صندوق رسائل العميل'}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.interactionType === 'comment' && (
                        <button
                          type="button"
                          disabled={sendingId === item._id}
                          onClick={() => handleSendReply(item, 'private_messenger')}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>إرسال رسالة خاصة على ماسنجر</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={sendingId === item._id}
                        onClick={() => handleSendReply(item, item.interactionType === 'comment' ? 'comment_reply' : 'private_messenger')}
                        className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{item.interactionType === 'comment' ? 'إرسال الرد على التعليق' : 'إرسال الرد على الماسنجر'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-4 rounded-2xl bg-surface border border-line flex items-center justify-between text-xs font-bold">
              <span>صفحة {page} من {totalPages} (إجمالي {totalCount} تفاعل)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-line bg-paper text-ink disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Customer History Modal / Timeline */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-line rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="font-black text-sm text-ink">سجل تفاعلات وطلبات العميل الموحد</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-paper text-ink-soft hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-primary animate-spin mx-auto" />
                <p className="text-xs text-ink-soft">جاري استرجاع تاريخ العميل...</p>
              </div>
            ) : selectedCustomerHistory ? (
              <div className="space-y-4">
                {/* Summary Box */}
                <div className="p-4 rounded-2xl bg-paper border border-line grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-ink-soft font-bold">معرف العميل</div>
                    <div className="font-mono font-bold text-ink truncate">{selectedCustomerHistory.senderId}</div>
                  </div>
                  <div>
                    <div className="text-ink-soft font-bold">رقم الهاتف</div>
                    <div className="font-mono font-black text-emerald-600">
                      {selectedCustomerHistory.extractedPhone || 'غير متوفر'}
                    </div>
                  </div>
                  <div>
                    <div className="text-ink-soft font-bold">الطلبات المسجلة</div>
                    <div className="font-black text-primary text-sm">{selectedCustomerHistory.ordersCount} طلب</div>
                  </div>
                </div>

                {/* Store Orders Section */}
                {selectedCustomerHistory.orders && selectedCustomerHistory.orders.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-black text-ink flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      <span>طلبات الشراء السابقة بالمتجر:</span>
                    </h5>
                    <div className="space-y-2">
                      {selectedCustomerHistory.orders.map((ord) => (
                        <div
                          key={ord._id}
                          className="p-3 rounded-xl bg-surface border border-line flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold">طلب #{ord._id.toString().slice(-6)}</span>
                            <div className="text-[11px] text-ink-soft">
                              {new Date(ord.createdAt).toLocaleDateString('ar-EG')}
                            </div>
                          </div>
                          <div className="text-left font-bold">
                            <div className="text-emerald-600">{ord.totalPrice || ord.total || 0} ج.م</div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper border border-line">
                              {ord.status || 'معلق'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactions Timeline */}
                <div className="space-y-2">
                  <h5 className="text-xs font-black text-ink flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>التعليقات والرسائل السابقة ({selectedCustomerHistory.interactionsCount}):</span>
                  </h5>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {(selectedCustomerHistory.interactions || []).map((it) => (
                      <div key={it._id} className="p-3 rounded-xl bg-paper border border-line space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-ink-soft">
                          <span>{it.interactionType === 'message' ? 'رسالة ماسنجر' : 'تعليق بوست'}</span>
                          <span>{new Date(it.createdAt).toLocaleString('ar-EG')}</span>
                        </div>
                        <p className="font-medium text-ink">{it.content}</p>
                        {it.reply?.sentReply && (
                          <div className="p-2 rounded-lg bg-surface border border-line text-[11px] text-emerald-800">
                            <span className="font-bold">الرد المرسل: </span>
                            <span>{it.reply.sentReply}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-soft text-center py-4">لا توجد بيانات لهذا العميل</p>
            )}
          </div>
        </div>
      )}

      {/* 6. Simulate Interaction Modal */}
      {simulateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleSimulate}
            className="w-full max-w-lg bg-surface border border-line rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-black text-sm text-ink">محاكاة تعليق أو رسالة فيسبوك بالذكاء الاصطناعي</h3>
              </div>
              <button
                type="button"
                onClick={() => setSimulateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-paper text-ink-soft hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">نوع التفاعل</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimType('comment')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                      simType === 'comment'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-paper text-ink border-line'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>تعليق على بوست</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimType('message')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                      simType === 'message'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-paper text-ink border-line'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>رسالة ماسنجر خاصة</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">اسم العميل (متابع الصفحة)</label>
                <input
                  type="text"
                  value={simSenderName}
                  onChange={(e) => setSimSenderName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-medium focus:border-primary outline-none"
                  placeholder="مثال: محمد السيد"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">نص التعليق أو الرسالة المراد اختبارها</label>
                <textarea
                  rows={3}
                  value={simContent}
                  onChange={(e) => setSimContent(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-medium focus:border-primary outline-none"
                  placeholder="اكتب استفسار، سؤال عن تقسيط، شكوى، أو رقم هاتف..."
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">سياق المنشور (اختياري)</label>
                <input
                  type="text"
                  value={simPostText}
                  onChange={(e) => setSimPostText(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink font-medium focus:border-primary outline-none"
                  placeholder="سياق الإعلان أو المنتج المنشور عنه..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setSimulateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-paper border border-line text-ink text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={simulating}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{simulating ? 'جاري التحليل وتوليد الرد...' : 'تنفيذ المحاكاة'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
