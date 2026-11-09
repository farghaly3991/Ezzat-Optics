const getDesiredProductModel = require("../product-requests/desiredProductModel");
const {
  generateEmbedding,
  isGeminiEmbeddingVector,
  cosineSimilarity,
  normalizeArabicText,
  expandDomainTokens
} = require("./embeddingProvider");
const { buildProductEmbeddingText } = require("./productRepresentation");

const REQUEST_MATCH_THRESHOLD = 0.60;

/**
 * Plan and generate 768-d Gemini embedding for a desired product query
 */
async function embedDesiredProductRequest(queryText, { categoryName = "", specs = {}, adminData = {} } = {}) {
  const specSummary = Object.entries(specs || {}).map(([k, v]) => `${k} ${v}`).join(" ");
  const text = [
    categoryName ? `قسم ${categoryName}` : "",
    queryText,
    specSummary ? `المواصفات: ${specSummary}` : ""
  ].filter(Boolean).join(". ");

  return generateEmbedding(text, { adminData, taskType: "RETRIEVAL_QUERY" });
}

/**
 * Match a newly added/updated product with active customer product requests
 * Uses 768-d Gemini embeddings with clean lexical fallback if Gemini is unavailable.
 */
async function matchProductWithCustomerRequests(subdomain, productDoc, { adminData = {} } = {}) {
  if (!productDoc) return [];

  const DesiredProduct = getDesiredProductModel(subdomain);
  const pendingRequests = await DesiredProduct.find({
    status: { $in: ["pending", "matched"] }
  }).lean();

  if (!pendingRequests || pendingRequests.length === 0) return [];

  const prodText = buildProductEmbeddingText(productDoc, productDoc.categoryName);
  let prodVec = productDoc.embedding;
  if (!isGeminiEmbeddingVector(prodVec, productDoc.embeddingModel)) {
    prodVec = await generateEmbedding(prodText, {
      adminData,
      taskType: "RETRIEVAL_DOCUMENT"
    });
  }
  const hasProdGemini = isGeminiEmbeddingVector(prodVec);

  const prodNorm = normalizeArabicText(prodText);
  const prodTokens = new Set(expandDomainTokens(prodNorm.split(" ").filter((t) => t.length >= 2)));

  const matches = [];

  for (const req of pendingRequests) {
    let reqVec = req.embedding;
    if (hasProdGemini && !isGeminiEmbeddingVector(reqVec)) {
      reqVec = await embedDesiredProductRequest(req.queryText, {
        categoryName: req.categoryName,
        specs: req.specs,
        adminData
      });
      if (isGeminiEmbeddingVector(reqVec)) {
        await DesiredProduct.updateOne({ _id: req._id }, { $set: { embedding: reqVec } });
      }
    }

    let sim = 0;
    if (hasProdGemini && isGeminiEmbeddingVector(reqVec)) {
      sim = cosineSimilarity(prodVec, reqVec);
    } else {
      const reqTokens = expandDomainTokens(
        normalizeArabicText(req.queryText || "").split(" ").filter((t) => t.length >= 2)
      );
      if (reqTokens.length > 0) {
        let hits = 0;
        reqTokens.forEach((t) => {
          if (prodTokens.has(t) || prodNorm.includes(t)) hits++;
        });
        sim = hits / reqTokens.length;
      }
    }

    // Boost if categories match
    let finalScore = sim;
    if (req.categoryId && productDoc.categoryId && String(req.categoryId) === String(productDoc.categoryId)) {
      finalScore = Math.min(1.0, finalScore + 0.1);
    }

    // Price consideration
    if (req.targetPrice?.max && productDoc.price) {
      if (productDoc.price <= req.targetPrice.max) {
        finalScore = Math.min(1.0, finalScore + 0.05);
      }
    }

    if (finalScore >= REQUEST_MATCH_THRESHOLD) {
      matches.push({
        requestId: req._id,
        customerName: req.customerName,
        phone: req.phone,
        email: req.email,
        userId: req.userId,
        similarityScore: Number(finalScore.toFixed(3)),
        queryText: req.queryText
      });

      await DesiredProduct.updateOne(
        { _id: req._id },
        {
          $set: {
            status: "matched",
            matchedProductId: productDoc._id,
            matchedAt: new Date()
          }
        }
      );
    }
  }

  return matches;
}

module.exports = {
  embedDesiredProductRequest,
  matchProductWithCustomerRequests
};
