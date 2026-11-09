const assert = require("assert");
const visualEngine = require("../modules/visual-engine");
require("dotenv").config({ path: __dirname + "/../.env" });

async function runTests() {
  console.log("=== STARTING UNIFIED VISUALS ENGINE VERIFICATION TESTS ===\n");

  // -------------------------------------------------------------
  // Test 1: Asset Loader & Normalizer
  // -------------------------------------------------------------
  console.log("Test 1: Testing assetLoader.loadAssetAsBuffer...");
  const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const loadedDataUri = await visualEngine.loadAssetAsBuffer(dummyBase64);
  assert(loadedDataUri !== null, "Base64 Data URI should be loaded successfully");
  assert.strictEqual(loadedDataUri.mimeType, "image/png");
  assert(Buffer.isBuffer(loadedDataUri.buffer), "Loaded asset should contain a Buffer");
  assert(loadedDataUri.size > 0, "Buffer size should be greater than 0");

  const nullAsset = await visualEngine.loadAssetAsBuffer("/non-existent/fake-path.png");
  assert.strictEqual(nullAsset, null, "Non-existent path should return null gracefully");
  console.log("  [PASS] Asset loader successfully parsed data URIs and handled missing paths.\n");

  // -------------------------------------------------------------
  // Test 2: Provider Discovery & Credentials
  // -------------------------------------------------------------
  console.log("Test 2: Testing visualProvider.getVisualCredentials...");
  const creds = visualEngine.getVisualCredentials();
  assert(creds.hasGemini === true, "GEMINI_API_KEY from .env should be discovered");
  assert(creds.geminiKey.length > 5, "Discovered Gemini Key should be valid length");
  console.log(`  [PASS] Visual credentials detected. Gemini Available: ${creds.hasGemini}, BaseURL: ${creds.imageBaseUrl}\n`);

  // -------------------------------------------------------------
  // Test 3: Product AI Studio Engine Prompt Generation
  // -------------------------------------------------------------
  console.log("Test 3: Testing productStudioEngine.buildProductStudioPrompt...");
  const studioPrompt1 = visualEngine.buildProductStudioPrompt({
    productName: "لابتوب ديل XPS 15",
    categoryName: "أجهزة كمبيوتر ولابتوب",
    specs: { RAM: "32GB", GPU: "RTX 4070" },
    mode: "enhance_only"
  });
  assert(studioPrompt1.includes("لابتوب ديل XPS 15"), "Prompt should feature product name");
  assert(studioPrompt1.includes("32GB"), "Prompt should include specs");
  assert(studioPrompt1.includes("Enhanced professional studio product photography"), "Prompt should reflect enhance_only mode");

  const studioPrompt2 = visualEngine.buildProductStudioPrompt({
    productName: "سماعة بلوتوث رياضية",
    categoryName: "إلكترونيات",
    mode: "extract_item_from_collection"
  });
  assert(studioPrompt2.includes("Isolate and extract ONLY"), "Prompt should instruct isolation for collection mode");
  console.log("  [PASS] Product studio prompt builder constructed precise commercial photography prompts.\n");

  // -------------------------------------------------------------
  // Test 4: Commercial Ad Poster Prompt Builder
  // -------------------------------------------------------------
  console.log("Test 4: Testing adVisualEngine.buildCommercialAdPrompt...");
  const adPrompt = visualEngine.buildCommercialAdPrompt({
    storeName: "متجر المستقبل",
    currency: "ج.م",
    products: [
      { name: "شاشة سامسونج الذكية 55 بوصة", price: 18500, specs: { Resolution: "4K UHD" } }
    ],
    headline: "عروض الجمعة البيضاء",
    badgeText: "خصم 25%",
    ctaText: "اطلب الآن واستلم غداً",
    discountText: "وفر 4,000 ج.م"
  });
  assert(adPrompt.includes("متجر المستقبل"), "Ad prompt should contain store name");
  assert(adPrompt.includes("عروض الجمعة البيضاء"), "Ad prompt should include headline overlay");
  assert(adPrompt.includes("خصم 25%"), "Ad prompt should include offer badge");
  assert(adPrompt.includes("اطلب الآن واستلم غداً"), "Ad prompt should include CTA badge");
  console.log("  [PASS] Commercial ad prompt builder correctly incorporated promotional badges and CTA text overlays.\n");

  // -------------------------------------------------------------
  // Test 5: Verify Module Exports & Architectural Interconnections
  // -------------------------------------------------------------
  console.log("Test 5: Verifying all unified functions exported on index.js...");
  const requiredFunctions = [
    "loadAssetAsBuffer",
    "saveVisualAsset",
    "getVisualCredentials",
    "analyzeImageWithVision",
    "inspectVisualReference",
    "generateImageWithAi",
    "buildProductStudioPrompt",
    "generateProductStudioImages",
    "resolveSelectedProductsContext",
    "buildCommercialAdPrompt",
    "generateCommercialAdPoster",
    "extractProductsFromVisualDocument",
    "identifyProductFromImage",
    "searchCatalogByImage"
  ];

  for (const fn of requiredFunctions) {
    assert(typeof visualEngine[fn] === "function", `visualEngine.${fn} must be a function`);
  }
  console.log(`  [PASS] All ${requiredFunctions.length} unified visual functions are cleanly exported and accessible.\n`);

  // -------------------------------------------------------------
  // Test 6: Verify Product Intake & Facebook Post Delegations
  // -------------------------------------------------------------
  console.log("Test 6: Verifying consumer module connections...");
  const productIntakeAi = require("../modules/products/productIntakeAi");
  const facebookPostAi = require("../modules/facebook/facebookPostAi");
  const { checkImageAiAvailable } = require("../core/middleware/aiDispatcher");

  assert(typeof productIntakeAi.processProductImageWithAi === "function", "productIntakeAi.processProductImageWithAi should exist");
  assert(typeof productIntakeAi.handleUploadAiImageToStorage === "function", "productIntakeAi.handleUploadAiImageToStorage should exist");
  assert(typeof facebookPostAi.generateFacebookPostImageWithAi === "function", "facebookPostAi.generateFacebookPostImageWithAi should exist");
  assert(typeof facebookPostAi.loadImageSourceAsBuffer === "function", "facebookPostAi.loadImageSourceAsBuffer should exist");

  const isImageReady = checkImageAiAvailable({ adminData: {} });
  assert(isImageReady === true, "checkImageAiAvailable should return true when GEMINI_API_KEY is present");
  console.log("  [PASS] All consumer modules cleanly linked with unified visual engine.\n");

  console.log("=== ALL UNIFIED VISUALS ENGINE TESTS PASSED SUCCESSFULLY! 🚀 ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
