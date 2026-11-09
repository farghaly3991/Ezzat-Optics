const mongoose = require("mongoose");
const getCartModel = require("./cartModel");
const getProductModel = require("../products/productModel");
const getOrdersModel = require("../orders/orderModel");
const getActivityModel = require("../activity/activityModel");
const getAdminDataModel = require("../settings/adminDataModel");
const {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification,
  createInAppNotification
} = require("../product-requests/notificationService");

/**
 * Synchronize or update a cart session from the storefront
 */
async function syncCart(subdomain, cartData = {}, actor = {}) {
  const Cart = getCartModel(subdomain);
  const cartId = (cartData.cartId || actor.cartId || "").trim();
  if (!cartId) return null;

  const rawItems = Array.isArray(cartData.items) ? cartData.items : [];
  let totalQuantity = 0;
  let subtotal = 0;

  const sanitizedItems = rawItems
    .filter((item) => item && (item.productId || item._id))
    .map((item) => {
      const pId = item.productId || item._id;
      const qty = Math.max(1, Number(item.quantity || 1));
      const price = Number(item.price || 0);
      totalQuantity += qty;
      subtotal += price * qty;

      return {
        productId: pId,
        name: item.name || "",
        price,
        quantity: qty,
        image: item.image || (item.images && item.images[0]) || "",
        isService: Boolean(item.isService),
        sku: item.sku || ""
      };
    });

  const updateFields = {
    items: sanitizedItems,
    totalQuantity,
    subtotal,
    lastActiveAt: new Date()
  };

  if (cartData.couponCode !== undefined) {
    updateFields.couponCode = cartData.couponCode || "";
    updateFields.discountAmount = Number(cartData.discountAmount || 0);
  }

  if (actor.userId && mongoose.isValidObjectId(actor.userId)) {
    updateFields.userId = actor.userId;
  }
  if (actor.visitorId) {
    updateFields.visitorId = actor.visitorId;
  }
  if (actor.sessionId) {
    updateFields.sessionId = actor.sessionId;
  }

  if (cartData.customer && typeof cartData.customer === "object") {
    if (cartData.customer.name) updateFields["customer.name"] = cartData.customer.name;
    if (cartData.customer.phone) updateFields["customer.phone"] = cartData.customer.phone;
    if (cartData.customer.email) updateFields["customer.email"] = cartData.customer.email;
  }

  // If cart was abandoned, customer activity brings it back to active
  updateFields.status = sanitizedItems.length > 0 ? "active" : "active";

  const cart = await Cart.findOneAndUpdate(
    { cartId },
    {
      $set: updateFields,
      $setOnInsert: { cartId }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return cart;
}

/**
 * Mark a cart as converted after an order is placed
 */
async function markCartConverted(subdomain, cartId, orderId = null) {
  if (!cartId) return;
  const Cart = getCartModel(subdomain);
  await Cart.updateOne(
    { cartId },
    {
      $set: {
        status: "converted",
        convertedOrderId: orderId || null,
        lastActiveAt: new Date()
      }
    }
  );
}

/**
 * Scan and retrieve inactive / abandoned carts with flexible sorting & filtering
 */
async function getInactiveCarts(subdomain, options = {}) {
  const Cart = getCartModel(subdomain);
  const Orders = getOrdersModel(subdomain);
  const Activity = getActivityModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);

  const adminConfig = (await AdminData.findOne({}).lean()) || {};
  const currency = adminConfig.currency || "ج.م";
  const siteName = adminConfig.siteName || "متجرنا";

  const periodHours = parseFloat(options.periodHours) || 24; // default: 24h inactive
  const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 20, 200));
  const sortBy = options.sortBy || "items_desc"; // 'items_desc' (default) | 'subtotal_desc' | 'last_active_desc' | 'last_active_asc'
  const search = (options.search || "").trim();

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - periodHours * 60 * 60 * 1000);

  // 1. Backfill from Activity logs if Cart collection has few items
  try {
    const existingCount = await Cart.countDocuments({});
    if (existingCount < 5) {
      await backfillCartsFromActivity(subdomain, Cart, Activity, Orders);
    }
  } catch (err) {
    console.warn("[CARTS_BACKFILL_WARN]", err.message);
  }

  // 2. Query filter
  const query = {
    status: { $ne: "converted" },
    totalQuantity: { $gt: 0 }
  };

  if (periodHours > 0) {
    query.lastActiveAt = { $lte: cutoffDate };
  }

  if (options.branchId) {
    query.branchId = options.branchId;
  }

  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [
      { cartId: searchRegex },
      { "customer.name": searchRegex },
      { "customer.phone": searchRegex },
      { "customer.email": searchRegex },
      { "items.name": searchRegex }
    ];
  }

  // 3. Sorting configuration
  let sortObj = { totalQuantity: -1, subtotal: -1 };
  if (sortBy === "items_desc") {
    sortObj = { totalQuantity: -1, subtotal: -1 };
  } else if (sortBy === "subtotal_desc") {
    sortObj = { subtotal: -1, totalQuantity: -1 };
  } else if (sortBy === "last_active_desc") {
    sortObj = { lastActiveAt: -1 };
  } else if (sortBy === "last_active_asc") {
    sortObj = { lastActiveAt: 1 };
  }

  // 4. Summary counts & metrics (across all matching period cutoff)
  const allMatching = await Cart.find({
    status: { $ne: "converted" },
    totalQuantity: { $gt: 0 },
    ...(periodHours > 0 ? { lastActiveAt: { $lte: cutoffDate } } : {}),
    ...(options.branchId ? { branchId: options.branchId } : {})
  }).select("totalQuantity subtotal recoveryHistory").lean();

  const totalAbandonedCarts = allMatching.length;
  const totalAbandonedItems = allMatching.reduce((acc, c) => acc + (c.totalQuantity || 0), 0);
  const totalAbandonedValue = allMatching.reduce((acc, c) => acc + (c.subtotal || 0), 0);
  const totalNotifiedCarts = allMatching.filter((c) => Array.isArray(c.recoveryHistory) && c.recoveryHistory.length > 0).length;

  // 5. Fetch paginated/limited carts
  const carts = await Cart.find(query)
    .sort(sortObj)
    .limit(limit)
    .populate("userId", "fullname phone email username")
    .populate("branchId", "name code city isMain")
    .populate({
      path: "items.productId",
      select: "name price images stockCount active sku isService"
    })
    .lean();

  // 6. Enrich cart items with customer info and calculate idle time
  const enrichedCarts = carts.map((c) => {
    const custName = c.customer?.name || c.userId?.fullname || c.userId?.username || "زائر المتجر";
    const custPhone = c.customer?.phone || c.userId?.phone || "";
    const custEmail = c.customer?.email || c.userId?.email || "";

    const lastActive = c.lastActiveAt ? new Date(c.lastActiveAt) : new Date(c.updatedAt || c.createdAt);
    const idleHours = Math.max(0, Math.round((now.getTime() - lastActive.getTime()) / (3600 * 1000)));
    const idleDays = Math.floor(idleHours / 24);

    let idleText = `منذ ${idleHours} ساعة`;
    if (idleDays >= 1) {
      idleText = idleDays === 1 ? "منذ يوم" : idleDays === 2 ? "منذ يومين" : `منذ ${idleDays} أيام`;
    } else if (idleHours < 1) {
      idleText = "منذ أقل من ساعة";
    }

    const itemsSummary = (c.items || [])
      .map((it) => `${it.name || it.productId?.name || "منتج"} (×${it.quantity})`)
      .join("، ");

    const directWaLink = custPhone
      ? buildWhatsAppDirectLink(
          custPhone,
          `مرحباً ${custName} 👋\nلاحظنا وجود (${c.totalQuantity} منتجات) في سلة تسوقك بمتجرنا بقيمة ${c.subtotal} ${currency}.\n\nالمنتجات:\n${itemsSummary}\n\nهل تحتاج إلى مساعدة لإتمام طلبك؟ يمكنك استكمال الشراء بسهولة عبر الرابط:\nhttps://${subdomain}.almister.com/cart`
        )
      : "";

    return {
      _id: c._id,
      cartId: c.cartId,
      branchId: c.branchId || null,
      customer: {
        name: custName,
        phone: custPhone,
        email: custEmail,
        isRegistered: Boolean(c.userId)
      },
      visitorId: c.visitorId,
      items: (c.items || []).map((it) => ({
        productId: it.productId?._id || it.productId,
        name: it.productId?.name || it.name,
        price: it.price || it.productId?.price || 0,
        quantity: it.quantity || 1,
        image: it.image || it.productId?.images?.[0] || "",
        stockCount: it.productId?.stockCount ?? null,
        sku: it.sku || it.productId?.sku || "",
        isService: it.isService || it.productId?.isService || false
      })),
      totalQuantity: c.totalQuantity || 0,
      subtotal: c.subtotal || 0,
      couponCode: c.couponCode || "",
      discountAmount: c.discountAmount || 0,
      status: c.status,
      lastActiveAt: lastActive,
      idleHours,
      idleDays,
      idleText,
      recoveryHistory: c.recoveryHistory || [],
      directWaLink
    };
  });

  const waStatus = checkWhatsAppAvailability(adminConfig);

  return {
    periodHours,
    sortBy,
    limit,
    summary: {
      totalAbandonedCarts,
      totalAbandonedItems,
      totalAbandonedValue,
      totalNotifiedCarts,
      currency,
      siteName,
      isWhatsAppCloudConfigured: waStatus.isConfigured
    },
    carts: enrichedCarts
  };
}

