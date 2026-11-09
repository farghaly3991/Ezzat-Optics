import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Star, Eye, Scale, Bell, Wrench, Layers } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const {
    config,
    cart,
    addToCart,
    toggleWishlist,
    isInWishlist,
    setActiveProductModal,
    trackProductView,
    addToComparison,
    removeFromComparison,
    isInComparison,
    openWaitlistModal,
    setIsCartOpen
  } = useStore();

  if (!product) return null;

  const inWishlist = isInWishlist(product._id);
  const images = product.images && product.images.length > 0
    ? product.images
    : ['https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800&auto=format&fit=crop&q=80'];

  const discount = product.oldPrice && product.oldPrice > product.price
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;

  const isService = product.categoryId?.type === 'service' || product.isService === true;
  const isAlreadyInCart =
    isService &&
    Array.isArray(cart) &&
    cart.some((it) => String(it.productId || it._id) === String(product._id));
  const isLowStock = !isService && product.stockCount > 0 && product.stockCount <= 5;
  const isOutOfStock = !isService && product.stockCount <= 0;

  const handleCardClick = () => {
    trackProductView(product);
    navigate(`/product/${product._id}`);
  };

  const handleQuickView = (e) => {
    e.stopPropagation();
    trackProductView(product);
    setActiveProductModal(product);
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();
    trackProductView(product);
    addToCart(product, 1);
  };

  const handleToggleWishlist = (e) => {
    e.stopPropagation();
    toggleWishlist(product._id);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-card border border-line bg-surface hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden text-ink"
    >
      {/* Top Image Container */}
      <div>
        <div className="relative aspect-square rounded-btn overflow-hidden bg-paper mb-3 border border-line">
          <img
            src={images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
          />

          {/* Badges Top Right */}
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 z-10">
            {product.hasVariants && product.variantCount > 1 && (
              <span className="bg-primary text-[var(--color-primary-contrast,#ffffff)] text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>متوفر بـ {product.variantCount} خيارات</span>
              </span>
            )}
            {isService && (
              <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                <Wrench className="w-3 h-3" />
                <span>خدمة</span>
              </span>
            )}
            {!isService && discount > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                -{discount}%
              </span>
            )}
            {!isService && !product.hasVariants && isLowStock && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                متبقي {product.stockCount} فقط!
              </span>
            )}
            {!isService && !product.hasVariants && isOutOfStock && (
              <span className="bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-btn shadow-sm">
                نفد المخزون
              </span>
            )}
          </div>

          {/* Wishlist Button Top Left */}
          <button
            onClick={handleToggleWishlist}
            className={`absolute top-2.5 left-2.5 p-2 rounded-btn backdrop-blur-md transition-all z-10 border ${
              inWishlist
                ? 'bg-red-500 text-white border-red-500 shadow-md'
                : 'bg-surface/85 hover:bg-surface text-ink hover:text-red-500 border-line shadow-sm'
            }`}
            title="إضافة للمفضلة"
          >
            <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
          </button>

          {/* Comparison Toggle Button Top Left (offset) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isInComparison(product._id)) {
                removeFromComparison(product._id);
              } else {
                addToComparison(product._id);
              }
            }}
            className={`absolute top-2.5 left-11 p-2 rounded-btn backdrop-blur-md transition-all z-10 border ${
              isInComparison(product._id)
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-surface/85 hover:bg-surface text-ink hover:text-emerald-600 border-line shadow-sm'
            }`}
            title={isInComparison(product._id) ? 'إزالة من المقارنة' : 'إضافة للمقارنة'}
          >
            <Scale className="w-4 h-4" />
          </button>

          {/* Quick Preview Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <button
              type="button"
              onClick={handleQuickView}
              className="quick-view-badge text-xs font-bold px-3.5 py-2 rounded-btn shadow-2xl flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105 active:scale-95"
            >
              <Eye className="w-4 h-4 text-white" /> معاينة سريعة
            </button>
          </div>
        </div>

        {/* Category & Rating */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
            isService
              ? 'text-orange-950 dark:text-orange-100 bg-orange-500/15 border-orange-500/40'
              : 'text-primary bg-primary/10 border-primary/20'
          }`}>
            {isService ? '🔧 ' : ''}{product.categoryId?.name || 'عام'}
          </span>

          <div className="flex items-center gap-1 text-xs text-orange-950 dark:text-orange-200 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/30">
            <Star className="w-3.5 h-3.5 text-orange-500 fill-amber-400" />
            <span>{product.ratingAvg ? product.ratingAvg.toFixed(1) : 'جديد'}</span>
            {product.ratingCount > 0 && (
              <span className="text-[10px] text-ink-soft">({product.ratingCount})</span>
            )}
          </div>
        </div>

        {/* Product Title */}
        <h3 className="font-black text-ink text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Optics Key Specs Badges */}
        {product.specs && Object.keys(product.specs).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {product.specs['نوع الإطار'] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                👓 {product.specs['نوع الإطار']}
              </span>
            )}
            {product.specs['معامل الانكسار'] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                🔬 {product.specs['معامل الانكسار']}
              </span>
            )}
            {product.specs['مادة الإطار'] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
                {product.specs['مادة الإطار']}
              </span>
            )}
            {product.specs['الفئة'] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {product.specs['الفئة']}
              </span>
            )}
            {product.specs['نوع العدسة'] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                👁️ {product.specs['نوع العدسة']}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pricing & Add to Cart */}
      <div className="pt-2.5 border-t border-line mt-2">
        <div className="flex items-baseline gap-2 mb-3">
          {product.hasVariants && product.variantCount > 1 && product.minPrice !== product.maxPrice ? (
            <div className="flex flex-col">
              <span className="text-[10px] text-ink-soft font-bold">يبدأ من:</span>
              <span className="text-sm sm:text-base font-black text-ink">
                {product.minPrice?.toLocaleString()} - {product.maxPrice?.toLocaleString()} {config?.currency || 'ج.م'}
              </span>
            </div>
          ) : (
            <>
              <span className="text-base sm:text-lg font-black text-ink">
                {(product.minPrice || product.price)?.toLocaleString()} {config?.currency || 'ج.م'}
              </span>
              {product.oldPrice > product.price && (
                <span className="text-xs text-ink-soft line-through">
                  {product.oldPrice?.toLocaleString()}
                </span>
              )}
            </>
          )}
        </div>

        {product.hasVariants && product.variantCount > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              trackProductView(product);
              navigate(`/product/${product._id}`);
            }}
            className="w-full py-2.5 px-3 rounded-btn font-black text-xs flex items-center justify-center gap-2 transition-all duration-200 bg-primary text-[var(--color-primary-contrast,#ffffff)] hover:bg-primary/90 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95"
          >
            <Layers className="w-4 h-4" />
            <span>اختر المواصفات واللون</span>
          </button>
        ) : isService ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isAlreadyInCart) {
                setIsCartOpen(true);
              } else {
                handleAddToCart(e);
              }
            }}
            className={`w-full py-2.5 px-3 rounded-btn font-black text-xs flex items-center justify-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 ${
              isAlreadyInCart
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {isAlreadyInCart ? (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>✓ الخدمة مضافة (عرض السلة)</span>
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                <span>طلب وحجز الخدمة</span>
              </>
            )}
          </button>
        ) : isOutOfStock ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWaitlistModal(product);
            }}
            className="w-full py-2.5 px-3 rounded-btn font-bold text-xs flex items-center justify-center gap-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-500/30 transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
            title="تنبيه عند التوفر في المخزون"
          >
            <Bell className="w-4 h-4" />
            <span>نبهني عند التوفر</span>
          </button>
        ) : config?.storefrontMode === 'internal_catalog' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (setActiveProductModal) setActiveProductModal(product);
              else navigate(`/product/${product._id}`);
            }}
            className="w-full py-2.5 px-3 rounded-btn font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 bg-surface border border-line text-ink hover:border-primary hover:text-primary shadow-xs"
          >
            <Eye className="w-4 h-4" />
            <span>معاينة المواصفات بالفرع</span>
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="w-full py-2.5 px-3 rounded-btn font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 bg-primary text-[var(--color-primary-contrast,#ffffff)] hover:bg-primary/90 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>أضف للسلة</span>
          </button>
        )}
      </div>
    </div>
  );
}
