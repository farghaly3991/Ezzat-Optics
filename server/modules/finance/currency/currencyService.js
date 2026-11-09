/**
 * Phase F — Purchase Currency, Exchange Rates & Replacement Cost Recalculation Service
 *
 * Implements:
 * - F1: Historical purchase currency & exchange-rate snapshots on supplier shipments and purchase lines.
 *       Never infers historical exchange rates from today's rate.
 * - F2: Manual exchange-rate entry, rate history, and configurable update policies
 *       (`both`, `increases_only`, `decreases_only`, `manual_only`).
 *       Never uses an LLM or unverified web search as an exchange-rate source.
 * - F3: Preview and admin-confirmed application of replacement cost updates (`replacementUnitCost`)
 *       and optional proposed selling prices (`price`), while strictly preserving:
 *       - Historical order cost snapshots (`storeOrder.items.costPrice`)
 *       - Historical supplier shipment lines (`storeSupplierShipment.purchaseLines`)
 *       - Historical inventory movements (`storeInventoryMovement`)
 *       - Posted journal entries (`storeJournalEntry`)
 */

const mongoose = require("mongoose");
const getExchangeRateModel = require("./exchangeRateModel");
const getProductsModel = require("../../products/productModel");
const { getFinanceSettings, updateFinanceSettings } = require("../core/settings/financeSettingsService");
const { recordFinanceAudit } = require("../core/audit/auditService");
const {
  emitFinanceEvent,
  FINANCE_DOMAIN_EVENTS
} = require("../core/events/financeEventBus");
const { CURRENCY_COST_UPDATE_POLICIES } = require("../shared/constants");
const {
  createFinanceError,
  roundMoney,
  validatePositiveAmount,
  validateCurrencyCode,
  validateOptionalDate
} = require("../shared/validators");

/**
 * Resolve active exchange rate for `fromCurrency -> toCurrency` as of now (for new transactions).
 * Historical transactions always store and use their own `exchangeRateUsed` snapshot!
 */
async function resolveRate(subdomain, fromCurrency = "EGP", toCurrency = "EGP") {
  const cleanFrom = validateCurrencyCode(fromCurrency || "EGP");
  const cleanTo = validateCurrencyCode(toCurrency || "EGP");

  if (cleanFrom === cleanTo) {
    return {
      currency: cleanFrom,
      baseCurrency: cleanTo,
      exchangeRate: 1,
      effectiveDate: new Date(),
      rateSource: "base_currency"
    };
  }

  const ExchangeRate = getExchangeRateModel(subdomain);
  const latest = await ExchangeRate.findOne({
    fromCurrency: cleanFrom,
    toCurrency: cleanTo,
    isActiveLatest: true
  })
    .sort({ effectiveDate: -1, createdAt: -1 })
    .lean();

  if (!latest) {
    throw createFinanceError(
      `لا يوجد سعر صرف مسجل للعملة (${cleanFrom} -> ${cleanTo}). يرجى تسجيل سعر الصرف أولاً أو تحديد سعر الصرف للعملية.`,
      400,
      "EXCHANGE_RATE_NOT_FOUND"
    );
  }

  return {
    currency: cleanFrom,
    baseCurrency: cleanTo,
    exchangeRate: Number(latest.rate),
    effectiveDate: latest.effectiveDate,
    rateSource: latest.source || "manual",
    providerName: latest.providerName || "إدخال إداري يدوي"
  };
}

/**
 * F2: Record a new Exchange Rate entry and optionally preview/recalculate replacement costs
 * according to the store's configured `costUpdatePolicy` (without mutating public selling prices!).
 */
