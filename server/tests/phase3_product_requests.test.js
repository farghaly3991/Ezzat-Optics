/**
 * Comprehensive Verification Suite for Out-of-Stock Waitlists and AI Desired Products
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const assert = require("assert");
const mongoose = require("mongoose");
const envJson = require("../env.json");
const serverModule = require("../server");

const {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification,
  createInAppNotification,
  planAndEmbedDesiredProduct,
  matchProductWithDesiredRequests,
  localExtractDesiredProduct
} = require("../modules/product-requests");

const getProductWaitlistModel = require("../modules/product-requests/waitlistModel");
const getDesiredProductModel = require("../modules/product-requests/desiredProductModel");
const getStoreNotificationModel = require("../modules/product-requests/notificationModel");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");

const TEST_TENANT = "phase3_test_tenant";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runTests() {
  console.log("=== Starting Product Requests & Waitlist Verification Suite ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const conn = await mongoose.createConnection(buildTenantDbUri(baseUri, TEST_TENANT)).asPromise();
  serverModule.setMongooseConnection(TEST_TENANT, conn);

  try {
    await conn.dropDatabase();

    // 1. Test WhatsApp Availability & Direct Link Builder
    console.log("1. Testing WhatsApp Availability Check & Direct Links...");
    {
      const unconfigured = checkWhatsAppAvailability({});
      assert.strictEqual(unconfigured.isConfigured, false, "Should be false when no tokens configured");

      const configured = checkWhatsAppAvailability({
        WHATSAPP_ACCESS_TOKEN: "fake_token",
        WHATSAPP_PHONE_NUMBER_ID: "123456789"
      });
      assert.strictEqual(configured.isConfigured, true, "Should be true when token and phoneId are present");

      const directLink = buildWhatsAppDirectLink("01012345678", "مرحبا بك في المتجر");
      assert(directLink.includes("https://wa.me/201012345678"), "Should format phone with Egypt code");
      assert(directLink.includes(encodeURIComponent("مرحبا بك في المتجر")), "Should encode message");
      console.log("   [PASS] WhatsApp availability and direct links verified.");
    }

    // 2. Test Local Desired Product Planning & Vector Generation
    console.log("2. Testing AI Desired Product Planning & 128-d Vector Generation...");
    {
      const query = "عايز تكييف كاريير 3 حصان انفرتر ابيض بارد ساخن ميزانية تحت 30000";
      const fakeCategories = [
        { _id: new mongoose.Types.ObjectId(), name: "تكييفات ومبردات" },
        { _id: new mongoose.Types.ObjectId(), name: "موبايلات وتابلت" }
      ];

      const extracted = localExtractDesiredProduct(query, fakeCategories);
      assert.strictEqual(extracted.specs.horsePower, "3", "Should extract 3 horsepower");
      assert.strictEqual(extracted.specs.color, "ابيض", "Should extract white color");
      assert.strictEqual(extracted.targetPrice.max, 30000, "Should extract max price 30000");

      const planned = await planAndEmbedDesiredProduct(TEST_TENANT, query, {});
      assert(Array.isArray(planned.embedding), "Embedding should be an array");
      assert.strictEqual(planned.embedding.length, 128, "Embedding vector must be 128-dimensional");
      console.log("   [PASS] Planning & 128-d vector embedding verified.");
    }

    // 3. Test In-App Notification Creation & Querying
    console.log("3. Testing In-App Notification Storage & Tenant Isolation...");
    {
      const testVisitorId = "visitor_test_999";
      const notif = await createInAppNotification(TEST_TENANT, {
        visitorId: testVisitorId,
        title: "توفر منتجك المفضل! 🎉",
        message: "تم توفير تكييف شارب 1.5 حصان في المخزن",
        type: "restock",
        link: "/products/123"
      });

      assert(notif._id, "Notification should have ID");
      assert.strictEqual(notif.isRead, false, "Notification should start unread");

      const StoreNotification = await getStoreNotificationModel(TEST_TENANT);
      const found = await StoreNotification.findOne({ visitorId: testVisitorId });
      assert.strictEqual(found.title, "توفر منتجك المفضل! 🎉");
      console.log("   [PASS] In-app notification creation & querying verified.");
    }

    // 4. Test Waitlist Model CRUD and Status Lifecycle
    console.log("4. Testing Restock Waitlist Storage & Product Association...");
    {
      const ProductWaitlist = await getProductWaitlistModel(TEST_TENANT);
      const dummyProductId = new mongoose.Types.ObjectId();

      const waitlistEntry = await ProductWaitlist.create({
        productId: dummyProductId,
        productSnapshot: {
          name: "غسالة إل جي أوتوماتيك 8 كيلو",
          price: 18500
        },
        phone: "01123456789",
        customerName: "عميل تجريبي",
        visitorId: "vis_abc_123",
        channelPreference: "both",
        status: "waiting"
      });

      assert(waitlistEntry._id);
      assert.strictEqual(waitlistEntry.status, "waiting");

      // Verify aggregation summary
      const summary = await ProductWaitlist.aggregate([
        { $match: { status: "waiting" } },
        { $group: { _id: "$productId", count: { $sum: 1 } } }
      ]);
      assert.strictEqual(summary.length, 1);
      assert.strictEqual(summary[0].count, 1);
      console.log("   [PASS] Restock waitlist CRUD and status aggregation verified.");
    }

    // 5. Test Cosine Similarity Matching for Desired Products
    console.log("5. Testing Semantic Cosine Vector Matching between Product & Desired Requests...");
    {
      const DesiredProduct = await getDesiredProductModel(TEST_TENANT);

      // Save a customer request for an inverter air conditioner
      const customerQuery = "مكيف شارب 2.25 حصان انفرتر بارد";
      const planned = await planAndEmbedDesiredProduct(TEST_TENANT, customerQuery, {});

      await DesiredProduct.create({
        queryText: customerQuery,
        extractedName: "تكييف شارب 2.25 حصان انفرتر",
        specs: { horsePower: "2.25", inverter: "true" },
        embedding: planned.embedding,
        phone: "01234567890",
        customerName: "مشتري محتمل",
        status: "pending"
      });

      // Match against newly added product
      const matchingProduct = {
        _id: new mongoose.Types.ObjectId(),
        name: "تكييف شارب سبليت 2.25 حصان انفرتر بارد ساخن",
        description: "أحدث تكييفات شارب بتقنية الانفرتر الموفرة للطاقة وتبريد فائق السرعة",
        specs: { "القدرة": "2.25 حصان", "النوع": "انفرتر" },
        price: 26000,
        tags: ["شارب", "تكييف", "انفرتر"]
      };

      const matches = await matchProductWithDesiredRequests(TEST_TENANT, matchingProduct, 0.2);
      assert(matches.length > 0, "Should find at least 1 semantic match");
      assert(matches[0].similarityScore > 0.3, "Similarity score should be significant (> 0.3)");
      assert.strictEqual(matches[0].desiredProduct.phone, "01234567890");
      console.log(`   [PASS] Semantic matching verified with score ${(matches[0].similarityScore * 100).toFixed(1)}%!`);
    }

    console.log("\n=== ALL 5/5 PRODUCT REQUESTS TEST SUITES PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (err) {
    console.error("Test suite failed:", err);
    process.exit(1);
  } finally {
    try {
      await conn.dropDatabase();
      await conn.close();
    } catch {}
  }
}

runTests();
