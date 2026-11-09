import React, { useState } from 'react';
import {
  Eye,
  Check,
  Edit2,
  Calendar,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Image as ImageIcon,
  X,
  Plus,
  Copy
} from 'lucide-react';

/**
 * POS Prescription Card
 * Displays the customer's latest clinical prescription directly inside the cashier screen.
 * Shows customer age, exam date, re-exam alert if > 1 year ago, attached prescription photo,
 * and prominent actions to:
 * 1) Copy & adopt existing readings for the current invoice.
 * 2) Record brand new clinical exam readings for the customer.
 */
export default function PosPrescriptionCard({
  prescription,
  customer = null,
  onApplyPrescription,
  onOpenFullPrescriptionsModal,
  appliedPrescription = null
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);

  if (!prescription) {
    return (
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between animate-fadeIn">
        <div className="flex items-center gap-2 text-amber-900">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            لا يوجد كشف نظر مسجل للعميل{' '}
            {customer?.age !== null && customer?.age !== undefined && (
              <b className="px-1.5 py-0.5 rounded-full bg-amber-200/60 text-amber-950 font-mono">
                (السن: {customer.age} سنة)
              </b>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenFullPrescriptionsModal}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1 shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ إدخال قراءات كشف جديد</span>
        </button>
      </div>
    );
  }

  const isApplied = Boolean(appliedPrescription);
  const examDate = prescription.examDate || prescription.date || prescription.createdAt;
  const examTime = examDate ? new Date(examDate).getTime() : null;
  const daysSinceExam = examTime ? Math.floor((Date.now() - examTime) / (1000 * 60 * 60 * 24)) : null;
  const requiresReExam = Boolean(customer?.requiresReExam) || (daysSinceExam !== null && daysSinceExam > 365);
  const prescriptionPhoto = prescription.prescriptionImage || customer?.prescriptionImage || '';

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3 transition-all animate-fadeIn shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-xs">
            👁️
          </div>
          <div>
            <div className="text-xs font-black text-blue-950 flex items-center gap-2">
              <span>كشف النظر الأخير للعميل</span>
              {customer?.age !== null && customer?.age !== undefined && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-950 border border-blue-300 font-mono">
                  السن: {customer.age} سنة
                </span>
              )}
              {isApplied && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-xs animate-fadeIn">
                  <Check className="w-3 h-3" />
                  <span>معتمد بالفاتورة</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-blue-700/80 mt-0.5">
              تاريخ الكشف: {examDate ? new Date(examDate).toLocaleDateString('ar-EG') : 'غير محدد'}
              {prescription.doctorName ? ` | د. ${prescription.doctorName}` : ''}
              {prescription.usageType ? ` (${prescription.usageType === 'distance' ? 'مسافات' : prescription.usageType === 'reading' ? 'قراءة' : prescription.usageType})` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {prescriptionPhoto && (
            <button
              type="button"
              onClick={() => setIsImagePreviewOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-white hover:bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 transition-all"
              title="عرض صورة الروشتة المرفقة"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>الروشتة</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
            title={isExpanded ? 'طي الجدول' : 'عرض الجدول'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Re-Exam Alert Badge */}
      {requiresReExam && (
        <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 text-[11px] flex items-center justify-between font-bold">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              ⚠️ تنبيه: مضى أكثر من عام ({daysSinceExam || 365}+ يوم) على آخر فحص. يُنصح بإجراء كشف نظر جديد لضبط المقاسات بدقة.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenFullPrescriptionsModal}
            className="text-amber-800 underline font-black hover:text-black shrink-0 mr-2"
          >
            فحص جديد
          </button>
        </div>
      )}

      {/* Refraction Matrix Table */}
      {isExpanded && (
        <div className="border border-blue-200 rounded-xl overflow-hidden bg-white text-xs shadow-2xs">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-blue-100/70 text-blue-950 font-bold border-b border-blue-200">
                <th className="p-1.5">العين</th>
                <th className="p-1.5">SPH (كروي)</th>
                <th className="p-1.5">CYL (أسطواني)</th>
                <th className="p-1.5">AXIS (المحور)</th>
                <th className="p-1.5">ADD (قراءة)</th>
                <th className="p-1.5">PD (البؤبؤ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100 font-mono font-bold">
              <tr className="hover:bg-blue-50/40">
                <td className="p-1.5 text-blue-800 font-sans font-black">اليمنى (OD)</td>
                <td className="p-1.5 text-slate-800">{prescription.rightEye?.sph || '0.00'}</td>
                <td className="p-1.5 text-slate-800">{prescription.rightEye?.cyl || '0.00'}</td>
                <td className="p-1.5 text-slate-800">
                  {prescription.rightEye?.axis ? prescription.rightEye.axis + '°' : '—'}
                </td>
                <td className="p-1.5 text-slate-600">{prescription.rightEye?.add || '—'}</td>
                <td className="p-1.5 text-slate-600">{prescription.rightEye?.pd || '—'}</td>
              </tr>
              <tr className="hover:bg-blue-50/40">
                <td className="p-1.5 text-indigo-800 font-sans font-black">اليسرى (OS)</td>
                <td className="p-1.5 text-slate-800">{prescription.leftEye?.sph || '0.00'}</td>
                <td className="p-1.5 text-slate-800">{prescription.leftEye?.cyl || '0.00'}</td>
                <td className="p-1.5 text-slate-800">
                  {prescription.leftEye?.axis ? prescription.leftEye.axis + '°' : '—'}
                </td>
                <td className="p-1.5 text-slate-600">{prescription.leftEye?.add || '—'}</td>
                <td className="p-1.5 text-slate-600">{prescription.leftEye?.pd || '—'}</td>
              </tr>
            </tbody>
          </table>
          {prescription.ipd && (
            <div className="px-3 py-1 bg-blue-50/60 text-[11px] text-blue-900 border-t border-blue-100 flex justify-between font-bold">
              <span>المسافة بين البؤبؤين (IPD):</span>
              <span className="font-mono">{prescription.ipd} مم</span>
            </div>
          )}
        </div>
      )}

      {/* Prominent Action Buttons: Adopt vs New Exam */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onApplyPrescription(prescription)}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs ${
            isApplied
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-300'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isApplied ? (
            <>
              <Check className="w-4 h-4" />
              <span>✓ تم اعتماد نفس القراءات للفاتورة (انقر للإلغاء)</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>نسخ واعتماد نفس القراءات للفاتورة الحالية</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenFullPrescriptionsModal}
          className="py-2 px-3 rounded-xl text-xs font-bold bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 flex items-center justify-center gap-1.5 transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>إدخال قراءات كشف جديد</span>
        </button>
      </div>

      {/* Image Preview Modal */}
      {isImagePreviewOpen && prescriptionPhoto && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-xl w-full bg-white p-3 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b">
              <span className="text-xs font-bold text-slate-800">صورة كشف النظر المرفقة للعميل</span>
              <button
                type="button"
                onClick={() => setIsImagePreviewOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={prescriptionPhoto} alt="Prescription" className="w-full max-h-[75vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
