/**
 * Automated test suite for Standalone Notification Module & Cart Price/Stock Alerts
 */
const assert = require("assert");
const mongoose = require("mongoose");
const envJson = require("../env.json");
const serverModule = require("../server");
const {
  getStoreNotificationModel,
  getPushSubscriptionModel,
  dispatchNotification,
  checkPushAvailability
} = require("../modules/notifications");
const {
  checkAndNotifyCartPriceChanges,
  checkAndNotifyBulkCartChanges
} = require("../modules/carts/cartAlertService");
const getCartModel = require("../modules/carts/cartModel");
const getAdminDataModel = require("../modules/settings/adminDataModel");

const TEST_SUBDOMAIN = "test_store_cart_notif_" + Date.now();

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runTests() {
  console.log("=== STARTING CART NOTIFICATIONS & STANDALONE MODULE TEST SUITE ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const connection = await mongoose
    .createConnection(buildTenantDbUri(baseUri, TEST_SUBDOMAIN))
    .asPromise();
  serverModule.setMongooseConnection(TEST_SUBDOMAIN, connection);

  try {

    // 1. Check Model Compilations
    console.log("1. Testing Model Registration...");
    const Notification = getStoreNotificationModel(TEST_SUBDOMAIN);
    const PushSub = getPushSubscriptionModel(TEST_SUBDOMAIN);
    const Cart = getCartModel(TEST_SUBDOMAIN);
    const AdminData = getAdminDataModel(TEST_SUBDOMAIN);

    assert(Notification, "Notification model should compile");
    assert(PushSub, "PushSubscription model should compile");
    assert(Cart, "Cart model should compile");
    assert(AdminData, "AdminData model should compile");
    console.log("✔ Models registered successfully.");

    // 2. Setup Admin Settings
    console.log("2. Setting up store notification settings...");
    await AdminData.findOneAndUpdate(
      { admin: 1 },
      {
        $set: {
          cartNotifications: {
            enabled: true,
            channel: "in_app",
            notifyOnPriceDrop: true,
            notifyOnPriceIncrease: true,
            notifyOnOutOfStock: true,
            notifyOnCriticalStock: true,
            autoUpdateCartOnOutOfStock: false,
            vapidPublicKey: "",
            vapidPrivateKey: ""
          }
        }
      },
      { upsert: true, new: true }
    );

    // 3. Test Push Availability Helper
    console.log("3. Testing Push Availability Check...");
    const pushCheckWithoutKeys = checkPushAvailability({});
    assert.strictEqual(pushCheckWithoutKeys.isConfigured, false, "Should report false without keys");

    const pushCheckWithKeys = checkPushAvailability({
      cartNotifications: {
        vapidPublicKey: "fake_public",
        vapidPrivateKey: "fake_private"
      }
    });
    assert.strictEqual(pushCheckWithKeys.isConfigured, true, "Should report true with VAPID keys");
    console.log("✔ Push availability check verified.");

    // 4. Test Direct Notification Dispatcher
    console.log("4. Testing Standalone Notification Dispatcher (In-App)...");
    const dispatchRes = await dispatchNotification(TEST_SUBDOMAIN, {
      visitorId: "visitor_unit_test_123",
      title: "عرض خاص على السلة",
      message: "تم تخفيض السعر بنسبة 20%",
      type: "price_drop",
      link: "/cart",
      metadata: { discount: 20 }
    });

    assert(dispatchRes.success, "Dispatcher should report success");
    assert(dispatchRes.channelsSent.includes("in_app"), "Channels should include in_app");

    const foundNotif = await Notification.findOne({ visitorId: "visitor_unit_test_123" });
    assert(foundNotif, "In-app notification must be persisted in DB");
    assert.strictEqual(foundNotif.type, "price_drop");
    assert.strictEqual(foundNotif.isRead, false);
    console.log("✔ Notification persisted and retrieved from DB.");

    // 5. Setup Mock Cart with a product
    console.log("5. Testing Cart Price Drop Watcher...");
    const mongoose = require("mongoose");
    const mockProductId = new mongoose.Types.ObjectId();
    const mockVisitorId = "visitor_cart_shopper_" + Date.now();

    await Cart.create({
      cartId: "cart_" + Date.now(),
      visitorId: mockVisitorId,
      status: "active",
      totalQuantity: 2,
      subtotal: 500,
      items: [
        {
          productId: mockProductId,
          name: "سماعة بلوتوث لاسلكية",
          price: 250,
          quantity: 2
        }
      ]
    });

    // 6. Simulate price drop from 250 to 199
    const alertResult = await checkAndNotifyCartPriceChanges(TEST_SUBDOMAIN, {
      productId: mockProductId,
      previousState: { price: 250, stockCount: 15 },
      updatedProduct: {
        _id: mockProductId,
        name: "سماعة بلوتوث لاسلكية",
        price: 199,
        stockCount: 15,
        criticalStockThreshold: 5
      }
    });

    assert.strictEqual(alertResult.success, true);
    assert.strictEqual(alertResult.event, "price_drop");
    assert.strictEqual(alertResult.notifiedCount, 1);

    const cartAlertNotif = await Notification.findOne({
      visitorId: mockVisitorId,
      type: "price_drop"
    });
    assert(cartAlertNotif, "Cart shopper should receive price drop alert");
    assert(cartAlertNotif.title.includes("انخفض سعر"), "Title should announce price drop");
    assert.strictEqual(cartAlertNotif.metadata.oldPrice, 250);
    assert.strictEqual(cartAlertNotif.metadata.newPrice, 199);
    console.log("✔ Cart price drop alert successfully detected, persisted, and verified.");

    // 7. Test Zero-Overhead Guard when disabled
    console.log("7. Testing Zero-Overhead Guard when notifications disabled...");
    await AdminData.findOneAndUpdate(
      { admin: 1 },
      { $set: { "cartNotifications.enabled": false } }
    );

    const disabledAlertResult = await checkAndNotifyCartPriceChanges(TEST_SUBDOMAIN, {
      productId: mockProductId,
      previousState: { price: 199, stockCount: 15 },
      updatedProduct: {
        _id: mockProductId,
        name: "سماعة بلوتوث لاسلكية",
        price: 150,
        stockCount: 15
      }
    });

    assert.strictEqual(disabledAlertResult.skipped, true);
    assert.strictEqual(disabledAlertResult.reason, "cart_notifications_disabled");
    console.log("✔ Zero-overhead guard verified when notifications disabled.");

    // 8. Test Bulk Cart Alert Aggregation
    console.log("8. Testing Bulk Consolidated Cart Changes...");
    await AdminData.findOneAndUpdate(
      { admin: 1 },
      { $set: { "cartNotifications.enabled": true } }
    );

    const bulkProductId = new mongoose.Types.ObjectId();
    const bulkVisitorId = "visitor_bulk_" + Date.now();

    await Cart.create({
      cartId: "cart_bulk_" + Date.now(),
      visitorId: bulkVisitorId,
      status: "abandoned",
      totalQuantity: 1,
      items: [
        {
          productId: bulkProductId,
          name: "شاحن سريع 65 واط",
          price: 400,
          quantity: 1
        }
      ]
    });

    const bulkResult = await checkAndNotifyBulkCartChanges(TEST_SUBDOMAIN, [
      {
        product: { _id: bulkProductId, name: "شاحن سريع 65 واط", price: 320, stockCount: 20 },
        previous: { price: 400, stockCount: 20 }
      }
    ]);

    assert.strictEqual(bulkResult.success, true);
    assert.strictEqual(bulkResult.notifiedCartsCount, 1);

    const bulkNotif = await Notification.findOne({ visitorId: bulkVisitorId });
    assert(bulkNotif, "Bulk notification should be dispatched to cart owner");
    console.log("✔ Bulk consolidated cart alert verified.");

    // Cleanup test collections
    await connection.dropDatabase();

    console.log("\n=======================================================");
    console.log("✅ ALL TESTS PASSED SUCCESSFULLY (100% VERIFIED)!");
    console.log("=======================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
  }
}

runTests();
