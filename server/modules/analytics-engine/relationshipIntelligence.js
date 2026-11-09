/**
 * Relationship Intelligence & Cross-Entity Analytics Engine
 * Uncovers latent relationships between customer logs, products, price sensitivity, and drop-off points.
 */

const getActivityModel = require("../activity/activityModel");
const getOrdersModel = require("../orders/orderModel");
const getProductsModel = require("../products/productModel");
const { parseDateRange, safeRate } = require("./metricDefinitions");

/**
 * 1. Product Affinity & Co-Viewing Matrix
 * Finds products frequently viewed or added to cart together in the same session or by the same actor.
 */
async function analyzeProductAffinity(subdomain, { limit = 10, days = 30 } = {}) {
  const Activity = getActivityModel(subdomain);
  const Products = getProductsModel(subdomain);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Group views and cart additions by actor (visitorId or sessionId or userId)
  const actorSessions = await Activity.aggregate([
    {
      $match: {
        eventType: { $in: ["product_viewed", "add_to_cart"] },
        productId: { $ne: null },
        createdAt: { $gte: cutoff }
      }
    },
    {
      $project: {
        actorId: {
          $ifNull: ["$userId", { $ifNull: ["$visitorId", "$sessionId"] }]
        },
        productId: "$productId"
      }
    },
    {
      $match: {
        actorId: { $ne: null }
      }
    },
    {
      $group: {
        _id: "$actorId",
        productIds: { $addToSet: "$productId" }
      }
    },
    {
      $match: {
        "productIds.1": { $exists: true } // At least 2 distinct products viewed/carted
      }
    }
  ]);

  // Compute pairwise co-occurrences
  const pairCounts = {};
  actorSessions.forEach((session) => {
    const pids = session.productIds.map(String).sort();
    for (let i = 0; i < pids.length; i++) {
      for (let j = i + 1; j < pids.length; j++) {
        const pairKey = `${pids[i]}|${pids[j]}`;
        pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
      }
    }
  });

  const sortedPairs = Object.entries(pairCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  // Resolve product names
  const allIds = new Set();
  sortedPairs.forEach(([pair]) => {
    const [p1, p2] = pair.split("|");
    allIds.add(p1);
    allIds.add(p2);
  });

  const productDocs = await Products.find({ _id: { $in: Array.from(allIds) } })
    .select("name price images categoryId")
    .populate("categoryId", "name")
    .lean();

  const productMap = new Map(productDocs.map((p) => [String(p._id), p]));

  const affinities = sortedPairs.map(([pair, count]) => {
    const [id1, id2] = pair.split("|");
    const p1 = productMap.get(id1);
    const p2 = productMap.get(id2);
    return {
      productA: {
        _id: id1,
        name: p1?.name || "منتج غير معروف",
        price: p1?.price || 0,
        category: p1?.categoryId?.name || "عام"
      },
      productB: {
        _id: id2,
        name: p2?.name || "منتج غير معروف",
        price: p2?.price || 0,
        category: p2?.categoryId?.name || "عام"
      },
      coOccurrenceCount: count,
      relationshipStrength: count >= 5 ? "قوية جداً (High Affinity)" : count >= 2 ? "متوسطة (Moderate)" : "أولية (Emerging)"
    };
  });

  return {
    totalSessionsAnalyzed: actorSessions.length,
    pairsFound: affinities.length,
    affinities
  };
}

/**
 * 2. Price Sensitivity vs Conversion Elasticity
 * Analyzes relationship between product views, price complaints ("price_feedback"), and sales.
 */
async function analyzePriceElasticity(subdomain, query = {}) {
  const { startDate, endDate } = parseDateRange(query);
  const Activity = getActivityModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  // 1. Activity aggregates per product
  const activityStats = await Activity.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        productId: { $ne: null }
      }
    },
    {
      $group: {
        _id: "$productId",
        views: { $sum: { $cond: [{ $eq: ["$eventType", "product_viewed"] }, 1, 0] } },
        cartAdditions: { $sum: { $cond: [{ $eq: ["$eventType", "add_to_cart"] }, 1, 0] } },
        priceFeedback: { $sum: { $cond: [{ $eq: ["$eventType", "price_feedback"] }, 1, 0] } }
      }
    }
  ]);

  // 2. Sales aggregates per product
  const salesStats = await Orders.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["delivered", "shipped", "preparing", "confirmed", "new"] }
      }
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        unitsSold: { $sum: { $ifNull: ["$items.quantity", 1] } },
        revenue: { $sum: { $multiply: ["$items.price", { $ifNull: ["$items.quantity", 1] }] } }
      }
    }
  ]);

  const salesMap = new Map(salesStats.map((s) => [String(s._id), s]));
  const allProductIds = activityStats.map((a) => a._id);

  const productDocs = await Products.find({ _id: { $in: allProductIds } })
    .select("name price oldPrice categoryId stockCount")
    .populate("categoryId", "name")
    .lean();

  const productMap = new Map(productDocs.map((p) => [String(p._id), p]));

  const analyzedProducts = activityStats.map((stat) => {
    const pid = String(stat._id);
    const prod = productMap.get(pid);
    const sale = salesMap.get(pid) || { unitsSold: 0, revenue: 0 };

    const views = stat.views || 0;
    const pfCount = stat.priceFeedback || 0;
    const unitsSold = sale.unitsSold || 0;
    const pfRate = safeRate(pfCount, views);
    const convRate = safeRate(unitsSold, views);

    let elasticityProfile = "healthy_standard";
    let strategicRecommendation = "أداء قياسي مستقر؛ حافظ على السعر الحالي.";

    if (views >= 5) {
      if (pfRate !== null && pfRate > 15 && (convRate === null || convRate < 3)) {
        elasticityProfile = "elastic_high_friction";
        strategicRecommendation = "حساسية سعرية عالية ومقاومة شراء قوية؛ يُنصح بتقديم عرض ترويجي أو خفض مؤقت لاختبار الاستجابة.";
      } else if (pfRate !== null && pfRate > 10 && convRate !== null && convRate >= 5) {
        elasticityProfile = "inelastic_strong_demand";
        strategicRecommendation = "طلب قوي رغم إشارات السعر؛ لا تخفض السعر، وركز على إبراز الجودة والمواصفات (Value Justification).";
      } else if (convRate !== null && convRate > 10) {
        elasticityProfile = "high_converter_star";
        strategicRecommendation = "منتج نجم ذو تحويل ممتاز؛ يمكن عمل حملات إعلانية وتوسيع المخزون بثقة.";
      }
    } else {
      elasticityProfile = "under_explored";
      strategicRecommendation = "حجم مشاهدات غير كافٍ للجزم؛ يحتاج لتعزيز الظهور أولاً.";
    }

    return {
      productId: pid,
      name: prod?.name || "منتج",
      category: prod?.categoryId?.name || "عام",
      price: prod?.price || 0,
      oldPrice: prod?.oldPrice || 0,
      stockCount: prod?.stockCount || 0,
      views,
      cartAdditions: stat.cartAdditions,
      priceFeedbackCount: pfCount,
      priceFeedbackRate: pfRate,
      unitsSold,
      conversionRate: convRate,
      elasticityProfile,
      strategicRecommendation
    };
  });

  return {
    totalProductsAnalyzed: analyzedProducts.length,
    elasticFrictionCount: analyzedProducts.filter((p) => p.elasticityProfile === "elastic_high_friction").length,
    inelasticDemandCount: analyzedProducts.filter((p) => p.elasticityProfile === "inelastic_strong_demand").length,
    products: analyzedProducts.sort((a, b) => b.views - a.views)
  };
}

