import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Truck, CheckCircle2, Clock, PackageCheck, AlertCircle, Wrench } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

const DELIVERY_STEPS = [
  { key: 'new', label: 'طلب جديد' },
  { key: 'confirmed', label: 'تم التأكيد' },
  { key: 'preparing', label: 'قيد التجهيز' },
  { key: 'shipped', label: 'تم الشحن' },
  { key: 'delivered', label: 'تم التسليم بنجاح' }
];

const SERVICE_STEPS = [
  { key: 'new', label: 'حجز جديد' },
  { key: 'confirmed', label: 'تأكيد موعد الزيارة' },
  { key: 'preparing', label: 'تجهيز الفني والمعدات' },
  { key: 'shipped', label: 'الفني في الطريق إليك' },
  { key: 'delivered', label: 'تم تنفيذ الخدمة بنجاح' }
];

const PICKUP_STEPS = [
  { key: 'new', label: 'طلب جديد' },
  { key: 'confirmed', label: 'تم التأكيد' },
  { key: 'ready_for_pickup', label: 'جاهز للاستلام من الفرع' },
  { key: 'delivered', label: 'تم الاستلام بنجاح' }
];

export default function OrderTracking() {
  const { config } = useStore();
  const { orderId: paramOrderId } = useParams();
  
  const [orderId, setOrderId] = useState(paramOrderId || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrder = async (id) => {
    if (!id.trim()) return;
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await axios.get(`/api/store-orders-public/track/${id.trim().toUpperCase()}`);
      if (res.data?.order) {
        setOrder(res.data.order);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'لم يتم العثور على طلب بهذا الرقم، يرجى التأكد من كتابة الكود بشكل صحيح');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramOrderId) {
      setOrderId(paramOrderId);
      fetchOrder(paramOrderId);
    }
  }, [paramOrderId]);

  const handleTrack = (e) => {
    e?.preventDefault();
    fetchOrder(orderId);
  };

  const isServiceOrder =
    order?.orderType === 'service' ||
    order?.hasServices ||
    order?.items?.some((i) => i.isService || i.categoryId?.type === 'service');

  const activeSteps = isServiceOrder
    ? SERVICE_STEPS
    : order?.deliveryMethod === 'pickup' || order?.shippingSnapshot?.deliveryMethod === 'pickup'
    ? PICKUP_STEPS
    : DELIVERY_STEPS;

  const getStepIndex = (status) => {
    if (
      (order?.deliveryMethod === 'pickup' || order?.shippingSnapshot?.deliveryMethod === 'pickup') &&
      status === 'preparing'
    ) {
      return 1;
    }
    const idx = activeSteps.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-card bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
          <Truck className="w-7 h-7" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-ink">تتبع حالة شحنتك وطلبك</h2>
        <p className="text-xs sm:text-sm text-ink-soft max-w-md mx-auto font-medium">
          أدخل رقم الطلب الخاص بك (المكون من كود ORD-XXXXXX) لمعرفة خط سير الشحنة ولحظة وصولها
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleTrack} className="max-w-md mx-auto flex gap-2">
        <input
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value.toUpperCase())}
          placeholder="ORD-XXXXXX"
          className="flex-1 bg-paper border border-line rounded-card px-4 py-3 text-sm font-mono font-bold uppercase tracking-wider outline-none focus:border-primary text-ink shadow-sm placeholder:text-ink-soft/50"
        />
        <button
          type="submit"
          disabled={loading || !orderId.trim()}
          className="bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-xs px-6 py-3 rounded-card shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? 'جاري البحث...' : 'تتبع'}
          <Search className="w-4 h-4" />
        </button>
      </form>

      {error && (
        <div className="max-w-md mx-auto p-4 rounded-card bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Order Status Display */}
      {order && (
        <div className="rounded-card p-6 sm:p-8 bg-surface text-ink border border-line space-y-8 animate-in fade-in shadow-sm">
          {/* Top Status & Date */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <span className="text-xs text-ink-soft font-bold block">رقم الطلب:</span>
              <h3 className="text-xl font-mono font-black text-ink">{order.orderId}</h3>
            </div>

            <div className="text-right">
              <span className="text-xs text-ink-soft font-bold block">تاريخ الطلب:</span>
              <span className="text-sm font-bold text-ink">
                {new Date(order.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'long' })}
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-ink">مراحل التوصيل</h4>
            <div className="relative flex items-center justify-between">
              {/* Progress Line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-line -z-0" />
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 h-1 bg-primary transition-all duration-500 -z-0"
                style={{
                  width: `${(getStepIndex(order.status) / (activeSteps.length - 1)) * 100}%`
                }}
              />

              {activeSteps.map((step, idx) => {
                const currentIdx = getStepIndex(order.status);
                const isPassed = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={step.key} className="flex flex-col items-center gap-2 relative z-10">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all ${
                        isPassed
                          ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)]'
                          : 'bg-paper border-2 border-line text-ink-soft'
                      } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}`}
                    >
                      {isPassed ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-[11px] font-bold text-center hidden sm:block ${
                        isCurrent ? 'text-primary font-black' : isPassed ? 'text-ink' : 'text-ink-soft'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Items & Shipping Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-line">
            {/* Items */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-ink-soft uppercase tracking-wider">
                المنتجات في الشحنة
              </h4>
              <div className="divide-y divide-line">
                {order.items.map((it, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <img
                        src={it.image || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                        alt=""
                        className="w-10 h-10 rounded-btn object-cover bg-paper border border-line"
                      />
                      <div>
                        <span className="font-bold text-ink block truncate max-w-[180px]">{it.name}</span>
                        <span className="text-xs text-ink-soft">الكمية: {it.quantity}</span>
                      </div>
                    </div>
                    <span className="font-black text-ink">{it.price * it.quantity} {config?.currency || 'ج.م'}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-line text-xs font-bold space-y-1">
                <div className="flex justify-between text-ink-soft">
                  <span>الشحن:</span>
                  <span>{order.shipping} {config?.currency || 'ج.م'}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>الخصم:</span>
                    <span>-{order.discount} {config?.currency || 'ج.م'}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-ink pt-1 border-t border-line">
                  <span>المبلغ الإجمالي:</span>
                  <span className="text-primary">{order.total} {config?.currency || 'ج.م'}</span>
                </div>
              </div>
            </div>

            {/* Customer & Timeline */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-extrabold text-ink-soft uppercase tracking-wider mb-2">
                  بيانات التسليم
                </h4>
                <div className="p-3.5 rounded-card bg-paper border border-line text-xs space-y-1 font-bold text-ink">
                  <p>الاسم: {order.customer?.name}</p>
                  <p>الهاتف: {order.customer?.phone}</p>
                  <p>العنوان: {order.customer?.address} - {order.customer?.city}</p>
                  <p>طريقة الدفع: {order.payment?.method === 'cod' ? 'الدفع عند الاستلام' : 'دفع إلكتروني Paymob'}</p>
                </div>
              </div>

              {/* Timeline Log */}
              {order.timeline && order.timeline.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold text-ink-soft uppercase tracking-wider mb-2">
                    سجل التحديثات
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {order.timeline.map((event, i) => (
                      <div key={i} className="text-xs flex items-start gap-2 text-ink-soft">
                        <Clock className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-ink">{event.note || event.status}</span>
                          <span className="text-[10px] text-ink-soft/70 block">
                            {new Date(event.at).toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
