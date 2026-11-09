import React, { useState } from 'react';
import { X, Wrench, CheckCircle2, Clock, Send, Printer, MessageCircle, DollarSign, AlertCircle } from 'lucide-react';
import axios from 'axios';

/**
 * LabOrderActionModal
 * Allows updating the workshop status of a glasses order,
 * collecting remaining balance, printing workshop slip, and notifying customer via WhatsApp.
 */
export default function LabOrderActionModal({
  order,
  onClose,
  onUpdated,
  onPrintSlip,
  showToast,
  token,
  currency = 'ج.م'
}) {
  if (!order) return null;

  const currentStatus = order.labStatus || 'pending_lab';
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [remainingCollected, setRemainingCollected] = useState('');
  const [labNotes, setLabNotes] = useState(order.labNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pays = order.paymentsSnapshot || {
    totalAmount: order.total,
    paidAmount: order.total,
    remainingAmount: 0
  };

  const remaining = Number(pays.remainingAmount || 0);

  const statusOptions = [
    {
      key: 'pending_lab',
      label: '1. قيد الانتظار بالمعمل',
      desc: 'الطلب مسجل وبانتظار بدء التجهيز وقص العدسات',
      color: 'border-amber-500/40 bg-amber-500/10 text-amber-500'
    },
    {
      key: 'in_lab',
      label: '2. جاري التجهيز والقص',
      desc: 'النظارة بالورشة قيد التركيب والضبط',
      color: 'border-blue-500/40 bg-blue-500/10 text-blue-500'
    },
    {
      key: 'ready',
      label: '3. جاهزة للاستلام بالفرع',
      desc: 'تم استلامها من المعمل وجاهزة لتسليمها للعميل',
      color: 'border-purple-500/40 bg-purple-500/10 text-purple-500'
    },
    {
      key: 'delivered',
      label: '4. تم التسليم للعميل',
      desc: 'تم فحص النظارة مع العميل واستلامها بالكامل',
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
    }
  ];

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      const extraPaid = Number(remainingCollected) || 0;
      const res = await axios.put(
        `/api/admin/orders/${order._id}/lab-status`,
        {
          labStatus: selectedStatus,
          remainingPaymentCollected: extraPaid,
          notes: labNotes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast(res.data?.message || 'تم تحديث حالة أمر الشغل بنجاح', 'success');
      if (onUpdated) onUpdated(res.data?.order || { ...order, labStatus: selectedStatus });
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث حالة أمر الشغل', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsAppNotification = () => {
    const phone = order.customer?.phone || '';
    if (!phone) {
      showToast('رقم هاتف العميل غير متوفر', 'error');
      return;
    }

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('0')) cleanPhone = '20' + cleanPhone.substring(1);
      else cleanPhone = '20' + cleanPhone;
    } else {
      cleanPhone = cleanPhone.replace('+', '');
    }

    let text = `مرحباً ${order.customer?.name || 'عميلنا العزيز'}،\n`;
    if (selectedStatus === 'ready') {
      text += `يسرنا إبلاغك بأن نظارتك الطبية (رقم الطلب: ${order.orderId}) أصبحت *جاهزة للاستلام* في فرعنا 👓✨.\n`;
      if (remaining > 0) {
        text += `المتبقي للحساب: ${remaining} ${currency}.\n`;
      }
      text += `نسعد بزيارتك لاستلام النظارة وعمل الضبط النهائي. شكراً لاختيارك لنا!`;
    } else if (selectedStatus === 'in_lab') {
      text += `نفيدك بأن نظارتك (طلب: ${order.orderId}) قيد التجهيز وقص العدسات في المعمل حالياً.\nموعد الاستلام المتوقع: ${order.labDeliveryDate ? new Date(order.labDeliveryDate).toLocaleDateString('ar-EG') : 'قريباً'}.\nشكراً لثقتكم.`;
    } else {
      text += `بخصوص طلبكم رقم ${order.orderId}، نود إعلامكم بأن الحالة الحالية هي: ${statusOptions.find(s => s.key === selectedStatus)?.label}.\nشكراً لثقتكم.`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-line rounded-card shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col text-right">
        {/* Header */}
        <div className="p-4 bg-paper border-b border-line flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1.5 rounded-btn hover:bg-surface text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-base font-black text-ink flex items-center gap-2 justify-end">
                <span>متابعة وتحديث أمر المعمل والتجهيز</span>
                <Wrench className="w-5 h-5 text-blue-500" />
              </h2>
              <p className="text-xs text-ink-soft">
                الطلب رقم: <span className="font-mono font-bold text-ink">{order.orderId}</span> - العميل:{' '}
                <span className="font-bold text-ink">{order.customer?.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Prescription Snapshot Box */}
          {order.prescriptionSnapshot && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-ink-soft">
                  تاريخ التسليم المحدد بالمعمل: {' '}
                  <strong className="text-ink">
                    {order.labDeliveryDate ? new Date(order.labDeliveryDate).toLocaleDateString('ar-EG') : 'غير محدد'}
                  </strong>
                </span>
                <h4 className="font-black text-blue-700 dark:text-blue-400">مقاسات العدسات بالروشتة المحفوظة</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center font-mono">
                <div className="bg-surface/80 p-2 rounded-lg border border-line">
                  <div className="font-bold text-ink mb-1 text-[11px]">العين اليمنى (OD / Right)</div>
                  <div className="text-ink-soft text-[10px]">
                    SPH: {order.prescriptionSnapshot.rightEye?.sph || '0.00'} | CYL: {order.prescriptionSnapshot.rightEye?.cyl || '0.00'} | AXIS: {order.prescriptionSnapshot.rightEye?.axis || '0'}°
                  </div>
                </div>
                <div className="bg-surface/80 p-2 rounded-lg border border-line">
                  <div className="font-bold text-ink mb-1 text-[11px]">العين اليسرى (OS / Left)</div>
                  <div className="text-ink-soft text-[10px]">
                    SPH: {order.prescriptionSnapshot.leftEye?.sph || '0.00'} | CYL: {order.prescriptionSnapshot.leftEye?.cyl || '0.00'} | AXIS: {order.prescriptionSnapshot.leftEye?.axis || '0'}°
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Selection Cards */}
          <div>
            <label className="block text-ink font-bold mb-2">اختر مرحلة التشغيل بالمعمل:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {statusOptions.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(st.key);
                    if (st.key === 'delivered' && remaining > 0 && !remainingCollected) {
                      setRemainingCollected(String(remaining));
                    }
                  }}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    selectedStatus === st.key
                      ? `${st.color} ring-2 ring-primary shadow-sm font-black`
                      : 'border-line bg-surface hover:bg-paper text-ink'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-xs">{st.label}</span>
                    {selectedStatus === st.key && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-ink-soft opacity-80">{st.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Financial Breakdown & Balance Collection */}
          <div className="p-4 rounded-xl bg-paper border border-line space-y-3">
            <h4 className="font-black text-ink flex items-center justify-between">
              <span>الموقف المالي للطلب</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface p-2 rounded-lg border border-line">
                <div className="text-ink-soft text-[11px]">إجمالي الفاتورة</div>
                <div className="text-sm font-black text-ink">{pays.totalAmount} {currency}</div>
              </div>
              <div className="bg-surface p-2 rounded-lg border border-line">
                <div className="text-ink-soft text-[11px]">المدفوع سلفاً</div>
                <div className="text-sm font-black text-emerald-600">{pays.paidAmount} {currency}</div>
              </div>
              <div className={`p-2 rounded-lg border ${remaining > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface border-line'}`}>
                <div className="text-ink-soft text-[11px]">المتبقي للتحصيل</div>
                <div className={`text-sm font-black ${remaining > 0 ? 'text-amber-600 font-mono' : 'text-emerald-600'}`}>
                  {remaining} {currency}
                </div>
              </div>
            </div>

            {remaining > 0 && (
              <div className="pt-2 border-t border-line">
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => setRemainingCollected(String(remaining))}
                    className="text-[11px] text-primary hover:underline font-bold"
                  >
                    تحصيل كامل المتبقي ({remaining} {currency})
                  </button>
                  <label className="text-xs font-bold text-ink">تحصيل متبقي نقدًا من العميل الآن:</label>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={remaining}
                    value={remainingCollected}
                    onChange={(e) => setRemainingCollected(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface border border-line rounded-btn px-3 py-2 text-sm font-bold text-ink outline-none focus:border-primary text-center font-mono"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-soft">
                    {currency}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-ink font-bold mb-1">ملاحظات المعمل والتشغيل:</label>
            <input
              type="text"
              value={labNotes}
              onChange={(e) => setLabNotes(e.target.value)}
              placeholder="مثال: تم إرسال الشمبر لورشة كذا / تم تسليم العدسات كود..."
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          {/* Action helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={handleSendWhatsAppNotification}
              className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-bold flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إشعار العميل عبر واتساب</span>
            </button>

            {onPrintSlip && (
              <button
                type="button"
                onClick={() => onPrintSlip(order)}
                className="px-3 py-2 rounded-xl border border-line bg-surface hover:bg-paper text-ink font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4 text-ink-soft" />
                <span>طباعة إيصال الشغل الحراري (80mm)</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-paper border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-btn border border-line bg-surface hover:bg-paper text-ink font-bold transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black hover:opacity-95 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>جاري الحفظ...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ التحديثات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
