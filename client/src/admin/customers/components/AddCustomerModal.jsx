import React, { useState } from 'react';
import { X, UserPlus, Phone, User, Calendar, MapPin, Eye, DollarSign, Mail, Lock } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

/**
 * Clean Add Customer Modal
 * Regular customer creation with optional email and password.
 * Whether customers can log in to the storefront is governed globally by the store's settings.
 */
export default function AddCustomerModal({ onClose, onSuccess, authHeader, showToast, branches = [] }) {
  const { config } = useStore();
  const isOptics = config?.systemProfile === 'optics' && config?.enableOpticsPrescriptions !== false;

  const [formData, setFormData] = useState({
    fullname: '',
    phone: '',
    email: '',
    password: '',
    birthDate: '',
    gender: 'male',
    city: '',
    address: '',
    branchId: '',
    depositBalance: 0,
    checkupPeriodMonths: 12
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullname.trim() || !formData.phone.trim()) {
      showToast('الاسم ورقم الهاتف مطلوبان للتسجيل', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/admin/customers', formData, authHeader);
      showToast('تم تسجيل بيانات العميل بنجاح');
      if (onSuccess) onSuccess(res.data?.user);
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تسجيل العميل', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-blue-200" />
            <h3 className="text-base font-black text-white">
              {isOptics ? 'تسجيل عميل بصريات جديد (New Patient)' : 'تسجيل عميل جديد (New Customer)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">اسم العميل بالكامل *</label>
              <input
                type="text"
                placeholder="مثال: حسام الدين محمود"
                value={formData.fullname}
                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">رقم الهاتف (واتساب) *</label>
              <input
                type="tel"
                placeholder="010XXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono"
                required
              />
            </div>
          </div>

          {/* Email & Password (Normal standard user fields) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                البريد الإلكتروني <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                كلمة المرور <span className="text-[10px] text-slate-400 font-normal">(اختياري - افتراضياً آخر 6 أرقام)</span>
              </label>
              <input
                type="password"
                placeholder="••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Optical Specific Fields: Age & Gender */}
          {isOptics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">تاريخ الميلاد (لحساب السن):</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">النوع:</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="male">ذكر (Male)</option>
                  <option value="female">أنثى (Female)</option>
                </select>
              </div>
            </div>
          )}

          {/* City & Initial Deposit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">المدينة / المنطقة:</label>
              <input
                type="text"
                placeholder="مثال: الدقي، الجيزة"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">عربون أولي (تحت الحساب):</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={formData.depositBalance}
                onChange={(e) => setFormData({ ...formData, depositBalance: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {branches && branches.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">الفرع التابع له:</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">الفرع الرئيسي</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
            💡 <strong>ملاحظة:</strong> يتم إنشاء حساب العميل ببيانات الدخول أعلاه. وقدرة العملاء على تسجيل الدخول عبر المتجر الإلكتروني يتم التحكم بها مركزياً من إعدادات المتجر العامة.
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? 'جاري التسجيل...' : 'تسجيل العميل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
