/**
 * Unified Theme & Styling Engine
 * Centralized design system generator, 30 master presets library, WCAG contrast calculation, and CSS compiler.
 */

const presetCatalog = require("./presetCatalog");
const colorLuminance = require("./colorLuminance");
const designTokensValidator = require("./designTokensValidator");
const themePromptBuilder = require("./themePromptBuilder");
const themeGenerator = require("./themeGenerator");
const cssThemeCompiler = require("./cssThemeCompiler");

module.exports = {
  // Presets Catalog
  getAllPresets: presetCatalog.getAllPresets,
  getPresetById: presetCatalog.getPresetById,
  getPresetsByCategory: presetCatalog.getPresetsByCategory,
  findPresetByMoodOrKeywords: presetCatalog.findPresetByMoodOrKeywords,
  isPresetDark: presetCatalog.isPresetDark,
  CATEGORY_MAP: presetCatalog.CATEGORY_MAP,

  // AI Theme Generation
  generateThemeWithAi: themeGenerator.generateThemeWithAi,
  buildExternalHelperPrompt: themePromptBuilder.buildExternalHelperPrompt,

  // Token Normalization & Accessibility
  normalizeThemeTokens: designTokensValidator.normalizeThemeTokens,
  VALID_CARD_ARCHETYPES: designTokensValidator.VALID_CARD_ARCHETYPES,
  VALID_FONTS: designTokensValidator.VALID_FONTS,

  // Contrast & Luminance (WCAG 2.1)
  getContrastTextColor: colorLuminance.getContrastTextColor,
  getContrastRatio: colorLuminance.getContrastRatio,
  isDarkColor: colorLuminance.isDarkColor,
  parseColorToRgb: colorLuminance.parseColorToRgb,
  sanitizeHex: colorLuminance.sanitizeHex,

  // CSS Compiler
  compileThemeToCss: cssThemeCompiler.compileThemeToCss
};
