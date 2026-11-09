const getStoreNotificationModel = require("./notificationModel");
const getPushSubscriptionModel = require("./pushSubscriptionModel");
const getAdminDataModel = require("../settings/adminDataModel");
const { dispatchNotification } = require("./notificationDispatcher");
const { checkPushAvailability } = require("./pushService");
const { checkWhatsAppAvailability } = require("../product-requests/notificationService");

/**
 * Get in-app notifications for customer/visitor
 */
exports.getNotifications = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { visitorId, limit = 30, unreadOnly = false } = req.query;
    const userId = req.user?._id || null;

    if (!userId && !visitorId) {
      return res.json({ notifications: [], unreadCount: 0 });
    }

    const StoreNotification = getStoreNotificationModel(subdomain);
    const conditions = [];
    if (userId) conditions.push({ userId });
    if (visitorId) conditions.push({ visitorId });

    const query = { $or: conditions };
    if (unreadOnly === "true" || unreadOnly === true) {
      query.isRead = false;
    }

    const notifications = await StoreNotification.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(100, parseInt(limit, 10) || 30))
      .lean();

    const unreadCount = await StoreNotification.countDocuments({
      $or: conditions,
      isRead: false
    });

    return res.json({
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error("[GET_NOTIFICATIONS_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء جلب الإشعارات" });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const { visitorId, markAll = false } = req.body;
    const userId = req.user?._id || null;

    const StoreNotification = getStoreNotificationModel(subdomain);
    const conditions = [];
    if (userId) conditions.push({ userId });
    if (visitorId) conditions.push({ visitorId });

    if (markAll) {
      if (conditions.length > 0) {
        await StoreNotification.updateMany({ $or: conditions }, { $set: { isRead: true } });
      }
      return res.json({ success: true, message: "تم تحديد جميع الإشعارات كمقروءة" });
    }

    if (!id) {
      return res.status(400).json({ error: "معرف الإشعار مطلوب" });
    }

    const updated = await StoreNotification.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { new: true }
    );

    return res.json({ success: true, notification: updated });
  } catch (err) {
    console.error("[MARK_NOTIFICATION_READ_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء تحديث حالة الإشعار" });
  }
};

/**
 * Register Web Push Subscription
 */
exports.subscribePush = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { endpoint, keys, fcmToken, visitorId } = req.body;
    const userId = req.user?._id || null;

    if (!endpoint) {
      return res.status(400).json({ error: "نقطة نهاية الاشتراك (endpoint) مطلوبة" });
    }

    const PushSub = getPushSubscriptionModel(subdomain);
    const subscription = await PushSub.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId: userId || null,
          visitorId: visitorId || "",
          keys: keys || {},
          fcmToken: fcmToken || "",
          userAgent: req.headers["user-agent"] || "",
          isActive: true
        }
      },
      { upsert: true, new: true }
    );

    // Also link to active cart if visitorId or userId is available
    if (visitorId || userId) {
      try {
        const getCartModel = require("../carts/cartModel");
        const Cart = getCartModel(subdomain);
        const cartQuery = userId ? { userId } : { visitorId };
        await Cart.updateMany(
          { ...cartQuery, status: "active" },
          {
            $set: {
              "pushSubscription.endpoint": endpoint,
              "pushSubscription.keys": keys || {}
            }
          }
        );
      } catch (cartErr) {
        console.error("[PUSH_CART_LINK_WARN]:", cartErr.message);
      }
    }

    return res.json({ success: true, subscription });
  } catch (err) {
    console.error("[SUBSCRIBE_PUSH_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء تسجيل اشتراك الإشعارات" });
  }
};

/**
 * Get notification settings status for admin dashboard
 */
exports.getSettingsStatus = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const AdminData = getAdminDataModel(subdomain);
    const adminData = await AdminData.findOne({ admin: 1 }).lean();

    const pushAvailability = checkPushAvailability(adminData);
    const whatsAppAvailability = checkWhatsAppAvailability(adminData);

    return res.json({
      cartNotifications: adminData?.cartNotifications || {
        enabled: true,
        channel: "in_app",
        notifyOnPriceDrop: true,
        notifyOnPriceIncrease: false,
        notifyOnOutOfStock: true,
        notifyOnCriticalStock: true,
        autoUpdateCartOnOutOfStock: false
      },
      pushAvailability,
      whatsAppAvailability
    });
  } catch (err) {
    console.error("[GET_NOTIFICATION_SETTINGS_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء جلب إعدادات الإشعارات" });
  }
};

/**
 * Send test notification from admin panel
 */
exports.sendTestNotification = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { title, message, channel = "in_app", testPhone = "" } = req.body;

    const result = await dispatchNotification(subdomain, {
      userId: req.user?._id || null,
      visitorId: "admin_test",
      phone: testPhone,
      title: title || "🔔 إشعار تجريبي من المتجر",
      message: message || "هذا إشعار تجريبي لاختبار نظام التنبيهات المستقل في المتجر.",
      type: "general",
      link: "/admin/overview",
      channels: channel === "both" ? ["in_app", "web_push"] : [channel]
    });

    return res.json({ success: true, result });
  } catch (err) {
    console.error("[SEND_TEST_NOTIFICATION_ERROR]:", err);
    return res.status(500).json({ error: err.message || "فشل إرسال الإشعار التجريبي" });
  }
};
