const { getCategorySpecsContext } = require("./schemaContext");
const { callDeepSeek, callGemini } = require("./llmCaller");

/**
 * Normalizes an array of raw product objects against the category's specification schema
 */
function normalizeExtractedProducts(rawProducts = [], categoryContext = {}) {
  const { category = {}, specsMetaList = [] } = categoryContext;

  return rawProducts.map((item, idx) => {
    const rawSpecs = item.specs && typeof item.specs === "object" ? item.specs : {};
    const normalizedSpecs = {};
    const specsDisplay = [];

    specsMetaList.forEach((meta) => {
      // Match by specKey or fallback to specLabel if LLM keyed by label
      const val =
        rawSpecs[meta.specKey] !== undefined
          ? String(rawSpecs[meta.specKey] || "").trim()
          : rawSpecs[meta.specLabel] !== undefined
          ? String(rawSpecs[meta.specLabel] || "").trim()
          : "";

      normalizedSpecs[meta.specKey] = val;
      specsDisplay.push({
        specKey: meta.specKey, // Physical key in product document (e.g. spec1)
        specLabel: meta.specLabel, // User-facing label (e.g. قدرة التبريد)
        value: val,
        existingValues: meta.existingValues || []
      });
    });

    const tags = Array.isArray(item.tags)
      ? item.tags.map((t) => String(t).trim()).filter(Boolean)
      : typeof item.tags === "string"
      ? item.tags.split(/[,،]+/).map((t) => t.trim()).filter(Boolean)
      : [];

    return {
      tempId: `ai_prod_${Date.now()}_${idx}`,
      categoryId: String(category._id || ""),
      categoryName: category.name || "",
      name: String(item.name || "").trim(),
      price: Number(item.price) || 0,
      oldPrice: Number(item.oldPrice) || 0,
      costPrice: Number(item.costPrice) || 0,
      stockCount: item.stockCount !== undefined ? Number(item.stockCount) : 10,
      description: String(item.description || "").trim(),
      tags,
      images: Array.isArray(item.images) ? item.images : [],
      specs: normalizedSpecs,
      specsDisplay,
      active: true
    };
  });
}

/**
 * Extracts and schemas single or multiple products from unstructured spoken or written text
 */
