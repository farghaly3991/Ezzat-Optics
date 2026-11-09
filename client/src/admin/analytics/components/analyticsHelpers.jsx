import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function DeltaPill({ delta, inverseGood = false }) {
  if (!delta || delta.percentChange === null || delta.percentChange === undefined) {
    return <span className="text-[10px] text-ink-soft font-bold">لا توجد بيانات سابقة للمقارنة</span>;
  }
  const pct = Number(delta.percentChange);
  const isPos = pct > 0;
  const isZero = pct === 0;
  const isGood = inverseGood ? !isPos : isPos;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
          isZero
            ? 'bg-slate-500/10 text-ink-soft'
            : isGood
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-red-500/10 text-red-500'
        }`}
      >
        {isPos ? <TrendingUp className="w-3 h-3" /> : !isZero ? <TrendingDown className="w-3 h-3" /> : null}
        <span dir="ltr">{isPos ? `+${pct}%` : `${pct}%`}</span>
      </span>
      <span className="text-[10px] text-ink-soft font-bold">
        السابق: {delta.previous !== null && delta.previous !== undefined ? delta.previous : '—'}
      </span>
    </div>
  );
}

export function truncateLabel(str, maxLen = 22) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

export const RANKING_OPTIONS = [
  { value: 'most_viewed', label: '1. الأكثر مشاهدة (Most Viewed)' },
  { value: 'most_wishlisted', label: '2. الأكثر إضافة للمفضلة (Most Wishlisted)' },
  { value: 'most_wishlist_removed', label: '3. الأكثر إزالة من المفضلة (Most Wishlist Removals)' },
  { value: 'most_cart_added', label: '4. الأكثر إضافة للسلة (Most Added to Cart)' },
  { value: 'most_cart_removed', label: '5. الأكثر إزالة من السلة (Most Cart Removals)' },
  { value: 'most_checkout_started', label: '6. الأكثر بدءاً للدفع (Most Checkout Starts)' },
  { value: 'most_orders_created', label: '7. الأكثر طلبات منشأة (Most Orders Created)' },
  { value: 'most_completed_orders', label: '8. الأكثر طلبات مكتملة (Most Completed Orders)' },
  { value: 'most_units_sold', label: '9. الأعلى وحدات مباعة (Most Units Sold)' },
  { value: 'most_cancelled', label: '10. الأعلى طلبات ملغاة (Most Cancelled Orders)' },
  { value: 'most_cancelled_qty', label: '10b. الأعلى كميات ملغاة (Most Cancelled Quantities)' },
  { value: 'most_returned', label: '11. الأعلى منتجات مسترجعة (Most Returned Products)' },
  { value: 'highest_refunded', label: '12. الأعلى مبالغ مستردة (Highest Refunded - إن توفر)' },
  { value: 'most_price_feedback', label: '13. الأكثر إشارات «السعر مرتفع» (Most Price Feedback)' },
  { value: 'highest_rated', label: '14. الأعلى تقييماً (Highest Rated)' },
  { value: 'highest_revenue', label: '15. الأعلى إيراداً (Highest Revenue)' },
  { value: 'highest_profit', label: '16. الأعلى ربحاً صافياً (Highest Profit)' }
];
