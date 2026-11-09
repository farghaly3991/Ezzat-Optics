const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const returnItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    image: { type: String, default: "" },
    warrantyPeriodMonths: { type: Number, default: 0 },
    isUnderWarranty: { type: Boolean, default: false },
    reason: { type: String, default: "" },
    condition: { type: String, default: "opened" } // new_sealed, opened, defective, damaged
  },
  { _id: false }
);

const timelineEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    title: { type: String, default: "" },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    by: { type: String, default: "system" }
  },
  { _id: false }
);

const storeReturnRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["return", "maintenance"],
      default: "return"
    },
    orderId: { type: String, required: true },
    orderMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "storeOrder", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null, index: true },
    assignedTechId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },
    techNotes: { type: String, default: "" },
    techAction: { type: String, default: "" },
    techCompletedAt: { type: Date, default: null },
    accessToken: {
      type: String,
      default: () => Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
    },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true }
    },
    items: { type: [returnItemSchema], default: [] },
    reason: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    images: { type: [String], default: [] },
    warrantyStatus: {
      type: String,
      enum: ["in_warranty", "out_of_warranty", "not_applicable"],
      default: "not_applicable"
    },
    warrantyExpiryDate: { type: Date, default: null },
    maintenanceSource: {
      type: String,
      enum: ["warranty_claim", "direct_service", "manual_branch", "out_of_warranty"],
      default: "warranty_claim"
    },
    serviceFee: { type: Number, default: 0 },
    partsCost: { type: Number, default: 0 },
    totalMaintenanceCost: { type: Number, default: 0 },
    isWarrantyFree: { type: Boolean, default: true },
    amountDueFromCustomer: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["free_warranty", "pending_collection", "collected_by_tech", "remitted_to_admin"],
      default: "free_warranty"
    },
    collectedAmount: { type: Number, default: 0 },
    collectedAt: { type: Date, default: null },
    remittedToAdmin: { type: Boolean, default: false },
    remittedAt: { type: Date, default: null },
    remittedNote: { type: String, default: "" },
    isWithinReturnWindow: { type: Boolean, default: true },
    status: {
      type: String,
      enum: [
        // Return Lifecycle
        "requested",
        "approved",
        "courier_assigned",
        "picked_up",
        "inspected",
        "refunded",
        "rejected",
        // Maintenance Lifecycle
        "received_at_branch",
        "assigned_to_tech",
        "in_maintenance",
        "parts_pending",
        "repaired",
        "unrepairable",
        "delivered_back"
      ],
      default: "requested"
    },
    courier: {
      name: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      trackingReference: { type: String, default: "", trim: true },
      scheduledDate: { type: Date, default: null }
    },
    refund: {
      amount: { type: Number, default: 0 },
      method: {
        type: String,
        enum: ["paymob_online", "manual_cash", "bank_transfer", "wallet", "none"],
        default: "none"
      },
      status: {
        type: String,
        enum: ["pending", "processed", "failed", "none"],
        default: "none"
      },
      transactionId: { type: String, default: "" },
      paymobRefundId: { type: String, default: "" },
      restocked: { type: Boolean, default: false },
      processedAt: { type: Date, default: null },
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
      refunded: { type: Boolean, default: false },
      convertedToOrderId: { type: String, default: "" },
      convertedOrderMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "storeOrder", default: null },
      convertedAt: { type: Date, default: null }
    },
    timeline: { type: [timelineEventSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeReturnRequest || connection.model("storeReturnRequest", storeReturnRequestSchema);
};