async function extractProductsForCategory(subdomain, categoryId, spokenOrWrittenText, adminData = {}) {
  if (!spokenOrWrittenText || !spokenOrWrittenText.trim()) {
    throw new Error("يرجى إدخال أو نطق بيانات المنتج أولاً");
  }

  // 1. Fetch Category & its Specs Schema from MongoDB
  const categoryContext = await getCategorySpecsContext(subdomain, categoryId);
  const { category, catSpecsMap, specsMetaList, categoryTags } = categoryContext;

  // Format specs schema for the System Prompt
  const specsSchemaPromptLines = specsMetaList.map((s) => {
    const sampleVals = s.existingValues.map((v) => v.value).slice(0, 8);
    const sampleStr =
      sampleVals.length > 0
        ? ` | أمثلة لقيم الفلتر المعتمدة في المتجر: [${sampleVals.join(" ، ")}]`
        : "";
    return `- مفتاح الحفظ البرمجي: "${s.specKey}" -> الاسم المعروض للمستخدم: "${s.specLabel}"${sampleStr}`;
  });

  const specsKeysExampleObj = {};
  specsMetaList.forEach((s) => {
    specsKeysExampleObj[s.specKey] = `قيمة ${s.specLabel} منسقة للفلترة`;
  });

  // 2. Planner LLM System Prompt with Category Specs injected
  const systemPrompt = `أنت مخطط ذكي ومحلل بيانات منتجات (AI Product & Specs Planner) لمتجر إلكتروني.
مهمتك: قراءة النص المنطوق أو المكتوب من مدير المتجر (سواء كان لمنتج واحد أو لمجموعة منتجات دفعة واحدة)، واستخراج بيانات كل منتج مع مواصفاته الفنية الخاصة بالقسم المختار بدقة عالية.

بيانات القسم المختار من قاعدة البيانات (MongoDB):
- اسم القسم: "${category.name}" (معرف القسم: "${category._id}")
- وسوم القسم المعتادة (Tags): [${categoryTags.join("، ") || "عام"}]
- هيكل المواصفات الفنية الخاصة بهذا القسم (Category Specs Schema):
${specsSchemaPromptLines.length > 0 ? specsSchemaPromptLines.join("\n") : "- لا توجد مواصفات مقيدة مسبقاً لهذا القسم"}

القواعد الصارمة لاستخراج وتنسيق البيانات:
1. قد يحتوي النص على منتج واحد أو عدة منتجات؛ استخرجها جميعاً في مصفوفة "products".
2. لكل منتج، استخرج:
   - "name": اسم المنتج التجاري الكامل والمنسق بشكل احترافي (مثال: "تكييف كاريير أوبتيماكس برو 1.5 حصان بارد فقط انفرتر").
   - "price": سعر البيع النهائي (رقم فقط، أو 0 إذا لم يُذكر).
   - "oldPrice": السعر قبل الخصم إن ذُكر (رقم فقط، أو 0 إذا لم يُذكر).
   - "costPrice": سعر التكلفة أو الجملة إن ذُكر (رقم فقط، أو 0 إذا لم يُذكر).
   - "stockCount": الكمية أو المخزون المتاح (رقم، الافتراضي 10 إذا لم يُذكر).
   - "description": وصف تسويقي وفني احترافي للمنتج باللغة العربية يوضح مميزاته ومواصفاته.
   - "tags": مصفوفة وسوم مناسبة للمنتج (تتضمن الماركة وأهم الكلمات المفتاحية المتوافقة مع وسوم القسم).
   - "specs": كائن يحتوي على مفاتيح المواصفات البرمجية المحفوظة في القسم (${Object.keys(catSpecsMap).join(", ") || "إن وجدت"}).
3. تنسيق قيم المواصفات (Filter-Ready Formatting):
   - نسق قيمة كل مواصفة بنفس الأسلوب القياسي الموحد المستخدم في فلترة المنتجات بالمتجر (انظر "أمثلة لقيم الفلتر المعتمدة" أعلاه إن وجدت).
   - إذا لم تُذكر مواصفة معينة في كلام المستخدم ولكن يمكن استنتاجها منطقياً من موديل المنتج فاستنتجها، وإلا اترك قيمتها نصاً فارغاً "".

يجب إرجاع النتيجة بصيغة JSON فقط بدون أي نصوص إضافية أو markdown بالشكل التالي:
{
  "products": [
    {
      "name": "اسم المنتج الكامل",
      "price": 0,
      "oldPrice": 0,
      "costPrice": 0,
      "stockCount": 10,
      "description": "وصف احترافي للمنتج",
      "tags": ["وسم1", "وسم2"],
      "specs": ${JSON.stringify(specsKeysExampleObj)}
    }
  ]
}`;

  let parsed = null;

  // Priority 1: DeepSeek
  try {
    parsed = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: spokenOrWrittenText }
      ],
      adminData,
      0.1
    );
  } catch (err) {
    console.warn("[INTAKE_ENGINE] DeepSeek failed, trying Gemini fallback:", err.message);
  }

  // Priority 2: Gemini Fallback
  if (!parsed || !Array.isArray(parsed.products)) {
    try {
      parsed = await callGemini(systemPrompt, spokenOrWrittenText, adminData);
    } catch (err) {
      console.warn("[INTAKE_ENGINE] Gemini fallback failed:", err.message);
      throw new Error("تعذر استخراج بيانات المنتجات بالذكاء الاصطناعي: " + err.message);
    }
  }

  const rawProducts = Array.isArray(parsed?.products) ? parsed.products : [];
  if (rawProducts.length === 0) {
    throw new Error("لم يتم العثور على منتجات واضحة في النص المدخل");
  }

  // 3. Normalize products
  const normalizedProducts = normalizeExtractedProducts(rawProducts, categoryContext);

  return {
    category: {
      _id: String(category._id),
      name: category.name,
      specs: catSpecsMap,
      tags: categoryTags
    },
    specsMetaList,
    products: normalizedProducts
  };
}

module.exports = {
  normalizeExtractedProducts,
  extractProductsForCategory
};
