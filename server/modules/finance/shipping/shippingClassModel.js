/**
 * Phase A — Shipping Class Model (storeShippingClass)
 *
 * Tenant Isolation:
 * - Uses tenant-specific database connection via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const { VALID_SHIPPING_MODES } = require("../shared/constants");

const coverageRegionSchema = new mongoose.Schema(
  {
    governorate: { type: String, trim: true, default: "" },
    cities: { type: [String], default: [] },
    districts: { type: [String], default: [] },
    aliases: { type: [String], default: [] }
  },
  { _id: false }
);

const shippingClassSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    customerPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    actualCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    defaultCalculationMode: {
      type: String,
      enum: VALID_SHIPPING_MODES,
      default: "MAX"
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    coverageText: {
      type: String,
      default: "",
      trim: true
    },
    coverageRegions: {
      type: [coverageRegionSchema],
      default: []
    },
    normalizedCoverageTokens: {
      type: [String],
      default: []
    },
    matchedGovernorateKeys: {
      type: [String],
      default: []
    },
    sortOrder: {
      type: Number,
      default: 0
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

shippingClassSchema.index({ active: 1, sortOrder: 1, createdAt: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeShippingClass || connection.model("storeShippingClass", shippingClassSchema);
};
