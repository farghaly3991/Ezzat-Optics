import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Clock,
  Filter,
  Send,
  MessageCircle,
  Bell,
  Zap,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Phone,
  Eye,
  Trash2,
  ArrowUpDown,
  Tag,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AdminBranchSelector from '../shared/AdminBranchSelector';

export default function AbandonedCartsPage() {
  const { token, config, showToast, activeBranchId } = useStore();
  const currency = config?.currency || 'ج.م';
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // Filters & Sorting state
  const [periodHours, setPeriodHours] = useState(24);
  const [sortBy, setSortBy] = useState('items_desc'); // 'items_desc' (default) | 'subtotal_desc' | 'last_active_desc' | 'last_active_asc'
  const [limit, setLimit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [isLoading, setIsLoading] = useState(false);
  const [cartsData, setCartsData] = useState({
    carts: [],
    summary: {
      totalAbandonedCarts: 0,
      totalAbandonedItems: 0,
      totalAbandonedValue: 0,
      totalNotifiedCarts: 0,
      currency: 'ج.م',
      siteName: '',
      isWhatsAppCloudConfigured: false
    }
  });

  // Selected carts for bulk recovery
  const [selectedCartIds, setSelectedCartIds] = useState([]);

  // Modal states
  const [activeCartModal, setActiveCartModal] = useState(null);
  const [sendModalCart, setSendModalCart] = useState(null); // single or null
  const [isBulkSendModalOpen, setIsBulkSendModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('both'); // 'in_app' | 'whatsapp' | 'both'
  const [customNotificationMessage, setCustomNotificationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load inactive carts
  const loadCarts = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const branchQuery = activeBranchId ? `&branchId=${activeBranchId}` : '';
      const res = await axios.get(
        `/api/admin/carts/inactive?periodHours=${periodHours}&sortBy=${sortBy}&limit=${limit}&search=${encodeURIComponent(
          searchQuery
        )}${branchQuery}`,
        authHeader
      );
      setCartsData(res.data || { carts: [], summary: {} });
      setSelectedCartIds([]);
    } catch (err) {
      console.error('Failed to load inactive carts:', err);
      showToast?.(err.response?.data?.error || 'تعذر تحميل بيانات السلات المتروكة', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCarts();
  }, [token, periodHours, sortBy, limit, activeBranchId]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCarts();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedCartIds.length === (cartsData.carts || []).length) {
      setSelectedCartIds([]);
    } else {
      setSelectedCartIds((cartsData.carts || []).map((c) => c.cartId));
    }
  };

  const handleToggleSelectCart = (cartId) => {
    setSelectedCartIds((prev) =>
      prev.includes(cartId) ? prev.filter((id) => id !== cartId) : [...prev, cartId]
    );
  };

  // Dispatch recovery notification for single cart
  const handleConfirmSingleSend = async () => {
    if (!sendModalCart) return;
    setIsSending(true);
    try {
      const res = await axios.post(
        '/api/admin/carts/recovery/send',
        {
          cartId: sendModalCart.cartId,
          channels: selectedChannel,
          customMessage: customNotificationMessage.trim() || undefined
        },
        authHeader
      );

      const r = res.data?.result;
      const sentChannels = [];
      if (r?.inApp?.success) sentChannels.push('إشعار داخلي');
      if (r?.whatsapp?.success) sentChannels.push('واتساب');

      if (sentChannels.length > 0) {
        showToast?.(`تم إرسال تنبيه السلة بنجاح عبر (${sentChannels.join(' و ')}) ✓`);
      } else if (r?.whatsapp?.directLink) {
        // Open wa.me link directly if Cloud API not configured
        window.open(r.whatsapp.directLink, '_blank');
        showToast?.('تم فتح محادثة الواتساب المجهزة مع العميل بنجاح');
      } else {
        showToast?.(r?.whatsapp?.error || r?.inApp?.error || 'تمت محاولة الإرسال', 'info');
      }

      setSendModalCart(null);
      setCustomNotificationMessage('');
      loadCarts();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر إرسال تنبيه السلة', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Dispatch bulk recovery notifications
  const handleConfirmBulkSend = async () => {
    if (selectedCartIds.length === 0) return;
    setIsSending(true);
    try {
      const res = await axios.post(
        '/api/admin/carts/recovery/bulk-send',
        {
          cartIds: selectedCartIds,
          channels: selectedChannel,
          customMessage: customNotificationMessage.trim() || undefined
        },
        authHeader
      );

      const data = res.data?.result;
      showToast?.(
        `اكتمل الإرسال الجماعي: نجح (${data?.inAppSuccessCount || 0} إشعار داخلي، و ${
          data?.waSuccessCount || 0
        } رسالة واتساب) من أصل ${data?.total || selectedCartIds.length} سلة`
      );

      setIsBulkSendModalOpen(false);
      setSelectedCartIds([]);
      setCustomNotificationMessage('');
      loadCarts();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر تنفيذ الإرسال الجماعي', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const periodOptions = [
    { hours: 2, label: 'أكثر من ساعتين (> 2h)' },
    { hours: 6, label: 'أكثر من 6 ساعات (> 6h)' },
    { hours: 24, label: 'أكثر من 24 ساعة (يوم - افتراضي)' },
    { hours: 48, label: 'أكثر من 48 ساعة (يومين)' },
    { hours: 168, label: 'أكثر من أسبوع (> 7d)' },
    { hours: 0, label: 'كل السلات النشطة (الكل)' }
  ];

  const sortOptions = [
    { value: 'items_desc', label: 'أكثر كارت بها منتجات (عناصر) ⬇' },
    { value: 'subtotal_desc', label: 'أعلى قيمة مالية للسلة ⬇' },
    { value: 'last_active_desc', label: 'الأحدث خمولاً وتفاعلاً ⬇' },
    { value: 'last_active_asc', label: 'الأقدم خمولاً وتفاعلاً ⬆' }
  ];

  const limitOptions = [10, 20, 50, 100];

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/25">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-ink">
                  إدارة سلات التسوق المتروكة واستعادة المبيعات (Abandoned Carts Recovery)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] font-black">
                  Smart Re-engagement
                </span>
                {cartsData.summary?.isWhatsAppCloudConfigured ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>واتساب سحابي متصل</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] font-bold flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>مراسلة واتساب مباشرة (wa.me)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed max-w-3xl">
                فحص السلات التي لم يتم تحديثها أو استكمال طلباتها لمدد زمنية محددة، وترتيبها تنازلياً حسب كثافة المنتجات أو القيمة المالية، مع إمكانية إرسال إشعارات داخل المتجر (In-App) ورسائل واتساب فورية لإعادة استقطاب العميل وإتمام الشراء بنقرة واحدة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadCarts}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-btn bg-paper border border-line hover:border-primary text-ink text-xs font-black flex items-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث السلات الآن</span>
          </button>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
            <span className="text-[11px] font-bold text-ink-soft">السلات المتروكة المرصودة</span>
            <div className="text-xl font-black text-ink flex items-baseline gap-1.5">
              <span>{(cartsData.summary?.totalAbandonedCarts || 0).toLocaleString()}</span>
              <span className="text-xs font-bold text-ink-soft">سلة معلقة</span>
            </div>
            <span className="text-[10px] text-ink-soft block">
              خاملة لأكثر من {periodHours === 0 ? 'أي فترة' : `${periodHours} ساعة`}
            </span>
          </div>

          <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
            <span className="text-[11px] font-bold text-ink-soft">إجمالي القطع في السلات</span>
            <div className="text-xl font-black text-purple-600 flex items-baseline gap-1.5">
              <span>{(cartsData.summary?.totalAbandonedItems || 0).toLocaleString()}</span>
              <span className="text-xs font-bold text-purple-600/80">قطعة بانتظار الشراء</span>
            </div>
            <span className="text-[10px] text-ink-soft block">منتجات مضافة ولم تُشتر بعد</span>
          </div>

          <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
            <span className="text-[11px] font-bold text-ink-soft">القيمة المالية المحتملة</span>
            <div className="text-xl font-black text-emerald-600 flex items-baseline gap-1.5">
              <span>{(cartsData.summary?.totalAbandonedValue || 0).toLocaleString()}</span>
              <span className="text-xs font-bold text-ink-soft">{currency}</span>
            </div>
            <span className="text-[10px] text-ink-soft block">إجمالي مبيعات معلقة يمكن استردادها</span>
          </div>

          <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
            <span className="text-[11px] font-bold text-ink-soft">السلات التي تم تنبيهها</span>
            <div className="text-xl font-black text-orange-600 flex items-baseline gap-1.5">
              <span>{(cartsData.summary?.totalNotifiedCarts || 0).toLocaleString()}</span>
              <span className="text-xs font-bold text-ink-soft">سلة أُرسل لها</span>
            </div>
            <span className="text-[10px] text-ink-soft block">تنبيهات استعادة سابقة (In-App / WA)</span>
          </div>
        </div>
      </div>

      {/* Branch Scope Selector */}
      <AdminBranchSelector
        label="تصفية السلات المتروكة حسب الفرع:"
        onChange={() => loadCarts()}
      />

      {/* Control Bar: Filters, Sorting, Display Count, Search */}
      <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Inactivity Period Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-soft flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>مدة الخمول:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {periodOptions.map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setPeriodHours(opt.hours)}
                  className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-all ${
                    periodHours === opt.hours
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                      : 'bg-paper text-ink-soft hover:text-ink hover:bg-paper/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display Count (Limit) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-soft">العدد الظاهر:</span>
            <div className="flex items-center gap-1 bg-paper p-1 rounded-btn border border-line">
              {limitOptions.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setLimit(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                    limit === num
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Top {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Bar: Sorting & Search & Bulk Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Sorting */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-soft flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
                <span>الترتيب:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-paper border border-line rounded-btn py-1.5 px-3 text-xs text-ink font-bold outline-none focus:border-primary"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[240px] max-w-sm flex-1">
              <Search className="w-3.5 h-3.5 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم العميل، الهاتف، كود السلة..."
                className="w-full bg-paper border border-line rounded-btn py-1.5 pr-8 pl-3 text-xs text-ink font-bold outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Bulk Action Button */}
          {selectedCartIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">
                تم تحديد {selectedCartIds.length} سلة
              </span>
              <button
                type="button"
                onClick={() => setIsBulkSendModalOpen(true)}
                className="px-4 py-1.5 rounded-btn bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال تنبيه جماعي ({selectedCartIds.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Carts List View */}
      {isLoading ? (
        <div className="p-16 text-center bg-surface rounded-card border border-line space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs font-black text-ink">جاري فحص وتصفية السلات المتروكة...</p>
        </div>
      ) : (cartsData.carts || []).length === 0 ? (
        <div className="p-16 text-center bg-surface rounded-card border border-line space-y-3">
          <ShoppingCart className="w-12 h-12 text-ink-soft/40 mx-auto" />
          <h4 className="text-sm font-black text-ink">لا توجد سلات متروكة تطابق هذه المعايير حالياً</h4>
          <p className="text-xs text-ink-soft max-w-md mx-auto">
            جميع السلات النشطة إما تم تحويلها لطلبات ناجحة أو خمولها يقل عن {periodHours} ساعة. يمكنك تغيير فلتر المدة لتوسيع نطاق الفحص.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Selection header */}
          <div className="flex items-center justify-between px-2 text-xs font-bold text-ink-soft">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 hover:text-ink transition-colors"
            >
              {selectedCartIds.length === (cartsData.carts || []).length ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>تحديد الكل ({cartsData.carts.length} سلة معروضة)</span>
            </button>

            <span>
              مرتبة حسب: <strong>{sortOptions.find((s) => s.value === sortBy)?.label}</strong>
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-3.5">
            {cartsData.carts.map((cart, index) => {
              const isSelected = selectedCartIds.includes(cart.cartId);
              const lastNotification = cart.recoveryHistory?.[cart.recoveryHistory.length - 1];

              return (
                <div
                  key={cart.cartId}
                  className={`p-5 rounded-card bg-surface border transition-all space-y-4 shadow-sm ${
                    isSelected ? 'border-primary shadow-primary/10' : 'border-line hover:border-line/80'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Right side: Checkbox + Customer & Cart Metadata */}
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectCart(cart.cartId)}
                        className="mt-1 text-ink-soft hover:text-primary transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-paper border border-line text-xs font-black text-ink flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <h4 className="text-sm font-black text-ink">{cart.customer?.name}</h4>
                          {cart.customer?.isRegistered && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-black">
                              عميل مسجل
                            </span>
                          )}
                          {cart.branchId?.name && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black">
                              🏢 {cart.branchId.name}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-ink-soft/70">
                            ID: {cart.cartId}
                          </span>
                        </div>

                        {/* Customer Contact & Idle Details */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                          {cart.customer?.phone ? (
                            <span className="flex items-center gap-1 font-mono font-bold text-ink">
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              <span>{cart.customer.phone}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-soft/60">
                              (لم يُسجل هاتف بعد — زائر)
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            <span>آخر نشاط: <strong className="text-ink">{cart.idleText}</strong></span>
                          </span>

                          {lastNotification && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>
                                تم التنبيه {lastNotification.channels?.includes('whatsapp') ? 'واتساب' : ''}{' '}
                                {lastNotification.channels?.includes('in_app') ? 'وإشعار داخلي' : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Left side: Cart Metrics & Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-line">
                      <div className="text-left space-y-0.5 min-w-[130px]">
                        <div className="text-xs font-bold text-ink-soft">
                          محتويات السلة:{' '}
                          <strong className="text-purple-600 font-black">{cart.totalQuantity} منتج</strong>
                        </div>
                        <div className="text-base font-black text-ink">
                          {cart.subtotal.toLocaleString()} {currency}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSendModalCart(cart);
                            setSelectedChannel('in_app');
                          }}
                          className="px-3 py-1.5 rounded-btn bg-paper border border-line hover:border-primary text-ink text-xs font-bold flex items-center gap-1 transition-all"
                          title="إرسال إشعار داخل التطبيق فقط"
                        >
                          <Bell className="w-3.5 h-3.5 text-primary" />
                          <span>إشعار</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSendModalCart(cart);
                            setSelectedChannel(cart.customer?.phone ? 'whatsapp' : 'in_app');
                          }}
                          className="px-3 py-1.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                          title="إرسال واتساب للعميل"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSendModalCart(cart);
                            setSelectedChannel('both');
                          }}
                          className="px-3 py-1.5 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] text-xs font-black flex items-center gap-1 shadow-md transition-all"
                          title="إرسال إشعار داخلي وواتساب معاً"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>الاثنين معاً</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveCartModal(cart)}
                          className="p-1.5 rounded-btn bg-paper hover:bg-surface border border-line text-ink-soft hover:text-ink transition-colors"
                          title="عرض محتويات السلة بالتفصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Products Thumbnails Horizontal Preview */}
                  <div className="pt-3 border-t border-line/60 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-ink-soft ml-1">منتجات السلة:</span>
                    {(cart.items || []).slice(0, 5).map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-paper border border-line/70 text-xs"
                      >
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-7 h-7 rounded-lg object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-surface border border-line flex items-center justify-center text-ink-soft shrink-0">
                            <Package className="w-3.5 h-3.5 opacity-50" />
                          </div>
                        )}
                        <span className="font-bold text-ink max-w-[140px] truncate text-[11px]">
                          {it.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-surface text-[10px] font-black text-primary border border-line">
                          ×{it.quantity}
                        </span>
                      </div>
                    ))}
                    {(cart.items || []).length > 5 && (
                      <button
                        type="button"
                        onClick={() => setActiveCartModal(cart)}
                        className="text-[11px] font-bold text-primary hover:underline px-2"
                      >
                        +{cart.items.length - 5} منتجات إضافية
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Cart Details Preview */}
      {activeCartModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-lg space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h4 className="text-sm font-black text-ink">تفاصيل محتويات السلة المتروكة</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveCartModal(null)}
                className="text-ink-soft hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Customer Summary */}
            <div className="p-3.5 rounded-xl bg-paper border border-line space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-soft">العميل:</span>
                <span className="font-black text-ink">{activeCartModal.customer?.name}</span>
              </div>
              {activeCartModal.customer?.phone && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">الهاتف:</span>
                  <span className="font-mono font-bold text-primary">{activeCartModal.customer.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-soft">آخر تفاعل:</span>
                <span className="font-bold text-ink">{activeCartModal.idleText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">معرف السلة:</span>
                <span className="font-mono text-[10px] text-ink-soft">{activeCartModal.cartId}</span>
              </div>
            </div>

            {/* Items Breakdown */}
            <div className="space-y-2">
              <h5 className="text-xs font-black text-ink">المنتجات في السلة ({activeCartModal.items?.length}):</h5>
              <div className="divide-y divide-line border border-line rounded-xl bg-paper overflow-hidden">
                {(activeCartModal.items || []).map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      {it.image ? (
                        <img
                          src={it.image}
                          alt={it.name}
                          className="w-10 h-10 rounded-lg object-cover border border-line"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface border border-line flex items-center justify-center text-ink-soft">
                          <Package className="w-5 h-5 opacity-40" />
                        </div>
                      )}
                      <div>
                        <h6 className="font-bold text-ink">{it.name}</h6>
                        <span className="text-[11px] text-ink-soft">
                          الكمية: <strong>{it.quantity}</strong> × {it.price} {currency}
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-ink">
                      {(it.price * it.quantity).toLocaleString()} {currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-3 border-t border-line text-sm font-black">
              <span>المجموع الكلي:</span>
              <span className="text-primary text-base">
                {activeCartModal.subtotal.toLocaleString()} {currency}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveCartModal(null)}
                className="px-4 py-2 rounded-btn bg-paper border border-line text-xs font-bold hover:bg-surface"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  setSendModalCart(activeCartModal);
                  setActiveCartModal(null);
                }}
                className="px-4 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black flex items-center gap-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال تنبيه استعادة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Single or Bulk Send Recovery Notification */}
      {(sendModalCart || isBulkSendModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 text-xs font-bold">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2 text-primary">
                <Send className="w-4 h-4" />
                <h4 className="text-sm font-black text-ink">
                  {isBulkSendModalOpen
                    ? `إرسال تنبيه استعادة جماعي (${selectedCartIds.length} سلة)`
                    : `إرسال تنبيه استعادة للعميل «${sendModalCart?.customer?.name}»`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSendModalCart(null);
                  setIsBulkSendModalOpen(false);
                }}
                className="text-ink-soft hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <label className="block text-ink-soft">طريقة الإرسال والتنبيه المطلوبة:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('in_app')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    selectedChannel === 'in_app'
                      ? 'border-primary bg-primary/10 text-primary font-black shadow-sm'
                      : 'border-line bg-paper text-ink-soft hover:text-ink'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span className="text-[11px]">إشعار داخلي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('whatsapp')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    selectedChannel === 'whatsapp'
                      ? 'border-emerald-600 bg-emerald-500/10 text-emerald-600 font-black shadow-sm'
                      : 'border-line bg-paper text-ink-soft hover:text-ink'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[11px]">رسالة واتساب</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('both')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    selectedChannel === 'both'
                      ? 'border-purple-600 bg-purple-500/10 text-purple-600 font-black shadow-sm'
                      : 'border-line bg-paper text-ink-soft hover:text-ink'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-[11px]">الاثنين معاً 🔥</span>
                </button>
              </div>
            </div>

            {/* Custom Message (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-ink-soft">
                رسالة التنبيه (اختياري — سيتم استخدام النص الذكي الافتراضي):
              </label>
              <textarea
                value={customNotificationMessage}
                onChange={(e) => setCustomNotificationMessage(e.target.value)}
                placeholder="مثال: مرحباً بك! سلتك بانتظار إتمام الطلب، وفرنا لك كود خصم خاص..."
                rows={3}
                className="w-full bg-paper border border-line rounded-btn p-3 text-xs text-ink outline-none focus:border-primary font-medium"
              />
            </div>

            {/* Notice */}
            <div className="p-3 rounded-xl bg-paper border border-line/60 text-[11px] text-ink-soft leading-relaxed space-y-1">
              <p>
                • <strong>الإشعار الداخلي (In-App):</strong> يظهر في جرس إشعارات المتجر للعميل بنقرة للعودة للسلة مباشرة.
              </p>
              <p>
                • <strong>الواتساب:</strong> يتطلب توفر رقم هاتف للعميل، ويتم إرساله آلياً عبر السحابة أو عبر فتح نافذة محادثة مباشرة معدة بالكامل.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                disabled={isSending}
                onClick={() => {
                  setSendModalCart(null);
                  setIsBulkSendModalOpen(false);
                }}
                className="px-4 py-2 rounded-btn bg-paper border border-line text-ink hover:bg-surface"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isSending}
                onClick={isBulkSendModalOpen ? handleConfirmBulkSend : handleConfirmSingleSend}
                className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'جاري الإرسال...' : 'تأكيد الإرسال الآن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
