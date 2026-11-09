/**
 * Phase E — Financial Reporting Service (E2 Basic Dashboard & E3 Advanced Reports)
 *
 * Implements:
 * - Date presets (`today`, `yesterday`, `current_week`, `previous_week`, `current_month`,
 *   `previous_month`, `quarter`, `half_year`, `year`, `custom`) + automatic previous-period comparison.
 * - E2 Basic Financial Dashboard: Clearly separated and labeled metrics for:
 *   (1) Sales / Order Value (Accrual),
 *   (2) Actual Cash Received & Paid (Cash Flow),
 *   (3) Recorded Operating Expenses (Incurred vs Paid),
 *   (4) Shipping Charged vs Carrier Costs,
 *   (5) Outstanding Payables & Receivables.
 * - E3 Advanced Financial Reports:
 *   - Net sales, COGS, gross profit & margin, shipping margin/subsidy, operating expenses by category,
 *     net operating result, cash flow statement, product & category performance, inventory valuation,
 *     supplier payables, customer receivables, and period-over-period comparisons.
 *   - Data Completeness Guard: Never displays a definitive net profit when product costs or actual
 *     shipping costs are missing; instead flags `isDefinitiveProfitAvailable: false` and lists `missingInputs`.
 *   - Accounting Invariant: Never double-counts supplier shipment payments as both an operating expense
 *     and a supplier payable settlement.
 */

const getOrdersModel = require("../../orders/orderModel");
const getProductsModel = require("../../products/productModel");
const getCategoriesModel = require("../../categories/categoryModel");
const getFinancePaymentModel = require("../core/payments/paymentModel");
const getSupplierShipmentModel = require("../procurement/supplierShipmentModel");
const getExpenseModel = require("../expenses/expenseModel");
const getManualSaleModel = require("../expenses/manualSaleModel");
const getInventoryMovementModel = require("../inventory/inventoryMovementModel");
const { getInventoryValuationReport } = require("../inventory/inventoryService");
const { calculateAutomaticPayroll } = require("../expenses/expensesService");
const { roundMoney } = require("../shared/validators");

/**
 * Resolve date range preset and its corresponding previous period of equal length.
 */
