import React, { useState, useEffect } from 'react';
import { X, Bell, Phone, CheckCircle2, MessageCircle, AlertCircle, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

export default function RestockWaitlistModal({ product, isOpen, onClose }) {
  const { user, visitorId, showToast, config } = useStore();

  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [channelPreference, setChannelPreference] = useState('both');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [alreadyWaiting, setAlreadyWaiting] = useState(false);

  useEffect(() => {
    if (!isOpen || !product) {
      setIsSuccess(false);
      setAlreadyWaiting(false);
      return;
    }

    // Auto-fill from authenticated user or localStorage
    const savedPhone = user?.phone || localStorage.getItem('store_user_phone') || '';
    const savedName = user?.name || localStorage.getItem('store_user_name') || '';
    if (savedPhone) setPhone(savedPhone);
    if (savedName) setCustomerName(savedName);

    // Check if user is already waiting for this product
    if (product._id) {
      axios
        .get(`/api/store-public/waitlist/status/${product._id}`, {
          params: { visitorId, phone: savedPhone }
        })
        .then((res) => {
          if (res.data?.isWaiting) {
            setAlreadyWaiting(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, product, user, visitorId]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone && !visitorId && !user?._id) {
      showToast('يرجى إدخال رقم الهاتف للتواصل عبر واتساب أو استلام الإشعار', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        productId: product._id,
        phone: phone.trim(),
        customerName: customerName.trim(),
        visitorId,
        channelPreference
      };

      const res = await axios.post('/api/store-public/waitlist/join', payload);
      if (res.data?.success) {
        setIsSuccess(true);
        if (phone.trim()) {
          localStorage.setItem('store_user_phone', phone.trim());
        }
        if (customerName.trim()) {
          localStorage.setItem('store_user_name', customerName.trim());
        }
        showToast('تم تسجيلك في قائمة التنبيه بنجاح! سنخبرك فور توفره.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'حدث خطأ أثناء التسجيل، يرجى المحاولة لاحقاً';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const image =
    (product.images && product.images[0]) ||
    product.image ||
    'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-surface rounded-3xl border border-line shadow-2xl overflow-hidden text-ink">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="font-black text-sm text-ink">تنبيه عند توفر المنتج</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-paper text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Product Snapshot */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-paper border border-line">
            <img
              src={image}
              alt={product.name}
              className="w-14 h-14 rounded-xl object-cover border border-line/60 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-xs text-ink line-clamp-1">{product.name}</h4>
              <p className="text-xs text-primary font-black mt-0.5">
                {product.price?.toLocaleString()} {config?.currency || 'ج.م'}
              </p>
              <span className="inline-block mt-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                نفد من المخزون حالياً
              </span>
            </div>
          </div>

          {isSuccess ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-ink">تم تسجيل طلبك بنجاح!</h4>
              <p className="text-xs text-ink-soft leading-relaxed max-w-xs mx-auto">
                سنقوم بإرسال إشعار فوري لك عبر المتجر وواتساب فور قيام إدارة المتجر بإعادة شحن هذا المنتج.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-6 py-2.5 rounded-btn bg-primary text-white font-bold text-xs shadow-md hover:bg-primary/90 transition-all"
              >
                حسناً، تم
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {alreadyWaiting && (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2 text-orange-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>أنت مسجل بالفعل في قائمة الانتظار لهذا المنتج. يمكنك تحديث بياناتك أدناه.</span>
                </div>
              )}

              <p className="text-xs text-ink-soft leading-relaxed">
                سجل رقم هاتفك لتكون أول من يعلم فور توفر المنتج مرة أخرى في المخزن بأسعاره وعروضه المحدثة.
              </p>

              {/* Name (Optional) */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">اسمك (اختياري)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full px-3.5 py-2.5 rounded-btn bg-paper border border-line text-xs font-bold text-ink focus:border-primary outline-none transition-colors"
                />
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  رقم الهاتف أو الواتساب <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="w-full pl-3.5 pr-9 py-2.5 rounded-btn bg-paper border border-line text-xs font-black text-ink text-left focus:border-primary outline-none transition-colors"
                  />
                  <Phone className="w-4 h-4 text-ink-soft absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Notification Channel Preference */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">طريقة التنبيه المفضلة:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannelPreference('both')}
                    className={`py-2 px-2 rounded-btn text-[11px] font-bold border transition-all flex flex-col items-center gap-1 ${
                      channelPreference === 'both'
                        ? 'bg-primary/10 border-primary text-primary font-black shadow-sm'
                        : 'bg-paper border-line text-ink-soft hover:bg-surface'
                    }`}
                  >
                    <span>⚡ كلاهما</span>
                    <span className="text-[9px] opacity-75">(موصى به)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannelPreference('whatsapp')}
                    className={`py-2 px-2 rounded-btn text-[11px] font-bold border transition-all flex flex-col items-center gap-1 ${
                      channelPreference === 'whatsapp'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-black shadow-sm'
                        : 'bg-paper border-line text-ink-soft hover:bg-surface'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>واتساب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannelPreference('in_app')}
                    className={`py-2 px-2 rounded-btn text-[11px] font-bold border transition-all flex flex-col items-center gap-1 ${
                      channelPreference === 'in_app'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 font-black shadow-sm'
                        : 'bg-paper border-line text-ink-soft hover:bg-surface'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>إشعار بالمتجر</span>
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-btn font-black text-xs bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
              >
                <Bell className="w-4 h-4" />
                <span>{loading ? 'جاري التسجيل...' : 'تنبيهي عند توفر المنتج بالمخزن'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
