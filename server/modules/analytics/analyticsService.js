const mongoose = require("mongoose");
const getActivityModel = require("../activity/activityModel");
const getOrdersModel = require("../orders/orderModel");
const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");
const getUsersModel = require("../auth/userModel");
const getReviewsModel = require("../products/reviewModel");

/**
 * Analytics Service — Reusable Backend Analytics Engine
 *
 * Explicit Metric Definitions & Numerator/Denominator Documentation:
 * - `viewToCartConversion`:
 *     Numerator: Distinct actors (`userId || visitorId || sessionId`) who performed `add_to_cart` in the window.
 *     Denominator: Distinct actors who performed `product_viewed` in the window.
 *     Unit: Percentage (0–100%), rounded to 2 decimal places. Null if denominator === 0.
 *     (Also returns `eventBasedRate` = add_to_cart events / product_viewed events for transparency).
 * - `viewToPurchaseConversion`:
 *     Numerator: Distinct completed orders (`status === "delivered"`) in the window (or distinct actors with `order_completed`).
 *     Denominator: Distinct visitors/sessions (`userId || visitorId || sessionId`) who viewed products in the window.
 *     Unit: Percentage (0–100%). Null if denominator === 0. Never treats repeated views by the same visitor as independent visitors.
 * - `wishlistToCartConversion`:
 *     Numerator: Distinct (actor, productId) pairs where the same actor (`userId || visitorId || sessionId`) added the product to wishlist (`wishlist_added`) AND subsequently added the same product to cart (`add_to_cart`) within the period.
 *     Denominator: Distinct (actor, productId) pairs with `wishlist_added` in the period.
 *     Unit: Percentage (0–100%). Null if denominator === 0.
 * - `cartToCheckoutConversion`:
 *     Numerator: Distinct carts/actors (`cartId || userId || visitorId || sessionId`) with `checkout_started` in the window.
 *     Denominator: Distinct carts/actors with `add_to_cart` in the window.
 *     Unit: Percentage (0–100%). Null if denominator === 0.
 * - `orderCompletionRate`:
 *     Numerator: Orders reaching `delivered` (`order_completed` / authoritative `storeOrder.status === "delivered"`).
 *     Denominator: Total orders created in the selected period.
 *     Unit: Percentage (0–100%). Null if denominator === 0.
 * - `orderCancellationRate`:
 *     Numerator: Orders reaching `cancelled` (`order_cancelled` / authoritative `storeOrder.status === "cancelled"`).
 *     Denominator: Total orders created in the selected period.
 *     Unit: Percentage (0–100%). Null if denominator === 0.
 * - `productReturnRate`:
 *     Numerator: Returned units (`product_returned` quantity / authoritative `storeOrder.status === "returned"` item quantities).
 *     Denominator: Completed + Returned units in the selected period (or total ordered units when viewing order-level return rate). Both order-based and unit-based rates are provided.
 *     Unit: Percentage (0–100%). Null if denominator === 0.
 * - `cartAbandonmentRate`:
 *     Uses cart/order linkage (`cartId` or actor session linkage) and a defined 24-hour abandonment window (carts with `add_to_cart` or `checkout_started` older than 24h without a linked `order_created` by `cartId` or actor). Never inferred by subtracting raw cart events from total orders.
 */

const TIMEZONE = "Africa/Cairo";
const ABANDONMENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const METRIC_DEFINITIONS = {
  viewToCartConversion: {
    name: "معدل التحويل من المشاهدة إلى السلة (View-to-Cart Rate)",
    numerator: "عدد الزوار/الجلسات الفريدة التي أضافت منتجاً للسلة (Distinct Actors with add_to_cart)",
    denominator: "عدد الزوار/الجلسات الفريدة التي شاهدت المنتجات (Distinct Actors with product_viewed)",
    unit: "percentage (%)",
    notes: "يعتمد على الزوار الفريدين وليس إجمالي النقرات المتكررة لنفس الزائر."
  },
  viewToPurchaseConversion: {
    name: "معدل التحويل إلى الشراء المكتمل (View-to-Completed-Purchase Rate)",
    numerator: "عدد الزوار الفريدين الذين أتموا شراءً مكتملاً أو عدد الطلبات المكتملة المنسوبة",
    denominator: "عدد الزوار/الجلسات الفريدة التي شاهدت المنتجات في نفس الفترة",
    unit: "percentage (%)",
    notes: "لا يتم احتساب المشاهدات المتكررة لنفس الزائر كزوار مستقلين."
  },
  wishlistToCartConversion: {
    name: "معدل التحويل من المفضلة إلى السلة (Wishlist-to-Cart Attribution Rate)",
    numerator: "الأزواج الفريدة (زائر + منتج) التي أُضيفت للمفضلة ثم أُضيفت للسلة من نفس الزائر",
    denominator: "إجمالي الأزواج الفريدة (زائر + منتج) التي أُضيفت للمفضلة في الفترة",
    unit: "percentage (%)"
  },
  cartToCheckoutConversion: {
    name: "معدل الانتقال من السلة إلى بدء الدفع (Cart-to-Checkout Rate)",
    numerator: "عدد السلات/الزوار الفريدين الذين بدأوا خطوة إتمام الطلب (checkout_started)",
    denominator: "عدد السلات/الزوار الفريدين الذين أضافوا منتجات للسلة (add_to_cart)",
    unit: "percentage (%)"
  },
  orderCompletionRate: {
    name: "معدل إتمام وتسليم الطلبات (Order Completion Rate)",
    numerator: "عدد الطلبات المكتملة (المسلّمة delivered)",
    denominator: "إجمالي الطلبات المنشأة في نفس الفترة الزمنية",
    unit: "percentage (%)"
  },
  orderCancellationRate: {
    name: "معدل إلغاء الطلبات (Order Cancellation Rate)",
    numerator: "عدد الطلبات الملغاة (cancelled)",
    denominator: "إجمالي الطلبات المنشأة في نفس الفترة الزمنية",
    unit: "percentage (%)"
  },
  productReturnRate: {
    name: "معدل استرجاع المنتجات (Product Return Rate)",
    numerator: "عدد الوحدات المسترجعة (أو الطلبات المسترجعة returned)",
    denominator: "إجمالي الوحدات المباعة في الطلبات المكتملة والمسترجعة (Delivered + Returned Units)",
    unit: "percentage (%)"
  },
  priceFeedbackRate: {
    name: "معدل إشارات السعر المرتفع إلى المشاهدات (Price Feedback per View Rate)",
    numerator: "إجمالي نقرات «السعر مرتفع» (price_feedback events)",
    denominator: "إجمالي مشاهدات المنتج (product_viewed events)",
    unit: "percentage (%)",
    notes: "إشارة استرشادية من العملاء للمراجعة التسعيرية وليست دليلاً قاطعاً بمفردها."
  },
  cartAbandonmentRate: {
    name: "معدل السلات المتروكة (Linked Cart Abandonment Rate)",
    numerator: "السلات الفريدة المرتبطة (cartId/actor) التي مر عليها أكثر من 24 ساعة (أو انتهت الجلسة) دون طلب مرتبط",
    denominator: "إجمالي السلات الفريدة النشطة القابلة للتقييم في نافذة الإهمال",
    unit: "percentage (%)",
    notes: "يُحسب عبر ربط معرف السلة/الزائر بالطلبات الفعلية ولا يُحسب بطرح الأحداث الخام."
  }
};

/**
 * Parse date range and compute exact previous period of equal duration.
 */
