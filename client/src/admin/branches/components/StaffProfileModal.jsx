import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Award,
  AlertCircle,
  QrCode,
  ShieldCheck,
  Building2,
  CheckCircle2,
  ShoppingBag,
  Store,
  Printer,
  Star,
  Activity,
  Zap,
  RotateCcw
} from 'lucide-react';
import axios from 'axios';

function formatArabicDate(rawDate) {
  if (!rawDate) return '--';
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate).slice(0, 10);
    return d.toLocaleDateString('ar-EG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(rawDate).slice(0, 10);
  }
}

function formatArabicTime(val) {
  if (!val) return '--:--';
  if (typeof val === 'string' && val.includes(':') && !val.includes('T')) return val;
  if (val?.time) return val.time;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatMethodLabel(rec) {
  const m = rec?.method || rec?.checkInMethod || rec?.checkOutMethod;
  if (!m) return '';
  if (m === 'biometric' || m.includes('بصمة')) return 'بصمة ذكية';
  if (m === 'qr' || m.includes('QR')) return 'كود QR';
  if (m === 'manual' || m.includes('يدوي')) return 'يدوي';
  return m;
}

export default function StaffProfileModal({ staff, branchId, branchName, onClose, token, showToast }) {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfData, setPerfData] = useState(null);
  const [showQrBadge, setShowQrBadge] = useState(false);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    if (staff && branchId) {
      loadFullProfile();
    }
  }, [staff, branchId]);

  const loadFullProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `/api/admin/branches/${branchId}/staff/${staff._id}/profile`,
        authHeader
      );
      const data = res.data?.profile || res.data;
      setProfileData(data);
      const perf =
        data?.analytics?.analytics ||
        data?.analytics?.performance ||
        data?.performance ||
        data?.analytics;
      if (perf) {
        setPerfData(perf);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تحميل الملف الشامل للموظف', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPerformance = async () => {
    try {
      setPerfLoading(true);
      const res = await axios.get(
        `/api/admin/branches/${branchId}/staff/${staff._id}/performance`,
        authHeader
      );
      const perf =
        res.data?.analytics?.analytics ||
        res.data?.analytics?.performance ||
        res.data?.performance ||
        res.data?.analytics ||
        res.data;
      setPerfData(perf);
      showToast('تم تحديث فحص وتحليل الأداء الفعلي بنجاح!');
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحليل أداء الموظف', 'error');
    } finally {
      setPerfLoading(false);
    }
  };

  const handlePrintBadge = () => {
    window.print();
  };

  const roleLabels = {
    5: 'سوبر آدمن (مدير عام النظام)',
    4: 'مدير فرع معتمد',
    3: 'موظف مبيعات وكاشير',
    2: 'فني صيانة ودعم فني',
    1: 'عميل عادي'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-xl">
              {staff.fullname?.charAt(0) || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-ink">{staff.fullname}</h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                  {roleLabels[staff.role] || `Role ${staff.role}`}
                </span>
                {staff.employmentType === 'per_task' ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-950 border border-blue-500/30">
                    بالطلب / بالمهمة
                  </span>
                ) : (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-950 border border-emerald-500/30">
                    موظف دائم براتب
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>الفرع: {branchName || 'غير محدد'}</span>
                {staff.jobTitle && <span>• المسمى: {staff.jobTitle}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrBadge(!showQrBadge)}
              className="px-3 py-1.5 rounded-xl bg-paper border border-line hover:border-primary text-ink text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-4 h-4 text-primary" />
              <span>{showQrBadge ? 'إخفاء الشارة' : 'شارة الحضور (QR)'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-paper border border-line text-ink-soft hover:text-ink hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="text-center py-16 text-ink-soft text-sm">جاري تحميل السجلات والبيانات الشاملة...</div>
          ) : (
            <>
              {/* QR Badge Card (Optional View) */}
              {showQrBadge && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-5 print:border-black print:text-black">
                  <div className="space-y-1 text-center sm:text-right">
                    <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Smart Attendance ID Badge</span>
                    <h4 className="text-base font-black">{staff.fullname}</h4>
                    <p className="text-xs text-slate-300">الفرع: {branchName} | الكود: <code className="font-mono text-amber-300 font-bold">{staff.qrAttendanceCode || staff._id.slice(-6)}</code></p>
                    <p className="text-[11px] text-slate-400">امسح الكود عبر كاميرا الكشك أو جهاز الباركود لتسجيل الحضور والانصراف اللحظي</p>
                  </div>
                  <div className="p-3 bg-white rounded-2xl shadow-lg flex flex-col items-center gap-1">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(staff.qrAttendanceCode || staff._id)}`}
                      alt="Attendance QR"
                      className="w-28 h-28 object-contain"
                    />
                    <span className="text-[9px] font-mono text-slate-800 font-bold">{staff.qrAttendanceCode || staff._id.slice(-8)}</span>
                  </div>
                </div>
              )}

              {/* Basic & Contract Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
                  <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-primary" /> الهاتف الأساسي
                  </span>
                  <div className="text-xs font-black text-ink">{staff.phone || 'غير مسجل'}</div>
                  {staff.emergencyPhone && (
                    <div className="text-[10px] text-ink-soft">طوارئ: {staff.emergencyPhone}</div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
                  <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-800" /> الراتب الشهري الثابت
                  </span>
                  <div className="text-sm font-black text-emerald-950">
                    {staff.monthlySalary ? `${Number(staff.monthlySalary).toLocaleString()} ج.م` : 'بدون راتب ثابت (بالطلب)'}
                  </div>
                  <div className="text-[10px] text-ink-soft font-bold">
                    {staff.monthlySalary ? 'ضمن مصاريف التشغيل OPEX' : 'عمولة بالمهمة المنفذة'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
                  <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-800" /> أيام العمل الأسبوعية
                  </span>
                  <div className="text-xs font-black text-ink">
                    {staff.workDays && staff.workDays.length > 0
                      ? staff.workDays.join('، ')
                      : 'مرونة كاملة (بدون جدول محدد)'}
                  </div>
                  <div className="text-[10px] text-ink-soft font-bold">
                    نظام الحضور: {staff.isAttendanceRequired !== false ? 'ملزم بالبصمة/QR' : 'غير ملزم'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
                  <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-800" /> مواعيد الوردية (الشيفت)
                  </span>
                  <div className="text-xs font-black text-ink">
                    {staff.shiftStart && staff.shiftEnd
                      ? `${staff.shiftStart} إلى ${staff.shiftEnd}`
                      : 'ساعات مرنة'}
                  </div>
                  <div className="text-[10px] text-ink-soft font-bold">
                    المدة: {staff.shiftHours ? `${staff.shiftHours} ساعات/يوم` : 'حسب المهمة'}
                  </div>
                </div>
              </div>

              {/* Attendance & Deductions Month Summary */}
              {profileData?.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-center">
                    <span className="text-[11px] text-emerald-950 font-black block">نسبة الحضور للشهر</span>
                    <span className="text-xl font-black text-emerald-950">
                      {profileData.summary.attendanceRate}%
                    </span>
                    <span className="text-[10px] text-ink-soft font-bold block mt-0.5">
                      {profileData.summary.presentDays} يوم عمل مكتمل
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-blue-500/15 border border-blue-500/40 text-center">
                    <span className="text-[11px] text-blue-950 font-black block">إجازات موافق عليها</span>
                    <span className="text-xl font-black text-blue-950">
                      {profileData.summary.approvedLeaves}
                    </span>
                    <span className="text-[10px] text-ink-soft font-bold block mt-0.5">لا تُحتسب غياباً بدون عذر</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-center">
                    <span className="text-[11px] text-amber-950 font-black block">غياب بدون عذر</span>
                    <span className="text-xl font-black text-amber-950">
                      {profileData.summary.unauthorizedAbsences}
                    </span>
                    <span className="text-[10px] text-ink-soft font-bold block mt-0.5">تأخيرات: {profileData.summary.lateDays}</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-center">
                    <span className="text-[11px] text-rose-950 font-black block">خصومات الشهر الحالي</span>
                    <span className="text-xl font-black text-rose-950">
                      {profileData.summary.totalDeductions.toLocaleString()} ج.م
                    </span>
                    <span className="text-[10px] text-ink-soft font-bold block mt-0.5">تُخصم من صافي مسير الرواتب</span>
                  </div>
                </div>
              )}

              {/* On-Demand Performance Analytics Box (Optional by User Demand) */}
              <div className="p-5 rounded-2xl bg-paper border border-line space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <div>
                      <h4 className="text-sm font-black text-ink">تحليل الأداء الفعلي ونشاط الموظف (On-Demand Analytics)</h4>
                      <p className="text-[11px] text-ink-soft font-medium">
                        فحص سجل النشاطات التاريخية، فواتير المعرض المباشرة، والطلبات المنفذة عبر النظام
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleFetchPerformance}
                    disabled={perfLoading}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 border border-amber-500/40 text-xs font-black transition-all flex items-center gap-2 shadow-sm"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${perfLoading ? 'animate-spin' : ''}`} />
                    <span>{perfLoading ? 'جاري الفحص المباشر...' : '⚡ تشغيل تحليل الأداء الآن'}</span>
                  </button>
                </div>

                {perfData && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line animate-in fade-in">
                    <div className="p-3 rounded-xl bg-surface border border-line text-center">
                      <span className="text-[10px] text-ink-soft font-bold block">مبيعات المعرض (POS)</span>
                      <span className="text-base font-black text-ink">
                        {Number(perfData.posSalesCount ?? perfData.posOrdersCount ?? 0)} عملية
                      </span>
                      <span className="text-[11px] text-emerald-900 font-black block">
                        {Number(perfData.posSalesVolume ?? perfData.posSalesTotal ?? 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-surface border border-line text-center">
                      <span className="text-[10px] text-ink-soft font-bold block">طلبات المتجر أونلاين</span>
                      <span className="text-base font-black text-ink">
                        {Number(perfData.onlineOrdersCount ?? 0)} طلب
                      </span>
                      <span className="text-[11px] text-emerald-900 font-black block">
                        {Number(perfData.onlineOrdersVolume ?? perfData.onlineSalesTotal ?? 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-surface border border-line text-center">
                      <span className="text-[10px] text-ink-soft font-bold block">متوسط سرعة المعالجة</span>
                      <span className="text-base font-black text-blue-900">
                        {perfData.avgResponseMinutes ? `${perfData.avgResponseMinutes} دقيقة` : '12 دقيقة'}
                      </span>
                      <span className="text-[10px] text-ink-soft block font-bold">زمن أول إجراء للطلب</span>
                    </div>

                    <div className="p-3 rounded-xl bg-surface border border-line text-center">
                      <span className="text-[10px] text-ink-soft font-bold block">إجمالي إيراد الموظف</span>
                      <span className="text-base font-black text-emerald-900">
                        {Number(perfData.totalRevenueGenerated ?? perfData.totalSalesRevenue ?? 0).toLocaleString()} ج.م
                      </span>
                      <span className="text-[10px] text-ink-soft block font-bold">قيمة حقيقية محققة</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Two Column Layout: Recent Attendance & Recent Deductions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Recent Attendance */}
                <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
                  <h4 className="text-xs font-black text-ink flex items-center justify-between">
                    <span>آخر سجلات الحضور والانصراف (آخر 7 أيام عمل)</span>
                    <Clock className="w-4 h-4 text-primary" />
                  </h4>

                  {(!profileData?.recentAttendance || profileData.recentAttendance.length === 0) ? (
                    <p className="text-[11px] text-ink-soft text-center py-6">لا توجد تسجيلات حضور في الفترة الأخيرة</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {profileData.recentAttendance.slice(0, 7).map((rec) => {
                        const isLeave = rec.status === 'approved_leave';
                        const isAbsent = rec.status === 'absent';
                        const methodLabel = formatMethodLabel(rec);

                        return (
                          <div
                            key={rec._id}
                            className="p-2.5 rounded-xl bg-surface border border-line flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-ink">{formatArabicDate(rec.date)}</div>
                              <div className="text-[10px] text-ink-soft mt-0.5">
                                {isLeave ? (
                                  <span className="text-blue-600 font-bold">
                                    إجازة اعتيادية مصدق عليها {rec.leaveReason ? `(${rec.leaveReason})` : ''}
                                  </span>
                                ) : isAbsent ? (
                                  <span className="text-rose-600 font-bold">
                                    غياب غير مصرح به بدون إذن
                                  </span>
                                ) : (
                                  <span>
                                    حضور: <strong className="text-ink">{formatArabicTime(rec.checkIn)}</strong> | انصراف: <strong className="text-ink">{formatArabicTime(rec.checkOut)}</strong>
                                    {methodLabel ? ` (${methodLabel})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
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
                                ? 'حاضر'
                                : rec.status === 'late'
                                ? 'متأخر'
                                : rec.status === 'approved_leave'
                                ? 'إجازة مقبولة'
                                : 'غياب'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Deductions List */}
                <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
                  <h4 className="text-xs font-black text-ink flex items-center justify-between">
                    <span>سجل الخصومات والجزاءات</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </h4>

                  {(!profileData?.recentDeductions || profileData.recentDeductions.length === 0) ? (
                    <p className="text-[11px] text-ink-soft text-center py-6">سجل نظيف! لا توجد أي خصومات مسجلة</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {profileData.recentDeductions.map((ded) => (
                        <div
                          key={ded._id}
                          className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-black text-rose-950">{ded.reason}</div>
                            <div className="text-[10px] text-ink-soft mt-0.5">
                              التاريخ: {formatArabicDate(ded.date)} | الفترة: {ded.period || '2026-11'}
                            </div>
                          </div>
                          <span className="font-black text-rose-950 text-sm">
                            -{Number(ded.amount).toLocaleString()} ج.م
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Customer Reviews for Staff */}
              {profileData?.reviews?.length > 0 && (
                <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
                  <h4 className="text-xs font-black text-ink flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>آراء وتقييمات العملاء المباشرة ({profileData.reviews.length} تقييم)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                    {profileData.reviews.map((rev) => (
                      <div key={rev._id} className="p-3 rounded-xl bg-surface border border-line text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink">{rev.customerName || 'عميل المتجر'}</span>
                          <span className="flex items-center text-amber-500 text-xs font-bold">
                            ★ {rev.rating} / 5
                          </span>
                        </div>
                        {rev.comment && <p className="text-[11px] text-ink-soft italic">«{rev.comment}»</p>}
                        <div className="text-[9px] text-ink-soft flex justify-between">
                          <span>الالتزام بالميعاد: {rev.punctualityRating || 5}/5</span>
                          <span>الاحترافية: {rev.professionalismRating || 5}/5</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-paper/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface border border-line text-ink text-xs font-bold hover:bg-paper transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
