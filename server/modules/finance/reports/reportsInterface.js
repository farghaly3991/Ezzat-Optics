/**
 * Phase E — Financial Reporting Interface
 */

const reportsService = require("./reportsService");

let registeredReportsProvider = reportsService;

function registerReportsProvider(provider) {
  registeredReportsProvider = provider;
}

function isReportsPhaseActive() {
  return Boolean(registeredReportsProvider && registeredReportsProvider.implemented === true);
}

module.exports = {
  registerReportsProvider,
  isReportsPhaseActive,
  reportsService
};
