/**
 * Deterministic Signal-Driven Marketing Campaign Builder
 * Constructs tailored promotional copy and layout angles based on store analytics triggers.
 */
function buildSignalCampaignFallback(products = [], signalKey = "auto_ai", signalObj = {}, adminData = {}) {
  const storeName = adminData.siteName || "المتجر العصري";
  const currency = adminData.currency || "ج.م";
  const phone = adminData.whatsapp || adminData.phone || "";

  const angleMap = {
    cart_without_order: {
      preset: "urgent_fomo",
      svgTemplateId: "flash_retail",
      headline: "فرصتك الأخيرة لإتمام طلبك! 🛒",
      subheadline: "الكمية المتبقية أوشكت على النفاد",
      discountText: "شحن سريع + عرض خاص لفترة محدودة 🔥",
      badgeText: "الأكثر طلباً في السلة 🔥",
      hook: "لاحظنا إقبالاً كبيراً جداً على المنتجات دي الفترة الأخيرة! لو لسه متردد أو حاططها في السلة، وفرنالك النهاردة أقوى عرض عشان تحسم قرارك قبل نفاد الكمية 🚀",
      customPrompt: "التركيز على حسم تردد العميل، سرعة التوصيل، والكمية المحدودة للمنتجات المضافة للسلة"
    },
    incomplete_orders: {
      preset: "friendly_egyptian",
      svgTemplateId: "modern_spotlight",
      headline: "تسهيلات خاصة وضمان كامل! 🛡️",
      subheadline: "شحن سريع ومعاينة قبل الاستلام",
      discountText: "ضمان شامل + معاينة عند الاستلام 🛡️",
      badgeText: "ضمان وأمان 100% ✅",
      hook: "راحتك وثقتك تهمنا قبل أي حاجة! دلوقتي تقدر تطلب وأنت مطمئن تماماً مع ضمان أصلي، توصيل سريع لباب البيت، ومعاينة الطلب بنفسك عند الاستلام 🤝✨",
      customPrompt: "التركيز على بناء الثقة، الضمان الحقيقي، الدفع والمعاينة عند الاستلام، وسرعة التوصيل"
    },
    high_views_low_conversion: {
      preset: "tech_specs",
      svgTemplateId: "dark_luxury",
      headline: "الأكثر خطفاً للأنظار اليوم! ✨",
      subheadline: "مواصفات حصرية وسعر منافس",
      discountText: "أقوى قيمة مقابل سعر في السوق 💎",
      badgeText: "أفضل قيمة ومواصفات ⭐",
      hook: "بتبحث عن المواصفات الأقوى والسعر اللي يناسب ميزانيتك؟ جبنالك التفاصيل الكاملة للمنتج الأكثر بحثاً ومشاهدة على منصتنا عشان تختار الصح عن اقتناع 💡",
      customPrompt: "إبراز القيمة العالية مقابل السعر وشرح المواصفات الفارقة التي تبرر اقتناء المنتج"
    },
    best_sellers: {
      preset: "luxury_prestige",
      svgTemplateId: "modern_spotlight",
      headline: "تشكيلة النخبة والأكثر طلباً! 🏆",
      subheadline: "اختيار آلاف العملاء الموثوق",
      discountText: "الأكثر مبيعاً وتقييماً من عملائنا 🏆",
      badgeText: "الأعلى مبيعاً 🏆",
      hook: "اختيار آلاف العملاء مش من فراغ! استمتع بأعلى جودة وأفضل أداء مع تشكيلة المنتجات الأكثر مبيعاً وطلباً في متجرنا 🌟",
      customPrompt: "إبراز أن المنتج هو الأكثر مبيعاً وطلباً (Social Proof) والتركيز على الجودة الفائقة"
    },
    slow_movers_high_stock: {
      preset: "bundle_saver",
      svgTemplateId: "emerald_bundle",
      headline: "تصفية خاصة وعروض التوفير الكبرى! 🎁",
      subheadline: "أسعار استثنائية شحن فوري",
      discountText: "عرض التوفير الحصري لفترة محدودة 🎁",
      badgeText: "عرض توفير حصري 🎁",
      hook: "فرصة توفير ما تتعوضش! جهزنالك عرض استثنائي على منتجات متوفرة جاهزة للشحن الفوري بأفضل سعر في مصر 🎉",
      customPrompt: "تقديم المنتجات كعرض ترويجي جذاب جاهز للشحن الفوري لتحريك المبيعات"
    },
    auto_ai: {
      preset: products.length > 1 ? "bundle_saver" : "urgent_fomo",
      svgTemplateId: products.length > 1 ? "emerald_bundle" : "modern_spotlight",
      headline: "اختياراتنا الذكية لك اليوم! 🌟",
      subheadline: "أفضل الموديلات وأقوى الأسعار",
      discountText: "عرض خاص لفترة محدودة 🔥",
      badgeText: "ترشيح ذكي 🔥",
      hook: "اختياراتنا الذكية لك اليوم! أقوى المنتجات الأكثر طلباً واهتماماً من عملائنا بأفضل سعر وضمان حقيقي 🚀",
      customPrompt: "إبراز نقاط القوة والطلب العالي على المنتجات المختارة مع دعوة واضحة للشراء"
    }
  };

  const selectedAngle = angleMap[signalKey] || angleMap.auto_ai;

  const productLines = products.map((p, idx) => {
    const oldPriceStr = p.oldPrice > p.price ? ` (بدلاً من ${p.oldPrice} ${currency})` : "";
    const specsStr = Object.entries(p.specs || {})
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    return `${idx + 1}️⃣ **${p.name}**\n   💰 السعر: **${p.price} ${currency}**${oldPriceStr}${
      specsStr ? `\n   ⚙️ أهم المواصفات: ${specsStr}` : ""
    }`;
  });

  const postText = [
    `${selectedAngle.headline}`,
    ``,
    `${selectedAngle.hook}`,
    ``,
    `🌟 تفاصيل العرض والمنتجات المتاحة:`,
    productLines.join("\n\n"),
    ``,
    `🚚 متاح الشحن السريع لكافة المحافظات والدفع عند الاستلام بعد المعاينة.`,
    phone ? `📲 للطلب السريع والاستفسار: ${phone}` : `🛍️ للطلب: اطلب مباشرة من متجرنا الآن!`,
    ``,
    `#${storeName.replace(/\s+/g, "_")} #عروض_خاصة #تسوق_أونلاين`
  ]
    .filter(Boolean)
    .join("\n");

  return {
    preset: selectedAngle.preset,
    svgTemplateId: selectedAngle.svgTemplateId,
    discountText: selectedAngle.discountText,
    customPrompt: selectedAngle.customPrompt,
    postText,
    headline: selectedAngle.headline,
    subheadline: selectedAngle.subheadline,
    badgeText: selectedAngle.badgeText,
    ctaText: phone ? `اطلب الآن: ${phone}` : "اطلب الآن عبر رسائل الصفحة",
    suggestedImagePrompt: `Commercial promotional advertisement layout for "${storeName}", featuring products: ${products
      .map((p) => p.name)
      .join(", ")}. Headline overlay: "${selectedAngle.headline}". Studio retail lighting, 8k.`,
    strategySummary: `تم اختيار (${products.map((p) => p.name).join("، ")}) بناءً على دلالة «${
      signalObj?.label || signalKey || "الأكثر احتياجاً للإعلان"
    }»، وتم ضبط زاوية الإعلان على أسلوب (${selectedAngle.preset}) لتحفيز المبيعات الفورية.`
  };
}

module.exports = {
  buildSignalCampaignFallback
};
