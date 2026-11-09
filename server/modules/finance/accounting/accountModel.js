/**
 * Phase E4 — Chart of Accounts Model (storeChartOfAccount)
 *
 * Configurable Chart of Accounts for the Double-Entry Accounting layer
 * (Professional & Enterprise tiers).
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const { ACCOUNT_TYPES } = require("../shared/constants");

const chartOfAccountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    nameAr: {
      type: String,
      required: true,
      trim: true
    },
    nameEn: {
      type: String,
      default: "",
      trim: true
    },
    accountType: {
      type: String,
      required: true,
      enum: ACCOUNT_TYPES,
      index: true
    },
    normalBalance: {
      type: String,
      required: true,
      enum: ["debit", "credit"],
      default: "debit"
    },
    systemRole: {
      type: String,
      default: "",
      trim: true,
      index: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    isSystemDefault: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
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
    connection.models.storeChartOfAccount ||
    connection.model("storeChartOfAccount", chartOfAccountSchema)
  );
};
