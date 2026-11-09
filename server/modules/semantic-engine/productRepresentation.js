const {
  GEMINI_EMBEDDING_MODEL,
  generateGeminiEmbeddingStrict,
  generateGeminiBatchEmbeddings,
  isGeminiEmbeddingVector,
  computeTextHash
} = require("./embeddingProvider");

const OPTICS_TYPE_SYNONYMS = {
  frame: "نوع المنتج: إطار نظارة طبية (شمبر، شنبر، تشمبر، فريم، شاسيه، نظارة طبية، إطارات طبية، نظارات نظر، Eyeglasses Frame, Optical Eyewear)",
  sunglass: "نوع المنتج: نظارة شمسية (نظارات شمس، شمبر شمس، تشمبر شمس، فريم شمس، عدسات حماية شمسية UV400، كلاسيك، Sunglasses)",
  lens: "نوع المنتج: عدسات طبية وبصرية (زوج عدسات نظر، عدسات طبية، لنس، عدسات مضغوطة، عدسات شاشات، حماية بلوكت Blue Cut، فوتوكروميك Transitions، Optical Lenses)",
  contact_lens: "نوع المنتج: عدسات لاصقة (عدسات عيون، عدسات تجميلية، عدسات لينة، لينسز، Contact Lenses)",
  accessory: "نوع المنتج: إكسسوارات ومستلزمات بصريات (محلول تعقيم، محلول عدسات، جراب نظارة، حافظة، سلسلة، فوطة مسح، إكسسوارات نظارات)"
};

/**
 * Builds a rich, context-aware textual representation of a product.
 * Ensures numerical specifications have clear semantic units and are anchored to their category & optical taxonomy.
 */
function buildProductEmbeddingText(product = {}, categoryName = "") {
  const parts = [];

  const cat = categoryName || product.categoryId?.name || product.categoryName || "";
  if (cat) {
    parts.push(`القسم: ${cat}`);
  }

  // Inject optics domain semantic synonyms for product type
  const pType = product.productType || "frame";
  if (OPTICS_TYPE_SYNONYMS[pType]) {
    parts.push(OPTICS_TYPE_SYNONYMS[pType]);
  }

  if (product.name) {
    parts.push(`اسم المنتج: ${product.name}`);
  }

  // Optics domain specifications (Brand, model, frame/lens details)
  const os = product.opticsSpecs || product.frameSpecs || {};
  const opticsDetails = [];
  if (os.brand) opticsDetails.push(`الماركة: ${os.brand}`);
  if (os.modelCode) opticsDetails.push(`كود الموديل: ${os.modelCode}`);
  if (os.eyewearType) opticsDetails.push(`طبيعة النظارة: ${os.eyewearType}`);
  if (os.frameStyle) opticsDetails.push(`نمط الإطار: ${os.frameStyle}`);
  if (os.frameMaterial) opticsDetails.push(`خامة الإطار: ${os.frameMaterial}`);
  if (os.frameShape) opticsDetails.push(`شكل الإطار: ${os.frameShape}`);
  if (os.color) opticsDetails.push(`اللون: ${os.color}`);
  if (os.size) opticsDetails.push(`المقاس: ${os.size}`);
  if (os.gender) opticsDetails.push(`الفئة: ${os.gender}`);
  if (os.lensType) opticsDetails.push(`نوع العدسة: ${os.lensType}`);
  if (os.lensIndex) opticsDetails.push(`معامل الانكسار والضغط: ${os.lensIndex}`);
  if (os.lensBrand) opticsDetails.push(`الماركة البصرية: ${os.lensBrand}`);
  if (os.lensMaterial) opticsDetails.push(`خامة العدسة: ${os.lensMaterial}`);
  if (Array.isArray(os.coatings) && os.coatings.length > 0) {
    opticsDetails.push(`طبقات الحماية والمعالجة: ${os.coatings.join("، ")}`);
  }
  if (opticsDetails.length > 0) {
    parts.push(`مواصفات البصريات الدقيقة: ${opticsDetails.join("، ")}`);
  }

  if (product.description) {
    parts.push(`الوصف والاستخدام: ${product.description}`);
  }

  // Format generic specs into full contextual sentences
  if (product.specs && typeof product.specs === "object") {
    const specEntries = Object.entries(product.specs).filter(([_, v]) => v !== undefined && v !== null && v !== "");
    if (specEntries.length > 0) {
      const formattedSpecs = specEntries
        .map(([k, v]) => `${k}: ${v}`)
        .join("، ");
      parts.push(`المواصفات الفنية: ${formattedSpecs}`);
    }
  }

  if (Array.isArray(product.tags) && product.tags.length > 0) {
    parts.push(`الوسوم والكلمات الدلالية: ${product.tags.join("، ")}`);
  }

  if (product.price && Number(product.price) > 0) {
    parts.push(`السعر: ${product.price} جنيه`);
  }

  return parts.join(". ");
}