function parseDateRange(query = {}) {
  const now = new Date();
  let startDate = null;
  let endDate = now;
  const rangePreset = String(query.range || query.period || "30d").trim();

  if (query.startDate || query.from) {
    const parsedStart = new Date(query.startDate || query.from);
    if (!Number.isNaN(parsedStart.getTime())) {
      startDate = parsedStart;
    }
  }

  if (query.endDate || query.to) {
    const parsedEnd = new Date(query.endDate || query.to);
    if (!Number.isNaN(parsedEnd.getTime())) {
      // If only YYYY-MM-DD was passed, set to end of day
      if (String(query.endDate || query.to).length <= 10) {
        parsedEnd.setHours(23, 59, 59, 999);
      }
      endDate = parsedEnd;
    }
  }

  if (!startDate) {
    const daysMatch = rangePreset.match(/^(\d+)d$/i);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : rangePreset === "7d" ? 7 : rangePreset === "90d" ? 90 : 30;
    startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  }

  if (startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const durationMs = Math.max(24 * 60 * 60 * 1000, endDate.getTime() - startDate.getTime());
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  const daysSpan = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
  const interval = query.interval || (daysSpan > 60 ? "week" : "day");

  return {
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    durationMs,
    daysSpan,
    interval,
    timezone: TIMEZONE,
    rangePreset
  };
}

function safeRate(numerator, denominator) {
  const num = Number(numerator || 0);
  const den = Number(denominator || 0);
  if (!den || den <= 0) return null;
  return Math.round((num / den) * 10000) / 100; // 2 decimal places percentage
}

function computeDelta(currentVal, previousVal) {
  const curr = currentVal !== null && currentVal !== undefined ? Number(currentVal) : null;
  const prev = previousVal !== null && previousVal !== undefined ? Number(previousVal) : null;
  if (curr === null || prev === null) {
    return { current: curr, previous: prev, diff: null, percentChange: null };
  }
  const diff = Math.round((curr - prev) * 100) / 100;
  if (prev === 0) {
    return {
      current: curr,
      previous: 0,
      diff,
      percentChange: curr > 0 ? 100 : 0,
      isNewFromZero: curr > 0
    };
  }
  const percentChange = Math.round(((curr - prev) / Math.abs(prev)) * 10000) / 100;
  return { current: curr, previous: prev, diff, percentChange, isNewFromZero: false };
}

function getActorKey(doc) {
  if (!doc) return null;
  if (doc.userId) return `u:${String(doc.userId)}`;
  if (doc.visitorId) return `v:${String(doc.visitorId)}`;
  if (doc.sessionId) return `s:${String(doc.sessionId)}`;
  return null;
}

function getCartKey(doc) {
  if (!doc) return null;
  if (doc.cartId) return `c:${String(doc.cartId)}`;
  return getActorKey(doc);
}

/**
 * Resolve filtered product IDs when categoryId or offerId filter is applied.
 */
async function resolveFilteredProductContext(subdomain, { categoryId, offerId } = {}) {
  const Products = getProductsModel(subdomain);
  const Categories = getCategoriesModel(subdomain);

  const prodQuery = {};
  let categoryDoc = null;

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    categoryDoc = await Categories.findById(categoryId).lean();
    const childCats = await Categories.find({ parentId: categoryId }).select("_id").lean();
    if (childCats.length > 0) {
      prodQuery.categoryId = {
        $in: [new mongoose.Types.ObjectId(categoryId), ...childCats.map((c) => c._id)]
      };
    } else {
      prodQuery.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
  }

  if (offerId && mongoose.isValidObjectId(offerId)) {
    prodQuery.offerId = new mongoose.Types.ObjectId(offerId);
  }

  const hasProductFilter = Object.keys(prodQuery).length > 0;
  const products = await Products.find(prodQuery).populate("categoryId").populate("offerId").lean();
  const productMap = new Map();
  products.forEach((p) => productMap.set(String(p._id), p));
  const productObjectIds = products.map((p) => p._id);
  const productStringIds = products.map((p) => String(p._id));

  return {
    hasProductFilter,
    categoryDoc,
    products,
    productMap,
    productObjectIds,
    productStringIds
  };
}

/**
 * Compute core activity, order, financial, conversion, and abandonment metrics for a single time window.
 */
async function computeWindowMetrics(subdomain, { startDate, endDate, productContext, productId = null, branchId = null }) {
  const Activity = getActivityModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const actMatch = {
    occurredAt: { $gte: startDate, $lte: endDate }
  };

  let targetProductStringIds = null;
  if (productId && mongoose.isValidObjectId(productId)) {
    actMatch.productId = new mongoose.Types.ObjectId(productId);
    targetProductStringIds = new Set([String(productId)]);
  } else if (productContext?.hasProductFilter) {
    actMatch.productId = { $in: productContext.productObjectIds };
    targetProductStringIds = new Set(productContext.productStringIds);
  }

  const orderMatch = {
    createdAt: { $gte: startDate, $lte: endDate }
  };
  if (targetProductStringIds) {
    orderMatch["items.productId"] = { $in: Array.from(targetProductStringIds) };
  }
  if (branchId && branchId !== "all" && mongoose.isValidObjectId(branchId)) {
    const bObjId = new mongoose.Types.ObjectId(branchId);
    actMatch.branchId = bObjId;
    orderMatch.branchId = bObjId;
  }

  const [activities, orders] = await Promise.all([
    Activity.find(actMatch).lean(),
    Orders.find(orderMatch).lean()
  ]);

  // Activity Counters & Actor Sets
  let productViews = 0;
  const viewActors = new Set();
  const viewSessions = new Set();

  let wishlistAdded = 0;
  let wishlistRemoved = 0;
  const wishlistActorProductPairs = new Map(); // "actor|productId" -> first occurredAt

  let addToCartEvents = 0;
  let addToCartQuantity = 0;
  let removeFromCartEvents = 0;
  let removeFromCartQuantity = 0;
  const cartActors = new Set();
  const cartKeys = new Map(); // cartKey -> { lastCartAt, hasOrder }
  const cartActorProductPairs = new Map(); // "actor|productId" -> last occurredAt

  let checkoutStartedEvents = 0;
  const checkoutActors = new Set();
  const checkoutCartKeys = new Set();

  let priceFeedbackEvents = 0;
  const priceFeedbackActors = new Set();

  let activityOrderCreatedEvents = 0;
  let activityOrderCompletedEvents = 0;
  let activityOrderCancelledEvents = 0;
  let activityProductReturnedEvents = 0;
  let activityReturnedQuantity = 0;

  const orderCreatedCartKeys = new Set();

  for (const act of activities) {
    const actor = getActorKey(act);
    const cKey = getCartKey(act);
    const pIdStr = act.productId ? String(act.productId) : "";
    const atTime = act.occurredAt ? new Date(act.occurredAt).getTime() : 0;

    switch (act.eventType) {
      case "product_viewed":
        productViews += 1;
        if (actor) viewActors.add(actor);
        if (act.sessionId) viewSessions.add(String(act.sessionId));
        break;
      case "wishlist_added":
        wishlistAdded += 1;
        if (actor && pIdStr) {
          const pairKey = `${actor}|${pIdStr}`;
          if (!wishlistActorProductPairs.has(pairKey) || atTime < wishlistActorProductPairs.get(pairKey)) {
            wishlistActorProductPairs.set(pairKey, atTime);
          }
        }
        break;
      case "wishlist_removed":
        wishlistRemoved += 1;
        break;
      case "add_to_cart":
        addToCartEvents += 1;
        addToCartQuantity += Number(act.quantity || 1);
        if (actor) cartActors.add(actor);
        if (cKey) {
          const prev = cartKeys.get(cKey) || { lastAt: 0, ordered: false };
          if (atTime > prev.lastAt) prev.lastAt = atTime;
          cartKeys.set(cKey, prev);
        }
        if (actor && pIdStr) {
          const pairKey = `${actor}|${pIdStr}`;
          if (!cartActorProductPairs.has(pairKey) || atTime > cartActorProductPairs.get(pairKey)) {
            cartActorProductPairs.set(pairKey, atTime);
          }
        }
        break;
      case "remove_from_cart":
        removeFromCartEvents += 1;
        removeFromCartQuantity += Number(act.quantity || 1);
        break;
      case "checkout_started":
        checkoutStartedEvents += 1;
        if (actor) checkoutActors.add(actor);
        if (cKey) {
          checkoutCartKeys.add(cKey);
          const prev = cartKeys.get(cKey) || { lastAt: 0, ordered: false };
          if (atTime > prev.lastAt) prev.lastAt = atTime;
          cartKeys.set(cKey, prev);
        }
        break;
      case "price_feedback":
        priceFeedbackEvents += 1;
        if (actor) priceFeedbackActors.add(actor);
        break;
      case "order_created":
        activityOrderCreatedEvents += 1;
        if (cKey) orderCreatedCartKeys.add(cKey);
        if (actor) orderCreatedCartKeys.add(actor);
        break;
      case "order_completed":
        activityOrderCompletedEvents += 1;
        break;
      case "order_cancelled":
        activityOrderCancelledEvents += 1;
        break;
      case "product_returned":
        activityProductReturnedEvents += 1;
        activityReturnedQuantity += Number(act.quantity || 1);
        break;
      default:
        break;
    }
  }

  // Authoritative Order & Financial Calculations from `storeOrder`
  let ordersCreated = 0;
  let ordersCompleted = 0;
  let ordersCancelled = 0;
  let ordersReturned = 0;
  let ordersActiveInProgress = 0;

  let unitsOrdered = 0;
  let unitsSoldCompleted = 0;
  let unitsSoldValid = 0; // non-cancelled, non-returned
  let unitsCancelled = 0;
  let unitsReturned = 0;

  let grossRevenueValid = 0; // non-cancelled, non-returned
  let completedRevenue = 0; // strictly delivered
  let cancelledOrderValue = 0;
  let returnedOrderValue = 0;
  let netProfitCompleted = 0;
  let netProfitValid = 0;

  const purchaseActors = new Set();
  const completedPurchaseActors = new Set();

  for (const ord of orders) {
    ordersCreated += 1;
    const ordActor = ord.userId
      ? `u:${String(ord.userId)}`
      : ord.visitorId
      ? `v:${String(ord.visitorId)}`
      : ord.sessionId
      ? `s:${String(ord.sessionId)}`
      : ord.customer?.phone
      ? `p:${String(ord.customer.phone)}`
      : null;

    if (ordActor) purchaseActors.add(ordActor);
    if (ord.cartId) orderCreatedCartKeys.add(`c:${String(ord.cartId)}`);
    if (ordActor) orderCreatedCartKeys.add(ordActor);

    const relevantItems = (ord.items || []).filter((it) =>
      targetProductStringIds ? targetProductStringIds.has(String(it.productId)) : true
    );

    const itemQtySum = relevantItems.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    const itemSubtotalSum = relevantItems.reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1),
      0
    );
    const itemProfitSum = relevantItems.reduce(
      (sum, it) => sum + (Number(it.price || 0) - Number(it.costPrice || 0)) * Number(it.quantity || 1),
      0
    );

    // If filtering by category/product, use itemSubtotalSum; otherwise use authoritative order total (or itemSubtotalSum)
    const orderFinancialValue = targetProductStringIds ? itemSubtotalSum : Number(ord.total || itemSubtotalSum || 0);

    unitsOrdered += itemQtySum;

    if (ord.status === "delivered") {
      ordersCompleted += 1;
      unitsSoldCompleted += itemQtySum;
      unitsSoldValid += itemQtySum;
      completedRevenue += orderFinancialValue;
      grossRevenueValid += orderFinancialValue;
      netProfitCompleted += itemProfitSum;
      netProfitValid += itemProfitSum;
      if (ordActor) completedPurchaseActors.add(ordActor);
    } else if (ord.status === "cancelled") {
      ordersCancelled += 1;
      unitsCancelled += itemQtySum;
      cancelledOrderValue += orderFinancialValue;
    } else if (ord.status === "returned") {
      ordersReturned += 1;
      unitsReturned += itemQtySum;
      returnedOrderValue += orderFinancialValue;
    } else {
      ordersActiveInProgress += 1;
      unitsSoldValid += itemQtySum;
      grossRevenueValid += orderFinancialValue;
      netProfitValid += itemProfitSum;
    }
  }

  // Reconcile return counts if Activity has product_returned events recorded inside window
  const finalReturnEvents = Math.max(ordersReturned, activityProductReturnedEvents);
  const finalReturnedQuantity = Math.max(unitsReturned, activityReturnedQuantity);

  // Wishlist-to-Cart Attribution (same actor + same productId)
  let wishlistToCartConvertedPairs = 0;
  wishlistActorProductPairs.forEach((wishTime, pairKey) => {
    if (cartActorProductPairs.has(pairKey)) {
      const cartTime = cartActorProductPairs.get(pairKey);
      if (cartTime >= wishTime) {
        wishlistToCartConvertedPairs += 1;
      }
    }
  });

  // Cart Abandonment with Cart/Order Linkage and 24h Abandonment Cutoff
  const abandonmentCutoff = Date.now() - ABANDONMENT_WINDOW_MS;
  let evaluableCarts = 0;
  let abandonedCarts = 0;
  let convertedCarts = 0;

  cartKeys.forEach((info, cKey) => {
    const isConverted = orderCreatedCartKeys.has(cKey);
    if (isConverted) {
      evaluableCarts += 1;
      convertedCarts += 1;
    } else if (info.lastAt <= abandonmentCutoff) {
      evaluableCarts += 1;
      abandonedCarts += 1;
    }
  });

  const uniqueVisitorsOrSessions = viewActors.size;
  const uniqueCartActors = cartActors.size;
  const uniqueCheckoutActors = checkoutActors.size || checkoutCartKeys.size;

  // Conversion Rates (with explicit numerators & denominators)
  const viewToCartConversion = safeRate(uniqueCartActors, uniqueVisitorsOrSessions);
  const viewToCartEventRate = safeRate(addToCartEvents, productViews);

  // For view-to-completed-purchase:
  // Use completed orders relative to unique visitors (capped at 100% if historical orders completed in window exceed new visitors)
  const viewToPurchaseConversion =
    uniqueVisitorsOrSessions > 0
      ? safeRate(completedPurchaseActors.size || ordersCompleted, uniqueVisitorsOrSessions)
      : null;

  const wishlistToCartConversion = safeRate(wishlistToCartConvertedPairs, wishlistActorProductPairs.size);
  const cartToCheckoutConversion = safeRate(uniqueCheckoutActors, uniqueCartActors);
  const checkoutToOrderConversion = safeRate(ordersCreated, uniqueCheckoutActors || checkoutStartedEvents);
  const orderCompletionRate = safeRate(ordersCompleted, ordersCreated);
  const orderCancellationRate = safeRate(ordersCancelled, ordersCreated);

  // Return rate: both order-level and unit-level
  const fulfilledOrReturnedUnits = unitsSoldCompleted + finalReturnedQuantity;
  const productReturnRateByUnits = safeRate(finalReturnedQuantity, fulfilledOrReturnedUnits || unitsOrdered);
  const productReturnRateByOrders = safeRate(ordersReturned, ordersCompleted + ordersReturned || ordersCreated);

  const priceFeedbackRate = safeRate(priceFeedbackEvents, productViews);
  const cartAbandonmentRate = safeRate(abandonedCarts, evaluableCarts);

  return {
    activity: {
      productViews,
      uniqueVisitors: uniqueVisitorsOrSessions,
      uniqueSessions: viewSessions.size,
      wishlistAdded,
      wishlistRemoved,
      addToCartEvents,
      addToCartQuantity,
      uniqueCartActors,
      removeFromCartEvents,
      removeFromCartQuantity,
      checkoutStartedEvents,
      uniqueCheckoutActors,
      priceFeedbackEvents,
      uniquePriceFeedbackActors: priceFeedbackActors.size
    },
    orders: {
      ordersCreated,
      ordersCompleted,
      ordersCancelled,
      ordersReturned,
      ordersActiveInProgress,
      unitsOrdered,
      unitsSold: unitsSoldCompleted,
      unitsSoldIncludingInProgress: unitsSoldValid,
      unitsCancelled,
      returnEventCount: finalReturnEvents,
      returnedQuantity: finalReturnedQuantity
    },
    financials: {
      completedRevenue,
      grossRevenueValid,
      grossRevenue: grossRevenueValid,
      shippingRevenue: 0,
      discountsApplied: 0,
      cancelledOrderValue,
      returnedOrderValue,
      netProfitCompleted,
      netProfitValid,
      netProfit: netProfitCompleted,
      profitMargin: completedRevenue > 0 && netProfitCompleted !== null ? Math.round((netProfitCompleted / completedRevenue) * 100) : null,
      averageCompletedOrderValue: ordersCompleted > 0 ? Math.round(completedRevenue / ordersCompleted) : 0
    },
    financial: {
      completedRevenue,
      grossRevenueValid,
      grossRevenue: grossRevenueValid,
      shippingRevenue: 0,
      discountsApplied: 0,
      cancelledOrderValue,
      returnedOrderValue,
      netProfitCompleted,
      netProfitValid,
      netProfit: netProfitCompleted,
      profitMargin: completedRevenue > 0 && netProfitCompleted !== null ? Math.round((netProfitCompleted / completedRevenue) * 100) : null,
      averageCompletedOrderValue: ordersCompleted > 0 ? Math.round(completedRevenue / ordersCompleted) : 0
    },
    conversions: {
      viewToCartConversion,
      viewToCartEventRate,
      viewToPurchaseConversion,
      wishlistToCartConversion,
      wishlistAttributedPairs: wishlistToCartConvertedPairs,
      wishlistTotalPairs: wishlistActorProductPairs.size,
      cartToCheckoutConversion,
      checkoutToOrderConversion,
      orderCompletionRate,
      orderCancellationRate,
      cancellationRate: orderCancellationRate,
      productReturnRate: productReturnRateByUnits,
      productReturnRateByOrders,
      priceFeedbackRate,
      cartAbandonmentRate,
      abandonedCartsCount: abandonedCarts,
      convertedCartsCount: convertedCarts,
      evaluableCartsCount: evaluableCarts
    },
    sampleSizes: {
      totalActivityEvents: activities.length,
      totalOrdersInPeriod: orders.length
    }
  };
}

