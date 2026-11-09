/**
 * AI Store Insights & Automated Intelligence Engine
 * Comprehensive multi-dimensional analytics: Commercial KPIs, operational rates,
 * inventory bottlenecks, supply chain telemetry, and executive LLM inference.
 */

const {
  getStoreOverviewAnalytics,
  getProductRankings,
  getCustomerCancellationReport
} = require("./coreAggregator");
const { callDeepSeek, callGemini } = require("../intake-engine");

/**
 * Gathers operational telemetry (installments, returns, scrap, pending supplies, lab orders, audit logs)
 */
async function gatherOperationalTelemetry(subdomain) {
  try {
    const getOrdersModel = require("../orders/orderModel");
    const getProductsModel = require("../products/productModel");
    const getReturnRequestModel = require("../returns/returnModel");
    const { getAuditLogModel } = require("../audit/auditModel");

    const Orders = getOrdersModel(subdomain);
    const Products = getProductsModel(subdomain);
    const ReturnRequest = getReturnRequestModel(subdomain);
    const AuditLog = getAuditLogModel(subdomain);

    const [orders, products, returnRequests, auditLogs] = await Promise.all([
      Orders.find({}).lean(),
      Products.find({}).lean(),
      ReturnRequest.find({}).lean(),
      AuditLog.find({}).sort({ timestamp: -1 }).limit(10).lean()
    ]);

    // 1. Installment metrics
    const installmentOrders = orders.filter((o) => o.installment?.isInstallment);
    let totalDueInstallments = 0;
    let totalPaidOnTime = 0;
    let totalOverdue = 0;
    let totalCollectedEGP = 0;
    const now = new Date();

    for (const ord of installmentOrders) {
      for (const p of ord.installment?.payments || []) {
        const isPastDue = new Date(p.dueDate) <= now;
        if (p.status === "paid") {
          totalPaidOnTime++;
          totalCollectedEGP += Number(p.amount || 0);
        } else if (isPastDue) {
          totalOverdue++;
          totalDueInstallments++;
        } else {
          totalDueInstallments++;
        }
      }
    }
    const settledTotal = totalPaidOnTime + totalOverdue;
    const installmentOnTimeRate = settledTotal > 0 ? Math.round((totalPaidOnTime / settledTotal) * 100) : 100;

    // 2. Returns & Scrap
    let totalSoldUnits = 0;
    orders.forEach((o) => {
      if (o.status !== "cancelled") {
        (o.items || []).forEach((it) => {
          totalSoldUnits += Number(it.quantity || 1);
        });
      }
    });

    let totalReturnedUnits = 0;
    returnRequests.forEach((ret) => {
      if (ret.status !== "rejected") {
        (ret.items || []).forEach((it) => {
          totalReturnedUnits += Number(it.quantity || 1);
        });
      }
    });
    const returnRatePercent = totalSoldUnits > 0 ? Math.round((totalReturnedUnits / totalSoldUnits) * 10000) / 100 : 0;

    let totalScrappedUnits = 0;
    let totalScrapLossEGP = 0;
    products.forEach((prod) => {
      (prod.scrapRecords || []).forEach((s) => {
        totalScrappedUnits += Number(s.quantity || 1);
        totalScrapLossEGP += Number(s.totalLoss || 0);
      });
    });

    // 3. Inventory & Pending Supplies
    const outOfStock = products.filter((p) => (p.storeStock !== undefined ? p.storeStock <= 0 : (p.stockCount || 0) <= 0));
    const critical = products.filter((p) => {
      const stock = p.storeStock !== undefined ? p.storeStock : (p.stockCount || 0);
      const threshold = p.criticalStockThreshold || 3;
      return stock > 0 && stock <= threshold;
    });

    // Pending supplies from orders
    const pendingSupplies = [];
    orders.forEach((ord) => {
      (ord.items || []).forEach((it) => {
        if (it.supplierStatus === "pending") {
          pendingSupplies.push({
            orderId: ord.orderId || ord._id,
            productName: it.name,
            supplierName: it.supplierName || "مورد غير محدد",
            date: it.supplierPendingDate || ord.createdAt
          });
        }
      });
    });

    // 4. Lab / Workshop orders
    const labOrdersInProgress = orders.filter((o) => o.isLabOrder && ["processing", "confirmed", "new", "in_progress", "pending"].includes(o.status || o.orderStatus)).length;
    const labOrdersReady = orders.filter((o) => o.isLabOrder && ["ready", "shipped"].includes(o.status || o.orderStatus)).length;

    // 5. Recent Audit Logs
    const compactLogs = auditLogs.map((l) => ({
      actionLabel: l.actionLabel || l.action,
      userName: l.userName || "المدير",
      impactSummary: l.impactSummary || l.details,
      timestamp: l.timestamp
    }));

    return {
      installments: {
        totalDueInstallments,
        totalPaidOnTime,
        totalOverdue,
        totalCollectedEGP,
        installmentOnTimeRate
      },
      returnsAndScrap: {
        totalSoldUnits,
        totalReturnedUnits,
        returnRatePercent,
        totalScrappedUnits,
        totalScrapLossEGP
      },
      inventoryAndSupplies: {
        totalProducts: products.length,
        outOfStockCount: outOfStock.length,
        outOfStockNames: outOfStock.map((p) => p.name).slice(0, 5),
        criticalCount: critical.length,
        criticalNames: critical.map((p) => p.name).slice(0, 5),
        pendingSuppliesCount: pendingSupplies.length,
        pendingSuppliesSample: pendingSupplies.slice(0, 5)
      },
      labAndFulfillment: {
        labOrdersInProgress,
        labOrdersReady
      },
      recentAuditLogs: compactLogs
    };
  } catch (err) {
    console.warn("[GATHER_OPERATIONAL_TELEMETRY_WARN]", err.message);
    return null;
  }
}

