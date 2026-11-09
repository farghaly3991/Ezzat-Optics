const mongoose = require("mongoose");
const getProductsModel = require("../products/productModel");
const getAdminDataModel = require("../settings/adminDataModel");
const {
  STOP_WORDS,
  generateGeminiEmbeddingStrict,
  isGeminiEmbeddingVector,
  cosineSimilarity,
  normalizeArabicText,
  expandDomainTokens
} = require("./embeddingProvider");
const { syncProductEmbedding } = require("./productRepresentation");

const DEFAULT_SIMILARITY_THRESHOLD = 0.35;
const PURE_SEMANTIC_THRESHOLD = 0.52;

/**
 * Light Arabic morphological stemmer for lexical matching
 * e.g. "للأطفال" -> "اطفال", "بتتكسرش" -> "كسر", "الشاشات" -> "شاش"
 */
function lightStemArabic(token = "") {
  let w = token.trim();
  if (w.length <= 3) return w;

  // Strip colloquial negation prefix/suffix (ما...ش / ب...ش)
  if (w.endsWith("ش") && w.length >= 5 && (w.startsWith("ب") || w.startsWith("ت") || w.startsWith("ي") || w.startsWith("م"))) {
    w = w.slice(0, -1);
  }

  const prefixes = ["وال", "بال", "كال", "فال", "لل", "ال", "بتت", "يت", "تت", "ل", "ب"];
  for (const pre of prefixes) {
    if (w.startsWith(pre) && w.length - pre.length >= 3) {
      w = w.slice(pre.length);
      break;
    }
  }

  const suffixes = ["ات", "ين", "ون", "ان", "ها", "هم", "كم", "يه", "ه", "ي"];
  for (const suf of suffixes) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, -suf.length);
      break;
    }
  }

  return w;
}

/**
 * Stage 1: Deterministic Lexical & Domain-Synonym Scorer
 * Evaluates exact SKU/Barcode/Model matches, direct token matches, and domain synonym matches.
 */
