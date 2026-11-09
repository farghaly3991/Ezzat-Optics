import React from 'react';
import {
  ArrowUpDown,
  AlertTriangle,
  ChevronLeft
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { RANKING_OPTIONS, truncateLabel } from './analyticsHelpers';

export default function ProductRankingsTab({
  rankingsLoading,
  rankingsData,
  rankingMetric,
  setRankingMetric,
  rankingOrder,
  setRankingOrder,
  rankingLimit,
  setRankingLimit,
  onSelectProduct,
  currency = 'ج.م'
}) {
  const rankingChartData = (rankingsData?.items || []).map((it) => ({
    productId: it.productId,
    shortName: truncateLabel(it.name, 25),
    fullName: it.name,
    primaryValue: Number(it.primaryValue || 0),
    secondaryRate: it.secondaryRate !== null && it.secondaryRate !== undefined ? Number(it.secondaryRate) : null,
    views: it.views,
    unitsSold: it.unitsSold,
    ordersCreatedCount: it.ordersCreatedCount,
    cancelledOrdersCount: it.cancelledOrdersCount,
    returnedQuantity: it.returnedQuantity,
    priceFeedbackCount: it.priceFeedbackCount
  }));

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Ranking Controls Bar */}
      <div className="p-5 rounded-card bg-surface border border-line shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-black text-ink">معيار الترتيب:</label>
          <select
            value={rankingMetric}
            onChange={(e) => setRankingMetric(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-black text-ink outline-none focus:border-primary"
          >
            {RANKING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRankingOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            className="px-3.5 py-2 rounded-btn bg-paper hover:bg-surface border border-line text-xs font-black text-ink flex items-center gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
            <span>{rankingOrder === 'desc' ? 'تنازلي (الأعلى أولاً)' : 'تصاعدي (الأقل أولاً)'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-ink-soft">الحد الأقصى (Top-N):</span>
            {[5, 10, 20].map((lim) => (
              <button
                key={lim}
                type="button"
                onClick={() => setRankingLimit(lim)}
                className={`px-3 py-1.5 rounded-btn text-xs font-black ${
                  rankingLimit === lim
                    ? 'bg-primary text-white'
                    : 'bg-paper text-ink border border-line'
                }`}
              >
                Top {lim}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rankingsLoading ? (
        <div className="p-12 rounded-card bg-surface border border-line text-center text-ink-soft font-bold animate-pulse">
          جاري حساب ترتيب المنتجات...
        </div>
      ) : rankingsData?.supported === false ? (
        <div className="p-8 rounded-card bg-orange-500/10 border border-orange-500/25 text-orange-700 space-y-2 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-orange-500" />
          <h4 className="text-sm font-black">{rankingsData.meta?.label}</h4>
          <p className="text-xs font-bold max-w-xl mx-auto">{rankingsData.unsupportedReason}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Horizontal Bar Chart for Selected Ranking */}
          <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-black text-ink">
                  {rankingsData?.meta?.label} (أعلى {rankingChartData.length} منتجات)
                </h4>
                <p className="text-xs text-ink-soft">
                  اضغط على أي منتج في الجدول أدناه لفتح صفحة التحليلات التفصيلية الخاصة به
                </p>
              </div>
              <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-lg">
                وحدة القياس: {rankingsData?.meta?.unit}
              </span>
            </div>

            {rankingChartData.length === 0 ? (
              <p className="text-xs text-ink-soft py-8 text-center">لا توجد بيانات متاحة لهذا المعيار في الفترة المحددة.</p>
            ) : (
              <div
                className="w-full"
                style={{ height: `${Math.max(260, rankingChartData.length * 42)}px` }}
                dir="ltr"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={rankingChartData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={175}
                      tick={{ fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip
                      formatter={(val, name, props) => {
                        const p = props?.payload;
                        const rateStr =
                          p?.secondaryRate !== null && p?.secondaryRate !== undefined
                            ? ` | ${rankingsData?.meta?.rateLabel || 'النسبة'}: ${p.secondaryRate}%`
                            : '';
                        return [`${val} ${rankingsData?.meta?.unit || ''}${rateStr}`, p?.fullName || name];
                      }}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: 'rtl', textAlign: 'right' }}
                    />
                    <Bar
                      dataKey="primaryValue"
                      name={rankingsData?.meta?.label}
                      radius={[0, 8, 8, 0]}
                      onClick={(barData) => {
                        if (barData?.productId) onSelectProduct(barData.productId);
                      }}
                      className="cursor-pointer"
                    >
                      {rankingChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            rankingMetric.includes('cancel') || rankingMetric.includes('return')
                              ? '#ef4444'
                              : rankingMetric.includes('price_feedback')
                              ? '#f59e0b'
                              : '#2563eb'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Detailed Ranking Table */}
          <div className="rounded-card bg-surface border border-line overflow-hidden shadow-sm">
            <div className="p-4 border-b border-line bg-paper/50 flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-sm font-black text-ink">
                الجدول التفصيلي (يعرض الأعداد الخام مع النسب المئوية وحجم المبيعات معاً لمنع التفسير المضلل)
              </h5>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">المنتج</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3">المشاهدات</th>
                    <th className="p-3">إضافات السلة</th>
                    <th className="p-3">الوحدات المباعة</th>
                    <th className="p-3">الطلبات الملغاة (النسبة %)</th>
                    <th className="p-3">المرتجعات (النسبة %)</th>
                    <th className="p-3">إشارات السعر (النسبة %)</th>
                    <th className="p-3">الإيراد المكتمل</th>
                    <th className="p-3 text-center">تحليل المنتج</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(rankingsData?.items || []).map((item) => (
                    <tr key={item.productId} className="hover:bg-paper/60 transition-colors">
                      <td className="p-3 font-black text-primary">{item.rank}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-9 h-9 rounded-lg object-cover border border-line shrink-0"
                            />
                          )}
                          <div>
                            <span className="font-bold text-ink block line-clamp-1">{item.name}</span>
                            <span className="text-[10px] text-ink-soft">{item.categoryName || 'عام'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-bold">{item.price} {currency}</td>
                      <td className="p-3 font-bold text-sky-600">{item.views.toLocaleString()}</td>
                      <td className="p-3 font-bold text-indigo-600">{item.cartAdditions.toLocaleString()}</td>
                      <td className="p-3 font-black text-emerald-600">{item.unitsSold.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="font-bold text-red-500">
                          {item.cancelledOrdersCount} ({item.cancellationRate !== null ? `${item.cancellationRate}%` : '0%'})
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-orange-600">
                          {item.returnedQuantity} ({item.returnRate !== null ? `${item.returnRate}%` : '0%'})
                        </span>
                      </td>
                      <td className="p-3 font-bold text-purple-600">
                        {item.priceFeedbackCount} ({item.priceFeedbackRate !== null ? `${item.priceFeedbackRate}%` : '0%'})
                      </td>
                      <td className="p-3 font-black text-emerald-600">
                        {item.grossRevenue ? `${Number(item.grossRevenue).toLocaleString()} ${currency}` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(item.productId)}
                          className="px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-black text-[11px] inline-flex items-center gap-1 transition-all"
                        >
                          <span>تحليل مفصل</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
