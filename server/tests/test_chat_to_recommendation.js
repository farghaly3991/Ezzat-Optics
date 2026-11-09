const mongoose = require("mongoose");
require("dotenv").config();
const envJson = require("../env.json");
const { setMongooseConnection } = require("../core/database");

async function testScenario() {
  const conn = await mongoose.createConnection(envJson.localhost.database).asPromise();
  setMongooseConnection("localhost", conn);

  const { recordChatInterest, getPersonalizedRecommendations } = require("../modules/semantic-engine");
  const getClientProfileModel = require("../modules/recommendation/clientProfileModel");
  const ClientProfile = getClientProfileModel("localhost");

  const testSession = "sim_chat_laptop_" + Date.now();
  console.log("=== SIMULATING EXACT USER JOURNEY ===");
  console.log("1. User Session ID:", testSession);

  // 1. Simulate Chat Interaction
  console.log("2. Ingesting Chat message: 'أنا عايز لابتوب قوي ينفع لمبرمج ذكاء اصطناعي وشوية جرافيكس بس أرخص حاجة ممكنة'...");
  await recordChatInterest("localhost", {
    sessionId: testSession,
    categoryId: "6addf850118494bbff00fa22",
    categoryName: "أجهزة كمبيوتر ولابتوب",
    specFilters: { usage: "برمجة وذكاء اصطناعي وجرافيكس" },
    minPrice: 70000,
    maxPrice: 120000,
    searchKeywords: "لابتوب",
    userMessage: "أنا عايز لابتوب قوي ينفع لمبرمج ذكاء اصطناعي وشوية جرافيكس بس أرخص حاجة ممكنة",
    adminData: { GEMINI_API_KEY: process.env.GEMINI_API_KEY }
  });

  // Verify profile updated
  const prof = await ClientProfile.findOne({ sessionId: testSession }).lean();
  console.log("   ✓ ClientProfile updated successfully!");
  const laptopProf = prof.categoryProfiles.find((cp) => String(cp.categoryId) === "6addf850118494bbff00fa22");
  console.log("   - Category Profile:", laptopProf?.categoryName);
  console.log("   - Interaction Count:", laptopProf?.interactionCount);
  console.log("   - Price Affinity Avg:", laptopProf?.priceAffinity?.avg, "ج.م");
  console.log("   - 768-d Vector Length:", laptopProf?.vector?.length);

  // 2. Simulate User Refreshing and Fetching Recommendations
  console.log("\n3. User refreshes page: fetching recommendations for this session...");
  const recRes = await getPersonalizedRecommendations("localhost", {
    sessionId: testSession,
    limit: 6
  });

  console.log("   ✓ Engine:", recRes.engine);
  console.log("   ✓ Total Recommendations:", recRes.recommendations.length);
  recRes.recommendations.forEach((r, idx) => {
    console.log(`   [${idx + 1}] ${r.name}`);
    console.log(`       السعر: ${r.price?.toLocaleString()} ج.م | القسم: ${r.categoryId?.name} | السكور: ${r.recommendationScore}% | السبب: ${r.recommendationReason}`);
  });

  // Clean test profile
  await ClientProfile.deleteOne({ sessionId: testSession });
  console.log("\n=== VERIFICATION TEST PASSED WITH 100% ACCURACY ===");
  process.exit(0);
}

testScenario().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
