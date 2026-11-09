const { analyzeImageWithVision } = require("./visualProvider");

/**
 * Extracts structured product records from an image or scanned document
 * (e.g., photo of wholesale catalog, invoice, receipt, shelf price tag)
 * using Multimodal Vision AI.
 */
async function extractProductsFromVisualDocument(fileBuffer, mimeType, systemPrompt, adminData = {}) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new Error("Invalid fileBuffer provided for visual document extraction");
  }

  const cleanMimeType = (mimeType || "image/jpeg").split(";")[0].trim();
  const userPrompt =
    "يرجى فحص وتحليل هذا الملف أو الصورة بدقة متناهية واستخراج كافة المنتجات المعروضة أو المذكورة فيها مع أسعارها ومواصفاتها الفنية بصيغة JSON حصراً.";

  try {
    const parsedData = await analyzeImageWithVision({
      imageBuffer: fileBuffer,
      mimeType: cleanMimeType,
      prompt: userPrompt,
      systemPrompt,
      responseFormat: "json",
      adminData
    });

    return parsedData;
  } catch (err) {
    console.error("[DOCUMENT_VISION_EXTRACTOR_ERR]", err.message);
    throw new Error(
      "تعذر استخراج المنتجات بالرؤية الحاسوبية من هذا الملف/الصورة. تأكد من ضبط مفتاح GEMINI_API_KEY أو مفتاح AI للصور في الإعدادات."
    );
  }
}

module.exports = {
  extractProductsFromVisualDocument
};
