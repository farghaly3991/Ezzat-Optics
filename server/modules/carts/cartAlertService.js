const getCartModel = require("./cartModel");
const getAdminDataModel = require("../settings/adminDataModel");
const { dispatchNotification } = require("../notifications/notificationDispatcher");

/**
 * Check and notify carts when a single product's price or stock changes
 */
async function checkAndNotifyCartPriceChanges(subdomain, { productId, previousState, updatedProduct }) {
  if (!subdomain || !productId || !updatedProduct || !previousState) {
    return { skipped: true, reason: "missing_required_arguments" };
  }

  // 1. Fetch store settings and guard with zero overhead
  const AdminData = getAdminDataModel(subdomain);
  const adminData = await AdminData.findOne({ admin: 1 }).lean();
  const cartCfg = adminData?.cartNotifications || {};

  if (cartCfg.enabled === false || cartCfg.channel === "disabled") {
    return { skipped: true, reason: "cart_notifications_disabled" };
  }

  const oldPrice = Number(previousState.price || 0);
  const newPrice = Number(updatedProduct.price || 0);
  const oldStock = Number(previousState.stockCount || 0);
  const newStock = Number(updatedProduct.stockCount || 0);
  const criticalThreshold = Number(updatedProduct.criticalStockThreshold || 5);

  const isPriceDrop = newPrice < oldPrice && cartCfg.notifyOnPriceDrop !== false;
  const isPriceIncrease = newPrice > oldPrice && cartCfg.notifyOnPriceIncrease === true;
  const isStockOut = oldStock > 0 && newStock <= 0 && cartCfg.notifyOnOutOfStock !== false;
  const isCriticalStock =
    oldStock > criticalThreshold &&
    newStock <= criticalThreshold &&
    newStock > 0 &&
    cartCfg.notifyOnCriticalStock !== false;

  if (!isPriceDrop && !isPriceIncrease && !isStockOut && !isCriticalStock) {
    return { skipped: true, reason: "no_qualifying_alert_event" };
  }

  // 2. Find all active or abandoned carts containing this product
  const Cart = getCartModel(subdomain);
  const carts = await Cart.find({
    status: { $in: ["active", "abandoned"] },
    "items.productId": productId
  }).lean();

  if (!carts || carts.length === 0) {
    return { count: 0, message: "No affected carts found for this product" };
  }

  // 3. Auto-update cart items if enabled on out-of-stock
  if (isStockOut && cartCfg.autoUpdateCartOnOutOfStock) {
    try {
      await Cart.updateMany(
        {
          _id: { $in: carts.map((c) => c._id) },
          "items.productId": productId
        },
        {
          $set: { "items.$.price": newPrice, "items.$.stockUnavailable": true }
        }
      );
    } catch (updateErr) {
      console.error("[AUTO_UPDATE_CART_ERROR]:", updateErr);
    }
  }

  // 4. Formulate the alert payload
  const priceDiff = Math.abs(oldPrice - newPrice);
  const percentageDrop = oldPrice > 0 ? Math.round(((oldPrice - newPrice) / oldPrice) * 100) : 0;
  const productName = updatedProduct.name || "منتج في سلتك";
  const image = updatedProduct.images?.[0] || "";

  let notifType = "cart_alert";
  let title = "تحديث في سلة تسوقك";
  let message = `حدث تحديث على منتج "${productName}" في سلة تسوقك.`;

  if (isPriceDrop) {
    notifType = "price_drop";
    title = "🎉 عرض مغري: انخفض سعر منتج في سلتك!";
    message = `خبر رائع! منتج "${productName}" الموجود في سلة تسوقك أصبح الآن بسعر ${newPrice} ج.م بدلاً من ${oldPrice} ج.م (وفرت ${priceDiff} ج.م - خصم ${percentageDrop}%)! الحق العرض وأتمم طلبك الآن.`;
  } else if (isPriceIncrease) {
    notifType = "price_increase";
    title = "تنبيه: تعديل سعر منتج في سلة التسوق";
    message = `نود إعلامك بأنه تم تعديل سعر منتج "${productName}" الموجود في سلة تسوقك إلى ${newPrice} ج.م.`;
  } else if (isStockOut) {
    notifType = "stock_out";
    title = "⚠️ تنبيه نفاذ كمية منتج في سلتك";
    message = `نحيطك علماً بأن كمية منتج "${productName}" الموجود في سلة تسوقك قد نفدت من المخزون حالياً.`;
  } else if (isCriticalStock) {
    notifType = "critical_stock";
    title = "🔥 سارع بالشراء: الكمية أوشكت على النفاد!";
    message = `الكمية المتبقية من منتج "${productName}" في سلتك أصبحت محدودة جداً (${newStock} قطع فقط). أتمم طلبك الآن قبل نفاذ الكمية!`;
  }

  // 5. Dispatch notifications to affected users/visitors
  let notifiedCount = 0;
  const dispatchPromises = carts.map(async (cart) => {
    try {
      const targetUser = cart.userId || null;
      const targetVisitor = cart.visitorId || "";
      const targetPhone = cart.customer?.phone || "";

      if (!targetUser && !targetVisitor && !targetPhone) {
        return null;
      }

      const res = await dispatchNotification(subdomain, {
        userId: targetUser,
        visitorId: targetVisitor,
        phone: targetPhone,
        pushSubscription: cart.pushSubscription || null,
        title,
        message,
        type: notifType,
        productId,
        cartId: cart._id,
        link: "/cart",
        image,
        metadata: {
          productId,
          oldPrice,
          newPrice,
          priceDiff,
          percentageDrop,
          oldStock,
          newStock,
          autoUpdated: isStockOut && Boolean(cartCfg.autoUpdateCartOnOutOfStock)
        }
      });

      if (res.success) notifiedCount++;
      return res;
    } catch (err) {
      console.error(`[CART_ALERT_DISPATCH_ERROR] Cart ${cart._id}:`, err);
      return null;
    }
  });

  await Promise.allSettled(dispatchPromises);

  return {
    success: true,
    affectedCarts: carts.length,
    notifiedCount,
    event: notifType
  };
}

