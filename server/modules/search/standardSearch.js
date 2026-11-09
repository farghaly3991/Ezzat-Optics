const { searchProducts } = require("../semantic-engine");

exports.searchProducts = async (req, res, next) => {
  try {
    const query = (req.query.query || req.query.q || "").trim();
    const { categoryId, minPrice, maxPrice, limit = 20, minSimilarity } = req.query;

    if (!query) {
      return res.json({ done: true, engine: "standard-lexical", products: [], total: 0 });
    }

    const result = await searchProducts(req.subdomain, {
      query,
      categoryId,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      limit: Number(limit),
      minSimilarity: minSimilarity ? Number(minSimilarity) : undefined,
      lexicalOnly: true,
      adminData: req.adminData || {}
    });

    res.json({
      ...result,
      engine: "standard-lexical"
    });
  } catch (err) {
    next(err);
  }
};
