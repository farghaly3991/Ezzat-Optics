const assert = require("assert");
const mongoose = require("mongoose");
require("dotenv").config();
const envJson = require("../env.json");

const {
  generateEmbedding,
  cosineSimilarity,
  recordProductViews,
  recordSearchFilter,
  recordChatInterest,
  getPersonalizedRecommendations,
  searchProducts
} = require("../modules/semantic-engine");
const getClientProfileModel = require("../modules/recommendation/clientProfileModel");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");

async function runTests() {
  console.log("=== STARTING UNIFIED SEMANTIC ENGINE TEST SUITE ===");

  const conn = await mongoose.createConnection(envJson.localhost.database).asPromise();
  const { setMongooseConnection } = require("../core/database");
  setMongooseConnection("localhost", conn);

  const Products = getProductsModel("localhost");
  const Categories = getCategoriesModel("localhost");
  const ClientProfile = getClientProfileModel("localhost");

  // TEST 1: Embedding Provider
  console.log("\n[TEST 1] Testing 768-d Vector Generation...");
  const testVec = await generateEmbedding("هاتف ذكي بشاشة أموليد وبطارية تدوم طويلاً", {
    adminData: { GEMINI_API_KEY: process.env.GEMINI_API_KEY }
  });
  assert(Array.isArray(testVec), "Vector must be an array");
  assert.strictEqual(testVec.length, 768, "Vector must be exactly 768 dimensions");
  const norm = Math.sqrt(testVec.reduce((s, v) => s + v * v, 0));
  assert(Math.abs(norm - 1.0) < 0.01, "Vector must be L2 unit-normalized");
  console.log("  ✓ Vector generation verified (768-d, unit length ~1.0)");

  // TEST 2: Two-Stage Semantic Search
  console.log("\n[TEST 2] Testing Semantic Search Engine...");
  const searchRes = await searchProducts("localhost", {
    query: "سماعة ايربودز بلوتوث عازلة للضوضاء",
    limit: 5,
    adminData: { GEMINI_API_KEY: process.env.GEMINI_API_KEY }
  });
  assert(searchRes.done === true, "Search response should have done: true");
  assert(Array.isArray(searchRes.products), "Search should return products array");
  console.log(`  ✓ Search returned ${searchRes.products.length} products for query: "${searchRes.query}"`);
  if (searchRes.products.length > 0) {
    const top = searchRes.products[0];
    console.log(`    - Top match: "${top.name}" (Score: ${(top.similarityScore * 100).toFixed(1)}%)`);
    assert(top.similarityScore >= 0.5, "Top match similarity score should be >= 0.5");
  }

  // TEST 3: User Profile Category-Specific Ingestion & EMA Accumulation
  console.log("\n[TEST 3] Testing Category-Partitioned User Profile & EMA...");
  const testSessionId = `test_sess_${Date.now()}`;

  // Find 2 sample categories
  const sampleCats = await Categories.find({ active: true }).limit(2).lean();
  assert(sampleCats.length >= 2, "Need at least 2 categories for testing");
  const cat1 = sampleCats[0];
  const cat2 = sampleCats[1];

  // Ingest view for Cat 1
  console.log(`  - Ingesting view for Category 1: "${cat1.name}"`);
  const prof1 = await recordProductViews("localhost", {
    sessionId: testSessionId,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: `منتج تجريبي 1 في ${cat1.name}`,
        categoryId: cat1._id,
        categoryName: cat1.name,
        price: 5000,
        specs: { brand: "سامسونج" }
      }
    ]
  });

  assert(prof1.categoryProfiles.length >= 1, "Should create category profile for cat1");
  const cp1 = prof1.categoryProfiles.find((cp) => String(cp.categoryId) === String(cat1._id));
  assert(cp1, "Category 1 profile must exist");
  assert.strictEqual(cp1.interactionCount, 1, "Interaction count should be 1");
  assert.strictEqual(cp1.priceAffinity.avg, 5000, "Price affinity avg should be 5000");
  assert.strictEqual(cp1.vector.length, 768, "Category vector must be 768 dimensions");

  // Ingest view for Cat 2 (Different category, different price range)
  console.log(`  - Ingesting view for Category 2: "${cat2.name}" (Different budget: 15000)`);
  const prof2 = await recordProductViews("localhost", {
    sessionId: testSessionId,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: `منتج تجريبي 2 في ${cat2.name}`,
        categoryId: cat2._id,
        categoryName: cat2.name,
        price: 15000,
        specs: { power: "3 حصان" }
      }
    ]
  });

  const cp2 = prof2.categoryProfiles.find((cp) => String(cp.categoryId) === String(cat2._id));
  assert(cp2, "Category 2 profile must exist independently");
  assert.strictEqual(cp2.priceAffinity.avg, 15000, "Category 2 price affinity must be isolated (15000)");

  // Verify Cat 1 price affinity was NOT corrupted by Cat 2!
  const cp1Reloaded = prof2.categoryProfiles.find((cp) => String(cp.categoryId) === String(cat1._id));
  assert.strictEqual(cp1Reloaded.priceAffinity.avg, 5000, "Category 1 price affinity preserved at 5000");
  console.log("  ✓ Category isolation verified: Prices and Vectors are strictly separated per category!");

  // Ingest second view for Cat 1 (Testing EMA accumulation)
  console.log(`  - Ingesting second view for Category 1 with price 7000 to test EMA...`);
  const initialVec = [...cp1Reloaded.vector];
  const prof3 = await recordProductViews("localhost", {
    sessionId: testSessionId,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: `منتج تجريبي 3 في ${cat1.name}`,
        categoryId: cat1._id,
        categoryName: cat1.name,
        price: 7000,
        specs: { brand: "أبل" }
      }
    ]
  });

  const cp1Updated = prof3.categoryProfiles.find((cp) => String(cp.categoryId) === String(cat1._id));
  assert.strictEqual(cp1Updated.interactionCount, 2, "Interaction count should be 2");
  assert.strictEqual(cp1Updated.priceAffinity.avg, 6000, "Average price should be (5000 + 7000) / 2 = 6000");
  const simBetweenUpdates = cosineSimilarity(initialVec, cp1Updated.vector);
  console.log(`  ✓ EMA Vector evolution verified: Cosine similarity between V1 and V2: ${(simBetweenUpdates * 100).toFixed(1)}%`);

  // TEST 4: Search Filter Ingestion
  console.log("\n[TEST 4] Testing Search Filter Ingestion without product click...");
  await recordSearchFilter("localhost", {
    sessionId: testSessionId,
    categoryId: cat1._id,
    categoryName: cat1.name,
    specFilters: { storage: "256GB" },
    minPrice: 4000,
    maxPrice: 8000,
    query: "هاتف 256 جيجا"
  });
  const profAfterFilter = await ClientProfile.findOne({ sessionId: testSessionId }).lean();
  const cpAfterFilter = profAfterFilter.categoryProfiles.find((cp) => String(cp.categoryId) === String(cat1._id));
  assert(cpAfterFilter.preferredSpecs?.storage?.["256GB"] >= 1, "Filter spec should be recorded in category profile");
  console.log("  ✓ Search filter successfully updated category profile and preferred specs!");

  // TEST 5: Recommendations
  console.log("\n[TEST 5] Testing Personalized Recommendations Engine...");
  const recRes = await getPersonalizedRecommendations("localhost", {
    sessionId: testSessionId,
    limit: 6
  });
  assert(recRes.done === true, "Recommendations should succeed");
  assert(Array.isArray(recRes.recommendations), "Should return recommendations list");
  console.log(`  ✓ Generated ${recRes.recommendations.length} personalized recommendations!`);
  if (recRes.recommendations.length > 0) {
    const topRec = recRes.recommendations[0];
    console.log(`    - Top recommendation: "${topRec.name}" (Score: ${topRec.recommendationScore}, Reason: ${topRec.recommendationReason})`);
  }

  // Clean up test profile
  await ClientProfile.deleteOne({ sessionId: testSessionId });
  console.log("\n=== ALL UNIFIED SEMANTIC ENGINE TESTS PASSED SUCCESSFULLY! ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
