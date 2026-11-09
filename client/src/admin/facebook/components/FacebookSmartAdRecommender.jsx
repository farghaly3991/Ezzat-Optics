import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShoppingCart,
  PackageX,
  Eye,
  TrendingUp,
  Boxes,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

const SIGNAL_OPTIONS = [
  {
    id: 'auto_ai',
    label: '✨ ترشيح ذكي شامل (AI Auto-Pick)',
    shortLabel: 'ترشيح ذكي شامل',
    badge: 'الخيار الموصى به',
    icon: Sparkles,
    color: 'from-purple-600 to-indigo-600',
    border: 'border-purple-500',
    description: 'يحلل الذكاء الاصطناعي كافة دلالات المنصة ليختار المنتجات الأكثر إلحاحاً لإعلان فوري.'
  },
  {
    id: 'cart_without_order',
    label: '🛒 سلات متروكة (تُضاف للكارت بدون أوردر)',
    shortLabel: 'سلات متروكة',
    badge: 'أعلى عائد تحويل',
    icon: ShoppingCart,
    color: 'from-orange-500 to-orange-600',
    border: 'border-orange-500',
    description: 'منتجات وضعها العملاء في السلة أو المفضلة ولم يكملوا الطلب — تستهدف حسم التردد.'
  },
  {
    id: 'incomplete_orders',
    label: '📦 طلبات لم تكتمل أو أُلغيت',
    shortLabel: 'طلبات غير مكتملة',
    badge: 'استعادة الطلبات',
    icon: PackageX,
    color: 'from-rose-500 to-red-600',
    border: 'border-rose-500',
    description: 'منتجات دخلت في طلبات ولم يتم تسليمها — إعلان يركز على الضمان والمعاينة وسرعة التوصيل.'
  },
  {
    id: 'high_views_low_conversion',
    label: '👀 مشاهدات عالية بدون شراء (أو حساسية سعر)',
    shortLabel: 'مشاهدات عالية وتحويل منخفض',
    badge: 'تحسين التحويل',
    icon: Eye,
    color: 'from-blue-600 to-indigo-600',
    border: 'border-blue-500',
    description: 'منتجات تحظى باهتمام وزيارات مرتفعة — إعلان يبرز القيمة والمواصفات أو يقدم عرضاً منافساً.'
  },
  {
    id: 'best_sellers',
    label: '🔥 الأكثر مبيعاً وطلباً (Winning Products)',
    shortLabel: 'الأكثر مبيعاً',
    badge: 'دليل اجتماعي',
    icon: TrendingUp,
    color: 'from-emerald-600 to-teal-700',
    border: 'border-emerald-500',
    description: 'المنتجات الرابحة الأكثر إقبالاً — استثمار نجاحها لجذب شرائح عملاء جديدة ومضمونة.'
  },
  {
    id: 'slow_movers_high_stock',
    label: '📊 مخزون متوفر يحتاج تحريك وتنشيط',
    shortLabel: 'تنشيط المخزون',
    badge: 'تصفية المخزون',
    icon: Boxes,
    color: 'from-slate-600 to-gray-800',
    border: 'border-slate-500',
    description: 'منتجات متوفرة بكميات جيدة في المخزون وحركتها بطيئة — تستهدف عروض التوفير والباكدج.'
  }
];

