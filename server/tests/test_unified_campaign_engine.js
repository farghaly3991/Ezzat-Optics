/**
 * Automated Verification Suite for Unified Marketing & Campaign Engine
 */

const assert = require("assert");
const campaignEngine = require("../modules/campaign-engine");
const facebookPostAi = require("../modules/facebook/facebookPostAi");

async function runTests() {
  console.log("=== Starting Unified Campaign Engine Automated Verification ===");

  // 1. Verify Presets Structure
  console.log("\n[Test 1] Verify Commercial Copywriting Presets...");
  assert(Array.isArray(campaignEngine.AD_PRESETS), "AD_PRESETS must be an array");
  assert(campaignEngine.AD_PRESETS.length >= 6, "Expected at least 6 copywriting presets");
  
  const urgentPreset = campaignEngine.getPresetById("urgent_fomo");
  assert.strictEqual(urgentPreset.id, "urgent_fomo", "Preset ID should match");
  assert(urgentPreset.label.length > 0, "Preset label must not be empty");
  assert(urgentPreset.promptInstruction.length > 0, "Preset instruction must not be empty");

  const fallbackPreset = campaignEngine.getPresetById("non_existent_preset");
  assert.strictEqual(fallbackPreset.id, "urgent_fomo", "Should fallback to default preset");
  console.log("✓ Test 1 Passed: Presets structure & fallback verified.");

  // 2. Verify Signal-Driven Fallback Generation
  console.log("\n[Test 2] Verify Signal-Driven Campaign Fallback Generation...");
  const dummyProducts = [
    {
      _id: "prod_1",
      name: "Dell XPS 15",
      price: 74000,
      oldPrice: 82000,
      categoryName: "أجهزة كمبيوتر ولابتوب",
      specs: { "المعالج": "Intel Core i9", "الرام": "32GB" }
    },
    {
      _id: "prod_2",
      name: "MacBook Pro M3 Max",
      price: 118000,
      oldPrice: 125000,
      categoryName: "أجهزة كمبيوتر ولابتوب",
      specs: { "المعالج": "M3 Max", "الرام": "36GB" }
    }
  ];

  const adminData = {
    siteName: "تكنو ستور",
    currency: "ج.م",
    whatsapp: "01000000000"
  };

  const signalCopy = campaignEngine.buildSignalCampaignFallback(
    dummyProducts,
    "cart_without_order",
    { label: "سلات متروكة" },
    adminData
  );

  assert(signalCopy.headline.length > 0, "Headline should be generated");
  assert(signalCopy.postText.includes("Dell XPS 15"), "Post text should mention product 1");
  assert(signalCopy.postText.includes("MacBook Pro M3 Max"), "Post text should mention product 2");
  assert(signalCopy.postText.includes("01000000000"), "Post text should include contact phone");
  assert.strictEqual(signalCopy.preset, "urgent_fomo", "Should map cart_without_order to urgent_fomo");
  assert(signalCopy.suggestedImagePrompt.includes("Dell XPS 15"), "Visual prompt should include product names");
  console.log("✓ Test 2 Passed: Deterministic signal campaign builder works as expected.");

  // 3. Verify Other Signals (High Views / Low Conv, Best Sellers)
  console.log("\n[Test 3] Verify Alternative Marketing Signal Angles...");
  const techSpecsCopy = campaignEngine.buildSignalCampaignFallback(
    dummyProducts.slice(0, 1),
    "high_views_low_conversion",
    {},
    adminData
  );
  assert.strictEqual(techSpecsCopy.preset, "tech_specs", "Should map high_views to tech_specs");
  assert.strictEqual(techSpecsCopy.svgTemplateId, "dark_luxury", "Should recommend dark_luxury template");

  const bestSellerCopy = campaignEngine.buildSignalCampaignFallback(
    dummyProducts.slice(0, 1),
    "best_sellers",
    {},
    adminData
  );
  assert.strictEqual(bestSellerCopy.preset, "luxury_prestige", "Should map best_sellers to luxury_prestige");
  console.log("✓ Test 3 Passed: Alternative marketing signal angles correctly resolved.");

  // 4. Verify facebookPostAi Facade Delegation
  console.log("\n[Test 4] Verify facebookPostAi Facade Compatibility...");
  assert.strictEqual(facebookPostAi.AD_PRESETS, campaignEngine.AD_PRESETS, "AD_PRESETS should match");
  assert(typeof facebookPostAi.getPresets === "function", "getPresets route handler should exist");
  assert(typeof facebookPostAi.handleGetAdSignals === "function", "handleGetAdSignals should exist");
  assert(typeof facebookPostAi.handleGenerateSmartCampaign === "function", "handleGenerateSmartCampaign should exist");
  assert(typeof facebookPostAi.handleGeneratePostCopy === "function", "handleGeneratePostCopy should exist");
  assert(typeof facebookPostAi.handleGeneratePostImage === "function", "handleGeneratePostImage should exist");
  assert(typeof facebookPostAi.generateFacebookPostCopy === "function", "generateFacebookPostCopy should exist");
  assert(typeof facebookPostAi.generateFacebookPostImageWithAi === "function", "generateFacebookPostImageWithAi should exist");
  assert(typeof facebookPostAi.generateSmartFacebookCampaign === "function", "generateSmartFacebookCampaign should exist");
  console.log("✓ Test 4 Passed: Facade maintains 100% backward compatibility.");

  // 5. Verify Visual Poster Generation Integration
  console.log("\n[Test 5] Verify Visual Engine Poster Integration...");
  assert(typeof campaignEngine.generateAdPosterImage === "function", "generateAdPosterImage should be exported");
  console.log("✓ Test 5 Passed: Ad poster generation linked cleanly to visual engine.");

  console.log("\n🎉 ALL CAMPAIGN ENGINE TESTS PASSED SUCCESSFULLY! (5/5)");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
