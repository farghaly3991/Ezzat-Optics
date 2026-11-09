/**
 * Dynamic Client Profile Model (storeClientProfile)
 *
 * Generic, domain-agnostic client custom records (e.g. eye prescription, body tailoring specs,
 * dental record, or custom client completed data).
 * Structured dynamically by `adminData.clientProfileConfig`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const clientProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    title: {
      type: String,
      default: "",
      trim: true
    },
    fieldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    matrixData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    attachments: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeClientProfile ||
    connection.model("storeClientProfile", clientProfileSchema)
  );
};
