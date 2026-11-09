const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const pushSubscriptionSchema = new mongoose.Schema(
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
    endpoint: {
      type: String,
      required: true,
      trim: true
    },
    keys: {
      p256dh: { type: String, default: "" },
      auth: { type: String, default: "" }
    },
    fcmToken: {
      type: String,
      default: ""
    },
    userAgent: {
      type: String,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.storePushSubscription ||
    connection.model("storePushSubscription", pushSubscriptionSchema)
  );
};
