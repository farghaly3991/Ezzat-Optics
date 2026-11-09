/**
 * Phase B & Commercial Inventory — Supplier Procurement Reorder Model (storeProcurementReorder)
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const reorderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      default: null,
      required: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    image: {
      type: String,
      default: ""
    },
    category: {
      type: String,
      default: ""
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitCost: {
      type: Number,
      default: 0
    },
    stockAtOrder: {
      type: Number,
      default: 0
    },
    criticalStockThreshold: {
      type: Number,
      default: 3
    },
    specs: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    unitSlotKey: {
      type: String,
      default: "",
      trim: true
    },
    unitSlotLabel: {
      type: String,
      default: "",
      trim: true
    },
    orderId: {
      type: String,
      default: "",
      trim: true
    },
    customerName: {
      type: String,
      default: "",
      trim: true
    },
    customerPhone: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

const procurementReorderSchema = new mongoose.Schema(
  {
    reorderCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplier",
      default: null,
      index: true
    },
    supplierName: {
      type: String,
      required: true,
      trim: true
    },
    supplierPhone: {
      type: String,
      default: "",
      trim: true
    },
    supplierWhatsapp: {
      type: String,
      default: "",
      trim: true
    },
    items: {
      type: [reorderItemSchema],
      default: []
    },
    totalQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    totalEstimatedCost: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    waterfallRequestCode: {
      type: String,
      default: "",
      trim: true
    },
    trackingPortalUrl: {
      type: String,
      default: "",
      trim: true
    },
    linkedShipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplierShipment",
      default: null
    },
    messageText: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "sent", "partially_fulfilled", "completed", "cancelled"],
      default: "sent",
      index: true
    },
    channel: {
      type: String,
      enum: ["whatsapp_direct", "whatsapp_api", "manual_copy", "in_app"],
      default: "whatsapp_direct"
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    }
  },
  { timestamps: true }
);

procurementReorderSchema.index({ createdAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeProcurementReorder ||
    connection.model("storeProcurementReorder", procurementReorderSchema)
  );
};
