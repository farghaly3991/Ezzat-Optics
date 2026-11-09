const mongoose = require("mongoose");
const getCategoriesModel = require("../categories/categoryModel");
const getProductsModel = require("../products/productModel");
const getOffersModel = require("../offers/offerModel");
const getReviewsModel = require("../products/reviewModel");
const getActivityModel = require("../activity/activityModel");
const getBranchesModel = require("../branches/branchModel");
const getSupplierModel = require("../finance/procurement/supplierModel");
const { recordActivity, extractActorContext } = require("../activity/activityService");

/**
 * Intelligent variant grouping and enrichment helper.
 * If multiple products share the same groupCode, collapses them into a single storefront card
 * annotated with hasVariants: true, variantCount, minPrice, maxPrice, and variantImages.
 */
async function enrichAndCollapseVariants(Products, productList, shouldCollapse = true) {
  if (!Array.isArray(productList) || productList.length === 0) return [];

  const groupCodes = Array.from(
    new Set(productList.map((p) => String(p.groupCode || "").trim()).filter(Boolean))
  );
  if (groupCodes.length === 0) return productList;

  const allSiblings = await Products.find({
    groupCode: { $in: groupCodes },
    active: true
  })
    .select("_id name price oldPrice images specs groupCode stockCount")
    .lean();

  const groupMap = new Map();
  allSiblings.forEach((sib) => {
    const gc = sib.groupCode;
    if (!groupMap.has(gc)) groupMap.set(gc, []);
    groupMap.get(gc).push(sib);
  });

  const seenGroupCodes = new Set();
  const result = [];

  for (const prod of productList) {
    const gc = String(prod.groupCode || "").trim();
    if (gc && groupMap.has(gc)) {
      const siblings = groupMap.get(gc);
      if (siblings.length > 1) {
        if (shouldCollapse) {
          if (seenGroupCodes.has(gc)) {
            continue;
          }
          seenGroupCodes.add(gc);
        }

        const prices = siblings.map((s) => Number(s.price || 0));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const totalStock = siblings.reduce((sum, s) => sum + Number(s.stockCount || 0), 0);
        const allImages = Array.from(
          new Set(siblings.flatMap((s) => (Array.isArray(s.images) ? s.images : [])))
        ).filter(Boolean);

        result.push({
          ...prod,
          hasVariants: true,
          variantCount: siblings.length,
          minPrice,
          maxPrice,
          totalVariantStock: totalStock,
          variantImages: allImages.length > 0 ? allImages : prod.images
        });
        continue;
      }
    }
    result.push(prod);
  }

  return result;
}