/**
 * 1. General Store Metrics + Previous Period Comparisons + Time-Series + Funnel
 */
async function getStoreOverviewAnalytics(subdomain, query = {}) {
  const dateInfo = parseDateRange(query);
  const productContext = await resolveFilteredProductContext(subdomain, {
    categoryId: query.categoryId,
    offerId: query.offerId
  });

  const [current, previous, timeSeries, funnel] = await Promise.all([
    computeWindowMetrics(subdomain, {
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate,
      productContext,
      branchId: query.branchId
    }),
    computeWindowMetrics(subdomain, {
      startDate: dateInfo.prevStartDate,
      endDate: dateInfo.prevEndDate,
      productContext,
      branchId: query.branchId
    }),
    getTimeSeriesAnalytics(subdomain, { ...query, _dateInfo: dateInfo, _productContext: productContext }),
    getFunnelAnalytics(subdomain, { ...query, _dateInfo: dateInfo, _productContext: productContext })
  ]);

  const comparisons = {
    productViews: computeDelta(current.activity.productViews, previous.activity.productViews),
    uniqueVisitors: computeDelta(current.activity.uniqueVisitors, previous.activity.uniqueVisitors),
    wishlistAdded: computeDelta(current.activity.wishlistAdded, previous.activity.wishlistAdded),
    wishlistRemoved: computeDelta(current.activity.wishlistRemoved, previous.activity.wishlistRemoved),
    addToCartEvents: computeDelta(current.activity.addToCartEvents, previous.activity.addToCartEvents),
    removeFromCartEvents: computeDelta(current.activity.removeFromCartEvents, previous.activity.removeFromCartEvents),
    checkoutStartedEvents: computeDelta(current.activity.checkoutStartedEvents, previous.activity.checkoutStartedEvents),
    ordersCreated: computeDelta(current.orders.ordersCreated, previous.orders.ordersCreated),
    ordersCompleted: computeDelta(current.orders.ordersCompleted, previous.orders.ordersCompleted),
    ordersCancelled: computeDelta(current.orders.ordersCancelled, previous.orders.ordersCancelled),
    unitsSold: computeDelta(current.orders.unitsSold, previous.orders.unitsSold),
    returnedQuantity: computeDelta(current.orders.returnedQuantity, previous.orders.returnedQuantity),
    priceFeedbackEvents: computeDelta(current.activity.priceFeedbackEvents, previous.activity.priceFeedbackEvents),
    completedRevenue: computeDelta(current.financials.completedRevenue, previous.financials.completedRevenue),
    grossRevenue: computeDelta(current.financials.grossRevenueValid, previous.financials.grossRevenueValid),
    netProfit: computeDelta(current.financials.netProfitCompleted, previous.financials.netProfitCompleted),
    viewToCartConversion: computeDelta(current.conversions.viewToCartConversion, previous.conversions.viewToCartConversion),
    viewToPurchaseConversion: computeDelta(current.conversions.viewToPurchaseConversion, previous.conversions.viewToPurchaseConversion),
    wishlistToCartConversion: computeDelta(current.conversions.wishlistToCartConversion, previous.conversions.wishlistToCartConversion),
    cartToCheckoutConversion: computeDelta(current.conversions.cartToCheckoutConversion, previous.conversions.cartToCheckoutConversion),
    orderCompletionRate: computeDelta(current.conversions.orderCompletionRate, previous.conversions.orderCompletionRate),
    orderCancellationRate: computeDelta(current.conversions.orderCancellationRate, previous.conversions.orderCancellationRate),
    cancellationRate: computeDelta(current.conversions.orderCancellationRate, previous.conversions.orderCancellationRate),
    productReturnRate: computeDelta(current.conversions.productReturnRate, previous.conversions.productReturnRate)
  };

  return {
    period: {
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate,
      prevStartDate: dateInfo.prevStartDate,
      prevEndDate: dateInfo.prevEndDate,
      daysSpan: dateInfo.daysSpan,
      interval: dateInfo.interval,
      timezone: dateInfo.timezone,
      categoryFilter: productContext.categoryDoc
        ? { _id: productContext.categoryDoc._id, name: productContext.categoryDoc.name }
        : null
    },
    current,
    previous,
    comparisons,
    timeSeries: timeSeries.series,
    funnel,
    metricDefinitions: METRIC_DEFINITIONS
  };
}

