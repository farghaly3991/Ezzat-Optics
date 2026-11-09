import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  Building2,
  Calendar,
  DollarSign,
  MessageCircle,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Star,
  Layers,
  Send,
  Glasses,
  Check
} from 'lucide-react';
import axios from 'axios';

export default function WorkOrderModal({
  isOpen,
  onClose,
  order,
  existingWorkOrder = null,
  labs = [],
  authHeader,
  showToast,
  onSuccess,
  onSaveDraftConfig
}) {
  if (!isOpen || !order) return null;

  const [selectedLabId, setSelectedLabId] = useState(
    existingWorkOrder?.labId?._id || existingWorkOrder?.labId || labs[0]?._id || ''
  );
  const [expectedDate, setExpectedDate] = useState(
    existingWorkOrder?.expectedDeliveryDate
      ? new Date(existingWorkOrder.expectedDeliveryDate).toISOString().split('T')[0]
      : ''
  );
  const [labCost, setLabCost] = useState(existingWorkOrder?.financials?.labCost || 0);
  const [shippingCost, setShippingCost] = useState(existingWorkOrder?.financials?.shippingCost || 0);
  const [extraCost, setExtraCost] = useState(existingWorkOrder?.financials?.extraCost || 0);
  const [paidAmount, setPaidAmount] = useState(existingWorkOrder?.financials?.paidAmount || 0);
  const [notes, setNotes] = useState(existingWorkOrder?.notes || '');
  const [loading, setLoading] = useState(false);

  // Active work order state (if viewing existing)
  const [activeWO, setActiveWO] = useState(existingWorkOrder);
  const [selectedStageKey, setSelectedStageKey] = useState(existingWorkOrder?.currentStage || 'received');
  const [stageNotes, setStageNotes] = useState('');
  const [rating, setRating] = useState(existingWorkOrder?.adminFeedback?.rating || 5);
  const [ratingComment, setRatingComment] = useState(existingWorkOrder?.adminFeedback?.comment || '');

  // Find currently selected lab object
  const activeLab = labs.find((l) => String(l._id) === String(selectedLabId)) || labs[0] || {};
  const stages = activeLab.customStages || [
    { key: 'received', label: 'استلام أمر الشغل' },
    { key: 'processing', label: 'جاري التجهيز والقص' },
    { key: 'assembly', label: 'التركيب والمعايرة الدقيقة' },
    { key: 'ready', label: 'جاهز للاستلام من المعمل' },
    { key: 'delivered', label: 'تم الاستلام بالفرع وجاهز للعميل' }
  ];

  // If order has existing workOrderId but existingWorkOrder wasn't passed in full, fetch it
  useEffect(() => {
    if (order.workOrderId && !activeWO) {
      axios
        .get(`/api/admin/work-orders/${order.workOrderId}`, authHeader)
        .then((res) => {
          if (res.data?.workOrder) {
            setActiveWO(res.data.workOrder);
            setSelectedLabId(res.data.workOrder.labId?._id || res.data.workOrder.labId);
            setSelectedStageKey(res.data.workOrder.currentStage);
            setLabCost(res.data.workOrder.financials?.labCost || 0);
            setShippingCost(res.data.workOrder.financials?.shippingCost || 0);
            setPaidAmount(res.data.workOrder.financials?.paidAmount || 0);
            if (res.data.workOrder.adminFeedback?.rating) {
              setRating(res.data.workOrder.adminFeedback.rating);
              setRatingComment(res.data.workOrder.adminFeedback.comment || '');
            }
          }
        })
        .catch((err) => console.warn('Could not load work order:', err));
    }
  }, [order, activeWO]);

  // Handle Create Work Order
  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!selectedLabId) {
      showToast('يرجى تحديد المعمل أو الورشة أولاً', 'error');
      return;
    }

    if (order.isDraft || !order.orderId) {
      if (onSaveDraftConfig) {
        const selectedLab = labs.find((l) => String(l._id) === String(selectedLabId));
        onSaveDraftConfig({
          labId: selectedLabId,
          labName: selectedLab?.name || 'معمل مختار',
          expectedDeliveryDate: expectedDate || null,
          financials: {
            labCost: Number(labCost || 0),
            shippingCost: Number(shippingCost || 0),
            extraCost: Number(extraCost || 0),
            paidAmount: Number(paidAmount || 0),
            isPaidToLab: Number(paidAmount) >= Number(labCost) + Number(shippingCost) + Number(extraCost)
          },
          notes
        });
        showToast('تم ضبط وتجهيز أمر التشغيل للمعمل بنجاح');
        onClose();
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        orderId: order.orderId,
        labId: selectedLabId,
        expectedDeliveryDate: expectedDate || null,
        financials: {
          labCost: Number(labCost || 0),
          shippingCost: Number(shippingCost || 0),
          extraCost: Number(extraCost || 0),
          paidAmount: Number(paidAmount || 0),
          isPaidToLab: Number(paidAmount) >= Number(labCost) + Number(shippingCost) + Number(extraCost)
        },
        notes
      };

      const res = await axios.post('/api/admin/work-orders', payload, authHeader);
      showToast(res.data?.message || 'تم إصدار أمر التشغيل بنجاح');
      setActiveWO(res.data.workOrder);
      if (onSuccess) onSuccess(res.data.workOrder);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر إصدار أمر التشغيل', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Stage Update
  const handleUpdateStage = async (newStageKey) => {
    if (!activeWO) return;
    const stageObj = stages.find((s) => s.key === newStageKey);
    setLoading(true);
    try {
      const res = await axios.put(
        `/api/admin/work-orders/${activeWO._id}/stage`,
        {
          stageKey: newStageKey,
          stageLabel: stageObj?.label || newStageKey,
          notes: stageNotes
        },
        authHeader
      );
      showToast(res.data?.message || 'تم تحديث مرحلة أمر التشغيل');
      setActiveWO(res.data.workOrder);
      setSelectedStageKey(newStageKey);
      setStageNotes('');
      if (onSuccess) onSuccess(res.data.workOrder);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث المرحلة', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Financials Update
  const handleUpdateFinancials = async () => {
    if (!activeWO) return;
    setLoading(true);
    try {
      const res = await axios.put(
        `/api/admin/work-orders/${activeWO._id}/financials`,
        {
          labCost: Number(labCost || 0),
          shippingCost: Number(shippingCost || 0),
          extraCost: Number(extraCost || 0),
          paidAmount: Number(paidAmount || 0)
        },
        authHeader
      );
      showToast('تم تحديث مصاريف أمر التشغيل ومزامنتها بنجاح');
      setActiveWO(res.data.workOrder);
      if (onSuccess) onSuccess(res.data.workOrder);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث المصاريف', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Rate Work Order
  const handleRateLab = async () => {
    if (!activeWO) return;
    setLoading(true);
    try {
      const res = await axios.put(
        `/api/admin/work-orders/${activeWO._id}/rate`,
        {
          rating,
          comment: ratingComment
        },
        authHeader
      );
      showToast('تم حفظ تقييم وملاحظات أداء المعمل بنجاح ⭐');
      setActiveWO(res.data.workOrder);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل التقييم', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate WhatsApp Message & Send to Lab
  const handleSendWhatsAppToLab = () => {
    const rawPhone = activeLab.whatsappPhone || activeLab.phone || '01011180841';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '20' + cleanPhone.substring(1) : cleanPhone;

    const publicUrl = `${window.location.origin}/lab/work-order/${activeWO?.publicTrackingToken || ''}`;

    const itemsSummary = (activeWO?.items || order.items || [])
      .map((it, idx) => {
        const slotText = it.unitSlotLabel ? `【${it.unitSlotLabel}】` : '';
        const specsText = it.specs?.sph
          ? `(SPH: ${it.specs.sph} | CYL: ${it.specs.cyl || '0.00'})`
          : it.lensSpecs?.sph
          ? `(SPH: ${it.lensSpecs.sph} | CYL: ${it.lensSpecs.cyl || '0.00'})`
          : '';
        return `▫️ ${it.name} ${slotText} ${specsText}`;
      })
      .join('\n');

    const msg = `📋 *أمر تشغيل معمل وتجهيز نظارة (Work Order)*
🏛️ *المرسل:* مركز البصريات (HI LUXE)
🔬 *المعمل / الورشة:* ${activeLab.name || 'معمل البصريات'}

🏷️ *رقم أمر الشغل:* #${activeWO?.workOrderNumber || 'WO-جديد'}
🔢 *رقم الفاتورة الأصلية:* #${order.orderId}
👤 *اسم العميل:* ${order.customer?.name || 'عميل المتجر'}

👓 *الأصناف المطلوب تركيبها وتجهيزها:*
${itemsSummary}

${expectedDate ? `📅 *موعد التسليم المطلوب:* ${expectedDate}\n` : ''}
${notes ? `📝 *تعليمات وملاحظات فنية:* ${notes}\n` : ''}
🔗 *رابط المتابعة وتحديث المرحلة الذكي للمعمل:*
${publicUrl}

برجاء تأكيد استلام أمر الشغل والبدء في التجهيز. شكراً جزيلاً!`;

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const copyPublicLink = () => {
    if (!activeWO?.publicTrackingToken) return;
    const publicUrl = `${window.location.origin}/lab/work-order/${activeWO.publicTrackingToken}`;
    navigator.clipboard.writeText(publicUrl);
    showToast('تم نسخ رابط متابعة المعمل للمحفظة ✓');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl space-y-4 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  {activeWO ? `أمر تشغيل معمل: #${activeWO.workOrderNumber}` : 'إصدار أمر تشغيل ورشة / معمل خارجي'}
                </h3>
                {activeWO && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {activeWO.currentStageLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                مرتبط بالطلب #{order.orderId} · العميل: {order.customer?.name} ({order.customer?.phone || 'بدون هاتف'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Work Order View vs Create Form */}
        {activeWO ? (
          <div className="space-y-4">
            {/* Stage Progress Pipeline Stepper */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-blue-950 dark:text-blue-200">
                <span>مسار تنفيذ ومراحل العمل بالورشة:</span>
                <span className="font-mono text-[11px] text-blue-700">
                  المعمل: {activeWO.labName || activeLab.name}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                {stages.map((st, idx) => {
                  const isCurrent = activeWO.currentStage === st.key;
                  const isPassed = activeWO.stageHistory?.some((h) => h.stageKey === st.key);

                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleUpdateStage(st.key)}
                      disabled={loading}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition-all relative ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-102 font-black'
                          : isPassed
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <span className="text-[10px] opacity-70">#{idx + 1}</span>
                        {isPassed && !isCurrent && <Check className="w-3 h-3 text-emerald-600" />}
                      </div>
                      <div className="truncate">{st.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Turnaround Time Display if Received */}
              {activeWO.turnaroundHours !== null && activeWO.turnaroundHours !== undefined && (
                <div className="p-2.5 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    <span>تم الاستلام وإنهاء أمر الشغل في:</span>
                  </div>
                  <span className="font-mono text-sm font-black">{activeWO.turnaroundHours} ساعة (SLA)</span>
                </div>
              )}
            </div>

            {/* Items Included in Work Order */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-black text-slate-700 dark:text-slate-300 block">
                الأصناف المرسلة في أمر التشغيل:
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {(activeWO.items || []).map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Glasses className="w-3.5 h-3.5 text-blue-600" />
                        <span>{it.name}</span>
                        {it.unitSlotLabel && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                            {it.unitSlotLabel}
                          </span>
                        )}
                      </div>
                      {it.specs?.sph && (
                        <div className="text-[11px] font-mono font-bold text-blue-700 mt-0.5">
                          SPH: {it.specs.sph} | CYL: {it.specs.cyl || '0.00'}
                        </div>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-500">الكمية: {it.quantity || 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financials & Expenses Sync */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>مصاريف أمر التشغيل وحساب المعمل:</span>
                </div>
                <span className="text-[11px] font-normal text-slate-500">
                  تُسجل تلقائياً في خانة مصاريف الأوردر لحساب صافي الربح
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">تكلفة المعمل (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={labCost}
                    onChange={(e) => setLabCost(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 font-mono font-bold text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">مصاريف الشحن (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 font-mono font-bold text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">المبلغ المدفوع (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 font-mono font-bold text-xs outline-none text-emerald-700"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleUpdateFinancials}
                    disabled={loading}
                    className="w-full py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-black transition-colors"
                  >
                    حفظ المصروف
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Links & WhatsApp Actions */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-black text-emerald-900 dark:text-emerald-200 block">
                  رابط المتابعة وتحديث المراحل السريع للمعمل:
                </span>
                <span className="text-[10px] text-emerald-700 opacity-80 font-mono truncate max-w-sm block">
                  {window.location.origin}/lab/work-order/{activeWO.publicTrackingToken}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyPublicLink}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 font-bold text-emerald-800 text-xs flex items-center gap-1 hover:bg-emerald-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الرابط</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendWhatsAppToLab}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>واتساب المعمل</span>
                </button>
              </div>
            </div>

            {/* Performance Rating by Admin */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-black text-amber-950 dark:text-amber-200">
                <span>تقييم أداء المعمل في هذا الأمر (SLA Quality Rating):</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-base transition-transform ${star <= rating ? 'text-amber-500 scale-110' : 'text-slate-300'}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="font-mono text-xs font-bold mr-1">{rating}/5</span>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ملاحظة حول دقة القص، السرعة، المعايرة..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 text-xs font-bold outline-none"
                />
                <button
                  type="button"
                  onClick={handleRateLab}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-xs"
                >
                  حفظ التقييم
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Create Form */
          <form onSubmit={handleCreateWorkOrder} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اختيار الورشة / المعمل الخارجي *
                </label>
                <select
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none focus:border-blue-500"
                  required
                >
                  {labs.map((lab) => (
                    <option key={lab._id} value={lab._id}>
                      {lab.name} ({lab.city}) · تقييم: {lab.rating?.score || 5}★ · {lab.specialty}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Preview */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-black text-slate-800 dark:text-slate-200 block">
                  الأصناف التي سيتم إدراجها في أمر التشغيل ({order.items?.length || 0}):
                </span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {(order.items || []).map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {it.name}
                        </span>
                        {it.lensSpecs?.sph && (
                          <span className="text-[10px] font-mono font-bold text-blue-600 block">
                            SPH: {it.lensSpecs.sph} | CYL: {it.lensSpecs.cyl || '0.00'}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500 font-bold">{it.quantity} قطعة</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected Delivery Date & Financials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">موعد التسليم المتوقع من المعمل:</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تكلفة أمر الشغل (ج.م):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={labCost}
                    onChange={(e) => setLabCost(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">مصاريف الشحن / الدليفري (ج.م):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات وتعليمات القص والتركيب للمعمل:</label>
                <input
                  type="text"
                  placeholder="شطف خاص، قص نايلور، بدون إطار، سنفرة حواف..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Wrench className="w-4 h-4" />
                <span>{loading ? 'جاري الإصدار...' : 'إصدار أمر التشغيل وتوليد الرابط الذكي'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
