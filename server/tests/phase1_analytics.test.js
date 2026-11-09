/**
 * Comprehensive verification test suite for Phase 1:
 * Activity Tracking, Store Analytics, Responsive Charts & AI Insights
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const assert = require("assert");
const mongoose = require("mongoose");
const envJson = require("../env.json");
const serverModule = require("../server");

const getActivityModel = require("../modules/activity/activityModel");
const getProductModel = require("../modules/products/productModel");
const getCategoryModel = require("../modules/categories/categoryModel");
const getOrderModel = require("../modules/orders/orderModel");
const getOfferModel = require("../modules/offers/offerModel");
const getCouponModel = require("../modules/coupons/couponModel");
const getUsersModel = require("../modules/auth/userModel");

const {
  recordActivity,
  recordOrderLifecycleEvents,
} = require("../modules/activity/activityService");
const {
  getStoreOverviewAnalytics,
  getTimeSeriesAnalytics,
  getFunnelAnalytics,
  getProductRankings,
  getProductAnalyticsDetail,
  getCustomerCancellationReport,
  METRIC_DEFINITIONS,
} = require("../modules/analytics/analyticsService");
const {
  generateStoreInsights,
} = require("../modules/analytics/aiInsightsService");
const { recordClientActivity, getProductDetails } = require("../modules/storefront/storefrontController");
const { updateOrderStatus } = require("../modules/orders/ordersController");

const TEST_TENANT_A = "phase1_test_tenant_a";
const TEST_TENANT_B = "phase1_test_tenant_b";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runTests() {
  console.log("=== Starting Phase 1 Verification Suite ===");
  let passed = 0;
  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";
  const connA = await mongoose.createConnection(buildTenantDbUri(baseUri, TEST_TENANT_A)).asPromise();
  const connB = await mongoose.createConnection(buildTenantDbUri(baseUri, TEST_TENANT_B)).asPromise();
  serverModule.setMongooseConnection(TEST_TENANT_A, connA);
  serverModule.setMongooseConnection(TEST_TENANT_B, connB);

  try {
    await connA.dropDatabase();
    await connB.dropDatabase();

    const ActivityA = getActivityModel(TEST_TENANT_A);
    const ProductA = getProductModel(TEST_TENANT_A);
    const CategoryA = getCategoryModel(TEST_TENANT_A);
    const OrderA = getOrderModel(TEST_TENANT_A);
    const OfferA = getOfferModel(TEST_TENANT_A);
    const CouponA = getCouponModel(TEST_TENANT_A);
    const UsersA = getUsersModel(TEST_TENANT_A);

    // -------------------------------------------------------------------------
    // TEST 1: Activity schema fields, supported event types, no storeId, no price_feedback on Product
    // -------------------------------------------------------------------------
    console.log("1. Testing Activity schema & Product schema constraints...");
    const schemaPaths = Object.keys(ActivityA.schema.paths);
    assert(!schemaPaths.includes("storeId"), "Activity schema MUST NOT include storeId");
    const requiredCoreFields = [
      "eventType",
      "productId",
      "userId",
      "visitorId",
      "sessionId",
      "cartId",
      "orderId",
      "quantity",
      "unitPrice",
      "offerId",
      "offerDiscountPercent",
      "couponApplied",
      "couponDiscountPercent",
      "occurredAt",
    ];
    for (const f of requiredCoreFields) {
      assert(schemaPaths.includes(f), `Activity schema missing core field: ${f}`);
    }

    const productSchemaPaths = Object.keys(ProductA.schema.paths);
    assert(
      !productSchemaPaths.includes("price_feedback"),
      "Product schema MUST NOT have a permanent price_feedback field"
    );

    // Verify invalid eventType fails validation
    let invalidEventRejected = false;
    try {
      await ActivityA.create({ eventType: "invalid_fake_event", occurredAt: new Date() });
    } catch (err) {
      invalidEventRejected = true;
    }
    assert(invalidEventRejected, "Invalid eventType must be rejected by schema enum validation");
    passed++;
    console.log("   [PASS] Schema validation & field constraints verified.");

    // -------------------------------------------------------------------------
    // TEST 2: Empty dataset & zero-denominator handling
    // -------------------------------------------------------------------------
    console.log("2. Testing empty dataset & zero-denominator handling...");
    const emptyOverview = await getStoreOverviewAnalytics(TEST_TENANT_A, {});
    assert.strictEqual(emptyOverview.current.activity.productViews, 0);
    assert.strictEqual(emptyOverview.current.conversions.viewToCartConversion, null);
    assert.strictEqual(emptyOverview.current.conversions.viewToPurchaseConversion, null);
    assert.strictEqual(emptyOverview.current.conversions.orderCompletionRate, null);
    assert.strictEqual(emptyOverview.current.conversions.cartAbandonmentRate, null);
    passed++;
    console.log("   [PASS] Empty dataset returns null rates safely without NaN/Infinity.");

    // -------------------------------------------------------------------------
    // TEST 3: Seed test catalog, offers, coupons, users, and test event recording + deduplication
    // -------------------------------------------------------------------------
    console.log("3. Testing event recording, price/discount snapshots, and retry deduplication...");
    const catElectronics = await CategoryA.create({ name: "إلكترونيات", icon: "cpu" });
    const catFashion = await CategoryA.create({ name: "أزياء", icon: "shirt" });

    const now = new Date();
    const activeOffer = await OfferA.create({
      title: "خصم 20%",
      discountPercentage: 20,
      startDate: new Date(now.getTime() - 86400000),
      endDate: new Date(now.getTime() + 86400000 * 5),
      active: true,
    });

    const prod1 = await ProductA.create({
      name: "سماعة لاسلكية احترافية",
      price: 800,
      oldPrice: 1000,
      costPrice: 600,
      categoryId: catElectronics._id,
      offerId: activeOffer._id,
      stockCount: 50,
      ratingAvg: 4.8,
      ratingCount: 12,
    });

    const prod2 = await ProductA.create({
      name: "ساعة ذكية رياضية",
      price: 500,
      costPrice: 300,
      categoryId: catFashion._id,
      stockCount: 30,
      ratingAvg: 4.2,
      ratingCount: 5,
    });

    await CouponA.create({
      code: "SAVE10",
      type: "discount",
      discount: 10,
      allowedUses: 100,
      usedCount: 0,
      expiration: new Date(now.getTime() + 86400000 * 5),
      active: true,
    });

    const customer1 = await UsersA.create({
      fullname: "أحمد محمد",
      email: "ahmed@example.com",
      phone: "0501112233",
      password: "hashedpassword",
      role: "user",
    });

    const customer2 = await UsersA.create({
      fullname: "سارة علي",
      email: "sara@example.com",
      phone: "0509998877",
      password: "hashedpassword",
      role: "user",
    });

    // Visitor 1 views prod1 via controller getProductDetails (also tests deduplication on rapid retry)
    const reqView1 = {
      subdomain: TEST_TENANT_A,
      params: { id: String(prod1._id) },
      query: {},
      headers: { "x-visitor-id": "vis_1", "x-session-id": "sess_1" },
      user: customer1,
    };
    const resView1 = createMockRes();
    await getProductDetails(reqView1, resView1, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(resView1.statusCode, 200);

    // Immediate retry within 10s window should be deduplicated and NOT double-increment product.visited
    const resView1Retry = createMockRes();
    await getProductDetails(reqView1, resView1Retry, (err) => {
      if (err) throw err;
    });
    const updatedProd1 = await ProductA.findById(prod1._id);
    assert.strictEqual(updatedProd1.visited, 1, "Rapid retry of product view must not double-increment product.visited");

    const viewEventsCount = await ActivityA.countDocuments({ eventType: "product_viewed", productId: prod1._id });
    assert.strictEqual(viewEventsCount, 1, "Rapid retry of product_viewed must be deduplicated in Activity collection");

    // Verify offer snapshot on prod1 (1000 with 20% offer -> unitPrice 800, offerDiscountPercent 20)
    const firstViewDoc = await ActivityA.findOne({ eventType: "product_viewed", productId: prod1._id }).lean();
    assert.strictEqual(firstViewDoc.unitPrice, 800, "unitPrice should snapshot offer-adjusted price (800)");
    assert.strictEqual(firstViewDoc.offerDiscountPercent, 20, "offerDiscountPercent should be 20");
    assert.strictEqual(String(firstViewDoc.offerId), String(activeOffer._id));

    // Visitor 2 views prod1 and prod2
    await recordActivity(TEST_TENANT_A, {
      eventType: "product_viewed",
      productId: prod1._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
      occurredAt: new Date(now.getTime() - 3600 * 1000 * 5),
    });
    await recordActivity(TEST_TENANT_A, {
      eventType: "product_viewed",
      productId: prod2._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
      occurredAt: new Date(now.getTime() - 3600 * 1000 * 5),
    });

    // Price feedback clicks: 2 distinct clicks from different/same user must BOTH be recorded (no dedup suppression)
    await recordActivity(TEST_TENANT_A, {
      eventType: "price_feedback",
      productId: prod1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
      userId: customer1._id,
    });
    await recordActivity(TEST_TENANT_A, {
      eventType: "price_feedback",
      productId: prod1._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
    });
    const pfCount = await ActivityA.countDocuments({ eventType: "price_feedback", productId: prod1._id });
    assert.strictEqual(pfCount, 2, "Each distinct price_feedback action must create a new Activity document");

    // Wishlist add & remove
    const wlTime = new Date(now.getTime() - 3600 * 1000 * 2);
    await recordActivity(TEST_TENANT_A, {
      eventType: "wishlist_added",
      productId: prod1._id,
      userId: customer1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
      occurredAt: wlTime,
    });
    await recordActivity(TEST_TENANT_A, {
      eventType: "wishlist_added",
      productId: prod2._id,
      userId: customer1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
      occurredAt: wlTime,
    });
    await recordActivity(TEST_TENANT_A, {
      eventType: "wishlist_removed",
      productId: prod2._id,
      userId: customer1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
    });

    // Cart additions & removals (Cart 1 converts to order, Cart 2 is >24h old and abandoned)
    await recordActivity(TEST_TENANT_A, {
      eventType: "add_to_cart",
      productId: prod1._id,
      userId: customer1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
      cartId: "cart_converted_1",
      quantity: 2,
      couponCode: "SAVE10",
    });

    // Abandoned cart activity 30 hours ago (exceeds 24h abandonment window, no linked order)
    const thirtyHoursAgo = new Date(now.getTime() - 30 * 3600 * 1000);
    await recordActivity(TEST_TENANT_A, {
      eventType: "add_to_cart",
      productId: prod2._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
      cartId: "cart_abandoned_2",
      quantity: 1,
      occurredAt: thirtyHoursAgo,
    });
    await recordActivity(TEST_TENANT_A, {
      eventType: "remove_from_cart",
      productId: prod2._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
      cartId: "cart_abandoned_2",
      quantity: 1,
      occurredAt: new Date(thirtyHoursAgo.getTime() + 60000),
    });

    // Checkout started for cart_converted_1
    await recordActivity(TEST_TENANT_A, {
      eventType: "checkout_started",
      productId: prod1._id,
      userId: customer1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
      cartId: "cart_converted_1",
      quantity: 2,
      couponCode: "SAVE10",
    });

    passed++;
    console.log("   [PASS] Activity events, offer/coupon snapshots, and deduplication verified.");

    // -------------------------------------------------------------------------
    // TEST 4: Security check — client activity endpoint rejects fake order lifecycle events
    // -------------------------------------------------------------------------
    console.log("4. Testing security boundary on POST /api/store-public/activity...");
    for (const forbiddenEvent of ["order_created", "order_completed", "order_cancelled", "product_returned"]) {
      const reqForbidden = {
        subdomain: TEST_TENANT_A,
        body: { eventType: forbiddenEvent, productId: String(prod1._id) },
        headers: {},
      };
      const resForbidden = createMockRes();
      await recordClientActivity(reqForbidden, resForbidden, (err) => {
        if (err) throw err;
      });
      assert.strictEqual(
        resForbidden.statusCode,
        400,
        `Client endpoint must reject ${forbiddenEvent} with HTTP 400`
      );
    }
    passed++;
    console.log("   [PASS] Client endpoint rejects fake order lifecycle events.");

    // -------------------------------------------------------------------------
    // TEST 5: Order lifecycle events & idempotency on status retries
    // -------------------------------------------------------------------------
    console.log("5. Testing Order creation, completion, cancellation, return & idempotency...");
    const order1 = await OrderA.create({
      orderId: "ORD-1001",
      customer: {
        name: "أحمد محمد",
        phone: "0501112233",
        email: "ahmed@example.com",
        address: "القاهرة، مدينة نصر",
      },
      items: [{ productId: String(prod1._id), name: prod1.name, price: 800, costPrice: 600, quantity: 2 }],
      subtotal: 1600,
      discount: 160,
      coupon: "SAVE10",
      shipping: 0,
      total: 1440,
      status: "new",
      userId: customer1._id,
      visitorId: "vis_1",
      sessionId: "sess_1",
      cartId: "cart_converted_1",
      timeline: [{ status: "new", timestamp: now, note: "Created" }],
    });

    await recordOrderLifecycleEvents(TEST_TENANT_A, {
      order: order1,
      eventType: "order_created",
    });

    // Transition order1 to delivered via updateOrderStatus controller
    const reqDeliver = {
      subdomain: TEST_TENANT_A,
      params: { id: String(order1._id) },
      body: { status: "delivered", note: "تم التسليم" },
      headers: { "x-visitor-id": "vis_1" },
    };
    const resDeliver1 = createMockRes();
    await updateOrderStatus(reqDeliver, resDeliver1, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(resDeliver1.statusCode, 200);

    // Retry delivering the exact same order1 (idempotency check)
    const resDeliver2 = createMockRes();
    await updateOrderStatus(reqDeliver, resDeliver2, (err) => {
      if (err) throw err;
    });
    const completedEvents = await ActivityA.countDocuments({
      orderId: order1._id,
      eventType: "order_completed",
    });
    assert.strictEqual(completedEvents, 1, "Repeated delivered status update must not duplicate order_completed activity");

    // Create Order 2 (cancelled by customer2)
    const order2 = await OrderA.create({
      orderId: "ORD-1002",
      customer: {
        name: "سارة علي",
        phone: "0509998877",
        email: "sara@example.com",
        address: "الإسكندرية، سموحة",
      },
      items: [{ productId: String(prod2._id), name: prod2.name, price: 500, costPrice: 300, quantity: 3 }],
      subtotal: 1500,
      discount: 0,
      shipping: 0,
      total: 1500,
      status: "new",
      userId: customer2._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
      timeline: [{ status: "new", timestamp: now, note: "Created" }],
    });
    await recordOrderLifecycleEvents(TEST_TENANT_A, { order: order2, eventType: "order_created" });

    const reqCancel = {
      subdomain: TEST_TENANT_A,
      params: { id: String(order2._id) },
      body: { status: "cancelled", note: "العميل ألغى الطلب" },
      headers: {},
    };
    await updateOrderStatus(reqCancel, createMockRes(), (err) => {
      if (err) throw err;
    });
    await updateOrderStatus(reqCancel, createMockRes(), (err) => {
      if (err) throw err;
    }); // retry
    const cancelEvents = await ActivityA.countDocuments({
      orderId: order2._id,
      eventType: "order_cancelled",
    });
    assert.strictEqual(cancelEvents, 1, "Repeated cancelled status update must not duplicate order_cancelled activity");

    // Create Order 3 (returned by customer2)
    const order3 = await OrderA.create({
      orderId: "ORD-1003",
      customer: {
        name: "سارة علي",
        phone: "0509998877",
        email: "sara@example.com",
        address: "الإسكندرية، سموحة",
      },
      items: [{ productId: String(prod2._id), name: prod2.name, price: 500, costPrice: 300, quantity: 1 }],
      subtotal: 500,
      discount: 0,
      shipping: 0,
      total: 500,
      status: "delivered",
      userId: customer2._id,
      visitorId: "vis_2",
      sessionId: "sess_2",
      timeline: [{ status: "delivered", timestamp: now, note: "Delivered" }],
    });
    await recordOrderLifecycleEvents(TEST_TENANT_A, { order: order3, eventType: "order_created" });
    await recordOrderLifecycleEvents(TEST_TENANT_A, { order: order3, eventType: "order_completed" });

    const reqReturn = {
      subdomain: TEST_TENANT_A,
      params: { id: String(order3._id) },
      body: { status: "returned", note: "إرجاع المنتج" },
      headers: {},
    };
    await updateOrderStatus(reqReturn, createMockRes(), (err) => {
      if (err) throw err;
    });
    const returnEvents = await ActivityA.countDocuments({
      orderId: order3._id,
      eventType: "product_returned",
    });
    assert.strictEqual(returnEvents, 1, "product_returned event must be recorded once");
    passed++;
    console.log("   [PASS] Order lifecycle events & idempotency verified.");

    // -------------------------------------------------------------------------
    // TEST 6: Tenant Isolation check (Tenant B must have 0 events and 0 orders)
    // -------------------------------------------------------------------------
    console.log("6. Testing tenant database isolation...");
    const overviewTenantB = await getStoreOverviewAnalytics(TEST_TENANT_B, {});
    assert.strictEqual(overviewTenantB.current.activity.productViews, 0, "Tenant B must not see Tenant A views");
    assert.strictEqual(overviewTenantB.current.orders.ordersCreated, 0, "Tenant B must not see Tenant A orders");
    passed++;
    console.log("   [PASS] Tenant database isolation verified.");

    // -------------------------------------------------------------------------
    // TEST 7: General Store Metrics, Conversions, Previous-Period Comparisons & Linked Cart Abandonment
    // -------------------------------------------------------------------------
    console.log("7. Testing general store metrics, conversion formulas, and cart abandonment...");
    const overviewA = await getStoreOverviewAnalytics(TEST_TENANT_A, {});
    assert.strictEqual(overviewA.current.activity.productViews, 3, "Total product views should be 3");
    assert.strictEqual(overviewA.current.activity.uniqueVisitors, 2, "Unique visitors should be 2 (vis_1, vis_2)");
    assert.strictEqual(overviewA.current.activity.wishlistAdded, 2);
    assert.strictEqual(overviewA.current.activity.wishlistRemoved, 1);
    assert.strictEqual(overviewA.current.activity.addToCartEvents, 2);
    assert.strictEqual(overviewA.current.activity.removeFromCartEvents, 1);
    assert.strictEqual(overviewA.current.activity.checkoutStartedEvents, 1);
    assert.strictEqual(overviewA.current.orders.ordersCreated, 3);
    assert.strictEqual(overviewA.current.orders.ordersCompleted, 1);
    assert.strictEqual(overviewA.current.orders.ordersCancelled, 1);
    assert.strictEqual(overviewA.current.orders.returnEventCount, 1);
    assert.strictEqual(overviewA.current.orders.returnedQuantity, 1);
    assert.strictEqual(overviewA.current.activity.priceFeedbackEvents, 2);

    // Check conversion rates
    assert.strictEqual(overviewA.current.conversions.viewToCartConversion, 100);
    assert.strictEqual(overviewA.current.conversions.wishlistToCartConversion, 50);
    assert.strictEqual(overviewA.current.conversions.evaluableCartsCount, 2);
    assert.strictEqual(overviewA.current.conversions.abandonedCartsCount, 1);
    assert.strictEqual(overviewA.current.conversions.cartAbandonmentRate, 50);

    // Check metric definitions exist for all conversion metrics
    assert(Object.keys(METRIC_DEFINITIONS).length >= 8, "METRIC_DEFINITIONS must document all rates");
    passed++;
    console.log("   [PASS] Store metrics, conversion rates, and linked 24h cart abandonment verified.");

    // -------------------------------------------------------------------------
    // TEST 8: All 16 Product Rankings, Category Filtering, and Unsupported Refund Metric
    // -------------------------------------------------------------------------
    console.log("8. Testing all 16 product ranking metrics & category filtering...");
    const all16Metrics = [
      "most_viewed",
      "most_wishlisted",
      "most_wishlist_removed",
      "most_cart_added",
      "most_cart_removed",
      "most_checkout_started",
      "most_orders_created",
      "most_completed_orders",
      "most_units_sold",
      "most_cancelled",
      "most_cancelled_qty",
      "most_returned",
      "highest_refunded",
      "most_price_feedback",
      "highest_rated",
      "highest_revenue",
      "highest_profit",
    ];

    for (const metric of all16Metrics) {
      const rankRes = await getProductRankings(TEST_TENANT_A, { metric, limit: 5, order: "desc" });
      if (metric === "highest_refunded") {
        assert.strictEqual(rankRes.supported, false, "highest_refunded must explicitly report supported: false");
      } else {
        assert.strictEqual(rankRes.supported, true, `${metric} should be supported`);
        assert(Array.isArray(rankRes.items), `${metric} must return items array`);
      }
    }

    // Verify most_viewed top item is prod1 (2 views vs 1 view)
    const mostViewed = await getProductRankings(TEST_TENANT_A, { metric: "most_viewed", limit: 5 });
    assert.strictEqual(String(mostViewed.items[0].productId), String(prod1._id));
    assert.strictEqual(mostViewed.items[0].primaryValue, 2);

    // Verify category filter works
    const fashionViewed = await getProductRankings(TEST_TENANT_A, {
      metric: "most_viewed",
      categoryId: String(catFashion._id),
    });
    assert.strictEqual(fashionViewed.items.length, 1);
    assert.strictEqual(String(fashionViewed.items[0].productId), String(prod2._id));
    passed++;
    console.log("   [PASS] All 16 product rankings and category filters verified.");

    // -------------------------------------------------------------------------
    // TEST 9: Product-Level Analytics Detail & Customer Cancellation Report
    // -------------------------------------------------------------------------
    console.log("9. Testing Product-Level Analytics & Customer Cancellation Report...");
    const prod1Detail = await getProductAnalyticsDetail(TEST_TENANT_A, String(prod1._id), {});
    assert.strictEqual(prod1Detail.product.name, prod1.name);
    assert.strictEqual(prod1Detail.current.activity.productViews, 2);
    assert.strictEqual(prod1Detail.current.activity.priceFeedbackEvents, 2);
    assert.strictEqual(prod1Detail.current.conversions.priceFeedbackRate, 100);

    const cancelReport = await getCustomerCancellationReport(TEST_TENANT_A, {});
    assert(cancelReport.customers.length >= 1, "Customer cancellation report should include customers with orders");
    const saraRow = cancelReport.customers.find((c) => c.phone === "0509998877");
    assert(saraRow, "Sara should appear in customer cancellation report");
    assert.strictEqual(saraRow.totalOrders, 2);
    assert.strictEqual(saraRow.cancelledOrders, 1);
    assert.strictEqual(saraRow.cancellationRate, 50);
    assert(cancelReport.disclaimer.includes("أداة مساعدة للمراجعة"), "Report must include non-punitive human review disclaimer");
    passed++;
    console.log("   [PASS] Product detail analytics & Customer cancellation report verified.");

    // -------------------------------------------------------------------------
    // TEST 10: Funnel, Time-Series, and AI Insights Orchestration
    // -------------------------------------------------------------------------
    console.log("10. Testing Funnel, Time-Series, and AI Insights Orchestration...");
    const funnel = await getFunnelAnalytics(TEST_TENANT_A, {});
    assert.strictEqual(funnel.stages.length, 5);
    assert(funnel.attributionDisclosure, "Funnel must include attribution disclosure");

    const ts = await getTimeSeriesAnalytics(TEST_TENANT_A, {});
    assert(Array.isArray(ts.series) && ts.series.length > 0, "Time series must return daily buckets");

    const insightsPayload = await generateStoreInsights(TEST_TENANT_A, {});
    assert(Array.isArray(insightsPayload.insights), "AI insights must return structured insights array");
    assert(insightsPayload.insights.length > 0, "AI insights must produce at least one structured insight");
    const firstInsight = insightsPayload.insights[0];
    for (const requiredKey of [
      "title",
      "observation",
      "supportingMetrics",
      "possibleExplanations",
      "recommendedActions",
      "confidence",
      "limitations",
    ]) {
      assert(requiredKey in firstInsight, `Insight item missing required key: ${requiredKey}`);
    }
    passed++;
    console.log("   [PASS] Funnel, Time-Series, and AI Insights orchestration verified.");

    console.log(`\n=== ALL ${passed}/10 TEST SUITES PASSED SUCCESSFULLY ===`);
  } finally {
    await connA.dropDatabase();
    await connB.dropDatabase();
    await connA.close();
    await connB.close();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("TEST SUITE FAILED:", err);
  process.exit(1);
});
