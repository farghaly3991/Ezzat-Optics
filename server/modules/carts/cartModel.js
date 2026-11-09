const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeCartSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null,
      index: true
    },
    cartId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
      index: true
    },
    visitorId: {
      type: String,
      trim: true,
      default: "",
      index: true
    },
    sessionId: {
      type: String,
      trim: true,
      default: ""
    },
    customer: {
      name: { type: String, default: "", trim: true },
      phone: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true }
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "storeProduct",
          required: true
        },
        name: { type: String, default: "" },
        price: { type: Number, default: 0 },
        quantity: { type: Number, default: 1, min: 1 },
        image: { type: String, default: "" },
        isService: { type: Boolean, default: false },
        sku: { type: String, default: "" }
      }
    ],
    totalQuantity: {
      type: Number,
      default: 0,
      index: true
    },
    subtotal: {
      type: Number,
      default: 0
    },
    couponCode: {
      type: String,
      default: ""
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["active", "converted", "abandoned"],
      default: "active",
      index: true
    },
    convertedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeOrder",
      default: null
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    recoveryHistory: [
      {
        channels: { type: [String], default: [] },
        sentAt: { type: Date, default: Date.now },
        status: { type: String, default: "sent" },
        recipientPhone: { type: String, default: "" },
        waSuccess: { type: Boolean, default: false },
        inAppSuccess: { type: Boolean, default: false },
        notes: { type: String, default: "" },
        error: { type: String, default: "" }
      }
    ],
    pushSubscription: {
      endpoint: { type: String, default: "" },
      keys: {
        auth: { type: String, default: "" },
        p256dh: { type: String, default: "" }
      }
    },
    notificationToken: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

storeCartSchema.index({ status: 1, lastActiveAt: -1 });
storeCartSchema.index({ totalQuantity: -1, lastActiveAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  // Ensure referenced models are registered
  require("../products/productModel")(subdomain);
  require("../orders/orderModel")(subdomain);
  require("../auth/userModel")(subdomain);
  return connection.models.storeCart || connection.model("storeCart", storeCartSchema);
};
