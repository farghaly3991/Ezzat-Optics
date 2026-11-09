/**
 * Phase E4 — Double-Entry Accounting Interface
 */

const accountingService = require("./accountingService");
const { ACCOUNT_TYPES } = require("../shared/constants");

let registeredAccountingProvider = accountingService;

function registerAccountingProvider(provider) {
  registeredAccountingProvider = provider;
}

function isAccountingPhaseActive() {
  return Boolean(registeredAccountingProvider && registeredAccountingProvider.implemented === true);
}

module.exports = {
  STANDARD_ACCOUNT_TYPES: ACCOUNT_TYPES,
  registerAccountingProvider,
  isAccountingPhaseActive,
  accountingService
};
