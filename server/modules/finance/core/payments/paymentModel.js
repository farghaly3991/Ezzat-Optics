/**
 * Finance Core Payment Model (storeFinancePayment)
 *
 * Separate, auditable payment ledger records.
 * Partial payments, subsequent payments, corrections, and reversals each create
 * a distinct immutable record rather than overwriting a manual "paid amount" field.
 *
 * Tenant Isolation:
 * - Resolved per tenant database via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId` in this schema.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../../core/database");
const { PAYMENT_ENTRY_TYPES, PAYMENT_METHODS } = require("../../shared/constants");

const financePaymentSchema = new mongoose.Schema(
  {
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    entityType: {
      type: String,
      required: true,
      enum: ["supplier_shipment", "expense", "manual_sale", "order_settlement"],
      default: "supplier_shipment",
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    entityReferenceCode: {
      type: String,
      default: "",
      trim: true
    },
    direction: {
      type: String,
      required: true,
      enum: ["outflow", "inflow"],
      default: "outflow"
    },
    entryType: {
      type: String,
      required: true,
      enum: PAYMENT_ENTRY_TYPES,
      default: "payment"
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "cash"
    },
    paidAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    referenceNote: {
      type: String,
      default: "",
      trim: true
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
    status: {
      type: String,
      enum: ["posted", "reversed"],
      default: "posted"
    },
    parentPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeFinancePayment",
      default: null
    },
    reversedByPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeFinancePayment",
      default: null
    },
    reversalReason: {
      type: String,
      default: "",
      trim: true
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true
    },
    requestFingerprint: {
      type: String,
      default: null,
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

financePaymentSchema.index({ entityType: 1, entityId: 1, paidAt: -1, createdAt: -1 });
financePaymentSchema.index({ entityType: 1, entityId: 1, idempotencyKey: 1 });
financePaymentSchema.index({ entityType: 1, entityId: 1, requestFingerprint: 1, createdAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeFinancePayment || connection.model("storeFinancePayment", financePaymentSchema);
};
