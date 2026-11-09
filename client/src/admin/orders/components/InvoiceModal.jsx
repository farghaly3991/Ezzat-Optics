import React, { useRef } from 'react';
import {
  Printer,
  X,
  Package,
  Calendar,
  Phone,
  MapPin,
  CheckCircle2,
  FileText,
  Building2,
  Clock,
  Truck,
  CreditCard
} from 'lucide-react';

export default function InvoiceModal({ order, onClose, config }) {
  const printAreaRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPickup =
    order.deliveryMethod === 'pickup' ||
    order.shippingSnapshot?.deliveryMethod === 'pickup';

  const orderDate = new Date(order.createdAt || Date.now());
  const formattedDate = orderDate.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = orderDate.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const currency = order.financialSnapshot?.currency || 'ج.م';
  const subtotal = order.subtotal ?? (order.total - (order.shipping || 0) + (order.discount || 0));
  const shipping = order.shipping || 0;
  const discount = order.discount || 0;
  const total = order.total || 0;

  const isInstallment = order.payment?.method === 'installment' || order.installment?.isInstallment;
  const isPaid = isInstallment
    ? order.installment?.summary?.status === 'completed'
    : (order.payment?.paid || order.status === 'delivered');

  const paymentMethodLabel =
    isInstallment
      ? 'تقسيط مباشر مع المحل'
      : order.payment?.method === 'cod'
      ? 'الدفع عند الاستلام (COD)'
      : order.payment?.method === 'cash'
      ? 'نقداً بالفرع (Cash)'
      : order.payment?.method === 'card'
      ? 'بطاقة دفع بنكية (Card)'
      : order.payment?.method === 'wallet'
      ? 'محفظة إلكترونية'
      : 'كاش';

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      {/* Container with print-specific isolation */}
      <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col my-auto relative print:m-0 print:p-0 print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        {/* Modal Top Actions (Hidden on Print) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-paper/60 sticky top-0 z-20 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-ink">
                فاتورة طلب / إيصال بيع ({order.orderId})
              </h3>
              <span className="text-[11px] text-ink-soft">
                جاهزة للطباعة أو الإرفاق مع الشحنة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-ink-soft hover:text-red-500 rounded-xl hover:bg-paper transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE INVOICE CONTENT */}
        <div
          ref={printAreaRef}
          id="printable-invoice"
          className="p-6 sm:p-8 space-y-6 bg-white text-slate-900 print:p-4 print:text-black print:w-full"
          dir="rtl"
        >
          {/* Header & Store Branding */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                {config?.logo ? (
                  <img src={config.logo} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                    ⚡
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950">
                    {config?.siteName || 'المتجر الإلكتروني'}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    {config?.siteDescription || 'فاتورة شراء معتمدة وإيصال استلام'}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-left space-y-1">
              <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-black text-xs border border-slate-300">
                رقم الفاتورة: #{order.orderId}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formattedDate}</span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
                <Clock className="w-3.5 h-3.5" />
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Customer & Delivery / Payment Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            {/* Customer Details */}
            <div className="space-y-1.5">
              <span className="font-black text-slate-700 block text-[11px] uppercase tracking-wider">
                بيانات العميل:
              </span>
              <div className="font-extrabold text-slate-900 text-sm">
                {order.customer?.name || 'عميل المتجر (مباشر)'}
              </div>
              {order.customer?.phone && (
                <div className="text-slate-600 flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span dir="ltr">{order.customer.phone}</span>
                </div>
              )}
              {order.customer?.address && (
                <div className="text-slate-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    {order.customer.address}
                    {order.customer.city ? ` - ${order.customer.city}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Delivery & Payment Details */}
            <div className="space-y-1.5 sm:border-r sm:border-slate-200 sm:pr-4">
              <span className="font-black text-slate-700 block text-[11px] uppercase tracking-wider">
                طريقة الاستلام والدفع:
              </span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                {isPickup ? (
                  <>
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>استلام مباشر من الفرع (Pickup)</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span>
                      شحن وتوصيل للمنزل ({order.shippingSnapshot?.selectedClassName || 'توصيل قياسي'})
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <span>طريقة الدفع: {paymentMethodLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {isPaid ? '✓ تم السداد بالكامل' : isInstallment ? 'عقد تقسيط جاري السداد' : 'قيد السداد عند الاستلام'}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Installment Summary Box */}
          {isInstallment && order.installment?.plan && (
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-2.5">
              <div className="flex items-center justify-between font-black text-amber-900 border-b border-amber-200/70 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  <span>بيانات عقد التقسيط المباشر مع المتجر</span>
                </span>
                <span className="text-[11px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  {order.installment.plan.months} شهر ({order.installment.plan.interestRate || 0}% هامش/فائدة)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                  <span className="text-amber-800/80 block text-[10px]">إجمالي العقد المقسط:</span>
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {Number(order.installment.plan.totalAmount || order.total).toLocaleString()} {currency}
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                  <span className="text-amber-800/80 block text-[10px]">المقدم المدفوع:</span>
                  <span className="font-mono font-black text-emerald-700 text-xs">
                    {Number(order.installment.plan.downPayment || 0).toLocaleString()} {currency}
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                  <span className="text-amber-800/80 block text-[10px]">القسط الشهري:</span>
                  <span className="font-mono font-black text-amber-900 text-xs">
                    {Number(order.installment.plan.monthlyAmount || 0).toLocaleString()} {currency}
                  </span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                  <span className="text-amber-800/80 block text-[10px]">المتبقي ذمة للمتجر:</span>
                  <span className="font-mono font-black text-red-600 text-xs">
                    {Number(order.installment.summary?.totalRemaining ?? 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>
              {order.installment.guarantor?.name && (
                <div className="text-[10px] text-amber-900 pt-1.5 border-t border-amber-200/70 flex flex-wrap gap-x-4 gap-y-1">
                  <span>الضامن: <b className="font-bold">{order.installment.guarantor.name}</b></span>
                  {order.installment.guarantor.phone && (
                    <span>هاتف الضامن: <b className="font-mono font-bold" dir="ltr">{order.installment.guarantor.phone}</b></span>
                  )}
                  {order.installment.guarantor.nationalId && (
                    <span>الرقم القومي: <b className="font-mono font-bold">{order.installment.guarantor.nationalId}</b></span>
                  )}
                  {order.installment.guarantor.relationship && (
                    <span>صلة القرابة: <b>{order.installment.guarantor.relationship}</b></span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">المنتج والوصف</th>
                  <th className="p-3 text-center">الكمية</th>
                  <th className="p-3 text-center">سعر الوحدة</th>
                  <th className="p-3 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(order.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{item.name}</span>
                        {item.unitSlotLabel && (
                          <span className="inline-block bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-md font-black border border-primary/20">
                            {item.unitSlotLabel}
                          </span>
                        )}
                      </div>
                      {item.productId && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          كود: {item.productId.slice(-8)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-black text-slate-800">
                      {item.quantity}
                    </td>
                    <td className="p-3 text-center text-slate-600 font-mono">
                      {Number(item.price || 0).toLocaleString()} {currency}
                    </td>
                    <td className="p-3 text-left font-black text-slate-900 font-mono">
                      {(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}{' '}
                      {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">
                  {Number(subtotal).toLocaleString()} {currency}
                </span>
              </div>

              {shipping > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>رسوم الشحن والتوصيل:</span>
                  <span className="font-mono font-bold">
                    +{Number(shipping).toLocaleString()} {currency}
                  </span>
                </div>
              )}

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم مطبق:</span>
                  <span className="font-mono">
                    -{Number(discount).toLocaleString()} {currency}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-slate-950 pt-2 border-t-2 border-slate-900">
                <span>الإجمالي النهائي:</span>
                <span className="font-mono text-primary">
                  {Number(total).toLocaleString()} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Delivery Instructions */}
          {order.customer?.notes && (
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900 space-y-1">
              <span className="font-bold block">ملاحظات العميل والتسليم:</span>
              <p>{order.customer.notes}</p>
            </div>
          )}

          {/* Barcode & Footer Notice */}
          <div className="pt-6 border-t border-dashed border-slate-300 text-center space-y-2">
            {/* Visual Barcode representation */}
            <div className="flex flex-col items-center justify-center">
              <div
                className="font-mono text-2xl tracking-[0.35em] text-slate-800 select-none"
                style={{
                  fontFamily: 'Courier, monospace',
                  letterSpacing: '5px',
                  fontWeight: 900
                }}
              >
                ||| | |||| | ||| |||| | || |||
              </div>
              <span className="font-mono text-[11px] text-slate-500 font-bold mt-1">
                *{order.orderId}*
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              شكراً لتسوقكم معنا! هذه الفاتورة تم إصدارها إلكترونياً وتعتبر إشعار استلام وتسليم رسمي.
            </p>
          </div>
        </div>

        {/* Global Print Styling */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-invoice, #printable-invoice * {
              visibility: visible !important;
            }
            #printable-invoice {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 20px !important;
              margin: 0 !important;
              background: white !important;
              color: black !important;
            }
          }
        `}} />
      </div>
    </div>
  );
}
