import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function CustomerCancellationsTab({
  cancelLoading,
  cancelReport,
  cancelSortBy,
  setCancelSortBy,
  cancelAllTime,
  setCancelAllTime,
  currency = 'ج.م'
}) {
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Non-punitive Review Aid Disclaimer */}
      <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-ink flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h4 className="font-black text-orange-700">
            تنبيه إداري: تقرير مراجعة إلغاءات العملاء (أداة مساعدة للمراجعة البشرية)
          </h4>
          <p className="text-ink-soft font-bold leading-relaxed">
            {cancelReport?.disclaimer ||
              'هذا التقرير أداة مساعدة للمراجعة الإدارية فقط وليس حكماً آلياً بالاحتيال. يتم دائماً عرض عدد الإلغاءات جنباً إلى جنب مع إجمالي حجم طلبات العميل وقيمة مشترياته المكتملة.'}
          </p>
        </div>
      </div>

      <div className="p-5 rounded-card bg-surface border border-line shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-black text-ink">ترتيب العملاء حسب:</span>
          <select
            value={cancelSortBy}
            onChange={(e) => setCancelSortBy(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-1.5 font-bold text-ink"
          >
            <option value="cancelled_desc">عدد الطلبات الملغاة (الأعلى أولاً)</option>
            <option value="rate_desc">نسبة الإلغاء % (الأعلى أولاً)</option>
            <option value="value_desc">قيمة الطلبات الملغاة (الأعلى أولاً)</option>
          </select>

          <label className="flex items-center gap-1.5 font-bold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={cancelAllTime}
              onChange={(e) => setCancelAllTime(e.target.checked)}
            />
            <span>عرض السجل التاريخي الكامل للعملاء (All-Time)</span>
          </label>
        </div>

        {cancelReport && (
          <div className="flex items-center gap-3 font-bold text-ink-soft">
            <span>إجمالي العملاء أصحاب الطلبات: <strong className="text-ink">{cancelReport.totalCustomersWithOrders}</strong></span>
            <span>•</span>
            <span>عملاء لديهم إلغاءات: <strong className="text-red-500">{cancelReport.customersWithCancellations}</strong></span>
          </div>
        )}
      </div>

      {cancelLoading ? (
        <div className="p-12 rounded-card bg-surface border border-line text-center text-ink-soft font-bold animate-pulse">
          جاري تحميل تقرير إلغاءات ومرتجعات العملاء...
        </div>
      ) : (
        <div className="rounded-card bg-surface border border-line overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                <tr>
                  <th className="p-3.5">العميل</th>
                  <th className="p-3.5">إجمالي الطلبات (الحجم الكلي)</th>
                  <th className="p-3.5">الطلبات المكتملة</th>
                  <th className="p-3.5">الطلبات الملغاة</th>
                  <th className="p-3.5">معدل الإلغاء %</th>
                  <th className="p-3.5">المرتجعات (طلبات / وحدات)</th>
                  <th className="p-3.5">قيمة المشتريات المكتملة</th>
                  <th className="p-3.5">قيمة الطلبات الملغاة</th>
                  <th className="p-3.5">آخر طلب / آخر نشاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(cancelReport?.customers || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-ink-soft font-bold">
                      لا توجد بيانات طلبات للعملاء في هذه الفترة.
                    </td>
                  </tr>
                ) : (
                  (cancelReport?.customers || []).map((cust) => (
                    <tr key={cust.customerKey} className="hover:bg-paper/60 transition-colors">
                      <td className="p-3.5">
                        <span className="font-black text-ink block">{cust.name}</span>
                        <span className="text-[11px] text-ink-soft">
                          {cust.phone} {cust.city ? `• ${cust.city}` : ''}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-ink">{cust.totalOrders} طلب</td>
                      <td className="p-3.5 font-bold text-emerald-600">{cust.completedOrders} مكتمل</td>
                      <td className="p-3.5 font-black text-red-500">
                        {cust.cancelledOrders} ملغي ({cust.cancelledQuantity} وحدة)
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black text-[11px] ${
                            (cust.cancellationRate || 0) >= 50
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                              : (cust.cancellationRate || 0) > 0
                              ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                              : 'bg-emerald-500/10 text-emerald-600'
                          }`}
                        >
                          {cust.cancellationRate !== null ? `${cust.cancellationRate}%` : '0%'}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-purple-600">
                        {cust.returnedOrders} طلب ({cust.returnedQuantity} وحدة)
                      </td>
                      <td className="p-3.5 font-black text-emerald-600">
                        {cust.completedOrdersValue?.toLocaleString()} {currency}
                      </td>
                      <td className="p-3.5 font-bold text-red-500">
                        {cust.cancelledOrdersValue?.toLocaleString()} {currency}
                      </td>
                      <td className="p-3.5 text-[11px] text-ink-soft">
                        <div>
                          آخر طلب:{' '}
                          <strong className="text-ink">
                            {cust.mostRecentOrderDate
                              ? new Date(cust.mostRecentOrderDate).toLocaleDateString('ar-EG')
                              : '—'}
                          </strong>
                        </div>
                        <div>
                          آخر نشاط:{' '}
                          <strong>
                            {cust.mostRecentActivityDate
                              ? new Date(cust.mostRecentActivityDate).toLocaleDateString('ar-EG')
                              : '—'}
                          </strong>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
