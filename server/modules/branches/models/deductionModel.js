const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const deductionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    period: {
      type: String, // e.g. "2026-11"
      required: true,
      index: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    appliedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeStaffDeduction || connection.model("storeStaffDeduction", deductionSchema);
};
