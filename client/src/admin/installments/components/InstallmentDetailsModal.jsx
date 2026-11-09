import React, { useState, useEffect } from 'react';
import {
  X,
  CalendarClock,
  User,
  Phone,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  CreditCard,
  Banknote,
  Wallet,
  Receipt,
  Printer,
  ShieldCheck,
  Check,
  RotateCcw,
  FileText,
  Paperclip,
  Upload,
  Trash2,
  ExternalLink,
  Eye,
  FileCheck
} from 'lucide-react';
import axios from 'axios';

const DOC_TYPES = [
  { key: 'signed_contract', label: 'العقد الورقي الموقع والمبصوم عليه' },
  { key: 'customer_id_front', label: 'بطاقة العميل (الوجه الأمامي)' },
  { key: 'customer_id_back', label: 'بطاقة العميل (الظهر)' },
  { key: 'guarantor_id_front', label: 'بطاقة الضامن (الوجه الأمامي)' },
  { key: 'guarantor_id_back', label: 'بطاقة الضامن (الظهر)' },
  { key: 'utility_bill', label: 'إيصال مرافق (كهرباء / غاز / مياه) أو عقد سكن' },
  { key: 'promissory_note', label: 'إيصال أمانة / شيك بنكي موقع' },
  { key: 'other', label: 'مستندات وأوراق أخرى' }
];

