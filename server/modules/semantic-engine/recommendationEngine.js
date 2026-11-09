const mongoose = require("mongoose");
const getClientProfileModel = require("../recommendation/clientProfileModel");
const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");
const { cosineSimilarity, generateEmbedding, isGeminiEmbeddingVector } = require("./embeddingProvider");
const { buildProductEmbeddingText, syncProductEmbedding } = require("./productRepresentation");

/**
 * Two-stage Lean Recommendation Pipeline
 */
async function getPersonalizedRecommendations(subdomain, {
  userId = null,
  sessionId = null,
  categoryId = null,
  limit = 8,
  adminData = {}
}) {
  const ClientProfile = getClientProfileModel(subdomain);
  const Products = getProductsModel(subdomain);

  const query = [];
  if (userId && mongoose.isValidObjectId(userId)) {
    query.push({ userId: new mongoose.Types.ObjectId(userId) });
  }
  if (sessionId) {
    query.push({ sessionId: String(sessionId).trim() });
  }

  let profile = null;
  if (query.length > 0) {
    profile = await ClientProfile.findOne({ $or: query }).lean();
  }

  // 1. Cold start fallback if user has no profile or no category interactions
  const hasHistory = profile && (
    (profile.browsedProductIds && profile.browsedProductIds.length > 0) ||
    (profile.categoryProfiles && profile.categoryProfiles.length > 0)
  );

  if (!hasHistory) {
    const fallbackFilter = { active: true };
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      fallbackFilter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const fallbackProducts = await Products.find(fallbackFilter)
      .populate("categoryId", "name slug")
      .sort({ visited: -1, ratingAvg: -1, salesCount: -1 })
      .limit(Number(limit))
      .lean();

    return {
      done: true,
      engine: "semantic-coldstart",
      recommendations: fallbackProducts.map((p) => ({
        ...p,
        recommendationScore: 100,
        recommendationReason: "الأكثر رواجاً وتقييماً في المتجر"
      })),
      sections: []
    };
  }

  const browsedIds = (profile.browsedProductIds || []).map((id) => String(id));
  const categoryProfiles = profile.categoryProfiles || [];

  // Determine target categories
  let targetProfiles = [];
  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    const cleanId = String(categoryId);
    const found = categoryProfiles.find((cp) => cp.categoryId && String(cp.categoryId) === cleanId);
    if (found) {
      targetProfiles = [found];
    } else {
      // User is exploring a category they haven't interacted with yet
      targetProfiles = [{
        categoryId: new mongoose.Types.ObjectId(categoryId),
        categoryName: "",
        vector: [],
        priceAffinity: { min: 0, max: 0, avg: 0 }
      }];
    }
  } else {
    // Sort user's category profiles by recency & interaction count
    targetProfiles = [...categoryProfiles]
      .filter((cp) => cp.categoryId && cp.interactionCount > 0)
      .sort((a, b) => new Date(b.lastInteractedAt || 0) - new Date(a.lastInteractedAt || 0))
      .slice(0, 3);
  }

  if (targetProfiles.length === 0) {
    const fallbackProducts = await Products.find({ active: true, _id: { $nin: browsedIds } })
      .populate("categoryId", "name slug")
      .sort({ visited: -1, ratingAvg: -1 })
      .limit(Number(limit))
      .lean();

    return {
      done: true,
      engine: "semantic-coldstart-unseen",
      recommendations: fallbackProducts,
      sections: []
    };
  }

  // Stage 1: Mongo Lean Query (Only active products in target categories, not yet browsed)
  const targetCatIds = targetProfiles.map((tp) => tp.categoryId).filter(Boolean);
  let candidateProducts = await Products.find({
    active: true,
    categoryId: { $in: targetCatIds },
    _id: { $nin: browsedIds }
  })
    .populate("categoryId", "name slug")
    .select("_id name price oldPrice images ratingAvg visited salesCount categoryId specs tags embedding")
    .lean();

  if (candidateProducts.length === 0) {
    // If all products in target category were browsed, recommend top products within their target category anyway!
    candidateProducts = await Products.find({
      active: true,
      categoryId: { $in: targetCatIds }
    })
      .populate("categoryId", "name slug")
      .select("_id name price oldPrice images ratingAvg visited salesCount categoryId specs tags embedding")
      .lean();
  }

  if (candidateProducts.length === 0) {
    // If category has no active products at all, fallback to overall top-rated
    const fallbackProducts = await Products.find({ active: true, _id: { $nin: browsedIds } })
      .populate("categoryId", "name slug")
      .sort({ ratingAvg: -1, salesCount: -1 })
      .limit(Number(limit))
      .lean();

    return {
      done: true,
      engine: "semantic-fallback-exhausted",
      recommendations: fallbackProducts,
      sections: []
    };
  }

  // Stage 2: In-Memory Multi-Factor Rescoring per Category
  const scoredProducts = await Promise.all(
    candidateProducts.map(async (prod) => {
      const prodCatId = String(prod.categoryId?._id || prod.categoryId || "");
      const matchedProfile = targetProfiles.find((tp) => String(tp.categoryId) === prodCatId) || targetProfiles[0];

      let score = 0;
      let reasons = [];

      // 1. Vector Cosine Similarity (Up to 50 points - strictly 768-d Gemini vectors)
      const userVec = matchedProfile?.vector;
      let prodVec = prod.embedding;

      if (!isGeminiEmbeddingVector(prodVec, prod.embeddingModel)) {
        prodVec = await syncProductEmbedding(subdomain, prod, {
          adminData,
          categoryName: prod.categoryId?.name || ""
        });
      }

      if (isGeminiEmbeddingVector(userVec) && isGeminiEmbeddingVector(prodVec, prod.embeddingModel)) {
        const sim = cosineSimilarity(userVec, prodVec);
        score += sim * 50;
        if (sim >= 0.70) {
          reasons.push("تطابق دلالي وثيق مع متطلباتك");
        }
      } else {
        score += 25; // Neutral base if user or product has no Gemini vector yet
      }

      // 2. Category-Specific Price Affinity (Up to 25 points)
      const catPriceAvg = matchedProfile?.priceAffinity?.avg || 0;
      if (catPriceAvg > 0 && prod.price > 0) {
        const diffRatio = Math.abs(prod.price - catPriceAvg) / catPriceAvg;
        if (diffRatio <= 0.25) {
          score += 25;
          reasons.push("ضمن نطاق السعر المفضل لك في هذا القسم");
        } else if (diffRatio <= 0.50) {
          score += 15;
        } else {
          score += 5;
        }
      } else {
        score += 15;
      }

      // 3. Spec & Tag Overlap (Up to 25 points)
      let specTagPoints = 0;
      const prefSpecs = matchedProfile?.preferredSpecs || {};
      if (prod.specs && typeof prod.specs === "object") {
        Object.entries(prod.specs).forEach(([k, v]) => {
          if (prefSpecs[k] && prefSpecs[k][String(v)]) {
            specTagPoints += 6;
          }
        });
      }

      if (Array.isArray(prod.tags)) {
        const topKeywords = matchedProfile?.topKeywords || [];
        prod.tags.forEach((t) => {
          if (topKeywords.includes(t)) specTagPoints += 5;
        });
      }

      score += Math.min(25, specTagPoints);

      const categoryName = prod.categoryId?.name || matchedProfile?.categoryName || "القسم";
      const primaryReason = reasons.length > 0
        ? reasons.join(" و ")
        : `مرشح خصيصاً لك في قسم ${categoryName}`;

      return {
        ...prod,
        recommendationScore: Math.round(score),
        recommendationReason: primaryReason
      };
    })
  );

  scoredProducts.sort((a, b) => b.recommendationScore - a.recommendationScore);
  const topRecommendations = scoredProducts.slice(0, Number(limit));

  // Build category sections
  const sectionMap = {};
  scoredProducts.forEach((p) => {
    const catId = String(p.categoryId?._id || "general");
    const catName = p.categoryId?.name || "مقترحات مميزة";
    if (!sectionMap[catId]) {
      sectionMap[catId] = {
        categoryId: catId,
        categoryName: catName,
        products: []
      };
    }
    if (sectionMap[catId].products.length < 4) {
      sectionMap[catId].products.push(p);
    }
  });

  return {
    done: true,
    engine: "semantic-unified-engine",
    recommendations: topRecommendations,
    sections: Object.values(sectionMap).filter((s) => s.products.length > 0)
  };
}

module.exports = {
  getPersonalizedRecommendations
};