// 1. بيانات الصفحة الرئيسية الشاملة
exports.getHomeSections = async (req, res, next) => {
  try {
    const Categories = getCategoriesModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);
    const Offers = getOffersModel(req.subdomain);

    const now = new Date();

    // الفئات النشطة مع عدد منتجاتها (بما في ذلك الفئات الفرعية التابعة)
    const categories = await Categories.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
    const counts = await Products.aggregate([
      { $match: { active: true } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[String(c._id)] = c.count;
    });

    const childMap = {};
    categories.forEach((cat) => {
      if (cat.parentId) {
        const pId = String(cat.parentId);
        if (!childMap[pId]) childMap[pId] = [];
        childMap[pId].push(String(cat._id));
      }
    });

    const categoriesWithCount = categories.map((cat) => {
      const catIdStr = String(cat._id);
      let totalProdCount = countMap[catIdStr] || 0;
      if (childMap[catIdStr]) {
        childMap[catIdStr].forEach((childId) => {
          totalProdCount += countMap[childId] || 0;
        });
      }
      return {
        ...cat,
        productsCount: totalProdCount
      };
    });

    // الخدمات والأنشطة المعتمدة (Services)
    const serviceCategories = categoriesWithCount.filter((c) => c.type === "service");
    const serviceCategoryIds = serviceCategories.map((c) => c._id);
    let featuredServices = [];
    if (serviceCategoryIds.length > 0) {
      featuredServices = await Products.find({
        active: true,
        categoryId: { $in: serviceCategoryIds }
      })
        .populate("categoryId")
        .sort({ salesCount: -1, createdAt: -1 })
        .limit(6)
        .lean();
    }

    // العروض الترويجية النشطة
    const activeOffers = await Offers.find({ active: true, endDate: { $gte: now } })
      .populate("productIds")
      .sort({ createdAt: -1 })
      .lean();

    // المنتجات الأكثر مبيعاً
    const bestSellers = await Products.find({ active: true })
      .populate("categoryId")
      .sort({ salesCount: -1, visited: -1 })
      .limit(8)
      .lean();

    // أقوى العروض والتخفيضات (النسبة الأكبر أو وجود oldPrice)
    const allProductsWithDeals = await Products.find({ active: true, oldPrice: { $gt: 0 } })
      .populate("categoryId")
      .lean();
    const topDeals = allProductsWithDeals
      .map((p) => {
        const discountPct = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
        return { ...p, discountPct };
      })
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, 8);

    // الأكثر مشاهدة
    const mostVisited = await Products.find({ active: true })
      .populate("categoryId")
      .sort({ visited: -1 })
      .limit(8)
      .lean();

    // أحدث المنتجات
    const latest = await Products.find({ active: true })
      .populate("categoryId")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    // Smart Specs: تجميع المواصفات الشائعة التي عليها منتجات كثيرة
    const allActive = await Products.find({ active: true }).select("specs").lean();
    const specCounter = {};
    allActive.forEach((p) => {
      Object.entries(p.specs || {}).forEach(([specKey, specVal]) => {
        if (!specVal) return;
        if (!specCounter[specKey]) specCounter[specKey] = {};
        specCounter[specKey][specVal] = (specCounter[specKey][specVal] || 0) + 1;
      });
    });

    const smartSpecs = Object.entries(specCounter).map(([key, valCounts]) => {
      const topValues = Object.entries(valCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const totalCount = Object.values(valCounts).reduce((a, b) => a + b, 0);
      return { specKey: key, totalCount, topValues };
    }).sort((a, b) => b.totalCount - a.totalCount).slice(0, 6);

    const [bestSellersC, topDealsC, mostVisitedC, latestC, featuredServicesC] = await Promise.all([
      enrichAndCollapseVariants(Products, bestSellers, true),
      enrichAndCollapseVariants(Products, topDeals, true),
      enrichAndCollapseVariants(Products, mostVisited, true),
      enrichAndCollapseVariants(Products, latest, true),
      enrichAndCollapseVariants(Products, featuredServices, true)
    ]);

    res.json({
      done: true,
      categories: categoriesWithCount,
      serviceCategories,
      featuredServices: featuredServicesC,
      activeOffers,
      bestSellers: bestSellersC,
      topDeals: topDealsC,
      mostVisited: mostVisitedC,
      latest: latestC,
      smartSpecs
    });
  } catch (err) {
    next(err);
  }
};

exports.getPublicCategories = async (req, res, next) => {
  try {
    const Categories = getCategoriesModel(req.subdomain);
    const categories = await Categories.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ done: true, categories });
  } catch (err) {
    next(err);
  }
};

