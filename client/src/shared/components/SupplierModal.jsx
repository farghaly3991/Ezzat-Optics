import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Phone, Mail, MapPin, Tag, FileText, CheckCircle2, X } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../context/StoreContext';

/**
 * Reusable modal for Creating and Editing Suppliers.
 * Used in:
 * 1. Finance & Procurement Suppliers Directory.
 * 2. UnifiedProductForm when selecting or immediately creating a new supplier.
 */
export default function SupplierModal({
  isOpen,
  onClose,
  supplier = null,
  authHeader: customAuthHeader,
  showToast: customShowToast,
  onSuccess
}) {
  const store = useStore?.() || {};
  const effectiveToast = customShowToast || store.showToast || ((msg) => alert(msg));
  const effectiveToken =
    store.token || (typeof window !== 'undefined' ? localStorage.getItem('store_token') : '') || '';
  const authHeader = useMemo(
    () => customAuthHeader || { headers: { Authorization: `Bearer ${effectiveToken}` } },
    [customAuthHeader, effectiveToken]
  );

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsappPhone: '',
    email: '',
    specialty: '',
    address: '',
    notes: '',
    active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        phone: supplier.phone || '',
        whatsappPhone: supplier.whatsappPhone || supplier.phone || '',
        email: supplier.email || '',
        specialty: supplier.specialty || '',
        address: supplier.address || '',
        notes: supplier.notes || '',
        active: supplier.active !== false
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        whatsappPhone: '',
        email: '',
        specialty: '',
        address: '',
        notes: '',
        active: true
      });
    }
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      effectiveToast('يرجى كتابة اسم المورد أولاً', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        whatsappPhone: formData.whatsappPhone.trim() || formData.phone.trim(),
        email: formData.email.trim(),
        specialty: formData.specialty.trim(),
        address: formData.address.trim(),
        notes: formData.notes.trim(),
        active: formData.active
      };

      let res;
      if (supplier && supplier._id) {
        res = await axios.put(`/api/admin/finance/suppliers/${supplier._id}`, payload, authHeader);
        effectiveToast('تم تحديث بيانات المورد بنجاح ✓');
      } else {
        res = await axios.post('/api/admin/finance/suppliers', payload, authHeader);
        effectiveToast('تم تسجيل وإضافة المورد الجديد بنجاح ✓');
      }

      const savedSupplier = res.data?.supplier;
      if (onSuccess && savedSupplier) {
        onSuccess(savedSupplier);
      }
      onClose();
    } catch (err) {
      effectiveToast(err.response?.data?.error || 'تعذر حفظ بيانات المورد', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in zoom-in-95 text-xs font-bold">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-ink">
                {supplier ? `تعديل بيانات المورد (${supplier.name})` : 'إضافة مورد جديد للقائمة'}
              </h4>
              <p className="text-[11px] text-ink-soft">
                بيانات الاتصال والتخصص وأرقام الواتساب لإرسال طلبات التوريد المباشرة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-btn hover:bg-paper text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>اسم المورد أو الشركة *</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثال: شركة النور للأجهزة الإلكترونية"
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>رقم الهاتف الأساسي</span>
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01012345678"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
                <span className="text-emerald-500 font-black">💬</span>
                <span>رقم الواتساب للتوريد *</span>
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.whatsappPhone}
                onChange={(e) => setFormData({ ...formData, whatsappPhone: e.target.value })}
                placeholder="01012345678"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold"
              />
              <span className="text-[10px] text-ink-soft block mt-0.5">
                تُرسل عليه رسائل طلبات التوريد المباشرة
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span>التخصص ومجال البضائع</span>
              </label>
              <input
                type="text"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="مثال: شاشات وتلفزيونات، هواتف، أزياء..."
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span>البريد الإلكتروني (اختياري)</span>
              </label>
              <input
                type="email"
                dir="ltr"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="supplier@example.com"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>العنوان أو موقع المستودع</span>
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="مثال: القاهرة، مدينة نصر، المنطقة الصناعية"
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-ink-soft mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>الوصف وملاحظات التعامل</span>
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ملاحظات حول سرعة التوريد، شروط الدفع، أو طريقة التسليم..."
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary text-xs font-bold resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="activeSupplierCheckbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 rounded text-primary focus:ring-0"
            />
            <label htmlFor="activeSupplierCheckbox" className="text-ink cursor-pointer">
              مورد نشط ومتاح لربط المنتجات وإرسال الطلبيات
            </label>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-btn bg-paper hover:bg-surface text-ink border border-line text-xs font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black shadow-md hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'جاري الحفظ...' : supplier ? 'حفظ التعديلات' : 'إضافة المورد الآن'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
