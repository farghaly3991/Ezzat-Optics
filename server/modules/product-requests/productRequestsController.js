const getProductWaitlistModel = require("./waitlistModel");
const getDesiredProductModel = require("./desiredProductModel");
const getStoreNotificationModel = require("./notificationModel");
const getProductsModel = require("../products/productModel");
const getStoreOrderModel = require("../orders/orderModel");
const getStoreReturnModel = require("../returns/returnModel");
const getAdminDataModel = require("../settings/adminDataModel");
const { ensureCustomerAccount } = require("../auth/customerAccountUtil");
const {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification,
  createInAppNotification
} = require("./notificationService");
const {
  planAndEmbedDesiredProduct,
  matchProductWithDesiredRequests
} = require("./desiredProductPlanner");

// ==========================================
// STOREFRONT PUBLIC ENDPOINTS
// ==========================================

/**
 * Join restock waitlist for an out-of-stock product
 */
exports.joinWaitlist = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const {
      productId,
      phone = "",
      email = "",
      visitorId = "",
      channelPreference = "both",
      customerName = ""
    } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "معرف المنتج مطلوب" });
    }

    if (!phone && !visitorId && !req.user?._id) {
      return res.status(400).json({ error: "يرجى توفير رقم الهاتف أو معرف الجهاز للتنبيه" });
    }

    const Products = getProductsModel(subdomain);
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    const ProductWaitlist = await getProductWaitlistModel(subdomain);

    const query = {
      productId,
      $or: []
    };

    if (req.user?._id) {
      query.$or.push({ userId: req.user._id });
    }
    if (phone) {
      query.$or.push({ phone: phone.trim() });
    }
    if (visitorId) {
      query.$or.push({ visitorId: visitorId.trim() });
    }

    let existing = null;
    if (query.$or.length > 0) {
      existing = await ProductWaitlist.findOne(query);
    }

    const snapshot = {
      name: product.name,
      price: product.price,
      image: product.images?.[0] || product.image || "",
      categoryName: product.categoryName || ""
    };

    if (existing) {
      existing.status = "waiting";
      existing.channelPreference = channelPreference;
      if (phone) existing.phone = phone.trim();
      if (email) existing.email = email.trim();
      if (customerName) existing.customerName = customerName.trim();
      if (visitorId) existing.visitorId = visitorId.trim();
      if (req.user?._id) existing.userId = req.user._id;
      existing.productSnapshot = snapshot;
      await existing.save();

      return res.json({
        success: true,
        message: "تم تحديث اشتراكك في قائمة انتظار المنتج بنجاح. سنخبرك فور توفره!",
        waitlist: existing
      });
    }

    const newWaitlist = await ProductWaitlist.create({
      productId,
      productSnapshot: snapshot,
      userId: req.user?._id || null,
      customerName: customerName.trim() || req.user?.name || "",
      phone: phone.trim() || req.user?.phone || "",
      email: email.trim() || req.user?.email || "",
      visitorId: visitorId.trim() || "",
      channelPreference,
      status: "waiting"
    });

    return res.status(201).json({
      success: true,
      message: "تم تسجيلك في قائمة التنبيه عند توفر المنتج بنجاح!",
      waitlist: newWaitlist
    });
  } catch (err) {
    console.error("[WAITLIST_JOIN_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء التسجيل في قائمة الانتظار" });
  }
};

/**
 * Check if the user/visitor is already in waitlist for this product
 */
exports.checkWaitlistStatus = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { productId } = req.params;
    const { visitorId, phone } = req.query;

    const ProductWaitlist = await getProductWaitlistModel(subdomain);
    const conditions = [];

    if (req.user?._id) conditions.push({ userId: req.user._id });
    if (phone) conditions.push({ phone: phone.trim() });
    if (visitorId) conditions.push({ visitorId: visitorId.trim() });

    if (!conditions.length) {
      return res.json({ isWaiting: false });
    }

    const existing = await ProductWaitlist.findOne({
      productId,
      status: "waiting",
      $or: conditions
    });

    return res.json({
      isWaiting: Boolean(existing),
      waitlistId: existing?._id || null
    });
  } catch (err) {
    console.error("[WAITLIST_CHECK_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ في فحص حالة قائمة الانتظار" });
  }
};

