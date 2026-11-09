/**
 * Finance Core Payment Service
 *
 * Handles:
 * - Recording full and partial payments as separate immutable records.
 * - Recording payment corrections (adjustments) and reversals with full linkage.
 * - Duplicate-request / retry protection via `idempotencyKey` and short-window request fingerprinting.
 * - Currency and amount validation.
 */

const crypto = require("crypto");
const getFinancePaymentModel = require("./paymentModel");
const { PAYMENT_METHODS } = require("../../shared/constants");
const {
  createFinanceError,
  roundMoney,
  validatePositiveAmount,
  validateCurrencyCode,
  validateObjectId,
  validateOptionalDate
} = require("../../shared/validators");

async function generateUniquePaymentReference(FinancePayment, prefix = "PAY") {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 8; attempt++) {
    const rnd = crypto.randomBytes(3).toString("hex").toUpperCase();
    const candidate = `${prefix}-${datePart}-${rnd}`;
    const exists = await FinancePayment.exists({ paymentReference: candidate });
    if (!exists) return candidate;
  }
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function computeRequestFingerprint({
  entityType,
  entityId,
  entryType,
  amount,
  currency,
  paymentMethod,
  referenceNote
}) {
  const raw = [
    String(entityType || ""),
    String(entityId || ""),
    String(entryType || "payment"),
    String(roundMoney(amount)),
    String(currency || "EGP"),
    String(paymentMethod || "cash"),
    String(referenceNote || "").trim()
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Create a new payment record with idempotency and duplicate-retry protection.
 */
async function createPaymentEntry(subdomain, {
  entityType = "supplier_shipment",
  entityId,
  entityReferenceCode = "",
  direction = "outflow",
  amount,
  currency = "EGP",
  paymentMethod = "cash",
  paidAt = new Date(),
  referenceNote = "",
  notes = "",
  attachments = [],
  idempotencyKey = null,
  dedupeWindowMs = 8000,
  expectedCurrency = null,
  actor = null
}) {
  const FinancePayment = getFinancePaymentModel(subdomain);
  const validEntityId = validateObjectId(entityId, "معرف الشحنة/الالتزام");
  const validAmount = validatePositiveAmount(amount, "مبلغ الدفعة");
  const validCurrency = validateCurrencyCode(currency);

  if (expectedCurrency) {
    const cleanExpectedCurrency = validateCurrencyCode(expectedCurrency);
    if (validCurrency !== cleanExpectedCurrency) {
      throw createFinanceError(
        `عملة الدفعة (${validCurrency}) لا تطابق عملة الشحنة/الالتزام (${cleanExpectedCurrency})`,
        400
      );
    }
  }

  const cleanMethod = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : "cash";
  const cleanPaidAt = validateOptionalDate(paidAt, "تاريخ الدفع") || new Date();
  const cleanIdempotencyKey = idempotencyKey ? String(idempotencyKey).trim() : null;

  // 1. Check explicit idempotency key first
  if (cleanIdempotencyKey) {
    const existingByIdem = await FinancePayment.findOne({
      entityType,
      entityId: validEntityId,
      idempotencyKey: cleanIdempotencyKey
    }).lean();
    if (existingByIdem) {
      return { payment: existingByIdem, deduplicated: true };
    }
  }

  // 2. Check short-window fingerprint when referenceNote or idempotency context indicates retry
  const fingerprint = computeRequestFingerprint({
    entityType,
    entityId: validEntityId,
    entryType: "payment",
    amount: validAmount,
    currency: validCurrency,
    paymentMethod: cleanMethod,
    referenceNote
  });

  if (dedupeWindowMs > 0) {
    const since = new Date(Date.now() - dedupeWindowMs);
    const recentDup = await FinancePayment.findOne({
      entityType,
      entityId: validEntityId,
      requestFingerprint: fingerprint,
      createdAt: { $gte: since }
    }).lean();
    if (recentDup) {
      return { payment: recentDup, deduplicated: true };
    }
  }

  const paymentReference = await generateUniquePaymentReference(FinancePayment, "PAY");
  const actorId = actor?._id || actor?.userId || null;

  const doc = await new FinancePayment({
    paymentReference,
    entityType,
    entityId: validEntityId,
    entityReferenceCode: String(entityReferenceCode || "").trim(),
    direction,
    entryType: "payment",
    amount: validAmount,
    currency: validCurrency,
    paymentMethod: cleanMethod,
    paidAt: cleanPaidAt,
    referenceNote: String(referenceNote || "").trim(),
    notes: String(notes || "").trim(),
    attachments: Array.isArray(attachments) ? attachments.filter(Boolean) : [],
    status: "posted",
    idempotencyKey: cleanIdempotencyKey,
    requestFingerprint: fingerprint,
    recordedBy: actorId
  }).save();

  return { payment: doc.toObject(), deduplicated: false };
}

/**
 * Reverse an existing payment entry by creating an offsetting reversal record.
 * Never deletes or overwrites the original payment record.
 */
async function reversePaymentEntry(subdomain, {
  paymentId,
  reason = "",
  actor = null
}) {
  const FinancePayment = getFinancePaymentModel(subdomain);
  const validPaymentId = validateObjectId(paymentId, "معرف الدفعة");
  const original = await FinancePayment.findById(validPaymentId);

  if (!original) {
    throw createFinanceError("سجل الدفعة المراد عكسها غير موجود", 404);
  }
  if (original.entryType === "reversal") {
    throw createFinanceError("لا يمكن عكس قيد عكسي سابق", 400);
  }
  if (original.status === "reversed" || original.reversedByPaymentId) {
    throw createFinanceError("تم عكس هذه الدفعة مسبقاً", 400);
  }

  const cleanReason = String(reason || "عكس دفعة مالية").trim();
  const reversalRef = await generateUniquePaymentReference(FinancePayment, "REV");
  const actorId = actor?._id || actor?.userId || null;

  // Compute current effective amount (including any active corrections on this payment)
  let effectiveAmountToReverse = Number(original.amount || 0);
  if (original.entryType === "payment") {
    const priorCorrections = await FinancePayment.find({
      parentPaymentId: original._id,
      entryType: "correction",
      status: { $ne: "reversed" }
    });
    const priorDeltaSum = priorCorrections.reduce((acc, c) => acc + Number(c.amount || 0), 0);
    effectiveAmountToReverse = roundMoney(effectiveAmountToReverse + priorDeltaSum);
    for (const corr of priorCorrections) {
      corr.status = "reversed";
      corr.reversalReason = cleanReason;
      await corr.save();
    }
  }

  const reversalDoc = await new FinancePayment({
    paymentReference: reversalRef,
    entityType: original.entityType,
    entityId: original.entityId,
    entityReferenceCode: original.entityReferenceCode,
    direction: original.direction,
    entryType: "reversal",
    amount: roundMoney(-effectiveAmountToReverse),
    currency: original.currency,
    paymentMethod: original.paymentMethod,
    paidAt: new Date(),
    referenceNote: `عكس للدفعة ${original.paymentReference}`,
    notes: cleanReason,
    status: "posted",
    parentPaymentId: original._id,
    reversalReason: cleanReason,
    recordedBy: actorId
  }).save();

  original.status = "reversed";
  original.reversedByPaymentId = reversalDoc._id;
  original.reversalReason = cleanReason;
  await original.save();

  return {
    originalPayment: original.toObject(),
    reversalPayment: reversalDoc.toObject()
  };
}

/**
 * Record an explicit payment correction (delta adjustment) referencing an earlier payment.
 * Preserves the original payment record untouched and appends a correction record.
 */
async function correctPaymentEntry(subdomain, {
  paymentId,
  newAmount,
  reason = "",
  actor = null
}) {
  const FinancePayment = getFinancePaymentModel(subdomain);
  const validPaymentId = validateObjectId(paymentId, "معرف الدفعة");
  const validNewAmount = validatePositiveAmount(newAmount, "المبلغ المصحح الجديد");

  const original = await FinancePayment.findById(validPaymentId);
  if (!original) {
    throw createFinanceError("سجل الدفعة المراد تصحيحها غير موجود", 404);
  }
  if (original.status === "reversed") {
    throw createFinanceError("لا يمكن تصحيح دفعة تم عكسها مسبقاً", 400);
  }
  if (original.entryType !== "payment") {
    throw createFinanceError("يمكن إجراء التصحيح على دفعة أساسية فقط", 400);
  }

  // Calculate current effective amount of this payment (original + any prior corrections on it)
  const priorCorrections = await FinancePayment.find({
    parentPaymentId: original._id,
    entryType: "correction",
    status: { $ne: "reversed" }
  }).lean();
  const priorDeltaSum = priorCorrections.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  const currentEffectiveAmount = roundMoney(original.amount + priorDeltaSum);
  const delta = roundMoney(validNewAmount - currentEffectiveAmount);

  if (delta === 0) {
    throw createFinanceError("المبلغ الجديد مطابق للمبلغ الفعلي الحالي للدفعة", 400);
  }

  const cleanReason = String(reason || `تصحيح قيمة الدفعة من ${currentEffectiveAmount} إلى ${validNewAmount}`).trim();
  const corrRef = await generateUniquePaymentReference(FinancePayment, "COR");
  const actorId = actor?._id || actor?.userId || null;

  const correctionDoc = await new FinancePayment({
    paymentReference: corrRef,
    entityType: original.entityType,
    entityId: original.entityId,
    entityReferenceCode: original.entityReferenceCode,
    direction: original.direction,
    entryType: "correction",
    amount: delta,
    currency: original.currency,
    paymentMethod: original.paymentMethod,
    paidAt: new Date(),
    referenceNote: `تصحيح للدفعة ${original.paymentReference}`,
    notes: cleanReason,
    status: "posted",
    parentPaymentId: original._id,
    recordedBy: actorId
  }).save();

  const correctionObj = correctionDoc.toObject();
  return {
    originalPayment: original.toObject(),
    correctionPayment: correctionObj,
    correctionEntry: correctionObj,
    previousEffectiveAmount: currentEffectiveAmount,
    newEffectiveAmount: validNewAmount,
    delta
  };
}

async function listPaymentsForEntity(subdomain, { entityType = "supplier_shipment", entityId }) {
  const FinancePayment = getFinancePaymentModel(subdomain);
  const validEntityId = validateObjectId(entityId, "معرف السجل");
  return FinancePayment.find({ entityType, entityId: validEntityId })
    .sort({ paidAt: 1, createdAt: 1 })
    .lean();
}

module.exports = {
  createPaymentEntry,
  reversePaymentEntry,
  correctPaymentEntry,
  listPaymentsForEntity
};
