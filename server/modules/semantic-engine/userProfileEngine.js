const mongoose = require("mongoose");
const getClientProfileModel = require("../recommendation/clientProfileModel");
const getCategoriesModel = require("../categories/categoryModel");
const getProductsModel = require("../products/productModel");
const { generateEmbedding, isGeminiEmbeddingVector, normalizeVector, cosineSimilarity } = require("./embeddingProvider");
const { buildProductEmbeddingText } = require("./productRepresentation");

const EMA_ALPHA_DEFAULT = 0.35;
const EMA_ALPHA_CART_PURCHASE = 0.55;

/**
 * Exponential Moving Average (EMA) vector accumulation.
 * Strictly requires valid 768-d Gemini vectors so user taste profiles are never polluted by local hash vectors.
 */
function accumulateVectorEMA(currentVec, incomingVec, alpha = EMA_ALPHA_DEFAULT) {
  if (!isGeminiEmbeddingVector(incomingVec)) {
    return isGeminiEmbeddingVector(currentVec) ? currentVec : [];
  }
  if (!isGeminiEmbeddingVector(currentVec)) {
    return normalizeVector(incomingVec);
  }

  const dim = Math.min(currentVec.length, incomingVec.length);
  const combined = new Array(dim);
  for (let i = 0; i < dim; i++) {
    combined[i] = alpha * incomingVec[i] + (1 - alpha) * currentVec[i];
  }
  return normalizeVector(combined);
}

/**
 * Find or create a ClientProfile document by userId or sessionId
 */
async function getOrCreateProfile(subdomain, { userId, sessionId, name, phone, email }) {
  const ClientProfile = getClientProfileModel(subdomain);
  const query = [];
  if (userId && mongoose.isValidObjectId(userId)) {
    query.push({ userId: new mongoose.Types.ObjectId(userId) });
  }
  if (sessionId) {
    query.push({ sessionId: String(sessionId).trim() });
  }
  if (phone) {
    query.push({ phone: String(phone).trim() });
  }

  let profile = null;
  if (query.length > 0) {
    profile = await ClientProfile.findOne({ $or: query });
  }

  if (!profile) {
    profile = new ClientProfile({
      sessionId: sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: userId && mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null,
      name: name || "عميل",
      phone: phone || "",
      email: email || "",
      categoryProfiles: []
    });
  } else {
    if (userId && !profile.userId && mongoose.isValidObjectId(userId)) {
      profile.userId = new mongoose.Types.ObjectId(userId);
    }
    if (phone && !profile.phone) profile.phone = phone;
    if (name && profile.name === "عميل") profile.name = name;
  }

  return profile;
}

/**
 * Ensure category profile entry exists within profile.categoryProfiles
 */
function findOrCreateCategoryProfile(profile, categoryId, categoryName = "") {
  if (!profile.categoryProfiles) {
    profile.categoryProfiles = [];
  }

  const cleanCatId = categoryId ? String(categoryId) : null;
  let entry = profile.categoryProfiles.find(
    (cp) => (cleanCatId && cp.categoryId && String(cp.categoryId) === cleanCatId) ||
            (categoryName && cp.categoryName && cp.categoryName.toLowerCase() === categoryName.toLowerCase())
  );

  if (!entry) {
    entry = {
      categoryId: cleanCatId && mongoose.isValidObjectId(cleanCatId) ? new mongoose.Types.ObjectId(cleanCatId) : null,
      categoryName: categoryName || "",
      vector: [],
      interactionCount: 0,
      priceAffinity: { min: 0, max: 0, avg: 0 },
      preferredSpecs: {},
      topKeywords: [],
      lastInteractedAt: new Date()
    };
    profile.categoryProfiles.push(entry);
    entry = profile.categoryProfiles[profile.categoryProfiles.length - 1];
  } else {
    if (!entry.categoryId && cleanCatId && mongoose.isValidObjectId(cleanCatId)) {
      entry.categoryId = new mongoose.Types.ObjectId(cleanCatId);
    }
    if (!entry.categoryName && categoryName) {
      entry.categoryName = categoryName;
    }
  }

  return entry;
}

/**
 * Update price affinity helper for an entry
 */
function updatePriceAffinity(entry, newPrices = []) {
  const validPrices = newPrices.filter((p) => typeof p === "number" && p > 0);
  if (validPrices.length === 0) return;

  const currentAvg = entry.priceAffinity?.avg || 0;
  const currentCount = entry.interactionCount || 0;
  const newBatchAvg = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;

  const updatedAvg = currentAvg > 0
    ? Math.round((currentAvg * currentCount + newBatchAvg * validPrices.length) / (currentCount + validPrices.length))
    : Math.round(newBatchAvg);

  const allMin = entry.priceAffinity?.min > 0
    ? Math.min(entry.priceAffinity.min, ...validPrices)
    : Math.min(...validPrices);

  const allMax = entry.priceAffinity?.max > 0
    ? Math.max(entry.priceAffinity.max, ...validPrices)
    : Math.max(...validPrices);

  entry.priceAffinity = {
    min: allMin,
    max: allMax,
    avg: updatedAvg
  };
}

