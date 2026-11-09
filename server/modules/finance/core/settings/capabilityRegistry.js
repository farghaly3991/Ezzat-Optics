/**
 * Finance Capability Registry & Phase Definitions (Phases A–F)
 *
 * Defines:
 * - Capability tiers: Basic, Advanced, Professional, Enterprise
 * - Phases A–F with explicit implementation status and minimum required capability tier.
 * - Changing capability levels controls access to UI, features, reports, and configuration
 *   while preserving all historical records and never disabling essential core transaction recording.
 */

const { FINANCE_CAPABILITY_LEVELS, FINANCE_PHASES } = require("../../shared/constants");

const LEVEL_RANK = {
  [FINANCE_CAPABILITY_LEVELS.BASIC]: 1,
  [FINANCE_CAPABILITY_LEVELS.ADVANCED]: 2,
  [FINANCE_CAPABILITY_LEVELS.PROFESSIONAL]: 3,
  [FINANCE_CAPABILITY_LEVELS.ENTERPRISE]: 4
};

const PHASE_REGISTRY = {
  [FINANCE_PHASES.PHASE_A]: {
    phase: "A",
    key: "shipping",
    titleAr: "فئات الشحن وحساب التوصيل والاستلام من الفرع ولقطات التكلفة (المرحلة أ)",
    titleEn: "Shipping, Pickup & Order Cost Snapshots",
    implemented: true,
    activeInRuntime: true,
    minLevel: FINANCE_CAPABILITY_LEVELS.BASIC,
    capabilities: [
      "shipping.classes.manage",
      "shipping.coverage.match",
      "shipping.calculator.max_add",
      "shipping.pickup.workflow",
      "orders.financial_snapshot",
      "orders.actual_shipping_cost"
    ]
  },
  [FINANCE_PHASES.PHASE_B]: {
    phase: "B",
    key: "procurement",
    titleAr: "شحنات الموردين والالتزامات والمدفوعات والأرصدة المستحقة (المرحلة ب)",
    titleEn: "Supplier Shipments, Obligations, Payments & Balances",
    implemented: true,
    activeInRuntime: true,
    minLevel: FINANCE_CAPABILITY_LEVELS.BASIC,
    capabilities: [
      "procurement.suppliers.manage",
      "procurement.shipments.manage",
      "procurement.products.associate",
      "procurement.payments.record",
      "procurement.payments.correct_reverse",
      "procurement.balances.view",
      "procurement.alerts.overdue"
    ]
  },
  [FINANCE_PHASES.PHASE_C]: {
    phase: "C",
    key: "inventory",
    titleAr: "حركات المخزون والاستلام والمرتجعات وتقييم المخزون (المرحلة ج)",
    titleEn: "Inventory Movements, Receiving & Valuation",
    implemented: true,
    activeInRuntime: true,
    minLevel: FINANCE_CAPABILITY_LEVELS.ADVANCED,
    capabilities: [
      "inventory.movements",
      "inventory.receiving",
      "inventory.returns_damaged",
      "inventory.manual_adjustments",
      "inventory.valuation"
    ]
  },
  [FINANCE_PHASES.PHASE_D]: {
    phase: "D",
    key: "expenses",
    titleAr: "المصروفات الدورية والطارئة والمبيعات اليدوية (المرحلة د)",
    titleEn: "Expenses, Recurring Expenses & Manual Sales",
    implemented: true,
    activeInRuntime: true,
    minLevel: FINANCE_CAPABILITY_LEVELS.ADVANCED,
    capabilities: [
      "expenses.one_off",
      "expenses.recurring",
      "sales.manual_offline"
    ]
  },
  [FINANCE_PHASES.PHASE_E]: {
    phase: "E",
    key: "reports_accounting",
    titleAr: "التقارير المالية والمحاسبة المتقدمة بالقيد المزدوج (المرحلة هـ)",
    titleEn: "Financial Reporting & Double-Entry Accounting",
    implemented: true,
    activeInRuntime: true,
    minLevel: FINANCE_CAPABILITY_LEVELS.PROFESSIONAL,
    capabilities: [
      "reports.basic_dashboard",
      "reports.profit_and_loss",
      "reports.cash_flow",
      "accounting.double_entry",
      "accounting.period_closing",
      "accounting.reconciliation"
    ]
  },
  [FINANCE_PHASES.PHASE_F]: {
    phase: "F",
    key: "currency",
    titleAr: "إدارة العملات المتعددة وأسعار الصرف وإعادة تسعير التكلفة (المرحلة و)",
    titleEn: "Currency, Exchange-Rate & Replacement Cost Management",
    implemented: true,
    activeInRuntime: true,
    minLevel: FINANCE_CAPABILITY_LEVELS.ENTERPRISE,
    capabilities: [
      "currency.multi_currency",
      "currency.exchange_rates",
      "currency.replacement_cost_recalculation"
    ]
  }
};

