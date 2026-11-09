import React, { useState } from 'react';
import {
  X,
  Trash2,
  RotateCcw
} from 'lucide-react';
import axios from 'axios';
import CorrectionReversalModal from './CorrectionReversalModal';

const SHIPMENT_STATUS_LABELS = {
  draft: 'مسودة (Draft)',
  ordered: 'تم الطلب من المورد (Ordered)',
  in_transit: 'في الطريق (In Transit)',
  partially_received: 'مستلم جزئياً (Partially Received)',
  received: 'تم الاستلام (Received)',
  cancelled: 'ملغاة (Cancelled)'
};

export default function ShipmentDetailsModal({
  activeShipmentDetails,
  onClose,
  catalogProducts = [],
  currency = 'ج.م',
  authHeader,
  showToast,
  onRefreshDetails,
  onRefreshParent
}) {
  const [addLineForm, setAddLineForm] = useState({
    productId: '',
    quantity: 1,
    unitCost: '',
    note: '',
    syncProductCostPrice: false
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'cash',
    referenceNote: ''
  });

  const [dueDateEdit, setDueDateEdit] = useState({
    dueDate: activeShipmentDetails?.shipment?.dueDate
      ? new Date(activeShipmentDetails.shipment.dueDate).toISOString().slice(0, 10)
      : '',
    reason: ''
  });

  const [correctionModal, setCorrectionModal] = useState({
    isOpen: false,
    payment: null,
    mode: 'reverse', // 'reverse' | 'correct'
    correctedAmount: '',
    reason: ''
  });

  if (!activeShipmentDetails?.shipment) return null;
  const shipment = activeShipmentDetails.shipment;

  const handleAssociateProductLine = async (e) => {
    e.preventDefault();
    if (!shipment._id) return;
    if (!addLineForm.productId) {
      showToast('يرجى اختيار المنتج أولاً', 'error');
      return;
    }

    try {
      await axios.post(
        `/api/admin/finance/shipments/${shipment._id}/products`,
        {
          syncProductCostPrice: addLineForm.syncProductCostPrice,
          lines: [
            {
              productId: addLineForm.productId,
              quantity: Number(addLineForm.quantity || 1),
              unitCost: Number(addLineForm.unitCost || 0),
              note: addLineForm.note
            }
          ]
        },
        authHeader
      );
      showToast('تم ربط المنتج بشحنة المورد وحفظ لقطة التكلفة التاريخية');
      setAddLineForm({ productId: '', quantity: 1, unitCost: '', note: '', syncProductCostPrice: false });
      await onRefreshDetails(shipment._id);
      onRefreshParent?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر ربط المنتج بالشحنة', 'error');
    }
  };

  const handleRemovePurchaseLine = async (lineId) => {
    if (!shipment._id) return;
    try {
      await axios.delete(
        `/api/admin/finance/shipments/${shipment._id}/products/${lineId}`,
        authHeader
      );
      showToast('تم حذف البند من الشحنة');
      await onRefreshDetails(shipment._id);
      onRefreshParent?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حذف البند', 'error');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!shipment._id) return;
    const idempotencyKey = `PAY-UI-${shipment._id}-${Date.now()}`;
    try {
      await axios.post(
        `/api/admin/finance/shipments/${shipment._id}/payments`,
        {
          amount: Number(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          referenceNote: paymentForm.referenceNote,
          idempotencyKey
        },
        authHeader
      );
      showToast('تم تسجيل الدفعة المالية وتحديث الرصيد المتبقي بنجاح');
      setPaymentForm({
        amount: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'cash',
        referenceNote: ''
      });
      await onRefreshDetails(shipment._id);
      onRefreshParent?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل الدفعة', 'error');
    }
  };

  const handleUpdateDueDate = async () => {
    if (!shipment._id) return;
    try {
      await axios.put(
        `/api/admin/finance/shipments/${shipment._id}`,
        {
          dueDate: dueDateEdit.dueDate || null,
          dueDateReason: dueDateEdit.reason || 'تحديث تاريخ الاستحقاق من لوحة التحكم'
        },
        authHeader
      );
      showToast('تم تحديث تاريخ الاستحقاق وتسجيله في سجل التدقيق');
      await onRefreshDetails(shipment._id);
      onRefreshParent?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث تاريخ الاستحقاق', 'error');
    }
  };

  const handleSubmitCorrectionOrReversal = async (e) => {
    e.preventDefault();
    const { payment, mode, correctedAmount, reason } = correctionModal;
    if (!payment || !shipment._id) return;

    try {
      if (mode === 'reverse') {
        await axios.post(
          `/api/admin/finance/shipments/${shipment._id}/payments/${payment._id}/reverse`,
          { reason },
          authHeader
        );
        showToast('تم عكس الدفعة المالية بنجاح مع الاحتفاظ بالسجل التاريخي');
      } else {
        await axios.post(
          `/api/admin/finance/shipments/${shipment._id}/payments/${payment._id}/correct`,
          {
            correctedAmount: Number(correctedAmount),
            reason
          },
          authHeader
        );
        showToast('تم تصحيح الدفعة المالية عبر قيد عكسي وقيد مصحح بنجاح');
      }
      setCorrectionModal({ isOpen: false, payment: null, mode: 'reverse', correctedAmount: '', reason: '' });
      await onRefreshDetails(shipment._id);
      onRefreshParent?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تنفيذ العملية', 'error');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-4xl space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h4 className="text-base font-black text-ink flex items-center gap-2">
                <span className="font-mono text-primary">{shipment.referenceId}</span>
                <span>— {shipment.supplier?.name}</span>
              </h4>
              <p className="text-xs text-ink-soft">
                حالة الشحنة: {SHIPMENT_STATUS_LABELS[shipment.status]} | العملة: {shipment.currency}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-soft hover:text-ink"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Financial Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-card bg-paper border border-line">
              <span className="text-ink-soft block">إجمالي الالتزام المعتمد:</span>
              <strong className="text-base font-black text-ink">
                {shipment.approvedObligationTotal} {currency}
              </strong>
            </div>
            <div className="p-3 rounded-card bg-paper border border-line">
              <span className="text-ink-soft block">إجمالي المدفوع:</span>
              <strong className="text-base font-black text-emerald-600">
                {shipment.totalPaid} {currency}
              </strong>
            </div>
            <div className="p-3 rounded-card bg-paper border border-line">
              <span className="text-ink-soft block">الرصيد المتبقي (Outstanding):</span>
              <strong className="text-base font-black text-orange-600">
                {shipment.outstandingBalance} {currency}
              </strong>
            </div>
            <div className="p-3 rounded-card bg-paper border border-line space-y-1">
              <span className="text-ink-soft block">تاريخ الاستحقاق:</span>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dueDateEdit.dueDate}
                  onChange={(e) => setDueDateEdit({ ...dueDateEdit, dueDate: e.target.value })}
                  className="bg-surface border border-line rounded px-1.5 py-0.5 text-[11px] font-bold text-ink"
                />
                <button
                  type="button"
                  onClick={handleUpdateDueDate}
                  className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-black"
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Purchase Lines & Product Association */}
            <div className="space-y-4">
              <h5 className="text-xs font-black text-ink border-b border-line pb-2">
                1. المنتجات المرتبطة بالشحنة ولقطات التكلفة التاريخية ({shipment.purchaseLines?.length || 0})
              </h5>

              <form
                onSubmit={handleAssociateProductLine}
                className="p-3.5 rounded-card bg-paper border border-line space-y-2.5 text-xs font-bold"
              >
                <span className="block text-primary font-black">+ ربط منتج من الكتالوج بهذه الشحنة:</span>
                <select
                  value={addLineForm.productId}
                  onChange={(e) => {
                    const prod = catalogProducts.find((p) => p._id === e.target.value);
                    setAddLineForm({
                      ...addLineForm,
                      productId: e.target.value,
                      unitCost: prod?.costPrice ?? addLineForm.unitCost
                    });
                  }}
                  className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                >
                  <option value="">-- اختر المنتج --</option>
                  {catalogProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (تكلفة حالية: {p.costPrice || 0} {currency})
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-soft">الكمية المشتراة *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={addLineForm.quantity}
                      onChange={(e) => setAddLineForm({ ...addLineForm, quantity: e.target.value })}
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-soft">تكلفة الوحدة في هذه الشحنة *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={addLineForm.unitCost}
                      onChange={(e) => setAddLineForm({ ...addLineForm, unitCost: e.target.value })}
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addLineForm.syncProductCostPrice}
                    onChange={(e) =>
                      setAddLineForm({ ...addLineForm, syncProductCostPrice: e.target.checked })
                    }
                    className="accent-primary"
                  />
                  <span>تحديث حقل تكلفة المنتج الحالية في الكتالوج أيضاً</span>
                </label>

                <button
                  type="submit"
                  className="w-full py-2 rounded-btn bg-indigo-600 text-white font-black hover:bg-indigo-700"
                >
                  ربط المنتج وحفظ لقطة الشراء
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(shipment.purchaseLines || []).map((line) => (
                  <div
                    key={line.lineId}
                    className="p-2.5 rounded-btn bg-paper border border-line flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-black text-ink block">{line.productNameSnapshot}</span>
                      <span className="text-[11px] text-ink-soft">
                        الكمية: {line.quantity} × تكلفة الوحدة: {line.unitCost} {currency}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-primary">
                        {line.lineTotal} {currency}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePurchaseLine(line.lineId)}
                        className="text-red-500 hover:bg-red-500/10 p-1 rounded"
                        title="إزالة السطر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Record Payment & Payment History Ledger */}
            <div className="space-y-4">
              <h5 className="text-xs font-black text-ink border-b border-line pb-2">
                2. سجل الدفعات المالية للمورد (Payments & Corrections Ledger)
              </h5>

              <form
                onSubmit={handleRecordPayment}
                className="p-3.5 rounded-card bg-emerald-500/5 border border-emerald-500/25 space-y-2.5 text-xs font-bold"
              >
                <span className="block text-emerald-600 font-black">
                  + تسجيل دفعة مالية جديدة (كاملة أو جزئية):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-soft">المبلغ المدفوع *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder={`المتبقي: ${shipment.outstandingBalance}`}
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-soft">تاريخ الدفع *</label>
                    <input
                      type="date"
                      required
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-soft">طريقة الدفع</label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    >
                      <option value="cash">نقدي (Cash)</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                      <option value="wallet">محفظة إلكترونية</option>
                      <option value="check">شيك</option>
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  value={paymentForm.referenceNote}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNote: e.target.value })}
                  placeholder="رقم إيصال التحويل أو ملاحظة مرجعية..."
                  className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                />

                <button
                  type="submit"
                  className="w-full py-2 rounded-btn bg-emerald-600 text-white font-black hover:bg-emerald-700"
                >
                  تسجيل الدفعة وتحديث الرصيد
                </button>
              </form>

              {/* Payment Ledger Entries */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(activeShipmentDetails.payments || []).map((pay) => (
                  <div
                    key={pay._id}
                    className={`p-2.5 rounded-btn border text-xs flex items-center justify-between ${
                      pay.status === 'reversed'
                        ? 'bg-red-500/5 border-red-500/20 opacity-75'
                        : pay.entryType === 'reversal'
                        ? 'bg-orange-500/5 border-orange-500/20'
                        : 'bg-paper border-line'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-primary">{pay.paymentReference}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line font-bold">
                          {pay.entryType} / {pay.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-soft block">
                        {new Date(pay.paymentDate).toLocaleDateString('ar-EG')} — {pay.paymentMethod}
                        {pay.referenceNote ? ` (${pay.referenceNote})` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-black ${
                          pay.amount < 0 ? 'text-red-500' : 'text-emerald-600'
                        }`}
                      >
                        {pay.amount} {currency}
                      </span>

                      {pay.status === 'posted' && pay.entryType !== 'reversal' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCorrectionModal({
                                isOpen: true,
                                payment: pay,
                                mode: 'correct',
                                correctedAmount: pay.amount,
                                reason: ''
                              })
                            }
                            className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-600 text-[10px] font-black"
                            title="تصحيح المبلغ"
                          >
                            تصحيح
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCorrectionModal({
                                isOpen: true,
                                payment: pay,
                                mode: 'reverse',
                                correctedAmount: '',
                                reason: ''
                              })
                            }
                            className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-[10px] font-black"
                            title="عكس الدفعة"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CorrectionReversalModal
        correctionModal={correctionModal}
        setCorrectionModal={setCorrectionModal}
        onSubmit={handleSubmitCorrectionOrReversal}
      />
    </>
  );
}
