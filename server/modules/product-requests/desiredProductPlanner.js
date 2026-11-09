const axios = require("axios");
const getCategoriesModel = require("../categories/categoryModel");
const { getStoreCategorySchema } = require("../../core/ai/schemaExtractor");
const {
  buildLocalSemanticVector,
  cosineSimilarity,
  normalizeArabicText
} = require("../ai-instructions/aiInstructionService");

/**
 * Local deterministic fallback to extract product specs and category when AI API is unavailable
 */
function localExtractDesiredProduct(queryText, categories = []) {
  const normQuery = normalizeArabicText(queryText);
  let matchedCategory = null;

  for (const cat of categories) {
    const catNameNorm = normalizeArabicText(cat.name);
    if (normQuery.includes(catNameNorm)) {
      matchedCategory = cat;
      break;
    }
  }

  // Price hints extraction
  let minPrice = null;
  let maxPrice = null;
  const underMatch = queryText.match(/(?:تحت|أقل من|اقل من|حدود|ميزانية|سعر)\s*(\d+)/i);
  if (underMatch) {
    maxPrice = Number(underMatch[1]);
  }
  const overMatch = queryText.match(/(?:أكبر من|فوق|اكتر من|أكثر من)\s*(\d+)/i);
  if (overMatch) {
    minPrice = Number(overMatch[1]);
  }

  // Extract simple specs
  const specs = {};
  const colors = ["اسود", "أسود", "ابيض", "أبيض", "فضي", "ذهبي", "ازرق", "أزرق", "احمر", "أحمر", "رمادي"];
  for (const c of colors) {
    if (normQuery.includes(normalizeArabicText(c))) {
      specs.color = c;
      break;
    }
  }

  const horsePowerMatch = queryText.match(/(\d+(?:\.\d+)?)\s*(?:حصان|hp)/i);
  if (horsePowerMatch) {
    specs.horsePower = horsePowerMatch[1];
  }

  const storageMatch = queryText.match(/(\d+)\s*(?:جيجا|gb|تيرابايت|tb)/i);
  if (storageMatch) {
    specs.storage = storageMatch[0];
  }

  return {
    extractedName: queryText.slice(0, 100).trim(),
    categoryId: matchedCategory ? String(matchedCategory._id) : null,
    categoryName: matchedCategory ? matchedCategory.name : "",
    specs,
    targetPrice: { min: minPrice, max: maxPrice },
    tags: []
  };
}

/**
 * Plan, structure, and generate 128-d semantic embedding for customer's desired product query
 */
