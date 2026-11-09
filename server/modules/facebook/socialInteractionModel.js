const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const socialInteractionSchema = new mongoose.Schema(
  {
    interactionType: {
      type: String,
      enum: ["comment", "message"],
      default: "comment",
      index: true
    },
    facebookId: { type: String, required: true, index: true },
    facebookPostId: { type: String, default: "", index: true },
    facebookPostText: { type: String, default: "" },

    sender: {
      id: { type: String, required: true, index: true },
      name: { type: String, default: "متابع الصفحة" },
      avatar: { type: String, default: "" },
      extractedPhone: { type: String, default: "", index: true },
      previousInteractionsCount: { type: Number, default: 0 },
      hasStoreAccount: { type: Boolean, default: false },
      storeUserId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }
    },

    content: { type: String, required: true },

    matchedProduct: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "storeProduct", default: null },
      name: { type: String, default: "" },
      price: { type: Number, default: 0 },
      stockCount: { type: Number, default: 0 },
      sku: { type: String, default: "" },
      installmentEligible: { type: Boolean, default: true },
      installmentSample: {
        downPayment: { type: Number, default: 0 },
        monthlyAmount: { type: Number, default: 0 },
        months: { type: Number, default: 6 }
      },
      productUrl: { type: String, default: "" }
    },

    classification: {
      intent: {
        type: String,
        enum: [
          "product_inquiry",
          "installment_inquiry",
          "general_inquiry",
          "purchase_lead",
          "complaint",
          "greeting_or_chat"
        ],
        default: "general_inquiry",
        index: true
      },
      confidence: { type: Number, default: 0.9 },
      sentiment: {
        type: String,
        enum: ["positive", "neutral", "negative", "urgent"],
        default: "neutral"
      },
      extractedPhone: { type: String, default: "" },
      isHighIntentLead: { type: Boolean, default: false, index: true }
    },

    ragKnowledge: {
      usedKnowledge: { type: Boolean, default: false },
      topic: { type: String, default: "" },
      excerpt: { type: String, default: "" }
    },

    reply: {
      generatedReply: { type: String, default: "" },
      sentReply: { type: String, default: "" },
      status: {
        type: String,
        enum: ["pending", "approved", "sent", "failed", "skipped"],
        default: "pending",
        index: true
      },
      sentAt: { type: Date, default: null },
      sentVia: {
        type: String,
        enum: ["comment_reply", "private_messenger", "both"],
        default: "comment_reply"
      },
      sentByName: { type: String, default: "الرد الذكي التلقائي" },
      errorReason: { type: String, default: "" }
    },

    rawMetadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.socialInteraction ||
    connection.model("socialInteraction", socialInteractionSchema)
  );
};
