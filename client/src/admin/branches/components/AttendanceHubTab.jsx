import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  User,
  ShieldCheck,
  Check,
  LogIn,
  LogOut,
  Sparkles
} from 'lucide-react';
import axios from 'axios';

export default function AttendanceHubTab({
  branchId,
  branchName,
  staffList = [],
  token,
  showToast,
  onOpenKiosk
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ present: 0, late: 0, leave: 0, absent: 0 });

  // Manual Check-in modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: staffList[0]?._id || '',
    date: todayStr,
    checkInTime: '09:00',
    checkOutTime: '',
    status: 'present',
    note: ''
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `/api/admin/branches/${branchId}/attendance?date=${selectedDate}`,
        authHeader
      );
      const data = res.data?.records || [];
      setRecords(data);

      // Compute quick stats
      let presentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      data.forEach((r) => {
        if (r.status === 'present') presentCount++;
        else if (r.status === 'late') lateCount++;
        else if (r.status === 'approved_leave') leaveCount++;
        else absentCount++;
      });

      setStats({
        present: presentCount,
        late: lateCount,
        leave: leaveCount,
        absent: absentCount
      });
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل سجل الحضور والانصراف', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      loadAttendance();
    }
  }, [branchId, selectedDate]);

  const handleClockOut = async (rec) => {
    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await axios.put(
        `/api/admin/branches/${branchId}/attendance/${rec._id}/clock-out`,
        { checkOutTime: timeStr },
        authHeader
      );
      showToast(`تم تسجيل انصراف الموظف بنجاح (${timeStr})`);
      loadAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تسجيل الانصراف', 'error');
    }
  };

  const handleApproveLeave = async (rec) => {
    try {
      await axios.put(
        `/api/admin/branches/${branchId}/attendance/${rec._id}/approve-leave`,
        { note: 'إجازة رسمية موافق عليها من إدارة الفرع' },
        authHeader
      );
      showToast('تم اعتماد الإجازة بنجاح، ولن تُحتسب غياباً غير مبرر');
      loadAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل اعتماد الإجازة', 'error');
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.employeeId) {
      showToast('يرجى اختيار الموظف أولاً', 'error');
      return;
    }

    setSubmittingManual(true);
    try {
      await axios.post(
        `/api/admin/branches/${branchId}/attendance/manual`,
        {
          employeeId: manualForm.employeeId,
          date: manualForm.date,
          checkInTime: manualForm.checkInTime,
          checkOutTime: manualForm.checkOutTime || undefined,
          status: manualForm.status,
          note: manualForm.note
        },
        authHeader
      );
      showToast('تم تسجيل الحضور اليدوي وتحديث السجل بنجاح!');
      setShowManualModal(false);
      loadAttendance();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل الحضور اليدوي', 'error');
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Date & Kiosk Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-paper border border-line px-3 py-1.5 rounded-xl text-xs font-bold text-ink">
            <Calendar className="w-4 h-4 text-primary" />
            <span>تاريخ السجل:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-ink font-bold focus:outline-none"
            />
          </div>

          <button
            onClick={loadAttendance}
            title="تحديث السجل"
            className="p-2 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenKiosk}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <ScanLine className="w-4 h-4" />
            <span>نقطة الحضور السريع (QR Kiosk)</span>
          </button>

          <button
            onClick={() => {
              setManualForm({
                employeeId: staffList[0]?._id || '',
                date: selectedDate,
                checkInTime: '09:00',
                checkOutTime: '',
                status: 'present',
                note: ''
              });
              setShowManualModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-paper border border-line hover:border-primary text-ink text-xs font-black transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>تسجيل يدوي</span>
          </button>
        </div>
      </div>

      {/* KPI Stats for the selected day */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center">
          <span className="text-[11px] text-emerald-950 font-black block">حاضرون في الموعد</span>
          <span className="text-xl font-black text-emerald-950">{stats.present}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-center">
          <span className="text-[11px] text-amber-950 font-black block">متأخرون عن الشيفت</span>
          <span className="text-xl font-black text-amber-950">{stats.late}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-center">
          <span className="text-[11px] text-blue-950 font-black block">إجازات معتمدة</span>
          <span className="text-xl font-black text-blue-950">{stats.leave}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-center">
          <span className="text-[11px] text-rose-950 font-black block">غياب غير مسجل</span>
          <span className="text-xl font-black text-rose-950">{stats.absent}</span>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-16 text-ink-soft text-sm">جاري جلب سجلات الحضور والانصراف...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-ink-soft space-y-2">
            <Clock className="w-12 h-12 mx-auto text-ink-soft/40" />
            <p className="font-bold">لا توجد حركات حضور مسجلة لهذا التاريخ في هذا الفرع</p>
            <p className="text-xs">استخدم الكشك الذكي للبدء في مسح الشارات أو سجل يدوياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper/70 text-ink-soft font-bold border-b border-line">
                <tr>
                  <th className="p-3.5">الموظف</th>
                  <th className="p-3.5">وقت الحضور</th>
                  <th className="p-3.5">وقت الانصراف</th>
                  <th className="p-3.5">إجمالي الساعات</th>
                  <th className="p-3.5">طريقة الإثبات</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink font-bold">
                {records.map((rec) => {
                  const emp = rec.employeeId;
                  const hasCheckOut = Boolean(rec.checkOut?.time);

                  return (
                    <tr key={rec._id} className="hover:bg-paper/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-black text-ink">{emp?.fullname || 'موظف'}</div>
                        <div className="text-[10px] text-ink-soft">{emp?.jobTitle || emp?.email}</div>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono text-emerald-600 font-black">
                          {rec.checkIn?.time || '--:--'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono text-ink-soft font-black">
                          {rec.checkOut?.time || 'لم ينصرف بعد'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {rec.totalMinutes ? (
                          <span>{Math.floor(rec.totalMinutes / 60)} س و {rec.totalMinutes % 60} د</span>
                        ) : (
                          <span className="text-ink-soft text-[10px]">قيد العمل</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper border border-line">
                          {rec.method === 'qr' ? 'مسح QR ذكي' : rec.method === 'manual' ? 'تسجيل يدوي' : 'بصمة'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            rec.status === 'present'
                              ? 'bg-emerald-500/20 text-emerald-950 border border-emerald-500/30'
                              : rec.status === 'late'
                              ? 'bg-amber-500/20 text-amber-950 border border-amber-500/30'
                              : rec.status === 'approved_leave'
                              ? 'bg-blue-500/20 text-blue-950 border border-blue-500/30'
                              : 'bg-rose-500/20 text-rose-950 border border-rose-500/30'
                          }`}
                        >
                          {rec.status === 'present'
                            ? 'حاضر منضبط'
                            : rec.status === 'late'
                            ? 'متأخر'
                            : rec.status === 'approved_leave'
                            ? 'إجازة معتمدة'
                            : 'غياب'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!hasCheckOut && rec.status !== 'approved_leave' && (
                            <button
                              onClick={() => handleClockOut(rec)}
                              title="تسجيل انصراف الآن"
                              className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 text-[10px] font-black transition-colors flex items-center gap-1"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>انصراف</span>
                            </button>
                          )}

                          {rec.status !== 'approved_leave' && (
                            <button
                              onClick={() => handleApproveLeave(rec)}
                              title="اعتماد كإجازة رسمية (لا تحسب غياب بدون عذر)"
                              className="px-2 py-1 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 text-[10px] font-black transition-colors"
                            >
                              اعتماد إجازة
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Check-in Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
              <h3 className="text-base font-black text-ink">تسجيل حضور / انصراف يدوي</h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-2 rounded-xl bg-paper border border-line text-ink-soft hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-5 space-y-4 text-xs font-bold">
              <div>
                <label className="block text-ink-soft mb-1">الموظف *</label>
                <select
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  {staffList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.fullname} ({s.jobTitle || 'طاقم العمل'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">ساعة الحضور *</label>
                  <input
                    type="time"
                    required
                    value={manualForm.checkInTime}
                    onChange={(e) => setManualForm({ ...manualForm, checkInTime: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>

                <div>
                  <label className="block text-ink-soft mb-1">ساعة الانصراف (اختياري)</label>
                  <input
                    type="time"
                    value={manualForm.checkOutTime}
                    onChange={(e) => setManualForm({ ...manualForm, checkOutTime: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">حالة الحضور *</label>
                <select
                  value={manualForm.status}
                  onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  <option value="present">حاضر (منضبط)</option>
                  <option value="late">حاضر (متأخر عن الشيفت)</option>
                  <option value="approved_leave">إجازة رسمية موافق عليها</option>
                </select>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">ملاحظة توضيحية</label>
                <input
                  type="text"
                  value={manualForm.note}
                  onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                  placeholder="سبب التسجيل اليدوي..."
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-btn bg-paper border border-line text-ink text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-5 py-2 rounded-btn bg-primary text-white text-xs font-black shadow-md"
                >
                  {submittingManual ? 'جاري الحفظ...' : 'تأكيد التسجيل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
