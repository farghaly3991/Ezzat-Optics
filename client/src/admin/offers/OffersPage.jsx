import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Clock } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ImageUploader from '../../shared/components/ImageUploader';

export default function OffersTab() {
  const { token, showToast } = useStore();
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setOfferForm] = useState({
    title: '',
    description: '',
    badge: 'عرض خاص ⚡',
    discountPercentage: 20,
    endDate: '',
    productIds: []
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadData = () => {
    axios.get('/api/admin/offers', authHeader).then((r) => setOffers(r.data?.offers || []));
    axios.get('/api/admin/products?limit=100', authHeader).then((r) => setProducts(r.data?.products || []));
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      await axios.delete(`/api/admin/offers/${id}`, authHeader);
      showToast('تم حذف العرض');
      loadData();
    } catch {
      showToast('تعذر الحذف', 'error');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.endDate) return;
    try {
      await axios.post('/api/admin/offers', form, authHeader);
      showToast('تم إنشاء العرض بنجاح');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ العرض', 'error');
    }
  };

  const toggleProductInOffer = (pId) => {
    setOfferForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(pId)
        ? prev.productIds.filter((id) => id !== pId)
        : [...prev.productIds, pId]
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-secondary flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" />
          <span>العروض الترويجية والحملات النشطة ({offers.length})</span>
        </h3>

        <button
          onClick={() => {
            const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            setOfferForm({
              title: '',
              description: '',
              badge: 'عرض خاص ⚡',
              discountPercentage: 25,
              endDate: nextWeek,
              productIds: []
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-card bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" /> إنشاء عرض ترويجي جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {offers.map((offer) => (
          <div
            key={offer._id}
            className="p-5 rounded-card bg-surface text-ink space-y-3 relative overflow-hidden border border-line shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="bg-orange-500 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full">
                {offer.badge}
              </span>
              <button
                onClick={() => handleDelete(offer._id)}
                className="p-1.5 text-ink-soft hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <h4 className="text-lg font-black text-ink">{offer.title}</h4>
            <p className="text-xs text-ink-soft line-clamp-2">{offer.description}</p>
            <div className="pt-2 text-xs text-ink-soft flex justify-between border-t border-line font-bold">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> ينتهي في: {new Date(offer.endDate).toLocaleDateString('ar-EG')}
              </span>
              <span>{offer.productIds?.length || 0} منتجات مشمولة</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-card p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto border border-line">
            <h3 className="font-black text-sm text-ink">إنشاء حملة ترويجية جديدة</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-ink-soft mb-1">عنوان العرض *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setOfferForm({ ...form, title: e.target.value })}
                  placeholder="خصومات الصيف الكبرى"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">شارة العرض (Badge)</label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => setOfferForm({ ...form, badge: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50"
                  />
                </div>

                <div>
                  <label className="block text-ink-soft mb-1">تاريخ الانتهاء *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setOfferForm({ ...form, endDate: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setOfferForm({ ...form, description: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50"
                />
              </div>

              <div>
                <label className="block text-ink-soft mb-1">صورة البانر (اختياري)</label>
                <ImageUploader 
                  value={form.bannerImage || ''}
                  onChange={(val) => setOfferForm({ ...form, bannerImage: val })}
                />
              </div>

              <div>
                <label className="block text-ink-soft mb-1.5">حدد المنتجات المشمولة في هذا العرض:</label>
                <div className="max-h-40 overflow-y-auto divide-y divide-line border border-line rounded-btn p-2 bg-paper text-ink">
                  {products.map((p) => {
                    const isChecked = form.productIds.includes(p._id);
                    return (
                      <label key={p._id} className="flex items-center gap-2 py-1.5 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProductInOffer(p._id)}
                          className="rounded text-primary"
                        />
                        <span className="truncate flex-1 text-ink">{p.name}</span>
                        <span className="font-mono text-ink-soft">{p.price} ج.م</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-paper border border-line text-ink rounded-btn font-bold hover:bg-surface"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-[var(--color-primary-contrast,#ffffff)] rounded-btn font-black shadow-md hover:bg-primary/90"
                >
                  حفظ العرض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