/**
 * Plan, structure, and save a customer's desired future product request
 */
exports.planAndSaveDesiredProduct = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const {
      queryText,
      phone = "",
      email = "",
      customerName = "",
      visitorId = "",
      channelPreference = "both"
    } = req.body;

    if (!queryText || !queryText.trim()) {
      return res.status(400).json({ error: "وصف المنتج المطلوب فارغ" });
    }

    const AdminData = await getAdminDataModel(subdomain);
    const adminData = (await AdminData.findOne().lean()) || {};

    // 1. AI Planning & Vector Embedding
    const planned = await planAndEmbedDesiredProduct(subdomain, queryText.trim(), adminData);

    const DesiredProduct = await getDesiredProductModel(subdomain);

    const newRecord = await DesiredProduct.create({
      queryText: queryText.trim(),
      extractedName: planned.extractedName,
      categoryId: planned.categoryId || null,
      categoryName: planned.categoryName || "",
      specs: planned.specs || {},
      targetPrice: planned.targetPrice || { min: null, max: null },
      embedding: planned.embedding,
      userId: req.user?._id || null,
      customerName: customerName.trim() || req.user?.name || "",
      phone: phone.trim() || req.user?.phone || "",
      email: email.trim() || req.user?.email || "",
      visitorId: visitorId.trim() || "",
      channelPreference,
      status: "pending"
    });

    // Strip raw embedding vector from client response
    const responseData = newRecord.toObject();
    delete responseData.embedding;

    return res.status(201).json({
      success: true,
      message: "تم حفظ طلبك بنجاح! سنقوم بإبلاغك فور توفر منتج يطابق مواصفاتك.",
      desiredProduct: responseData
    });
  } catch (err) {
    console.error("[DESIRED_PRODUCT_SAVE_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء حفظ طلب المنتج المرغوب" });
  }
};

/**
 * Get storefront in-app notifications for authenticated user or visitor
 */
exports.getStorefrontNotifications = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { visitorId } = req.query;
    const userId = req.user?._id || null;

    if (!userId && !visitorId) {
      return res.json({ notifications: [], unreadCount: 0 });
    }

    const StoreNotification = await getStoreNotificationModel(subdomain);
    const conditions = [];
    if (userId) conditions.push({ userId });
    if (visitorId) conditions.push({ visitorId });

    const notifications = await StoreNotification.find({ $or: conditions })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.json({
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error("[STOREFRONT_NOTIFICATIONS_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء جلب الإشعارات" });
  }
};

/**
 * Mark in-app notification(s) as read
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const { visitorId, markAll = false } = req.body;
    const userId = req.user?._id || null;

    const StoreNotification = await getStoreNotificationModel(subdomain);

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

    const notification = await StoreNotification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: "الإشعار غير موجود" });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({ success: true, notification });
  } catch (err) {
    console.error("[MARK_NOTIFICATION_READ_ERROR]:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء تحديث حالة الإشعار" });
  }
};

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

/**
 * Check store's WhatsApp configuration status
 */
exports.getWhatsAppStatus = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const AdminData = await getAdminDataModel(subdomain);
    const adminData = (await AdminData.findOne().lean()) || {};

    const status = checkWhatsAppAvailability(adminData);
    return res.json(status);
  } catch (err) {
    console.error("[WHATSAPP_STATUS_ERROR]:", err);
    return res.status(500).json({ error: "فشل التحقق من حالة الواتساب" });
  }
};

/**
 * Get restock waitlists overview (counts per product)
 */
