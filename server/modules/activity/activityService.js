const mongoose = require("mongoose");
const getActivityModel = require("./activityModel");
const getProductsModel = require("../products/productModel");
const getOffersModel = require("../offers/offerModel");
const getCouponsModel = require("../coupons/couponModel");

const { SUPPORTED_EVENT_TYPES } = getActivityModel;

/**
 * Resolve product pricing and active offer snapshot at event time.
 * `unitPrice` represents `product.price` (the effective selling price per unit after any product/offer markdown).
 */
async function resolveProductPriceAndOfferSnapshot(subdomain, productOrId) {
  if (!productOrId) {
    return { productId: null, unitPrice: null, offerId: null, offerDiscountPercent: null };
  }

  const Products = getProductsModel(subdomain);
  const Offers = getOffersModel(subdomain);

  let prod = null;
  if (typeof productOrId === "object" && productOrId._id) {
    prod = productOrId;
  } else if (mongoose.isValidObjectId(productOrId)) {
    prod = await Products.findById(productOrId).populate("offerId").lean();
  }

  if (!prod) {
    return { productId: null, unitPrice: null, offerId: null, offerDiscountPercent: null };
  }

  const unitPrice = typeof prod.price === "number" ? prod.price : Number(prod.price || 0);
  let offerId = null;
  let offerDiscountPercent = null;

  if (prod.offerId) {
    let offerDoc = null;
    if (typeof prod.offerId === "object" && prod.offerId._id) {
      offerDoc = prod.offerId;
    } else if (mongoose.isValidObjectId(prod.offerId)) {
      offerDoc = await Offers.findById(prod.offerId).lean();
    }

    if (offerDoc && offerDoc.active !== false) {
      offerId = offerDoc._id;
      if (typeof offerDoc.discountPercentage === "number" && offerDoc.discountPercentage > 0) {
        offerDiscountPercent = offerDoc.discountPercentage;
      }
    }
  }

  // If product has oldPrice > price and no explicit offerDiscountPercent from offerDoc, snapshot the markdown % if offerId is present
  if (offerId && offerDiscountPercent === null && prod.oldPrice > prod.price && prod.oldPrice > 0) {
    offerDiscountPercent = Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100);
  }

  return {
    productId: prod._id,
    unitPrice,
    offerId,
    offerDiscountPercent
  };
}

/**
 * Resolve coupon snapshot (couponApplied & couponDiscountPercent) when couponCode or coupon info is provided.
 */
async function resolveCouponSnapshot(subdomain, { couponCode, couponApplied, couponDiscountPercent }) {
  if (couponCode && String(couponCode).trim()) {
    const Coupons = getCouponsModel(subdomain);
    const cleanCode = String(couponCode).toUpperCase().trim();
    const couponDoc = await Coupons.findOne({ code: cleanCode }).lean();
    if (couponDoc) {
      return {
        couponApplied: true,
        couponDiscountPercent:
          couponDoc.type === "discount" && typeof couponDoc.discount === "number"
            ? couponDoc.discount
            : couponDiscountPercent ?? null
      };
    }
    return {
      couponApplied: true,
      couponDiscountPercent: couponDiscountPercent ?? null
    };
  }

  if (typeof couponApplied === "boolean") {
    return {
      couponApplied,
      couponDiscountPercent: couponApplied && typeof couponDiscountPercent === "number" ? couponDiscountPercent : null
    };
  }

  return {
    couponApplied: null,
    couponDiscountPercent: null
  };
}

/**
 * Extract user, visitor, session, and cart identifiers from request headers/body/query.
 */
function extractActorContext(req, overrides = {}) {
  const body = req?.body || {};
  const query = req?.query || {};
  const headers = req?.headers || {};

  const userId = overrides.userId !== undefined
    ? overrides.userId
    : (req?.user?._id || null);

  const visitorId = (
    overrides.visitorId ||
    body.visitorId ||
    query.visitorId ||
    headers["x-visitor-id"] ||
    ""
  ).toString().trim() || null;

  const sessionId = (
    overrides.sessionId ||
    body.sessionId ||
    query.sessionId ||
    headers["x-session-id"] ||
    ""
  ).toString().trim() || null;

  const cartId = (
    overrides.cartId ||
    body.cartId ||
    query.cartId ||
    headers["x-cart-id"] ||
    ""
  ).toString().trim() || null;

  return {
    userId: userId && mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null,
    visitorId,
    sessionId,
    cartId
  };
}

/**
 * Core activity recording function with duplicate/retry protection and null/absent field hygiene.
 */