/**
 * Send an in-app or WhatsApp recovery notification for an abandoned cart
 */
async function sendCartRecoveryNotification(subdomain, { cartId, channels = ["in_app"], customMessage = "" }) {
  const Cart = getCartModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);

  const cart = await Cart.findOne({ cartId })
    .populate("userId", "fullname phone email username")
    .populate("items.productId", "name price images")
    .lean();

  if (!cart) {
    throw new Error("سلة التسوق غير موجودة");
  }

  const adminConfig = (await AdminData.findOne({}).lean()) || {};
  const currency = adminConfig.currency || "ج.م";
  const siteName = adminConfig.siteName || "متجرنا";

  // Normalize channels
  let chList = Array.isArray(channels) ? channels : [channels];
  if (channels === "both") chList = ["in_app", "whatsapp"];

  const customerName = cart.customer?.name || cart.userId?.fullname || cart.userId?.username || "عميلنا العزيز";
  const customerPhone = cart.customer?.phone || cart.userId?.phone || "";

  let inAppResult = { success: false };
  let waResult = { success: false, directLink: "" };
  const itemsText = (cart.items || []).map((i) => `• ${i.name || i.productId?.name} (عدد ${i.quantity})`).join("\n");

  // 1. In-App Notification
  if (chList.includes("in_app") || chList.includes("both")) {
    try {
      const inAppTitle = "🛒 سلة تسوقك بانتظارك!";
      const inAppMsg =
        customMessage ||
        `مرحباً ${customerName}، لديك (${cart.totalQuantity} منتجات) محفوظة في سلة التسوق، لا تفوت فرصة إتمام طلبك الآن قبل نفاد الكمية!`;

      await createInAppNotification(subdomain, {
        userId: cart.userId?._id || null,
        visitorId: cart.visitorId || "",
        title: inAppTitle,
        message: inAppMsg,
        type: "general",
        link: "/cart",
        image: cart.items?.[0]?.image || cart.items?.[0]?.productId?.images?.[0] || ""
      });

      inAppResult = { success: true };
    } catch (err) {
      inAppResult = { success: false, error: err.message };
    }
  }

  // 2. WhatsApp Notification
  if (chList.includes("whatsapp") || chList.includes("both")) {
    if (!customerPhone) {
      waResult = {
        success: false,
        error: "رقم هاتف العميل غير متوفر في هذه السلة لإرسال رسالة واتساب"
      };
    } else {
      const waMsg =
        customMessage ||
        `مرحباً ${customerName} 👋\nلاحظنا وجود (${cart.totalQuantity} منتجات) في سلة تسوقك بمتجر ${siteName} بقيمة ${cart.subtotal} ${currency}.\n\nالمنتجات:\n${itemsText}\n\nهل تحتاج إلى مساعدة أو استفسار لإتمام طلبك؟ يمكنك استكمال الشراء بسهولة عبر الرابط:\nhttps://${subdomain}.almister.com/cart\n\nشكراً لتسوقك معنا!`;

      const waRes = await sendWhatsAppNotification({
        phone: customerPhone,
        message: waMsg,
        adminData: adminConfig
      });

      waResult = waRes;
    }
  }

  // Record into cart's recoveryHistory
  const historyEntry = {
    channels: chList,
    sentAt: new Date(),
    status: (inAppResult.success || waResult.success) ? "sent" : "failed",
    recipientPhone: customerPhone,
    waSuccess: Boolean(waResult.success),
    inAppSuccess: Boolean(inAppResult.success),
    error: [inAppResult.error, waResult.error].filter(Boolean).join(" | ")
  };

  await Cart.updateOne(
    { cartId },
    {
      $push: { recoveryHistory: historyEntry },
      $set: { status: "abandoned" }
    }
  );

  return {
    cartId,
    channels: chList,
    inApp: inAppResult,
    whatsapp: waResult,
    customerName,
    customerPhone
  };
}

