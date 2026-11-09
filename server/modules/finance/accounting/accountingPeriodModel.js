/**
 * Phase E4 — Accounting Period Closing Model (storeAccountingPeriod)
 *
 * Controls closing and reopening of monthly accounting periods (`YYYY-MM`)
 * so backdated postings or modifications into a closed period are blocked.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const accountingPeriodSchema = new mongoose.Schema(
  {
    periodKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true
    },
    closedAt: {
      type: Date,
      default: null
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    closingNote: {
      type: String,
      default: "",
      trim: true
    },
    reopenedAt: {
      type: Date,
      default: null
    },
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    reopenReason: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeAccountingPeriod ||
    connection.model("storeAccountingPeriod", accountingPeriodSchema)
  );
};
