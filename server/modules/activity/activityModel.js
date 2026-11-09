const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

/**
 * Activity Schema — Store Event Tracking & Analytics
 *
 * Tenant Isolation:
 * - Each tenant uses a dedicated Mongoose database connection resolved by `req.subdomain`.
 * - Do NOT include `storeId` in this schema; isolation is enforced at the database connection level.
 *
 * Price & Discount Semantics:
 * - `unitPrice`: Snapshot of the product's effective selling unit price (`product.price`) at event time
 *   (i.e. the active selling price after any product/offer markdown relative to `product.oldPrice`,
 *   before order-level coupon discounts).
 * - `offerId` & `offerDiscountPercent`: Snapshot of the active promotional offer (`storeOffer`) and its
 *   discount percentage at event time, preserving historical context even if the offer is later edited or deleted.
 * - `couponApplied` & `couponDiscountPercent`: Recorded when a coupon is applied at cart/checkout/order time.
 *   Note: Offer and coupon discount percentages are NOT additive; authoritative financial totals come from `storeOrder`.
 */

const SUPPORTED_EVENT_TYPES = [
  "product_viewed",
  "wishlist_added",
  "wishlist_removed",
  "add_to_cart",
  "remove_from_cart",
  "checkout_started",
  "order_created",
  "order_cancelled",
  "order_completed",
  "product_returned",
  "price_feedback",
  // Finance & Procurement Activity Event Types (Phases A & B)
  "shipment_created",
  "shipment_updated",
  "shipment_product_associated",
  "shipment_received",
  "shipment_payment_recorded",
  "shipment_payment_corrected",
  "shipment_payment_reversed",
  "shipment_due_date_changed",
  "shipping_class_updated",
  "order_shipping_cost_recorded",
  "finance_settings_updated",
  // Phase C-F Activity Event Types
  "inventory_movement_recorded",
  "inventory_adjusted",
  "inventory_damaged_recorded",
  "supplier_return_recorded",
  "expense_recorded",
  "expense_payment_recorded",
  "recurring_expense_generated",
  "manual_sale_recorded",
  "manual_sale_payment_recorded",
  "journal_entry_posted",
  "journal_entry_reversed",
  "accounting_period_closed",
  "exchange_rate_updated",
  "product_replacement_cost_updated"
];

const storeActivitySchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      enum: SUPPORTED_EVENT_TYPES
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      default: null
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    visitorId: {
      type: String,
      trim: true,
      default: null
    },
    sessionId: {
      type: String,
      trim: true,
      default: null
    },
    cartId: {
      type: String,
      trim: true,
      default: null
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeOrder",
      default: null
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplierShipment",
      default: null
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeFinancePayment",
      default: null
    },
    quantity: {
      type: Number,
      default: null
    },
    unitPrice: {
      type: Number,
      default: null
    },
    amount: {
      type: Number,
      default: null
    },
    currency: {
      type: String,
      default: null
    },
    note: {
      type: String,
      default: null
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeOffer",
      default: null
    },
    offerDiscountPercent: {
      type: Number,
      default: null
    },
    couponApplied: {
      type: Boolean,
      default: null
    },
    couponDiscountPercent: {
      type: Number,
      default: null
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

// Compound indexes based on actual analytics query patterns:
// 1. Time-range + eventType aggregations & time-series trends
storeActivitySchema.index({ eventType: 1, occurredAt: -1 });
storeActivitySchema.index({ occurredAt: -1, eventType: 1 });
// 2. Product-level analytics & product rankings by eventType and date range
storeActivitySchema.index({ productId: 1, eventType: 1, occurredAt: -1 });
// 3. Visitor / Session / User attribution, funnel cohort linkage, and deduplication
storeActivitySchema.index({ visitorId: 1, sessionId: 1, eventType: 1, occurredAt: -1 });
storeActivitySchema.index({ userId: 1, eventType: 1, occurredAt: -1 });
// 4. Cart & Order lifecycle event lookup and idempotency checks
storeActivitySchema.index({ orderId: 1, eventType: 1, productId: 1 });
storeActivitySchema.index({ cartId: 1, eventType: 1, occurredAt: -1 });

const getActivityModel = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  require("../products/productModel")(subdomain);
  require("../orders/orderModel")(subdomain);
  require("../offers/offerModel")(subdomain);
  require("../auth/userModel")(subdomain);
  return connection.models.storeActivity || connection.model("storeActivity", storeActivitySchema);
};

getActivityModel.SUPPORTED_EVENT_TYPES = SUPPORTED_EVENT_TYPES;

module.exports = getActivityModel;
