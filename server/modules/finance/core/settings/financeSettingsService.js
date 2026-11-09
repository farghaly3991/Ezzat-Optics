/**
 * Finance Settings & Capability Management Service (Phases A–F)
 *
 * - Manages Finance capability levels (Basic, Advanced, Professional, Enterprise)
 *   and module/policy settings stored in `AdminData.financeSettings`.
 * - Enforces tier-based operational access while ensuring core transaction recording
 *   is never silently disabled and historical records are never deleted when levels change.
 * - Prevents silent switching of inventory costing policy (`weighted_average` vs `fifo`).
 */

const getAdminDataModel = require("../../../settings/adminDataModel");
const {
  PHASE_REGISTRY,
  LEVEL_DEFINITIONS,
  DEFAULT_FINANCE_SETTINGS,
  isLevelSufficient
} = require("./capabilityRegistry");
const {
  VALID_FINANCE_LEVELS,
  INVENTORY_COSTING_METHODS,
  CURRENCY_COST_UPDATE_POLICIES
} = require("../../shared/constants");
const { createFinanceError, validateCurrencyCode } = require("../../shared/validators");
const { recordFinanceAudit } = require("../audit/auditService");
const { emitFinanceEvent, FINANCE_DOMAIN_EVENTS } = require("../events/financeEventBus");

/**
 * Normalize and merge stored financeSettings with safe defaults.
 */
function resolveEffectiveFinanceSettings(rawSettings = {}, fallbackCurrency = "EGP") {
  const level = VALID_FINANCE_LEVELS.includes(rawSettings?.level)
    ? rawSettings.level
    : DEFAULT_FINANCE_SETTINGS.level;

  let defaultCurrency = "EGP";
  try {
    defaultCurrency = validateCurrencyCode(rawSettings?.defaultCurrency || fallbackCurrency || "EGP");
  } catch {
    defaultCurrency = "EGP";
  }

  const rawModules = rawSettings?.modules || {};

  const buildModuleState = (key, phase, minLevel) => {
    const rawMod = rawModules[key];
    const explicitlyDisabled =
      rawMod !== undefined &&
      (rawMod === false || (typeof rawMod === "object" && rawMod.enabled === false));
    const levelUnlocked = isLevelSufficient(level, minLevel);
    const enabled = levelUnlocked && !explicitlyDisabled;
    return {
      phase,
      implemented: true,
      minLevel,
      levelUnlocked,
      enabled,
      operational: enabled,
      transactionRecordingActive: true
    };
  };

  const modules = {
    shipping: buildModuleState("shipping", "A", "basic"),
    procurement: buildModuleState("procurement", "B", "basic"),
    inventory: buildModuleState("inventory", "C", "advanced"),
    expenses: buildModuleState("expenses", "D", "advanced"),
    reports: {
      ...buildModuleState("reports", "E", "basic"),
      basicReportsOperational: true,
      advancedReportsOperational: isLevelSufficient(level, "advanced")
    },
    accounting: buildModuleState("accounting", "E", "professional"),
    currency: buildModuleState("currency", "F", "enterprise")
  };

  const rawPickup = rawSettings?.pickup || {};
  const pickup = {
    enabled: rawPickup.enabled !== false,
    branchName: String(rawPickup.branchName ?? DEFAULT_FINANCE_SETTINGS.pickup.branchName).trim(),
    branchAddress: String(rawPickup.branchAddress ?? DEFAULT_FINANCE_SETTINGS.pickup.branchAddress).trim(),
    instructions: String(rawPickup.instructions ?? DEFAULT_FINANCE_SETTINGS.pickup.instructions).trim(),
    requireConfirmationBeforeCompletion: rawPickup.requireConfirmationBeforeCompletion !== false
  };

  const rawShippingConfig = rawSettings?.shippingConfig || {};
  const shippingConfig = {
    useShippingClasses: rawShippingConfig.useShippingClasses !== false,
    useAiAddressFallback: rawShippingConfig.useAiAddressFallback !== false,
    allowCustomerClassSelection: rawShippingConfig.allowCustomerClassSelection !== false,
    requireCoverageMatch: rawShippingConfig.requireCoverageMatch !== false,
    respectFreeShippingThreshold: Boolean(rawShippingConfig.respectFreeShippingThreshold),
    addQuantityBehavior:
      rawShippingConfig.addQuantityBehavior === "per_unit" ? "per_unit" : "per_line"
  };

  const rawInventoryConfig = rawSettings?.inventoryConfig || {};
  const costingMethod = INVENTORY_COSTING_METHODS.includes(rawInventoryConfig.costingMethod)
    ? rawInventoryConfig.costingMethod
    : DEFAULT_FINANCE_SETTINGS.inventoryConfig.costingMethod;

  const inventoryConfig = {
    costingMethod,
    costingPolicyLocked: Boolean(rawInventoryConfig.costingPolicyLocked),
    lowStockThresholdDefault: Math.max(
      0,
      Number(
        rawInventoryConfig.lowStockThresholdDefault ??
          DEFAULT_FINANCE_SETTINGS.inventoryConfig.lowStockThresholdDefault
      )
    ),
    autoRecordOrderSaleMovements: rawInventoryConfig.autoRecordOrderSaleMovements !== false
  };

  const rawAccountingConfig = rawSettings?.accountingConfig || {};
  const accountingConfig = {
    autoPostEntries: Boolean(rawAccountingConfig.autoPostEntries),
    requirePeriodOpen: rawAccountingConfig.requirePeriodOpen !== false,
    egyptianComplianceDisclaimerAccepted: Boolean(
      rawAccountingConfig.egyptianComplianceDisclaimerAccepted
    )
  };

  const rawCurrencyConfig = rawSettings?.currencyConfig || {};
  const costUpdatePolicy = CURRENCY_COST_UPDATE_POLICIES.includes(rawCurrencyConfig.costUpdatePolicy)
    ? rawCurrencyConfig.costUpdatePolicy
    : DEFAULT_FINANCE_SETTINGS.currencyConfig.costUpdatePolicy;

  const currencyConfig = {
    baseCurrency: defaultCurrency,
    supportedCurrencies: Array.isArray(rawCurrencyConfig.supportedCurrencies) &&
      rawCurrencyConfig.supportedCurrencies.length > 0
      ? rawCurrencyConfig.supportedCurrencies
      : DEFAULT_FINANCE_SETTINGS.currencyConfig.supportedCurrencies,
    costUpdatePolicy,
    autoChangeSellingPrice: false, // Enforced invariant: selling price changes require explicit admin confirmation
    externalProvider: {
      enabled: Boolean(rawCurrencyConfig.externalProvider?.enabled),
      providerName: String(rawCurrencyConfig.externalProvider?.providerName || "").trim(),
      lastSyncedAt: rawCurrencyConfig.externalProvider?.lastSyncedAt || null
    }
  };

  return {
    level,
    levelDefinition: LEVEL_DEFINITIONS[level],
    defaultCurrency,
    modules,
    pickup,
    shippingConfig,
    inventoryConfig,
    accountingConfig,
    currencyConfig,
    phases: PHASE_REGISTRY,
    availableLevels: Object.values(LEVEL_DEFINITIONS)
  };
}

