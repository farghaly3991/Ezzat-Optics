const getCategoriesModel = require("./categoryModel");
const getProductsModel = require("../products/productModel");
const { syncStoreCategorySchema } = require("../../core/ai/schemaExtractor");

exports.listCategories = async (req, res, next) => {
  try {
    const Categories = getCategoriesModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);

    const query = {};
    if (req.query.type) {
      query.type = req.query.type === "service" ? "service" : "product";
    }

    const categories = await Categories.find(query).sort({ order: 1, createdAt: 1 }).lean();
    const counts = await Products.aggregate([
      { $group: { _id: "$categoryId", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach((c) => {
      if (c._id) countMap[String(c._id)] = c.count;
    });

    const catById = {};
    const childrenByParent = {};
    categories.forEach((cat) => {
      const idStr = String(cat._id);
      catById[idStr] = cat;
      if (cat.parentId) {
        const pIdStr = String(cat.parentId);
        if (!childrenByParent[pIdStr]) childrenByParent[pIdStr] = [];
        childrenByParent[pIdStr].push(idStr);
      }
    });

    const withCounts = categories.map((cat) => {
      const idStr = String(cat._id);
      const directCount = countMap[idStr] || 0;
      const childIds = childrenByParent[idStr] || [];
      const childrenCount = childIds.reduce((sum, cid) => sum + (countMap[cid] || 0), 0);
      const parentCat = cat.parentId ? catById[String(cat.parentId)] : null;

      return {
        ...cat,
        directProductsCount: directCount,
        productsCount: directCount + childrenCount,
        isParent: childIds.length > 0,
        childrenIds: childIds,
        parentName: parentCat ? parentCat.name : null,
        displayName: parentCat ? `${parentCat.name} › ${cat.name}` : cat.name
      };
    });

    res.json({ done: true, categories: withCounts });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const Categories = getCategoriesModel(req.subdomain);
    const {
      name,
      image,
      specs,
      tags,
      order,
      type,
      icon,
      parentId,
      matrixTemplateId,
      layoutMode,
      allowMultiVariants,
      hasGridSpecs,
      gridConfig
    } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "اسم القسم مطلوب" });

    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const categoryType = type === "service" ? "service" : "product";
    const category = await new Categories({
      name: name.trim(),
      slug,
      image,
      icon: icon || "",
      type: categoryType,
      specs,
      tags,
      order,
      parentId: parentId || null,
      matrixTemplateId: matrixTemplateId || null,
      layoutMode: layoutMode || (hasGridSpecs ? "matrix_grid" : "standard"),
      allowMultiVariants: allowMultiVariants !== false,
      hasGridSpecs: Boolean(hasGridSpecs),
      gridConfig: gridConfig || undefined
    }).save();
    
    // Auto-sync AI category schema in background
    syncStoreCategorySchema(req.subdomain).catch(e => console.warn("[AI_AUTO_SYNC_ERR]", e.message));

    res.json({ done: true, category, message: "تم إضافة القسم بنجاح وتحديث بيانات الذكاء الاصطناعي" });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const Categories = getCategoriesModel(req.subdomain);
    const updated = await Categories.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "القسم غير موجود" });
    
    // Auto-sync AI category schema in background
    syncStoreCategorySchema(req.subdomain).catch(e => console.warn("[AI_AUTO_SYNC_ERR]", e.message));

    res.json({ done: true, category: updated, message: "تم تعديل القسم بنجاح وتحديث بيانات الذكاء الاصطناعي" });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const Categories = getCategoriesModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);

    const hasProducts = await Products.countDocuments({ categoryId: req.params.id });
    if (hasProducts > 0) {
      return res.status(400).json({ error: `لا يمكن حذف هذا القسم لاحتوائه على ${hasProducts} منتج مرتبط به` });
    }

    await Categories.findByIdAndDelete(req.params.id);

    // Auto-sync AI category schema in background
    syncStoreCategorySchema(req.subdomain).catch(e => console.warn("[AI_AUTO_SYNC_ERR]", e.message));

    res.json({ done: true, message: "تم حذف القسم بنجاح وتحديث بيانات الذكاء الاصطناعي" });
  } catch (err) {
    next(err);
  }
};