// 2. فلترة وبحث الكتالوج مع الفيسيتس (Facets) والترقيم الخادمي الحقيقي (Server Pagination)
exports.filterProducts = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const Categories = getCategoriesModel(req.subdomain);
    getBranchesModel(req.subdomain);
    getSupplierModel(req.subdomain);

    const {
      ids,
      categoryId,
      search = "",
      groupCode = "",
      tags = [],
      specFilters = [],
      minPrice,
      maxPrice,
      stockFilter,
      includeInactive = false,
      sortBy = "latest",
      page = 1,
      pageSize = 20
    } = req.body || {};

    const query = {};
    if (!includeInactive) {
      query.active = true;
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
      if (validIds.length > 0) {
        query._id = { $in: validIds };
      }
    }

    // Branch scoping (from req.body.branchId, query, x-branch-id, or req.branchFilter)
    const effectiveBranchId =
      req.body.branchId ||
      req.query?.branchId ||
      req.headers?.["x-branch-id"] ||
      (req.branchFilter && req.branchFilter.branchId) ||
      (req.isBranchAdmin && req.user?.branchId);

    if (effectiveBranchId && effectiveBranchId !== "all") {
      query.branchId = effectiveBranchId;
    }

    let categoryObj = null;
    let categoryChildren = [];
    if (categoryId) {
      categoryObj = await Categories.findById(categoryId).lean();
      const childQuery = { parentId: categoryId };
      if (!includeInactive) childQuery.active = true;
      categoryChildren = await Categories.find(childQuery).lean();
      if (categoryChildren.length > 0) {
        query.categoryId = { $in: [categoryId, ...categoryChildren.map((c) => c._id)] };
      } else {
        query.categoryId = categoryId;
      }
    }

    if (search && search.trim()) {
      const rx = { $regex: search.trim(), $options: "i" };
      query.$or = [{ name: rx }, { groupCode: rx }];
    }
    if (stockFilter === "critical") {
      query.stockCount = { $lte: 3, $gt: 0 };
    } else if (stockFilter === "low") {
      query.stockCount = { $lte: 5, $gt: 0 };
    } else if (stockFilter === "out") {
      query.stockCount = { $lte: 0 };
    } else if (stockFilter === "in_stock") {
      query.stockCount = { $gt: 0 };
    }

    if (req.body.supplierId) {
      query.supplierId = req.body.supplierId;
    } else if (req.body.supplierStatus === "has_supplier") {
      query.supplierId = { $exists: true, $ne: null };
    } else if (req.body.supplierStatus === "no_supplier") {
      query.$or = [{ supplierId: null }, { supplierId: { $exists: false } }];
    }

    // Filter by linked / suggested items cross-sell existence
    if (req.body.hasLinkedItems === true || req.body.linkedStatus === "has_linked") {
      query["linkedItemIds.0"] = { $exists: true };
    } else if (req.body.hasLinkedItems === false || req.body.linkedStatus === "no_linked") {
      query.$or = [{ linkedItemIds: { $size: 0 } }, { linkedItemIds: { $exists: false } }];
    }

    // Filter by Category Type ('service' vs 'product')
    const categoryType = req.body.categoryType;
    if (categoryType && (categoryType === "service" || categoryType === "product")) {
      const typeCats = await Categories.find({
        type: categoryType,
        ...(includeInactive ? {} : { active: true })
      }).select("_id").lean();
      const typeCatIds = typeCats.map((c) => c._id);
      if (query.categoryId) {
        if (query.categoryId.$in) {
          query.categoryId.$in = query.categoryId.$in.filter((id) =>
            typeCatIds.some((tid) => String(tid) === String(id))
          );
        } else {
          const match = typeCatIds.some((tid) => String(tid) === String(query.categoryId));
          query.categoryId = match ? query.categoryId : { $in: [] };
        }
      } else {
        query.categoryId = { $in: typeCatIds };
      }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && minPrice !== "") query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined && maxPrice !== "") query.price.$lte = Number(maxPrice);
      if (Object.keys(query.price).length === 0) delete query.price;
    }

    // استعلام الفيسيتس الأساسي (قبل تطبيق فلاتر الـ specs والـ tags والـ groupCode الدقيقة حتى تظل الخيارات متاحة للاختيار)
    const facetBaseQuery = { ...query };

    if (groupCode && String(groupCode).trim()) {
      query.groupCode = String(groupCode).trim();
    }
    if (Array.isArray(tags) && tags.length > 0) {
      query.tags = { $in: tags };
    }
    if (Array.isArray(specFilters) && specFilters.length > 0) {
      specFilters.forEach((f) => {
        if (f.spec && Array.isArray(f.values) && f.values.length > 0) {
          query[`specs.${f.spec}`] = { $in: f.values };
        }
      });
    }

    const perPage = Math.max(1, Math.min(parseInt(pageSize) || 20, 60));
    const requestedPage = Math.max(1, parseInt(page) || 1);

    // الترتيب على مستوى قاعدة البيانات (MongoDB Sort)
    let sortSpec = { createdAt: -1 };
    switch (sortBy) {
      case "price_asc":
        sortSpec = { price: 1, createdAt: -1 };
        break;
      case "price_desc":
        sortSpec = { price: -1, createdAt: -1 };
        break;
      case "rating_desc":
        sortSpec = { ratingAvg: -1, createdAt: -1 };
        break;
      case "visited_desc":
        sortSpec = { visited: -1, createdAt: -1 };
        break;
      case "sales_desc":
        sortSpec = { salesCount: -1, createdAt: -1 };
        break;
      default:
        sortSpec = { createdAt: -1 };
        break;
    }

    const total = await Products.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(requestedPage, totalPages);
    const start = (currentPage - 1) * perPage;

    // جلب صفحة المنتجات المطلوبة فقط (توفير كامل للرام RAM)
    const [products, facetDocs, allCatsForSpecs] = await Promise.all([
      Products.find(query)
        .populate("categoryId")
        .populate("offerId")
        .populate("branchId", "name code city isMain")
        .populate("supplierId", "name phone whatsappPhone email specialty")
        .populate({
          path: "linkedItemIds",
          select: "name price oldPrice images categoryId active stockCount",
          populate: { path: "categoryId", select: "name type" }
        })
        .sort(sortSpec)
        .skip(start)
        .limit(perPage)
        .lean(),
      Products.find(facetBaseQuery).select("tags specs groupCode").lean(),
      categoryObj ? Promise.resolve([]) : Categories.find({}).select("specs").lean()
    ]);

    // تجميع الـ Facets (الوسوم والمواصفات ومعرفات المجموعات من نطاق البحث)
    const tagMap = {};
    const specMap = {};
    const groupCodeMap = {};
    facetDocs.forEach((p) => {
      if (p.groupCode && String(p.groupCode).trim()) {
        const gc = String(p.groupCode).trim();
        groupCodeMap[gc] = (groupCodeMap[gc] || 0) + 1;
      }
      (p.tags || []).forEach((t) => {
        tagMap[t] = (tagMap[t] || 0) + 1;
      });
      Object.entries(p.specs || {}).forEach(([k, v]) => {
        if (!v) return;
        if (!specMap[k]) specMap[k] = {};
        specMap[k][v] = (specMap[k][v] || 0) + 1;
      });
    });

    // خريطة أسماء المواصفات الحقيقية من القسم (spec1 -> القدرة الحصانية، إلخ)
    const catSpecsMap = { ...(categoryObj?.specs || {}) };
    categoryChildren.forEach((child) => {
      if (child.specs) Object.assign(catSpecsMap, child.specs);
    });
    if (!categoryObj && Array.isArray(allCatsForSpecs)) {
      allCatsForSpecs.forEach((c) => {
        if (c.specs) Object.assign(catSpecsMap, c.specs);
      });
    }

    const tagsFacet = Object.entries(tagMap).map(([tag, count]) => ({ tag, count }));
    const groupCodesFacet = Object.entries(groupCodeMap).map(([code, count]) => ({
      groupCode: code,
      count
    }));
    const specsFacet = Object.entries(specMap).map(([specKey, valCounts]) => ({
      spec: specKey,
      label: catSpecsMap[specKey] || specKey,
      values: Object.entries(valCounts).map(([value, count]) => ({ value, count }))
    }));

    // قائمة الـ tags المخصصة للقسم وفئاته الفرعية
    const categoryTags = Array.from(
      new Set([
        ...(categoryObj?.tags || []),
        ...categoryChildren.flatMap((c) => c.tags || [])
      ])
    ).filter(Boolean);

    const isAdminRequest = req.originalUrl && req.originalUrl.includes("/admin");
    const shouldCollapse = !isAdminRequest && req.body?.collapseVariants !== false;
    const finalProducts = await enrichAndCollapseVariants(Products, products, shouldCollapse);

    res.json({
      done: true,
      category: categoryObj,
      categoryChildren,
      categoryTags,
      products: finalProducts,
      tagsFacet,
      groupCodesFacet,
      specsFacet,
      total,
      page: currentPage,
      pages: totalPages,
      pageSize: perPage
    });
  } catch (err) {
    next(err);
  }
};

