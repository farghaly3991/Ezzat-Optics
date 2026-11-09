/**
 * Unified Analytics Metric Definitions & Date Utilities
 * Standardized mathematical definitions, formulas, and timezone conventions.
 */

const TIMEZONE = "Africa/Cairo";
const ABANDONMENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const METRIC_DEFINITIONS = {
  viewToCartConversion: {
    name: "معدل التحويل من المشاهدة إلى السلة (View-to-Cart Rate)",
    numerator: "عدد الزوار/الجلسات الفريدة التي أضافت منتجاً للسلة (Distinct Actors with add_to_cart)",
    denominator: "عدد الزوار/الجلسات الفريدة التي شاهدت المنتجات (Distinct Actors with product_viewed)",
    unit: "percentage (%)",
    notes: "يعتمد على الزوار الفريدين وليس إجمالي النقرات المتكررة لنفس الزائر."
  },
  viewToPurchaseConversion: {
    name: "معدل التحويل إلى الشراء المكتمل (View-to-Completed-Purchase Rate)",
    numerator: "عدد الزوار الفريدين الذين أتموا شراءً مكتملاً أو عدد الطلبات المكتملة المنسوبة",
    denominator: "عدد الزوار/الجلسات الفريدة التي شاهدت المنتجات في نفس الفترة",
    unit: "percentage (%)",
    notes: "لا يتم احتساب المشاهدات المتكررة لنفس الزائر كزوار مستقلين."
  },
  wishlistToCartConversion: {
    name: "معدل التحويل من المفضلة إلى السلة (Wishlist-to-Cart Attribution Rate)",
    numerator: "الأزواج الفريدة (زائر + منتج) التي أُضيفت للمفضلة ثم أُضيفت للسلة من نفس الزائر",
    denominator: "إجمالي الأزواج الفريدة (زائر + منتج) التي أُضيفت للمفضلة في الفترة",
    unit: "percentage (%)"
  },
  cartToCheckoutConversion: {
    name: "معدل الانتقال من السلة إلى بدء الدفع (Cart-to-Checkout Rate)",
    numerator: "عدد السلات/الزوار الفريدين الذين بدأوا خطوة إتمام الطلب (checkout_started)",
    denominator: "عدد السلات/الزوار الفريدين الذين أضافوا منتجات للسلة (add_to_cart)",
    unit: "percentage (%)"
  },
  orderCompletionRate: {
    name: "معدل إتمام وتسليم الطلبات (Order Completion Rate)",
    numerator: "عدد الطلبات المكتملة (المسلّمة delivered)",
    denominator: "إجمالي الطلبات المنشأة في نفس الفترة الزمنية",
    unit: "percentage (%)"
  },
  orderCancellationRate: {
    name: "معدل إلغاء الطلبات (Order Cancellation Rate)",
    numerator: "عدد الطلبات الملغاة (cancelled)",
    denominator: "إجمالي الطلبات المنشأة في نفس الفترة الزمنية",
    unit: "percentage (%)"
  },
  productReturnRate: {
    name: "معدل استرجاع المنتجات (Product Return Rate)",
    numerator: "عدد الوحدات المسترجعة (أو الطلبات المسترجعة returned)",
    denominator: "إجمالي الوحدات المباعة في الطلبات المكتملة والمسترجعة (Delivered + Returned Units)",
    unit: "percentage (%)"
  },
  priceFeedbackRate: {
    name: "معدل إشارات السعر المرتفع إلى المشاهدات (Price Feedback per View Rate)",
    numerator: "إجمالي نقرات «السعر مرتفع» (price_feedback events)",
    denominator: "إجمالي مشاهدات المنتج (product_viewed events)",
    unit: "percentage (%)",
    notes: "إشارة استرشادية من العملاء للمراجعة التسعيرية وليست دليلاً قاطعاً بمفردها."
  },
  cartAbandonmentRate: {
    name: "معدل السلات المتروكة (Linked Cart Abandonment Rate)",
    numerator: "السلات الفريدة المرتبطة (cartId/actor) التي مر عليها أكثر من 24 ساعة (أو انتهت الجلسة) دون طلب مرتبط",
    denominator: "إجمالي السلات الفريدة النشطة القابلة للتقييم في نافذة الإهمال",
    unit: "percentage (%)",
    notes: "يُحسب عبر ربط معرف السلة/الزائر بالطلبات الفعلية ولا يُحسب بطرح الأحداث الخام."
  }
};

/**
 * Safe percentage rate computation (returns null if denominator === 0, otherwise float rounded to 2 decimals)
 */
function safeRate(numerator, denominator, multiplier = 100) {
  const num = Number(numerator || 0);
  const den = Number(denominator || 0);
  if (den <= 0 || isNaN(num) || isNaN(den)) return null;
  return Math.round((num / den) * multiplier * 100) / 100;
}

/**
 * Compute comparative percentage delta between current and previous values
 */
function computeDelta(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  const absoluteDelta = Math.round((c - p) * 100) / 100;
  if (p === 0) {
    return {
      current: c,
      previous: p,
      absoluteDelta,
      percentChange: c > 0 ? 100 : c < 0 ? -100 : 0
    };
  }
  const pct = Math.round(((c - p) / p) * 10000) / 100;
  return {
    current: c,
    previous: p,
    absoluteDelta,
    percentChange: pct
  };
}

/**
 * Parse date range and compute exact previous period of equal duration.
 */
function parseDateRange(query = {}) {
  const now = new Date();
  let startDate = null;
  let endDate = now;
  const rangePreset = String(query.range || query.period || "30d").trim();

  if (query.startDate || query.from) {
    const parsedStart = new Date(query.startDate || query.from);
    if (!Number.isNaN(parsedStart.getTime())) {
      startDate = parsedStart;
    }
  }

  if (query.endDate || query.to) {
    const parsedEnd = new Date(query.endDate || query.to);
    if (!Number.isNaN(parsedEnd.getTime())) {
      if (String(query.endDate || query.to).length <= 10) {
        parsedEnd.setHours(23, 59, 59, 999);
      }
      endDate = parsedEnd;
    }
  }

  if (!startDate) {
    const daysMatch = rangePreset.match(/^(\d+)d$/i);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : rangePreset === "7d" ? 7 : rangePreset === "90d" ? 90 : 30;
    startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  }

  if (startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const durationMs = Math.max(24 * 60 * 60 * 1000, endDate.getTime() - startDate.getTime());
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  const daysSpan = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const interval = query.interval || (daysSpan > 60 ? "week" : "day");

  return {
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    daysSpan,
    rangePreset,
    interval,
    timezone: TIMEZONE
  };
}

module.exports = {
  TIMEZONE,
  ABANDONMENT_WINDOW_MS,
  METRIC_DEFINITIONS,
  safeRate,
  computeDelta,
  parseDateRange
};
