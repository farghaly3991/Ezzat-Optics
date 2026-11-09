import React from 'react';
import { X, Printer, CheckCircle2, MessageCircle, Clock, Eye, Sparkles } from 'lucide-react';

/**
 * Optics Thermal Receipt & Lab Order Modal (معاينة وطباعة الفاتورة الحرارية 80mm)
 * Perfectly sized for standard 80mm POS receipt printers with safe margins.
 */
export default function OpticsThermalReceiptModal({
  order,
  onClose,
  showToast,
  currency = 'ج.م'
}) {
  if (!order) return null;

  const isLab = Boolean(order.isLabOrder);
  const p = order.prescriptionSnapshot || {};
  const pays = order.paymentsSnapshot || {
    totalAmount: order.total,
    paidAmount: order.total,
    remainingAmount: 0,
    previousDepositDeducted: 0
  };

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=380,height=600');
    printWin.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة - ${order.orderId}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Tahoma, sans-serif;
              width: 72mm;
              margin: 0 auto;
              padding: 8px 4px;
              color: #000;
              font-size: 12px;
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .badge {
              border: 1px solid #000;
              padding: 3px 6px;
              text-align: center;
              font-size: 13px;
              font-weight: bold;
              margin: 6px 0;
            }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; text-align: center; }
            th, td { border: 1px solid #000; padding: 3px 2px; }
            th { background-color: #eee; }
            .footer-note { font-size: 10px; text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center font-bold" style="font-size: 16px;">HI LUXE Optics</div>
          <div class="text-center" style="font-size: 11px;">مركز البصريات وتجهيز النظارات الطبية</div>
          <div class="text-center" style="font-size: 10px;">هاتف: 01011180841 | فرع الدقي الرئيسي</div>
          <div class="divider"></div>

          <div class="badge">
            ${isLab ? '⚡ أمر شغل معمل وتجهيز نظارة ⚡' : 'فاتورة مبيعات نقدية'}
          </div>

          <div class="row">
            <span>رقم الفاتورة:</span>
            <span class="font-bold">${order.orderId}</span>
          </div>
          <div class="row">
            <span>التاريخ:</span>
            <span>${new Date(order.createdAt || Date.now()).toLocaleDateString('ar-EG')} - ${new Date(order.createdAt || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          ${
            isLab && order.labDeliveryDate
              ? `<div class="row" style="background:#000; color:#fff; padding:2px 4px; font-weight:bold;">
                  <span>موعد استلام النظارة:</span>
                  <span>${new Date(order.labDeliveryDate).toLocaleDateString('ar-EG')}</span>
                </div>`
              : ''
          }
          <div class="divider"></div>

          <div class="row">
            <span>العميل:</span>
            <span class="font-bold">${order.customer?.name || 'عميل نقدي'}</span>
          </div>
          <div class="row">
            <span>الهاتف:</span>
            <span>${order.customer?.phone || '—'}</span>
          </div>

          ${
            p.sphR || p.sphL
              ? `<div class="divider"></div>
                 <div class="text-center font-bold" style="font-size:11px; margin-bottom:2px;">مقاسات كشف النظر (Prescription)</div>
                 <table>
                   <thead>
                     <tr>
                       <th>العين</th>
                       <th>SPH</th>
                       <th>CYL</th>
                       <th>AXIS</th>
                       <th>ADD</th>
                       <th>PD</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr>
                       <td class="font-bold">OD (R)</td>
                       <td>${p.sphR || '0.00'}</td>
                       <td>${p.cylR || '0.00'}</td>
                       <td>${p.axisR ? p.axisR + '°' : '—'}</td>
                       <td>${p.addR || '—'}</td>
                       <td>${p.pdR || '—'}</td>
                     </tr>
                     <tr>
                       <td class="font-bold">OS (L)</td>
                       <td>${p.sphL || '0.00'}</td>
                       <td>${p.cylL || '0.00'}</td>
                       <td>${p.axisL ? p.axisL + '°' : '—'}</td>
                       <td>${p.addL || '—'}</td>
                       <td>${p.pdL || '—'}</td>
                     </tr>
                   </tbody>
                 </table>
                 ${p.ipd ? `<div class="row" style="font-size:10px;"><span>المسافة بين البؤبؤين (IPD):</span><span>${p.ipd} مم</span></div>` : ''}`
              : ''
          }

          <div class="divider"></div>
          <div class="text-center font-bold" style="font-size:11px; margin-bottom:2px;">تفاصيل الأصناف والخدمات</div>
          <table>
            <thead>
              <tr>
                <th style="text-align:right;">الصنف</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || [])
                .map(
                  (it) => `
                <tr>
                  <td style="text-align:right;">
                    ${it.name}
                    ${it.isRequestedSupply ? '<br><small style="color:#d97706;">[طلب توريد]</small>' : ''}
                  </td>
                  <td>${it.quantity}</td>
                  <td>${it.price}</td>
                  <td>${it.price * it.quantity}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="divider"></div>
          <div class="row">
            <span>إجمالي الأصناف:</span>
            <span>${order.subtotal?.toLocaleString()} ${currency}</span>
          </div>
          ${order.discount > 0 ? `<div class="row"><span>الخصم:</span><span>-${order.discount} ${currency}</span></div>` : ''}
          ${pays.previousDepositDeducted > 0 ? `<div class="row" style="color:#2563eb;"><span>دفعة سابقة تحت الحساب:</span><span>-${pays.previousDepositDeducted} ${currency}</span></div>` : ''}
          
          <div class="row" style="font-size:14px; font-weight:bold; border-top:1px solid #000; padding-top:4px;">
            <span>صافي الفاتورة:</span>
            <span>${order.total?.toLocaleString()} ${currency}</span>
          </div>

          <div class="row" style="font-size:13px; font-weight:bold; margin-top:2px;">
            <span>المدفوع نقداً (عربون):</span>
            <span>${pays.paidAmount?.toLocaleString()} ${currency}</span>
          </div>

          <div class="row" style="font-size:15px; font-weight:bold; background:#eee; padding:3px; margin-top:3px; border:1px solid #000;">
            <span>المتبقي عند الاستلام:</span>
            <span>${pays.remainingAmount?.toLocaleString()} ${currency}</span>
          </div>

          ${order.labNotes ? `<div style="font-size:10px; margin-top:6px;"><strong>ملاحظات المعمل:</strong> ${order.labNotes}</div>` : ''}

          <div class="divider"></div>
          <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:11px;">
            <span>توقيع العميل: ........</span>
            <span>توقيع الكاشير: ........</span>
          </div>

          <div class="footer-note">
            شكراً لثقتكم بنا وبنظاراتكم الطبية!<br>
            برجاء إحضار هذا الإيصال عند استلام النظارة من الفرع.
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleSendWhatsApp = () => {
    const phone = order.customer?.phone?.replace(/[^0-9]/g, '');
    if (!phone) {
      showToast('رقم هاتف العميل غير متوفر', 'error');
      return;
    }
    const intlPhone = phone.startsWith('0') ? '20' + phone.substring(1) : phone;

    const text = `👓 *فاتورة شراء - مركز البصريات (HI LUXE)*
مرحباً بحضرتك أستاذ: *${order.customer?.name}*
رقم الفاتورة: *${order.orderId}*

${isLab ? `⚡ *أمر شغل تجهيز نظارة طبية بالمعمل*` : '🛍️ *فاتورة مبيعات مباشرة*'}
${order.labDeliveryDate ? `📅 *موعد الاستلام المتوقع:* ${new Date(order.labDeliveryDate).toLocaleDateString('ar-EG')}` : ''}

💰 *البيان المالي:*
• الإجمالي: ${order.total} ${currency}
• المدفوع (عربون): ${pays.paidAmount} ${currency}
• *المتبقي عند الاستلام:* ${pays.remainingAmount} ${currency}

${p.sphR ? `👁️ *مقاسات النظر:* OD (${p.sphR}/${p.cylR || '0.00'}) | OS (${p.sphL}/${p.cylL || '0.00'})` : ''}

نسعد دائماً بخدمتكم وتجهيز نظارتكم بأعلى معايير الدقة!`;

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-black text-white">
              {isLab ? 'تم حفظ أمر الشغل بالمعمل' : 'تم حفظ الفاتورة بنجاح'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Preview Box */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 font-mono text-xs text-slate-800 space-y-3">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="text-center">
              <div className="font-black text-sm text-slate-900">HI LUXE Optics</div>
              <div className="text-[10px] text-slate-500">مركز البصريات وتجهيز النظارات</div>
            </div>

            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-center font-black text-blue-900 text-xs">
              {isLab ? '⚡ أمر شغل معمل وتجهيز نظارة' : 'فاتورة بيع مباشر'}
            </div>

            <div className="flex justify-between text-[11px] pt-1">
              <span>رقم الفاتورة:</span>
              <span className="font-black">{order.orderId}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>العميل:</span>
              <span className="font-bold">{order.customer?.name}</span>
            </div>
            {order.labDeliveryDate && (
              <div className="flex justify-between text-[11px] bg-amber-50 p-1 rounded font-bold text-amber-900">
                <span>موعد الاستلام:</span>
                <span>{new Date(order.labDeliveryDate).toLocaleDateString('ar-EG')}</span>
              </div>
            )}

            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold mb-1">الأصناف:</div>
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <span className="truncate max-w-[170px]">{it.name} (x{it.quantity})</span>
                  <span>{it.price * it.quantity} {currency}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>الإجمالي:</span>
                <span className="font-bold">{order.total} {currency}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>المدفوع (عربون):</span>
                <span className="font-black">{pays.paidAmount} {currency}</span>
              </div>
              <div className="flex justify-between text-rose-700 bg-rose-50 p-1 rounded font-black text-sm">
                <span>المتبقي عند الاستلام:</span>
                <span>{pays.remainingAmount} {currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة حرارية إيصال (80mm)</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>إرسال تفاصيل الفاتورة عبر واتساب</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            إغلاق ومتابعة عملية جديدة
          </button>
        </div>
      </div>
    </div>
  );
}