function computeLexicalMatch(prod, {
  cleanQuery,
  normalizedQuery,
  rawQueryTokens,
  expandedQueryTokens,
  intentFlags
}) {
  const os = prod.opticsSpecs || prod.frameSpecs || {};
  const qLower = cleanQuery.toLowerCase();

  // 1. Exact Code Match (SKU, Barcode, ModelCode, GroupCode)
  const exactCodes = [
    prod.sku,
    prod.barcode,
    prod.groupCode,
    os.modelCode
  ]
    .filter(Boolean)
    .map((c) => String(c).trim().toLowerCase());

  if (exactCodes.includes(qLower)) {
    return {
      lexicalScore: 1.0,
      directRatio: 1.0,
      synonymRatio: 1.0,
      categoryBoost: 0.25,
      isExactCode: true
    };
  }

  // 2. Build normalized searchable text fields for the product
  const nameNorm = normalizeArabicText(`${prod.name || ""} ${os.brand || ""} ${os.modelCode || ""}`);
  const tagsAndSpecsNorm = normalizeArabicText(
    `${(prod.tags || []).join(" ")} ${prod.categoryId?.name || ""} ${os.frameMaterial || ""} ${os.frameShape || ""} ${os.color || ""} ${(os.coatings || []).join(" ")} ${os.lensBrand || ""} ${os.lensIndex || ""} ${Object.entries(prod.specs || {}).map(([k, v]) => `${k} ${v}`).join(" ")}`
  );
  const descNorm = normalizeArabicText(`${prod.description || ""}`);

  const fullProdText = `${nameNorm} ${tagsAndSpecsNorm} ${descNorm}`.trim();
  const prodRawTokens = fullProdText.split(" ").filter((t) => t.length >= 2);
  const prodTokens = new Set(prodRawTokens);
  const prodStemTokens = new Set(prodRawTokens.map(lightStemArabic));

  // Direct phrase match in product name/brand/model
  const hasFullPhraseInName = normalizedQuery.length >= 3 && nameNorm.includes(normalizedQuery);

  // Direct token overlap (tokens literally written by the user or their morphological stems)
  let directHits = 0;
  let weightedDirectHits = 0;
  for (const tok of rawQueryTokens) {
    const stem = lightStemArabic(tok);
    const matchedInName = nameNorm.includes(tok) || (stem.length >= 3 && nameNorm.includes(stem));
    const matchedInTags = tagsAndSpecsNorm.includes(tok) || (stem.length >= 3 && tagsAndSpecsNorm.includes(stem));
    const matchedInTokens = prodTokens.has(tok) || (stem.length >= 3 && prodStemTokens.has(stem));

    if (matchedInName || matchedInTags || matchedInTokens) {
      directHits += 1;
      if (matchedInName) weightedDirectHits += 1.25;
      else if (matchedInTags) weightedDirectHits += 1.0;
      else weightedDirectHits += 0.70;
    }
  }

  const directRatio = rawQueryTokens.length > 0
    ? Math.min(1.0, weightedDirectHits / rawQueryTokens.length)
    : 0;

  // Synonym-expanded token overlap (including optical taxonomy & brand transliterations)
  const prodTypeLabel =
    prod.productType === "frame" ? "اطار نظاره طبيه تشمبر شمبر شنبر فريم frame" :
    prod.productType === "sunglass" ? "نظاره شمسيه شمس تشمبر شمبر فريم sunglass uv400" :
    prod.productType === "lens" ? "عدسه عدسات طبيه نظر لنس lens" :
    prod.productType === "contact_lens" ? "عدسه عدسات لاصقه لينسز contact lens" :
    prod.productType === "accessory" ? "اكسسوار محلول جراب فوطه" : "";

  const fullWithTaxonomy = `${fullProdText} ${prodTypeLabel}`;
  let synonymHits = 0;
  for (const expTok of expandedQueryTokens) {
    if (fullWithTaxonomy.includes(expTok)) {
      synonymHits += 1;
    }
  }

  const hasSynonymMatch = synonymHits > 0;
  const synonymRatio = expandedQueryTokens.length > 0
    ? Math.min(1.0, synonymHits / Math.min(expandedQueryTokens.length, Math.max(2, rawQueryTokens.length * 2)))
    : 0;

  // 3. Optical Type Alignment Boost / Penalty
  let categoryBoost = 0;
  let categoryPenalty = 0;
  const pType = prod.productType || "frame";

  if (intentFlags.isContactLensQuery) {
    if (pType === "contact_lens") categoryBoost = 0.30;
    else categoryPenalty = 0.25;
  } else if (intentFlags.isLensQuery) {
    if (pType === "lens" || pType === "contact_lens") categoryBoost = 0.28;
    else categoryPenalty = 0.28;
  } else if (intentFlags.isSolutionQuery) {
    if (pType === "accessory") categoryBoost = 0.30;
    else categoryPenalty = 0.25;
  } else if (intentFlags.isSunglassQuery) {
    if (pType === "sunglass") categoryBoost = 0.30;
    else if (pType === "frame") categoryBoost = 0.12;
    else categoryPenalty = 0.25;
  } else if (intentFlags.isFrameOnlyQuery) {
    if (pType === "frame" || pType === "sunglass") categoryBoost = 0.25;
    else categoryPenalty = 0.30; // Prevent lenses/solutions from matching "تشمبر / فريم / إطار"
  }

  let lexicalScore = 0;
  if (hasFullPhraseInName) {
    lexicalScore = 0.92;
  } else if (directHits > 0) {
    lexicalScore = directRatio * 0.70 + synonymRatio * 0.15 + categoryBoost - categoryPenalty;
  } else if (hasSynonymMatch) {
    lexicalScore = synonymRatio * 0.55 + categoryBoost - categoryPenalty;
  }

  lexicalScore = Math.max(0, Math.min(1.0, lexicalScore));

  return {
    lexicalScore: Number(lexicalScore.toFixed(3)),
    directRatio: Number(directRatio.toFixed(3)),
    synonymRatio: Number(synonymRatio.toFixed(3)),
    directHits,
    synonymHits,
    categoryBoost,
    categoryPenalty,
    isExactCode: false
  };
}

/**
 * Unified Two-Stage Cascading & Hybrid Search Pipeline:
 * - Stage 1: Fast Normalized Arabic/English Lexical + Domain Synonym Search.
 * - Stage 2: Pure 768-d Gemini Vector Semantic Search (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT).
 *   - If Stage 1 returns 0 results (conceptual/descriptive query), Stage 2 Semantic Search rescues the query.
 *   - If Stage 1 returns results and Gemini is available, Stage 2 enriches & ranks them by semantic cosine similarity.
 *   - If Gemini API is unavailable/unconfigured/rate-limited, cleanly falls back to Stage 1 Lexical Search without ever mixing local hash vectors.
 */