export default function FacebookSmartAdRecommender({
  onApplySmartCampaign,
  onOpenPreview,
  currency = 'ج.م'
}) {
  const { token, showToast } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [selectedSignal, setSelectedSignal] = useState('auto_ai');
  const [productCount, setProductCount] = useState('auto');
  const [range, setRange] = useState('30d');
  const [generating, setGenerating] = useState(false);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [signalsData, setSignalsData] = useState(null);
  const [showSignalsDetails, setShowSignalsDetails] = useState(false);
  const [lastResultStrategy, setLastResultStrategy] = useState(null);

  // Fetch Signals Overview on demand or mount
  const fetchAdSignals = async () => {
    if (!token) return;
    setLoadingSignals(true);
    try {
      const res = await axios.get(`/api/admin/facebook/ad-signals?range=${range}`, authHeader);
      if (res.data?.done) {
        setSignalsData(res.data);
      }
    } catch (err) {
      console.warn('Could not load ad signals preview:', err.message);
    } finally {
      setLoadingSignals(false);
    }
  };

  useEffect(() => {
    fetchAdSignals();
  }, [token, range]);

  // Main Action: Generate Smart Campaign
  const handleGenerateCampaign = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(
        '/api/admin/facebook/smart-ad-campaign',
        {
          signalType: selectedSignal,
          range,
          productCount: productCount === 'auto' ? 0 : parseInt(productCount, 10)
        },
        authHeader
      );

      if (res.data?.done) {
        setLastResultStrategy({
          signalLabel: res.data.signalLabel,
          strategySummary: res.data.strategySummary,
          selectedProducts: res.data.selectedProducts || [],
          aiUsed: res.data.aiUsed
        });

        // Pass everything to parent FacebookPage state
        if (onApplySmartCampaign) {
          onApplySmartCampaign(res.data);
        }

        showToast(
          res.data.aiUsed
            ? 'تم تحليل نشاط المتجر وتجهيز الإعلان بالكامل بالذكاء الاصطناعي! 🚀'
            : 'تم تجهيز الإعلان بالكامل بناءً على دلالات نشاط المتجر! ✅'
        );
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'حدث خطأ أثناء اقتراح وتجهيز الإعلان', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const currentSignalObj =
    SIGNAL_OPTIONS.find((s) => s.id === selectedSignal) || SIGNAL_OPTIONS[0];

  const currentBucketCandidates =
    signalsData?.signalsCatalog?.[selectedSignal]?.candidates || [];

  return (
    <div className="rounded-card bg-gradient-to-br from-surface to-paper border-2 border-primary/30 p-5 sm:p-6 space-y-5 shadow-md text-ink relative overflow-hidden">
      {/* Decorative ambient light */}
      <div className="absolute -top-24 -left-24 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-56 h-56 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-orange-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
                <span>المساعد الذكي: اقتراح وتجهيز إعلان فيسبوك جاهز من دلالات نشاط المتجر</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
                  AI Marketing Engine
                </span>
              </h3>
              <p className="text-xs text-ink-soft">
                الذكاء الاصطناعي يستخرج تلقائياً المنتجات التي تحتاج إعلاناً (السلات المتروكة، الأوردرات غير المكتملة، الأكثر مبيعاً، أو المشاهدات المرتفعة) ويجهز إعلاناً كاملاً بنصوصه وتصميمه جاهزاً للنشر فوراً مع إمكانية تعديله.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSignalsDetails((prev) => !prev)}
            className="px-3.5 py-1.5 rounded-btn bg-surface hover:bg-paper border border-line text-ink text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Info className="w-3.5 h-3.5 text-primary" />
            <span>{showSignalsDetails ? 'إخفاء دلالات النشاط' : 'استعراض دلالات نشاط المتجر'}</span>
            {showSignalsDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Store Quick Stats Bar from Analytics */}
      {signalsData?.storeSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs relative z-10">
          <div className="p-2.5 rounded-xl bg-surface/80 border border-line">
            <span className="text-[10px] font-bold text-ink-soft block">مشاهدات المنتجات</span>
            <span className="text-sm font-black text-ink">
              {signalsData.storeSummary.totalViews?.toLocaleString() || 0}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface/80 border border-orange-500/25">
            <span className="text-[10px] font-bold text-orange-600 block">إضافات السلة</span>
            <span className="text-sm font-black text-orange-600">
              {signalsData.storeSummary.addToCartEvents?.toLocaleString() || 0}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface/80 border border-rose-500/25">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">سلات متروكة مرصودة</span>
            <span className="text-sm font-black text-rose-700 dark:text-rose-300">
              {signalsData.storeSummary.abandonedCartsCount?.toLocaleString() || 0}{' '}
              {signalsData.storeSummary.cartAbandonmentRate !== null && (
                <span className="text-[10px] font-normal text-ink-soft">
                  ({signalsData.storeSummary.cartAbandonmentRate}%)
                </span>
              )}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface/80 border border-emerald-500/25">
            <span className="text-[10px] font-bold text-emerald-600 block">طلبات مكتملة</span>
            <span className="text-sm font-black text-emerald-600">
              {signalsData.storeSummary.ordersCompleted?.toLocaleString() || 0}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface/80 border border-red-500/25 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-red-600 block">طلبات ملغاة / لم تكتمل</span>
            <span className="text-sm font-black text-red-600">
              {signalsData.storeSummary.ordersCancelled?.toLocaleString() || 0}{' '}
              {signalsData.storeSummary.orderCancellationRate !== null && (
                <span className="text-[10px] font-normal text-ink-soft">
                  ({signalsData.storeSummary.orderCancellationRate}%)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Strategy Selector Grid */}
      <div className="space-y-2 relative z-10">
        <label className="block text-xs font-black text-ink">
          اختر الدلالة أو الاستراتيجية التسويقية المطلوبة للإعلان:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SIGNAL_OPTIONS.map((sig) => {
            const isPicked = selectedSignal === sig.id;
            const SigIcon = sig.icon;
            return (
              <button
                key={sig.id}
                type="button"
                onClick={() => setSelectedSignal(sig.id)}
                className={`p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-2 text-ink relative ${
                  isPicked
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-sm'
                    : 'border-line bg-surface hover:bg-paper'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-xl bg-gradient-to-r ${sig.color} text-white flex items-center justify-center shrink-0 shadow-xs`}
                    >
                      <SigIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-black text-ink">{sig.shortLabel}</span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-paper border border-line text-ink-soft shrink-0">
                    {sig.badge}
                  </span>
                </div>
                <p className="text-[11px] text-ink-soft leading-relaxed">{sig.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Options & Action Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-ink-soft">عدد المنتجات للإعلان:</label>
            <select
              value={productCount}
              onChange={(e) => setProductCount(e.target.value)}
              className="bg-paper border border-line rounded-btn px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-primary"
            >
              <option value="auto">تلقائي ذكي (1 إلى 3 منتجات)</option>
              <option value="1">منتج واحد رئيسي (Single Hero)</option>
              <option value="2">منتجان معاً (Duo Offer)</option>
              <option value="3">3 منتجات (باكدج عرض التوفير)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-ink-soft">فترة تحليل النشاط:</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-paper border border-line rounded-btn px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-primary"
            >
              <option value="30d">آخر 30 يوماً</option>
              <option value="7d">آخر 7 أيام (سريع وحالي)</option>
              <option value="90d">آخر 3 أشهر (عينة أوسع)</option>
            </select>
          </div>
        </div>

        {/* Generate Smart Campaign Primary Button */}
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateCampaign}
          className="px-6 py-3.5 rounded-btn bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer active:scale-98"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري تحليل الدلالات واختيار المنتجات وكتابة الإعلان وتجهيز البوستر...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-orange-300 fill-amber-300" />
              <span>اقترح المنتجات وجهّز الإعلان الكامل الآن بالذكاء الاصطناعي 🚀</span>
            </>
          )}
        </button>
      </div>

      {/* Last Generated Strategy Rationale Banner */}
      {lastResultStrategy && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 space-y-2.5 relative z-10 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                تم اختيار المنتجات وصياغة الإعلان بالكامل بناءً على دلالة «
                {lastResultStrategy.signalLabel}» بنجاح!
              </span>
            </div>
            <span className="text-[11px] font-bold text-ink-soft">
              الإعلان جاهز في الاستوديو بالأسفل ومتاح للتعديل أو النشر المباشر
            </span>
          </div>

          <p className="text-xs text-ink leading-relaxed font-bold bg-surface/80 p-3 rounded-xl border border-line">
            💡 <strong>تفسير الذكاء الاصطناعي لاختيار المنتجات وزاوية الإعلان:</strong>{' '}
            {lastResultStrategy.strategySummary}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-black text-ink-soft">المنتجات المختارة في الإعلان:</span>
            {lastResultStrategy.selectedProducts.map((p) => (
              <span
                key={p._id}
                className="px-2.5 py-1 rounded-lg bg-surface border border-line text-xs font-black text-ink flex items-center gap-1.5 shadow-xs"
              >
                <span>{p.name}</span>
                <span className="text-primary font-bold">({p.price} {currency})</span>
                {p.signalBadge && (
                  <span className="text-[10px] font-normal text-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                    {p.signalBadge}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Signals Candidates Details Drawer */}
      {showSignalsDetails && (
        <div className="p-4 rounded-2xl bg-paper border border-line space-y-3 relative z-10 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-ink flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>
                أبرز المنتجات المرشحة حالياً لدلالة «{currentSignalObj.shortLabel}» ({currentBucketCandidates.length} منتج)
              </span>
            </h5>
            <span className="text-[11px] text-ink-soft">
              مرتبة حسب الأولوية الإعلانية وحجم النشاط
            </span>
          </div>

          {loadingSignals ? (
            <div className="p-6 text-center text-xs text-ink-soft flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>جاري استخراج وتحليل بيانات النشاط...</span>
            </div>
          ) : currentBucketCandidates.length === 0 ? (
            <div className="p-4 text-center text-xs text-ink-soft">
              لا توجد منتجات مسجلة لهذه الدلالة في الفترة المحددة ({range}).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentBucketCandidates.slice(0, 6).map((c) => (
                <div
                  key={c.productId}
                  className="p-3 rounded-xl bg-surface border border-line space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={c.image || 'https://via.placeholder.com/64'}
                      alt={c.name}
                      className="w-12 h-12 rounded-lg object-cover border border-line shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h6 className="text-xs font-black text-ink truncate">{c.name}</h6>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-bold text-primary">
                          {c.price} {currency}
                        </span>
                        <span className="text-[10px] text-ink-soft">
                          المخزون: <strong>{c.stockCount}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-ink-soft leading-snug line-clamp-2 bg-paper/80 p-2 rounded-lg border border-line">
                    {c.signalReasonAr}
                  </p>

                  <div className="flex flex-wrap gap-1 text-[10px] font-bold text-ink-soft pt-1 border-t border-line">
                    <span className="px-1.5 py-0.5 rounded bg-paper border border-line">
                      👀 {c.views} مشاهدة
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-700 border border-orange-500/20">
                      🛒 {c.cartAdditions} سلة
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                      ✅ {c.unitsSold} مبيعات
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