export default function InstallmentDetailsModal({
  order,
  isOpen,
  onClose,
  token,
  currency = 'ج.م',
  showToast,
  onPaymentSuccess
}) {
  if (!isOpen || !order) return null;

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const inst = order.installment || {};
  const plan = inst.plan || {};
  const summary = inst.summary || {};
  const guarantor = inst.guarantor || {};
  const payments = inst.payments || [];

  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'contract' | 'documents'

  // Payment Recording State
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(() => {
    const firstUnpaid = payments.find((p) => p.status !== 'paid');
    return firstUnpaid ? firstUnpaid.installmentIndex : (payments[0]?.installmentIndex || 1);
  });
  const selectedPayment = payments.find((p) => p.installmentIndex === selectedPaymentIndex) || payments[0];
  const [paidAmount, setPaidAmount] = useState(selectedPayment?.amount || plan.monthlyAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptNumber, setReceiptNumber] = useState(`RCP-${Date.now().toString().slice(-6)}`);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Contract State
  const [contractText, setContractText] = useState(inst.legalContractText || '');
  const [loadingContract, setLoadingContract] = useState(false);
  const [savingContract, setSavingContract] = useState(false);

  // Documents State
  const [documents, setDocuments] = useState(inst.documents || []);
  const [uploadDocType, setUploadDocType] = useState('signed_contract');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState(null);

  // When selected installment changes, update suggested amount
  const handleSelectInstallment = (idx) => {
    setSelectedPaymentIndex(idx);
    const p = payments.find((item) => item.installmentIndex === idx);
    if (p) setPaidAmount(p.amount);
  };

  // Generate or load contract on demand
  const loadOrGenerateContract = async () => {
    try {
      setLoadingContract(true);
      const res = await axios.post(
        `/api/admin/installments/${order.orderId}/generate-contract`,
        {},
        authHeader
      );
      if (res.data?.contractText) {
        setContractText(res.data.contractText);
        if (showToast) showToast('تم تجهيز وصياغة العقد الرسمي بالبيانات المحدثة');
      }
    } catch (err) {
      console.error('Failed to generate contract:', err);
      if (showToast) showToast('فشل توليد صياغة العقد', 'error');
    } finally {
      setLoadingContract(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'contract' && !contractText) {
      loadOrGenerateContract();
    }
  }, [activeTab]);

  // Save manual contract edits
  const handleSaveContractEdits = async () => {
    try {
      setSavingContract(true);
      await axios.put(
        `/api/admin/installments/${order.orderId}/contract`,
        { contractText },
        authHeader
      );
      if (showToast) showToast('تم حفظ تعديلات العقد الرسمي بنجاح');
    } catch (err) {
      console.error('Failed to save contract:', err);
      if (showToast) showToast('فشل حفظ صياغة العقد', 'error');
    } finally {
      setSavingContract(false);
    }
  };

  // Record Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paidAmount || Number(paidAmount) <= 0) {
      if (showToast) showToast('يرجى إدخال مبلغ دفع صالح', 'error');
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await axios.post(
        `/api/admin/installments/${order.orderId}/pay`,
        {
          installmentIndex: selectedPaymentIndex,
          amount: Number(paidAmount),
          paymentMethod,
          receiptNumber,
          notes: paymentNotes
        },
        authHeader
      );

      if (res.data?.done) {
        if (showToast) showToast(res.data.message || 'تم تسجيل القسط وتحديث السجل المالي بنجاح!');
        if (onPaymentSuccess) onPaymentSuccess(res.data.order || order);
        onClose();
      }
    } catch (err) {
      console.error('Record payment failed:', err);
      if (showToast) showToast(err.response?.data?.error || 'فشل تسجيل القسط', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Upload Document
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      if (showToast) showToast('يرجى اختيار ملف أو صورة لرفعها', 'error');
      return;
    }

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Upload to file server
      const uploadRes = await axios.post('/api/admin/upload', formData, {
        headers: {
          ...authHeader.headers
        }
      });

      const fileUrl = uploadRes.data?.url || uploadRes.data?.fileUrl;
      if (!fileUrl) throw new Error('فشل الحصول على رابط الملف بعد الرفع');

      const docLabel =
        uploadTitle.trim() ||
        DOC_TYPES.find((d) => d.key === uploadDocType)?.label ||
        'مستند تقسيط';

      // Attach document to installment
      const attachRes = await axios.post(
        `/api/admin/installments/${order.orderId}/documents`,
        {
          docType: uploadDocType,
          title: docLabel,
          url: fileUrl,
          notes: uploadNotes.trim()
        },
        authHeader
      );

      if (attachRes.data?.documents) {
        setDocuments(attachRes.data.documents);
        setSelectedFile(null);
        setUploadTitle('');
        setUploadNotes('');
        if (showToast) showToast('تم إرفاق المستند بنجاح في ملف التقسيط');
      }
    } catch (err) {
      console.error('Failed to attach document:', err);
      if (showToast) showToast(err.response?.data?.error || 'فشل رفع أو إرفاق المستند', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستند من ملف التقسيط؟')) return;
    try {
      const res = await axios.delete(
        `/api/admin/installments/${order.orderId}/documents/${docId}`,
        authHeader
      );
      if (res.data?.documents) {
        setDocuments(res.data.documents);
        if (showToast) showToast('تم حذف المستند بنجاح');
      }
    } catch (err) {
      console.error('Failed to delete doc:', err);
      if (showToast) showToast('فشل حذف المستند', 'error');
    }
  };

  const isCompleted = summary.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-4xl bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line bg-paper/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-900 border border-amber-500/30 flex items-center justify-center font-bold">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-ink">
                  عقد التقسيط المباشر ({order.orderId})
                </h3>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-950 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-950 border border-amber-500/30'
                  }`}
                >
                  {isCompleted ? 'مكتمل ومسدد بالكامل' : 'عقد ساري التحصيل'}
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                تاريخ العقد: {new Date(order.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'full' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-2.5 rounded-xl bg-surface border border-line text-ink hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold print:hidden"
              title="طباعة"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-surface border border-line text-ink-soft hover:text-ink transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Subtabs */}
        <div className="flex border-b border-line bg-surface px-5 gap-2 text-xs font-bold pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'schedule'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>جدول الأقساط والتحصيل</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contract')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'contract'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>العقد الورقي والطباعة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all relative ${
              activeTab === 'documents'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>ملف الوثائق والمستندات</span>
            {documents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-mono">
                {documents.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Customer & Branch & Guarantor Info Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
              <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-primary" /> العميل المشتري
              </span>
              <div className="text-xs font-black text-ink">{order.customer?.name}</div>
              <div className="text-[10px] text-ink-soft font-mono font-bold flex items-center gap-1">
                <Phone className="w-3 h-3" /> {order.customer?.phone}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
              <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-primary" /> الفرع المعني
              </span>
              <div className="text-xs font-black text-ink">
                {order.branchId?.name || 'الفرع الرئيسي'} ({order.branchId?.city || 'مصر'})
              </div>
              <div className="text-[10px] text-ink-soft font-bold">
                نظام التسليم: {order.deliveryMethod === 'pickup' ? 'استلام من الفرع' : 'توصيل'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-1">
              <span className="text-[11px] text-ink-soft font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> الضامن المتضامن
              </span>
              <div className="text-xs font-black text-ink">
                {guarantor.name || '(لا يوجد ضامن مسجل)'}
              </div>
              <div className="text-[10px] text-ink-soft font-bold">
                {guarantor.phone ? `هاتف: ${guarantor.phone} ` : ''}
                {guarantor.relationship ? `(${guarantor.relationship})` : ''}
              </div>
            </div>
          </div>

          {/* TAB 1: SCHEDULE & PAYMENT RECORDING */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              {/* Financial KPI Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-paper border border-line text-center">
                  <span className="text-[10px] text-ink-soft font-bold block">إجمالي قيمة العقد</span>
                  <span className="text-lg font-black text-ink">
                    {Number(summary.totalRequired || plan.totalAmount || 0).toLocaleString()} {currency}
                  </span>
                  <span className="text-[10px] text-ink-soft block font-bold">
                    (أصل: {Number(plan.originalAmount || 0).toLocaleString()} + فائدة: {Number(plan.interestAmount || 0).toLocaleString()})
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <span className="text-[10px] text-emerald-950 font-black block">إجمالي المحصل فعلياً</span>
                  <span className="text-lg font-black text-emerald-950">
                    {Number(summary.totalPaid || 0).toLocaleString()} {currency}
                  </span>
                  <span className="text-[10px] text-emerald-900 block font-bold">
                    سداد: {summary.paidInstallmentsCount || 0} من أصل {plan.months || 0} شهر
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <span className="text-[10px] text-amber-950 font-black block">المتبقي المطلوب تحصيله</span>
                  <span className="text-lg font-black text-amber-950">
                    {Number(summary.totalRemaining || 0).toLocaleString()} {currency}
                  </span>
                  <span className="text-[10px] text-amber-900 block font-bold">
                    متبقي: {summary.remainingInstallmentsCount || 0} قسط شهري
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-paper border border-line text-center">
                  <span className="text-[10px] text-ink-soft font-bold block">قيمة القسط الشهري</span>
                  <span className="text-lg font-black text-primary">
                    {Number(plan.monthlyAmount || 0).toLocaleString()} {currency}
                  </span>
                  <span className="text-[10px] text-ink-soft block font-bold">
                    مقدم مدفوع: {Number(plan.downPayment || 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              {/* Record New Payment Form */}
              {!isCompleted ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-paper border border-line space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-black text-ink">
                        تحصيل وتأكيد سداد قسط جديد (Record Installment Payment)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-ink-soft">
                      المشرف المحصل يُسجل تلقائياً باسم حسابك الحالي
                    </span>
                  </div>

                  <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-ink-soft font-bold mb-1">حدد القسط المراد سداده:</label>
                        <select
                          value={selectedPaymentIndex}
                          onChange={(e) => handleSelectInstallment(Number(e.target.value))}
                          className="w-full p-2.5 rounded-xl bg-surface border border-line text-ink font-bold outline-none"
                        >
                          {payments.map((p) => (
                            <option key={p.installmentIndex} value={p.installmentIndex}>
                              القسط {p.installmentIndex} ({Number(p.amount).toLocaleString()} {currency}) - {p.status === 'paid' ? 'مسدد ✓' : 'مستحق'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-ink-soft font-bold mb-1">المبلغ المحصل فعلياً:</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            required
                            className="w-full p-2.5 rounded-xl bg-surface border border-line text-ink font-mono font-bold outline-none"
                          />
                          <span className="text-[10px] text-ink-soft font-bold">{currency}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-ink-soft font-bold mb-1">طريقة التحصيل:</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-surface border border-line text-ink font-bold outline-none"
                        >
                          <option value="cash">نقداً بالفرع (كاش)</option>
                          <option value="card">بطاقة بنكية / فيزا</option>
                          <option value="wallet">محفظة إلكترونية</option>
                          <option value="bank_transfer">تحويل بنكي / إنستاباي</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-ink-soft font-bold mb-1">رقم إيصال التحصيل:</label>
                        <input
                          type="text"
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          required
                          placeholder="RCP-000000"
                          className="w-full p-2.5 rounded-xl bg-surface border border-line text-ink font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-ink-soft font-bold mb-1">ملاحظات التحصيل (اختياري):</label>
                      <input
                        type="text"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="مثال: تم التحصيل بواسطة الكاشير / إيداع فودافون كاش..."
                        className="w-full p-2 rounded-xl bg-surface border border-line text-ink outline-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingPayment}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>{submittingPayment ? 'جاري تسجيل الدفعة...' : 'تأكيد وحفظ سداد القسط في الخزينة'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-950 font-bold text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>تم سداد كافة أقساط هذا العقد بالكامل (100%). تم إغلاق المديونية وأصبحت الفاتورة خالصة.</span>
                </div>
              )}

              {/* Installment Schedule Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-ink flex items-center justify-between">
                  <span>جدول استحقاق الأقساط الشهرية والتسديدات ({payments.length} شهر)</span>
                  <span className="text-[10px] text-ink-soft font-mono">
                    تاريخ الاستحقاق | المبلغ | المشرف المسؤول
                  </span>
                </h4>

                <div className="border border-line rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-paper text-ink-soft font-bold border-b border-line text-[11px]">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">تاريخ الاستحقاق</th>
                        <th className="p-3">قيمة القسط</th>
                        <th className="p-3">حالة السداد</th>
                        <th className="p-3">المسدد فعلياً</th>
                        <th className="p-3">المشرف المحصل</th>
                        <th className="p-3">الإيصال والطريقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {payments.map((p) => {
                        const isPaid = p.status === 'paid';
                        const isLate = !isPaid && new Date(p.dueDate) < new Date();
                        return (
                          <tr
                            key={p.installmentIndex}
                            className={`hover:bg-paper/50 transition-colors ${
                              isPaid ? 'bg-emerald-500/5' : isLate ? 'bg-rose-500/5' : ''
                            }`}
                          >
                            <td className="p-3 font-mono font-bold text-ink">
                              القسط {p.installmentIndex}
                            </td>
                            <td className="p-3 font-medium text-ink">
                              {new Date(p.dueDate).toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td className="p-3 font-black text-ink">
                              {Number(p.amount).toLocaleString()} {currency}
                            </td>
                            <td className="p-3">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isPaid
                                    ? 'bg-emerald-500/20 text-emerald-950 border border-emerald-500/40'
                                    : isLate
                                    ? 'bg-rose-500/20 text-rose-950 border border-rose-500/40'
                                    : 'bg-amber-500/20 text-amber-950 border border-amber-500/40'
                                }`}
                              >
                                {isPaid ? 'مسدد بالكامل' : isLate ? 'متأخر عن الموعد' : 'قيد الانتظار'}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-bold text-ink">
                              {isPaid ? `${Number(p.paidAmount || p.amount).toLocaleString()} ${currency}` : '--'}
                            </td>
                            <td className="p-3 text-[11px] text-ink font-bold">
                              {p.collectedByName || p.collectedBy?.fullname || (isPaid ? 'المشرف المسؤول' : '--')}
                            </td>
                            <td className="p-3 text-[11px] text-ink-soft">
                              {isPaid ? (
                                <span>
                                  {p.receiptNumber ? `${p.receiptNumber} • ` : ''}
                                  {p.paymentMethod === 'cash'
                                    ? 'كاش'
                                    : p.paymentMethod === 'card'
                                    ? 'بطاقة'
                                    : 'تحويل'}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectInstallment(p.installmentIndex)}
                                  className="text-[10px] font-black text-primary hover:underline"
                                >
                                  سداد الآن
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OFFICIAL PAPER CONTRACT GENERATOR & PRINT */}
          {activeTab === 'contract' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-paper border border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-xs font-black text-ink">صياغة وتوليد العقد الرسمي للطباعة</h4>
                    <p className="text-[11px] text-ink-soft">
                      عقد بيع بالتقسيط قانوني متكامل الأركان، يطبع ليمضي ويبصم عليه المشتري والضامن والبائع
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadOrGenerateContract}
                    disabled={loadingContract}
                    className="px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-bold text-ink hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loadingContract ? 'animate-spin' : ''}`} />
                    <span>إعادة توليد بالبيانات الحديثة</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveContractEdits}
                    disabled={savingContract}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    <span>{savingContract ? 'جاري الحفظ...' : 'حفظ تعديلات الصياغة'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة العقد الرسمي</span>
                  </button>
                </div>
              </div>

              {/* Printable Contract Area */}
              <div id="printable-contract" className="p-6 rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-sm space-y-4 font-sans text-xs leading-relaxed">
                {/* Header for Print */}
                <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      {order.branchId?.name || 'المتجر العصري'}
                    </h2>
                    <p className="text-[10px] text-slate-600">
                      {order.branchId?.address || 'المقر الرئيسي'} • هاتف: {order.branchId?.phone || '01000000000'}
                    </p>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[10px] text-slate-500 block">رقم العقد الرسمي:</span>
                    <span className="text-xs font-black text-slate-900">CNT-INST-{order.orderId}</span>
                  </div>
                </div>

                {/* Contract Editable Body */}
                <textarea
                  value={contractText}
                  onChange={(e) => setContractText(e.target.value)}
                  rows={20}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-sans text-slate-900 leading-relaxed outline-none focus:border-primary focus:bg-white resize-y"
                  placeholder="جاري تحميل وصياغة العقد القانوني..."
                />

                {/* Signatures & Fingerprint Boxes */}
                <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
                  <div className="border border-slate-300 rounded-xl p-3 space-y-8 bg-slate-50/50">
                    <span className="font-black text-slate-800 block">الطرف الأول (البائع / المتجر)</span>
                    <div className="text-[10px] text-slate-500">التوقيع والختم الرسمي: ......................</div>
                  </div>

                  <div className="border border-slate-300 rounded-xl p-3 space-y-8 bg-slate-50/50">
                    <span className="font-black text-slate-800 block">الطرف الثاني (المشتري)</span>
                    <div className="space-y-2">
                      <div className="text-[10px] text-slate-500">التوقيع: .......................................</div>
                      <div className="text-[10px] text-slate-500">البصمة: [ خـاتـم الإبهام الأيمن ]</div>
                    </div>
                  </div>

                  <div className="border border-slate-300 rounded-xl p-3 space-y-8 bg-slate-50/50">
                    <span className="font-black text-slate-800 block">الطرف الثالث (الضامن المتضامن)</span>
                    <div className="space-y-2">
                      <div className="text-[10px] text-slate-500">التوقيع: .......................................</div>
                      <div className="text-[10px] text-slate-500">البصمة: [ خـاتـم الإبهام الأيمن ]</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENTS & ATTACHMENTS HUB */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Upload Form Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-paper border border-line space-y-4">
                <div className="flex items-center gap-2 border-b border-line pb-2.5">
                  <Upload className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-black text-ink">
                    إرفاق مستند أو صورة جديدة في ملف التعاقد
                  </h4>
                </div>

                <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-ink-soft font-bold mb-1">نوع المستند:</label>
                      <select
                        value={uploadDocType}
                        onChange={(e) => setUploadDocType(e.target.value)}
                        className="w-full p-2 rounded-xl bg-surface border border-line text-ink font-bold outline-none"
                      >
                        {DOC_TYPES.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-ink-soft font-bold mb-1">عنوان / وصف المستند:</label>
                      <input
                        type="text"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="اتركه فارغاً للاسم التلقائي..."
                        className="w-full p-2 rounded-xl bg-surface border border-line text-ink outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-soft font-bold mb-1">اختيار الملف أو الصورة:</label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                        className="w-full text-xs text-ink file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-bold file:cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink-soft font-bold mb-1">ملاحظات إضافية على المستند:</label>
                    <input
                      type="text"
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="مثال: تم التوقيع والبصمة بالفرع بحضور الضامن..."
                      className="w-full p-2 rounded-xl bg-surface border border-line text-ink outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={uploadingDoc || !selectedFile}
                      className="px-5 py-2 rounded-xl bg-primary text-white font-black text-xs shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingDoc ? 'جاري الرفع والإرفاق...' : 'إرفاق المستند بالملف'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Gallery of Uploaded Documents */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-ink flex items-center justify-between">
                  <span>المستندات والوثائق المرفقة حالياً ({documents.length})</span>
                  <span className="text-[10px] text-ink-soft font-bold">
                    يمكنك استعراض الوثائق أو إضافة أوراق جديدة في أي وقت
                  </span>
                </h4>

                {documents.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-paper/40 border border-dashed border-line text-ink-soft text-xs space-y-1">
                    <Paperclip className="w-8 h-8 mx-auto opacity-30 text-ink" />
                    <p className="font-bold">لا توجد مستندات مرفقة حتى الآن في ملف هذا العقد</p>
                    <p className="text-[11px]">ارفع صورة العقد الموقع، صور بطاقات الرقم القومي، أو إيصالات الأمانة أعلاه</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {documents.map((doc, idx) => {
                      const isImage = doc.url && (doc.url.match(/\.(jpeg|jpg|png|webp|gif)$/i) || !doc.url.includes('.pdf'));
                      return (
                        <div
                          key={doc._id || idx}
                          className="p-3 rounded-2xl bg-paper border border-line space-y-2 flex flex-col justify-between hover:border-primary/50 transition-all shadow-xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-900 border border-amber-500/30 text-[10px] font-bold">
                                {DOC_TYPES.find((t) => t.key === doc.docType)?.label || 'مستند'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc._id)}
                                className="text-ink-soft hover:text-red-500 p-1"
                                title="حذف المستند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <h5 className="text-xs font-black text-ink line-clamp-1">{doc.title}</h5>

                            {/* Thumbnail */}
                            {isImage ? (
                              <div
                                onClick={() => setPreviewDocUrl(doc.url)}
                                className="h-28 rounded-xl bg-surface border border-line overflow-hidden cursor-pointer relative group flex items-center justify-center"
                              >
                                <img
                                  src={doc.url}
                                  alt={doc.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                                  <Eye className="w-4 h-4" />
                                  <span>تكبير ومعاينة</span>
                                </div>
                              </div>
                            ) : (
                              <div className="h-28 rounded-xl bg-surface border border-line flex flex-col items-center justify-center text-ink-soft gap-2">
                                <FileText className="w-8 h-8 text-primary" />
                                <span className="text-[10px] font-bold font-mono">مستند PDF</span>
                              </div>
                            )}

                            {doc.notes && (
                              <p className="text-[10px] text-ink-soft bg-surface p-1.5 rounded-lg line-clamp-2">
                                {doc.notes}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-line flex items-center justify-between text-[10px] text-ink-soft">
                            <span>
                              {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ar-EG') : ''}
                            </span>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-bold hover:underline flex items-center gap-0.5"
                            >
                              <span>فتح الملف</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Products Included */}
          <div className="space-y-2 pt-2 border-t border-line">
            <h4 className="text-xs font-black text-ink">المنتجات المشمولة في هذا العقد:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-paper border border-line flex items-center justify-between text-xs">
                  <span className="font-bold text-ink">{it.name} × {it.quantity}</span>
                  <span className="font-black text-ink">{Number(it.price * it.quantity).toLocaleString()} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Image Preview Modal */}
      {previewDocUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewDocUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewDocUrl}
              alt="معاينة المستند"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/20"
            />
            <button
              type="button"
              onClick={() => setPreviewDocUrl(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-surface text-ink shadow-lg hover:bg-paper"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