/**
 * Builds compact, structured analytics summary for AI consumption (never raw documents)
 */
async function buildOrchestratedAnalyticsSummary(subdomain, query = {}) {
  const [
    overview,
    topViewed,
    topSold,
    topCancelled,
    topReturned,
    topPriceFeedback,
    customerCancellations,
    operationalTelemetry
  ] = await Promise.all([
    getStoreOverviewAnalytics(subdomain, query),
    getProductRankings(subdomain, { ...query, metric: "most_viewed", limit: 8 }),
    getProductRankings(subdomain, { ...query, metric: "most_units_sold", limit: 8 }),
    getProductRankings(subdomain, { ...query, metric: "most_cancelled", limit: 5 }),
    getProductRankings(subdomain, { ...query, metric: "most_returned", limit: 5 }),
    getProductRankings(subdomain, { ...query, metric: "most_price_feedback", limit: 5 }),
    getCustomerCancellationReport(subdomain, { ...query, limit: 5 }),
    gatherOperationalTelemetry(subdomain)
  ]);

  const productIndicators = [];
  for (const p of topViewed.items || []) {
    if (p.views >= 5 && (p.viewToCartRate === null || p.viewToCartRate < 5)) {
      productIndicators.push({
        type: "high_views_low_cart",
        productId: p.productId,
        name: p.name,
        views: p.views,
        cartAdditions: p.cartAdditions,
        viewToCartRate: p.viewToCartRate,
        priceFeedbackCount: p.priceFeedbackCount,
        price: p.price
      });
    }
  }

  for (const p of topPriceFeedback.items || []) {
    if (p.priceFeedbackCount > 0) {
      productIndicators.push({
        type: "price_sensitivity_signal",
        productId: p.productId,
        name: p.name,
        price: p.price,
        views: p.views,
        priceFeedbackCount: p.priceFeedbackCount,
        priceFeedbackPerViewRate: p.priceFeedbackPerViewRate,
        unitsSold: p.unitsSold
      });
    }
  }

  const priceFeedbackSeries = (overview.timeSeries || []).filter((d) => d.priceFeedback > 0);

  const sampleSizes = {
    totalActivityEvents: overview.current?.sampleSizes?.totalActivityEvents || 0,
    totalOrdersInPeriod: overview.current?.sampleSizes?.totalOrdersInPeriod || 0,
    uniqueVisitors: overview.current?.activity?.uniqueVisitors || 0,
    previousPeriodActivityEvents: overview.previous?.sampleSizes?.totalActivityEvents || 0,
    previousPeriodOrders: overview.previous?.sampleSizes?.totalOrdersInPeriod || 0
  };

  const dataLimitations = [
    sampleSizes.totalOrdersInPeriod < 10
      ? `حجم عينة الطلبات في الفترة المحددة صغير (${sampleSizes.totalOrdersInPeriod} طلبات)، لذا يجب التعامل مع النسب المئوية بحذر إحصائي.`
      : null,
    sampleSizes.uniqueVisitors < 15
      ? `عدد الزوار الفريدين المسجلين في الفترة المحددة محدود (${sampleSizes.uniqueVisitors} زائر).`
      : null,
    "تقارير «السعر مرتفع» (price_feedback) تمثل إشارات انطباعية من الزوار وليست دليلاً قاطعاً بمفردها على أن السعر هو السبب الوحيد لعدم الشراء.",
    "إلغاءات الطلبات لا تثبت تلقائياً وجود مشكلة في السعر أو الجودة أو شركة الشحن دون مراجعة ملاحظات الطلبات والتواصل مع العملاء."
  ].filter(Boolean);

  return {
    period: overview.period,
    generalMetrics: {
      activity: overview.current?.activity || {},
      orders: overview.current?.orders || {},
      financials: overview.current?.financials || {},
      conversions: overview.current?.conversions || {}
    },
    operationalTelemetry: operationalTelemetry || {},
    previousPeriodComparisons: overview.comparisons || {},
    funnel: overview.funnel || {},
    rankingsSummary: {
      mostViewed: (topViewed.items || []).slice(0, 5).map((p) => ({
        name: p.name,
        views: p.views,
        cartAdditions: p.cartAdditions,
        unitsSold: p.unitsSold,
        viewToCartRate: p.viewToCartRate,
        priceFeedbackCount: p.priceFeedbackCount
      })),
      mostSold: (topSold.items || []).slice(0, 5).map((p) => ({
        name: p.name,
        unitsSold: p.unitsSold,
        completedOrdersCount: p.completedOrdersCount,
        revenue: p.revenue,
        views: p.views
      })),
      mostCancelled: (topCancelled.items || [])
        .filter((p) => p.cancelledOrdersCount > 0)
        .map((p) => ({
          name: p.name,
          cancelledOrdersCount: p.cancelledOrdersCount,
          cancelledQuantity: p.cancelledQuantity,
          ordersCreatedCount: p.ordersCreatedCount,
          cancellationRateByOrders: p.cancellationRateByOrders,
          unitsSold: p.unitsSold
        })),
      mostReturned: (topReturned.items || [])
        .filter((p) => p.returnedQuantity > 0 || p.returnEventsCount > 0)
        .map((p) => ({
          name: p.name,
          returnedQuantity: p.returnedQuantity,
          returnEventsCount: p.returnEventsCount,
          unitsSold: p.unitsSold,
          returnRateByUnits: p.returnRateByUnits
        })),
      mostPriceFeedback: (topPriceFeedback.items || [])
        .filter((p) => p.priceFeedbackCount > 0)
        .map((p) => ({
          name: p.name,
          price: p.price,
          priceFeedbackCount: p.priceFeedbackCount,
          views: p.views,
          priceFeedbackPerViewRate: p.priceFeedbackPerViewRate,
          unitsSold: p.unitsSold
        }))
    },
    productProblemIndicators: productIndicators.slice(0, 8),
    customerCancellationSummary: {
      totalCustomersWithOrders: customerCancellations.totalCustomersWithOrders || 0,
      customersWithCancellations: customerCancellations.customersWithCancellations || 0,
      topCancellingCustomers: (customerCancellations.customers || [])
        .filter((c) => c.cancelledOrders > 0)
        .slice(0, 5)
        .map((c) => ({
          name: c.name,
          totalOrders: c.totalOrders,
          completedOrders: c.completedOrders,
          cancelledOrders: c.cancelledOrders,
          cancellationRate: c.cancellationRate,
          cancelledOrdersValue: c.cancelledOrdersValue
        }))
    },
    priceFeedbackTrend: {
      totalEvents: overview.current?.activity?.priceFeedbackEvents || 0,
      ratePerView: overview.current?.conversions?.priceFeedbackRate || 0,
      previousPeriodEvents: overview.previous?.activity?.priceFeedbackEvents || 0,
      activeDays: priceFeedbackSeries.map((d) => ({ date: d.date, count: d.priceFeedback }))
    },
    sampleSizes,
    dataLimitations
  };
}

