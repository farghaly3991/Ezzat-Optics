/**
 * Core Analytics Aggregator Engine
 * Encapsulates multi-tenant database aggregations for events, orders, rankings, and marketing signals.
 */

const analyticsService = require("../analytics/analyticsService");

module.exports = {
  getStoreOverviewAnalytics: analyticsService.getStoreOverviewAnalytics,
  getTimeSeriesAnalytics: analyticsService.getTimeSeriesAnalytics,
  getFunnelAnalytics: analyticsService.getFunnelAnalytics,
  getProductRankings: analyticsService.getProductRankings,
  getProductAnalyticsDetail: analyticsService.getProductAnalyticsDetail,
  getCustomerCancellationReport: analyticsService.getCustomerCancellationReport,
  getMarketingProductSignals: analyticsService.getMarketingProductSignals
};
