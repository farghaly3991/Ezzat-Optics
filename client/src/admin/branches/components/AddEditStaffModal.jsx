import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Phone,
  DollarSign,
  Calendar,
  Clock,
  Building2,
  Briefcase,
  ShieldCheck,
  Check
} from 'lucide-react';
import axios from 'axios';

const WEEK_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function AddEditStaffModal({
  isOpen,
  onClose,
  editingStaff,
  branchId,
  branchesList,
  isSuperAdmin,
  token,
  showToast,
  onSuccess
}) {
  if (!isOpen) return null;

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const isEditing = Boolean(editingStaff);

  const [form, setForm] = useState({
    fullname: editingStaff?.fullname || '',
    email: editingStaff?.email || '',
    password: '',
    phone: editingStaff?.phone || '',
    role: editingStaff?.role ? Number(editingStaff.role) : 3,
    branchId: branchId || editingStaff?.branchId?._id || editingStaff?.branchId || (branchesList[0]?._id || ''),
    employmentType: editingStaff?.employmentType || 'permanent',
    monthlySalary: editingStaff?.monthlySalary !== undefined ? String(editingStaff.monthlySalary) : '',
    jobTitle: editingStaff?.jobTitle || '',
    nationalId: editingStaff?.nationalId || '',
    emergencyPhone: editingStaff?.emergencyPhone || '',
    workDays: editingStaff?.workDays || ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
    shiftHours: editingStaff?.shiftHours || 8,
    shiftStart: editingStaff?.shiftStart || '09:00',
    shiftEnd: editingStaff?.shiftEnd || '17:00',
    isAttendanceRequired: editingStaff?.isAttendanceRequired !== false
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        fullname: editingStaff?.fullname || '',
        email: editingStaff?.email || '',
        password: '',
        phone: editingStaff?.phone || '',
        role: editingStaff?.role ? Number(editingStaff.role) : 3,
        branchId: branchId || editingStaff?.branchId?._id || editingStaff?.branchId || (branchesList[0]?._id || ''),
        employmentType: editingStaff?.employmentType || 'permanent',
        monthlySalary: editingStaff?.monthlySalary !== undefined ? String(editingStaff.monthlySalary) : '',
        jobTitle: editingStaff?.jobTitle || '',
        nationalId: editingStaff?.nationalId || '',
        emergencyPhone: editingStaff?.emergencyPhone || '',
        workDays: editingStaff?.workDays || ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        shiftHours: editingStaff?.shiftHours || 8,
        shiftStart: editingStaff?.shiftStart || '09:00',
        shiftEnd: editingStaff?.shiftEnd || '17:00',
        isAttendanceRequired: editingStaff?.isAttendanceRequired !== false
      });
    }
  }, [editingStaff, isOpen, branchId]);

  const [saving, setSaving] = useState(false);

  const toggleDay = (day) => {
    if (form.workDays.includes(day)) {
      setForm({ ...form, workDays: form.workDays.filter((d) => d !== day) });
    } else {
      setForm({ ...form, workDays: [...form.workDays, day] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullname.trim() || !form.email.trim()) {
      showToast('يرجى إدخال اسم الموظف والبريد الإلكتروني', 'error');
      return;
    }

    if (!isEditing && !form.password) {
      showToast('يرجى تحديد كلمة المرور للموظف الجديد', 'error');
      return;
    }

    const targetBranchId = branchId || form.branchId || editingStaff?.branchId?._id || editingStaff?.branchId;
    if (!targetBranchId) {
      showToast('يرجى تحديد الفرع التابع له الموظف', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branchId: targetBranchId,
        fullname: form.fullname.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: Number(form.role),
        employmentType: form.employmentType,
        monthlySalary: form.monthlySalary !== '' ? Number(form.monthlySalary) : 0,
        jobTitle: form.jobTitle.trim(),
        nationalId: form.nationalId.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
        workDays: form.workDays,
        shiftHours: Number(form.shiftHours || 8),
        shiftStart: form.shiftStart,
        shiftEnd: form.shiftEnd,
        isAttendanceRequired: Boolean(form.isAttendanceRequired)
      };

      if (form.password) {
        payload.password = form.password;
      }

      if (isEditing) {
        await axios.put(
          `/api/admin/branches/${targetBranchId}/staff/${editingStaff._id}`,
          payload,
          authHeader
        );
        showToast(`تم تحديث بيانات الموظف «${form.fullname}» بنجاح!`);
      } else {
        await axios.post(
          `/api/admin/branches/${targetBranchId}/staff`,
          payload,
          authHeader
        );
        showToast(`تمت إضافة الموظف «${form.fullname}» وإنشاء باركود الحضور الذكي له!`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ بيانات الموظف', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">
                {isEditing ? `تعديل ملف الموظف: ${editingStaff.fullname}` : 'إضافة موظف جديد لطاقم العمل'}
              </h3>
              <p className="text-xs text-ink-soft">
                تسجيل العقد، المرتب، نوع التعيين (دائم أو بالطلب)، وجدول الشيفت وسجل الحضور
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs font-bold">
          
          {/* Branch & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">الفرع المخصص *</label>
              <select
                disabled={!isSuperAdmin}
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink disabled:opacity-60"
              >
                {branchesList.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.city}) {b.isMain ? '★ رئيسي' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-ink-soft mb-1">الدور الوظيفي في النظام *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: Number(e.target.value) })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value={3}>موظف مبيعات وكاشير (Role 3)</option>
                <option value={2}>فني صيانة ودعم فني (Role 2)</option>
              </select>
            </div>
          </div>

          {/* Basic Personal Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">الاسم بالكامل *</label>
              <input
                type="text"
                required
                value={form.fullname}
                onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                placeholder="مثال: أحمد محمود إبراهيم"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">المسمى الوظيفي الداخلي</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="مثال: مسؤول مبيعات صالة، فني صيانة محمول، مندوب شحن"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
          </div>

          {/* Email & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">البريد الإلكتروني لتسجيل الدخول *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="staff@store.com"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">
                كلمة المرور {isEditing && '(اتركها فارغة للإبقاء على الحالية)'} *
              </label>
              <input
                type="password"
                required={!isEditing}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
          </div>

          {/* Phones & National ID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">رقم الهاتف الأساسي</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010xxxxxxxx"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">هاتف الطوارئ</label>
              <input
                type="text"
                value={form.emergencyPhone}
                onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                placeholder="012xxxxxxxx"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">الرقم القومي</label>
              <input
                type="text"
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                placeholder="14 رقم"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
          </div>

          {/* Employment Type & Compensation */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
            <span className="text-ink font-black block">نظام التعاقد والراتب (Employment Contract)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                  form.employmentType === 'permanent'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-line bg-surface text-ink-soft'
                }`}
              >
                <div>
                  <div className="font-black text-xs text-ink">موظف دائم (ثابت براتب شهري)</div>
                  <div className="text-[10px] text-ink-soft">بمرتب شهري محسوب آلياً في مصاريف التشغيل OPEX وسجل حضور وانصراف</div>
                </div>
                <input
                  type="radio"
                  name="employmentType"
                  value="permanent"
                  checked={form.employmentType === 'permanent'}
                  onChange={() => setForm({ ...form, employmentType: 'permanent' })}
                  className="hidden"
                />
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                  form.employmentType === 'per_task'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-line bg-surface text-ink-soft'
                }`}
              >
                <div>
                  <div className="font-black text-xs text-ink">موظف بالطلب أو بالمهمة (Per-Task)</div>
                  <div className="text-[10px] text-ink-soft">مثل فنيي الصيانة بالطلب أو مناديب الشحن بالقطعة، عمولة حسب الإنجاز</div>
                </div>
                <input
                  type="radio"
                  name="employmentType"
                  value="per_task"
                  checked={form.employmentType === 'per_task'}
                  onChange={() => setForm({ ...form, employmentType: 'per_task' })}
                  className="hidden"
                />
              </label>
            </div>

            {/* Salary & Attendance Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-ink-soft mb-1">
                  المرتب الشهري الأساسي (ج.م) {form.employmentType === 'permanent' && '*'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={form.monthlySalary}
                  onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                  placeholder={form.employmentType === 'permanent' ? 'مثال: 6000' : 'اختياري في حالة وجود راتب أساسي'}
                  className="w-full bg-surface border border-line rounded-btn p-2.5 text-ink"
                />
                <span className="text-[10px] text-ink-soft block mt-0.5">
                  تُخصم منه الجزاءات آلياً لحساب صافي مصاريف التشغيل الفعلية
                </span>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer pt-4">
                  <input
                    type="checkbox"
                    checked={form.isAttendanceRequired}
                    onChange={(e) => setForm({ ...form, isAttendanceRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span className="text-xs text-ink font-bold">ملزم بنظام تسجيل الحضور والانصراف اليومي</span>
                </label>
                <span className="text-[10px] text-ink-soft block mt-1">
                  في حال عدم التفعيل، يُعتبر موظفاً مرناً بدون تقييد مواعيد
                </span>
              </div>
            </div>
          </div>

          {/* Shift & Work Days (if permanent or attendance required) */}
          {form.isAttendanceRequired && (
            <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
              <span className="text-ink font-black block">جدول الشيفت وساعات العمل اليومية</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">ساعات العمل اليومية</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={form.shiftHours}
                    onChange={(e) => setForm({ ...form, shiftHours: e.target.value })}
                    className="w-full bg-surface border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>

                <div>
                  <label className="block text-ink-soft mb-1">بداية الشيفت</label>
                  <input
                    type="time"
                    value={form.shiftStart}
                    onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                    className="w-full bg-surface border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>

                <div>
                  <label className="block text-ink-soft mb-1">نهاية الشيفت</label>
                  <input
                    type="time"
                    value={form.shiftEnd}
                    onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
                    className="w-full bg-surface border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>

              {/* Work days pills */}
              <div>
                <label className="block text-ink-soft mb-1.5">أيام العمل الأسبوعية المعتمدة:</label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((day) => {
                    const isSelected = form.workDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-surface border border-line text-ink-soft hover:text-ink'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
              {saving ? 'جاري الحفظ...' : isEditing ? 'تحديث بيانات الموظف' : 'إضافة الموظف واعتماد العقد'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