/**
 * Deterministic rule-based structured insights generator
 */
function buildRuleBasedStructuredInsights(summary) {
  const insights = [];
  const gm = summary.generalMetrics || {};
  const op = summary.operationalTelemetry || {};
  const sample = summary.sampleSizes || {};

  const isLowSample = sample.totalOrdersInPeriod < 10 || sample.uniqueVisitors < 15;
  const defaultConfidence = isLowSample ? "low" : sample.totalOrdersInPeriod >= 30 ? "high" : "medium";

  // Calculate health score deterministically
  let healthScore = 94;
  if ((op.inventoryAndSupplies?.outOfStockCount || 0) > 0) healthScore -= 8;
  if ((op.inventoryAndSupplies?.criticalCount || 0) > 0) healthScore -= 5;
  if ((op.inventoryAndSupplies?.pendingSuppliesCount || 0) > 0) healthScore -= 4;
  if ((op.returnsAndScrap?.totalScrappedUnits || 0) > 0) healthScore -= 6;
  if ((op.installments?.totalOverdue || 0) > 0) healthScore -= 8;
  if (healthScore < 50) healthScore = 50;

  const grossRevenue = gm.financials?.completedRevenue || 0;
  const onTimeRate = op.installments?.installmentOnTimeRate ?? 100;
  const outOfStockCount = op.inventoryAndSupplies?.outOfStockCount || 0;
  const pendingSuppliesCount = op.inventoryAndSupplies?.pendingSuppliesCount || 0;
  const scrappedUnits = op.returnsAndScrap?.totalScrappedUnits || 0;
  const scrapLossEGP = op.returnsAndScrap?.totalScrapLossEGP || 0;

  const executiveSummary = `يسجل المتجر أداءً تشغيلياً وتجارياً مستقراً بإجمالي إيرادات محققة قدرها ${(grossRevenue).toLocaleString()} ج.م، مع انضباط ائتماني ممتاز بنسبة التزام بسداد الأقساط تبلغ ${onTimeRate}%. تتركز الأولويات التنفيذية الحالية في استكمال طلبيات التوريد المعلقة ومعالجة الأصناف النافذة لتفادي تراجع معدلات تلبية الطلبات.`;

  const strengths = [
    `انضباط مالي قوي بسداد الأقساط بنسبة التزام ${onTimeRate}% وإجمالي تحصيلات ${(op.installments?.totalCollectedEGP || 0).toLocaleString()} ج.م.`,
    `مبيعات تجارية ناجحة بإجمالي إيرادات ${(grossRevenue).toLocaleString()} ج.م لـ ${gm.orders?.ordersCompleted || 0} طلباً مكتمل.`,
    `جاهزية ورشة ومعمل البصريات مع استقرار حركة تسليم النظارات للعملاء.`
  ];

  const risksAndBottlenecks = [
    outOfStockCount > 0
      ? `رصد ${outOfStockCount} أصناف نافذة الرصيد تماماً في المخزن تتطلب أوامر توريد عاجلة.`
      : `مخزون متوازن بدون انقطاعات حرجة في الأصناف الرئيسية.`,
    pendingSuppliesCount > 0
      ? `وجود ${pendingSuppliesCount} شحنات توريد معلقة بانتظار التأكيد والاستلام من الوكلاء والموردين.`
      : `لا توجد شحنات توريد معلقة متأخرة حالياً.`,
    scrappedUnits > 0
      ? `تسجيل ${scrappedUnits} قطع تالف ضمان بقيمة هالك ${scrapLossEGP.toLocaleString()} ج.م تستوجب مراجعة الوكيل.`
      : `معدل مرتجعات وتوالف ضمن الحدود الآمنة.`
  ];

  const actionableRecommendations = [
    "إرسال أوامر توريد فورية عبر الواتساب للموردين لتجديد رصيد الأصناف النافذة بالكامل.",
    "متابعة الشحنات المعلقة مع الوكلاء لتسريع وصولها للفرع وتحويل حالتها إلى مستلمة.",
    "استمرار التواصل الآلي الدوري مع عملاء الأقساط قبل مواعيد الاستحقاق للحفاظ على نسبة التزام 100%.",
    "فحص جودة الشنابر والعدسات التي سجلت تالف ضمان بالتنسيق مع فنيي المعمل والوكيل المورد."
  ];

  // 1. Funnel & Commercial Insight
  insights.push({
    title: "تحليل العمليات والمؤشرات التجارية والقمع",
    observation: `حقق المتجر إيرادات مكتملة قدرها ${(grossRevenue).toLocaleString()} ج.م بعدد ${gm.orders?.ordersCompleted || 0} طلباً مكتمل. معدل اكتمال الطلبات المنشأة بلغ ${gm.conversions?.orderCompletionRate ?? 100}%.`,
    supportingMetrics: [
      `إجمالي الإيرادات: ${(grossRevenue).toLocaleString()} ج.م`,
      `الطلبات المكتملة: ${gm.orders?.ordersCompleted || 0} من أصل ${gm.orders?.ordersCreated || 0}`,
      `متوسط قيمة الطلب: ${(gm.financials?.averageCompletedOrderValue || 0).toLocaleString()} ج.م`,
      `نسبة التحصيل وسداد الأقساط بالموعد: ${onTimeRate}%`
    ],
    possibleExplanations: [
      "ثقة العملاء في المنتجات وسرعة تنفيذ الطلبات تساهم في الحفاظ على نسبة إتمام عالية.",
      "توفير خيارات التقسيط والدفع الميسر يعزز متوسط قيمة سلة المشتريات."
    ],
    recommendedActions: [
      "تعزيز العروض على الأصناف ذات هامش الربح المرتفع لتحفيز وتيرة المبيعات.",
      "متابعة السلات التي لم تكتمل وتيسير إجراءات الدفع والاستلام."
    ],
    confidence: defaultConfidence,
    limitations: isLowSample ? "حجم العينة الحالي محدود إحصائياً." : "البيانات مبنية على المبيعات المسجلة."
  });

  // 2. Supply Chain & Deficits
  insights.push({
    title: "كفاءة سلاسل الإمداد ومخاطر نفاد المخزون",
    observation: `يحتوي الكتالوج على ${outOfStockCount} أصناف نافذة بالكامل و${op.inventoryAndSupplies?.criticalCount || 0} أصناف بلغت حد إعادة الطلب الحرج، بالإضافة إلى ${pendingSuppliesCount} شحنات بانتظار التوريد.`,
    supportingMetrics: [
      `أصناف رصيدها صفر: ${outOfStockCount} صنف`,
      `أصناف دون حد الأمان: ${op.inventoryAndSupplies?.criticalCount || 0} صنف`,
      `شحنات توريد معلقة: ${pendingSuppliesCount} شحنة`,
      `أوامر عمل المعمل قيد التجهيز: ${op.labAndFulfillment?.labOrdersInProgress || 0} أمر`
    ],
    possibleExplanations: [
      "الإقبال المرتفع على بعض الموديلات الفاخرة يؤدي إلى استنفاد المخزون أسرع من دورة التوريد المعتادة.",
      "تأخر ردود بعض الموردين أو شركات الشحن على أوامر التوريد المرسلة."
    ],
    recommendedActions: [
      "تفعيل إعادة الطلب التلقائي للأصناف سريعة الحركة عند وصولها لحد الأمان.",
      "استخدام نموذج أمر التوريد عبر الواتساب لتسريع تأكيد الشحنات المعلقة."
    ],
    confidence: "high",
    limitations: "تعتمد الرؤية على الأرصدة الفعلية المسجلة بنظام المخزن."
  });

  // 3. Operational Integrity & Installments
  insights.push({
    title: "الانضباط الائتماني وإدارة المرتجعات وتوالف الضمان",
    observation: `نسبة التزام العملاء بسداد الأقساط في مواعيدها بلغت ${onTimeRate}%، بينما سجل المتجر معدل إرجاع قدره ${op.returnsAndScrap?.returnRatePercent || 0}% وخسارة توالف بلغت ${scrapLossEGP.toLocaleString()} ج.م.`,
    supportingMetrics: [
      `نسبة سداد الأقساط بالموعد: ${onTimeRate}% (أقساط متأخرة: ${op.installments?.totalOverdue || 0})`,
      `المبالغ المحصلة من الأقساط: ${(op.installments?.totalCollectedEGP || 0).toLocaleString()} ج.م`,
      `قطع تالف الضمان والهالك: ${scrappedUnits} قطع بقيمة ${scrapLossEGP.toLocaleString()} ج.م`,
      `قطع مسترجعة سليمة للمخزن: ${op.returnsAndScrap?.totalReturnedUnits || 0} قطع`
    ],
    possibleExplanations: [
      "آلية التحصيل والتذكير بمواعيد الأقساط تثبت فاعليتها مع العملاء.",
      "توالف الضمان قد تنتج عن أخطاء معملية أثناء تركيب العدسات أو عيوب مصنعية في الشنبر."
    ],
    recommendedActions: [
      "فحص عينات الشنابر التي تكرر تلفها مع المصنع واسترداد قيمتها الائتمانية.",
      "مكافأة العملاء الملتزمين بالسداد المبكر بنقاط ولاء أو خصومات على المشتريات التالية."
    ],
    confidence: "high",
    limitations: "البيانات تغطي العقود وتذاكر المرتجع المسجلة بالنظام."
  });

  return {
    executiveSummary,
    healthScore,
    strengths,
    risksAndBottlenecks,
    actionableRecommendations,
    insights
  };
}

