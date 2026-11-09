/**
 * Automated test suite for AI Market Competitor Intelligence & Dynamic Pricing Module
 */
const assert = require("assert");
const mongoose = require("mongoose");
const envJson = require("../env.json");
const serverModule = require("../server");
const { compareProductWithMarket } = require("../modules/market-intel/marketIntelService");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");

const TEST_SUBDOMAIN = "test_store_market_intel_" + Date.now();

function buildTenantDbUri(baseUri, dbName) {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function runTests() {
  console.log("=== STARTING AI MARKET COMPETITOR INTELLIGENCE TEST SUITE ===");

  const baseUri =
    envJson.localhost?.database ||
    process.env.DEFAULT_DB ||
    "mongodb://127.0.0.1:27017/multu_tenant_store";

  const connection = await mongoose
    .createConnection(buildTenantDbUri(baseUri, TEST_SUBDOMAIN))
    .asPromise();
  serverModule.setMongooseConnection(TEST_SUBDOMAIN, connection);

  try {
    const Products = getProductsModel(TEST_SUBDOMAIN);
    const Categories = getCategoriesModel(TEST_SUBDOMAIN);

    // 1. Setup mock Category and Product
    console.log("1. Setting up mock Category & Product with specs...");
    const cat = await Categories.create({
      name: "تكييفات",
      slug: "air-conditioners"
    });

    const testProduct = await Products.create({
      name: "تكييف كاريير 1.5 حصان اوبتيماكس انفرتر بارد فقط",
      categoryId: cat._id,
      price: 24500,
      oldPrice: 26000,
      costPrice: 19500,
      stockCount: 12,
      tags: ["كاريير", "تكييف", "انفرتر", "1.5 حصان"],
      specs: {
        "القدرة الحصانية": "1.5 حصان",
        "النوع": "بارد فقط",
        "تقنية التوفير": "انفرتر",
        "غاز التبريد": "R410A"
      },
      active: true
    });

    assert(testProduct._id, "Product should be created");
    console.log("✔ Product created with ID:", testProduct._id);

    // 2. Execute compareProductWithMarket
    console.log("2. Running compareProductWithMarket...");
    const result = await compareProductWithMarket(TEST_SUBDOMAIN, testProduct._id);

    assert(result, "Result should be defined");
    assert(result.product, "Result should contain target product details");
    assert.strictEqual(result.product.name, testProduct.name);
    assert.strictEqual(result.product.price, 24500);

    // 3. Verify Market Overview Metrics
    console.log("3. Verifying Market Overview Metrics...");
    const overview = result.marketOverview;
    assert(overview, "marketOverview must exist");
    assert(typeof overview.averagePrice === "number" && overview.averagePrice > 0, "averagePrice must be positive");
    assert(typeof overview.minPrice === "number" && overview.minPrice > 0, "minPrice must be positive");
    assert(typeof overview.maxPrice === "number" && overview.maxPrice >= overview.minPrice, "maxPrice must be >= minPrice");
    assert(typeof overview.priceDelta === "number", "priceDelta must be a number");
    assert(overview.marketPosition, "marketPosition must be defined");
    console.log("✔ Market Overview verified:", {
      avg: overview.averagePrice,
      min: overview.minPrice,
      max: overview.maxPrice,
      pos: overview.marketPosition
    });

    // 4. Verify Competitors List & Similarity Ranking
    console.log("4. Verifying Competitor Rankings & Similarity Scores...");
    const competitors = result.competitors;
    assert(Array.isArray(competitors) && competitors.length >= 2, "Should return at least 2 competitors");

    // Check descending sort by similarityScore
    for (let i = 0; i < competitors.length - 1; i++) {
      assert(
        competitors[i].similarityScore >= competitors[i + 1].similarityScore,
        "Competitors must be sorted descending by similarityScore"
      );
    }

    const first = competitors[0];
    assert(first.title, "Competitor must have a title");
    assert(first.storeName, "Competitor must have a storeName");
    assert(first.price > 0, "Competitor price must be positive");
    assert(first.similarityScore >= 10 && first.similarityScore <= 100, "similarityScore must be between 10 and 100");
    console.log("✔ Top Competitor:", {
      store: first.storeName,
      title: first.title,
      price: first.price,
      similarity: `${first.similarityScore}%`
    });

    // 5. Verify Strategic Analysis & Recommendations
    console.log("5. Verifying Strategic Analysis & Pricing Recommendations...");
    const strategic = result.strategicAnalysis;
    assert(strategic, "strategicAnalysis must exist");
    assert(typeof strategic.recommendedPrice === "number" && strategic.recommendedPrice > 0, "recommendedPrice must be positive");
    assert(strategic.pricingRationale, "pricingRationale must be provided");
    assert(Array.isArray(strategic.keyAdvantages) && strategic.keyAdvantages.length > 0, "keyAdvantages must not be empty");
    assert(Array.isArray(strategic.keyVulnerabilities) && strategic.keyVulnerabilities.length > 0, "keyVulnerabilities must not be empty");
    assert(Array.isArray(strategic.actionableTips) && strategic.actionableTips.length > 0, "actionableTips must not be empty");

    console.log("✔ Strategic Recommendations verified:", {
      recommendedPrice: strategic.recommendedPrice,
      score: strategic.competitivenessScore,
      rationalePreview: strategic.pricingRationale.slice(0, 60) + "..."
    });

    // 6. Test Applying Recommended Price to Product
    console.log("6. Testing Applying Recommended Price...");
    testProduct.oldPrice = testProduct.price;
    testProduct.price = strategic.recommendedPrice;
    await testProduct.save();

    const updatedInDb = await Products.findById(testProduct._id);
    assert.strictEqual(updatedInDb.price, strategic.recommendedPrice);
    assert.strictEqual(updatedInDb.oldPrice, 24500);
    console.log("✔ Price successfully updated in database to recommended price.");

    // Cleanup
    await connection.dropDatabase();

    console.log("\n=======================================================");
    console.log("✅ ALL AI MARKET INTEL TESTS PASSED (100% VERIFIED)!");
    console.log("=======================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
  }
}

runTests();
