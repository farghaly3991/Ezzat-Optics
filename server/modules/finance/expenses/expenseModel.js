/**
 * Phase D — Expense Record Model (storeExpense)
 *
 * Represents one-off operating expenses and individual period-specific occurrences
 * generated from recurring expense rules (`storeRecurringExpenseRule`).
 *
 * Accounting Rules:
 * - Incurring an expense (`status: "recorded"`) does NOT mean it has been paid (`paymentStatus: "unpaid"`).
 * - Actual cash disbursements are recorded in `storeFinancePayment` (`entityType: "expense"`, `direction: "outflow"`).
 * - Supplier shipment obligations and payments are tracked in `storeSupplierShipment` and must NOT be
 *   duplicated here as operating expenses.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const { EXPENSE_CATEGORIES, PAYMENT_STATUSES } = require("../shared/constants");

const expenseSchema = new mongoose.Schema(
  {
    expenseCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: EXPENSE_CATEGORIES,
      default: "operational",
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    // Optional foreign currency snapshot
    originalAmount: {
      type: Number,
      default: null
    },
    originalCurrency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    exchangeRateUsed: {
      type: Number,
      default: 1
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    accountingPeriod: {
      type: String,
      required: true,
      index: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    paidAt: {
      type: Date,
      default: null
    },
    payeeName: {
      type: String,
      default: "",
      trim: true
    },
    payeePhone: {
      type: String,
      default: "",
      trim: true
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    outstandingBalance: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    overpaidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      index: true
    },
    status: {
      type: String,
      enum: ["recorded", "cancelled"],
      default: "recorded",
      index: true
    },
    // Link to recurring expense rule (null for one-off expenses)
    recurringRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeRecurringExpenseRule",
      default: null,
      index: true
    },
    occurrencePeriodKey: {
      type: String,
      default: null
    },
    referenceNote: {
      type: String,
      default: "",
      trim: true
    },
    // Partner Withdrawals & Profit Distributions Linkage (مسحوبات الشركاء وأصحاب المحل)
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storePartner",
      default: null,
      index: true
    },
    partnerName: {
      type: String,
      default: "",
      trim: true
    },
    partnerSharePercent: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    attachments: {
      type: [String],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate recurring expense occurrences for the same rule & period
expenseSchema.index(
  { recurringRuleId: 1, occurrencePeriodKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recurringRuleId: { $type: "objectId" },
      occurrencePeriodKey: { $type: "string" }
    }
  }
);

expenseSchema.index({ effectiveDate: -1, category: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeExpense ||
    connection.model("storeExpense", expenseSchema)
  );
};
