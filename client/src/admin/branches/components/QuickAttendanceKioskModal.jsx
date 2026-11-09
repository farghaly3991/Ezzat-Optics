import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Building2,
  ScanLine,
  LogIn,
  LogOut
} from 'lucide-react';
import axios from 'axios';

export default function QuickAttendanceKioskModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  token,
  showToast,
  onSuccess
}) {
  if (!isOpen) return null;

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Keep focus on input for continuous barcode/QR scanning
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [lastScanResult, errorMsg]);

  const handleScanSubmit = async (e) => {
    e?.preventDefault();
    const code = inputCode.trim();
    if (!code) return;

    setSubmitting(true);
    setErrorMsg('');
    setLastScanResult(null);

    try {
      const res = await axios.post(
        `/api/admin/branches/${branchId}/attendance/verify-qr`,
        { qrCode: code },
        authHeader
      );

      setLastScanResult(res.data);
      setInputCode('');
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.error || 'فشل التحقق من كود الحضور';
      setErrorMsg(msg);
      setInputCode('');
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">نقطة الحضور والانصراف السريع (QR Kiosk)</h3>
              <p className="text-xs text-ink-soft">الفرع: {branchName || 'الفرع الحالي'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-paper border border-line text-ink-soft hover:text-ink hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Content */}
        <div className="p-6 space-y-6 text-center">
          
          <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
              وجه كاميرا الماسح أو قارئ الباركود نحو شارة الموظف (QR Badge) أو أدخل كود الموظف يدوياً
            </p>
            <p className="text-[11px] text-ink-soft">
              يقوم النظام تلقائياً بتحديد نوع الحركة: تسجيل الحضور إذا لم يسجل، أو تسجيل الانصراف وحساب إجمالي الساعات المنقضية
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleScanSubmit} className="space-y-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="امسح الـ QR أو اكتب الكود واضغط Enter..."
                disabled={submitting}
                className="w-full text-center text-sm font-mono font-black tracking-wider py-3.5 px-4 rounded-2xl bg-paper border-2 border-line focus:border-primary focus:outline-none text-ink shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !inputCode.trim()}
              className="w-full py-3 rounded-2xl bg-primary text-white text-xs font-black shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              <span>{submitting ? 'جاري التحقق والتسجيل...' : 'تسجيل الحركة الآن (Check In/Out)'}</span>
            </button>
          </form>

          {/* Result Card */}
          {lastScanResult && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-center gap-2 text-sm font-black">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{lastScanResult.message}</span>
              </div>
              <div className="text-xs font-bold">
                الموظف: <span className="font-black text-ink">{lastScanResult.employee?.fullname}</span> ({lastScanResult.employee?.jobTitle || 'طاقم العمل'})
              </div>
              <div className="text-[11px] text-ink-soft flex items-center justify-center gap-4">
                <span>النوع: {lastScanResult.action === 'check_in' ? '🟢 تسجيل حضور' : '🔴 تسجيل انصراف'}</span>
                <span>الحالة: {lastScanResult.status === 'present' ? 'منضبط' : lastScanResult.status === 'late' ? 'متأخر' : lastScanResult.status}</span>
                {lastScanResult.totalMinutes && (
                  <span>المدة: {Math.floor(lastScanResult.totalMinutes / 60)} ساعة و{lastScanResult.totalMinutes % 60} دقيقة</span>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-2 animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-paper/50 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-surface border border-line text-ink text-xs font-bold hover:bg-paper transition-colors"
          >
            إغلاق شاشة الكشك
          </button>
        </div>

      </div>
    </div>
  );
}
