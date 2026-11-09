const getCategoriesModel = require("../categories/categoryModel");
const getProductsModel = require("../products/productModel");

/**
 * Fetches category specification schema, child/parent specifications,
 * and historical product facet values from MongoDB for filter-ready schema mapping.
 */
async function getCategorySpecsContext(subdomain, categoryId) {
  const Categories = getCategoriesModel(subdomain);
  const Products = getProductsModel(subdomain);

  const categoryObj = await Categories.findById(categoryId).lean();
  if (!categoryObj) {
    throw new Error("القسم المحدد غير موجود في قاعدة البيانات");
  }

  // Merge parent or child specs if present, keeping categoryObj.specs primary
  const catSpecsMap = {};
  if (categoryObj.parentId) {
    const parentCat = await Categories.findById(categoryObj.parentId).lean();
    if (parentCat?.specs && typeof parentCat.specs === "object") {
      Object.assign(catSpecsMap, parentCat.specs);
    }
  }
  const childCategories = await Categories.find({ parentId: categoryId, active: true }).lean();
  childCategories.forEach((child) => {
    if (child.specs && typeof child.specs === "object") {
      Object.assign(catSpecsMap, child.specs);
    }
  });
  if (categoryObj.specs && typeof categoryObj.specs === "object") {
    Object.assign(catSpecsMap, categoryObj.specs);
  }

  // Query existing products in this category to collect real filter values per specKey
  const catIds = [categoryObj._id, ...childCategories.map((c) => c._id)];
  const sampleProducts = await Products.find({ categoryId: { $in: catIds } })
    .select("specs tags")
    .limit(120)
    .lean();

  const specValueCounts = {};
  const tagCounts = {};

  sampleProducts.forEach((p) => {
    (p.tags || []).forEach((t) => {
      if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
    Object.entries(p.specs || {}).forEach(([k, v]) => {
      if (!v) return;
      const cleanVal = String(v).trim();
      if (!cleanVal) return;
      if (!specValueCounts[k]) specValueCounts[k] = {};
      specValueCounts[k][cleanVal] = (specValueCounts[k][cleanVal] || 0) + 1;
      // If product has a spec key not yet in catSpecsMap, include it
      if (!catSpecsMap[k]) {
        catSpecsMap[k] = k;
      }
    });
  });

  const specsMetaList = Object.entries(catSpecsMap).map(([specKey, specLabel]) => {
    const valCounts = specValueCounts[specKey] || {};
    const existingValues = Object.entries(valCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([value, count]) => ({ value, count }));

    return {
      specKey,
      specLabel: String(specLabel || specKey),
      existingValues
    };
  });

  const categoryTags = Array.from(
    new Set([
      ...(categoryObj.tags || []),
      ...childCategories.flatMap((c) => c.tags || []),
      ...Object.keys(tagCounts).slice(0, 15)
    ])
  ).filter(Boolean);

  return {
    category: categoryObj,
    catSpecsMap,
    specsMetaList,
    categoryTags
  };
}

module.exports = {
  getCategorySpecsContext
};
