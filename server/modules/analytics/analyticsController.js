const getOrdersModel = require("../orders/orderModel");
const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");
const getUsersModel = require("../auth/userModel");
const analyticsService = require("./analyticsService");
const aiInsightsService = require("./aiInsightsService");

// 1. لوحة الحسابات التجارية الأساسية (مُحافظ عليها للتوافق الخلفي مع الإضافات الحالية)
exports.getCommercialDashboard = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);
    const Categories = getCategoriesModel(req.subdomain);
    const Users = getUsersModel(req.subdomain);

    const branchFilter = req.branchFilter?.branchId
      ? { branchId: req.branchFilter.branchId }
      : req.query.branchId && req.query.branchId !== "all"
      ? { branchId: req.query.branchId }
      : {};

    const orders = await Orders.find(branchFilter).lean();
    const products = await Products.find(branchFilter).populate("categoryId").lean();
    const totalCustomers = await Users.countDocuments({ role: { $in: ["user", 1] } });

    // 1. حساب الإيرادات وصافي الأرباح
    let totalRevenue = 0;
    let netProfit = 0;
    let validOrdersCount = 0;

    const ordersByStatus = {
      new: 0,
      confirmed: 0,
      preparing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0
    };

    orders.forEach((o) => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;

      // الطلبات التي تحسب مالياً (ليست ملغية أو مرتجعة)
      if (o.status !== "cancelled" && o.status !== "returned") {
        totalRevenue += Number(o.total || 0);
        validOrdersCount++;

        // حساب ربح كل منتج في الطلب
        (o.items || []).forEach((item) => {
          const price = Number(item.price || 0);
          const cost = Number(item.costPrice || 0);
          const qty = Number(item.quantity || 1);
          netProfit += (price - cost) * qty;
        });
      }
    });

    const averageOrderValue = validOrdersCount > 0 ? Math.round(totalRevenue / validOrdersCount) : 0;

    // 2. تنبيهات نفاذ المخزون (أقل من 5 أو 0)
    const lowStockAlerts = products
      .filter((p) => p.stockCount <= 5)
      .sort((a, b) => a.stockCount - b.stockCount)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.categoryId?.name || "عام",
        price: p.price,
        stockCount: p.stockCount,
        image: p.images?.[0] || "",
        isCritical: p.stockCount === 0
      }));

    // 3. المنتجات الأكثر مبيعاً
    const topSellingProducts = [...products]
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 8)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.categoryId?.name || "عام",
        price: p.price,
        salesCount: p.salesCount || 0,
        stockCount: p.stockCount || 0,
        image: p.images?.[0] || ""
      }));

    // 4. مبيعات حسب الأقسام
    const catSalesMap = {};
    orders.forEach((o) => {
      if (o.status !== "cancelled") {
        (o.items || []).forEach((it) => {
          const prod = products.find((p) => String(p._id) === String(it.productId));
          const cName = prod?.categoryId?.name || "أقسام أخرى";
          catSalesMap[cName] = (catSalesMap[cName] || 0) + (it.price * it.quantity);
        });
      }
    });

    const salesByCategory = Object.entries(catSalesMap).map(([name, total]) => ({ name, total }));

    // 5. آخر الطلبات
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    res.json({
      done: true,
      stats: {
        totalRevenue,
        netProfit,
        totalOrders: orders.length,
        validOrdersCount,
        averageOrderValue,
        totalCustomers,
        totalProducts: products.length,
        lowStockCount: lowStockAlerts.length
      },
      ordersByStatus,
      lowStockAlerts,
      topSellingProducts,
      salesByCategory,
      recentOrders
    });
  } catch (err) {
    next(err);
  }
};

