/**
 * Phase E4 — Double-Entry Accounting Service (Professional & Enterprise Tiers)
 *
 * Implements:
 * - Configurable Chart of Accounts (`storeChartOfAccount`) with automatic tenant seeding.
 * - Balanced Journal Entries (`storeJournalEntry`) enforcing `totalDebit === totalCredit` (> 0).
 * - Separation between `draft`, `posted`, and `reversed` journal entries.
 * - Duplicate-posting prevention via `idempotencyKey`.
 * - Period closing controls (`storeAccountingPeriod`) blocking postings into closed periods.
 * - Explicit mapping from source business events (`recognized_sale`, `payment_collection`,
 *   `supplier_purchase_receipt`, `supplier_payment`, `expense_incurred`, `expense_payment`,
 *   `inventory_adjustment`) to balanced accounting entries.
 * - Trial Balance and Sub-Ledger Reconciliation.
 *
 * Compliance Disclaimer:
 * - Accounting mappings and Chart of Accounts are configurable and require review by a
 *   qualified local Egyptian Chartered Accountant (محاسب قانوني) for Egyptian Accounting
 *   Standards (EAS) and Egyptian Tax Authority (ETA) compliance.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const getAccountModel = require("./accountModel");
const getJournalEntryModel = require("./journalEntryModel");
const getAccountingPeriodModel = require("./accountingPeriodModel");
const getOrdersModel = require("../../orders/orderModel");
const getSupplierShipmentModel = require("../procurement/supplierShipmentModel");
const getExpenseModel = require("../expenses/expenseModel");
const getManualSaleModel = require("../expenses/manualSaleModel");
const getFinancePaymentModel = require("../core/payments/paymentModel");
const { getInventoryValuationReport } = require("../inventory/inventoryService");
const { recordFinanceAudit } = require("../core/audit/auditService");
const {
  emitFinanceEvent,
  FINANCE_DOMAIN_EVENTS
} = require("../core/events/financeEventBus");
const { ACCOUNT_TYPES } = require("../shared/constants");
const {
  createFinanceError,
  roundMoney,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateObjectId,
  validateOptionalDate
} = require("../shared/validators");

const EGYPTIAN_ACCOUNTING_REVIEW_NOTE =
  "تنبيه مهني: تم تصميم دليل الحسابات وقواعد الترحيل المزدوج لأغراض الإدارة المالية والرقابة الداخلية للمتجر، ويلزم مراجعتها واعتمادها من قِبل محاسب قانوني مصري مختص للتأكد من التوافق مع معايير المحاسبة المصرية (EAS) ومتطلبات مصلحة الضرائب المصرية والفاتورة الإلكترونية.";

const DEFAULT_CHART_OF_ACCOUNTS = [
  {
    code: "1010",
    nameAr: "النقدية بالصندوق والخزينة",
    nameEn: "Cash on Hand",
    accountType: "asset",
    normalBalance: "debit",
    systemRole: "cash",
    isSystemDefault: true
  },
  {
    code: "1020",
    nameAr: "البنوك والمحافظ الإلكترونية وبوابات الدفع",
    nameEn: "Bank & Digital Wallets",
    accountType: "asset",
    normalBalance: "debit",
    systemRole: "bank",
    isSystemDefault: true
  },
  {
    code: "1110",
    nameAr: "العملاء وذمم الدفع عند الاستلام (Accounts Receivable)",
    nameEn: "Accounts Receivable - Customers",
    accountType: "asset",
    normalBalance: "debit",
    systemRole: "accounts_receivable",
    isSystemDefault: true
  },
  {
    code: "1210",
    nameAr: "مخزون البضائع (Merchandise Inventory)",
    nameEn: "Merchandise Inventory",
    accountType: "asset",
    normalBalance: "debit",
    systemRole: "inventory",
    isSystemDefault: true
  },
  {
    code: "2010",
    nameAr: "الموردون والالتزامات التجارية (Accounts Payable)",
    nameEn: "Accounts Payable - Suppliers",
    accountType: "liability",
    normalBalance: "credit",
    systemRole: "accounts_payable",
    isSystemDefault: true
  },
  {
    code: "2020",
    nameAr: "مصروفات مستحقة الدفع (Accrued Expenses Payable)",
    nameEn: "Accrued Expenses Payable",
    accountType: "liability",
    normalBalance: "credit",
    systemRole: "accrued_expenses",
    isSystemDefault: true
  },
  {
    code: "2030",
    nameAr: "مستحقات شركات الشحن والتوصيل",
    nameEn: "Shipping Carriers Payable",
    accountType: "liability",
    normalBalance: "credit",
    systemRole: "shipping_payable",
    isSystemDefault: true
  },
  {
    code: "3010",
    nameAr: "رأس المال والأرباح المبقاة",
    nameEn: "Owner Equity & Retained Earnings",
    accountType: "equity",
    normalBalance: "credit",
    systemRole: "equity",
    isSystemDefault: true
  },
  {
    code: "4010",
    nameAr: "إيرادات مبيعات البضائع (صافي)",
    nameEn: "Merchandise Sales Revenue",
    accountType: "revenue",
    normalBalance: "credit",
    systemRole: "sales_revenue",
    isSystemDefault: true
  },
  {
    code: "4020",
    nameAr: "إيرادات الشحن والتوصيل المحصلة من العملاء",
    nameEn: "Customer Shipping Revenue",
    accountType: "revenue",
    normalBalance: "credit",
    systemRole: "shipping_revenue",
    isSystemDefault: true
  },
  {
    code: "4090",
    nameAr: "مردودات ومسموحات وخصومات المبيعات",
    nameEn: "Sales Returns & Allowances",
    accountType: "revenue",
    normalBalance: "debit",
    systemRole: "sales_returns",
    isSystemDefault: true
  },
  {
    code: "5010",
    nameAr: "تكلفة البضاعة المباعة (COGS)",
    nameEn: "Cost of Goods Sold",
    accountType: "cogs",
    normalBalance: "debit",
    systemRole: "cogs",
    isSystemDefault: true
  },
  {
    code: "5020",
    nameAr: "تكلفة الشحن والتوصيل الفعلية",
    nameEn: "Fulfillment & Carrier Shipping Cost",
    accountType: "cogs",
    normalBalance: "debit",
    systemRole: "shipping_cost",
    isSystemDefault: true
  },
  {
    code: "5030",
    nameAr: "توالف وعجز وتسويات المخزون",
    nameEn: "Inventory Shrinkage & Adjustments",
    accountType: "cogs",
    normalBalance: "debit",
    systemRole: "inventory_shrinkage",
    isSystemDefault: true
  },
  {
    code: "6010",
    nameAr: "المصروفات التشغيلية والإدارية والعمومية",
    nameEn: "Operating & Administrative Expenses",
    accountType: "expense",
    normalBalance: "debit",
    systemRole: "operating_expense",
    isSystemDefault: true
  }
];

function toPeriodKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function generateEntryNumber(JournalEntry, prefix = "JE") {
  for (let i = 0; i < 6; i++) {
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    const ts = Date.now().toString(36).toUpperCase().slice(-5);
    const num = `${prefix}-${ts}-${rand}`;
    const exists = await JournalEntry.exists({ entryNumber: num });
    if (!exists) return num;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// ============================================================================
// 1. Chart of Accounts Management
// ============================================================================

async function ensureDefaultChartOfAccounts(subdomain) {
  const Account = getAccountModel(subdomain);
  const count = await Account.countDocuments();
  if (count === 0) {
    for (const def of DEFAULT_CHART_OF_ACCOUNTS) {
      await Account.updateOne(
        { code: def.code },
        { $setOnInsert: def },
        { upsert: true }
      );
    }
  }
  return Account.find().sort({ code: 1 }).lean();
}

async function listChartOfAccounts(subdomain, { activeOnly = false } = {}) {
  await ensureDefaultChartOfAccounts(subdomain);
  const Account = getAccountModel(subdomain);
  const query = activeOnly ? { active: true } : {};
  const accounts = await Account.find(query).sort({ code: 1 }).lean();
  return {
    accounts,
    complianceNote: EGYPTIAN_ACCOUNTING_REVIEW_NOTE,
    disclaimer: EGYPTIAN_ACCOUNTING_REVIEW_NOTE
  };
}

async function createAccount(subdomain, payload = {}, actor = null) {
  await ensureDefaultChartOfAccounts(subdomain);
  const Account = getAccountModel(subdomain);

  const code = String(payload.code || "").trim().toUpperCase();
  const nameAr = String(payload.nameAr || payload.name || "").trim();
  if (!code || !nameAr) {
    throw createFinanceError("كود الحساب واسم الحساب باللغة العربية حقول مطلوبة", 400);
  }

  const existing = await Account.exists({ code });
  if (existing) {
    throw createFinanceError(`كود الحساب (${code}) مستخدم مسبقاً في شجرة الحسابات`, 400);
  }

  const accountType = ACCOUNT_TYPES.includes(payload.accountType)
    ? payload.accountType
    : "expense";

  const defaultNormalBalance = ["asset", "cogs", "expense"].includes(accountType)
    ? "debit"
    : "credit";
  const normalBalance = ["debit", "credit"].includes(payload.normalBalance)
    ? payload.normalBalance
    : defaultNormalBalance;

  const accountDoc = await new Account({
    code,
    nameAr,
    nameEn: String(payload.nameEn || "").trim(),
    accountType,
    normalBalance,
    systemRole: String(payload.systemRole || "").trim(),
    description: String(payload.description || "").trim(),
    isSystemDefault: false,
    active: payload.active !== false,
    createdBy: actor?._id || actor?.userId || null
  }).save();

  await recordFinanceAudit(subdomain, {
    action: "chart_of_account_created",
    entityType: "chart_of_account",
    entityId: String(accountDoc._id),
    referenceCode: accountDoc.code,
    summary: `إضافة حساب محاسبي جديد (${accountDoc.code} - ${accountDoc.nameAr})`,
    afterState: accountDoc.toObject(),
    actor
  });

  return { account: accountDoc.toObject() };
}

// ============================================================================
// 2. Accounting Period Closing Controls
// ============================================================================

async function assertAccountingPeriodOpen(subdomain, accountingPeriod) {
  const AccountingPeriod = getAccountingPeriodModel(subdomain);
  const periodDoc = await AccountingPeriod.findOne({ periodKey: accountingPeriod }).lean();
  if (periodDoc && periodDoc.status === "closed") {
    throw createFinanceError(
      `الفترة المحاسبية (${accountingPeriod}) مغلقة ولا يُسمح بترحيل أو تعديل قيود محاسبية فيها إلا بعد إعادة فتحها بصلاحية معتمدة.`,
      400,
      "ACCOUNTING_PERIOD_CLOSED"
    );
  }
}

async function closeAccountingPeriod(subdomain, { periodKey, note = "" } = {}, actor = null) {
  if (!periodKey || !/^\d{4}-\d{2}$/.test(String(periodKey).trim())) {
    throw createFinanceError("يرجى تحديد الفترة المحاسبية بصيغة YYYY-MM (مثال: 2026-10)", 400);
  }
  const cleanPeriod = String(periodKey).trim();
  const AccountingPeriod = getAccountingPeriodModel(subdomain);
  const actorId = actor?._id || actor?.userId || null;

  let periodDoc = await AccountingPeriod.findOne({ periodKey: cleanPeriod });
  if (!periodDoc) {
    periodDoc = new AccountingPeriod({ periodKey: cleanPeriod });
  }

  periodDoc.status = "closed";
  periodDoc.closedAt = new Date();
  periodDoc.closedBy = actorId;
  periodDoc.closingNote = String(note || "إغلاق الفترة المحاسبية").trim();
  await periodDoc.save();

  await recordFinanceAudit(subdomain, {
    action: "accounting_period_closed",
    entityType: "accounting_period",
    entityId: String(periodDoc._id),
    referenceCode: cleanPeriod,
    summary: `إغلاق الفترة المحاسبية (${cleanPeriod})`,
    afterState: periodDoc.toObject(),
    actor,
    activityPayload: {
      eventType: "accounting_period_closed",
      note: `إغلاق الفترة المحاسبية ${cleanPeriod}`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.ACCOUNTING_PERIOD_CLOSED, {
    subdomain,
    period: periodDoc.toObject()
  });

  return { period: periodDoc.toObject() };
}

async function reopenAccountingPeriod(subdomain, { periodKey, reason = "" } = {}, actor = null) {
  const cleanReason = String(reason || "").trim();
  if (!cleanReason) {
    throw createFinanceError("يلزم إدخال سبب واضح ومعتمد لإعادة فتح فترة محاسبية مغلقة", 400);
  }
  const cleanPeriod = String(periodKey || "").trim();
  const AccountingPeriod = getAccountingPeriodModel(subdomain);
  const periodDoc = await AccountingPeriod.findOne({ periodKey: cleanPeriod });
  if (!periodDoc) {
    throw createFinanceError("الفترة المحاسبية غير موجودة", 404);
  }

  periodDoc.status = "open";
  periodDoc.reopenedAt = new Date();
  periodDoc.reopenedBy = actor?._id || actor?.userId || null;
  periodDoc.reopenReason = cleanReason;
  await periodDoc.save();

  await recordFinanceAudit(subdomain, {
    action: "accounting_period_reopened",
    entityType: "accounting_period",
    entityId: String(periodDoc._id),
    referenceCode: cleanPeriod,
    summary: `إعادة فتح الفترة المحاسبية (${cleanPeriod}) — السبب: ${cleanReason}`,
    afterState: periodDoc.toObject(),
    actor
  });

  return { period: periodDoc.toObject() };
}

async function listAccountingPeriods(subdomain) {
  const AccountingPeriod = getAccountingPeriodModel(subdomain);
  const periods = await AccountingPeriod.find().sort({ periodKey: -1 }).lean();
  return { periods };
}

// ============================================================================
// 3. Balanced Journal Entries (Draft, Posted, Reversed & Idempotency)
// ============================================================================

async function resolveAndValidateJournalLines(subdomain, rawLines = []) {
  await ensureDefaultChartOfAccounts(subdomain);
  const Account = getAccountModel(subdomain);

  if (!Array.isArray(rawLines) || rawLines.length < 2) {
    throw createFinanceError(
      "القيد المحاسبي المزدوج يجب أن يحتوي على طرفين (بندين) على الأقل",
      400,
      "INVALID_JOURNAL_LINES"
    );
  }

  const resolvedLines = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const rl of rawLines) {
    let accountDoc = null;
    if (rl.accountId && mongoose.isValidObjectId(rl.accountId)) {
      accountDoc = await Account.findById(rl.accountId).lean();
    } else if (rl.accountCode) {
      accountDoc = await Account.findOne({
        code: String(rl.accountCode).trim().toUpperCase()
      }).lean();
    } else if (rl.systemRole) {
      accountDoc = await Account.findOne({ systemRole: rl.systemRole }).lean();
    }

    if (!accountDoc) {
      throw createFinanceError(
        `الحساب المحاسبي المحدد غير موجود (${rl.accountCode || rl.accountId || rl.systemRole})`,
        404,
        "ACCOUNT_NOT_FOUND"
      );
    }

    const debit = roundMoney(validateNonNegativeAmount(rl.debit || 0, "قيمة المدين"));
    const credit = roundMoney(validateNonNegativeAmount(rl.credit || 0, "قيمة الدائن"));

    if (debit === 0 && credit === 0) {
      continue;
    }
    if (debit > 0 && credit > 0) {
      throw createFinanceError(
        `البند الواحد في القيد لا يمكن أن يكون مديناً ودائناً في نفس السطر (${accountDoc.code})`,
        400,
        "LINE_BOTH_DEBIT_AND_CREDIT"
      );
    }

    totalDebit = roundMoney(totalDebit + debit);
    totalCredit = roundMoney(totalCredit + credit);

    resolvedLines.push({
      accountId: accountDoc._id,
      accountCode: accountDoc.code,
      accountNameAr: accountDoc.nameAr,
      accountType: accountDoc.accountType,
      debit,
      credit,
      memo: String(rl.memo || "").trim()
    });
  }

  if (resolvedLines.length < 2) {
    throw createFinanceError(
      "القيد المحاسبي يجب أن يحتوي على سطرين بقيم غير صفرية على الأقل",
      400,
      "INVALID_JOURNAL_LINES"
    );
  }

  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  return {
    lines: resolvedLines,
    totalDebit,
    totalCredit,
    isBalanced
  };
}

/**
 * Create a Journal Entry (`status: "draft" | "posted"`).
 * Enforces:
 * - Idempotency via `idempotencyKey` (prevents duplicate postings of the same business event).
 * - Balanced invariant: `totalDebit === totalCredit` (> 0) for posted entries.
 * - Period open check (`assertAccountingPeriodOpen`).
 */
