import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Trash2, ArrowLeft, Tag, CheckCircle2, AlertCircle, Wrench, Eye } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function CartDrawer() {
  const navigate = useNavigate();
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    addToCart,
    removeFromCart,
    updateQty,
    cartSubtotal,
    cartCount,
    config,
    setIsCheckoutOpen,
    appliedCoupon,
    setAppliedCoupon,
    logActivityEvent
  } = useStore();

  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const suggestedItems = useMemo(() => {
    const inCartIds = new Set(cart.map((c) => c.productId || c._id));
    const list = [];
    const seen = new Set();
    cart.forEach((c) => {
      if (Array.isArray(c.linkedItemIds)) {
        c.linkedItemIds.forEach((li) => {
          if (typeof li === 'object' && li !== null) {
            const id = li._id;
            if (id && !inCartIds.has(id) && !seen.has(id)) {
              seen.add(id);
              list.push(li);
            }
          }
        });
      }
    });
    return list;
  }, [cart]);

  if (!isCartOpen) return null;

  const freeShippingThreshold = config?.freeShippingOver || 1000;
  const freeShippingProgress = Math.min(100, Math.round((cartSubtotal / freeShippingThreshold) * 100));
  const shipping = cartSubtotal >= freeShippingThreshold ? 0 : (config?.shippingCost || 50);

  const discount = appliedCoupon?.discountAmount || 0;
  const total = Math.max(0, cartSubtotal - discount + (cart.length > 0 ? shipping : 0));

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await axios.post('/api/store-coupons-public/validate', {
        code: couponCode.trim(),
        subtotal: cartSubtotal
      });
      setAppliedCoupon(res.data);
    } catch (err) {
      setCouponError(err.response?.data?.error || 'كوبون غير صالح');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleProceedToCheckout = () => {
    if (cart.length > 0 && logActivityEvent) {
      logActivityEvent({
        eventType: 'checkout_started',
        items: cart.map((item) => ({
          productId: item.productId || item._id,
          quantity: item.quantity || 1
        })),
        couponCode: appliedCoupon?.code || null,
        couponApplied: Boolean(appliedCoupon?.code)
      });
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />

      <div className="absolute inset-y-0 left-0 max-w-full flex">
        <div
          style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
          className="w-screen max-w-md text-ink shadow-2xl flex flex-col justify-between border-r border-line animate-in slide-in-from-left duration-300"
        >
          {/* Header */}
          <div
            style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
            className="p-5 border-b border-line flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-black text-ink">سلة التسوق ({cartCount})</h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-card text-ink-soft hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Bar */}
          <div className="px-5 py-3 bg-primary/10 border-b border-primary/20 text-xs font-bold text-ink">
            {shipping === 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-500 font-black">
                <CheckCircle2 className="w-4 h-4" /> تهانينا! حصلت على شحن مجاني لطلبك
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between text-ink-soft">
                  <span>أضف {freeShippingThreshold - cartSubtotal} {config?.currency || 'ج.م'} للحصول على شحن مجاني!</span>
                  <span className="font-bold text-primary">{freeShippingProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-paper rounded-full overflow-hidden border border-line/50">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-line">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-ink-soft space-y-3">
                <div className="w-16 h-16 rounded-card bg-paper border border-line flex items-center justify-center text-3xl">
                  🛒
                </div>
                <p className="text-base font-extrabold text-ink">سلة التسوق فارغة</p>
                <p className="text-xs text-ink-soft">ابدأ بإضافة منتجاتك المفضلة لتظهر هنا</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="py-4 flex gap-3.5 items-center">
                  <img
                    src={item.image || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                    alt={item.name}
                    className="w-16 h-16 rounded-card object-cover bg-paper border border-line flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      {(item.isService || item.categoryId?.type === 'service') && (
                        <span className="text-[10px] bg-orange-500/20 border border-orange-500/40 text-orange-950 dark:text-orange-100 px-1.5 py-0.5 rounded font-black shrink-0">
                          🔧 خدمة
                        </span>
                      )}
                      <h4 className="text-sm font-bold text-ink truncate">{item.name}</h4>
                    </div>
                    <p className="text-xs font-black text-primary mt-0.5">
                      {item.price?.toLocaleString()} {config?.currency || 'ج.م'}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      {item.isService || item.categoryId?.type === 'service' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-card bg-orange-500/15 border border-orange-500/40 text-orange-950 dark:text-orange-100 text-[11px] font-bold">
                          <Wrench className="w-3.5 h-3.5 shrink-0 text-orange-600" />
                          <span>حجز خدمة واحدة</span>
                        </div>
                      ) : (
                        <div className="flex items-center border border-line rounded-btn p-0.5 bg-paper">
                          <button
                            onClick={() => updateQty(item.productId, item.quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-surface text-ink font-bold hover:bg-paper flex items-center justify-center text-xs shadow-sm border border-line/40"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-black text-ink">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.productId, item.quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-surface text-ink font-bold hover:bg-paper flex items-center justify-center text-xs shadow-sm border border-line/40"
                          >
                            +
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="p-1.5 text-ink-soft hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="حذف من السلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Suggested Complementary Items / Services */}
          {suggestedItems.length > 0 && (
            <div className="p-4 bg-indigo-500/10 border-t border-indigo-500/25 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-indigo-950 dark:text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>خدمات ومقترحات مناسبة لطلبك:</span>
                </span>
                <span className="text-[10px] text-ink-soft font-bold">انقر للتصفح أو الإضافة</span>
              </div>
              <div className="space-y-1.5">
                {suggestedItems.slice(0, 3).map((sItem) => (
                  <div
                    key={sItem._id}
                    onClick={() => {
                      navigate(`/product/${sItem._id}`);
                      setIsCartOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface hover:bg-paper border border-line hover:border-indigo-500/50 text-xs shadow-xs cursor-pointer group transition-all"
                    title="انقر لتصفح هذا المنتج"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs">{sItem.categoryId?.type === 'service' ? '🔧' : '📦'}</span>
                      <span className="font-bold text-ink group-hover:text-primary transition-colors truncate max-w-[170px]">
                        {sItem.name}
                      </span>
                      <span className="text-primary font-mono font-black text-[11px] whitespace-nowrap">
                        {sItem.price?.toLocaleString()} {config?.currency || 'ج.م'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/product/${sItem._id}`);
                          setIsCartOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-2 py-1 rounded-lg border border-line bg-paper hover:bg-surface text-ink hover:text-primary text-[10px] font-bold"
                        title="تصفح"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(sItem, 1);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-primary text-[var(--color-primary-contrast,#ffffff)] text-[10px] font-black hover:bg-primary/90"
                      >
                        + أضف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer with Coupon & Checkout */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-line bg-paper space-y-4">
              {/* Coupon Form */}
              {config?.enabledModules?.coupons !== false && (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="كود الكوبون (مثال: FAR2026)..."
                        className="w-full bg-surface border border-line rounded-btn px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                      />
                      <Tag className="w-3.5 h-3.5 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponCode.trim()}
                      className="bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs px-4 py-2 rounded-btn transition-colors disabled:opacity-50"
                    >
                      {isValidatingCoupon ? '...' : 'تطبيق'}
                    </button>
                  </div>

                  {appliedCoupon && (
                    <div className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>تم تطبيق الكوبون «{appliedCoupon.code}»: وفرت {appliedCoupon.discountAmount} {config?.currency || 'ج.م'}</span>
                    </div>
                  )}
                  {couponError && (
                    <div className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{couponError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-ink-soft font-bold">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span className="text-ink">{cartSubtotal?.toLocaleString()} {config?.currency || 'ج.م'}</span>
                </div>
                <div className="flex justify-between">
                  <span>الشحن:</span>
                  <span>{shipping === 0 ? <span className="text-emerald-500 font-black">مجاناً</span> : `${shipping} ${config?.currency || 'ج.م'}`}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>خصم الكوبون:</span>
                    <span>-{discount?.toLocaleString()} {config?.currency || 'ج.م'}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-ink pt-2 border-t border-line">
                  <span>الإجمالي النهائي:</span>
                  <span className="text-primary">{total?.toLocaleString()} {config?.currency || 'ج.م'}</span>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 px-4 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-sm shadow-md flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>متابعة إتمام الطلب</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
