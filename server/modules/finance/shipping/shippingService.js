/**
 * Phase A — Shipping Management, Actual Carrier Cost Recording & Pickup Completion Service
 */

const getShippingClassModel = require("./shippingClassModel");
const getOrdersModel = require("../../orders/orderModel");
const { buildClassCoverageIndex, classifyCustomerAddress } = require("./addressCoverageService");
const { calculateOrderShippingAuthoritative } = require("./shippingCalculatorService");
const { getFinanceSettings } = require("../core/settings/financeSettingsService");
const { recordFinanceAudit } = require("../core/audit/auditService");
const { emitFinanceEvent, FINANCE_DOMAIN_EVENTS } = require("../core/events/financeEventBus");
const { recordOrderLifecycleEvents } = require("../../activity/activityService");
const { VALID_SHIPPING_MODES } = require("../shared/constants");
const {
  createFinanceError,
  roundMoney,
  validateNonNegativeAmount,
  validateObjectId
} = require("../shared/validators");

function sanitizeCoverageRegions(rawRegions) {
  if (!Array.isArray(rawRegions)) return [];
  return rawRegions
    .map((reg) => ({
      governorate: String(reg?.governorate || "").trim(),
      cities: Array.isArray(reg?.cities)
        ? reg.cities.map((c) => String(c).trim()).filter(Boolean)
        : String(reg?.cities || "")
            .split(/[,،;]+/)
            .map((c) => c.trim())
            .filter(Boolean),
      districts: Array.isArray(reg?.districts)
        ? reg.districts.map((d) => String(d).trim()).filter(Boolean)
        : String(reg?.districts || "")
            .split(/[,،;]+/)
            .map((d) => d.trim())
            .filter(Boolean),
      aliases: Array.isArray(reg?.aliases)
        ? reg.aliases.map((a) => String(a).trim()).filter(Boolean)
        : String(reg?.aliases || "")
            .split(/[,،;]+/)
            .map((a) => a.trim())
            .filter(Boolean)
    }))
    .filter(
      (r) =>
        r.governorate ||
        r.cities.length > 0 ||
        r.districts.length > 0 ||
        r.aliases.length > 0
    );
}

