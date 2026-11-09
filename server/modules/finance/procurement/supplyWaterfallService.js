/**
 * Multi-Supplier Waterfall Procurement Service
 *
 * Implements cascading / priority-ordered supply requests:
 * 1. Dispatches supply request to Supplier #1 via Magic Link.
 * 2. On Acceptance: Notifies admin in dashboard, alerts admin on WhatsApp, marks accepted.
 * 3. On Decline: Cascades automatically to Supplier #2 with new token & WhatsApp message.
 * 4. Tracks acceptance rates & response performance per supplier.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const getSupplyWaterfallRequestModel = require("./supplyWaterfallRequestModel");
const getProductsModel = require("../../products/productModel");
const getSupplierModel = require("./supplierModel");
const getStoreNotificationModel = require("../../notifications/notificationModel");
const getActivityModel = require("../../activity/activityModel");
const getAdminDataModel = require("../../settings/adminDataModel");
const getBranchModel = require("../../branches/branchModel");
const {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification
} = require("../../product-requests/notificationService");

async function generateRequestCode(Model) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const rnd = crypto.randomBytes(2).toString("hex").toUpperCase();
    const candidate = `SUP-${dateStr}-${rnd}`;
    const exists = await Model.exists({ requestCode: candidate });
    if (!exists) return candidate;
  }
  return `SUP-${Date.now().toString(36).toUpperCase()}`;
}

function getSiteBaseUrl(subdomain) {
  const host = process.env.FRONTEND_URL || process.env.BASE_DOMAIN || "localhost:3005";
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return host.replace(/\/+$/, "");
  }
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  if (subdomain && subdomain !== "localhost" && subdomain !== "main") {
    return `${protocol}://${subdomain}.${host}`;
  }
  return `${protocol}://${host}`;
}

/**
 * Creates and initiates a waterfall supply request.
 */
