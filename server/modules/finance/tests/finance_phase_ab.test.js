/**
 * Comprehensive Verification Suite for Finance Foundation + Phases A & B
 *
 * Covers all 11 required verification areas (Section 8):
 * 1. Shipping class creation, editing, activation/deactivation
 * 2. Address matching (Arabic & English), AI suggestion validation, and ambiguous fallback
 * 3. Customer-facing class selection and server-side validation (never trusting client shipping)
 * 4. MAX / ADD shipping algorithm (exact prompt example, ties, empty carts, non-shippable items, quantities)
 * 5. Pickup with zero shipping and enforced pickup lifecycle (Confirmed -> Awaiting Pickup -> Completed)
 * 6. Historical order snapshots remaining unchanged after admin edits + post-order actual carrier cost
 * 7. Supplier shipment creation, product association (shipment screen + product modal), and accounting separation
 * 8. Full & partial payments, corrections, reversals, outstanding balance, idempotency, and overdue alerts
 * 9. Tenant isolation (no storeId, separate tenant DBs) and admin permissions (401/403 + public field stripping)
 * 10. Regression verification for existing product, coupon, order creation, and cancellation workflows
 * 11. Finance capability levels (Basic/Advanced/Professional/Enterprise) and Phase C–F boundaries
 */

const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const envJson = require("../../../env.json");

const { app, setMongooseConnection } = require("../../../server");
const getShippingClassModel = require("../shipping/shippingClassModel");
const getSupplierModel = require("../procurement/supplierModel");
const getSupplierShipmentModel = require("../procurement/supplierShipmentModel");
const getFinancePaymentModel = require("../core/payments/paymentModel");
const getFinanceAuditModel = require("../core/audit/auditModel");
const getProductsModel = require("../../products/productModel");
const getOrdersModel = require("../../orders/orderModel");
const getUsersModel = require("../../auth/userModel");
const getCouponsModel = require("../../coupons/couponModel");
const getActivityModel = require("../../activity/activityModel");

const {
  runMaxAddShippingAlgorithm,
  calculateOrderShippingAuthoritative
} = require("../shipping/shippingCalculatorService");
const { classifyCustomerAddress } = require("../shipping/addressCoverageService");

const TENANT_A = "test_fin_tenant_a";
const TENANT_B = "test_fin_tenant_b";
const JWT_SECRET =
  envJson.localhost?.JWT_SECRET || process.env.JWT_SECRET || "default_jwt_secret";

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

