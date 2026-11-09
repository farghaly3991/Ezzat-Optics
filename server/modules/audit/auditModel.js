const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

/**
 * Audit Log Model for Optics Store System
 * Logs every administrative, counter, sales, and warehouse operation
 * with timestamp, user ID, staff name, action type, and details.
 */
const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      index: true
    },
    userName: {
      type: String,
      default: "المدير العام"
    },
    userRole: {
      type: String,
      default: "admin"
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    actionLabel: {
      type: String,
      required: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null,
      index: true
    },
    targetType: {
      type: String,
      enum: ["order", "customer", "product", "finance", "warehouse", "prescription", "work_order", "lab", "category", "maintenance", "return", "audit", "system"],
      default: "system",
      index: true
    },
    targetId: {
      type: String
    },
    targetCode: {
      type: String
    },
    details: {
      type: String,
      required: true
    },
    impactSummary: {
      type: String,
      default: ""
    },
    deepImpact: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

function getAuditLogModel(subdomain) {
  const conn = getMongooseConnection(subdomain);
  if (!conn) {
    throw new Error(`[AUDIT_LOG_ERROR] No active database connection for tenant: "${subdomain}"`);
  }
  return conn.models.auditLog || conn.model("auditLog", auditLogSchema);
}

module.exports = {
  auditLogSchema,
  getAuditLogModel
};