function resolveDateRangeWindow({
  preset = "current_month",
  startDate = null,
  endDate = null,
  now = new Date()
} = {}) {
  const refNow = now instanceof Date ? new Date(now) : new Date(now);
  let start;
  let end;
  const cleanPreset = String(preset || "current_month").trim().toLowerCase();

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (cleanPreset === "custom" && (startDate || endDate)) {
    start = startDate ? new Date(startDate) : new Date(refNow.getTime() - 30 * 86400000);
    end = endDate ? new Date(endDate) : refNow;
    if (String(endDate || "").length <= 10 && endDate) {
      end = endOfDay(end);
    }
  } else if (cleanPreset === "today") {
    start = startOfDay(refNow);
    end = endOfDay(refNow);
  } else if (cleanPreset === "yesterday" || cleanPreset === "previous_day") {
    const y = new Date(refNow.getTime() - 86400000);
    start = startOfDay(y);
    end = endOfDay(y);
  } else if (cleanPreset === "current_week") {
    const day = refNow.getDay();
    const diffToSat = (day + 1) % 7; // Week starting Saturday (common in Egypt)
    const weekStart = new Date(refNow.getTime() - diffToSat * 86400000);
    start = startOfDay(weekStart);
    end = endOfDay(refNow);
  } else if (cleanPreset === "previous_week") {
    const day = refNow.getDay();
    const diffToSat = (day + 1) % 7;
    const thisWeekStart = startOfDay(new Date(refNow.getTime() - diffToSat * 86400000));
    end = new Date(thisWeekStart.getTime() - 1);
    start = startOfDay(new Date(thisWeekStart.getTime() - 7 * 86400000));
  } else if (cleanPreset === "previous_month" || cleanPreset === "previous_period") {
    start = new Date(refNow.getFullYear(), refNow.getMonth() - 1, 1, 0, 0, 0, 0);
    end = new Date(refNow.getFullYear(), refNow.getMonth(), 0, 23, 59, 59, 999);
  } else if (cleanPreset === "quarter") {
    const qStartMonth = Math.floor(refNow.getMonth() / 3) * 3;
    start = new Date(refNow.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
    end = endOfDay(refNow);
  } else if (cleanPreset === "half_year") {
    const hStartMonth = refNow.getMonth() < 6 ? 0 : 6;
    start = new Date(refNow.getFullYear(), hStartMonth, 1, 0, 0, 0, 0);
    end = endOfDay(refNow);
  } else if (cleanPreset === "year") {
    start = new Date(refNow.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = endOfDay(refNow);
  } else {
    // Default: current_month
    start = new Date(refNow.getFullYear(), refNow.getMonth(), 1, 0, 0, 0, 0);
    end = endOfDay(refNow);
  }

  const durationMs = Math.max(86400000, end.getTime() - start.getTime() + 1);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 1);

  return {
    preset: cleanPreset,
    startDate: start,
    endDate: end,
    previousStartDate: prevStart,
    previousEndDate: prevEnd
  };
}

/**
 * Internal helper: Compute period metrics for `[startDate, endDate]`.
 */
async function computePeriodDataset(subdomain, startDate, endDate) {
  const Orders = getOrdersModel(subdomain);
  const ManualSale = getManualSaleModel(subdomain);
  const Expense = getExpenseModel(subdomain);
  const FinancePayment = getFinancePaymentModel(subdomain);
  const InventoryMovement = getInventoryMovementModel(subdomain);

  const [orders, manualSales, expenses, payments, damagedMovements] = await Promise.all([
    Orders.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean(),
    ManualSale.find({
      saleDate: { $gte: startDate, $lte: endDate }
    }).lean(),
    Expense.find({
      effectiveDate: { $gte: startDate, $lte: endDate },
      status: { $ne: "cancelled" }
    }).lean(),
    FinancePayment.find({
      paidAt: { $gte: startDate, $lte: endDate }
    }).lean(),
    InventoryMovement.find({
      occurredAt: { $gte: startDate, $lte: endDate },
      movementType: "damaged_or_lost"
    }).lean()
  ]);

  // 1. Online Orders Analysis (Exclude cancelled orders from recognized sales)
  let onlineGrossSales = 0;
  let onlineDiscounts = 0;
  let onlineReturnsValue = 0;
  let onlineNetSales = 0;
  let onlineCogs = 0;
  let customerShippingCharged = 0;
  let estimatedCarrierShippingCost = 0;
  let confirmedActualCarrierShippingCost = 0;
  let effectiveCarrierShippingCost = 0;
  let ordersMissingActualShippingCostCount = 0;
  let missingCostItemsCount = 0;
  let recognizedOnlineOrdersCount = 0;
  let returnedOnlineOrdersCount = 0;
  let cashFromPaidOnlineOrdersWithoutLedger = 0;

  // Map of online order IDs that have explicit `order_settlement` ledger entries in `storeFinancePayment`
  const settledOrderIdsInLedger = new Set(
    payments
      .filter((p) => p.entityType === "order_settlement")
      .map((p) => String(p.entityId))
  );

  for (const ord of orders) {
    if (ord.status === "cancelled") continue;

    const grossSub = Number(
      ord.financialSnapshot?.grossMerchandiseSubtotal ?? ord.subtotal ?? 0
    );
    const disc = Number(ord.financialSnapshot?.discountTotal ?? ord.discount ?? 0);
    const netMerch = Number(
      ord.financialSnapshot?.netMerchandiseTotal ?? Math.max(0, grossSub - disc)
    );

    if (ord.status === "returned") {
      returnedOnlineOrdersCount++;
      onlineReturnsValue = roundMoney(onlineReturnsValue + netMerch);
      continue;
    }

    recognizedOnlineOrdersCount++;
    onlineGrossSales = roundMoney(onlineGrossSales + grossSub);
    onlineDiscounts = roundMoney(onlineDiscounts + disc);
    onlineNetSales = roundMoney(onlineNetSales + netMerch);

    // Inspect item-level costs & check for missing costs
    let orderItemCostSum = 0;
    for (const item of ord.items || []) {
      const qty = Math.max(1, Number(item.quantity || 1));
      const unitCost = Number(item.costPrice ?? 0);
      const lineCost =
        item.lineCostTotal !== undefined && item.lineCostTotal !== null && Number(item.lineCostTotal) > 0
          ? Number(item.lineCostTotal)
          : roundMoney(unitCost * qty);
      if (unitCost <= 0 && Number(item.price || 0) > 0) {
        missingCostItemsCount++;
      }
      orderItemCostSum = roundMoney(orderItemCostSum + lineCost);
    }

    const orderCogs =
      orderItemCostSum > 0
        ? orderItemCostSum
        : Number(ord.financialSnapshot?.productCostTotal || 0);
    onlineCogs = roundMoney(onlineCogs + orderCogs);

    // Shipping charges & carrier costs
    const custShip = Number(
      ord.shippingSnapshot?.customerShippingCharge ?? ord.shipping ?? 0
    );
    const estShip = Number(ord.shippingSnapshot?.estimatedCarrierCost ?? 0);
    const isPickup =
      ord.deliveryMethod === "pickup" ||
      ord.shippingSnapshot?.deliveryMethod === "pickup";

    customerShippingCharged = roundMoney(customerShippingCharged + custShip);
    estimatedCarrierShippingCost = roundMoney(estimatedCarrierShippingCost + estShip);

    if (isPickup) {
      // Pickup has 0 delivery carrier cost by definition
    } else if (
      ord.shippingSnapshot?.actualCostStatus === "confirmed" &&
      ord.shippingSnapshot?.actualCarrierCost !== null &&
      ord.shippingSnapshot?.actualCarrierCost !== undefined
    ) {
      const actShip = Number(ord.shippingSnapshot.actualCarrierCost);
      confirmedActualCarrierShippingCost = roundMoney(
        confirmedActualCarrierShippingCost + actShip
      );
      effectiveCarrierShippingCost = roundMoney(effectiveCarrierShippingCost + actShip);
    } else {
      ordersMissingActualShippingCostCount++;
      effectiveCarrierShippingCost = roundMoney(effectiveCarrierShippingCost + estShip);
    }

    // If order is marked `payment.paid === true` (e.g. delivered COD or paid card) and has no separate
    // `order_settlement` row in `storeFinancePayment`, include its collected cash once
    if (ord.payment?.paid === true && !settledOrderIdsInLedger.has(String(ord._id))) {
      cashFromPaidOnlineOrdersWithoutLedger = roundMoney(
        cashFromPaidOnlineOrdersWithoutLedger + Number(ord.total || 0)
      );
    }
  }

  // 2. Manual / Offline Sales Analysis
  let manualGrossSales = 0;
  let manualDiscounts = 0;
  let manualNetSales = 0;
  let manualCogs = 0;
  let manualShippingCharged = 0;
  let manualCarrierShippingCost = 0;
  let recognizedManualSalesCount = 0;

  for (const ms of manualSales) {
    if (ms.status === "cancelled" || ms.status === "returned") continue;
    recognizedManualSalesCount++;
    manualGrossSales = roundMoney(manualGrossSales + Number(ms.grossSubtotal || 0));
    manualDiscounts = roundMoney(manualDiscounts + Number(ms.discountTotal || 0));
    manualNetSales = roundMoney(manualNetSales + Number(ms.netMerchandiseTotal || 0));
    manualCogs = roundMoney(manualCogs + Number(ms.totalCostSnapshot || 0));
    manualShippingCharged = roundMoney(manualShippingCharged + Number(ms.shippingCharge || 0));
    manualCarrierShippingCost = roundMoney(
      manualCarrierShippingCost + Number(ms.actualCarrierShippingCost || 0)
    );

    for (const item of ms.items || []) {
      if (Number(item.unitCostSnapshot || 0) <= 0 && Number(item.unitSellingPrice || 0) > 0) {
        missingCostItemsCount++;
      }
    }
  }

  // 3. Operating Expenses Incurred (Accrual)
  let expensesIncurredTotal = 0;
  const expensesByCategory = {};
  for (const exp of expenses) {
    const amt = roundMoney(Number(exp.amount || 0));
    expensesIncurredTotal = roundMoney(expensesIncurredTotal + amt);
    const cat = exp.category || "operational";
    expensesByCategory[cat] = roundMoney((expensesByCategory[cat] || 0) + amt);
  }

  // 4. Actual Cash Flow from Payment Ledger (`storeFinancePayment`)
  let ledgerCashFromOnlineOrders = 0;
  let ledgerCashFromManualSales = 0;
  let supplierPaymentsOutflow = 0;
  let expensePaymentsOutflow = 0;

  for (const pay of payments) {
    const amt = Number(pay.amount || 0);
    if (!Number.isFinite(amt)) continue;

    if (pay.direction === "inflow") {
      if (pay.entityType === "order_settlement") {
        ledgerCashFromOnlineOrders = roundMoney(ledgerCashFromOnlineOrders + amt);
      } else if (pay.entityType === "manual_sale") {
        ledgerCashFromManualSales = roundMoney(ledgerCashFromManualSales + amt);
      }
    } else if (pay.direction === "outflow") {
      if (pay.entityType === "supplier_shipment") {
        // Tracked strictly as supplier obligation settlement (never double-counted as operating expense!)
        supplierPaymentsOutflow = roundMoney(supplierPaymentsOutflow + amt);
      } else if (pay.entityType === "expense") {
        expensePaymentsOutflow = roundMoney(expensePaymentsOutflow + amt);
      }
    }
  }

  const cashReceivedFromOnlineOrders = roundMoney(
    Math.max(0, ledgerCashFromOnlineOrders + cashFromPaidOnlineOrdersWithoutLedger)
  );
  const cashReceivedFromManualSales = roundMoney(Math.max(0, ledgerCashFromManualSales));
  const totalCashReceived = roundMoney(
    cashReceivedFromOnlineOrders + cashReceivedFromManualSales
  );

  const totalShippingCostOutflow = roundMoney(
    confirmedActualCarrierShippingCost + manualCarrierShippingCost
  );
  const totalPaymentsMade = roundMoney(
    Math.max(0, supplierPaymentsOutflow) +
      Math.max(0, expensePaymentsOutflow) +
      totalShippingCostOutflow
  );
  const netCashFlow = roundMoney(totalCashReceived - totalPaymentsMade);

  // 5. Combined Sales, COGS, Shipping Margin, and Operating Result
  const totalGrossSales = roundMoney(onlineGrossSales + manualGrossSales);
  const totalDiscounts = roundMoney(onlineDiscounts + manualDiscounts);
  const totalNetSales = roundMoney(onlineNetSales + manualNetSales);
  const totalCogs = roundMoney(onlineCogs + manualCogs);

  const damagedWriteOffCost = roundMoney(
    damagedMovements.reduce((acc, m) => acc + Number(m.totalCost || 0), 0)
  );

  const grossProfit = roundMoney(totalNetSales - totalCogs);
  const grossMarginPercent =
    totalNetSales > 0 ? roundMoney((grossProfit / totalNetSales) * 100) : 0;

  const totalCustomerShippingCharged = roundMoney(
    customerShippingCharged + manualShippingCharged
  );
  const totalEffectiveCarrierCost = roundMoney(
    effectiveCarrierShippingCost + manualCarrierShippingCost
  );
  const shippingMarginOrSubsidy = roundMoney(
    totalCustomerShippingCharged - totalEffectiveCarrierCost
  );

  const netOperatingResult = roundMoney(
    grossProfit + shippingMarginOrSubsidy - expensesIncurredTotal
  );
  const netOperatingResultAfterWriteOffs = roundMoney(
    netOperatingResult - damagedWriteOffCost
  );

  return {
    orders,
    manualSales,
    expenses,
    payments,
    metrics: {
      sales: {
        onlineOrdersCount: recognizedOnlineOrdersCount,
        returnedOnlineOrdersCount,
        manualSalesCount: recognizedManualSalesCount,
        onlineGrossSales,
        onlineDiscounts,
        onlineReturnsValue,
        onlineNetSales,
        manualGrossSales,
        manualDiscounts,
        manualNetSales,
        totalGrossSales,
        totalDiscounts,
        totalNetSales
      },
      costsAndProfit: {
        onlineCogs,
        manualCogs,
        totalCogs,
        damagedWriteOffCost,
        grossProfit,
        grossMarginPercent,
        customerShippingCharged: totalCustomerShippingCharged,
        estimatedCarrierShippingCost,
        confirmedActualCarrierShippingCost: roundMoney(
          confirmedActualCarrierShippingCost + manualCarrierShippingCost
        ),
        effectiveCarrierShippingCost: totalEffectiveCarrierCost,
        shippingMarginOrSubsidy,
        isShippingSubsidized: shippingMarginOrSubsidy < 0,
        operatingExpensesIncurred: expensesIncurredTotal,
        expensesByCategory,
        netOperatingResult,
        netOperatingResultAfterWriteOffs
      },
      cashFlow: {
        cashReceivedFromOnlineOrders,
        cashReceivedFromManualSales,
        totalCashReceived,
        supplierPaymentsMade: roundMoney(Math.max(0, supplierPaymentsOutflow)),
        expensePaymentsMade: roundMoney(Math.max(0, expensePaymentsOutflow)),
        shippingCostsPaid: totalShippingCostOutflow,
        totalPaymentsMade,
        netCashFlow
      },
      completenessFlags: {
        missingCostItemsCount,
        ordersMissingActualShippingCostCount
      }
    }
  };
}

/**
 * Compute current outstanding payables and receivables across the store.
 */
async function computeCurrentOutstandingBalances(subdomain) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const Expense = getExpenseModel(subdomain);
  const ManualSale = getManualSaleModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const [shipments, unpaidExpenses, unpaidManualSales, unpaidOnlineOrders] = await Promise.all([
    SupplierShipment.find({
      status: { $ne: "cancelled" },
      outstandingBalance: { $gt: 0 }
    }).lean(),
    Expense.find({
      status: { $ne: "cancelled" },
      outstandingBalance: { $gt: 0 }
    }).lean(),
    ManualSale.find({
      status: "completed",
      outstandingBalance: { $gt: 0 }
    }).lean(),
    Orders.find({
      status: { $nin: ["cancelled", "returned"] },
      "payment.paid": false
    }).lean()
  ]);

  const supplierPayablesOutstanding = roundMoney(
    shipments.reduce((acc, s) => acc + Number(s.outstandingBalance || 0), 0)
  );
  const expensePayablesOutstanding = roundMoney(
    unpaidExpenses.reduce((acc, e) => acc + Number(e.outstandingBalance || 0), 0)
  );
  const manualSalesReceivablesOutstanding = roundMoney(
    unpaidManualSales.reduce((acc, m) => acc + Number(m.outstandingBalance || 0), 0)
  );
  const onlineOrdersUncollectedTotal = roundMoney(
    unpaidOnlineOrders.reduce((acc, o) => acc + Number(o.total || 0), 0)
  );

  return {
    supplierPayablesOutstanding,
    supplierPayablesCount: shipments.length,
    expensePayablesOutstanding,
    expensePayablesCount: unpaidExpenses.length,
    totalPayablesOutstanding: roundMoney(
      supplierPayablesOutstanding + expensePayablesOutstanding
    ),
    manualSalesReceivablesOutstanding,
    manualSalesReceivablesCount: unpaidManualSales.length,
    onlineOrdersUncollectedTotal,
    onlineOrdersUncollectedCount: unpaidOnlineOrders.length,
    totalReceivablesAndUncollected: roundMoney(
      manualSalesReceivablesOutstanding + onlineOrdersUncollectedTotal
    )
  };
}

