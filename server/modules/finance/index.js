/**
 * Finance Module Public Entry Point (Phases A–F)
 */

const financeRoutes = require("./routes");
const capabilityRegistry = require("./core/settings/capabilityRegistry");
const financeSettingsService = require("./core/settings/financeSettingsService");
const shippingCalculatorService = require("./shipping/shippingCalculatorService");
const addressCoverageService = require("./shipping/addressCoverageService");
const shippingService = require("./shipping/shippingService");
const procurementService = require("./procurement/procurementService");
const inventoryService = require("./inventory/inventoryService");
const expensesService = require("./expenses/expensesService");
const reportsService = require("./reports/reportsService");
const accountingService = require("./accounting/accountingService");
const currencyService = require("./currency/currencyService");
const paymentService = require("./core/payments/paymentService");
const balanceService = require("./core/balances/balanceService");
const auditService = require("./core/audit/auditService");
const financeEventBus = require("./core/events/financeEventBus");

module.exports = {
  financeRoutes,
  capabilityRegistry,
  financeSettingsService,
  shippingCalculatorService,
  addressCoverageService,
  shippingService,
  procurementService,
  inventoryService,
  expensesService,
  reportsService,
  accountingService,
  currencyService,
  paymentService,
  balanceService,
  auditService,
  financeEventBus
};
