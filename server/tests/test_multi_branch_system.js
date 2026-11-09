/**
 * Automated Verification Suite for Multi-Branch Architecture
 */

const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const branchService = require("../modules/branches/branchService");
const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const getProductsModel = require("../modules/products/productModel");
const getOrdersModel = require("../modules/orders/orderModel");

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

async function runTests() {
  console.log("=== Starting Multi-Branch Architecture Verification Suite ===");
  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Products = getProductsModel(SUBDOMAIN);
  const Orders = getOrdersModel(SUBDOMAIN);

  // 1. Verify Branches Listing & Counts
  console.log("\n[Test 1] Verify Branches Listing & Aggregated Counts...");
  const branches = await branchService.listBranches(SUBDOMAIN);
  assert(Array.isArray(branches), "Branches must be an array");
  assert(branches.length >= 3, `Expected at least 3 branches, found ${branches.length}`);

  const mainBranch = branches.find((b) => b.isMain);
  assert(mainBranch, "Main branch must exist");
  assert.strictEqual(mainBranch.code, "MAIN-CAI");
  assert(mainBranch.productsCount > 0, "Main branch should have products");
  assert(mainBranch.ordersCount > 0, "Main branch should have orders");
  console.log(`✓ Test 1 Passed: Found ${branches.length} branches. Main branch has ${mainBranch.productsCount} products and ${mainBranch.ordersCount} orders.`);

  // 2. Verify Super Admin (Role 5) vs Branch Manager (Role 4) Roles
  console.log("\n[Test 2] Verify Roles (Super Admin 5 vs Branch Admin 4)...");
  const superAdmin = await Users.findOne({ email: "admin@store.com" }).lean();
  assert(superAdmin, "Super admin user must exist");
  assert.strictEqual(Number(superAdmin.role), 5, "Super admin must have role: 5");

  const alexManager = await Users.findOne({ email: "alex_manager@store.com" }).lean();
  assert(alexManager, "Alex manager user must exist");
  assert.strictEqual(Number(alexManager.role), 4, "Branch manager must have role: 4");
  assert(alexManager.branchId, "Branch manager must be linked to a branchId");
  console.log("✓ Test 2 Passed: Super admin is Role 5 and Branch Manager is Role 4 with linked branchId.");

  // 3. Verify Branch Isolation for Products
  console.log("\n[Test 3] Verify Product Isolation across Branches...");
  const alexBranch = branches.find((b) => b.code === "ALEX-SMH");
  const gizaBranch = branches.find((b) => b.code === "GIZA-ZAYED");
  assert(alexBranch && gizaBranch, "Alex and Giza branches must exist");

  const alexProducts = await Products.find({ branchId: alexBranch._id }).lean();
  const gizaProducts = await Products.find({ branchId: gizaBranch._id }).lean();

  assert(alexProducts.length >= 40, `Alex branch should have at least 40 products, got ${alexProducts.length}`);
  assert(gizaProducts.length >= 40, `Giza branch should have at least 40 products, got ${gizaProducts.length}`);

  // Confirm product IDs are mutually exclusive
  const alexIds = new Set(alexProducts.map((p) => String(p._id)));
  const overlap = gizaProducts.some((p) => alexIds.has(String(p._id)));
  assert.strictEqual(overlap, false, "Branches must have completely isolated product catalogs!");
  console.log(`✓ Test 3 Passed: Branch product isolation verified (Alex: ${alexProducts.length}, Giza: ${gizaProducts.length}, 0 overlap).`);

  // 4. Verify Branch Isolation for Orders
  console.log("\n[Test 4] Verify Order Isolation across Branches...");
  const alexOrders = await Orders.find({ branchId: alexBranch._id }).lean();
  const gizaOrders = await Orders.find({ branchId: gizaBranch._id }).lean();
  assert(alexOrders.length > 0, "Alex branch should have orders");
  assert(gizaOrders.length > 0, "Giza branch should have orders");

  alexOrders.forEach((o) => {
    assert.strictEqual(String(o.branchId), String(alexBranch._id), "All orders must match alex branch ID");
  });
  console.log(`✓ Test 4 Passed: Order branch isolation verified (Alex: ${alexOrders.length} orders, Giza: ${gizaOrders.length} orders).`);

  // 5. Verify Super Admin Branch Creation & Update
  console.log("\n[Test 5] Verify Branch Creation, Update, and Deletion Protection...");
  const testBranchPayload = {
    name: "فرع تجريبي مؤقت (المنصورة)",
    code: "MANS-TEMP",
    city: "المنصورة",
    address: "شارع الجيش، المنصورة",
    phone: "01099998888",
    whatsapp: "01099998888"
  };

  const created = await branchService.createBranch(SUBDOMAIN, testBranchPayload, superAdmin);
  assert.strictEqual(created.code, "MANS-TEMP");
  assert.strictEqual(created.city, "المنصورة");

  // Try to delete main branch (should throw error)
  let mainDeleteFailed = false;
  try {
    await branchService.deleteBranch(SUBDOMAIN, mainBranch._id, superAdmin);
  } catch (err) {
    mainDeleteFailed = true;
    assert(err.message.includes("الرئيسي"), "Should prohibit main branch deletion");
  }
  assert.strictEqual(mainDeleteFailed, true, "Main branch deletion was correctly blocked");

  // Clean up test branch
  await branchService.deleteBranch(SUBDOMAIN, created._id, superAdmin);
  const deletedCheck = await Branch.findById(created._id);
  assert.strictEqual(deletedCheck, null, "Test branch should be successfully deleted");
  console.log("✓ Test 5 Passed: Branch CRUD and main branch deletion protection verified.");

  console.log("\n🎉 ALL MULTI-BRANCH SYSTEM TESTS PASSED SUCCESSFULLY! (5/5)");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  });