/**
 * E2: Basic Financial Dashboard
 */
async function getBasicFinancialDashboard(subdomain, query = {}) {
  const windowInfo = resolveDateRangeWindow(query);
  const [periodData, outstandingBalances] = await Promise.all([
    computePeriodDataset(subdomain, windowInfo.startDate, windowInfo.endDate),
    computeCurrentOutstandingBalances(subdomain)
  ]);

  const m = periodData.metrics;

  return {
    dateRange: {
      preset: windowInfo.preset,
      startDate: windowInfo.startDate,
      endDate: windowInfo.endDate
    },
    metrics: {
      recognizedSales: {
        totalSalesValue: m.sales.totalNetSales,
        ...m.sales
      },
      cashReceivedFromCustomers: {
        netCashInflow: m.cashFlow.totalCashReceived,
        ...m.cashFlow
      },
      expensesAndShipping: {
        ...m.costsAndProfit
      },
      outstandingBalances: {
        ...outstandingBalances
      }
    },
    summaries: {
      salesAndDiscounts: {
        measurementType: "order_accrual_value",
        labelAr: "قيمة المبيعات والخصومات المسجلة (استحقاق طلبات وفواتير — لا تعني التحصيل النقدي الفوري)",
        totalGrossSales: m.sales.totalGrossSales,
        totalDiscounts: m.sales.totalDiscounts,
        totalNetSales: m.sales.totalNetSales,
        onlineNetSales: m.sales.onlineNetSales,
        manualNetSales: m.sales.manualNetSales
      },
      actualCashMovements: {
        measurementType: "actual_cash_flow",
        labelAr: "التدفقات النقدية الفعلية (مقبوضات ومدفوعات نقدية/بنكية مسجلة فعلياً)",
        actualCashReceived: m.cashFlow.totalCashReceived,
        cashFromOnlineOrders: m.cashFlow.cashReceivedFromOnlineOrders,
        cashFromManualSales: m.cashFlow.cashReceivedFromManualSales,
        actualPaymentsMade: m.cashFlow.totalPaymentsMade,
        supplierPaymentsMade: m.cashFlow.supplierPaymentsMade,
        expensePaymentsMade: m.cashFlow.expensePaymentsMade,
        shippingCostsPaid: m.cashFlow.shippingCostsPaid,
        netCashFlow: m.cashFlow.netCashFlow
      },
      expensesAndShipping: {
        measurementType: "expenses_incurred_and_shipping",
        labelAr: "المصروفات التشغيلية وتكاليف الشحن عن الفترة",
        recordedExpensesIncurred: m.costsAndProfit.operatingExpensesIncurred,
        actualExpensePaymentsMade: m.cashFlow.expensePaymentsMade,
        customerShippingCharged: m.costsAndProfit.customerShippingCharged,
        effectiveCarrierShippingCost: m.costsAndProfit.effectiveCarrierShippingCost,
        confirmedActualCarrierShippingCost: m.costsAndProfit.confirmedActualCarrierShippingCost
      },
      outstandingBalances: {
        measurementType: "balance_due",
        labelAr: "الأرصدة المستحقة القائمة (التزامات للموردين/المصروفات وذمم مستحقة على العملاء)",
        ...outstandingBalances
      }
    }
  };
}