/**
 * Normalizes raw insights array and executive package
 */
function normalizeInsightsList(rawResult, fallbackSummary) {
  const fallback = buildRuleBasedStructuredInsights(fallbackSummary);

  if (!rawResult || typeof rawResult !== "object") {
    return fallback;
  }

  const executiveSummary =
    typeof rawResult.executiveSummary === "string" && rawResult.executiveSummary.trim()
      ? rawResult.executiveSummary.trim()
      : fallback.executiveSummary;

  const healthScore =
    typeof rawResult.healthScore === "number" && !isNaN(rawResult.healthScore)
      ? Math.min(100, Math.max(50, Math.round(rawResult.healthScore)))
      : fallback.healthScore;

  const strengths =
    Array.isArray(rawResult.strengths) && rawResult.strengths.length > 0
      ? rawResult.strengths.map((s) => String(s).trim()).filter(Boolean)
      : fallback.strengths;

  const risksAndBottlenecks =
    Array.isArray(rawResult.risksAndBottlenecks) && rawResult.risksAndBottlenecks.length > 0
      ? rawResult.risksAndBottlenecks.map((s) => String(s).trim()).filter(Boolean)
      : fallback.risksAndBottlenecks;

  const actionableRecommendations =
    Array.isArray(rawResult.actionableRecommendations) && rawResult.actionableRecommendations.length > 0
      ? rawResult.actionableRecommendations.map((s) => String(s).trim()).filter(Boolean)
      : fallback.actionableRecommendations;

  const rawList = Array.isArray(rawResult.insights)
    ? rawResult.insights
    : Array.isArray(rawResult)
    ? rawResult
    : [];

  const validConfidences = ["low", "medium", "high"];
  const cleaned = rawList
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const title = String(item.title || "").trim();
      const observation = String(item.observation || "").trim();
      if (!title || !observation) return null;

      const supportingMetrics = Array.isArray(item.supportingMetrics)
        ? item.supportingMetrics.map((m) => String(m).trim()).filter(Boolean)
        : [];
      const possibleExplanations = Array.isArray(item.possibleExplanations)
        ? item.possibleExplanations.map((m) => String(m).trim()).filter(Boolean)
        : [];
      const recommendedActions = Array.isArray(item.recommendedActions)
        ? item.recommendedActions.map((m) => String(m).trim()).filter(Boolean)
        : [];

      const rawConf = String(item.confidence || "medium").toLowerCase().trim();
      const confidence = validConfidences.includes(rawConf) ? rawConf : "medium";
      const limitations = String(
        item.limitations ||
          "هذه الرؤية مبنية على البيانات المتاحة في الفترة المحددة ويجب تفسير الفرضيات كاحتمالات قابلة للاختبار."
      ).trim();

      return {
        title,
        observation,
        supportingMetrics,
        possibleExplanations,
        recommendedActions,
        confidence,
        limitations
      };
    })
    .filter(Boolean);

  const finalInsights = cleaned.length > 0 ? cleaned : fallback.insights;

  return {
    executiveSummary,
    healthScore,
    strengths,
    risksAndBottlenecks,
    actionableRecommendations,
    insights: finalInsights
  };
}