const LEVEL_DEFINITIONS = {
  [FINANCE_CAPABILITY_LEVELS.BASIC]: {
    level: FINANCE_CAPABILITY_LEVELS.BASIC,
    rank: 1,
    labelAr: "الأساسي (Basic)",
    labelEn: "Basic",
    descriptionAr:
      "يشمل فئات الشحن وحساب MAX/ADD والاستلام من الفرع ولقطات تكلفة الطلبات وشحنات الموردين والمدفوعات ولوحة الملخص المالي الأساسي",
    supportedPhases: ["A", "B"],
    enabledModulesByDefault: ["shipping", "procurement", "reports"]
  },
  [FINANCE_CAPABILITY_LEVELS.ADVANCED]: {
    level: FINANCE_CAPABILITY_LEVELS.ADVANCED,
    rank: 2,
    labelAr: "المتقدم (Advanced)",
    labelEn: "Advanced",
    descriptionAr:
      "يضيف إدارة المخزون واستلام الشحنات وتقييم التكلفة (WAC/FIFO) والمصروفات الدورية والطارئة والمبيعات اليدوية والتقارير التحليلية المتقدمة",
    supportedPhases: ["A", "B", "C", "D"],
    enabledModulesByDefault: ["shipping", "procurement", "inventory", "expenses", "reports"]
  },
  [FINANCE_CAPABILITY_LEVELS.PROFESSIONAL]: {
    level: FINANCE_CAPABILITY_LEVELS.PROFESSIONAL,
    rank: 3,
    labelAr: "الاحترافي (Professional)",
    labelEn: "Professional",
    descriptionAr:
      "يضيف المحاسبة الكاملة بالقيد المزدوج وشجرة الحسابات والقيود اليومية المتوازنة وإغلاق الفترات المحاسبية والمطابقة المالية",
    supportedPhases: ["A", "B", "C", "D", "E"],
    enabledModulesByDefault: [
      "shipping",
      "procurement",
      "inventory",
      "expenses",
      "reports",
      "accounting"
    ]
  },
  [FINANCE_CAPABILITY_LEVELS.ENTERPRISE]: {
    level: FINANCE_CAPABILITY_LEVELS.ENTERPRISE,
    rank: 4,
    labelAr: "المؤسسي (Enterprise)",
    labelEn: "Enterprise",
    descriptionAr:
      "يضيف إدارة عملات الشراء الأجنبية وأسعار الصرف التاريخية وإعادة حساب التكلفة الاستبدالية واقتراح أسعار البيع بمراجعة الإدارة",
    supportedPhases: ["A", "B", "C", "D", "E", "F"],
    enabledModulesByDefault: [
      "shipping",
      "procurement",
      "inventory",
      "expenses",
      "reports",
      "accounting",
      "currency"
    ]
  }
};

const DEFAULT_FINANCE_SETTINGS = {
  level: FINANCE_CAPABILITY_LEVELS.ADVANCED,
  defaultCurrency: "EGP",
  modules: {
    shipping: { enabled: true, phase: "A", implemented: true, minLevel: "basic" },
    procurement: { enabled: true, phase: "B", implemented: true, minLevel: "basic" },
    inventory: { enabled: true, phase: "C", implemented: true, minLevel: "advanced" },
    expenses: { enabled: true, phase: "D", implemented: true, minLevel: "advanced" },
    reports: { enabled: true, phase: "E", implemented: true, minLevel: "basic" },
    accounting: { enabled: true, phase: "E", implemented: true, minLevel: "professional" },
    currency: { enabled: true, phase: "F", implemented: true, minLevel: "enterprise" }
  },
  pickup: {
    enabled: true,
    branchName: "الفرع الرئيسي",
    branchAddress: "",
    instructions: "يرجى إحضار رقم الطلب عند الحضور للاستلام من الفرع بعد تأكيد الجاهزية",
    requireConfirmationBeforeCompletion: true
  },
  shippingConfig: {
    useShippingClasses: true,
    useAiAddressFallback: true,
    allowCustomerClassSelection: true,
    requireCoverageMatch: true,
    respectFreeShippingThreshold: false,
    addQuantityBehavior: "per_line"
  },
  inventoryConfig: {
    costingMethod: "weighted_average", // "weighted_average" | "fifo"
    costingPolicyLocked: false,
    lowStockThresholdDefault: 5,
    autoRecordOrderSaleMovements: true
  },
  accountingConfig: {
    autoPostEntries: false,
    requirePeriodOpen: true,
    egyptianComplianceDisclaimerAccepted: false
  },
  currencyConfig: {
    baseCurrency: "EGP",
    supportedCurrencies: ["EGP", "USD", "EUR", "SAR", "AED", "GBP", "CNY"],
    costUpdatePolicy: "both", // "both" | "increases_only" | "decreases_only" | "manual_only"
    autoChangeSellingPrice: false, // Never auto-mutate public selling prices without explicit policy/approval
    externalProvider: {
      enabled: false,
      providerName: "",
      lastSyncedAt: null
    }
  }
};

function isLevelSufficient(currentLevel, requiredLevel) {
  const currRank = LEVEL_RANK[currentLevel] || 1;
  const reqRank = LEVEL_RANK[requiredLevel] || 1;
  return currRank >= reqRank;
}

module.exports = {
  LEVEL_RANK,
  PHASE_REGISTRY,
  LEVEL_DEFINITIONS,
  DEFAULT_FINANCE_SETTINGS,
  isLevelSufficient
};
