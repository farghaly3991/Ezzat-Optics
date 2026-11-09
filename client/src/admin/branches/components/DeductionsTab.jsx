import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  User,
  DollarSign,
  RefreshCw,
  FileText,
  ShieldCheck
} from 'lucide-react';
import axios from 'axios';

export default function DeductionsTab({
  branchId,
  branchName,
  staffList = [],
  token,
  showToast,
  onOpenAddDeduction
}) {
  const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [deductions, setDeductions] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const loadDeductions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `/api/admin/branches/${branchId}/deductions?period=${selectedPeriod}`,
        authHeader
      );
      setDeductions(res.data?.deductions || []);
      setTotalAmount(res.data?.totalAmount || 0);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل سجل الخصومات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      loadDeductions();
    }
  }, [branchId, selectedPeriod]);

  const handleDeleteDeduction = async (dedId) => {
    if (!window.confirm('هل أنت متأكد من إلغاء وحذف هذا الخصم المالي؟')) return;

    try {
      await axios.delete(`/api/admin/branches/${branchId}/deductions/${dedId}`, authHeader);
      showToast('تم حذف الخصم بنجاح وإعادته لمسير الرواتب');
      loadDeductions();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حذف الخصم', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Filter & Actions */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-paper border border-line px-3 py-1.5 rounded-xl text-xs font-bold text-ink">
            <Calendar className="w-4 h-4 text-primary" />
            <span>فترة الخصم (شهر):</span>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-ink font-bold focus:outline-none"
            />
          </div>

          <button
            onClick={loadDeductions}
            title="تحديث القائمة"
            className="p-2 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          onClick={onOpenAddDeduction}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل خصم أو جزاء جديد</span>
        </button>
      </div>

      {/* Summary KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 space-y-1">
          <span className="text-xs font-black text-rose-950">إجمالي الخصومات المطبقة بالفترة</span>
          <div className="text-2xl font-black text-rose-950">
            {totalAmount.toLocaleString()} ج.م
          </div>
          <span className="text-[10px] text-ink-soft block font-bold">تُخصم تلقائياً من رواتب الموظفين ومصاريف التشغيل</span>
        </div>

        <div className="p-4 rounded-2xl bg-paper border border-line space-y-1">
          <span className="text-xs font-bold text-ink-soft">عدد قرارات الخصم</span>
          <div className="text-2xl font-black text-ink">{deductions.length} إجراء</div>
          <span className="text-[10px] text-ink-soft block font-bold">موثقة مع الأسباب والتواريخ</span>
        </div>

        <div className="p-4 rounded-2xl bg-paper border border-line space-y-1">
          <span className="text-xs font-bold text-ink-soft">الربط المحاسبي التلقائي</span>
          <div className="text-sm font-black text-emerald-950 flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-800" />
            <span>نظام OPEX الآلي فعّال</span>
          </div>
          <span className="text-[10px] text-ink-soft block font-bold">لا حاجة للإدخال اليدوي في قائمة الأرباح</span>
        </div>
      </div>

      {/* Deductions Table */}
      <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-16 text-ink-soft text-sm">جاري تحميل سجلات الخصومات...</div>
        ) : deductions.length === 0 ? (
          <div className="text-center py-16 text-ink-soft space-y-2">
            <AlertCircle className="w-12 h-12 mx-auto text-ink-soft/40" />
            <p className="font-bold">سجل الفرع نظيف! لا توجد خصومات مسجلة في شهر ({selectedPeriod})</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper/70 text-ink-soft font-bold border-b border-line">
                <tr>
                  <th className="p-3.5">الموظف المعني</th>
                  <th className="p-3.5">المبلغ المخصوم</th>
                  <th className="p-3.5">تاريخ الخصم</th>
                  <th className="p-3.5">سبب الخصم والبيان</th>
                  <th className="p-3.5">صادر بواسطة</th>
                  <th className="p-3.5 text-center">إلغاء الخصم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink font-bold">
                {deductions.map((ded) => {
                  const emp = ded.employeeId;
                  const adminUser = ded.appliedBy;

                  return (
                    <tr key={ded._id} className="hover:bg-paper/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-black text-ink">{emp?.fullname || 'موظف'}</div>
                        <div className="text-[10px] text-ink-soft">{emp?.jobTitle || emp?.email}</div>
                      </td>

                      <td className="p-3.5">
                        <span className="text-sm font-black text-rose-600">
                          -{Number(ded.amount).toLocaleString()} ج.م
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono text-ink-soft">{ded.date}</span>
                      </td>

                      <td className="p-3.5 max-w-xs">
                        <p className="text-[11px] leading-relaxed text-ink truncate" title={ded.reason}>
                          {ded.reason}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <span className="text-[10px] text-ink-soft">
                          {adminUser?.fullname || 'الإدارة'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleDeleteDeduction(ded._id)}
                          title="إلغاء الخصم"
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
