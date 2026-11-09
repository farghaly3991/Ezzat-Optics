const cartService = require("./cartService");
const { extractActorContext } = require("../activity/activityService");

/**
 * Public storefront endpoint: Sync cart items and state
 * POST /api/store-public/cart/sync
 */
exports.syncCart = async (req, res) => {
  try {
    const subdomain = req.subdomain;

    // If store is configured in internal catalog mode, suppress cart persistence
    if (req.adminData?.storefrontMode === "internal_catalog" || req.adminData?.enabledModules?.carts === false) {
      return res.json({
        success: true,
        cart: null,
        disabled: true,
        message: "وضع الكتالوج والمعرض الداخلي مفعل، سلة التسوق الإلكترونية غير مستخدمة"
      });
    }

    const actor = extractActorContext(req);
    const cart = await cartService.syncCart(subdomain, req.body, actor);
    return res.json({ success: true, cart });
  } catch (err) {
    console.error("[CART_SYNC_ERR]", err);
    return res.status(500).json({ error: err.message || "تعذر مزامنة السلة" });
  }
};

/**
 * Admin endpoint: List inactive / abandoned carts with sorting and filtering
 * GET /api/admin/carts/inactive
 */
exports.getInactiveCarts = async (req, res) => {
  try {
    const subdomain = req.subdomain;

    // In internal catalog mode, no abandoned carts exist or require recovery
    if (req.adminData?.storefrontMode === "internal_catalog" || req.adminData?.enabledModules?.carts === false) {
      return res.json({
        carts: [],
        summary: {
          totalAbandonedCarts: 0,
          totalAbandonedItems: 0,
          totalPotentialLoss: 0,
          recoveryRatePercent: 0
        },
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
      });
    }

    const { periodHours, sortBy, limit, search, branchId } = req.query;

    const data = await cartService.getInactiveCarts(subdomain, {
      periodHours,
      sortBy,
      limit,
      search,
      branchId
    });

    return res.json(data);
  } catch (err) {
    console.error("[INACTIVE_CARTS_ERR]", err);
    return res.status(500).json({ error: err.message || "تعذر استرجاع السلات المتروكة" });
  }
};

/**
 * Admin endpoint: Send recovery notification (in-app, WhatsApp, or both) for a specific cart
 * POST /api/admin/carts/recovery/send
 */
exports.sendRecoveryNotification = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { cartId, channels, customMessage } = req.body;

    if (!cartId) {
      return res.status(400).json({ error: "معرف السلة (cartId) مطلوب" });
    }

    const result = await cartService.sendCartRecoveryNotification(subdomain, {
      cartId,
      channels,
      customMessage
    });

    return res.json({ success: true, result });
  } catch (err) {
    console.error("[RECOVERY_SEND_ERR]", err);
    return res.status(400).json({ error: err.message || "تعذر إرسال تنبيه الاستعادة" });
  }
};

/**
 * Admin endpoint: Bulk send recovery notifications to multiple carts
 * POST /api/admin/carts/recovery/bulk-send
 */
exports.bulkSendRecovery = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { cartIds, channels, customMessage } = req.body;

    if (!Array.isArray(cartIds) || cartIds.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد السلات المستهدفة للإرسال" });
    }

    const result = await cartService.bulkSendRecovery(subdomain, {
      cartIds,
      channels,
      customMessage
    });

    return res.json({ success: true, result });
  } catch (err) {
    console.error("[BULK_RECOVERY_SEND_ERR]", err);
    return res.status(400).json({ error: err.message || "تعذر إرسال التنبيهات الجماعية" });
  }
};
