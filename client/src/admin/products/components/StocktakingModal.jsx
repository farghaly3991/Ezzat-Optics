import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Layers, Store, Building2, RefreshCw, Save } from 'lucide-react';
import axios from 'axios';

/**
 * StocktakingModal
 * Category-based physical inventory count (جرد البضاعة لكل قسم على حدة)
 */
export default function StocktakingModal({
  categories = [],
  onClose,
  onSuccess,
  token,
  showToast
}) {
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?._id || '');
  const [productsList, setProductsList] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadCategoryProducts = (catId) => {
    if (!catId || !token) return;
    setLoading(true);
    axios
      .post(
        '/api/admin/products/filter',
        { categoryId: catId, limit: 150 },
        authHeader
      )
      .then((res) => {
        const prods = res.data?.products || [];
        setProductsList(prods);

        // Pre-fill counts with current recorded stock
        const initial = {};
        for (const p of prods) {
          initial[p._id] = {
            store: Number(p.storeStock ?? p.stockCount ?? 0),
            external: Number(p.externalStock ?? 0)
          };
        }
        setCounts(initial);
      })
      .catch((err) => {
        showToast('تعذر تحميل منتجات هذا القسم للجرد', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedCatId) {
      loadCategoryProducts(selectedCatId);
    }
  }, [selectedCatId]);

  const handleStoreChange = (pid, val) => {
    setCounts((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] || { store: 0, external: 0 }),
        store: Math.max(0, Number(val) || 0)
      }
    }));
  };

  const handleExternalChange = (pid, val) => {
    setCounts((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] || { store: 0, external: 0 }),
        external: Math.max(0, Number(val) || 0)
      }
    }));
  };

  const handleSubmit = async () => {
    if (productsList.length === 0) return;
    setIsSubmitting(true);

    const payloadItems = productsList.map((p) => {
      const c = counts[p._id] || { store: p.storeStock || 0, external: p.externalStock || 0 };
      return {
        productId: p._id,
        countedStoreQty: c.store,
        countedExternalQty: c.external
      };
    });

    try {
      const res = await axios.post(
        '/api/admin/products/stocktaking',
        { categoryId: selectedCatId, items: payloadItems },
        authHeader
      );
      showToast(res.data?.message || 'تم اعتماد نتائج الجرد وتسوية الأرصدة بنجاح', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ الجرد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
      <div className="bg-surface border border-line rounded-card shadow-2xl w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col text-right">
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
              <h2 className="text-sm font-black text-ink flex items-center gap-2 justify-end">
                <span>جرد وتسوية المخزون حسب القسم</span>
                <Layers className="w-4 h-4 text-primary" />
              </h2>
              <p className="text-[11px] text-ink-soft">
                مطابقة العد الفعلي في مخزن المحل والمخزن الخارجي وتسوية الفروقات
              </p>
            </div>
          </div>
        </div>

        {/* Category Picker Bar */}
        <div className="p-4 bg-surface border-b border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label className="font-bold text-ink">اختر قسم الجرد:</label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="bg-paper border border-line rounded-btn px-3 py-1.5 font-bold text-ink outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-ink-soft font-bold">
            عدد الأصناف بالقسم: <strong className="text-ink">{productsList.length} صنف</strong>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-4 overflow-y-auto flex-1 text-xs">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-primary animate-spin mx-auto" />
              <p className="text-ink-soft font-bold">جاري تحميل أصناف القسم للجرد...</p>
            </div>
          ) : productsList.length === 0 ? (
            <div className="py-16 text-center text-ink-soft font-bold">
              لا توجد أصناف مسجلة في هذا القسم حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-3">اسم الصنف / الباركود</th>
                    <th className="p-3 text-center">الرصيد الدفتري المسجل</th>
                    <th className="p-3 text-center">العد الفعلي: مخزن المحل</th>
                    <th className="p-3 text-center">العد الفعلي: المخزن الخارجي</th>
                    <th className="p-3 text-center">المجموع الفعلي</th>
                    <th className="p-3 text-center">فارق الجرد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {productsList.map((p) => {
                    const c = counts[p._id] || {
                      store: p.storeStock ?? p.stockCount ?? 0,
                      external: p.externalStock ?? 0
                    };
                    const previousTotal = Number(p.stockCount ?? 0);
                    const newTotal = c.store + c.external;
                    const variance = newTotal - previousTotal;

                    return (
                      <tr key={p._id} className="hover:bg-paper/60 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-ink block">{p.name}</span>
                          {p.barcode && (
                            <span className="text-[10px] text-ink-soft font-mono">باركود: {p.barcode}</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-ink-soft">
                          {previousTotal}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={c.store}
                            onChange={(e) => handleStoreChange(p._id, e.target.value)}
                            className="w-20 bg-paper border border-line rounded-lg px-2 py-1 text-center font-mono font-bold text-ink outline-none focus:border-primary"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={c.external}
                            onChange={(e) => handleExternalChange(p._id, e.target.value)}
                            className="w-20 bg-paper border border-line rounded-lg px-2 py-1 text-center font-mono font-bold text-ink outline-none focus:border-primary"
                          />
                        </td>
                        <td className="p-3 text-center font-mono font-black text-ink">
                          {newTotal}
                        </td>
                        <td className="p-3 text-center font-mono font-black">
                          {variance === 0 ? (
                            <span className="text-emerald-600 font-bold">مطابق (0)</span>
                          ) : variance > 0 ? (
                            <span className="text-blue-600 font-bold">+{variance} (زيادة)</span>
                          ) : (
                            <span className="text-red-500 font-bold">{variance} (عجز)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-paper border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-btn border border-line bg-surface hover:bg-paper text-ink font-bold"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || productsList.length === 0}
            className="px-5 py-2 rounded-btn bg-primary text-white font-black hover:opacity-95 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الاعتماد...' : 'اعتماد وتسوية الجرد الآن'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
