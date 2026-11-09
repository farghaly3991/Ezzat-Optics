/**
 * Finance Core Audit Trail Model (storeFinanceAudit)
 *
 * Tenant Isolation:
 * - Each store uses its own database connection resolved by `subdomain`.
 * - Do NOT include `storeId` in this schema.
 */

const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../../core/database");

const financeAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, index: true },
    entityType: {
      type: String,
      required: true,
      enum: [
        "shipping_class",
        "order_shipping",
        "supplier",
        "supplier_shipment",
        "procurement_reorder",
        "finance_payment",
        "finance_settings",
        "inventory_movement",
        "expense",
        "recurring_expense_rule",
        "manual_sale",
        "order_settlement",
        "customer_order",
        "chart_of_account",
        "accounting_period",
        "journal_entry",
        "currency_rate",
        "exchange_rate",
        "currency_recalculation"
      ],
      index: true
    },
    entityId: { type: String, required: true, index: true },
    referenceCode: { type: String, default: "" },
    summary: { type: String, required: true },
    beforeState: { type: mongoose.Schema.Types.Mixed, default: null },
    afterState: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    actorName: { type: String, default: "" },
    occurredAt: { type: Date, required: true, default: Date.now, index: true }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

financeAuditSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
financeAuditSchema.index({ action: 1, occurredAt: -1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeFinanceAudit || connection.model("storeFinanceAudit", financeAuditSchema);
};