/**
 * 2. Aggregated Time-Series Data (Daily or Weekly buckets in Africa/Cairo timezone)
 */
async function getTimeSeriesAnalytics(subdomain, query = {}) {
  const dateInfo = query._dateInfo || parseDateRange(query);
  const productContext =
    query._productContext ||
    (await resolveFilteredProductContext(subdomain, {
      categoryId: query.categoryId,
      offerId: query.offerId
    }));

  const Activity = getActivityModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const actMatch = {
    occurredAt: { $gte: dateInfo.startDate, $lte: dateInfo.endDate }
  };
  let targetProductStringIds = null;

  if (query.productId && mongoose.isValidObjectId(query.productId)) {
    actMatch.productId = new mongoose.Types.ObjectId(query.productId);
    targetProductStringIds = new Set([String(query.productId)]);
  } else if (productContext.hasProductFilter) {
    actMatch.productId = { $in: productContext.productObjectIds };
    targetProductStringIds = new Set(productContext.productStringIds);
  }

  const dateFormat = dateInfo.interval === "week" ? "%Y-W%V" : "%Y-%m-%d";

  const activityBuckets = await Activity.aggregate([
    { $match: actMatch },
    {
      $group: {
        _id: {
          bucket: { $dateToString: { format: dateFormat, date: "$occurredAt", timezone: TIMEZONE } },
          eventType: "$eventType"
        },
        count: { $sum: 1 },
        quantity: { $sum: { $ifNull: ["$quantity", 1] } },
        actors: {
          $addToSet: {
            $cond: [
              { $ne: ["$userId", null] },
              { $concat: ["u:", { $toString: "$userId" }] },
              {
                $cond: [
                  { $ne: ["$visitorId", null] },
                  { $concat: ["v:", "$visitorId"] },
                  { $concat: ["s:", { $ifNull: ["$sessionId", "anon"] }] }
                ]
              }
            ]
          }
        }
      }
    }
  ]);

  const orderMatch = {
    createdAt: { $gte: dateInfo.startDate, $lte: dateInfo.endDate }
  };
  if (targetProductStringIds) {
    orderMatch["items.productId"] = { $in: Array.from(targetProductStringIds) };
  }
  if (query.branchId && query.branchId !== "all" && mongoose.isValidObjectId(query.branchId)) {
    const bObjId = new mongoose.Types.ObjectId(query.branchId);
    actMatch.branchId = bObjId;
    orderMatch.branchId = bObjId;
  }
  const ordersInPeriod = await Orders.find(orderMatch).lean();

  // Build continuous day/week map
  const bucketMap = new Map();
  if (dateInfo.interval === "day") {
    const cursor = new Date(dateInfo.startDate);
    cursor.setHours(0, 0, 0, 0);
    const endCursor = new Date(dateInfo.endDate);
    endCursor.setHours(23, 59, 59, 999);
    while (cursor <= endCursor) {
      const key = cursor.toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // YYYY-MM-DD
      bucketMap.set(key, {
        date: key,
        views: 0,
        uniqueVisitors: 0,
        wishlistAdded: 0,
        wishlistRemoved: 0,
        cartAdditions: 0,
        cartRemovals: 0,
        checkoutStarts: 0,
        ordersCreated: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
        returnedQuantity: 0,
        unitsSold: 0,
        revenue: 0,
        priceFeedback: 0,
        _viewActorsCount: 0,
        _cartActorsCount: 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const ensureBucket = (key) => {
    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        date: key,
        views: 0,
        uniqueVisitors: 0,
        wishlistAdded: 0,
        wishlistRemoved: 0,
        cartAdditions: 0,
        cartRemovals: 0,
        checkoutStarts: 0,
        ordersCreated: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
        returnedQuantity: 0,
        unitsSold: 0,
        revenue: 0,
        priceFeedback: 0,
        _viewActorsCount: 0,
        _cartActorsCount: 0
      });
    }
    return bucketMap.get(key);
  };

  for (const row of activityBuckets) {
    const bKey = row._id.bucket;
    const ev = row._id.eventType;
    const b = ensureBucket(bKey);
    const actorCount = (row.actors || []).filter((a) => a !== "s:anon").length;

    if (ev === "product_viewed") {
      b.views += row.count;
      b.uniqueVisitors = Math.max(b.uniqueVisitors, actorCount);
      b._viewActorsCount = actorCount;
    } else if (ev === "wishlist_added") {
      b.wishlistAdded += row.count;
    } else if (ev === "wishlist_removed") {
      b.wishlistRemoved += row.count;
    } else if (ev === "add_to_cart") {
      b.cartAdditions += row.count;
      b._cartActorsCount = actorCount;
    } else if (ev === "remove_from_cart") {
      b.cartRemovals += row.count;
    } else if (ev === "checkout_started") {
      b.checkoutStarts += row.count;
    } else if (ev === "price_feedback") {
      b.priceFeedback += row.count;
    } else if (ev === "product_returned") {
      b.returnedQuantity = Math.max(b.returnedQuantity, row.quantity || row.count);
    }
  }

  for (const ord of ordersInPeriod) {
    const createdDate = new Date(ord.createdAt);
    const bKey =
      dateInfo.interval === "week"
        ? (() => {
            const d = new Date(Date.UTC(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
            return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
          })()
        : createdDate.toLocaleDateString("en-CA", { timeZone: TIMEZONE });

    const b = ensureBucket(bKey);
    const relevantItems = (ord.items || []).filter((it) =>
      targetProductStringIds ? targetProductStringIds.has(String(it.productId)) : true
    );
    const qty = relevantItems.reduce((s, it) => s + Number(it.quantity || 1), 0);
    const val = targetProductStringIds
      ? relevantItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 1), 0)
      : Number(ord.total || 0);

    b.ordersCreated += 1;
    if (ord.status === "delivered") {
      b.completedOrders += 1;
      b.unitsSold += qty;
      b.revenue += val;
    } else if (ord.status === "cancelled") {
      b.cancelledOrders += 1;
    } else if (ord.status === "returned") {
      b.returnedOrders += 1;
      b.returnedQuantity = Math.max(b.returnedQuantity, qty);
    }
  }

  const series = Array.from(bucketMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => {
      const denomVisitors = b.uniqueVisitors || b.views;
      const viewToCartRate = denomVisitors > 0 ? safeRate(b._cartActorsCount || b.cartAdditions, denomVisitors) : 0;
      const conversionRate = denomVisitors > 0 ? safeRate(b.completedOrders, denomVisitors) : 0;
      const { _viewActorsCount, _cartActorsCount, ...clean } = b;
      return {
        ...clean,
        grossRevenue: b.revenue,
        netProfit: 0,
        viewToCartRate: viewToCartRate ?? 0,
        conversionRate: conversionRate ?? 0
      };
    });

  return {
    interval: dateInfo.interval,
    timezone: TIMEZONE,
    series
  };
}

/**
 * 3. Funnel Analytics (Product Views -> Cart Additions -> Checkout Starts -> Orders Created -> Completed Orders)
 *    Provides both Unique Actor Cohort counts and Event/Order counts, and discloses attribution notes.
 */
async function getFunnelAnalytics(subdomain, query = {}) {
  const dateInfo = query._dateInfo || parseDateRange(query);
  const productContext =
    query._productContext ||
    (await resolveFilteredProductContext(subdomain, {
      categoryId: query.categoryId,
      offerId: query.offerId
    }));

  const metrics = await computeWindowMetrics(subdomain, {
    startDate: dateInfo.startDate,
    endDate: dateInfo.endDate,
    productContext,
    branchId: query.branchId
  });

  const stages = [
    {
      key: "product_viewed",
      label: "مشاهدة المنتجات (Product Views)",
      actorCount: metrics.activity.uniqueVisitors,
      eventCount: metrics.activity.productViews,
      unitLabel: "زائر فريد",
      secondaryLabel: `${metrics.activity.productViews} مشاهدة إجمالية`,
      conversionFromPrevious: 100,
      conversionFromTop: 100
    },
    {
      key: "add_to_cart",
      label: "الإضافة إلى السلة (Cart Additions)",
      actorCount: metrics.activity.uniqueCartActors,
      eventCount: metrics.activity.addToCartEvents,
      unitLabel: "زائر أضاف للسلة",
      secondaryLabel: `${metrics.activity.addToCartEvents} عملية إضافة (${metrics.activity.addToCartQuantity} وحدة)`,
      conversionFromPrevious: safeRate(metrics.activity.uniqueCartActors, metrics.activity.uniqueVisitors),
      conversionFromTop: safeRate(metrics.activity.uniqueCartActors, metrics.activity.uniqueVisitors)
    },
    {
      key: "checkout_started",
      label: "بدء إتمام الطلب (Checkout Starts)",
      actorCount: metrics.activity.uniqueCheckoutActors,
      eventCount: metrics.activity.checkoutStartedEvents,
      unitLabel: "جلسة دفع",
      secondaryLabel: `${metrics.activity.checkoutStartedEvents} حدث بدء دفع`,
      conversionFromPrevious: safeRate(metrics.activity.uniqueCheckoutActors, metrics.activity.uniqueCartActors),
      conversionFromTop: safeRate(metrics.activity.uniqueCheckoutActors, metrics.activity.uniqueVisitors)
    },
    {
      key: "order_created",
      label: "إنشاء الطلبات (Orders Created)",
      actorCount: metrics.orders.ordersCreated,
      eventCount: metrics.orders.ordersCreated,
      unitLabel: "طلب منشأ",
      secondaryLabel: `${metrics.orders.unitsOrdered} وحدة مطلوبة`,
      conversionFromPrevious: safeRate(
        metrics.orders.ordersCreated,
        metrics.activity.uniqueCheckoutActors || metrics.activity.uniqueCartActors
      ),
      conversionFromTop: safeRate(metrics.orders.ordersCreated, metrics.activity.uniqueVisitors)
    },
    {
      key: "order_completed",
      label: "الطلبات المكتملة (Completed Orders)",
      actorCount: metrics.orders.ordersCompleted,
      eventCount: metrics.orders.ordersCompleted,
      unitLabel: "طلب مكتمل (مسلّم)",
      secondaryLabel: `${metrics.orders.unitsSold} وحدة مباعة مسلمة`,
      conversionFromPrevious: safeRate(metrics.orders.ordersCompleted, metrics.orders.ordersCreated),
      conversionFromTop: safeRate(metrics.orders.ordersCompleted, metrics.activity.uniqueVisitors)
    }
  ];

  return {
    stages,
    attributionDisclosure:
      "يتم تتبع مراحل القمع التسويقي عبر معرفات الزائر والجلسة والسلة (userId / visitorId / sessionId / cartId). في حال إتمام زائر لطلب دون المرور المسبق بحدث سلة مسجل (أو عند تسليم طلب أُنشئ في فترة سابقة)، قد تختلف الأعداد المرحلية عن التسلسل الخطي الصارم، ولذلك نعرض كلاً من عدد الزوار الفريدين وإجمالي الأحداث والطلبات الفعلية."
  };
}

/**
 * 4. Product Rankings (All 16 Supported Ranking Metrics with Counts, Rates, Volume Context & Sorting)
 */
async function getProductRankings(subdomain, query = {}) {
  const dateInfo = parseDateRange(query);
  const productContext = await resolveFilteredProductContext(subdomain, {
    categoryId: query.categoryId,
    offerId: query.offerId
  });

  const metric = String(query.metric || "most_viewed").trim();
  const order = String(query.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const limit = Math.max(1, Math.min(parseInt(query.limit, 10) || 10, 50));

  const Activity = getActivityModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const actMatch = {
    occurredAt: { $gte: dateInfo.startDate, $lte: dateInfo.endDate },
    productId: productContext.hasProductFilter
      ? { $in: productContext.productObjectIds }
      : { $ne: null }
  };

  const orderMatch = {
    createdAt: { $gte: dateInfo.startDate, $lte: dateInfo.endDate }
  };
  if (productContext.hasProductFilter) {
    orderMatch["items.productId"] = { $in: productContext.productStringIds };
  }

  if (query.branchId && query.branchId !== "all" && mongoose.isValidObjectId(query.branchId)) {
    const bObjId = new mongoose.Types.ObjectId(query.branchId);
    actMatch.branchId = bObjId;
    orderMatch.branchId = bObjId;
  }

  const [activityAgg, ordersInPeriod] = await Promise.all([
    Activity.aggregate([
      { $match: actMatch },
      {
        $group: {
          _id: { productId: "$productId", eventType: "$eventType" },
          eventCount: { $sum: 1 },
          quantitySum: { $sum: { $ifNull: ["$quantity", 1] } },
          uniqueActors: {
            $addToSet: {
              $cond: [
                { $ne: ["$userId", null] },
                { $concat: ["u:", { $toString: "$userId" }] },
                {
                  $cond: [
                    { $ne: ["$visitorId", null] },
                    { $concat: ["v:", "$visitorId"] },
                    { $concat: ["s:", { $ifNull: ["$sessionId", "anon"] }] }
                  ]
                }
              ]
            }
          }
        }
      }
    ]),
    Orders.find(orderMatch).lean()
  ]);

  // Initialize stats map for all products in scope
  const statsByProd = new Map();
  for (const prod of productContext.products) {
    const pid = String(prod._id);
    statsByProd.set(pid, {
      productId: pid,
      name: prod.name,
      categoryName: prod.categoryId?.name || "عام",
      categoryId: prod.categoryId?._id || prod.categoryId,
      price: Number(prod.price || 0),
      oldPrice: Number(prod.oldPrice || 0),
      costPrice: Number(prod.costPrice || 0),
      hasReliableCost: Number(prod.costPrice || 0) > 0,
      stockCount: Number(prod.stockCount || 0),
      image: prod.images?.[0] || "",
      ratingAvg: Number(prod.ratingAvg || 0),
      ratingCount: Number(prod.ratingCount || 0),
      views: 0,
      uniqueVisitors: 0,
      wishlistAdditions: 0,
      wishlistRemovals: 0,
      cartAdditions: 0,
      cartAdditionsQty: 0,
      cartRemovals: 0,
      cartRemovalsQty: 0,
      checkoutStarts: 0,
      ordersCreatedCount: 0,
      completedOrdersCount: 0,
      unitsSold: 0,
      cancelledOrdersCount: 0,
      cancelledQuantity: 0,
      returnEventsCount: 0,
      returnedQuantity: 0,
      priceFeedbackCount: 0,
      revenue: 0,
      profit: 0,
      refundedAmount: null // Not supported unless authoritative refund ledger exists
    });
  }

  for (const row of activityAgg) {
    const pid = String(row._id.productId);
    const ev = row._id.eventType;
    const entry = statsByProd.get(pid);
    if (!entry) continue;

    const actorsCount = (row.uniqueActors || []).filter((a) => a !== "s:anon").length;

    if (ev === "product_viewed") {
      entry.views += row.eventCount;
      entry.uniqueVisitors += actorsCount;
    } else if (ev === "wishlist_added") {
      entry.wishlistAdditions += row.eventCount;
    } else if (ev === "wishlist_removed") {
      entry.wishlistRemovals += row.eventCount;
    } else if (ev === "add_to_cart") {
      entry.cartAdditions += row.eventCount;
      entry.cartAdditionsQty += row.quantitySum;
    } else if (ev === "remove_from_cart") {
      entry.cartRemovals += row.eventCount;
      entry.cartRemovalsQty += row.quantitySum;
    } else if (ev === "checkout_started") {
      entry.checkoutStarts += row.eventCount;
    } else if (ev === "price_feedback") {
      entry.priceFeedbackCount += row.eventCount;
    } else if (ev === "product_returned") {
      entry.returnEventsCount = Math.max(entry.returnEventsCount, row.eventCount);
      entry.returnedQuantity = Math.max(entry.returnedQuantity, row.quantitySum);
    }
  }

  // Aggregate authoritative Order items
  for (const ord of ordersInPeriod) {
    const seenProductsInOrder = new Set();
    for (const item of ord.items || []) {
      const pid = String(item.productId);
      const entry = statsByProd.get(pid);
      if (!entry) continue;

      const qty = Number(item.quantity || 1);
      const price = Number(item.price || entry.price || 0);
      const cost = Number(item.costPrice || entry.costPrice || 0);
      const lineRevenue = price * qty;
      const lineProfit = cost > 0 ? (price - cost) * qty : 0;

      if (!seenProductsInOrder.has(pid)) {
        seenProductsInOrder.add(pid);
        entry.ordersCreatedCount += 1;
        if (ord.status === "delivered") entry.completedOrdersCount += 1;
        if (ord.status === "cancelled") entry.cancelledOrdersCount += 1;
        if (ord.status === "returned") entry.returnEventsCount = Math.max(entry.returnEventsCount, 1);
      }

      if (ord.status === "delivered") {
        entry.unitsSold += qty;
        entry.revenue += lineRevenue;
        if (cost > 0) {
          entry.profit += lineProfit;
          entry.hasReliableCost = true;
        }
      } else if (ord.status === "cancelled") {
        entry.cancelledQuantity += qty;
      } else if (ord.status === "returned") {
        entry.returnedQuantity = Math.max(entry.returnedQuantity, qty);
      }
    }
  }

  // Enrich rates alongside raw counts
  const enrichedList = Array.from(statsByProd.values()).map((item) => {
    const totalOrderedUnits = item.unitsSold + item.cancelledQuantity + item.returnedQuantity;
    const cancellationRateByOrders = safeRate(item.cancelledOrdersCount, item.ordersCreatedCount);
    const cancellationRateByUnits = safeRate(item.cancelledQuantity, totalOrderedUnits);
    const returnRateByUnits = safeRate(item.returnedQuantity, item.unitsSold + item.returnedQuantity);
    const priceFeedbackPerViewRate = safeRate(item.priceFeedbackCount, item.views);
    const viewToCartRate = safeRate(item.cartAdditions, item.views);
    const viewToPurchaseRate = safeRate(item.completedOrdersCount, item.uniqueVisitors || item.views);

    return {
      ...item,
      totalOrderedUnits,
      cancellationRateByOrders,
      cancellationRateByUnits,
      returnRateByUnits,
      priceFeedbackPerViewRate,
      viewToCartRate,
      viewToPurchaseRate
    };
  });

  const metricSelectorMap = {
    most_viewed: { field: "views", label: "الأكثر مشاهدة", unit: "مشاهدة", rateField: "viewToCartRate", rateLabel: "معدل السلة %" },
    most_wishlisted: { field: "wishlistAdditions", label: "الأكثر إضافة للمفضلة", unit: "إضافة مفضلة", rateField: null },
    most_wishlist_removed: { field: "wishlistRemovals", label: "الأكثر إزالة من المفضلة", unit: "إزالة مفضلة", rateField: null },
    most_cart_added: { field: "cartAdditions", label: "الأكثر إضافة للسلة", unit: "إضافة سلة", rateField: "viewToCartRate", rateLabel: "معدل السلة من المشاهدات %" },
    most_cart_removed: { field: "cartRemovals", label: "الأكثر إزالة من السلة", unit: "إزالة سلة", rateField: null },
    most_checkout_started: { field: "checkoutStarts", label: "الأكثر بدءاً للدفع", unit: "بدء دفع", rateField: null },
    most_orders_created: { field: "ordersCreatedCount", label: "الأكثر طلباً (إجمالي الطلبات)", unit: "طلب", rateField: null },
    most_completed_orders: { field: "completedOrdersCount", label: "الأكثر طلبات مكتملة", unit: "طلب مكتمل", rateField: "viewToPurchaseRate", rateLabel: "معدل الشراء %" },
    most_units_sold: { field: "unitsSold", label: "الأعلى مبيعاً بالوحدات", unit: "وحدة مباعة", rateField: "viewToPurchaseRate", rateLabel: "معدل الشراء %" },
    most_cancelled: { field: "cancelledOrdersCount", label: "الأعلى إلغاءً (عدد الطلبات الملغاة)", unit: "طلب ملغي", rateField: "cancellationRateByOrders", rateLabel: "نسبة الإلغاء من الطلبات %" },
    most_cancelled_qty: { field: "cancelledQuantity", label: "الأعلى كميات ملغاة", unit: "وحدة ملغاة", rateField: "cancellationRateByUnits", rateLabel: "نسبة الكمية الملغاة %" },
    most_returned: { field: "returnedQuantity", label: "الأعلى استرجاعاً (بالكمية والأحداث)", unit: "وحدة مسترجعة", rateField: "returnRateByUnits", rateLabel: "نسبة الاسترجاع من المبيعات %" },
    most_price_feedback: { field: "priceFeedbackCount", label: "الأكثر بلاغات «السعر مرتفع»", unit: "إشارة سعر", rateField: "priceFeedbackPerViewRate", rateLabel: "نسبة الإشارات للمشاهدات %" },
    highest_rated: { field: "ratingAvg", label: "الأعلى تقييماً", unit: "نجوم", rateField: null },
    highest_revenue: { field: "revenue", label: "الأعلى إيراداً (الطلبات المكتملة)", unit: "ج.م", rateField: null },
    highest_profit: { field: "profit", label: "الأعلى صافي ربح (للمنتجات المسجل تكلفتها)", unit: "ج.م", rateField: null },
    highest_refunded: { field: "refundedAmount", label: "الأعلى مبالغ مستردة", unit: "ج.م", unsupported: true }
  };

  const selectedMeta = metricSelectorMap[metric] || metricSelectorMap.most_viewed;

  if (selectedMeta.unsupported) {
    return {
      metric,
      meta: selectedMeta,
      supported: false,
      unsupportedReason:
        "حساب إجمالي المبالغ المستردة الفعلية (Refunded Amounts) غير مدعوم حالياً لعدم وجود سجل تسويات مالية مستقل للمرتجعات النقدية في قاعدة البيانات.",
      items: []
    };
  }

  let candidateList = enrichedList;
  if (metric === "highest_profit") {
    candidateList = enrichedList.filter((item) => item.hasReliableCost);
  }

  const sortField = selectedMeta.field;
  candidateList.sort((a, b) => {
    const valA = Number(a[sortField] || 0);
    const valB = Number(b[sortField] || 0);
    if (valA !== valB) {
      return order === "asc" ? valA - valB : valB - valA;
    }
    return b.views - a.views;
  });

  const ranked = candidateList.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    ...item,
    primaryValue: item[sortField] ?? 0,
    secondaryRate: selectedMeta.rateField ? item[selectedMeta.rateField] : null
  }));

  return {
    metric,
    order,
    limit,
    meta: selectedMeta,
    supported: true,
    period: {
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate,
      daysSpan: dateInfo.daysSpan
    },
    items: ranked
  };
}

