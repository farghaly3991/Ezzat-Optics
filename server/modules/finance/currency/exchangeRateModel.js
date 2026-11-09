/**
 * Phase F — Exchange Rate History Model (storeExchangeRate)
 *
 * Preserves immutable historical records of exchange rates entered manually
 * or synced from an administrator-configured trusted provider.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const exchangeRateSchema = new mongoose.Schema(
  {
    fromCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    toCurrency: {
      type: String,
      required: true,
      default: "EGP",
      uppercase: true,
      trim: true,
      index: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0.0001
    },
    previousRate: {
      type: Number,
      default: null
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    source: {
      type: String,
      enum: ["manual", "trusted_provider"],
      default: "manual"
    },
    providerName: {
      type: String,
      default: "إدخال إداري يدوي",
      trim: true
    },
    isActiveLatest: {
      type: Boolean,
      default: true,
      index: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    }
  },
  {
    timestamps: true
  }
);

exchangeRateSchema.index({ fromCurrency: 1, toCurrency: 1, isActiveLatest: 1, effectiveDate: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeExchangeRate ||
    connection.model("storeExchangeRate", exchangeRateSchema)
  );
};
