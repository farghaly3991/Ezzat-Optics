import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, DollarSign, Store, Building2, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

/**
 * ScrapModal
 * Registers damaged or scrapped optical stock (توالف وهدر الشنابر والعدسات)
 * Decrements stock and computes loss in finance OPEX.
 */
export default function ScrapModal({
  product,
  onClose,
  onSuccess,
  token,
  currency = 'ج.م',
  showToast
}) {
  if (!product) return null;

  const storeStock = Number(product.storeStock ?? product.stockCount ?? 0);
  const externalStock = Number(product.externalStock ?? 0);

  const [warehouse, setWarehouse] = useState('store');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('كسر أو خدش أثناء التركيب والقص بالورشة');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxAvailable = warehouse === 'store' ? storeStock : externalStock;
  const unitCost = Number(product.costPrice || (Number(product.price || 0) * 0.5));
  const estimatedLoss = unitCost * quantity;

  const reasonsList = [
    'كسر أو خدش أثناء التركيب والقص بالورشة',
    'عيب صناعة / تقشير في الطلاء أو الحماية',
    'تلف ناتج عن النقل وسوء التخزين',
    'كسر في مسامير أو مفصلات الشمبر',
    'تلف وانتهاء صلاحية (عدسات ومحاليل)',
    'أخرى'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (quantity <= 0) {
      showToast('يرجى تحديد كمية صالحة للتالف', 'error');
      return;
    }
    if (quantity > maxAvailable) {
      showToast(`الرصيد المتاح في هذا المخزن هو ${maxAvailable} فقط`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `/api/admin/products/${product._id}/scrap`,
        { quantity, reason, warehouse, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(res.data?.message || 'تم تسجيل التوالف وخصمها من المخزون بنجاح', 'success');
      if (onSuccess) onSuccess(res.data?.product);
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل التوالف', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface border border-line rounded-card shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-right">
        {/* Header */}
        <div className="p-4 bg-paper border-b border-line flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1.5 rounded-btn hover:bg-surface text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-black text-red-600 flex items-center gap-2">
            <span>تسجيل توالف وهدر بضاعة</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </h2>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-ink-soft block mb-1">المنتج المتضرر:</span>
            <h3 className="text-sm font-black text-ink">{product.name}</h3>
            <span className="text-[10px] text-ink-soft">
              تكلفة الوحدة التقديرية: <strong className="text-ink">{unitCost} {currency}</strong>
            </span>
          </div>

          {/* Warehouse Selection */}
          <div>
            <label className="block text-ink font-bold mb-1.5">المخزن المسحوب منه التالف:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWarehouse('store')}
                className={`p-2.5 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                  warehouse === 'store'
                    ? 'border-red-500 bg-red-500/10 text-red-600 ring-1 ring-red-500 shadow-xs'
                    : 'border-line bg-surface hover:bg-paper text-ink'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>مخزن المحل ({storeStock} متاح)</span>
              </button>

              <button
                type="button"
                onClick={() => setWarehouse('external')}
                className={`p-2.5 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                  warehouse === 'external'
                    ? 'border-red-500 bg-red-500/10 text-red-600 ring-1 ring-red-500 shadow-xs'
                    : 'border-line bg-surface hover:bg-paper text-ink'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>المخزن الخارجي ({externalStock} متاح)</span>
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-ink-soft">
                الرصيد المتاح: <strong className="text-ink">{maxAvailable} قطعة</strong>
              </span>
              <label className="text-ink font-bold">الكمية التالفة:</label>
            </div>
            <input
              type="number"
              min="1"
              max={maxAvailable}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm font-black text-ink outline-none focus:border-red-500 text-center font-mono"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-ink font-bold mb-1">سبب التلف:</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs text-ink outline-none focus:border-red-500 font-bold"
            >
              {reasonsList.map((r, idx) => (
                <option key={idx} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-ink font-bold mb-1">تفاصيل إضافية / الموظف المتسبب:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: انكسرت العدسة اليمنى أثناء عملية المسن والقص بالماكينة..."
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs text-ink outline-none focus:border-red-500"
            />
          </div>

          {/* Financial Loss Summary */}
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <div className="text-red-700 dark:text-red-400">
              <span className="block text-[11px] font-bold">إجمالي الخسارة المقيدة كـ OPEX:</span>
              <span className="text-[10px] opacity-80">سيتم تسجيلها في المصروفات التشغيلية للمتجر</span>
            </div>
            <div className="text-base font-black text-red-600 font-mono">
              {estimatedLoss} {currency}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-btn border border-line bg-surface hover:bg-paper text-ink font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxAvailable <= 0}
              className="px-5 py-2 rounded-btn bg-red-600 hover:bg-red-700 text-white font-black shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التسجيل...' : 'تسجيل التالف وخصم المخزون'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