// 3. تفاصيل منتج معين والمنتجات الشقيقة (Siblings بنفس الـ groupCode) والمنتجات ذات الصلة
exports.getProductDetails = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const Reviews = getReviewsModel(req.subdomain);

    const product = await Products.findById(req.params.id)
      .populate("categoryId")
      .populate("offerId")
      .populate({
        path: "linkedItemIds",
        select: "name price oldPrice images categoryId active stockCount specs tags requiresShipping isService",
        populate: { path: "categoryId", select: "name type" }
      });
    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });

    // Fallback: If any linkedItemIds or relatedItems or relatedProducts are unpopulated string IDs, fetch and resolve them
    const rawIds = [
      ...(Array.isArray(product.linkedItemIds) ? product.linkedItemIds : []),
      ...(Array.isArray(product.relatedItems) ? product.relatedItems : []),
      ...(Array.isArray(product.relatedProducts) ? product.relatedProducts : [])
    ];
    const unpopulatedIds = rawIds
      .map((it) => (it && typeof it === "object" && it._id ? null : it))
      .filter((id) => id && mongoose.isValidObjectId(String(id)));

    let fetchedLinked = [];
    if (unpopulatedIds.length > 0) {
      fetchedLinked = await Products.find({
        _id: { $in: unpopulatedIds },
        active: true
      })
        .select("name price oldPrice images categoryId active stockCount specs tags requiresShipping isService")
        .populate("categoryId", "name type")
        .lean();
    }

    const linkedItemsMap = new Map();
    rawIds.forEach((it) => {
      if (it && typeof it === "object" && it._id && String(it._id) !== String(product._id)) {
        linkedItemsMap.set(String(it._id), it);
      }
    });
    fetchedLinked.forEach((it) => {
      if (it && it._id && String(it._id) !== String(product._id)) {
        linkedItemsMap.set(String(it._id), it);
      }
    });
    product.linkedItemIds = Array.from(linkedItemsMap.values());

    // تسجيل نشاط المشاهدة (product_viewed) وتحديث عداد المشاهدات بدون ازدواجية
    const actor = extractActorContext(req);
    const skipViewTrack = req.query.skipTrack === "true" || req.query.skipTrack === "1";
    if (!skipViewTrack) {
      try {
        const viewRecord = await recordActivity(req.subdomain, {
          eventType: "product_viewed",
          product,
          userId: actor.userId,
          visitorId: actor.visitorId,
          sessionId: actor.sessionId,
          cartId: actor.cartId
        });
        if (!viewRecord.deduplicated) {
          await Products.updateOne({ _id: product._id }, { $inc: { visited: 1 } });
          product.visited = (product.visited || 0) + 1;
        }
      } catch (actErr) {
        console.warn("[ACTIVITY_VIEW_WARN]", actErr.message);
        await Products.updateOne({ _id: product._id }, { $inc: { visited: 1 } });
      }
    }

    // جلب بقية المنتجات التي تحمل نفس المُعرف (groupCode) لعرض المتغيرات والأسعار والصور المختلفة
    let siblings = [];
    const cleanGroupCode = String(product.groupCode || "").trim();
    if (cleanGroupCode) {
      siblings = await Products.find({
        groupCode: cleanGroupCode,
        active: true
      })
        .populate("categoryId")
        .populate("offerId")
        .sort({ price: 1, createdAt: 1 })
        .lean();
    }

    // المراجعات والتقييمات
    const reviews = await Reviews.find({ productId: product._id }).sort({ createdAt: -1 }).limit(20).lean();

    // المنتجات ذات الصلة: نفس القسم + تداخل في الوسوم أو المواصفات (مع استثناء نفس مجموعة المتغيرات)
    const categoryId = product.categoryId?._id || product.categoryId;
    const siblingIds = siblings.map((s) => s._id);
    const candidates = await Products.find({
      categoryId,
      _id: { $nin: [product._id, ...siblingIds] },
      active: true
    })
      .populate("categoryId")
      .limit(10)
      .lean();

    const currentTags = (product.tags || []).map((t) => t.toLowerCase());

    const related = candidates
      .map((cand) => {
        let score = 0;
        const candTags = (cand.tags || []).map((t) => t.toLowerCase());
        const tagMatches = candTags.filter((t) => currentTags.includes(t)).length;
        score += tagMatches * 10;
        return { ...cand, relevance: score };
      })
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 4);

    res.json({
      done: true,
      product,
      siblings,
      reviews,
      related
    });
  } catch (err) {
    next(err);
  }
};

