const getProductsModel = require("../products/productModel");
const { compareProductWithMarket } = require("./marketIntelService");
const { extractActorContext, logStoreActivity } = require("../activity/activityService");
const { checkAndNotifyCartPriceChanges } = require("../carts/cartAlertService");

/**
 * Compare product with market competitors
 */
exports.compareProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ error: "معرف المنتج مطلوب" });
    }

    const analysis = await compareProductWithMarket(req.subdomain, productId);

    return res.json({
      done: true,
      analysis
    });
  } catch (err) {
    console.error("[MARKET_INTEL_CONTROLLER_ERROR]:", err);
    return res.status(500).json({
      error: err.message || "حدث خطأ أثناء إجراء تحليل ومقارنة السوق"
    });
  }
};

/**
 * Apply the AI-recommended price to the product
 */
exports.applyRecommendedPrice = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { newPrice } = req.body;

    const parsedPrice = Number(newPrice);
    if (!parsedPrice || parsedPrice <= 0) {
      return res.status(400).json({ error: "السعر المقترح يجب أن يكون رقماً أكبر من صفر" });
    }

    const Products = getProductsModel(req.subdomain);
    const existing = await Products.findById(productId);
    if (!existing) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    const oldPrice = existing.price;
    existing.oldPrice = oldPrice;
    existing.price = parsedPrice;
    await existing.save();

    // Trigger cart price alerts if configured
    try {
      checkAndNotifyCartPriceChanges(req.subdomain, {
        productId: existing._id,
        previousState: { price: oldPrice, stockCount: existing.stockCount },
        updatedProduct: existing
      }).catch((cartErr) => console.error("[MARKET_INTEL_CART_ALERT_WARN]:", cartErr.message));
    } catch {}

    // Audit log
    const actor = extractActorContext(req);
    await logStoreActivity(req.subdomain, {
      activityType: "product_updated",
      description: `تم تطبيق السعر المقترح من الذكاء الاصطناعي على المنتج "${existing.name}" من ${oldPrice} إلى ${parsedPrice} ج.م`,
      actor,
      metadata: {
        productId: existing._id,
        oldPrice,
        newPrice: parsedPrice,
        source: "ai_market_intel"
      }
    });

    return res.json({
      done: true,
      product: existing,
      message: `تم تطبيق السعر المقترح (${parsedPrice.toLocaleString()} ج.م) بنجاح!`
    });
  } catch (err) {
    console.error("[APPLY_RECOMMENDED_PRICE_ERROR]:", err);
    return res.status(500).json({
      error: err.message || "حدث خطأ أثناء تطبيق السعر الجديد"
    });
  }
};