async function createWaterfallRequest(subdomain, data, actor = null) {
  const WaterfallModel = getSupplyWaterfallRequestModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Supplier = getSupplierModel(subdomain);
  const Branch = getBranchModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);

  const adminConfig = (await AdminData.findOne({}).lean()) || {};
  const siteName = adminConfig.siteName || "متجرنا";

  const { productId, quantity, branchId, notes } = data;
  if (!productId) throw new Error("معرّف المنتج مطلوب");
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const product = await Products.findById(productId).lean();
  if (!product) throw new Error("المنتج غير موجود");

  // Resolve branch
  let targetBranch = null;
  if (branchId && mongoose.isValidObjectId(branchId)) {
    targetBranch = await Branch.findById(branchId).lean();
  } else if (product.branchId) {
    targetBranch = await Branch.findById(product.branchId).lean();
  }

  // Build supplier chain
  let chainData = [];

  if (Array.isArray(product.suppliers) && product.suppliers.length > 0) {
    // Sort by priority ascending (1 = highest priority)
    const sorted = [...product.suppliers].sort((a, b) => (a.priority || 1) - (b.priority || 1));
    for (let idx = 0; idx < sorted.length; idx++) {
      const s = sorted[idx];
      let supDoc = null;
      if (s.supplierId) {
        supDoc = await Supplier.findById(s.supplierId).lean();
      }
      chainData.push({
        supplierId: s.supplierId || supDoc?._id || new mongoose.Types.ObjectId(),
        supplierName: s.supplierName || supDoc?.name || `مورد رقم ${idx + 1}`,
        supplierPhone: s.phone || supDoc?.phone || "",
        supplierWhatsapp: s.whatsapp || supDoc?.whatsappPhone || supDoc?.phone || s.phone || "",
        priority: s.priority || idx + 1,
        token: crypto.randomBytes(16).toString("hex"),
        status: idx === 0 ? "contacted" : "pending",
        contactedAt: idx === 0 ? new Date() : null,
        respondedAt: null,
        responseNotes: ""
      });
    }
  } else if (product.supplierId) {
    const supDoc = await Supplier.findById(product.supplierId).lean();
    if (supDoc) {
      chainData.push({
        supplierId: supDoc._id,
        supplierName: supDoc.name,
        supplierPhone: supDoc.phone || "",
        supplierWhatsapp: supDoc.whatsappPhone || supDoc.phone || "",
        priority: 1,
        token: crypto.randomBytes(16).toString("hex"),
        status: "contacted",
        contactedAt: new Date(),
        respondedAt: null,
        responseNotes: ""
      });
    }
  }

  // If still empty, check if specific supplierIds were passed in payload
  if (chainData.length === 0 && Array.isArray(data.supplierIds) && data.supplierIds.length > 0) {
    for (let idx = 0; idx < data.supplierIds.length; idx++) {
      const supDoc = await Supplier.findById(data.supplierIds[idx]).lean();
      if (supDoc) {
        chainData.push({
          supplierId: supDoc._id,
          supplierName: supDoc.name,
          supplierPhone: supDoc.phone || "",
          supplierWhatsapp: supDoc.whatsappPhone || supDoc.phone || "",
          priority: idx + 1,
          token: crypto.randomBytes(16).toString("hex"),
          status: idx === 0 ? "contacted" : "pending",
          contactedAt: idx === 0 ? new Date() : null,
          respondedAt: null,
          responseNotes: ""
        });
      }
    }
  }

  if (chainData.length === 0) {
    throw new Error("لا يوجد موردين مسجلين لهذا المنتج. يرجى ربط مورد واحد على الأقل أولاً.");
  }

  const requestCode = await generateRequestCode(WaterfallModel);
  const estimatedCost = data.estimatedCost !== undefined ? Number(data.estimatedCost) : (product.costPrice || 0) * qty;

  const request = await WaterfallModel.create({
    requestCode,
    productId: product._id,
    productName: data.orderTitle || product.name,
    productImage: (product.images && product.images[0]) || product.image || "",
    productSku: product.sku || "",
    branchId: targetBranch ? targetBranch._id : null,
    quantity: qty,
    estimatedCost,
    items: Array.isArray(data.items) ? data.items : [],
    chain: chainData,
    currentSupplierIndex: 0,
    status: "in_progress",
    createdBy: actor?.userId || null,
    notes: notes || ""
  });

  // Prepare first supplier communication
  const firstSupplier = chainData[0];
  const baseUrl = getSiteBaseUrl(subdomain);
  const taskUrl = `${baseUrl}/supplier/supply-request/${firstSupplier.token}`;
  const cleanPhone = (firstSupplier.supplierWhatsapp || firstSupplier.supplierPhone || "").replace(/\D/g, "");

  const messageText = [
    `السلام عليكم ورحمة الله وبركاته،`,
    `تحية طيبة إلى السيد/ *${firstSupplier.supplierName}* المحترم،`,
    ``,
    `يوجد طلب توريد عاجل من متجر *${siteName}*:`,
    `📦 الصنف: *${product.name}*`,
    `🔢 الكمية المطلوبة: *${qty} قطعة*`,
    `🏢 الفرع المستلم: *${targetBranch ? targetBranch.name : "الفرع الرئيسي"}*`,
    ``,
    `يرجى تأكيد إمكانية التوريد والجاهزية عبر الرابط المباشر التالي:`,
    taskUrl
  ].join("\n");

  const whatsappUrl = cleanPhone
    ? buildWhatsAppDirectLink(cleanPhone, messageText)
    : "";

  // Attempt Cloud API if available
  try {
    if (cleanPhone) {
      await sendWhatsAppNotification(subdomain, {
        recipientPhone: cleanPhone,
        message: messageText
      });
    }
  } catch (waErr) {
    console.warn("[WATERFALL_WA_DISPATCH_WARN]", waErr.message);
  }

  // Log activity
  try {
    const Activity = getActivityModel(subdomain);
    await Activity.create({
      event: "procurement_waterfall_initiated",
      entity: "storeSupplyWaterfallRequest",
      entityId: String(request._id),
      details: {
        requestCode,
        productName: product.name,
        quantity: qty,
        firstSupplier: firstSupplier.supplierName
      },
      actor: {
        userId: actor?.userId || null,
        role: actor?.role || "admin",
        name: actor?.fullname || "إدارة التوريد"
      }
    });
  } catch (_) {}

  return {
    request,
    firstSupplier,
    taskUrl,
    whatsappUrl,
    messageText
  };
}

/**
 * Public portal retrieval: fetches request summary by supplier's magic token.
 */
