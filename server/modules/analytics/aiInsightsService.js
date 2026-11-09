/**
 * Analytics Orchestration & AI Store Insights Service
 * Delegating facade over the Unified Analytics Intelligence Engine.
 */

const analyticsEngine = require("../analytics-engine");

module.exports = {
  buildOrchestratedAnalyticsSummary: analyticsEngine.buildOrchestratedAnalyticsSummary,
  buildRuleBasedStructuredInsights: analyticsEngine.buildRuleBasedStructuredInsights,
  generateStoreInsights: analyticsEngine.generateStoreInsights,
  getLastSavedStoreInsights: analyticsEngine.getLastSavedStoreInsights
};