async function searchProducts(subdomain, {
  query = "",
  categoryId = null,
  minPrice = null,
  maxPrice = null,
  limit = 20,
  minSimilarity = DEFAULT_SIMILARITY_THRESHOLD,
  lexicalOnly = false,
  adminData = null
}) {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) {
    return {
      done: true,
      engine: "lexical-semantic-cascade",
      searchStrategy: "empty_query",
      query: "",
      products: [],
      total: 0,
      hasExactMatch: true
    };
  }

  const Products = getProductsModel(subdomain);
  let effectiveAdminData = adminData;
  if (!effectiveAdminData || Object.keys(effectiveAdminData).length === 0) {
    try {
      const AdminData = getAdminDataModel(subdomain);
      effectiveAdminData = (await AdminData.findOne().lean()) || {};
    } catch {
      effectiveAdminData = {};
    }
  }

  // Stage 0: Mongo Hard Pre-filtering (Active + Category + Price)
  const filter = { active: true };
  if (categoryId) {
    if (mongoose.isValidObjectId(categoryId)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    } else if (typeof categoryId === "string") {
      const catLower = categoryId.trim().toLowerCase();
      if (/frame|إطار|اطار|شنبر|شمبر|تشمبر|فريم|نظار/i.test(catLower)) {
        filter.productType = { $in: ["frame", "sunglass"] };
      } else if (/contact|لاصق/i.test(catLower)) {
        filter.productType = "contact_lens";
      } else if (/lens|عدس/i.test(catLower)) {
        filter.productType = { $in: ["lens", "contact_lens"] };
      } else if (/sunglass|شمس/i.test(catLower)) {
        filter.productType = "sunglass";
      } else if (/access|محلول|اكسسوار/i.test(catLower)) {
        filter.productType = "accessory";
      }
    }
  }

  const priceFilter = {};
  if (typeof minPrice === "number" && minPrice > 0) priceFilter.$gte = minPrice;
  if (typeof maxPrice === "number" && maxPrice > 0) priceFilter.$lte = maxPrice;
  if (Object.keys(priceFilter).length > 0) {
    filter.price = priceFilter;
  }

  const candidateProducts = await Products.find(filter)
    .populate("categoryId", "name slug")
    .select("_id name sku barcode groupCode price costPrice oldPrice storeStock stockCount images ratingAvg visited salesCount categoryId productType opticsSpecs frameSpecs lensSpecs specs tags description embedding embeddingModel embeddingTextHash scrapRecords")
    .lean();

  if (candidateProducts.length === 0) {
    return {
      done: true,
      engine: "lexical-semantic-cascade",
      searchStrategy: "no_candidates_in_filter",
      query: cleanQuery,
      products: [],
      total: 0,
      hasExactMatch: false,
      suggestDesiredProduct: true,
      message: "لم يتم العثور على منتجات تطابق هذا البحث ضمن الفلاتر المحددة"
    };
  }

  // Normalize & Tokenize Query
  const normalizedQuery = normalizeArabicText(cleanQuery);
  const rawQueryTokens = normalizedQuery
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  if (rawQueryTokens.length === 0 && normalizedQuery.length >= 2) {
    rawQueryTokens.push(normalizedQuery);
  }

  const customSynonyms = effectiveAdminData?.searchSynonyms || [];
  const expandedQueryTokens = expandDomainTokens(rawQueryTokens, customSynonyms);

  // Optical Intent Detection (Lens intent takes precedence if user explicitly says عدسات/لنس/بلوكت/فوتو)
  const hasLensWord = /عدس|عدسات|لنس|lens|بلوكت|فوتو|مضغوط|بروجريسيف|ترانزيشن/i.test(normalizedQuery);
  const hasFrameWord = /تشمبر|شمبر|شنبر|شنابر|اطار|فريم|شاسيه|frame/i.test(normalizedQuery);
  const hasGeneralGlassesWord = /نظاره|نظارات|eyewear|eyeglasses/i.test(normalizedQuery);
  const isContactLensQuery = /لاصق|لاصقه|لينسز|contact/i.test(normalizedQuery);
  const isSolutionQuery = /محلول|تعقيم|renu|رينيو|solution/i.test(normalizedQuery);
  const isSunglassQuery = !hasLensWord && /شمس|شمسيه|sunglass|uv400/i.test(normalizedQuery);

  const intentFlags = {
    isContactLensQuery,
    isLensQuery: hasLensWord && !isContactLensQuery,
    isSolutionQuery,
    isSunglassQuery,
    isFrameOnlyQuery: (hasFrameWord || (hasGeneralGlassesWord && !hasLensWord && !isSunglassQuery)) && !hasLensWord
  };

  // ===========================================================================
  // STAGE 1: LEXICAL + DOMAIN SYNONYM SEARCH (0ms, Deterministic)
  // ===========================================================================
  const lexicalEvaluated = candidateProducts.map((prod) => {
    const lex = computeLexicalMatch(prod, {
      cleanQuery,
      normalizedQuery,
      rawQueryTokens,
      expandedQueryTokens,
      intentFlags
    });
    return { prod, lex };
  });

  // Fast-path: If an exact SKU / Barcode / ModelCode matched, return immediately!
  const exactCodeMatches = lexicalEvaluated.filter((item) => item.lex.isExactCode);
  if (exactCodeMatches.length > 0) {
    const exactResults = exactCodeMatches.map(({ prod, lex }) => ({
      ...prod,
      similarityScore: 1.0,
      lexicalScore: 1.0,
      vectorSimilarity: 1.0,
      tokenOverlap: 1.0,
      categoryBoost: lex.categoryBoost,
      matchSource: "exact_code"
    }));
    return {
      done: true,
      engine: "lexical-exact-code",
      searchStrategy: "exact_code_match",
      query: cleanQuery,
      products: exactResults.slice(0, Number(limit)),
      total: exactResults.length,
      hasExactMatch: true,
      suggestDesiredProduct: false,
      thresholdUsed: minSimilarity,
      message: `تم العثور على ${exactResults.length} منتج بتطابق مباشر للكود`
    };
  }

  const lexicalMatches = lexicalEvaluated.filter((item) => item.lex.lexicalScore >= minSimilarity);

  // If caller explicitly requested lexicalOnly (e.g. standardSearch when AI is disabled), return Stage 1
  if (lexicalOnly) {
    const sortedLexical = lexicalMatches
      .map(({ prod, lex }) => ({
        ...prod,
        similarityScore: lex.lexicalScore,
        lexicalScore: lex.lexicalScore,
        vectorSimilarity: 0,
        tokenOverlap: lex.directRatio || lex.synonymRatio,
        categoryBoost: lex.categoryBoost,
        matchSource: "lexical_only"
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, Number(limit));

    return {
      done: true,
      engine: "lexical-standard",
      searchStrategy: "lexical_only",
      query: cleanQuery,
      products: sortedLexical,
      total: sortedLexical.length,
      hasExactMatch: sortedLexical.length > 0,
      suggestDesiredProduct: sortedLexical.length === 0,
      thresholdUsed: minSimilarity,
      message: sortedLexical.length > 0
        ? `تم العثور على ${sortedLexical.length} منتج يطابق بحثك`
        : "لم نجد منتجات تطابق كلمات البحث مباشرة"
    };
  }

  // ===========================================================================
  // STAGE 2: GEMINI 768-D SEMANTIC VECTOR SEARCH (Fallback & Semantic Rescoring)
  // ===========================================================================
  const queryEmbeddingRes = await generateGeminiEmbeddingStrict(cleanQuery, {
    adminData: effectiveAdminData,
    taskType: "RETRIEVAL_QUERY"
  });

  const queryVec = queryEmbeddingRes.isGemini ? queryEmbeddingRes.vector : null;

  // Fallback Case: Gemini is NOT available -> Return Stage 1 Lexical Search Results cleanly!
  if (!queryVec) {
    const fallbackResults = lexicalMatches
      .map(({ prod, lex }) => ({
        ...prod,
        similarityScore: lex.lexicalScore,
        lexicalScore: lex.lexicalScore,
        vectorSimilarity: 0,
        tokenOverlap: lex.directRatio || lex.synonymRatio,
        categoryBoost: lex.categoryBoost,
        matchSource: "lexical_fallback_no_gemini"
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, Number(limit));

    return {
      done: true,
      engine: "lexical-fallback",
      searchStrategy: "lexical_fallback_gemini_unavailable",
      query: cleanQuery,
      products: fallbackResults,
      total: fallbackResults.length,
      hasExactMatch: fallbackResults.length > 0,
      suggestDesiredProduct: fallbackResults.length === 0,
      thresholdUsed: minSimilarity,
      message: fallbackResults.length > 0
        ? `تم العثور على ${fallbackResults.length} منتج يطابق بحثك`
        : "لم نجد منتجات تطابق طلبك حالياً"
    };
  }

  // Gemini IS available: Compute true 768-d Cosine Similarity against genuine Gemini product embeddings
  const hadLexicalResults = lexicalMatches.length > 0;

  const finalScored = await Promise.all(
    lexicalEvaluated.map(async ({ prod, lex }) => {
      let prodVec = prod.embedding;
      let hasValidGeminiVec = isGeminiEmbeddingVector(prodVec, prod.embeddingModel);

      if (!hasValidGeminiVec) {
        const syncedVec = await syncProductEmbedding(subdomain, prod, {
          adminData: effectiveAdminData,
          categoryName: prod.categoryId?.name || ""
        });
        if (isGeminiEmbeddingVector(syncedVec, prod.embeddingModel)) {
          prodVec = syncedVec;
          hasValidGeminiVec = true;
          Products.updateOne(
            { _id: prod._id },
            {
              $set: {
                embedding: prodVec,
                embeddingModel: prod.embeddingModel,
                embeddingTextHash: prod.embeddingTextHash
              }
            }
          ).catch(() => {});
        }
      }

      const vectorSim = hasValidGeminiVec ? cosineSimilarity(queryVec, prodVec) : 0;

      let combinedScore = 0;
      let matchSource = "none";

      if (lex.lexicalScore >= minSimilarity) {
        // Product matched in Stage 1 (Lexical/Synonym) -> Combine Lexical (45%) + Gemini Vector Similarity (55%)
        combinedScore = Math.min(
          1.0,
          lex.lexicalScore * 0.45 + vectorSim * 0.55
        );
        matchSource = "hybrid_lexical_semantic";
      } else if (!hadLexicalResults || vectorSim >= PURE_SEMANTIC_THRESHOLD) {
        // Stage 1 had 0 lexical matches (or product has a strong conceptual Gemini vector match >= 0.52)
        if (vectorSim >= PURE_SEMANTIC_THRESHOLD) {
          combinedScore = Math.min(
            1.0,
            Math.max(0, vectorSim * 0.85 + lex.categoryBoost * 0.5 - (lex.categoryPenalty || 0) * 0.5)
          );
          matchSource = "gemini_semantic_rescue";
        } else {
          combinedScore = vectorSim * 0.6;
        }
      } else {
        combinedScore = lex.lexicalScore * 0.4 + vectorSim * 0.4;
      }

      return {
        ...prod,
        similarityScore: Number(combinedScore.toFixed(3)),
        lexicalScore: lex.lexicalScore,
        vectorSimilarity: Number(vectorSim.toFixed(3)),
        tokenOverlap: Number((lex.directRatio || lex.synonymRatio).toFixed(3)),
        categoryBoost: lex.categoryBoost,
        matchSource
      };
    })
  );

  finalScored.sort((a, b) => b.similarityScore - a.similarityScore);

  const matchedResults = finalScored
    .filter((p) => p.similarityScore >= minSimilarity)
    .slice(0, Number(limit));

  const hasExactMatch = matchedResults.length > 0;
  const usedStrategy = hadLexicalResults
    ? "lexical_with_gemini_semantic_ranking"
    : "lexical_zero_fallback_to_gemini_semantic";

  return {
    done: true,
    engine: "semantic-unified",
    searchStrategy: usedStrategy,
    embeddingModel: "gemini-embedding-001",
    query: cleanQuery,
    products: matchedResults,
    total: matchedResults.length,
    hasExactMatch,
    suggestDesiredProduct: !hasExactMatch,
    thresholdUsed: minSimilarity,
    message: hasExactMatch
      ? `تم العثور على ${matchedResults.length} منتج يطابق بحثك`
      : "لم نجد منتجات تطابق طلبك بدقة كافية حالياً، يمكنك تسجيل رغبتك لإشعارك فور توفره"
  };
}

module.exports = {
  searchProducts,
  computeLexicalMatch,
  lightStemArabic
};