async function recordActivity(subdomain, payload = {}) {
  const {
    eventType,
    product,
    productId: rawProductId,
    userId = null,
    visitorId = null,
    sessionId = null,
    cartId = null,
    orderId = null,
    shipmentId = null,
    paymentId = null,
    quantity = null,
    unitPrice: explicitUnitPrice = null,
    amount = null,
    currency = null,
    note = null,
    offerId: explicitOfferId = null,
    offerDiscountPercent: explicitOfferDiscountPercent = null,
    couponCode = null,
    couponApplied: explicitCouponApplied = null,
    couponDiscountPercent: explicitCouponDiscountPercent = null,
    occurredAt = new Date(),
    dedupeWindowMs = 0
  } = payload;

  if (!eventType || !SUPPORTED_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Unsupported or missing Activity eventType: "${eventType}"`);
  }

  const Activity = getActivityModel(subdomain);

  // Resolve product & offer snapshot if relevant
  let resolvedProduct = {
    productId: null,
    unitPrice: explicitUnitPrice,
    offerId: explicitOfferId,
    offerDiscountPercent: explicitOfferDiscountPercent
  };

  if (product || rawProductId) {
    const snap = await resolveProductPriceAndOfferSnapshot(subdomain, product || rawProductId);
    resolvedProduct = {
      productId: snap.productId,
      unitPrice: explicitUnitPrice !== null && explicitUnitPrice !== undefined ? Number(explicitUnitPrice) : snap.unitPrice,
      offerId: explicitOfferId !== null && explicitOfferId !== undefined ? explicitOfferId : snap.offerId,
      offerDiscountPercent:
        explicitOfferDiscountPercent !== null && explicitOfferDiscountPercent !== undefined
          ? Number(explicitOfferDiscountPercent)
          : snap.offerDiscountPercent
    };
  }

  // Resolve coupon snapshot where applicable (cart, checkout, order events)
  const couponEvents = ["add_to_cart", "checkout_started", "order_created", "order_completed", "order_cancelled", "product_returned"];
  let couponSnap = { couponApplied: null, couponDiscountPercent: null };
  if (couponEvents.includes(eventType)) {
    couponSnap = await resolveCouponSnapshot(subdomain, {
      couponCode,
      couponApplied: explicitCouponApplied,
      couponDiscountPercent: explicitCouponDiscountPercent
    });
    // For checkout/order events, if couponApplied wasn't explicitly set, default to Boolean(couponCode)
    if (["checkout_started", "order_created", "order_completed", "order_cancelled"].includes(eventType) && couponSnap.couponApplied === null) {
      couponSnap.couponApplied = Boolean(couponCode && String(couponCode).trim());
    }
  }

  const validOrderId = orderId && mongoose.isValidObjectId(orderId) ? new mongoose.Types.ObjectId(orderId) : null;
  const validUserId = userId && mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null;
  const validShipmentId = shipmentId && mongoose.isValidObjectId(shipmentId) ? new mongoose.Types.ObjectId(shipmentId) : null;
  const validPaymentId = paymentId && mongoose.isValidObjectId(paymentId) ? new mongoose.Types.ObjectId(paymentId) : null;

  // Idempotency / Duplicate Prevention:
  // 1. Critical order lifecycle events (order_created, order_cancelled, order_completed, product_returned)
  //    must never be duplicated for the same (orderId, eventType, productId).
  if (validOrderId && ["order_created", "order_cancelled", "order_completed", "product_returned"].includes(eventType)) {
    const existingOrderEvent = await Activity.findOne({
      orderId: validOrderId,
      eventType,
      productId: resolvedProduct.productId || null
    }).lean();
    if (existingOrderEvent) {
      return { doc: existingOrderEvent, deduplicated: true };
    }
  }

  // 2. Time-window deduplication for rapid retries / double-clicks (e.g. product_viewed, checkout_started, wishlist, cart)
  const effectiveDedupeMs =
    dedupeWindowMs > 0
      ? dedupeWindowMs
      : eventType === "product_viewed"
      ? 10000 // 10s window for accidental duplicate view fetches (e.g. React StrictMode or modal+page load)
      : eventType === "checkout_started"
      ? 15000 // 15s window for repeated checkout modal open
      : ["wishlist_added", "wishlist_removed", "add_to_cart", "remove_from_cart"].includes(eventType)
      ? 2000 // 2s network retry guard
      : 0; // Note: price_feedback has 0ms dedupe window if distinct clicks, or 1000ms network retry guard

  if (effectiveDedupeMs > 0) {
    const since = new Date(new Date(occurredAt).getTime() - effectiveDedupeMs);
    const dedupeFilter = {
      eventType,
      productId: resolvedProduct.productId || null,
      occurredAt: { $gte: since }
    };
    if (validUserId) dedupeFilter.userId = validUserId;
    else if (visitorId) dedupeFilter.visitorId = visitorId;
    else if (sessionId) dedupeFilter.sessionId = sessionId;

    if (validUserId || visitorId || sessionId) {
      const recentDup = await Activity.findOne(dedupeFilter).lean();
      if (recentDup) {
        return { doc: recentDup, deduplicated: true };
      }
    }
  }

  // Construct clean document with null for non-applicable fields
  const docData = {
    eventType,
    productId: resolvedProduct.productId || null,
    userId: validUserId,
    visitorId: visitorId || null,
    sessionId: sessionId || null,
    cartId: cartId || null,
    orderId: validOrderId,
    shipmentId: validShipmentId,
    paymentId: validPaymentId,
    quantity: quantity !== null && quantity !== undefined && !Number.isNaN(Number(quantity)) ? Number(quantity) : null,
    unitPrice:
      resolvedProduct.unitPrice !== null && resolvedProduct.unitPrice !== undefined && !Number.isNaN(Number(resolvedProduct.unitPrice))
        ? Number(resolvedProduct.unitPrice)
        : null,
    amount: amount !== null && amount !== undefined && !Number.isNaN(Number(amount)) ? Number(amount) : null,
    currency: currency ? String(currency).trim().toUpperCase() : null,
    note: note ? String(note).trim() : null,
    offerId: resolvedProduct.offerId || null,
    offerDiscountPercent:
      resolvedProduct.offerDiscountPercent !== null &&
      resolvedProduct.offerDiscountPercent !== undefined &&
      !Number.isNaN(Number(resolvedProduct.offerDiscountPercent))
        ? Number(resolvedProduct.offerDiscountPercent)
        : null,
    couponApplied: typeof couponSnap.couponApplied === "boolean" ? couponSnap.couponApplied : null,
    couponDiscountPercent:
      couponSnap.couponDiscountPercent !== null &&
      couponSnap.couponDiscountPercent !== undefined &&
      !Number.isNaN(Number(couponSnap.couponDiscountPercent))
        ? Number(couponSnap.couponDiscountPercent)
        : null,
    occurredAt: occurredAt instanceof Date ? occurredAt : new Date(occurredAt || Date.now())
  };

  const saved = await new Activity(docData).save();
  return { doc: saved.toObject(), deduplicated: false };
}

/**
 * Record order-level and item-level events when an order is created or transitions status.
 * Creates one activity record per order item (with productId, quantity, unitPrice, orderId, offer/coupon snapshots)
 * so both product-level rankings/analytics and order-level distinct orderId aggregations work accurately.
 */
async function recordOrderLifecycleEvents(subdomain, { order, eventType, actor = {}, occurredAt = new Date() }) {
  if (!order || !order._id) return [];
  const items = Array.isArray(order.items) ? order.items : [];
  const couponCode = order.coupon || null;
  const couponApplied = Boolean((order.coupon && String(order.coupon).trim()) || Number(order.discount || 0) > 0);

  let couponDiscountPercent = null;
  if (couponCode) {
    const snap = await resolveCouponSnapshot(subdomain, { couponCode });
    couponDiscountPercent = snap.couponDiscountPercent;
  } else if (couponApplied && Number(order.subtotal || 0) > 0 && Number(order.discount || 0) > 0) {
    couponDiscountPercent = Math.round((Number(order.discount) / Number(order.subtotal)) * 100);
  }

  const results = [];
  for (const item of items) {
    if (!item.productId || !mongoose.isValidObjectId(item.productId)) continue;
    const res = await recordActivity(subdomain, {
      eventType,
      productId: item.productId,
      userId: order.userId || actor.userId || null,
      visitorId: order.visitorId || actor.visitorId || null,
      sessionId: order.sessionId || actor.sessionId || null,
      cartId: order.cartId || actor.cartId || null,
      orderId: order._id,
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.price || 0),
      couponCode,
      couponApplied,
      couponDiscountPercent,
      occurredAt
    });
    results.push(res);
  }
  return results;
}

module.exports = {
  SUPPORTED_EVENT_TYPES,
  extractActorContext,
  resolveProductPriceAndOfferSnapshot,
  resolveCouponSnapshot,
  recordActivity,
  recordOrderLifecycleEvents
};
