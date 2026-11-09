const mongoose = require("mongoose");
const getOrdersModel = require("../../orders/orderModel");
const getProductsModel = require("../../products/productModel");
const getExpenseModel = require("../expenses/expenseModel");
const getBranchModel = require("../../branches/branchModel");
const getUsersModel = require("../../auth/userModel");
const getDeductionModel = require("../../branches/models/deductionModel");
const getReturnModel = require("../../returns/returnModel");
const getCommercialAuditSnapshotModel = require("./commercialAuditSnapshotModel");
const getSupplierShipmentModel = require("../procurement/supplierShipmentModel");

function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Compute the live comprehensive commercial ledger
 */
async function computeCommercialLedger(subdomain, { branchId = null, periodStart = null, periodEnd = null } = {}) {
  const Orders = getOrdersModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Expense = getExpenseModel(subdomain);
  const Branch = getBranchModel(subdomain);
  const Users = getUsersModel(subdomain);
  const Deduction = getDeductionModel(subdomain);
  const ReturnRequest = getReturnModel(subdomain);
  const SupplierShipment = getSupplierShipmentModel(subdomain);

  // Filters
  const orderFilter = { status: { $ne: "cancelled" } };
  const expenseFilter = { status: { $ne: "cancelled" } };
  const productFilter = { status: { $ne: "archived" } };
  const returnFilter = { type: "maintenance" };
  const staffFilter = { role: { $in: [2, 3, 4] }, active: { $ne: false } };
  const deductionFilter = { status: { $in: ["deducted", "approved"] } };
  const shipmentFilter = { status: { $ne: "cancelled" } };

  if (branchId && branchId !== "all" && mongoose.isValidObjectId(branchId)) {
    orderFilter.branchId = branchId;
    expenseFilter.branchId = branchId;
    productFilter.branchId = branchId;
    returnFilter.branchId = branchId;
    staffFilter.branchId = branchId;
    deductionFilter.branchId = branchId;
    shipmentFilter.$or = [
      { branchId: new mongoose.Types.ObjectId(branchId) },
      { branchId: null },
      { branchId: { $exists: false } }
    ];
  }

  if (periodStart || periodEnd) {
    const dateRange = {};
    if (periodStart) dateRange.$gte = new Date(periodStart);
    if (periodEnd) dateRange.$lte = new Date(periodEnd);
    orderFilter.createdAt = dateRange;
    expenseFilter.effectiveDate = dateRange;
    deductionFilter.createdAt = dateRange;
    shipmentFilter.createdAt = dateRange;
  }

  // Fetch data in parallel
  const [orders, products, expenses, maintenanceRequests, staffList, deductions, shipments] = await Promise.all([
    Orders.find(orderFilter).lean(),
    Products.find(productFilter).lean(),
    Expense.find(expenseFilter).lean(),
    ReturnRequest.find(returnFilter).lean(),
    Users.find(staffFilter).lean(),
    Deduction.find(deductionFilter).lean(),
    SupplierShipment.find(shipmentFilter).lean()
  ]);

  // 1. Process Orders: POS vs Online vs Installments
  let onlineStoreSales = 0;
  let posDirectSales = 0;
  let merchandiseCogs = 0;
  let customerShippingCollected = 0;
  let carrierActualShippingCost = 0;

  let installmentCashCollected = 0;
  let installmentCompletedProfit = 0;
  let installmentOutstandingReceivables = 0;
  let labWorkshopExpenses = 0;

  for (const ord of orders) {
    const isPos =
      ord.deliveryMethod === "pickup" ||
      ord.shippingSnapshot?.deliveryMethod === "pickup" ||
      ord.shippingSnapshot?.matchMethod === "pos_direct";

    const orderSubtotal = Number(ord.subtotal || 0);
    const orderDiscount = Number(ord.discount || 0);
    const orderNet = Math.max(0, orderSubtotal - orderDiscount);

    if (isPos) {
      posDirectSales += orderNet;
    } else {
      onlineStoreSales += orderNet;
    }

    // Item-level COGS
    for (const it of ord.items || []) {
      const q = Math.max(1, Number(it.quantity || 1));
      const cost = Number(it.costPrice ?? 0);
      merchandiseCogs += cost * q;
    }

    // Shipping
    const custShip = Number(ord.shippingSnapshot?.customerShippingCharge ?? ord.shipping ?? 0);
    const actShip = Number(ord.shippingSnapshot?.actualCarrierCost ?? ord.shippingSnapshot?.estimatedCarrierCost ?? 0);
    customerShippingCollected += custShip;
    carrierActualShippingCost += actShip;

    // Installments
    if (ord.installment && ord.installment.isInstallment) {
      const sum = ord.installment.summary || {};
      const plan = ord.installment.plan || {};
      installmentCashCollected += Number(sum.totalPaid || 0);
      installmentOutstandingReceivables += Number(sum.totalRemaining || 0);

      // Completed installment interest profit
      if (sum.status === "completed") {
        installmentCompletedProfit += Number(plan.interestAmount || 0);
      }
    }

    // Lab & Workshop expenses per order
    labWorkshopExpenses += Number(ord.labWorkshopCost || 0);
  }

  const totalMerchandiseSales = onlineStoreSales + posDirectSales;
  const merchandiseGrossProfit = Math.max(0, totalMerchandiseSales - merchandiseCogs);
  const shippingProfitOrSubsidy = customerShippingCollected - carrierActualShippingCost;

  // 2. Process Maintenance & Services
  let maintenanceRevenue = 0;
  let maintenancePartsCost = 0;

  for (const m of maintenanceRequests) {
    const isCompleted =
      m.status === "delivered_back" ||
      m.status === "repaired" ||
      m.paymentStatus === "remitted_to_admin" ||
      m.paymentStatus === "collected_by_tech";

    if (isCompleted) {
      maintenanceRevenue += Number(m.serviceFee || m.collectedAmount || 0);
      maintenancePartsCost += Number(m.partsCost || 0);
    }
  }
  const maintenanceNetProfit = Math.max(0, maintenanceRevenue - maintenancePartsCost);
  const servicesRevenue = 0; // extensible for custom standalone services

  const totalGrossRevenue =
    totalMerchandiseSales + installmentCashCollected + maintenanceRevenue + customerShippingCollected;

  const totalGrossOperatingProfit =
    merchandiseGrossProfit + installmentCompletedProfit + maintenanceNetProfit + shippingProfitOrSubsidy;

  // 3. Process Assets & Merchandise Valuation
  let totalStockUnits = 0;
  let inventoryCostValue = 0;
  let inventoryRetailValue = 0;

  for (const p of products) {
    const stock = Math.max(0, Number(p.stockCount ?? p.stock ?? 0));
    const cost = Math.max(0, Number(p.costPrice || 0));
    const price = Math.max(0, Number(p.price || 0));

    totalStockUnits += stock;
    inventoryCostValue += stock * cost;
    inventoryRetailValue += stock * price;
  }
  const potentialInventoryProfit = Math.max(0, inventoryRetailValue - inventoryCostValue);

  // 4. Process Expenses, Salaries & Deductions
  let salariesBase = 0;
  for (const s of staffList) {
    salariesBase += Number(s.salary || 0);
  }

  let salariesDeductions = 0;
  for (const d of deductions) {
    salariesDeductions += Number(d.amount || 0);
  }
  const salariesNetPaid = Math.max(0, salariesBase - salariesDeductions);

  let rentExpenses = 0;
  let utilitiesExpenses = 0;
  let generalOperatingExpenses = 0;
  let independentCouriersCost = carrierActualShippingCost;

  for (const exp of expenses) {
    const cat = String(exp.category || "").toLowerCase();
    const title = String(exp.name || exp.description || "");
    const amt = Number(exp.amount || 0);

    if (cat === "rent" || title.includes("إيجار") || title.includes("ايجار")) {
      rentExpenses += amt;
    } else if (
      cat === "utilities" ||
      title.includes("كهرباء") ||
      title.includes("مياه") ||
      title.includes("غاز") ||
      title.includes("إنترنت")
    ) {
      utilitiesExpenses += amt;
    } else if (cat === "shipping" || title.includes("شحن") || title.includes("دليفري")) {
      independentCouriersCost += amt;
    } else {
      generalOperatingExpenses += amt;
    }
  }

  const totalOperatingExpenses =
    salariesNetPaid + independentCouriersCost + rentExpenses + utilitiesExpenses + generalOperatingExpenses + labWorkshopExpenses;

  // Process Supplier Payables Pending (المبالغ المعلقة للموردين)
  let supplierPayablesPending = 0;
  for (const sh of shipments || []) {
    supplierPayablesPending += Math.max(0, Number(sh.outstandingBalance || 0));
  }

  // 5. Net Estimated Profit
  const estimatedNetProfit = totalGrossOperatingProfit - (totalOperatingExpenses - independentCouriersCost);
  const netProfitMarginPercent =
    totalGrossRevenue > 0 ? round2((estimatedNetProfit / totalGrossRevenue) * 100) : 0;

  // 6. Generate AI Insights
  const strengths = [];
  const risksAndWarnings = [];
  const recommendations = [];

  if (merchandiseGrossProfit > 0) {
    strengths.push(
      `هامش ربح تجارة البضائع يبلغ ${round2(
        (merchandiseGrossProfit / (totalMerchandiseSales || 1)) * 100
      )}% بإجمالي مجمل ربح ${round2(merchandiseGrossProfit).toLocaleString()} ج.م.`
    );
  }
  if (installmentCompletedProfit > 0) {
    strengths.push(
      `تحقيق أرباح فوائد وهوامش تقسيط مكتملة قدرها ${round2(installmentCompletedProfit).toLocaleString()} ج.م تعزز الربحية المباشرة.`
    );
  }
  if (maintenanceNetProfit > 0) {
    strengths.push(
      `قسم الصيانة الفنية يدر صافي عائد إيجابي بقيمة ${round2(maintenanceNetProfit).toLocaleString()} ج.م بعد خصم تكلفة قطع الغيار.`
    );
  }

  if (installmentOutstandingReceivables > totalGrossRevenue * 0.4) {
    risksAndWarnings.push(
      `ارتفاع نسبة المديونيات الآجلة للتقسيط (${round2(
        installmentOutstandingReceivables
      ).toLocaleString()} ج.م) مقارنة بالسيولة النقدية، مما يتطلب تشديد متابعة التحصيل.`
    );
  }
  if (salariesNetPaid > totalGrossOperatingProfit * 0.5) {
    risksAndWarnings.push(
      `كتلة المرتبات الصافية تلتهم أكثر من 50% من مجمل الأرباح التشغيلية، يُنصح بربط الحوافز بإنتاجية المبيعات.`
    );
  }
  if (shippingProfitOrSubsidy < 0) {
    risksAndWarnings.push(
      `عجز في رسوم الشحن والتوصيل بقيمة ${Math.abs(round2(shippingProfitOrSubsidy)).toLocaleString()} ج.م (المتجر يتحمل فرق تكلفة شركات الشحن).`
    );
  }

  recommendations.push(
    "التركيز على تحصيل دفعات التقسيط المبكرة وتوجيه السيولة نحو استيراد أو توريد الأصناف الأسرع دوراناً."
  );
  if (shippingProfitOrSubsidy < 0) {
    recommendations.push("مراجعة شرائح تسعير الشحن للعملاء أو التفاوض مع مناديب وشركات الشحن لتقليص فارق التكلفة.");
  }
  recommendations.push(
    `استثمار البضائع الراكدة في العروض الترويجية لتحرير سيولة نقدية فورية من المخزون البالغ ${round2(
      inventoryRetailValue
    ).toLocaleString()} ج.م.`
  );

  const aiInsight = {
    summary:
      estimatedNetProfit >= 0
        ? `الأداء المالي في مسار ربحي مستقر بصافي ربح تقديري ${round2(
            estimatedNetProfit
          ).toLocaleString()} ج.م وهامش ربحية ${netProfitMarginPercent}%.`
        : `تنبيه: الأداء التشغيلي يسجل عجزاً مؤقتاً بقيمة ${Math.abs(round2(
            estimatedNetProfit
          )).toLocaleString()} ج.م بسبب ثقل المصروفات التشغيلية مقارنة بالإيراد المحقق.`,
    strengths: strengths.length > 0 ? strengths : ["حركة مبيعات نشطة ومتوازنة بين الفرع والمتجر."],
    risksAndWarnings:
      risksAndWarnings.length > 0
        ? risksAndWarnings
        : ["مستويات المخاطر مقبولة ولا توجد انحرافات حادة في المصروفات."],
    recommendations,
    generatedAt: new Date()
  };

  return {
    calculatedAt: new Date(),
    revenues: {
      onlineStoreSales: round2(onlineStoreSales),
      posDirectSales: round2(posDirectSales),
      totalMerchandiseSales: round2(totalMerchandiseSales),
      merchandiseCogs: round2(merchandiseCogs),
      merchandiseGrossProfit: round2(merchandiseGrossProfit),

      installmentCashCollected: round2(installmentCashCollected),
      installmentCompletedProfit: round2(installmentCompletedProfit),

      maintenanceRevenue: round2(maintenanceRevenue),
      maintenancePartsCost: round2(maintenancePartsCost),
      maintenanceNetProfit: round2(maintenanceNetProfit),

      servicesRevenue: round2(servicesRevenue),

      customerShippingCollected: round2(customerShippingCollected),
      carrierActualShippingCost: round2(carrierActualShippingCost),
      shippingProfitOrSubsidy: round2(shippingProfitOrSubsidy),

      totalGrossRevenue: round2(totalGrossRevenue),
      totalGrossOperatingProfit: round2(totalGrossOperatingProfit)
    },
    assets: {
      totalProductsCount: products.length,
      totalStockUnits,
      inventoryCostValue: round2(inventoryCostValue),
      inventoryRetailValue: round2(inventoryRetailValue),
      potentialInventoryProfit: round2(potentialInventoryProfit)
    },
    expenses: {
      salariesBase: round2(salariesBase),
      salariesDeductions: round2(salariesDeductions),
      salariesNetPaid: round2(salariesNetPaid),

      independentCouriersCost: round2(independentCouriersCost),

      rentExpenses: round2(rentExpenses),
      utilitiesExpenses: round2(utilitiesExpenses),
      generalOperatingExpenses: round2(generalOperatingExpenses),
      labWorkshopExpenses: round2(labWorkshopExpenses),
      totalOperatingExpenses: round2(totalOperatingExpenses),

      installmentOutstandingReceivables: round2(installmentOutstandingReceivables),
      supplierPayablesPending: round2(supplierPayablesPending)
    },
    netResults: {
      estimatedNetProfit: round2(estimatedNetProfit),
      netProfitMarginPercent,
      cashInHandEstimated: round2(totalGrossRevenue - totalOperatingExpenses)
    },
    aiInsight
  };
}

