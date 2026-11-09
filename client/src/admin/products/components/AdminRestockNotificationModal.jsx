import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  MessageCircle,
  Send,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Users,
  ShieldAlert
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

export default function AdminRestockNotificationModal({
  product,
  isOpen,
  onClose,
  onNotified
}) {
  const { token, showToast } = useStore();

  const [loading, setLoading] = useState(false);
  const [waitlistData, setWaitlistData] = useState(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [channels, setChannels] = useState(['in_app']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (!isOpen || !product?._id) {
      setWaitlistData(null);
      setResultSummary(null);
      return;
    }

    setLoading(true);
    setResultSummary(null);

    // Fetch waitlist count and details
    const fetchWaitlist = axios.get(
      `/api/admin/product-requests/waitlists/${product._id}`,
      authHeader
    );
    // Fetch WhatsApp credentials status
    const fetchWaStatus = axios.get(
      `/api/admin/product-requests/whatsapp-status`,
      authHeader
    );

    Promise.all([fetchWaitlist, fetchWaStatus])
      .then(([wRes, waRes]) => {
        setWaitlistData(wRes.data);
        setWhatsAppStatus(waRes.data);
        if (waRes.data?.isConfigured) {
          setChannels(['in_app', 'whatsapp']);
        } else {
          setChannels(['in_app']);
        }
      })
      .catch((err) => {
        console.error('Failed to load waitlist/wa status:', err);
        showToast('فشل جلب بيانات قائمة الانتظار', 'error');
      })
      .finally(() => setLoading(false));
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleToggleChannel = (chan) => {
    if (chan === 'whatsapp' && !whatsAppStatus?.isConfigured) {
      return; // Disabled if not configured
    }
    setChannels((prev) =>
      prev.includes(chan) ? prev.filter((c) => c !== chan) : [...prev, chan]
    );
  };

  const handleSendNotifications = async () => {
    if (channels.length === 0) {
      showToast('يرجى اختيار قناة إرسال واحدة على الأقل', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await axios.post(
        `/api/admin/product-requests/waitlists/${product._id}/notify`,
        {
          channels,
          customMessage: customMessage.trim()
        },
        authHeader
      );

      if (res.data?.success) {
        setResultSummary(res.data.summary);
        showToast(res.data.message || 'تم إرسال إشعارات التوفر بنجاح');
        if (onNotified) onNotified();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل إرسال الإشعارات', 'error');
    } finally {
      setSending(false);
    }
  };

  const waitingCount = waitlistData?.waitingCount || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-surface rounded-3xl border border-line shadow-2xl overflow-hidden text-ink max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-ink">إشعار قائمة انتظار توفر المنتج</h3>
              <p className="text-[11px] text-ink-soft">
                إرسال إشعارات للعملاء المنتظرين فور توفر المنتج في المخزون
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-paper text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Product Snapshot */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-paper border border-line">
            <img
              src={
                product.images?.[0] ||
                product.image ||
                'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'
              }
              alt={product.name}
              className="w-12 h-12 rounded-xl object-cover border border-line/60 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-black text-xs text-ink truncate">{product.name}</h4>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="font-extrabold text-primary">
                  السعر: {product.price?.toLocaleString()} ج.م
                </span>
                <span className="text-ink-soft font-bold">
                  المخزون الحالي: <b className="text-ink">{product.stockCount}</b>
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-ink-soft">
              جاري فحص قائمة الانتظار وحالة الواتساب...
            </div>
          ) : resultSummary ? (
            /* Results Screen */
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-sm">تم إرسال الإشعارات بنجاح!</h4>
                  <p className="text-xs">
                    إجمالي المنتظرين: <b>{resultSummary.totalWaiting}</b> | إشعارات داخل المتجر:{' '}
                    <b>{resultSummary.inAppSent}</b> | رسائل واتساب آلية:{' '}
                    <b>{resultSummary.whatsAppSent}</b>
                  </p>
                </div>
              </div>

              {/* Direct WhatsApp Links if API was unconfigured or fallback needed */}
              {resultSummary.directWhatsAppLinks && resultSummary.directWhatsAppLinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-ink">
                    <span>روابط المراسلة المباشرة عبر واتساب ويب (wa.me):</span>
                    <span className="text-[10px] text-ink-soft font-bold">
                      ({resultSummary.directWhatsAppLinks.length} عميل)
                    </span>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-line divide-y divide-line bg-paper">
                    {resultSummary.directWhatsAppLinks.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-surface transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink truncate">{item.name}</p>
                          <p className="text-[10px] text-ink-soft font-mono" dir="ltr">
                            {item.phone}
                          </p>
                        </div>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>فتح واتساب</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-btn bg-paper hover:bg-surface border border-line text-xs font-black text-ink transition-all"
              >
                إغلاق
              </button>
            </div>
          ) : (
            /* Notification Dispatch Form */
            <div className="space-y-4">
              {/* Waiting Count Stat */}
              <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-orange-600" />
                  <div>
                    <h5 className="font-black text-xs text-ink">العملاء بانتظار هذا المنتج:</h5>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      تم تسجيلهم عبر زر "تنبيه عند التوفر" في المتجر
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-orange-500 text-white font-black text-base shadow-sm">
                  {waitingCount} عميل
                </div>
              </div>

              {waitingCount === 0 ? (
                <div className="py-6 text-center text-xs font-bold text-ink-soft border border-dashed border-line rounded-2xl">
                  لا توجد طلبات انتظار معلقة لهذا المنتج حالياً.
                </div>
              ) : (
                <>
                  {/* Channels Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-ink">
                      اختر قنوات إرسال الإشعار:
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {/* In-App Channel */}
                      <button
                        type="button"
                        onClick={() => handleToggleChannel('in_app')}
                        className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 ${
                          channels.includes('in_app')
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-line bg-paper text-ink-soft'
                        }`}
                      >
                        <Bell
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            channels.includes('in_app') ? 'text-primary' : ''
                          }`}
                        />
                        <div className="min-w-0">
                          <h6 className="font-black text-xs text-ink">إشعار داخل المتجر (In-App)</h6>
                          <p className="text-[10px] text-ink-soft mt-0.5">
                            يظهر في جرس الإشعارات بحساب العميل وجهازه
                          </p>
                        </div>
                      </button>

                      {/* WhatsApp Channel */}
                      <button
                        type="button"
                        disabled={!whatsAppStatus?.isConfigured}
                        onClick={() => handleToggleChannel('whatsapp')}
                        className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 ${
                          !whatsAppStatus?.isConfigured
                            ? 'border-line bg-paper/50 opacity-60 cursor-not-allowed'
                            : channels.includes('whatsapp')
                            ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                            : 'border-line bg-paper text-ink-soft'
                        }`}
                        title={
                          !whatsAppStatus?.isConfigured
                            ? 'خدمة واتساب السحابية غير مفعلة (يتطلب إعداد التوكن في الإعدادات)'
                            : ''
                        }
                      >
                        <MessageCircle
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            channels.includes('whatsapp') ? 'text-emerald-600' : ''
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h6 className="font-black text-xs text-ink">رسائل واتساب</h6>
                            {!whatsAppStatus?.isConfigured && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
                                معطل
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-ink-soft mt-0.5">
                            {whatsAppStatus?.isConfigured
                              ? 'إرسال آلي عبر WhatsApp Cloud API'
                              : 'غير مفعل (يمكنك استخدام روابط wa.me اليدوية)'}
                          </p>
                        </div>
                      </button>
                    </div>

                    {!whatsAppStatus?.isConfigured && (
                      <div className="p-2.5 rounded-xl bg-paper border border-line flex items-center gap-2 text-[11px] text-ink-soft">
                        <ShieldAlert className="w-4 h-4 text-orange-500 shrink-0" />
                        <span>
                          ملاحظة: يمكنك إرسال إشعارات داخل المتجر، وسيتم تزويدك بروابط WhatsApp المباشرة للتواصل اليدوي إن رغبت.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Custom Message (Optional) */}
                  <div>
                    <label className="block text-xs font-black text-ink mb-1">
                      نص الرسالة المخصصة (اختياري):
                    </label>
                    <textarea
                      rows={3}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder={`يسعدنا إخبارك بأن منتج "${product.name}" أصبح متوفراً الآن في المتجر! سارع بالطلب قبل نفاد الكمية.`}
                      className="w-full p-3 rounded-2xl bg-paper border border-line text-xs font-medium text-ink focus:border-primary outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={sending || channels.length === 0}
                      onClick={handleSendNotifications}
                      className="flex-1 py-3 px-4 rounded-btn bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {sending
                          ? 'جاري إرسال الإشعارات...'
                          : `إرسال الإشعارات لـ ${waitingCount} عميل`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-3 rounded-btn bg-paper hover:bg-surface border border-line text-xs font-bold text-ink transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
