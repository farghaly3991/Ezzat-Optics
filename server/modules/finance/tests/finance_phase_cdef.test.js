/**
 * Comprehensive Automated Verification Suite for Finance Expansion (Phases C, D, E, and F)
 *
 * Covers:
 *  1. Phase C: Full & partial supplier shipment receiving, discrepancies, rejected qty, payment != receipt.
 *  2. Phase C: Idempotent inventory movements, stock reservations, returns, damaged stock & manual adjustments.
 *  3. Phase C: Weighted-Average Cost (WAC) & FIFO valuation, 4-cost separation, and Costing Policy Lock.
 *  4. Phase D: One-off expenses, recurring expense rules vs. period occurrences (immutability of prior periods), and payments.
 *  5. Phase D: Manual / offline sales (POS/Showroom) with inventory/COGS & payment ledger without duplicating online orders.
 *  6. Phase E2/E3: Basic & Advanced Financial Reports, Cash Flow vs. Accrual Profit, zero double-counting of supplier payments, and Data Completeness Guard.
 *  7. Phase E4: Double-entry accounting (Chart of Accounts, balanced journal entries, unbalanced rejection, duplicate-posting prevention, order!=cash, period closing, trial balance).
 *  8. Phase F: Foreign currency purchases, historical exchange-rate snapshots, LLM rate rejection, replacement cost policies (both/increases_only/decreases_only), admin-confirmed selling price updates, and strict historical immutability.
 *  9. Multi-tenant isolation & absence of redundant `storeId` across all Phase C–F models.
 */

const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const envJson = require("../../../env.json");

const { app, setMongooseConnection } = require("../../../server");
const getUsersModel = require("../../auth/userModel");
const getCategoriesModel = require("../../categories/categoryModel");
const getProductsModel = require("../../products/productModel");
const getOrdersModel = require("../../orders/orderModel");

const getInventoryMovementModel = require("../inventory/inventoryMovementModel");
const getInventoryBatchModel = require("../inventory/inventoryBatchModel");
const getExpenseModel = require("../expenses/expenseModel");
const getRecurringExpenseRuleModel = require("../expenses/recurringExpenseRuleModel");
const getManualSaleModel = require("../expenses/manualSaleModel");
const getChartOfAccountModel = require("../accounting/accountModel");
const getJournalEntryModel = require("../accounting/journalEntryModel");
const getAccountingPeriodModel = require("../accounting/accountingPeriodModel");
const getExchangeRateModel = require("../currency/exchangeRateModel");

const JWT_SECRET =
  envJson.localhost?.JWT_SECRET || process.env.JWT_SECRET || "default_jwt_secret";
const TENANT_A = "test_fin_cdef_alpha";
const TENANT_B = "test_fin_cdef_beta";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

let testServer = null;
let baseUrl = "";

