/**
 * Phase D — Expenses, Recurring Expenses & Manual/Offline Sales Service
 *
 * Implements:
 * - D1: One-off and recurring operating expenses (`storeExpense`) with category, accounting period,
 *       payee, due date, and payment status (`unpaid`, `partial`, `paid`).
 * - D2: Recurring expense definitions (`storeRecurringExpenseRule`) strictly separated from
 *       period-specific occurrences (`storeExpense`). Updating a rule's amount never rewrites
 *       previous period occurrences, and `generateRecurringExpenseOccurrences` prevents duplicates.
 * - D3: Manual/offline sales (`storeManualSale`) using the existing `storeProduct` catalog and
 *       `inventoryService.recordSaleConsumption` for stock & COGS, without duplicating online orders.
 * - D4: Reusable payment ledger (`storeFinancePayment`) for expense disbursements (`outflow`),
 *       manual sale receipts (`inflow`), and online order settlements (`inflow`), supporting
 *       partial payments, corrections, and reversals without deleting posted history.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const getExpenseModel = require("./expenseModel");
const getRecurringExpenseRuleModel = require("./recurringExpenseRuleModel");
const getManualSaleModel = require("./manualSaleModel");
const getProductsModel = require("../../products/productModel");
const getOrdersModel = require("../../orders/orderModel");
const getUsersModel = require("../../auth/userModel");
const getDeductionModel = require("../../branches/models/deductionModel");
const {
  createPaymentEntry,
  reversePaymentEntry,
  correctPaymentEntry,
  listPaymentsForEntity
} = require("../core/payments/paymentService");
const { calculateObligationBalance } = require("../core/balances/balanceService");
const { recordFinanceAudit } = require("../core/audit/auditService");
const {
  emitFinanceEvent,
  FINANCE_DOMAIN_EVENTS
} = require("../core/events/financeEventBus");
const {
  recordSaleConsumption,
  recordInventoryMovement
} = require("../inventory/inventoryService");
const {
  EXPENSE_CATEGORIES,
  RECURRENCE_FREQUENCIES,
  MANUAL_SALE_SOURCES
} = require("../shared/constants");
const {
  createFinanceError,
  roundMoney,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateCurrencyCode,
  validateObjectId,
  validateOptionalDate
} = require("../shared/validators");

async function generateUniqueCode(Model, fieldName, prefix) {
  for (let i = 0; i < 6; i++) {
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    const ts = Date.now().toString(36).toUpperCase().slice(-5);
    const code = `${prefix}-${ts}-${rand}`;
    const exists = await Model.exists({ [fieldName]: code });
    if (!exists) return code;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toAccountingPeriod(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function computeOccurrencePeriodKey(frequency, dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  switch (frequency) {
    case "daily":
      return `${year}-${month}-${day}`;
    case "weekly": {
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
      const week = String(Math.ceil((days + startOfYear.getUTCDay() + 1) / 7)).padStart(2, "0");
      return `${year}-W${week}`;
    }
    case "quarterly": {
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      return `${year}-Q${q}`;
    }
    case "yearly":
      return `${year}`;
    case "monthly":
    default:
      return `${year}-${month}`;
  }
}

// ============================================================================
// 1. Expense Records & Payments (D1 & D4)
// ============================================================================

async function recalculateAndSaveExpenseState(subdomain, expenseDoc, now = new Date()) {
  const payments = await listPaymentsForEntity(subdomain, {
    entityType: "expense",
    entityId: expenseDoc._id
  });

  const balance = calculateObligationBalance({
    expectedGoodsValue: expenseDoc.amount,
    linesTotal: expenseDoc.amount,
    explicitApprovedObligation: expenseDoc.amount,
    paymentRecords: payments,
    dueDate: expenseDoc.dueDate,
    shipmentStatus: expenseDoc.status === "cancelled" ? "cancelled" : "ordered",
    now
  });

  expenseDoc.totalPaid = balance.totalPaid;
  expenseDoc.outstandingBalance = balance.outstandingBalance;
  expenseDoc.overpaidAmount = balance.overpaidAmount;
  expenseDoc.paymentStatus = balance.paymentStatus;
  if (balance.paymentStatus === "paid" && !expenseDoc.paidAt) {
    const latestPayment = payments[payments.length - 1];
    expenseDoc.paidAt = latestPayment?.paidAt || new Date();
  } else if (balance.paymentStatus !== "paid") {
    expenseDoc.paidAt = null;
  }

  await expenseDoc.save();

  return {
    expense: expenseDoc.toObject(),
    payments,
    balanceSummary: balance
  };
}

async function createExpense(subdomain, payload = {}, actor = null, options = {}) {
  const session = options?.session || null;
  const Expense = getExpenseModel(subdomain);
  const title = String(payload.title || "").trim();
  if (!title) {
    throw createFinanceError("يرجى إدخال عنوان أو بيان المصروف", 400);
  }

  const category = EXPENSE_CATEGORIES.includes(payload.category)
    ? payload.category
    : "operational";

  const currency = validateCurrencyCode(payload.currency || "EGP");
  const originalCurrency = payload.originalCurrency
    ? validateCurrencyCode(payload.originalCurrency)
    : currency;
  const exchangeRateUsed =
    payload.exchangeRateUsed !== undefined && Number(payload.exchangeRateUsed) > 0
      ? Number(payload.exchangeRateUsed)
      : 1;

  let amount = 0;
  let originalAmount = null;
  if (
    originalCurrency !== currency &&
    payload.originalAmount !== undefined &&
    payload.originalAmount !== null
  ) {
    originalAmount = validatePositiveAmount(payload.originalAmount, "المبلغ بالعملة الأصلية");
    amount = roundMoney(originalAmount * exchangeRateUsed);
  } else {
    amount = validatePositiveAmount(payload.amount, "قيمة المصروف");
    originalAmount = amount;
  }

  const effectiveDate = validateOptionalDate(payload.effectiveDate, "تاريخ استحقاق/تحمل المصروف") || new Date();
  const accountingPeriod = payload.accountingPeriod
    ? String(payload.accountingPeriod).trim()
    : toAccountingPeriod(effectiveDate);
  const dueDate = validateOptionalDate(payload.dueDate, "تاريخ السداد المستحق");

  const expenseCode = payload.expenseCode
    ? String(payload.expenseCode).trim().toUpperCase()
    : await generateUniqueCode(Expense, "expenseCode", "EXP");

  const actorId = actor?._id || actor?.userId || null;

  const expenseDoc = await new Expense({
    expenseCode,
    title,
    category,
    amount,
    currency,
    originalAmount,
    originalCurrency,
    exchangeRateUsed,
    effectiveDate,
    accountingPeriod,
    dueDate,
    payeeName: String(payload.payeeName || "").trim(),
    payeePhone: String(payload.payeePhone || "").trim(),
    partnerId: payload.partnerId && mongoose.isValidObjectId(payload.partnerId) ? payload.partnerId : null,
    partnerName: String(payload.partnerName || "").trim(),
    partnerSharePercent: Number(payload.partnerSharePercent || 0),
    totalPaid: 0,
    outstandingBalance: amount,
    overpaidAmount: 0,
    paymentStatus: "unpaid",
    status: "recorded",
    recurringRuleId:
      payload.recurringRuleId && mongoose.isValidObjectId(payload.recurringRuleId)
        ? payload.recurringRuleId
        : null,
    occurrencePeriodKey: payload.occurrencePeriodKey || null,
    referenceNote: String(payload.referenceNote || "").trim(),
    notes: String(payload.notes || "").trim(),
    attachments: Array.isArray(payload.attachments) ? payload.attachments.filter(Boolean) : [],
    createdBy: actorId,
    updatedBy: actorId
  }).save({ session: session || undefined });

  await recordFinanceAudit(subdomain, {
    action: "expense_created",
    entityType: "expense",
    entityId: String(expenseDoc._id),
    referenceCode: expenseDoc.expenseCode,
    summary: `تسجيل مصروف "${title}" (${category}) بقيمة ${amount} ${currency} للفترة ${accountingPeriod}`,
    afterState: expenseDoc.toObject(),
    actor,
    activityPayload: {
      eventType: "expense_recorded",
      amount,
      currency,
      note: `مصروف: ${title} (${expenseDoc.expenseCode})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.EXPENSE_CREATED, {
    subdomain,
    expense: expenseDoc.toObject()
  });

  // Optional: If immediate payment was explicitly requested on creation
  if (payload.paidImmediately === true || (payload.initialPaymentAmount && Number(payload.initialPaymentAmount) > 0)) {
    const payAmt = payload.paidImmediately === true ? amount : Number(payload.initialPaymentAmount);
    return recordExpensePayment(
      subdomain,
      expenseDoc._id,
      {
        amount: payAmt,
        currency,
        paymentMethod: payload.paymentMethod || "cash",
        paidAt: payload.paidAt || effectiveDate,
        referenceNote: payload.referenceNote || "سداد مباشر عند تسجيل المصروف",
        idempotencyKey: payload.idempotencyKey ? `${payload.idempotencyKey}:init_pay` : null
      },
      actor
    );
  }

  return {
    expense: expenseDoc.toObject(),
    payments: [],
    balanceSummary: {
      originalObligation: amount,
      totalPaid: 0,
      outstandingBalance: amount,
      paymentStatus: "unpaid"
    }
  };
}

async function updateExpense(subdomain, expenseId, payload = {}, actor = null) {
  const Expense = getExpenseModel(subdomain);
  const validId = validateObjectId(expenseId, "معرف المصروف");
  const expenseDoc = await Expense.findById(validId);
  if (!expenseDoc) {
    throw createFinanceError("سجل المصروف غير موجود", 404);
  }

  const beforeState = expenseDoc.toObject();
  if (payload.title !== undefined) {
    const t = String(payload.title).trim();
    if (!t) throw createFinanceError("عنوان المصروف لا يمكن أن يكون فارغاً", 400);
    expenseDoc.title = t;
  }
  if (payload.category !== undefined && EXPENSE_CATEGORIES.includes(payload.category)) {
    expenseDoc.category = payload.category;
  }
  if (payload.amount !== undefined) {
    expenseDoc.amount = validatePositiveAmount(payload.amount, "قيمة المصروف");
  }
  if (payload.effectiveDate !== undefined) {
    expenseDoc.effectiveDate = validateOptionalDate(payload.effectiveDate, "تاريخ المصروف") || expenseDoc.effectiveDate;
    if (!payload.accountingPeriod) {
      expenseDoc.accountingPeriod = toAccountingPeriod(expenseDoc.effectiveDate);
    }
  }
  if (payload.accountingPeriod !== undefined) {
    expenseDoc.accountingPeriod = String(payload.accountingPeriod).trim();
  }
  if (payload.dueDate !== undefined) {
    expenseDoc.dueDate = payload.dueDate ? validateOptionalDate(payload.dueDate, "تاريخ الاستحقاق") : null;
  }
  if (payload.payeeName !== undefined) expenseDoc.payeeName = String(payload.payeeName).trim();
  if (payload.notes !== undefined) expenseDoc.notes = String(payload.notes).trim();
  if (payload.status && ["recorded", "cancelled"].includes(payload.status)) {
    expenseDoc.status = payload.status;
  }

  expenseDoc.updatedBy = actor?._id || actor?.userId || null;
  const recalculated = await recalculateAndSaveExpenseState(subdomain, expenseDoc);

  await recordFinanceAudit(subdomain, {
    action: "expense_updated",
    entityType: "expense",
    entityId: String(expenseDoc._id),
    referenceCode: expenseDoc.expenseCode,
    summary: `تحديث بيانات المصروف ${expenseDoc.expenseCode}`,
    beforeState,
    afterState: recalculated.expense,
    actor
  });

  return recalculated;
}

async function recordExpensePayment(subdomain, expenseId, payload = {}, actor = null) {
  const Expense = getExpenseModel(subdomain);
  const validId = validateObjectId(expenseId, "معرف المصروف");
  const expenseDoc = await Expense.findById(validId);
  if (!expenseDoc) {
    throw createFinanceError("سجل المصروف غير موجود", 404);
  }
  if (expenseDoc.status === "cancelled") {
    throw createFinanceError("لا يمكن تسجيل دفعة لمصروف ملغي", 400);
  }

  const paymentResult = await createPaymentEntry(subdomain, {
    entityType: "expense",
    entityId: expenseDoc._id,
    entityReferenceCode: expenseDoc.expenseCode,
    direction: "outflow",
    amount: payload.amount,
    currency: payload.currency || expenseDoc.currency || "EGP",
    paymentMethod: payload.paymentMethod || "cash",
    paidAt: payload.paidAt || new Date(),
    referenceNote: payload.referenceNote || "",
    notes: payload.notes || "",
    attachments: payload.attachments || [],
    idempotencyKey: payload.idempotencyKey || null,
    actor
  });

  const recalculated = await recalculateAndSaveExpenseState(subdomain, expenseDoc);

  if (!paymentResult.deduplicated) {
    await recordFinanceAudit(subdomain, {
      action: "expense_payment_recorded",
      entityType: "finance_payment",
      entityId: String(paymentResult.payment._id),
      referenceCode: paymentResult.payment.paymentReference,
      summary: `سداد دفعة (${paymentResult.payment.amount} ${paymentResult.payment.currency}) للمصروف ${expenseDoc.expenseCode}`,
      afterState: {
        payment: paymentResult.payment,
        expenseTotalPaid: recalculated.expense.totalPaid,
        expenseOutstanding: recalculated.expense.outstandingBalance
      },
      actor,
      activityPayload: {
        eventType: "expense_payment_recorded",
        paymentId: paymentResult.payment._id,
        amount: paymentResult.payment.amount,
        currency: paymentResult.payment.currency,
        note: `سداد مصروف ${expenseDoc.expenseCode}: ${expenseDoc.title}`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.EXPENSE_PAID, {
      subdomain,
      payment: paymentResult.payment,
      expense: recalculated.expense
    });
  }

  return {
    payment: paymentResult.payment,
    deduplicated: paymentResult.deduplicated,
    ...recalculated
  };
}

async function reverseExpensePayment(subdomain, expenseId, paymentId, payload = {}, actor = null) {
  const Expense = getExpenseModel(subdomain);
  const validId = validateObjectId(expenseId, "معرف المصروف");
  const expenseDoc = await Expense.findById(validId);
  if (!expenseDoc) {
    throw createFinanceError("سجل المصروف غير موجود", 404);
  }

  const reversalResult = await reversePaymentEntry(subdomain, {
    paymentId,
    reason: payload.reason || payload.notes || "عكس دفعة مصروف",
    actor
  });

  const recalculated = await recalculateAndSaveExpenseState(subdomain, expenseDoc);

  await recordFinanceAudit(subdomain, {
    action: "expense_payment_reversed",
    entityType: "finance_payment",
    entityId: String(reversalResult.reversalPayment._id),
    referenceCode: reversalResult.reversalPayment.paymentReference,
    summary: `عكس دفعة المصروف ${expenseDoc.expenseCode}`,
    beforeState: { originalPayment: reversalResult.originalPayment },
    afterState: { reversalPayment: reversalResult.reversalPayment, expense: recalculated.expense },
    actor
  });

  return {
    ...reversalResult,
    ...recalculated
  };
}

async function correctExpensePayment(subdomain, expenseId, paymentId, payload = {}, actor = null) {
  const Expense = getExpenseModel(subdomain);
  const validId = validateObjectId(expenseId, "معرف المصروف");
  const expenseDoc = await Expense.findById(validId);
  if (!expenseDoc) {
    throw createFinanceError("سجل المصروف غير موجود", 404);
  }

  const correctionResult = await correctPaymentEntry(subdomain, {
    paymentId,
    newAmount: payload.newAmount ?? payload.correctedAmount ?? payload.amount,
    reason: payload.reason || payload.notes || "",
    actor
  });

  const recalculated = await recalculateAndSaveExpenseState(subdomain, expenseDoc);

  await recordFinanceAudit(subdomain, {
    action: "expense_payment_corrected",
    entityType: "finance_payment",
    entityId: String(correctionResult.correctionPayment._id),
    referenceCode: correctionResult.correctionPayment.paymentReference,
    summary: `تصحيح دفعة المصروف ${expenseDoc.expenseCode}`,
    afterState: { ...correctionResult, expense: recalculated.expense },
    actor
  });

  return {
    ...correctionResult,
    ...recalculated
  };
}

async function listExpenses(
  subdomain,
  {
    category = "",
    paymentStatus = "",
    accountingPeriod = "",
    recurringOnly = false,
    startDate = "",
    endDate = "",
    page = 1,
    limit = 50
  } = {}
) {
  const Expense = getExpenseModel(subdomain);
  const query = { status: { $ne: "cancelled" } };

  if (category && category !== "all") query.category = category;
  if (paymentStatus && paymentStatus !== "all") query.paymentStatus = paymentStatus;
  if (accountingPeriod) query.accountingPeriod = String(accountingPeriod).trim();
  if (recurringOnly === true || recurringOnly === "true") {
    query.recurringRuleId = { $ne: null };
  }
  if (startDate || endDate) {
    query.effectiveDate = {};
    if (startDate) query.effectiveDate.$gte = new Date(startDate);
    if (endDate) query.effectiveDate.$lte = new Date(endDate);
  }

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const [total, expenses] = await Promise.all([
    Expense.countDocuments(query),
    Expense.find(query)
      .sort({ effectiveDate: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean()
  ]);

  let totalIncurred = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  for (const e of expenses) {
    totalIncurred = roundMoney(totalIncurred + Number(e.amount || 0));
    totalPaid = roundMoney(totalPaid + Number(e.totalPaid || 0));
    totalOutstanding = roundMoney(totalOutstanding + Number(e.outstandingBalance || 0));
  }

  return {
    expenses,
    summary: {
      totalCount: total,
      totalIncurred,
      totalPaid,
      totalOutstanding
    },
    total,
    page: p,
    pages: Math.ceil(total / l) || 1
  };
}

async function getExpenseById(subdomain, expenseId) {
  const Expense = getExpenseModel(subdomain);
  const validId = validateObjectId(expenseId, "معرف المصروف");
  const expenseDoc = await Expense.findById(validId);
  if (!expenseDoc) {
    throw createFinanceError("سجل المصروف غير موجود", 404);
  }
  return recalculateAndSaveExpenseState(subdomain, expenseDoc);
}

// ============================================================================
// 2. Recurring Expense Rules & Occurrence Generation (D2)
// ============================================================================

async function createRecurringExpenseRule(subdomain, payload = {}, actor = null) {
  const RecurringRule = getRecurringExpenseRuleModel(subdomain);
  const title = String(payload.title || "").trim();
  if (!title) {
    throw createFinanceError("يرجى إدخال عنوان المصروف الدوري", 400);
  }

  const category = EXPENSE_CATEGORIES.includes(payload.category)
    ? payload.category
    : "rent";
  const amount = validatePositiveAmount(payload.amount, "قيمة المصروف الدوري");
  const currency = validateCurrencyCode(payload.currency || "EGP");
  const frequency = RECURRENCE_FREQUENCIES.includes(payload.frequency)
    ? payload.frequency
    : "monthly";
  const startDate = validateOptionalDate(payload.startDate, "تاريخ بدء التكرار") || new Date();
  const endDate = validateOptionalDate(payload.endDate, "تاريخ انتهاء التكرار");
  const dayOfMonth = Math.min(28, Math.max(1, Number(payload.dayOfMonth || 1)));
  const dueDaysOffset = Math.max(0, Number(payload.dueDaysOffset ?? 5));

  const ruleCode = payload.ruleCode
    ? String(payload.ruleCode).trim().toUpperCase()
    : await generateUniqueCode(RecurringRule, "ruleCode", "REC");

  const actorId = actor?._id || actor?.userId || null;

  const ruleDoc = await new RecurringRule({
    ruleCode,
    title,
    category,
    amount,
    currency,
    frequency,
    startDate,
    endDate,
    dayOfMonth,
    dueDaysOffset,
    payeeName: String(payload.payeeName || "").trim(),
    payeePhone: String(payload.payeePhone || "").trim(),
    notes: String(payload.notes || "").trim(),
    active: payload.active !== false,
    createdBy: actorId,
    updatedBy: actorId
  }).save();

  await recordFinanceAudit(subdomain, {
    action: "recurring_expense_rule_created",
    entityType: "recurring_expense_rule",
    entityId: String(ruleDoc._id),
    referenceCode: ruleDoc.ruleCode,
    summary: `إنشاء قاعدة مصروف دوري "${title}" (${frequency}) بقيمة ${amount} ${currency}`,
    afterState: ruleDoc.toObject(),
    actor
  });

  // Optionally generate the initial occurrence if requested
  let initialGeneration = null;
  if (payload.generateCurrentPeriod === true) {
    initialGeneration = await generateRecurringExpenseOccurrences(
      subdomain,
      { ruleId: ruleDoc._id, asOfDate: startDate },
      actor
    );
  }

  return {
    rule: ruleDoc.toObject(),
    initialGeneration
  };
}

/**
 * Update a recurring expense rule for future occurrences.
 * Explicitly preserves all previously generated `storeExpense` occurrences untouched!
 */
