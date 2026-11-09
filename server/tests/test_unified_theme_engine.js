/**
 * Automated Verification Suite for Unified Theme & Styling Engine
 */

const assert = require("assert");
const themeEngine = require("../modules/theme-engine");
const aiTheme = require("../modules/theme/aiTheme");
const standardTheme = require("../modules/theme/standardTheme");

async function runTests() {
  console.log("=== Starting Unified Theme & Styling Engine Automated Verification ===");

  // 1. Verify Presets Catalog
  console.log("\n[Test 1] Verify 30 Master Presets Catalog...");
  const allPresets = themeEngine.getAllPresets();
  assert(Array.isArray(allPresets), "allPresets must be an array");
  assert.strictEqual(allPresets.length, 30, `Expected exactly 30 presets, got ${allPresets.length}`);

  const cyberPreset = themeEngine.getPresetById("cyberpunk-neon");
  assert(cyberPreset, "Should find cyberpunk-neon preset by ID");
  assert.strictEqual(cyberPreset.id, "cyberpunk-neon");
  assert(cyberPreset.name.length > 0, "Preset name must not be empty");
  console.log("✓ Test 1 Passed: Presets catalog loaded 30 master presets successfully.");

  // 2. Verify Category Filtering
  console.log("\n[Test 2] Verify Category Filtering...");
  const darkPresets = themeEngine.getPresetsByCategory("dark");
  assert(darkPresets.length > 0, "Dark presets should not be empty");
  darkPresets.forEach((p) => {
    assert(themeEngine.isPresetDark(p), "Each preset in dark category must be dark");
  });

  const lightPresets = themeEngine.getPresetsByCategory("light");
  assert(lightPresets.length > 0, "Light presets should not be empty");
  lightPresets.forEach((p) => {
    assert(!themeEngine.isPresetDark(p), "Each preset in light category must not be dark");
  });
  console.log(`✓ Test 2 Passed: Category filtering verified (${darkPresets.length} dark, ${lightPresets.length} light).`);

  // 3. Verify Semantic Keyword Mood Matching
  console.log("\n[Test 3] Verify Semantic Mood & Keyword Matching...");
  const neonMatch = themeEngine.findPresetByMoodOrKeywords("أريد ثيم نيون مستقبلي جيمنج");
  assert.strictEqual(neonMatch.id, "cyberpunk-neon", "Should match cyberpunk-neon for gaming/neon prompt");

  const goldMatch = themeEngine.findPresetByMoodOrKeywords("متجر عطور ملكي فخم باللون الذهبي");
  assert.strictEqual(goldMatch.id, "royal-academic", "Should match royal-academic for luxury gold prompt");

  const greenMatch = themeEngine.findPresetByMoodOrKeywords("منتجات عضوية وطبيعية خضراء واحة");
  assert.strictEqual(greenMatch.id, "emerald-oasis", "Should match emerald-oasis for organic green prompt");
  console.log("✓ Test 3 Passed: Semantic mood matching correctly resolved multiple Arabic prompts.");

  // 4. Verify WCAG Contrast & Luminance Engine
  console.log("\n[Test 4] Verify WCAG Contrast & Luminance Engine...");
  const whiteOnBlack = themeEngine.getContrastTextColor("#000000");
  assert.strictEqual(whiteOnBlack, "#ffffff", "Contrast text on black should be white");

  const darkOnWhite = themeEngine.getContrastTextColor("#ffffff");
  assert.strictEqual(darkOnWhite, "#0f172a", "Contrast text on white should be dark");

  const ratio = themeEngine.getContrastRatio("#ffffff", "#000000");
  assert(ratio >= 20, "Contrast ratio between pure white and pure black should be ~21:1");

  assert.strictEqual(themeEngine.isDarkColor("#0f172a"), true, "#0f172a should be detected as dark");
  assert.strictEqual(themeEngine.isDarkColor("#f8fafc"), false, "#f8fafc should be detected as light");
  console.log("✓ Test 4 Passed: WCAG contrast calculation and luminance checks confirmed.");

  // 5. Verify Token Normalization & Accessibility Injection
  console.log("\n[Test 5] Verify Token Normalization & Contrast Ingestion...");
  const rawTokenObj = {
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    highlightColor: "#f59e0b",
    accentColor: "#10b981",
    fontFamily: "Alexandria",
    cardArchetype: "glassmorphic-modern"
  };

  const normalized = themeEngine.normalizeThemeTokens(rawTokenObj);
  assert.strictEqual(normalized.primaryColor, "#2563eb");
  assert.strictEqual(normalized.fontFamily, "Alexandria");
  assert.strictEqual(normalized.primaryContrast, "#ffffff", "Primary contrast should be auto-computed");
  assert.strictEqual(normalized.colors.primary, "#2563eb");
  assert(normalized.globalBg && normalized.cardContainer && normalized.buttons, "Missing structures should be hydrated");
  console.log("✓ Test 5 Passed: Token normalizer safely handles and enriches token objects.");

  // 6. Verify CSS Compilation
  console.log("\n[Test 6] Verify CSS Theme Compiler...");
  const css = themeEngine.compileThemeToCss(normalized);
  assert(css.includes(":root"), "CSS should declare :root");
  assert(css.includes("--color-primary: #2563eb;"), "CSS should declare --color-primary");
  assert(css.includes("--font-family-store: 'Alexandria', sans-serif;"), "CSS should declare font family");
  assert(css.includes("--color-primary-contrast: #ffffff;"), "CSS should declare contrast variable");
  console.log("✓ Test 6 Passed: CSS theme compiler produces complete CSS custom properties.");

  // 7. Verify Theme Generation & Fallback
  console.log("\n[Test 7] Verify Theme Generator with Curated Fallback...");
  const generated = await themeEngine.generateThemeWithAi("متجر ساعات فخمة كلاسيك", {});
  assert(generated.done === true, "Result must have done === true");
  assert(generated.theme && generated.theme.primaryColor, "Result must include valid theme tokens");
  assert(typeof generated.helperPrompt === "string" && generated.helperPrompt.length > 0, "Helper prompt must be included");
  console.log(`✓ Test 7 Passed: Theme generator responded via [${generated.engine}].`);

  console.log("\n🎉 ALL THEME ENGINE TESTS PASSED SUCCESSFULLY! (7/7)");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