/**
 * Check and notify carts in bulk (e.g. after Excel import or mass price updates)
 * Consolidates notifications per cart so each affected customer receives only 1 alert!
 */
async function checkAndNotifyBulkCartChanges(subdomain, modifiedProducts = []) {
  if (!subdomain || !Array.isArray(modifiedProducts) || modifiedProducts.length === 0) {
    return { skipped: true, reason: "empty_or_invalid_modified_products" };
  }

  const AdminData = getAdminDataModel(subdomain);
  const adminData = await AdminData.findOne({ admin: 1 }).lean();
  const cartCfg = adminData?.cartNotifications || {};

  if (cartCfg.enabled === false || cartCfg.channel === "disabled") {
    return { skipped: true, reason: "cart_notifications_disabled" };
  }

  // Filter products that actually have price drops or stock modifications
  const productChangeMap = new Map();
  for (const item of modifiedProducts) {
    const { product, previous } = item;
    if (!product || !previous) continue;

    const oldPrice = Number(previous.price || 0);
    const newPrice = Number(product.price || 0);
    const oldStock = Number(previous.stockCount || 0);
    const newStock = Number(product.stockCount || 0);

    const priceDrop = newPrice < oldPrice && cartCfg.notifyOnPriceDrop !== false;
    const priceIncrease = newPrice > oldPrice && cartCfg.notifyOnPriceIncrease === true;
    const stockOut = oldStock > 0 && newStock <= 0 && cartCfg.notifyOnOutOfStock !== false;

    if (priceDrop || priceIncrease || stockOut) {
      productChangeMap.set(String(product._id), {
        productId: product._id,
        name: product.name,
        image: product.images?.[0] || "",
        oldPrice,
        newPrice,
        priceDrop,
        priceIncrease,
        stockOut,
        diff: Math.abs(oldPrice - newPrice)
      });
    }
  }

  if (productChangeMap.size === 0) {
    return { skipped: true, reason: "no_qualifying_changes_in_bulk_set" };
  }

  const productIds = Array.from(productChangeMap.values()).map((p) => p.productId);

  // Single query for all affected carts
  const Cart = getCartModel(subdomain);
  const carts = await Cart.find({
    status: { $in: ["active", "abandoned"] },
    "items.productId": { $in: productIds }
  }).lean();

  if (!carts || carts.length === 0) {
    return { count: 0, message: "No affected carts found for bulk changes" };
  }

  let notifiedCartsCount = 0;

  for (const cart of carts) {
    // Collect all changed items in this specific cart
    const changedItems = [];
    let totalSavings = 0;
    let hasPriceDrop = false;
    let hasStockOut = false;

    for (const item of cart.items || []) {
      const change = productChangeMap.get(String(item.productId));
      if (change) {
        changedItems.push(change);
        if (change.priceDrop) {
          hasPriceDrop = true;
          totalSavings += change.diff * (item.quantity || 1);
        }
        if (change.stockOut) {
          hasStockOut = true;
        }
      }
    }

    if (changedItems.length === 0) continue;

    let title = "تحديث في منتجات سلتك";
    let message = `حدث تحديث في أسعار وتوافر بعض المنتجات الموجودة في سلة تسوقك.`;
    let type = "cart_alert";

    if (hasPriceDrop) {
      type = "price_drop";
      title = `🎉 عروض مغرية: انخفضت أسعار ${changedItems.length} منتجات بسلتك!`;
      message = `خبر سار! انخفضت أسعار ${changedItems.length} منتجات في سلة تسوقك بإجمالي وفر يصل إلى ${totalSavings} ج.م! اغتنم الفرصة وأكمل طلبك الآن.`;
    } else if (hasStockOut) {
      type = "stock_out";
      title = `⚠️ تنبيه توافر المنتجات في سلتك`;
      message = `نود إعلامك بأن بعض المنتجات في سلتك قد نفدت كميتها من المخزون حالياً.`;
    }

    const firstImage = changedItems[0]?.image || "";

    try {
      const res = await dispatchNotification(subdomain, {
        userId: cart.userId || null,
        visitorId: cart.visitorId || "",
        phone: cart.customer?.phone || "",
        pushSubscription: cart.pushSubscription || null,
        title,
        message,
        type,
        cartId: cart._id,
        link: "/cart",
        image: firstImage,
        metadata: {
          changedCount: changedItems.length,
          totalSavings,
          products: changedItems
        }
      });

      if (res.success) notifiedCartsCount++;
    } catch (err) {
      console.error(`[BULK_CART_ALERT_ERROR] Cart ${cart._id}:`, err);
    }
  }

  return {
    success: true,
    totalAffectedCarts: carts.length,
    notifiedCartsCount,
    changedProductsCount: productChangeMap.size
  };
}

module.exports = {
  checkAndNotifyCartPriceChanges,
  checkAndNotifyBulkCartChanges
};
