/**
 * Geographic Address Coverage & Shipping Intelligence Engine
 * Normalizes Arabic/English geographical terms, matches Egypt dictionary, and evaluates shipping class eligibility.
 */

const addressCoverageService = require("../finance/shipping/addressCoverageService");

module.exports = {
  normalizeGeoText: addressCoverageService.normalizeGeoText,
  extractMeaningfulTokens: addressCoverageService.extractMeaningfulTokens,
  detectDictionaryLocations: addressCoverageService.detectDictionaryLocations,
  buildClassCoverageIndex: addressCoverageService.buildClassCoverageIndex,
  scoreClassAgainstAddress: addressCoverageService.scoreClassAgainstAddress,
  classifyCustomerAddress: addressCoverageService.classifyCustomerAddress,
  validateShippingClassForAddress: addressCoverageService.validateShippingClassForAddress
};
