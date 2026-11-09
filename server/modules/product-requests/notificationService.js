const getStoreNotificationModel = require("./notificationModel");
const getAdminDataModel = require("../settings/adminDataModel");

/**
 * Check if automated WhatsApp dispatch credentials are configured for this store
 */
function checkWhatsAppAvailability(adminData = {}) {
  const token =
    adminData.WHATSAPP_ACCESS_TOKEN ||
    adminData.whatsappAccessToken ||
    adminData.whatsappApiKey ||
    process.env.WHATSAPP_ACCESS_TOKEN;

  const phoneId =
    adminData.WHATSAPP_PHONE_NUMBER_ID ||
    adminData.whatsappPhoneNumberId ||
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  const isConfigured = Boolean(token && phoneId);

  return {
    isConfigured,
    phoneId: phoneId || null,
    hasToken: Boolean(token),
    storeWhatsAppNumber: adminData.whatsapp || adminData.phone || "",
    statusText: isConfigured
      ? "خدمة واتساب السحابية مفعلة وجاهزة للإرسال الآلي"
      : "خدمة واتساب السحابية غير مفعلة (تتطلب إعداد WhatsApp Cloud API Token & Phone ID في الإعدادات)"
  };
}

/**
 * Build a standard wa.me direct chat link
 */
function buildWhatsAppDirectLink(phone, message = "") {
  if (!phone) return "";
  let cleanPhone = String(phone).replace(/[^\d+]/g, "");
  if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.slice(1);
  if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
    cleanPhone = "20" + cleanPhone.slice(1); // Default Egypt country code prefix
  }
  const safeEncoded = encodeURIComponent(message)
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  return `https://wa.me/${cleanPhone}?text=${safeEncoded}`;
}

/**
 * Send WhatsApp notification via Cloud API (if configured) or prepare wa.me payload
 */
async function sendWhatsAppNotification({ phone, message, adminData = {} }) {
  const availability = checkWhatsAppAvailability(adminData);

  if (!phone) {
    return { success: false, error: "رقم الهاتف غير متوفر" };
  }

  // Format clean phone number
  let cleanPhone = String(phone).replace(/[^\d]/g, "");
  if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
    cleanPhone = "20" + cleanPhone.slice(1);
  }

  const directLink = buildWhatsAppDirectLink(phone, message);

  // If Cloud API configured, attempt Cloud API dispatch
  if (availability.isConfigured) {
    const token =
      adminData.WHATSAPP_ACCESS_TOKEN ||
      adminData.whatsappAccessToken ||
      process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = availability.phoneId;

    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { body: message }
          })
        }
      );

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || "فشل إرسال رسالة الواتساب",
          directLink
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        directLink
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        directLink
      };
    }
  }

  // Fallback when automated API is not configured
  return {
    success: false,
    reason: "credentials_missing",
    error: "بيانات اعتماد WhatsApp Cloud API غير مكتملة",
    directLink
  };
}

/**
 * Create In-App notification for user or visitor
 */
async function createInAppNotification(subdomain, {
  userId = null,
  visitorId = "",
  title,
  message,
  type = "general",
  productId = null,
  link = "",
  image = ""
}) {
  const StoreNotification = await getStoreNotificationModel(subdomain);

  const notification = await StoreNotification.create({
    userId: userId || null,
    visitorId: visitorId || "",
    title,
    message,
    type,
    productId: productId || null,
    link: link || (productId ? `/products/${productId}` : ""),
    image: image || "",
    isRead: false
  });

  return notification;
}

module.exports = {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification,
  createInAppNotification
};
