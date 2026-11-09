import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Package,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
  Phone,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export default function SupplierSupplyRequestPage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionDone, setActionDone] = useState(null); // 'accept' | 'decline' | null
  const [actionMessage, setActionMessage] = useState('');

  const loadData = async () => {
    if (!token) {
      setError('رمز التحقق غير موجود بالرابط');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/procurement-public/supply-request/${token}`);
      setRequestData(res.data?.request || null);
    } catch (err) {
      console.error('Failed to load supply request:', err);
      setError(err.response?.data?.error || 'تعذر استرجاع تفاصيل طلب التوريد، قد يكون الرابط منتهياً.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleRespond = async (action) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await axios.post(`/api/procurement-public/supply-request/${token}/respond`, {
        action,
        notes: notes.trim()
      });
      setActionDone(action);
      setActionMessage(res.data?.message || (action === 'accept' ? 'تم تأكيد التوريد بنجاح!' : 'تم تسجيل اعتذارك.'));
      // Reload updated request state
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'تعذر تسجيل الرد، يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">جاري تحميل بيانات طلب التوريد...</p>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white">رابط غير صالح أو منتهي</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {error || 'لم نتمكن من العثور على طلب التوريد المطابق لهذا الرابط.'}
          </p>
        </div>
      </div>
    );
  }

  const isAccepted = requestData.myStatus === 'accepted' || actionDone === 'accept';
  const isDeclined = requestData.myStatus === 'declined' || actionDone === 'decline';
  const canRespond = requestData.isCurrentlyActive && !isAccepted && !isDeclined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6" dir="rtl">
      <div className="max-w-xl mx-auto w-full py-6 space-y-5">
        
        {/* Header Store Badge */}
        <div className="text-center space-y-1">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-black inline-flex items-center gap-1.5 shadow-xs">
            <Building2 className="w-3.5 h-3.5" />
            <span>{requestData.siteName || 'بوابة الموردين المعتمدين'}</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-black pt-1">
            طلب توريد وتأكيد جاهزية بضائع
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            رقم الطلب: <strong className="text-slate-800 dark:text-white">#{requestData.requestCode}</strong>
          </p>
        </div>

        {/* Greeting Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-400">المورد المحترم:</span>
            <div className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <span>{requestData.supplierName}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                أولوية #{requestData.priority}
              </span>
            </div>
          </div>
          <div className="text-left text-xs font-bold text-emerald-600">
            {requestData.branchName}
          </div>
        </div>

        {/* Product / Multi-Item & Lens Matrix Breakdown Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            {requestData.productImage ? (
              <img
                src={requestData.productImage}
                alt={requestData.productName}
                className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <Package className="w-8 h-8 text-slate-400" />
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 font-mono">
                {requestData.productSku ? `SKU: ${requestData.productSku}` : 'بيان طلب التوريد'}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                {requestData.productName}
              </h3>

              <div className="pt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-bold text-slate-500">إجمالي الوحدات المطلوبة:</span>
                <span className="text-2xl font-black text-emerald-600">
                  {requestData.quantity.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-500">قطعة / زوج</span>
              </div>
            </div>
          </div>

          {/* Detailed Items & SPH x CYL Lens Matrix Breakdown */}
          {Array.isArray(requestData.items) && requestData.items.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>📋 قائمة الأصناف وتفصيل مقاسات الجريد (SPH × CYL) المطلوبة:</span>
                <span className="text-[11px] font-mono text-emerald-600">
                  {requestData.items.length} أصناف
                </span>
              </h4>

              <div className="space-y-3">
                {requestData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {idx + 1}. {item.name}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-xs font-black shrink-0">
                        إجمالي الصنف: {item.quantity} وحدة
                      </span>
                    </div>

                    {Array.isArray(item.matrixBreakdown) && item.matrixBreakdown.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center justify-between">
                          <span>👓 جدول المقاسات المطلوبة من الدرج ({item.matrixBreakdown.length} مقاس SPH×CYL):</span>
                          <span className="text-[10px] text-slate-500">SPH / CYL → الكمية المطلوبة</span>
                        </div>
                        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                          <table className="w-full text-right text-[11px] font-mono">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                              <tr>
                                <th className="p-2">الدرجة الكروية (SPH)</th>
                                <th className="p-2">الاستجماتيزم (CYL)</th>
                                <th className="p-2 text-center">حالة الدرج بالمحل</th>
                                <th className="p-2 text-center">الكمية المطلوبة للتوريد</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {item.matrixBreakdown.map((cell, cIdx) => (
                                <tr key={cIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="p-2 font-black text-slate-900 dark:text-white" dir="ltr">
                                    {cell.sph}
                                  </td>
                                  <td className="p-2 font-black text-purple-700 dark:text-purple-300" dir="ltr">
                                    {cell.cyl}
                                  </td>
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        Number(cell.qty ?? cell.currentStock ?? 0) <= 0
                                          ? 'bg-red-500/10 text-red-600'
                                          : 'bg-amber-500/10 text-amber-700'
                                      }`}
                                    >
                                      {Number(cell.qty ?? cell.currentStock ?? 0) <= 0
                                        ? '0 (نافد تماماً)'
                                        : `${cell.qty ?? cell.currentStock} (حرج)`}
                                    </span>
                                  </td>
                                  <td className="p-2 text-center font-black text-emerald-600">
                                    {cell.neededQty || cell.quantity} زوج
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>فرع الاستلام: <strong className="text-slate-700 dark:text-slate-300">{requestData.branchName}</strong></span>
            {requestData.branchPhone && (
              <span dir="ltr" className="font-mono">{requestData.branchPhone}</span>
            )}
          </div>
        </div>

        {/* Status / Responses View */}
        {isAccepted && (
          <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2 animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-black text-emerald-700 dark:text-emerald-400">
              تم تأكيد جاهزية التوريد بنجاح!
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              شكراً لتعاونكم المثمر معنا. تم إشعار إدارة المتجر فوراً بتأكيدكم، وسيتم التواصل معكم لاستلام الشحنة وتنسيق الفواتير.
            </p>
          </div>
        )}

        {isDeclined && (
          <div className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-center space-y-2 animate-in fade-in">
            <XCircle className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-black text-slate-700 dark:text-slate-300">
              تم تسجيل اعتذاركم عن توريد هذا الصنف
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              شكراً لإبلاغنا في أقرب وقت. نتطلع للتعاون معكم في طلبيات أخرى قادمة.
            </p>
          </div>
        )}

        {canRespond && (
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                ملاحظات إضافية أو موعد التسليم المتوقع (اختياري):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: جاهز للتسليم خلال 24 ساعة، البضاعة متوفرة بالمخزن..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Big Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleRespond('accept')}
                disabled={isSubmitting}
                className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>جاهز للتوريد فوراً ✅</span>
              </button>

              <button
                type="button"
                onClick={() => handleRespond('decline')}
                disabled={isSubmitting}
                className="w-full py-4 px-5 rounded-2xl bg-slate-100 hover:bg-red-500/10 text-slate-700 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-700 hover:border-red-500/30 font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                <span>أعتذر، غير متوفر ❌</span>
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-400">
              💡 عند الضغط، يتم تسجيل ردكم فورياً في نظام المتجر وإشعار الإدارة تلقائياً.
            </p>
          </div>
        )}

      </div>

      <footer className="text-center py-4 text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800">
        نظام إدارة سلاسل الإمداد والتوريد الذكي • {requestData.siteName || 'المتجر الإلكتروني'}
      </footer>
    </div>
  );
}
