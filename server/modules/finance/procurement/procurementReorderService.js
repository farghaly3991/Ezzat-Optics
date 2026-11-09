/**
 * Supplier Procurement Reorder & Critical Stock Alerting Service
 *
 * Provides:
 * 1. Critical & out-of-stock product retrieval with multi-faceted filtering & pagination.
 * 2. Automated Supplier-Grouping & professional Arabic WhatsApp procurement proposal builder.
 * 3. Execution of procurement reorders (WhatsApp Direct, Cloud API, or Clipboard Copy).
 * 4. Auditable historical log of reorders with re-send capabilities.
 * 5. 6-Hour background worker for critical stock notification & proactive monitoring.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const getProductsModel = require("../../products/productModel");
const getCategoriesModel = require("../../categories/categoryModel");
const getSupplierModel = require("./supplierModel");
const getProcurementReorderModel = require("./procurementReorderModel");
const getStoreNotificationModel = require("../../product-requests/notificationModel");
const getActivityModel = require("../../activity/activityModel");
const getOrdersModel = require("../../orders/orderModel");
const {
  checkWhatsAppAvailability,
  buildWhatsAppDirectLink,
  sendWhatsAppNotification
} = require("../../product-requests/notificationService");
const { recordFinanceAudit } = require("../core/audit/auditService");
const getAdminDataModel = require("../../settings/adminDataModel");

async function getTenantAdminData(subdomain) {
  try {
    const AdminData = getAdminDataModel(subdomain);
    return (await AdminData.findOne({}).lean()) || {};
  } catch {
    return {};
  }
}

async function generateReorderCode(Model) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const rnd = crypto.randomBytes(2).toString("hex").toUpperCase();
    const candidate = `REO-${dateStr}-${rnd}`;
    const exists = await Model.exists({ reorderCode: candidate });
    if (!exists) return candidate;
  }
  return `REO-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * 1. Get critical and out-of-stock products with advanced filtering and pagination.
 */
async function getCriticalAndOutOfStockProducts(subdomain, options = {}) {
  const Products = getProductsModel(subdomain);
  const {
    supplierId = "",
    search = "",
    page = 1,
    sortBy = "stock_asc"
  } = options;

  const statusFilter =
    options.statusFilter ||
    (["out_of_stock", "critical"].includes(options.filterType) ? options.filterType : "all");

  const hasSupplier =
    options.hasSupplier ||
    (["with_supplier", "no_supplier", "without_supplier"].includes(options.filterType)
      ? options.filterType
      : "all");

  const limit = Math.max(
    1,
    Math.min(parseInt(options.limit || options.pageSize || 10, 10) || 10, 100)
  );

  const query = {};

  if (statusFilter === "out_of_stock") {
    query.stockCount = { $lte: 0 };
  } else if (statusFilter === "critical") {
    query.$and = (query.$and || []).concat([
      { stockCount: { $gt: 0 } },
      { $expr: { $lte: ["$stockCount", { $ifNull: ["$criticalStockThreshold", 3] }] } }
    ]);
  } else {
    // "all" critical or out of stock
    query.$or = [
      { stockCount: { $lte: 0 } },
      { $expr: { $lte: ["$stockCount", { $ifNull: ["$criticalStockThreshold", 3] }] } }
    ];
  }

  if (hasSupplier === "with_supplier") {
    query.supplierId = { $exists: true, $ne: null };
  } else if (hasSupplier === "no_supplier" || hasSupplier === "without_supplier") {
    query.$and = (query.$and || []).concat([
      { $or: [{ supplierId: null }, { supplierId: { $exists: false } }] }
    ]);
  }

  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    query.supplierId = supplierId;
  }

  if (search && String(search).trim()) {
    const rx = { $regex: String(search).trim(), $options: "i" };
    query.$and = (query.$and || []).concat([
      { $or: [{ name: rx }, { groupCode: rx }, { tags: rx }] }
    ]);
  }

  let sort = { stockCount: 1, createdAt: -1 };
  if (sortBy === "stock_desc") sort = { stockCount: -1 };
  if (sortBy === "name_asc") sort = { name: 1 };
  if (sortBy === "recent") sort = { createdAt: -1 };

  const p = Math.max(1, parseInt(page, 10) || 1);

  // Compute summary stats across all products for this tenant
  const [totalProducts, allOutCount, allCritCount, withSupCount] = await Promise.all([
    Products.countDocuments(query),
    Products.countDocuments({ stockCount: { $lte: 0 } }),
    Products.countDocuments({ stockCount: { $lte: 3, $gt: 0 } }),
    Products.countDocuments({
      supplierId: { $exists: true, $ne: null },
      $or: [{ stockCount: { $lte: 0 } }, { stockCount: { $lte: 3 } }]
    })
  ]);

  const rawProducts = await Products.find(query)
    .populate("categoryId", "name displayName")
    .populate("supplierId", "name phone whatsappPhone email specialty address notes")
    .sort(sort)
    .skip((p - 1) * limit)
    .limit(limit)
    .lean();

  const products = rawProducts.map((prod) => {
    const critThreshold = prod.criticalStockThreshold !== undefined ? prod.criticalStockThreshold : 3;
    const isOut = (prod.stockCount || 0) <= 0;
    const isCrit = !isOut && (prod.stockCount || 0) <= critThreshold;

    return {
      ...prod,
      supplier: prod.supplierId && typeof prod.supplierId === "object" ? prod.supplierId : null,
      isOutOfStock: isOut,
      isCritical: isCrit,
      effectiveCriticalThreshold: critThreshold,
      suggestedReorderQuantity: prod.reorderQuantity || 10,
      hasSupplier: Boolean(prod.supplierId)
    };
  });

  return {
    products,
    pagination: {
      total: totalProducts,
      page: p,
      pageSize: limit,
      limit,
      pages: Math.max(1, Math.ceil(totalProducts / limit)),
      totalPages: Math.max(1, Math.ceil(totalProducts / limit))
    },
    counts: {
      all: totalProducts,
      outOfStock: allOutCount,
      critical: allCritCount,
      withSupplier: withSupCount,
      withoutSupplier: Math.max(0, totalProducts - withSupCount)
    },
    summary: {
      totalLowOrOut: totalProducts,
      outOfStockCount: allOutCount,
      criticalStockCount: allCritCount,
      withSupplierCount: withSupCount
    }
  };
}

