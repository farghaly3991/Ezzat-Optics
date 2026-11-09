/**
 * Unified Visuals Engine
 * Centralized multimodal vision, e-commerce product studio, and commercial ad visual generation.
 */

const assetLoader = require("./assetLoader");
const visualProvider = require("./visualProvider");
const productStudioEngine = require("./productStudioEngine");
const adVisualEngine = require("./adVisualEngine");
const documentVisionExtractor = require("./documentVisionExtractor");
const visualSearchEngine = require("./visualSearchEngine");

module.exports = {
  // Asset Loading & Storage
  loadAssetAsBuffer: assetLoader.loadAssetAsBuffer,
  saveVisualAsset: assetLoader.saveVisualAsset,

  // Visual Provider & Multimodal Vision
  getVisualCredentials: visualProvider.getVisualCredentials,
  analyzeImageWithVision: visualProvider.analyzeImageWithVision,
  inspectVisualReference: visualProvider.inspectVisualReference,
  generateImageWithAi: visualProvider.generateImageWithAi,

  // Product AI Studio (Enhance, Multi-Angle, Isolation)
  buildProductStudioPrompt: productStudioEngine.buildProductStudioPrompt,
  generateProductStudioImages: productStudioEngine.generateProductStudioImages,

  // Commercial Ad Poster Visuals (Facebook / Social Media)
  resolveSelectedProductsContext: adVisualEngine.resolveSelectedProductsContext,
  buildCommercialAdPrompt: adVisualEngine.buildCommercialAdPrompt,
  generateCommercialAdPoster: adVisualEngine.generateCommercialAdPoster,

  // Document & Invoice Multimodal Extraction
  extractProductsFromVisualDocument: documentVisionExtractor.extractProductsFromVisualDocument,

  // Multimodal Visual Product Search
  identifyProductFromImage: visualSearchEngine.identifyProductFromImage,
  searchCatalogByImage: visualSearchEngine.searchCatalogByImage
};
