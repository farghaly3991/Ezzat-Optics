/**
 * Inventory Velocity & Procurement Replenishment Intelligence Engine
 * Predicts stockout dates and constructs automated supplier reorder proposals.
 */

function calculateStockVelocity(unitsSold = 0, daysSpan = 30) {
  const units = Number(unitsSold || 0);
  const days = Math.max(1, Number(daysSpan || 30));
  return Math.round((units / days) * 100) / 100;
}

function predictStockDepletion(stockCount = 0, dailyVelocity = 0) {
  const stock = Number(stockCount || 0);
  const velocity = Number(dailyVelocity || 0);

  if (stock <= 0) {
    return {
      runOutDays: 0,
      depletionStatus: "out_of_stock",
      label: "نفد من المخزن تماماً (Out of Stock)"
    };
  }

  if (velocity <= 0) {
    return {
      runOutDays: 999,
      depletionStatus: "dormant",
      label: "مخزون راكد لا توجد مبيعات في الفترة"
    };
  }

  const days = Math.round(stock / velocity);
  let status = "healthy";
  let label = `يكفي لحوالي ${days} يوماً`;

  if (days <= 3) {
    status = "critical";
    label = `حرِج جداً: أوشك على النفاد خلال ${days} أيام فقط!`;
  } else if (days <= 10) {
    status = "warning";
    label = `تنبيه مبكر: المخزون يغطي ${days} أيام`;
  }

  return {
    runOutDays: days,
    depletionStatus: status,
    label
  };
}

function calculateSuggestedReorderQty(currentStock = 0, dailyVelocity = 0, options = {}) {
  const {
    supplierLeadTimeDays = 5,
    targetBufferDays = 21,
    minOrderQty = 5
  } = options;

  const velocity = Number(dailyVelocity || 0);
  const current = Number(currentStock || 0);

  if (velocity <= 0) {
    return current <= 0 ? minOrderQty : 0;
  }

  const targetCoverageUnits = Math.ceil(velocity * (supplierLeadTimeDays + targetBufferDays));
  const needed = Math.max(0, targetCoverageUnits - current);

  return Math.max(needed > 0 ? minOrderQty : 0, needed);
}

function buildSupplierWhatsAppProposal(payload = {}) {
  const {
    storeName = "المتجر",
    supplierName = "المورد المحترم",
    items = [],
    currency = "ج.م",
    customNote = ""
  } = payload;

  const greeting = `السلام عليكم ورحمة الله وبركاته،\nالأفاضل شركة/أستاذ: *${supplierName}*\nتحية طيبة وبعد،،`;
  const intro = `نود عمل طلبية توريد جديدة لحساب متجر: *${storeName}*، نرجو تأكيد توفر الكميات والأسعار:`;

  const itemLines = items.map((it, idx) => {
    const codeStr = it.sku || it.code ? ` (كود: ${it.sku || it.code})` : "";
    const costStr = it.costPrice ? ` | سعر التكلفة المتوقع: ${it.costPrice} ${currency}` : "";
    return `${idx + 1}. *${it.name}*${codeStr}\n   الكمية المطلوبة: *${it.quantity} قطعة*${costStr}`;
  });

  const totalUnits = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const summaryLine = `📊 إجمالي البنود: ${items.length} منتج | إجمالي عدد القطع: *${totalUnits} قطعة*`;

  const footer = [
    customNote ? `\nملاحظة: ${customNote}` : "",
    `برجاء إرسال الفاتورة المبدئية وموعد الشحن المتوقع.`,
    `شاكرين ومقدرين حسن تعاونكم الدائم 🙏`
  ]
    .filter(Boolean)
    .join("\n");

  const messageText = [greeting, intro, "", ...itemLines, "", summaryLine, "", footer].join("\n");

  return {
    messageText,
    totalItems: items.length,
    totalUnits,
    encodedUrl: `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`
  };
}

module.exports = {
  calculateStockVelocity,
  predictStockDepletion,
  calculateSuggestedReorderQty,
  buildSupplierWhatsAppProposal
};
