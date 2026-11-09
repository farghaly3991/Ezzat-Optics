/**
 * Phase D — Expenses, Recurring Expenses & Manual/Offline Sales Interface
 */

const expensesService = require("./expensesService");
const { EXPENSE_CATEGORIES } = require("../shared/constants");

let registeredExpensesProvider = expensesService;

function registerExpensesProvider(provider) {
  registeredExpensesProvider = provider;
}

function isExpensesPhaseActive() {
  return Boolean(registeredExpensesProvider && registeredExpensesProvider.implemented === true);
}

module.exports = {
  EXPENSE_CATEGORIES,
  registerExpensesProvider,
  isExpensesPhaseActive,
  expensesService
};