exports.getProductWaitlistSummary = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const ProductWaitlist = await getProductWaitlistModel(subdomain);

    const summary = await ProductWaitlist.aggregate([
      { $match: { status: "waiting" } },
      {
        $group: {
          _id: "$productId",
          count: { $sum: 1 },
          productSnapshot: { $first: "$productSnapshot" },
          latestRequestAt: { $max: "$createdAt" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return res.json({ summary });
  } catch (err) {
    console.error("[WAITLIST_SUMMARY_ERROR]:", err);
    return res.status(500).json({ error: "فشل جلب ملخص قوائم الانتظار" });
  }
};

/**
 * Get customers waiting for a specific product
 */
exports.getProductWaitlist = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { productId } = req.params;

    const ProductWaitlist = await getProductWaitlistModel(subdomain);
    const waitlist = await ProductWaitlist.find({ productId })
      .sort({ createdAt: -1 })
      .lean();

    const waitingCount = waitlist.filter((w) => w.status === "waiting").length;
    const notifiedCount = waitlist.filter((w) => w.status === "notified").length;

    return res.json({
      productId,
      totalCount: waitlist.length,
      waitingCount,
      notifiedCount,
      waitlist
    });
  } catch (err) {
    console.error("[GET_PRODUCT_WAITLIST_ERROR]:", err);
    return res.status(500).json({ error: "فشل جلب قائمة انتظار المنتج" });
  }
};

/**
 * Notify customers in waitlist when product is restocked
 */
exports.notifyProductWaitlist = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { productId } = req.params;
    const {
      channels = ["in_app"], // "in_app" | "whatsapp" | "both"
      customMessage = ""
    } = req.body;

    const Products = getProductsModel(subdomain);
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    const AdminData = await getAdminDataModel(subdomain);
    const adminData = (await AdminData.findOne().lean()) || {};
    const waAvailability = checkWhatsAppAvailability(adminData);

    const ProductWaitlist = await getProductWaitlistModel(subdomain);
    const waitingItems = await ProductWaitlist.find({
      productId,
      status: "waiting"
    });

    if (!waitingItems.length) {
      return res.json({
        success: true,
        message: "لا توجد طلبات انتظار معلقة لهذا المنتج",
        notifiedCount: 0
      });
    }

    const allowInApp = channels.includes("in_app") || channels.includes("both");
    const allowWhatsApp = channels.includes("whatsapp") || channels.includes("both");

    const defaultTitle = `توفر منتجك المفضل الآن! 🎉`;
    const defaultMsg =
      customMessage ||
      `يسعدنا إخبارك بأن منتج "${product.name}" أصبح متوفراً الآن في المتجر! سارع بالطلب قبل نفاد الكمية.`;

    let inAppCount = 0;
    let whatsAppSuccessCount = 0;
    const directWhatsAppLinks = [];

    for (const item of waitingItems) {
      const logs = [];

      // 1. In-App Notification
      if (allowInApp && (item.userId || item.visitorId)) {
        try {
          await createInAppNotification(subdomain, {
            userId: item.userId,
            visitorId: item.visitorId,
            title: defaultTitle,
            message: defaultMsg,
            type: "restock",
            productId: product._id,
            link: `/products/${product._id}`,
            image: product.images?.[0] || product.image || ""
          });
          inAppCount++;
          logs.push({
            channel: "in_app",
            sentAt: new Date(),
            message: defaultMsg,
            success: true
          });
        } catch (inAppErr) {
          logs.push({
            channel: "in_app",
            sentAt: new Date(),
            message: defaultMsg,
            success: false,
            error: inAppErr.message
          });
        }
      }

      // 2. WhatsApp Notification
      if (allowWhatsApp && item.phone) {
        const waMsg = `${defaultTitle}\n\n${defaultMsg}\n\nرابط المنتج:\n${product.name}`;
        const waResult = await sendWhatsAppNotification({
          phone: item.phone,
          message: waMsg,
          adminData
        });

        if (waResult.success) {
          whatsAppSuccessCount++;
          logs.push({
            channel: "whatsapp",
            sentAt: new Date(),
            message: waMsg,
            success: true
          });
        } else {
          logs.push({
            channel: "whatsapp",
            sentAt: new Date(),
            message: waMsg,
            success: false,
            error: waResult.error || "Missing credentials"
          });
          if (waResult.directLink) {
            directWhatsAppLinks.push({
              phone: item.phone,
              name: item.customerName || "عميل المتجر",
              link: waResult.directLink
            });
          }
        }
      }

      item.status = "notified";
      item.notifiedAt = new Date();
      if (logs.length > 0) {
        item.notificationLog.push(...logs);
      }
      await item.save();
    }

    return res.json({
      success: true,
      message: `تم إرسال إشعارات التوفر بنجاح لـ ${waitingItems.length} عميل`,
      summary: {
        totalWaiting: waitingItems.length,
        inAppSent: inAppCount,
        whatsAppSent: whatsAppSuccessCount,
        isWhatsAppApiConfigured: waAvailability.isConfigured,
        directWhatsAppLinks: directWhatsAppLinks.slice(0, 50)
      }
    });
  } catch (err) {
    console.error("[NOTIFY_WAITLIST_ERROR]:", err);
    return res.status(500).json({ error: "فشل إرسال إشعارات توفر المنتج" });
  }
};