/**
 * Bulk send recovery notifications to multiple selected carts
 */
async function bulkSendRecovery(subdomain, { cartIds = [], channels = ["in_app"], customMessage = "" }) {
  if (!Array.isArray(cartIds) || cartIds.length === 0) {
    throw new Error("لم يتم تحديد أي سلات للإرسال");
  }

  const results = [];
  let inAppSuccessCount = 0;
  let waSuccessCount = 0;
  let failedCount = 0;

  for (const cid of cartIds) {
    try {
      const res = await sendCartRecoveryNotification(subdomain, {
        cartId: cid,
        channels,
        customMessage
      });
      if (res.inApp?.success) inAppSuccessCount++;
      if (res.whatsapp?.success) waSuccessCount++;
      results.push(res);
    } catch (err) {
      failedCount++;
      results.push({ cartId: cid, success: false, error: err.message });
    }
  }

  return {
    total: cartIds.length,
    inAppSuccessCount,
    waSuccessCount,
    failedCount,
    results
  };
}

/**
 * Helper: reconstruct and backfill carts from existing activity logs
 */
async function backfillCartsFromActivity(subdomain, Cart, Activity, Orders) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const cartActivities = await Activity.find({
    eventType: { $in: ["add_to_cart", "checkout_started"] },
    cartId: { $ne: null, $exists: true },
    occurredAt: { $gte: cutoff }
  })
    .sort({ occurredAt: -1 })
    .populate("productId", "name price images sku isService")
    .lean();

  const completedOrders = await Orders.find({
    cartId: { $ne: null, $exists: true }
  }).select("cartId").lean();

  const convertedCartIds = new Set(completedOrders.map((o) => o.cartId));

  const cartsMap = new Map();

  for (const act of cartActivities) {
    const cId = act.cartId;
    if (!cId || convertedCartIds.has(cId)) continue;

    if (!cartsMap.has(cId)) {
      cartsMap.set(cId, {
        cartId: cId,
        userId: act.userId || null,
        visitorId: act.visitorId || "",
        sessionId: act.sessionId || "",
        itemsMap: new Map(),
        lastActiveAt: act.occurredAt || new Date()
      });
    }

    const cObj = cartsMap.get(cId);
    if (act.productId) {
      const pIdStr = String(act.productId._id || act.productId);
      if (!cObj.itemsMap.has(pIdStr)) {
        cObj.itemsMap.set(pIdStr, {
          productId: act.productId._id || act.productId,
          name: act.productId.name || "منتج",
          price: Number(act.unitPrice || act.productId.price || 0),
          quantity: Number(act.quantity || 1),
          image: act.productId.images?.[0] || "",
          sku: act.productId.sku || "",
          isService: Boolean(act.productId.isService)
        });
      }
    }
  }

  for (const [cId, data] of cartsMap.entries()) {
    const items = Array.from(data.itemsMap.values());
    if (items.length === 0) continue;

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    await Cart.findOneAndUpdate(
      { cartId: cId },
      {
        $setOnInsert: {
          cartId: cId,
          userId: data.userId,
          visitorId: data.visitorId,
          sessionId: data.sessionId,
          items,
          totalQuantity,
          subtotal,
          status: "abandoned",
          lastActiveAt: data.lastActiveAt
        }
      },
      { upsert: true }
    );
  }
}

module.exports = {
  syncCart,
  markCartConverted,
  getInactiveCarts,
  sendCartRecoveryNotification,
  bulkSendRecovery
};