/**
 * 2. Generate supplier-grouped reorder proposals and formatted Arabic WhatsApp messages.
 */
async function generateSupplierReordersProposal(subdomain, payload = {}, req = null) {
  const Products = getProductsModel(subdomain);
  const Supplier = getSupplierModel(subdomain);
  const adminData = req?.adminData || (await getTenantAdminData(subdomain));
  const storeName = adminData.siteName || adminData.storeName || "متجرنا التجاري";

  const { productIds = [], itemsOverride = [] } = payload;

  const overrideMap = new Map();
  if (Array.isArray(itemsOverride)) {
    itemsOverride.forEach((it) => {
      if (it.productId) {
        overrideMap.set(String(it.productId), {
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitCost: Number(it.unitCost) || 0
        });
      }
    });
  }

  const queryIds = productIds.filter((id) => mongoose.isValidObjectId(id));
  if (queryIds.length === 0 && overrideMap.size === 0) {
    return { proposals: [], unassignedProducts: [], totalGroups: 0 };
  }

  const allTargetIds = Array.from(new Set([...queryIds, ...Array.from(overrideMap.keys())]));
  const foundProducts = await Products.find({ _id: { $in: allTargetIds } })
    .populate("categoryId", "name displayName")
    .populate("supplierId")
    .lean();

  const supplierGroups = new Map();
  const unassignedProducts = [];

  for (const prod of foundProducts) {
    const override = overrideMap.get(String(prod._id));
    const qty = override ? override.quantity : Math.max(1, Number(prod.reorderQuantity) || 10);
    const cost = override && override.unitCost ? override.unitCost : Number(prod.costPrice) || 0;

    const itemData = {
      productId: prod._id,
      name: prod.name,
      image: Array.isArray(prod.images) && prod.images[0] ? prod.images[0] : "",
      category: prod.categoryId?.displayName || prod.categoryId?.name || "",
      stockCount: prod.stockCount || 0,
      criticalStockThreshold: prod.criticalStockThreshold !== undefined ? prod.criticalStockThreshold : 3,
      quantity: qty,
      unitCost: cost,
      lineTotal: qty * cost
    };

    if (prod.supplierId && prod.supplierId._id) {
      const supId = String(prod.supplierId._id);
      if (!supplierGroups.has(supId)) {
        supplierGroups.set(supId, {
          supplier: prod.supplierId,
          items: []
        });
      }
      supplierGroups.get(supId).items.push(itemData);
    } else {
      unassignedProducts.push(itemData);
    }
  }

  const proposals = [];
  const waStatus = checkWhatsAppAvailability(adminData);

  for (const [supId, group] of supplierGroups.entries()) {
    const sup = group.supplier;
    const items = group.items;
    const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);
    const totalEstimatedCost = items.reduce((acc, it) => acc + it.lineTotal, 0);
    const targetPhone = (sup.whatsappPhone || sup.phone || "").trim();

    // Arabic formatted WhatsApp order text
    const today = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const itemsText = items
      .map(
        (it, idx) =>
          `🔹 *${idx + 1}. ${it.name}*\n   • الكمية المطلوبة: *${it.quantity} قطعة* (المخزون الحالي: ${it.stockCount})`
      )
      .join("\n\n");

    const message = [
      `السلام عليكم ورحمة الله وبركاته،`,
      `تحية طيبة إلى السيد/ *${sup.name}* المحترم،`,
      ``,
      `📦 *طلب توريد بضاعة جديد من:* ${storeName}`,
      `📅 *التاريخ:* ${today}`,
      `🏢 *المورد:* ${sup.name}${sup.specialty ? ` (${sup.specialty})` : ""}`,
      ``,
      `يرجى التكرم بتجهيز وتوريد الأصناف والكميات التالية على وجه السرعة:`,
      `---------------------------------`,
      itemsText,
      `---------------------------------`,
      `📊 *إجمالي عدد الوحدات المطلوبة:* *${totalQty} قطعة*`,
      ``,
      `يرجى موافاتنا بتأكيد الاستلام، الموعد التقريبي للتسليم، والفاتورة المبدئية.`,
      `شاكرين ومقدرين حسن تعاونكم الدائم معنا.`
    ].join("\n");

    const directLink = targetPhone ? buildWhatsAppDirectLink(targetPhone, message) : "";

    proposals.push({
      supplierId: sup._id,
      supplierCode: sup.supplierCode,
      supplierName: sup.name,
      supplierPhone: sup.phone || "",
      supplierWhatsapp: sup.whatsappPhone || sup.phone || "",
      specialty: sup.specialty || "",
      items,
      totalQuantity: totalQty,
      totalEstimatedCost,
      messageText: message,
      directWhatsAppLink: directLink,
      isWhatsAppApiConfigured: waStatus.isConfigured
    });
  }

  return {
    proposals,
    unassignedProducts,
    totalGroups: proposals.length,
    whatsappConfig: waStatus
  };
}

