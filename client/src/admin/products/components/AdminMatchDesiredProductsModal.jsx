import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  CheckCircle2,
  Phone,
  MessageCircle,
  Bell,
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

export default function AdminMatchDesiredProductsModal({
  product,
  isOpen,
  onClose
}) {
  const { token, showToast } = useStore();

  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [notifyingId, setNotifyingId] = useState(null);
  const [notifiedMap, setNotifiedMap] = useState({});

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (!isOpen || !product?._id) {
      setMatches([]);
      setNotifiedMap({});
      return;
    }

    setLoading(true);
    setMatches([]);

    const fetchMatches = axios.post(
      `/api/admin/product-requests/desired-products/match/${product._id}`,
      {},
      authHeader
    );
    const fetchWaStatus = axios.get(
      `/api/admin/product-requests/whatsapp-status`,
      authHeader
    );

    Promise.all([fetchMatches, fetchWaStatus])
      .then(([mRes, waRes]) => {
        setMatches(mRes.data?.matches || []);
        setWhatsAppStatus(waRes.data);
      })
      .catch((err) => {
        console.error('Failed to match desired products:', err);
        showToast('فشل فحص طلبات العملاء المطابقة', 'error');
      })
      .finally(() => setLoading(false));
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleNotifyRequest = async (matchItem) => {
    const reqId = matchItem.desiredProduct._id;
    setNotifyingId(reqId);

    try {
      const isWaReady = whatsAppStatus?.isConfigured;
      const channels = isWaReady ? ['in_app', 'whatsapp'] : ['in_app'];

      const res = await axios.post(
        `/api/admin/product-requests/desired-products/${reqId}/notify`,
        {
          productId: product._id,
          channels
        },
        authHeader
      );

      if (res.data?.success) {
        showToast('تم إرسال إشعار المطابقة للعميل بنجاح');
        setNotifiedMap((prev) => ({
          ...prev,
          [reqId]: {
            done: true,
            directLink: res.data.summary?.directWhatsAppLink
          }
        }));
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل إرسال الإشعار', 'error');
    } finally {
      setNotifyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-surface rounded-3xl border border-line shadow-2xl overflow-hidden text-ink max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-ink">
                مطابقة طلبات العملاء المستقبلية (AI Semantic Vector Matching)
              </h3>
              <p className="text-[11px] text-ink-soft">
                فحص الطلبات المحفوظة مسبقاً التي تطابق مواصفات هذا المنتج دلالياً
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

        {/* Product Snapshot Bar */}
        <div className="px-6 py-3 bg-paper border-b border-line flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-ink truncate">المنتج: {product.name}</span>
            <span className="text-primary font-extrabold shrink-0">
              ({product.price?.toLocaleString()} ج.م)
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-black shrink-0">
            {matches.length} طلبات مطابقة
          </span>
        </div>

        {/* Body List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-ink-soft">
              جاري فحص الطلبات وحساب درجات التشابه الدلالي (Cosine Similarity)...
            </div>
          ) : matches.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-line rounded-2xl">
              <Search className="w-8 h-8 text-ink-soft mx-auto opacity-50" />
              <h5 className="text-xs font-black text-ink">لا توجد طلبات مطابقة حالياً</h5>
              <p className="text-[11px] text-ink-soft max-w-sm mx-auto">
                لم يسجل أي عميل رغبة في منتج يحمل مواصفات مشابهة لهذا المنتج حتى الآن.
              </p>
            </div>
          ) : (
            matches.map((item) => {
              const req = item.desiredProduct;
              const scorePct = Math.round(item.similarityScore * 100);
              const notificationState = notifiedMap[req._id];

              return (
                <div
                  key={req._id}
                  className="p-4 rounded-2xl border border-line bg-paper/50 hover:bg-paper transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 font-black text-xs">
                          {scorePct}% نسبة التطابق
                        </span>
                        {req.categoryName && (
                          <span className="px-2 py-0.5 rounded-md bg-paper border border-line text-[10px] font-bold text-ink-soft">
                            {req.categoryName}
                          </span>
                        )}
                        <span className="text-[10px] text-ink-soft">
                          {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>

                      <h4 className="font-black text-xs text-ink mt-1">
                        طلب العميل: "{req.queryText}"
                      </h4>
                      {req.extractedName && req.extractedName !== req.queryText && (
                        <p className="text-[11px] text-primary font-bold">
                          المستخلص: {req.extractedName}
                        </p>
                      )}
                    </div>

                    {/* Notification Status / Action */}
                    {notificationState?.done || req.status === 'notified' ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم الإشعار</span>
                        </span>
                        {notificationState?.directLink && (
                          <a
                            href={notificationState.directLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-0.5"
                          >
                            <span>فتح واتساب</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={notifyingId === req._id}
                        onClick={() => handleNotifyRequest(item)}
                        className="py-1.5 px-3 rounded-btn bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {notifyingId === req._id ? 'جاري الإرسال...' : 'إشعار العميل'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Specs Badges */}
                  {req.specs && Object.keys(req.specs).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(req.specs).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 rounded-lg bg-surface border border-line text-[10px] font-bold text-ink"
                        >
                          <b>{k}:</b> {String(v)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Customer Contact Info */}
                  <div className="flex items-center justify-between text-[11px] text-ink-soft pt-1 border-t border-line/60">
                    <div className="flex items-center gap-3">
                      {req.customerName && <span>العميل: {req.customerName}</span>}
                      {req.phone ? (
                        <span className="font-mono" dir="ltr">
                          📱 {req.phone}
                        </span>
                      ) : (
                        <span>جهاز الزائر: {req.visitorId?.slice(0, 10)}...</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold">
                      القناة: {req.channelPreference === 'both' ? 'متجر + واتساب' : req.channelPreference}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
