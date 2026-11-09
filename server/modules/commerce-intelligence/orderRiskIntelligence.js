/**
 * Order Risk & Anti-Fraud Intelligence Engine
 * Evaluates e-commerce orders for fake orders, rapid duplicate spam, high COD exposure, and cancellation risk.
 */

const getOrdersModel = require("../orders/orderModel");

const RISK_THRESHOLDS = {
  HIGH_VALUE_COD: 12000, // EGP
  SHORT_ADDRESS_MIN_CHARS: 8,
  RAPID_ORDER_WINDOW_MS: 30 * 60 * 1000 // 30 minutes
};

/**
 * Assesses an incoming or existing order for risk signals
 */
async function assessOrderRisk(subdomain, orderData = {}, options = {}) {
  const {
    phone = "",
    total = 0,
    paymentMethod = "cod",
    address = "",
    city = "",
    visitorId = "",
    items = []
  } = orderData;

  const riskFlags = [];
  const reasons = [];
  let score = 0;

  const cleanPhone = String(phone || "").replace(/\D/g, "");
  const orderTotal = Number(total || 0);
  const isCod = String(paymentMethod).toLowerCase() === "cod";

  let recentOrders = options.injectedRecentOrders || null;
  let pastOrders = options.injectedPastOrders || null;

  // Retrieve orders from DB only if connected or injected
  if (recentOrders === null || pastOrders === null) {
    try {
      const mongoose = require("mongoose");
      const isConnected = mongoose.connection && mongoose.connection.readyState === 1;

      if (options.injectedOrdersModel) {
        const Orders = options.injectedOrdersModel;
        const thirtyMinutesAgo = new Date(Date.now() - RISK_THRESHOLDS.RAPID_ORDER_WINDOW_MS);
        if (cleanPhone.length >= 8) {
          recentOrders = await Orders.find({
            phone: { $regex: cleanPhone.slice(-8) },
            createdAt: { $gte: thirtyMinutesAgo }
          }).select("total status createdAt").lean();

          pastOrders = await Orders.find({
            phone: { $regex: cleanPhone.slice(-8) }
          }).select("status").lean();
        }
      } else if (isConnected) {
        const Orders = getOrdersModel(subdomain);
        const thirtyMinutesAgo = new Date(Date.now() - RISK_THRESHOLDS.RAPID_ORDER_WINDOW_MS);
        if (cleanPhone.length >= 8) {
          recentOrders = await Orders.find({
            phone: { $regex: cleanPhone.slice(-8) },
            createdAt: { $gte: thirtyMinutesAgo }
          }).select("total status createdAt").lean();

          pastOrders = await Orders.find({
            phone: { $regex: cleanPhone.slice(-8) }
          }).select("status").lean();
        }
      }
    } catch (dbErr) {
      console.warn("[ORDER_RISK_DB_WARN]", dbErr.message);
    }
  }

  recentOrders = Array.isArray(recentOrders) ? recentOrders : [];
  pastOrders = Array.isArray(pastOrders) ? pastOrders : [];

  // 1. Rapid Duplicate & Spam Order Check
  if (recentOrders.length >= 2) {
    score += 45;
    riskFlags.push("RAPID_DUPLICATE_ORDERS");
    reasons.push(`تم رصد (${recentOrders.length}) طلبات مكررة من نفس رقم الهاتف خلال آخر 30 دقيقة.`);
  } else if (recentOrders.length === 1) {
    score += 20;
    riskFlags.push("RECENT_ORDER_EXISTS");
    reasons.push("العميل قام بإنشاء طلب آخر حديث جداً خلال أقل من نصف ساعة.");
  }

  // 2. High-Value COD (Cash on Delivery) Exposure
  if (isCod && orderTotal >= RISK_THRESHOLDS.HIGH_VALUE_COD) {
    score += 30;
    riskFlags.push("HIGH_VALUE_COD");
    reasons.push(`قيمة الطلب مرتفعة (${orderTotal.toLocaleString()} ج.م) مع اختيار الدفع عند الاستلام، مما يزيد مخاطر رفض الاستلام.`);
  }

  // 3. Historical Cancellation Record of the Customer
  if (pastOrders.length >= 2) {
    const cancelledCount = pastOrders.filter((o) => o.status === "cancelled").length;
    const cancellationRate = Math.round((cancelledCount / pastOrders.length) * 100);

    if (cancellationRate >= 50 && cancelledCount >= 2) {
      score += 35;
      riskFlags.push("HIGH_CANCELLATION_HISTORY");
      reasons.push(`سجل العميل السابق يشير إلى نسبة إلغاء عالية (${cancellationRate}% من إجمالي ${pastOrders.length} طلبات).`);
    }
  }

  // 4. Address Completeness & Clarity Check
  const fullAddress = `${city} ${address}`.trim();
  if (fullAddress.length < RISK_THRESHOLDS.SHORT_ADDRESS_MIN_CHARS) {
    score += 25;
    riskFlags.push("VAGUE_ADDRESS");
    reasons.push("العنوان المدخل قصير جداً أو يفتقر للتفاصيل، مما قد يعيق وصول مندوب التوصيل.");
  }

  // Cap score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  // Determine risk level & recommended action
  let riskLevel = "low";
  let recommendedAction = "auto_fulfill";
  let actionLabel = "اعتماد مباشر وتجهيز الشحن";

  if (finalScore >= 75) {
    riskLevel = "critical";
    recommendedAction = "require_deposit_or_hold";
    actionLabel = "إيقاف الطلب مؤقتاً ومطالبة العميل بعربون شحن أو مراجعة إدارية";
  } else if (finalScore >= 50) {
    riskLevel = "high";
    recommendedAction = "phone_confirmation";
    actionLabel = "التأكيد الهاتفي الصارم مع العميل قبل الشحن";
  } else if (finalScore >= 25) {
    riskLevel = "medium";
    recommendedAction = "phone_confirmation";
    actionLabel = "تأكيد تفاصيل العنوان مع العميل عبر مكالمة أو واتساب";
  }

  return {
    riskScore: finalScore,
    riskLevel,
    riskFlags,
    recommendedAction,
    actionLabel,
    reasons: reasons.length > 0 ? reasons : ["لا توجد مؤشرات خطورة مرصودة على الطلب، العملية آمنة وطبيعية."],
    evaluatedAt: new Date()
  };
}

module.exports = {
  assessOrderRisk,
  RISK_THRESHOLDS
};
