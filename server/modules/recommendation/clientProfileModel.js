const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const clientProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    sessionId: { type: String, required: true, index: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    browsedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
    browsedHistory: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" },
        name: String,
        categoryId: String,
        categoryName: String,
        price: Number,
        tags: [String],
        specs: Object,
        visitedAt: { type: Date, default: Date.now }
      }
    ],
    searchQueries: [{ query: String, at: { type: Date, default: Date.now } }],
    preferredCategories: [
      {
        categoryId: String,
        name: String,
        count: { type: Number, default: 1 }
      }
    ],
    preferredTags: [
      {
        tag: String,
        count: { type: Number, default: 1 }
      }
    ],
    preferredSpecs: { type: Object, default: {} },
    priceAffinity: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      avg: { type: Number, default: 0 }
    },
    buyerPersona: { type: String, default: "عميل استكشاف ومقارنة" },
    interestSummary: { type: String, default: "" },
    interestVector: { type: [Number], default: [] },
    // Category-partitioned embeddings and price affinity
    categoryProfiles: [
      {
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "storeCategory" },
        categoryName: { type: String, default: "" },
        vector: { type: [Number], default: [] },
        interactionCount: { type: Number, default: 0 },
        priceAffinity: {
          min: { type: Number, default: 0 },
          max: { type: Number, default: 0 },
          avg: { type: Number, default: 0 }
        },
        preferredSpecs: { type: Object, default: {} },
        topKeywords: { type: [String], default: [] },
        lastInteractedAt: { type: Date, default: Date.now }
      }
    ],
    enrichmentCount: { type: Number, default: 0 },
    lastEnrichedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

clientProfileSchema.index({ sessionId: 1, userId: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.model("clientProfile", clientProfileSchema);
};
