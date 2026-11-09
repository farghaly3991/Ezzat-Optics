import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  FileText
} from 'lucide-react';
import axios from 'axios';

export default function AddDeductionModal({
  isOpen,
  onClose,
  branchId,
  staffList = [],
  preselectedStaffId = null,
  token,
  showToast,
  onSuccess
}) {
  if (!isOpen) return null;

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    employeeId: preselectedStaffId || (staffList[0]?._id || ''),
    amount: '',
    reason: '',
    date: todayStr
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.employeeId) {
      showToast('يرجى اختيار الموظف المستهدف بالخصم', 'error');
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      showToast('يرجى تحديد مبلغ خصم صحيح أكبر من صفر', 'error');
      return;
    }

    if (!form.reason.trim()) {
      showToast('يرجى كتابة سبب الخصم أو الجزاء للتوثيق المالي', 'error');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `/api/admin/branches/${branchId}/deductions`,
        {
          employeeId: form.employeeId,
          amount: Number(form.amount),
          reason: form.reason.trim(),
          date: form.date
        },
        authHeader
      );

      showToast('تم تسجيل الخصم وتوثيقه وخصمه تلقائياً من مسير الرواتب ومصاريف التشغيل');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تسجيل الخصم', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">تسجيل خصم أو جزاء مالي</h3>
              <p className="text-xs text-ink-soft">يتم ربطه بحساب الموظف وخصمه من راتبه الشهري</p>
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
          
          <div>
            <label className="block text-ink-soft mb-1">الموظف المعني بالخصم *</label>
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
            >
              {staffList.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullname} ({emp.jobTitle || 'موظف'} - {emp.employmentType === 'per_task' ? 'بالطلب' : 'دائم'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-ink-soft mb-1">مبلغ الخصم (ج.م) *</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="5"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="مثال: 150"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-black text-sm"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft font-bold text-xs">ج.م</span>
            </div>
            <p className="text-[10px] text-ink-soft mt-1">
              يُخصم هذا المبلغ تلقائياً من إجمالي مصاريف الرواتب التشغيلية (OPEX) للفرع
            </p>
          </div>

          <div>
            <label className="block text-ink-soft mb-1">تاريخ توقيع الخصم *</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
            />
          </div>

          <div>
            <label className="block text-ink-soft mb-1">سبب الخصم والبيان التوضيحي *</label>
            <textarea
              rows={3}
              required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="مثال: تأخير غير مبرر عن فتح صالة المعرض لمدة 45 دقيقة..."
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink resize-none"
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
              className="px-6 py-2.5 rounded-btn bg-rose-600 text-white text-xs font-black shadow-md hover:bg-rose-700 transition-all flex items-center gap-1.5"
            >
              {saving ? 'جاري التسجيل...' : 'تأكيد تسجيل الخصم'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
