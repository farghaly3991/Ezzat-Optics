const { getMarketingProductSignals } = require("../analytics/analyticsService");
const { resolveSelectedProductsContext, generateCommercialAdPoster } = require("../visual-engine");
const { AD_PRESETS } = require("./adPresets");
const { buildSignalCampaignFallback } = require("./signalCampaignBuilder");
const { generateAdPostCopy } = require("./copywritingProvider");
const { callDeepSeek, callGemini } = require("../intake-engine");

/**
 * Orchestrates smart marketing campaigns driven by real-time analytics signals
 */
async function generateSmartCampaign(subdomain, payload = {}, adminData = {}) {
  const signalType = String(payload.signalType || "auto_ai").trim();
  const range = String(payload.range || "30d").trim();
  const requestedCount = payload.productCount ? parseInt(payload.productCount, 10) : 0;

  const signalsData = await getMarketingProductSignals(subdomain, {
    range,
    categoryId: payload.categoryId
  });

  const signalBucket =
    signalsData.signalsCatalog?.[signalType] || signalsData.signalsCatalog?.auto_ai;
  const candidates = signalBucket?.candidates || signalsData.topAdCandidates || [];

  if (candidates.length === 0) {
    const err = new Error("لا توجد منتجات متاحة حالياً في المتجر لاقتراح حملة إعلانية لها");
    err.status = 404;
    throw err;
  }

  const targetCount =
    requestedCount >= 1 && requestedCount <= 4
      ? Math.min(requestedCount, candidates.length)
      : signalType === "slow_movers_high_stock"
      ? Math.min(2, candidates.length)
      : Math.min(
          candidates.length >= 2 && candidates[0].adNeedScore === candidates[1].adNeedScore ? 2 : 1,
          candidates.length
        );

  const topCandidateSlice = candidates.slice(0, 6);
  const storeName = adminData.siteName || "المتجر العصري";
  const currency = adminData.currency || "ج.م";
  const contactPhone = adminData.whatsapp || adminData.phone || "";

  let aiPickedIds = null;
  let aiCopyData = null;

  const hasAi =
    adminData.aiEnabled !== false &&
    Boolean(
      (
        adminData.AI_API_KEY ||
        adminData.aiApiKey ||
        process.env.AI_API_KEY ||
        adminData.GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        ""
      ).trim()
    );

  if (hasAi) {
    const systemPrompt = `أنت خبير تسويق رقمي وإعلانات فيسبوك (Senior Performance Marketing & Meta Ads Strategist).
مهمتك هي تحليل الدلالات المعلوماتية لنشاط المتجر والمنتجات، ثم:
1. اختيار أفضل ${requestedCount > 0 ? `${targetCount} منتج/منتجات` : "1 إلى 3 منتجات"} تحتاج إلى إعلان لتحقيق أعلى عائد ومبيعات.
2. تحديد الزاوية التسويقية (Marketing Angle) وأسلوب الإعلان الأنسب (preset) وقالب التصميم (svgTemplateId).
3. كتابة الإعلان الكامل الجاهز للنشر فوراً (postText + نصوص الهوية البصرية على البوستر).

أساليب الإعلان المتاحة (preset):
- "urgent_fomo" | "friendly_egyptian" | "luxury_prestige" | "tech_specs" | "bundle_saver" | "short_punchy"

قوالب التصميم المتاحة (svgTemplateId):
- "modern_spotlight" | "dark_luxury" | "flash_retail" | "emerald_bundle"

أرجع النتيجة بصيغة JSON فقط:
{
  "selectedProductIds": ["معرف المنتج 1"],
  "preset": "urgent_fomo",
  "svgTemplateId": "flash_retail",
  "discountText": "نص العرض أو الميزة التنافسية",
  "customPrompt": "التوجيه التسويقي",
  "strategySummary": "شرح استراتيجي في سطرين لسبب الاختيار",
  "perProductReasons": { "productId": "السبب بالأرقام" },
  "postText": "النص الكامل الجاهز للنشر مع الإيموجيز والهاشتاجات",
  "headline": "عنوان رئيسي قصير وخاطف للبوستر",
  "subheadline": "عنوان فرعي مكمل",
  "badgeText": "نص الشارة",
  "ctaText": "نص زر الإجراء",
  "suggestedImagePrompt": "High-converting visual layout prompt in English"
}`;

    const userPrompt = `بيانات المتجر:
- اسم المتجر: ${storeName}
- العملة: ${currency}
- التواصل: ${contactPhone || "رسائل الصفحة"}
- الاستراتيجية المطلوبة: ${signalBucket?.label || signalType}
- عدد المنتجات المطلوب: ${targetCount}

المنتجات المرشحة مع دلالاتها:
${JSON.stringify(
  topCandidateSlice.map((c) => ({
    productId: c.productId,
    name: c.name,
    category: c.categoryName,
    price: `${c.price} ${currency}`,
    oldPrice: c.oldPrice > c.price ? `${c.oldPrice} ${currency}` : undefined,
    stockCount: c.stockCount,
    views: c.views,
    cartAdditions: c.cartAdditions,
    wishlistAdditions: c.wishlistAdditions,
    unconvertedCartGap: c.unconvertedCartGap,
    completedOrdersCount: c.completedOrdersCount,
    primarySignal: c.primarySignal,
    signalBadge: c.signalBadge
  })),
  null,
  2
)}`;

    try {
      aiCopyData = await callDeepSeek(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        adminData,
        0.4
      );
    } catch (err) {
      console.warn("[CAMPAIGN_SMART_DEEPSEEK_FALLBACK]", err.message);
      try {
        aiCopyData = await callGemini(systemPrompt, userPrompt, adminData);
      } catch (gemErr) {
        console.warn("[CAMPAIGN_SMART_GEMINI_FALLBACK]", gemErr.message);
      }
    }

    if (
      aiCopyData &&
      Array.isArray(aiCopyData.selectedProductIds) &&
      aiCopyData.selectedProductIds.length > 0
    ) {
      const validSet = new Set(candidates.map((c) => String(c.productId)));
      const filtered = aiCopyData.selectedProductIds
        .map((id) => String(id))
        .filter((id) => validSet.has(id));
      if (filtered.length > 0) {
        aiPickedIds = requestedCount > 0 ? filtered.slice(0, targetCount) : filtered.slice(0, 4);
      }
    }
  }

  const finalProductIds =
    aiPickedIds && aiPickedIds.length > 0
      ? aiPickedIds
      : candidates.slice(0, Math.max(1, targetCount)).map((c) => String(c.productId));

  const resolvedProducts = await resolveSelectedProductsContext(subdomain, finalProductIds);

  const candidateMap = new Map(candidates.map((c) => [String(c.productId), c]));
  const enrichedSelectedProducts = finalProductIds
    .map((id) => {
      const prodDoc = resolvedProducts.find((p) => String(p._id) === String(id));
      const sigInfo = candidateMap.get(String(id));
      if (!prodDoc) return null;
      return {
        ...prodDoc,
        signalBadge: sigInfo?.signalBadge || "✨ مرشح للإعلان",
        signalReasonAr:
          aiCopyData?.perProductReasons?.[id] ||
          sigInfo?.signalReasonAr ||
          "مرشح بناءً على نشاط المنصة",
        signalMetrics: sigInfo
          ? {
              views: sigInfo.views,
              cartAdditions: sigInfo.cartAdditions,
              wishlistAdditions: sigInfo.wishlistAdditions,
              checkoutStarts: sigInfo.checkoutStarts,
              unconvertedCartGap: sigInfo.unconvertedCartGap,
              ordersCreatedCount: sigInfo.ordersCreatedCount,
              completedOrdersCount: sigInfo.completedOrdersCount,
              unitsSold: sigInfo.unitsSold,
              stockCount: sigInfo.stockCount
            }
          : null
      };
    })
    .filter(Boolean);

  const fallbackCampaign = buildSignalCampaignFallback(
    enrichedSelectedProducts,
    signalType,
    signalBucket,
    adminData
  );

  const perProductPrompts = {};
  enrichedSelectedProducts.forEach((p) => {
    const specsText = Object.entries(p.specs || {})
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join("، ");
    perProductPrompts[p._id] = `صورة إعلانية احترافية تبرز المنتج (${p.name}) بسعر ${p.price} ${currency}${
      specsText ? ` ومواصفاته (${specsText})` : ""
    } مع إضاءة استوديو فخمة`;
  });

  const validPresets = new Set(AD_PRESETS.map((p) => p.id));
  const validTemplates = new Set([
    "modern_spotlight",
    "dark_luxury",
    "flash_retail",
    "emerald_bundle"
  ]);

  const chosenPreset =
    aiCopyData?.preset && validPresets.has(aiCopyData.preset)
      ? aiCopyData.preset
      : fallbackCampaign.preset;
  const chosenSvgTemplate =
    aiCopyData?.svgTemplateId && validTemplates.has(aiCopyData.svgTemplateId)
      ? aiCopyData.svgTemplateId
      : fallbackCampaign.svgTemplateId;

  return {
    signalType,
    signalLabel: signalBucket?.label || "ترشيح ذكي شامل",
    aiUsed: Boolean(aiCopyData && aiCopyData.postText),
    strategySummary: aiCopyData?.strategySummary || fallbackCampaign.strategySummary,
    selectedProducts: enrichedSelectedProducts,
    productIds: enrichedSelectedProducts.map((p) => p._id),
    preset: chosenPreset,
    svgTemplateId: chosenSvgTemplate,
    discountText: aiCopyData?.discountText || fallbackCampaign.discountText,
    customPrompt: aiCopyData?.customPrompt || fallbackCampaign.customPrompt,
    postText: aiCopyData?.postText || fallbackCampaign.postText,
    headline: aiCopyData?.headline || fallbackCampaign.headline,
    subheadline: aiCopyData?.subheadline || fallbackCampaign.subheadline,
    badgeText: aiCopyData?.badgeText || fallbackCampaign.badgeText,
    ctaText: aiCopyData?.ctaText || fallbackCampaign.ctaText,
    suggestedImagePrompt:
      aiCopyData?.suggestedImagePrompt || fallbackCampaign.suggestedImagePrompt,
    perProductPrompts,
    storeSummary: signalsData.storeSummary,
    signalsCatalog: signalsData.signalsCatalog
  };
}

module.exports = {
  generateSmartCampaign,
  generateAdPostCopy,
  generateAdPosterImage: generateCommercialAdPoster
};
