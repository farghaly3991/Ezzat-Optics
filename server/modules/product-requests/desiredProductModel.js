const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const desiredProductSchema = new mongoose.Schema(
  {
    queryText: {
      type: String,
      required: true,
      trim: true
    },
    extractedName: {
      type: String,
      trim: true,
      default: ""
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeCategory",
      default: null,
      index: true
    },
    categoryName: {
      type: String,
      trim: true,
      default: ""
    },
    specs: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    targetPrice: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    embedding: {
      type: [Number],
      default: () => []
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeUser",
      default: null,
      index: true
    },
    customerName: {
      type: String,
      trim: true,
      default: ""
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      index: true
    },
    email: {
      type: String,
      trim: true,
      default: ""
    },
    visitorId: {
      type: String,
      trim: true,
      default: "",
      index: true
    },
    channelPreference: {
      type: String,
      enum: ["in_app", "whatsapp", "both"],
      default: "both"
    },
    status: {
      type: String,
      enum: ["pending", "matched", "notified", "converted_to_service", "converted_to_order", "archived"],
      default: "pending",
      index: true
    },
    convertedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeOrder",
      default: null
    },
    convertedOrderCode: {
      type: String,
      default: ""
    },
    convertedAt: {
      type: Date,
      default: null
    },
    conversionNotes: {
      type: String,
      default: ""
    },
    matchedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeProduct",
      default: null
    },
    matchedProductSnapshot: {
      name: { type: String, default: "" },
      price: { type: Number, default: 0 },
      image: { type: String, default: "" }
    },
    similarityScore: {
      type: Number,
      default: 0
    },
    notifiedAt: {
      type: Date,
      default: null
    },
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

desiredProductSchema.index({ createdAt: -1 });

module.exports = async function getDesiredProductModel(subdomain) {
  const connection = await getMongooseConnection(subdomain);
  return (
    connection.models.storeDesiredProduct ||
    connection.model("storeDesiredProduct", desiredProductSchema)
  );
};
