import React, { useState } from 'react';
import { X, ArrowRightLeft, Building2, Store, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

/**
 * WarehouseTransferModal
 * Moves stock between Store Warehouse (مخزن المحل) and External Warehouse (المخزن الخارجي)
 */
export default function WarehouseTransferModal({
  product,
  onClose,
  onSuccess,
  token,
  showToast
}) {
  if (!product) return null;

  const storeStock = Number(product.storeStock ?? product.stockCount ?? 0);
  const externalStock = Number(product.externalStock ?? 0);

  const [from, setFrom] = useState('external'); // 'external' -> 'store' or 'store' -> 'external'
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const to = from === 'external' ? 'store' : 'external';
  const maxAvailable = from === 'external' ? externalStock : storeStock;

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (quantity <= 0) {
      showToast('يرجى تحديد كمية صالحة للتحويل', 'error');
      return;
    }
    if (quantity > maxAvailable) {
      showToast(`الرصيد المتاح للتحويل هو ${maxAvailable} فقط`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `/api/admin/products/${product._id}/transfer-stock`,
        { quantity, from, to, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(res.data?.message || 'تم تحويل البضاعة بنجاح', 'success');
      if (onSuccess) onSuccess(res.data?.product);
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر إتمام التحويل', 'error');
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
          <h2 className="text-sm font-black text-ink flex items-center gap-2">
            <span>تحويل بضاعة بين المخازن</span>
            <ArrowRightLeft className="w-4 h-4 text-primary" />
          </h2>
        </div>

        {/* Content */}
        <form onSubmit={handleTransfer} className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-ink-soft block mb-1">المنتج المحدد:</span>
            <h3 className="text-sm font-black text-ink">{product.name}</h3>
            {product.barcode && (
              <span className="text-[10px] text-ink-soft font-mono">باركود: {product.barcode}</span>
            )}
          </div>

          {/* Current Stock Cards */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className={`p-3 rounded-xl border ${from === 'store' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-line bg-paper'}`}>
              <div className="flex items-center justify-center gap-1.5 text-ink-soft mb-1">
                <Store className="w-3.5 h-3.5" />
                <span className="font-bold">مخزن المحل (المحلي)</span>
              </div>
              <div className="text-lg font-black text-ink font-mono">{storeStock}</div>
              <span className="text-[10px] text-ink-soft">قطع متاحة</span>
            </div>

            <div className={`p-3 rounded-xl border ${from === 'external' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-line bg-paper'}`}>
              <div className="flex items-center justify-center gap-1.5 text-ink-soft mb-1">
                <Building2 className="w-3.5 h-3.5" />
                <span className="font-bold">المخزن الخارجي (الفرعي)</span>
              </div>
              <div className="text-lg font-black text-ink font-mono">{externalStock}</div>
              <span className="text-[10px] text-ink-soft">قطع متاحة</span>
            </div>
          </div>

          {/* Direction Selector */}
          <div>
            <label className="block text-ink font-bold mb-1.5">اتجاه التحويل:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFrom('external')}
                className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                  from === 'external'
                    ? 'border-primary bg-primary text-white shadow-xs'
                    : 'border-line bg-surface hover:bg-paper text-ink'
                }`}
              >
                من الخارجي ⬅️ إلى المحل
              </button>
              <button
                type="button"
                onClick={() => setFrom('store')}
                className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                  from === 'store'
                    ? 'border-primary bg-primary text-white shadow-xs'
                    : 'border-line bg-surface hover:bg-paper text-ink'
                }`}
              >
                من المحل ⬅️ إلى الخارجي
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-ink-soft">
                الحد الأقصى المتاح: <strong className="text-ink">{maxAvailable} قطعة</strong>
              </span>
              <label className="text-ink font-bold">الكمية المراد نقلها:</label>
            </div>
            <input
              type="number"
              min="1"
              max={maxAvailable}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm font-black text-ink outline-none focus:border-primary text-center font-mono"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-ink font-bold mb-1">ملاحظة / سبب التحويل:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تعويض نقص الكاونتر / تخزين بضاعة جديدة..."
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs text-ink outline-none focus:border-primary"
            />
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
              className="px-5 py-2 rounded-btn bg-primary text-white font-black hover:opacity-95 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التحويل...' : 'تأكيد التحويل الآن'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
