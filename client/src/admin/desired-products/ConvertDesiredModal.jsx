import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  X,
  Sparkles,
  Phone,
  User,
  DollarSign,
  Building2,
  MessageCircle,
  Key,
  ExternalLink,
  ShieldCheck,
  Send
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function ConvertDesiredModal({
  request,
  isOpen,
  onClose,
  onConverted,
  branches = []
}) {
  const { token, showToast, config } = useStore();

  const [targetType, setTargetType] = useState('service'); // 'service' | 'maintenance'
  const [serviceTitle, setServiceTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (request && isOpen) {
      setServiceTitle(request.extractedName || request.queryText || '');
      setCustomerName(request.customerName || '');
      setPhone(request.phone || '');
      setEstimatedCost(
        request.targetPrice?.max || request.targetPrice?.min || 0
      );
      setBranchId(request.branchId || (branches[0]?._id || ''));
      setNotes('');
      setSendWhatsApp(Boolean(request.phone));
      setResult(null);
    }
  }, [request, isOpen, branches]);

  if (!isOpen || !request) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (!serviceTitle.trim()) {
      showToast('يرجى تحديد مسمى الخدمة أو الفحص', 'error');
      return;
    }

    setLoading(true);
    try {
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(
        `/api/admin/product-requests/desired-products/${request._id}/convert`,
        {
          targetType,
          serviceTitle: serviceTitle.trim(),
          customerName: customerName.trim(),
          phone: phone.trim(),
          estimatedCost: Number(estimatedCost) || 0,
          branchId: branchId || null,
          notes: notes.trim(),
          sendWhatsApp
        },
        authHeader
      );

      if (res.data?.success) {
        showToast(res.data.message || 'تم تحويل الطلب بنجاح');
        setResult(res.data);
        if (onConverted) {
          onConverted(res.data);
        }
      } else {
        showToast(res.data?.error || 'فشل التحويل', 'error');
      }
    } catch (err) {
      console.error('Failed to convert desired product:', err);
      showToast(err.response?.data?.error || 'حدث خطأ أثناء تحويل الطلب إلى خدمة', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-line w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">
                تحويل رغبة العميل إلى طلب خدمة / صيانة
              </h3>
              <p className="text-xs text-ink-soft">
                توليد فوري لتذكرة الخدمة أو الصيانة وإنشاء حساب تلقائي للعميل
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-soft hover:text-ink hover:bg-paper transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {result ? (
            /* Success confirmation screen */
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-black text-ink">
                  تم اعتماد وتحويل الطلب بنجاح!
                </h4>
                <p className="text-xs text-ink-soft mt-1">
                  رقم المعاملة الرسمية:{' '}
                  <span className="font-mono font-bold text-primary text-sm px-2 py-0.5 rounded bg-primary/10">
                    #{result.convertedCode}
                  </span>
                </p>
              </div>

              {/* Customer Account Box */}
              {result.customerAccount?.isNew ? (
                <div className="p-4 rounded-2xl bg-paper border border-line text-right space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <Key className="w-4 h-4" />
                    <span>تم إنشاء حساب دخول تلقائي للعميل:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-xl bg-surface border border-line">
                      <span className="text-[10px] text-ink-soft block font-sans">
                        اسم المستخدم (الهاتف):
                      </span>
                      <span className="font-bold text-ink">{result.customerAccount.phone}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-surface border border-line">
                      <span className="text-[10px] text-ink-soft block font-sans">
                        كلمة المرور المؤقتة:
                      </span>
                      <span className="font-bold text-emerald-600">{result.customerAccount.tempPassword}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-soft">
                    يمكن للعميل تسجيل الدخول فوراً برقم هاتفه للاطلاع على حالة الخدمة ومتابعتها.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 font-bold">
                  ✓ تم ربط الخدمة بالحساب المسجل مسبقاً للعميل ({result.customerAccount?.phone || phone}).
                </div>
              )}

              {/* WhatsApp direct link if available */}
              {result.directWhatsAppLink && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-right space-y-2">
                  <span className="text-xs font-bold text-emerald-900 block">
                    💬 إرسال تفاصيل الخدمة والبيانات للعميل عبر واتساب:
                  </span>
                  <a
                    href={result.directWhatsAppLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>فتح محادثة واتساب مع العميل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to={`/admin/maintenance?search=${encodeURIComponent(result.convertedCode)}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all active:scale-95"
                >
                  <Wrench className="w-4 h-4" />
                  <span>عرض المعاملة في مركز الصيانة والخدمات (#{result.convertedCode})</span>
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-paper border border-line text-ink font-black text-xs shadow-sm hover:bg-surface"
                >
                  إغلاق ومتابعة العمل
                </button>
              </div>
            </div>
          ) : (
            /* Conversion form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target Type Selector */}
              <div>
                <label className="text-xs font-bold text-ink block mb-2">
                  نوع الإجراء المطلوب تحويله:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType('service')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                      targetType === 'service'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-line bg-paper hover:bg-surface'
                    }`}
                  >
                    <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-black text-ink block">
                        طلب خدمة معتمد (Service Order)
                      </span>
                      <span className="text-[10px] text-ink-soft leading-relaxed block mt-0.5">
                        إدراج كطلب خدمة رسمي بقسم الطلبات (Orders) لمتابعة التنفيذ والتحصيل
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('maintenance')}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                      targetType === 'maintenance'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-line bg-paper hover:bg-surface'
                    }`}
                  >
                    <Wrench className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-black text-ink block">
                        تذكرة صيانة / فحص (Maintenance)
                      </span>
                      <span className="text-[10px] text-ink-soft leading-relaxed block mt-0.5">
                        إدراج بمركز الصيانة لتوكيلها لفني الفرع ومتابعة الإصلاح والقطع
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Service Title */}
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  مسمى الخدمة / العملية:
                </label>
                <input
                  type="text"
                  value={serviceTitle}
                  onChange={(e) => setServiceTitle(e.target.value)}
                  placeholder="مثال: فحص وإصلاح شاشة الهاتف، أو توفير جهاز مخصص..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  required
                />
              </div>

              {/* Customer info: Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-ink-soft" />
                    <span>اسم العميل:</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم العميل..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-ink-soft" />
                    <span>رقم الهاتف (سيستخدم لتسجيل دخوله):</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary text-right"
                  />
                </div>
              </div>

              {/* Cost & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-ink-soft" />
                    <span>التكلفة التقديرية ({config?.currency || 'ج.م'}):</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-ink-soft" />
                    <span>الفرع المسؤول:</span>
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  >
                    <option value="">الفرع الافتراضي / عام</option>
                    {(Array.isArray(branches) ? branches : []).map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.city || 'الفرع الرئيسي'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  ملاحظات فنية أو تعليمات تنفيذ:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي تفاصيل خاصة بتشخيص الحالة أو طريقة التواصل..."
                  className="w-full px-3.5 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Auto Account Callout & WhatsApp Checkbox */}
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>إنشاء حساب فوري وتكامل تام:</span>
                </div>
                <p className="text-[11px] text-ink-soft leading-relaxed">
                  إذا لم يكن العميل مسجلاً، فسيتم إنشاء حسابه تلقائياً بحيث يكون اسم المستخدم وكلمة المرور هو رقم هاتفه، ليتمكن من تسجيل الدخول فوراً ومتابعة طلبه.
                </p>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="text-xs font-bold text-ink">
                    إرسال رسالة تأكيد للعميل على الواتساب مع بيانات حسابه
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-soft hover:bg-paper"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black shadow-md flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? (
                    <span>جاري التحويل وتفعيل الحساب...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد التحويل وإنشاء المعاملة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