// 2. إحصائيات المتجر الشاملة ومعدلات التحويل والسلاسل الزمنية والقمع التسويقي
exports.getStoreOverview = async (req, res, next) => {
  try {
    const query = { ...(req.query || {}), ...(req.branchFilter || {}) };
    const result = await analyticsService.getStoreOverviewAnalytics(req.subdomain, query);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 3. السلاسل الزمنية المستقلة
exports.getTimeSeries = async (req, res, next) => {
  try {
    const query = { ...(req.query || {}), ...(req.branchFilter || {}) };
    const result = await analyticsService.getTimeSeriesAnalytics(req.subdomain, query);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 4. القمع التسويقي المستقل
exports.getFunnel = async (req, res, next) => {
  try {
    const query = { ...(req.query || {}), ...(req.branchFilter || {}) };
    const result = await analyticsService.getFunnelAnalytics(req.subdomain, query);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 5. تصنيفات وترتيب المنتجات (16 معيار ترتيب مختلف مع النسب وحجم المبيعات)
exports.getProductRankings = async (req, res, next) => {
  try {
    const query = { ...(req.query || {}), ...(req.branchFilter || {}) };
    const result = await analyticsService.getProductRankings(req.subdomain, query);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 6. التحليلات التفصيلية على مستوى منتج واحد (Product-Level Analytics)
exports.getProductAnalytics = async (req, res, next) => {
  try {
    const query = { ...(req.query || {}), ...(req.branchFilter || {}) };
    const result = await analyticsService.getProductAnalyticsDetail(
      req.subdomain,
      req.params.productId,
      query
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 7. تقرير إلغاءات ومرتجعات العملاء (أداة مساعدة للمراجعة الإدارية)
exports.getCustomerCancellations = async (req, res, next) => {
  try {
    const query = { ...(req.query || {}), ...(req.branchFilter || {}) };
    const result = await analyticsService.getCustomerCancellationReport(req.subdomain, query);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 8. توليد رؤى المتجر بالذكاء الاصطناعي (Orchestration Service)
exports.generateInsights = async (req, res, next) => {
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const result = await aiInsightsService.generateStoreInsights(req.subdomain, req, params);
    res.json({ success: true, done: true, report: result, ...result });
  } catch (err) {
    next(err);
  }
};

// 9. استرجاع آخر تقرير رؤى ذكية محفوظ للمتجر دون إعادة التوليد
exports.getSavedInsights = async (req, res, next) => {
  try {
    const result = await aiInsightsService.getLastSavedStoreInsights(req.subdomain);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// 10. استخراج الدلالات المعلوماتية والتسويقية لنشاط المنصة والمنتجات (Marketing & Ad Signals)
exports.getMarketingSignals = async (req, res, next) => {
  try {
    const result = await analyticsService.getMarketingProductSignals(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 11. تحليل توافق المنتجات ومصفوفة المشاهدة المشتركة (Product Affinity Matrix)
exports.getProductAffinity = async (req, res, next) => {
  try {
    const analyticsEngine = require("../analytics-engine");
    const result = await analyticsEngine.analyzeProductAffinity(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 12. تحليل مرونة الأسعار ومقاومة الشراء (Price Sensitivity & Elasticity)
exports.getPriceElasticity = async (req, res, next) => {
  try {
    const analyticsEngine = require("../analytics-engine");
    const result = await analyticsEngine.analyzePriceElasticity(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 13. تحليل نقاط الانسحاب ومسار العميل (Journey Drop-Off & Friction)
exports.getDropOffFriction = async (req, res, next) => {
  try {
    const analyticsEngine = require("../analytics-engine");
    const result = await analyticsEngine.analyzeDropOffFriction(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

// 14. تحليل معدلات الإرجاع، التوالف، وسداد الأقساط (Operational Rates & Return Analytics)
exports.getOperationalRates = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const getOrdersModel = require("../orders/orderModel");
    const getReturnRequestModel = require("../returns/returnModel");
    const getProductsModel = require("../products/productModel");

    const Orders = getOrdersModel(subdomain);
    const ReturnRequest = getReturnRequestModel(subdomain);
    const Products = getProductsModel(subdomain);

    // 1. Return Rate Analytics
    const deliveredOrders = await Orders.find({ status: { $in: ["delivered", "completed"] } }).lean();
    let totalSoldUnits = 0;
    const productSalesMap = {};

    for (const ord of deliveredOrders) {
      for (const it of ord.items || []) {
        const pid = String(it.productId || it._id);
        const qty = Number(it.quantity || 1);
        totalSoldUnits += qty;
        if (!productSalesMap[pid]) {
          productSalesMap[pid] = { productId: pid, name: it.name, soldUnits: 0, returnedUnits: 0 };
        }
        productSalesMap[pid].soldUnits += qty;
      }
    }

    const returns = await ReturnRequest.find({ type: "return", status: { $ne: "rejected" } }).lean();
    let totalReturnedUnits = 0;
    for (const ret of returns) {
      for (const it of ret.items || []) {
        const pid = String(it.productId);
        const qty = Number(it.quantity || 1);
        totalReturnedUnits += qty;
        if (productSalesMap[pid]) {
          productSalesMap[pid].returnedUnits += qty;
        } else {
          productSalesMap[pid] = { productId: pid, name: it.name, soldUnits: 0, returnedUnits: qty };
        }
      }
    }

    const overallReturnRate = totalSoldUnits > 0 ? Math.round((totalReturnedUnits / totalSoldUnits) * 10000) / 100 : 0;
    const productReturnRates = Object.values(productSalesMap).map(p => ({
      ...p,
      returnRatePercent: p.soldUnits > 0 ? Math.round((p.returnedUnits / p.soldUnits) * 10000) / 100 : 0
    })).sort((a, b) => b.returnRatePercent - a.returnRatePercent);

    // 2. Scrap / Damage Analytics per Product
    const allProducts = await Products.find({}).select("name stockCount storeStock externalStock costPrice price scrapRecords").lean();
    let totalScrappedUnits = 0;
    let totalScrapLossEGP = 0;
    const productScrapRates = [];

    for (const prod of allProducts) {
      const scraps = prod.scrapRecords || [];
      if (scraps.length > 0) {
        const pScrapUnits = scraps.reduce((sum, s) => sum + Number(s.quantity || 1), 0);
        const pScrapLoss = scraps.reduce((sum, s) => sum + Number(s.totalLoss || 0), 0);
        totalScrappedUnits += pScrapUnits;
        totalScrapLossEGP += pScrapLoss;
        const totalLifetimeUnits = (prod.stockCount || 0) + pScrapUnits;
        const scrapRate = totalLifetimeUnits > 0 ? Math.round((pScrapUnits / totalLifetimeUnits) * 10000) / 100 : 0;
        productScrapRates.push({
          productId: String(prod._id),
          name: prod.name,
          currentStock: prod.stockCount || 0,
          scrappedUnits: pScrapUnits,
          totalLossEGP: pScrapLoss,
          scrapRatePercent: scrapRate
        });
      }
    }
    productScrapRates.sort((a, b) => b.totalLossEGP - a.totalLossEGP);

    // 3. Installment On-Time Settlement Analytics
    const installmentOrders = await Orders.find({ "installment.isInstallment": true }).lean();
    let totalDueInstallments = 0;
    let totalPaidOnTime = 0;
    let totalOverdue = 0;
    const customerInstallmentMap = {};
    const staffCollectionsMap = {};

    const now = new Date();
    for (const ord of installmentOrders) {
      const inst = ord.installment || {};
      const cKey = ord.customer?.phone || ord.customer?.name || "عميل";
      if (!customerInstallmentMap[cKey]) {
        customerInstallmentMap[cKey] = { name: ord.customer?.name, phone: ord.customer?.phone, dueCount: 0, onTimeCount: 0, overdueCount: 0 };
      }

      for (const p of inst.payments || []) {
        const isPastDue = new Date(p.dueDate) <= now;
        if (p.status === "paid" || isPastDue) {
          totalDueInstallments++;
          customerInstallmentMap[cKey].dueCount++;

          if (p.status === "paid") {
            const paidDate = new Date(p.paidAt || p.dueDate);
            const wasOnTime = paidDate <= new Date(p.dueDate.getTime() + 24 * 60 * 60 * 1000);
            if (wasOnTime) {
              totalPaidOnTime++;
              customerInstallmentMap[cKey].onTimeCount++;
            } else {
              totalOverdue++;
              customerInstallmentMap[cKey].overdueCount++;
            }

            const sKey = p.collectedByName || "مشرف الحسابات";
            if (!staffCollectionsMap[sKey]) {
              staffCollectionsMap[sKey] = { staffName: sKey, collectionCount: 0, totalAmountEGP: 0 };
            }
            staffCollectionsMap[sKey].collectionCount++;
            staffCollectionsMap[sKey].totalAmountEGP += Number(p.paidAmount || p.amount || 0);
          } else {
            totalOverdue++;
            customerInstallmentMap[cKey].overdueCount++;
          }
        }
      }
    }

    const overallOnTimeRate = totalDueInstallments > 0 ? Math.round((totalPaidOnTime / totalDueInstallments) * 10000) / 100 : 100;
    const overallOverdueRate = totalDueInstallments > 0 ? Math.round((totalOverdue / totalDueInstallments) * 10000) / 100 : 0;

    res.json({
      done: true,
      returns: {
        totalSoldUnits,
        totalReturnedUnits,
        overallReturnRatePercent: overallReturnRate,
        productReturnRates
      },
      scrap: {
        totalScrappedUnits,
        totalScrapLossEGP,
        productScrapRates
      },
      installments: {
        totalDueInstallments,
        totalPaidOnTime,
        totalOverdue,
        overallOnTimeRatePercent: overallOnTimeRate,
        overallOverdueRatePercent: overallOverdueRate,
        customerCompliance: Object.values(customerInstallmentMap),
        staffCollections: Object.values(staffCollectionsMap)
      }
    });
  } catch (err) {
    next(err);
  }
};


