const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeNotificationSchema = new mongoose.Schema(
  {
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: [
        "price_drop",
        "price_increase",
        "stock_out",
        "critical_stock",
        "cart_alert",
        "restock",
        "desired_product_match",
        "service_created",
        "critical_stock_alert",
        "order_update",
        "general"
      ],
      default: "general",
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      default: null
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeCart",
      default: null
    },
    link: {
      type: String,
      trim: true,
      default: ""
    },
    image: {
      type: String,
      trim: true,
      default: ""
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    channelsSent: {
      type: [String],
      default: ["in_app"]
    },
    pushStatus: {
      type: String,
      enum: ["not_applicable", "sent", "failed", "not_configured"],
      default: "not_applicable"
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

storeNotificationSchema.index({ createdAt: -1 });
storeNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
storeNotificationSchema.index({ visitorId: 1, isRead: 1, createdAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  // Ensure referenced models are registered
  require("../products/productModel")(subdomain);
  require("../auth/userModel")(subdomain);
  require("../carts/cartModel")(subdomain);

  return (
    connection.models.storeNotification ||
    connection.model("storeNotification", storeNotificationSchema)
  );
};
