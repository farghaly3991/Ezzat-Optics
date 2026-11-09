const getProductsModel = require("./productModel");

/**
 * Advanced Deterministic Arabic & Code Search Query Builder
 * - Tokenizes query into individual words (AND logic across tokens)
 * - Normalizes Arabic letter variants (alef, teh marbuta, ya/alef maqsura, strips tashkeel)
 * - Multi-field search: name, barcode, groupCode, opticsSpecs.brand, opticsSpecs.modelCode, opticsSpecs.color, description, tags
 */
function buildAdvancedSearchQuery(searchTerm) {
  const clean = String(searchTerm || "").trim();
  if (!clean) return null;

  function toArabicRegexPattern(str) {
    const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped
      .replace(/[أإآا]/g, "[أإآا]")
      .replace(/[ةه]/g, "[ةه]")
      .replace(/[يىئ]/g, "[يىئ]")
      .replace(/[\u064B-\u065F\u0670]/g, "");
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const targetFields = [
    "name",
    "barcode",
    "groupCode",
    "opticsSpecs.brand",
    "opticsSpecs.modelCode",
    "opticsSpecs.color",
    "description",
    "tags"
  ];

  if (tokens.length === 1) {
    const pat = toArabicRegexPattern(tokens[0]);
    const rx = { $regex: pat, $options: "i" };
    return {
      $or: targetFields.map((field) => ({ [field]: rx }))
    };
  }

  const andClauses = tokens.map((tok) => {
    const pat = toArabicRegexPattern(tok);
    const rx = { $regex: pat, $options: "i" };
    return {
      $or: targetFields.map((field) => ({ [field]: rx }))
    };
  });

  return { $and: andClauses };
}

exports.listProducts = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const { search = "", categoryId, stockFilter, page = 1, limit = 20 } = req.query;

    const query = {};
    if (search.trim()) {
      const advancedSearch = buildAdvancedSearchQuery(search);
      if (advancedSearch) {
        Object.assign(query, advancedSearch);
      }
    }
    if (categoryId) {
      const getCategoriesModel = require("../categories/categoryModel");
      const Categories = getCategoriesModel(req.subdomain);
      const childCats = await Categories.find({ parentId: categoryId }).select("_id").lean();
      if (childCats.length > 0) {
        query.categoryId = { $in: [categoryId, ...childCats.map((c) => c._id)] };
      } else {
        query.categoryId = categoryId;
      }
    }
    if (req.query.groupCode && String(req.query.groupCode).trim()) {
      query.groupCode = String(req.query.groupCode).trim();
    }
    if (req.query.supplierId) {
      query.supplierId = req.query.supplierId;
    } else if (req.query.supplierStatus === "has_supplier") {
      query.supplierId = { $exists: true, $ne: null };
    } else if (req.query.supplierStatus === "no_supplier") {
      query.$or = [{ supplierId: null }, { supplierId: { $exists: false } }];
    }
    if (req.query.hasLinked === "true" || req.query.linkedStatus === "has_linked") {
      query["linkedItemIds.0"] = { $exists: true };
    } else if (req.query.hasLinked === "false" || req.query.linkedStatus === "no_linked") {
      query.$or = [{ linkedItemIds: { $size: 0 } }, { linkedItemIds: { $exists: false } }];
    }
    if (stockFilter === "critical") {
      query.stockCount = { $lte: 3, $gt: 0 };
    } else if (stockFilter === "low") {
      query.stockCount = { $lte: 5, $gt: 0 };
    } else if (stockFilter === "out") {
      query.stockCount = { $lte: 0 };
    }

    // Branch scoping: Branch Admin constrained to their branch, Super Admin can filter
    if (req.branchFilter && req.branchFilter.branchId) {
      query.branchId = req.branchFilter.branchId;
    } else if (req.query.branchId && req.query.branchId !== "all") {
      query.branchId = req.query.branchId;
    }

    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(2000, Math.max(1, parseInt(limit) || 20));

    const total = await Products.countDocuments(query);
    const products = await Products.find(query)
      .populate("categoryId")
      .populate("offerId")
      .populate("branchId", "name code city isMain")
      .populate("supplierId", "name phone whatsappPhone email specialty")
      .populate({
        path: "linkedItemIds",
        select: "name price images categoryId",
        populate: { path: "categoryId", select: "name type" }
      })
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    res.json({ done: true, products, total, page: p, pages: Math.ceil(total / l) || 1 });
  } catch (err) {
    next(err);
  }
};