/**
 * Generates store insights via AI or deterministic fallback
 */
async function generateStoreInsights(subdomain, req, query = {}) {
  const summary = await buildOrchestratedAnalyticsSummary(subdomain, query);
  const adminData = req?.adminData || {};
  const isAiEnabled = adminData.aiEnabled !== false;

  const systemPrompt = `أنت المستشار الاستراتيجي الذكي والرئيس التنفيذي للعمليات (AI Chief Operating Officer & Strategic Advisor) لإدارة الأعمال والمتاجر.
مهمتك هي قراءة الملخص الإحصائي والتشغيلي المهيكل الشامل للمتجر وتوليد تقرير استراتيجي ذكي باللغة العربية لمساعدة المدير التنفيذي في اتخاذ قرارات حاسمة.

المطلوب إخراج كائن JSON فقط يحتوي الحقول التالية:
1. executiveSummary: ملخص تنفيذي فائق الذكاء (فقرة أو فقرتين) يصف نبض وصحة العمليات التجارية والتشغيلية والمخزنية وسلاسل الإمداد بناءً على الأرقام الواردة.
2. healthScore: تقييم رقمي لصحة العمليات ككل من 100 (بين 50 و 100) بناءً على انضباط السداد وهوامش الأرباح وتفادي النواقص.
3. strengths: مصفوفة من 2 إلى 3 نقاط قوة وإنجازات ملحوظة مدعومة بالأرقام (مبيعات، تحصيلات، انتظام سداد).
4. risksAndBottlenecks: مصفوفة من 2 إلى 3 مخاطر أو اختناقات تشغيلية حرجة (مثل النواقص، الشحنات المعلقة، التوالف، أو الأقساط المتأخرة).
5. actionableRecommendations: مصفوفة من 3 إلى 4 قرارات وتوصيات عملية وفورية ذات أثر مالي وتشغيلي مباشر.
6. insights: مصفوفة من 3 إلى 5 رؤى تحليلية مهيكلة مفصلة، كل عنصر يحتوي:
   - title: عنوان الرؤية
   - observation: الحقيقة المرصودة بدقة
   - supportingMetrics: مصفوفة أدلة رقمية مستشهدة بالأرقام الفعلية
   - possibleExplanations: مصفوفة فرضيات وتفسيرات محتملة
   - recommendedActions: مصفوفة توصيات عملية
   - confidence: "high" | "medium" | "low"
   - limitations: قيود الاستنتاج

القواعد الصارمة:
- افصل بين الحقائق المرصودة رقمياً (observation & supportingMetrics) والفرضيات التفسيرية (possibleExplanations).
- لا تخترع أرقاماً غير موجودة في الملخص الإحصائي.
- أرجع إجابتك بصيغة JSON فقط دون أي نصوص مقدمة أو خاتمة:
{
  "executiveSummary": "...",
  "healthScore": 88,
  "strengths": ["...", "..."],
  "risksAndBottlenecks": ["...", "..."],
  "actionableRecommendations": ["...", "..."],
  "insights": [...]
}`;

  const userPrompt = `فيما يلي الملخص الإحصائي والتشغيلي للمتجر للفترة الحالية وسجل العمليات الحية:
${JSON.stringify(summary, null, 2)}

قم بتحليل هذا الملخص التشغيلي والمالي الشامل وتوليد التقرير الاستراتيجي المتكامل بصيغة JSON وفق التعليمات.`;

  let aiResult = null;
  let engineUsed = "deterministic-evidence-fallback";
  let modelName = "المحرك الإحصائي والتشغيلي المهيكل";
  let modelNote = "تم استخلاص التقرير بدقة عبر القواعد والمؤشرات الإحصائية المباشرة.";

  // Check if DeepSeek credentials exist in adminData or env
  const deepSeekKey = adminData.AI_API_KEY || adminData.aiApiKey || process.env.AI_API_KEY || "";
  const hasDeepSeekKey = Boolean(deepSeekKey && deepSeekKey.trim() && !deepSeekKey.startsWith("AQ."));

  if (isAiEnabled) {
    if (hasDeepSeekKey) {
      // 1. Priority: DeepSeek advanced intelligence when credentials are present
      try {
        aiResult = await callDeepSeek(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          adminData,
          0.2
        );
        if (aiResult) {
          engineUsed = "deepseek-v3-neural";
          modelName = "DeepSeek-V3 (المستشار الاستراتيجي المتقدم)";
          modelNote = "تم التوليد باستخدام نموذج DeepSeek-V3 فائق الذكاء المتقدم.";
        }
      } catch (err) {
        console.warn("[ANALYTICS_AI_DEEPSEEK_FALLBACK]", err.message);
        try {
          aiResult = await callGemini(systemPrompt, userPrompt, adminData);
          if (aiResult) {
            engineUsed = "gemini-flash-coo";
            modelName = "Gemini 1.5 Flash (بديل فوري)";
            modelNote = "تم التوليد عبر Gemini كبديل فوري بعد تعذر الاتصال بـ DeepSeek.";
          }
        } catch (gemErr) {
          console.warn("[ANALYTICS_AI_GEMINI_FALLBACK]", gemErr.message);
        }
      }
    } else {
      // 2. Default: Gemini fast model (free tier / primary default)
      try {
        aiResult = await callGemini(systemPrompt, userPrompt, adminData);
        if (aiResult) {
          engineUsed = "gemini-flash-coo";
          modelName = "Gemini 1.5 Flash (النموذج الافتراضي السريع)";
          modelNote = "تم التوليد بنموذج Gemini الافتراضي. يمكنك إدخال مفتاح DeepSeek في الإعدادات لتفعيل نموذج الذكاء الاصطناعي الأعمق.";
        }
      } catch (gemErr) {
        console.warn("[ANALYTICS_AI_GEMINI_FALLBACK]", gemErr.message);
      }
    }
  }

  const normalizedPackage = normalizeInsightsList(aiResult, summary);

  const finalReport = {
    done: true,
    engine: engineUsed,
    modelName,
    modelNote,
    aiUsed: Boolean(aiResult),
    hasAdvancedModel: hasDeepSeekKey,
    generatedAt: new Date(),
    period: summary.period,
    sampleSizes: summary.sampleSizes,
    dataLimitations: summary.dataLimitations,
    summarySnapshot: summary,
    executiveSummary: normalizedPackage.executiveSummary,
    healthScore: normalizedPackage.healthScore,
    strengths: normalizedPackage.strengths,
    risksAndBottlenecks: normalizedPackage.risksAndBottlenecks,
    actionableRecommendations: normalizedPackage.actionableRecommendations,
    insights: normalizedPackage.insights
  };

  await saveStoreInsightsToDb(subdomain, finalReport);
  return finalReport;
}

async function saveStoreInsightsToDb(subdomain, insightResult) {
  try {
    const getAdminDataModel = require("../settings/adminDataModel");
    const AdminData = getAdminDataModel(subdomain);
    await AdminData.findOneAndUpdate(
      {},
      {
        $set: {
          lastAiStoreInsight: {
            ...insightResult,
            savedAt: new Date()
          }
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn("[SAVE_AI_INSIGHTS_WARN] Could not persist lastAiStoreInsight:", err.message);
  }
}

async function getLastSavedStoreInsights(subdomain) {
  const getAdminDataModel = require("../settings/adminDataModel");
  const AdminData = getAdminDataModel(subdomain);
  const doc = await AdminData.findOne().select("lastAiStoreInsight siteName").lean();
  const saved = doc?.lastAiStoreInsight || null;
  return {
    done: true,
    hasSavedInsight: Boolean(saved && Array.isArray(saved.insights) && saved.insights.length > 0),
    siteName: doc?.siteName || "المتجر",
    insight: saved
  };
}

module.exports = {
  buildOrchestratedAnalyticsSummary,
  buildRuleBasedStructuredInsights,
  generateStoreInsights,
  getLastSavedStoreInsights
};
