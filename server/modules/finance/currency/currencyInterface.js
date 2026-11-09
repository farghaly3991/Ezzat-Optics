/**
 * Phase F — Currency & Exchange-Rate Management Interface
 */

const currencyService = require("./currencyService");
const { validateCurrencyCode } = require("../shared/validators");

let registeredCurrencyProvider = currencyService;

function registerCurrencyProvider(provider) {
  registeredCurrencyProvider = provider;
}

function isCurrencyPhaseActive() {
  return Boolean(registeredCurrencyProvider && registeredCurrencyProvider.implemented === true);
}

/**
 * Resolve currency and exchange rate snapshot for a transaction.
 */
async function resolveCurrencySnapshot(
  subdomain,
  requestedCurrency = "EGP",
  baseCurrency = "EGP",
  explicitExchangeRate = null
) {
  const cleanRequested = validateCurrencyCode(requestedCurrency || baseCurrency || "EGP");
  const cleanBase = validateCurrencyCode(baseCurrency || "EGP");

  if (cleanRequested === cleanBase) {
    return {
      currency: cleanBase,
      originalCurrency: cleanRequested,
      baseCurrency: cleanBase,
      exchangeRate: 1,
      effectiveDate: new Date(),
      rateSource: "base_currency"
    };
  }

  if (explicitExchangeRate !== null && explicitExchangeRate !== undefined && Number(explicitExchangeRate) > 0) {
    return {
      currency: cleanBase,
      originalCurrency: cleanRequested,
      baseCurrency: cleanBase,
      exchangeRate: Number(explicitExchangeRate),
      effectiveDate: new Date(),
      rateSource: "transaction_explicit_rate"
    };
  }

  if (isCurrencyPhaseActive() && typeof registeredCurrencyProvider.resolveRate === "function") {
    const resolved = await registeredCurrencyProvider.resolveRate(subdomain, cleanRequested, cleanBase);
    return {
      currency: cleanBase,
      originalCurrency: cleanRequested,
      baseCurrency: cleanBase,
      exchangeRate: resolved.exchangeRate,
      effectiveDate: resolved.effectiveDate || new Date(),
      rateSource: resolved.rateSource || "manual"
    };
  }

  return {
    currency: cleanRequested,
    originalCurrency: cleanRequested,
    baseCurrency: cleanBase,
    exchangeRate: 1,
    effectiveDate: new Date(),
    rateSource: "default"
  };
}

module.exports = {
  registerCurrencyProvider,
  isCurrencyPhaseActive,
  resolveCurrencySnapshot,
  currencyService
};
