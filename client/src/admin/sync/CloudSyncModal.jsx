import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  ShieldAlert
} from 'lucide-react';

export default function CloudSyncModal({ isOpen, onClose, showToast }) {
  const [onlineStatus, setOnlineStatus] = useState({ checking: true, online: false });
  const [direction, setDirection] = useState(null); // 'push' | 'pull' | null
  const [confirmationInput, setConfirmationInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Check cloud connection on open
  useEffect(() => {
    if (isOpen) {
      checkConnectivity();
      setDirection(null);
      setConfirmationInput('');
      setSyncResult(null);
    }
  }, [isOpen]);

  const checkConnectivity = async () => {
    setOnlineStatus({ checking: true, online: false });
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      setOnlineStatus({ checking: false, ...data });
    } catch (err) {
      setOnlineStatus({ checking: false, online: false, message: 'تعذر الاتصال بالخادم' });
    }
  };

  const handleExecuteSync = async () => {
    if (confirmationInput !== 'مزامنة') {
      showToast('يجب كتابة كلمة "مزامنة" بدقة لتأكيد العملية', 'error');
      return;
    }

    setLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          confirmationText: confirmationInput
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت المزامنة');

      setSyncResult(data);
      showToast(data.message || 'تمت المزامنة بنجاح!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-cyan-300">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black">مزامنة السحابة (Ezzat Optics Cloud Sync)</h3>
              <p className="text-xs text-blue-200 font-medium">مزامنة البيانات بين النسخة المحلية وقاعدة البيانات السحابية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connectivity Status Banner */}
        <div className={`px-5 py-3 border-b flex items-center justify-between text-xs font-bold ${
          onlineStatus.checking
            ? 'bg-slate-50 text-slate-600 border-slate-200'
            : onlineStatus.online
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {onlineStatus.checking ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
            ) : onlineStatus.online ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <span>
              {onlineStatus.checking
                ? 'جاري فحص الاتصال بالإنترنت وبالسحابة...'
                : onlineStatus.online
                ? `متصل بالسحابة بنجاح (استجابة: ${onlineStatus.latencyMs}ms)`
                : onlineStatus.message || 'غير متصل بالإنترنت'}
            </span>
          </div>
          <button
            onClick={checkConnectivity}
            disabled={onlineStatus.checking}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-700 shadow-xs"
          >
            إعادة الفحص
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!onlineStatus.online && !onlineStatus.checking && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block">لا يمكن إجراء المزامنة بدون إنترنت</span>
                تأكد من توصيل الجهاز بالشبكة أولاً، حيث تتطلب هذه الميزة الوصول إلى كلاود MongoDB Atlas.
              </div>
            </div>
          )}

          {/* Sync Direction Choice */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-700 block">اختر نوع واتجاه المزامنة:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: PUSH (Local -> Cloud) */}
              <div
                onClick={() => setDirection('push')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  direction === 'push'
                    ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <span className="font-black text-sm text-slate-900">رفع للسحابة (Push)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  <strong>متى أستخدمه؟</strong> في نهاية اليوم لرفع المبيعات والفواتير والعملاء الجدد المسجلين محلياً إلى السحابة.
                </p>
              </div>

              {/* Option 2: PULL (Cloud -> Local) */}
              <div
                onClick={() => setDirection('pull')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  direction === 'pull'
                    ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                    <CloudDownload className="w-4 h-4" />
                  </div>
                  <span className="font-black text-sm text-slate-900">سحب من السحابة (Pull)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  <strong>متى أستخدمه؟</strong> عند تثبيت جهاز جديد في الفرع أو رغبتك في جلب أحدث قائمة أسعار ومنتجات من السحابة إلى هذا الجهاز.
                </p>
              </div>
            </div>
          </div>

          {/* Extreme Warning Barrier & Confirmation */}
          {direction && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-red-900">تحذير أمني شديد الأهمية!</h4>
                  <p className="text-[11px] text-red-700 leading-relaxed mt-0.5">
                    {direction === 'push'
                      ? 'سيتم تحديث سجلات السحابة بالبيانات الموجودة حالياً على هذا الجهاز. تأكد من أن بيانات هذا الجهاز هي الأحدث.'
                      : 'سيتم استبدال البيانات القديمة على هذا الجهاز بأحدث نسخة موجودة على السحابة.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-red-200/80">
                <label className="block text-[11px] font-black text-red-900 mb-1.5">
                  لتأكيد العملية، اكتب كلمة <span className="font-mono bg-red-200/60 px-1.5 py-0.5 rounded text-red-900 font-black">مزامنة</span> في الحقل أدناه:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value.trim())}
                  placeholder='اكتب: مزامنة'
                  className="w-full px-3 py-2 rounded-xl bg-white border border-red-300 text-xs font-black text-center text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          )}

          {/* Sync Result Report */}
          {syncResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-black">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{syncResult.message}</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                تمت مواءمة الجداول الأساسية (المنتجات، الفواتير، العملاء، الخزينة، الفروع) بنجاح تام.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
          >
            إلغاء
          </button>

          <button
            onClick={handleExecuteSync}
            disabled={!onlineStatus.online || !direction || confirmationInput !== 'مزامنة' || loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-md ${
              !onlineStatus.online || !direction || confirmationInput !== 'مزامنة' || loading
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : direction === 'push'
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-95'
                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20 active:scale-95'
            }`}
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>بدء المزامنة الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
