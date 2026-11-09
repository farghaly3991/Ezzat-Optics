/**
 * Phase 5 Verification Suite: Document & Multi-Modal AI Product Intake,
 * Reusable Product Form & Standalone AI Image Studio.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const envJson = require("../env.json");
const serverModule = require("../server");

const productIntakeAi = require("../modules/products/productIntakeAi");
const getCategoriesModel = require("../modules/categories/categoryModel");
const getProductsModel = require("../modules/products/productModel");

const TEST_TENANT = "phase5_test_intake";

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runPhase5Suite() {
  console.log("\n=== Starting Phase 5 AI Product Intake & Image Studio Verification Suite ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const tenantUri = buildTenantDbUri(baseUri, TEST_TENANT);
  const conn = await mongoose.createConnection(tenantUri).asPromise();
  serverModule.setMongooseConnection(TEST_TENANT, conn);

  const Categories = getCategoriesModel(TEST_TENANT);
  const Products = getProductsModel(TEST_TENANT);

  try {
    // -------------------------------------------------------------
    // 1. Setup Test Category with Specific Specs & Tags
    // -------------------------------------------------------------
    console.log("1. Setting up Test Category with Specific Specs Schema...");
    await Categories.deleteMany({});
    await Products.deleteMany({});

    const testCat = await Categories.create({
      name: "أجهزة التكييف والتبريد",
      slug: "air-conditioners",
      active: true,
      tags: ["كاريير", "شارب", "فريش", "انفرتر", "توفير الطاقة"],
      specs: {
        spec1: "القدرة الحصانية",
        spec2: "نوع التبريد",
        spec3: "خاصية الانفرتر"
      }
    });

    // Seed sample product to create filter facets
    await Products.create({
      name: "تكييف كاريير 1.5 حصان بارد فقط انفرتر",
      categoryId: testCat._id,
      price: 24500,
      stockCount: 15,
      specs: {
        spec1: "1.5 حصان",
        spec2: "بارد فقط",
        spec3: "انفرتر"
      },
      tags: ["كاريير", "انفرتر"]
    });

    console.log("   [PASS] Test category & filter facets initialized.");

    // -------------------------------------------------------------
    // 2. Testing Category External Prompt Generation
    // -------------------------------------------------------------
    console.log("2. Testing External Category AI Prompt Generation...");
    const promptRes = await productIntakeAi.generateExternalPromptForCategory(
      TEST_TENANT,
      testCat._id
    );

    assert.ok(promptRes.prompt, "Generated prompt should be present");
    assert.ok(promptRes.prompt.includes("أجهزة التكييف والتبريد"), "Prompt must include category name");
    assert.ok(promptRes.prompt.includes("القدرة الحصانية"), "Prompt must include spec labels");
    assert.ok(promptRes.prompt.includes("spec1"), "Prompt must specify spec storage keys");
    assert.ok(promptRes.sampleSchema?.products, "Sample schema must provide products array");
    console.log("   [PASS] Rich external prompt generated successfully with category specs.");

    // -------------------------------------------------------------
    // 3. Testing External JSON Paste & Normalization
    // -------------------------------------------------------------
    console.log("3. Testing External JSON Import & Category Specs Normalization...");
    const mockExternalJson = JSON.stringify({
      products: [
        {
          name: "تكييف شارب 2.25 حصان بارد ساخن ديجيتال",
          price: 32000,
          oldPrice: 34500,
          costPrice: 28000,
          stockCount: 8,
          description: "تكييف شارب بخاصية البلازما كلاستر لتنقية الهواء وتقنية التبريد السريع",
          tags: ["شارب", "بارد ساخن", "بلازما"],
          specs: {
            spec1: "2.25 حصان",
            spec2: "بارد ساخن",
            spec3: "عادي"
          }
        },
        {
          name: "تكييف فريش سمارت 1.5 حصان بارد فقط",
          price: 19500,
          costPrice: 17000,
          stockCount: 12,
          description: "تكييف فريش اقتصادي بتوزيع هواء رباعي الاتجاهات",
          tags: ["فريش"],
          specs: {
            spec1: "1.5 حصان",
            spec2: "بارد فقط",
            spec3: "بدون انفرتر"
          }
        }
      ]
    });

    // Simulate Document Intake controller with jsonText
    const mockReqJson = {
      subdomain: TEST_TENANT,
      adminData: {},
      body: {
        categoryId: String(testCat._id),
        jsonText: mockExternalJson
      }
    };

    let responseData = null;
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await productIntakeAi.handleDocumentProductIntake(mockReqJson, mockRes, () => {});
    assert.ok(responseData?.done, "Import response must be done: true");
    assert.strictEqual(responseData.products.length, 2, "Must extract 2 products");
    assert.strictEqual(responseData.products[0].name, "تكييف شارب 2.25 حصان بارد ساخن ديجيتال");
    assert.strictEqual(responseData.products[0].specs.spec1, "2.25 حصان");
    assert.strictEqual(responseData.products[0].specs.spec2, "بارد ساخن");
    assert.strictEqual(responseData.products[1].name, "تكييف فريش سمارت 1.5 حصان بارد فقط");
    console.log("   [PASS] External JSON successfully parsed and normalized into products list.");

    // -------------------------------------------------------------
    // 4. Testing AI Image Studio Workflow Prompts (3 Modes)
    // -------------------------------------------------------------
    console.log("4. Testing AI Image Studio 3 Workflow Modes & Dynamic Prompts...");

    // Mode A: enhance_only
    const enhancePromptRes = await productIntakeAi.processProductImageWithAi(
      { adminData: {} },
      {
        productName: "تكييف كاريير 1.5 حصان",
        categoryName: "أجهزة التكييف",
        specs: { "القدرة": "1.5 حصان", "اللون": "أبيض لؤلؤي" },
        mode: "enhance_only",
        notes: "خلفية رمادية رخامية هادئة",
        generatePromptOnly: true
      }
    );
    assert.ok(enhancePromptRes.prompt.includes("Enhanced professional studio product photography"), "Must include enhance objective");
    assert.ok(enhancePromptRes.prompt.includes("تكييف كاريير 1.5 حصان"), "Must include product name");
    assert.ok(enhancePromptRes.prompt.includes("رخامية"), "Must include custom notes");

    // Mode B: enhance_and_angles
    const anglesPromptRes = await productIntakeAi.processProductImageWithAi(
      { adminData: {} },
      {
        productName: "سماعة رأس سوني XM5",
        categoryName: "إلكترونيات صوتية",
        specs: { "اللون": "أسود مطفي" },
        mode: "enhance_and_angles",
        anglesCount: 3,
        generatePromptOnly: true
      }
    );
    assert.strictEqual(anglesPromptRes.mode, "enhance_and_angles");
    assert.ok(anglesPromptRes.prompt.includes("commercial e-commerce"), "Must format marketing perspectives");

    // Mode C: extract_item_from_collection
    const isolatePromptRes = await productIntakeAi.processProductImageWithAi(
      { adminData: {} },
      {
        productName: "هاتف آيفون 15 برو ماكس",
        categoryName: "هواتف ذكية",
        specs: { "اللون": "تيتانيوم أزرق" },
        mode: "extract_item_from_collection",
        notes: "اعزل الهاتف فقط واحذف السماعة والساعة المجاورة له في الصورة",
        generatePromptOnly: true
      }
    );
    assert.strictEqual(isolatePromptRes.mode, "extract_item_from_collection");
    assert.ok(isolatePromptRes.prompt.includes("Isolate and extract ONLY"), "Must include isolation prompt directive");
    assert.ok(isolatePromptRes.prompt.includes("هاتف آيفون 15 برو ماكس"), "Must target specific product");
    console.log("   [PASS] AI Image Studio prompt generation verified across all 3 modes.");

    // -------------------------------------------------------------
    // 5. Testing Base64 Image Upload to Cloud/Storage Endpoint
    // -------------------------------------------------------------
    console.log("5. Testing AI Image Base64 Upload to Storage...");
    // 1x1 transparent PNG base64
    const tinyPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const mockUploadReq = {
      subdomain: TEST_TENANT,
      adminData: {},
      body: {
        image: tinyPngBase64,
        filename: "test-ai-output.png"
      }
    };

    let uploadResData = null;
    const mockUploadRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        uploadResData = data;
        return this;
      }
    };

    await productIntakeAi.handleUploadAiImageToStorage(mockUploadReq, mockUploadRes, () => {});
    assert.ok(uploadResData?.done, "Upload response must be done: true");
    assert.ok(uploadResData?.url, "Must return uploaded image URL");
    console.log("   [PASS] AI Base64 image successfully converted & uploaded to storage:", uploadResData.url);

    console.log("\n=== ALL 5/5 PHASE 5 INTAKE & IMAGE STUDIO TESTS PASSED SUCCESSFULLY ===\n");
  } finally {
    await conn.dropDatabase();
    await conn.close();
  }
}

runPhase5Suite().catch((err) => {
  console.error("❌ Phase 5 Test Suite Failed:", err);
  process.exit(1);
});
