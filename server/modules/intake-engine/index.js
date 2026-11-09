/**
 * Unified Catalog Ingestion & Extraction Engine
 * Centralized document parsing, category specification mapping, LLM extraction, and multimodal intake orchestration.
 */

const documentParser = require("./documentParser");
const schemaContext = require("./schemaContext");
const llmCaller = require("./llmCaller");
const catalogExtractor = require("./catalogExtractor");
const externalPromptBuilder = require("./externalPromptBuilder");
const intakeOrchestrator = require("./intakeOrchestrator");

module.exports = {
  // Document Parsing
  parseDocument: documentParser.parseDocument,

  // Category Schema Context
  getCategorySpecsContext: schemaContext.getCategorySpecsContext,

  // LLM Calling & Safe Parsing
  safeParseJson: llmCaller.safeParseJson,
  callDeepSeek: llmCaller.callDeepSeek,
  callGemini: llmCaller.callGemini,

  // Catalog Extraction & Normalization
  normalizeExtractedProducts: catalogExtractor.normalizeExtractedProducts,
  extractProductsForCategory: catalogExtractor.extractProductsForCategory,

  // External Prompt Generator
  generateExternalPromptForCategory: externalPromptBuilder.generateExternalPromptForCategory,

  // High-Level Intake Orchestration
  processDocumentIntake: intakeOrchestrator.processDocumentIntake,
  processVoiceIntake: intakeOrchestrator.processVoiceIntake
};
