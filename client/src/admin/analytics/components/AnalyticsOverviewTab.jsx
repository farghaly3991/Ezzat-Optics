import React from 'react';
import {
  Eye,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  XCircle,
  DollarSign,
  Heart,
  MessageSquareWarning,
  Layers,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { DeltaPill } from './analyticsHelpers';

export default function AnalyticsOverviewTab({
  overviewLoading,
  overviewError,
  overviewData,
  currency = 'ج.م'
}) {
  if (overviewLoading) {
    return (
      <div className="p-12 rounded-card bg-surface border border-line text-center text-ink-soft font-bold animate-pulse">
        جاري حساب مؤشرات الأداء والسلاسل الزمنية ومعدلات التحويل...
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="p-8 rounded-card bg-red-500/10 border border-red-500/20 text-red-500 text-center text-xs font-bold">
        {overviewError}
      </div>
    );
  }

  if (!overviewData?.current) return null;

  const current = overviewData.current || {};
  const activity = current.activity || {};
  const orders = current.orders || {};
  const conversions = current.conversions || {};
  const fin = current.financials || current.financial || {};
  const comparisons = overviewData.comparisons || {};
  const timeSeries = overviewData.timeSeries || [];
  const funnel = overviewData.funnel;

  // 1. Views
  const productViews = activity.productViews ?? 0;
  const uniqueVisitors = activity.uniqueVisitors ?? 0;
  const uniqueSessions = activity.uniqueSessions ?? 0;

  // 2. Cart Additions
  const addToCartEvents = activity.addToCartEvents ?? 0;
  const addToCartQuantity = activity.addToCartQuantity ?? 0;
  const removeFromCartEvents = activity.removeFromCartEvents ?? 0;

  // 3. Checkout Starts
  const checkoutStartedEvents = activity.checkoutStartedEvents ?? 0;
  const cartToCheckout = conversions.cartToCheckoutConversion ?? null;

  // 4. Completed Orders
  const ordersCompleted = orders.ordersCompleted ?? 0;
  const ordersCreated = orders.ordersCreated ?? 0;
  const unitsSold = orders.unitsSold ?? 0;

  // 5. Conversions
  const viewToPurchase = conversions.viewToPurchaseConversion ?? null;
  const viewToCart = conversions.viewToCartConversion ?? null;

  // 6. Cancellations
  const cancellationRate = conversions.orderCancellationRate ?? conversions.cancellationRate ?? null;
  const ordersCancelled = orders.ordersCancelled ?? 0;
  const cancelledUnits = orders.unitsCancelled ?? orders.cancelledQuantity ?? 0;

  // 7. Gross Revenue
  const grossRevenue = fin.grossRevenueValid ?? fin.grossRevenue ?? fin.completedRevenue ?? 0;
  const shippingRevenue = fin.shippingRevenue ?? 0;
  const discountsApplied = fin.discountsApplied ?? 0;

  // 8. Net Profit
  const netProfit = fin.netProfitCompleted ?? fin.netProfitValid ?? fin.netProfit ?? 0;
  const profitMargin =
    fin.profitMargin !== null && fin.profitMargin !== undefined
      ? fin.profitMargin
      : grossRevenue > 0 && netProfit
      ? Math.round((netProfit / grossRevenue) * 100)
      : null;

  // Contextual signals
  const wishlistAdd = activity.wishlistAddEvents ?? activity.wishlistAdded ?? 0;
  const wishlistRemove = activity.wishlistRemoveEvents ?? activity.wishlistRemoved ?? 0;
  const priceFeedback = activity.priceTooHighFeedbackCount ?? activity.priceFeedbackEvents ?? 0;
  const deliveryOrders = orders.deliveryMethodBreakdown?.delivery ?? 0;
  const pickupOrders = orders.deliveryMethodBreakdown?.pickup ?? 0;

  // TimeSeries data formatted safely for Recharts
  const chartTimeSeries = (timeSeries || []).map((pt) => ({
    ...pt,
    views: pt.views || 0,
    cartAdditions: pt.cartAdditions || 0,
    completedOrders: pt.completedOrders || 0,
    conversionRate: pt.conversionRate || 0,
    grossRevenue: pt.grossRevenue ?? pt.revenue ?? 0,
    netProfit: pt.netProfit ?? 0
  }));

  // Parse funnel stages safely (supports both array contract and object)
  const funnelStages = Array.isArray(funnel?.stages)
    ? funnel.stages.map((st, idx) => ({
        key: st.key || `stage-${idx}`,
        step: `${idx + 1}. ${st.label}`,
        count: st.actorCount ?? st.eventCount ?? 0,
        sub: st.secondaryLabel || (st.unitLabel ? `${st.actorCount ?? 0} ${st.unitLabel}` : ''),
        prevRate: st.conversionFromPrevious !== null && st.conversionFromPrevious !== undefined ? `${st.conversionFromPrevious}%` : '—',
        topRate: st.conversionFromTop !== null && st.conversionFromTop !== undefined ? `${st.conversionFromTop}% من القمة` : '—'
      }))
    : funnel?.stages && typeof funnel.stages === 'object'
    ? [
        {
          key: 'sessions',
          step: '1. الجلسات والزوار',
          count: funnel.stages.sessions?.count || 0,
          sub: `${uniqueVisitors} زائر`,
          prevRate: '100%',
          topRate: '100%'
        },
        {
          key: 'views',
          step: '2. مشاهدات المنتجات',
          count: funnel.stages.productViews?.count || 0,
          sub: `تحويل: ${funnel.stepConversions?.sessionToViewRate ?? '—'}%`,
          prevRate: `${funnel.stepConversions?.sessionToViewRate ?? '—'}%`,
          topRate: `${funnel.overallConversions?.viewsOfSessions ?? '—'}%`
        },
        {
          key: 'cart',
          step: '3. إضافات السلة',
          count: funnel.stages.cartAdditions?.count || 0,
          sub: `تحويل: ${funnel.stepConversions?.viewToCartRate ?? '—'}%`,
          prevRate: `${funnel.stepConversions?.viewToCartRate ?? '—'}%`,
          topRate: `${funnel.overallConversions?.cartOfSessions ?? '—'}%`
        },
        {
          key: 'checkout',
          step: '4. بدء الدفع',
          count: funnel.stages.checkoutStarted?.count || 0,
          sub: `تحويل: ${funnel.stepConversions?.cartToCheckoutRate ?? '—'}%`,
          prevRate: `${funnel.stepConversions?.cartToCheckoutRate ?? '—'}%`,
          topRate: `${funnel.overallConversions?.checkoutOfSessions ?? '—'}%`
        },
        {
          key: 'orders',
          step: '5. إنشاء الطلب',
          count: funnel.stages.ordersCreated?.count || 0,
          sub: `تحويل: ${funnel.stepConversions?.checkoutToOrderRate ?? '—'}%`,
          prevRate: `${funnel.stepConversions?.checkoutToOrderRate ?? '—'}%`,
          topRate: `${funnel.overallConversions?.ordersOfSessions ?? '—'}%`
        },
        {
          key: 'completed',
          step: '6. اكتمال الطلب',
          count: funnel.stages.ordersCompleted?.count || 0,
          sub: `تحويل: ${funnel.stepConversions?.orderCompletionRate ?? '—'}%`,
          prevRate: `${funnel.stepConversions?.orderCompletionRate ?? '—'}%`,
          topRate: `${funnel.overallConversions?.completedOfSessions ?? '—'}%`
        }
      ]
    : [];

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 8 Core KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* 1. Views */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">1. مشاهدات المنتجات (Views)</span>
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-ink">
            {productViews.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            {uniqueVisitors} زائر فريد ({uniqueSessions} جلسة)
          </div>
          <DeltaPill delta={comparisons.productViews} />
        </div>

        {/* 2. Cart Additions */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">2. إضافات السلة (Cart Additions)</span>
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-ink">
            {addToCartEvents.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            {addToCartQuantity} وحدة مضافة | حذف: {removeFromCartEvents}
          </div>
          <DeltaPill delta={comparisons.addToCartEvents} />
        </div>

        {/* 3. Checkout Starts */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">3. بدء الدفع (Checkout Starts)</span>
            <CreditCard className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-ink">
            {checkoutStartedEvents.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            سلة ← دفع: {cartToCheckout !== null ? `${cartToCheckout}%` : 'غير متاح'}
          </div>
          <DeltaPill delta={comparisons.checkoutStartedEvents} />
        </div>

        {/* 4. Completed Orders */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">4. الطلبات المكتملة (Completed)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {ordersCompleted.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            من إجمالي {ordersCreated} طلب ({unitsSold} وحدة مسلمة)
          </div>
          <DeltaPill delta={comparisons.ordersCompleted} />
        </div>

        {/* 5. Conversion Rate */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">5. معدل التحويل للشراء (Conversion)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-ink">
            {viewToPurchase !== null ? `${viewToPurchase}%` : 'غير متاح'}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            مشاهدة ← سلة: {viewToCart !== null ? `${viewToCart}%` : '—'}
          </div>
          <DeltaPill delta={comparisons.viewToPurchaseConversion} />
        </div>

        {/* 6. Cancellation Rate */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">6. معدل الإلغاء (Cancellation Rate)</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-500">
            {cancellationRate !== null ? `${cancellationRate}%` : '0%'}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            {ordersCancelled} طلب ملغى ({cancelledUnits} وحدة)
          </div>
          <DeltaPill delta={comparisons.cancellationRate ?? comparisons.orderCancellationRate} inverseGood={true} />
        </div>

        {/* 7. Gross Revenue */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">7. إجمالي الإيرادات (Gross Revenue)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {Number(grossRevenue || 0).toLocaleString()} {currency}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            شحن محصل: {Number(shippingRevenue || 0).toLocaleString()} | خصومات: {Number(discountsApplied || 0).toLocaleString()}
          </div>
          <DeltaPill delta={comparisons.grossRevenue ?? comparisons.completedRevenue} />
        </div>

        {/* 8. Net Profit */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-black">8. صافي الربح التقديري (Net Profit)</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-primary">
            {Number(netProfit || 0).toLocaleString()} {currency}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            هامش الربح: {profitMargin !== null ? `${profitMargin}%` : 'غير محدد (تتطلب تكلفة)'}
          </div>
          <DeltaPill delta={comparisons.netProfit ?? comparisons.completedRevenue} />
        </div>
      </div>

      {/* Optional Contextual Signals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-card bg-surface border border-line flex items-center gap-3">
          <Heart className="w-8 h-8 text-rose-500 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-black text-ink-soft block">قائمة الرغبات (Wishlist)</span>
            <div className="text-lg font-black text-ink">
              +{wishlistAdd} إضافة / -{wishlistRemove} إزالة
            </div>
          </div>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line flex items-center gap-3">
          <MessageSquareWarning className="w-8 h-8 text-orange-500 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-black text-ink-soft block">إشارات «السعر مرتفع» (Price Feedback)</span>
            <div className="text-lg font-black text-ink">
              {priceFeedback} إشارة من العملاء
            </div>
          </div>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-black text-ink-soft block">توزيع الاستلام (Delivery vs Pickup)</span>
            <div className="text-xs font-bold text-ink">
              توصيل منزلي: <strong>{deliveryOrders}</strong> | استلام فرع: <strong>{pickupOrders}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Interactive TimeSeries Charts */}
      {chartTimeSeries.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Views & Cart Additions Over Time */}
            <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
              <div>
                <h4 className="text-sm font-black text-ink">1. المشاهدات وإضافات السلة عبر الزمن</h4>
                <p className="text-[11px] text-ink-soft">تتبع حركة اهتمام الزوار وإقبالهم على المنتجات</p>
              </div>
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTimeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="views"
                      name="المشاهدات (Views)"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cartAdditions"
                      name="إضافات السلة (Cart Additions)"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Completed Orders & Conversion Rate Over Time */}
            <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
              <div>
                <h4 className="text-sm font-black text-ink">2. الطلبات المكتملة ومعدل التحويل عبر الزمن</h4>
                <p className="text-[11px] text-ink-soft">
                  المحور الأيسر: عدد الطلبات المكتملة | المحور الأيمن: نسبة التحويل (%)
                </p>
              </div>
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTimeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="orders" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis yAxisId="rate" orientation="right" unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      yAxisId="orders"
                      type="monotone"
                      dataKey="completedOrders"
                      name="الطلبات المكتملة"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="rate"
                      type="monotone"
                      dataKey="conversionRate"
                      name="معدل التحويل %"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 3: Gross Revenue & Estimated Net Profit Over Time */}
          <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
            <div>
              <h4 className="text-sm font-black text-ink">3. الإيرادات وصافي الربح عبر الزمن</h4>
              <p className="text-[11px] text-ink-soft">
                القيم بالعملة ({currency}) بناءً على حركة الطلبات المسجلة
              </p>
            </div>
            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartTimeSeries} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                    formatter={(val) => [`${Number(val || 0).toLocaleString()} ${currency}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="grossRevenue"
                    name="الإيرادات (Revenue)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="صافي الربح التقديري (Net Profit)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-card bg-surface border border-line text-center text-xs text-ink-soft">
          لا توجد بيانات حركة زمنية كافية في هذا النطاق لعرض الرسوم البيانية.
        </div>
      )}

      {/* Multi-Step Marketing & Conversion Funnel */}
      {funnelStages.length > 0 && (
        <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-5">
          <div>
            <h4 className="text-sm font-black text-ink">4. قمع التحويل التسويقي (Marketing & Conversion Funnel)</h4>
            <p className="text-[11px] text-ink-soft">
              تتبع رحلة العميل من المشاهدة الأولى وحتى استلام الطلب مع نسب التحويل والتسرب عند كل مرحلة
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {funnelStages.map((st) => (
              <div
                key={st.key}
                className="p-4 rounded-xl border border-line bg-paper/60 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-black block text-ink-soft">{st.step}</span>
                  <div className="text-xl font-black mt-1 text-ink">{Number(st.count || 0).toLocaleString()}</div>
                  <span className="text-[10px] font-bold text-ink-soft block">{st.sub}</span>
                </div>
                <div className="pt-2 border-t border-line text-[10px] font-black flex items-center justify-between text-primary">
                  <span>تحويل: {st.prevRate}</span>
                  <span className="text-ink-soft font-normal">{st.topRate}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-card bg-paper border border-line text-[11px] text-ink-soft space-y-1">
            <div className="font-black text-ink flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <span>ملاحظات منهجية قياس القمع التسويقي:</span>
            </div>
            <p>
              {funnel?.attributionDisclosure ||
                'يتم احتساب معدلات التحويل خطوة بخطوة بالاعتماد على سجل أحداث النشاط الحقيقي (Activity Events) والطلبات المسجلة بالفترة.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