// 4. إضافة تقييم ومراجعة للعميل
exports.addReview = async (req, res, next) => {
  try {
    const Products = getProductsModel(req.subdomain);
    const Reviews = getReviewsModel(req.subdomain);

    const { rating, comment, username = "عميل المتجر" } = req.body;
    const rateNum = Number(rating);
    if (!rateNum || rateNum < 1 || rateNum > 5) {
      return res.status(400).json({ error: "يرجى تحديد تقييم من 1 إلى 5 نجوم" });
    }

    const product = await Products.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "المنتج غير موجود" });

    const review = await new Reviews({
      productId: product._id,
      userId: req.user ? req.user._id : null,
      username: req.user?.fullname || username,
      phone: req.user?.phone || "",
      rating: rateNum,
      comment: comment || ""
    }).save();

    // إعادة حساب تقييمات المنتج
    const all = await Reviews.find({ productId: product._id }).lean();
    const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    all.forEach((r) => {
      buckets[r.rating] = (buckets[r.rating] || 0) + 1;
      totalScore += r.rating;
    });

    const ratingAvg = all.length > 0 ? Math.round((totalScore / all.length) * 10) / 10 : 0;

    product.ratings = buckets;
    product.ratingAvg = ratingAvg;
    product.ratingCount = all.length;
    await product.save();

    res.json({ done: true, review, ratingAvg, ratingCount: all.length, message: "شكراً لك! تم إضافة تقييمك بنجاح" });
  } catch (err) {
    next(err);
  }
};