async function getSupplyRequestByToken(subdomain, token) {
  if (!token) throw new Error("رمز التحقق (token) مطلوب");
  const WaterfallModel = getSupplyWaterfallRequestModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const req = await WaterfallModel.findOne({ "chain.token": token })
    .populate("branchId", "name city address phone")
    .lean();

  if (!req) {
    throw new Error("طلب التوريد غير موجود أو انتهت صلاحية الرابط");
  }

  const matchingIndex = req.chain.findIndex((c) => c.token === token);
  if (matchingIndex === -1) {
    throw new Error("رمز التحقق غير صالح");
  }

  const currentSup = req.chain[matchingIndex];
  const adminConfig = (await AdminData.findOne({}).lean()) || {};

  return {
    requestCode: req.requestCode,
    productName: req.productName,
    productImage: req.productImage,
    productSku: req.productSku,
    quantity: req.quantity,
    estimatedCost: req.estimatedCost,
    items: Array.isArray(req.items) ? req.items : [],
    notes: req.notes || "",
    branchName: req.branchId?.name || "الفرع الرئيسي للمتجر",
    branchPhone: req.branchId?.phone || adminConfig.phone || "",
    supplierName: currentSup.supplierName,
    priority: currentSup.priority,
    status: req.status, // in_progress | accepted | all_declined
    myStatus: currentSup.status, // contacted | accepted | declined
    isCurrentlyActive: req.currentSupplierIndex === matchingIndex && req.status === "in_progress",
    respondedAt: currentSup.respondedAt,
    responseNotes: currentSup.responseNotes,
    siteName: adminConfig.siteName || "المتجر الإلكتروني",
    currency: adminConfig.currency || "ج.م"
  };
}

/**
 * Public portal response: supplier accepts or declines.
 */