/**
 * Get all customer-desired future products with features, query text, customer info, status (excluding embeddings)
 */
exports.getDesiredProducts = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { status, categoryId, search, page = 1, limit = 50 } = req.query;

    const DesiredProduct = await getDesiredProductModel(subdomain);
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }
    if (categoryId) {
      filter.categoryId = categoryId;
    }
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { queryText: { $regex: q, $options: "i" } },
        { extractedName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } }
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const totalCount = await DesiredProduct.countDocuments(filter);

    // Exclude heavy embedding vector from results
    const requests = await DesiredProduct.find(filter)
      .select("-embedding")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.json({
      requests,
      totalCount,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    console.error("[GET_DESIRED_PRODUCTS_ERROR]:", err);
    return res.status(500).json({ error: "فشل جلب قائمة المنتجات المرغوبة" });
  }
};

/**
 * Match a product against all pending desired product requests using AI vector similarity
 */
exports.matchProductRequests = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { productId } = req.params;
    let productDoc = req.body.productData || null;

    if (!productDoc) {
      if (!productId) {
        return res.status(400).json({ error: "معرف المنتج أو بياناته مطلوبة للبحث" });
      }
      const Products = getProductsModel(subdomain);
      productDoc = await Products.findById(productId).lean();
      if (!productDoc) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
    }

    const minSimilarity = Number(req.query.minSimilarity) || 0.22;
    const matches = await matchProductWithDesiredRequests(subdomain, productDoc, minSimilarity);

    return res.json({
      productId: productDoc._id || null,
      productName: productDoc.name,
      matchCount: matches.length,
      matches
    });
  } catch (err) {
    console.error("[MATCH_PRODUCT_REQUESTS_ERROR]:", err);
    return res.status(500).json({ error: "فشل مطابقة طلبات العملاء بالمنتج" });
  }
};

/**
 * Notify customer who requested a desired product when a matching product is ready
 */
