import React, { useState } from 'react';
import {
  X,
  Eye,
  Calendar,
  User,
  Building,
  Printer,
  MessageCircle,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import axios from 'axios';

/**
 * Optics Prescription Modal (كارت كشف ومقاسات النظر للمريض)
 * Displays and allows adding full optometry refractions: OD/OS, SPH, CYL, AXIS, ADD, PD.
 */
export default function OpticsPrescriptionModal({
  customer,
  onClose,
  onSuccess,
  authHeader,
  showToast
}) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default / New Prescription State
  const [prescription, setPrescription] = useState({
    date: new Date().toISOString().split('T')[0],
    doctorName: '',
    clinicName: '',
    usageType: 'distance',
    rightEye: {
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      pd: '',
      prism: '',
      base: ''
    },
    leftEye: {
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      pd: '',
      prism: '',
      base: ''
    },
    ipd: '',
    notes: '',
    prescriptionImage: ''
  });

  // Calculate total IPD if individual PDs are entered
  const handlePdChange = (eye, val) => {
    const updated = {
      ...prescription,
      [eye]: { ...prescription[eye], pd: val }
    };
    const rPd = parseFloat(eye === 'rightEye' ? val : prescription.rightEye.pd) || 0;
    const lPd = parseFloat(eye === 'leftEye' ? val : prescription.leftEye.pd) || 0;
    if (rPd && lPd) {
      updated.ipd = (rPd + lPd).toFixed(1);
    }
    setPrescription(updated);
  };

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    if (!customer) return;

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `/api/admin/customers/${customer._id}/prescriptions`,
        { prescription },
        authHeader
      );
      showToast('تم حفظ كشف النظر بنجاح في ملف العميل');
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ كشف النظر', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick WhatsApp sharing of prescription measurements
  const handleShareWhatsApp = (p) => {
    const phone = customer.phone?.replace(/[^0-9]/g, '');
    if (!phone) {
      showToast('رقم هاتف العميل غير متوفر', 'error');
      return;
    }
    const cleanPhone = phone.startsWith('0') ? '20' + phone.substring(1) : phone;

    const text = `👓 *كارت مقاسات النظر - مركز البصريات* 👓
عزيزي العميل: *${customer.fullname}*
تاريخ الكشف: ${new Date(p.date || Date.now()).toLocaleDateString('ar-EG')}
الطبيب المعالج: ${p.doctorName || 'الفاحص المعتمد'}

👁️ *العين اليمنى (R / OD):*
• SPH (كروي): ${p.rightEye?.sph || '0.00'}
• CYL (سلندر): ${p.rightEye?.cyl || '0.00'}
• AXIS (المحور): ${p.rightEye?.axis || '—'}°
• ADD (القراءة): ${p.rightEye?.add || '—'}
• PD (البؤبؤ): ${p.rightEye?.pd || '—'} مم

👁️ *العين اليسرى (L / OS):*
• SPH (كروي): ${p.leftEye?.sph || '0.00'}
• CYL (سلندر): ${p.leftEye?.cyl || '0.00'}
• AXIS (المحور): ${p.leftEye?.axis || '—'}°
• ADD (القراءة): ${p.leftEye?.add || '—'}
• PD (البؤبؤ): ${p.leftEye?.pd || '—'} مم

📏 *المسافة بين البؤبؤين (IPD):* ${p.ipd || '—'} مم
نوع الاستخدام: ${
      p.usageType === 'distance'
        ? 'مسافات / كمبيوتر'
        : p.usageType === 'reading'
        ? 'قراءة وقريب'
        : p.usageType === 'progressive'
        ? 'متعددة البؤر (بروجريسيف)'
        : 'عام'
    }
${p.notes ? `\n📝 ملاحظات: ${p.notes}` : ''}
نتمنى لكم دوام الصحة والعافية!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Quick Print Card
  const handlePrintCard = (p) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>كارت مقاسات نظر - ${customer.fullname}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #1e293b; }
            .card { border: 2px solid #2563eb; border-radius: 12px; padding: 20px; max-width: 600px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 0; }
            .info { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; text-align: center; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; }
            th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
            .notes { margin-top: 16px; font-size: 12px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 class="title">👓 كارت مقاسات كشف النظر (Prescription Card)</h2>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">مركز البصريات الحديث - HI LUXE Optics</div>
            </div>
            <div class="info">
              <div><strong>اسم العميل:</strong> ${customer.fullname}</div>
              <div><strong>التليفون:</strong> ${customer.phone}</div>
              <div><strong>التاريخ:</strong> ${new Date(p.date || Date.now()).toLocaleDateString('ar-EG')}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>العين (Eye)</th>
                  <th>SPH (كروي)</th>
                  <th>CYL (سلندر)</th>
                  <th>AXIS (المحور)</th>
                  <th>ADD (قراءة)</th>
                  <th>PD (البؤبؤ)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: bold; background: #eff6ff;">العين اليمنى (OD / R)</td>
                  <td>${p.rightEye?.sph || '0.00'}</td>
                  <td>${p.rightEye?.cyl || '0.00'}</td>
                  <td>${p.rightEye?.axis ? p.rightEye.axis + '°' : '—'}</td>
                  <td>${p.rightEye?.add || '—'}</td>
                  <td>${p.rightEye?.pd || '—'}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; background: #eff6ff;">العين اليسرى (OS / L)</td>
                  <td>${p.leftEye?.sph || '0.00'}</td>
                  <td>${p.leftEye?.cyl || '0.00'}</td>
                  <td>${p.leftEye?.axis ? p.leftEye.axis + '°' : '—'}</td>
                  <td>${p.leftEye?.add || '—'}</td>
                  <td>${p.leftEye?.pd || '—'}</td>
                </tr>
              </tbody>
            </table>
            <div style="margin-top: 10px; font-size: 13px; font-weight: bold;">
              المسافة الكلية بين البؤبؤين (IPD): ${p.ipd || '—'} مم
            </div>
            ${p.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${p.notes}</div>` : ''}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const prescriptionsList = customer.prescriptions || [];
  const latestPrescription = prescriptionsList[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 text-xl">
              👓
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>سجل كشوفات ومقاسات النظر: {customer.fullname}</span>
              </h3>
              <p className="text-xs text-blue-200/80 mt-0.5">
                الهاتف: {customer.phone} | رصيد العربون: {customer.depositBalance || 0} ج.م
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'new'
                ? 'border-blue-600 text-blue-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>تسجيل كشف نظر جديد (New Prescription)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>الكشوفات السابقة ({prescriptionsList.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'new' ? (
            <form onSubmit={handleSavePrescription} className="space-y-6">
              {/* Doctor & Date Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">تاريخ الكشف:</label>
                  <input
                    type="date"
                    value={prescription.date}
                    onChange={(e) => setPrescription({ ...prescription, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">اسم الطبيب المعالج / الفاحص:</label>
                  <input
                    type="text"
                    placeholder="مثال: د. طارق الشناوي"
                    value={prescription.doctorName}
                    onChange={(e) => setPrescription({ ...prescription, doctorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">نوع الاستخدام:</label>
                  <select
                    value={prescription.usageType}
                    onChange={(e) => setPrescription({ ...prescription, usageType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="distance">مسافات / قيادة / كمبيوتر (Distance)</option>
                    <option value="reading">قراءة وقريب فقط (Reading)</option>
                    <option value="progressive">متعدد البؤر تدريجي (Progressive)</option>
                    <option value="bifocal">ثنائي البؤرة بخط فاصل (Bifocal)</option>
                    <option value="general">عام / شامل</option>
                  </select>
                </div>
              </div>

              {/* Optical Measurements Grid (OD & OS) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>جدول قياسات العينين (Optical Prescription Matrix)</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">SPH و CYL بربع درجة (0.25±)</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                        <th className="p-3 w-28">العين (Eye)</th>
                        <th className="p-3">SPH (كروي)</th>
                        <th className="p-3">CYL (أسطواني)</th>
                        <th className="p-3">AXIS (المحور 1-180°)</th>
                        <th className="p-3">ADD (إضافة القراءة)</th>
                        <th className="p-3">PD (البؤبؤ مم)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {/* Right Eye (OD) */}
                      <tr className="bg-blue-50/30 hover:bg-blue-50/50">
                        <td className="p-3 font-black text-blue-900 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          <span>اليمنى (OD / R)</span>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="-2.25"
                            value={prescription.rightEye.sph}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                rightEye: { ...prescription.rightEye, sph: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="-0.75"
                            value={prescription.rightEye.cyl}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                rightEye: { ...prescription.rightEye, cyl: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="175"
                            value={prescription.rightEye.axis}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                rightEye: { ...prescription.rightEye, axis: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="+2.00"
                            value={prescription.rightEye.add}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                rightEye: { ...prescription.rightEye, add: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-blue-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="31"
                            value={prescription.rightEye.pd}
                            onChange={(e) => handlePdChange('rightEye', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-blue-600"
                          />
                        </td>
                      </tr>

                      {/* Left Eye (OS) */}
                      <tr className="bg-indigo-50/30 hover:bg-indigo-50/50">
                        <td className="p-3 font-black text-indigo-900 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                          <span>اليسرى (OS / L)</span>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="-2.75"
                            value={prescription.leftEye.sph}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                leftEye: { ...prescription.leftEye, sph: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="-1.00"
                            value={prescription.leftEye.cyl}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                leftEye: { ...prescription.leftEye, cyl: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="180"
                            value={prescription.leftEye.axis}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                leftEye: { ...prescription.leftEye, axis: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="+2.00"
                            value={prescription.leftEye.add}
                            onChange={(e) =>
                              setPrescription({
                                ...prescription,
                                leftEye: { ...prescription.leftEye, add: e.target.value }
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-indigo-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="31.5"
                            value={prescription.leftEye.pd}
                            onChange={(e) => handlePdChange('leftEye', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs font-black text-slate-800 text-center outline-none focus:border-indigo-600"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">المسافة الكلية بين البؤبؤين (IPD):</span>
                    <input
                      type="text"
                      placeholder="62.5"
                      value={prescription.ipd}
                      onChange={(e) => setPrescription({ ...prescription, ipd: e.target.value })}
                      className="w-20 px-2 py-1 rounded bg-slate-50 border border-slate-300 text-xs font-bold text-center"
                    />
                    <span className="text-slate-400">مم</span>
                  </div>
                </div>
              </div>

              {/* Notes & Optional Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ملاحظات وتوصيات العدسات:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: يفضل عدسات بلو كت 1.56 مضغوطة لمستخدم كمبيوتر..."
                    value={prescription.notes}
                    onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    رابط صورة الروشتة الورقية (اختياري):
                  </label>
                  <input
                    type="text"
                    placeholder="https://... أو مسار صورة الروشتة الممسوحة"
                    value={prescription.prescriptionImage}
                    onChange={(e) => setPrescription({ ...prescription, prescriptionImage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ كشف النظر في سجل العميل'}
                </button>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-4">
              {prescriptionsList.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Eye className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold">لا توجد كشوفات نظر سابقة مسجلة لهذا العميل</p>
                </div>
              ) : (
                prescriptionsList.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all space-y-3 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">
                          #{prescriptionsList.length - idx}
                        </span>
                        <div className="text-xs font-black text-slate-800">
                          {new Date(p.date || Date.now()).toLocaleDateString('ar-EG')}
                        </div>
                        {p.doctorName && (
                          <span className="text-[11px] text-slate-500 font-medium">({p.doctorName})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(p)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold border border-emerald-200 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>إرسال واتساب</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintCard(p)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-bold border border-slate-200 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة كارت النظر</span>
                        </button>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-center border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <th className="p-2">العين</th>
                            <th className="p-2">SPH</th>
                            <th className="p-2">CYL</th>
                            <th className="p-2">AXIS</th>
                            <th className="p-2">ADD</th>
                            <th className="p-2">PD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="p-2 font-bold text-blue-800">اليمنى (OD)</td>
                            <td className="p-2 font-black">{p.rightEye?.sph || '0.00'}</td>
                            <td className="p-2 font-black">{p.rightEye?.cyl || '0.00'}</td>
                            <td className="p-2 font-black">{p.rightEye?.axis ? p.rightEye.axis + '°' : '—'}</td>
                            <td className="p-2">{p.rightEye?.add || '—'}</td>
                            <td className="p-2">{p.rightEye?.pd || '—'}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold text-indigo-800">اليسرى (OS)</td>
                            <td className="p-2 font-black">{p.leftEye?.sph || '0.00'}</td>
                            <td className="p-2 font-black">{p.leftEye?.cyl || '0.00'}</td>
                            <td className="p-2 font-black">{p.leftEye?.axis ? p.leftEye.axis + '°' : '—'}</td>
                            <td className="p-2">{p.leftEye?.add || '—'}</td>
                            <td className="p-2">{p.leftEye?.pd || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {p.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                        <strong>ملاحظات:</strong> {p.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