/**
 * 5. Dedicated Product-Level Analytics View
 */
async function getProductAnalyticsDetail(subdomain, productId, query = {}) {
  if (!productId || !mongoose.isValidObjectId(productId)) {
    const err = new Error("معرف المنتج غير صالح");
    err.status = 400;
    throw err;
  }

  const Products = getProductsModel(subdomain);
  const Reviews = getReviewsModel(subdomain);

  const product = await Products.findById(productId).populate("categoryId").populate("offerId").lean();
  if (!product) {
    const err = new Error("المنتج غير موجود");
    err.status = 404;
    throw err;
  }

  const dateInfo = parseDateRange(query);

  const [current, previous, timeSeries, recentReviews] = await Promise.all([
    computeWindowMetrics(subdomain, {
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate,
      productId,
      branchId: query.branchId
    }),
    computeWindowMetrics(subdomain, {
      startDate: dateInfo.prevStartDate,
      endDate: dateInfo.prevEndDate,
      productId,
      branchId: query.branchId
    }),
    getTimeSeriesAnalytics(subdomain, { ...query, productId, _dateInfo: dateInfo }),
    Reviews.find({ productId: product._id }).sort({ createdAt: -1 }).limit(10).lean()
  ]);

  const comparisons = {
    productViews: computeDelta(current.activity.productViews, previous.activity.productViews),
    uniqueVisitors: computeDelta(current.activity.uniqueVisitors, previous.activity.uniqueVisitors),
    wishlistAdded: computeDelta(current.activity.wishlistAdded, previous.activity.wishlistAdded),
    wishlistRemoved: computeDelta(current.activity.wishlistRemoved, previous.activity.wishlistRemoved),
    addToCartEvents: computeDelta(current.activity.addToCartEvents, previous.activity.addToCartEvents),
    removeFromCartEvents: computeDelta(current.activity.removeFromCartEvents, previous.activity.removeFromCartEvents),
    checkoutStartedEvents: computeDelta(current.activity.checkoutStartedEvents, previous.activity.checkoutStartedEvents),
    ordersCreated: computeDelta(current.orders.ordersCreated, previous.orders.ordersCreated),
    ordersCompleted: computeDelta(current.orders.ordersCompleted, previous.orders.ordersCompleted),
    unitsSold: computeDelta(current.orders.unitsSold, previous.orders.unitsSold),
    returnedQuantity: computeDelta(current.orders.returnedQuantity, previous.orders.returnedQuantity),
    priceFeedbackEvents: computeDelta(current.activity.priceFeedbackEvents, previous.activity.priceFeedbackEvents),
    viewToCartConversion: computeDelta(current.conversions.viewToCartConversion, previous.conversions.viewToCartConversion),
    viewToPurchaseConversion: computeDelta(current.conversions.viewToPurchaseConversion, previous.conversions.viewToPurchaseConversion),
    cartToCheckoutConversion: computeDelta(current.conversions.cartToCheckoutConversion, previous.conversions.cartToCheckoutConversion),
    orderCancellationRate: computeDelta(current.conversions.orderCancellationRate, previous.conversions.orderCancellationRate),
    productReturnRate: computeDelta(current.conversions.productReturnRate, previous.conversions.productReturnRate),
    priceFeedbackRate: computeDelta(current.conversions.priceFeedbackRate, previous.conversions.priceFeedbackRate)
  };

  return {
    product: {
      _id: product._id,
      name: product.name,
      category: product.categoryId ? { _id: product.categoryId._id, name: product.categoryId.name } : null,
      offer: product.offerId
        ? {
            _id: product.offerId._id,
            title: product.offerId.title,
            discountPercentage: product.offerId.discountPercentage
          }
        : null,
      price: product.price,
      oldPrice: product.oldPrice,
      costPrice: product.costPrice,
      stockCount: product.stockCount,
      images: product.images || [],
      ratingAvg: product.ratingAvg || 0,
      ratingCount: product.ratingCount || 0,
      ratingsBreakdown: product.ratings || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      lifetimeVisited: product.visited || 0,
      lifetimeSalesCount: product.salesCount || 0
    },
    period: {
      startDate: dateInfo.startDate,
      endDate: dateInfo.endDate,
      prevStartDate: dateInfo.prevStartDate,
      prevEndDate: dateInfo.prevEndDate,
      daysSpan: dateInfo.daysSpan,
      timezone: dateInfo.timezone
    },
    current,
    previous,
    comparisons,
    timeSeries: timeSeries.series,
    recentReviews
  };
}

