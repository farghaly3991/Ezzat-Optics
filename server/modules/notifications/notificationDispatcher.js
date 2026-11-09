const getStoreNotificationModel = require("./notificationModel");
const getAdminDataModel = require("../settings/adminDataModel");
const { dispatchPushToTarget, checkPushAvailability } = require("./pushService");
const { sendWhatsAppNotification, checkWhatsAppAvailability } = require("../product-requests/notificationService");

/**
 * Central Decoupled Notification Dispatcher
 *
 * Accepts structured inputs, checks tenant settings, and dispatches across
 * in-app, web push, and WhatsApp channels.
 *
 * Zero overhead: Exits immediately if alerts are disabled in store settings.
 */
async function dispatchNotification(subdomain, {
  userId = null,
  visitorId = "",
  phone = "",
  pushSubscription = null,
  title,
  message,
  type = "general",
  productId = null,
  cartId = null,
  link = "",
  image = "",
  metadata = {},
  channels = null // If omitted, determined automatically by admin settings
}) {
  if (!subdomain) {
    throw new Error("subdomain is required for notification dispatch");
  }

  // 1. Fetch store settings
  const AdminData = getAdminDataModel(subdomain);
  const adminData = await AdminData.findOne({ admin: 1 }).lean();
  const cartCfg = adminData?.cartNotifications || {};

  // 2. High-Performance Guard: Check if notifications are globally disabled
  if (cartCfg.enabled === false || cartCfg.channel === "disabled") {
    return {
      success: false,
      skipped: true,
      reason: "notifications_disabled_by_store_settings"
    };
  }

  // 3. Determine active channels
  // Configured channel options: "in_app", "web_push", "both"
  const configuredChannel = cartCfg.channel || "in_app";
  let targetChannels = channels;
  if (!Array.isArray(targetChannels) || targetChannels.length === 0) {
    if (configuredChannel === "both") {
      targetChannels = ["in_app", "web_push"];
    } else if (configuredChannel === "web_push") {
      targetChannels = ["web_push"];
    } else {
      targetChannels = ["in_app"];
    }
  }

  const dispatchResults = {
    channels: targetChannels,
    inApp: null,
    webPush: null,
    whatsApp: null
  };

  const actualSentChannels = [];

  // 4. Dispatch In-App Notification
  if (targetChannels.includes("in_app")) {
    try {
      const StoreNotification = getStoreNotificationModel(subdomain);
      const inAppDoc = await StoreNotification.create({
        userId: userId || null,
        visitorId: visitorId || "",
        title: String(title || "").trim(),
        message: String(message || "").trim(),
        type,
        productId: productId || null,
        cartId: cartId || null,
        link: link || (productId ? `/product/${productId}` : (cartId ? "/cart" : "")),
        image: image || "",
        metadata: metadata || {},
        channelsSent: ["in_app"],
        isRead: false
      });

      dispatchResults.inApp = { success: true, id: inAppDoc._id };
      actualSentChannels.push("in_app");
    } catch (inAppErr) {
      console.error("[NOTIFICATION_IN_APP_ERROR]:", inAppErr);
      dispatchResults.inApp = { success: false, error: inAppErr.message };
    }
  }

  // 5. Dispatch Web Push Notification (if configured and enabled)
  if (targetChannels.includes("web_push")) {
    try {
      const pushCheck = checkPushAvailability(adminData);
      if (pushCheck.isConfigured) {
        const pushRes = await dispatchPushToTarget(subdomain, {
          userId,
          visitorId,
          title,
          message,
          link: link || "/cart",
          image,
          metadata,
          adminData
        });

        dispatchResults.webPush = pushRes;
        if (pushRes.success) {
          actualSentChannels.push("web_push");
        }
      } else {
        dispatchResults.webPush = {
          success: false,
          reason: "push_credentials_not_configured",
          message: pushCheck.statusText
        };
      }
    } catch (pushErr) {
      console.error("[NOTIFICATION_WEB_PUSH_ERROR]:", pushErr);
      dispatchResults.webPush = { success: false, error: pushErr.message };
    }
  }

  // 6. Optional WhatsApp dispatch
  if (targetChannels.includes("whatsapp") && phone) {
    try {
      const waRes = await sendWhatsAppNotification({
        phone,
        message: `${title}\n\n${message}\n\n${link ? "رابط العرض: " + link : ""}`,
        adminData
      });
      dispatchResults.whatsApp = waRes;
      if (waRes.success) {
        actualSentChannels.push("whatsapp");
      }
    } catch (waErr) {
      console.error("[NOTIFICATION_WHATSAPP_ERROR]:", waErr);
      dispatchResults.whatsApp = { success: false, error: waErr.message };
    }
  }

  return {
    success: actualSentChannels.length > 0 || (dispatchResults.inApp?.success === true),
    channelsSent: actualSentChannels,
    results: dispatchResults
  };
}

module.exports = {
  dispatchNotification
};