/**
 * Save snapshot of current financial statistics to database
 */
async function saveAuditSnapshot(subdomain, user, options = {}) {
  const CommercialAuditSnapshot = getCommercialAuditSnapshotModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const ledgerData = await computeCommercialLedger(subdomain, options);

  let branchName = "كافة الأفرع (مركزياً)";
  if (options.branchId && mongoose.isValidObjectId(options.branchId)) {
    const br = await Branch.findById(options.branchId).lean();
    if (br) branchName = br.name;
  }

  const snapshotNumber = `SNP-${Date.now().toString().slice(-8)}`;

  const snapshot = await CommercialAuditSnapshot.create({
    snapshotNumber,
    periodPreset: options.periodPreset || "all_time",
    periodStart: options.periodStart || null,
    periodEnd: options.periodEnd || null,
    branchId: options.branchId || null,
    branchName,
    generatedBy: user?._id || null,
    generatedByName: user?.fullname || user?.name || "الإدارة المالية",
    revenues: ledgerData.revenues,
    assets: ledgerData.assets,
    expenses: ledgerData.expenses,
    netResults: ledgerData.netResults,
    aiInsight: ledgerData.aiInsight
  });

  return snapshot;
}

/**
 * Get latest saved audit snapshot
 */
async function getLatestAuditSnapshot(subdomain, branchId = null) {
  const CommercialAuditSnapshot = getCommercialAuditSnapshotModel(subdomain);
  const filter = {};
  if (branchId && branchId !== "all" && mongoose.isValidObjectId(branchId)) {
    filter.branchId = branchId;
  }
  return await CommercialAuditSnapshot.findOne(filter).sort({ createdAt: -1 }).lean();
}

