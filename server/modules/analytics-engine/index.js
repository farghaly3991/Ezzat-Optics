/**
 * Unified Analytics Intelligence Engine
 * Comprehensive analytics platform: multi-tenant log aggregations, cross-entity relationships,
 * graph data formatters, and evidence-backed AI store insights.
 */

const metricDefinitions = require("./metricDefinitions");
const coreAggregator = require("./coreAggregator");
const relationshipIntelligence = require("./relationshipIntelligence");
const graphDataFormatter = require("./graphDataFormatter");
const aiInsightsProvider = require("./aiInsightsProvider");

module.exports = {
  // Metric Definitions & Utilities
  TIMEZONE: metricDefinitions.TIMEZONE,
  ABANDONMENT_WINDOW_MS: metricDefinitions.ABANDONMENT_WINDOW_MS,
  METRIC_DEFINITIONS: metricDefinitions.METRIC_DEFINITIONS,
  safeRate: metricDefinitions.safeRate,
  computeDelta: metricDefinitions.computeDelta,
  parseDateRange: metricDefinitions.parseDateRange,

  // Core Multi-Tenant Aggregations
  getStoreOverviewAnalytics: coreAggregator.getStoreOverviewAnalytics,
  getTimeSeriesAnalytics: coreAggregator.getTimeSeriesAnalytics,
  getFunnelAnalytics: coreAggregator.getFunnelAnalytics,
  getProductRankings: coreAggregator.getProductRankings,
  getProductAnalyticsDetail: coreAggregator.getProductAnalyticsDetail,
  getCustomerCancellationReport: coreAggregator.getCustomerCancellationReport,
  getMarketingProductSignals: coreAggregator.getMarketingProductSignals,

  // Latent Relationship Intelligence (Co-occurrences, Price Elasticity, Journey Bottlenecks)
  analyzeProductAffinity: relationshipIntelligence.analyzeProductAffinity,
  analyzePriceElasticity: relationshipIntelligence.analyzePriceElasticity,
  analyzeDropOffFriction: relationshipIntelligence.analyzeDropOffFriction,

  // Graph & Chart Formatters
  formatTimeSeriesGraph: graphDataFormatter.formatTimeSeriesGraph,
  formatFunnelGraph: graphDataFormatter.formatFunnelGraph,
  formatCategoryDistributionGraph: graphDataFormatter.formatCategoryDistributionGraph,
  formatPriceVsConversionScatter: graphDataFormatter.formatPriceVsConversionScatter,

  // AI Store Insights Orchestration
  generateStoreInsights: aiInsightsProvider.generateStoreInsights,
  buildOrchestratedAnalyticsSummary: aiInsightsProvider.buildOrchestratedAnalyticsSummary,
  buildRuleBasedStructuredInsights: aiInsightsProvider.buildRuleBasedStructuredInsights,
  getLastSavedStoreInsights: aiInsightsProvider.getLastSavedStoreInsights
};
