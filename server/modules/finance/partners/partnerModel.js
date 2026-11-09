const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

/**
 * Partner & Owner Model (storePartner)
 * Manages store partners, equity share percentages, capital investments,
 * and individual withdrawal/drawing ledgers to avoid partnership disputes.
 */
const partnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      default: "",
      trim: true
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true
    },
    // Equity / Ownership share percentage (e.g. 50 for 50%)
    sharePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50
    },
    // Initial capital contributed
    initialCapital: {
      type: Number,
      default: 0,
      min: 0
    },
    // Cumulative historical withdrawals taken by this partner
    totalWithdrawals: {
      type: Number,
      default: 0,
      min: 0
    },
    // Cumulative profit distributions taken
    totalProfitDistributed: {
      type: Number,
      default: 0,
      min: 0
    },
    active: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    }
  },
  { timestamps: true }
);

function getPartnerModel(subdomain) {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storePartner || connection.model("storePartner", partnerSchema);
}

module.exports = {
  partnerSchema,
  getPartnerModel
};
