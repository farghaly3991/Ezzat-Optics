/**
 * Phase 7 Test Suite: POS Cashier, Barcode Scanning & Auto-Customer Accounts
 */
const assert = require("assert");
const mongoose = require("mongoose");
const envJson = require("../env.json");
const serverModule = require("../server");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getUsersModel = require("../modules/auth/userModel");
const ordersController = require("../modules/orders/ordersController");
const productsController = require("../modules/products/productsController");
const authController = require("../modules/auth/authController");

const TEST_SUBDOMAIN = "test_pos_barcode_" + Date.now();

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runTests() {
  console.log("=== STARTING PHASE 7 POS, BARCODE & AUTO-CUSTOMER TEST SUITE ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const connection = await mongoose
    .createConnection(buildTenantDbUri(baseUri, TEST_SUBDOMAIN))
    .asPromise();
  serverModule.setMongooseConnection(TEST_SUBDOMAIN, connection);

  try {
    const Products = getProductsModel(TEST_SUBDOMAIN);
    const Categories = getCategoriesModel(TEST_SUBDOMAIN);
    const Orders = getOrdersModel(TEST_SUBDOMAIN);
    const Users = getUsersModel(TEST_SUBDOMAIN);

    const cat = await Categories.create({
      name: "إلكترونيات",
      slug: "electronics"
    });

    // 1. Verify default barcode behavior
    console.log("1. Testing Barcode auto-generation on product creation...");
    const prodAuto = new Products({
      name: "شاحن ذكي تلقائي",
      categoryId: cat._id,
      price: 150,
      costPrice: 80,
      stockCount: 20
    });
    await prodAuto.save();

    assert(prodAuto.barcode, "Product barcode must be generated");
    assert.strictEqual(
      prodAuto.barcode,
      prodAuto._id.toString(),
      "Default barcode should match product _id"
    );
    console.log("✔ Auto barcode generated successfully:", prodAuto.barcode);

    // 2. Verify physical factory barcode assignment
    console.log("2. Testing Physical Factory Barcode assignment...");
    const FACTORY_EAN = "6221234567890";
    const prodFactory = new Products({
      name: "سماعة أذن بلوتوث من المصنع",
      categoryId: cat._id,
      barcode: FACTORY_EAN,
      price: 350,
      costPrice: 200,
      stockCount: 15
    });
    await prodFactory.save();

    assert.strictEqual(
      prodFactory.barcode,
      FACTORY_EAN,
      "Factory barcode must be preserved exactly"
    );
    console.log("✔ Factory barcode stored properly:", prodFactory.barcode);

    // 3. Test lookupProductByCode
    console.log("3. Testing lookupProductByCode for both types...");
    let reqLookup = { subdomain: TEST_SUBDOMAIN, params: { code: FACTORY_EAN } };
    let resData = null;
    let resObj = {
      json: (d) => { resData = d; return resObj; },
      status: () => resObj
    };

    await productsController.lookupProductByCode(reqLookup, resObj);
    assert(resData && resData.product, "Must find product by factory barcode");
    assert.strictEqual(resData.product._id.toString(), prodFactory._id.toString());
    console.log("✔ Successfully looked up by factory barcode!");

    reqLookup = { subdomain: TEST_SUBDOMAIN, params: { code: prodAuto._id.toString() } };
    await productsController.lookupProductByCode(reqLookup, resObj);
    assert(resData && resData.product, "Must find product by auto-generated _id barcode");
    assert.strictEqual(resData.product._id.toString(), prodAuto._id.toString());
    console.log("✔ Successfully looked up by system _id barcode!");

    // 4. Test POS Order Creation with customer auto-creation
    console.log("4. Testing createPosOrder with New Customer Auto-Account Creation...");
    const CUSTOMER_PHONE = "01099887766";
    const CUSTOMER_NAME = "أحمد مصطفى كاشير";

    let posReq = {
      subdomain: TEST_SUBDOMAIN,
      body: {
        items: [
          { productId: prodFactory._id.toString(), name: prodFactory.name, price: 350, quantity: 2 },
          { productId: prodAuto._id.toString(), name: prodAuto.name, price: 150, quantity: 1 }
        ],
        customer: {
          name: CUSTOMER_NAME,
          phone: CUSTOMER_PHONE,
          address: "استلام من الفرع"
        },
        paymentMethod: "cash",
        discount: 50
      }
    };

    let posResData = null;
    let posRes = {
      status: (code) => {
        assert(code === 201, "POS Order should return status 201");
        return {
          json: (d) => { posResData = d; return posResData; }
        };
      }
    };

    await ordersController.createPosOrder(posReq, posRes, (err) => {
      if (err) throw err;
    });

    assert(posResData && posResData.done, "POS Order should succeed");
    assert(posResData.order, "Order document must be returned");
    assert.strictEqual(posResData.order.total, 800, "Subtotal 850 - discount 50 = 800");
    assert(posResData.customerAccount, "Customer account response must exist");
    assert.strictEqual(posResData.customerAccount.isNew, true, "Should be flagged as a new account");
    assert.strictEqual(posResData.customerAccount.phone, CUSTOMER_PHONE);
    assert.strictEqual(posResData.customerAccount.tempPassword, CUSTOMER_PHONE);
    console.log("✔ POS order created & customer auto-account verified!");

    // Verify stock decrement
    const updatedFactory = await Products.findById(prodFactory._id).lean();
    assert.strictEqual(updatedFactory.stockCount, 13, "Stock count should decrement by 2 (15 - 2 = 13)");
    assert.strictEqual(updatedFactory.salesCount, 2, "Sales count should increment by 2");
    console.log("✔ Inventory stock successfully decremented!");

    // 5. Test Customer Instant Login with Phone Number & Phone Password
    console.log("5. Testing customer login using Phone as username and Phone as password...");
    let loginReq = {
      subdomain: TEST_SUBDOMAIN,
      body: {
        email: CUSTOMER_PHONE,
        password: CUSTOMER_PHONE
      }
    };

    let loginData = null;
    let loginRes = {
      json: (d) => { loginData = d; return loginRes; },
      status: (c) => {
        return {
          json: (d) => { loginData = { status: c, ...d }; return loginData; }
        };
      }
    };

    await authController.login(loginReq, loginRes, (err) => {
      if (err) throw err;
    });

    assert(loginData && loginData.done, "Customer must be able to log in with phone credentials");
    assert(loginData.token, "Auth JWT token must be generated");
    assert.strictEqual(loginData.user.phone, CUSTOMER_PHONE);
    console.log("✔ Customer instant login with phone credentials PASSED!");

    // 6. Test Customer Intelligence Lookup
    console.log("6. Testing lookupPosCustomer for returning customer metrics...");
    let lookupCustomerReq = {
      subdomain: TEST_SUBDOMAIN,
      query: { q: CUSTOMER_PHONE }
    };
    let customerLookupData = null;
    let customerLookupRes = {
      json: (d) => { customerLookupData = d; return customerLookupRes; }
    };

    await ordersController.lookupPosCustomer(lookupCustomerReq, customerLookupRes, (err) => {
      if (err) throw err;
    });

    assert(customerLookupData && customerLookupData.found, "Customer must be found");
    assert.strictEqual(customerLookupData.customer.name, CUSTOMER_NAME);
    assert.strictEqual(customerLookupData.customer.hasAccount, true);
    assert.strictEqual(customerLookupData.stats.ordersCount, 1);
    assert.strictEqual(customerLookupData.stats.totalSpent, 800);
    assert(customerLookupData.recentOrders.length >= 1);
    console.log("✔ Customer Intelligence lookup PASSED!");

    console.log("=== ALL PHASE 7 TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    try {
      await connection.dropDatabase();
      await connection.close();
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
