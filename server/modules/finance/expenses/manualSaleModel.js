/**
 * Phase D — Manual / Offline Sale Model (storeManualSale)
 *
 * Allows authorized administrators to record sales made outside the online checkout
 * (POS, showroom, phone order, WhatsApp direct, B2B invoice).
 *
 * Architectural Separation:
 * - Stored in `storeManualSale` with explicit `sourceChannel` (`pos`, `showroom`, `manual_offline`, etc.)
 *   so online checkout orders (`storeOrder`) are never polluted or duplicated.
 * - Reuses the existing `storeProduct` catalog and `inventoryService.recordSaleConsumption` for stock & COGS.
 * - Reuses `storeFinancePayment` (`entityType: "manual_sale"`, `direction: "inflow"`) for partial/full receipts.
 *
 * Tenant Isolation:
 * - Uses tenant database connection resolved via `getMongooseConnection(subdomain)`.
 * - Do NOT include `storeId`.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");
const { MANUAL_SALE_SOURCES, PAYMENT_STATUSES } = require("../shared/constants");

const manualSaleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      required: true
    },
    nameSnapshot: {
      type: String,
      required: true,
      trim: true
    },
    groupCodeSnapshot: {
      type: String,
      default: "",
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitSellingPrice: {
      type: Number,
      required: true,
      min: 0
    },
    unitDiscount: {
      type: Number,
      default: 0,
      min: 0
    },
    allocatedSaleDiscount: {
      type: Number,
      default: 0,
      min: 0
    },
    grossLineTotal: {
      type: Number,
      required: true,
      min: 0
    },
    netLineValue: {
      type: Number,
      required: true,
      min: 0
    },
    unitCostSnapshot: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    lineCostTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    costingMethodUsed: {
      type: String,
      default: "weighted_average"
    }
  },
  { _id: false }
);

const manualSaleSchema = new mongoose.Schema(
  {
    saleCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    sourceChannel: {
      type: String,
      enum: MANUAL_SALE_SOURCES,
      default: "manual_offline",
      index: true
    },
    saleDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    customer: {
      name: { type: String, default: "عميل مباشر (معرض/كاشير)", trim: true },
      phone: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
      notes: { type: String, default: "", trim: true }
    },
    items: {
      type: [manualSaleItemSchema],
      default: []
    },
    currency: {
      type: String,
      default: "EGP",
      uppercase: true,
      trim: true
    },
    grossSubtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    netMerchandiseTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    shippingCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    actualCarrierShippingCost: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    totalCostSnapshot: {
      type: Number,
      default: 0,
      min: 0
    },
    grossProfitSnapshot: {
      type: Number,
      default: 0
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    outstandingBalance: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    overpaidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["completed", "cancelled", "returned"],
      default: "completed",
      index: true
    },
    idempotencyKey: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: "",
      trim: true
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

manualSaleSchema.index({ saleDate: -1, status: 1 });
manualSaleSchema.index({ idempotencyKey: 1 }, { sparse: true });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storeManualSale ||
    connection.model("storeManualSale", manualSaleSchema)
  );
};