async function recordExchangeRate(subdomain, payload = {}, actor = null) {
  const ExchangeRate = getExchangeRateModel(subdomain);
  const settings = await getFinanceSettings(subdomain);
  const baseCurrency = settings?.defaultCurrency || "EGP";

  const fromCurrency = validateCurrencyCode(payload.fromCurrency || payload.currency);
  const toCurrency = validateCurrencyCode(payload.toCurrency || baseCurrency);

  if (fromCurrency === toCurrency) {
    throw createFinanceError(
      `عملة المصدر (${fromCurrency}) مطابقة لعملة الأساس (${toCurrency})؛ سعر الصرف دائماً 1.0`,
      400
    );
  }

  // Reject any attempt to mark an LLM as the exchange-rate source
  const source = payload.source === "trusted_provider" ? "trusted_provider" : "manual";
  if (
    String(payload.source || "").toLowerCase().includes("llm") ||
    String(payload.source || "").toLowerCase().includes("ai")
  ) {
    throw createFinanceError(
      "لا يُسمح باستخدام نماذج الذكاء الاصطناعي (LLM) كمصدر لسعر الصرف المالي المعتمد",
      400,
      "LLM_EXCHANGE_RATE_FORBIDDEN"
    );
  }

  const rate = roundMoney(validatePositiveAmount(payload.rate, "سعر الصرف"));
  const effectiveDate = validateOptionalDate(payload.effectiveDate, "تاريخ سريان سعر الصرف") || new Date();

  const previousActive = await ExchangeRate.findOne({
    fromCurrency,
    toCurrency,
    isActiveLatest: true
  }).sort({ effectiveDate: -1, createdAt: -1 });

  const previousRate = previousActive ? Number(previousActive.rate) : null;

  if (previousActive) {
    await ExchangeRate.updateMany(
      { fromCurrency, toCurrency, isActiveLatest: true },
      { $set: { isActiveLatest: false } }
    );
  }

  const actorId = actor?._id || actor?.userId || null;

  const rateDoc = await new ExchangeRate({
    fromCurrency,
    toCurrency,
    rate,
    previousRate,
    effectiveDate,
    source,
    providerName: String(payload.providerName || "إدخال إداري يدوي").trim(),
    isActiveLatest: true,
    notes: String(payload.notes || "").trim(),
    recordedBy: actorId
  }).save();

  await recordFinanceAudit(subdomain, {
    action: "exchange_rate_recorded",
    entityType: "exchange_rate",
    entityId: String(rateDoc._id),
    referenceCode: `${fromCurrency}/${toCurrency}`,
    summary: `تحديث سعر صرف العملة (${fromCurrency} مقابل ${toCurrency}) من ${previousRate ?? "غير مسجل"} إلى ${rate}`,
    beforeState: { previousRate },
    afterState: rateDoc.toObject(),
    actor,
    activityPayload: {
      eventType: "exchange_rate_updated",
      amount: rate,
      currency: fromCurrency,
      note: `سعر صرف ${fromCurrency}/${toCurrency} = ${rate}`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.EXCHANGE_RATE_UPDATED, {
    subdomain,
    exchangeRate: rateDoc.toObject()
  });

  // Preview impact on products purchased in `fromCurrency`
  const preview = await previewExchangeRateCostImpact(subdomain, {
    fromCurrency,
    newRate: rate,
    updatePolicy: payload.updatePolicy || settings?.currencyConfig?.costUpdatePolicy || "both"
  });

  // If `autoUpdateReplacementCosts === true` is explicitly requested (and policy is not `manual_only`),
  // update `product.replacementUnitCost` ONLY — NEVER mutate `product.price` or historical snapshots!
  let appliedReplacementUpdates = null;
  const effectivePolicy =
    payload.updatePolicy || payload.policy || settings?.currencyConfig?.costUpdatePolicy || "both";
  if (payload.autoUpdateReplacementCosts === true && effectivePolicy !== "manual_only") {
    appliedReplacementUpdates = await applyApprovedCostAndPriceUpdates(
      subdomain,
      {
        fromCurrency,
        newRate: rate,
        updatePolicy: effectivePolicy,
        updateReplacementCosts: true,
        confirmSellingPriceUpdate: false // Never auto-mutate public selling prices!
      },
      actor
    );
  }

  return {
    exchangeRate: rateDoc.toObject(),
    impactPreview: preview,
    appliedReplacementUpdates
  };
}

/**
 * List current active exchange rates and historical rate log.
 */
async function listExchangeRates(subdomain, { fromCurrency = "", activeOnly = false, limit = 50 } = {}) {
  const ExchangeRate = getExchangeRateModel(subdomain);
  const settings = await getFinanceSettings(subdomain);

  const query = {};
  if (fromCurrency) {
    query.fromCurrency = validateCurrencyCode(fromCurrency);
  }
  if (activeOnly) {
    query.isActiveLatest = true;
  }

  const [activeRates, history] = await Promise.all([
    ExchangeRate.find({ isActiveLatest: true }).sort({ fromCurrency: 1 }).lean(),
    ExchangeRate.find(query)
      .sort({ effectiveDate: -1, createdAt: -1 })
      .limit(Math.min(200, Math.max(1, Number(limit || 50))))
      .lean()
  ]);

  return {
    baseCurrency: settings?.defaultCurrency || "EGP",
    currencyConfig: settings?.currencyConfig || {},
    activeRates,
    latestByCurrency: activeRates,
    history,
    externalProviderRequirementsNote:
      "ملاحظة إعداد مزود أسعار الصرف الخارجي: النظام يعمل افتراضياً بالإدخال الإداري اليدوي الموثق دون الاعتماد على أي اتصال خارجي أو نماذج ذكاء اصطناعي. لربط مزود أسعار صرف خارجي مدفوع (مثل Central Bank / Fixer / OpenExchangeRates)، يلزم تفعيله وإدخال مفتاح API الخاص بالمتجر من قِبل المدير."
  };
}

/**
 * F3: Preview the impact of a new exchange rate on replacement costs and proposed selling prices
 * for products purchased in `fromCurrency`, respecting `updatePolicy` (`both`, `increases_only`, `decreases_only`).
 */
async function previewExchangeRateCostImpact(
  subdomain,
  { fromCurrency, newRate, updatePolicy = null, policy: policyAlias = null } = {}
) {
  const Products = getProductsModel(subdomain);
  const settings = await getFinanceSettings(subdomain);

  const cleanCurrency = validateCurrencyCode(fromCurrency || "USD");
  let targetRate = newRate !== undefined && newRate !== null && newRate !== "" ? Number(newRate) : null;
  if (!targetRate || targetRate <= 0) {
    try {
      const resolved = await resolveRate(subdomain, cleanCurrency, settings?.defaultCurrency || "EGP");
      targetRate = resolved.exchangeRate;
    } catch (_) {
      targetRate = 1;
    }
  }

  const requestedPolicy = updatePolicy || policyAlias;
  const policy = CURRENCY_COST_UPDATE_POLICIES.includes(requestedPolicy)
    ? requestedPolicy
    : settings?.currencyConfig?.costUpdatePolicy || "both";

  const foreignProducts = await Products.find({
    lastPurchaseCurrency: cleanCurrency,
    lastPurchaseOriginalUnitCost: { $gt: 0 }
  })
    .sort({ name: 1 })
    .lean();

  const proposals = [];
  for (const prod of foreignProducts) {
    const originalUnitCost = Number(prod.lastPurchaseOriginalUnitCost || 0);
    const oldRate = Number(prod.lastPurchaseExchangeRate || 1);
    const historicalPurchaseCost = roundMoney(
      Number(prod.lastPurchaseCost ?? originalUnitCost * oldRate)
    );
    const oldReplacementCost = roundMoney(
      Number(prod.replacementUnitCost ?? historicalPurchaseCost)
    );
    const calculatedNewReplacementCost = roundMoney(originalUnitCost * targetRate);
    const costDelta = roundMoney(calculatedNewReplacementCost - oldReplacementCost);

    let eligibleUnderPolicy = true;
    let policySkipReason = "";
    if (policy === "increases_only" && costDelta <= 0) {
      eligibleUnderPolicy = false;
      policySkipReason = "السياسة المفعلة (increases_only) تطبق الزيادات فقط وتتجاهل الانخفاض";
    } else if (policy === "decreases_only" && costDelta >= 0) {
      eligibleUnderPolicy = false;
      policySkipReason = "السياسة المفعلة (decreases_only) تطبق الانخفاضات فقط وتتجاهل الزيادة";
    } else if (policy === "manual_only") {
      eligibleUnderPolicy = false;
      policySkipReason = "السياسة المفعلة (manual_only) تتطلب اختياراً يدوياً";
    }

    const effectiveNewReplacementCost = eligibleUnderPolicy
      ? calculatedNewReplacementCost
      : oldReplacementCost;

    const currentSellingPrice = roundMoney(Number(prod.price || 0));
    // Calculate proposed selling price that preserves the previous gross margin ratio
    let proposedSellingPrice = currentSellingPrice;
    if (oldReplacementCost > 0 && currentSellingPrice > oldReplacementCost) {
      const markupMultiplier = currentSellingPrice / oldReplacementCost;
      proposedSellingPrice = roundMoney(calculatedNewReplacementCost * markupMultiplier);
    } else if (calculatedNewReplacementCost > currentSellingPrice) {
      proposedSellingPrice = roundMoney(calculatedNewReplacementCost * 1.2);
    }

    proposals.push({
      productId: String(prod._id),
      name: prod.name,
      groupCode: prod.groupCode || "",
      originalCurrency: cleanCurrency,
      purchaseCurrency: cleanCurrency,
      originalUnitCost,
      historicalExchangeRate: oldRate,
      newExchangeRate: targetRate,
      historicalPurchaseCostSnapshot: historicalPurchaseCost,
      inventoryBookUnitCost: roundMoney(Number(prod.inventoryBookUnitCost ?? prod.costPrice ?? 0)),
      oldReplacementCost,
      currentReplacementUnitCost: oldReplacementCost,
      calculatedNewReplacementCost,
      recalculatedReplacementCost: calculatedNewReplacementCost,
      effectiveNewReplacementCost,
      costDelta,
      eligibleUnderPolicy,
      policySkipReason,
      currentSellingPrice,
      proposedSellingPrice,
      sellingPriceDelta: roundMoney(proposedSellingPrice - currentSellingPrice)
    });
  }

  return {
    fromCurrency: cleanCurrency,
    baseCurrency: settings?.defaultCurrency || "EGP",
    newExchangeRate: targetRate,
    updatePolicy: policy,
    affectedProductsCount: proposals.length,
    eligibleForUpdateCount: proposals.filter((p) => p.eligibleUnderPolicy && p.costDelta !== 0).length,
    proposals,
    items: proposals
  };
}

/**
 * F3: Apply administrator-reviewed replacement cost updates and (ONLY when explicitly confirmed)
 * approved public selling price updates.
 */
async function applyApprovedCostAndPriceUpdates(
  subdomain,
  payload = {},
  actor = null
) {
  const Products = getProductsModel(subdomain);
  const preview = await previewExchangeRateCostImpact(subdomain, {
    fromCurrency: payload.fromCurrency || payload.currency,
    newRate: payload.newRate || payload.rate,
    updatePolicy: payload.updatePolicy || payload.policy
  });

  const updateReplacementCosts =
    payload.updateReplacementCosts !== undefined
      ? payload.updateReplacementCosts !== false
      : payload.updateReplacementCost !== false;
  const confirmSellingPriceUpdate =
    payload.confirmSellingPriceUpdate === true ||
    (payload.confirmApply === true && payload.updateSellingPrice === true);
  const applyAllProposedPrices =
    payload.applyAllProposedPrices === true ||
    (payload.confirmApply === true && payload.updateSellingPrice === true);
  const approvedPricesMap = new Map();

  if (Array.isArray(payload.approvedPriceUpdates)) {
    for (const item of payload.approvedPriceUpdates) {
      if (item.productId && item.newSellingPrice !== undefined) {
        approvedPricesMap.set(
          String(item.productId),
          roundMoney(validatePositiveAmount(item.newSellingPrice, "سعر البيع الجديد المعتمد"))
        );
      }
    }
  }

  const updatedProducts = [];

  for (const prop of preview.proposals) {
    const shouldUpdateReplacement =
      updateReplacementCosts &&
      (prop.eligibleUnderPolicy || payload.forceApplyAllReplacementCosts === true) &&
      prop.calculatedNewReplacementCost !== prop.oldReplacementCost;

    const explicitApprovedPrice = approvedPricesMap.get(prop.productId);
    const shouldUpdatePrice =
      confirmSellingPriceUpdate &&
      (explicitApprovedPrice !== undefined || payload.applyAllProposedPrices === true);

    if (!shouldUpdateReplacement && !shouldUpdatePrice) {
      continue;
    }

    const prodDoc = await Products.findById(prop.productId);
    if (!prodDoc) continue;

    const beforeReplacement = prodDoc.replacementUnitCost;
    const beforePrice = prodDoc.price;

    if (shouldUpdateReplacement) {
      prodDoc.replacementUnitCost = prop.calculatedNewReplacementCost;
    }

    if (shouldUpdatePrice) {
      prodDoc.price =
        explicitApprovedPrice !== undefined
          ? explicitApprovedPrice
          : prop.proposedSellingPrice;
    }

    await prodDoc.save();

    updatedProducts.push({
      productId: String(prodDoc._id),
      name: prodDoc.name,
      oldReplacementCost: beforeReplacement,
      newReplacementCost: prodDoc.replacementUnitCost,
      oldSellingPrice: beforePrice,
      newSellingPrice: prodDoc.price,
      sellingPriceChanged: beforePrice !== prodDoc.price,
      historicalPurchaseCostPreserved: prodDoc.lastPurchaseCost
    });
  }

  if (updatedProducts.length > 0) {
    await recordFinanceAudit(subdomain, {
      action: "replacement_costs_and_prices_updated",
      entityType: "currency_recalculation",
      entityId: preview.fromCurrency,
      referenceCode: `${preview.fromCurrency}@${preview.newExchangeRate}`,
      summary: `تحديث التكلفة الاستبدالية لعدد (${updatedProducts.length}) منتج بناءً على سعر صرف ${preview.fromCurrency} = ${preview.newExchangeRate} (تغيير سعر البيع العام: ${confirmSellingPriceUpdate ? "معتمد" : "لم يتغير"})`,
      afterState: {
        fromCurrency: preview.fromCurrency,
        newExchangeRate: preview.newExchangeRate,
        confirmSellingPriceUpdate,
        updatedProducts
      },
      actor,
      activityPayload: {
        eventType: "product_replacement_cost_updated",
        amount: preview.newExchangeRate,
        currency: preview.fromCurrency,
        note: `تحديث التكلفة الاستبدالية لـ ${updatedProducts.length} منتج`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.REPLACEMENT_COSTS_RECALCULATED, {
      subdomain,
      fromCurrency: preview.fromCurrency,
      newExchangeRate: preview.newExchangeRate,
      updatedProducts
    });
  }

  return {
    fromCurrency: preview.fromCurrency,
    newExchangeRate: preview.newExchangeRate,
    updatePolicy: preview.updatePolicy,
    sellingPricesUpdated: confirmSellingPriceUpdate,
    updatedCount: updatedProducts.length,
    updatedProducts
  };
}

module.exports = {
  implemented: true,
  resolveRate,
  recordExchangeRate,
  listExchangeRates,
  previewExchangeRateCostImpact,
  applyApprovedCostAndPriceUpdates
};
