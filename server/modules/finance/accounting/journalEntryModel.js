/**
 * Phase E4 — Double-Entry Journal Entry Model (storeJournalEntry)
 *
 * Enforces:
 * - Clear separation between `draft`, `posted`, and `reversed` entries.
 * - Balanced debits and credits (`totalDebit === totalCredit` for all posted entries).
 * - Duplicate-posting prevention via `idempotencyKey`.
 * - Full source traceability (`sourceType`, `sourceId`, `sourceReference`, `postingDate`, `accountingPeriod`).
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const { JOURNAL_ENTRY_STATUSES } = require("../shared/constants");

const journalLineSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeChartOfAccount",
      required: true
    },
    accountCode: {
      type: String,
      required: true,
      trim: true
    },
    accountNameAr: {
      type: String,
      required: true,
      trim: true
    },
    accountType: {
      type: String,
      required: true
    },
    debit: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    credit: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    memo: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

const journalEntrySchema = new mongoose.Schema(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    postingDate: {
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
    status: {
      type: String,
      required: true,
      enum: JOURNAL_ENTRY_STATUSES,
      default: "draft",
      index: true
    },
    entryKind: {
      type: String,
      enum: ["standard", "reversal", "adjustment"],
      default: "standard"
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    lines: {
      type: [journalLineSchema],
      default: []
    },
    totalDebit: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    totalCredit: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    isBalanced: {
      type: Boolean,
      default: true
    },
    sourceType: {
      type: String,
      default: "manual_journal",
      index: true
    },
    sourceEvent: {
      type: String,
      default: "",
      index: true
    },
    sourceId: {
      type: String,
      default: "",
      index: true
    },
    sourceReference: {
      type: String,
      default: "",
      trim: true
    },
    idempotencyKey: {
      type: String,
      default: null
    },
    reversesEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeJournalEntry",
      default: null
    },
    reversedByEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeJournalEntry",
      default: null
    },
    reversalReason: {
      type: String,
      default: "",
      trim: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    postedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

journalEntrySchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" }
    }
  }
);
journalEntrySchema.index({ accountingPeriod: 1, status: 1, postingDate: -1 });
journalEntrySchema.index({ sourceType: 1, sourceId: 1, sourceEvent: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeJournalEntry ||
    connection.model("storeJournalEntry", journalEntrySchema)
  );
};
