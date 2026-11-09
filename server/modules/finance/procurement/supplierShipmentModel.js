/**
 * Phase B — Supplier Shipment & Purchase Obligation Model (storeSupplierShipment)
 *
 * For incoming supplier shipments containing products purchased for the store.
 * Preserves historical purchase line snapshots independently of editable catalog product cost fields.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const { SUPPLIER_SHIPMENT_STATUSES, PAYMENT_STATUSES } = require("../shared/constants");

const purchaseLineSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      required: true
    },
    productNameSnapshot: { type: String, required: true, trim: true },
    groupCodeSnapshot: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitCost: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "EGP", uppercase: true, trim: true },
    lineTotal: { type: Number, required: true, min: 0, default: 0 },
    // Phase C: Receiving & Discrepancy Tracking
    receivedQuantity: { type: Number, default: 0, min: 0 },
    rejectedQuantity: { type: Number, default: 0, min: 0 },
    returnedToSupplierQuantity: { type: Number, default: 0, min: 0 },
    discrepancyNote: { type: String, default: "", trim: true },
    // Phase F: Historical Purchase Currency & Exchange Rate Snapshot
    originalCurrency: { type: String, default: "EGP", uppercase: true, trim: true },
    originalUnitCost: { type: Number, default: null },
    originalLineTotal: { type: Number, default: null },
    exchangeRateUsed: { type: Number, default: 1, min: 0 },
    exchangeRateDate: { type: Date, default: null },
    exchangeRateSource: { type: String, default: "base_currency", trim: true },
    notes: { type: String, default: "", trim: true },
    gridCoords: { type: Object, default: null },
    matrixUpdates: { type: Object, default: null },
    associatedAt: { type: Date, default: Date.now },
    associatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }
  },
  { _id: false }
);

const receivingLineRecordSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "storeProduct", required: true },
    productNameSnapshot: { type: String, default: "" },
    expectedQty: { type: Number, default: 0 },
    receivedNowQty: { type: Number, default: 0 },
    rejectedNowQty: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    currency: { type: String, default: "EGP" },
    originalCurrency: { type: String, default: "EGP" },
    originalUnitCost: { type: Number, default: null },
    exchangeRateUsed: { type: Number, default: 1 },
    discrepancyNote: { type: String, default: "" },
    movementId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  { _id: false }
);

const receivingRecordSchema = new mongoose.Schema(
  {
    receiptId: { type: String, required: true },
    idempotencyKey: { type: String, default: null },
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    notes: { type: String, default: "" },
    lines: { type: [receivingLineRecordSchema], default: [] }
  },
  { _id: false }
);

const dueDateChangeSchema = new mongoose.Schema(
  {
    previousDueDate: { type: Date, default: null },
    newDueDate: { type: Date, default: null },
    reason: { type: String, default: "", trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const supplierShipmentSchema = new mongoose.Schema(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    externalInvoiceRef: {
      type: String,
      default: "",
      trim: true
    },
    shipmentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplier",
      default: null,
      index: true
    },
    supplier: {
      name: { type: String, required: true, trim: true },
      contactPerson: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true }
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    // Phase F: Foreign currency header snapshot (converted to base `currency` for accounting/balances)
    originalCurrency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    originalGoodsValue: {
      type: Number,
      default: null
    },
    exchangeRateUsed: {
      type: Number,
      default: 1,
      min: 0
    },
    exchangeRateDate: {
      type: Date,
      default: null
    },
    exchangeRateSource: {
      type: String,
      default: "base_currency",
      trim: true
    },
    expectedGoodsValue: {
      type: Number,
      min: 0,
      default: 0
    },
    linesTotal: {
      type: Number,
      min: 0,
      default: 0
    },
    explicitApprovedObligation: {
      type: Number,
      default: null
    },
    approvedObligationTotal: {
      type: Number,
      min: 0,
      default: 0
    },
    totalPaid: {
      type: Number,
      min: 0,
      default: 0
    },
    outstandingBalance: {
      type: Number,
      min: 0,
      default: 0,
      index: true
    },
    overpaidAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      index: true
    },
    dueDate: {
      type: Date,
      default: null,
      index: true
    },
    dueDateHistory: {
      type: [dueDateChangeSchema],
      default: []
    },
    status: {
      type: String,
      enum: SUPPLIER_SHIPMENT_STATUSES,
      default: "ordered",
      index: true
    },
    purchaseLines: {
      type: [purchaseLineSchema],
      default: []
    },
    receivingRecords: {
      type: [receivingRecordSchema],
      default: []
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    attachments: {
      type: [String],
      default: []
    },
    receivedAt: {
      type: Date,
      default: null
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

supplierShipmentSchema.index({ paymentStatus: 1, dueDate: 1 });
supplierShipmentSchema.index({ "purchaseLines.productId": 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  require("./supplierModel")(subdomain);
  require("../../products/productModel")(subdomain);
  return (
    connection.models.storeSupplierShipment ||
    connection.model("storeSupplierShipment", supplierShipmentSchema)
  );
};