/**
 * 6. Customer Cancellation & Return Analytics Report (Review Aid — Non-Punitive)
 */
async function getCustomerCancellationReport(subdomain, query = {}) {
  const dateInfo = parseDateRange(query);
  const Orders = getOrdersModel(subdomain);
  const Users = getUsersModel(subdomain);
  const Activity = getActivityModel(subdomain);

  const useAllTime = query.allTime === "true" || query.range === "all";
  const orderFilter = useAllTime
    ? {}
    : { createdAt: { $gte: dateInfo.startDate, $lte: dateInfo.endDate } };

  if (query.branchId && query.branchId !== "all" && mongoose.isValidObjectId(query.branchId)) {
    orderFilter.branchId = new mongoose.Types.ObjectId(query.branchId);
  }

  const [orders, users, latestActivities] = await Promise.all([
    Orders.find(orderFilter).sort({ createdAt: -1 }).lean(),
    Users.find({ role: "user" }).select("_id fullname email phone city createdAt lastLogin").lean(),
    Activity.aggregate([
      { $match: { userId: { $ne: null } } },
      { $group: { _id: "$userId", lastActivityAt: { $max: "$occurredAt" }, totalEvents: { $sum: 1 } } }
    ])
  ]);

  const userMap = new Map();
  users.forEach((u) => userMap.set(String(u._id), u));
  const userByPhone = new Map();
  users.forEach((u) => {
    if (u.phone) userByPhone.set(String(u.phone).trim(), u);
  });

  const activityByUserId = new Map();
  latestActivities.forEach((a) => activityByUserId.set(String(a._id), a));

  const customerGroups = new Map();

  for (const ord of orders) {
    const phone = String(ord.customer?.phone || "").trim();
    const matchedUser =
      (ord.userId && userMap.get(String(ord.userId))) ||
      (phone && userByPhone.get(phone)) ||
      null;

    const groupKey = matchedUser
      ? `user:${String(matchedUser._id)}`
      : phone
      ? `phone:${phone}`
      : `order:${String(ord._id)}`;

    if (!customerGroups.has(groupKey)) {
      const actInfo = matchedUser ? activityByUserId.get(String(matchedUser._id)) : null;
      customerGroups.set(groupKey, {
        customerKey: groupKey,
        userId: matchedUser?._id || ord.userId || null,
        name: matchedUser?.fullname || ord.customer?.name || "عميل",
        phone: phone || matchedUser?.phone || "",
        email: matchedUser?.email || ord.customer?.email || "",
        city: ord.customer?.city || matchedUser?.city || "",
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
        activeOrders: 0,
        returnedQuantity: 0,
        cancelledQuantity: 0,
        completedOrdersValue: 0,
        cancelledOrdersValue: 0,
        returnedOrdersValue: 0,
        failedDeliveries: null, // Not tracked as a separate schema field in storeOrder
        mostRecentOrderDate: null,
        mostRecentActivityDate: actInfo?.lastActivityAt || matchedUser?.lastLogin || null,
        recentOrdersSummary: []
      });
    }

    const entry = customerGroups.get(groupKey);
    entry.totalOrders += 1;

    const ordDate = ord.createdAt ? new Date(ord.createdAt) : null;
    if (ordDate && (!entry.mostRecentOrderDate || ordDate > entry.mostRecentOrderDate)) {
      entry.mostRecentOrderDate = ordDate;
    }

    const updatedAt = ord.updatedAt ? new Date(ord.updatedAt) : ordDate;
    if (updatedAt && (!entry.mostRecentActivityDate || updatedAt > entry.mostRecentActivityDate)) {
      entry.mostRecentActivityDate = updatedAt;
    }

    const itemQty = (ord.items || []).reduce((s, it) => s + Number(it.quantity || 1), 0);
    const val = Number(ord.total || 0);

    if (ord.status === "delivered") {
      entry.completedOrders += 1;
      entry.completedOrdersValue += val;
    } else if (ord.status === "cancelled") {
      entry.cancelledOrders += 1;
      entry.cancelledQuantity += itemQty;
      entry.cancelledOrdersValue += val;
    } else if (ord.status === "returned") {
      entry.returnedOrders += 1;
      entry.returnedQuantity += itemQty;
      entry.returnedOrdersValue += val;
    } else {
      entry.activeOrders += 1;
    }

    if (entry.recentOrdersSummary.length < 5) {
      entry.recentOrdersSummary.push({
        orderId: ord.orderId,
        status: ord.status,
        total: val,
        createdAt: ord.createdAt,
        lastNote: ord.timeline?.[ord.timeline.length - 1]?.note || ""
      });
    }
  }

  const list = Array.from(customerGroups.values()).map((c) => ({
    ...c,
    cancellationRate: safeRate(c.cancelledOrders, c.totalOrders),
    completionRate: safeRate(c.completedOrders, c.totalOrders),
    returnRate: safeRate(c.returnedOrders, c.totalOrders)
  }));

  const sortBy = String(query.sortBy || "cancelled_desc");
  list.sort((a, b) => {
    if (sortBy === "rate_desc") {
      if ((b.cancellationRate || 0) !== (a.cancellationRate || 0)) {
        return (b.cancellationRate || 0) - (a.cancellationRate || 0);
      }
      return b.cancelledOrders - a.cancelledOrders;
    }
    if (sortBy === "value_desc") {
      return b.cancelledOrdersValue - a.cancelledOrdersValue;
    }
    // Default: rank by cancelled orders count, then cancellation rate, then total orders
    if (b.cancelledOrders !== a.cancelledOrders) {
      return b.cancelledOrders - a.cancelledOrders;
    }
    if ((b.cancellationRate || 0) !== (a.cancellationRate || 0)) {
      return (b.cancellationRate || 0) - (a.cancellationRate || 0);
    }
    return b.totalOrders - a.totalOrders;
  });

  const limit = Math.max(1, Math.min(parseInt(query.limit, 10) || 25, 100));

  return {
    period: useAllTime
      ? { allTime: true }
      : { startDate: dateInfo.startDate, endDate: dateInfo.endDate, daysSpan: dateInfo.daysSpan },
    totalCustomersWithOrders: list.length,
    customersWithCancellations: list.filter((c) => c.cancelledOrders > 0).length,
    disclaimer:
      "هذا التقرير أداة مساعدة للمراجعة الإدارية فقط وليس حكماً آلياً بالاحتيال. يجب دائماً قراءة عدد الإلغاءات جنباً إلى جنب مع إجمالي حجم طلبات العميل وملاحظات التوصيل قبل اتخاذ أي إجراء.",
    dataLimitations: {
      failedDeliveriesTrackedSeparately: false,
      note: "حالات عدم الاستلام أو فشل التوصيل لا تملك حقلاً منفصلاً في نموذج الطلب الحالي ويتم تسجيلها ضمن حالة ملغي (cancelled) أو مسترجع (returned) مع ملاحظة في الـ timeline."
    },
    customers: list.slice(0, limit)
  };
}