// 7. مقارنة المنتجات التفصيلية (Side-by-Side Comparison)
exports.compareProducts = async (req, res, next) => {
  try {
    const rawIds = req.query.ids || "";
    const idList = (Array.isArray(rawIds) ? rawIds : String(rawIds).split(","))
      .map((id) => String(id).trim())
      .filter(Boolean);

    if (idList.length === 0) {
      return res.status(400).json({ error: "لم يتم تحديد منتجات للمقارنة" });
    }

    const Products = getProductsModel(req.subdomain);
    const products = await Products.find({ _id: { $in: idList }, active: true })
      .populate("categoryId")
      .populate("offerId")
      .lean();

    if (products.length === 0) {
      return res.status(404).json({ error: "لم يتم العثور على المنتجات المطلوبة للمقارنة" });
    }

    // Extract all unique spec keys
    const allSpecKeysSet = new Set();
    products.forEach((p) => {
      Object.keys(p.specs || {}).forEach((k) => allSpecKeysSet.add(k));
    });
    const commonSpecs = Array.from(allSpecKeysSet);

    // Build specs matrix
    const specsMatrix = {};
    commonSpecs.forEach((k) => {
      specsMatrix[k] = {};
      products.forEach((p) => {
        specsMatrix[k][String(p._id)] = p.specs?.[k] || "غير متوفر";
      });
    });

    res.json({
      done: true,
      products,
      commonSpecs,
      specsMatrix,
      count: products.length
    });
  } catch (err) {
    next(err);
  }
};

