const axios = require("axios");
const getPushSubscriptionModel = require("./pushSubscriptionModel");
const getAdminDataModel = require("../settings/adminDataModel");

/**
 * Check if Web Push credentials (VAPID or FCM) are configured for this store
 */
function checkPushAvailability(adminData = {}) {
  const cartCfg = adminData.cartNotifications || {};
  const vapidPublicKey = cartCfg.vapidPublicKey || adminData.vapidPublicKey || process.env.VAPID_PUBLIC_KEY || "";
  const vapidPrivateKey = cartCfg.vapidPrivateKey || adminData.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || "";
  const fcmServerKey = cartCfg.fcmServerKey || adminData.fcmServerKey || process.env.FCM_SERVER_KEY || "";

  const hasVapid = Boolean(vapidPublicKey && vapidPrivateKey);
  const hasFcm = Boolean(fcmServerKey);
  const isConfigured = hasVapid || hasFcm;

  return {
    isConfigured,
    hasVapid,
    hasFcm,
    vapidPublicKey,
    statusText: isConfigured
      ? "إشعارات الويب الحقيقية (Web Push) مفعلة وجاهزة للعمل"
      : "إشعارات الويب غير مفعلة (تتطلب ضبط مفاتيح VAPID أو FCM Server Key في الإعدادات)"
  };
}

/**
 * Send Web Push notification to a specific subscription or FCM token
 */
async function sendWebPushToSubscription({
  subscription,
  fcmToken,
  payload,
  adminData = {}
}) {
  const availability = checkPushAvailability(adminData);

  if (!availability.isConfigured) {
    return {
      success: false,
      reason: "credentials_missing",
      error: availability.statusText
    };
  }

  const title = payload.title || "تنبيه جديد";
  const body = payload.message || payload.body || "";
  const icon = payload.image || payload.icon || "/icons/icon-192.png";
  const url = payload.link || payload.url || "/";

  // If FCM Server Key is configured and token or endpoint contains fcm
  if (availability.hasFcm && (fcmToken || subscription?.endpoint?.includes("fcm.googleapis.com"))) {
    try {
      const fcmKey =
        adminData.cartNotifications?.fcmServerKey ||
        adminData.fcmServerKey ||
        process.env.FCM_SERVER_KEY;

      const registrationToken =
        fcmToken ||
        subscription?.endpoint?.split("/").pop();

      if (registrationToken) {
        const response = await axios.post(
          "https://fcm.googleapis.com/fcm/send",
          {
            to: registrationToken,
            notification: {
              title,
              body,
              icon,
              click_action: url
            },
            data: {
              url,
              metadata: JSON.stringify(payload.metadata || {})
            }
          },
          {
            headers: {
              Authorization: `key=${fcmKey}`,
              "Content-Type": "application/json"
            },
            timeout: 5000
          }
        );

        if (response.data?.success >= 1) {
          return { success: true, method: "fcm", data: response.data };
        }
      }
    } catch (err) {
      console.error("[FCM_PUSH_ERROR]:", err.message);
      return { success: false, error: err.message, method: "fcm" };
    }
  }

  // Fallback or generic HTTP push
  return {
    success: false,
    reason: "unsupported_or_pending_client_subscription",
    error: "لم يتم العثور على اشتراك متوافق مع خادم الإرسال"
  };
}

/**
 * Dispatch Web Push to all active subscriptions of a user or visitor
 */
async function dispatchPushToTarget(subdomain, { userId, visitorId, title, message, link, image, metadata, adminData }) {
  try {
    const availability = checkPushAvailability(adminData);
    if (!availability.isConfigured) {
      return { success: false, reason: "credentials_missing" };
    }

    const PushSub = getPushSubscriptionModel(subdomain);
    const conditions = [];
    if (userId) conditions.push({ userId });
    if (visitorId) conditions.push({ visitorId });

    if (conditions.length === 0) {
      return { success: false, reason: "no_target_identifiers" };
    }

    const subscriptions = await PushSub.find({
      $or: conditions,
      isActive: true
    }).limit(10);

    if (subscriptions.length === 0) {
      return { success: false, reason: "no_active_subscriptions" };
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendWebPushToSubscription({
          subscription: sub,
          fcmToken: sub.fcmToken,
          payload: { title, message, link, image, metadata },
          adminData
        })
      )
    );

    const successfulCount = results.filter((r) => r.status === "fulfilled" && r.value?.success).length;

    return {
      success: successfulCount > 0,
      sentCount: successfulCount,
      totalTargets: subscriptions.length
    };
  } catch (err) {
    console.error("[DISPATCH_PUSH_TARGET_ERROR]:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  checkPushAvailability,
  sendWebPushToSubscription,
  dispatchPushToTarget
};