async function getFinanceSettings(subdomain) {
  const AdminData = getAdminDataModel(subdomain);
  let adminDoc = await AdminData.findOne().lean();
  if (!adminDoc) {
    adminDoc = (await new AdminData().save()).toObject();
  }
  return resolveEffectiveFinanceSettings(adminDoc.financeSettings || {}, adminDoc.currency);
}

async function updateFinanceSettings(subdomain, payload = {}, actor = null) {
  const AdminData = getAdminDataModel(subdomain);
  let adminDoc = await AdminData.findOne();
  if (!adminDoc) {
    adminDoc = new AdminData();
  }

  const previousEffective = resolveEffectiveFinanceSettings(adminDoc.financeSettings || {}, adminDoc.currency);

  if (payload.level !== undefined) {
    const cleanLevel = String(payload.level).trim().toLowerCase();
    if (!VALID_FINANCE_LEVELS.includes(cleanLevel)) {
      throw createFinanceError(
        `مستوى القدرات المالية غير صالح: "${payload.level}". القيم المسموحة: ${VALID_FINANCE_LEVELS.join(", ")}`,
        400
      );
    }
  }

  // Validate inventory costing policy change: do not allow silent switching if locked or movements exist
  const requestedCostingMethod = payload.inventoryConfig?.costingMethod;
  if (
    requestedCostingMethod !== undefined &&
    requestedCostingMethod !== previousEffective.inventoryConfig.costingMethod
  ) {
    if (!INVENTORY_COSTING_METHODS.includes(requestedCostingMethod)) {
      throw createFinanceError(
        `سياسة تقييم المخزون غير صالحة: "${requestedCostingMethod}". القيم المسموحة: ${INVENTORY_COSTING_METHODS.join(", ")}`,
        400,
        "INVALID_COSTING_METHOD"
      );
    }

    // Check if inventory movements already exist in this tenant DB
    let existingMovementsCount = 0;
    try {
      const getInventoryMovementModel = require("../../inventory/inventoryMovementModel");
      const InventoryMovement = getInventoryMovementModel(subdomain);
      existingMovementsCount = await InventoryMovement.countDocuments();
    } catch {
      existingMovementsCount = 0;
    }

    if (
      (previousEffective.inventoryConfig.costingPolicyLocked || existingMovementsCount > 0) &&
      payload.inventoryConfig?.confirmPolicyChange !== true
    ) {
      throw createFinanceError(
        "لا يمكن تغيير سياسة تقييم تكلفة المخزون (WAC / FIFO) بصمت بعد بدء تسجيل حركات المخزون منعاً للتلاعب بالأرباح التاريخية. يلزم تأكيد صريح ومسبب للتغيير.",
        400,
        "COSTING_POLICY_LOCKED"
      );
    }
  }

  const existingModulesRaw = adminDoc.financeSettings?.modules || {};
  const nextModulesRaw = { ...existingModulesRaw };

  if (payload.modules && typeof payload.modules === "object") {
    for (const key of ["shipping", "procurement", "inventory", "expenses", "reports", "accounting", "currency"]) {
      if (payload.modules[key] !== undefined) {
        const enabledVal =
          typeof payload.modules[key] === "boolean"
            ? payload.modules[key]
            : payload.modules[key]?.enabled !== false;
        nextModulesRaw[key] = { enabled: enabledVal };
      }
    }
  }

  const mergedRaw = {
    ...(adminDoc.financeSettings || {}),
    ...(payload.level ? { level: String(payload.level).trim().toLowerCase() } : {}),
    ...(payload.defaultCurrency
      ? { defaultCurrency: validateCurrencyCode(payload.defaultCurrency) }
      : {}),
    modules: nextModulesRaw,
    pickup: {
      ...(adminDoc.financeSettings?.pickup || {}),
      ...(payload.pickup || {})
    },
    shippingConfig: {
      ...(adminDoc.financeSettings?.shippingConfig || {}),
      ...(payload.shippingConfig || {})
    },
    inventoryConfig: {
      ...(adminDoc.financeSettings?.inventoryConfig || {}),
      ...(payload.inventoryConfig || {})
    },
    accountingConfig: {
      ...(adminDoc.financeSettings?.accountingConfig || {}),
      ...(payload.accountingConfig || {})
    },
    currencyConfig: {
      ...(adminDoc.financeSettings?.currencyConfig || {}),
      ...(payload.currencyConfig || {}),
      autoChangeSellingPrice: false
    }
  };

  adminDoc.financeSettings = mergedRaw;
  adminDoc.markModified("financeSettings");
  await adminDoc.save();

  const updatedEffective = resolveEffectiveFinanceSettings(adminDoc.financeSettings, adminDoc.currency);

  await recordFinanceAudit(subdomain, {
    action: "finance_settings_updated",
    entityType: "finance_settings",
    entityId: String(adminDoc._id),
    summary: `تم تحديث إعدادات المالية (المستوى: ${updatedEffective.level})`,
    beforeState: {
      level: previousEffective.level,
      modules: previousEffective.modules,
      inventoryConfig: previousEffective.inventoryConfig,
      accountingConfig: previousEffective.accountingConfig,
      currencyConfig: previousEffective.currencyConfig
    },
    afterState: {
      level: updatedEffective.level,
      modules: updatedEffective.modules,
      inventoryConfig: updatedEffective.inventoryConfig,
      accountingConfig: updatedEffective.accountingConfig,
      currencyConfig: updatedEffective.currencyConfig
    },
    actor,
    activityPayload: {
      eventType: "finance_settings_updated",
      note: `تحديث إعدادات المالية إلى مستوى ${updatedEffective.level}`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.FINANCE_SETTINGS_UPDATED, {
    subdomain,
    settings: updatedEffective
  });

  return updatedEffective;
}

module.exports = {
  resolveEffectiveFinanceSettings,
  getFinanceSettings,
  updateFinanceSettings
};