async function respondSupplyRequest(subdomain, token, { action, notes = "" }) {
  if (!token) throw new Error("رمز التحقق مطلوب");
  if (!["accept", "decline"].includes(action)) {
    throw new Error("الإجراء يجب أن يكون accept أو decline");
  }

  const WaterfallModel = getSupplyWaterfallRequestModel(subdomain);
  const StoreNotification = getStoreNotificationModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);
  const Activity = getActivityModel(subdomain);

  const req = await WaterfallModel.findOne({ "chain.token": token });
  if (!req) throw new Error("طلب التوريد غير موجود");

  const matchingIndex = req.chain.findIndex((c) => c.token === token);
  if (matchingIndex === -1) throw new Error("رمز التحقق غير صالح");

  const adminConfig = (await AdminData.findOne({}).lean()) || {};
  const currentSup = req.chain[matchingIndex];
  const now = new Date();

  // 1. ACCEPT ACTION
  if (action === "accept") {
    currentSup.status = "accepted";
    currentSup.respondedAt = now;
    currentSup.responseNotes = notes.trim();

    req.status = "accepted";
    req.acceptedSupplier = {
      supplierId: currentSup.supplierId,
      supplierName: currentSup.supplierName,
      supplierPhone: currentSup.supplierPhone,
      supplierWhatsapp: currentSup.supplierWhatsapp,
      acceptedAt: now,
      notes: notes.trim()
    };

    await req.save();

    // Create In-App Notification for Dashboard
    try {
      await StoreNotification.create({
        title: `✅ تأكيد جاهزية التوريد: ${currentSup.supplierName}`,
        message: `وافق المورد «${currentSup.supplierName}» على توريد (${req.quantity} قطعة) من الصنف «${req.productName}». كود الطلب: #${req.requestCode}. ${notes ? `ملاحظات: ${notes}` : ""}`,
        type: "general",
        link: "/admin/finance/procurement"
      });
    } catch (notifErr) {
      console.warn("[WATERFALL_NOTIF_ERR]", notifErr.message);
    }

    // Alert Admin / Store Owner via WhatsApp
    const adminPhone = (adminConfig.storeWhatsapp || adminConfig.phone || adminConfig.whatsapp || "").replace(/\D/g, "");
    if (adminPhone) {
      const adminMsg = [
        `🔔 *إشعار جاهزية توريد جديد (${adminConfig.siteName || "المتجر"})*`,
        `قام المورد *${currentSup.supplierName}* بالموافقة وتأكيد الجاهزية للتوريد!`,
        ``,
        `📋 رقم الطلب: *#${req.requestCode}*`,
        `📦 المنتج: *${req.productName}*`,
        `🔢 الكمية: *${req.quantity} قطعة*`,
        `📞 هاتف المورد: ${currentSup.supplierPhone || currentSup.supplierWhatsapp || "غير مسجل"}`,
        notes ? `📝 ملاحظة المورد: ${notes}` : ""
      ].filter(Boolean).join("\n");

      try {
        await sendWhatsAppNotification(subdomain, {
          recipientPhone: adminPhone,
          message: adminMsg
        });
      } catch (waErr) {
        console.warn("[WATERFALL_ADMIN_WA_ERR]", waErr.message);
      }
    }

    // Log Activity
    try {
      await Activity.create({
        event: "procurement_supplier_accepted",
        entity: "storeSupplyWaterfallRequest",
        entityId: String(req._id),
        details: {
          requestCode: req.requestCode,
          supplierName: currentSup.supplierName,
          quantity: req.quantity,
          notes
        }
      });
    } catch (_) {}

    return {
      success: true,
      message: "تم تسجيل موافقتك وجاهزية التوريد بنجاح! تم إشعار إدارة المتجر فوراً.",
      status: "accepted"
    };
  }

  // 2. DECLINE ACTION -> Advance to Next Supplier
  if (action === "decline") {
    currentSup.status = "declined";
    currentSup.respondedAt = now;
    currentSup.responseNotes = notes.trim();

    const nextIndex = matchingIndex + 1;

    if (nextIndex < req.chain.length) {
      // Advance to next supplier
      req.currentSupplierIndex = nextIndex;
      const nextSup = req.chain[nextIndex];
      nextSup.status = "contacted";
      nextSup.contactedAt = now;

      await req.save();

      // Trigger message to next supplier
      const baseUrl = getSiteBaseUrl(subdomain);
      const nextTaskUrl = `${baseUrl}/supplier/supply-request/${nextSup.token}`;
      const nextCleanPhone = (nextSup.supplierWhatsapp || nextSup.supplierPhone || "").replace(/\D/g, "");

      const nextMessageText = [
        `السلام عليكم ورحمة الله وبركاته،`,
        `تحية طيبة إلى السيد/ *${nextSup.supplierName}* المحترم،`,
        ``,
        `يوجد طلب توريد عاجل من متجر *${adminConfig.siteName || "متجرنا"}*:`,
        `📦 الصنف: *${req.productName}*`,
        `🔢 الكمية المطلوبة: *${req.quantity} قطعة*`,
        ``,
        `يرجى تأكيد إمكانية التوريد والجاهزية عبر الرابط المباشر التالي:`,
        nextTaskUrl
      ].join("\n");

      try {
        if (nextCleanPhone) {
          await sendWhatsAppNotification(subdomain, {
            recipientPhone: nextCleanPhone,
            message: nextMessageText
          });
        }
      } catch (waErr) {
        console.warn("[NEXT_SUPPLIER_WA_WARN]", waErr.message);
      }

      // Notify dashboard about cascade
      try {
        await StoreNotification.create({
          title: `🔄 اعتذار مورد وتمرير الطلب للبديل التالي`,
          message: `اعتذر المورد «${currentSup.supplierName}» عن توريد (${req.productName}). تم تحويل الطلب تلقائياً للمورد البديل: «${nextSup.supplierName}» (أولوية ${nextSup.priority}).`,
          type: "general",
          link: "/admin/finance/procurement"
        });
      } catch (_) {}

      return {
        success: true,
        message: "تم تسجيل اعتذارك بنجاح. شكراً لإبلاغنا في أقرب وقت.",
        status: "declined",
        cascadedTo: nextSup.supplierName
      };
    } else {
      // No more suppliers in chain!
      req.status = "all_declined";
      await req.save();

      // Alert dashboard that all suppliers declined
      try {
        await StoreNotification.create({
          title: `⚠️ تعذر توفير طلب التوريد (اعتذار كافة الموردين)`,
          message: `اعتذر جميع الموردين في القائمة عن توريد (${req.productName}) - الكمية (${req.quantity}). يرجى اتخاذ إجراء يدوي أو البحث عن موردين جدد.`,
          type: "critical_stock_alert",
          link: "/admin/finance/procurement"
        });
      } catch (_) {}

      // Alert Admin on WhatsApp
      const adminPhone = (adminConfig.storeWhatsapp || adminConfig.phone || adminConfig.whatsapp || "").replace(/\D/g, "");
      if (adminPhone) {
        try {
          await sendWhatsAppNotification(subdomain, {
            recipientPhone: adminPhone,
            message: `⚠️ تنبيه من ${adminConfig.siteName || "المتجر"}:\nاعتذر كافة الموردين عن توفير طلب التوريد رقم #${req.requestCode} للمنتج (${req.productName}). يرجى مراجعة إدارة المشتريات.`
          });
        } catch (_) {}
      }

      return {
        success: true,
        message: "تم تسجيل اعتذارك بنجاح. شكراً لتعاونكم.",
        status: "all_declined"
      };
    }
  }
}

/**
 * Admin: List all waterfall requests with pagination & status filter.
 */
