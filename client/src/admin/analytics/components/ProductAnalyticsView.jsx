import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Eye,
  Heart,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  MessageSquareWarning,
  Layers,
  Tag
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

function DeltaBadge({ delta, inverseGood = false }) {
  if (!delta || delta.percentChange === null || delta.percentChange === undefined) {
    return <span className="text-[10px] text-ink-soft font-bold">مقارنة غير متاحة</span>;
  }
  const pct = Number(delta.percentChange);
  const isPositive = pct > 0;
  const isNeutral = pct === 0;
  const isGood = inverseGood ? !isPositive : isPositive;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
        isNeutral
          ? 'bg-slate-500/10 text-ink-soft'
          : isGood
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-red-500/10 text-red-500'
      }`}
    >
      {isPositive ? <TrendingUp className="w-3 h-3" /> : !isNeutral ? <TrendingDown className="w-3 h-3" /> : null}
      <span dir="ltr">{isPositive ? `+${pct}%` : `${pct}%`}</span>
      <span className="text-ink-soft/80 font-normal mr-1">
        (السابق: {delta.previous ?? 0})
      </span>
    </span>
  );
}

export default function ProductAnalyticsView({ productId, rangeParams, onBack }) {
  const { token, config } = useStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !productId) return;
    setLoading(true);
    setError('');
    axios
      .get(`/api/admin/analytics/products/${productId}`, {
        params: rangeParams,
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'تعذر تحميل تحليلات المنتج');
      })
      .finally(() => setLoading(false));
  }, [token, productId, JSON.stringify(rangeParams)]);

  if (loading) {
    return (
      <div className="p-12 rounded-card bg-surface border border-line text-center space-y-3 animate-pulse">
        <div className="w-12 h-12 rounded-full bg-primary/15 mx-auto" />
        <p className="text-sm font-black text-ink">جاري تحميل التحليلات التفصيلية للمنتج...</p>
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="p-8 rounded-card bg-surface border border-line text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-sm font-black text-red-500">{error || 'المنتج غير متوفر'}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-btn bg-primary text-white text-xs font-bold"
          >
            العودة للوحة التحليلات
          </button>
        )}
      </div>
    );
  }

  const { product, current, comparisons, timeSeries = [], period, recentReviews = [] } = data;
  const currency = config?.currency || 'ج.م';

  const wishlistAndCartBarData = [
    {
      name: 'إضافة للمفضلة',
      الحالي: current.activity.wishlistAdded,
      السابق: comparisons.wishlistAdded?.previous || 0
    },
    {
      name: 'حذف من المفضلة',
      الحالي: current.activity.wishlistRemoved,
      السابق: comparisons.wishlistRemoved?.previous || 0
    },
    {
      name: 'إضافة للسلة',
      الحالي: current.activity.addToCartEvents,
      السابق: comparisons.addToCartEvents?.previous || 0
    },
    {
      name: 'حذف من السلة',
      الحالي: current.activity.removeFromCartEvents,
      السابق: comparisons.removeFromCartEvents?.previous || 0
    },
    {
      name: 'بدء الدفع',
      الحالي: current.activity.checkoutStartedEvents,
      السابق: comparisons.checkoutStartedEvents?.previous || 0
    }
  ];

  const ratesComparisonData = [
    {
      name: 'مشاهدة ← سلة %',
      الحالي: current.conversions.viewToCartConversion ?? 0,
      السابق: comparisons.viewToCartConversion?.previous ?? 0
    },
    {
      name: 'مشاهدة ← شراء %',
      الحالي: current.conversions.viewToPurchaseConversion ?? 0,
      السابق: comparisons.viewToPurchaseConversion?.previous ?? 0
    },
    {
      name: 'سلة ← دفع %',
      الحالي: current.conversions.cartToCheckoutConversion ?? 0,
      السابق: comparisons.cartToCheckoutConversion?.previous ?? 0
    },
    {
      name: 'معدل الإلغاء %',
      الحالي: current.conversions.orderCancellationRate ?? 0,
      السابق: comparisons.orderCancellationRate?.previous ?? 0
    },
    {
      name: 'معدل الاسترجاع %',
      الحالي: current.conversions.productReturnRate ?? 0,
      السابق: comparisons.productReturnRate?.previous ?? 0
    },
    {
      name: 'إشارات السعر/مشاهدة %',
      الحالي: current.conversions.priceFeedbackRate ?? 0,
      السابق: comparisons.priceFeedbackRate?.previous ?? 0
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Product Header & Back Action */}
      <div className="p-5 sm:p-6 rounded-card bg-surface border border-line shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {product.images?.[0] && (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-line bg-paper shrink-0"
            />
          )}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {product.category.name}
                </span>
              )}
              {product.offer && (
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> عرض نشط ({product.offer.discountPercentage}%)
                </span>
              )}
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-orange-500/10 text-orange-600 flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" /> {product.ratingAvg?.toFixed(1) || '0.0'} ({product.ratingCount} تقييم)
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-ink truncate">{product.name}</h3>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-ink-soft">
              <span>
                السعر الحالي: <strong className="text-primary">{product.price?.toLocaleString()} {currency}</strong>
              </span>
              {product.oldPrice > product.price && (
                <span className="line-through">{product.oldPrice?.toLocaleString()} {currency}</span>
              )}
              <span>المخزون المتاح: <strong className="text-ink">{product.stockCount}</strong></span>
              <span>المنطقة الزمنية: <strong dir="ltr">{period.timezone}</strong></span>
            </div>
          </div>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-btn bg-paper hover:bg-primary hover:text-white text-ink border border-line text-xs font-black flex items-center gap-1.5 transition-all shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لتقارير المتجر</span>
          </button>
        )}
      </div>

      {/* Product Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-ink-soft text-xs font-bold">
            <span>المشاهدات والزوار</span>
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-black text-ink">{current.activity.productViews}</div>
          <div className="text-[11px] font-bold text-ink-soft">
            {current.activity.uniqueVisitors} زائر فريد ({current.activity.uniqueSessions} جلسة)
          </div>
          <DeltaBadge delta={comparisons.productViews} />
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-ink-soft text-xs font-bold">
            <span>المفضلة (+ / -)</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-ink">
            +{current.activity.wishlistAdded}{' '}
            <span className="text-xs font-bold text-ink-soft">/ -{current.activity.wishlistRemoved}</span>
          </div>
          <div className="text-[11px] font-bold text-ink-soft">إضافات وإزالات المفضلة</div>
          <DeltaBadge delta={comparisons.wishlistAdded} />
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-ink-soft text-xs font-bold">
            <span>إضافات السلة</span>
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-ink">
            {current.activity.addToCartEvents}{' '}
            <span className="text-xs font-bold text-ink-soft">(-{current.activity.removeFromCartEvents} حذف)</span>
          </div>
          <div className="text-[11px] font-bold text-indigo-600">
            تحويل السلة: {current.conversions.viewToCartConversion !== null ? `${current.conversions.viewToCartConversion}%` : 'غير متاح'}
          </div>
          <DeltaBadge delta={comparisons.addToCartEvents} />
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-ink-soft text-xs font-bold">
            <span>بدء الدفع والطلبات</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-ink">
            {current.orders.ordersCompleted}{' '}
            <span className="text-xs font-bold text-ink-soft">من {current.orders.ordersCreated} طلب</span>
          </div>
          <div className="text-[11px] font-bold text-emerald-600">
            الوحدات المباعة: {current.orders.unitsSold} | بدء دفع: {current.activity.checkoutStartedEvents}
          </div>
          <DeltaBadge delta={comparisons.ordersCompleted} />
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-ink-soft text-xs font-bold">
            <span>الإلغاء والاسترجاع</span>
            <RotateCcw className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-black text-ink">
            {current.orders.ordersCancelled} ملغي / {current.orders.returnedQuantity} مسترجع
          </div>
          <div className="text-[11px] font-bold text-red-500">
            إلغاء: {current.conversions.orderCancellationRate ?? 0}% | استرجاع: {current.conversions.productReturnRate ?? 0}%
          </div>
          <DeltaBadge delta={comparisons.orderCancellationRate} inverseGood />
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-ink-soft text-xs font-bold">
            <span>إشارات «السعر مرتفع»</span>
            <MessageSquareWarning className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-xl font-black text-orange-600">{current.activity.priceFeedbackEvents}</div>
          <div className="text-[11px] font-bold text-orange-600">
            نسبة للمشاهدات: {current.conversions.priceFeedbackRate !== null ? `${current.conversions.priceFeedbackRate}%` : '0%'}
          </div>
          <DeltaBadge delta={comparisons.priceFeedbackEvents} inverseGood />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Views & Orders Over Time Line Chart */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-black text-ink">1. المشاهدات وإضافات السلة والطلبات عبر الزمن</h4>
            <p className="text-[11px] text-ink-soft">تطور تفاعل الزوار والطلبات اليومية للمنتج خلال الفترة المحددة</p>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="views"
                  name="المشاهدات"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cartAdditions"
                  name="إضافات السلة"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="completedOrders"
                  name="الطلبات المكتملة"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Wishlist & Cart Actions Bar Chart (Current vs Previous Period) */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-black text-ink">2. تفاعلات المفضلة والسلة والدفع (الحالي مقابل الفترة السابقة)</h4>
            <p className="text-[11px] text-ink-soft">مقارنة أعداد الإضافة والحذف وبدء الدفع مع الفترة المماثلة السابقة</p>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wishlistAndCartBarData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="الحالي" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="السابق" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Conversion, Cancellation & Return Rates Comparison Chart */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-black text-ink">3. مقارنة معدلات التحويل والإلغاء والاسترجاع (%)</h4>
            <p className="text-[11px] text-ink-soft">جميع القيم على محور النسب المئوية (0% - 100%) للفترة الحالية والسابقة</p>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratesComparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'النسبة']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="الحالي" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="السابق" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Price-Feedback Count & Trend Over Time */}
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-ink">4. اتجاه إشارات «السعر مرتفع» عبر الزمن</h4>
              <p className="text-[11px] text-ink-soft">
                إشارة استرشادية من المتسوقين وليست دليلاً قاطعاً بمفردها على المبالغة في التسعير
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 text-xs font-black">
              إجمالي: {current.activity.priceFeedbackEvents} إشارة
            </span>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="priceFeedback"
                  name="إشارات السعر مرتفع"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="cancelledOrders"
                  name="الطلبات الملغاة"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="returnedQuantity"
                  name="الوحدات المسترجعة"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Existing Ratings Breakdown & Recent Reviews */}
      <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-black text-ink flex items-center gap-2">
            <Star className="w-4 h-4 text-orange-500 fill-current" />
            <span>ملخص تقييمات ومراجعات المنتج الحالية ({product.ratingCount} تقييم — بمتوسط {product.ratingAvg?.toFixed(1) || 0} / 5)</span>
          </h4>
          <span className="text-xs font-bold text-ink-soft">
            إجمالي المشاهدات التاريخية: {product.lifetimeVisited} | إجمالي المبيعات التاريخية: {product.lifetimeSalesCount}
          </span>
        </div>

        {recentReviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentReviews.slice(0, 6).map((r) => (
              <div key={r._id} className="p-3.5 rounded-xl bg-paper border border-line space-y-1 text-xs">
                <div className="flex items-center justify-between font-black">
                  <span className="text-ink">{r.username}</span>
                  <span className="text-orange-500">{'★'.repeat(r.rating || 5)}</span>
                </div>
                {r.comment && <p className="text-ink-soft leading-relaxed">{r.comment}</p>}
                <span className="text-[10px] text-ink-soft/70 block">
                  {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-soft py-4 text-center">لا توجد مراجعات نصية مسجلة لهذا المنتج حتى الآن.</p>
        )}
      </div>
    </div>
  );
}
