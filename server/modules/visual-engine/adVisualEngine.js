const getProductsModel = require("../products/productModel");
const getCategoriesModel = require("../categories/categoryModel");
const { loadAssetAsBuffer, saveVisualAsset } = require("./assetLoader");
const {
  getVisualCredentials,
  inspectVisualReference,
  generateImageWithAi
} = require("./visualProvider");

/**
 * Resolves context for selected products including true spec names
 */
async function resolveSelectedProductsContext(subdomain, productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];

  const Products = getProductsModel(subdomain);
  const Categories = getCategoriesModel(subdomain);

  const docs = await Products.find({ _id: { $in: productIds } })
    .populate("categoryId")
    .lean();

  const categoriesCache = {};
  async function getCategoryFields(catId) {
    if (!catId) return [];
    if (categoriesCache[catId]) return categoriesCache[catId];
    const cat = await Categories.findById(catId).lean();
    categoriesCache[catId] = cat?.fields || [];
    return categoriesCache[catId];
  }

  const resolved = [];
  for (const doc of docs) {
    const catId = doc.categoryId?._id || doc.categoryId;
    const catName = doc.categoryId?.name || "";
    const fields = await getCategoryFields(catId);

    const namedSpecs = {};
    if (doc.specs && typeof doc.specs === "object") {
      Object.entries(doc.specs).forEach(([k, v]) => {
        if (!v) return;
        const matchedField = fields.find((f) => f.key === k);
        const readableName = matchedField?.label || matchedField?.name || k;
        namedSpecs[readableName] = v;
      });
    }

    resolved.push({
      _id: String(doc._id),
      name: doc.name,
      price: doc.price,
      oldPrice: doc.oldPrice || 0,
      image: Array.isArray(doc.images) && doc.images.length > 0 ? doc.images[0] : "",
      categoryName: catName,
      specs: namedSpecs
    });
  }

  return resolved;
}

/**
 * Builds commercial social media ad visual prompt
 */
function buildCommercialAdPrompt({
  storeName = "المتجر العصري",
  currency = "ج.م",
  products = [],
  rawImagesCount = 0,
  headline = "",
  subheadline = "",
  imageOverlayText = "",
  badgeText = "",
  ctaText = "",
  discountText = "",
  imageDesignPrompt = "",
  visualReferenceDescription = ""
}) {
  const productsDesc = products
    .map((p) => {
      const topSpecs = Object.entries(p.specs || {})
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `"${p.name}" (Price: ${p.price} ${currency}${
        p.oldPrice > p.price ? `, Old Price: ${p.oldPrice} ${currency}` : ""
      }${topSpecs ? `, Key Specs: ${topSpecs}` : ""})`;
    })
    .join(" + ");

  const mainTitle = (imageOverlayText || headline || "").trim();
  const subTitle = (subheadline || "").trim();
  const badge = (badgeText || discountText || "").trim();
  const cta = (ctaText || "").trim();

  const overlayInstruction = [
    mainTitle ? `Include bold promotional headline text on the design: "${mainTitle}".` : "",
    subTitle ? `Subheadline text: "${subTitle}".` : "",
    badge ? `Include a prominent offer/discount badge reading: "${badge}".` : "",
    cta ? `Call-to-action footer badge: "${cta}".` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `Create a high-converting, professional social media Facebook advertisement poster for store "${storeName}".`,
    productsDesc ? `Product details to feature on the visual: ${productsDesc}.` : "",
    visualReferenceDescription ? `Visual reference details: ${visualReferenceDescription}.` : "",
    rawImagesCount > 0
      ? `Preserve the exact appearance and identity of the attached ${rawImagesCount} reference image(s), blending and composing them seamlessly into the commercial advertisement scene.`
      : "",
    overlayInstruction,
    imageDesignPrompt && imageDesignPrompt.trim()
      ? `Custom design & prompt direction: ${imageDesignPrompt.trim()}.`
      : "Modern studio commercial lighting, eye-catching retail advertisement layout, 8k resolution, crisp commercial finish."
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generates a full commercial ad poster with AI blending of product images and text overlays
 */
async function generateCommercialAdPoster(req, payload = {}) {
  const adminData = req.adminData || {};
  const creds = getVisualCredentials(adminData);

  if (!creds.isImageAiReady && !creds.hasGemini) {
    const err = new Error(
      "موديل الذكاء الاصطناعي للصور غير مفعل أو لم يتم إدخال بياناته في الإعدادات. يمكنك استخدام استوديو قوالب SVG المدمج لتصميم صورة البوست."
    );
    err.status = 403;
    throw err;
  }

  const {
    productIds = [],
    productImageUrls = [],
    useAttachedImages = true,
    headline = "",
    subheadline = "",
    imageOverlayText = "",
    badgeText = "",
    ctaText = "",
    discountText = "",
    imageDesignPrompt = ""
  } = payload;

  // 1. Resolve product context
  let products = [];
  if (Array.isArray(productIds) && productIds.length > 0) {
    products = await resolveSelectedProductsContext(req.subdomain, productIds);
  }

  // 2. Gather image sources
  const urlsToLoad = [];
  if (useAttachedImages !== false) {
    if (Array.isArray(productImageUrls) && productImageUrls.length > 0) {
      urlsToLoad.push(...productImageUrls.filter(Boolean));
    } else {
      products.forEach((p) => {
        if (p.image) urlsToLoad.push(p.image);
      });
    }
  }

  // 3. Load up to 4 images as binary Buffers
  const rawImages = [];
  for (const url of urlsToLoad.slice(0, 4)) {
    const loaded = await loadAssetAsBuffer(url);
    if (loaded?.buffer) {
      rawImages.push(loaded);
    }
  }

  // 4. Optional visual inspection for reference images
  let visualReferenceDescription = "";
  if (rawImages.length > 0) {
    visualReferenceDescription = await inspectVisualReference(
      rawImages[0].buffer,
      rawImages[0].mimeType,
      { adminData }
    );
  }

  const storeName = adminData.siteName || "المتجر العصري";
  const currency = adminData.currency || "ج.م";

  const fullPrompt = buildCommercialAdPrompt({
    storeName,
    currency,
    products,
    rawImagesCount: rawImages.length,
    headline,
    subheadline,
    imageOverlayText,
    badgeText,
    ctaText,
    discountText,
    imageDesignPrompt,
    visualReferenceDescription
  });

  // 5. Generate image
  const { buffer, mimeType } = await generateImageWithAi({
    prompt: fullPrompt,
    rawImages,
    options: { size: "1024x1024" },
    adminData
  });

  // 6. Save image to storage
  const uploadedUrl = await saveVisualAsset(
    buffer,
    mimeType,
    `fb-ad-poster-${Date.now()}.png`,
    req
  );

  return {
    imageUrl: uploadedUrl,
    attachedProductImagesCount: rawImages.length
  };
}

module.exports = {
  resolveSelectedProductsContext,
  buildCommercialAdPrompt,
  generateCommercialAdPoster
};