/**
 * 1. Record browsed products into Category-Specific Profiles using EMA
 */
async function recordProductViews(subdomain, { userId, sessionId, items = [], adminData = {} }) {
  if (!items || !items.length) return null;

  const profile = await getOrCreateProfile(subdomain, { userId, sessionId });

  // Group items by category
  const byCat = {};
  for (const it of items) {
    if (!it.productId) continue;
    const catId = it.categoryId ? String(it.categoryId) : "uncategorized";
    if (!byCat[catId]) {
      byCat[catId] = {
        categoryId: it.categoryId || null,
        categoryName: it.categoryName || "",
        items: []
      };
    }
    byCat[catId].items.push(it);

    // Track global browsed history
    const prodIdStr = String(it.productId);
    if (!profile.browsedProductIds.some((id) => String(id) === prodIdStr)) {
      if (mongoose.isValidObjectId(it.productId)) {
        profile.browsedProductIds.push(new mongoose.Types.ObjectId(it.productId));
      }
    }

    profile.browsedHistory.push({
      productId: mongoose.isValidObjectId(it.productId) ? new mongoose.Types.ObjectId(it.productId) : null,
      name: it.name,
      categoryId: it.categoryId,
      categoryName: it.categoryName,
      price: it.price,
      tags: it.tags || [],
      specs: it.specs || {},
      visitedAt: new Date()
    });
  }

  if (profile.browsedHistory.length > 60) {
    profile.browsedHistory = profile.browsedHistory.slice(-60);
  }

  // Update category profiles
  for (const catGroup of Object.values(byCat)) {
    const entry = findOrCreateCategoryProfile(profile, catGroup.categoryId, catGroup.categoryName);

    // Update prices
    const prices = catGroup.items.map((i) => Number(i.price)).filter((p) => p > 0);
    updatePriceAffinity(entry, prices);

    // Update specs
    if (!entry.preferredSpecs) entry.preferredSpecs = {};
    catGroup.items.forEach((it) => {
      if (it.specs && typeof it.specs === "object") {
        Object.entries(it.specs).forEach(([k, v]) => {
          if (!entry.preferredSpecs[k]) entry.preferredSpecs[k] = {};
          entry.preferredSpecs[k][v] = (entry.preferredSpecs[k][v] || 0) + 1;
        });
      }
    });

    // Build semantic interaction text
    const textSegments = [
      catGroup.categoryName ? `قسم ${catGroup.categoryName}` : "",
      ...catGroup.items.map((i) => {
        const specSummary = Object.entries(i.specs || {}).map(([k, v]) => `${k} ${v}`).join(" ");
        return `${i.name} ${specSummary} ${(i.tags || []).join(" ")}`;
      })
    ].filter(Boolean);

    const interactionText = textSegments.join(". ");
    const incomingVec = await generateEmbedding(interactionText, {
      adminData,
      extraTags: catGroup.items.flatMap((i) => i.tags || [])
    });

    // Apply EMA accumulation
    const alpha = entry.interactionCount === 0 ? 1.0 : EMA_ALPHA_DEFAULT;
    entry.vector = accumulateVectorEMA(entry.vector, incomingVec, alpha);
    entry.interactionCount += catGroup.items.length;
    entry.lastInteractedAt = new Date();
  }

  // Recalculate top categories
  const catCounts = {};
  profile.categoryProfiles.forEach((cp) => {
    if (cp.categoryName) {
      catCounts[cp.categoryName] = (catCounts[cp.categoryName] || 0) + (cp.interactionCount || 1);
    }
  });
  profile.preferredCategories = Object.entries(catCounts).map(([name, count]) => ({ name, count }));

  profile.enrichmentCount += 1;
  profile.lastEnrichedAt = new Date();
  profile.markModified("categoryProfiles");
  await profile.save();
  return profile;
}

/**
 * 2. Record Search Filter queries into Category-Specific Profile
 */
