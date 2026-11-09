/**
 * Automated Verification Suite for Unified Commerce Intelligence Utilities
 */

const assert = require("assert");
const commerceIntelligence = require("../modules/commerce-intelligence");

async function runTests() {
  console.log("=== Starting Unified Commerce Intelligence Utilities Verification ===");

  // 1. Geographic Address Intelligence
  console.log("\n[Test 1] Verify Geographic Address Intelligence & Normalization...");
  const norm1 = commerceIntelligence.normalizeGeoText("محافظة الإسْكَنْدَرِيَّة");
  assert(norm1.includes("اسكندريه"), "Alef and diacritics should be normalized");

  const detected = commerceIntelligence.detectDictionaryLocations("شارع التحرير، الدقي، الجيزة");
  assert(detected.governorateKeys.includes("giza"), "Should detect Giza governorate key");
  assert(detected.matchedCities.includes("الدقي") || detected.matchedCities.some(c => c.includes("دقي")), "Should detect Dokki");

  const tokens = commerceIntelligence.extractMeaningfulTokens("مدينة 6 أكتوبر حي المتميز في محافظة الجيزة");
  assert(Array.isArray(tokens), "Tokens must be array");
  assert(tokens.length > 0, "Meaningful tokens must not be empty");
  console.log("✓ Test 1 Passed: Geographic normalization and dictionary detections verified.");

  // 2. Order Risk & Anti-Fraud Intelligence
  console.log("\n[Test 2] Verify Order Risk & Anti-Fraud Assessment...");
  
  // Fake safe order
  const safeAssessment = await commerceIntelligence.assessOrderRisk("mock_subdomain", {
    phone: "01000000001",
    total: 450,
    paymentMethod: "visa",
    city: "القاهرة",
    address: "15 شارع مصدق، الدقي"
  });

  assert.strictEqual(safeAssessment.riskLevel, "low");
  assert.strictEqual(safeAssessment.recommendedAction, "auto_fulfill");
  assert.strictEqual(safeAssessment.riskScore, 0);

  // High-risk COD with vague address
  const highRiskAssessment = await commerceIntelligence.assessOrderRisk("mock_subdomain", {
    phone: "01000000002",
    total: 18000,
    paymentMethod: "cod",
    city: "",
    address: "شارع" // short / vague
  });

  assert(highRiskAssessment.riskFlags.includes("HIGH_VALUE_COD"), "Should flag high value COD");
  assert(highRiskAssessment.riskFlags.includes("VAGUE_ADDRESS"), "Should flag vague address");
  assert(highRiskAssessment.riskScore >= 50, "Risk score should be elevated");
  assert(highRiskAssessment.riskLevel === "high" || highRiskAssessment.riskLevel === "critical");
  console.log(`✓ Test 2 Passed: Order risk evaluated correctly (Score: ${highRiskAssessment.riskScore}, Level: ${highRiskAssessment.riskLevel}).`);

  // 3. Stock Velocity & Inventory Replenishment
  console.log("\n[Test 3] Verify Stock Velocity & Depletion Forecasting...");
  const velocity = commerceIntelligence.calculateStockVelocity(60, 30); // 2 units/day
  assert.strictEqual(velocity, 2);

  const criticalDepletion = commerceIntelligence.predictStockDepletion(4, velocity); // 4 / 2 = 2 days
  assert.strictEqual(criticalDepletion.runOutDays, 2);
  assert.strictEqual(criticalDepletion.depletionStatus, "critical");

  const oosDepletion = commerceIntelligence.predictStockDepletion(0, velocity);
  assert.strictEqual(oosDepletion.runOutDays, 0);
  assert.strictEqual(oosDepletion.depletionStatus, "out_of_stock");

  const reorderQty = commerceIntelligence.calculateSuggestedReorderQty(4, velocity, {
    supplierLeadTimeDays: 5,
    targetBufferDays: 20
  });
  // target units = 2 * (5 + 20) = 50. needed = 50 - 4 = 46.
  assert.strictEqual(reorderQty, 46);
  console.log("✓ Test 3 Passed: Inventory runout days and reorder calculations verified.");

  // 4. Supplier WhatsApp Proposal Builder
  console.log("\n[Test 4] Verify Supplier WhatsApp Proposal Builder...");
  const proposal = commerceIntelligence.buildSupplierWhatsAppProposal({
    storeName: "تكنو شوب",
    supplierName: "شركة الأهرام للتوريدات",
    items: [
      { name: "سماعة بلوتوث", sku: "HP-01", quantity: 20, costPrice: 350 },
      { name: "شاحن سريع", sku: "CH-02", quantity: 50, costPrice: 120 }
    ],
    customNote: "برجاء التأكيد قبل الساعة 3 عصراً"
  });

  assert(proposal.messageText.includes("شركة الأهرام للتوريدات"), "Proposal should mention supplier name");
  assert(proposal.messageText.includes("تكنو شوب"), "Proposal should mention store name");
  assert(proposal.messageText.includes("70 قطعة"), "Proposal should compute total units (20 + 50 = 70)");
  assert(proposal.encodedUrl.startsWith("https://api.whatsapp.com/send?text="), "Proposal should provide WhatsApp direct link");
  console.log("✓ Test 4 Passed: Supplier WhatsApp draft accurately formatted.");

  // 5. Verify Exports & Modular Structure
  console.log("\n[Test 5] Verify Grouped & Direct API Exports...");
  assert(commerceIntelligence.geoAddress, "geoAddress namespace must exist");
  assert(commerceIntelligence.orderRisk, "orderRisk namespace must exist");
  assert(commerceIntelligence.stockVelocity, "stockVelocity namespace must exist");
  console.log("✓ Test 5 Passed: All namespaces cleanly exported.");

  console.log("\n🎉 ALL COMMERCE INTELLIGENCE TESTS PASSED SUCCESSFULLY! (5/5)");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
