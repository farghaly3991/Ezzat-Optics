import React from 'react';

export default function CorrectionReversalModal({
  correctionModal,
  setCorrectionModal,
  onSubmit
}) {
  if (!correctionModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-surface text-ink rounded-card border border-line p-5 w-full max-w-md space-y-4 shadow-2xl text-xs font-bold"
      >
        <h5 className="text-sm font-black text-ink">
          {correctionModal.mode === 'reverse'
            ? `عكس الدفعة المالية (${correctionModal.payment?.paymentReference})`
            : `تصحيح مبلغ الدفعة (${correctionModal.payment?.paymentReference})`}
        </h5>

        {correctionModal.mode === 'correct' && (
          <div>
            <label className="block text-ink-soft mb-1">المبلغ الصحيح الجديد *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={correctionModal.correctedAmount}
              onChange={(e) =>
                setCorrectionModal({ ...correctionModal, correctedAmount: e.target.value })
              }
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
            />
          </div>
        )}

        <div>
          <label className="block text-ink-soft mb-1">سبب العملية (يُحفظ في سجل التدقيق المالي) *</label>
          <input
            type="text"
            required
            value={correctionModal.reason}
            onChange={(e) => setCorrectionModal({ ...correctionModal, reason: e.target.value })}
            placeholder="مثال: خطأ إدخال رقم الإيصال أو تعديل قيمة الدفعة..."
            className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() =>
              setCorrectionModal({
                isOpen: false,
                payment: null,
                mode: 'reverse',
                correctedAmount: '',
                reason: ''
              })
            }
            className="px-4 py-2 rounded-btn bg-paper border border-line text-ink"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-btn bg-primary text-white font-black"
          >
            تأكيد العملية
          </button>
        </div>
      </form>
    </div>
  );
}
