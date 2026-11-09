const getClientProfileModel = require("./clientProfileModel");
const getProductsModel = require("../products/productModel");

exports.enrichProfile = async (req, res, next) => {
  try {
    const { sessionId, items = [] } = req.body;
    const userId = req.user ? req.user._id : null;
    if (!sessionId && !userId) {
      return res.status(400).json({ error: "sessionId or userId is required" });
    }

    const ClientProfile = getClientProfileModel(req.subdomain);
    let profile = await ClientProfile.findOne(userId ? { userId } : { sessionId });

    if (!profile) {
      profile = new ClientProfile({
        sessionId: sessionId || `session_${Date.now()}`,
        userId,
        name: req.user?.fullname || "عميل مجهول",
        phone: req.user?.phone || "",
        email: req.user?.email || ""
      });
    }

    // 1. Record items
    items.forEach((it) => {
      if (it.productId && !profile.browsedProductIds.some((id) => id.toString() === it.productId.toString())) {
        profile.browsedProductIds.push(it.productId);
      }
      profile.browsedHistory.push({
        productId: it.productId,
        name: it.name,
        categoryId: it.categoryId,
        categoryName: it.categoryName,
        price: it.price,
        tags: it.tags || [],
        specs: it.specs || {},
        visitedAt: new Date()
      });
    });

    if (profile.browsedHistory.length > 50) {
      profile.browsedHistory = profile.browsedHistory.slice(-50);
    }

    // 2. Statistical calculation
    const catMap = {};
    const tagMap = {};
    const prices = [];
    const specMap = profile.preferredSpecs || {};

    profile.browsedHistory.forEach((h) => {
      if (h.categoryName) catMap[h.categoryName] = (catMap[h.categoryName] || 0) + 1;
      (h.tags || []).forEach((t) => {
        tagMap[t] = (tagMap[t] || 0) + 1;
      });
      if (h.price && Number(h.price) > 0) prices.push(Number(h.price));
      if (h.specs && typeof h.specs === "object") {
        Object.entries(h.specs).forEach(([k, v]) => {
          if (!specMap[k]) specMap[k] = {};
          specMap[k][v] = (specMap[k][v] || 0) + 1;
        });
      }
    });

    profile.preferredCategories = Object.entries(catMap).map(([name, count]) => ({ name, count }));
    profile.preferredTags = Object.entries(tagMap).map(([tag, count]) => ({ tag, count }));
    profile.preferredSpecs = specMap;

    if (prices.length > 0) {
      profile.priceAffinity = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      };
    }

    // Deterministic persona synthesis
    const topCat = profile.preferredCategories.sort((a, b) => b.count - a.count)[0]?.name || "المنتجات العامة";
    profile.buyerPersona = `مهتم بقسم ${topCat}`;
    profile.interestSummary = `تفضيل مستمر لمنتجات ${topCat} بمتوسط سعري ${profile.priceAffinity.avg} ج.م`;

    profile.enrichmentCount += 1;
    profile.lastEnrichedAt = new Date();
    await profile.save();

    res.json({
      done: true,
      engine: "standard-analytics",
      message: "تم تحديث تفضيلات العميل إحصائياً بنجاح",
      profile: {
        buyerPersona: profile.buyerPersona,
        interestSummary: profile.interestSummary,
        preferredCategories: profile.preferredCategories,
        priceAffinity: profile.priceAffinity
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const { sessionId, limit = 8 } = req.query;
    const userId = req.user ? req.user._id : null;

    const ClientProfile = getClientProfileModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);

    const profile = await ClientProfile.findOne(userId ? { userId } : { sessionId }).lean();

    if (!profile || !profile.browsedProductIds || profile.browsedProductIds.length === 0) {
      const fallback = await Products.find({ active: true })
        .populate("categoryId")
        .sort({ visited: -1, salesCount: -1 })
        .limit(Number(limit))
        .lean();
      return res.json({ done: true, engine: "standard-coldstart", products: fallback });
    }

    const browsedIds = (profile.browsedProductIds || []).map((id) => id.toString());
    const candidateProducts = await Products.find({
      active: true,
      _id: { $nin: browsedIds }
    })
      .populate("categoryId")
      .lean();

    const topCategories = (profile.preferredCategories || []).map((c) => c.name.toLowerCase());
    const topTags = (profile.preferredTags || []).map((t) => t.tag.toLowerCase());

    const scored = candidateProducts.map((p) => {
      let score = 0;
      const catName = (p.categoryId?.name || "").toLowerCase();
      if (topCategories.includes(catName)) score += 50;

      const pTags = (p.tags || []).map((t) => t.toLowerCase());
      const tagMatches = pTags.filter((t) => topTags.includes(t)).length;
      score += tagMatches * 15;

      if (profile.priceAffinity && profile.priceAffinity.avg > 0 && p.price) {
        const diff = Math.abs(p.price - profile.priceAffinity.avg) / profile.priceAffinity.avg;
        if (diff < 0.25) score += 20;
      }

      return {
        ...p,
        recommendationScore: score,
        recommendationReason: `منتج مقترح بناءً على تصفحك لقسم ${p.categoryId?.name || "المتجر"}`
      };
    });

    scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
    const recommended = scored.slice(0, Number(limit));

    res.json({
      done: true,
      engine: "standard-frequency",
      persona: profile.buyerPersona,
      interestSummary: profile.interestSummary,
      products: recommended
    });
  } catch (err) {
    next(err);
  }
};

exports.recordFilter = async (req, res, next) => {
  try {
    const { sessionId, query } = req.body;
    const userId = req.user ? req.user._id : null;
    const ClientProfile = getClientProfileModel(req.subdomain);
    let profile = await ClientProfile.findOne(userId ? { userId } : { sessionId });
    if (profile && query) {
      profile.searchQueries.push({ query: String(query).trim(), at: new Date() });
      await profile.save();
    }
    res.json({ done: true, engine: "standard", message: "تم تسجيل الفلتر" });
  } catch (err) {
    next(err);
  }
};