/**
 * 7. Marketing & Activity Signals Extractor (الدلالات المعلوماتية والتسويقية لنشاط المنصة والمنتجات)
 *
 * Reuses existing analytics computations (Overview + Product Rankings across all products)
 * to extract actionable product signals for marketing & Facebook ad campaigns:
 * - `cart_without_order`: Products added to cart / wishlist / checkout without completing orders
 * - `incomplete_orders`: Products in orders that were cancelled or not completed
 * - `high_views_low_conversion`: Products with high traffic/views or price sensitivity signals but low purchase conversion
 * - `best_sellers`: Top selling winning products (high social proof)
 * - `slow_movers_high_stock`: In-stock products with low recent movement that need promotional push
 */
async function getMarketingProductSignals(subdomain, query = {}) {
  const effectiveRange = query.range || "30d";
  const [overview, rankingsRes] = await Promise.all([
    getStoreOverviewAnalytics(subdomain, { ...query, range: effectiveRange }),
    getProductRankings(subdomain, { ...query, range: effectiveRange, metric: "most_viewed", limit: 50 })
  ]);

  const Products = getProductsModel(subdomain);
  const allProductsDocs = await Products.find({}).select("_id visited salesCount stockCount isActive").lean();
  const lifetimeMap = new Map();
  allProductsDocs.forEach((p) => {
    lifetimeMap.set(String(p._id), {
      lifetimeViews: Number(p.visited || 0),
      lifetimeSales: Number(p.salesCount || 0),
      stockCount: Number(p.stockCount || 0),
      isActive: p.isActive !== false
    });
  });

  // Filter to active products (prefer in-stock products for ads, fallback to all active if none in stock)
  const rawItems = rankingsRes.items || [];
  const inStockItems = rawItems.filter((item) => {
    const life = lifetimeMap.get(String(item.productId));
    return (life ? life.isActive : true) && Number(item.stockCount ?? life?.stockCount ?? 0) > 0;
  });
  const pool = inStockItems.length > 0 ? inStockItems : rawItems;

  const enrichedPool = pool.map((item) => {
    const life = lifetimeMap.get(String(item.productId)) || { lifetimeViews: 0, lifetimeSales: 0 };
    const effectiveViews = item.views > 0 ? item.views : life.lifetimeViews;
    const effectiveUnitsSold = item.unitsSold > 0 ? item.unitsSold : life.lifetimeSales;

    const cartAndCheckoutIntent = Number(item.cartAdditions || 0) + Number(item.checkoutStarts || 0);
    const unconvertedCartGap = Math.max(0, cartAndCheckoutIntent - Number(item.completedOrdersCount || 0));
    const uncompletedOrdersCount = Math.max(
      0,
      Number(item.ordersCreatedCount || 0) - Number(item.completedOrdersCount || 0)
    );
    const cancelledOrdersCount = Number(item.cancelledOrdersCount || 0);
    const incompleteTotalSignal = Math.max(uncompletedOrdersCount, cancelledOrdersCount);

    // Compute signal-specific scores
    const cartAbandonScore =
      unconvertedCartGap * 18 +
      Number(item.checkoutStarts || 0) * 12 +
      Number(item.wishlistAdditions || 0) * 6;

    const incompleteOrderScore =
      cancelledOrdersCount * 22 +
      uncompletedOrdersCount * 16 +
      Number(item.cancelledQuantity || 0) * 8;

    const highViewsLowConvScore =
      effectiveViews >= 3 && Number(item.completedOrdersCount || 0) === 0
        ? effectiveViews * 5 + Number(item.priceFeedbackCount || 0) * 20
        : effectiveViews > 0 && (item.viewToPurchaseRate === null || item.viewToPurchaseRate < 5)
        ? effectiveViews * 2.5 + Number(item.priceFeedbackCount || 0) * 18
        : Number(item.priceFeedbackCount || 0) * 15;

    const bestSellerScore =
      effectiveUnitsSold * 15 +
      Number(item.completedOrdersCount || 0) * 12 +
      (Number(item.revenue || 0) > 0 ? Math.min(40, Math.round(Number(item.revenue || 0) / 500)) : 0);

    const slowMoverScore =
      Number(item.stockCount || 0) > 0 && effectiveUnitsSold === 0
        ? Math.min(60, Number(item.stockCount || 0) * 4) + (effectiveViews < 5 ? 25 : 10)
        : 0;

    // Determine primary signal for this product
    const signalScores = [
      {
        key: "cart_without_order",
        score: cartAbandonScore,
        badge: "🛒 يُضاف للسلة دون إتمام الطلب",
        preset: "urgent_fomo",
        svgTemplate: "flash_retail",
        discountSuggestion: "خصم خاص 10% أو شحن سريع مجاني لفترة محدودة",
        reasonAr:
          unconvertedCartGap > 0
            ? `أُضيف للسلة/الدفع ${cartAndCheckoutIntent} مرة (والمفضلة ${item.wishlistAdditions} مرة) لكن اكتمل منه ${item.completedOrdersCount} طلب فقط — عملاء مهتمون يحتاجون حافزاً سريعاً لحسم الشراء.`
            : `سجل ${item.wishlistAdditions} إضافة للمفضلة و${item.cartAdditions} للسلة مع فرصة لتحويل الاهتمام إلى طلبات فعلية.`
      },
      {
        key: "incomplete_orders",
        score: incompleteOrderScore,
        badge: "📦 طلبات لم تكتمل / أُلغيت",
        preset: "friendly_egyptian",
        svgTemplate: "modern_spotlight",
        discountSuggestion: "ضمان شامل ومعاينة عند الاستلام",
        reasonAr: `دخل في ${item.ordersCreatedCount} طلبات ولكن لم يكتمل/أُلغي منها ${incompleteTotalSignal} طلب (${cancelledOrdersCount} ملغي) — يحتاج إعلاناً يبني الثقة ويؤكد الضمان وسرعة التوصيل.`
      },
      {
        key: "high_views_low_conversion",
        score: highViewsLowConvScore,
        badge: "👀 مشاهدات عالية وتحويل منخفض",
        preset: item.priceFeedbackCount > 0 ? "urgent_fomo" : "tech_specs",
        svgTemplate: item.priceFeedbackCount > 0 ? "flash_retail" : "dark_luxury",
        discountSuggestion:
          item.priceFeedbackCount > 0 ? "عرض توفير حصري لفترة محدودة" : "أقوى قيمة مقابل سعر",
        reasonAr: `حقق ${effectiveViews} مشاهدة${
          item.priceFeedbackCount > 0 ? ` مع ${item.priceFeedbackCount} إشارة «السعر مرتفع»` : ""
        } مقابل ${effectiveUnitsSold} مبيعات — يجذب الانتباه بقوة ويحتاج إبراز مواصفاته وقيمته التنافسية في إعلان.`
      },
      {
        key: "best_sellers",
        score: bestSellerScore,
        badge: "🔥 الأكثر مبيعاً وطلباً",
        preset: "luxury_prestige",
        svgTemplate: "modern_spotlight",
        discountSuggestion: "الأكثر مبيعاً — متوفر الآن بكمية محدودة",
        reasonAr: `من المنتجات الرابحة في المنصة (${effectiveUnitsSold} وحدة مباعة، ${item.completedOrdersCount} طلب مكتمل، متوفر ${item.stockCount} بالمخزون) — مثالي لإعلان يعتمد على الثقة والإقبال العالي (Social Proof).`
      },
      {
        key: "slow_movers_high_stock",
        score: slowMoverScore,
        badge: "📊 مخزون متوفر يحتاج تنشيط",
        preset: "bundle_saver",
        svgTemplate: "emerald_bundle",
        discountSuggestion: "عرض تنشيطي خاص لفترة محدودة",
        reasonAr: `متوفر في المخزون بعدد ${item.stockCount} قطعة مع حركة مبيعات هادئة (${effectiveUnitsSold} مبيعات و${effectiveViews} مشاهدة) — يحتاج حملة إعلانية لتسليط الضوء عليه وتحريك المخزون.`
      }
    ];

    signalScores.sort((a, b) => b.score - a.score);
    const topSignal = signalScores[0] && signalScores[0].score > 0 ? signalScores[0] : signalScores[3];

    // Composite Ad Need Score prioritizing high-intent bottlenecks first, then winners & stock movers
    const adNeedScore = Math.round(
      cartAbandonScore * 1.35 +
        incompleteOrderScore * 1.25 +
        highViewsLowConvScore * 1.15 +
        bestSellerScore * 1.0 +
        slowMoverScore * 0.85
    );

    return {
      productId: String(item.productId),
      name: item.name,
      categoryName: item.categoryName || "عام",
      price: item.price,
      oldPrice: item.oldPrice,
      stockCount: item.stockCount,
      image: item.image,
      views: effectiveViews,
      windowViews: item.views,
      uniqueVisitors: item.uniqueVisitors,
      wishlistAdditions: item.wishlistAdditions,
      cartAdditions: item.cartAdditions,
      checkoutStarts: item.checkoutStarts,
      unconvertedCartGap,
      ordersCreatedCount: item.ordersCreatedCount,
      completedOrdersCount: item.completedOrdersCount,
      uncompletedOrdersCount,
      cancelledOrdersCount: item.cancelledOrdersCount,
      cancelledQuantity: item.cancelledQuantity,
      unitsSold: effectiveUnitsSold,
      windowUnitsSold: item.unitsSold,
      revenue: item.revenue,
      priceFeedbackCount: item.priceFeedbackCount,
      viewToCartRate: item.viewToCartRate,
      viewToPurchaseRate: item.viewToPurchaseRate,
      cancellationRateByOrders: item.cancellationRateByOrders,
      adNeedScore,
      primarySignal: topSignal.key,
      signalBadge: topSignal.badge,
      signalReasonAr: topSignal.reasonAr,
      recommendedPreset: topSignal.preset,
      recommendedSvgTemplate: topSignal.svgTemplate,
      recommendedDiscountSuggestion: topSignal.discountSuggestion,
      scoresBreakdown: {
        cart_without_order: Math.round(cartAbandonScore),
        incomplete_orders: Math.round(incompleteOrderScore),
        high_views_low_conversion: Math.round(highViewsLowConvScore),
        best_sellers: Math.round(bestSellerScore),
        slow_movers_high_stock: Math.round(slowMoverScore)
      }
    };
  });

  const pickTopForSignal = (sigKey, fallbackSortFn, maxCount = 6) => {
    const withPositiveScore = enrichedPool
      .filter((p) => (p.scoresBreakdown[sigKey] || 0) > 0)
      .sort((a, b) => (b.scoresBreakdown[sigKey] || 0) - (a.scoresBreakdown[sigKey] || 0));

    if (withPositiveScore.length > 0) {
      return withPositiveScore.slice(0, maxCount);
    }
    return [...enrichedPool].sort(fallbackSortFn).slice(0, maxCount);
  };

  const signalsCatalog = {
    auto_ai: {
      id: "auto_ai",
      label: "✨ ترشيح ذكي شامل (الأكثر احتياجاً للإعلان)",
      description:
        "يحلل الذكاء الاصطناعي كافة دلالات المنصة (السلات المتروكة، الطلبات غير المكتملة، المشاهدات، والمبيعات) ليختار المنتجات الأهم للإعلان الآن",
      recommendedPreset: "urgent_fomo",
      recommendedSvgTemplate: "modern_spotlight",
      candidates: [...enrichedPool].sort((a, b) => b.adNeedScore - a.adNeedScore).slice(0, 8)
    },
    cart_without_order: {
      id: "cart_without_order",
      label: "🛒 تُضاف للكارت ولا يُعمل لها أوردر (سلات متروكة)",
      description:
        "منتجات أضافها الزوار للسلة أو المفضلة أو بدأوا الدفع عليها دون إتمام الطلب — أعلى فرصة تحويل بإعلان تذكيري أو خصم خاطف",
      recommendedPreset: "urgent_fomo",
      recommendedSvgTemplate: "flash_retail",
      candidates: pickTopForSignal(
        "cart_without_order",
        (a, b) => b.cartAdditions + b.wishlistAdditions - (a.cartAdditions + a.wishlistAdditions)
      )
    },
    incomplete_orders: {
      id: "incomplete_orders",
      label: "📦 منتجات في أوردرات لم تكتمل أو أُلغيت",
      description:
        "منتجات دخلت في طلبات فعلية ولكن لم تكتمل أو تم إلغاؤها — تحتاج إعلاناً يركز على الثقة، الضمان، وسرعة التوصيل",
      recommendedPreset: "friendly_egyptian",
      recommendedSvgTemplate: "modern_spotlight",
      candidates: pickTopForSignal(
        "incomplete_orders",
        (a, b) => b.uncompletedOrdersCount + b.cancelledOrdersCount - (a.uncompletedOrdersCount + a.cancelledOrdersCount)
      )
    },
    high_views_low_conversion: {
      id: "high_views_low_conversion",
      label: "👀 مشاهدات عالية بدون شراء (أو حساسية سعرية)",
      description:
        "منتجات تحظى بزيارات ومشاهدات مرتفعة أو إشارات سعر ولكن معدل شرائها منخفض — تحتاج إبراز المواصفات والقيمة مقابل السعر",
      recommendedPreset: "tech_specs",
      recommendedSvgTemplate: "dark_luxury",
      candidates: pickTopForSignal("high_views_low_conversion", (a, b) => b.views - a.views)
    },
    best_sellers: {
      id: "best_sellers",
      label: "🔥 الأكثر مبيعاً وطلباً (المنتجات الرابحة)",
      description:
        "المنتجات الأعلى مبيعاً وإيراداً في المنصة — مثالية لإعلانات الدليل الاجتماعي (Social Proof) لجذب عملاء جدد",
      recommendedPreset: "luxury_prestige",
      recommendedSvgTemplate: "modern_spotlight",
      candidates: pickTopForSignal("best_sellers", (a, b) => b.unitsSold - a.unitsSold)
    },
    slow_movers_high_stock: {
      id: "slow_movers_high_stock",
      label: "📊 مخزون متوفر يحتاج تحريك وتنشيط",
      description:
        "منتجات متوفرة بكميات جيدة في المخزون ولكن حركتها بطيئة — مثالية لعروض الباكدج والتصفيات الترويجية",
      recommendedPreset: "bundle_saver",
      recommendedSvgTemplate: "emerald_bundle",
      candidates: pickTopForSignal("slow_movers_high_stock", (a, b) => b.stockCount - a.stockCount)
    }
  };

  return {
    period: overview.period,
    storeSummary: {
      totalViews: overview.current.activity.productViews,
      uniqueVisitors: overview.current.activity.uniqueVisitors,
      addToCartEvents: overview.current.activity.addToCartEvents,
      abandonedCartsCount: overview.current.conversions.abandonedCartsCount,
      cartAbandonmentRate: overview.current.conversions.cartAbandonmentRate,
      ordersCreated: overview.current.orders.ordersCreated,
      ordersCompleted: overview.current.orders.ordersCompleted,
      ordersCancelled: overview.current.orders.ordersCancelled,
      orderCancellationRate: overview.current.conversions.orderCancellationRate,
      priceFeedbackEvents: overview.current.activity.priceFeedbackEvents
    },
    signalsCatalog,
    topAdCandidates: signalsCatalog.auto_ai.candidates
  };
}

module.exports = {
  TIMEZONE,
  METRIC_DEFINITIONS,
  parseDateRange,
  safeRate,
  computeDelta,
  getStoreOverviewAnalytics,
  getTimeSeriesAnalytics,
  getFunnelAnalytics,
  getProductRankings,
  getProductAnalyticsDetail,
  getCustomerCancellationReport,
  getMarketingProductSignals
};

