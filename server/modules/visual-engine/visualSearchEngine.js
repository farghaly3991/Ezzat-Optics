const { loadAssetAsBuffer } = require("./assetLoader");
const { analyzeImageWithVision } = require("./visualProvider");
const { searchCatalog } = require("../semantic-engine/searchEngine");

/**
 * Identifies product name, category, and visual attributes from an image.
 */
async function identifyProductFromImage(imageBuffer, mimeType = "image/jpeg", adminData = {}) {
  const prompt =
    "Identify the commercial retail product shown in this image. " +
    "Return JSON with: " +
    "1. 'productName' (concise Arabic and English title), " +
    "2. 'categoryName' (best matching general e-commerce category in Arabic), " +
    "3. 'brand' (brand name if visible, or null), " +
    "4. 'color' (predominant color), " +
    "5. 'searchQuery' (an optimized search query in Arabic and English to find this exact item in a catalog).";

  const result = await analyzeImageWithVision({
    imageBuffer,
    mimeType,
    prompt,
    systemPrompt: "You are an expert e-commerce catalog visual search and recognition assistant.",
    responseFormat: "json",
    adminData
  });

  return {
    productName: result?.productName || "",
    categoryName: result?.categoryName || "",
    brand: result?.brand || "",
    color: result?.color || "",
    searchQuery: result?.searchQuery || result?.productName || ""
  };
}

/**
 * Searches the store catalog using an uploaded image or image URL (Visual Search).
 */
async function searchCatalogByImage(subdomain, options = {}) {
  const {
    imageBuffer = null,
    mimeType = "image/jpeg",
    imageUrl = "",
    limit = 8,
    adminData = {}
  } = options;

  let bufferToUse = imageBuffer;
  let mimeToUse = mimeType;

  if (!bufferToUse && imageUrl) {
    const loaded = await loadAssetAsBuffer(imageUrl);
    if (loaded?.buffer) {
      bufferToUse = loaded.buffer;
      mimeToUse = loaded.mimeType;
    }
  }

  if (!bufferToUse) {
    throw new Error("No image data provided for visual search");
  }

  const detected = await identifyProductFromImage(bufferToUse, mimeToUse, adminData);
  const query = detected.searchQuery || detected.productName;

  let matchedProducts = [];
  if (query) {
    const searchRes = await searchCatalog(subdomain, {
      query,
      limit
    });
    matchedProducts = searchRes?.products || [];
  }

  return {
    detected,
    products: matchedProducts,
    count: matchedProducts.length
  };
}

module.exports = {
  identifyProductFromImage,
  searchCatalogByImage
};