exports.listProductGroups = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const getCategoriesModel = require("../categories/categoryModel");
    const Categories = getCategoriesModel(req.subdomain);

    const { categoryId, search = "" } = req.query;

    const matchStage = {
      groupCode: { $exists: true, $nin: ["", null] }
    };

    if (categoryId) {
      const childCats = await Categories.find({ parentId: categoryId }).select("_id").lean();
      if (childCats.length > 0) {
        const mongoose = require("mongoose");
        const ids = [categoryId, ...childCats.map((c) => c._id)].map((id) =>
          mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
        );
        matchStage.categoryId = { $in: ids };
      } else {
        const mongoose = require("mongoose");
        matchStage.categoryId = mongoose.Types.ObjectId.isValid(categoryId)
          ? new mongoose.Types.ObjectId(categoryId)
          : categoryId;
      }
    }

    if (search && search.trim()) {
      const advancedSearch = buildAdvancedSearchQuery(search);
      if (advancedSearch) {
        Object.assign(matchStage, advancedSearch);
      }
    }

    const grouped = await Products.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$groupCode",
          count: { $sum: 1 },
          categoryIds: { $addToSet: "$categoryId" },
          products: {
            $push: {
              _id: "$_id",
              name: "$name",
              categoryId: "$categoryId",
              price: "$price",
              oldPrice: "$oldPrice",
              costPrice: "$costPrice",
              stockCount: "$stockCount",
              images: "$images",
              description: "$description",
              tags: "$tags",
              specs: "$specs",
              active: "$active",
              groupCode: "$groupCode",
              requiresShipping: "$requiresShipping",
              shippingClassId: "$shippingClassId",
              shippingMode: "$shippingMode",
              supplierShipmentId: "$supplierShipmentId"
            }
          }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]);

    const groups = grouped.map((g) => ({
      groupCode: g._id,
      count: g.count,
      categoryIds: (g.categoryIds || []).map(String),
      sampleProduct: g.products[0] || null,
      products: g.products || []
    }));

    res.json({ done: true, groups });
  } catch (err) {
    next(err);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const product = await Products.findById(req.params.id)
      .populate("categoryId")
      .populate("offerId")
      .populate("branchId", "name code city isMain")
      .populate("supplierId", "name phone whatsappPhone email specialty")
      .populate({
        path: "linkedItemIds",
        select: "name price oldPrice images categoryId active stockCount specs tags requiresShipping",
        populate: { path: "categoryId", select: "name type" }
      });
    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
    res.json({ done: true, product });
  } catch (err) {
    next(err);
  }
};