async function planAndEmbedDesiredProduct(subdomain, queryText, adminData = {}) {
  const Categories = getCategoriesModel(subdomain);
  const categories = await Categories.find({}).lean();

  let schemaPromptText = "";
  try {
    schemaPromptText = await getStoreCategorySchema(subdomain);
  } catch (err) {
    console.warn("[DESIRED_PRODUCT_PLANNER] Failed to load schema text:", err.message);
  }

  const apiKey = (adminData.AI_API_KEY || adminData.aiApiKey || process.env.AI_API_KEY || "").trim();
  const baseUrl = (adminData.AI_BASE_URL || process.env.AI_BASE_URL || "https://api.deepseek.com").trim();
  const model = (adminData.AI_MODEL || process.env.AI_MODEL || "deepseek-chat").trim();

  let plannedResult = null;

  if (apiKey) {
    const systemPrompt = `أنت مخطط ذكاء اصطناعي (AI Product Planner) متخصص في استخراج وتصنيف رغبات العملاء للمنتجات المستقبلية.
المهمة:
العميل يبحث عن منتج يرغب في توفره مستقبلاً. حلل طلبه واستخرج التالي بدقة:
1. extractedName: اسم دال ومختصر للمنتج المطلوب (مثال: "تكييف كاريير 3 حصان انفرتر بارد ساخن" أو "آيفون 15 برو ماكس 256 جيجا").
2. categoryId: معرف القسم (ObjectId) الأنسب من قائمة أقسام المتجر أدناه، أو null إذا لم يتطابق مع أي قسم.
3. categoryName: اسم القسم المطابق، أو فارغ إذا لم يتطابق.
4. specs: كائن يحتوي على المواصفات المذكورة في نص العميل فقط (مثل الماركة، الحجم، اللون، السعة، القدرة، النوع). أي مواصفة لم يحددها العميل لا تخمنها واتركها غير موجودة.
5. targetPrice: { min: number | null, max: number | null } نطاق السعر أو الميزانية إذا ذُكرت.
6. tags: مصفوفة بالكلمات الدلالية والوسوم المستخرجة من طلبه.

أقسام ومواصفات المتجر:
${schemaPromptText || categories.map((c) => `- ${c.name} (ID: ${c._id})`).join("\n")}

أرجع النتيجة بصيغة JSON فقط:
{
  "extractedName": "اسم المنتج المطلوب",
  "categoryId": "ID أو null",
  "categoryName": "اسم القسم أو فارغ",
  "specs": { "المواصفة": "القيمة" },
  "targetPrice": { "min": null, "max": null },
  "tags": ["وسم1", "وسم2"]
}`;

    try {
      const resp = await axios.post(
        `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: queryText }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      const content = resp.data?.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
      if (parsed && (parsed.extractedName || parsed.categoryName)) {
        // Resolve categoryId if model returned an ID or name
        let matchedCat = categories.find((c) => String(c._id) === String(parsed.categoryId));
        if (!matchedCat && parsed.categoryName) {
          const normExpected = normalizeArabicText(parsed.categoryName);
          matchedCat = categories.find((c) => normalizeArabicText(c.name) === normExpected);
        }

        plannedResult = {
          extractedName: parsed.extractedName || queryText.slice(0, 80),
          categoryId: matchedCat ? String(matchedCat._id) : null,
          categoryName: matchedCat ? matchedCat.name : (parsed.categoryName || ""),
          specs: typeof parsed.specs === "object" && parsed.specs !== null ? parsed.specs : {},
          targetPrice: {
            min: Number(parsed.targetPrice?.min) || null,
            max: Number(parsed.targetPrice?.max) || null
          },
          tags: Array.isArray(parsed.tags) ? parsed.tags : []
        };
      }
    } catch (err) {
      console.warn("[DESIRED_PRODUCT_PLANNER_WARN] LLM call failed, falling back to local extractor:", err.message);
    }
  }

  // Fallback to local heuristic extractor if AI call wasn't made or failed
  if (!plannedResult) {
    plannedResult = localExtractDesiredProduct(queryText, categories);
  }

  // Generate 768-d semantic embedding for vector matching
  const specsText = Object.entries(plannedResult.specs || {})
    .map(([k, v]) => `${k} ${v}`)
    .join(" ");

  const textToEmbed = [
    queryText,
    plannedResult.extractedName,
    plannedResult.categoryName,
    specsText
  ]
    .filter(Boolean)
    .join(" ");

  const { generateEmbedding, cosineSimilarity: geminiCosineSim, isGeminiEmbeddingVector, normalizeArabicText, expandDomainTokens, buildProductEmbeddingText } = require("../semantic-engine");
  const embedding = await generateEmbedding(textToEmbed, {
    adminData,
    taskType: "RETRIEVAL_QUERY",
    extraTags: plannedResult.tags || []
  });

  return {
    ...plannedResult,
    embedding
  };
}

/**
 * Compare a product against all pending desired product requests using 768-d Gemini Cosine Similarity + Lexical Fallback
 */
async function matchProductWithDesiredRequests(subdomain, productDoc, minSimilarity = 0.45) {
  const getDesiredProductModel = require("./desiredProductModel");
  const {
    generateEmbedding,
    cosineSimilarity: geminiCosineSim,
    isGeminiEmbeddingVector,
    normalizeArabicText,
    expandDomainTokens,
    buildProductEmbeddingText
  } = require("../semantic-engine");

  const DesiredProduct = await getDesiredProductModel(subdomain);

  const pendingRequests = await DesiredProduct.find({
    status: { $in: ["pending", "matched"] }
  }).lean();

  if (!pendingRequests.length) {
    return [];
  }

  const productText = buildProductEmbeddingText(productDoc, productDoc.categoryName || "");
  let productVec = productDoc.embedding;
  if (!isGeminiEmbeddingVector(productVec, productDoc.embeddingModel)) {
    productVec = await generateEmbedding(productText, { taskType: "RETRIEVAL_DOCUMENT" });
  }
  const hasProdGemini = isGeminiEmbeddingVector(productVec);

  const prodNorm = normalizeArabicText(productText);
  const prodTokens = new Set(expandDomainTokens(prodNorm.split(" ").filter((t) => t.length >= 2)));

  const matches = [];

  for (const req of pendingRequests) {
    let score = 0;
    const reqText = [req.queryText, req.extractedName, req.categoryName].filter(Boolean).join(" ");
    let reqVec = req.embedding;

    if (hasProdGemini && !isGeminiEmbeddingVector(reqVec)) {
      reqVec = await generateEmbedding(reqText, { taskType: "RETRIEVAL_QUERY" });
      if (isGeminiEmbeddingVector(reqVec)) {
        DesiredProduct.updateOne({ _id: req._id }, { $set: { embedding: reqVec } }).catch(() => {});
      }
    }

    if (hasProdGemini && isGeminiEmbeddingVector(reqVec)) {
      score = geminiCosineSim(productVec, reqVec);
    } else {
      // Lexical Fallback when Gemini is unavailable
      const reqTokens = expandDomainTokens(
        normalizeArabicText(reqText).split(" ").filter((t) => t.length >= 2)
      );
      if (reqTokens.length > 0) {
        let hits = 0;
        reqTokens.forEach((t) => {
          if (prodTokens.has(t) || prodNorm.includes(t)) hits++;
        });
        score = hits / reqTokens.length;
      }
    }

    // Category bonus: if same category, grant a 0.08 similarity boost
    const prodCatId = productDoc.categoryId?._id || productDoc.categoryId || productDoc.category;
    if (req.categoryId && prodCatId && String(req.categoryId) === String(prodCatId)) {
      score = Math.min(1.0, score + 0.08);
    }

    // Price match consideration: if target price specified and product matches
    if (req.targetPrice?.max && productDoc.price) {
      if (productDoc.price <= req.targetPrice.max) {
        score = Math.min(1.0, score + 0.05);
      }
    }

    if (score >= minSimilarity) {
      matches.push({
        desiredProduct: {
          _id: req._id,
          queryText: req.queryText,
          extractedName: req.extractedName,
          categoryName: req.categoryName,
          specs: req.specs,
          targetPrice: req.targetPrice,
          customerName: req.customerName,
          phone: req.phone,
          email: req.email,
          visitorId: req.visitorId,
          channelPreference: req.channelPreference,
          status: req.status,
          createdAt: req.createdAt
        },
        similarityScore: Number(score.toFixed(3))
      });
    }
  }

  // Sort descending by highest similarity score
  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  return matches;
}

module.exports = {
  planAndEmbedDesiredProduct,
  matchProductWithDesiredRequests,
  localExtractDesiredProduct
};
