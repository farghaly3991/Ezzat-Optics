import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import { exportMarketReportPdf } from './exportMarketReportPdf';
import {
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Tag,
  Building2,
  DollarSign,
  BarChart3
} from 'lucide-react';

export default function AdminMarketComparisonModal({
  product,
  isOpen,
  onClose,
  onPriceUpdated
}) {
  const { token, config, showToast } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [applyingPrice, setApplyingPrice] = useState(false);
  const [priceAppliedSuccess, setPriceAppliedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && product?._id) {
      fetchAnalysis();
    } else {
      setAnalysis(null);
      setError('');
      setPriceAppliedSuccess(false);
    }
  }, [isOpen, product?._id]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    setPriceAppliedSuccess(false);
    try {
      const res = await axios.get(`/api/admin/market-intel/compare/${product._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.analysis) {
        setAnalysis(res.data.analysis);
      } else {
        setError('تعذر استخراج بيانات التحليل من الخادم.');
      }
    } catch (err) {
      console.error('Market analysis fetch error:', err);
      setError(err.response?.data?.error || 'فشل الاتصال بمحرك تحليل السوق.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPrice = async () => {
    const recommended = analysis?.strategicAnalysis?.recommendedPrice;
    if (!recommended || recommended <= 0) return;

    setApplyingPrice(true);
    try {
      const res = await axios.post(
        `/api/admin/market-intel/apply-price/${product._id}`,
        { newPrice: recommended },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.done) {
        setPriceAppliedSuccess(true);
        if (showToast) {
          showToast(`تم تطبيق السعر المقترح (${recommended.toLocaleString()} ج.م) بنجاح!`, 'success');
        }
        if (onPriceUpdated) {
          onPriceUpdated(product._id, recommended);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'فشل تطبيق السعر الجديد';
      if (showToast) showToast(msg, 'error');
    } finally {
      setApplyingPrice(false);
    }
  };

  const handleExportPdf = () => {
    if (!analysis) return;
    exportMarketReportPdf(analysis, config, showToast);
  };

  if (!isOpen || !product) return null;

  const currency = config?.currency || 'ج.م';
  const prod = analysis?.product || product;
  const overview = analysis?.marketOverview || {};
  const strategic = analysis?.strategicAnalysis || {};
  const competitors = analysis?.competitors || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-surface text-ink rounded-3xl shadow-2xl border border-line flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-primary text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-ink">
                  تحليل ومقارنة أسعار السوق بالذكاء الاصطناعي
                </h3>
                <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  AI Market Intel
                </span>
              </div>
              <p className="text-xs text-ink-soft">
                فحص أسعار المنافسين وحساب درجات التشابه وتقديم توصيات التسعير الاستراتيجية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-ink-soft hover:text-ink hover:bg-paper rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Product Banner */}
          <div className="p-4 rounded-2xl bg-paper border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {product.categoryId?.name || 'قسم عام'}
              </span>
              <h4 className="text-base font-black text-ink line-clamp-1">{product.name}</h4>
              <div className="flex items-center gap-4 text-xs text-ink-soft">
                <span>
                  سعرك الحالي: <strong className="text-ink font-mono">{Number(product.price).toLocaleString()} {currency}</strong>
                </span>
                {product.costPrice ? (
                  <span>
                    سعر التكلفة: <strong className="text-ink font-mono">{Number(product.costPrice).toLocaleString()} {currency}</strong>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading || !analysis}
                className="bg-paper hover:bg-line text-ink border border-line px-3.5 py-2 rounded-btn text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                title="طباعة التقرير كـ PDF"
              >
                <Printer className="w-4 h-4 text-primary" />
                <span>طباعة PDF</span>
              </button>
              <button
                type="button"
                onClick={fetchAnalysis}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] px-3.5 py-2 rounded-btn text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'جاري الفحص...' : 'إعادة الفحص'}</span>
              </button>
            </div>
          </div>

          {/* Transparency & Source of Data Notice */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row items-start gap-3 text-xs leading-relaxed shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="font-black text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-2">
                <span>شفافية ومصدر بيانات تحليل أسعار السوق</span>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  AI Market Intel & Web Grounding
                </span>
              </h5>
              <p className="text-ink-soft text-[11px] leading-relaxed">
                تُستخرج هذه الأسعار والتوصيات عبر نماذج الذكاء الاصطناعي بناءً على رصد وتحليل متوسطات أسعار السلع المماثلة والمتطابقة في السوق المصري والمتاجر الكبرى (أمازون مصر، نون، بي تك، جوميا).
                نظراً لتغير أسعار المتاجر اللحظي وسياسات حماية المنصات ضد السحب الآلي، زِر <strong>(استعلام بالمتجر)</strong> في الجدول أدناه يفتح لك استعلاماً بحثياً حياً في المنصة المعنية للتأكد بنفسك من المخزون والأسعار المعروضة حالياً.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent animate-spin flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-ink">جاري مسح وتحليل السوق بالذكاء الاصطناعي...</h4>
                <p className="text-xs text-ink-soft mt-1">
                  نبحث في كبرى المتاجر الإلكترونية، ونطابق المواصفات ونحسب درجات التشابه بدقة
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="p-6 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto" />
              <div className="font-bold text-sm">{error}</div>
              <button
                type="button"
                onClick={fetchAnalysis}
                className="bg-red-500 text-white px-4 py-1.5 rounded-btn text-xs font-bold hover:bg-red-600 transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Analysis Results Content */}
          {!loading && !error && analysis && (
            <div className="space-y-6 animate-in fade-in">
              {/* Metric Highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-paper border border-line text-center space-y-1">
                  <span className="text-[11px] font-bold text-ink-soft">متوسط سعر السوق</span>
                  <div className="text-lg font-black text-ink font-mono">
                    {Number(overview.averagePrice || 0).toLocaleString()} {currency}
                  </div>
                  <span className="text-[10px] text-ink-soft block">
                    {overview.priceDeltaPercent > 0
                      ? `سعرك أعلى بـ ${overview.priceDeltaPercent}%`
                      : overview.priceDeltaPercent < 0
                      ? `سعرك أرخص بـ ${Math.abs(overview.priceDeltaPercent)}%`
                      : 'مطابق للمتوسط'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1">
                  <span className="text-[11px] font-bold text-emerald-600">أقل سعر منافس</span>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    {Number(overview.minPrice || 0).toLocaleString()} {currency}
                  </div>
                  <span className="text-[10px] text-emerald-600/80 block">أفضل صفقة معلنة بالسوق</span>
                </div>

                <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-center space-y-1">
                  <span className="text-[11px] font-bold text-orange-600">أعلى سعر منافس</span>
                  <div className="text-lg font-black text-orange-700 dark:text-orange-400 font-mono">
                    {Number(overview.maxPrice || 0).toLocaleString()} {currency}
                  </div>
                  <span className="text-[10px] text-orange-600/80 block">السقف السعري للمنتج</span>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-center space-y-1">
                  <span className="text-[11px] font-bold text-indigo-600">السعر المقترح من AI</span>
                  <div className="text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono">
                    {Number(strategic.recommendedPrice || product.price).toLocaleString()} {currency}
                  </div>
                  <span className="text-[10px] text-indigo-600/80 block">لأعلى مبيعات وأفضل هامش</span>
                </div>
              </div>

              {/* Strategic Pricing Action Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                      التوصية الاستراتيجية للتسعير الذكي:
                    </span>
                    <span className="text-xs font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      {Number(strategic.recommendedPrice || product.price).toLocaleString()} {currency}
                    </span>
                  </div>
                  <p className="text-xs text-ink leading-relaxed">
                    {strategic.pricingRationale}
                  </p>
                  {strategic.potentialMarginImpact && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      💡 {strategic.potentialMarginImpact}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyPrice}
                    disabled={applyingPrice || priceAppliedSuccess}
                    className={`px-5 py-2.5 rounded-btn text-xs font-black flex items-center gap-2 transition-all shadow-md ${
                      priceAppliedSuccess
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 disabled:opacity-50'
                    }`}
                  >
                    {priceAppliedSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم تطبيق السعر بنجاح</span>
                      </>
                    ) : (
                      <>
                        <Tag className="w-4 h-4" />
                        <span>{applyingPrice ? 'جاري التطبيق...' : 'تطبيق السعر المقترح الآن'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Competitors Comparison Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-ink flex items-center gap-2">
                    <span>المنتجات الشبيهة والمنافسة في السوق</span>
                    <span className="text-xs text-ink-soft font-normal">
                      (مرتبة تنازلياً حسب درجة التطابق)
                    </span>
                  </h4>
                  <span className="text-xs font-bold text-ink-soft">
                    {competitors.length} خيارات مرصودة
                  </span>
                </div>

                <div className="border border-line rounded-2xl overflow-hidden bg-surface">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                        <tr>
                          <th className="p-3 w-10 text-center">#</th>
                          <th className="p-3">المنتج المنافس</th>
                          <th className="p-3">المتجر</th>
                          <th className="p-3">السعر</th>
                          <th className="p-3">الفارق عن سعرك</th>
                          <th className="p-3 text-center">درجة التطابق (Similarity)</th>
                          <th className="p-3 text-center">فحص العرض بالمتجر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {competitors.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="p-6 text-center text-ink-soft">
                              لم يتم العثور على منتجات منافسة مسجلة في هذا النطاق
                            </td>
                          </tr>
                        ) : (
                          competitors.map((comp, idx) => {
                            const isCheaper = comp.price < product.price;
                            const diffAmount = Math.abs(product.price - comp.price);
                            const simScore = comp.similarityScore || 75;

                            return (
                              <tr key={idx} className="hover:bg-paper/50 transition-colors">
                                <td className="p-3 text-center font-bold text-ink-soft">{idx + 1}</td>
                                <td className="p-3 font-bold text-ink">
                                  <div className="line-clamp-1">{comp.title}</div>
                                  {comp.matchingSpecs?.length > 0 && (
                                    <div className="text-[10px] text-ink-soft mt-0.5 font-normal line-clamp-1">
                                      مطابقة: {comp.matchingSpecs.join('، ')}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                                  {comp.storeName}
                                </td>
                                <td className="p-3 font-black text-ink font-mono whitespace-nowrap">
                                  {Number(comp.price).toLocaleString()} {currency}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  {comp.price === product.price ? (
                                    <span className="text-ink-soft font-bold">مطابق لسعرك</span>
                                  ) : isCheaper ? (
                                    <span className="text-red-500 font-bold flex items-center gap-1">
                                      <TrendingDown className="w-3.5 h-3.5" />
                                      أرخص بـ {diffAmount.toLocaleString()} {currency}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                      <TrendingUp className="w-3.5 h-3.5" />
                                      أغلى بـ {diffAmount.toLocaleString()} {currency}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="inline-flex items-center gap-2">
                                    <div className="w-16 h-2 rounded-full bg-paper border border-line overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          simScore >= 90
                                            ? 'bg-emerald-500'
                                            : simScore >= 75
                                            ? 'bg-indigo-500'
                                            : 'bg-orange-500'
                                        }`}
                                        style={{ width: `${simScore}%` }}
                                      />
                                    </div>
                                    <span
                                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                        simScore >= 90
                                          ? 'bg-emerald-500/15 text-emerald-600'
                                          : simScore >= 75
                                          ? 'bg-indigo-500/15 text-indigo-600'
                                          : 'bg-orange-500/15 text-orange-600'
                                      }`}
                                    >
                                      {simScore}%
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {comp.url ? (
                                    <a
                                      href={comp.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-paper hover:bg-primary/10 text-primary border border-line text-[11px] font-bold transition-all shadow-xs"
                                      title={`فتح استعلام بحث حي عن هذا المنتج في متجر ${comp.storeName}`}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>استعلام بالمتجر</span>
                                    </a>
                                  ) : (
                                    <span className="text-ink-soft text-[11px]">تقدير تحليلي</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="text-[11px] text-ink-soft flex items-center gap-1.5 px-1 font-medium">
                  <span>💡</span>
                  <span>
                    زر <strong>(استعلام بالمتجر)</strong> ينقلك مباشرة للبحث في المتجر المعني لتتمكن من مراجعة أحدث الأسعار والتأكد من توافر المنتج لحظياً.
                  </span>
                </div>
              </div>

              {/* Insights and Strategic Tips Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-paper border border-line space-y-2">
                  <h5 className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    نقاط القوة والميزات التنافسية لمتجرك
                  </h5>
                  <ul className="space-y-1.5 text-xs text-ink-soft">
                    {(strategic.keyAdvantages || []).map((adv, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">✔</span>
                        <span>{adv}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-paper border border-line space-y-2">
                  <h5 className="text-xs font-black text-orange-600 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    التحديات والنقاط الواجب مراعاتها
                  </h5>
                  <ul className="space-y-1.5 text-xs text-ink-soft">
                    {(strategic.keyVulnerabilities || []).map((v, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold">⚠️</span>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actionable Tips */}
              {strategic.actionableTips?.length > 0 && (
                <div className="p-4 rounded-2xl bg-paper border border-line space-y-2">
                  <h5 className="text-xs font-black text-indigo-600 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    خطوات تنفيذية فورية لزيادة مبيعات هذا المنتج
                  </h5>
                  <ul className="space-y-1 text-xs text-ink">
                    {strategic.actionableTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-indigo-500 font-black">•</span>
                        <span className="font-medium">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-line bg-paper/50 shrink-0">
          <div className="text-[11px] text-ink-soft">
            {analysis?.generatedAt
              ? `آخر تحديث للتحليل: ${new Date(analysis.generatedAt).toLocaleTimeString('ar-EG')}`
              : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || !analysis}
              className="bg-paper hover:bg-line text-ink border border-line px-4 py-2 rounded-btn text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>طباعة تقرير PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-paper hover:bg-line text-ink px-4 py-2 rounded-btn text-xs font-bold transition-all"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