async function listWaterfallRequests(subdomain, options = {}) {
  const WaterfallModel = getSupplyWaterfallRequestModel(subdomain);
  const { status, limit = 20, page = 1, search } = options;

  const query = {};
  if (status && status !== "all") {
    query.status = status;
  }
  if (search) {
    const rx = new RegExp(search, "i");
    query.$or = [{ requestCode: rx }, { productName: rx }, { "chain.supplierName": rx }];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const total = await WaterfallModel.countDocuments(query);
  const requests = await WaterfallModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .populate("branchId", "name code city")
    .lean();

  const baseUrl = getSiteBaseUrl(subdomain);

  const enriched = requests.map((r) => {
    const currentSup = r.chain[r.currentSupplierIndex] || r.chain[0] || null;
    const cleanPhone = (currentSup?.supplierWhatsapp || currentSup?.supplierPhone || "").replace(/\D/g, "");
    const taskUrl = currentSup?.token ? `${baseUrl}/supplier/supply-request/${currentSup.token}` : "";
    const directWaLink = cleanPhone && taskUrl ? buildWhatsAppDirectLink(cleanPhone, `طلب توريد: ${taskUrl}`) : "";

    return {
      ...r,
      activeSupplier: currentSup,
      taskUrl,
      directWaLink
    };
  });

  return {
    requests: enriched,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / parseInt(limit, 10))
    }
  };
}

/**
 * Admin: Aggregated Supplier Performance & Acceptance Rate Statistics.
 */
async function getSupplierPerformanceStats(subdomain) {
  const WaterfallModel = getSupplyWaterfallRequestModel(subdomain);
  const requests = await WaterfallModel.find({}).lean();

  const supplierStatsMap = {};

  let totalRequests = requests.length;
  let acceptedRequests = 0;
  let declinedRequests = 0;
  let pendingRequests = 0;

  for (const r of requests) {
    if (r.status === "accepted") acceptedRequests++;
    else if (r.status === "all_declined") declinedRequests++;
    else if (r.status === "in_progress") pendingRequests++;

    for (const c of r.chain) {
      const key = String(c.supplierId || c.supplierName);
      if (!supplierStatsMap[key]) {
        supplierStatsMap[key] = {
          supplierId: c.supplierId,
          supplierName: c.supplierName,
          phone: c.supplierPhone || c.supplierWhatsapp,
          contactedCount: 0,
          acceptedCount: 0,
          declinedCount: 0,
          pendingCount: 0,
          totalResponseTimeMs: 0,
          respondedCount: 0
        };
      }

      const st = supplierStatsMap[key];
      if (c.status === "contacted") {
        st.contactedCount++;
        st.pendingCount++;
      } else if (c.status === "accepted") {
        st.contactedCount++;
        st.acceptedCount++;
        if (c.contactedAt && c.respondedAt) {
          st.totalResponseTimeMs += new Date(c.respondedAt).getTime() - new Date(c.contactedAt).getTime();
          st.respondedCount++;
        }
      } else if (c.status === "declined") {
        st.contactedCount++;
        st.declinedCount++;
        if (c.contactedAt && c.respondedAt) {
          st.totalResponseTimeMs += new Date(c.respondedAt).getTime() - new Date(c.contactedAt).getTime();
          st.respondedCount++;
        }
      }
    }
  }

  const suppliersList = Object.values(supplierStatsMap).map((s) => {
    const acceptanceRate = s.contactedCount > 0
      ? Math.round((s.acceptedCount / s.contactedCount) * 100)
      : 0;
    const avgResponseTimeHours = s.respondedCount > 0
      ? +(s.totalResponseTimeMs / (s.respondedCount * 3600 * 1000)).toFixed(1)
      : null;

    return {
      supplierId: s.supplierId,
      supplierName: s.supplierName,
      phone: s.phone,
      contactedCount: s.contactedCount,
      acceptedCount: s.acceptedCount,
      declinedCount: s.declinedCount,
      acceptanceRate,
      avgResponseTimeHours
    };
  }).sort((a, b) => b.acceptanceRate - a.acceptanceRate);

  const overallAcceptanceRate = totalRequests > 0
    ? Math.round((acceptedRequests / totalRequests) * 100)
    : 0;

  return {
    overview: {
      totalRequests,
      acceptedRequests,
      declinedRequests,
      pendingRequests,
      overallAcceptanceRate
    },
    suppliers: suppliersList
  };
}

module.exports = {
  createWaterfallRequest,
  getSupplyRequestByToken,
  respondSupplyRequest,
  listWaterfallRequests,
  getSupplierPerformanceStats
};