/**
 * 3. Drop-Off Point & Journey Friction Analysis
 * Pinpoints exactly where prospective customers abandon the purchase journey.
 */
async function analyzeDropOffFriction(subdomain, query = {}) {
  const { startDate, endDate } = parseDateRange(query);
  const Activity = getActivityModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const [views, carts, checkouts, ordersCreated, ordersDelivered, ordersCancelled] = await Promise.all([
    Activity.countDocuments({ eventType: "product_viewed", createdAt: { $gte: startDate, $lte: endDate } }),
    Activity.countDocuments({ eventType: "add_to_cart", createdAt: { $gte: startDate, $lte: endDate } }),
    Activity.countDocuments({ eventType: "checkout_started", createdAt: { $gte: startDate, $lte: endDate } }),
    Orders.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
    Orders.countDocuments({ status: "delivered", createdAt: { $gte: startDate, $lte: endDate } }),
    Orders.countDocuments({ status: "cancelled", createdAt: { $gte: startDate, $lte: endDate } })
  ]);

  const stages = [
    {
      stage: "view_to_cart",
      label: "من تصفح المنتج إلى إضافة السلة",
      sourceCount: views,
      targetCount: carts,
      conversionRate: safeRate(carts, views),
      dropOffRate: views > 0 ? safeRate(Math.max(0, views - carts), views) : null,
      potentialCauses: [
        "غموض المواصفات أو ضعف جودة صور المنتجات",
        "عدم وضوح السعر أو تكلفة الشحن الإضافية",
        "تفضيل المقارنة مع خيارات أخرى قبل اتخاذ القرار"
      ]
    },
    {
      stage: "cart_to_checkout",
      label: "من السلة إلى بدء إتمام الطلب",
      sourceCount: carts,
      targetCount: checkouts,
      conversionRate: safeRate(checkouts, carts),
      dropOffRate: carts > 0 ? safeRate(Math.max(0, carts - checkouts), carts) : null,
      potentialCauses: [
        "ظهور مصاريف شحن مفاجئة غير متوقعة في السلة",
        "عدم وجود كوبون خصم أو حافز للشراء الفوري",
        "تردد العميل بشأن طريقة الدفع أو المعاينة"
      ]
    },
    {
      stage: "checkout_to_order",
      label: "من شاشة الدفع إلى تأكيد الطلب",
      sourceCount: checkouts,
      targetCount: ordersCreated,
      conversionRate: safeRate(ordersCreated, checkouts),
      dropOffRate: checkouts > 0 ? safeRate(Math.max(0, checkouts - ordersCreated), checkouts) : null,
      potentialCauses: [
        "طلب بيانات تفصيلية زائدة في نموذج العنوان",
        "مخاوف أمنية بشأن الدفع أو غياب خيار الدفع عند الاستلام",
        "أخطاء تقنية أثناء إرسال الطلب"
      ]
    },
    {
      stage: "order_to_delivery",
      label: "من إنشاء الطلب إلى التسليم الناجح",
      sourceCount: ordersCreated,
      targetCount: ordersDelivered,
      conversionRate: safeRate(ordersDelivered, ordersCreated),
      dropOffRate: ordersCreated > 0 ? safeRate(ordersCancelled, ordersCreated) : null,
      potentialCauses: [
        "تأخر الاتصال الهاتفي لتأكيد الطلب مع العميل",
        "تأخر مواعيد مندوب شركة الشحن",
        "تراجع العميل عن الشراء (Buyer's Remorse)"
      ]
    }
  ];

  // Identify primary bottleneck
  let worstStage = stages[0];
  let highestDrop = -1;
  stages.forEach((st) => {
    const drop = st.dropOffRate !== null ? st.dropOffRate : 0;
    if (drop > highestDrop) {
      highestDrop = drop;
      worstStage = st;
    }
  });

  return {
    period: { startDate, endDate },
    stages,
    primaryBottleneck: {
      stage: worstStage.stage,
      label: worstStage.label,
      dropOffRate: worstStage.dropOffRate,
      actionableGuidance: worstStage.potentialCauses[0] || "مراجعة إجراءات هذه المرحلة"
    }
  };
}

module.exports = {
  analyzeProductAffinity,
  analyzePriceElasticity,
  analyzeDropOffFriction
};