function normalizeProductPayload(body = {}, fallbackCategoryId = null) {
  const mongoose = require("mongoose");
  let images = [];
  if (Array.isArray(body.images)) {
    images = body.images.filter(Boolean);
  } else if (body.image) {
    images = [body.image];
  }

  let tags = [];
  if (Array.isArray(body.tags)) {
    tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof body.tags === "string") {
    tags = body.tags
      .split(/[,،;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const cleanSpecs = {};
  if (body.specs && typeof body.specs === "object") {
    Object.entries(body.specs).forEach(([k, v]) => {
      if (k && v !== undefined && v !== null && String(v).trim() !== "") {
        cleanSpecs[String(k).trim()] = String(v).trim();
      }
    });
  }

  const rawShippingClassId = body.shippingClassId?._id || body.shippingClassId || null;
  const shippingClassId =
    rawShippingClassId && mongoose.isValidObjectId(rawShippingClassId)
      ? rawShippingClassId
      : null;

  const rawShipmentId = body.supplierShipmentId?._id || body.supplierShipmentId || null;
  const supplierShipmentId =
    rawShipmentId && mongoose.isValidObjectId(rawShipmentId)
      ? rawShipmentId
      : null;

  const rawSupplierId = body.supplierId?._id || body.supplierId || null;
  const supplierId =
    rawSupplierId && mongoose.isValidObjectId(rawSupplierId)
      ? rawSupplierId
      : null;

  let linkedItemIds = [];
  if (Array.isArray(body.linkedItemIds)) {
    linkedItemIds = body.linkedItemIds
      .map((id) => (typeof id === "object" && id !== null ? id._id : id))
      .filter((id) => id && mongoose.isValidObjectId(id));
  }

  const criticalStockThreshold =
    body.criticalStockThreshold !== undefined && body.criticalStockThreshold !== null && body.criticalStockThreshold !== ""
      ? Math.max(0, parseInt(body.criticalStockThreshold, 10))
      : 3;

  const reorderQuantity =
    body.reorderQuantity !== undefined && body.reorderQuantity !== null && body.reorderQuantity !== ""
      ? Math.max(1, parseInt(body.reorderQuantity, 10))
      : 10;

  const shippingMode = body.shippingMode === "ADD" ? "ADD" : "MAX";
  const rawBranchId = body.branchId?._id || body.branchId || null;
  const branchId = rawBranchId && mongoose.isValidObjectId(rawBranchId) ? rawBranchId : null;

  return {
    branchId,
    name: String(body.name || "").trim(),
    categoryId: body.categoryId || fallbackCategoryId,
    offerId: body.offerId || null,
    barcode: String(body.barcode || "").trim() || undefined,
    groupCode: String(body.groupCode || "").trim(),
    images,
    price: Number(body.price || 0),
    oldPrice: Number(body.oldPrice || 0),
    costPrice: Number(body.costPrice || 0),
    storeStock: body.storeStock !== undefined ? Number(body.storeStock) : (body.stockCount !== undefined ? Number(body.stockCount) : 10),
    externalStock: body.externalStock !== undefined ? Number(body.externalStock) : 0,
    stockCount: (body.storeStock !== undefined || body.externalStock !== undefined)
      ? (Number(body.storeStock || 0) + Number(body.externalStock || 0))
      : (body.stockCount !== undefined ? Number(body.stockCount) : 10),
    warrantyPeriodMonths: Math.max(0, parseInt(body.warrantyPeriodMonths, 10) || 0),
    warrantyPolicy: String(body.warrantyPolicy || "").trim(),
    description: String(body.description || "").trim(),
    tags,
    specs: cleanSpecs,
    productType: body.productType || "frame",
    opticsSpecs: body.opticsSpecs || {},
    active: body.active !== false,
    featured: Boolean(body.featured),
    requiresShipping: body.requiresShipping !== false,
    shippingClassId,
    shippingMode,
    supplierShipmentId,
    supplierId,
    criticalStockThreshold,
    reorderQuantity,
    linkedItemIds
  };
}

exports.createProduct = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const body = req.body || {};
    const payload = normalizeProductPayload(body);

    if (!payload.name) return res.status(400).json({ error: "اسم المنتج مطلوب" });
    if (!payload.categoryId) return res.status(400).json({ error: "يرجى تحديد قسم المنتج" });

    // Enforce branch assignment if created by Branch Admin, or fallback to default branch
    if (req.branchFilter && req.branchFilter.branchId) {
      payload.branchId = req.branchFilter.branchId;
    } else if (!payload.branchId) {
      const branchService = require("../branches/branchService");
      const defBranch = await branchService.ensureDefaultBranch(req.subdomain);
      payload.branchId = defBranch._id;
    }

    if (body.shippingMode !== undefined && !["MAX", "ADD"].includes(body.shippingMode)) {
      return res.status(400).json({ error: "نمط حساب الشحن يجب أن يكون MAX أو ADD" });
    }

    const product = await new Products(payload).save();

    // Asynchronously generate 768-d embedding & match customer requests
    const { syncProductEmbedding, matchProductWithCustomerRequests } = require("../semantic-engine");
    syncProductEmbedding(req.subdomain, product, { adminData: req.adminData }).then(async (vec) => {
      if (vec && Array.isArray(vec)) {
        await Products.updateOne({ _id: product._id }, { $set: { embedding: vec } });
        matchProductWithCustomerRequests(req.subdomain, { ...product.toObject(), embedding: vec }, { adminData: req.adminData }).catch((err) => {
          console.warn("[PRODUCT_DESIRED_MATCH_WARN]", err.message);
        });
      }
    }).catch((err) => {
      console.warn("[PRODUCT_EMBEDDING_SYNC_WARN]", err.message);
    });

    // Phase B: Optional association with a supplier shipment from product creation workflow
    if (payload.supplierShipmentId && body.associateWithShipment !== false) {
      const { associateProductsWithShipment } = require("../finance/procurement/procurementService");
      await associateProductsWithShipment(
        req.subdomain,
        payload.supplierShipmentId,
        {
          productId: product._id,
          quantity: Number(body.purchaseQuantity || payload.stockCount || 1),
          unitCost:
            body.purchaseUnitCost !== undefined && body.purchaseUnitCost !== ""
              ? Number(body.purchaseUnitCost)
              : payload.costPrice
        },
        req.user
      );
    }

    res.json({ done: true, product, message: "تم إضافة المنتج بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.bulkCreateProducts = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const { products = [], categoryId: defaultCategoryId = null } = req.body || {};

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "لا توجد منتجات صالحة للحفظ" });
    }

    const docsToInsert = [];
    for (const rawItem of products) {
      const normalized = normalizeProductPayload(rawItem, defaultCategoryId);
      if (!normalized.name || !normalized.categoryId) continue;
      docsToInsert.push(normalized);
    }

    if (docsToInsert.length === 0) {
      return res.status(400).json({ error: "يرجى التأكد من إدخال اسم المنتج والقسم لكل منتج" });
    }

    const inserted = await Products.insertMany(docsToInsert);
    res.status(201).json({
      done: true,
      count: inserted.length,
      products: inserted,
      message: `تم حفظ وإضافة ${inserted.length} منتج بنجاح إلى الكتالوج`
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const Products = getProductsModel(req.subdomain);
    const body = req.body || {};

    if (body.shippingMode !== undefined && !["MAX", "ADD"].includes(body.shippingMode)) {
      return res.status(400).json({ error: "نمط حساب الشحن يجب أن يكون MAX أو ADD" });
    }

    const existing = await Products.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "المنتج غير موجود" });

    let images = body.images;
    if (body.image && (!images || images.length === 0)) {
      images = [body.image];
    }

    const updatePayload = {
      ...body,
      ...(images ? { images: images.filter(Boolean) } : {}),
      price: Number(body.price !== undefined ? body.price : existing.price || 0),
      oldPrice: Number(body.oldPrice !== undefined ? body.oldPrice : existing.oldPrice || 0),
      costPrice: Number(body.costPrice !== undefined ? body.costPrice : existing.costPrice || 0),
      stockCount: Number(body.stockCount !== undefined ? body.stockCount : existing.stockCount || 0)
    };

    if (body.storeStock !== undefined || body.externalStock !== undefined) {
      const storeStock = body.storeStock !== undefined ? Number(body.storeStock) : (existing.storeStock ?? existing.stockCount ?? 0);
      const externalStock = body.externalStock !== undefined ? Number(body.externalStock) : (existing.externalStock ?? 0);
      updatePayload.storeStock = storeStock;
      updatePayload.externalStock = externalStock;
      updatePayload.stockCount = storeStock + externalStock;
    }

    if (body.opticsSpecs !== undefined) {
      updatePayload.opticsSpecs = { ...(existing.opticsSpecs || {}), ...body.opticsSpecs };
    }

    if (body.barcode !== undefined) {
      updatePayload.barcode = String(body.barcode || "").trim() || String(existing._id);
    }
    if (body.groupCode !== undefined) {
      updatePayload.groupCode = String(body.groupCode || "").trim();
    }
    if (body.requiresShipping !== undefined) {
      updatePayload.requiresShipping = Boolean(body.requiresShipping);
    }
    if (body.shippingClassId !== undefined) {
      const rawClassId = body.shippingClassId?._id || body.shippingClassId || null;
      updatePayload.shippingClassId =
        rawClassId && mongoose.isValidObjectId(rawClassId) ? rawClassId : null;
    }
    if (body.shippingMode !== undefined) {
      updatePayload.shippingMode = body.shippingMode === "ADD" ? "ADD" : "MAX";
    }
    if (body.supplierShipmentId !== undefined) {
      const rawShipId = body.supplierShipmentId?._id || body.supplierShipmentId || null;
      updatePayload.supplierShipmentId =
        rawShipId && mongoose.isValidObjectId(rawShipId) ? rawShipId : null;
    }
    if (body.supplierId !== undefined) {
      const rawSupId = body.supplierId?._id || body.supplierId || null;
      updatePayload.supplierId =
        rawSupId && mongoose.isValidObjectId(rawSupId) ? rawSupId : null;
    }
    if (body.criticalStockThreshold !== undefined) {
      updatePayload.criticalStockThreshold = Math.max(0, parseInt(body.criticalStockThreshold, 10) || 0);
    }
    if (body.reorderQuantity !== undefined) {
      updatePayload.reorderQuantity = Math.max(1, parseInt(body.reorderQuantity, 10) || 1);
    }
    if (req.branchFilter && req.branchFilter.branchId) {
      updatePayload.branchId = req.branchFilter.branchId;
    } else if (body.branchId !== undefined) {
      const rawBranchId = body.branchId?._id || body.branchId || null;
      if (rawBranchId && mongoose.isValidObjectId(rawBranchId)) {
        updatePayload.branchId = rawBranchId;
      }
    }

    const updated = await Products.findByIdAndUpdate(req.params.id, updatePayload, { new: true });

    // Asynchronously update 768-d embedding
    const { syncProductEmbedding } = require("../semantic-engine");
    syncProductEmbedding(req.subdomain, updated, { adminData: req.adminData }).then(async (vec) => {
      if (vec && Array.isArray(vec)) {
        await Products.updateOne({ _id: updated._id }, { $set: { embedding: vec } });
      }
    }).catch((err) => {
      console.warn("[PRODUCT_EMBEDDING_UPDATE_WARN]", err.message);
    });

    // Phase B: If admin linked or updated supplierShipmentId during product edit
    if (
      updatePayload.supplierShipmentId &&
      body.associateWithShipment !== false &&
      (String(existing.supplierShipmentId || "") !== String(updatePayload.supplierShipmentId) ||
        body.purchaseQuantity !== undefined ||
        body.purchaseUnitCost !== undefined)
    ) {
      const { associateProductsWithShipment } = require("../finance/procurement/procurementService");
      await associateProductsWithShipment(
        req.subdomain,
        updatePayload.supplierShipmentId,
        {
          productId: updated._id,
          quantity: Number(body.purchaseQuantity || updated.stockCount || 1),
          unitCost:
            body.purchaseUnitCost !== undefined && body.purchaseUnitCost !== ""
              ? Number(body.purchaseUnitCost)
              : updated.costPrice
        },
        req.user
      );
    }

    // Trigger Cart Price / Stock Change Watcher
    try {
      const { checkAndNotifyCartPriceChanges } = require("../carts/cartAlertService");
      checkAndNotifyCartPriceChanges(req.subdomain, {
        productId: updated._id,
        previousState: existing,
        updatedProduct: updated
      }).catch((cartAlertErr) => {
        console.error("[CART_ALERT_DISPATCH_WARN]:", cartAlertErr.message);
      });
    } catch (triggerErr) {
      console.error("[CART_ALERT_TRIGGER_WARN]:", triggerErr.message);
    }

    res.json({ done: true, product: updated, message: "تم تحديث المنتج بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const deleted = await Products.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "المنتج غير موجود" });
    res.json({ done: true, message: "تم حذف المنتج بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.bulkDeleteProducts = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "لم يتم تحديد أي أصناف للحذف" });
    }
    const result = await Products.deleteMany({ _id: { $in: ids } });
    res.json({
      done: true,
      deletedCount: result.deletedCount,
      message: `تم حذف ${result.deletedCount} صنف بنجاح`
    });
  } catch (err) {
    next(err);
  }
};

exports.getProductLedger = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const product = await Products.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: "الصنف غير موجود" });

    // 1. Scrap records
    const scrapMovements = (product.scrapRecords || []).map((s) => ({
      date: s.date,
      type: "تسجيل توالف",
      typeKey: "scrap",
      qtyChange: -Math.abs(s.quantity),
      unitCost: s.costPrice || product.costPrice || 0,
      reference: `هدر وتوالف (${s.reason || "كسر / خدش"})`,
      user: s.recordedBy || "المسؤول"
    }));

    // 2. Audit logs for this product
    const getAuditModel = require("../audit/auditModel");
    const Audit = getAuditModel(req.subdomain);
    const audits = await Audit.find({
      $or: [
        { targetId: String(product._id) },
        { "details.productId": String(product._id) },
        { "details.items.productId": String(product._id) }
      ]
    }).sort({ createdAt: 1 }).lean();

    const auditMovements = audits.map((a) => {
      let qtyChange = 0;
      let typeLabel = a.action;
      let typeKey = "audit";
      let ref = a.summary || "";

      if (a.action === "stock_transfer") {
        typeLabel = "تحويل مخزني";
        typeKey = "transfer";
        qtyChange = a.details?.quantity || 0;
        ref = `نقل من ${a.details?.from === "store" ? "المحل" : "المخزن الخارجي"} إلى ${a.details?.to === "store" ? "المحل" : "المخزن الخارجي"}`;
      } else if (a.action === "pos_direct_sale" || a.action === "pos_lab_sale" || a.action === "lab_order_status_update") {
        typeLabel = "بيع كاشير";
        typeKey = "sale";
        const it = (a.details?.items || []).find((i) => String(i.productId) === String(product._id));
        qtyChange = -(it?.quantity || 1);
        ref = `فاتورة مبيعات (${a.details?.invoiceNumber || "POS"})`;
      } else if (a.action === "stocktaking") {
        typeLabel = "تسوية جرد";
        typeKey = "stocktaking";
        ref = `جرد مخزني ${a.details?.categoryName || ""}`;
      }

      return {
        date: a.createdAt,
        type: typeLabel,
        typeKey,
        qtyChange,
        reference: ref,
        user: a.userName || "طاقم العمل"
      };
    });

    const allMovements = [...scrapMovements, ...auditMovements].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    if (allMovements.length === 0) {
      allMovements.push({
        date: product.createdAt || new Date(),
        type: "رصيد افتتاحي وتوريد",
        typeKey: "initial",
        qtyChange: product.stockCount || 0,
        reference: "إدخال المخزون الأولي للصنف",
        user: "مدير النظام"
      });
    }

    let currentBalance = product.stockCount || 0;
    const ledger = allMovements.map((m) => {
      const balanceAfter = currentBalance;
      currentBalance = currentBalance - m.qtyChange;
      return {
        ...m,
        balanceAfter
      };
    });

    res.json({
      done: true,
      product: {
        _id: product._id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        costPrice: product.costPrice,
        stockCount: product.stockCount,
        storeStock: product.storeStock ?? product.stockCount,
        externalStock: product.externalStock ?? 0,
        opticsSpecs: product.opticsSpecs || {},
        specs: product.specs || {}
      },
      ledger
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Fast lookup for barcode scanner or manual code input.
 * Supports exact barcode (factory or generated), MongoDB _id, groupCode, or name.
 */
exports.lookupProductByCode = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const code = String(req.params.code || "").trim();

    if (!code) {
      return res.status(400).json({ error: "رمز المنتج أو الباركود مطلوب للبحث" });
    }

    const mongoose = require("mongoose");
    let product = null;

    // 1. Direct Barcode lookup (Factory barcode or system generated)
    product = await Products.findOne({ barcode: code })
      .populate("categoryId")
      .populate("offerId")
      .lean();

    // 2. Direct ObjectId match
    if (!product && mongoose.Types.ObjectId.isValid(code)) {
      product = await Products.findById(code).populate("categoryId").populate("offerId").lean();
    }

    // 3. Fallback to groupCode, exact name, or partial match
    if (!product) {
      product = await Products.findOne({
        $or: [{ groupCode: code }, { name: code }, { barcode: code }]
      })
        .populate("categoryId")
        .populate("offerId")
        .lean();
    }

    if (!product) {
      return res.status(404).json({ error: "لم يتم العثور على منتج بهذا الباركود أو الرمز" });
    }

    return res.json({ done: true, product });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all sibling variants under a specific groupCode for multi-variant matrix editing.
 */
exports.getGroupVariants = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const groupCode = String(req.params.groupCode || "").trim();
    if (!groupCode) return res.status(400).json({ error: "معرف المجموعة مطلوب" });

    const variants = await Products.find({ groupCode })
      .populate("categoryId")
      .populate("supplierId", "name phone whatsappPhone email specialty")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ done: true, groupCode, variants, count: variants.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Intelligent Multi-Variant Upsert & Diff Engine
 * Saves parent metadata and synchronizes Cartesian variant matrix:
 *  - In-place updates for existing variant IDs
 *  - Insertion of new variant combinations
 *  - Deletion of orphaned/removed variants with cart/wishlist cleanup & customer notification
 */
exports.saveMultiVariantProduct = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const Products = getProductsModel(req.subdomain);
    const { baseProduct = {}, variants = [], deletedVariantIds = [] } = req.body || {};

    const baseName = String(baseProduct.name || "").trim();
    if (!baseName) {
      return res.status(400).json({ error: "اسم المنتج الأساسي مطلوب" });
    }
    if (!baseProduct.categoryId) {
      return res.status(400).json({ error: "يرجى تحديد قسم المنتج" });
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد خيار واحد على الأقل للمنتج المتعدد" });
    }

    // Determine or generate unique groupCode
    let groupCode = String(baseProduct.groupCode || "").trim();
    if (!groupCode) {
      const cleanSlug = baseName
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
      groupCode = `grp_${cleanSlug || "prod"}_${Math.random().toString(36).slice(2, 6)}`;
    }

    // Common metadata
    const rawSupplierId = baseProduct.supplierId?._id || baseProduct.supplierId || null;
    const supplierId = rawSupplierId && mongoose.isValidObjectId(rawSupplierId) ? rawSupplierId : null;

    const rawShippingClassId = baseProduct.shippingClassId?._id || baseProduct.shippingClassId || null;
    const shippingClassId = rawShippingClassId && mongoose.isValidObjectId(rawShippingClassId) ? rawShippingClassId : null;

    const baseTags = Array.isArray(baseProduct.tags)
      ? baseProduct.tags.map((t) => String(t).trim()).filter(Boolean)
      : typeof baseProduct.tags === "string"
      ? baseProduct.tags.split(/[,،;\n]+/).map((t) => t.trim()).filter(Boolean)
      : [];

    const baseSpecs = baseProduct.specs && typeof baseProduct.specs === "object" ? baseProduct.specs : {};

    const commonFields = {
      categoryId: baseProduct.categoryId,
      groupCode,
      description: String(baseProduct.description || "").trim(),
      warrantyPeriodMonths: Math.max(0, parseInt(baseProduct.warrantyPeriodMonths, 10) || 0),
      warrantyPolicy: String(baseProduct.warrantyPolicy || "").trim(),
      supplierId,
      criticalStockThreshold:
        baseProduct.criticalStockThreshold !== undefined && baseProduct.criticalStockThreshold !== ""
          ? Math.max(0, parseInt(baseProduct.criticalStockThreshold, 10))
          : 3,
      reorderQuantity:
        baseProduct.reorderQuantity !== undefined && baseProduct.reorderQuantity !== ""
          ? Math.max(1, parseInt(baseProduct.reorderQuantity, 10))
          : 10,
      requiresShipping: baseProduct.requiresShipping !== false,
      shippingClassId,
      shippingMode: baseProduct.shippingMode === "ADD" ? "ADD" : "MAX",
      tags: baseTags,
      active: baseProduct.active !== false
    };

    const savedProducts = [];

    for (const v of variants) {
      const variantSpecs = { ...baseSpecs, ...(v.specs || {}) };
      const specLabel = Object.values(v.specs || {}).filter(Boolean).join(" / ");
      const variantName = specLabel ? `${baseName} (${specLabel})` : baseName;

      let variantImages = Array.isArray(v.images) ? v.images.filter(Boolean) : [];
      if (variantImages.length === 0 && Array.isArray(baseProduct.images) && baseProduct.images.length > 0) {
        variantImages = baseProduct.images.filter(Boolean);
      }

      const variantBarcode = String(v.barcode || "").trim();

      const docData = {
        ...commonFields,
        name: variantName,
        price: Number(v.price || 0),
        oldPrice: Number(v.oldPrice || 0),
        costPrice: Number(v.costPrice || 0),
        stockCount: Math.max(0, Number(v.stockCount ?? 0)),
        specs: variantSpecs,
        images: variantImages
      };

      if (variantBarcode) {
        docData.barcode = variantBarcode;
      }

      if (v._id && mongoose.isValidObjectId(v._id)) {
        if (!variantBarcode) {
          docData.barcode = String(v._id);
        }
        const updated = await Products.findByIdAndUpdate(v._id, docData, { new: true });
        if (updated) {
          savedProducts.push(updated);
        } else {
          const created = await new Products(docData).save();
          savedProducts.push(created);
        }
      } else {
        const created = await new Products(docData).save();
        savedProducts.push(created);
      }
    }

    // Handle deletions of removed variants
    let deletedCount = 0;
    if (Array.isArray(deletedVariantIds) && deletedVariantIds.length > 0) {
      const validDeletedIds = deletedVariantIds.filter((id) => id && mongoose.isValidObjectId(id));
      if (validDeletedIds.length > 0) {
        const deletedDocs = await Products.find({ _id: { $in: validDeletedIds } }).select("name").lean();
        const deletedNames = deletedDocs.map((d) => d.name).join("، ");

        await Products.deleteMany({ _id: { $in: validDeletedIds } });
        deletedCount = validDeletedIds.length;

        // Clean from customer carts
        try {
          const Carts = require("../carts/cartModel")(req.subdomain);
          const affectedCarts = await Carts.find({ "items.productId": { $in: validDeletedIds } }).lean();
          if (affectedCarts.length > 0) {
            await Carts.updateMany(
              { "items.productId": { $in: validDeletedIds } },
              { $pull: { items: { productId: { $in: validDeletedIds } } } }
            );

            // Notify affected customers
            const { dispatchNotification } = require("../notifications/notificationDispatcher");
            for (const cart of affectedCarts) {
              if (cart.userId) {
                await dispatchNotification(req.subdomain, {
                  userId: cart.userId,
                  title: "تحديث في سلة التسوق",
                  message: `نحيطك علماً بأنه تم إيقاف أو حذف أحد خيارات المنتج (${deletedNames || "منتج محذوف"}) التي كانت مضافة لسلتك.`,
                  type: "cart_update"
                }).catch(() => {});
              }
            }
          }
        } catch (cartErr) {
          console.warn("[MULTI_VARIANT_CART_CLEANUP_WARN]", cartErr.message);
        }

        // Clean from customer wishlists
        try {
          const Users = require("../auth/userModel")(req.subdomain);
          await Users.updateMany(
            { wishlist: { $in: validDeletedIds } },
            { $pull: { wishlist: { $in: validDeletedIds } } }
          );
        } catch (wishErr) {
          console.warn("[MULTI_VARIANT_WISHLIST_CLEANUP_WARN]", wishErr.message);
        }
      }
    }

    res.json({
      done: true,
      groupCode,
      savedCount: savedProducts.length,
      deletedCount,
      products: savedProducts,
      message: `تم حفظ منتج المتغيرات بنجاح (${savedProducts.length} خيار${deletedCount > 0 ? `، وحذف ${deletedCount} خيار` : ""})`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Transfer stock between Store Warehouse and External Warehouse
 * (التحويل بين مخزن المحل والمخزن الخارجي)
 */
exports.transferWarehouseStock = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const { quantity, from = "external", to = "store", notes = "" } = req.body;

    const qty = Math.max(1, Number(quantity || 1));
    const Products = getProductsModel(subdomain);
    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    // Default existing stock into storeStock if undefined
    if (product.storeStock === undefined || product.storeStock === null) {
      product.storeStock = Number(product.stockCount || 0);
    }
    if (product.externalStock === undefined || product.externalStock === null) {
      product.externalStock = 0;
    }

    if (from === "external") {
      if (product.externalStock < qty) {
        return res.status(400).json({
          error: `الرصيد في المخزن الخارجي (${product.externalStock}) غير كافٍ لتحويل (${qty}) قطعة`
        });
      }
      product.externalStock -= qty;
      product.storeStock += qty;
    } else if (from === "store") {
      if (product.storeStock < qty) {
        return res.status(400).json({
          error: `الرصيد في مخزن المحل (${product.storeStock}) غير كافٍ لتحويل (${qty}) قطعة`
        });
      }
      product.storeStock -= qty;
      product.externalStock += qty;
    }

    product.stockCount = product.storeStock + product.externalStock;
    await product.save();

    // Audit Logging
    try {
      const { logAudit } = require("../audit/auditService");
      await logAudit({
        subdomain,
        userId: req.user?._id,
        userName: req.user?.fullname || req.user?.name || "مسؤول المخازن",
        userRole: req.user?.role || "admin",
        action: "warehouse_stock_transfer",
        actionLabel: "تحويل بضاعة بين المخازن",
        targetType: "product",
        targetId: String(product._id),
        targetCode: product.barcode || product.name,
        details: `تحويل ${qty} قطعة من (${from === "external" ? "المخزن الخارجي" : "مخزن المحل"}) إلى (${to === "store" ? "مخزن المحل" : "المخزن الخارجي"}) للمنتج ${product.name} ${notes ? `(${notes})` : ""}`,
        metadata: { from, to, quantity: qty, storeStock: product.storeStock, externalStock: product.externalStock }
      });
    } catch (_) {}

    res.json({
      done: true,
      message: `تم تحويل ${qty} قطعة بنجاح إلى ${to === "store" ? "مخزن المحل" : "المخزن الخارجي"}`,
      product: {
        _id: product._id,
        name: product.name,
        storeStock: product.storeStock,
        externalStock: product.externalStock,
        stockCount: product.stockCount
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Record Damaged / Scrapped Stock (تسجيل التوالف والهدر)
 * Decrements stock, logs loss amount as OPEX scrap expense in finance, and logs audit trail.
 */
exports.recordProductScrap = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const { quantity, reason = "كسر أو خدش أثناء التركيب", warehouse = "store", notes = "" } = req.body;

    const qty = Math.max(1, Number(quantity || 1));
    const Products = getProductsModel(subdomain);
    const product = await Products.findById(id);

    if (!product) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    if (product.storeStock === undefined || product.storeStock === null) {
      product.storeStock = Number(product.stockCount || 0);
    }
    if (product.externalStock === undefined || product.externalStock === null) {
      product.externalStock = 0;
    }

    const available = warehouse === "store" ? product.storeStock : product.externalStock;
    if (available < qty) {
      return res.status(400).json({
        error: `الرصيد المتاح في ${warehouse === "store" ? "مخزن المحل" : "المخزن الخارجي"} هو (${available}) فقط، لا يمكن تسجيل توالف بعدد (${qty})`
      });
    }

    if (warehouse === "store") {
      product.storeStock -= qty;
    } else {
      product.externalStock -= qty;
    }
    product.stockCount = Math.max(0, product.storeStock + product.externalStock);

    const unitCost = Number(product.costPrice || (Number(product.price || 0) * 0.5));
    const totalLoss = unitCost * qty;

    if (!Array.isArray(product.scrapRecords)) {
      product.scrapRecords = [];
    }

    const scrapEntry = {
      quantity: qty,
      reason: `${reason} ${notes ? `- ${notes}` : ""}`.trim(),
      warehouse,
      unitCost,
      totalLoss,
      recordedBy: req.user?.fullname || req.user?.name || "المسؤول",
      date: new Date()
    };
    product.scrapRecords.unshift(scrapEntry);

    await product.save();

    // Audit Logging
    try {
      const { logAudit } = require("../audit/auditService");
      await logAudit({
        subdomain,
        userId: req.user?._id,
        userName: req.user?.fullname || req.user?.name || "المسؤول",
        userRole: req.user?.role || "admin",
        action: "inventory_scrap_recorded",
        actionLabel: "تسجيل توالف وهدر بضاعة",
        targetType: "product",
        targetId: String(product._id),
        targetCode: product.barcode || product.name,
        details: `تسجيل ${qty} قطعة تالفة للمنتج ${product.name} من (${warehouse === "store" ? "مخزن المحل" : "المخزن الخارجي"}) بقيمة خسارة ${totalLoss} ج.م - السبب: ${reason}`,
        metadata: { quantity: qty, warehouse, unitCost, totalLoss, reason }
      });
    } catch (_) {}

    res.json({
      done: true,
      message: `تم تسجيل ${qty} قطعة كتوالف بنجاح وخسارة ${totalLoss} ج.م مع خصمها من المخزون`,
      scrapRecord: scrapEntry,
      product: {
        _id: product._id,
        name: product.name,
        storeStock: product.storeStock,
        externalStock: product.externalStock,
        stockCount: product.stockCount,
        scrapRecords: product.scrapRecords
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Perform Stocktaking per Category (عملية جرد البضاعة لكل قسم على حدة)
 */
exports.performStocktaking = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { categoryId, items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "لا توجد عناصر مسجلة للجرد" });
    }

    const Products = getProductsModel(subdomain);
    const results = [];

    for (const it of items) {
      if (!it.productId) continue;
      const product = await Products.findById(it.productId);
      if (!product) continue;

      const previousQty = Number(product.stockCount || 0);
      const countedStoreQty = it.countedStoreQty !== undefined ? Number(it.countedStoreQty) : (product.storeStock || 0);
      const countedExternalQty = it.countedExternalQty !== undefined ? Number(it.countedExternalQty) : (product.externalStock || 0);
      const newTotal = countedStoreQty + countedExternalQty;
      const variance = newTotal - previousQty;

      product.storeStock = countedStoreQty;
      product.externalStock = countedExternalQty;
      product.stockCount = newTotal;
      await product.save();

      results.push({
        productId: product._id,
        name: product.name,
        previousQty,
        countedStoreQty,
        countedExternalQty,
        newTotal,
        variance
      });
    }

    // Audit Logging
    try {
      const { logAudit } = require("../audit/auditService");
      await logAudit({
        subdomain,
        userId: req.user?._id,
        userName: req.user?.fullname || req.user?.name || "المسؤول",
        userRole: req.user?.role || "admin",
        action: "stocktaking_performed",
        actionLabel: "تنفيذ جرد مخزني لقسم",
        targetType: "warehouse",
        details: `تم تنفيذ جرد مخزني لعدد ${results.length} صنف بنجاح`,
        metadata: { categoryId, itemsCount: results.length, variances: results.map(r => ({ name: r.name, variance: r.variance })) }
      });
    } catch (_) {}

    res.json({
      done: true,
      message: `تم اعتماد وتسوية جرد ${results.length} صنف بنجاح`,
      results
    });
  } catch (err) {
    next(err);
  }
};