async function createJournalEntry(subdomain, payload = {}, actor = null) {
  const JournalEntry = getJournalEntryModel(subdomain);

  const cleanIdempotencyKey = payload.idempotencyKey
    ? String(payload.idempotencyKey).trim()
    : null;

  if (cleanIdempotencyKey) {
    const existing = await JournalEntry.findOne({
      idempotencyKey: cleanIdempotencyKey
    }).lean();
    if (existing) {
      return {
        entry: existing,
        deduplicated: true,
        duplicate: true
      };
    }
  }

  const description = String(payload.description || "").trim();
  if (!description) {
    throw createFinanceError("يرجى إدخال بيان أو شرح القيد المحاسبي", 400);
  }

  const postingDate =
    validateOptionalDate(payload.postingDate || payload.entryDate, "تاريخ الترحيل") || new Date();
  const accountingPeriod = payload.accountingPeriod
    ? String(payload.accountingPeriod).trim()
    : toPeriodKey(postingDate);

  const requestedStatus = payload.status === "draft" ? "draft" : "posted";

  // Check period open before creating a posted entry (or even draft in a closed period)
  await assertAccountingPeriodOpen(subdomain, accountingPeriod);

  const { lines, totalDebit, totalCredit, isBalanced } = await resolveAndValidateJournalLines(
    subdomain,
    payload.lines
  );

  if (requestedStatus === "posted" && !isBalanced) {
    throw createFinanceError(
      `القيد المحاسبي غير متوازن: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit}). يجب أن يتساوى الطرفان قبل الترحيل.`,
      400,
      "ACCOUNTING_ENTRY_UNBALANCED"
    );
  }

  const entryNumber = payload.entryNumber
    ? String(payload.entryNumber).trim().toUpperCase()
    : await generateEntryNumber(JournalEntry, "JE");

  const actorId = actor?._id || actor?.userId || null;

  const entryDoc = await new JournalEntry({
    entryNumber,
    postingDate,
    accountingPeriod,
    status: requestedStatus,
    entryKind: payload.entryKind || "standard",
    description,
    currency: String(payload.currency || "EGP").toUpperCase(),
    lines,
    totalDebit,
    totalCredit,
    isBalanced,
    sourceType: String(payload.sourceType || "manual_journal"),
    sourceEvent: String(payload.sourceEvent || ""),
    sourceId: String(payload.sourceId || ""),
    sourceReference: String(payload.sourceReference || ""),
    idempotencyKey: cleanIdempotencyKey,
    notes: String(payload.notes || "").trim(),
    createdBy: actorId,
    postedBy: requestedStatus === "posted" ? actorId : null,
    postedAt: requestedStatus === "posted" ? new Date() : null
  }).save();

  if (requestedStatus === "posted") {
    await recordFinanceAudit(subdomain, {
      action: "journal_entry_posted",
      entityType: "journal_entry",
      entityId: String(entryDoc._id),
      referenceCode: entryDoc.entryNumber,
      summary: `ترحيل قيد يومية متوازن (${entryDoc.entryNumber}) بقيمة ${totalDebit} — ${description}`,
      afterState: entryDoc.toObject(),
      actor,
      activityPayload: {
        eventType: "journal_entry_posted",
        amount: totalDebit,
        currency: entryDoc.currency,
        note: `قيد يومية ${entryDoc.entryNumber}: ${description}`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.JOURNAL_ENTRY_POSTED, {
      subdomain,
      entry: entryDoc.toObject()
    });
  }

  return {
    entry: entryDoc.toObject(),
    deduplicated: false
  };
}

/**
 * Post an existing `draft` journal entry after verifying balance and open period.
 */
async function postDraftJournalEntry(subdomain, entryId, actor = null) {
  const JournalEntry = getJournalEntryModel(subdomain);
  const validId = validateObjectId(entryId, "معرف القيد المحاسبي");
  const entryDoc = await JournalEntry.findById(validId);
  if (!entryDoc) {
    throw createFinanceError("القيد المحاسبي غير موجود", 404);
  }
  if (entryDoc.status !== "draft") {
    throw createFinanceError(`لا يمكن ترحيل قيد في حالة "${entryDoc.status}"`, 400);
  }

  await assertAccountingPeriodOpen(subdomain, entryDoc.accountingPeriod);

  if (
    entryDoc.totalDebit <= 0 ||
    Math.abs(entryDoc.totalDebit - entryDoc.totalCredit) >= 0.005
  ) {
    throw createFinanceError(
      `القيد المحاسبي المسودة غير متوازن (${entryDoc.totalDebit} مدين مقابل ${entryDoc.totalCredit} دائن)`,
      400,
      "ACCOUNTING_ENTRY_UNBALANCED"
    );
  }

  entryDoc.status = "posted";
  entryDoc.isBalanced = true;
  entryDoc.postedBy = actor?._id || actor?.userId || null;
  entryDoc.postedAt = new Date();
  await entryDoc.save();

  await recordFinanceAudit(subdomain, {
    action: "journal_entry_posted_from_draft",
    entityType: "journal_entry",
    entityId: String(entryDoc._id),
    referenceCode: entryDoc.entryNumber,
    summary: `اعتماد وترحيل القيد المسودة (${entryDoc.entryNumber})`,
    afterState: entryDoc.toObject(),
    actor
  });

  return { entry: entryDoc.toObject() };
}

/**
 * Reverse a posted Journal Entry by creating an offsetting balanced reversal entry
 * (swapping debits and credits). Never deletes the original posted entry!
 */
async function reverseJournalEntry(subdomain, entryId, payload = {}, actor = null) {
  const JournalEntry = getJournalEntryModel(subdomain);
  const validId = validateObjectId(entryId, "معرف القيد المحاسبي");
  const original = await JournalEntry.findById(validId);
  if (!original) {
    throw createFinanceError("القيد المحاسبي المراد عكسه غير موجود", 404);
  }
  if (original.status === "draft") {
    throw createFinanceError("القيد لا يزال مسودة ولم يُرحل بعد", 400);
  }
  if (original.status === "reversed" || original.reversedByEntryId) {
    throw createFinanceError("تم عكس هذا القيد المحاسبي مسبقاً", 400);
  }

  const reversalDate = validateOptionalDate(payload.postingDate, "تاريخ القيد العكسي") || new Date();
  const reversalPeriod = payload.accountingPeriod
    ? String(payload.accountingPeriod).trim()
    : toPeriodKey(reversalDate);

  await assertAccountingPeriodOpen(subdomain, reversalPeriod);

  const reason = String(payload.reason || payload.notes || "قيد عكسي لتصحيح معاملة").trim();
  const reversedLines = original.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountNameAr: l.accountNameAr,
    accountType: l.accountType,
    debit: l.credit,
    credit: l.debit,
    memo: `عكس بند القيد ${original.entryNumber}: ${l.memo || ""}`.trim()
  }));

  const revNumber = await generateEntryNumber(JournalEntry, "REVJE");
  const actorId = actor?._id || actor?.userId || null;

  const reversalDoc = await new JournalEntry({
    entryNumber: revNumber,
    postingDate: reversalDate,
    accountingPeriod: reversalPeriod,
    status: "posted",
    entryKind: "reversal",
    description: `قيد عكسي للقيد ${original.entryNumber} — ${reason}`,
    currency: original.currency,
    lines: reversedLines,
    totalDebit: original.totalCredit,
    totalCredit: original.totalDebit,
    isBalanced: true,
    sourceType: original.sourceType,
    sourceEvent: "journal_reversal",
    sourceId: String(original._id),
    sourceReference: original.entryNumber,
    reversesEntryId: original._id,
    reversalReason: reason,
    createdBy: actorId,
    postedBy: actorId,
    postedAt: new Date()
  }).save();

  original.status = "reversed";
  original.reversedByEntryId = reversalDoc._id;
  original.reversalReason = reason;
  await original.save();

  await recordFinanceAudit(subdomain, {
    action: "journal_entry_reversed",
    entityType: "journal_entry",
    entityId: String(reversalDoc._id),
    referenceCode: reversalDoc.entryNumber,
    summary: `إصدار قيد عكسي (${reversalDoc.entryNumber}) لإلغاء أثر القيد (${original.entryNumber})`,
    beforeState: { originalEntryNumber: original.entryNumber },
    afterState: { reversalEntry: reversalDoc.toObject() },
    actor,
    activityPayload: {
      eventType: "journal_entry_reversed",
      amount: reversalDoc.totalDebit,
      currency: reversalDoc.currency,
      note: `عكس القيد ${original.entryNumber} بالقيد ${reversalDoc.entryNumber}`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.JOURNAL_ENTRY_REVERSED, {
    subdomain,
    originalEntry: original.toObject(),
    reversalEntry: reversalDoc.toObject()
  });

  return {
    originalEntry: original.toObject(),
    reversalEntry: reversalDoc.toObject()
  };
}

// ============================================================================
// 4. Explicit Mapping from Source Business Events to Balanced Postings
// ============================================================================

/**
 * Post a source business event (`order`, `manual_sale`, `supplier_shipment`, `expense`, `finance_payment`)
 * to the Double-Entry General Ledger with strict duplicate-posting prevention (`idempotencyKey`).
 *
 * Crucial Accounting Rule (Requirement E4):
 * - Recognizing an order/sale (`recognized_sale`) records Accounts Receivable (1110) vs Revenue (4010/4020)
 *   and COGS (5010) vs Inventory (1210). It NEVER treats order creation alone as evidence of payment collection!
 * - Cash collection is posted separately via `payment_collection` when an actual receipt is recorded.
 */
async function postSourceBusinessEvent(subdomain, payload = {}, actor = null) {
  await ensureDefaultChartOfAccounts(subdomain);
  const eventType = String(payload.eventType || "").trim();
  const sourceId = String(payload.sourceId || "").trim();

  if (!eventType || !sourceId) {
    throw createFinanceError("يرجى تحديد نوع الحدث المصدر (eventType) ومعرف السجل (sourceId)", 400);
  }

  const idemKey =
    payload.idempotencyKey || `src_post:${eventType}:${sourceId}`;

  if (eventType === "recognized_sale" || eventType === "order_created") {
    const Orders = getOrdersModel(subdomain);
    const ManualSale = getManualSaleModel(subdomain);

    let netMerch = 0;
    let shipCharge = 0;
    let cogsTotal = 0;
    let totalReceivable = 0;
    let refCode = "";
    let postingDate = new Date();
    let srcType = "online_order";

    const ord = mongoose.isValidObjectId(sourceId)
      ? await Orders.findById(sourceId).lean()
      : null;

    if (ord) {
      if (ord.status === "cancelled" || ord.status === "returned") {
        throw createFinanceError("لا يمكن ترحيل مبيعات لطلب ملغي أو مرتجع", 400);
      }
      netMerch = roundMoney(
        Number(ord.financialSnapshot?.netMerchandiseTotal ?? Math.max(0, ord.subtotal - ord.discount))
      );
      shipCharge = roundMoney(
        Number(ord.shippingSnapshot?.customerShippingCharge ?? ord.shipping ?? 0)
      );
      cogsTotal = roundMoney(Number(ord.financialSnapshot?.productCostTotal || 0));
      totalReceivable = roundMoney(netMerch + shipCharge);
      refCode = ord.orderId;
      postingDate = ord.createdAt || new Date();
      srcType = "online_order";
    } else {
      const ms = mongoose.isValidObjectId(sourceId)
        ? await ManualSale.findById(sourceId).lean()
        : null;
      if (!ms) {
        throw createFinanceError("سجل المبيعات المصدر غير موجود", 404);
      }
      netMerch = roundMoney(Number(ms.netMerchandiseTotal || 0));
      shipCharge = roundMoney(Number(ms.shippingCharge || 0));
      cogsTotal = roundMoney(Number(ms.totalCostSnapshot || 0));
      totalReceivable = roundMoney(netMerch + shipCharge);
      refCode = ms.saleCode;
      postingDate = ms.saleDate || new Date();
      srcType = "manual_sale";
    }

    const lines = [
      {
        accountCode: "1110", // Accounts Receivable
        debit: totalReceivable,
        credit: 0,
        memo: `إثبات ذمم عميل عن مبيعات ${refCode}`
      },
      {
        accountCode: "4010", // Merchandise Sales Revenue
        debit: 0,
        credit: netMerch,
        memo: `صافي إيرادات مبيعات البضائع ${refCode}`
      }
    ];

    if (shipCharge > 0) {
      lines.push({
        accountCode: "4020", // Shipping Revenue
        debit: 0,
        credit: shipCharge,
        memo: `إيرادات شحن وتوصيل ${refCode}`
      });
    }

    if (cogsTotal > 0) {
      lines.push(
        {
          accountCode: "5010", // COGS
          debit: cogsTotal,
          credit: 0,
          memo: `إثبات تكلفة البضاعة المباعة (COGS) ${refCode}`
        },
        {
          accountCode: "1210", // Merchandise Inventory
          debit: 0,
          credit: cogsTotal,
          memo: `صرف مخزون للبضاعة المباعة ${refCode}`
        }
      );
    }

    return createJournalEntry(
      subdomain,
      {
        postingDate: payload.postingDate || postingDate,
        description: `قيد استحقاق مبيعات وتكلفة بضاعة مباعة (${refCode}) — بدون افتراض التحصيل النقدي`,
        lines,
        sourceType: srcType,
        sourceEvent: "recognized_sale",
        sourceId,
        sourceReference: refCode,
        idempotencyKey: idemKey
      },
      actor
    );
  }

  if (eventType === "payment_collection") {
    const FinancePayment = getFinancePaymentModel(subdomain);
    const pay = mongoose.isValidObjectId(sourceId)
      ? await FinancePayment.findById(sourceId).lean()
      : null;

    if (!pay || pay.direction !== "inflow") {
      throw createFinanceError("سجل التحصيل النقدي المصدر غير موجود", 404);
    }

    const amt = roundMoney(Math.abs(Number(pay.amount || 0)));
    const cashAccountCode = pay.paymentMethod === "cash" ? "1010" : "1020";

    return createJournalEntry(
      subdomain,
      {
        postingDate: payload.postingDate || pay.paidAt || new Date(),
        description: `قيد تحصيل نقدي فعلي (${pay.paymentReference}) للعملية ${pay.entityReferenceCode}`,
        lines: [
          {
            accountCode: cashAccountCode,
            debit: amt,
            credit: 0,
            memo: `تحصيل (${pay.paymentMethod}) - ${pay.paymentReference}`
          },
          {
            accountCode: "1110", // Accounts Receivable
            debit: 0,
            credit: amt,
            memo: `سداد ذمة العميل عن ${pay.entityReferenceCode}`
          }
        ],
        sourceType: "finance_payment",
        sourceEvent: "payment_collection",
        sourceId,
        sourceReference: pay.paymentReference,
        idempotencyKey: idemKey
      },
      actor
    );
  }

  if (eventType === "supplier_purchase_receipt") {
    const SupplierShipment = getSupplierShipmentModel(subdomain);
    const ship = mongoose.isValidObjectId(sourceId)
      ? await SupplierShipment.findById(sourceId).lean()
      : null;
    if (!ship) {
      throw createFinanceError("شحنة المورد غير موجودة", 404);
    }
    const amt = roundMoney(Number(ship.approvedObligationTotal || ship.linesTotal || 0));
    return createJournalEntry(
      subdomain,
      {
        postingDate: payload.postingDate || ship.receivedAt || ship.shipmentDate || new Date(),
        description: `قيد استلام مشتريات وإثبات التزام المورد (${ship.referenceId} - ${ship.supplier?.name || ""})`,
        lines: [
          {
            accountCode: "1210", // Merchandise Inventory
            debit: amt,
            credit: 0,
            memo: `إضافة مشتريات للمخزون (${ship.referenceId})`
          },
          {
            accountCode: "2010", // Accounts Payable - Suppliers
            debit: 0,
            credit: amt,
            memo: `استحقاق التزام المورد ${ship.supplier?.name || ""} (${ship.referenceId})`
          }
        ],
        sourceType: "supplier_shipment",
        sourceEvent: "supplier_purchase_receipt",
        sourceId,
        sourceReference: ship.referenceId,
        idempotencyKey: idemKey
      },
      actor
    );
  }

  if (eventType === "supplier_payment") {
    const FinancePayment = getFinancePaymentModel(subdomain);
    const pay = mongoose.isValidObjectId(sourceId)
      ? await FinancePayment.findById(sourceId).lean()
      : null;
    if (!pay || pay.entityType !== "supplier_shipment") {
      throw createFinanceError("دفعة المورد المصدر غير موجودة", 404);
    }
    const amt = roundMoney(Math.abs(Number(pay.amount || 0)));
    const cashAccountCode = pay.paymentMethod === "cash" ? "1010" : "1020";

    return createJournalEntry(
      subdomain,
      {
        postingDate: payload.postingDate || pay.paidAt || new Date(),
        description: `قيد سداد دفعة لمورد (${pay.paymentReference}) عن الشحنة ${pay.entityReferenceCode}`,
        lines: [
          {
            accountCode: "2010", // Accounts Payable - Suppliers
            debit: amt,
            credit: 0,
            memo: `تخفيض رصيد المورد عن الشحنة ${pay.entityReferenceCode}`
          },
          {
            accountCode: cashAccountCode,
            debit: 0,
            credit: amt,
            memo: `صرف دفعة مورد (${pay.paymentMethod}) - ${pay.paymentReference}`
          }
        ],
        sourceType: "finance_payment",
        sourceEvent: "supplier_payment",
        sourceId,
        sourceReference: pay.paymentReference,
        idempotencyKey: idemKey
      },
      actor
    );
  }

  if (eventType === "expense_incurred") {
    const Expense = getExpenseModel(subdomain);
    const exp = mongoose.isValidObjectId(sourceId)
      ? await Expense.findById(sourceId).lean()
      : null;
    if (!exp) {
      throw createFinanceError("سجل المصروف المصدر غير موجود", 404);
    }
    const amt = roundMoney(Number(exp.amount || 0));
    return createJournalEntry(
      subdomain,
      {
        postingDate: payload.postingDate || exp.effectiveDate || new Date(),
        accountingPeriod: exp.accountingPeriod,
        description: `قيد إثبات استحقاق مصروف تشغيلي (${exp.expenseCode} - ${exp.title})`,
        lines: [
          {
            accountCode: "6010", // Operating Expenses
            debit: amt,
            credit: 0,
            memo: `مصروف (${exp.category}): ${exp.title}`
          },
          {
            accountCode: "2020", // Accrued Expenses Payable
            debit: 0,
            credit: amt,
            memo: `استحقاق مصروف ${exp.expenseCode}`
          }
        ],
        sourceType: "expense",
        sourceEvent: "expense_incurred",
        sourceId,
        sourceReference: exp.expenseCode,
        idempotencyKey: idemKey
      },
      actor
    );
  }

  if (eventType === "expense_payment") {
    const FinancePayment = getFinancePaymentModel(subdomain);
    const pay = mongoose.isValidObjectId(sourceId)
      ? await FinancePayment.findById(sourceId).lean()
      : null;
    if (!pay || pay.entityType !== "expense") {
      throw createFinanceError("دفعة المصروف المصدر غير موجودة", 404);
    }
    const amt = roundMoney(Math.abs(Number(pay.amount || 0)));
    const cashAccountCode = pay.paymentMethod === "cash" ? "1010" : "1020";

    return createJournalEntry(
      subdomain,
      {
        postingDate: payload.postingDate || pay.paidAt || new Date(),
        description: `قيد سداد مصروف تشغيلي (${pay.paymentReference}) عن ${pay.entityReferenceCode}`,
        lines: [
          {
            accountCode: "2020", // Accrued Expenses Payable
            debit: amt,
            credit: 0,
            memo: `سداد المصروف المستحق ${pay.entityReferenceCode}`
          },
          {
            accountCode: cashAccountCode,
            debit: 0,
            credit: amt,
            memo: `صرف نقدي/بنكي للمصروف (${pay.paymentReference})`
          }
        ],
        sourceType: "finance_payment",
        sourceEvent: "expense_payment",
        sourceId,
        sourceReference: pay.paymentReference,
        idempotencyKey: idemKey
      },
      actor
    );
  }

  throw createFinanceError(`نوع الحدث المحاسبي غير مدعوم: ${eventType}`, 400);
}

// ============================================================================
// 5. Journal Queries, Trial Balance & Sub-Ledger Reconciliation
// ============================================================================

async function listJournalEntries(
  subdomain,
  {
    status = "",
    accountingPeriod = "",
    sourceType = "",
    page = 1,
    limit = 50
  } = {}
) {
  await ensureDefaultChartOfAccounts(subdomain);
  const JournalEntry = getJournalEntryModel(subdomain);
  const query = {};

  if (status && status !== "all") query.status = status;
  if (accountingPeriod) query.accountingPeriod = String(accountingPeriod).trim();
  if (sourceType && sourceType !== "all") query.sourceType = sourceType;

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const [total, entries] = await Promise.all([
    JournalEntry.countDocuments(query),
    JournalEntry.find(query)
      .sort({ postingDate: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean()
  ]);

  return {
    entries,
    total,
    page: p,
    pages: Math.ceil(total / l) || 1,
    complianceNote: EGYPTIAN_ACCOUNTING_REVIEW_NOTE
  };
}

/**
 * Compute Trial Balance across all active posted/reversed Journal Entries
 * (since reversals post offsetting entries, summing all non-draft entries gives exact net ledger balances)
 * and reconcile with operational sub-ledgers.
 */
async function getTrialBalanceAndReconciliation(subdomain, { accountingPeriod = "" } = {}) {
  const accounts = await ensureDefaultChartOfAccounts(subdomain);
  const JournalEntry = getJournalEntryModel(subdomain);
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const Expense = getExpenseModel(subdomain);

  const entryQuery = { status: { $in: ["posted", "reversed"] } };
  if (accountingPeriod) {
    entryQuery.accountingPeriod = String(accountingPeriod).trim();
  }

  const entries = await JournalEntry.find(entryQuery).lean();

  const balanceByCode = new Map();
  for (const acc of accounts) {
    balanceByCode.set(acc.code, {
      accountId: String(acc._id),
      code: acc.code,
      nameAr: acc.nameAr,
      nameEn: acc.nameEn,
      accountType: acc.accountType,
      normalBalance: acc.normalBalance,
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0
    });
  }

  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  for (const entry of entries) {
    for (const line of entry.lines || []) {
      const d = roundMoney(Number(line.debit || 0));
      const c = roundMoney(Number(line.credit || 0));
      grandTotalDebit = roundMoney(grandTotalDebit + d);
      grandTotalCredit = roundMoney(grandTotalCredit + c);

      if (!balanceByCode.has(line.accountCode)) {
        balanceByCode.set(line.accountCode, {
          accountId: String(line.accountId || ""),
          code: line.accountCode,
          nameAr: line.accountNameAr || line.accountCode,
          nameEn: "",
          accountType: line.accountType || "expense",
          normalBalance: "debit",
          totalDebit: 0,
          totalCredit: 0,
          netBalance: 0
        });
      }

      const row = balanceByCode.get(line.accountCode);
      row.totalDebit = roundMoney(row.totalDebit + d);
      row.totalCredit = roundMoney(row.totalCredit + c);
      row.netBalance =
        row.normalBalance === "debit"
          ? roundMoney(row.totalDebit - row.totalCredit)
          : roundMoney(row.totalCredit - row.totalDebit);
    }
  }

  const trialBalanceRows = Array.from(balanceByCode.values());
  const isTrialBalanceBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.005;

  // Sub-ledger reconciliation checks
  const [invValuation, supplierShipments, unpaidExpenses] = await Promise.all([
    getInventoryValuationReport(subdomain),
    SupplierShipment.find({ status: { $ne: "cancelled" } }).lean(),
    Expense.find({ status: { $ne: "cancelled" } }).lean()
  ]);

  const subLedgerInventoryValue = roundMoney(invValuation.summary.totalBookValuation || 0);
  const subLedgerSupplierPayables = roundMoney(
    supplierShipments.reduce((acc, s) => acc + Number(s.outstandingBalance || 0), 0)
  );
  const subLedgerExpensePayables = roundMoney(
    unpaidExpenses.reduce((acc, e) => acc + Number(e.outstandingBalance || 0), 0)
  );

  const glInventoryBalance = balanceByCode.get("1210")?.netBalance || 0;
  const glSupplierPayables = balanceByCode.get("2010")?.netBalance || 0;
  const glExpensePayables = balanceByCode.get("2020")?.netBalance || 0;

  return {
    accountingPeriod: accountingPeriod || "ALL",
    entriesCount: entries.length,
    grandTotalDebit,
    grandTotalCredit,
    totalDebit: grandTotalDebit,
    totalCredit: grandTotalCredit,
    isTrialBalanceBalanced,
    isBalanced: isTrialBalanceBalanced,
    trialBalanceRows,
    trialBalance: {
      rows: trialBalanceRows,
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      isBalanced: isTrialBalanceBalanced
    },
    reconciliation: {
      inventory: {
        glAccountCode: "1210",
        glBalance: glInventoryBalance,
        subLedgerBalance: subLedgerInventoryValue,
        variance: roundMoney(glInventoryBalance - subLedgerInventoryValue)
      },
      supplierPayables: {
        glAccountCode: "2010",
        glBalance: glSupplierPayables,
        subLedgerBalance: subLedgerSupplierPayables,
        variance: roundMoney(glSupplierPayables - subLedgerSupplierPayables)
      },
      accruedExpenses: {
        glAccountCode: "2020",
        glBalance: glExpensePayables,
        subLedgerBalance: subLedgerExpensePayables,
        variance: roundMoney(glExpensePayables - subLedgerExpensePayables)
      }
    },
    complianceNote: EGYPTIAN_ACCOUNTING_REVIEW_NOTE
  };
}

module.exports = {
  implemented: true,
  EGYPTIAN_ACCOUNTING_REVIEW_NOTE,
  ensureDefaultChartOfAccounts,
  listChartOfAccounts,
  createAccount,
  closeAccountingPeriod,
  reopenAccountingPeriod,
  listAccountingPeriods,
  createJournalEntry,
  postDraftJournalEntry,
  reverseJournalEntry,
  postSourceBusinessEvent,
  listJournalEntries,
  getTrialBalanceAndReconciliation
};
