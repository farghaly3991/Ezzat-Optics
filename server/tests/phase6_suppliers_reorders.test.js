/**
 * Phase 6 Verification Suite: Independent Suppliers Directory & Management,
 * Reusable SupplierModal, Supplier-Product Linkage, Critical & Out-of-Stock Inventory Manager,
 * Supplier-Grouped Reorder Queue & Formatted Arabic WhatsApp Message Proposals,
 * and 6-Hour Background Worker for Critical Stock Alerts.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const envJson = require("../env.json");
const serverModule = require("../server");

const {
  createSupplier,
  listSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier
} = require("../modules/finance/procurement/procurementService");

const {
  getCriticalAndOutOfStockProducts,
  generateSupplierReordersProposal,
  dispatchAndRecordSupplierReorder,
  listSupplierReorders,
  runPeriodicCriticalStockCheck
} = require("../modules/finance/procurement/procurementReorderService");

const getProductsModel = require("../modules/products/productModel");
const getSuppliersModel = require("../modules/finance/procurement/supplierModel");
const getProcurementReordersModel = require("../modules/finance/procurement/procurementReorderModel");
const getCategoriesModel = require("../modules/categories/categoryModel");

const TEST_TENANT = "phase6_test_suppliers";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runPhase6Suite() {
  console.log("\n=== Starting Phase 6 Suppliers & Critical Stock Reorders Suite ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const tenantUri = buildTenantDbUri(baseUri, TEST_TENANT);
  const conn = await mongoose.createConnection(tenantUri).asPromise();
  serverModule.setMongooseConnection(TEST_TENANT, conn);

  const Product = getProductsModel(TEST_TENANT);
  const Supplier = getSuppliersModel(TEST_TENANT);
  const Reorder = getProcurementReordersModel(TEST_TENANT);
  const Category = getCategoriesModel(TEST_TENANT);

  try {
    // Clean test database collections
    await Supplier.deleteMany({});
    await Product.deleteMany({});
    await Reorder.deleteMany({});
    await Category.deleteMany({});

    // -------------------------------------------------------------
    // Test 1: Independent Suppliers Directory & CRUD
    // -------------------------------------------------------------
    console.log("1. Testing Supplier Creation with WhatsApp & Specialty...");
    const createdSupplier = await createSupplier(TEST_TENANT, {
      name: "شركة الأهرام للتوريدات والمعدات",
      phone: "01012345678",
      whatsappPhone: "01012345678",
      email: "ahram@supplies.test",
      specialty: "شواحن وكابلات معتمدة",
      address: "القاهرة - باب اللوق",
      notes: "خصم 10% للتوريدات التي تزيد عن 50 قطعة"
    });

    assert.ok(createdSupplier._id, "Supplier should have a valid _id");
    assert.strictEqual(createdSupplier.name, "شركة الأهرام للتوريدات والمعدات");
    assert.strictEqual(createdSupplier.whatsappPhone, "01012345678");
    assert.strictEqual(createdSupplier.specialty, "شواحن وكابلات معتمدة");
    console.log("   ✓ Supplier created successfully with ID:", createdSupplier._id.toString());

    // Update Supplier
    console.log("2. Testing Supplier Update...");
    const updatedSupplier = await updateSupplier(TEST_TENANT, createdSupplier._id, {
      specialty: "إلكترونيات واكسسوارات فائقة السرعة",
      phone: "01099998888"
    });
    assert.strictEqual(updatedSupplier.specialty, "إلكترونيات واكسسوارات فائقة السرعة");
    assert.strictEqual(updatedSupplier.phone, "01099998888");
    console.log("   ✓ Supplier updated successfully");

    // Fetch Details
    const fetched = await getSupplierById(TEST_TENANT, createdSupplier._id);
    assert.strictEqual(fetched.name, "شركة الأهرام للتوريدات والمعدات");

    // -------------------------------------------------------------
    // Test 2: Product Schema & Supplier Linkage
    // -------------------------------------------------------------
    console.log("3. Testing Product Creation with Supplier Link, Thresholds & Reorder Qty...");
    const cat = await Category.create({ name: "إكسسوارات ذكية" });

    // P1: Out of stock (stockCount = 0) linked to supplier
    const p1 = await Product.create({
      name: "كابل شحن فائق السرعة 100W",
      categoryId: cat._id,
      price: 180,
      costPrice: 90,
      stockCount: 0,
      supplierId: createdSupplier._id,
      criticalStockThreshold: 5,
      reorderQuantity: 30,
      active: true
    });

    // P2: Critical stock (stockCount = 2, threshold = 4) linked to supplier
    const p2 = await Product.create({
      name: "رأس شاحن GaN 65W",
      categoryId: cat._id,
      price: 450,
      costPrice: 280,
      stockCount: 2,
      supplierId: createdSupplier._id,
      criticalStockThreshold: 4,
      reorderQuantity: 20,
      active: true
    });

    // P3: Healthy stock (stockCount = 50, threshold = 3)
    const p3 = await Product.create({
      name: "سماعة بلوتوث رياضية",
      categoryId: cat._id,
      price: 650,
      costPrice: 380,
      stockCount: 50,
      supplierId: createdSupplier._id,
      criticalStockThreshold: 3,
      reorderQuantity: 15,
      active: true
    });

    assert.ok(p1 && p2 && p3, "All 3 test products should be created");
    console.log("   ✓ Products created with supplier and reorder attributes");

    // -------------------------------------------------------------
    // Test 3: Critical & Out-of-Stock Query with Pagination
    // -------------------------------------------------------------
    console.log("4. Testing Critical & Out-of-Stock Inventory Query & Pagination...");
    const criticalRes = await getCriticalAndOutOfStockProducts(TEST_TENANT, {
      page: 1,
      limit: 10,
      statusFilter: "all",
      hasSupplier: "all"
    });

    assert.strictEqual(criticalRes.products.length, 2, "Should find exactly 2 products (0 stock and 2 stock)");
    assert.strictEqual(criticalRes.counts.outOfStock, 1, "Should count 1 out-of-stock item");
    assert.strictEqual(criticalRes.counts.critical, 1, "Should count 1 critical stock item");
    assert.strictEqual(criticalRes.counts.withSupplier, 2, "Both should have assigned supplier");
    console.log("   ✓ Critical products query returned expected counts:", criticalRes.counts);

    // Test Top 5 limit pagination
    const topLimitRes = await getCriticalAndOutOfStockProducts(TEST_TENANT, {
      page: 1,
      limit: 1,
      statusFilter: "all"
    });
    assert.strictEqual(topLimitRes.products.length, 1, "Limit=1 should return 1 product");
    assert.strictEqual(topLimitRes.pagination.pages, 2, "Total 2 items / limit 1 should equal 2 pages");
    console.log("   ✓ Pagination controls verified successfully");

    // -------------------------------------------------------------
    // Test 4: Safe Supplier Deletion Guard
    // -------------------------------------------------------------
    console.log("5. Testing Safe Supplier Deletion Guard (Rejection on Linked Products)...");
    let caughtDeletionError = false;
    try {
      await deleteSupplier(TEST_TENANT, createdSupplier._id);
    } catch (err) {
      caughtDeletionError = true;
      assert.match(err.message, /مرتبط/, "Should specify that supplier is linked to products");
      console.log("   ✓ Deletion rejected with expected safety error message:", err.message);
    }
    assert.ok(caughtDeletionError, "Should have prevented deletion of linked supplier");

    // -------------------------------------------------------------
    // Test 5: Reorder Proposals & Arabic WhatsApp Message Formatting
    // -------------------------------------------------------------
    console.log("6. Testing Supplier-Grouped Reorder Proposals & Arabic WhatsApp Formatting...");
    const proposalRes = await generateSupplierReordersProposal(TEST_TENANT, {
      productIds: [p1._id, p2._id]
    });

    assert.strictEqual(proposalRes.proposals.length, 1, "Should group both products under the single supplier");
    const group = proposalRes.proposals[0];

    assert.strictEqual(group.supplierName, "شركة الأهرام للتوريدات والمعدات");
    assert.strictEqual(group.items.length, 2);
    assert.strictEqual(group.totalQuantity, 50, "30 + 20 = 50 requested units");

    // Check message template
    assert.ok(group.messageText.includes("طلب توريد بضاعة جديد"), "Header must include 'طلب توريد بضاعة جديد'");
    assert.ok(group.messageText.includes("كابل شحن فائق السرعة 100W"), "Item 1 must be present");
    assert.ok(group.messageText.includes("رأس شاحن GaN 65W"), "Item 2 must be present");
    assert.ok(group.messageText.includes("50 قطعة"), "Total quantity must match in text");
    assert.ok(group.directWhatsAppLink.startsWith("https://wa.me/"), "WhatsApp link must start with https://wa.me/");
    console.log("   ✓ Formatted Arabic WhatsApp message generated correctly:\n\n" + group.messageText + "\n");

    // -------------------------------------------------------------
    // Test 6: Reorder Dispatch & Activity Persistence
    // -------------------------------------------------------------
    console.log("7. Testing Reorder Dispatch & History Persistence...");
    const dispatchResult = await dispatchAndRecordSupplierReorder(TEST_TENANT, {
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      supplierPhone: group.supplierPhone,
      supplierWhatsapp: group.supplierWhatsapp,
      items: group.items,
      totalQuantity: group.totalQuantity,
      totalEstimatedCost: group.totalEstimatedCost,
      messageText: group.messageText,
      channel: "whatsapp_direct"
    });
    const dispatched = dispatchResult.reorder || dispatchResult;

    assert.ok(dispatched.reorderCode.startsWith("REO-"), "Reorder code should be prefixed with REO-");
    assert.strictEqual(dispatched.status, "sent");
    assert.strictEqual(dispatched.totalQuantity, 50);

    const historyRes = await listSupplierReorders(TEST_TENANT, { limit: 10 });
    const history = historyRes.reorders || historyRes;
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].reorderCode, dispatched.reorderCode);
    console.log("   ✓ Dispatched reorder recorded in activity log with code:", dispatched.reorderCode);

    // -------------------------------------------------------------
    // Test 7: 6-Hour Background Worker for Critical Stock Alerts
    // -------------------------------------------------------------
    console.log("8. Testing 6-Hour Critical Stock Background Worker Check...");
    const checkResult = await runPeriodicCriticalStockCheck(TEST_TENANT);
    assert.strictEqual(checkResult.alertCount, 2, "Worker should find the 2 critical products");
    console.log("   ✓ Background worker scanned and queued critical stock items:", checkResult);

    console.log("\n=======================================================");
    console.log("  ALL PHASE 6 VERIFICATION CHECKS PASSED SUCCESSFULLY!");
    console.log("=======================================================\n");
  } finally {
    await conn.close();
  }
}

runPhase6Suite().catch((err) => {
  console.error("Phase 6 Suite Failed:", err);
  process.exit(1);
});
