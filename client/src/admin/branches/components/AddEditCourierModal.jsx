import React, { useState } from 'react';
import {
  X,
  Truck,
  Phone,
  DollarSign,
  User,
  ShieldCheck,
  Building2,
  Globe
} from 'lucide-react';
import axios from 'axios';

export default function AddEditCourierModal({
  isOpen,
  onClose,
  editingCourier,
  staffList = [],
  branchId,
  token,
  showToast,
  onSuccess
}) {
  if (!isOpen) return null;

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const isEditing = Boolean(editingCourier);

  const [form, setForm] = useState({
    name: editingCourier?.name || '',
    type: editingCourier?.type || 'internal_staff',
    staffUserId: editingCourier?.staffUserId?._id || editingCourier?.staffUserId || '',
    phone: editingCourier?.phone || '',
    defaultCost: editingCourier?.defaultCost !== undefined ? String(editingCourier.defaultCost) : '0',
    companyName: editingCourier?.companyName || '',
    trackingUrlTemplate: editingCourier?.trackingUrlTemplate || '',
    notes: editingCourier?.notes || '',
    active: editingCourier?.active !== false
  });

  const [saving, setSaving] = useState(false);

  const handleTypeChange = (newType) => {
    let cost = form.defaultCost;
    if (newType === 'internal_staff') {
      cost = '0';
    } else if (cost === '0') {
      cost = '45';
    }
    setForm({ ...form, type: newType, defaultCost: cost });
  };

  const handleStaffSelect = (staffId) => {
    const selected = staffList.find((s) => s._id === staffId);
    if (selected) {
      setForm({
        ...form,
        staffUserId: staffId,
        name: selected.fullname,
        phone: selected.phone || form.phone,
        type: 'internal_staff',
        defaultCost: '0'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      showToast('يرجى إدخال اسم المندوب أو شركة الشحن', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        staffUserId: form.type === 'internal_staff' ? (form.staffUserId || null) : null,
        phone: form.phone.trim(),
        defaultCost: Number(form.defaultCost || 0),
        companyName: form.companyName.trim(),
        trackingUrlTemplate: form.trackingUrlTemplate.trim(),
        notes: form.notes.trim(),
        active: Boolean(form.active),
        branchId: branchId || null
      };

      if (isEditing) {
        await axios.put(`/api/admin/finance/shipping/couriers/${editingCourier._id}`, payload, authHeader);
        showToast('تم تحديث بيانات المندوب بنجاح!');
      } else {
        await axios.post('/api/admin/finance/shipping/couriers', payload, authHeader);
        showToast('تمت إضافة المندوب / جهة الشحن بنجاح!');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ بيانات جهة الشحن', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">
                {isEditing ? `تعديل جهة الشحن: ${editingCourier.name}` : 'إضافة جهة شحن أو مندوب توصيل'}
              </h3>
              <p className="text-xs text-ink-soft">
                تحديد التكلفة الهامشية الحقيقية على المتجر ونوع التعاقد
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-paper border border-line text-ink-soft hover:text-ink hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-bold">
          
          {/* Courier Type */}
          <div>
            <label className="block text-ink-soft mb-1.5">نوع جهة الشحن *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('internal_staff')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  form.type === 'internal_staff'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-black'
                    : 'border-line bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                موظف دائم بالمتجر
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('external_carrier')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  form.type === 'external_carrier'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 font-black'
                    : 'border-line bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                شركة شحن خارجية
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('freelancer')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  form.type === 'freelancer'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200 font-black'
                    : 'border-line bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                مندوب حر (بالأوردر)
              </button>
            </div>
          </div>

          {/* Link to Internal Staff (if internal) */}
          {form.type === 'internal_staff' && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <label className="block text-emerald-800 dark:text-emerald-200 text-xs font-black">
                اختر الموظف الداخلي (المربوط ببروفايل الحضور والراتب):
              </label>
              <select
                value={form.staffUserId}
                onChange={(e) => handleStaffSelect(e.target.value)}
                className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
              >
                <option value="">-- اختر موظفاً من طاقم العمل --</option>
                {staffList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullname} ({s.jobTitle || 'موظف'} - {s.phone || 'بدون هاتف'})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                ★ التكلفة الفعلية للأوردر ستكون = 0 ج.م تلقائياً لأن تكلفته مغطاة ضمن الراتب الشهري في مصاريف التشغيل (OPEX)
              </p>
            </div>
          )}

          {/* Courier Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">الاسم / المسمى *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: كابتن محمود حسن أو بوسطة اكسبريس"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">رقم الهاتف للتواصل *</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010xxxxxxxx"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
          </div>

          {/* Cost & Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">التكلفة الافتراضية على المتجر (ج.م) *</label>
              <input
                type="number"
                min="0"
                step="5"
                required
                value={form.defaultCost}
                onChange={(e) => setForm({ ...form, defaultCost: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
              <span className="text-[10px] text-ink-soft block mt-0.5">
                {form.type === 'internal_staff' ? '0 ج.م للموظف الثابت' : 'المبلغ المالي الذي يتقاضاه الناقل للأوردر'}
              </span>
            </div>

            <div>
              <label className="block text-ink-soft mb-1">اسم الشركة (إن وجد)</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="مثال: بوسطة، سمسا، شحنة سريعة"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
          </div>

          {/* Tracking template */}
          {form.type === 'external_carrier' && (
            <div>
              <label className="block text-ink-soft mb-1">رابط تتبع الشحنات العام (Tracking URL)</label>
              <input
                type="text"
                value={form.trackingUrlTemplate}
                onChange={(e) => setForm({ ...form, trackingUrlTemplate: e.target.value })}
                placeholder="https://track.bosta.co/{trackingNumber}"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono text-[11px]"
              />
            </div>
          )}

          <div>
            <label className="block text-ink-soft mb-1">ملاحظات إضافية</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="نطاق التغطية، سياسة التحصيل، مواعيد العمل..."
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-btn bg-paper border border-line text-ink text-xs font-bold hover:bg-surface transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-btn bg-primary text-white text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              {saving ? 'جاري الحفظ...' : isEditing ? 'تحديث جهة الشحن' : 'إضافة وتفعيل جهة الشحن'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