/**
 * 3. Confirm, dispatch, and persist a supplier procurement order.
 */
async function dispatchAndRecordSupplierReorder(subdomain, payload = {}, actor = null, req = null) {
  const ProcurementReorder = getProcurementReorderModel(subdomain);
  const Supplier = getSupplierModel(subdomain);
  const supplyWaterfallService = require("./supplyWaterfallService");
  const adminData = req?.adminData || (await getTenantAdminData(subdomain)) || {};

  const {
    supplierId,
    supplierName,
    supplierPhone,
    supplierWhatsapp,
    items = [],
    messageText = "",
    notes = "",
    waterfallRequestCode: passedWaterfallCode = "",
    trackingPortalUrl: passedTrackingUrl = "",
    channel = "whatsapp_direct" // "whatsapp_direct" | "whatsapp_api" | "manual_copy"
  } = payload;

  if (!items || items.length === 0) {
    const err = new Error("يجب تحديد منتج واحد على الأقل في طلب التوريد");
    err.status = 400;
    throw err;
  }

  let supDoc = null;
  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    supDoc = await Supplier.findById(supplierId).lean();
  }

  const finalSupplierName = String(supDoc?.name || supplierName || "مورد غير محدد").trim();
  const finalPhone = String(supplierPhone || supDoc?.phone || "").trim();
  const finalWhatsapp = String(supplierWhatsapp || supDoc?.whatsappPhone || finalPhone).trim();

  // Consolidate multiple single-cell items belonging to the same matrix lens product into a clean master item with matrixBreakdown
  const consolidatedMap = new Map();
  const normalizedItems = [];

  for (const it of items) {
    const pid = it.productId && mongoose.isValidObjectId(it.productId) ? String(it.productId) : null;
    const rawSpecs = it.specs || it.lensSpecs || it.frameSpecs || {};
    const hasSingleCellSpec =
      pid &&
      rawSpecs.sph !== undefined &&
      rawSpecs.sph !== "" &&
      (!Array.isArray(rawSpecs.matrixBreakdown) || rawSpecs.matrixBreakdown.length === 0);

    if (hasSingleCellSpec) {
      if (!consolidatedMap.has(pid)) {
        // Strip "(SPH: ... | CYL: ...)" suffix from master product name if present
        const cleanMasterName = String(it.baseProductName || it.name || it.productName || "عدسة طبية")
          .replace(/\s*\((?:SPH|CYL)[^)]*\)\s*$/i, "")
          .trim();
        consolidatedMap.set(pid, {
          productId: it.productId,
          name: cleanMasterName,
          image: it.image || "",
          category: it.category || "",
          quantity: 0,
          unitCost: Number(it.unitCost) || 0,
          stockAtOrder: Number(it.stockAtOrder !== undefined ? it.stockAtOrder : it.stockCount || 0),
          criticalStockThreshold: Number(it.criticalStockThreshold || 3),
          specs: {
            axisXName: rawSpecs.axisXName || "SPH",
            axisYName: rawSpecs.axisYName || "CYL",
            matrixBreakdown: []
          },
          unitSlotKey: it.unitSlotKey || "",
          unitSlotLabel: it.unitSlotLabel || "",
          orderId: it.orderId || "",
          customerName: it.customerName || "",
          customerPhone: it.customerPhone || ""
        });
        normalizedItems.push(consolidatedMap.get(pid));
      }
      const group = consolidatedMap.get(pid);
      const cellQty = Math.max(1, Number(it.quantity) || 1);
      group.quantity += cellQty;
      group.specs.matrixBreakdown.push({
        cell: `${rawSpecs.sph}_${rawSpecs.cyl || "0.00"}`,
        sph: String(rawSpecs.sph),
        cyl: String(rawSpecs.cyl || "0.00"),
        currentStock: Number(it.currentStock ?? it.stockAtOrder ?? 0),
        qty: Number(it.currentStock ?? it.stockAtOrder ?? 0),
        neededQty: cellQty,
        quantity: cellQty
      });
    } else {
      normalizedItems.push({
        productId: it.productId && mongoose.isValidObjectId(it.productId) ? it.productId : null,
        name: it.name || it.productName || "صنف توريد",
        image: it.image || "",
        category: it.category || "",
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitCost: Number(it.unitCost) || 0,
        stockAtOrder: Number(it.stockAtOrder !== undefined ? it.stockAtOrder : it.stockCount || 0),
        criticalStockThreshold: Number(it.criticalStockThreshold || 3),
        specs: rawSpecs,
        unitSlotKey: it.unitSlotKey || "",
        unitSlotLabel: it.unitSlotLabel || "",
        orderId: it.orderId || "",
        customerName: it.customerName || "",
        customerPhone: it.customerPhone || ""
      });
    }
  }

  const reorderCode = await generateReorderCode(ProcurementReorder);
  const totalQty = normalizedItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
  const totalCost = normalizedItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unitCost) || 0),
    0
  );

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3005";
  let waterfallRequestCode = passedWaterfallCode;
  let trackingPortalUrl = passedTrackingUrl;

  // Automatically create a Supplier Waterfall Tracking Link if not already provided
  if (!trackingPortalUrl && supDoc?._id) {
    const firstCatalogItem = normalizedItems.find((it) => it.productId && mongoose.isValidObjectId(it.productId));
    if (firstCatalogItem) {
      try {
        const wfRes = await supplyWaterfallService.createWaterfallRequest(
          subdomain,
          {
            productId: firstCatalogItem.productId,
            orderTitle:
              normalizedItems.length > 1
                ? `أمر توريد مجمع (${normalizedItems.length} أصناف - ${reorderCode})`
                : firstCatalogItem.name,
            quantity: totalQty,
            estimatedCost: totalCost,
            items: normalizedItems.map((it) => ({
              productId: it.productId,
              name: it.name,
              quantity: it.quantity,
              unitCost: it.unitCost,
              matrixBreakdown: Array.isArray(it.specs?.matrixBreakdown) ? it.specs.matrixBreakdown : []
            })),
            supplierIds: [supDoc._id],
            notes: notes || `أمر توريد صادر برقم (${reorderCode})`
          },
          {
            userId: actor?._id || actor?.userId || null,
            role: actor?.role || "admin",
            fullname: actor?.fullname || "إدارة المشتريات والتوريدات"
          }
        );
        waterfallRequestCode = wfRes?.request?.requestCode || "";
        trackingPortalUrl = wfRes?.taskUrl || "";
      } catch (wfErr) {
        console.warn("[REORDER_AUTO_WATERFALL_WARN]:", wfErr.message);
      }
    }
  }

  let finalMessageText = String(messageText || "").trim();
  if (!finalMessageText) {
    const itemsLines = normalizedItems
      .map((it, idx) => {
        const bd = Array.isArray(it.specs?.matrixBreakdown) ? it.specs.matrixBreakdown : [];
        const sample =
          bd.length > 0
            ? `\n   • مقاسات الدرج المطلوبة (${bd.length} مقاس): ` +
              bd
                .slice(0, 5)
                .map((c) => `${c.sph}/${c.cyl}×${c.neededQty || c.quantity}`)
                .join("، ") +
              (bd.length > 5 ? ` (+${bd.length - 5} مقاس بالجدول)` : "")
            : "";
        return `🔹 ${idx + 1}. ${it.name} — المطلوب: ${it.quantity} وحدة${sample}`;
      })
      .join("\n");

    finalMessageText = [
      `السلام عليكم، السادة / ${finalSupplierName}`,
      `📦 أمر توريد بضاعة ونواقص رقم (${reorderCode})`,
      `---------------------------------`,
      itemsLines,
      `---------------------------------`,
      `📊 إجمالي الوحدات: ${totalQty} وحدة | التكلفة التقديرية: ${totalCost.toLocaleString()} ج.م`,
      trackingPortalUrl ? `🔗 لعرض جدول المقاسات التفصيلي وتأكيد جاهزية التوريد بضغطة زر:\n${trackingPortalUrl}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  } else if (trackingPortalUrl && !finalMessageText.includes(trackingPortalUrl)) {
    finalMessageText += `\n\n🔗 لعرض جدول المقاسات التفصيلي وتأكيد التوريد بضغطة زر:\n${trackingPortalUrl}`;
  }

  let dispatchResult = { success: true };
  let finalStatus = "sent";

  // If WhatsApp API channel requested and phone number available
  if (channel === "whatsapp_api" && finalWhatsapp) {
    try {
      const waRes = await sendWhatsAppNotification({
        phone: finalWhatsapp,
        message: finalMessageText,
        adminData
      });
      dispatchResult = waRes;
      if (!waRes.success) {
        finalStatus = "pending";
      }
    } catch (waErr) {
      console.warn("[REORDER_WHATSAPP_DISPATCH_WARN]", waErr.message);
      finalStatus = "pending";
      dispatchResult = { success: false, error: waErr.message };
    }
  }

  const newReorder = await new ProcurementReorder({
    reorderCode,
    supplierId: supDoc?._id || null,
    supplierName: finalSupplierName,
    supplierPhone: finalPhone,
    supplierWhatsapp: finalWhatsapp,
    items: normalizedItems,
    totalQuantity: totalQty,
    totalEstimatedCost: totalCost,
    notes: String(notes || "").trim(),
    waterfallRequestCode,
    trackingPortalUrl,
    messageText: finalMessageText,
    status: finalStatus,
    channel,
    sentAt: new Date(),
    sentBy: actor?._id || actor?.userId || null
  }).save();

  await recordFinanceAudit(subdomain, {
    action: "SUPPLIER_REORDER_DISPATCHED",
    entityType: "procurement_reorder",
    entityId: newReorder._id,
    notes: `تم إنشاء وإرسال طلب توريد برقم (${reorderCode}) إلى المورد ${finalSupplierName} بعدد ${totalQty} وحدة`,
    actor
  });

  return {
    reorder: newReorder.toObject(),
    dispatchResult,
    waterfallRequestCode,
    trackingPortalUrl,
    shortWhatsAppUrl: `${baseUrl}/api/procurement-public/whatsapp/${reorderCode}`,
    directWhatsAppLink: finalWhatsapp ? buildWhatsAppDirectLink(finalWhatsapp, finalMessageText) : ""
  };
}

/**
 * 4. List previous supplier reorders with pagination & search.
 */
async function listSupplierReorders(subdomain, options = {}) {
  const ProcurementReorder = getProcurementReorderModel(subdomain);
  const { page = 1, pageSize = 15, search = "", status = "all", supplierId = "" } = options;

  const query = {};
  if (status !== "all" && status) {
    query.status = status;
  }
  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    query.supplierId = supplierId;
  }
  if (search && String(search).trim()) {
    const rx = { $regex: String(search).trim(), $options: "i" };
    query.$or = [{ reorderCode: rx }, { supplierName: rx }, { supplierPhone: rx }, { "items.name": rx }];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(pageSize, 10) || 15, 100));

  const [total, reorders] = await Promise.all([
    ProcurementReorder.countDocuments(query),
    ProcurementReorder.find(query)
      .populate("supplierId", "name phone whatsappPhone email specialty")
      .sort({ sentAt: -1, createdAt: -1 })
      .skip((p - 1) * limit)
      .limit(limit)
      .lean()
  ]);

  return {
    reorders,
    pagination: {
      total,
      page: p,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

/**
 * 5. Update reorder status (e.g. completed, cancelled).
 */
async function updateSupplierReorderStatus(subdomain, reorderId, newStatus, actor = null) {
  const ProcurementReorder = getProcurementReorderModel(subdomain);
  const Products = getProductsModel(subdomain);
  const reorder = await ProcurementReorder.findById(reorderId);
  if (!reorder) {
    const err = new Error("طلب التوريد غير موجود");
    err.status = 404;
    throw err;
  }

  const validStatuses = ["pending", "sent", "partially_fulfilled", "completed", "cancelled"];
  if (!validStatuses.includes(newStatus)) {
    const err = new Error("حالة طلب التوريد غير صالحة");
    err.status = 400;
    throw err;
  }

  const prevStatus = reorder.status;
  reorder.status = newStatus;
  await reorder.save();

  // Automatically replenish inventory & lens matrix drawer cells when transitioning to "completed"
  if (newStatus === "completed" && prevStatus !== "completed") {
    for (const it of reorder.items || []) {
      if (!it.productId || !mongoose.isValidObjectId(it.productId)) continue;
      const prod = await Products.findById(it.productId);
      if (!prod) continue;

      const matrixBreakdown = it.specs?.matrixBreakdown;
      if (Array.isArray(matrixBreakdown) && matrixBreakdown.length > 0) {
        if (!prod.opticsSpecs) prod.opticsSpecs = {};
        if (!prod.opticsSpecs.matrixStock) prod.opticsSpecs.matrixStock = {};
        let addedTotal = 0;
        for (const cell of matrixBreakdown) {
          const cellKey = cell.cell || `${cell.sph}_${cell.cyl || "0.00"}`;
          const addQty = Math.max(0, Number(cell.neededQty || cell.quantity || 0));
          if (addQty > 0) {
            prod.opticsSpecs.matrixStock[cellKey] =
              Math.max(0, Number(prod.opticsSpecs.matrixStock[cellKey] || 0)) + addQty;
            addedTotal += addQty;
          }
        }
        prod.opticsSpecs.isMatrixManaged = true;
        prod.storeStock = Number(prod.storeStock || 0) + addedTotal;
        prod.stockCount = Number(prod.stockCount || 0) + addedTotal;
        prod.markModified("opticsSpecs");
        prod.markModified("opticsSpecs.matrixStock");
        await prod.save();
      } else if (it.specs?.sph) {
        if (!prod.opticsSpecs) prod.opticsSpecs = {};
        if (!prod.opticsSpecs.matrixStock) prod.opticsSpecs.matrixStock = {};
        const cellKey = `${it.specs.sph}_${it.specs.cyl || "0.00"}`;
        const addQty = Math.max(1, Number(it.quantity || 1));
        prod.opticsSpecs.matrixStock[cellKey] =
          Math.max(0, Number(prod.opticsSpecs.matrixStock[cellKey] || 0)) + addQty;
        prod.opticsSpecs.isMatrixManaged = true;
        prod.storeStock = Number(prod.storeStock || 0) + addQty;
        prod.stockCount = Number(prod.stockCount || 0) + addQty;
        prod.markModified("opticsSpecs");
        prod.markModified("opticsSpecs.matrixStock");
        await prod.save();
      } else {
        const addQty = Math.max(1, Number(it.quantity || 1));
        prod.storeStock = Number(prod.storeStock || 0) + addQty;
        prod.stockCount = Number(prod.stockCount || 0) + addQty;
        await prod.save();
      }
    }
  }

  await recordFinanceAudit(subdomain, {
    action: "SUPPLIER_REORDER_STATUS_CHANGED",
    entityType: "procurement_reorder",
    entityId: reorder._id,
    notes: `تم تغيير حالة طلب التوريد (${reorder.reorderCode}) إلى: ${newStatus}`,
    actor
  });

  return reorder.toObject();
}

/**
 * 6. Periodic Critical Stock Background Checker (every 6 hours).
 */
async function runPeriodicCriticalStockCheck(subdomain) {
  try {
    const Products = getProductsModel(subdomain);
    const StoreNotification = await getStoreNotificationModel(subdomain);
    const adminData = (await getTenantAdminData(subdomain)) || {};

    // Find products linked to suppliers that are critical or zero stock
    const criticalProducts = await Products.find({
      supplierId: { $exists: true, $ne: null },
      $or: [
        { stockCount: { $lte: 0 } },
        { $expr: { $lte: ["$stockCount", { $ifNull: ["$criticalStockThreshold", 3] }] } }
      ]
    })
      .populate("supplierId", "name phone whatsappPhone")
      .limit(50)
      .lean();

    if (criticalProducts.length === 0) return { alertCount: 0 };

    // Group count for single consolidated notification if preferred
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check if an alert was already logged within 24 hours
    const recentAlert = await StoreNotification.findOne({
      type: "critical_stock_alert",
      createdAt: { $gte: twentyFourHoursAgo }
    }).lean();

    if (!recentAlert) {
      const outCount = criticalProducts.filter((p) => (p.stockCount || 0) <= 0).length;
      const critCount = criticalProducts.length - outCount;

      await new StoreNotification({
        title: "⚠️ تنبيه المخزون الحرج والنواقص للموردين",
        message: `يوجد حالياً ${criticalProducts.length} منتج بحاجة للتوريد (${outCount} نافذ بالكامل و ${critCount} قارب على النفاد). يمكنك مراجعة طلبات التوريد واعتمادها بنقرة واحدة.`,
        type: "critical_stock_alert",
        link: "/admin/analytics/commercial",
        isRead: false
      }).save();
    }

    return { alertCount: criticalProducts.length };
  } catch (err) {
    console.error(`[PERIODIC_CRITICAL_STOCK_CHECK_ERROR] [Tenant: ${subdomain}]:`, err.message);
    return { alertCount: 0, error: err.message };
  }
}

/**
 * 6. Get fast-selling products velocity & proactive procurement forecast.
 * Looks back at completed sales (order_completed, customer_sale, completed orders)
 * over the specified period (default: past 30 days from today),
 * calculates sales velocity, days until stockout, and suggests proactive supplier reorders.
 */
async function getFastSellingProcurementForecast(subdomain, options = {}) {
  const Activity = getActivityModel(subdomain);
  const Orders = getOrdersModel(subdomain);
  const Products = getProductsModel(subdomain);

  const days = Math.max(1, Math.min(parseInt(options.days, 10) || 30, 365));
  const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 10, 50));
  const supplierIdFilter = options.supplierId && mongoose.isValidObjectId(options.supplierId) ? options.supplierId : null;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  // 1. Query activity logs for sales and completed orders
  const activitySales = await Activity.aggregate([
    {
      $match: {
        eventType: { $in: ["order_completed", "customer_sale", "order_created"] },
        occurredAt: { $gte: startDate, $lte: endDate },
        productId: { $ne: null }
      }
    },
    {
      $group: {
        _id: "$productId",
        unitsSold: { $sum: { $ifNull: ["$quantity", 1] } },
        ordersCount: { $sum: 1 },
        totalRevenue: { $sum: { $multiply: [{ $ifNull: ["$quantity", 1] }, { $ifNull: ["$unitPrice", 0] }] } },
        lastSoldAt: { $max: "$occurredAt" }
      }
    }
  ]);

  // 2. Query completed/delivered orders within timeframe
  const orderSales = await Orders.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: ["cancelled", "refunded"] }
      }
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": { $ne: null }
      }
    },
    {
      $group: {
        _id: "$items.productId",
        unitsSold: { $sum: { $ifNull: ["$items.quantity", 1] } },
        ordersCount: { $sum: 1 },
        totalRevenue: { $sum: { $multiply: [{ $ifNull: ["$items.quantity", 1] }, { $ifNull: ["$items.price", 0] }] } },
        lastSoldAt: { $max: "$createdAt" }
      }
    }
  ]);

  // 3. Merge both sources (taking authoritative highest sold count)
  const salesMap = new Map();
  function recordSale(idRaw, data) {
    if (!idRaw || !mongoose.isValidObjectId(idRaw)) return;
    const id = String(idRaw);
    if (!salesMap.has(id)) {
      salesMap.set(id, {
        productId: id,
        unitsSold: Number(data.unitsSold || 0),
        ordersCount: Number(data.ordersCount || 0),
        totalRevenue: Number(data.totalRevenue || 0),
        lastSoldAt: data.lastSoldAt || null
      });
    } else {
      const ex = salesMap.get(id);
      ex.unitsSold = Math.max(ex.unitsSold, Number(data.unitsSold || 0));
      ex.ordersCount = Math.max(ex.ordersCount, Number(data.ordersCount || 0));
      ex.totalRevenue = Math.max(ex.totalRevenue, Number(data.totalRevenue || 0));
      if (data.lastSoldAt && (!ex.lastSoldAt || new Date(data.lastSoldAt) > new Date(ex.lastSoldAt))) {
        ex.lastSoldAt = data.lastSoldAt;
      }
    }
  }

  activitySales.forEach((a) => recordSale(a._id, a));
  orderSales.forEach((o) => recordSale(o._id, o));

  // 4. Fallback if fewer than 10 products have 30d sales: include top historical sellers
  if (salesMap.size < limit) {
    const lifetimeProducts = await Products.find({
      salesCount: { $gt: 0 },
      active: true
    })
      .select("_id salesCount price visited")
      .sort({ salesCount: -1 })
      .limit(limit)
      .lean();

    lifetimeProducts.forEach((p) => {
      const id = String(p._id);
      if (!salesMap.has(id)) {
        salesMap.set(id, {
          productId: id,
          unitsSold: Number(p.salesCount || 0),
          ordersCount: Math.ceil((p.salesCount || 1) / 2),
          totalRevenue: Number(p.salesCount || 0) * Number(p.price || 0),
          lastSoldAt: new Date(),
          isLifetimeFallback: true
        });
      }
    });
  }

  const candidateIds = Array.from(salesMap.keys());
  if (candidateIds.length === 0) {
    return {
      timeframeDays: days,
      startDate,
      endDate,
      totalAnalyzed: 0,
      urgentCount: 0,
      items: []
    };
  }

  // 5. Fetch full product & supplier information
  const productQuery = {
    _id: { $in: candidateIds },
    active: true
  };
  if (supplierIdFilter) {
    productQuery.supplierId = supplierIdFilter;
  }

  const productDocs = await Products.find(productQuery)
    .populate("categoryId", "name type")
    .populate("supplierId", "name phone whatsappPhone email specialty address notes")
    .lean();

  const enriched = [];

  for (const prod of productDocs) {
    // Exclude services (only physical products have procurement/inventory)
    if (prod.categoryId?.type === "service" || prod.isService === true) continue;

    const stats = salesMap.get(String(prod._id)) || { unitsSold: 0, ordersCount: 0, totalRevenue: 0 };
    const unitsSold = stats.unitsSold;
    const dailyVelocity = Number((unitsSold / days).toFixed(2));
    const currentStock = Number(prod.stockCount || 0);
    const criticalThreshold = Number(prod.criticalStockThreshold !== undefined ? prod.criticalStockThreshold : 3);

    let daysUntilStockout = 999;
    if (currentStock <= 0) {
      daysUntilStockout = 0;
    } else if (dailyVelocity > 0) {
      daysUntilStockout = Math.round(currentStock / dailyVelocity);
    }

    let urgencyLevel = "safe";
    if (currentStock <= 0) {
      urgencyLevel = "stockout";
    } else if (daysUntilStockout <= 7 || currentStock <= criticalThreshold) {
      urgencyLevel = "critical";
    } else if (daysUntilStockout <= 14) {
      urgencyLevel = "warning";
    } else if (daysUntilStockout <= 30) {
      urgencyLevel = "moderate";
    }

    // Recommended reorder quantity: at least 30 days of sales run-rate, or defined reorderQuantity
    const suggestedReorderQty = Math.max(
      Number(prod.reorderQuantity || 10),
      Math.ceil(dailyVelocity * 30)
    );

    const sup = prod.supplierId && typeof prod.supplierId === "object" ? prod.supplierId : null;

    enriched.push({
      _id: prod._id,
      name: prod.name,
      sku: prod.sku || "",
      images: prod.images || [],
      mainImage: (prod.images && prod.images[0]) || "",
      price: prod.price || 0,
      costPrice: prod.costPrice || 0,
      category: { name: prod.categoryId?.name || "عام" },
      currentStock,
      criticalStockThreshold: criticalThreshold,
      unitsSold: unitsSold,
      unitsSoldPeriod: unitsSold,
      dailyVelocity,
      daysUntilStockout,
      urgencyLevel,
      suggestedReorderQuantity: suggestedReorderQty,
      supplier: sup,
      hasSupplier: Boolean(sup),
      totalRevenue: stats.totalRevenue,
      lastSoldAt: stats.lastSoldAt,
      isLifetimeFallback: Boolean(stats.isLifetimeFallback)
    });
  }

  // 6. Sort by sales velocity descending, then by urgency (fewer days left)
  enriched.sort((a, b) => {
    if (b.unitsSoldPeriod !== a.unitsSoldPeriod) {
      return b.unitsSoldPeriod - a.unitsSoldPeriod;
    }
    return a.daysUntilStockout - b.daysUntilStockout;
  });

  const topItems = enriched.slice(0, limit);
  const urgentCount = enriched.filter((i) => ["stockout", "critical", "warning"].includes(i.urgencyLevel)).length;

  return {
    timeframeDays: days,
    startDate,
    endDate,
    totalAnalyzed: enriched.length,
    urgentCount,
    items: topItems,
    topFastSelling: topItems,
    summary: {
      totalUnitsSold: topItems.reduce((acc, i) => acc + (i.unitsSold || 0), 0),
      totalSuggestedReorder: topItems.reduce((acc, i) => acc + (i.suggestedReorderQuantity || 0), 0)
    }
  };
}

/**
 * Scan all categories and products with dynamic Grid specs to identify depleted/critical cells
 * AND return both structured 2D matrix products AND general non-matrix products across all categories.
 */
async function getGridCriticalAndOutOfStockProducts(subdomain, options = {}) {
  const Products = getProductsModel(subdomain);
  const Categories = getCategoriesModel(subdomain);

  const allCategories = await Categories.find({}).lean();
  const catMap = {};
  allCategories.forEach((c) => {
    catMap[String(c._id)] = c;
  });

  const gridCategories = allCategories.filter((c) => c.hasGridSpecs);
  const allProducts = await Products.find({ active: { $ne: false } })
    .populate("supplierId", "name phone whatsappPhone specialty")
    .lean();

  const missingGridItems = [];
  const matrixProducts = [];
  const generalProducts = [];

  const sortDiopterValues = (arr) =>
    Array.from(new Set(arr)).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        // Put 0.00 first, then negative values descending (0.00, -0.25, -0.50...), then positive values (+0.25, +0.50...)
        if (na === 0) return -1;
        if (nb === 0) return 1;
        if (na < 0 && nb < 0) return nb - na;
        if (na > 0 && nb > 0) return na - nb;
        return na < 0 ? -1 : 1;
      }
      return String(a).localeCompare(String(b));
    });

  for (const prod of allProducts) {
    const cat = catMap[String(prod.categoryId)] || {};
    if (cat.type === "service" || prod.isService === true) continue;

    const gridConfig = cat.gridConfig || {};
    const matrixStock = prod.opticsSpecs?.matrixStock || {};
    const matrixKeys = Object.keys(matrixStock);
    const isMatrixProduct = Boolean(
      (cat.hasGridSpecs || prod.opticsSpecs?.isMatrixManaged) && matrixKeys.length > 0
    );
    const critThreshold = prod.criticalStockThreshold !== undefined ? prod.criticalStockThreshold : 1;

    if (isMatrixProduct) {
      const sphSet = [];
      const cylSet = [];
      const matrixMap = {};
      let outOfStockCellsCount = 0;
      let criticalCellsCount = 0;

      for (const [key, qty] of Object.entries(matrixStock)) {
        const numQty = Number(qty || 0);
        const parts = key.split("_");
        const sph = parts[0] || "0.00";
        const cyl = parts[1] || "0.00";
        sphSet.push(sph);
        cylSet.push(cyl);

        const isOutOfStock = numQty <= 0;
        const isCritical = numQty > 0 && numQty <= critThreshold;
        const suggestedQuantity = Math.max(2, critThreshold * 2 - numQty + 2);
        const itemId = `${prod._id}_${key}`;

        matrixMap[key] = {
          id: itemId,
          productId: prod._id,
          productName: prod.name,
          cellKey: key,
          sph,
          cyl,
          currentStock: numQty,
          isOutOfStock,
          isCritical,
          isHealthy: !isOutOfStock && !isCritical,
          criticalThreshold: critThreshold,
          suggestedQuantity: isOutOfStock ? 4 : isCritical ? 3 : 2
        };

        if (isOutOfStock) outOfStockCellsCount++;
        if (isCritical) criticalCellsCount++;

        if (numQty <= critThreshold) {
          missingGridItems.push({
            id: itemId,
            productId: prod._id,
            productName: prod.name,
            categoryName: cat.name || "العدسات الطبية واللاصقة",
            categoryId: cat._id,
            cellKey: key,
            specs: {
              sph,
              cyl,
              axisXName: gridConfig.axisX?.name || "SPH",
              axisYName: gridConfig.axisY?.name || "CYL"
            },
            currentStock: numQty,
            isOutOfStock,
            isCritical,
            criticalThreshold: critThreshold,
            suggestedQuantity: isOutOfStock ? 4 : 3,
            costPrice: prod.costPrice || 0,
            price: prod.price || 0,
            supplier: prod.supplierId || null,
            unitCost: prod.costPrice || 0
          });
        }
      }

      matrixProducts.push({
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku || prod.barcode || "",
        categoryName: cat.name || "العدسات الطبية واللاصقة",
        categoryId: cat._id,
        axisXName: gridConfig.axisX?.name || "SPH",
        axisYName: gridConfig.axisY?.name || "CYL",
        sphAxis: sortDiopterValues(sphSet),
        cylAxis: sortDiopterValues(cylSet),
        matrixMap,
        totalCellsCount: matrixKeys.length,
        outOfStockCellsCount,
        criticalCellsCount,
        depletedOrCriticalCount: outOfStockCellsCount + criticalCellsCount,
        totalStock: prod.storeStock !== undefined ? prod.storeStock : (prod.stockCount || 0),
        costPrice: prod.costPrice || 0,
        price: prod.price || 0,
        supplier: prod.supplierId || null
      });
    } else {
      const currentStock = prod.storeStock !== undefined ? Number(prod.storeStock) : Number(prod.stockCount || 0);
      const genCrit = prod.criticalStockThreshold !== undefined ? Number(prod.criticalStockThreshold) : 3;
      const reorderThresh = prod.reorderThreshold !== undefined ? Number(prod.reorderThreshold) : 8;
      const isOutOfStock = currentStock <= 0;
      const isCritical = currentStock > 0 && currentStock <= genCrit;
      const isLowStock = currentStock > genCrit && currentStock <= reorderThresh;

      generalProducts.push({
        id: `general_${prod._id}`,
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku || prod.barcode || "",
        productType: prod.productType || "frame",
        categoryName: cat.name || "عام",
        categoryId: cat._id,
        currentStock,
        warehouseStock: Number(prod.stockCount || 0),
        criticalThreshold: genCrit,
        reorderThreshold: reorderThresh,
        isOutOfStock,
        isCritical,
        isLowStock,
        needsReorder: isOutOfStock || isCritical || isLowStock,
        suggestedQuantity: Math.max(5, Number(prod.reorderQuantity || 10)),
        costPrice: prod.costPrice || 0,
        price: prod.price || 0,
        unitCost: prod.costPrice || 0,
        supplier: prod.supplierId || null
      });
    }
  }

  // Sort missingGridItems by out of stock first, then by productName
  missingGridItems.sort((a, b) => {
    if (a.currentStock !== b.currentStock) return a.currentStock - b.currentStock;
    return a.productName.localeCompare(b.productName);
  });

  // Sort generalProducts by currentStock ascending so low-stock items appear at the top
  generalProducts.sort((a, b) => a.currentStock - b.currentStock);

  return {
    done: true,
    totalItems: missingGridItems.length,
    outOfStockCount: missingGridItems.filter((i) => i.isOutOfStock).length,
    criticalCount: missingGridItems.filter((i) => i.isCritical).length,
    items: missingGridItems,
    matrixProducts,
    generalProducts,
    generalLowStockCount: generalProducts.filter((p) => p.needsReorder).length,
    categories: gridCategories,
    allCategories
  };
}

module.exports = {
  getCriticalAndOutOfStockProducts,
  getGridCriticalAndOutOfStockProducts,
  generateSupplierReordersProposal,
  dispatchAndRecordSupplierReorder,
  listSupplierReorders,
  updateSupplierReorderStatus,
  runPeriodicCriticalStockCheck,
  getFastSellingProcurementForecast
};
