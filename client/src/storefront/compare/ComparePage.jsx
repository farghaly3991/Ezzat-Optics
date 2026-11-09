import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Scale,
  Sparkles,
  ShoppingBag,
  Trash2,
  Check,
  Star,
  ExternalLink,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Trophy,
  Award,
  Crown
} from 'lucide-react';
import { useStore } from '../../shared/context/StoreContext';
import PageLoader from '../../shared/components/PageLoader';

/**
 * Helper to parse a spec string or number into a comparable numerical value and unit.
 * E.g.: "6GB" -> 6, "128 جيجابايت" -> 128, "5000 mAh" -> 5000, "1.5 حصان" -> 1.5, "6.7 بوصة" -> 6.7
 */
function parseSpecNumber(val) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return null;

  const clean = val.trim();
  // Check for TB vs GB
  if (/(\d+(?:\.\d+)?)\s*(?:TB|تيرابايت)/i.test(clean)) {
    const match = clean.match(/(\d+(?:\.\d+)?)\s*(?:TB|تيرابايت)/i);
    return parseFloat(match[1]) * 1024;
  }
  // Check for numbers followed by common metrics
  const numMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  return null;
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    comparisonIds,
    setComparisonIds,
    removeFromComparison,
    clearComparison,
    addToCart,
    openAiComparisonChat,
    config
  } = useStore();

  const [products, setProducts] = useState([]);
  const [commonSpecs, setCommonSpecs] = useState([]);
  const [specsMatrix, setSpecsMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Extract IDs from URL search params or fallback to global context comparisonIds
  const urlIds = searchParams.get('ids');
  const activeIds = urlIds
    ? urlIds.split(',').map((id) => id.trim()).filter(Boolean)
    : comparisonIds;

  useEffect(() => {
    if (!activeIds || activeIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    axios
      .get(`/api/store-public/compare?ids=${activeIds.join(',')}`)
      .then((res) => {
        if (res.data?.products && res.data.products.length > 0) {
          const returnedProds = res.data.products;
          setProducts(returnedProds);
          setCommonSpecs(res.data.commonSpecs || []);
          setSpecsMatrix(res.data.specsMatrix || {});

          // Auto-sync comparisonIds with the real valid returned product IDs
          const validIds = returnedProds.map((p) => String(p._id));
          if (comparisonIds.length > 0 && comparisonIds.some((id) => !validIds.includes(String(id)))) {
            const cleaned = comparisonIds.filter((id) => validIds.includes(String(id)));
            if (typeof setComparisonIds === 'function') {
              setComparisonIds(cleaned);
            }
          }
        } else {
          setProducts([]);
        }
      })
      .catch((err) => {
        console.warn('Failed to load comparison data:', err.response?.data || err.message);
        if (err.response?.status === 404 || err.response?.status === 400) {
          // IDs in comparison list no longer exist in the store: reset comparison
          clearComparison();
          setSearchParams({});
          setProducts([]);
          setError('');
        } else {
          setError('تعذر تحميل بيانات مقارنة المنتجات.');
        }
      })
      .finally(() => setLoading(false));
  }, [urlIds, comparisonIds.join(',')]);

  // Clean ghost comparison IDs when products list is empty
  useEffect(() => {
    if (!loading && products.length === 0 && comparisonIds.length > 0 && !urlIds) {
      clearComparison();
    }
  }, [loading, products.length, comparisonIds.length, urlIds]);

  const handleRemoveProduct = (productId) => {
    const idStr = String(productId);
    const nextIds = activeIds.filter((id) => id !== idStr);
    removeFromComparison(productId);
    if (nextIds.length > 0) {
      setSearchParams({ ids: nextIds.join(',') });
    } else {
      clearComparison();
      setSearchParams({});
      setProducts([]);
    }
  };

  /**
   * When user clicks "استشارة الذكاء الاصطناعي في هذه المقارنة":
   * We open the AI Chat in "compare_consult" mode with the preloaded products.
   * NO automatic query or unrelated search is performed; the chat shows the greeting and waits for user's question!
   */
  const handleAskAiAboutComparison = () => {
    if (products.length === 0) return;
    openAiComparisonChat({
      products,
      commonSpecs,
      specsMatrix
    });
  };

  // -------------------------------------------------------------
  // INTELLIGENT SPEC-BY-SPEC SCORING SYSTEM (The Better-in-Row Engine)
  // -------------------------------------------------------------
  const { rowWinners, productScores, overallWinnerId } = useMemo(() => {
    if (products.length < 2) {
      return { rowWinners: {}, productScores: {}, overallWinnerId: null };
    }

    const scores = {};
    products.forEach((p) => {
      scores[String(p._id)] = 0;
    });

    const winners = {}; // specRowKey -> Set of winning product IDs

    // 1. Price Criterion (Lower is better)
    const validPrices = products.filter((p) => p.price > 0);
    if (validPrices.length > 1) {
      const minPrice = Math.min(...validPrices.map((p) => p.price));
      const priceWinners = validPrices.filter((p) => p.price === minPrice).map((p) => String(p._id));
      if (priceWinners.length < products.length) {
        winners['__price__'] = new Set(priceWinners);
        priceWinners.forEach((id) => {
          scores[id] = (scores[id] || 0) + 1;
        });
      }
    }

    // 2. Rating Criterion (Higher is better)
    const validRatings = products.filter((p) => (p.ratingAvg || 0) > 0);
    if (validRatings.length > 1) {
      const maxRating = Math.max(...validRatings.map((p) => p.ratingAvg));
      const ratingWinners = validRatings.filter((p) => p.ratingAvg === maxRating).map((p) => String(p._id));
      if (ratingWinners.length < products.length) {
        winners['__rating__'] = new Set(ratingWinners);
        ratingWinners.forEach((id) => {
          scores[id] = (scores[id] || 0) + 1;
        });
      }
    }

    // 3. Dynamic Specs Criteria
    commonSpecs.forEach((specKey) => {
      const lowerKey = specKey.toLowerCase();
      // Determine if Higher is better or Lower is better
      const isHigherBetter =
        lowerKey.includes('رام') ||
        lowerKey.includes('ذاكرة') ||
        lowerKey.includes('تخزين') ||
        lowerKey.includes('بطارية') ||
        lowerKey.includes('شاشة') ||
        lowerKey.includes('قدرة') ||
        lowerKey.includes('حصان') ||
        lowerKey.includes('ضمان') ||
        lowerKey.includes('سعة') ||
        lowerKey.includes('وات') ||
        lowerKey.includes('watt') ||
        lowerKey.includes('mah') ||
        lowerKey.includes('ram');

      const isLowerBetter =
        lowerKey.includes('وزن') ||
        lowerKey.includes('سعر') ||
        lowerKey.includes('استهلاك');

      if (!isHigherBetter && !isLowerBetter) {
        return; // Textual attribute like color, brand, or model where "better" is subjective
      }

      // Parse numerical values across all products
      const parsedValues = products.map((p) => {
        const raw = specsMatrix[specKey]?.[String(p._id)];
        return {
          id: String(p._id),
          num: parseSpecNumber(raw),
          raw
        };
      });

      const validParsed = parsedValues.filter((v) => v.num !== null && !isNaN(v.num));
      if (validParsed.length >= 2) {
        let bestTarget = null;
        if (isHigherBetter) {
          bestTarget = Math.max(...validParsed.map((v) => v.num));
        } else if (isLowerBetter) {
          bestTarget = Math.min(...validParsed.map((v) => v.num));
        }

        if (bestTarget !== null) {
          const specWinners = validParsed.filter((v) => v.num === bestTarget).map((v) => v.id);
          // If not everyone has the same value, reward the winner(s)
          if (specWinners.length < products.length) {
            winners[specKey] = new Set(specWinners);
            specWinners.forEach((id) => {
              scores[id] = (scores[id] || 0) + 1;
            });
          }
        }
      }
    });

    // Determine overall leader
    let topScore = -1;
    let leaderId = null;
    let tie = false;

    Object.entries(scores).forEach(([id, sc]) => {
      if (sc > topScore) {
        topScore = sc;
        leaderId = id;
        tie = false;
      } else if (sc === topScore && topScore > 0) {
        tie = true;
      }
    });

    return {
      rowWinners: winners,
      productScores: scores,
      overallWinnerId: tie ? null : leaderId
    };
  }, [products, commonSpecs, specsMatrix]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in text-ink">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-ink-soft mb-1">
            <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <Link to="/catalog" className="hover:text-primary transition-colors">الكتالوج</Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="text-primary font-black">مقارنة المنتجات</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-ink flex items-center gap-3">
            <Scale className="w-7 h-7 text-primary" />
            <span>مقارنة المنتجات والمواصفات الشاملة</span>
          </h1>
        </div>

        {products.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAskAiAboutComparison}
              className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-black text-xs px-4 py-2.5 rounded-btn shadow-md flex items-center gap-2 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4" />
              <span>استشارة الذكاء الاصطناعي في هذه المقارنة</span>
            </button>

            <button
              onClick={() => {
                clearComparison();
                setSearchParams({});
                setProducts([]);
              }}
              className="p-2.5 text-ink-soft hover:text-red-500 hover:bg-red-500/10 rounded-btn transition-colors"
              title="مسح المقارنة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="text-center py-20 px-4 bg-surface rounded-3xl border border-line shadow-sm space-y-5 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-2xl font-black">
            <Scale className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-ink">لا توجد منتجات محددة للمقارنة</h3>
            <p className="text-xs sm:text-sm text-ink-soft font-medium">
              يمكنك استعراض الكتالوج واختيار منتجين للمقارنة، أو طلب المساعدة من المساعد الذكي لمقارنة أي أجهزة فوراً.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/catalog"
              className="px-6 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black text-xs shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>تصفح المنتجات في الكتالوج</span>
            </Link>

            {comparisonIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearComparison();
                  setSearchParams({});
                  setProducts([]);
                }}
                className="px-5 py-2.5 rounded-btn bg-paper hover:bg-surface border border-line text-xs font-bold text-ink transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>تصفير وتفريغ قائمة المقارنة ({comparisonIds.length})</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Products Header Row Cards with Total Score Counter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((prod) => {
              const prodIdStr = String(prod._id);
              const score = productScores[prodIdStr] || 0;
              const isOverallWinner = prodIdStr === overallWinnerId && score > 0;

              return (
                <div
                  key={prod._id}
                  className={`p-5 rounded-3xl bg-surface border transition-all flex flex-col justify-between space-y-4 relative shadow-sm hover:shadow-xl ${
                    isOverallWinner
                      ? 'border-orange-400 ring-2 ring-amber-400/30 bg-gradient-to-b from-orange-500/5 to-surface'
                      : 'border-line'
                  }`}
                >
                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveProduct(prod._id)}
                    className="absolute top-3 left-3 p-1.5 rounded-full bg-paper hover:bg-red-500 hover:text-white text-ink-soft transition-colors shadow-sm z-10"
                    title="إزالة من المقارنة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Leader Badge */}
                  {isOverallWinner && (
                    <span className="absolute top-3 right-3 text-[10px] font-black px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md flex items-center gap-1 z-10">
                      <Crown className="w-3.5 h-3.5 text-amber-100 fill-amber-300" />
                      <span>متصدر نقاط التفضيل</span>
                    </span>
                  )}

                  <div className="space-y-3 pt-4">
                    <div className="relative">
                      <img
                        src={prod.images?.[0] || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                        alt={prod.name}
                        className="w-full h-44 rounded-2xl object-cover bg-paper border border-line"
                      />

                      {/* Score Box Banner on Product Card */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 rounded-xl bg-surface/90 backdrop-blur-md border border-line shadow-sm">
                        <span className="text-[11px] font-bold text-ink-soft">نقاط التفوق:</span>
                        <div className="flex items-center gap-1">
                          <Trophy className={`w-3.5 h-3.5 ${score > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
                          <span className="text-xs font-black text-ink">{score} نقاط تفوق</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {prod.categoryId?.name || 'عام'}
                      </span>
                      <h4 className="text-sm font-black text-ink mt-1.5 line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                    </div>

                    {/* Price Block */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-primary">
                        {prod.price?.toLocaleString()} {config?.currency || 'ج.م'}
                      </span>
                      {prod.oldPrice > prod.price && (
                        <span className="text-xs text-ink-soft line-through">
                          {prod.oldPrice?.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Ratings */}
                    <div className="flex items-center gap-1.5 text-xs text-orange-500 font-bold">
                      <Star className="w-4 h-4 fill-amber-400 text-orange-400" />
                      <span>{prod.ratingAvg || 0}</span>
                      <span className="text-ink-soft text-[11px]">({prod.ratingCount || 0} تقييم)</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2 border-t border-line">
                    <button
                      onClick={() => addToCart(prod, 1)}
                      className="w-full py-2.5 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>أضف إلى السلة</span>
                    </button>
                    <Link
                      to={`/product/${prod._id}`}
                      className="w-full py-2 rounded-btn bg-paper hover:bg-paper/80 text-ink font-bold text-xs transition-colors flex items-center justify-center gap-1 border border-line"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>صفحة المنتج</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison Table Matrix with Row Highlights */}
          <div className="rounded-3xl bg-surface border border-line shadow-sm overflow-hidden">
            <div className="p-5 border-b border-line bg-paper/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-ink flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  <span>جدول المقارنة التفصيلية للمواصفات ونقاط القوة</span>
                </h3>
                <p className="text-[11px] text-ink-soft font-medium mt-0.5">
                  تم وضع علامة التميز 🏅 تلقائياً على كل مواصفة يتفوق فيها الجهاز على منافسيه.
                </p>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                {commonSpecs.length + 3} معايير مقارنة نشطة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper/30 font-black text-ink">
                    <th className="p-4 w-48 font-black text-ink-soft">المعيار / المواصفة</th>
                    {products.map((p) => {
                      const isWinner = String(p._id) === overallWinnerId;
                      return (
                        <th key={p._id} className="p-4 font-black">
                          <div className="flex items-center gap-1.5">
                            {isWinner && <Crown className="w-4 h-4 text-orange-500 fill-amber-500 shrink-0" />}
                            <span className="truncate">{p.name}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium">
                  {/* Summary Score Row */}
                  <tr className="bg-orange-500/5 font-black">
                    <td className="p-4 font-black text-orange-700 dark:text-orange-400 bg-orange-500/10 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-orange-500" />
                      <span>إجمالي نقاط التفوق</span>
                    </td>
                    {products.map((p) => {
                      const sc = productScores[String(p._id)] || 0;
                      const isWinner = String(p._id) === overallWinnerId && sc > 0;
                      return (
                        <td key={p._id} className="p-4 font-black">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm px-2.5 py-1 rounded-lg font-black ${
                              isWinner
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-paper text-ink border border-line'
                            }`}>
                              {sc} نقطة
                            </span>
                            {isWinner && (
                              <span className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5">
                                <Award className="w-3.5 h-3.5" /> الأفضل إجمالاً
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Price Row */}
                  <tr className="hover:bg-paper/30 transition-colors">
                    <td className="p-4 font-black text-ink-soft bg-paper/20">السعر النهائي</td>
                    {products.map((p) => {
                      const isWin = rowWinners['__price__']?.has(String(p._id));
                      return (
                        <td key={p._id} className={`p-4 font-black text-sm ${isWin ? 'bg-emerald-500/5' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-black">
                              {p.price?.toLocaleString()} {config?.currency || 'ج.م'}
                            </span>
                            {isWin && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                                <Zap className="w-3 h-3" /> السعر الأوفر 🏅
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Stock Status */}
                  <tr className="hover:bg-paper/30 transition-colors">
                    <td className="p-4 font-black text-ink-soft bg-paper/20">حالة التوفر بالمخزون</td>
                    {products.map((p) => (
                      <td key={p._id} className="p-4">
                        {p.stockCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <Check className="w-3.5 h-3.5" /> متوفر ({p.stockCount} قطعة)
                          </span>
                        ) : (
                          <span className="text-red-500 font-bold">نفذت الكمية</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Rating */}
                  <tr className="hover:bg-paper/30 transition-colors">
                    <td className="p-4 font-black text-ink-soft bg-paper/20">التقييم العام</td>
                    {products.map((p) => {
                      const isWin = rowWinners['__rating__']?.has(String(p._id));
                      return (
                        <td key={p._id} className={`p-4 font-bold ${isWin ? 'bg-orange-500/5' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-orange-500 font-black">
                              ★ {p.ratingAvg || 0} / 5
                            </span>
                            <span className="text-ink-soft text-[11px]">({p.ratingCount || 0} تقييم)</span>
                            {isWin && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/30 flex items-center gap-1">
                                الأعلى تقييماً 🏅
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Dynamic Specs Rows */}
                  {commonSpecs.map((specKey) => {
                    const winSet = rowWinners[specKey];
                    return (
                      <tr key={specKey} className="hover:bg-paper/30 transition-colors">
                        <td className="p-4 font-black text-ink-soft bg-paper/20">{specKey}</td>
                        {products.map((p) => {
                          const val = specsMatrix[specKey]?.[String(p._id)] || 'غير محدد';
                          const isWin = winSet?.has(String(p._id));
                          return (
                            <td key={p._id} className={`p-4 font-bold text-ink ${isWin ? 'bg-emerald-500/5' : ''}`}>
                              <div className="flex items-center gap-2">
                                <span>{val}</span>
                                {isWin && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-0.5 shrink-0">
                                    تفوق 🏅
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Advice Bottom Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-primary/10 via-indigo-600/10 to-surface border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="space-y-1.5 text-right">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h4 className="text-lg font-black text-ink">
                  محتار في الاختيار بين هذه الأجهزة؟
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-ink-soft font-medium max-w-2xl leading-relaxed">
                اضغط لاستشارة المساعد الذكي؛ سيفتح معك الشات حاملاً بيانات هذه الأجهزة المحددة بدقة، وينتظر سؤالك تحديداً (سواء عن الاستخدام، الألعاب، الكاميرات أو القيمة مقابل السعر) ليساعدك في حسم قرارك مباشرة بدون تكرار البحث!
              </p>
            </div>

            <button
              onClick={handleAskAiAboutComparison}
              className="bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] px-6 py-3 rounded-btn font-black text-xs shadow-md transition-all flex items-center gap-2 shrink-0 hover:scale-105"
            >
              <Sparkles className="w-4 h-4" />
              <span>استشارة الذكاء الاصطناعي في هذه الأجهزة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
