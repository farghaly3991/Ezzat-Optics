const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

/**
 * AI Instruction Schema — Admin-Managed Instructions for Product Search Planner
 *
 * Tenant Isolation:
 * - Bound to the tenant's dedicated Mongoose connection via `getMongooseConnection(subdomain)`.
 * - Vector embeddings are stored directly alongside each instruction record in the tenant's
 *   isolated database (matching the `storeProduct.embedding` convention), ensuring zero
 *   cross-tenant vector leakage and atomic cleanup on disable/delete.
 */

const SCOPE_TYPES = ["global", "category", "product"];
const SYNC_STATUSES = ["synced", "pending", "failed"];

const aiInstructionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "عنوان التعليمة مطلوب"],
      trim: true,
      maxlength: [160, "عنوان التعليمة يجب ألا يتجاوز 160 حرفاً"]
    },
    content: {
      type: String,
      required: [true, "محتوى التعليمة مطلوب"],
      trim: true,
      maxlength: [2000, "محتوى التعليمة يجب ألا يتجاوز 2000 حرف"]
    },
    scopeType: {
      type: String,
      enum: SCOPE_TYPES,
      default: "global",
      index: true
    },
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "storeCategory"
      }
    ],
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "storeProduct"
      }
    ],
    tags: {
      type: [String],
      default: []
    },
    priority: {
      type: Number,
      default: 0,
      min: -10,
      max: 100
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    // Vector embedding & synchronization metadata
    embedding: {
      type: [Number],
      default: []
    },
    embeddingModel: {
      type: String,
      default: ""
    },
    embeddingTextHash: {
      type: String,
      default: ""
    },
    syncStatus: {
      type: String,
      enum: SYNC_STATUSES,
      default: "pending",
      index: true
    },
    lastSyncedAt: {
      type: Date,
      default: null
    },
    syncError: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast active retrieval and admin listing
aiInstructionSchema.index({ active: 1, syncStatus: 1, priority: -1 });
aiInstructionSchema.index({ active: 1, scopeType: 1 });
aiInstructionSchema.index({ updatedAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  require("../categories/categoryModel")(subdomain);
  require("../products/productModel")(subdomain);
  return (
    connection.models.storeAiInstruction ||
    connection.model("storeAiInstruction", aiInstructionSchema)
  );
};

module.exports.SCOPE_TYPES = SCOPE_TYPES;
module.exports.SYNC_STATUSES = SYNC_STATUSES;
