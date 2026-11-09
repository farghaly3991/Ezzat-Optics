import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Heart,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  ArrowRight,
  MessageSquarePlus,
  Send,
  Share2,
  Check,
  Layers,
  Bell,
  Wrench,
  Link2,
  Eye,
  ExternalLink,
  Store
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ProductCard from '../../shared/components/ProductCard';
import PageLoader from '../../shared/components/PageLoader';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
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
    fetchCachedProductDetails,
    openWaitlistModal,
    productDetailsCache
  } = useStore();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSendingPriceFeedback, setIsSendingPriceFeedback] = useState(false);
  const [addedLinkedIds, setAddedLinkedIds] = useState([]);

  // Review Form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    const idStr = String(id);

    // If already cached in StoreContext (e.g., switching between siblings of the same groupCode), load instantaneously without spinner!
    if (productDetailsCache?.[idStr]?.product) {
      const cachedData = productDetailsCache[idStr];
      setDetail(cachedData);
      setLoading(false);
      setActiveImgIndex(0);
      setQuantity(1);
      trackProductView(cachedData.product, true);
      return;
    }

    setLoading(true);
    setQuantity(1);
    setActiveImgIndex(0);

    fetchCachedProductDetails(idStr)
      .then((data) => {
        setDetail(data);
        if (data?.product) {
          trackProductView(data.product);
        }
      })
      .catch((err) => console.error('Failed to load product page:', err))
      .finally(() => setLoading(false));

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const product = detail?.product || null;
  const reviews = detail?.reviews || [];
  const related = detail?.related || [];
  const siblings = useMemo(() => {
    const rawSibs = Array.isArray(detail?.siblings) ? detail.siblings : [];
    if (rawSibs.length <= 1) return [];
    return rawSibs;
  }, [detail?.siblings]);

  const catSpecs = product?.categoryId?.specs || {};

  // Analyze differing specs and price-affecting vs price-neutral specs across siblings in the same groupCode
  const variantAnalysis = useMemo(() => {
    if (!product || siblings.length <= 1) {
      return { differingSpecs: [], hasPriceVariation: false };
    }

    const allSpecKeys = new Set();
    const pricesSet = new Set();

    siblings.forEach((sib) => {
      pricesSet.add(Number(sib.price || 0));
      Object.entries(sib.specs || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          allSpecKeys.add(k);
        }
      });
    });

    const differingSpecs = [];

    allSpecKeys.forEach((specKey) => {
      const valuesMap = new Map(); // value -> array of siblings having this value
      siblings.forEach((sib) => {
        const val = String(sib.specs?.[specKey] || '').trim();
        if (!val) return;
        if (!valuesMap.has(val)) valuesMap.set(val, []);
        valuesMap.get(val).push(sib);
      });

      // Only treat as a variant selector if there are 2+ distinct values across siblings (or if only 1 spec exists across siblings)
      if (valuesMap.size > 1) {
        // Check if different values of this spec lead to different prices
        const optionPrices = new Set();
        const options = [];

        valuesMap.forEach((matchingSibs, valStr) => {
          // Pick the sibling that best matches the currently active product's OTHER specs, or fallback to the first matching sibling
          const bestMatch =
            matchingSibs.find((cand) => {
              return Array.from(allSpecKeys).every((otherKey) => {
                if (otherKey === specKey) return true;
                const curOtherVal = String(product.specs?.[otherKey] || '').trim();
                const candOtherVal = String(cand.specs?.[otherKey] || '').trim();
                return !curOtherVal || !candOtherVal || curOtherVal === candOtherVal;
              });
            }) || matchingSibs[0];

          optionPrices.add(Number(bestMatch.price || 0));

          options.push({
            value: valStr,
            targetSibling: bestMatch,
            price: Number(bestMatch.price || 0),
            oldPrice: Number(bestMatch.oldPrice || 0),
            image: bestMatch.images?.[0] || '',
            inStock: (bestMatch.stockCount || 0) > 0,
            isSelected: String(product.specs?.[specKey] || '').trim() === valStr
          });
        });

        differingSpecs.push({
          specKey,
          label: catSpecs[specKey] || specKey,
          variesPrice: optionPrices.size > 1,
          options
        });
      }
    });

    return {
      differingSpecs,
      hasPriceVariation: pricesSet.size > 1
    };
  }, [product, siblings, catSpecs]);

  // Switch active variant seamlessly using cached siblings
  const handleSelectVariantSibling = (targetSib) => {
    if (!targetSib || String(targetSib._id) === String(product?._id)) return;
    setActiveImgIndex(0);
    setQuantity(1);
    setDetail((prev) => ({
      ...prev,
      product: targetSib
    }));
    navigate(`/product/${targetSib._id}`, { replace: true });
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h2 className="text-2xl font-black text-ink">عذراً، المنتج غير موجود أو تم حذفه</h2>
        <p className="text-xs text-ink-soft">قد يكون الرابط غير صحيح أو انتهت صلاحية توفر المنتج.</p>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-card bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-all mt-4"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لكتالوج المنتجات</span>
        </Link>
      </div>
    );
  }

  const inWishlist = isInWishlist(product._id);
  const images =
    product.images && product.images.length > 0
      ? product.images
      : ['https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'];

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;

  const isService = product.categoryId?.type === 'service' || product.isService === true;
  const isOutOfStock = !isService && product.stockCount <= 0;
  const isLowStock = !isService && product.stockCount > 0 && product.stockCount <= 5;
  const isAlreadyInCart =
    isService &&
    Array.isArray(cart) &&
    cart.some((it) => String(it.productId || it._id) === String(product._id));

  const handleAddToCart = () => {
    addToCart(product, quantity);
    trackProductView(product);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    trackProductView(product);
    setIsCartOpen(true);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
      const updatedData = await fetchCachedProductDetails(product._id, true);
      setDetail(updatedData);
      setComment('');
      setRating(5);
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-bold text-ink-soft overflow-x-auto no-scrollbar">
        <Link to="/" className="hover:text-primary transition-colors">
          الرئيسية
        </Link>
        <span>/</span>
        <Link to="/catalog" className="hover:text-primary transition-colors">
          الكتالوج
        </Link>
        {product.categoryId && (
          <>
            <span>/</span>
            <Link
              to={`/catalog/${product.categoryId._id}`}
              className="hover:text-primary transition-colors text-ink"
            >
              {product.categoryId.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-primary truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 bg-surface p-6 sm:p-10 rounded-3xl border border-line shadow-sm">
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-paper border border-line shadow-inner">
            <img
              src={images[activeImgIndex] || images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-all duration-300"
            />

            {/* Badges */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              {discount > 0 && (
                <span className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-xl shadow-md">
                  خصم {discount}%
                </span>
              )}
              {isLowStock && (
                <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-md">
                  متبقي {product.stockCount} فقط!
                </span>
              )}
              {isOutOfStock && (
                <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-md">
                  نفد المخزون
                </span>
              )}
            </div>

            {/* Share & Wishlist Floating Buttons */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              <button
                onClick={() => toggleWishlist(product._id)}
                className={`p-2.5 rounded-xl backdrop-blur-md transition-all shadow-md border ${
                  inWishlist
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-surface/80 hover:bg-surface text-ink hover:text-red-500 border-line'
                }`}
                title="إضافة للمفضلة"
              >
                <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl bg-surface/80 hover:bg-surface text-ink hover:text-primary backdrop-blur-md transition-all shadow-md border border-line"
                title="نسخ رابط المنتج"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Thumbnails Row for Active Variant Images */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImgIndex(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    activeImgIndex === idx
                      ? 'border-primary shadow-md scale-105'
                      : 'border-line opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Info, Dynamic Variant Selectors & Actions */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Category & Rating */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {product.categoryId && (
                  <Link
                    to={`/catalog/${product.categoryId._id}`}
                    className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    {product.categoryId.name}
                  </Link>
                )}
                {siblings.length > 1 && (
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/25">
                    متوفر بـ {siblings.length} خيارات / متغيرات
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-sm text-orange-900 dark:text-orange-200 font-bold bg-orange-500/15 border border-orange-500/40 px-3 py-1 rounded-lg">
                <Star className="w-4 h-4 text-orange-500 fill-amber-400" />
                <span>{product.ratingAvg ? product.ratingAvg.toFixed(1) : 'جديد'}</span>
                <span className="text-xs text-ink-soft font-normal">
                  ({reviews.length} تقييم)
                </span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-black text-ink leading-snug">
              {product.name}
            </h1>

            {/* Tags Pills */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.map((t, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-paper text-ink-soft border border-line"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Pricing Box */}
            <div className="p-4 rounded-2xl bg-paper border border-line flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="text-3xl font-black text-primary">
                  {product.price?.toLocaleString()} {config?.currency || 'ج.م'}
                </span>
                {product.oldPrice > product.price && (
                  <span className="text-base text-ink-soft line-through font-bold">
                    {product.oldPrice?.toLocaleString()} {config?.currency || 'ج.م'}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                    وفرت {(product.oldPrice - product.price).toLocaleString()}{' '}
                    {config?.currency || 'ج.م'}
                  </span>
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm ${
                      isReported
                        ? 'bg-orange-500/20 text-orange-950 dark:text-orange-100 border-2 border-orange-600 dark:border-orange-400 font-black'
                        : 'bg-surface hover:bg-orange-500/10 text-ink-soft hover:text-orange-900 dark:hover:text-orange-200 border border-line hover:border-orange-500/50'
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

            {/* ======================================================================= */}
            {/* DYNAMIC SIBLING & SPEC VARIANT SELECTORS (When product has a groupCode) */}
            {/* ======================================================================= */}
            {siblings.length > 1 && (
              <div className="p-4 rounded-2xl bg-paper/70 border-2 border-primary/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>اختر المواصفات أو النسخة المطلوبة من المنتج:</span>
                  </h4>
                  <span className="text-[10px] font-bold text-ink-soft">
                    يتغير السعر والصور تلقائياً حسب اختيارك
                  </span>
                </div>

                {/* 1. Differing Specs Selectors (Color, Size, Capacity, etc.) */}
                {variantAnalysis.differingSpecs.length > 0 && (
                  <div className="space-y-3.5">
                    {variantAnalysis.differingSpecs.map((specGroup) => (
                      <div key={specGroup.specKey} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-ink flex items-center gap-1.5">
                            <span>{specGroup.label}:</span>
                            <span className="text-primary">
                              {product.specs?.[specGroup.specKey] || 'غير محدد'}
                            </span>
                          </label>

                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              specGroup.variesPrice
                                ? 'bg-orange-500/10 text-orange-600 border-orange-500/25'
                                : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                            }`}
                          >
                            {specGroup.variesPrice
                              ? '💰 تختلف في السعر'
                              : '✓ بنفس السعر'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {specGroup.options.map((opt) => {
                            const priceDiff = opt.price - Number(product.price || 0);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleSelectVariantSibling(opt.targetSibling)}
                                className={`group rounded-xl p-2 border-2 text-right transition-all flex items-center gap-2.5 ${
                                  opt.isSelected
                                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                                    : 'border-line bg-surface hover:border-primary/50'
                                } ${!opt.inStock ? 'opacity-60' : ''}`}
                              >
                                {opt.image && (
                                  <img
                                    src={opt.image}
                                    alt={opt.value}
                                    className="w-9 h-9 rounded-lg object-cover border border-line shrink-0"
                                  />
                                )}
                                <div className="text-right">
                                  <div className="text-xs font-black text-ink flex items-center gap-1">
                                    <span>{opt.value}</span>
                                    {opt.isSelected && (
                                      <Check className="w-3.5 h-3.5 text-primary" />
                                    )}
                                  </div>
                                  {specGroup.variesPrice && (
                                    <div className="text-[10px] font-black text-primary">
                                      {opt.price.toLocaleString()} {config?.currency || 'ج.م'}
                                      {!opt.isSelected && priceDiff !== 0 && (
                                        <span className="text-[9px] text-ink-soft mr-1">
                                          ({priceDiff > 0 ? `+${priceDiff}` : priceDiff})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. All Sibling Variants Visual Strip (Direct switching with thumbnail + price + key diff) */}
                <div className="pt-2 border-t border-line space-y-2">
                  <span className="block text-[11px] font-black text-ink-soft">
                    جميع الإصدارات المتاحة ({siblings.length}):
                  </span>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {siblings.map((sib) => {
                      const isCurrent = String(sib._id) === String(product._id);
                      const sibImg =
                        sib.images?.[0] ||
                        'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800';
                      const diffLabels = variantAnalysis.differingSpecs
                        .map((ds) => sib.specs?.[ds.specKey])
                        .filter(Boolean)
                        .join(' · ');

                      return (
                        <button
                          key={sib._id}
                          type="button"
                          onClick={() => handleSelectVariantSibling(sib)}
                          className={`p-2 rounded-xl border-2 transition-all flex items-center gap-2.5 shrink-0 text-right ${
                            isCurrent
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-line bg-surface hover:border-primary/40'
                          }`}
                        >
                          <img
                            src={sibImg}
                            alt={sib.name}
                            className="w-11 h-11 rounded-lg object-cover border border-line shrink-0"
                          />
                          <div className="max-w-[150px]">
                            <div className="text-[11px] font-black text-ink truncate">
                              {diffLabels || sib.name}
                            </div>
                            <div className="text-[11px] font-black text-primary">
                              {Number(sib.price || 0).toLocaleString()}{' '}
                              {config?.currency || 'ج.م'}
                            </div>
                            {sib.images?.length > 1 && (
                              <div className="text-[9px] text-ink-soft">
                                {sib.images.length} صور
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Description Excerpt */}
            {product.description && (
              <div className="text-xs sm:text-sm text-ink-soft leading-relaxed whitespace-pre-line py-2">
                {product.description}
              </div>
            )}
          </div>

          {/* Quantity & Action Buttons */}
          <div className="space-y-4 pt-6 border-t border-line">
            {!isService ? (
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-ink">الكمية:</span>
                <div className="flex items-center border border-line rounded-card bg-paper">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3.5 py-2 text-ink hover:text-primary font-black"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 font-black text-xs text-ink">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stockCount || 99, q + 1))}
                    className="px-3.5 py-2 text-ink hover:text-primary font-black"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-ink-soft">
                  {isOutOfStock ? 'نفد المخزون' : 'متوفر في المخزن'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-card bg-orange-500/10 border border-orange-500/25 text-orange-800 dark:text-orange-200 text-xs font-bold w-fit">
                <Wrench className="w-4 h-4 text-orange-600 shrink-0" />
                <span>حجز خدمة واحدة لكل طلب</span>
              </div>
            )}

            {isOutOfStock ? (
              <button
                type="button"
                onClick={() => openWaitlistModal(product)}
                className="w-full py-4 px-6 rounded-card font-black text-sm flex items-center justify-center gap-2.5 bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 hover:scale-[1.01] active:scale-95 transition-all"
              >
                <Bell className="w-5 h-5" />
                <span>🔔 تنبيه عند التوفر في المخزون (احجز لتكن أول من يعلم)</span>
              </button>
            ) : isService ? (
              <div className="space-y-3">
                <button
                  onClick={isAlreadyInCart ? () => setIsCartOpen(true) : handleAddToCart}
                  className={`w-full py-4 px-4 rounded-card font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all ${
                    isAlreadyInCart
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                  }`}
                >
                  {isAlreadyInCart ? (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>✓ الخدمة مضافة لطلبك (اضغط لعرض السلة ومتابعة الطلب)</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-5 h-5" />
                      <span>طلب وحجز الخدمة الآن</span>
                    </>
                  )}
                </button>
                <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-900 dark:text-orange-200 text-xs font-bold flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>خدمة صيانة/تركيب معتمدة — بدون مصاريف شحن، والدفع يتم بعد إتمام وتنفيذ الخدمة بنجاح.</span>
                </div>
              </div>
            ) : config?.storefrontMode === 'internal_catalog' ? (
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 space-y-2">
                <div className="flex items-center gap-2 text-primary font-black text-sm">
                  <Store className="w-5 h-5 shrink-0" />
                  <span>معروض ومتاح بالفرع للمعانية والتجربة (كتالوج داخلي)</span>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">
                  هذا الصنف متاح ضمن الكتالوج والمعرض الداخلي للفرع. يمكنك مراجعة وتجربة الشنبر أو قياس العدسات مع أخصائي البصريات بالفرع أو حفظه في قائمة المفضلة.
                </p>
                <div className="pt-2 flex items-center justify-between text-xs font-bold text-ink">
                  <span>كود الصنف / الباركود:</span>
                  <span className="font-mono bg-surface px-2.5 py-1 rounded-lg border border-line">
                    {product.barcode || product.sku || product._id?.slice(-6)?.toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3.5 px-4 rounded-card font-black text-xs flex items-center justify-center gap-2 bg-primary text-[var(--color-primary-contrast,#ffffff)] hover:bg-primary/90 shadow-md hover:scale-[1.01] active:scale-95 transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>أضف إلى السلة</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  className="w-full py-3.5 px-4 rounded-card font-black text-xs flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:scale-[1.01] active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>اشتري الآن مباشرة</span>
                </button>
              </div>
            )}

            {/* Value Props Row */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line text-[11px] text-ink-soft font-bold">
              <div className="flex items-center gap-1.5">
                {isService ? <Wrench className="w-4 h-4 text-orange-500" /> : <Truck className="w-4 h-4 text-primary" />}
                <span>{isService ? 'فنيون متخصصون ومعتمدون' : 'شحن سريع لجميع المحافظات'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>
                  {product.warrantyPeriodMonths > 0
                    ? `ضمان ${product.warrantyPeriodMonths} شهراً`
                    : 'ضمان معتمد 100%'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-orange-500" />
                <span>{isService ? 'دفع بعد إتمام الخدمة' : 'استرجاع متاح خلال 15 يوماً'}</span>
              </div>
            </div>

            {/* Warranty Callout Badge */}
            {product.warrantyPeriodMonths > 0 && (
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-bold">
                    مشمول بضمان معتمد {product.warrantyPeriodMonths} شهراً من تاريخ الاستلام
                    {product.warrantyPolicy ? ` • ${product.warrantyPolicy}` : ''}
                  </span>
                </div>
                <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-black shrink-0">
                  ساري الضمان
                </span>
              </div>
            )}

            {/* Suggested Complementary Items & Services (Cross-Selling) */}
            {product.linkedItemIds && product.linkedItemIds.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/10 via-surface to-primary/5 border-2 border-indigo-500/30 dark:border-indigo-400/30 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>خدمات ومقترحات متوافقة مع هذا المنتج:</span>
                  </h4>
                  <span className="text-[10px] font-bold text-ink-soft">انقر لتصفح المنتج أو إضافته</span>
                </div>

                <div className="space-y-2">
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
                          navigate(`/product/${item._id}`);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface hover:bg-paper border border-line hover:border-indigo-500/60 dark:hover:border-indigo-400/60 transition-all text-xs cursor-pointer group shadow-xs hover:shadow-md"
                        title="انقر لتصفح تفاصيل هذا المنتج"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.images?.[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover bg-paper border border-line shrink-0 group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-paper border border-line flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition-transform">
                              {isItemService ? '🔧' : '📦'}
                            </div>
                          )}

                          <div className="min-w-0">
                            <span className="font-bold text-ink group-hover:text-primary transition-colors block truncate">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-primary font-black font-mono">
                                {item.price?.toLocaleString()} {config?.currency || 'ج.م'}
                              </span>
                              {isItemService && (
                                <span className="text-[10px] bg-orange-500/15 border border-orange-500/30 text-orange-900 dark:text-orange-200 px-2 py-0.5 rounded font-black">
                                  🔧 خدمة معتمدة
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/product/${item._id}`);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-line bg-paper hover:bg-surface-elevated text-ink hover:text-primary font-bold text-xs flex items-center gap-1 transition-all"
                            title="تصفح المنتج"
                          >
                            <Eye className="w-3.5 h-3.5 text-ink-soft group-hover:text-primary" />
                            <span>تصفح</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAdded) {
                                setIsCartOpen(true);
                              } else {
                                addToCart(item, 1);
                                setAddedLinkedIds((prev) => [...prev, item._id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg font-black text-xs shrink-0 flex items-center gap-1 transition-all ${
                              isAdded
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-primary text-[var(--color-primary-contrast,#ffffff)] hover:bg-primary/90 shadow-sm'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
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
          </div>
        </div>
      </div>

      {/* Specifications Table */}
      {product.specs && Object.keys(product.specs).length > 0 && (
        <div className="bg-surface p-6 sm:p-8 rounded-3xl border border-line shadow-sm space-y-4">
          <h3 className="text-lg font-black text-ink flex items-center gap-2">
            <span>⚙️</span> المواصفات الفنية للمنتج
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(product.specs).map(([specKey, specVal]) => {
              if (!specVal) return null;
              const label = catSpecs[specKey] || specKey;
              const isDiffering = variantAnalysis.differingSpecs.some(
                (d) => d.specKey === specKey
              );
              return (
                <div
                  key={specKey}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                    isDiffering
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-paper border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ink-soft">{label}</span>
                    {isDiffering && (
                      <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        متغير مختار
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-ink mt-1">{String(specVal)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews & Ratings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-surface p-6 sm:p-8 rounded-3xl border border-line shadow-sm">
        {/* Submit Review */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-ink flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-primary" />
            <span>أضف تقييمك للمنتج</span>
          </h3>

          <form onSubmit={handleReviewSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-ink-soft mb-1.5">
                تقييمك بالنجوم:
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating
                          ? 'text-orange-500 fill-amber-500'
                          : 'text-line hover:text-orange-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-soft mb-1.5">
                رأيك أو تعليقك:
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="اكتب تعليقك وتجربتك مع هذا المنتج..."
                rows={4}
                className="w-full bg-paper border border-line rounded-xl p-3 text-xs text-ink outline-none focus:border-primary placeholder:text-ink-soft/40"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReview}
              className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmittingReview ? 'جارٍ الإرسال...' : 'نشر التقييم'}</span>
            </button>
          </form>
        </div>

        {/* Reviews List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-black text-ink flex items-center gap-2">
            <span>⭐</span> تقييمات العملاء ({reviews.length})
          </h3>

          {reviews.length === 0 ? (
            <div className="p-8 text-center bg-paper rounded-2xl border border-line text-xs font-bold text-ink-soft">
              كن أول من يقيّم هذا المنتج وشارك رأيك مع الآخرين!
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {reviews.map((r, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-paper border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-ink">{r.username || 'عميل'}</span>
                    <div className="flex items-center gap-1 text-orange-500">
                      {[...Array(r.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-ink-soft leading-relaxed">{r.comment}</p>
                  )}
                  <span className="text-[10px] text-ink-soft/60 block">
                    {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Related Products Carousel */}
      {related.length > 0 && (
        <div className="space-y-6 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-black text-ink">منتجات قد تعجبك أيضاً</h3>
            <Link to="/catalog" className="text-xs font-bold text-primary hover:underline">
              عرض المزيد
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.slice(0, 4).map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