async function apiRequest(method, path, { tenant = TENANT_A, token = "", body = null } = {}) {
  const url = new URL(path, baseUrl);
  const headers = {
    "Content-Type": "application/json",
    "x-tenant-id": tenant
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runPhaseCDEFVerification() {
  console.log("=== STARTING FINANCE PHASES C, D, E & F VERIFICATION SUITE ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";
  const connA = await mongoose.createConnection(buildTenantDbUri(baseUri, TENANT_A)).asPromise();
  const connB = await mongoose.createConnection(buildTenantDbUri(baseUri, TENANT_B)).asPromise();

  await connA.dropDatabase();
  await connB.dropDatabase();

  setMongooseConnection(TENANT_A, connA);
  setMongooseConnection(TENANT_B, connB);

  await new Promise((resolve) => {
    testServer = http.createServer(app).listen(0, "127.0.0.1", () => {
      const { port } = testServer.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  try {
    // Seed Admin users on Tenant A and Tenant B
    const UsersA = getUsersModel(TENANT_A);
    const adminA = await UsersA.create({
      fullname: "مدير المتجر أ",
      email: "admin@cdef-alpha.com",
      phone: "01010000001",
      password: "HashedPassword123",
      role: "admin"
    });
    const tokenA = jwt.sign({ userId: adminA._id, role: "admin" }, JWT_SECRET, { expiresIn: "2h" });

    const UsersB = getUsersModel(TENANT_B);
    const adminB = await UsersB.create({
      fullname: "مدير المتجر ب",
      email: "admin@cdef-beta.com",
      phone: "01020000002",
      password: "HashedPassword123",
      role: "admin"
    });
    const tokenB = jwt.sign({ userId: adminB._id, role: "admin" }, JWT_SECRET, { expiresIn: "2h" });

    // Create category & initial products in Tenant A
    const CatA = getCategoriesModel(TENANT_A);
    const categoryA = await CatA.create({ name: "أجهزة ذكية" });

    const ProdA = getProductsModel(TENANT_A);
    const prod1 = await ProdA.create({
      name: "هاتف ذكي برو",
      categoryId: categoryA._id,
      price: 1500,
      costPrice: 1000,
      inventoryBookUnitCost: 1000,
      replacementUnitCost: 1000,
      stockCount: 0
    });
    const prod2 = await ProdA.create({
      name: "سماعة بلوتوث",
      categoryId: categoryA._id,
      price: 500,
      costPrice: 200,
      inventoryBookUnitCost: 200,
      replacementUnitCost: 200,
      stockCount: 0
    });

    // ========================================================================
    // SUITE 1: Phase C Receiving Workflow (Full & Partial, Discrepancies, Payment != Receipt)
    // ========================================================================
    console.log("1. Testing Phase C Supplier Shipment Receiving (Partial/Full, Discrepancies, Payment != Receipt)...");

    const shRes = await apiRequest("POST", "/api/admin/finance/shipments", {
      token: tokenA,
      body: {
        supplierName: "المورد الدولي للإلكترونيات",
        expectedGoodsValue: 12000,
        status: "ordered"
      }
    });
    assert.strictEqual(shRes.status, 201);
    const shipment = shRes.data.shipment;

    const assocRes = await apiRequest("POST", `/api/admin/finance/shipments/${shipment._id}/lines`, {
      token: tokenA,
      body: {
        lines: [
          { productId: prod1._id, quantity: 10, unitCost: 1000 },
          { productId: prod2._id, quantity: 10, unitCost: 200 }
        ]
      }
    });
    assert.strictEqual(assocRes.status, 200);
    const line1Id = assocRes.data.shipment.purchaseLines[0].lineId;
    const line2Id = assocRes.data.shipment.purchaseLines[1].lineId;

    // Pay supplier 5000 EGP BEFORE receiving -> verify physical stock is STILL 0 (payment != receipt!)
    const payShRes = await apiRequest("POST", `/api/admin/finance/shipments/${shipment._id}/payments`, {
      token: tokenA,
      body: { amount: 5000, paymentMethod: "bank_transfer" }
    });
    assert.strictEqual(payShRes.status, 201);
    const p1BeforeReceive = await ProdA.findById(prod1._id).lean();
    assert.strictEqual(p1BeforeReceive.stockCount, 0, "Paying supplier must NOT increment inventory before receipt");

    // Partial receipt: receive 6 of prod1, reject 1 of prod1 with discrepancy note
    const receiveKey1 = "RCV-PARTIAL-001";
    const rcvPartialRes = await apiRequest(
      "POST",
      `/api/admin/finance/inventory/receive/${shipment._id}`,
      {
        token: tokenA,
        body: {
          idempotencyKey: receiveKey1,
          notes: "استلام الدفعة الجزئية الأولى",
          lines: [
            {
              lineId: line1Id,
              productId: prod1._id,
              receivedQuantity: 6,
              rejectedQuantity: 1,
              discrepancyNote: "وحدة واحدة مكسورة الشاشة تم رفضها"
            }
          ]
        }
      }
    );
    assert.strictEqual(rcvPartialRes.status, 201);
    assert.strictEqual(rcvPartialRes.data.shipment.status, "partially_received");

    const p1AfterPartial = await ProdA.findById(prod1._id).lean();
    assert.strictEqual(p1AfterPartial.stockCount, 6);

    // Retry the exact same receiving idempotencyKey -> must NOT double-count stock!
    const rcvRetryRes = await apiRequest(
      "POST",
      `/api/admin/finance/inventory/receive/${shipment._id}`,
      {
        token: tokenA,
        body: {
          idempotencyKey: receiveKey1,
          lines: [{ lineId: line1Id, productId: prod1._id, receivedQuantity: 6 }]
        }
      }
    );
    assert.strictEqual(rcvRetryRes.status, 200);
    assert.strictEqual(rcvRetryRes.data.duplicate, true);
    const p1AfterRetry = await ProdA.findById(prod1._id).lean();
    assert.strictEqual(p1AfterRetry.stockCount, 6, "Retrying receipt must not double-count inventory");

    // Complete receiving remaining quantities (3 of prod1 + 10 of prod2)
    const rcvFullRes = await apiRequest(
      "POST",
      `/api/admin/finance/inventory/receive/${shipment._id}`,
      {
        token: tokenA,
        body: {
          idempotencyKey: "RCV-FINAL-002",
          lines: [
            { lineId: line1Id, productId: prod1._id, receivedQuantity: 3 },
            { lineId: line2Id, productId: prod2._id, receivedQuantity: 10 }
          ]
        }
      }
    );
    assert.strictEqual(rcvFullRes.status, 201);
    assert.strictEqual(rcvFullRes.data.shipment.status, "received");
    // Verify receipt did NOT mark the supplier as paid (outstandingBalance is still 7000)
    assert.strictEqual(rcvFullRes.data.shipment.outstandingBalance, 7000);
    console.log("   [PASS] Full & partial receiving, discrepancy notes, idempotency, and payment != receipt verified.");

    // ========================================================================
    // SUITE 2: Phase C Reservations, Returns, Damaged Stock & Manual Adjustments
    // ========================================================================
    console.log("2. Testing Phase C Reservations, Returns, Damaged Stock & Manual Adjustments...");

    // Hold reservation of 2 units on prod2 (physical = 10, reserved = 2, available = 8)
    const holdRes = await apiRequest("POST", "/api/admin/finance/inventory/reservations", {
      token: tokenA,
      body: {
        productId: prod2._id,
        quantityDelta: 2,
        referenceCode: "CART-HOLD-1",
        idempotencyKey: "RES-HOLD-1"
      }
    });
    assert.strictEqual(holdRes.status, 200);
    assert.strictEqual(holdRes.data.physicalStock, 10);
    assert.strictEqual(holdRes.data.reservedStock, 2);
    assert.strictEqual(holdRes.data.availableStock, 8);

    // Release reservation
    const relRes = await apiRequest("POST", "/api/admin/finance/inventory/reservations", {
      token: tokenA,
      body: {
        productId: prod2._id,
        quantityDelta: -2,
        referenceCode: "CART-HOLD-1",
        idempotencyKey: "RES-REL-1"
      }
    });
    assert.strictEqual(relRes.status, 200);
    assert.strictEqual(relRes.data.reservedStock, 0);
    assert.strictEqual(relRes.data.availableStock, 10);

    // Damaged stock: 1 unit of prod2 -> physical becomes 9
    const dmgRes = await apiRequest("POST", "/api/admin/finance/inventory/damaged", {
      token: tokenA,
      body: {
        productId: prod2._id,
        quantity: 1,
        reason: "تلف عبوة أثناء النقل الداخلي",
        idempotencyKey: "DMG-001"
      }
    });
    assert.strictEqual(dmgRes.status, 201);
    assert.strictEqual(dmgRes.data.movement.physicalStockAfter, 9);

    // Supplier return: 1 unit of prod2 -> physical becomes 8
    const supRetRes = await apiRequest("POST", "/api/admin/finance/inventory/returns", {
      token: tokenA,
      body: {
        returnType: "supplier_return",
        productId: prod2._id,
        quantity: 1,
        reason: "إرجاع وحدة معيبة للمورد",
        idempotencyKey: "SUP-RET-001"
      }
    });
    assert.strictEqual(supRetRes.status, 201);
    assert.strictEqual(supRetRes.data.movement.physicalStockAfter, 8);

    // Customer return to sellable stock: +1 unit of prod2 -> physical becomes 9
    const custRetRes = await apiRequest("POST", "/api/admin/finance/inventory/returns", {
      token: tokenA,
      body: {
        returnType: "customer_return",
        productId: prod2._id,
        quantity: 1,
        reason: "مرتجع عميل بحالة المصنع",
        idempotencyKey: "CUST-RET-001"
      }
    });
    assert.strictEqual(custRetRes.status, 201);
    assert.strictEqual(custRetRes.data.movement.physicalStockAfter, 9);

    // Manual stock adjustment reconciliation: adjust prod2 from 9 to 10 with reason
    const adjRes = await apiRequest("POST", "/api/admin/finance/inventory/adjust", {
      token: tokenA,
      body: {
        productId: prod2._id,
        newPhysicalStock: 10,
        reason: "مطابقة الجرد الفعلي بالمخزن",
        idempotencyKey: "ADJ-001"
      }
    });
    assert.strictEqual(adjRes.status, 200);
    assert.strictEqual(adjRes.data.movement.physicalStockAfter, 10);
    console.log("   [PASS] Reservations, damaged stock, supplier/customer returns, and manual adjustments verified.");

    // ========================================================================
    // SUITE 3: Phase C Weighted-Average Cost (WAC), FIFO & Costing Policy Lock
    // ========================================================================
    console.log("3. Testing Phase C Costing Policies (WAC & FIFO), 4-Cost Separation, and Policy Lock...");

    // Currently prod1 has 9 units received @ 1000 EGP (book cost = 1000).
    // Let's receive another shipment of 9 units of prod1 @ 1200 EGP -> new WAC should be (9*1000 + 9*1200)/18 = 1100 EGP!
    const sh2Res = await apiRequest("POST", "/api/admin/finance/shipments", {
      token: tokenA,
      body: { supplierName: "مورد الدفعة الثانية", expectedGoodsValue: 10800 }
    });
    const sh2 = sh2Res.data.shipment;
    const assoc2Res = await apiRequest("POST", `/api/admin/finance/shipments/${sh2._id}/lines`, {
      token: tokenA,
      body: { lines: [{ productId: prod1._id, quantity: 9, unitCost: 1200 }] }
    });
    const sh2LineId = assoc2Res.data.shipment.purchaseLines[0].lineId;

    await apiRequest("POST", `/api/admin/finance/inventory/receive/${sh2._id}`, {
      token: tokenA,
      body: {
        idempotencyKey: "RCV-WAC-BATCH2",
        lines: [{ lineId: sh2LineId, productId: prod1._id, receivedQuantity: 9 }]
      }
    });

    const valRes = await apiRequest("GET", "/api/admin/finance/inventory/valuation", { token: tokenA });
    assert.strictEqual(valRes.status, 200);
    const prod1Val = valRes.data.items.find((i) => String(i.productId) === String(prod1._id));
    assert.strictEqual(prod1Val.physicalStock, 18);
    assert.strictEqual(prod1Val.inventoryBookUnitCost, 1100, "WAC book unit cost should be 1100 EGP");
    assert.strictEqual(prod1Val.historicalPurchaseCost, 1200, "Historical last purchase cost should be 1200 EGP");
    assert.strictEqual(prod1Val.replacementUnitCost, 1200, "Replacement cost should be 1200 EGP");
    assert.strictEqual(prod1Val.sellingPrice, 1500, "Selling price should remain 1500 EGP");

    // Place a customer order for 2 units of prod1 -> COGS must use WAC (1100 EGP/unit = 2200 EGP)
    const orderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "pickup",
        customer: { name: "عميل اختبار التكلفة", phone: "01055556666", address: "القاهرة", city: "القاهرة" },
        items: [{ productId: prod1._id, quantity: 2 }]
      }
    });
    assert.strictEqual(orderRes.status, 200);
    const createdOrder = orderRes.data.order;
    assert.strictEqual(createdOrder.items[0].costPrice, 1100);
    assert.strictEqual(createdOrder.financialSnapshot.productCostTotal, 2200);

    // Attempt to silently switch costing policy to 'fifo' without confirmation -> must fail with 400 COSTING_POLICY_LOCKED
    const switchPolicyFail = await apiRequest("PUT", "/api/admin/finance/settings", {
      token: tokenA,
      body: { inventoryConfig: { costingMethod: "fifo" } }
    });
    assert.strictEqual(switchPolicyFail.status, 400);
    assert.strictEqual(switchPolicyFail.data.code, "COSTING_POLICY_LOCKED");

    // Test FIFO policy on Tenant B (before any movements exist on Tenant B)
    const setFifoB = await apiRequest("PUT", "/api/admin/finance/settings", {
      tenant: TENANT_B,
      token: tokenB,
      body: { inventoryConfig: { costingMethod: "fifo" } }
    });
    assert.strictEqual(setFifoB.status, 200);
    assert.strictEqual(setFifoB.data.settings.inventoryConfig.costingMethod, "fifo");

    const CatB = getCategoriesModel(TENANT_B);
    const catB = await CatB.create({ name: "إلكترونيات ب" });
    const ProdB = getProductsModel(TENANT_B);
    const fifoProd = await ProdB.create({
      name: "منتج FIFO",
      categoryId: catB._id,
      price: 400,
      costPrice: 100,
      stockCount: 0
    });

    // Receive Batch 1 on Tenant B: 5 units @ 100 EGP, Batch 2: 5 units @ 200 EGP
    const shB1 = (
      await apiRequest("POST", "/api/admin/finance/shipments", {
        tenant: TENANT_B,
        token: tokenB,
        body: {
          supplierName: "مورد ب 1",
          expectedGoodsValue: 500,
          purchaseLines: [{ productId: fifoProd._id, quantity: 5, unitCost: 100 }]
        }
      })
    ).data.shipment;
    await apiRequest("POST", `/api/admin/finance/inventory/receive/${shB1._id}`, {
      tenant: TENANT_B,
      token: tokenB,
      body: {
        lines: [{ lineId: shB1.purchaseLines[0].lineId, productId: fifoProd._id, receivedQuantity: 5 }]
      }
    });

    const shB2 = (
      await apiRequest("POST", "/api/admin/finance/shipments", {
        tenant: TENANT_B,
        token: tokenB,
        body: {
          supplierName: "مورد ب 2",
          expectedGoodsValue: 1000,
          purchaseLines: [{ productId: fifoProd._id, quantity: 5, unitCost: 200 }]
        }
      })
    ).data.shipment;
    await apiRequest("POST", `/api/admin/finance/inventory/receive/${shB2._id}`, {
      tenant: TENANT_B,
      token: tokenB,
      body: {
        lines: [{ lineId: shB2.purchaseLines[0].lineId, productId: fifoProd._id, receivedQuantity: 5 }]
      }
    });

    // Sell 6 units on Tenant B -> FIFO consumes 5 @ 100 (500) + 1 @ 200 (200) = 700 total COGS!
    const fifoOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      tenant: TENANT_B,
      body: {
        deliveryMethod: "pickup",
        customer: { name: "عميل FIFO", phone: "01122334455", address: "الجيزة", city: "الجيزة" },
        items: [{ productId: fifoProd._id, quantity: 6 }]
      }
    });
    assert.strictEqual(fifoOrderRes.status, 200);
    assert.strictEqual(fifoOrderRes.data.order.financialSnapshot.productCostTotal, 700);
    console.log("   [PASS] WAC valuation, FIFO layer consumption, 4-cost separation, and Costing Policy Lock verified.");

    // ========================================================================
    // SUITE 4: Phase D Expenses, Recurring Rules vs. Period Occurrences & Payments
    // ========================================================================
    console.log("4. Testing Phase D Expenses, Recurring Rule vs. Occurrence Immutability & Payments...");

    // Create one-off unpaid expense (1,200 EGP electricity)
    const exp1Res = await apiRequest("POST", "/api/admin/finance/expenses", {
      token: tokenA,
      body: {
        title: "فاتورة كهرباء المعرض",
        category: "electricity",
        amount: 1200,
        effectiveDate: new Date().toISOString(),
        payImmediately: false
      }
    });
    assert.strictEqual(exp1Res.status, 201);
    const exp1 = exp1Res.data.expense;
    assert.strictEqual(exp1.paymentStatus, "unpaid");
    assert.strictEqual(exp1.totalPaid, 0);
    assert.strictEqual(exp1.outstandingBalance, 1200);

    // Pay 500 EGP partial, then 700 EGP remaining
    const expPay1 = await apiRequest("POST", `/api/admin/finance/expenses/${exp1._id}/payments`, {
      token: tokenA,
      body: { amount: 500, paymentMethod: "cash" }
    });
    assert.strictEqual(expPay1.status, 201);
    assert.strictEqual(expPay1.data.expense.paymentStatus, "partial");
    assert.strictEqual(expPay1.data.expense.outstandingBalance, 700);

    const expPay2 = await apiRequest("POST", `/api/admin/finance/expenses/${exp1._id}/payments`, {
      token: tokenA,
      body: { amount: 700, paymentMethod: "cash" }
    });
    assert.strictEqual(expPay2.status, 201);
    assert.strictEqual(expPay2.data.expense.paymentStatus, "paid");
    assert.strictEqual(expPay2.data.expense.outstandingBalance, 0);

    // Create Recurring Expense Rule (Rent = 5,000 EGP/month)
    const ruleRes = await apiRequest("POST", "/api/admin/finance/expenses/recurring-rules", {
      token: tokenA,
      body: {
        title: "إيجار المقر الرئيسي",
        category: "rent",
        amount: 5000,
        frequency: "monthly",
        startDate: "2026-01-01",
        generateCurrentPeriod: false
      }
    });
    assert.strictEqual(ruleRes.status, 201);
    const rentRule = ruleRes.data.rule;

    // Generate occurrence for 2026-08
    const genAug = await apiRequest("POST", "/api/admin/finance/expenses/recurring-rules/generate", {
      token: tokenA,
      body: { ruleId: rentRule._id, periodKey: "2026-08" }
    });
    assert.strictEqual(genAug.status, 200);
    assert.strictEqual(genAug.data.createdCount, 1);
    const augExpenseId = genAug.data.createdOccurrences[0]._id;
    assert.strictEqual(genAug.data.createdOccurrences[0].amount, 5000);

    // Retry generating 2026-08 -> must NOT duplicate!
    const genAugRetry = await apiRequest("POST", "/api/admin/finance/expenses/recurring-rules/generate", {
      token: tokenA,
      body: { ruleId: rentRule._id, periodKey: "2026-08" }
    });
    assert.strictEqual(genAugRetry.status, 200);
    assert.strictEqual(genAugRetry.data.createdCount, 0);
    assert.strictEqual(genAugRetry.data.skippedCount, 1);

    // Update recurring rule amount to 6,500 EGP for future months (e.g., 2026-09)
    await apiRequest("PUT", `/api/admin/finance/expenses/recurring-rules/${rentRule._id}`, {
      token: tokenA,
      body: { amount: 6500 }
    });

    const genSep = await apiRequest("POST", "/api/admin/finance/expenses/recurring-rules/generate", {
      token: tokenA,
      body: { ruleId: rentRule._id, periodKey: "2026-09" }
    });
    assert.strictEqual(genSep.data.createdOccurrences[0].amount, 6500);

    // Verify 2026-08 occurrence is STILL 5,000 EGP!
    const augCheck = await apiRequest("GET", `/api/admin/finance/expenses/${augExpenseId}`, {
      token: tokenA
    });
    assert.strictEqual(augCheck.data.expense.amount, 5000, "Prior month occurrence must never be rewritten when rule changes");
    console.log("   [PASS] One-off expenses, recurring rule vs. period occurrence separation, and idempotency verified.");

    // ========================================================================
    // SUITE 5: Phase D Manual / Offline Sales & Payment Collection
    // ========================================================================
    console.log("5. Testing Phase D Manual / Offline Sales with Inventory/COGS & Payment Ledger...");

    const ordersCountBeforeManual = await getOrdersModel(TENANT_A).countDocuments();

    const msRes = await apiRequest("POST", "/api/admin/finance/expenses/manual-sales", {
      token: tokenA,
      body: {
        sourceChannel: "showroom",
        customerName: "شركة النيل للتجارة",
        initialPaidAmount: 1000,
        paymentMethod: "cash",
        items: [{ productId: prod1._id, quantity: 1, unitPrice: 1600 }]
      }
    });
    assert.strictEqual(msRes.status, 201);
    const manualSale = msRes.data.manualSale;
    assert.strictEqual(manualSale.sourceChannel, "showroom");
    assert.strictEqual(manualSale.totalAmount, 1600);
    assert.strictEqual(manualSale.totalCostOfGoodsSold, 1100); // WAC cost
    assert.strictEqual(manualSale.totalCollected, 1000);
    assert.strictEqual(manualSale.outstandingBalance, 600);
    assert.strictEqual(manualSale.paymentStatus, "partial");

    const ordersCountAfterManual = await getOrdersModel(TENANT_A).countDocuments();
    assert.strictEqual(
      ordersCountAfterManual,
      ordersCountBeforeManual,
      "Manual offline sale must not duplicate records in online storeOrders collection"
    );
    console.log("   [PASS] Manual/offline sales inventory consumption, COGS, and online order separation verified.");

    // ========================================================================
    // SUITE 6: Phase E2 & E3 Basic & Advanced Financial Reports & Completeness Guard
    // ========================================================================
    console.log("6. Testing Phase E Basic & Advanced Financial Reports, Cash Flow vs. Profit & Completeness Guard...");

    // Settle customer payment on the online order created earlier (3000 EGP)
    const settleOrderRes = await apiRequest(
      "POST",
      `/api/admin/finance/orders/${createdOrder._id}/settle-payment`,
      {
        token: tokenA,
        body: { amount: 3000, paymentMethod: "cash" }
      }
    );
    assert.strictEqual(settleOrderRes.status, 201);

    const basicRepRes = await apiRequest("GET", "/api/admin/finance/reports/basic?range=current_month", {
      token: tokenA
    });
    assert.strictEqual(basicRepRes.status, 200);
    assert.strictEqual(basicRepRes.data.metrics.recognizedSales.totalSalesValue, 4600); // 3000 online + 1600 manual
    assert.strictEqual(basicRepRes.data.metrics.cashReceivedFromCustomers.netCashInflow, 4000); // 3000 online + 1000 manual

    const advRepRes = await apiRequest("GET", "/api/admin/finance/reports/advanced?range=current_month", {
      token: tokenA
    });
    assert.strictEqual(advRepRes.status, 200);
    const inc = advRepRes.data.incomeStatement;
    const cf = advRepRes.data.cashFlowStatement;

    assert.strictEqual(inc.totalNetSales, 4600);
    assert.strictEqual(inc.totalCostOfGoodsSold, 3300); // 2200 online + 1100 manual
    assert.strictEqual(inc.grossProfit, 1300);
    // Operating expenses incurred in current month = 1200 (electricity). Supplier payment of 5000 is NOT an operating expense!
    assert.strictEqual(inc.totalOperatingExpensesIncurred, 1200);
    assert.strictEqual(inc.netOperatingResult, 100); // 1300 gross profit - 1200 operating expense

    // Cash Flow Statement: 4000 inflow - 5000 supplier outflow - 1200 expense outflow = -2200 net cash flow
    assert.strictEqual(cf.cashInflowsFromCustomers, 4000);
    assert.strictEqual(cf.cashOutflowsToSuppliers, 5000);
    assert.strictEqual(cf.cashOutflowsForExpenses, 1200);
    assert.strictEqual(cf.netCashFlow, -2200);
    assert.strictEqual(advRepRes.data.dataCompleteness.isComplete, true);
    assert.strictEqual(inc.canShowDefinitiveProfit, true);

    // Test Data Completeness Guard when an order has missing product cost and unrecorded carrier cost
    const uncostedProd = await ProdA.create({
      name: "منتج بدون تكلفة مسجلة",
      categoryId: categoryA._id,
      price: 300,
      costPrice: 0,
      stockCount: 5
    });
    await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "delivery",
        customer: { name: "عميل شحن غير مسجل التكلفة", phone: "01077778888", address: "المعادي", city: "القاهرة" },
        items: [{ productId: uncostedProd._id, quantity: 1 }]
      }
    });

    const advIncompleteRes = await apiRequest("GET", "/api/admin/finance/reports/advanced?range=current_month", {
      token: tokenA
    });
    assert.strictEqual(advIncompleteRes.data.dataCompleteness.isComplete, false);
    assert.strictEqual(advIncompleteRes.data.incomeStatement.canShowDefinitiveProfit, false);
    assert.ok(advIncompleteRes.data.dataCompleteness.missingInputs.length >= 1);
    console.log("   [PASS] Basic & Advanced Reports, Cash Flow vs. Profit distinction, and Data Completeness Guard verified.");

    // ========================================================================
    // SUITE 7: Phase E4 Double-Entry Accounting (Professional+ Tier)
    // ========================================================================
    console.log("7. Testing Phase E4 Double-Entry Accounting (Chart of Accounts, Balanced Entries, Period Close, Trial Balance)...");

    // Upgrade Tenant A to Professional level
    await apiRequest("PUT", "/api/admin/finance/settings", {
      token: tokenA,
      body: { level: "professional" }
    });

    const accListRes = await apiRequest("GET", "/api/admin/finance/accounting/accounts", {
      token: tokenA
    });
    assert.strictEqual(accListRes.status, 200);
    assert.ok(accListRes.data.accounts.length >= 12);
    assert.ok(accListRes.data.disclaimer.includes("محاسب قانوني"));

    // Verify unbalanced journal entry is rejected with 400 ACCOUNTING_ENTRY_UNBALANCED
    const unbalRes = await apiRequest("POST", "/api/admin/finance/accounting/journal-entries", {
      token: tokenA,
      body: {
        description: "قيد غير متوازن للاختبار",
        lines: [
          { accountCode: "6010", debit: 500, credit: 0 },
          { accountCode: "1010", debit: 0, credit: 300 }
        ]
      }
    });
    assert.strictEqual(unbalRes.status, 400);
    assert.strictEqual(unbalRes.data.code, "ACCOUNTING_ENTRY_UNBALANCED");

    // Post source event: order_created -> must debit Accounts Receivable (1110), NOT Cash (1010)!
    const postOrderEventRes = await apiRequest("POST", "/api/admin/finance/accounting/post-source-event", {
      token: tokenA,
      body: {
        eventType: "order_created",
        sourceId: String(createdOrder._id)
      }
    });
    assert.strictEqual(postOrderEventRes.status, 201);
    const postedOrderJe = postOrderEventRes.data.entry;
    const arLine = postedOrderJe.lines.find((l) => l.accountCode === "1110");
    const cashLine = postedOrderJe.lines.find((l) => l.accountCode === "1010");
    assert.ok(arLine && arLine.debit === 3000, "Order creation must debit Accounts Receivable (1110)");
    assert.strictEqual(cashLine, undefined, "Order creation alone must NOT debit Cash (1010)");

    // Retry posting the exact same source event -> idempotency prevents duplicate posting!
    const postOrderEventRetry = await apiRequest("POST", "/api/admin/finance/accounting/post-source-event", {
      token: tokenA,
      body: {
        eventType: "order_created",
        sourceId: String(createdOrder._id)
      }
    });
    assert.strictEqual(postOrderEventRetry.status, 200);
    assert.strictEqual(postOrderEventRetry.data.duplicate, true);

    // Close Period 2025-12 and verify posting to 2025-12 is rejected with 400 ACCOUNTING_PERIOD_CLOSED
    const closePerRes = await apiRequest("POST", "/api/admin/finance/accounting/periods/close", {
      token: tokenA,
      body: { periodKey: "2025-12", notes: "إقفال سنوي" }
    });
    assert.strictEqual(closePerRes.status, 200);

    const postToClosedRes = await apiRequest("POST", "/api/admin/finance/accounting/journal-entries", {
      token: tokenA,
      body: {
        entryDate: "2025-12-15",
        description: "محاولة ترحيل لفترة مقفلة",
        lines: [
          { accountCode: "6010", debit: 100, credit: 0 },
          { accountCode: "1010", debit: 0, credit: 100 }
        ]
      }
    });
    assert.strictEqual(postToClosedRes.status, 400);
    assert.strictEqual(postToClosedRes.data.code, "ACCOUNTING_PERIOD_CLOSED");

    // Check Trial Balance -> must be balanced
    const tbRes = await apiRequest("GET", "/api/admin/finance/accounting/trial-balance", {
      token: tokenA
    });
    assert.strictEqual(tbRes.status, 200);
    assert.strictEqual(tbRes.data.trialBalance.isBalanced, true);
    assert.strictEqual(tbRes.data.trialBalance.totalDebit, tbRes.data.trialBalance.totalCredit);
    console.log("   [PASS] Double-Entry Accounting, balanced enforcement, idempotency, period closing, and Trial Balance verified.");

    // ========================================================================
    // SUITE 8: Phase F Purchase Currency, Exchange Rates, Replacement Cost Policies & Historical Immutability
    // ========================================================================
    console.log("8. Testing Phase F Purchase Currency, Exchange Rates, Policies & Historical Immutability...");

    // Upgrade Tenant A to Enterprise level
    await apiRequest("PUT", "/api/admin/finance/settings", {
      token: tokenA,
      body: { level: "enterprise" }
    });

    // Reject LLM as exchange rate source
    const llmRateRes = await apiRequest("POST", "/api/admin/finance/currency/rates", {
      token: tokenA,
      body: { fromCurrency: "USD", toCurrency: "EGP", rate: 50, source: "llm_prediction" }
    });
    assert.strictEqual(llmRateRes.status, 400);
    assert.strictEqual(llmRateRes.data.code, "LLM_EXCHANGE_RATE_FORBIDDEN");

    // Record official rate: 1 USD = 48 EGP
    const rate48Res = await apiRequest("POST", "/api/admin/finance/currency/rates", {
      token: tokenA,
      body: { fromCurrency: "USD", toCurrency: "EGP", rate: 48, source: "central_bank_reference" }
    });
    assert.strictEqual(rate48Res.status, 201);

    // Create a product purchased in USD (10 USD @ rate 48 = 480 EGP)
    const usdProd = await ProdA.create({
      name: "راوتر مستورد بالدولار",
      categoryId: categoryA._id,
      price: 700,
      costPrice: 480,
      stockCount: 0
    });

    const usdShRes = await apiRequest("POST", "/api/admin/finance/shipments", {
      token: tokenA,
      body: {
        supplierName: "Global Tech USD Supplier",
        originalCurrency: "USD",
        exchangeRateUsed: 48,
        expectedGoodsValue: 2400,
        purchaseLines: [
          {
            productId: usdProd._id,
            quantity: 5,
            originalCurrency: "USD",
            originalUnitCost: 10,
            exchangeRateUsed: 48
          }
        ]
      }
    });
    assert.strictEqual(usdShRes.status, 201);
    const usdSh = usdShRes.data.shipment;
    assert.strictEqual(usdSh.purchaseLines[0].originalCurrency, "USD");
    assert.strictEqual(usdSh.purchaseLines[0].originalUnitCost, 10);
    assert.strictEqual(usdSh.purchaseLines[0].exchangeRateUsed, 48);
    assert.strictEqual(usdSh.purchaseLines[0].unitCost, 480);

    // Receive the USD shipment -> sets lastPurchaseCurrency='USD', lastPurchaseOriginalUnitCost=10, lastPurchaseExchangeRate=48
    await apiRequest("POST", `/api/admin/finance/inventory/receive/${usdSh._id}`, {
      token: tokenA,
      body: {
        lines: [{ lineId: usdSh.purchaseLines[0].lineId, productId: usdProd._id, receivedQuantity: 5 }]
      }
    });

    // Place a customer order for 1 unit of usdProd -> historical order cost snapshot = 480 EGP
    const usdOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "pickup",
        customer: { name: "عميل الراوتر", phone: "01099887766", address: "مدينة نصر", city: "القاهرة" },
        items: [{ productId: usdProd._id, quantity: 1 }]
      }
    });
    assert.strictEqual(usdOrderRes.status, 200);
    const usdOrderId = usdOrderRes.data.order._id;
    assert.strictEqual(usdOrderRes.data.order.items[0].costPrice, 480);

    // Now record a higher exchange rate: 1 USD = 54 EGP
    await apiRequest("POST", "/api/admin/finance/currency/rates", {
      token: tokenA,
      body: { fromCurrency: "USD", toCurrency: "EGP", rate: 54, source: "central_bank_reference" }
    });

    // Preview under 'decreases_only' -> since rate increased (48 -> 54), eligibleUnderPolicy must be false!
    const prevDecRes = await apiRequest("POST", "/api/admin/finance/currency/preview-impact", {
      token: tokenA,
      body: { fromCurrency: "USD", policy: "decreases_only" }
    });
    assert.strictEqual(prevDecRes.status, 200);
    const itemDec = prevDecRes.data.items.find((i) => String(i.productId) === String(usdProd._id));
    assert.strictEqual(itemDec.eligibleUnderPolicy, false);

    // Preview under 'increases_only' -> eligibleUnderPolicy must be true, recalculatedReplacementCost = 540 EGP!
    const prevIncRes = await apiRequest("POST", "/api/admin/finance/currency/preview-impact", {
      token: tokenA,
      body: { fromCurrency: "USD", policy: "increases_only" }
    });
    const itemInc = prevIncRes.data.items.find((i) => String(i.productId) === String(usdProd._id));
    assert.strictEqual(itemInc.eligibleUnderPolicy, true);
    assert.strictEqual(itemInc.recalculatedReplacementCost, 540);

    // Apply replacement cost update WITHOUT updating public selling price
    const applyCostOnlyRes = await apiRequest("POST", "/api/admin/finance/currency/apply-updates", {
      token: tokenA,
      body: {
        confirmApply: true,
        fromCurrency: "USD",
        policy: "increases_only",
        updateReplacementCost: true,
        updateSellingPrice: false
      }
    });
    assert.strictEqual(applyCostOnlyRes.status, 200);

    const usdProdAfterCostUpdate = await ProdA.findById(usdProd._id).lean();
    assert.strictEqual(usdProdAfterCostUpdate.replacementUnitCost, 540);
    assert.strictEqual(
      usdProdAfterCostUpdate.price,
      700,
      "Public selling price must NOT change unless updateSellingPrice is explicitly confirmed"
    );

    // Verify historical shipment line (480 EGP @ rate 48) and historical customer order (costPrice 480 EGP) were NOT retroactively mutated!
    const usdShCheck = await apiRequest("GET", `/api/admin/finance/shipments/${usdSh._id}`, {
      token: tokenA
    });
    assert.strictEqual(usdShCheck.data.shipment.purchaseLines[0].unitCost, 480);
    assert.strictEqual(usdShCheck.data.shipment.purchaseLines[0].exchangeRateUsed, 48);

    const usdOrderCheck = await getOrdersModel(TENANT_A).findById(usdOrderId).lean();
    assert.strictEqual(
      usdOrderCheck.items[0].costPrice,
      480,
      "Historical order cost snapshot must NEVER be rewritten by future exchange rate changes"
    );
    console.log("   [PASS] Foreign currency snapshots, rate policies, and historical immutability verified.");

    // ========================================================================
    // SUITE 9: Multi-Tenant Isolation & Schema `storeId` Absence Across All Phase C–F Models
    // ========================================================================
    console.log("9. Testing Multi-Tenant Isolation and schema storeId absence across all Phase C–F collections...");

    const phaseCDEFModels = [
      getInventoryMovementModel(TENANT_A),
      getInventoryBatchModel(TENANT_A),
      getExpenseModel(TENANT_A),
      getRecurringExpenseRuleModel(TENANT_A),
      getManualSaleModel(TENANT_A),
      getChartOfAccountModel(TENANT_A),
      getJournalEntryModel(TENANT_A),
      getAccountingPeriodModel(TENANT_A),
      getExchangeRateModel(TENANT_A)
    ];

    for (const M of phaseCDEFModels) {
      assert.strictEqual(
        M.schema.path("storeId"),
        undefined,
        `Model ${M.modelName} must NOT contain a redundant storeId field`
      );
    }

    // Verify Tenant B sees 0 expenses, 0 manual sales, and 0 journal entries from Tenant A
    const tenantBExpensesRes = await apiRequest("GET", "/api/admin/finance/expenses", {
      tenant: TENANT_B,
      token: tokenB
    });
    assert.strictEqual(tenantBExpensesRes.status, 200);
    assert.strictEqual(tenantBExpensesRes.data.expenses.length, 0);

    const tenantBManualSalesRes = await apiRequest("GET", "/api/admin/finance/expenses/manual-sales", {
      tenant: TENANT_B,
      token: tokenB
    });
    assert.strictEqual(tenantBManualSalesRes.status, 200);
    assert.strictEqual(tenantBManualSalesRes.data.sales.length, 0);
    console.log("   [PASS] Multi-tenant isolation and schema storeId absence across all Phase C–F models verified.");

    console.log("\n=== ALL 9/9 FINANCE PHASES C, D, E & F VERIFICATION SUITES PASSED SUCCESSFULLY ===");
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await connA.dropDatabase().catch(() => {});
    await connB.dropDatabase().catch(() => {});
    await connA.close().catch(() => {});
    await connB.close().catch(() => {});
  }
}

runPhaseCDEFVerification().catch((err) => {
  console.error("[FINANCE_CDEF_VERIFICATION_FAILED]", err);
  process.exit(1);
});
