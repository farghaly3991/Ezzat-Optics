const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const productWaitlistSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      required: true,
      index: true
    },
    productSnapshot: {
      name: { type: String, default: "" },
      price: { type: Number, default: 0 },
      image: { type: String, default: "" },
      categoryName: { type: String, default: "" }
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeUser",
      default: null,
      index: true
    },
    customerName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "", index: true },
    email: { type: String, trim: true, default: "" },
    visitorId: { type: String, trim: true, default: "", index: true },
    channelPreference: {
      type: String,
      enum: ["in_app", "whatsapp", "both"],
      default: "both"
    },
    status: {
      type: String,
      enum: ["waiting", "notified", "cancelled"],
      default: "waiting",
      index: true
    },
    notifiedAt: { type: Date, default: null },
    notificationLog: [
      {
        channel: { type: String, enum: ["in_app", "whatsapp"] },
        sentAt: { type: Date, default: Date.now },
        message: { type: String, default: "" },
        success: { type: Boolean, default: true },
        error: { type: String, default: "" }
      }
    ]
  },
  { timestamps: true }
);

productWaitlistSchema.index({ productId: 1, status: 1 });
productWaitlistSchema.index({ productId: 1, phone: 1 });
productWaitlistSchema.index({ productId: 1, visitorId: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeProductWaitlist || connection.model("storeProductWaitlist", productWaitlistSchema);
};