/**
 * E3: Advanced Financial Reports (P&L, Cash Flow, Product/Category Performance, Period Comparison, Data Completeness Guard)
 */
async function getAdvancedFinancialReport(subdomain, query = {}) {
  const windowInfo = resolveDateRangeWindow(query);
  const Products = getProductsModel(subdomain);
  const Categories = getCategoriesModel(subdomain);

  const [currentPeriod, previousPeriod, outstandingBalances, inventoryValuation, allProducts, allCategories] =
    await Promise.all([
      computePeriodDataset(subdomain, windowInfo.startDate, windowInfo.endDate),
      computePeriodDataset(subdomain, windowInfo.previousStartDate, windowInfo.previousEndDate),
      computeCurrentOutstandingBalances(subdomain),
      getInventoryValuationReport(subdomain),
      Products.find().lean(),
      Categories.find().lean()
    ]);

  const productById = new Map(allProducts.map((p) => [String(p._id), p]));
  const categoryNameById = new Map(allCategories.map((c) => [String(c._id), c.name]));

  // Product & Category Performance aggregation across online orders and manual sales
  const productStatsMap = new Map();
  const categoryStatsMap = new Map();

  const accumulateLine = ({ productId, name, quantity, grossTotal, netValue, lineCost }) => {
    const pid = String(productId || "unknown");
    const prodDoc = productById.get(pid);
    const catId = prodDoc?.categoryId ? String(prodDoc.categoryId) : "uncategorized";
    const catName = categoryNameById.get(catId) || "غير مصنف";

    if (!productStatsMap.has(pid)) {
      productStatsMap.set(pid, {
        productId: pid,
        name: name || prodDoc?.name || "منتج",
        categoryId: catId,
        categoryName: catName,
        unitsSold: 0,
        grossRevenue: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        marginPercent: 0
      });
    }
    const ps = productStatsMap.get(pid);
    ps.unitsSold += quantity;
    ps.grossRevenue = roundMoney(ps.grossRevenue + grossTotal);
    ps.netRevenue = roundMoney(ps.netRevenue + netValue);
    ps.cogs = roundMoney(ps.cogs + lineCost);
    ps.grossProfit = roundMoney(ps.netRevenue - ps.cogs);
    ps.marginPercent =
      ps.netRevenue > 0 ? roundMoney((ps.grossProfit / ps.netRevenue) * 100) : 0;

    if (!categoryStatsMap.has(catId)) {
      categoryStatsMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        unitsSold: 0,
        grossRevenue: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        marginPercent: 0
      });
    }
    const cs = categoryStatsMap.get(catId);
    cs.unitsSold += quantity;
    cs.grossRevenue = roundMoney(cs.grossRevenue + grossTotal);
    cs.netRevenue = roundMoney(cs.netRevenue + netValue);
    cs.cogs = roundMoney(cs.cogs + lineCost);
    cs.grossProfit = roundMoney(cs.netRevenue - cs.cogs);
    cs.marginPercent =
      cs.netRevenue > 0 ? roundMoney((cs.grossProfit / cs.netRevenue) * 100) : 0;
  };

  for (const ord of currentPeriod.orders) {
    if (["cancelled", "returned"].includes(ord.status)) continue;
    for (const item of ord.items || []) {
      const qty = Math.max(1, Number(item.quantity || 1));
      const grossTotal = Number(item.grossLineTotal ?? item.price * qty);
      const netValue = Number(item.netLineValue ?? grossTotal);
      const lineCost = Number(item.lineCostTotal ?? Number(item.costPrice || 0) * qty);
      accumulateLine({
        productId: item.productId,
        name: item.name,
        quantity: qty,
        grossTotal,
        netValue,
        lineCost
      });
    }
  }

  for (const ms of currentPeriod.manualSales) {
    if (["cancelled", "returned"].includes(ms.status)) continue;
    for (const item of ms.items || []) {
      accumulateLine({
        productId: item.productId,
        name: item.nameSnapshot,
        quantity: Number(item.quantity || 1),
        grossTotal: Number(item.grossLineTotal || 0),
        netValue: Number(item.netLineValue || 0),
        lineCost: Number(item.lineCostTotal || 0)
      });
    }
  }

  const productPerformance = Array.from(productStatsMap.values()).sort(
    (a, b) => b.netRevenue - a.netRevenue
  );
  const categoryPerformance = Array.from(categoryStatsMap.values()).sort(
    (a, b) => b.netRevenue - a.netRevenue
  );

  // Data Completeness Check for Definitive Profit (Requirement E3)
  const missingInputs = [];
  const currFlags = currentPeriod.metrics.completenessFlags;
  const totalSalesUnits = productPerformance.reduce((acc, p) => acc + p.unitsSold, 0);

  if (currFlags.missingCostItemsCount > 0) {
    missingInputs.push({
      code: "MISSING_PRODUCT_COST",
      count: currFlags.missingCostItemsCount,
      messageAr: `يوجد عدد (${currFlags.missingCostItemsCount}) من بنود المبيعات بدون تكلفة شراء/مخزون مسجلة (تكلفة صفرية)، مما يجعل تكلفة البضاعة المباعة (COGS) غير مكتملة.`
    });
  }

  if (
    query.requireConfirmedShippingCosts === "true" &&
    currFlags.ordersMissingActualShippingCostCount > 0
  ) {
    missingInputs.push({
      code: "UNCONFIRMED_CARRIER_SHIPPING_COST",
      count: currFlags.ordersMissingActualShippingCostCount,
      messageAr: `يوجد عدد (${currFlags.ordersMissingActualShippingCostCount}) من طلبات التوصيل لم يتم تسجيل تكلفة شركة الشحن الفعلية لها بعد (تم استخدام التكلفة التقديرية مؤقتاً).`
    });
  }

  const isDefinitiveProfitAvailable = missingInputs.length === 0;
  const currM = currentPeriod.metrics;
  const prevM = previousPeriod.metrics;

  const pctChange = (currVal, prevVal) => {
    if (prevVal === 0) return currVal > 0 ? 100 : currVal < 0 ? -100 : 0;
    return roundMoney(((currVal - prevVal) / Math.abs(prevVal)) * 100);
  };

  return {
    dateRange: {
      preset: windowInfo.preset,
      startDate: windowInfo.startDate,
      endDate: windowInfo.endDate,
      previousStartDate: windowInfo.previousStartDate,
      previousEndDate: windowInfo.previousEndDate
    },
    accountingDefinitionsNote: {
      netSales: "صافي المبيعات = إجمالي مبيعات البضائع بعد استبعاد الملغى والمرتجع والخصومات (لا يشمل رسوم الشحن).",
      grossProfit: "مجمل الربح = صافي المبيعات ناقص تكلفة البضاعة المباعة (COGS) وتكلفة التالف المخزني.",
      netOperatingResult: "صافي النتيجة التشغيلية = مجمل الربح + صافي هامش/دعم الشحن ناقص المصروفات التشغيلية المستحقة عن الفترة.",
      cashFlow: "صافي التدفق النقدي = النقدية المحصلة فعلياً ناقص المدفوعات النقدية المسددة فعلياً للموردين والمصروفات والشحن."
    },
    dataCompleteness: {
      isComplete: isDefinitiveProfitAvailable,
      canShowDefinitiveProfit: isDefinitiveProfitAvailable,
      missingInputs,
      statusMessageAr: isDefinitiveProfitAvailable
        ? "جميع تكاليف البضاعة المباعة والمدخلات المطلوبة مكتملة؛ الأرقام المعروضة تمثل صافي الربح التشغيلي المعتمد."
        : "تنبيه اكتمال البيانات: لا يمكن عرض رقم صافي ربح نهائي قاطع لوجود تكاليف غير مكتملة في بعض البنود الموضحة."
    },
    incomeStatement: {
      ...currM.sales,
      ...currM.costsAndProfit,
      totalCostOfGoodsSold: currM.costsAndProfit.totalCogs,
      totalOperatingExpensesIncurred: currM.costsAndProfit.operatingExpensesIncurred,
      canShowDefinitiveProfit: isDefinitiveProfitAvailable,
      totalSalesUnits,
      definitiveGrossProfit: isDefinitiveProfitAvailable ? currM.costsAndProfit.grossProfit : null,
      provisionalGrossProfit: currM.costsAndProfit.grossProfit,
      definitiveNetOperatingResult: isDefinitiveProfitAvailable
        ? currM.costsAndProfit.netOperatingResult
        : null,
      provisionalNetOperatingResult: currM.costsAndProfit.netOperatingResult
    },
    cashFlowStatement: {
      ...currM.cashFlow,
      cashInflowsFromCustomers: currM.cashFlow.totalCashReceived,
      cashOutflowsToSuppliers: currM.cashFlow.supplierPaymentsMade,
      cashOutflowsForExpenses: currM.cashFlow.expensePaymentsMade
    },
    periodComparison: {
      previousPeriod: {
        totalNetSales: prevM.sales.totalNetSales,
        grossProfit: prevM.costsAndProfit.grossProfit,
        operatingExpensesIncurred: prevM.costsAndProfit.operatingExpensesIncurred,
        netOperatingResult: prevM.costsAndProfit.netOperatingResult,
        totalCashReceived: prevM.cashFlow.totalCashReceived,
        netCashFlow: prevM.cashFlow.netCashFlow
      },
      deltas: {
        netSalesChangePercent: pctChange(currM.sales.totalNetSales, prevM.sales.totalNetSales),
        grossProfitChangePercent: pctChange(
          currM.costsAndProfit.grossProfit,
          prevM.costsAndProfit.grossProfit
        ),
        netOperatingResultChangePercent: pctChange(
          currM.costsAndProfit.netOperatingResult,
          prevM.costsAndProfit.netOperatingResult
        ),
        cashFlowChangePercent: pctChange(currM.cashFlow.netCashFlow, prevM.cashFlow.netCashFlow)
      }
    },
    productPerformance,
    categoryPerformance,
    inventoryValuationSummary: inventoryValuation.summary,
    payablesAndReceivables: outstandingBalances
  };
}

module.exports = {
  implemented: true,
  resolveDateRangeWindow,
  getBasicFinancialDashboard,
  getAdvancedFinancialReport
};
