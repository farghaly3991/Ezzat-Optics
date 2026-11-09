const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const staffReviewSchema = new mongoose.Schema(
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
      default: null,
      index: true
    },
    serviceType: {
      type: String,
      enum: ["delivery", "maintenance"],
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeOrder",
      default: null
    },
    maintenanceTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    customerName: {
      type: String,
      default: "عميل",
      trim: true
    },
    customerPhone: {
      type: String,
      default: "",
      trim: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    criteria: {
      punctuality: { type: Number, min: 1, max: 5, default: 5 },
      professionalism: { type: Number, min: 1, max: 5, default: 5 },
      quality: { type: Number, min: 1, max: 5, default: 5 }
    },
    comment: {
      type: String,
      default: "",
      trim: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ["pending", "submitted"],
      default: "submitted",
      index: true
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeStaffReview || connection.model("storeStaffReview", staffReviewSchema);
};
