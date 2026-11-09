const assert = require("assert");
const intakeEngine = require("../modules/intake-engine");
const productIntakeAi = require("../modules/products/productIntakeAi");
require("dotenv").config({ path: __dirname + "/../.env" });

async function runTests() {
  console.log("=== STARTING UNIFIED INTAKE & CATALOG INGESTION ENGINE TESTS ===\n");

  // -------------------------------------------------------------
  // Test 1: Document Parser
  // -------------------------------------------------------------
  console.log("Test 1: Testing documentParser.parseDocument...");
  const textBuffer = Buffer.from("تكييف كاريير 1.5 حصان بارد ساخن انفرتر بسعر 21500 ج.م", "utf8");
  const parsedText = await intakeEngine.parseDocument(textBuffer, "text/plain", "products.txt");
  assert.strictEqual(parsedText.isVisionNeeded, false);
  assert(parsedText.text.includes("كاريير"));
  assert.strictEqual(parsedText.format, "text");

  const imageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
  const parsedImage = await intakeEngine.parseDocument(imageBuffer, "image/jpeg", "invoice.jpg");
  assert.strictEqual(parsedImage.isVisionNeeded, true);
  assert.strictEqual(parsedImage.format, "image");
  console.log("  [PASS] Document parser accurately detected text and routed image files to vision pipeline.\n");

  // -------------------------------------------------------------
  // Test 2: Safe JSON Parsing & Code Fence Cleanup
  // -------------------------------------------------------------
  console.log("Test 2: Testing llmCaller.safeParseJson...");
  const rawLlmResponse = "```json\n{\n  \"products\": [\n    {\"name\": \"لابتوب ديل\", \"price\": 74000}\n  ]\n}\n```";
  const parsedJson = intakeEngine.safeParseJson(rawLlmResponse);
  assert(Array.isArray(parsedJson.products), "Parsed JSON must contain products array");
  assert.strictEqual(parsedJson.products[0].name, "لابتوب ديل");
  assert.strictEqual(parsedJson.products[0].price, 74000);
  console.log("  [PASS] Safe JSON parser stripped markdown fences and recovered structured payload.\n");

  // -------------------------------------------------------------
  // Test 3: Catalog Extraction Normalization & Spec Mapping
  // -------------------------------------------------------------
  console.log("Test 3: Testing catalogExtractor.normalizeExtractedProducts...");
  const mockCategoryContext = {
    category: {
      _id: "60c72b2f9b1d8b001f8e4a1a",
      name: "تكييفات وأجهزة تبريد"
    },
    specsMetaList: [
      {
        specKey: "spec1",
        specLabel: "قدرة التبريد",
        existingValues: [{ value: "1.5 حصان", count: 12 }]
      },
      {
        specKey: "spec2",
        specLabel: "النوع",
        existingValues: [{ value: "بارد فقط", count: 8 }]
      }
    ]
  };

  const rawProducts = [
    {
      name: "تكييف شارب 1.5 حصان",
      price: "19500",
      costPrice: "16000",
      description: "تكييف موفر للطاقة",
      tags: ["شارب", "تكييفات", "انفرتر"],
      // Test when LLM keys by specKey
      specs: {
        spec1: "1.5 حصان",
        spec2: "بارد ساخن"
      }
    },
    {
      name: "تكييف ميديا ميشن",
      price: "17200",
      // Test when LLM keys by human specLabel
      specs: {
        "قدرة التبريد": "2.25 حصان",
        "النوع": "بارد فقط"
      }
    }
  ];

  const normalized = intakeEngine.normalizeExtractedProducts(rawProducts, mockCategoryContext);
  assert.strictEqual(normalized.length, 2);
  assert.strictEqual(normalized[0].price, 19500);
  assert.strictEqual(normalized[0].specs.spec1, "1.5 حصان");
  assert.strictEqual(normalized[0].specs.spec2, "بارد ساخن");

  // Verify label fallback for 2nd product
  assert.strictEqual(normalized[1].specs.spec1, "2.25 حصان", "Should map human specLabel to canonical specKey");
  assert.strictEqual(normalized[1].specs.spec2, "بارد فقط");
  assert(normalized[0].specsDisplay.length === 2);
  assert.strictEqual(normalized[0].specsDisplay[0].specLabel, "قدرة التبريد");
  console.log("  [PASS] Normalizer successfully mapped canonical specs and human labels to catalog schema.\n");

  // -------------------------------------------------------------
  // Test 4: External Prompt Builder
  // -------------------------------------------------------------
  console.log("Test 4: Testing externalPromptBuilder module export...");
  assert(typeof intakeEngine.generateExternalPromptForCategory === "function");
  console.log("  [PASS] External prompt generator function confirmed.\n");

  // -------------------------------------------------------------
  // Test 5: Verify Unified Intake Index Exports
  // -------------------------------------------------------------
  console.log("Test 5: Verifying all unified functions exported on index.js...");
  const requiredFunctions = [
    "parseDocument",
    "getCategorySpecsContext",
    "safeParseJson",
    "callDeepSeek",
    "callGemini",
    "normalizeExtractedProducts",
    "extractProductsForCategory",
    "generateExternalPromptForCategory",
    "processDocumentIntake",
    "processVoiceIntake"
  ];

  for (const fn of requiredFunctions) {
    assert(typeof intakeEngine[fn] === "function", `intakeEngine.${fn} must be a function`);
  }
  console.log(`  [PASS] All ${requiredFunctions.length} unified intake functions are cleanly exported.\n`);

  // -------------------------------------------------------------
  // Test 6: Verify Product Intake AI Controller Delegations
  // -------------------------------------------------------------
  console.log("Test 6: Verifying productIntakeAi controller delegations...");
  const controllerMethods = [
    "handleVoiceProductIntake",
    "handleTextProductIntake",
    "handleDocumentProductIntake",
    "handleCategoryPromptGet",
    "handleUploadAiImageToStorage",
    "handleProductImageAi",
    "parseDocumentText",
    "callDeepSeek",
    "callGemini",
    "transcribeAudio",
    "extractProductsForCategory",
    "getCategorySpecsContext"
  ];

  for (const method of controllerMethods) {
    assert(typeof productIntakeAi[method] === "function", `productIntakeAi.${method} must be a function`);
  }
  console.log("  [PASS] All controller handlers and backward-compatible methods verified.\n");

  console.log("=== ALL UNIFIED INTAKE ENGINE TESTS PASSED SUCCESSFULLY! 📦 ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
