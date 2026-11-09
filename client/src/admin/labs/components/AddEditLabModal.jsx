import React, { useState, useEffect } from 'react';
import { X, Building2, Phone, MessageSquare, MapPin, Wrench, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const DEFAULT_STAGES = [
  { key: 'received', label: 'استلام أمر الشغل', order: 1 },
  { key: 'processing', label: 'جاري التجهيز والقص', order: 2 },
  { key: 'assembly', label: 'التركيب والمعايرة الدقيقة', order: 3 },
  { key: 'ready', label: 'جاهز للاستلام من المعمل', order: 4 },
  { key: 'delivered', label: 'تم الاستلام بالفرع وجاهز للعميل', order: 5 }
];

export default function AddEditLabModal({
  isOpen,
  onClose,
  lab = null,
  authHeader,
  showToast,
  onSuccess
}) {
  if (!isOpen) return null;

  const isEditing = Boolean(lab && lab._id);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsappPhone: '',
    specialty: 'معمل عدسات وبصريات متكامل',
    city: 'القاهرة',
    address: '',
    pricingNotes: '',
    customStages: DEFAULT_STAGES
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lab) {
      setForm({
        name: lab.name || '',
        phone: lab.phone || '',
        whatsappPhone: lab.whatsappPhone || lab.phone || '',
        specialty: lab.specialty || 'معمل عدسات وبصريات متكامل',
        city: lab.city || 'القاهرة',
        address: lab.address || '',
        pricingNotes: lab.pricingNotes || '',
        customStages: Array.isArray(lab.customStages) && lab.customStages.length > 0 ? lab.customStages : DEFAULT_STAGES
      });
    } else {
      setForm({
        name: '',
        phone: '',
        whatsappPhone: '',
        specialty: 'معمل عدسات وبصريات متكامل',
        city: 'القاهرة',
        address: '',
        pricingNotes: '',
        customStages: DEFAULT_STAGES
      });
    }
  }, [lab]);

  const handleAddStage = () => {
    const nextOrder = form.customStages.length + 1;
    const newStage = {
      key: `stage_${Date.now()}`,
      label: `مرحلة ${nextOrder}`,
      order: nextOrder
    };
    setForm({
      ...form,
      customStages: [...form.customStages, newStage]
    });
  };

  const handleRemoveStage = (index) => {
    if (form.customStages.length <= 2) {
      showToast('يجب الاحتفاظ بمرحلتين على الأقل لأمر التشغيل', 'error');
      return;
    }
    const filtered = form.customStages.filter((_, idx) => idx !== index);
    setForm({ ...form, customStages: filtered });
  };

  const handleStageLabelChange = (index, newLabel) => {
    const copy = [...form.customStages];
    copy[index].label = newLabel;
    setForm({ ...form, customStages: copy });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('يرجى إدخال اسم المعمل', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await axios.put(`/api/admin/labs/${lab._id}`, form, authHeader);
        showToast('تم تحديث بيانات المعمل بنجاح');
      } else {
        await axios.post('/api/admin/labs', form, authHeader);
        showToast('تمت إضافة المعمل الجديد بنجاح');
      }
      onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ بيانات المعمل', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl space-y-4 text-slate-800 dark:text-slate-100 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                {isEditing ? `تعديل بيانات ورشة / معمل: ${lab.name}` : 'إضافة ورشة عمل أو معمل بصريات جديد'}
              </h3>
              <p className="text-[11px] text-slate-500">إدارة جهات التشغيل الخارجية ومراحل أوامر الشغل</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المعمل / الورشة *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: معمل الصفا للعدسات الطبية"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">التخصص والخدمة</label>
              <input
                type="text"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                placeholder="قص وتجميع، عدسات بروجريسيف، لحام شنابر..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف الأرضي / الموبايل</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010xxxxxxxx"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none focus:border-amber-500 text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الواتساب (لأوامر التشغيل)</label>
              <input
                type="tel"
                value={form.whatsappPhone}
                onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
                placeholder="010xxxxxxxx"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none focus:border-amber-500 text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المدينة / المحافظة</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العنوان التفصيلي ومكان الاستلام</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="وسط البلد، باب اللوق، عمارة..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">اتفاقية الأسعار وملاحظات الحسابات</label>
            <input
              type="text"
              value={form.pricingNotes}
              onChange={(e) => setForm({ ...form, pricingNotes: e.target.value })}
              placeholder="مثال: خصم 15% على العدسات الفرنسية، مصاريف الشحن 30 ج.م..."
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none focus:border-amber-500"
            />
          </div>

          {/* Dynamic Custom Stages Pipeline */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  <span>مراحل وحالات أمر التشغيل لهذا المعمل (Workflow Stages)</span>
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  تظهر هذه المراحل بالترتيب في قائمة حالات أمر التشغيل للتحديث والمتابعة
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddStage}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>إضافة مرحلة</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {form.customStages.map((stage, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 text-[10px] font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    value={stage.label}
                    onChange={(e) => handleStageLabelChange(idx, e.target.value)}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                    placeholder="اسم المرحلة..."
                  />
                  {form.customStages.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                      title="حذف هذه المرحلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'جاري الحفظ...' : isEditing ? 'تحديث المعمل' : 'حفظ المعمل'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
