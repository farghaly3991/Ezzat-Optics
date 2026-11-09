/**
 * Multi-Supplier Waterfall Request Model (storeSupplyWaterfallRequest)
 *
 * Tracks automated / cascade supply requests across prioritized suppliers.
 * Tenant Isolation: resolved via getMongooseConnection(subdomain)
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const supplierChainNodeSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplier",
      required: true
    },
    supplierName: { type: String, required: true, trim: true },
    supplierPhone: { type: String, default: "", trim: true },
    supplierWhatsapp: { type: String, default: "", trim: true },
    priority: { type: Number, default: 1, min: 1 },
    token: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "contacted", "accepted", "declined", "timeout"],
      default: "pending",
      index: true
    },
    contactedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    responseNotes: { type: String, default: "", trim: true }
  },
  { _id: true }
);

const supplyWaterfallRequestSchema = new mongoose.Schema(
  {
    requestCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      required: true,
      index: true
    },
    productName: { type: String, required: true, trim: true },
    productImage: { type: String, default: "", trim: true },
    productSku: { type: String, default: "", trim: true },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    estimatedCost: {
      type: Number,
      default: 0,
      min: 0
    },
    items: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    chain: {
      type: [supplierChainNodeSchema],
      default: []
    },
    currentSupplierIndex: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["in_progress", "accepted", "all_declined", "cancelled", "fulfilled"],
      default: "in_progress",
      index: true
    },
    acceptedSupplier: {
      supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "storeSupplier", default: null },
      supplierName: { type: String, default: "" },
      supplierPhone: { type: String, default: "" },
      supplierWhatsapp: { type: String, default: "" },
      acceptedAt: { type: Date, default: null },
      notes: { type: String, default: "" }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    notes: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

supplyWaterfallRequestSchema.index({ createdAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  require("./supplierModel")(subdomain);
  require("../../products/productModel")(subdomain);
  return (
    connection.models.storeSupplyWaterfallRequest ||
    connection.model("storeSupplyWaterfallRequest", supplyWaterfallRequestSchema)
  );
};