async function updateRecurringExpenseRule(subdomain, ruleId, payload = {}, actor = null) {
  const RecurringRule = getRecurringExpenseRuleModel(subdomain);
  const validId = validateObjectId(ruleId, "معرف قاعدة المصروف الدوري");
  const ruleDoc = await RecurringRule.findById(validId);
  if (!ruleDoc) {
    throw createFinanceError("قاعدة المصروف الدوري غير موجودة", 404);
  }

  const beforeState = ruleDoc.toObject();
  if (payload.title !== undefined) {
    const t = String(payload.title).trim();
    if (!t) throw createFinanceError("عنوان المصروف الدوري مطلوب", 400);
    ruleDoc.title = t;
  }
  if (payload.category !== undefined && EXPENSE_CATEGORIES.includes(payload.category)) {
    ruleDoc.category = payload.category;
  }
  if (payload.amount !== undefined) {
    ruleDoc.amount = validatePositiveAmount(payload.amount, "قيمة المصروف الدوري");
  }
  if (payload.frequency !== undefined && RECURRENCE_FREQUENCIES.includes(payload.frequency)) {
    ruleDoc.frequency = payload.frequency;
  }
  if (payload.dayOfMonth !== undefined) {
    ruleDoc.dayOfMonth = Math.min(28, Math.max(1, Number(payload.dayOfMonth || 1)));
  }
  if (payload.payeeName !== undefined) ruleDoc.payeeName = String(payload.payeeName).trim();
  if (payload.notes !== undefined) ruleDoc.notes = String(payload.notes).trim();
  if (payload.active !== undefined) ruleDoc.active = Boolean(payload.active);
  if (payload.endDate !== undefined) {
    ruleDoc.endDate = payload.endDate ? validateOptionalDate(payload.endDate, "تاريخ الانتهاء") : null;
  }

  ruleDoc.updatedBy = actor?._id || actor?.userId || null;
  await ruleDoc.save();

  await recordFinanceAudit(subdomain, {
    action: "recurring_expense_rule_updated",
    entityType: "recurring_expense_rule",
    entityId: String(ruleDoc._id),
    referenceCode: ruleDoc.ruleCode,
    summary: `تحديث قاعدة المصروف الدوري ${ruleDoc.ruleCode} (يسري على الفترات القادمة فقط دون تعديل السجلات السابقة)`,
    beforeState,
    afterState: ruleDoc.toObject(),
    actor
  });

  return { rule: ruleDoc.toObject() };
}

