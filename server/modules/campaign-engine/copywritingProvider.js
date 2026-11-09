const { getPresetById } = require("./adPresets");
const { buildSignalCampaignFallback } = require("./signalCampaignBuilder");
const { resolveSelectedProductsContext } = require("../visual-engine");
const { callDeepSeek, callGemini } = require("../intake-engine");

/**
 * Generates high-converting social media advertisement copy using DeepSeek or Gemini
 */
async function generateAdPostCopy(subdomain, payload = {}, adminData = {}) {
  const {
    productIds = [],
    preset = "urgent_fomo",
    discountText = "",
    customPrompt = ""
  } = payload;

  const presetObj = getPresetById(preset);
  const products = await resolveSelectedProductsContext(subdomain, productIds);

  if (products.length === 0) {
    throw new Error("يرجى اختيار منتج واحد على الأقل لكتابة الإعلان عنه");
  }

  const storeName = adminData.siteName || "المتجر العصري";
  const currency = adminData.currency || "ج.م";
  const phone = adminData.whatsapp || adminData.phone || "";

  const productsSummary = products.map((p, idx) => {
    const specsStr = Object.entries(p.specs || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    return `${idx + 1}. اسم المنتج: "${p.name}" | السعر: ${p.price} ${currency}${
      p.oldPrice > p.price ? ` (السعر الأصلي: ${p.oldPrice} ${currency})` : ""
    }${p.categoryName ? ` | القسم: ${p.categoryName}` : ""}${specsStr ? ` | المواصفات: ${specsStr}` : ""}`;
  });

  const systemPrompt = `أنت خبير إعلانات سوشيال ميديا محترف (Facebook & Instagram Copywriter) متخصص في التجارة الإلكترونية بمصر والشرق الأوسط.
مهمتك: كتابة بوست إعلاني جذاب وقوي جداً يحقق أعلى معدلات تحويل ومبيعات، مع توليد نصوص بطاقات التصميم المصاحبة.

بيانات المتجر:
- اسم المتجر: "${storeName}"
- العملة: "${currency}"
${phone ? `- رقم التواصل/الواتساب: "${phone}"` : ""}

الأسلوب المطلوب (Tone of Voice):
- النمط المختار: "${presetObj.label}"
- التوجيه الإبداعي: ${presetObj.promptInstruction}
${discountText ? `- العرض أو الخصم الإضافي المطلوب إبرازه: "${discountText}"` : ""}
${customPrompt ? `- تعليمات إضافية من مدير المتجر: "${customPrompt}"` : ""}

القواعد الإلزامية:
1. كتابة "postText" منظم بالرموز التعبيرية (Emojis) والمسافات المريحة للعين، متضمناً:
   - Hook خاطف في أول سطرين يجبر القارئ على التوقف.
   - مميزات المنتجات وأسعارها بوضوح.
   - حث صريح على اتخاذ القرار والشراء الآن (CTA).
   - هاشتاجات تسويقية ذكية ومناسبة للمنتجات والمتجر.
2. استخراج "headline": عنوان رئيسي ترويجي قصير ومبهر لوضعه على بوستر التصميم (3 إلى 6 كلمات).
3. استخراج "subheadline": عنوان فرعي مكمل للبوستر (3 إلى 8 كلمات).
4. استخراج "badgeText": نص شارة الخصم أو العرض (مثال: "خصم 20%" أو "عرض حصري").
5. استخراج "ctaText": نص زر أو بطاقة الحث على الشراء (مثال: "اطلب الآن - كمية محدودة").
6. صياغة "suggestedImagePrompt": توجيه بصري باللغة الإنجليزية لوصف المشهد الإعلاني لمصمم الجرافيك أو الـ AI.

يجب أن تكون الإجابة بصيغة JSON فقط بالشكل التالي:
{
  "postText": "نص البوست الكامل باللغة العربية...",
  "headline": "عنوان رئيسي للتصميم",
  "subheadline": "عنوان فرعي مكمل",
  "badgeText": "نص شارة الخصم",
  "ctaText": "نص زر الإجراء",
  "suggestedImagePrompt": "High-converting commercial ad poster layout..."
}`;

  const userPrompt = `المنتجات المطلوب الإعلان عنها:\n${productsSummary.join("\n")}\n\nاكتب الإعلان المطلوب بدقة واحترافية تسويقية كاملة.`;

  let aiResult = null;
  try {
    aiResult = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      adminData,
      0.5
    );
  } catch (err) {
    console.warn("[CAMPAIGN_DEEPSEEK_FALLBACK]", err.message);
    try {
      aiResult = await callGemini(systemPrompt, userPrompt, adminData);
    } catch (gemErr) {
      console.warn("[CAMPAIGN_GEMINI_FALLBACK]", gemErr.message);
      aiResult = buildSignalCampaignFallback(products, "default", {}, adminData);
    }
  }

  const fallback = buildSignalCampaignFallback(products, "default", {}, adminData);

  return {
    postText: aiResult?.postText || fallback.postText,
    headline: aiResult?.headline || fallback.headline,
    subheadline: aiResult?.subheadline || fallback.subheadline,
    badgeText: aiResult?.badgeText || fallback.badgeText,
    ctaText: aiResult?.ctaText || fallback.ctaText,
    suggestedImagePrompt: aiResult?.suggestedImagePrompt || fallback.suggestedImagePrompt,
    productsSnapshot: products
  };
}

module.exports = {
  generateAdPostCopy
};
