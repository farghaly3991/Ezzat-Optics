import React, { useState } from 'react';
import { X, DollarSign, Printer, CheckCircle2, User, Phone, Sparkles } from 'lucide-react';
import axios from 'axios';

/**
 * Deposit Voucher Modal (دفعة نقدية تحت الحساب)
 * Collects cash from customer without issuing sales invoice or locking stock.
 * Prints standard 80mm thermal receipt voucher.
 */
export default function DepositVoucherModal({
  customer,
  onClose,
  onSuccess,
  authHeader,
  showToast,
  currency = 'ج.م'
}) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherData, setVoucherData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من صفر', 'error');
      return;
    }

    if (!customer?._id) {
      showToast('يرجى تحديد العميل أولاً لتسجيل الدفعة باسمه', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `/api/admin/customers/${customer._id}/deposit`,
        { amount: num, paymentMethod, notes },
        authHeader
      );

      if (res.data?.done) {
        showToast(res.data.message || 'تم تسجيل الدفعة النقدية بنجاح');
        setVoucherData(res.data.voucher);
        if (onSuccess) onSuccess(res.data.voucher);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تسجيل الدفعة تحت الحساب', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintThermal = () => {
    if (!voucherData) return;
    const printWin = window.open('', '_blank', 'width=350,height=500');
    printWin.document.write(`
      <html dir="rtl">
        <head>
          <title>إيصال استلام نقدية - ${voucherData.voucherNumber}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', monospace, Tahoma, sans-serif;
              width: 72mm;
              margin: 0 auto;
              padding: 8px 4px;
              color: #000;
              font-size: 12px;
              line-height: 1.4;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .badge {
              border: 1px solid #000;
              padding: 4px;
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin: 8px 0;
            }
            .footer-note { font-size: 10px; text-align: center; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold" style="font-size: 15px;">HI LUXE Optics</div>
          <div class="text-center" style="font-size: 11px;">مركز البصريات والنظارات المعتمد</div>
          <div class="divider"></div>

          <div class="badge">إيصال استلام نقدية تحت الحساب</div>

          <div class="row">
            <span>رقم الإيصال:</span>
            <span class="font-bold">${voucherData.voucherNumber}</span>
          </div>
          <div class="row">
            <span>التاريخ:</span>
            <span>${new Date(voucherData.date).toLocaleDateString('ar-EG')} - ${new Date(voucherData.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="divider"></div>

          <div class="row">
            <span>اسم العميل:</span>
            <span class="font-bold">${voucherData.customerName}</span>
          </div>
          <div class="row">
            <span>رقم الهاتف:</span>
            <span>${voucherData.customerPhone}</span>
          </div>
          <div class="row">
            <span>طريقة السداد:</span>
            <span>${voucherData.paymentMethod === 'cash' ? 'نقداً (كاش)' : 'بطاقة بنكية / فيزا'}</span>
          </div>
          <div class="divider"></div>

          <div class="row" style="font-size: 14px;">
            <span class="font-bold">المبلغ المقبوض:</span>
            <span class="font-bold">${voucherData.amount.toLocaleString()} ${currency}</span>
          </div>
          <div class="row" style="font-size: 12px; margin-top: 4px;">
            <span>إجمالي رصيد الدفعة:</span>
            <span class="font-bold">${voucherData.depositBalance.toLocaleString()} ${currency}</span>
          </div>

          ${voucherData.notes ? `<div style="font-size: 11px; margin-top: 6px;"><strong>ملاحظات:</strong> ${voucherData.notes}</div>` : ''}

          <div class="divider"></div>
          <div style="display: flex; justify-content: space-between; margin-top: 16px;">
            <span>توقيع العميل: ........</span>
            <span>توقيع الكاشير: ........</span>
          </div>

          <div class="footer-note">
            ⚠️ <strong>تنبيه:</strong> هذا الإيصال يثبت سداد دفعة نقدية تحت الحساب، ويتم خصمها تلقائياً عند إصدار فاتورة النظارة.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-300" />
            <h3 className="text-sm font-black text-white">استلام دفعة نقدية تحت الحساب (عربون)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!voucherData ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2.5">
              <User className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="text-xs">
                <div className="font-black text-blue-900">{customer?.fullname || 'عميل محدد'}</div>
                <div className="text-blue-700/80">{customer?.phone || 'بدون هاتف'}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ المقبوض ({currency}) *</label>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="مثال: 500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-base font-black text-slate-800 outline-none focus:border-blue-600 focus:bg-white font-mono"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">طريقة القبض:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  💵 نقداً (كاش)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  💳 بطاقة / فيزا
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات / بيان الإيصال:</label>
              <input
                type="text"
                placeholder="مثال: عربون تجهيز نظارة طبية لاحقاً..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              💡 <strong>تنبيه ذكي:</strong> المبلغ يدخل الصندوق فوراً كإيراد نقدي، ولا يتم حجز أي شمبر أو عدسة حتى لا تتجمد بضاعة المحل، ويخصم المبلغ تلقائياً من أول فاتورة يشتريها العميل.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
                {isSubmitting ? 'جاري التسجيل...' : 'حفظ واستخراج الإيصال'}
              </button>
            </div>
          </form>
        ) : (
          /* Success & Print View */
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl font-black">
              ✓
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800">تم تسجيل الدفعة النقدية بنجاح</h4>
              <p className="text-xs text-slate-500 mt-1">
                رقم الإيصال: <strong>{voucherData.voucherNumber}</strong> | المبلغ:{' '}
                <strong className="text-emerald-600">{voucherData.amount} {currency}</strong>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-right font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold">{voucherData.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">رصيد العميل الحالي:</span>
                <span className="font-bold text-blue-600">{voucherData.depositBalance} {currency}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={handlePrintThermal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة إيصال حراري (80mm)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