async function listRecurringExpenseRules(subdomain, { activeOnly = false } = {}) {
  const RecurringRule = getRecurringExpenseRuleModel(subdomain);
  const query = activeOnly ? { active: true } : {};
  const rules = await RecurringRule.find(query).sort({ createdAt: -1 }).lean();
  return { rules };
}

/**
 * Idempotently generate period-specific expense occurrences (`storeExpense`) from active recurring rules.
 * Safe against retries or repeated cron invocations: checks `{ recurringRuleId, occurrencePeriodKey }`.
 * Never marks generated occurrences as paid automatically.
 */
async function generateRecurringExpenseOccurrences(
  subdomain,
  { asOfDate = new Date(), periodKey = null, ruleId = null } = {},
  actor = null
) {
  const RecurringRule = getRecurringExpenseRuleModel(subdomain);
  const Expense = getExpenseModel(subdomain);

  const targetDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const query = { active: true };
  if (ruleId && mongoose.isValidObjectId(ruleId)) {
    query._id = new mongoose.Types.ObjectId(ruleId);
  }

  const rules = await RecurringRule.find(query);
  const createdOccurrences = [];
  const skippedDuplicates = [];

  for (const rule of rules) {
    if (rule.startDate && targetDate < new Date(rule.startDate) && !periodKey) {
      continue;
    }
    if (rule.endDate && targetDate > new Date(rule.endDate) && !periodKey) {
      continue;
    }

    const effectivePeriodKey = periodKey
      ? String(periodKey).trim()
      : computeOccurrencePeriodKey(rule.frequency, targetDate);

    // Check if occurrence already exists for this rule + periodKey
    const existing = await Expense.findOne({
      recurringRuleId: rule._id,
      occurrencePeriodKey: effectivePeriodKey
    }).lean();

    if (existing) {
      skippedDuplicates.push({
        ruleId: String(rule._id),
        ruleCode: rule.ruleCode,
        occurrencePeriodKey: effectivePeriodKey,
        existingExpenseId: String(existing._id),
        existingExpenseCode: existing.expenseCode
      });
      continue;
    }

    let occurrenceEffectiveDate = targetDate;
    if (/^\d{4}-\d{2}$/.test(effectivePeriodKey)) {
      const [yStr, mStr] = effectivePeriodKey.split("-");
      const yNum = Number(yStr);
      const mNum = Number(mStr);
      if (targetDate.getFullYear() !== yNum || targetDate.getMonth() + 1 !== mNum) {
        occurrenceEffectiveDate = new Date(
          yNum,
          mNum - 1,
          Math.min(28, Math.max(1, Number(rule.dayOfMonth || 1))),
          12,
          0,
          0
        );
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(effectivePeriodKey)) {
      occurrenceEffectiveDate = new Date(`${effectivePeriodKey}T12:00:00Z`);
    }

    const dueDate = new Date(
      occurrenceEffectiveDate.getTime() + Number(rule.dueDaysOffset || 5) * 24 * 60 * 60 * 1000
    );

    const accountingPeriod =
      /^\d{4}-\d{2}$/.test(effectivePeriodKey)
        ? effectivePeriodKey
        : toAccountingPeriod(occurrenceEffectiveDate);

    const createdRes = await createExpense(
      subdomain,
      {
        title: `${rule.title} (${effectivePeriodKey})`,
        category: rule.category,
        amount: rule.amount,
        currency: rule.currency,
        effectiveDate: occurrenceEffectiveDate,
        accountingPeriod,
        dueDate,
        payeeName: rule.payeeName,
        payeePhone: rule.payeePhone,
        recurringRuleId: rule._id,
        occurrencePeriodKey: effectivePeriodKey,
        referenceNote: `توليد تلقائي من القاعدة الدورية ${rule.ruleCode}`,
        notes: rule.notes
      },
      actor
    );

    rule.lastGeneratedPeriodKey = effectivePeriodKey;
    rule.lastGeneratedAt = new Date();
    await rule.save();

    createdOccurrences.push(createdRes.expense);

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.RECURRING_EXPENSE_GENERATED, {
      subdomain,
      rule: rule.toObject(),
      expense: createdRes.expense
    });
  }

  return {
    createdOccurrences,
    skippedDuplicates,
    createdCount: createdOccurrences.length,
    skippedCount: skippedDuplicates.length
  };
}

