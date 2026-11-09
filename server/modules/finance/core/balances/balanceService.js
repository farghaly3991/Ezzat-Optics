/**
 * Finance Core Balances Service
 *
 * Authoritative calculator for purchase obligations, recorded payments sum,
 * outstanding balances, payment status, and due/overdue evaluation.
 *
 * Accounting Distinction:
 * - A supplier obligation is NOT cash paid.
 * - Only recorded, posted payment entries (`payment`, `correction`, `reversal`)
 *   affect `totalPaid` and `outstandingBalance`.
 */

const { roundMoney } = require("../../shared/validators");
const { evaluateDueStatus } = require("../../shared/remindersInterface");

/**
 * Compute authoritative balance summary from obligation amount and payment records.
 */
function calculateObligationBalance({
  expectedGoodsValue = 0,
  linesTotal = 0,
  explicitApprovedObligation = null,
  paymentRecords = [],
  dueDate = null,
  shipmentStatus = "ordered",
  now = new Date()
}) {
  const cleanExpected = roundMoney(Math.max(0, Number(expectedGoodsValue || 0)));
  const cleanLinesTotal = roundMoney(Math.max(0, Number(linesTotal || 0)));

  // If explicitApprovedObligation is > 0 use it, otherwise if purchase lines exist use linesTotal (or max of expected/lines if expected was set before lines)
  let originalObligation = 0;
  if (explicitApprovedObligation !== null && explicitApprovedObligation !== undefined && Number(explicitApprovedObligation) > 0) {
    originalObligation = roundMoney(Number(explicitApprovedObligation));
  } else if (cleanLinesTotal > 0) {
    originalObligation = cleanLinesTotal;
  } else {
    originalObligation = cleanExpected;
  }

  // Sum all recorded ledger entries (payment = +X, correction = +/-delta, reversal = -X)
  // Every entry is an immutable ledger row; summing all active entries yields the exact net paid amount.
  let sumOfRecordedPayments = 0;
  let activePaymentsCount = 0;

  for (const rec of paymentRecords) {
    if (!rec) continue;
    const amt = Number(rec.amount || 0);
    if (Number.isFinite(amt)) {
      sumOfRecordedPayments += amt;
      if (rec.entryType === "payment" && rec.status !== "reversed") {
        activePaymentsCount++;
      }
    }
  }

  sumOfRecordedPayments = roundMoney(Math.max(0, sumOfRecordedPayments));
  const outstandingBalance = roundMoney(Math.max(0, originalObligation - sumOfRecordedPayments));
  const overpaidAmount = roundMoney(Math.max(0, sumOfRecordedPayments - originalObligation));

  let paymentStatus = "unpaid";
  if (sumOfRecordedPayments <= 0) {
    paymentStatus = "unpaid";
  } else if (originalObligation > 0 && sumOfRecordedPayments < originalObligation) {
    paymentStatus = "partial";
  } else if (originalObligation > 0 && sumOfRecordedPayments === originalObligation) {
    paymentStatus = "paid";
  } else if (sumOfRecordedPayments > originalObligation) {
    paymentStatus = originalObligation > 0 ? "overpaid" : "paid";
  }

  const dueEvaluation = evaluateDueStatus({
    dueDate,
    outstandingBalance,
    status: shipmentStatus,
    now
  });

  return {
    expectedGoodsValue: cleanExpected,
    linesTotal: cleanLinesTotal,
    originalObligation,
    totalPaid: sumOfRecordedPayments,
    outstandingBalance,
    overpaidAmount,
    paymentStatus,
    activePaymentsCount,
    dueDate: dueDate || null,
    isOverdue: dueEvaluation.isOverdue,
    isUpcomingDue: dueEvaluation.isUpcomingDue,
    daysOverdue: dueEvaluation.daysOverdue,
    daysUntilDue: dueEvaluation.daysUntilDue,
    dueSeverity: dueEvaluation.severity
  };
}

module.exports = {
  calculateObligationBalance
};
