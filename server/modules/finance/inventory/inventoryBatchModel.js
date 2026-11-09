/**
 * Phase C — Inventory Cost Layer Model (storeInventoryCostLayer)
 *
 * Tracks incoming purchase cost batches per product so both Weighted-Average Cost (WAC)
 * and First-In-First-Out (FIFO) costing policies are accurately supported without relying
 * on a single mutable `product.costPrice` field.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const inventoryCostLayerSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      required: true,
      index: true
    },
    movementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeInventoryMovement",
      default: null
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplierShipment",
      default: null
    },
    shipmentReference: {
      type: String,
      default: "",
      trim: true
    },
    sourceType: {
      type: String,
      enum: ["supplier_receipt", "customer_return", "manual_adjustment", "opening_balance"],
      default: "supplier_receipt"
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    originalCurrency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    originalUnitCost: {
      type: Number,
      default: null
    },
    exchangeRateUsed: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ["open", "depleted"],
      default: "open",
      index: true
    }
  },
  {
    timestamps: true
  }
);

inventoryCostLayerSchema.index({ productId: 1, status: 1, receivedAt: 1, createdAt: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeInventoryCostLayer ||
    connection.model("storeInventoryCostLayer", inventoryCostLayerSchema)
  );
};
