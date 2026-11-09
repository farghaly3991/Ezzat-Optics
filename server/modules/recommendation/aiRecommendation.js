const {
  recordProductViews,
  getPersonalizedRecommendations
} = require("../semantic-engine");

exports.enrichProfile = async (req, res, next) => {
  try {
    const { sessionId, items = [] } = req.body;
    const userId = req.user ? req.user._id : null;
    if (!sessionId && !userId) {
      return res.status(400).json({ error: "sessionId or userId is required" });
    }

    const profile = await recordProductViews(req.subdomain, {
      userId,
      sessionId,
      items,
      adminData: req.adminData || {}
    });

    res.json({
      done: true,
      engine: "semantic-unified",
      message: "تم تحديث بروفايل الاهتمامات الدلالي لكل قسم بنجاح",
      profile: {
        buyerPersona: profile?.buyerPersona,
        interestSummary: profile?.interestSummary,
        preferredCategories: profile?.preferredCategories,
        priceAffinity: profile?.priceAffinity,
        categoryProfiles: profile?.categoryProfiles?.map((cp) => ({
          categoryId: cp.categoryId,
          categoryName: cp.categoryName,
          interactionCount: cp.interactionCount,
          priceAffinity: cp.priceAffinity,
          lastInteractedAt: cp.lastInteractedAt
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const { sessionId, categoryId, limit = 8 } = req.query;
    const userId = req.user ? req.user._id : null;

    const result = await getPersonalizedRecommendations(req.subdomain, {
      userId,
      sessionId,
      categoryId,
      limit: Number(limit),
      adminData: req.adminData || {}
    });

    res.json({
      done: true,
      engine: result.engine,
      products: result.recommendations,
      sections: result.sections
    });
  } catch (err) {
    next(err);
  }
};

exports.recordFilter = async (req, res, next) => {
  try {
    const { sessionId, categoryId, categoryName, specFilters, minPrice, maxPrice, query } = req.body;
    const userId = req.user ? req.user._id : null;
    if (!sessionId && !userId) {
      return res.status(400).json({ error: "sessionId or userId is required" });
    }

    const { recordSearchFilter } = require("../semantic-engine");
    await recordSearchFilter(req.subdomain, {
      userId,
      sessionId,
      categoryId,
      categoryName,
      specFilters,
      minPrice,
      maxPrice,
      query,
      adminData: req.adminData || {}
    });

    res.json({
      done: true,
      engine: "semantic-unified",
      message: "تم تحديث اهتمامات البحث والفلاتر بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