// ============================================================================
// 3. Manual / Offline Sales & Payments (D3 & D4)
// ============================================================================

async function recalculateAndSaveManualSaleState(subdomain, saleDoc, now = new Date()) {
  const payments = await listPaymentsForEntity(subdomain, {
    entityType: "manual_sale",
    entityId: saleDoc._id
  });

  const balance = calculateObligationBalance({
    expectedGoodsValue: saleDoc.totalAmount,
    linesTotal: saleDoc.totalAmount,
    explicitApprovedObligation: saleDoc.totalAmount,
    paymentRecords: payments,
    dueDate: saleDoc.dueDate,
    shipmentStatus: saleDoc.status === "cancelled" ? "cancelled" : "ordered",
    now
  });

  saleDoc.totalPaid = balance.totalPaid;
  saleDoc.outstandingBalance = balance.outstandingBalance;
  saleDoc.overpaidAmount = balance.overpaidAmount;
  saleDoc.paymentStatus = balance.paymentStatus;

  await saleDoc.save();

  const msObj = {
    ...saleDoc.toObject(),
    totalCostOfGoodsSold: saleDoc.totalCostSnapshot,
    totalCollected: saleDoc.totalPaid,
    customerName: saleDoc.customer?.name || ""
  };

  return {
    manualSale: msObj,
    payments,
    balanceSummary: balance
  };
}

