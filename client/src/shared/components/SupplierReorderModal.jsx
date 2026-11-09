import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageCheck,
  Send,
  Copy,
  ExternalLink,
  Trash2,
  Plus,
  Building2,
  Phone,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../context/StoreContext';

export default function SupplierReorderModal({
  isOpen,
  onClose,
  initialProductIds = [],
  authHeader: customAuthHeader,
  showToast: customShowToast,
  onReorderSuccess
}) {
  const store = useStore?.() || {};
  const showToast = customShowToast || store.showToast || ((msg) => alert(msg));
  const effectiveToken =
    store.token || (typeof window !== 'undefined' ? localStorage.getItem('store_token') : '') || '';
  const authHeader = useMemo(
    () => customAuthHeader || { headers: { Authorization: `Bearer ${effectiveToken}` } },
    [customAuthHeader, effectiveToken]
  );

  const [loadingProposal, setLoadingProposal] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [unassignedProducts, setUnassignedProducts] = useState([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customNotes, setCustomNotes] = useState('');

  const loadProposal = async () => {
    if (!initialProductIds || initialProductIds.length === 0) return;
    setLoadingProposal(true);
    try {
      const res = await axios.post(
        '/api/admin/finance/procurement/reorders/propose',
        { productIds: initialProductIds },
        authHeader
      );
      setProposals(res.data?.proposals || []);
      setUnassignedProducts(res.data?.unassignedProducts || []);
      setActiveGroupIndex(0);
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر توليد مقترح طلب التوريد', 'error');
    } finally {
      setLoadingProposal(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialProductIds.length > 0) {
      loadProposal();
    }
  }, [isOpen, JSON.stringify(initialProductIds)]);

  if (!isOpen) return null;

  const currentGroup = proposals[activeGroupIndex] || null;

  const handleUpdateItemQuantity = (itemIndex, newQty) => {
    if (!currentGroup) return;
    const updatedProposals = [...proposals];
    const group = { ...updatedProposals[activeGroupIndex] };
    const items = [...group.items];
    const item = { ...items[itemIndex], quantity: Math.max(1, parseInt(newQty, 10) || 1) };
    item.lineTotal = item.quantity * (item.unitCost || 0);
    items[itemIndex] = item;
    group.items = items;
    group.totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
    group.totalEstimatedCost = items.reduce((acc, it) => acc + (it.lineTotal || 0), 0);

    // Re-generate WhatsApp text dynamically
    const itemsText = items
      .map(
        (it, idx) =>
          `🔹 *${idx + 1}. ${it.name}*\n   • الكمية المطلوبة: *${it.quantity} قطعة* (المخزون الحالي: ${it.stockCount})`
      )
      .join('\n\n');

    const today = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    group.messageText = [
      `السلام عليكم ورحمة الله وبركاته،`,
      `تحية طيبة إلى السيد/ *${group.supplierName}* المحترم،`,
      ``,
      `📦 *طلب توريد بضاعة جديد*`,
      `📅 *التاريخ:* ${today}`,
      `🏢 *المورد:* ${group.supplierName}${group.specialty ? ` (${group.specialty})` : ''}`,
      ``,
      `يرجى التكرم بتجهيز وتوريد الأصناف والكميات التالية على وجه السرعة:`,
      `---------------------------------`,
      itemsText,
      `---------------------------------`,
      `📊 *إجمالي عدد الوحدات المطلوبة:* *${group.totalQuantity} قطعة*`,
      ``,
      `يرجى موافاتنا بتأكيد الاستلام، الموعد التقريبي للتسليم، والفاتورة المبدئية.`,
      `شاكرين ومقدرين حسن تعاونكم الدائم معنا.`
    ].join('\n');

    const phone = (group.supplierWhatsapp || group.supplierPhone || '').replace(/\D/g, '');
    const cleanPhone = phone.startsWith('0') ? '2' + phone : phone;
    group.directWhatsAppLink = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(group.messageText)}`
      : '';

    updatedProposals[activeGroupIndex] = group;
    setProposals(updatedProposals);
  };

  const handleRemoveItem = (itemIndex) => {
    if (!currentGroup) return;
    const updatedProposals = [...proposals];
    const group = { ...updatedProposals[activeGroupIndex] };
    const items = group.items.filter((_, idx) => idx !== itemIndex);

    if (items.length === 0) {
      // Remove group if empty
      const nextProposals = updatedProposals.filter((_, idx) => idx !== activeGroupIndex);
      setProposals(nextProposals);
      setActiveGroupIndex(0);
      return;
    }

    group.items = items;
    group.totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
    group.totalEstimatedCost = items.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
    updatedProposals[activeGroupIndex] = group;
    setProposals(updatedProposals);
  };

  const handleCopyMessage = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast?.('تم نسخ نص طلب التوريد للحافظة بنجاح 📋');
  };

  const handleDispatchOrder = async (channel = 'whatsapp_direct') => {
    if (!currentGroup) return;
    setIsSubmitting(true);
    try {
      const payload = {
        supplierId: currentGroup.supplierId,
        supplierName: currentGroup.supplierName,
        supplierPhone: currentGroup.supplierPhone,
        supplierWhatsapp: currentGroup.supplierWhatsapp,
        items: currentGroup.items,
        messageText: currentGroup.messageText,
        notes: customNotes,
        channel
      };

      await axios.post(
        '/api/admin/finance/procurement/reorders/dispatch',
        payload,
        authHeader
      );

      showToast?.(`تم اعتماد وتسجيل طلب توريد (${currentGroup.supplierName}) في سجل التدقيق بنجاح ✓`);

      if (channel === 'whatsapp_direct' && currentGroup.directWhatsAppLink) {
        window.open(currentGroup.directWhatsAppLink, '_blank', 'noopener,noreferrer');
      }

      onReorderSuccess?.();

      // If more groups remain, remove this one and stay
      const remaining = proposals.filter((_, idx) => idx !== activeGroupIndex);
      if (remaining.length > 0) {
        setProposals(remaining);
        setActiveGroupIndex(0);
      } else {
        onClose();
      }
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر تسجيل طلب التوريد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-4xl space-y-6 shadow-2xl animate-in zoom-in-95 text-xs font-bold my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink flex items-center gap-2">
                <span>طلب توريد ذكي من الموردين (WhatsApp Procurement Reorder)</span>
                {proposals.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px]">
                    {proposals.length} موردين معنيين
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-ink-soft">
                تجميع وتنسيق الأصناف الحرجة والنافذة حسب كل مورد، وتوليد رسالة واتساب مهيأة للإرسال والاعتماد بنقرة واحدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-btn hover:bg-paper text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingProposal ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-ink">جاري تجميع الأصناف وتحليل الموردين المرتبطين وتوليد طلبات التوريد...</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <p className="text-sm font-black text-ink">لم يتم العثور على موردين مسجلين لهذه المنتجات</p>
            <p className="text-xs text-ink-soft max-w-md mx-auto">
              تأكد من ربط المنتجات بموردين مسجلين في شاشة تعديل المنتج، أو قم بإضافة مورد جديد لربطه بالمنتجات.
            </p>
            {unassignedProducts.length > 0 && (
              <div className="p-4 rounded-card bg-paper border border-line text-right max-w-lg mx-auto space-y-2">
                <span className="text-xs font-black text-ink block">منتجات بدون مورد محدد ({unassignedProducts.length}):</span>
                <div className="flex flex-wrap gap-1.5">
                  {unassignedProducts.map((p) => (
                    <span key={p.productId} className="px-2 py-1 rounded bg-surface border border-line text-[11px]">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-btn bg-paper border border-line text-ink hover:bg-surface text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Supplier Tabs */}
            {proposals.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-line text-xs font-black">
                <span className="text-ink-soft whitespace-nowrap">اختر المورد:</span>
                {proposals.map((prop, idx) => (
                  <button
                    key={prop.supplierId || idx}
                    type="button"
                    onClick={() => setActiveGroupIndex(idx)}
                    className={`px-3 py-2 rounded-btn flex items-center gap-2 transition-all whitespace-nowrap ${
                      activeGroupIndex === idx
                        ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                        : 'bg-paper text-ink border border-line hover:bg-surface'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{prop.supplierName}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                      {prop.items.length} أصناف
                    </span>
                  </button>
                ))}
              </div>
            )}

            {currentGroup && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 7 Columns: Items & Quantities */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Supplier Card */}
                  <div className="p-4 rounded-card bg-paper border border-line flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-sm font-black text-ink">{currentGroup.supplierName}</span>
                        {currentGroup.specialty && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {currentGroup.specialty}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
                        {currentGroup.supplierWhatsapp && (
                          <span className="flex items-center gap-1 text-emerald-600 font-bold">
                            <span>💬 واتساب:</span>
                            <span dir="ltr">{currentGroup.supplierWhatsapp}</span>
                          </span>
                        )}
                        {currentGroup.supplierPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{currentGroup.supplierPhone}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left bg-surface px-3 py-2 rounded-card border border-line">
                      <span className="text-[10px] text-ink-soft block">إجمالي الوحدات المطلوبة</span>
                      <span className="text-base font-black text-primary">
                        {currentGroup.totalQuantity} قطعة
                      </span>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div className="border border-line rounded-card overflow-hidden bg-surface">
                    <div className="p-3 bg-paper border-b border-line flex items-center justify-between text-xs font-black">
                      <span>قائمة الأصناف المطلوبة لهذا المورد ({currentGroup.items.length})</span>
                      <span className="text-ink-soft font-normal text-[11px]">يمكنك تعديل الكمية أو حذف أي صنف</span>
                    </div>

                    <div className="divide-y divide-line max-h-72 overflow-y-auto">
                      {currentGroup.items.map((item, itIdx) => (
                        <div key={item.productId || itIdx} className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={item.image || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                              alt=""
                              className="w-10 h-10 rounded-btn object-cover bg-paper border border-line shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-ink truncate block">
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-ink-soft">
                                <span className={item.stockCount === 0 ? 'text-red-500 font-bold' : 'text-orange-500 font-bold'}>
                                  المخزون الحالي: {item.stockCount} قطعة
                                </span>
                                {item.category && <span>• {item.category}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1">
                              <label className="text-[11px] text-ink-soft">الكمية:</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItemQuantity(itIdx, e.target.value)}
                                className="w-16 bg-paper border border-line rounded-btn p-1.5 text-center text-xs font-black text-ink outline-none focus:border-primary"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(itIdx)}
                              className="p-1.5 rounded-btn hover:bg-red-500/10 text-ink-soft hover:text-red-500 transition-colors"
                              title="حذف هذا الصنف من الطلبية"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right 5 Columns: WhatsApp Message Preview & Dispatch */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-card bg-[#0b141a] text-white border border-emerald-950/40 shadow-inner space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-emerald-900/40 pb-2">
                      <span className="text-emerald-400 font-black flex items-center gap-1.5">
                        <span>💬 معاينة رسالة الواتساب المنسقة</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(currentGroup.messageText)}
                        className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-btn transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>نسخ النص</span>
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-slate-200 bg-black/40 p-3 rounded-lg border border-white/5 select-all">
                      {currentGroup.messageText}
                    </div>

                    <div className="pt-1 flex flex-col gap-2">
                      {/* Action 1: Open WhatsApp Direct */}
                      <a
                        href={currentGroup.directWhatsAppLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDispatchOrder('whatsapp_direct')}
                        className={`w-full py-2.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 ${
                          !currentGroup.directWhatsAppLink ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>فتح واتساب وإرسال الطلب للمورد 📲</span>
                      </a>

                      <div className="flex items-center gap-2">
                        {/* Action 2: Copy Only */}
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyMessage(currentGroup.messageText);
                            handleDispatchOrder('manual_copy');
                          }}
                          className="flex-1 py-2 rounded-btn bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ واعتماد بالدفتر</span>
                        </button>

                        {/* Action 3: Cloud API (if configured) */}
                        <button
                          type="button"
                          disabled={!currentGroup.isWhatsAppApiConfigured || isSubmitting}
                          onClick={() => handleDispatchOrder('whatsapp_api')}
                          className="flex-1 py-2 rounded-btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            currentGroup.isWhatsAppApiConfigured
                              ? 'إرسال آلي فوري عبر WhatsApp Cloud API'
                              : 'يتطلب ربط WhatsApp Cloud API في الإعدادات'
                          }
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>إرسال Cloud API</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
