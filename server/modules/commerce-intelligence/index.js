/**
 * Unified Commerce Intelligence & Operational Utilities
 * Bundles geographic shipping address intelligence, order fraud/cancellation risk evaluation,
 * and inventory velocity replenishment into a unified suite.
 */

const geoAddressIntelligence = require("./geoAddressIntelligence");
const orderRiskIntelligence = require("./orderRiskIntelligence");
const stockVelocityProcurement = require("./stockVelocityProcurement");

module.exports = {
  // Grouped namespaces
  geoAddress: geoAddressIntelligence,
  orderRisk: orderRiskIntelligence,
  stockVelocity: stockVelocityProcurement,

  // Direct Geographic Utilities
  normalizeGeoText: geoAddressIntelligence.normalizeGeoText,
  extractMeaningfulTokens: geoAddressIntelligence.extractMeaningfulTokens,
  detectDictionaryLocations: geoAddressIntelligence.detectDictionaryLocations,
  classifyCustomerAddress: geoAddressIntelligence.classifyCustomerAddress,
  validateShippingClassForAddress: geoAddressIntelligence.validateShippingClassForAddress,

  // Direct Order Risk & Fraud Utilities
  assessOrderRisk: orderRiskIntelligence.assessOrderRisk,
  RISK_THRESHOLDS: orderRiskIntelligence.RISK_THRESHOLDS,

  // Direct Stock Velocity & Reorder Utilities
  calculateStockVelocity: stockVelocityProcurement.calculateStockVelocity,
  predictStockDepletion: stockVelocityProcurement.predictStockDepletion,
  calculateSuggestedReorderQty: stockVelocityProcurement.calculateSuggestedReorderQty,
  buildSupplierWhatsAppProposal: stockVelocityProcurement.buildSupplierWhatsAppProposal
};