exports.notifyDesiredProductRequest = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { requestId } = req.params;
    const {
      productId,
      channels = ["in_app"], // "in_app" | "whatsapp" | "both"
      customMessage = ""
    } = req.body;

    const DesiredProduct = await getDesiredProductModel(subdomain);
    const request = await DesiredProduct.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: "طلب المنتج المرغوب غير موجود" });
    }

    const Products = getProductsModel(subdomain);
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "المنتج المطابق غير موجود" });
    }

    const AdminData = await getAdminDataModel(subdomain);
    const adminData = (await AdminData.findOne().lean()) || {};
    const waAvailability = checkWhatsAppAvailability(adminData);

    const allowInApp = channels.includes("in_app") || channels.includes("both");
    const allowWhatsApp = channels.includes("whatsapp") || channels.includes("both");

    const defaultTitle = `وفرنا ما كنت تبحث عنه! 🎯`;
    const defaultMsg =
      customMessage ||
      `بناءً على رغبتك السابقة في البحث عن "${request.extractedName || request.queryText}"، يسعدنا إخبارك بتوفر منتج "${product.name}" الآن في المتجر!`;

    const logs = [];
    let inAppSent = false;
    let whatsAppSent = false;
    let directWhatsAppLink = "";

    // 1. In-App Notification
    if (allowInApp && (request.userId || request.visitorId)) {
      try {
        await createInAppNotification(subdomain, {
          userId: request.userId,
          visitorId: request.visitorId,
          title: defaultTitle,
          message: defaultMsg,
          type: "desired_product_match",
          productId: product._id,
          link: `/products/${product._id}`,
          image: product.images?.[0] || product.image || ""
        });
        inAppSent = true;
        logs.push({
          channel: "in_app",
          sentAt: new Date(),
          message: defaultMsg,
          success: true
        });
      } catch (inAppErr) {
        logs.push({
          channel: "in_app",
          sentAt: new Date(),
          message: defaultMsg,
          success: false,
          error: inAppErr.message
        });
      }
    }

    // 2. WhatsApp Notification
    if (allowWhatsApp && request.phone) {
      const waMsg = `${defaultTitle}\n\n${defaultMsg}\n\nيمكنك الاطلاع عليه وطلبه الآن من الرابط التالي:\n${product.name}`;
      const waResult = await sendWhatsAppNotification({
        phone: request.phone,
        message: waMsg,
        adminData
      });

      if (waResult.success) {
        whatsAppSent = true;
        logs.push({
          channel: "whatsapp",
          sentAt: new Date(),
          message: waMsg,
          success: true
        });
      } else {
        logs.push({
          channel: "whatsapp",
          sentAt: new Date(),
          message: waMsg,
          success: false,
          error: waResult.error || "Missing credentials"
        });
        directWhatsAppLink = waResult.directLink || "";
      }
    }

    request.status = "notified";
    request.matchedProductId = product._id;
    request.matchedProductSnapshot = {
      name: product.name,
      price: product.price,
      image: product.images?.[0] || product.image || ""
    };
    request.notifiedAt = new Date();
    if (logs.length > 0) {
      request.notificationLog.push(...logs);
    }
    await request.save();

    return res.json({
      success: true,
      message: "تم إرسال إشعار المطابقة للعميل بنجاح!",
      summary: {
        inAppSent,
        whatsAppSent,
        isWhatsAppApiConfigured: waAvailability.isConfigured,
        directWhatsAppLink
      }
    });
  } catch (err) {
    console.error("[NOTIFY_DESIRED_PRODUCT_ERROR]:", err);
    return res.status(500).json({ error: "فشل إرسال إشعار مطابقة المنتج" });
  }
};

/**
 * Delete or archive desired product request
 */
exports.deleteDesiredProduct = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { requestId } = req.params;

    const DesiredProduct = await getDesiredProductModel(subdomain);
    await DesiredProduct.findByIdAndDelete(requestId);

    return res.json({ success: true, message: "تم حذف الطلب بنجاح" });
  } catch (err) {
    console.error("[DELETE_DESIRED_PRODUCT_ERROR]:", err);
    return res.status(500).json({ error: "فشل حذف طلب المنتج المرغوب" });
  }
};

/**
 * Convert a customer desired product request into an official Service Order or Maintenance Ticket
 * - Automatically resolves or creates customer account (login with phone number, password = phone)
 * - Updates status to 'converted_to_service'
 * - Records timeline, store dashboard notification, and sends WhatsApp confirmation with credentials
 */
