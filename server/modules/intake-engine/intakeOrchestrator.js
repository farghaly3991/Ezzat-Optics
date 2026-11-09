const { parseDocument } = require("./documentParser");
const { getCategorySpecsContext } = require("./schemaContext");
const { normalizeExtractedProducts, extractProductsForCategory } = require("./catalogExtractor");
const visualEngine = require("../visual-engine");
const audioEngine = require("../audio-engine");

/**
 * Universal Document AI Intake (Direct JSON paste, Text PDF, Scanned Image PDF, Word, Excel, Images)
 */
async function processDocumentIntake({
  fileBuffer = null,
  mimeType = "",
  filename = "",
  jsonText = "",
  rawText = "",
  subdomain,
  categoryId,
  adminData = {}
}) {
  if (!categoryId) {
    throw new Error("يرجى اختيار القسم أولاً");
  }

  // 1. Direct JSON Paste (e.g. from external AI)
  if (jsonText && jsonText.trim()) {
    let cleanJson = jsonText.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed = null;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      throw new Error("كود الـ JSON المدخل غير صالح. يرجى التأكد من نسخه بالكامل.");
    }

    const rawProducts = Array.isArray(parsed?.products)
      ? parsed.products
      : Array.isArray(parsed)
      ? parsed
      : [];

    if (rawProducts.length === 0) {
      throw new Error("لم يتم العثور على أي منتجات داخل ملف الـ JSON المدخل");
    }

    const categoryContext = await getCategorySpecsContext(subdomain, categoryId);
    const normalizedProducts = normalizeExtractedProducts(rawProducts, categoryContext);

    return {
      extractedFrom: "json_import",
      category: categoryContext.category,
      specsMetaList: categoryContext.specsMetaList,
      products: normalizedProducts
    };
  }

  // 2. Direct Raw Text Input
  if (!fileBuffer && rawText && rawText.trim()) {
    const extraction = await extractProductsForCategory(
      subdomain,
      categoryId,
      rawText.trim(),
      adminData
    );
    return {
      extractedFrom: "text_input",
      ...extraction
    };
  }

  // 3. File Buffer Ingestion
  if (!fileBuffer) {
    throw new Error("يرجى اختيار ملف لرفعه أو إدخال نص المنتجات");
  }

  const parsedDoc = await parseDocument(fileBuffer, mimeType, filename);

  // A) If document is a scanned image or photo requiring Multimodal Vision
  if (parsedDoc.isVisionNeeded) {
    const categoryContext = await getCategorySpecsContext(subdomain, categoryId);
    const { category, catSpecsMap, specsMetaList, categoryTags } = categoryContext;

    const specsSchemaPromptLines = specsMetaList.map((s) => {
      const sampleVals = s.existingValues.map((v) => v.value).slice(0, 8);
      const sampleStr = sampleVals.length > 0 ? ` | أمثلة: [${sampleVals.join(" ، ")}]` : "";
      return `- "${s.specKey}": ${s.specLabel}${sampleStr}`;
    });

    const visionSystemPrompt = `أنت نظام ذكي لفحص المستندات المصورة وقوائم البضائع واستخراج المنتجات لقسم "${category.name}".
استخرج جميع المنتجات المذكورة في الصورة أو الملف بصيغة JSON حصراً بالمواصفات الفنية التالية:
${specsSchemaPromptLines.join("\n")}
الصيغة الإلزامية:
{
  "products": [
    {
      "name": "اسم المنتج",
      "price": 0,
      "oldPrice": 0,
      "costPrice": 0,
      "stockCount": 10,
      "description": "وصف المنتج ومميزاته",
      "tags": ["وسم1", "وسم2"],
      "specs": { "${Object.keys(catSpecsMap)[0] || "spec1"}": "قيمة المواصفة" }
    }
  ]
}`;

    const visionResult = await visualEngine.extractProductsFromVisualDocument(
      fileBuffer,
      parsedDoc.mimeType || mimeType,
      visionSystemPrompt,
      adminData
    );

    const rawProducts = Array.isArray(visionResult?.products)
      ? visionResult.products
      : Array.isArray(visionResult)
      ? visionResult
      : [];

    if (rawProducts.length === 0) {
      throw new Error("تعذر العثور على منتجات واضحة في الصورة أو المستند الممسوح ضوئياً");
    }

    const normalizedProducts = normalizeExtractedProducts(rawProducts, categoryContext);
    return {
      extractedFrom: `vision_${parsedDoc.format}`,
      category: categoryContext.category,
      specsMetaList: categoryContext.specsMetaList,
      products: normalizedProducts
    };
  }

  // B) Standard Text-Extracted Document (PDF, Word, Excel, CSV)
  if (!parsedDoc.text || !parsedDoc.text.trim()) {
    throw new Error("الملف فارغ أو تعذر قراءة نصوص منه");
  }

  const extraction = await extractProductsForCategory(
    subdomain,
    categoryId,
    parsedDoc.text,
    adminData
  );

  return {
    extractedFrom: `document_${parsedDoc.format}`,
    ...extraction
  };
}

/**
 * Universal Voice AI Product Intake
 */
async function processVoiceIntake({
  audioBuffer,
  mimeType = "audio/webm",
  subdomain,
  categoryId,
  adminData = {}
}) {
  if (!categoryId) {
    throw new Error("يرجى اختيار القسم أولاً قبل تسجيل الصوت");
  }

  if (!audioBuffer) {
    throw new Error("لم يتم إرسال أي تسجيل صوتي");
  }

  // 1. Transcribe voice via Audio Engine
  const transcribedText = await audioEngine.transcribeVoiceIntake(
    audioBuffer,
    mimeType,
    adminData
  );

  if (!transcribedText || !transcribedText.trim()) {
    throw new Error("لم يتم التقاط كلمات واضحة في التسجيل الصوتي");
  }

  // 2. Extract structured products from transcription
  const extraction = await extractProductsForCategory(
    subdomain,
    categoryId,
    transcribedText,
    adminData
  );

  return {
    extractedFrom: "voice",
    transcribedText,
    ...extraction
  };
}

module.exports = {
  processDocumentIntake,
  processVoiceIntake
};