async function createManualSale(subdomain, payload = {}, actor = null) {
  const ManualSale = getManualSaleModel(subdomain);
  const Products = getProductsModel(subdomain);

  const cleanIdempotencyKey = payload.idempotencyKey
    ? String(payload.idempotencyKey).trim()
    : null;

  if (cleanIdempotencyKey) {
    const existing = await ManualSale.findOne({ idempotencyKey: cleanIdempotencyKey });
    if (existing) {
      const state = await recalculateAndSaveManualSaleState(subdomain, existing);
      return { ...state, deduplicated: true, duplicate: true };
    }
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    throw createFinanceError("يرجى إضافة منتج واحد على الأقل لتسجيل عملية البيع اليدوي", 400);
  }

  const sourceChannel = MANUAL_SALE_SOURCES.includes(payload.sourceChannel)
    ? payload.sourceChannel
    : "manual_offline";

  const saleDate = validateOptionalDate(payload.saleDate, "تاريخ البيع") || new Date();
  const currency = validateCurrencyCode(payload.currency || "EGP");
  const saleLevelDiscount = validateNonNegativeAmount(
    payload.discount ?? payload.discountAmount ?? 0,
    "خصم الفاتورة"
  );
  const shippingCharge = validateNonNegativeAmount(payload.shippingCharge || 0, "رسوم الشحن");
  const actualCarrierShippingCost = validateNonNegativeAmount(
    payload.actualCarrierShippingCost ?? payload.actualCarrierCost ?? 0,
    "تكلفة الشحن الفعلية"
  );

  // Consolidate items by productId and validate against existing storeProduct catalog
  const prelimLines = [];
  let grossSubtotal = 0;

  for (const raw of rawItems) {
    const validProdId = validateObjectId(raw.productId || raw._id, "معرف المنتج");
    const product = await Products.findById(validProdId).lean();
    if (!product) {
      throw createFinanceError(`المنتج غير موجود في الكتالوج (${raw.productId})`, 404);
    }

    const quantity = Math.max(1, Math.round(Number(raw.quantity || 1)));
    if (payload.allowNegativeStock !== true && Number(product.stockCount || 0) < quantity) {
      throw createFinanceError(
        `الرصيد المتاح للمنتج "${product.name}" (${product.stockCount}) غير كافٍ لبيع الكمية (${quantity})`,
        400,
        "INSUFFICIENT_PHYSICAL_STOCK"
      );
    }

    const rawPriceVal =
      raw.unitSellingPrice !== undefined && raw.unitSellingPrice !== ""
        ? raw.unitSellingPrice
        : raw.unitPrice;
    const unitSellingPrice =
      rawPriceVal !== undefined && rawPriceVal !== ""
        ? validateNonNegativeAmount(rawPriceVal, "سعر بيع الوحدة")
        : roundMoney(Number(product.price || 0));

    const unitDiscount = validateNonNegativeAmount(raw.unitDiscount || 0, "خصم الوحدة");
    const effectiveUnitPrice = Math.max(0, roundMoney(unitSellingPrice - unitDiscount));
    const grossLineTotal = roundMoney(quantity * effectiveUnitPrice);
    grossSubtotal = roundMoney(grossSubtotal + grossLineTotal);

    prelimLines.push({
      productId: product._id,
      nameSnapshot: product.name,
      groupCodeSnapshot: product.groupCode || "",
      quantity,
      unitSellingPrice,
      unitDiscount,
      grossLineTotal
    });
  }

  const effectiveDiscount = Math.min(grossSubtotal, saleLevelDiscount);
  const netMerchandiseTotal = roundMoney(Math.max(0, grossSubtotal - effectiveDiscount));
  const totalAmount = roundMoney(netMerchandiseTotal + shippingCharge);

  const saleCode = payload.saleCode
    ? String(payload.saleCode).trim().toUpperCase()
    : await generateUniqueCode(ManualSale, "saleCode", "MS");

  const actorId = actor?._id || actor?.userId || null;

  // Allocate order-level discount across lines
  let allocatedSum = 0;
  const itemsWithDiscount = prelimLines.map((line, idx) => {
    let allocatedSaleDiscount = 0;
    if (effectiveDiscount > 0 && grossSubtotal > 0) {
      if (idx === prelimLines.length - 1) {
        allocatedSaleDiscount = roundMoney(effectiveDiscount - allocatedSum);
      } else {
        allocatedSaleDiscount = roundMoney((line.grossLineTotal / grossSubtotal) * effectiveDiscount);
        allocatedSum = roundMoney(allocatedSum + allocatedSaleDiscount);
      }
    }
    const netLineValue = roundMoney(Math.max(0, line.grossLineTotal - allocatedSaleDiscount));
    return {
      ...line,
      allocatedSaleDiscount,
      netLineValue,
      unitCostSnapshot: 0,
      lineCostTotal: 0,
      costingMethodUsed: "weighted_average"
    };
  });

  // Create ManualSale document first so we have its _id for inventory movement traceability
  const saleDoc = await new ManualSale({
    saleCode,
    sourceChannel,
    saleDate,
    customer: {
      name: String(payload.customer?.name || payload.customerName || "عميل مباشر (معرض/كاشير)").trim(),
      phone: String(payload.customer?.phone || payload.customerPhone || "").trim(),
      email: String(payload.customer?.email || "").trim(),
      address: String(payload.customer?.address || "").trim(),
      notes: String(payload.customer?.notes || "").trim()
    },
    items: itemsWithDiscount,
    currency,
    grossSubtotal,
    discountTotal: effectiveDiscount,
    netMerchandiseTotal,
    shippingCharge,
    actualCarrierShippingCost,
    totalAmount,
    totalCostSnapshot: 0,
    grossProfitSnapshot: netMerchandiseTotal,
    totalPaid: 0,
    outstandingBalance: totalAmount,
    paymentStatus: "unpaid",
    dueDate: validateOptionalDate(payload.dueDate, "تاريخ استحقاق السداد"),
    status: "completed",
    idempotencyKey: cleanIdempotencyKey,
    notes: String(payload.notes || "").trim(),
    createdBy: actorId,
    updatedBy: actorId
  }).save();

  // Deduct inventory and compute authoritative COGS via Phase C `recordSaleConsumption`
  const cogsRes = await recordSaleConsumption(
    subdomain,
    {
      sourceType: "manual_sale",
      sourceId: String(saleDoc._id),
      sourceReference: saleDoc.saleCode,
      items: saleDoc.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity
      })),
      skipProductStockMutation: false,
      occurredAt: saleDate
    },
    actor
  );

  let totalCostSnapshot = 0;
  for (const item of saleDoc.items) {
    const cogsEntry = cogsRes.itemsCostMap[String(item.productId)];
    if (cogsEntry) {
      item.unitCostSnapshot = cogsEntry.unitCost;
      item.lineCostTotal = cogsEntry.lineCostTotal;
      item.costingMethodUsed = cogsEntry.costingMethodUsed || "weighted_average";
    }
    totalCostSnapshot = roundMoney(totalCostSnapshot + Number(item.lineCostTotal || 0));
    await Products.updateOne(
      { _id: item.productId },
      { $inc: { salesCount: item.quantity } }
    );
  }

  saleDoc.totalCostSnapshot = totalCostSnapshot;
  saleDoc.grossProfitSnapshot = roundMoney(
    netMerchandiseTotal - totalCostSnapshot + (shippingCharge - actualCarrierShippingCost)
  );
  await saleDoc.save();

  await recordFinanceAudit(subdomain, {
    action: "manual_sale_created",
    entityType: "manual_sale",
    entityId: String(saleDoc._id),
    referenceCode: saleDoc.saleCode,
    summary: `تسجيل فاتورة بيع يدوي (${saleDoc.saleCode} - ${sourceChannel}) بإجمالي ${totalAmount} ${currency}`,
    afterState: saleDoc.toObject(),
    actor,
    activityPayload: {
      eventType: "manual_sale_recorded",
      amount: totalAmount,
      currency,
      note: `بيع يدوي ${saleDoc.saleCode} (${saleDoc.customer.name})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.MANUAL_SALE_CREATED, {
    subdomain,
    manualSale: saleDoc.toObject()
  });

  // Record initial payment if paid amount was provided (supports full, partial, or 0 unpaid credit)
  const rawPaidInput =
    payload.paidAmount !== undefined && payload.paidAmount !== ""
      ? payload.paidAmount
      : payload.initialPaidAmount;

  const rawPaidAmount =
    rawPaidInput !== undefined && rawPaidInput !== ""
      ? Number(rawPaidInput)
      : payload.paidImmediately === true
      ? totalAmount
      : 0;

  if (rawPaidAmount > 0) {
    return recordManualSalePayment(
      subdomain,
      saleDoc._id,
      {
        amount: rawPaidAmount,
        currency,
        paymentMethod: payload.paymentMethod || "cash",
        paidAt: saleDate,
        referenceNote: payload.referenceNote || "تحصيل عند إصدار فاتورة البيع اليدوي",
        idempotencyKey: cleanIdempotencyKey ? `${cleanIdempotencyKey}:init_pay` : null
      },
      actor
    );
  }

  return recalculateAndSaveManualSaleState(subdomain, saleDoc);
}

async function recordManualSalePayment(subdomain, saleId, payload = {}, actor = null) {
  const ManualSale = getManualSaleModel(subdomain);
  const validId = validateObjectId(saleId, "معرف فاتورة البيع اليدوي");
  const saleDoc = await ManualSale.findById(validId);
  if (!saleDoc) {
    throw createFinanceError("فاتورة البيع اليدوي غير موجودة", 404);
  }
  if (saleDoc.status === "cancelled") {
    throw createFinanceError("لا يمكن تسجيل تحصيل لفاتورة بيع يدوي ملغاة", 400);
  }

  const paymentResult = await createPaymentEntry(subdomain, {
    entityType: "manual_sale",
    entityId: saleDoc._id,
    entityReferenceCode: saleDoc.saleCode,
    direction: "inflow",
    amount: payload.amount,
    currency: payload.currency || saleDoc.currency || "EGP",
    paymentMethod: payload.paymentMethod || "cash",
    paidAt: payload.paidAt || new Date(),
    referenceNote: payload.referenceNote || "",
    notes: payload.notes || "",
    idempotencyKey: payload.idempotencyKey || null,
    actor
  });

  const recalculated = await recalculateAndSaveManualSaleState(subdomain, saleDoc);

  if (!paymentResult.deduplicated) {
    await recordFinanceAudit(subdomain, {
      action: "manual_sale_payment_recorded",
      entityType: "finance_payment",
      entityId: String(paymentResult.payment._id),
      referenceCode: paymentResult.payment.paymentReference,
      summary: `تحصيل دفعة (${paymentResult.payment.amount} ${paymentResult.payment.currency}) لفاتورة البيع اليدوي ${saleDoc.saleCode}`,
      afterState: {
        payment: paymentResult.payment,
        saleTotalPaid: recalculated.manualSale.totalPaid,
        saleOutstanding: recalculated.manualSale.outstandingBalance
      },
      actor,
      activityPayload: {
        eventType: "manual_sale_payment_recorded",
        paymentId: paymentResult.payment._id,
        amount: paymentResult.payment.amount,
        currency: paymentResult.payment.currency,
        note: `تحصيل فاتورة بيع يدوي ${saleDoc.saleCode}`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.MANUAL_SALE_PAYMENT_RECORDED, {
      subdomain,
      payment: paymentResult.payment,
      manualSale: recalculated.manualSale
    });
  }

  return {
    payment: paymentResult.payment,
    deduplicated: paymentResult.deduplicated,
    ...recalculated
  };
}

async function reverseManualSalePayment(subdomain, saleId, paymentId, payload = {}, actor = null) {
  const ManualSale = getManualSaleModel(subdomain);
  const validId = validateObjectId(saleId, "معرف فاتورة البيع اليدوي");
  const saleDoc = await ManualSale.findById(validId);
  if (!saleDoc) {
    throw createFinanceError("فاتورة البيع اليدوي غير موجودة", 404);
  }

  const reversalResult = await reversePaymentEntry(subdomain, {
    paymentId,
    reason: payload.reason || payload.notes || "عكس دفعة تحصيل بيع يدوي",
    actor
  });

  const recalculated = await recalculateAndSaveManualSaleState(subdomain, saleDoc);
  return {
    ...reversalResult,
    ...recalculated
  };
}

async function correctManualSalePayment(subdomain, saleId, paymentId, payload = {}, actor = null) {
  const ManualSale = getManualSaleModel(subdomain);
  const validId = validateObjectId(saleId, "معرف فاتورة البيع اليدوي");
  const saleDoc = await ManualSale.findById(validId);
  if (!saleDoc) {
    throw createFinanceError("فاتورة البيع اليدوي غير موجودة", 404);
  }

  const correctionResult = await correctPaymentEntry(subdomain, {
    paymentId,
    newAmount: payload.newAmount ?? payload.correctedAmount ?? payload.amount,
    reason: payload.reason || payload.notes || "",
    actor
  });

  const recalculated = await recalculateAndSaveManualSaleState(subdomain, saleDoc);
  return {
    ...correctionResult,
    ...recalculated
  };
}

async function listManualSales(
  subdomain,
  {
    sourceChannel = "",
    paymentStatus = "",
    startDate = "",
    endDate = "",
    page = 1,
    limit = 50
  } = {}
) {
  const ManualSale = getManualSaleModel(subdomain);
  const query = { status: { $ne: "cancelled" } };

  if (sourceChannel && sourceChannel !== "all") query.sourceChannel = sourceChannel;
  if (paymentStatus && paymentStatus !== "all") query.paymentStatus = paymentStatus;
  if (startDate || endDate) {
    query.saleDate = {};
    if (startDate) query.saleDate.$gte = new Date(startDate);
    if (endDate) query.saleDate.$lte = new Date(endDate);
  }

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const [total, manualSales] = await Promise.all([
    ManualSale.countDocuments(query),
    ManualSale.find(query)
      .sort({ saleDate: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean()
  ]);

  let totalSalesAmount = 0;
  let totalCollected = 0;
  let totalReceivables = 0;
  let totalCogs = 0;
  for (const s of manualSales) {
    totalSalesAmount = roundMoney(totalSalesAmount + Number(s.totalAmount || 0));
    totalCollected = roundMoney(totalCollected + Number(s.totalPaid || 0));
    totalReceivables = roundMoney(totalReceivables + Number(s.outstandingBalance || 0));
    totalCogs = roundMoney(totalCogs + Number(s.totalCostSnapshot || 0));
  }

  const enrichedSales = manualSales.map((s) => ({
    ...s,
    totalCostOfGoodsSold: s.totalCostSnapshot,
    totalCollected: s.totalPaid,
    customerName: s.customer?.name || ""
  }));

  return {
    manualSales: enrichedSales,
    sales: enrichedSales,
    summary: {
      totalCount: total,
      totalSalesAmount,
      totalCollected,
      totalReceivables,
      totalReceivable: totalReceivables,
      totalCogs,
      grossProfit: roundMoney(totalSalesAmount - totalCogs)
    },
    total,
    page: p,
    pages: Math.ceil(total / l) || 1
  };
}

async function getManualSaleById(subdomain, saleId) {
  const ManualSale = getManualSaleModel(subdomain);
  const validId = validateObjectId(saleId, "معرف فاتورة البيع اليدوي");
  const saleDoc = await ManualSale.findById(validId);
  if (!saleDoc) {
    throw createFinanceError("فاتورة البيع اليدوي غير موجودة", 404);
  }
  return recalculateAndSaveManualSaleState(subdomain, saleDoc);
}

/**
 * Record actual cash collection for an online customer order (`entityType: "order_settlement"`, `direction: "inflow"`).
 */
async function recordOnlineOrderSettlementPayment(subdomain, orderId, payload = {}, actor = null) {
  const Orders = getOrdersModel(subdomain);
  const validId = validateObjectId(orderId, "معرف الطلب");
  const orderDoc = await Orders.findById(validId);
  if (!orderDoc) {
    throw createFinanceError("الطلب غير موجود", 404);
  }

  const amount =
    payload.amount !== undefined && payload.amount !== ""
      ? validatePositiveAmount(payload.amount, "المبلغ المحصل")
      : Number(orderDoc.total || 0);

  const paymentResult = await createPaymentEntry(subdomain, {
    entityType: "order_settlement",
    entityId: orderDoc._id,
    entityReferenceCode: orderDoc.orderId,
    direction: "inflow",
    amount,
    currency: orderDoc.financialSnapshot?.currency || "EGP",
    paymentMethod: payload.paymentMethod || (orderDoc.payment?.method === "cod" ? "cash" : "card"),
    paidAt: payload.paidAt || new Date(),
    referenceNote: payload.referenceNote || `تحصيل الطلب ${orderDoc.orderId}`,
    notes: payload.notes || "",
    idempotencyKey: payload.idempotencyKey || `order_settle:${orderDoc._id}:${amount}`,
    actor
  });

  const allPayments = await listPaymentsForEntity(subdomain, {
    entityType: "order_settlement",
    entityId: orderDoc._id
  });
  const sumCollected = roundMoney(
    allPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
  );
  if (sumCollected >= Number(orderDoc.total || 0)) {
    orderDoc.payment.paid = true;
    await orderDoc.save();
  }

  return {
    order: orderDoc.toObject(),
    payment: paymentResult.payment,
    deduplicated: paymentResult.deduplicated,
    totalCollected: sumCollected
  };
}

/**
 * Calculate real-time automatic payroll for Operating Expenses (OPEX)
 * Formula: Net Payroll = Sum(Permanent Staff Monthly Salaries) - Sum(Current Period Deductions)
 * Non-manual: Pulled automatically from staff database and deduction ledger.
 */
async function calculateAutomaticPayroll(subdomain, period = null) {
  const Users = getUsersModel(subdomain);
  const Deduction = getDeductionModel(subdomain);
  const currentPeriod = period || new Date().toISOString().slice(0, 7);

  const salariedStaff = await Users.find({
    role: { $in: [2, 3, 4, "2", "3", "4", "branch_admin", "sales_staff", "maintenance_tech", "staff", "technician"] },
    employmentType: { $in: ["permanent", "permanent_salaried"] },
    active: true
  })
    .select("_id fullname email phone role jobTitle branchId monthlySalary")
    .populate("branchId", "name code city")
    .lean();

  const deductions = await Deduction.find({ period: currentPeriod }).lean();

  const deductionMap = {};
  for (const d of deductions) {
    const eId = String(d.employeeId);
    deductionMap[eId] = roundMoney((deductionMap[eId] || 0) + (Number(d.amount) || 0));
  }

  let totalBaseSalaries = 0;
  let totalDeductions = 0;
  let totalNetSalaries = 0;

  const staffBreakdown = salariedStaff.map((staff) => {
    const base = Number(staff.monthlySalary) || 0;
    const ded = deductionMap[String(staff._id)] || 0;
    const net = Math.max(0, roundMoney(base - ded));

    totalBaseSalaries = roundMoney(totalBaseSalaries + base);
    totalDeductions = roundMoney(totalDeductions + ded);
    totalNetSalaries = roundMoney(totalNetSalaries + net);

    return {
      _id: staff._id,
      fullname: staff.fullname,
      jobTitle: staff.jobTitle || "موظف",
      role: staff.role,
      branch: staff.branchId,
      monthlySalary: base,
      deductionsThisMonth: ded,
      netSalary: net
    };
  });

  return {
    period: currentPeriod,
    staffCount: salariedStaff.length,
    totalBaseSalaries,
    totalDeductions,
    totalNetSalaries,
    staffBreakdown
  };
}

module.exports = {
  implemented: true,
  createExpense,
  updateExpense,
  recordExpensePayment,
  reverseExpensePayment,
  correctExpensePayment,
  listExpenses,
  getExpenseById,
  createRecurringExpenseRule,
  updateRecurringExpenseRule,
  listRecurringExpenseRules,
  generateRecurringExpenseOccurrences,
  createManualSale,
  recordManualSalePayment,
  reverseManualSalePayment,
  correctManualSalePayment,
  listManualSales,
  getManualSaleById,
  recordOnlineOrderSettlementPayment,
  calculateAutomaticPayroll
};