async function listShippingClasses(subdomain, { activeOnly = false } = {}) {
  const ShippingClass = getShippingClassModel(subdomain);
  const query = activeOnly ? { active: true } : {};
  return ShippingClass.find(query).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

async function getShippingClassById(subdomain, id) {
  const ShippingClass = getShippingClassModel(subdomain);
  const validId = validateObjectId(id, "معرف فئة الشحن");
  const doc = await ShippingClass.findById(validId).lean();
  if (!doc) {
    throw createFinanceError("فئة الشحن غير موجودة", 404);
  }
  return doc;
}

async function createShippingClass(subdomain, payload = {}, actor = null) {
  const ShippingClass = getShippingClassModel(subdomain);

  const name = String(payload.name || "").trim();
  if (!name) {
    throw createFinanceError("اسم فئة الشحن مطلوب", 400);
  }

  let code = String(payload.code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!code) {
    const count = await ShippingClass.countDocuments();
    code = `CLASS_${String.fromCharCode(65 + (count % 26))}${count >= 26 ? count : ""}`;
  }

  const existingCode = await ShippingClass.findOne({ code }).lean();
  if (existingCode) {
    throw createFinanceError(`مُعرف فئة الشحن (${code}) مسجل مسبقاً`, 400);
  }

  const customerPrice = validateNonNegativeAmount(
    payload.customerPrice ?? 0,
    "سعر الشحن للعميل"
  );
  const actualCost = validateNonNegativeAmount(
    payload.actualCost ?? 0,
    "تكلفة الشحن الفعلية على المتجر"
  );

  const defaultCalculationMode = VALID_SHIPPING_MODES.includes(payload.defaultCalculationMode)
    ? payload.defaultCalculationMode
    : "MAX";

  const coverageText = String(payload.coverageText || "").trim();
  const coverageRegions = sanitizeCoverageRegions(payload.coverageRegions);
  const coverageIndex = buildClassCoverageIndex({ coverageText, coverageRegions });
  const actorId = actor?._id || actor?.userId || null;

  const created = await new ShippingClass({
    code,
    name,
    description: String(payload.description || "").trim(),
    customerPrice,
    actualCost,
    defaultCalculationMode,
    active: payload.active !== false,
    coverageText,
    coverageRegions,
    normalizedCoverageTokens: coverageIndex.normalizedCoverageTokens,
    matchedGovernorateKeys: coverageIndex.matchedGovernorateKeys,
    sortOrder: Number(payload.sortOrder || 0),
    createdBy: actorId,
    updatedBy: actorId
  }).save();

  const classObj = created.toObject();

  await recordFinanceAudit(subdomain, {
    action: "shipping_class_created",
    entityType: "shipping_class",
    entityId: String(classObj._id),
    referenceCode: classObj.code,
    summary: `تم إنشاء فئة الشحن "${classObj.name}" (${classObj.code})`,
    afterState: classObj,
    actor,
    activityPayload: {
      eventType: "shipping_class_updated",
      amount: classObj.customerPrice,
      note: `إنشاء فئة شحن: ${classObj.name} (${classObj.code})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.SHIPPING_CLASS_CREATED, {
    subdomain,
    shippingClass: classObj
  });

  return classObj;
}

async function updateShippingClass(subdomain, id, payload = {}, actor = null) {
  const ShippingClass = getShippingClassModel(subdomain);
  const validId = validateObjectId(id, "معرف فئة الشحن");
  const existing = await ShippingClass.findById(validId);
  if (!existing) {
    throw createFinanceError("فئة الشحن غير موجودة", 404);
  }

  const beforeState = existing.toObject();

  if (payload.name !== undefined) {
    const cleanName = String(payload.name || "").trim();
    if (!cleanName) throw createFinanceError("اسم فئة الشحن لا يمكن أن يكون فارغاً", 400);
    existing.name = cleanName;
  }

  if (payload.code !== undefined) {
    const cleanCode = String(payload.code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
    if (!cleanCode) throw createFinanceError("مُعرف فئة الشحن لا يمكن أن يكون فارغاً", 400);
    if (cleanCode !== existing.code) {
      const dup = await ShippingClass.findOne({ code: cleanCode, _id: { $ne: existing._id } }).lean();
      if (dup) throw createFinanceError(`مُعرف فئة الشحن (${cleanCode}) مستخدم بالفعل`, 400);
      existing.code = cleanCode;
    }
  }

  if (payload.description !== undefined) {
    existing.description = String(payload.description || "").trim();
  }

  if (payload.customerPrice !== undefined) {
    existing.customerPrice = validateNonNegativeAmount(payload.customerPrice, "سعر الشحن للعميل");
  }

  if (payload.actualCost !== undefined) {
    existing.actualCost = validateNonNegativeAmount(payload.actualCost, "تكلفة الشحن الفعلية");
  }

  if (payload.defaultCalculationMode !== undefined) {
    if (!VALID_SHIPPING_MODES.includes(payload.defaultCalculationMode)) {
      throw createFinanceError("نمط حساب الشحن يجب أن يكون MAX أو ADD", 400);
    }
    existing.defaultCalculationMode = payload.defaultCalculationMode;
  }

  if (payload.active !== undefined) {
    existing.active = Boolean(payload.active);
  }

  if (payload.sortOrder !== undefined) {
    existing.sortOrder = Number(payload.sortOrder || 0);
  }

  if (payload.coverageText !== undefined) {
    existing.coverageText = String(payload.coverageText || "").trim();
  }

  if (payload.coverageRegions !== undefined) {
    existing.coverageRegions = sanitizeCoverageRegions(payload.coverageRegions);
  }

  const coverageIndex = buildClassCoverageIndex({
    coverageText: existing.coverageText,
    coverageRegions: existing.coverageRegions
  });
  existing.normalizedCoverageTokens = coverageIndex.normalizedCoverageTokens;
  existing.matchedGovernorateKeys = coverageIndex.matchedGovernorateKeys;
  existing.updatedBy = actor?._id || actor?.userId || existing.updatedBy;

  await existing.save();
  const afterState = existing.toObject();

  await recordFinanceAudit(subdomain, {
    action: "shipping_class_updated",
    entityType: "shipping_class",
    entityId: String(afterState._id),
    referenceCode: afterState.code,
    summary: `تم تحديث فئة الشحن "${afterState.name}" (${afterState.code})`,
    beforeState,
    afterState,
    actor,
    activityPayload: {
      eventType: "shipping_class_updated",
      amount: afterState.customerPrice,
      note: `تحديث فئة شحن: ${afterState.name} (${afterState.code})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.SHIPPING_CLASS_UPDATED, {
    subdomain,
    shippingClass: afterState
  });

  return afterState;
}

async function toggleShippingClassStatus(subdomain, id, active = null, actor = null) {
  const ShippingClass = getShippingClassModel(subdomain);
  const validId = validateObjectId(id, "معرف فئة الشحن");
  const existing = await ShippingClass.findById(validId);
  if (!existing) {
    throw createFinanceError("فئة الشحن غير موجودة", 404);
  }

  const nextActive = typeof active === "boolean" ? active : !existing.active;
  return updateShippingClass(subdomain, id, { active: nextActive }, actor);
}

async function deleteShippingClass(subdomain, id, actor = null) {
  const ShippingClass = getShippingClassModel(subdomain);
  const validId = validateObjectId(id, "معرف فئة الشحن");
  const existing = await ShippingClass.findById(validId);
  if (!existing) {
    throw createFinanceError("فئة الشحن غير موجودة", 404);
  }

  const beforeState = existing.toObject();
  await ShippingClass.deleteOne({ _id: validId });

  await recordFinanceAudit(subdomain, {
    action: "shipping_class_deleted",
    entityType: "shipping_class",
    entityId: String(validId),
    referenceCode: beforeState.code,
    summary: `تم حذف فئة الشحن "${beforeState.name}" (${beforeState.code})`,
    beforeState,
    actor
  });

  return { deleted: true, id: String(validId), code: beforeState.code };
}

/**
 * Record or update the confirmed actual carrier shipping cost for an existing order
 * without modifying historical customer-facing prices, customer shipping charge, or product cost snapshots.
 */
async function recordOrderActualShippingCost(subdomain, {
  orderId,
  actualCarrierCost,
  carrierName = "",
  trackingReference = "",
  note = "",
  actor = null
}) {
  const Orders = getOrdersModel(subdomain);
  let order = null;

  const mongoose = require("mongoose");
  if (mongoose.isValidObjectId(orderId)) {
    order = await Orders.findById(orderId);
  }
  if (!order) {
    order = await Orders.findOne({ orderId: String(orderId || "").trim() });
  }
  if (!order) {
    throw createFinanceError("الطلب غير موجود", 404);
  }

  const validActualCost = validateNonNegativeAmount(
    actualCarrierCost,
    "تكلفة شركة الشحن الفعلية"
  );

  if (!order.shippingSnapshot) {
    order.shippingSnapshot = {
      deliveryMethod: order.deliveryMethod || "delivery",
      customerShippingCharge: Number(order.shipping || 0),
      estimatedCarrierCost: 0,
      actualCarrierCost: null,
      actualCostStatus: "unknown",
      costHistory: []
    };
  }

  const previousActualCost =
    order.shippingSnapshot.actualCarrierCost !== undefined
      ? order.shippingSnapshot.actualCarrierCost
      : null;

  const actorId = actor?._id || actor?.userId || null;
  const now = new Date();

  order.shippingSnapshot.actualCarrierCost = validActualCost;
  order.shippingSnapshot.actualCostStatus = "confirmed";
  if (carrierName) order.shippingSnapshot.carrierName = String(carrierName).trim();
  if (trackingReference) order.shippingSnapshot.trackingReference = String(trackingReference).trim();
  order.shippingSnapshot.actualCostRecordedAt = now;
  order.shippingSnapshot.actualCostRecordedBy = actorId;

  if (!Array.isArray(order.shippingSnapshot.costHistory)) {
    order.shippingSnapshot.costHistory = [];
  }
  order.shippingSnapshot.costHistory.push({
    previousActualCost,
    newActualCost: validActualCost,
    carrierName: String(carrierName || "").trim(),
    trackingReference: String(trackingReference || "").trim(),
    note: String(note || "تسجيل التكلفة الفعلية لشركة الشحن").trim(),
    recordedBy: actorId,
    recordedAt: now
  });

  if (order.financialSnapshot) {
    order.financialSnapshot.actualCarrierCost = validActualCost;
    const netMerch = Number(order.financialSnapshot.merchandiseNetTotal || 0);
    const custShip = Number(order.financialSnapshot.customerShippingCharge ?? order.shipping ?? 0);
    const prodCost = Number(order.financialSnapshot.totalProductCostSnapshot || 0);
    order.financialSnapshot.confirmedGrossMargin = roundMoney(
      netMerch + custShip - prodCost - validActualCost
    );
  }

  order.markModified("shippingSnapshot");
  order.markModified("financialSnapshot");
  await order.save();

  await recordFinanceAudit(subdomain, {
    action: "order_actual_shipping_cost_recorded",
    entityType: "order_shipping",
    entityId: String(order._id),
    referenceCode: order.orderId,
    summary: `تسجيل تكلفة الشحن الفعلية للطلب ${order.orderId} بقيمة ${validActualCost}`,
    beforeState: { actualCarrierCost: previousActualCost },
    afterState: {
      actualCarrierCost: validActualCost,
      actualCostStatus: "confirmed",
      carrierName: order.shippingSnapshot.carrierName,
      trackingReference: order.shippingSnapshot.trackingReference
    },
    actor,
    activityPayload: {
      eventType: "order_shipping_cost_recorded",
      orderId: order._id,
      amount: validActualCost,
      note: note || `تسجيل التكلفة الفعلية للشحن (${validActualCost})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.ORDER_ACTUAL_SHIPPING_COST_RECORDED, {
    subdomain,
    order: order.toObject()
  });

  return order.toObject();
}

/**
 * Explicit pickup-completion workflow action (Confirmed -> Awaiting Pickup -> Completed).
 */
async function completeOrderPickup(subdomain, { orderId, note = "", actor = null }) {
  const Orders = getOrdersModel(subdomain);
  const mongoose = require("mongoose");

  let order = null;
  if (mongoose.isValidObjectId(orderId)) {
    order = await Orders.findById(orderId);
  }
  if (!order) {
    order = await Orders.findOne({ orderId: String(orderId || "").trim() });
  }
  if (!order) {
    throw createFinanceError("الطلب غير موجود", 404);
  }

  if (order.deliveryMethod !== "pickup") {
    throw createFinanceError("هذا الإجراء مخصص لطلبات الاستلام من الفرع (Pickup) فقط", 400);
  }

  if (["cancelled", "returned"].includes(order.status)) {
    throw createFinanceError("لا يمكن إتمام استلام طلب ملغي أو مسترجع", 400);
  }

  if (order.status === "new") {
    throw createFinanceError(
      "يجب تأكيد الطلب أولاً (Confirmed / Awaiting Pickup) قبل تسجيل استلام العميل للطلب",
      400
    );
  }

  const now = new Date();
  const actorId = actor?._id || actor?.userId || null;
  const previousStatus = order.status;

  order.status = "delivered";
  order.pickupCompletedAt = now;
  order.pickupCompletedBy = actorId;

  if (order.payment?.method === "cod") {
    order.payment.paid = true;
  }

  order.timeline.push({
    status: "delivered",
    at: now,
    note: note || "تم استلام الطلب من الفرع بواسطة العميل (Pickup Completed)"
  });

  await order.save();

  await recordOrderLifecycleEvents(subdomain, {
    order,
    eventType: "order_completed",
    occurredAt: now
  });

  await recordFinanceAudit(subdomain, {
    action: "order_pickup_completed",
    entityType: "order_shipping",
    entityId: String(order._id),
    referenceCode: order.orderId,
    summary: `تم تأكيد استلام العميل للطلب ${order.orderId} من الفرع`,
    beforeState: { status: previousStatus },
    afterState: { status: "delivered", pickupCompletedAt: now },
    actor
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.ORDER_PICKUP_COMPLETED, {
    subdomain,
    order: order.toObject()
  });

  return order.toObject();
}

/**
 * Preview shipping & address classification for checkout or admin simulator.
 */
async function previewShippingQuote(subdomain, payload = {}, adminData = null) {
  const financeSettings = await getFinanceSettings(subdomain);
  const deliveryMethod = payload.deliveryMethod === "pickup" ? "pickup" : "delivery";

  if (deliveryMethod === "pickup" && !financeSettings.pickup.enabled && !payload.allowPickupPreview) {
    throw createFinanceError("خيار الاستلام من الفرع غير مفعل حالياً في إعدادات المتجر", 400);
  }

  const quote = await calculateOrderShippingAuthoritative(subdomain, {
    items: payload.items || [],
    deliveryMethod,
    address: payload.address || "",
    city: payload.city || "",
    selectedShippingClassId: payload.selectedShippingClassId || payload.shippingClassId || null,
    selectedShippingClassCode: payload.selectedShippingClassCode || payload.shippingClassCode || null,
    requireValidClassWhenConfigured: false,
    addQuantityBehavior: payload.addQuantityBehavior || financeSettings.shippingConfig.addQuantityBehavior,
    respectFreeShippingThreshold:
      payload.respectFreeShippingThreshold ?? financeSettings.shippingConfig.respectFreeShippingThreshold,
    freeShippingThreshold: payload.freeShippingThreshold ?? adminData?.freeShippingOver ?? 0,
    fallbackShippingCost: adminData?.shippingCost ?? 50,
    adminData,
    allowAiFallback: financeSettings.shippingConfig.useAiAddressFallback
  });

  return {
    quote,
    pickupConfig: financeSettings.pickup,
    shippingConfig: financeSettings.shippingConfig
  };
}

module.exports = {
  listShippingClasses,
  getShippingClassById,
  createShippingClass,
  updateShippingClass,
  toggleShippingClassStatus,
  deleteShippingClass,
  recordOrderActualShippingCost,
  completeOrderPickup,
  previewShippingQuote,
  classifyCustomerAddress
};