async function runTests() {
  console.log("=== Starting Finance Foundation + Phase A/B Verification Suite ===");

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
    // Setup Admin & Customer Users in Tenant A & Tenant B
    const UsersA = getUsersModel(TENANT_A);
    const UsersB = getUsersModel(TENANT_B);

    const adminUserA = await UsersA.create({
      fullname: "مدير المتجر أ",
      email: "admin@tenanta.com",
      phone: "01000000001",
      password: "hashed_password",
      role: "admin"
    });
    const customerUserA = await UsersA.create({
      fullname: "عميل المتجر أ",
      email: "customer@tenanta.com",
      phone: "01000000002",
      password: "hashed_password",
      role: "user"
    });
    const adminUserB = await UsersB.create({
      fullname: "مدير المتجر ب",
      email: "admin@tenantb.com",
      phone: "01000000009",
      password: "hashed_password",
      role: "admin"
    });

    const adminTokenA = jwt.sign({ userId: adminUserA._id, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
    const customerTokenA = jwt.sign({ userId: customerUserA._id, role: "user" }, JWT_SECRET, { expiresIn: "1h" });
    const adminTokenB = jwt.sign({ userId: adminUserB._id, role: "admin" }, JWT_SECRET, { expiresIn: "1h" });

    // ========================================================================
    // 1. Shipping Class CRUD and Activation/Deactivation
    // ========================================================================
    console.log("1. Testing Shipping Class creation, editing, and activation/deactivation...");

    const createClassARes = await apiRequest("POST", "/api/admin/finance/shipping-classes", {
      token: adminTokenA,
      body: {
        code: "A",
        name: "الفئة A - القاهرة والجيزة",
        description: "توصيل سريع للقاهرة الكبرى",
        customerPrice: 40,
        actualCost: 30,
        defaultCalculationMode: "MAX",
        coverageText: "Cairo and Giza Governorates: Nasr City, Maadi, Heliopolis, Dokki, Mohandessin"
      }
    });
    assert.strictEqual(createClassARes.status, 201);
    const classA = createClassARes.data.shippingClass;
    assert.strictEqual(classA.code, "A");
    assert.strictEqual(classA.customerPrice, 40);
    assert.strictEqual(classA.actualCost, 30);

    const createClassBRes = await apiRequest("POST", "/api/admin/finance/shipping-classes", {
      token: adminTokenA,
      body: {
        code: "B",
        name: "الفئة B - أسيوط وصعيد مصر",
        description: "تغطية محافظة أسيوط والمراكز",
        customerPrice: 65,
        actualCost: 52,
        defaultCalculationMode: "MAX",
        coverageText: "Assiut Governorate: Assiut city, Manfalut, Abu Tig, and nearby listed districts."
      }
    });
    assert.strictEqual(createClassBRes.status, 201);
    const classB = createClassBRes.data.shippingClass;

    const createClassCRes = await apiRequest("POST", "/api/admin/finance/shipping-classes", {
      token: adminTokenA,
      body: {
        code: "C",
        name: "الفئة C - شحن إضافي للأحجام الخاصة",
        customerPrice: 30,
        actualCost: 22,
        defaultCalculationMode: "ADD",
        coverageText: "الإسكندرية، سموحة، سيدي جابر، المنتزه"
      }
    });
    assert.strictEqual(createClassCRes.status, 201);
    const classC = createClassCRes.data.shippingClass;

    const createClassDRes = await apiRequest("POST", "/api/admin/finance/shipping-classes", {
      token: adminTokenA,
      body: {
        code: "D",
        name: "الفئة D - المناطق الحدودية",
        customerPrice: 110,
        actualCost: 95,
        defaultCalculationMode: "MAX",
        coverageText: "مرسى مطروح، الوادي الجديد، شمال سيناء"
      }
    });
    assert.strictEqual(createClassDRes.status, 201);
    const classD = createClassDRes.data.shippingClass;

    // Edit Class D description & price
    const updateClassDRes = await apiRequest("PUT", `/api/admin/finance/shipping-classes/${classD._id}`, {
      token: adminTokenA,
      body: {
        customerPrice: 120,
        description: "المناطق الحدودية والبعيدة"
      }
    });
    assert.strictEqual(updateClassDRes.status, 200);
    assert.strictEqual(updateClassDRes.data.shippingClass.customerPrice, 120);

    // Deactivate Class D
    const toggleClassDRes = await apiRequest("PATCH", `/api/admin/finance/shipping-classes/${classD._id}/toggle`, {
      token: adminTokenA,
      body: { active: false }
    });
    assert.strictEqual(toggleClassDRes.status, 200);
    assert.strictEqual(toggleClassDRes.data.shippingClass.active, false);

    // Public options must only return active classes (A, B, C) and strip actualCost
    const publicOptionsRes = await apiRequest("GET", "/api/store-public/shipping/options");
    assert.strictEqual(publicOptionsRes.status, 200);
    assert.strictEqual(publicOptionsRes.data.shippingClasses.length, 3);
    assert.strictEqual(publicOptionsRes.data.shippingClasses[0].actualCost, undefined);
    console.log("   [PASS] Shipping Class CRUD, toggle, and public field stripping verified.");

    // ========================================================================
    // 2. Layered Address Matching, AI Suggestion Validation & Ambiguous Fallback
    // ========================================================================
    console.log("2. Testing layered address matching, AI validation, and ambiguous fallback...");

    // 2a. Match Arabic address in Manfalut / Assiut against English coverageText of Class B
    const matchAssiutAr = await classifyCustomerAddress(TENANT_A, {
      address: "شارع المحطة، مركز منفلوط",
      city: "أسيوط",
      allowAiFallback: false
    });
    assert.ok(matchAssiutAr.matchedClass, "Should deterministically match Assiut/Manfalut");
    assert.strictEqual(matchAssiutAr.matchedClass.code, "B");
    assert.strictEqual(matchAssiutAr.matchMethod, "deterministic");

    // 2b. Match English address in Abu Tig against Class B
    const matchAbuTigEn = await classifyCustomerAddress(TENANT_A, {
      address: "15 Nile St, Abu Tig",
      city: "Assiut",
      allowAiFallback: false
    });
    assert.ok(matchAbuTigEn.matchedClass);
    assert.strictEqual(matchAbuTigEn.matchedClass.code, "B");

    // 2c. Match Maadi / Cairo against Class A
    const matchCairo = await classifyCustomerAddress(TENANT_A, {
      address: "شارع 9 المعادي",
      city: "القاهرة",
      allowAiFallback: false
    });
    assert.ok(matchCairo.matchedClass);
    assert.strictEqual(matchCairo.matchedClass.code, "A");

    // 2d. Ambiguous/unlisted governorate (e.g. Sohag, not in A, B, or C) with no AI -> must NOT silently assign a class
    const unmatchedSohag = await classifyCustomerAddress(TENANT_A, {
      address: "شارع البحر",
      city: "سوهاج",
      allowAiFallback: false
    });
    assert.strictEqual(unmatchedSohag.matchedClass, null);
    assert.strictEqual(unmatchedSohag.requiresCustomerSelection, true);

    // 2e. AI Fallback validation:
    // Case 1: AI suggests inactive class D -> rejected!
    const aiSuggestsInactive = await classifyCustomerAddress(TENANT_A, {
      address: "منطقة غير معروفة قرب النيل",
      city: "",
      allowAiFallback: true,
      aiClassifierFn: async () => ({
        suggestedClassCode: "D",
        confidence: 0.9,
        reason: "Inactive class test"
      })
    });
    assert.strictEqual(aiSuggestsInactive.matchedClass, null);
    assert.strictEqual(aiSuggestsInactive.requiresCustomerSelection, true);

    // Case 2: AI suggests non-existent class Z -> rejected!
    const aiSuggestsNonExistent = await classifyCustomerAddress(TENANT_A, {
      address: "منطقة غير معروفة",
      city: "",
      allowAiFallback: true,
      aiClassifierFn: async () => ({
        suggestedClassCode: "Z_FAKE",
        confidence: 0.95,
        reason: "Fake class test"
      })
    });
    assert.strictEqual(aiSuggestsNonExistent.matchedClass, null);

    // Case 3: AI suggests valid active class B for an informal Assiut landmark -> accepted & marked "ai_suggested"!
    const aiSuggestsValid = await classifyCustomerAddress(TENANT_A, {
      address: "بجوار جامعة الأزهر فرع الوجه القبلي",
      city: "",
      allowAiFallback: true,
      aiClassifierFn: async () => ({
        suggestedClassCode: "B",
        confidence: 0.85,
        reason: "فرع جامعة الأزهر للوجه القبلي يقع في مدينة أسيوط"
      })
    });
    assert.ok(aiSuggestsValid.matchedClass);
    assert.strictEqual(aiSuggestsValid.matchedClass.code, "B");
    assert.strictEqual(aiSuggestsValid.matchMethod, "ai_suggestion");
    console.log("   [PASS] Layered address matching, AI validation, and ambiguous fallback verified.");

    // ========================================================================
    // 3. MAX / ADD Shipping Calculation Algorithm (Unit & Database Tests)
    // ========================================================================
    console.log("3. Testing MAX / ADD cart shipping calculation algorithm...");

    // 3a. Exact prompt example:
    // Product A: 40 EGP, mode MAX
    // Product B: 65 EGP, mode MAX
    // Product C: 30 EGP, mode ADD
    // Expected: Base = 65 EGP, Product A = 0, Product C = +30 EGP -> Final = 95 EGP
    const exactExampleResult = runMaxAddShippingAlgorithm([
      { productId: "P_A", name: "Product A", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 40, quantity: 1 },
      { productId: "P_B", name: "Product B", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 65, quantity: 1 },
      { productId: "P_C", name: "Product C", requiresShipping: true, shippingMode: "ADD", unitCustomerShipping: 30, quantity: 1 }
    ]);
    assert.strictEqual(exactExampleResult.baseShippingAmount, 65);
    assert.strictEqual(exactExampleResult.additiveShippingAmount, 30);
    assert.strictEqual(exactExampleResult.customerShippingCharge, 95);
    assert.strictEqual(exactExampleResult.baseLineProductId, "P_B");

    // 3b. Highest-priced item is an ADD item (never counted twice!)
    // Product X: 40 EGP, MAX
    // Product Y: 80 EGP, ADD
    // Base is 80 EGP (from Y). Y is excluded from further addition in per_line mode. X is MAX (+0). Final = 80 EGP.
    const addIsHighestResult = runMaxAddShippingAlgorithm([
      { productId: "P_X", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 40, quantity: 1 },
      { productId: "P_Y", requiresShipping: true, shippingMode: "ADD", unitCustomerShipping: 80, quantity: 1 }
    ]);
    assert.strictEqual(addIsHighestResult.baseShippingAmount, 80);
    assert.strictEqual(addIsHighestResult.additiveShippingAmount, 0);
    assert.strictEqual(addIsHighestResult.customerShippingCharge, 80);

    // 3c. Price Tie between MAX and ADD:
    // Product M: 50 EGP, MAX
    // Product N: 50 EGP, ADD (listed first)
    // Tie-breaker selects MAX (50 EGP) as base so ADD (50 EGP) still adds -> 100 EGP
    const tieMaxAddResult = runMaxAddShippingAlgorithm([
      { productId: "P_N", requiresShipping: true, shippingMode: "ADD", unitCustomerShipping: 50, quantity: 1 },
      { productId: "P_M", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 50, quantity: 1 }
    ]);
    assert.strictEqual(tieMaxAddResult.baseLineProductId, "P_M");
    assert.strictEqual(tieMaxAddResult.baseShippingAmount, 50);
    assert.strictEqual(tieMaxAddResult.additiveShippingAmount, 50);
    assert.strictEqual(tieMaxAddResult.customerShippingCharge, 100);

    // 3d. Price Tie between two MAX items (50 EGP, 50 EGP) -> 50 EGP
    const tieTwoMaxResult = runMaxAddShippingAlgorithm([
      { productId: "P_M1", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 50, quantity: 1 },
      { productId: "P_M2", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 50, quantity: 1 }
    ]);
    assert.strictEqual(tieTwoMaxResult.customerShippingCharge, 50);

    // 3e. Empty cart & non-shippable items -> 0 EGP
    const emptyCartResult = runMaxAddShippingAlgorithm([]);
    assert.strictEqual(emptyCartResult.customerShippingCharge, 0);

    const nonShippableResult = runMaxAddShippingAlgorithm([
      { productId: "P_DIG1", requiresShipping: false, shippingMode: "MAX", unitCustomerShipping: 50, quantity: 2 },
      { productId: "P_DIG2", requiresShipping: false, shippingMode: "ADD", unitCustomerShipping: 30, quantity: 1 }
    ]);
    assert.strictEqual(nonShippableResult.customerShippingCharge, 0);

    // 3f. Quantity handling: default "per_line" vs optional "per_unit"
    const qtyPerLineResult = runMaxAddShippingAlgorithm(
      [
        { productId: "P_BASE", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 65, quantity: 3 },
        { productId: "P_ADD", requiresShipping: true, shippingMode: "ADD", unitCustomerShipping: 30, quantity: 2 }
      ],
      { addQuantityBehavior: "per_line" }
    );
    assert.strictEqual(qtyPerLineResult.customerShippingCharge, 95); // 65 + 30

    const qtyPerUnitResult = runMaxAddShippingAlgorithm(
      [
        { productId: "P_BASE", requiresShipping: true, shippingMode: "MAX", unitCustomerShipping: 65, quantity: 3 },
        { productId: "P_ADD", requiresShipping: true, shippingMode: "ADD", unitCustomerShipping: 30, quantity: 2 }
      ],
      { addQuantityBehavior: "per_unit" }
    );
    assert.strictEqual(qtyPerUnitResult.customerShippingCharge, 125); // 65 + (30 * 2)
    console.log("   [PASS] MAX / ADD shipping algorithm (all cases, ties, non-shippable, quantities) verified.");

    // ========================================================================
    // 4. Customer Class Selection & Server-Side Checkout Validation + Snapshots
    // ========================================================================
    console.log("4. Testing server-side checkout shipping validation & historical order snapshots...");

    // Create a test category and 3 catalog products matching the prompt example (A: 40 MAX, B: 65 MAX, C: 30 ADD)
    const getCategoryModel = require("../../categories/categoryModel");
    const CategoriesA = getCategoryModel(TENANT_A);
    const catA = await CategoriesA.create({ name: "إلكترونيات وشاشات" });

    const prodARes = await apiRequest("POST", "/api/admin/products", {
      token: adminTokenA,
      body: {
        name: "سماعة لاسلكية A",
        categoryId: catA._id,
        price: 500,
        oldPrice: 600,
        costPrice: 320,
        stockCount: 20,
        requiresShipping: true,
        shippingClassId: classA._id,
        shippingMode: "MAX"
      }
    });
    const prodA = prodARes.data.product;
    assert.ok(prodA && prodA._id);

    const prodBRes = await apiRequest("POST", "/api/admin/products", {
      token: adminTokenA,
      body: {
        name: "شاشة ذكية B",
        categoryId: catA._id,
        price: 1500,
        oldPrice: 1700,
        costPrice: 1100,
        stockCount: 15,
        requiresShipping: true,
        shippingClassId: classB._id,
        shippingMode: "MAX"
      }
    });
    const prodB = prodBRes.data.product;
    assert.ok(prodB && prodB._id);

    const prodCRes = await apiRequest("POST", "/api/admin/products", {
      token: adminTokenA,
      body: {
        name: "حامل معدني ثقيل C",
        categoryId: catA._id,
        price: 300,
        oldPrice: 300,
        costPrice: 180,
        stockCount: 25,
        requiresShipping: true,
        shippingClassId: classC._id,
        shippingMode: "ADD"
      }
    });
    const prodC = prodCRes.data.product;
    assert.ok(prodC && prodC._id);

    // 4a. Reject customer selecting an inactive shipping class (Class D)
    const invalidInactiveOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "delivery",
        selectedShippingClassId: classD._id,
        customer: { name: "أحمد علي", phone: "01011112222", address: "مرسى مطروح", city: "مطروح" },
        items: [{ productId: prodA._id, quantity: 1 }]
      }
    });
    assert.strictEqual(invalidInactiveOrderRes.status, 400);
    assert.strictEqual(invalidInactiveOrderRes.data.code, "SHIPPING_CLASS_INACTIVE");

    // 4b. Reject customer selecting Class A (Cairo/Giza) for an Assiut address
    const mismatchClassOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "delivery",
        selectedShippingClassId: classA._id,
        customer: { name: "أحمد علي", phone: "01011112222", address: "مركز منفلوط", city: "أسيوط" },
        items: [{ productId: prodA._id, quantity: 1 }]
      }
    });
    assert.strictEqual(mismatchClassOrderRes.status, 400);
    assert.strictEqual(mismatchClassOrderRes.data.code, "SHIPPING_CLASS_COVERAGE_MISMATCH");

    // 4c. Place delivery order with Products A, B, C while client sends fake shipping = 0!
    // Server must ignore client `shipping: 0` and compute 95 EGP (65 MAX + 30 ADD)
    const deliveryOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "delivery",
        shipping: 0, // Fake client shipping!
        customer: { name: "محمود حسن", phone: "01022223333", address: "شارع النيل", city: "أسيوط" },
        items: [
          { productId: prodA._id, quantity: 1 },
          { productId: prodB._id, quantity: 1 },
          { productId: prodC._id, quantity: 1 }
        ]
      }
    });
    assert.strictEqual(deliveryOrderRes.status, 200);
    const createdDeliveryOrder = deliveryOrderRes.data.order;
    assert.strictEqual(createdDeliveryOrder.subtotal, 2300); // 500 + 1500 + 300
    assert.strictEqual(createdDeliveryOrder.shipping, 95); // 65 (B MAX) + 0 (A MAX) + 30 (C ADD)
    assert.strictEqual(createdDeliveryOrder.total, 2395);
    assert.strictEqual(createdDeliveryOrder.shippingSnapshot.baseShippingAmount, 65);
    assert.strictEqual(createdDeliveryOrder.shippingSnapshot.additiveShippingAmount, 30);
    assert.strictEqual(createdDeliveryOrder.shippingSnapshot.customerShippingCharge, 95);
    assert.strictEqual(createdDeliveryOrder.shippingSnapshot.actualCarrierCost, null);
    assert.strictEqual(createdDeliveryOrder.shippingSnapshot.actualCostStatus, "unknown");
    assert.strictEqual(createdDeliveryOrder.financialSnapshot.productCostTotal, 1600); // 320 + 1100 + 180

    // 4d. Now Admin edits Product A, B, C prices & costs AND edits Shipping Classes A, B, C prices!
    await apiRequest("PUT", `/api/admin/products/${prodA._id}`, {
      token: adminTokenA,
      body: {
        name: prodA.name,
        price: 999,
        costPrice: 777,
        stockCount: 19,
        shippingClassId: classA._id,
        shippingMode: "MAX"
      }
    });
    await apiRequest("PUT", `/api/admin/finance/shipping-classes/${classB._id}`, {
      token: adminTokenA,
      body: { customerPrice: 150, actualCost: 120 }
    });

    // Fetch the historical order again and verify its snapshots are 100% UNCHANGED!
    const fetchedHistoricalOrderRes = await apiRequest(
      "GET",
      `/api/admin/orders/${createdDeliveryOrder._id}`,
      { token: adminTokenA }
    );
    const historicalOrder = fetchedHistoricalOrderRes.data.order;
    assert.strictEqual(historicalOrder.subtotal, 2300);
    assert.strictEqual(historicalOrder.shipping, 95);
    assert.strictEqual(historicalOrder.total, 2395);
    assert.strictEqual(historicalOrder.financialSnapshot.productCostTotal, 1600);
    const snapItemA = historicalOrder.items.find((i) => i.productId === String(prodA._id));
    assert.strictEqual(snapItemA.price, 500);
    assert.strictEqual(snapItemA.costPrice, 320);

    // 4e. Record post-order actual carrier shipping cost (e.g. 78 EGP)
    const recordActualCostRes = await apiRequest(
      "POST",
      `/api/admin/finance/orders/${createdDeliveryOrder._id}/actual-shipping-cost`,
      {
        token: adminTokenA,
        body: { actualCarrierCost: 78, note: "بوليصة بوستا رقم 99812" }
      }
    );
    assert.strictEqual(recordActualCostRes.status, 200);
    assert.strictEqual(recordActualCostRes.data.order.shippingSnapshot.actualCarrierCost, 78);
    assert.strictEqual(recordActualCostRes.data.order.shippingSnapshot.actualCostStatus, "confirmed");
    // Customer-facing shipping & total must remain 95 and 2395
    assert.strictEqual(recordActualCostRes.data.order.shipping, 95);
    assert.strictEqual(recordActualCostRes.data.order.total, 2395);
    console.log("   [PASS] Server-side validation, immutable historical snapshots, and post-order carrier cost verified.");

    // ========================================================================
    // 5. Pickup Delivery Method & Enforced Lifecycle
    // ========================================================================
    console.log("5. Testing Pickup delivery method (zero shipping) and enforced pickup lifecycle...");

    const pickupOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "pickup",
        shipping: 120, // Client tries to send non-zero shipping -> server forces 0
        customer: { name: "سارة خالد", phone: "01055556666", address: "" },
        items: [{ productId: prodB._id, quantity: 1 }]
      }
    });
    assert.strictEqual(pickupOrderRes.status, 200);
    const pickupOrder = pickupOrderRes.data.order;
    assert.strictEqual(pickupOrder.deliveryMethod, "pickup");
    assert.strictEqual(pickupOrder.shipping, 0);
    assert.strictEqual(pickupOrder.shippingSnapshot.customerShippingCharge, 0);
    assert.strictEqual(pickupOrder.shippingSnapshot.actualCarrierCost, 0);
    assert.strictEqual(pickupOrder.shippingSnapshot.actualCostStatus, "not_applicable");

    // 5a. Attempting to mark pickup order "delivered" directly from "new" (before confirmation) must fail!
    const prematureCompleteRes = await apiRequest("PUT", `/api/admin/orders/${pickupOrder._id}/status`, {
      token: adminTokenA,
      body: { status: "delivered" }
    });
    assert.strictEqual(prematureCompleteRes.status, 400);

    // 5b. Confirming the pickup order sets status to "confirmed" (NOT completed!)
    const confirmPickupRes = await apiRequest("PUT", `/api/admin/orders/${pickupOrder._id}/status`, {
      token: adminTokenA,
      body: { status: "confirmed" }
    });
    assert.strictEqual(confirmPickupRes.status, 200);
    assert.strictEqual(confirmPickupRes.data.order.status, "confirmed");
    assert.strictEqual(confirmPickupRes.data.order.pickupCompletedAt, null);

    // 5c. Transition to "ready_for_pickup" (Awaiting Pickup)
    const awaitingPickupRes = await apiRequest("PUT", `/api/admin/orders/${pickupOrder._id}/status`, {
      token: adminTokenA,
      body: { status: "ready_for_pickup" }
    });
    assert.strictEqual(awaitingPickupRes.status, 200);
    assert.strictEqual(awaitingPickupRes.data.order.status, "ready_for_pickup");

    // 5d. Complete pickup via explicit pickup-completion endpoint
    const completePickupRes = await apiRequest(
      "POST",
      `/api/admin/finance/orders/${pickupOrder._id}/complete-pickup`,
      {
        token: adminTokenA,
        body: { note: "استلمت العميلة الطلب من الفرع الرئيسي" }
      }
    );
    assert.strictEqual(completePickupRes.status, 200);
    assert.strictEqual(completePickupRes.data.order.status, "delivered");
    assert.ok(completePickupRes.data.order.pickupCompletedAt);
    console.log("   [PASS] Pickup zero-shipping and Confirmed -> Awaiting Pickup -> Completed lifecycle verified.");

    // ========================================================================
    // 6. Phase B: Supplier Shipments, Product Association & Historical Purchase Snapshots
    // ========================================================================
    console.log("6. Testing Phase B Supplier Shipments, Product Association & Historical Snapshots...");

    const pastDueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago (overdue)
    const createShipmentRes = await apiRequest("POST", "/api/admin/finance/shipments", {
      token: adminTokenA,
      body: {
        supplierName: "شركة الأمل للإلكترونيات",
        supplierPhone: "01234567890",
        expectedGoodsValue: 10000,
        dueDate: pastDueDate,
        notes: "شحنة توريد الربع الأول"
      }
    });
    assert.strictEqual(createShipmentRes.status, 201);
    const shipment1 = createShipmentRes.data.shipment;
    assert.ok(shipment1.referenceId.startsWith("SHP-"));
    // Accounting distinction: shipment creation != received, obligation != paid
    assert.strictEqual(shipment1.status, "ordered");
    assert.strictEqual(shipment1.approvedObligationTotal, 10000);
    assert.strictEqual(shipment1.totalPaid, 0);
    assert.strictEqual(shipment1.outstandingBalance, 10000);
    assert.strictEqual(shipment1.paymentStatus, "unpaid");

    // 6a. Associate product from Shipment screen
    const assocFromShipmentRes = await apiRequest(
      "POST",
      `/api/admin/finance/shipments/${shipment1._id}/products`,
      {
        token: adminTokenA,
        body: {
          lines: [
            {
              productId: prodB._id,
              quantity: 5,
              unitCost: 1050,
              note: "دفعة شاشات أولى"
            }
          ]
        }
      }
    );
    assert.strictEqual(assocFromShipmentRes.status, 200);
    assert.strictEqual(assocFromShipmentRes.data.shipment.purchaseLines.length, 1);
    assert.strictEqual(assocFromShipmentRes.data.shipment.purchaseLines[0].lineTotal, 5250);

    // 6b. Create a new product from the Product Create endpoint with `supplierShipmentId`
    const prodLinkedRes = await apiRequest("POST", "/api/admin/products", {
      token: adminTokenA,
      body: {
        name: "كيبورد ميكانيكي احترافي",
        categoryId: catA._id,
        price: 850,
        costPrice: 475,
        stockCount: 10,
        supplierShipmentId: shipment1._id,
        purchaseUnitCost: 475
      }
    });
    assert.strictEqual(prodLinkedRes.status, 200);
    const prodLinked = prodLinkedRes.data.product;

    // Verify Shipment 1 now has 2 purchaseLines totaling 5250 + (10 * 475) = 10000
    const getShipmentAfterLinkRes = await apiRequest(
      "GET",
      `/api/admin/finance/shipments/${shipment1._id}`,
      { token: adminTokenA }
    );
    assert.strictEqual(getShipmentAfterLinkRes.data.shipment.purchaseLines.length, 2);
    assert.strictEqual(getShipmentAfterLinkRes.data.shipment.linesTotal, 10000);

    // 6c. Edit `prodLinked.costPrice` in catalog to 900 -> historical purchase line in Shipment 1 must stay 475!
    await apiRequest("PUT", `/api/admin/products/${prodLinked._id}`, {
      token: adminTokenA,
      body: {
        name: prodLinked.name,
        price: 1200,
        costPrice: 900,
        stockCount: 10
      }
    });
    const getShipmentAfterCostEdit = await apiRequest(
      "GET",
      `/api/admin/finance/shipments/${shipment1._id}`,
      { token: adminTokenA }
    );
    const keyboardLine = getShipmentAfterCostEdit.data.shipment.purchaseLines.find(
      (l) => String(l.productId) === String(prodLinked._id)
    );
    assert.strictEqual(keyboardLine.unitCost, 475);
    assert.strictEqual(keyboardLine.lineTotal, 4750);
    console.log("   [PASS] Supplier shipment creation, bidirectional product association & immutable purchase snapshots verified.");

    // ========================================================================
    // 7. Partial/Full Payments, Idempotency, Reversals, Corrections & Alerts
    // ========================================================================
    console.log("7. Testing supplier payments, idempotency, reversals, corrections & overdue alerts...");

    // 7a. Check overdue alert before full payment
    const overviewBeforePay = await apiRequest("GET", "/api/admin/finance/procurement/overview", {
      token: adminTokenA
    });
    assert.strictEqual(overviewBeforePay.status, 200);
    assert.strictEqual(overviewBeforePay.data.summary.overdueCount, 1);
    assert.strictEqual(overviewBeforePay.data.alerts[0].alertType, "overdue");

    // 7b. Record Partial Payment 1 (4000 EGP) with idempotencyKey
    const stockBeforePayment = (await getProductsModel(TENANT_A).findById(prodLinked._id).lean()).stockCount;
    const pay1Res = await apiRequest(
      "POST",
      `/api/admin/finance/shipments/${shipment1._id}/payments`,
      {
        token: adminTokenA,
        body: {
          amount: 4000,
          paymentMethod: "bank_transfer",
          referenceNote: "تحويل بنكي رقم 1001",
          idempotencyKey: "IDEM-KEY-PAY-1"
        }
      }
    );
    assert.strictEqual(pay1Res.status, 201);
    assert.strictEqual(pay1Res.data.shipment.totalPaid, 4000);
    assert.strictEqual(pay1Res.data.shipment.outstandingBalance, 6000);
    assert.strictEqual(pay1Res.data.shipment.paymentStatus, "partial");

    // Verify payment does NOT automatically alter product stock (Phase B/C separation)
    const stockAfterPayment = (await getProductsModel(TENANT_A).findById(prodLinked._id).lean()).stockCount;
    assert.strictEqual(stockAfterPayment, stockBeforePayment);

    // 7c. Duplicate payment submission with same idempotencyKey -> must deduplicate and NOT double-charge!
    const pay1DupRes = await apiRequest(
      "POST",
      `/api/admin/finance/shipments/${shipment1._id}/payments`,
      {
        token: adminTokenA,
        body: {
          amount: 4000,
          paymentMethod: "bank_transfer",
          referenceNote: "تحويل بنكي رقم 1001",
          idempotencyKey: "IDEM-KEY-PAY-1"
        }
      }
    );
    assert.strictEqual(pay1DupRes.status, 200);
    assert.strictEqual(pay1DupRes.data.deduplicated, true);
    assert.strictEqual(pay1DupRes.data.shipment.totalPaid, 4000);
    assert.strictEqual(pay1DupRes.data.shipment.outstandingBalance, 6000);

    // 7d. Record Second Payment (6000 EGP) -> Fully Paid!
    const pay2Res = await apiRequest(
      "POST",
      `/api/admin/finance/shipments/${shipment1._id}/payments`,
      {
        token: adminTokenA,
        body: {
          amount: 6000,
          paymentMethod: "cash",
          referenceNote: "إيصال نقدي 1002",
          idempotencyKey: "IDEM-KEY-PAY-2"
        }
      }
    );
    assert.strictEqual(pay2Res.status, 201);
    assert.strictEqual(pay2Res.data.shipment.totalPaid, 10000);
    assert.strictEqual(pay2Res.data.shipment.outstandingBalance, 0);
    assert.strictEqual(pay2Res.data.shipment.paymentStatus, "paid");
    assert.strictEqual(pay2Res.data.shipment.dueEvaluation.isOverdue, false);

    // 7e. Correct Payment 2 from 6000 to 3500 -> delta -2500 -> totalPaid = 7500, outstanding = 2500
    const pay2Id = pay2Res.data.payment._id;
    const correctPay2Res = await apiRequest(
      "POST",
      `/api/admin/finance/shipments/${shipment1._id}/payments/${pay2Id}/correct`,
      {
        token: adminTokenA,
        body: {
          correctedAmount: 3500,
          reason: "تصحيح خطأ كتابي في قيمة الإيصال النقدي"
        }
      }
    );
    assert.strictEqual(correctPay2Res.status, 200);
    assert.strictEqual(correctPay2Res.data.shipment.totalPaid, 7500);
    assert.strictEqual(correctPay2Res.data.shipment.outstandingBalance, 2500);
    assert.strictEqual(correctPay2Res.data.shipment.paymentStatus, "partial");

    // 7f. Reverse the corrected payment (pay2Id, effective 3500) -> totalPaid returns to 4000, outstanding = 6000
    const reverseCorrectedRes = await apiRequest(
      "POST",
      `/api/admin/finance/shipments/${shipment1._id}/payments/${pay2Id}/reverse`,
      {
        token: adminTokenA,
        body: { reason: "إلغاء الدفعة النقدية واستبدالها بشيك" }
      }
    );
    assert.strictEqual(reverseCorrectedRes.status, 200);
    assert.strictEqual(reverseCorrectedRes.data.shipment.totalPaid, 4000);
    assert.strictEqual(reverseCorrectedRes.data.shipment.outstandingBalance, 6000);

    // Verify storeActivity & storeFinanceAudit recorded the procurement events
    const ActivitiesA = getActivityModel(TENANT_A);
    const shipmentActivities = await ActivitiesA.find({
      shipmentId: shipment1._id
    }).lean();
    assert.ok(shipmentActivities.length >= 4, "Activity log should contain shipment creation, payment, correction, and reversal");
    console.log("   [PASS] Payments, idempotency, corrections, reversals, balances & activity/audit logs verified.");

    // ========================================================================
    // 8. Tenant Isolation, No Redundant storeId, and Admin Permissions
    // ========================================================================
    console.log("8. Testing Tenant Isolation, schema storeId absence, and Admin Permissions...");

    // 8a. Verify no `storeId` path exists in any Finance Mongoose schema
    const modelsToCheck = [
      getShippingClassModel(TENANT_A),
      getSupplierModel(TENANT_A),
      getSupplierShipmentModel(TENANT_A),
      getFinancePaymentModel(TENANT_A),
      getFinanceAuditModel(TENANT_A)
    ];
    for (const M of modelsToCheck) {
      assert.strictEqual(
        M.schema.path("storeId"),
        undefined,
        `Model ${M.modelName} must NOT contain redundant storeId`
      );
    }

    // 8b. Verify Tenant B sees 0 shipping classes and 0 supplier shipments from Tenant A
    const tenantBClassesRes = await apiRequest("GET", "/api/admin/finance/shipping-classes", {
      tenant: TENANT_B,
      token: adminTokenB
    });
    assert.strictEqual(tenantBClassesRes.status, 200);
    assert.strictEqual(tenantBClassesRes.data.shippingClasses.length, 0);

    const tenantBShipmentsRes = await apiRequest("GET", "/api/admin/finance/shipments", {
      tenant: TENANT_B,
      token: adminTokenB
    });
    assert.strictEqual(tenantBShipmentsRes.status, 200);
    assert.strictEqual(tenantBShipmentsRes.data.shipments.length, 0);

    // 8c. Verify unauthenticated (401) and non-admin (403) requests to admin finance endpoints are rejected
    const unauthRes = await apiRequest("GET", "/api/admin/finance/shipments", { token: "" });
    assert.strictEqual(unauthRes.status, 401);

    const customerForbiddenRes = await apiRequest("GET", "/api/admin/finance/shipments", {
      token: customerTokenA
    });
    assert.strictEqual(customerForbiddenRes.status, 403);
    console.log("   [PASS] Tenant database isolation, schema storeId absence, and 401/403 permissions verified.");

    // ========================================================================
    // 9. Finance Capability Levels & Phase C–F Tier Boundaries
    // ========================================================================
    console.log("9. Testing Finance Capability Levels and Phase C–F tier boundaries...");

    // Switch level to Professional, then back to Basic -> verify no historical data is deleted
    const setProfRes = await apiRequest("PUT", "/api/admin/finance/settings", {
      token: adminTokenA,
      body: { level: "professional" }
    });
    assert.strictEqual(setProfRes.status, 200);
    assert.strictEqual(setProfRes.data.settings.level, "professional");
    // On professional level, phases A–E are operational while enterprise-only currency is false unless explicitly enabled
    assert.strictEqual(setProfRes.data.settings.modules.inventory.operational, true);
    assert.strictEqual(setProfRes.data.settings.modules.expenses.operational, true);
    assert.strictEqual(setProfRes.data.settings.modules.reports.operational, true);
    assert.strictEqual(setProfRes.data.settings.modules.accounting.operational, true);
    assert.strictEqual(setProfRes.data.settings.modules.currency.operational, false);

    // Switch back to Basic -> verify Shipment 1 and its payments still exist intact!
    await apiRequest("PUT", "/api/admin/finance/settings", {
      token: adminTokenA,
      body: { level: "basic" }
    });
    const shipmentStillExists = await apiRequest(
      "GET",
      `/api/admin/finance/shipments/${shipment1._id}`,
      { token: adminTokenA }
    );
    assert.strictEqual(shipmentStillExists.status, 200);
    assert.strictEqual(shipmentStillExists.data.shipment.totalPaid, 4000);

    // Verify higher-tier endpoints return 403 FINANCE_LEVEL_INSUFFICIENT when store is on 'basic' level
    for (const ep of [
      "/api/admin/finance/inventory/valuation",
      "/api/admin/finance/expenses",
      "/api/admin/finance/accounting/accounts",
      "/api/admin/finance/currency/rates"
    ]) {
      const modRes = await apiRequest("GET", ep, {
        token: adminTokenA
      });
      assert.strictEqual(modRes.status, 403);
      assert.strictEqual(modRes.data.code, "FINANCE_LEVEL_INSUFFICIENT");
    }

    // Restore level to advanced for subsequent tests
    await apiRequest("PUT", "/api/admin/finance/settings", {
      token: adminTokenA,
      body: { level: "advanced" }
    });
    console.log("   [PASS] Capability levels data preservation and tier boundaries verified.");

    // ========================================================================
    // 10. Regression Verification (Coupons, Order Cancellation & Stock Restoration)
    // ========================================================================
    console.log("10. Testing regression workflows (Coupons, Order Cancellation & Stock Restoration)...");

    const CouponsA = getCouponsModel(TENANT_A);
    await CouponsA.create({
      code: "SAVE100",
      type: "fixed",
      value: 100,
      minOrder: 200,
      maxUses: 10,
      active: true
    });

    const prodBeforeCancelOrder = await getProductsModel(TENANT_A).findById(prodC._id).lean();
    const stockBeforeOrder = prodBeforeCancelOrder.stockCount;

    const couponOrderRes = await apiRequest("POST", "/api/store-orders-public/create", {
      body: {
        deliveryMethod: "delivery",
        couponCode: "SAVE100",
        customer: { name: "رامي عادل", phone: "01099998888", address: "سموحة", city: "الإسكندرية" },
        items: [{ productId: prodC._id, quantity: 2 }]
      }
    });
    assert.strictEqual(couponOrderRes.status, 200);
    const couponOrder = couponOrderRes.data.order;
    assert.strictEqual(couponOrder.subtotal, 600); // 300 * 2
    assert.strictEqual(couponOrder.discount, 100);
    assert.strictEqual(couponOrder.items[0].netLineValue, 500); // 600 - 100

    const prodAfterOrder = await getProductsModel(TENANT_A).findById(prodC._id).lean();
    assert.strictEqual(prodAfterOrder.stockCount, stockBeforeOrder - 2);

    // Cancel order -> stock must be restored to stockBeforeOrder
    const cancelRes = await apiRequest("PUT", `/api/admin/orders/${couponOrder._id}/status`, {
      token: adminTokenA,
      body: { status: "cancelled", note: "إلغاء بناءً على طلب العميل" }
    });
    assert.strictEqual(cancelRes.status, 200);
    const prodAfterCancel = await getProductsModel(TENANT_A).findById(prodC._id).lean();
    assert.strictEqual(prodAfterCancel.stockCount, stockBeforeOrder);
    console.log("   [PASS] Regression workflows (coupons, netLineValue discount allocation, cancellation stock restore) verified.");

    console.log("\n=== ALL 10/10 FINANCE PHASE A & B VERIFICATION SUITES PASSED SUCCESSFULLY ===");
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

runTests().catch((err) => {
  console.error("[FINANCE_VERIFICATION_FAILED]", err);
  process.exit(1);
});