// 8. تسجيل أنشطة المتسوق غير المرتبطة بحالة طلب مالية (مشاهدة متغير، سلة، بدء الدفع، مفضلة لزائر، ملاحظة ارتفاع السعر price_feedback)
// ملاحظة أمنية: الأحداث المالية وأحداث الطلبات (order_created, order_completed, order_cancelled, product_returned) تُرفض هنا وتُسجل حصرياً من عمليات الخادم الموثوقة.
exports.recordClientActivity = async (req, res, next) => {
  try {
    const mongoose = require("mongoose");
    const Products = getProductsModel(req.subdomain);
    const body = req.body || {};
    const { eventType, productId, items = [], quantity, couponCode, couponApplied, couponDiscountPercent } = body;

    const ALLOWED_CLIENT_EVENTS = [
      "product_viewed",
      "wishlist_added",
      "wishlist_removed",
      "add_to_cart",
      "remove_from_cart",
      "checkout_started",
      "price_feedback"
    ];

    if (!eventType || !ALLOWED_CLIENT_EVENTS.includes(eventType)) {
      return res.status(400).json({
        error: "نوع النشاط غير مدعوم أو يتطلب تأكيد عملية خادم موثوقة (مثل حالات الطلبات)."
      });
    }

    const actor = extractActorContext(req);

    // عند بدء الدفع (checkout_started)، قد يحتوي الطلب على مصفوفة منتجات السلة أو منتج واحد
    if (eventType === "checkout_started" && Array.isArray(items) && items.length > 0) {
      const recorded = [];
      for (const it of items) {
        const pid = it.productId || it._id;
        if (!pid || !mongoose.isValidObjectId(pid)) continue;
        const prod = await Products.findById(pid).populate("offerId").lean();
        if (!prod) continue;
        const r = await recordActivity(req.subdomain, {
          eventType: "checkout_started",
          product: prod,
          userId: actor.userId,
          visitorId: actor.visitorId,
          sessionId: actor.sessionId,
          cartId: actor.cartId,
          quantity: Number(it.quantity || 1),
          couponCode: couponCode || null,
          couponApplied: typeof couponApplied === "boolean" ? couponApplied : Boolean(couponCode),
          couponDiscountPercent: couponDiscountPercent ?? null
        });
        recorded.push(r.doc);
      }
      return res.json({ done: true, count: recorded.length, activities: recorded });
    }

    // بقية الأحداث المرتبطة بمنتج محدد
    let product = null;
    if (productId) {
      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({ error: "معرف المنتج غير صالح" });
      }
      product = await Products.findById(productId).populate("offerId").lean();
      if (!product) {
        return res.status(404).json({ error: "المنتج غير موجود" });
      }
    } else if (eventType !== "checkout_started") {
      return res.status(400).json({ error: "معرف المنتج مطلوب لهذا الحدث" });
    }

    const result = await recordActivity(req.subdomain, {
      eventType,
      product,
      userId: actor.userId,
      visitorId: actor.visitorId,
      sessionId: actor.sessionId,
      cartId: actor.cartId,
      quantity:
        ["add_to_cart", "remove_from_cart", "checkout_started"].includes(eventType)
          ? Number(quantity || 1)
          : null,
      couponCode: couponCode || null,
      couponApplied: typeof couponApplied === "boolean" ? couponApplied : null,
      couponDiscountPercent: couponDiscountPercent ?? null,
      dedupeWindowMs: eventType === "price_feedback" ? 0 : undefined
    });

    // إذا كان الحدث product_viewed مباشر (مثل التبديل بين متغير مخبأ بالواجهة) ولم يكن مكرراً، نحدث عداد الزيارات
    if (eventType === "product_viewed" && product && !result.deduplicated) {
      await Products.updateOne({ _id: product._id }, { $inc: { visited: 1 } });
    }

    res.json({
      done: true,
      activity: result.doc,
      deduplicated: result.deduplicated,
      message:
        eventType === "price_feedback"
          ? "تم تسجيل ملاحظتك حول سعر المنتج، شكراً لمشاركتك رأيك!"
          : "تم تسجيل النشاط بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

// 9. تبديل ملاحظة «السعر مرتفع» (Toggle Price Feedback)
exports.togglePriceFeedback = async (req, res, next) => {
  try {
    const { productId } = req.body || {};
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ error: "معرف المنتج غير صالح" });
    }

    const Activity = getActivityModel(req.subdomain);
    const actor = extractActorContext(req);

    // Filter to find existing price_feedback by this user / visitor / session
    const filter = {
      eventType: "price_feedback",
      productId
    };
    if (actor.userId && mongoose.isValidObjectId(actor.userId)) {
      filter.userId = actor.userId;
    } else if (actor.visitorId) {
      filter.visitorId = actor.visitorId;
    } else if (actor.sessionId) {
      filter.sessionId = actor.sessionId;
    }

    const existing = await Activity.findOne(filter);
    if (existing) {
      // Toggle OFF: delete existing feedback
      await Activity.deleteMany(filter);
      return res.json({
        done: true,
        active: false,
        message: "تم إلغاء ملاحظتك حول السعر المرتفع"
      });
    }

    // Toggle ON: record feedback
    const Products = getProductsModel(req.subdomain);
    const prod = await Products.findById(productId).select("name price categoryId").lean();

    await recordActivity(req.subdomain, {
      eventType: "price_feedback",
      productId,
      product: prod,
      userId: actor.userId,
      visitorId: actor.visitorId,
      sessionId: actor.sessionId,
      cartId: actor.cartId,
      metadata: { source: "price_feedback_toggle" }
    });

    res.json({
      done: true,
      active: true,
      message: "شكراً لمشاركتك! تم إرسال إشارتك بأن السعر مرتفع لإدارة المتجر"
    });
  } catch (err) {
    next(err);
  }
};


