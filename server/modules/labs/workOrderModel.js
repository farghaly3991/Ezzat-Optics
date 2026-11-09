const mongoose = require("mongoose");
const crypto = require("crypto");
const { getMongooseConnection } = require("../../core/database");

const workOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "storeProduct", default: null },
    name: { type: String, required: true },
    unitSlotKey: { type: String, default: "" }, // e.g. "OD", "OS"
    unitSlotLabel: { type: String, default: "" }, // e.g. "العين اليمنى"
    specs: { type: Object, default: {} }, // { sph, cyl, axis, add, pd }
    quantity: { type: Number, default: 1 },
    isFrame: { type: Boolean, default: false },
    frameDetails: { type: Object, default: {} }
  },
  { _id: false }
);

const stageHistorySchema = new mongoose.Schema(
  {
    stageKey: { type: String, required: true },
    stageLabel: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: "نظام المعمل" },
    notes: { type: String, default: "" }
  },
  { _id: false }
);

const storeWorkOrderSchema = new mongoose.Schema(
  {
    workOrderNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderDbId: { type: mongoose.Schema.Types.ObjectId, ref: "storeOrder", default: null },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: "storeLab", required: true, index: true },
    labName: { type: String, default: "" },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null, index: true },
    customer: {
      name: { type: String, default: "عميل المتجر" },
      phone: { type: String, default: "" }
    },
    items: { type: [workOrderItemSchema], default: [] },
    currentStage: { type: String, default: "received" },
    currentStageLabel: { type: String, default: "استلام أمر الشغل" },
    stageHistory: { type: [stageHistorySchema], default: [] },
    status: {
      type: String,
      enum: ["in_progress", "completed", "cancelled"],
      default: "in_progress",
      index: true
    },
    financials: {
      labCost: { type: Number, default: 0 },
      shippingCost: { type: Number, default: 0 },
      extraCost: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      isPaidToLab: { type: Boolean, default: false },
      paidAmount: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 },
      paymentMethod: { type: String, default: "cash" },
      paidAt: { type: Date, default: null }
    },
    sentAt: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    turnaroundHours: { type: Number, default: null },
    adminFeedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: "" },
      ratedAt: { type: Date, default: null },
      ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }
    },
    publicTrackingToken: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(16).toString("hex")
    },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeWorkOrder || connection.model("storeWorkOrder", storeWorkOrderSchema);
};