/**
 * Sync / generate 768-d Gemini embedding for a single product document.
 * Strictly uses Gemini (gemini-embedding-001) and never stores local hash vectors.
 */
async function syncProductEmbedding(subdomain, productDoc, options = {}) {
  if (!productDoc) return null;

  let categoryName = options.categoryName || "";
  if (!categoryName && productDoc.categoryId) {
    if (typeof productDoc.categoryId === "object" && productDoc.categoryId.name) {
      categoryName = productDoc.categoryId.name;
    } else {
      const getCategoriesModel = require("../categories/categoryModel");
      const Categories = getCategoriesModel(subdomain);
      const catDoc = await Categories.findById(productDoc.categoryId).select("name").lean();
      categoryName = catDoc?.name || "";
    }
  }

  const textToEmbed = buildProductEmbeddingText(productDoc, categoryName);
  const textHash = computeTextHash(textToEmbed);

  // Skip API call if product already has an up-to-date Gemini 768-d vector for the exact same text
  if (
    !options.force &&
    productDoc.embeddingTextHash === textHash &&
    isGeminiEmbeddingVector(productDoc.embedding, productDoc.embeddingModel)
  ) {
    return productDoc.embedding;
  }

  const res = await generateGeminiEmbeddingStrict(textToEmbed, {
    adminData: options.adminData,
    taskType: "RETRIEVAL_DOCUMENT"
  });

  if (res.isGemini && Array.isArray(res.vector)) {
    productDoc.embedding = res.vector;
    productDoc.embeddingModel = GEMINI_EMBEDDING_MODEL;
    productDoc.embeddingTextHash = textHash;
    return res.vector;
  }

  // If Gemini is unavailable and current vector is a legacy local vector, clear it so it is never mixed
  if (!isGeminiEmbeddingVector(productDoc.embedding, productDoc.embeddingModel)) {
    productDoc.embedding = [];
    productDoc.embeddingModel = "";
    productDoc.embeddingTextHash = "";
  }
  return productDoc.embedding;
}

/**
 * Batch synchronize 768-d Gemini vector embeddings for all products in a tenant catalog.
 * Uses Gemini batchEmbedContents to embed up to 50 products per single HTTP request.
 */
async function syncAllProductEmbeddings(subdomain, options = {}) {
  const getProductsModel = require("../products/productModel");
  const getCategoriesModel = require("../categories/categoryModel");
  const getAdminDataModel = require("../settings/adminDataModel");
  const Products = getProductsModel(subdomain);
  const Categories = getCategoriesModel(subdomain);

  let adminData = options.adminData;
  if (!adminData || Object.keys(adminData).length === 0) {
    try {
      const AdminData = getAdminDataModel(subdomain);
      adminData = (await AdminData.findOne().lean()) || {};
    } catch {
      adminData = {};
    }
  }

  const categories = await Categories.find({}).lean();
  const catMap = {};
  categories.forEach((c) => {
    catMap[String(c._id)] = c.name;
  });

  const allProducts = await Products.find({}).lean();
  const toSync = [];

  for (const prod of allProducts) {
    const catName = catMap[String(prod.categoryId)] || "";
    const textToEmbed = buildProductEmbeddingText(prod, catName);
    const textHash = computeTextHash(textToEmbed);
    const hasValidGemini = isGeminiEmbeddingVector(prod.embedding, prod.embeddingModel);

    if (options.force || !hasValidGemini || prod.embeddingModel !== GEMINI_EMBEDDING_MODEL || prod.embeddingTextHash !== textHash) {
      toSync.push({ prod, textToEmbed, textHash });
    }
  }

  if (toSync.length === 0) {
    return { total: allProducts.length, updated: 0, skipped: allProducts.length, model: GEMINI_EMBEDDING_MODEL };
  }

  const texts = toSync.map((item) => item.textToEmbed);
  const vectors = await generateGeminiBatchEmbeddings(texts, {
    adminData,
    taskType: "RETRIEVAL_DOCUMENT"
  });

  const bulkOps = [];
  let updatedCount = 0;

  for (let i = 0; i < toSync.length; i++) {
    const vec = vectors[i];
    const { prod, textHash } = toSync[i];
    if (Array.isArray(vec) && vec.length === 768) {
      bulkOps.push({
        updateOne: {
          filter: { _id: prod._id },
          update: {
            $set: {
              embedding: vec,
              embeddingModel: GEMINI_EMBEDDING_MODEL,
              embeddingTextHash: textHash
            }
          }
        }
      });
      updatedCount++;
    }
  }

  if (bulkOps.length > 0) {
    await Products.bulkWrite(bulkOps);
  }

  return {
    total: allProducts.length,
    attempted: toSync.length,
    updated: updatedCount,
    model: GEMINI_EMBEDDING_MODEL
  };
}

module.exports = {
  buildProductEmbeddingText,
  syncProductEmbedding,
  syncAllProductEmbeddings,
  OPTICS_TYPE_SYNONYMS
};
