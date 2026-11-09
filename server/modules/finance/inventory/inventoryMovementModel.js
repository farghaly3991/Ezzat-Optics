/**
 * Phase C — Inventory Movement Ledger Model (storeInventoryMovement)
 *
 * Immutable ledger of every physical and reserved stock movement:
 * - supplier_receipt (Goods received from supplier shipment)
 * - customer_sale (Online order or manual/offline sale consumption)
 * - customer_return (Customer return when stock is actually returned to sellable inventory)
 * - order_cancellation_restore (Cancelled order stock restoration)
 * - supplier_return (Goods returned to supplier)
 * - damaged_or_lost (Damaged or lost stock write-off)
 * - manual_adjustment (Manual stock correction/reconciliation with reason & authorization)
 * - reservation_hold / reservation_release (Stock reservation workflow)
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const {
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_COSTING_METHODS
} = require("../shared/constants");

const fifoAllocationSchema = new mongoose.Schema(
  {
    layerId: { type: mongoose.Schema.Types.ObjectId, default: null },
    shipmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    quantityTaken: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const inventoryMovementSchema = new mongoose.Schema(
  {
    movementCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null,
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      required: true,
      index: true
    },
    productNameSnapshot: {
      type: String,
      required: true,
      trim: true
    },
    groupCodeSnapshot: {
      type: String,
      default: "",
      trim: true
    },
    movementType: {
      type: String,
      required: true,
      enum: INVENTORY_MOVEMENT_TYPES,
      index: true
    },
    direction: {
      type: String,
      required: true,
      enum: ["in", "out", "reservation"],
      default: "in"
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    signedQuantity: {
      type: Number,
      required: true
    },
    stockBefore: {
      type: Number,
      required: true,
      default: 0
    },
    stockAfter: {
      type: Number,
      required: true,
      default: 0
    },
    reservedBefore: {
      type: Number,
      default: 0
    },
    reservedAfter: {
      type: Number,
      default: 0
    },
    availableAfter: {
      type: Number,
      default: 0
    },
    costingMethodUsed: {
      type: String,
      enum: INVENTORY_COSTING_METHODS,
      default: "weighted_average"
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    inventoryBookUnitCostAfter: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    // Phase F: Foreign currency snapshot when movement originates from foreign-currency receipt
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
    fifoAllocations: {
      type: [fifoAllocationSchema],
      default: []
    },
    sourceType: {
      type: String,
      enum: [
        "supplier_shipment",
        "online_order",
        "manual_sale",
        "customer_return",
        "supplier_return",
        "damage_report",
        "manual_adjustment",
        "reservation"
      ],
      required: true,
      index: true
    },
    sourceId: {
      type: String,
      default: "",
      index: true
    },
    sourceLineId: {
      type: String,
      default: ""
    },
    sourceReference: {
      type: String,
      default: "",
      trim: true
    },
    idempotencyKey: {
      type: String,
      default: null
    },
    reason: {
      type: String,
      default: "",
      trim: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
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

inventoryMovementSchema.index({ productId: 1, occurredAt: -1, createdAt: -1 });
inventoryMovementSchema.index({ sourceType: 1, sourceId: 1, movementType: 1 });
inventoryMovementSchema.index({ idempotencyKey: 1 }, { sparse: true });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  require("../../products/productModel")(subdomain);
  return (
    connection.models.storeInventoryMovement ||
    connection.model("storeInventoryMovement", inventoryMovementSchema)
  );
};
