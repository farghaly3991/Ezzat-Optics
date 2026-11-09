import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ShoppingBag,
  Heart,
  Star,
  CheckCircle2,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  MessageSquarePlus,
  Send,
  Bell,
  Wrench,
  Link2,
  Check,
  Layers,
  ExternalLink,
  Eye,
  Loader2,
  Store
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ProductCarousel from '../../shared/components/ProductCarousel';
import ProductCard from '../../shared/components/ProductCard';

export default function ProductDetailModal() {
  const navigate = useNavigate();
  const {
    activeProductModal,
    setActiveProductModal,
    config,
    cart,
    addToCart,
    toggleWishlist,
    isInWishlist,
    setIsCartOpen,
    trackProductView,
    submitPriceFeedback,
    togglePriceFeedback,
    hasPriceFeedback,
    user,
    openWaitlistModal
  } = useStore();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isSendingPriceFeedback, setIsSendingPriceFeedback] = useState(false);
  const [addedLinkedIds, setAddedLinkedIds] = useState([]);

  // Review Form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    if (!activeProductModal?._id) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setQuantity(1);
    axios
      .get(`/api/store-public/product/${activeProductModal._id}`)
      .then((res) => {
        setDetail(res.data);
      })
      .catch((err) => console.error('Failed to load product detail:', err))
      .finally(() => setLoading(false));
  }, [activeProductModal]);

  if (!activeProductModal) return null;

  const product = detail?.product || activeProductModal;
  const isService = product?.categoryId?.type === 'service' || product?.isService === true;
  const isOutOfStock = !isService && (product?.stockCount || 0) <= 0;
  const isAlreadyInCart =
    isService &&
    Array.isArray(cart) &&
    cart.some((it) => String(it.productId || it._id) === String(product?._id));
  const reviews = detail?.reviews || [];
  const related = detail?.related || [];
  const inWishlist = product?._id ? isInWishlist(product._id) : false;

  const siblings = Array.isArray(detail?.siblings) && detail.siblings.length > 1 ? detail.siblings : [];

  const variantAnalysis = React.useMemo(() => {
    if (!product || siblings.length <= 1) return { differingSpecs: [] };
    const allSpecKeys = new Set();
    siblings.forEach((s) => {
      Object.entries(s.specs || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') allSpecKeys.add(k);
      });
    });

    const differingSpecs = [];
    allSpecKeys.forEach((specKey) => {
      const valuesMap = new Map();
      siblings.forEach((s) => {
        const val = String(s.specs?.[specKey] || '').trim();
        if (!val) return;
        if (!valuesMap.has(val)) valuesMap.set(val, []);
        valuesMap.get(val).push(s);
      });

      if (valuesMap.size > 1) {
        const options = Array.from(valuesMap.entries()).map(([val, sibsWithVal]) => {
          const matchWithOtherCurrentSpecs = sibsWithVal.find((sib) => {
            return Object.entries(product.specs || {}).every(([k, v]) => {
              if (k === specKey) return true;
              return !sib.specs?.[k] || sib.specs[k] === v;
            });
          });
          const targetSibling = matchWithOtherCurrentSpecs || sibsWithVal[0];
          return {
            value: val,
            targetSibling,
            isSelected: String(product.specs?.[specKey] || '') === val,
            price: Number(targetSibling.price || 0),
            inStock: targetSibling.stockCount > 0,
            image: targetSibling.images?.[0] || null
          };
        });

        differingSpecs.push({
          specKey,
          label: specKey,
          options
        });
      }
    });

    return { differingSpecs };
  }, [product, siblings]);

  const handleSelectVariantSibling = (targetSibling) => {
    if (!targetSibling?._id || targetSibling._id === product._id) return;
    setDetail((prev) => ({
      ...prev,
      product: targetSibling
    }));
    trackProductView(targetSibling, true);
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    trackProductView(product);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    trackProductView(product);
    setActiveProductModal(null);
    setIsCartOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return;
    setIsSubmittingReview(true);
    try {
      await axios.post(`/api/store-public/review/${product._id}`, {
        rating,
        comment,
        username: user?.fullname || 'عميل المتجر'
      });
      const res = await axios.get(`/api/store-public/product/${product._id}?skipTrack=1`);
      setDetail(res.data);
      setComment('');
      setRating(5);
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in">
      <div
        style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
        className="relative w-full max-w-full sm:max-w-5xl rounded-t-3xl sm:rounded-card shadow-2xl overflow-hidden border border-line my-0 sm:my-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Close Button */}
        <div
          style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
          className="p-3.5 sm:p-5 border-b border-line flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-btn truncate">
              {product.categoryId?.name || 'تفاصيل المنتج'}
            </span>
            {product.stockCount > 0 ? (
              <span className="text-[11px] sm:text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-btn flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> متوفر ({product.stockCount})
              </span>
            ) : (
              <span className="text-[11px] sm:text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-btn shrink-0">
                نفد من المخزون
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {product?._id && (
              <button
                type="button"
                onClick={() => {
                  const targetId = product._id;
                  setActiveProductModal(null);
                  navigate(`/product/${targetId}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-paper hover:bg-surface text-ink font-bold text-xs border border-line transition-all hover:border-primary/40"
                title="فتح صفحة المنتج الكاملة"
              >
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">صفحة المنتج الكاملة</span>
              </button>
            )}

            <button
              onClick={() => setActiveProductModal(null)}
              className="p-1.5 sm:p-2 rounded-btn hover:bg-paper text-ink-soft hover:text-ink border border-transparent hover:border-line transition-colors shrink-0"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 flex-1 min-h-0 relative">
          {loading && !detail && (
            <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs font-bold text-ink-soft">جاري تحميل تفاصيل المنتج والمواصفات...</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Left: Product Images Carousel */}
            <div>
              <ProductCarousel images={product.images} alt={product.name} />
            </div>

            {/* Right: Info & Purchase Controls */}
            <div className="space-y-5 sm:space-y-6">
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-ink leading-snug mb-2">
                  {product.name}
                </h2>

                {/* Rating & Stats */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-ink-soft flex-wrap">
                  <div className="flex items-center gap-1 text-orange-900 dark:text-orange-200 font-extrabold bg-orange-500/15 border border-orange-500/40 px-2 py-0.5 rounded-lg">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 fill-amber-400" />
                    <span>{product.ratingAvg ? product.ratingAvg.toFixed(1) : 'جديد'}</span>
                  </div>
                  <span>•</span>
                  <span>{product.ratingCount || 0} تقييم</span>
                  <span>•</span>
                  <span>{product.visited || 0} مشاهدة</span>
                </div>
              </div>

              {/* Price Box */}
              <div className="p-3.5 sm:p-4 rounded-card bg-paper border border-line flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                  <span className="text-xl sm:text-3xl font-black text-ink">
                    {product.price?.toLocaleString()} {config?.currency || 'ج.م'}
                  </span>
                  {product.oldPrice > product.price && (
                    <>
                      <span className="text-sm sm:text-base text-ink-soft line-through">
                        {product.oldPrice?.toLocaleString()} {config?.currency || 'ج.م'}
                      </span>
                      <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[11px] sm:text-xs font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-btn">
                        وفرت {(product.oldPrice - product.price)?.toLocaleString()} {config?.currency || 'ج.م'}
                      </span>
                    </>
                  )}
                </div>

                {(() => {
                  const isReported = hasPriceFeedback(product._id);
                  return (
                    <button
                      type="button"
                      disabled={isSendingPriceFeedback}
                      onClick={async () => {
                        setIsSendingPriceFeedback(true);
                        await togglePriceFeedback(product._id);
                        setIsSendingPriceFeedback(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm ${
                        isReported
                          ? 'bg-orange-500/20 text-orange-950 dark:text-orange-100 border-2 border-orange-600 dark:border-orange-400 font-black'
                          : 'bg-surface hover:bg-orange-500/10 text-ink-soft hover:text-orange-900 dark:hover:text-orange-200 border border-line hover:border-orange-500/40'
                      }`}
                      title={isReported ? 'اضغط لإلغاء الملاحظة' : 'أرسل ملاحظة للمتجر بأن السعر مرتفع'}
                    >
                      <span>{isReported ? '✓' : '💬'}</span>
                      <span>
                        {isReported
                          ? 'أشرت بأن السعر مرتفع (اضغط للإلغاء)'
                          : 'هل ترى أن هذا السعر مرتفع؟'}
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* Multi-Variant Sibling & Spec Selector */}
              {siblings.length > 1 && (
                <div className="p-3.5 sm:p-4 rounded-card bg-paper/80 border-2 border-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-primary" />
                      <span>اختر المواصفات أو اللون المطلوب:</span>
                    </h4>
                    <span className="text-[10px] font-bold text-ink-soft">
                      {siblings.length} خيارات متاحة
                    </span>
                  </div>

                  {variantAnalysis.differingSpecs.length > 0 ? (
                    <div className="space-y-3">
                      {variantAnalysis.differingSpecs.map((specGroup) => (
                        <div key={specGroup.specKey} className="space-y-1.5">
                          <label className="text-[11px] font-bold text-ink-soft flex items-center gap-1">
                            <span>{specGroup.label}:</span>
                            <span className="text-primary font-black">
                              {product.specs?.[specGroup.specKey] || 'غير محدد'}
                            </span>
                          </label>

                          <div className="flex flex-wrap gap-1.5">
                            {specGroup.options.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelectVariantSibling(opt.targetSibling)}
                                className={`px-2.5 py-1.5 rounded-btn border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  opt.isSelected
                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary font-black'
                                    : 'border-line bg-surface text-ink hover:border-primary/50'
                                } ${!opt.inStock ? 'opacity-50' : ''}`}
                              >
                                {opt.image && (
                                  <img
                                    src={opt.image}
                                    alt={opt.value}
                                    className="w-5 h-5 rounded object-cover border border-line"
                                  />
                                )}
                                <span>{opt.value}</span>
                                {opt.isSelected && <Check className="w-3 h-3 text-primary" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {siblings.map((sib) => {
                        const isCurrent = String(sib._id) === String(product._id);
                        return (
                          <button
                            key={sib._id}
                            type="button"
                            onClick={() => handleSelectVariantSibling(sib)}
                            className={`px-3 py-1.5 rounded-btn border text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                              isCurrent
                                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary font-black'
                                : 'border-line bg-surface text-ink hover:border-primary/50'
                            }`}
                          >
                            <span>{sib.name}</span>
                            {isCurrent && <Check className="w-3 h-3 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="p-3.5 sm:p-4 rounded-card bg-paper border border-line space-y-1.5">
                  <h4 className="text-xs font-black text-ink uppercase tracking-wider">
                    عن المنتج
                  </h4>
                  <p className="text-xs sm:text-sm leading-relaxed text-ink-soft whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Specs Table */}
              {product.specs && Object.keys(product.specs).length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-ink uppercase tracking-wider mb-2">
                    المواصفات الفنية
                  </h4>
                  <div className="rounded-card border border-line overflow-hidden divide-y divide-line text-xs sm:text-sm bg-paper">
                    {Object.entries(product.specs).map(([key, val]) => (
                      <div key={key} className="grid grid-cols-2 px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-surface transition-colors gap-2">
                        <span className="font-bold text-ink-soft truncate">{key}</span>
                        <span className="font-extrabold text-ink break-words">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-paper text-ink-soft border border-line text-[11px] sm:text-xs font-bold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-btn"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Linked Items & Services */}
              {product.linkedItemIds && product.linkedItemIds.length > 0 && (
                <div className="p-3.5 rounded-card bg-gradient-to-br from-indigo-950/10 via-surface to-primary/5 border-2 border-indigo-500/30 dark:border-indigo-400/30 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>خدمات ومقترحات متوافقة مع هذا المنتج:</span>
                    </h4>
                    <span className="text-[10px] font-bold text-ink-soft">انقر لتصفح المنتج أو إضافته</span>
                  </div>
                  <div className="space-y-1.5">
                    {product.linkedItemIds.map((item) => {
                      if (!item || typeof item !== 'object') return null;
                      const isItemService = item.categoryId?.type === 'service' || item.isService === true;
                      const isAdded =
                        addedLinkedIds.includes(item._id) ||
                        (Array.isArray(cart) && cart.some((c) => String(c.productId || c._id) === String(item._id)));
                      return (
                        <div
                          key={item._id}
                          onClick={() => {
                            setActiveProductModal(item);
                          }}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface hover:bg-paper border border-line hover:border-indigo-500/60 dark:hover:border-indigo-400/60 transition-all text-xs cursor-pointer group shadow-xs"
                          title="انقر لعرض تفاصيل هذا المنتج"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs">{isItemService ? '🔧' : '📦'}</span>
                            <span className="font-bold text-ink group-hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-[200px]">{item.name}</span>
                            <span className="text-primary font-mono font-black text-[11px]">
                              {item.price?.toLocaleString()} {config?.currency || 'ج.م'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/product/${item._id}`);
                                setActiveProductModal(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="px-2 py-1 rounded-lg border border-line bg-paper hover:bg-surface text-ink hover:text-primary font-bold text-[11px] flex items-center gap-1 transition-all"
                              title="تصفح صفحة المنتج كاملة"
                            >
                              <Eye className="w-3 h-3 text-ink-soft group-hover:text-primary" />
                              <span>تصفح</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isAdded) {
                                  setActiveProductModal(null);
                                  setIsCartOpen(true);
                                } else {
                                  addToCart(item, 1);
                                  setAddedLinkedIds((prev) => [...prev, item._id]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 flex items-center gap-1 transition-all ${
                                isAdded
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-primary text-white hover:bg-primary/90'
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>مضاف للطلب</span>
                                </>
                              ) : (
                                <span>+ أضف للطلب</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity & CTAs */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  {!isService ? (
                    <>
                      <span className="text-xs font-bold text-ink-soft">الكمية:</span>
                      <div className="flex items-center border border-line rounded-card p-0.5 sm:p-1 bg-paper">
                        <button
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="w-7 sm:w-8 h-7 sm:h-8 rounded-btn bg-surface text-ink font-bold hover:bg-paper flex items-center justify-center border border-line/50 shadow-sm text-sm"
                        >
                          -
                        </button>
                        <span className="w-10 sm:w-12 text-center font-black text-sm text-ink">{quantity}</span>
                        <button
                          onClick={() => setQuantity((q) => (product.stockCount ? Math.min(product.stockCount, q + 1) : q + 1))}
                          className="w-7 sm:w-8 h-7 sm:h-8 rounded-btn bg-surface text-ink font-bold hover:bg-paper flex items-center justify-center border border-line/50 shadow-sm text-sm"
                        >
                          +
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-card bg-orange-500/10 border border-orange-500/25 text-orange-800 dark:text-orange-200 text-xs font-bold">
                      <Wrench className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      <span>حجز خدمة واحدة لكل طلب</span>
                    </div>
                  )}

                  <button
                    onClick={() => toggleWishlist(product._id)}
                    className={`p-2.5 sm:p-3 rounded-card border transition-all ${
                      inWishlist
                        ? 'border-red-500 bg-red-500/10 text-red-500 shadow-sm'
                        : 'border-line hover:bg-paper text-ink-soft hover:text-ink'
                    }`}
                    title="قائمة المفضلة"
                  >
                    <Heart className={`w-4 sm:w-5 h-4 sm:h-5 ${inWishlist ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {isOutOfStock ? (
                  <button
                    type="button"
                    onClick={() => openWaitlistModal(product)}
                    className="w-full py-3.5 px-4 rounded-btn font-black text-xs sm:text-sm bg-orange-500 text-white hover:bg-orange-600 shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Bell className="w-4 h-4" />
                    <span>تنبيه عند التوفر في المخزون (قائمة الانتظار)</span>
                  </button>
                ) : isService ? (
                  <button
                    onClick={
                      isAlreadyInCart
                        ? () => {
                            setActiveProductModal(null);
                            setIsCartOpen(true);
                          }
                        : handleAddToCart
                    }
                    className={`w-full py-3.5 px-4 rounded-btn font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 ${
                      isAlreadyInCart
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                    }`}
                  >
                    {isAlreadyInCart ? (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>✓ الخدمة مضافة لطلبك (عرض السلة ومتابعة الحجز)</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        <span>طلب وحجز الخدمة الآن</span>
                      </>
                    )}
                  </button>
                ) : config?.storefrontMode === 'internal_catalog' ? (
                  <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-black text-xs sm:text-sm">
                      <Store className="w-4 h-4 shrink-0" />
                      <span>معروض ومتاح بالفرع للمعانية والتجربة (كتالوج داخلي)</span>
                    </div>
                    <p className="text-[11px] text-ink-soft leading-relaxed">
                      هذا الصنف متاح ضمن الكتالوج والمعرض الداخلي للفرع. يمكنك مراجعة وتجربة الشنبر أو قياس العدسات مع أخصائي البصريات بالفرع أو حفظه في قائمة المفضلة.
                    </p>
                    <div className="pt-1 flex items-center justify-between text-xs font-bold text-ink">
                      <span>كود الصنف / الباركود:</span>
                      <span className="font-mono bg-surface px-2 py-0.5 rounded-md border border-line text-[11px]">
                        {product.barcode || product.sku || product._id?.slice(-6)?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={handleAddToCart}
                      className="py-3 px-3 sm:py-3.5 sm:px-4 rounded-btn font-bold text-xs sm:text-sm bg-surface text-ink border border-line hover:border-primary flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all active:scale-95"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>إضافة للسلة</span>
                    </button>

                    <button
                      onClick={handleBuyNow}
                      className="py-3 px-3 sm:py-3.5 sm:px-4 rounded-btn font-black text-xs sm:text-sm bg-primary text-[var(--color-primary-contrast,#ffffff)] hover:bg-primary/90 shadow-md transition-all active:scale-95"
                    >
                      شراء فوري الآن
                    </button>
                  </div>
                )}
              </div>

              {/* Guarantees */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t border-line text-center text-[10px] sm:text-xs text-ink-soft font-bold">
                <div className="p-2 sm:p-2.5 rounded-btn bg-paper border border-line flex flex-col items-center justify-center">
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary mb-1" />
                  <span className="truncate w-full block">شحن سريع وموثوق</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-btn bg-paper border border-line flex flex-col items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 mb-1" />
                  <span className="truncate w-full block">ضمان أصلي 100%</span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-btn bg-paper border border-line flex flex-col items-center justify-center">
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 mb-1" />
                  <span className="truncate w-full block">استرجاع 14 يوماً</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Reviews & Form */}
          <div className="pt-6 border-t border-line space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <Star className="w-5 h-5 text-orange-500 fill-current" />
                <span>تقييمات وآراء العملاء ({reviews.length})</span>
              </h3>
            </div>

            {/* Add Review Form */}
            <form onSubmit={handleReviewSubmit} className="p-4 sm:p-5 rounded-card bg-paper border border-line space-y-3">
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <MessageSquarePlus className="w-4 h-4 text-primary" />
                <span>أضف تقييمك لهذا المنتج</span>
              </h4>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-soft">تقييمك:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1 text-lg transition-transform hover:scale-125 ${
                        star <= rating ? 'text-orange-500' : 'text-ink-soft/40'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="اكتب رأيك الصادق في جودة المنتج وسرعة التوصيل..."
                  className="flex-1 bg-surface border border-line rounded-btn px-3 py-2 text-sm text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                />
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="bg-primary text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs px-4 py-2 rounded-btn hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال</span>
                </button>
              </div>
            </form>

            {/* Reviews List */}
            {reviews.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reviews.map((rev) => (
                  <div key={rev._id} className="p-4 rounded-card border border-line bg-paper space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{rev.username}</span>
                      <div className="flex text-orange-500 text-xs">
                        {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-xs text-ink-soft leading-relaxed">{rev.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-soft text-center py-4">كن أول من يقيّم هذا المنتج الرائع!</p>
            )}
          </div>

          {/* Related Products */}
          {related.length > 0 && (
            <div className="pt-6 border-t border-line space-y-4">
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>منتجات ذات صلة قد تعجبك</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {related.map((rel) => (
                  <ProductCard key={rel._id} product={rel} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