async function recordSearchFilter(subdomain, {
  userId,
  sessionId,
  categoryId = null,
  categoryName = "",
  specFilters = {},
  minPrice = null,
  maxPrice = null,
  query = "",
  adminData = {}
}) {
  const profile = await getOrCreateProfile(subdomain, { userId, sessionId });

  if (query && query.trim()) {
    profile.searchQueries.push({ query: query.trim(), at: new Date() });
    if (profile.searchQueries.length > 40) {
      profile.searchQueries = profile.searchQueries.slice(-40);
    }
  }

  let resolvedCatName = categoryName;
  if (!resolvedCatName && categoryId && mongoose.isValidObjectId(categoryId)) {
    const Categories = getCategoriesModel(subdomain);
    const catDoc = await Categories.findById(categoryId).select("name").lean();
    if (catDoc) resolvedCatName = catDoc.name;
  }

  const entry = findOrCreateCategoryProfile(profile, categoryId, resolvedCatName);

  // Price hints
  const prices = [];
  if (typeof minPrice === "number" && minPrice > 0) prices.push(minPrice);
  if (typeof maxPrice === "number" && maxPrice > 0) prices.push(maxPrice);
  if (prices.length > 0) {
    updatePriceAffinity(entry, prices);
  }

  // Spec filters
  if (specFilters && typeof specFilters === "object") {
    if (!entry.preferredSpecs) entry.preferredSpecs = {};
    Object.entries(specFilters).forEach(([k, v]) => {
      if (!v) return;
      if (!entry.preferredSpecs[k]) entry.preferredSpecs[k] = {};
      entry.preferredSpecs[k][String(v)] = (entry.preferredSpecs[k][String(v)] || 0) + 1;
    });
  }

  // Semantic interaction text from search & filter
  const filterSummary = Object.entries(specFilters || {}).map(([k, v]) => `${k}: ${v}`).join("، ");
  const searchSemanticText = [
    resolvedCatName ? `بحث وفلترة في قسم ${resolvedCatName}` : "بحث في المتجر",
    query ? `كلمة البحث: ${query}` : "",
    filterSummary ? `المواصفات المطلوبة: ${filterSummary}` : "",
    minPrice || maxPrice ? `ميزانية السعر: من ${minPrice || 0} إلى ${maxPrice || "غير محدد"}` : ""
  ].filter(Boolean).join(". ");

  const incomingVec = await generateEmbedding(searchSemanticText, { adminData });
  const alpha = entry.interactionCount === 0 ? 1.0 : EMA_ALPHA_DEFAULT;
  entry.vector = accumulateVectorEMA(entry.vector, incomingVec, alpha);
  entry.interactionCount += 1;
  entry.lastInteractedAt = new Date();

  profile.enrichmentCount += 1;
  profile.lastEnrichedAt = new Date();
  profile.markModified("categoryProfiles");
  await profile.save();
  return profile;
}

/**
 * 3. Ingest AI Chat Extractions directly into Category-Specific Profile
 */
async function recordChatInterest(subdomain, {
  userId,
  sessionId,
  categoryId = null,
  categoryName = "",
  specFilters = {},
  minPrice = null,
  maxPrice = null,
  searchKeywords = "",
  userMessage = "",
  adminData = {}
}) {
  return recordSearchFilter(subdomain, {
    userId,
    sessionId,
    categoryId,
    categoryName,
    specFilters,
    minPrice,
    maxPrice,
    query: searchKeywords || userMessage,
    adminData
  });
}

/**
 * 4. Record Cart or Purchase (Strongest intent, higher alpha)
 */
async function recordCartOrPurchase(subdomain, {
  userId,
  sessionId,
  productId,
  categoryId = null,
  adminData = {}
}) {
  if (!productId) return null;
  const Products = getProductsModel(subdomain);
  const prod = await Products.findById(productId).populate("categoryId").lean();
  if (!prod) return null;

  const profile = await getOrCreateProfile(subdomain, { userId, sessionId });
  const resolvedCatId = categoryId || prod.categoryId?._id;
  const resolvedCatName = prod.categoryId?.name || "";

  const entry = findOrCreateCategoryProfile(profile, resolvedCatId, resolvedCatName);

  if (prod.price) {
    updatePriceAffinity(entry, [prod.price]);
  }

  let prodVec = prod.embedding;
  if (!prodVec || prodVec.length === 0) {
    const text = buildProductEmbeddingText(prod, resolvedCatName);
    prodVec = await generateEmbedding(text, { adminData, extraTags: prod.tags || [] });
  }

  // Strong reinforcement with EMA_ALPHA_CART_PURCHASE
  entry.vector = accumulateVectorEMA(entry.vector, prodVec, EMA_ALPHA_CART_PURCHASE);
  entry.interactionCount += 2;
  entry.lastInteractedAt = new Date();

  profile.enrichmentCount += 1;
  profile.lastEnrichedAt = new Date();
  profile.markModified("categoryProfiles");
  await profile.save();
  return profile;
}

module.exports = {
  getOrCreateProfile,
  accumulateVectorEMA,
  recordProductViews,
  recordSearchFilter,
  recordChatInterest,
  recordCartOrPurchase
};
