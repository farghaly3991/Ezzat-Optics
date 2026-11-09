const { getCategorySpecsContext } = require("./schemaContext");

/**
 * Builds rich, context-aware prompt for external AI (ChatGPT Plus / Claude / Gemini Web)
 * containing the exact category specifications schema and JSON format constraints.
 */
async function generateExternalPromptForCategory(subdomain, categoryId) {
  const { category, catSpecsMap, specsMetaList, categoryTags } = await getCategorySpecsContext(
    subdomain,
    categoryId
  );

  const specsPromptLines = specsMetaList.map((s) => {
    const sampleVals = s.existingValues.map((v) => v.value).slice(0, 8);
    const sampleStr =
      sampleVals.length > 0 ? ` | قيم شائعة: [${sampleVals.join(" ، ")}]` : "";
    return `- "${s.specKey}": ${s.specLabel}${sampleStr}`;
  });

  const sampleSpecsObj = {};
  specsMetaList.forEach((s) => {
    sampleSpecsObj[s.specKey] = `قيمة ${s.specLabel}`;
  });

  const prompt = `المطلوب: قم بفحص وتحليل الملف أو النص المرفق الخاص بمنتجات قسم "${category.name}"، واستخرج جميع المنتجات بصيغة JSON حصراً بدون أي نصوص تمهيدية أو ختامية.

القواعد:
1. استخرج المنتجات في مصفوفة باسم "products".
2. لكل منتج استخرج:
   - "name": اسم المنتج الكامل والواضح
   - "price": سعر البيع (رقم)
   - "oldPrice": السعر قبل الخصم إن وجد (رقم)
   - "costPrice": سعر التكلفة/الجملة إن وجد (رقم)
   - "stockCount": الكمية المتاحة (رقم، الافتراضي 10)
   - "description": وصف تسويقي وجذاب باللغة العربية
   - "tags": وسوم للمنتج (وسوم القسم المقترحة: ${categoryTags.join("، ") || "عام"})
   - "specs": كائن يحتوي على المواصفات الفنية التالية حصراً:
${specsPromptLines.length > 0 ? specsPromptLines.join("\n") : "- لا توجد مواصفات مقيدة لهذا القسم"}

صيغة الـ JSON المطلوبة:
\`\`\`json
{
  "products": [
    {
      "name": "اسم المنتج",
      "price": 0,
      "oldPrice": 0,
      "costPrice": 0,
      "stockCount": 10,
      "description": "وصف تسويقي",
      "tags": ["وسم1", "وسم2"],
      "specs": ${JSON.stringify(sampleSpecsObj, null, 2)}
    }
  ]
}
\`\`\``;

  return {
    category: {
      _id: String(category._id),
      name: category.name,
      specs: catSpecsMap,
      tags: categoryTags
    },
    specsMetaList,
    prompt
  };
}

module.exports = {
  generateExternalPromptForCategory
};
