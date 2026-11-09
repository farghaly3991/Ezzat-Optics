import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Receipt,
  Eye,
  MessageCircle,
  ExternalLink,
  Printer,
  Glasses,
  DollarSign,
  Plus,
  FileText,
  Building2,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import OpticsThermalReceiptModal from '../../pos/components/OpticsThermalReceiptModal';

/**
 * CustomerProfileModal (Customer 360 CRM for Optics)
 * Comprehensive profile with past orders, active lab orders,
 * deposit on account, outstanding balances, age, and eye exam matrix.
 */
export default function CustomerProfileModal({
  customerId,
  onClose,
  token,
  currency = 'ج.م',
  showToast,
  onOpenNewPrescription
}) {
  const { config } = useStore();
  const isOptics = config?.systemProfile === 'optics' && config?.enableOpticsPrescriptions !== false;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'prescriptions' | 'deposits'
  const [printingOrder, setPrintingOrder] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadProfile = () => {
    if (!customerId || !token) return;
    setLoading(true);
    axios
      .get(`/api/admin/customers/${customerId}/profile`, authHeader)
      .then((res) => {
        setProfile(res.data?.profile || null);
      })
      .catch((err) => {
        showToast(err.response?.data?.error || 'تعذر تحميل ملف العميل', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProfile();
  }, [customerId, token]);

  if (!customerId) return null;

  const handleWhatsApp = () => {
    if (!profile?.phone) return;
    let clean = profile.phone.replace(/[^\d+]/g, '');
    if (!clean.startsWith('+')) {
      if (clean.startsWith('0')) clean = '20' + clean.substring(1);
      else clean = '20' + clean;
    } else {
      clean = clean.replace('+', '');
    }
    const msg = `مرحباً ${profile.fullname || 'عميلنا العزيز'}، نرحب بكم ونسعد بخدمتكم في متجرنا للبصريات ✨👓.`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
      <div className="bg-surface border border-line rounded-card shadow-2xl w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col text-right">
        {/* Modal Header */}
        <div className="p-4 bg-paper border-b border-line flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1.5 rounded-btn hover:bg-surface text-ink-soft hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-base font-black text-ink flex items-center gap-2 justify-end">
                <span>ملف وبروفايل العميل الشامل (Customer 360)</span>
                <User className="w-5 h-5 text-primary" />
              </h2>
              <p className="text-xs text-ink-soft">
                كافة العمليات السابقة، أوامر المعمل، كشوفات النظر، والرصيد المالي
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-12 text-center text-ink-soft text-sm font-bold animate-pulse">
            جاري تحميل بيانات العميل والعمليات السابقة...
          </div>
        ) : !profile ? (
          <div className="p-8 text-center text-red-500 font-bold">
            تعذر العثور على بيانات هذا العميل.
          </div>
        ) : (
          <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
            {/* Customer Personal Info Card */}
            <div className="p-4 rounded-2xl bg-paper border border-line flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-ink">{profile.fullname}</h3>
                  {profile.age !== null && profile.age !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px] border border-primary/20">
                      {profile.age} سنة
                    </span>
                  )}
                  {profile.gender && (
                    <span className="px-2 py-0.5 rounded-full bg-surface text-ink-soft font-bold text-[10px] border border-line">
                      {profile.gender === 'male' || profile.gender === 'ذكر' ? 'ذكر' : 'أنثى'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-ink-soft text-[11px]">
                  <span className="flex items-center gap-1 font-mono text-ink">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>{profile.phone}</span>
                  </span>
                  {profile.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-ink-soft" />
                      <span>{profile.city} {profile.address ? `- ${profile.address}` : ''}</span>
                    </span>
                  )}
                  {profile.email && (
                    <span className="flex items-center gap-1 font-mono">
                      <Mail className="w-3.5 h-3.5 text-ink-soft" />
                      <span>{profile.email}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="px-3.5 py-2 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مراسلة واتساب</span>
                </button>

                {isOptics && onOpenNewPrescription && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNewPrescription(profile);
                    }}
                    className="px-3.5 py-2 rounded-btn bg-primary hover:opacity-90 text-[var(--color-primary-contrast,#ffffff)] font-black flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>كشف نظر جديد</span>
                  </button>
                )}
              </div>
            </div>

            {/* Re-Exam Alert Banner */}
            {isOptics && profile.requiresReExam && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span className="font-bold text-xs">
                    تنبيه موعد الفحص: مضى أكثر من عام (أو تجاوز موعد الكشف الدوري) منذ آخر فحص مسجل! يُوصى بإجراء كشف نظر وتحديث الروشتة.
                  </span>
                </div>
                {onOpenNewPrescription && (
                  <button
                    type="button"
                    onClick={() => onOpenNewPrescription(profile)}
                    className="px-2.5 py-1 rounded-btn bg-amber-500 text-black font-black text-[11px] hover:bg-amber-400 transition-colors"
                  >
                    فحص الآن
                  </button>
                )}
              </div>
            )}

            {/* Financial 360 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-surface border border-line text-center">
                <span className="text-[11px] text-ink-soft block mb-1">إجمالي المشتريات</span>
                <span className="text-base font-black text-ink">
                  {profile.stats?.totalSpent || 0} {currency}
                </span>
                <span className="text-[10px] text-ink-soft block mt-0.5">
                  ({profile.stats?.totalOrdersCount || 0} فاتورة وطلب)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-line text-center">
                <span className="text-[11px] text-ink-soft block mb-1">مجموع المدفوع فعلياً</span>
                <span className="text-base font-black text-emerald-600">
                  {profile.stats?.totalPaid || 0} {currency}
                </span>
                <span className="text-[10px] text-emerald-600/80 block mt-0.5">سُدد بنجاح</span>
              </div>

              <div className={`p-3.5 rounded-xl border text-center ${
                (profile.stats?.remainingPayable || 0) > 0
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-surface border-line'
              }`}>
                <span className="text-[11px] text-ink-soft block mb-1">المتبقي المطلوب سداده</span>
                <span className={`text-base font-black ${
                  (profile.stats?.remainingPayable || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {profile.stats?.remainingPayable || 0} {currency}
                </span>
                <span className="text-[10px] text-ink-soft block mt-0.5">
                  {(profile.stats?.activeOrdersCount || 0) > 0 ? `${profile.stats?.activeOrdersCount} طلبات نشطة` : 'لا يوجد متبقي'}
                </span>
              </div>

              <div className={`p-3.5 rounded-xl border text-center ${
                (profile.stats?.depositBalance || 0) > 0
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-surface border-line'
              }`}>
                <span className="text-[11px] text-ink-soft block mb-1">المدفوع تحت الحساب (أمانات)</span>
                <span className={`text-base font-black ${
                  (profile.stats?.depositBalance || 0) > 0 ? 'text-blue-600' : 'text-ink'
                }`}>
                  {profile.stats?.depositBalance || 0} {currency}
                </span>
                <span className="text-[10px] text-blue-600/80 block mt-0.5">رصيد متاح للخصم</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-line pb-1">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-btn font-black transition-all flex items-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-soft hover:text-ink hover:bg-paper'
                }`}
              >
                <Glasses className="w-4 h-4" />
                <span>أوامر الشغل والفواتير ({profile.allOrders?.length || 0})</span>
              </button>

              {isOptics && (
                <button
                  type="button"
                  onClick={() => setActiveTab('prescriptions')}
                  className={`px-4 py-2 rounded-btn font-black transition-all flex items-center gap-1.5 ${
                    activeTab === 'prescriptions'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-ink-soft hover:text-ink hover:bg-paper'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>كشوفات النظر السابقة ({profile.prescriptions?.length || 0})</span>
                </button>
              )}
            </div>

            {/* TAB 1: ORDERS & INVOICES */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                {(!profile.allOrders || profile.allOrders.length === 0) ? (
                  <div className="p-8 rounded-xl bg-paper border border-line text-center text-ink-soft font-bold">
                    لا توجد فواتير أو أوامر شغل سابقة لهذا العميل.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                        <tr>
                          <th className="p-3">رقم الطلب / التاريخ</th>
                          <th className="p-3">الأصناف والتفاصيل</th>
                          <th className="p-3">الإجمالي</th>
                          <th className="p-3">المدفوع والمتبقي</th>
                          <th className="p-3">حالة الطلب والمعمل</th>
                          <th className="p-3 text-center">طباعة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {profile.allOrders.map((ord) => {
                          const pays = ord.paymentsSnapshot || {
                            totalAmount: ord.total,
                            paidAmount: ord.total,
                            remainingAmount: 0
                          };
                          return (
                            <tr key={ord._id} className="hover:bg-paper/70 transition-colors">
                              <td className="p-3">
                                <span className="font-mono font-black text-primary block">{ord.orderId}</span>
                                <span className="text-[10px] text-ink-soft">
                                  {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('ar-EG') : ''}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="space-y-0.5">
                                  {(ord.items || []).map((it, idx) => (
                                    <div key={idx} className="font-bold text-ink">
                                      {it.name} <span className="text-ink-soft">× {it.quantity}</span>
                                    </div>
                                  ))}
                                  {ord.isLabOrder && ord.labDeliveryDate && (
                                    <span className="text-[10px] text-blue-600 block">
                                      موعد المعمل: {new Date(ord.labDeliveryDate).toLocaleDateString('ar-EG')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 font-black text-ink">
                                {ord.total} {currency}
                              </td>
                              <td className="p-3">
                                <div className="text-emerald-600 font-bold">{pays.paidAmount} {currency}</div>
                                {pays.remainingAmount > 0 && (
                                  <div className="text-amber-600 font-black text-[10px]">
                                    متبقي: {pays.remainingAmount} {currency}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {ord.isLabOrder ? (
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black inline-block ${
                                    ord.labStatus === 'delivered'
                                      ? 'bg-emerald-500/15 text-emerald-600'
                                      : ord.labStatus === 'ready'
                                      ? 'bg-purple-500/15 text-purple-600'
                                      : ord.labStatus === 'in_lab'
                                      ? 'bg-blue-500/15 text-blue-600'
                                      : 'bg-amber-500/15 text-amber-600'
                                  }`}>
                                    {ord.labStatus === 'delivered'
                                      ? 'تم التسليم للعميل'
                                      : ord.labStatus === 'ready'
                                      ? 'جاهزة للاستلام'
                                      : ord.labStatus === 'in_lab'
                                      ? 'بالمعمل قيد التجهيز'
                                      : 'بانتظار المعمل'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 text-[10px] font-black inline-block">
                                    بيع مباشر
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setPrintingOrder(ord)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                  title="طباعة إيصال حراري 80mm"
                                >
                                  <Receipt className="w-4 h-4" />
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
            )}

            {/* TAB 2: EYE PRESCRIPTIONS */}
            {activeTab === 'prescriptions' && (
              <div className="space-y-4">
                {(!profile.prescriptions || profile.prescriptions.length === 0) ? (
                  <div className="p-8 rounded-xl bg-paper border border-line text-center text-ink-soft font-bold">
                    لا توجد كشوفات نظر مسجلة لهذا العميل حتى الآن.
                  </div>
                ) : (
                  profile.prescriptions.map((p, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-surface border border-line shadow-sm space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-line">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-black text-[11px]">
                            كشف نظر #{profile.prescriptions.length - idx}
                          </span>
                          <span className="text-ink-soft text-[11px]">
                            التاريخ: {p.examDate ? new Date(p.examDate).toLocaleDateString('ar-EG') : 'غير محدد'}
                          </span>
                        </div>
                        {p.doctorName && (
                          <span className="text-ink font-bold text-[11px]">
                            د. {p.doctorName}
                          </span>
                        )}
                      </div>

                      {/* OD / OS Refraction Matrix */}
                      <div className="grid grid-cols-2 gap-3 text-center font-mono">
                        <div className="p-2.5 rounded-lg bg-paper border border-line">
                          <div className="font-bold text-ink mb-1 text-[11px]">العين اليمنى (OD / Right)</div>
                          <div className="text-[11px] space-y-0.5 text-ink-soft">
                            <div>SPH: <strong className="text-ink">{p.rightEye?.sph || '0.00'}</strong> | CYL: <strong className="text-ink">{p.rightEye?.cyl || '0.00'}</strong></div>
                            <div>AXIS: <strong className="text-ink">{p.rightEye?.axis || '0'}°</strong> | ADD: <strong className="text-ink">{p.rightEye?.add || '0.00'}</strong></div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-paper border border-line">
                          <div className="font-bold text-ink mb-1 text-[11px]">العين اليسرى (OS / Left)</div>
                          <div className="text-[11px] space-y-0.5 text-ink-soft">
                            <div>SPH: <strong className="text-ink">{p.leftEye?.sph || '0.00'}</strong> | CYL: <strong className="text-ink">{p.leftEye?.cyl || '0.00'}</strong></div>
                            <div>AXIS: <strong className="text-ink">{p.leftEye?.axis || '0'}°</strong> | ADD: <strong className="text-ink">{p.leftEye?.add || '0.00'}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Extra info & IPD & Attached Image */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-ink-soft">
                        <div className="flex items-center gap-3">
                          {p.ipd && <span>المسافة بين الحدقتين (IPD): <strong className="text-ink">{p.ipd} mm</strong></span>}
                          {p.usageType && <span>الاستخدام: <strong className="text-ink">{p.usageType === 'distance' ? 'مسافات / نظر دائم' : p.usageType === 'reading' ? 'قراءة' : 'كمبيوتر'}</strong></span>}
                          {p.notes && <span>ملاحظات: {p.notes}</span>}
                        </div>

                        {p.prescriptionImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(p.prescriptionImage)}
                            className="px-2.5 py-1 rounded-btn bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض صورة الروشتة المرفقة</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-paper border-t border-line flex items-center justify-between">
          <div className="text-[11px] text-ink-soft">
            معرف العميل: <span className="font-mono">{profile?._id || customerId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-btn bg-surface hover:bg-paper border border-line text-ink font-bold transition-colors"
          >
            إغلاق البروفايل
          </button>
        </div>
      </div>

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-surface p-2 rounded-xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 left-4 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewImage} alt="Prescription" className="w-full max-h-[80vh] object-contain rounded-lg" />
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {printingOrder && (
        <OpticsThermalReceiptModal
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
          showToast={showToast}
          currency={currency}
        />
      )}
    </div>
  );
}
