/**
 * Phase 4 Verification Suite: Returns (مرتجع), Refunds (ريفند), Warranty & Paymob Engine
 */

const assert = require("assert");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const envJson = require("../env.json");
const serverModule = require("../server");

const { getMongooseConnection } = require("../core/database");
const getReturnRequestModel = require("../modules/returns/returnModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");
const { paymobService } = require("../modules/paymob");
const returnsService = require("../modules/returns/returnsService");

const TEST_TENANT = "phase4_test_returns";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runReturnsSuite() {
  console.log("\n=== Starting Phase 4 Returns, Warranty & Paymob Engine Verification Suite ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const tenantUri = buildTenantDbUri(baseUri, TEST_TENANT);
  const conn = await mongoose.createConnection(tenantUri).asPromise();
  serverModule.setMongooseConnection(TEST_TENANT, conn);

  const ReturnRequest = getReturnRequestModel(TEST_TENANT);
  const Orders = getOrdersModel(TEST_TENANT);
  const Products = getProductsModel(TEST_TENANT);
  const Categories = getCategoriesModel(TEST_TENANT);

  try {
    // -------------------------------------------------------------
    // 1. Testing Product Warranty Schema & Evaluation
    // -------------------------------------------------------------
    console.log("1. Testing Product Warranty & Order Snapshotting...");

    const category = await new Categories({
      name: "إلكترونيات واجهزة",
      tags: ["أجهزة", "ضمان معتمد", "قطع غيار"]
    }).save();

    const productWithWarranty = await new Products({
      categoryId: category._id,
      name: "شاشة ذكية 55 بوصة 4K",
      price: 15000,
      costPrice: 11000,
      stockCount: 10,
      warrantyPeriodMonths: 24, // 2 years warranty
      warrantyPolicy: "ضمان محلي شامل العيوب المصنعية"
    }).save();

    assert.strictEqual(productWithWarranty.warrantyPeriodMonths, 24);
    assert.strictEqual(productWithWarranty.warrantyPolicy, "ضمان محلي شامل العيوب المصنعية");

    // Evaluate warranty on item delivered today
    const recentDelivery = new Date();
    const warrantyEvalActive = returnsService.evaluateItemWarranty(
      { warrantyPeriodMonths: 24 },
      recentDelivery
    );
    assert.strictEqual(warrantyEvalActive.status, "in_warranty");
    assert.strictEqual(warrantyEvalActive.isUnderWarranty, true);
    assert.strictEqual(warrantyEvalActive.monthsTotal, 24);

    // Evaluate warranty on item delivered 30 months ago (expired)
    const oldDelivery = new Date();
    oldDelivery.setMonth(oldDelivery.getMonth() - 30);
    const warrantyEvalExpired = returnsService.evaluateItemWarranty(
      { warrantyPeriodMonths: 24 },
      oldDelivery
    );
    assert.strictEqual(warrantyEvalExpired.status, "out_of_warranty");
    assert.strictEqual(warrantyEvalExpired.isUnderWarranty, false);

    console.log("   [PASS] Product warranty schema and active/expired evaluation verified.");

    // -------------------------------------------------------------
    // 2. Testing 15-Day Return Window Calculation
    // -------------------------------------------------------------
    console.log("2. Testing 15-Day Return Window Eligibility...");

    // Order 1: Delivered 5 days ago (Eligible)
    const orderDeliveredRecently = {
      status: "delivered",
      pickupCompletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      timeline: []
    };
    const elig1 = returnsService.evaluateReturnEligibility(orderDeliveredRecently);
    assert.strictEqual(elig1.eligible, true, "Order delivered 5 days ago must be return eligible");
    assert.strictEqual(elig1.daysElapsed, 5);
    assert.strictEqual(elig1.daysRemaining, 10);

    // Order 2: Delivered 18 days ago (Expired)
    const orderDeliveredOld = {
      status: "delivered",
      pickupCompletedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      timeline: []
    };
    const elig2 = returnsService.evaluateReturnEligibility(orderDeliveredOld);
    assert.strictEqual(elig2.eligible, false, "Order delivered 18 days ago must NOT be return eligible");
    assert.strictEqual(elig2.daysElapsed, 18);
    assert.strictEqual(elig2.daysRemaining, 0);

    // Order 3: Not delivered yet (shipped)
    const orderShipped = {
      status: "shipped",
      timeline: []
    };
    const elig3 = returnsService.evaluateReturnEligibility(orderShipped);
    assert.strictEqual(elig3.eligible, false, "Undelivered order must NOT be return eligible");

    console.log("   [PASS] 15-day return window and delivery status constraints verified.");

    // -------------------------------------------------------------
    // 3. Testing Return Request & Maintenance Request Creation
    // -------------------------------------------------------------
    console.log("3. Testing Return & Maintenance Request Lifecycle Creation...");

    const testOrder = await new Orders({
      orderId: "ORD-TEST-RET-01",
      customer: {
        name: "عميل تجريبي",
        phone: "01099887766",
        address: "القاهرة الجديدة",
        city: "القاهرة"
      },
      status: "delivered",
      pickupCompletedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      items: [
        {
          productId: String(productWithWarranty._id),
          name: productWithWarranty.name,
          price: productWithWarranty.price,
          quantity: 2,
          warrantyPeriodMonths: 24
        }
      ],
      payment: {
        method: "card",
        paid: true,
        transactionId: "TXN_PAYMOB_MOCK_12345"
      },
      total: 30000
    }).save();

    // Create return request
    const retReq = await returnsService.createClientRequest(
      TEST_TENANT,
      { _id: new mongoose.Types.ObjectId(), name: "عميل تجريبي" },
      {
        orderId: testOrder.orderId,
        type: "return",
        items: [
          {
            productId: String(productWithWarranty._id),
            quantity: 1,
            reason: "عيب مصنعي في الشاشة"
          }
        ],
        reason: "عيب مصنعي في الشاشة",
        notes: "الشاشة بها وميض مستمر"
      }
    );

    assert(retReq.requestNumber.startsWith("RET-"), "Return request number must start with RET-");
    assert.strictEqual(retReq.status, "requested");
    assert.strictEqual(retReq.items.length, 1);
    assert.strictEqual(retReq.items[0].quantity, 1);
    assert.strictEqual(retReq.refund.amount, 15000);
    assert.strictEqual(retReq.timeline.length, 1);

    // Create maintenance request
    const mntReq = await returnsService.createClientRequest(
      TEST_TENANT,
      { _id: new mongoose.Types.ObjectId(), name: "عميل تجريبي" },
      {
        orderId: testOrder.orderId,
        type: "maintenance",
        items: [
          {
            productId: String(productWithWarranty._id),
            quantity: 1,
            reason: "صيانة دورية للمنفذ"
          }
        ],
        notes: "صيانة مقبس الطاقة"
      }
    );

    assert(mntReq.requestNumber.startsWith("MNT-"), "Maintenance request number must start with MNT-");
    assert.strictEqual(mntReq.type, "maintenance");
    assert.strictEqual(mntReq.warrantyStatus, "in_warranty");

    console.log("   [PASS] Return & maintenance requests created with proper snapshots.");

    // -------------------------------------------------------------
    // 4. Testing Courier Assignment & Stepper Timeline Progression
    // -------------------------------------------------------------
    console.log("4. Testing Courier Assignment & Stepper Timeline Progression...");

    const updatedWithCourier = await returnsService.updateRequestStatus(
      TEST_TENANT,
      retReq._id,
      {
        status: "courier_assigned",
        note: "تم تسليم بوليصة الشحن لشركة أرامكس",
        courier: {
          name: "كابتن محمود علي",
          phone: "01122334455",
          trackingReference: "ARX-RET-88192"
        }
      },
      { name: "مدير المتجر" }
    );

    assert.strictEqual(updatedWithCourier.status, "courier_assigned");
    assert.strictEqual(updatedWithCourier.courier.name, "كابتن محمود علي");
    assert.strictEqual(updatedWithCourier.courier.trackingReference, "ARX-RET-88192");
    assert(updatedWithCourier.timeline.length >= 2, "Timeline must record status transition");

    console.log("   [PASS] Courier assignment and journey timeline transitions verified.");

    // -------------------------------------------------------------
    // 5. Testing Unified Paymob Refund Engine & Inventory Restocking
    // -------------------------------------------------------------
    console.log("5. Testing Unified Paymob Refund Engine & Inventory Restocking...");

    // Test Paymob Refund Engine directly in mock mode
    const paymobRefundRes = await paymobService.processRefund(TEST_TENANT, {
      transactionId: "TXN_PAYMOB_MOCK_12345",
      amountCents: 15000 * 100,
      reason: "مرتجع شاشة"
    });

    assert.strictEqual(paymobRefundRes.success, true);
    assert(paymobRefundRes.refundId, "Paymob refund must issue a refund reference ID");

    // Verify initial product stock before restock
    const prodBeforeRefund = await Products.findById(productWithWarranty._id).lean();
    const stockBefore = prodBeforeRefund.stockCount; // 10

    // Process full return refund with inventory restocking
    const refundedReq = await returnsService.processRefund(
      TEST_TENANT,
      retReq._id,
      {
        refundMethod: "paymob_online",
        refundAmount: 15000,
        restockInventory: true,
        adminNote: "تمت الموافقة وفحص الشاشة وإعادة إدراجها بالمخزون"
      },
      { name: "المشرف المالي" }
    );

    assert.strictEqual(refundedReq.status, "refunded");
    assert.strictEqual(refundedReq.refund.status, "processed");
    assert.strictEqual(refundedReq.refund.method, "paymob_online");
    assert.strictEqual(refundedReq.refund.restocked, true);

    // Verify stock incremented by returned quantity (+1)
    const prodAfterRefund = await Products.findById(productWithWarranty._id).lean();
    assert.strictEqual(
      prodAfterRefund.stockCount,
      stockBefore + 1,
      "Product stock must increment upon restock"
    );

    console.log("   [PASS] Paymob refund processing and inventory restock verified.");

    console.log("\n=== ALL 5/5 PHASE 4 RETURNS & WARRANTY TESTS PASSED SUCCESSFULLY ===");
  } finally {
    await conn.dropDatabase();
    await conn.close();
  }
}

if (require.main === module) {
  runReturnsSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n[TEST_FAILURE]:", err);
      process.exit(1);
    });
}

module.exports = { runReturnsSuite };
