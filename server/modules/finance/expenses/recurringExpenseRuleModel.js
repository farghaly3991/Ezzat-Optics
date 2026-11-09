/**
 * Phase D — Recurring Expense Rule Model (storeRecurringExpenseRule)
 *
 * Separates the recurring expense definition/schedule from its individual
 * period-specific occurrences (`storeExpense`).
 * Changing next month's rent or subscription amount updates this rule for future
 * occurrences and NEVER rewrites historical `storeExpense` records from prior periods.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const {
  EXPENSE_CATEGORIES,
  RECURRENCE_FREQUENCIES
} = require("../shared/constants");

const recurringExpenseRuleSchema = new mongoose.Schema(
  {
    ruleCode: {
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
      default: "rent"
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    frequency: {
      type: String,
      required: true,
      enum: RECURRENCE_FREQUENCIES,
      default: "monthly"
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 28,
      default: 1
    },
    dueDaysOffset: {
      type: Number,
      min: 0,
      default: 5
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
    notes: {
      type: String,
      default: "",
      trim: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    lastGeneratedPeriodKey: {
      type: String,
      default: null
    },
    lastGeneratedAt: {
      type: Date,
      default: null
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

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeRecurringExpenseRule ||
    connection.model("storeRecurringExpenseRule", recurringExpenseRuleSchema)
  );
};
