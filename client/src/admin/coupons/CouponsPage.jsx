import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function CouponsTab() {
  const { token, showToast } = useStore();
  const [coupons, setCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    type: 'discount',
    discount: 15,
    value: 50,
    minOrderValue: 500,
    allowedUses: 100
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadCoupons = () => {
    axios.get('/api/admin/coupons', authHeader).then((r) => setCoupons(r.data?.coupons || []));
  };

  useEffect(() => {
    if (token) loadCoupons();
  }, [token]);

  const handleDelete = async (id) => {
    if (!window.confirm('حذف الكوبون؟')) return;
    try {
      await axios.delete(`/api/admin/coupons/${id}`, authHeader);
      showToast('تم حذف الكوبون');
      loadCoupons();
    } catch {
      showToast('تعذر الحذف', 'error');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return;
    try {
      await axios.post('/api/admin/coupons', form, authHeader);
      showToast('تم حفظ الكوبون بنجاح');
      setIsModalOpen(false);
      loadCoupons();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ الكوبون', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-ink flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <span>كوبونات وأكواد الخصم ({coupons.length})</span>
        </h3>

        <button
          onClick={() => {
            setForm({ code: '', type: 'discount', discount: 15, value: 50, minOrderValue: 500, allowedUses: 100 });
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-card bg-primary text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs flex items-center gap-1.5 shadow-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> إنشاء كوبون جديد
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((c) => (
          <div key={c._id} className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-2 relative">
            <div className="flex justify-between items-center">
              <span className="font-mono font-black text-lg text-primary tracking-wider uppercase bg-primary/10 px-3 py-1 rounded-btn border border-primary/20">
                {c.code}
              </span>
              <button
                onClick={() => handleDelete(c._id)}
                className="p-1.5 text-ink-soft hover:text-red-500 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-ink">
              قيمة الخصم: {c.type === 'discount' ? `${c.discount}% نسبة مئوية` : `${c.value} ج.م قيمة ثابتة`}
            </p>
            <div className="text-[11px] text-ink-soft font-medium flex justify-between pt-2 border-t border-line">
              <span>
                الاستخدام: {c.usedCount || 0} / {c.allowedUses === 0 ? 'غير محدود' : c.allowedUses}
              </span>
              <span>
                ينتهي: {c.endDate ? new Date(c.endDate).toLocaleDateString('ar-EG') : 'بدون'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface rounded-card border border-line p-6 w-full max-w-md space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-ink">
            <h3 className="font-black text-sm text-ink">إنشاء كود كوبون جديد</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-ink-soft mb-1">كود الكوبون *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SALE20"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none font-mono uppercase text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">النوع</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none text-ink"
                  >
                    <option value="discount">نسبة مئوية (%)</option>
                    <option value="fixed">قيمة ثابتة (ج.م)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-soft mb-1">الخصم</label>
                  <input
                    type="number"
                    value={form.type === 'discount' ? form.discount : form.value}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (form.type === 'discount') setForm({ ...form, discount: val });
                      else setForm({ ...form, value: val });
                    }}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">الحد الأدنى لقيمة الطلب (ج.م)</label>
                <input
                  type="number"
                  value={form.minOrderValue}
                  onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none text-ink"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={form.endDate || ''}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">عدد مرات الاستخدام (0=غير محدود)</label>
                  <input
                    type="number"
                    value={form.allowedUses}
                    onChange={(e) => setForm({ ...form, allowedUses: Number(e.target.value) })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none text-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-paper border border-line rounded-btn font-bold text-ink hover:bg-surface"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-[var(--color-primary-contrast,#ffffff)] rounded-btn font-black shadow-md hover:bg-primary/90"
                >
                  حفظ الكوبون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
