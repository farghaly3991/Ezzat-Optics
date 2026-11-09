const mongoose = require("mongoose");

const facebookPostSchema = new mongoose.Schema(
  {
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
    productsSnapshot: [
      {
        _id: { type: String },
        name: { type: String },
        price: { type: Number, default: 0 },
        oldPrice: { type: Number, default: 0 },
        image: { type: String, default: "" },
        categoryName: { type: String, default: "" },
        specs: { type: mongoose.Schema.Types.Mixed, default: {} }
      }
    ],
    preset: { type: String, default: "urgent_fomo" },
    discountText: { type: String, default: "" },
    customPrompt: { type: String, default: "" },
    postText: { type: String, required: true },
    headline: { type: String, default: "" },
    subheadline: { type: String, default: "" },
    badgeText: { type: String, default: "" },
    ctaText: { type: String, default: "" },
    imageOverlayText: { type: String, default: "" },
    imageDesignPrompt: { type: String, default: "" },
    postImageCountMode: {
      type: String,
      enum: ["single", "multiple"],
      default: "single"
    },
    visualMode: {
      type: String,
      enum: ["svg_template", "ai_generated", "product_images", "combined"],
      default: "svg_template"
    },
    svgTemplateId: { type: String, default: "modern_spotlight" },
    coverImage: { type: String, default: "" },
    additionalImages: [{ type: String }],
    perProductPrompts: { type: mongoose.Schema.Types.Mixed, default: {} },
    images: [{ type: String }],
    status: {
      type: String,
      enum: ["draft", "scheduled", "publishing", "published", "failed"],
      default: "draft"
    },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    fbPostId: { type: String, default: "" },
    fbPostUrl: { type: String, default: "" },
    lastError: { type: String, default: "" }
  },
  { timestamps: true }
);

facebookPostSchema.index({ status: 1, scheduledAt: 1 });
facebookPostSchema.index({ createdAt: -1 });

module.exports = (subdomain) => {
  const { getMongooseConnection } = require("../../core/database");
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeFacebookPost || connection.model("storeFacebookPost", facebookPostSchema);
};

