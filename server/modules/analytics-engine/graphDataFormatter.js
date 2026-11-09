/**
 * Graph Data Formatter Engine
 * Transforms raw analytical aggregations into ready-to-render data structures for charts & dashboards.
 */

const PALETTE = [
  "#2563eb", // Primary blue
  "#10b981", // Emerald green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b"  // Slate
];

/**
 * 1. Time Series Graph Formatter (Line & Area Charts)
 */
function formatTimeSeriesGraph(timeSeries = [], interval = "day") {
  if (!Array.isArray(timeSeries)) return [];

  return timeSeries.map((point, idx) => ({
    key: point.date || `p_${idx}`,
    date: point.date,
    displayLabel: point.date,
    revenue: Number(point.revenue || 0),
    orders: Number(point.orders || 0),
    views: Number(point.views || point.productViews || 0),
    cartAdditions: Number(point.cartAdditions || point.addToCart || 0),
    priceFeedback: Number(point.priceFeedback || 0)
  }));
}

/**
 * 2. Funnel Graph Formatter (Funnel & Waterfall Charts)
 */
function formatFunnelGraph(funnel = {}) {
  const stages = [
    {
      id: "views",
      label: "المشاهدات (Views)",
      value: Number(funnel.views?.count || funnel.productViews || 0),
      color: "#3b82f6"
    },
    {
      id: "cart",
      label: "إضافات السلة (Cart Additions)",
      value: Number(funnel.cartAdditions?.count || funnel.addToCart || 0),
      color: "#10b981"
    },
    {
      id: "checkout",
      label: "بدء الدفع (Checkouts)",
      value: Number(funnel.checkouts?.count || funnel.checkoutStarted || 0),
      color: "#f59e0b"
    },
    {
      id: "orders",
      label: "الطلبات المنشأة (Orders Created)",
      value: Number(funnel.ordersCreated?.count || funnel.ordersCreated || 0),
      color: "#8b5cf6"
    },
    {
      id: "completed",
      label: "المبيعات المكتملة (Delivered)",
      value: Number(funnel.ordersCompleted?.count || funnel.ordersCompleted || 0),
      color: "#059669"
    }
  ];

  const topValue = stages[0].value > 0 ? stages[0].value : 1;

  return stages.map((s, idx) => {
    const prev = idx > 0 ? stages[idx - 1].value : s.value;
    const stepConversion = prev > 0 ? Math.round((s.value / prev) * 10000) / 100 : 0;
    const totalRetention = Math.round((s.value / topValue) * 10000) / 100;

    return {
      ...s,
      stepConversionRate: stepConversion,
      overallRetentionRate: totalRetention,
      dropOffCount: Math.max(0, prev - s.value)
    };
  });
}

/**
 * 3. Category Sales Distribution Formatter (Donut & Pie Charts)
 */
function formatCategoryDistributionGraph(categorySales = []) {
  if (!Array.isArray(categorySales)) return [];

  const total = categorySales.reduce((acc, c) => acc + Number(c.total || c.revenue || 0), 0);

  return categorySales.map((c, idx) => {
    const amount = Number(c.total || c.revenue || 0);
    const share = total > 0 ? Math.round((amount / total) * 10000) / 100 : 0;

    return {
      name: c.name || "أقسام أخرى",
      value: amount,
      sharePercent: share,
      color: PALETTE[idx % PALETTE.length]
    };
  });
}

/**
 * 4. Price Sensitivity vs Conversion Scatter Graph Formatter
 */
function formatPriceVsConversionScatter(products = []) {
  if (!Array.isArray(products)) return [];

  return products.map((p, idx) => ({
    id: p.productId || p._id || `p_${idx}`,
    name: p.name,
    category: p.category || "عام",
    x: Number(p.price || 0),
    y: Number(p.conversionRate || 0),
    z: Number(p.views || 0),
    priceFeedbackCount: Number(p.priceFeedbackCount || 0),
    elasticityProfile: p.elasticityProfile || "standard"
  }));
}

module.exports = {
  formatTimeSeriesGraph,
  formatFunnelGraph,
  formatCategoryDistributionGraph,
  formatPriceVsConversionScatter
};