/**
 * List past audit snapshots
 */
async function listAuditSnapshots(subdomain, branchId = null, limit = 20) {
  const CommercialAuditSnapshot = getCommercialAuditSnapshotModel(subdomain);
  const filter = {};
  if (branchId && branchId !== "all" && mongoose.isValidObjectId(branchId)) {
    filter.branchId = branchId;
  }
  return await CommercialAuditSnapshot.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Reconcile live commercial ledger with cumulative audit logs trail
 */
async function reconcileCommercialLedgerWithAudit(subdomain, { branchId = null, periodStart = null, periodEnd = null } = {}) {
  const ledger = await computeCommercialLedger(subdomain, { branchId, periodStart, periodEnd });
  const { getAuditLogModel } = require("../../audit/auditModel");
  const AuditLog = getAuditLogModel(subdomain);

  const auditQuery = {};
  if (branchId && branchId !== "all" && mongoose.isValidObjectId(branchId)) {
    auditQuery.$or = [
      { branchId: new mongoose.Types.ObjectId(branchId) },
      { branchId: null },
      { branchId: { $exists: false } }
    ];
  }
  if (periodStart || periodEnd) {
    auditQuery.timestamp = {};
    if (periodStart) auditQuery.timestamp.$gte = new Date(periodStart);
    if (periodEnd) auditQuery.timestamp.$lte = new Date(periodEnd);
  }

  const logs = await AuditLog.find(auditQuery).sort({ timestamp: -1 }).lean();

  let auditInflowSum = 0;
  let auditOutflowSum = 0;
  let auditReversalsCount = 0;
  let auditReversalsSum = 0;
  const anomalies = [];

  for (const log of logs) {
    const action = log.action || "";
    const meta = log.metadata || {};
    const amount = Number(meta.total || meta.paidAmount || meta.amount || meta.grandTotal || 0);

    if (action.includes("order_created") || action.includes("sale_created") || action.includes("payment_received") || action.includes("deposit_collected") || action.includes("pos_")) {
      auditInflowSum += amount;
    } else if (action.includes("expense_created") || action.includes("payout") || action.includes("work_order_created") || meta.totalCost) {
      auditOutflowSum += (amount || Number(meta.totalCost || 0));
    } else if (action.includes("cancel") || action.includes("refund") || action.includes("void")) {
      auditReversalsCount++;
      auditReversalsSum += amount;
      anomalies.push({
        type: "reversal",
        severity: "warning",
        title: `عملية ملغاة أو مستردة: ${log.actionLabel || action}`,
        details: log.details,
        userName: log.userName,
        timestamp: log.timestamp,
        amount
      });
    }
  }

  const ledgerInflow = ledger.revenues?.totalGrossRevenue || 0;
  const ledgerOutflow = ledger.expenses?.totalOperatingExpenses || ledger.expenses?.totalExpenses || 0;
  const ledgerNet = ledger.netResults?.estimatedNetProfit ?? (ledgerInflow - ledgerOutflow);

  const varianceInflow = round2(Math.abs(ledgerInflow - (auditInflowSum - auditReversalsSum)));
  const isMatch = varianceInflow < 1.0;

  return {
    reconciledAt: new Date(),
    period: { periodStart, periodEnd },
    branchId,
    status: isMatch ? "MATCHED" : "FLAGGED",
    reconciliationRate: isMatch ? 100 : Math.max(0, round2(100 - (varianceInflow / (ledgerInflow || 1)) * 100)),
    netDiscrepancy: varianceInflow,
    ledgerInflows: ledgerInflow,
    ledgerOutflows: ledgerOutflow,
    auditInflows: round2(auditInflowSum),
    auditOutflows: round2(auditOutflowSum),
    voidsCount: auditReversalsCount,
    voidsSum: round2(auditReversalsSum),
    matched: isMatch,
    matchPercentage: isMatch ? 100 : Math.max(0, round2(100 - (varianceInflow / (ledgerInflow || 1)) * 100)),
    ledgerMetrics: {
      inflow: ledgerInflow,
      outflow: ledgerOutflow,
      net: ledgerNet
    },
    auditMetrics: {
      totalLogsStudied: logs.length,
      loggedSalesCount: logs.filter(l => (l.action || "").includes("order") || (l.action || "").includes("sale")).length,
      inflowsRecorded: round2(auditInflowSum),
      outflowsRecorded: round2(auditOutflowSum),
      reversalsCount: auditReversalsCount,
      reversalsSum: round2(auditReversalsSum)
    },
    discrepancy: {
      amount: varianceInflow,
      status: isMatch ? "تطابق تام ومحاسبة موثقة 100%" : "يوجد هامش تباين أو عمليات ملغاة قيد المراجعة"
    },
    anomalies
  };
}

module.exports = {
  computeCommercialLedger,
  saveAuditSnapshot,
  getLatestAuditSnapshot,
  listAuditSnapshots,
  reconcileCommercialLedgerWithAudit
};