exports.convertDesiredProductToService = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { requestId } = req.params;
    const {
      targetType = "service", // "service" | "maintenance"
      serviceTitle = "",
      estimatedCost = 0,
      customerName = "",
      phone = "",
      address = "",
      city = "",
      branchId = null,
      assignedTechId = null,
      notes = "",
      sendWhatsApp = true
    } = req.body;

    const DesiredProduct = await getDesiredProductModel(subdomain);
    const desiredProduct = await DesiredProduct.findById(requestId);
    if (!desiredProduct) {
      return res.status(404).json({ error: "طلب المنتج المرغوب غير موجود" });
    }

    const targetPhone = String(phone || desiredProduct.phone || "").trim();
    const targetCustomerName = String(customerName || desiredProduct.customerName || "عميل المتجر").trim();
    const targetEmail = String(desiredProduct.email || "").trim();
    const resolvedTitle = String(
      serviceTitle || desiredProduct.extractedName || desiredProduct.queryText || "خدمة مخصصة"
    ).trim();
    const resolvedCost = Number(estimatedCost) || Number(desiredProduct.targetPrice?.max) || Number(desiredProduct.targetPrice?.min) || 0;

    // 1. Resolve or Auto-create Customer Account by phone
    let customerAccount = {
      userDoc: null,
      userId: desiredProduct.userId || null,
      isNew: false,
      username: targetPhone,
      tempPassword: targetPhone
    };

    if (targetPhone || targetEmail) {
      try {
        customerAccount = await ensureCustomerAccount(subdomain, {
          phone: targetPhone,
          name: targetCustomerName,
          email: targetEmail,
          address: address || "الفرع / خدمة ميدانية",
          city: city || "القاهرة"
        });
      } catch (accErr) {
        console.warn("[CONVERT_DESIRED_ACCOUNT_WARN]:", accErr.message);
      }
    }

    const resolvedUserId = customerAccount.userId || desiredProduct.userId || null;
    let convertedCode = "";
    let convertedMongoId = null;
    let createdRecord = null;

    // 2. Create Unified Technical Service or Maintenance Record in Returns Collection
    const Returns = getStoreReturnModel(subdomain);
    const prefix = targetType === "maintenance" ? "MNT" : "SRV";
    const ticketNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
    const maintenanceSource = targetType === "maintenance" ? "out_of_warranty" : "direct_service";

    createdRecord = await Returns.create({
      requestNumber: ticketNumber,
      type: "maintenance",
      orderId: `DESIRED-${desiredProduct._id.toString().slice(-6).toUpperCase()}`,
      userId: resolvedUserId,
      branchId: branchId || null,
      assignedTechId: assignedTechId || null,
      customer: {
        name: targetCustomerName,
        phone: targetPhone,
        address: address || "الصيانة / الفرع",
        city: city || "القاهرة"
      },
      items: [
        {
          productId: `srv_req_${desiredProduct._id}`,
          name: resolvedTitle,
          price: resolvedCost,
          quantity: 1,
          reason: notes || (targetType === "maintenance" ? "طلب صيانة وفحص بالذكاء الاصطناعي" : "طلب خدمة مباشرة بالذكاء الاصطناعي"),
          condition: "service_requested"
        }
      ],
      reason: notes || `${targetType === "maintenance" ? "طلب صيانة" : "طلب خدمة مباشرة"}: ${resolvedTitle}`,
      notes: notes || "",
      warrantyStatus: "not_applicable",
      maintenanceSource: maintenanceSource,
      serviceFee: resolvedCost,
      totalMaintenanceCost: resolvedCost,
      isWarrantyFree: false,
      amountDueFromCustomer: resolvedCost,
      paymentStatus: "pending_collection",
      status: "requested",
      timeline: [
        {
          status: "requested",
          title: targetType === "maintenance" ? "تحويل رغبة عميل إلى تذكرة صيانة" : "تحويل رغبة عميل إلى طلب خدمة فنية",
          note: `تم إنشاء التذكرة بناءً على طلب العميل بالذكاء الاصطناعي بواسطة ${req.user?.fullname || "الإدارة"}${
            customerAccount.isNew ? "، وتم تفعيل حساب دخول جديد للعميل." : "."
          }`,
          at: new Date(),
          by: req.user?.fullname || "الإدارة"
        }
      ]
    });

    convertedCode = createdRecord.requestNumber;
    convertedMongoId = createdRecord._id;

    // 3. Update Desired Product Status
    desiredProduct.status = "converted_to_service";
    desiredProduct.convertedOrderId = convertedMongoId;
    desiredProduct.convertedOrderCode = convertedCode;
    desiredProduct.convertedAt = new Date();
    desiredProduct.conversionNotes = notes || "";
    if (resolvedUserId && !desiredProduct.userId) {
      desiredProduct.userId = resolvedUserId;
    }
    await desiredProduct.save();

    // 4. Create In-App Notification for Dashboard
    try {
      const StoreNotification = await getStoreNotificationModel(subdomain);
      await StoreNotification.create({
        type: "service_created",
        title: "تحويل طلب رغبة عميل إلى خدمة معتمدة",
        message: `تم تحويل طلب العميل (${targetCustomerName}) "${resolvedTitle}" إلى ${
          targetType === "maintenance" ? "تذكرة صيانة" : "طلب خدمة فنية"
        } رقم #${convertedCode}${
          customerAccount.isNew ? "، وتم إنشاء حساب فوري للعميل برقم هاتفه." : "."
        }`,
        link: `/admin/maintenance?search=${encodeURIComponent(convertedCode)}`
      });
    } catch (notifErr) {
      console.warn("[CONVERT_DESIRED_NOTIF_WARN]:", notifErr.message);
    }

    // 5. WhatsApp Notification to Customer
    let whatsAppSent = false;
    let directWhatsAppLink = "";

    if (targetPhone && sendWhatsApp) {
      try {
        const AdminData = getAdminDataModel(subdomain);
        const adminData = await AdminData.findOne();

        let customerMsg = `مرحباً بك ${targetCustomerName}! ✨\n\nبخصوص طلبك: "${resolvedTitle}"، يسعدنا إبلاغك بأنه تم اعتماد طلبك وتجهيزه رسمياً كـ (${
          targetType === "maintenance" ? "تذكرة صيانة" : "طلب خدمة معتمد"
        }) برقم: #${convertedCode}.\nالقيمة المقدرة: ${resolvedCost} ج.م.`;

        if (customerAccount.isNew && customerAccount.tempPassword) {
          customerMsg += `\n\n🔑 تم تفعيل حسابك لدينا لمتابعة تفاصيل الخدمة والطلب:\n• اسم الدخول (أو الهاتف): ${targetPhone}\n• كلمة المرور: ${customerAccount.tempPassword}\nيمكنك تسجيل الدخول بالرقم في أي وقت.`;
        }

        const waResult = await sendWhatsAppNotification({
          phone: targetPhone,
          message: customerMsg,
          adminData
        });

        if (waResult.success) {
          whatsAppSent = true;
        } else {
          directWhatsAppLink = waResult.directLink || buildWhatsAppDirectLink(targetPhone, customerMsg);
        }
      } catch (waErr) {
        console.warn("[CONVERT_DESIRED_WA_WARN]:", waErr.message);
      }
    }

    return res.json({
      success: true,
      message: `تم تحويل الطلب بنجاح إلى ${
        targetType === "maintenance" ? "تذكرة صيانة" : "طلب خدمة"
      } رقم #${convertedCode}`,
      convertedCode,
      convertedId: convertedMongoId,
      targetType,
      customerAccount: {
        isNew: Boolean(customerAccount.isNew),
        phone: targetPhone,
        username: customerAccount.username,
        tempPassword: customerAccount.tempPassword
      },
      whatsAppSent,
      directWhatsAppLink
    });
  } catch (err) {
    console.error("[CONVERT_DESIRED_PRODUCT_ERROR]:", err);
    return res.status(500).json({ error: "فشل تحويل طلب المنتج إلى خدمة" });
  }
};
