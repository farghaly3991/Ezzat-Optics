/**
 * Finance Core Audit & Activity Service
 *
 * Records immutable financial audit logs (`storeFinanceAudit`) and bridges relevant
 * business events to `storeActivity` for dashboard visibility and statistics.
 */

const getFinanceAuditModel = require("./auditModel");
const { recordActivity } = require("../../../activity/activityService");
const { logAudit } = require("../../../audit/auditService");

const ACTION_LABELS_AR = {
  supplier_reorder_dispatched: "إرسال أمر توريد جديد للمورد",
  reorder_dispatched: "إرسال أمر توريد جديد للمورد",
  reorder_suggested: "اقتراح أمر توريد ذكي",
  reorder_cancelled: "إلغاء أمر توريد",
  reorder_converted: "تحويل أمر التوريد إلى شحنة",
  supplier_shipment_created: "تسجيل فاتورة شحنة توريد جديدة",
  supplier_shipment_updated: "تحديث بيانات شحنة التوريد",
  supplier_receipt: "استلام وتفريغ بضاعة شحنة توريد بالمخزن",
  inventory_receipt: "إذن إضافة بضاعة للمخزن",
  shipment_payment_recorded: "تسجيل دفعة سداد لمورد",
  supplier_created: "إضافة مورد جديد",
  supplier_updated: "تعديل بيانات مورد",
  supplier_deleted: "حذف مورد",
  inventory_issue: "إذن صرف مخزني",
  inventory_transfer: "تحويل مخزني بين الفروع",
  inventory_count_reconciliation: "تسوية جرد مخزني",
  expense_created: "تسجيل سند صرف / مصروف",
  expense_approved: "اعتماد سند مصروف",
  expense_rejected: "رفض سند مصروف",
  manual_sale_recorded: "تسجيل إيراد / بيع يدوي",
  journal_entry_posted: "ترحيل قيد يومية محاسبي",
  period_closed: "إقفال فترة مالية محاسبية",
  currency_rate_updated: "تحديث سعر صرف العملة",
  shipping_class_created: "إنشاء فئة شحن جديدة",
  shipping_class_updated: "تعديل فئة شحن"
};

function getActionFriendlyLabel(action, fallback) {
  const norm = String(action || "").toLowerCase().trim();
  return ACTION_LABELS_AR[norm] || fallback || norm;
}

function getTargetType(entityType) {
  const norm = String(entityType || "").toLowerCase();
  if (norm.includes("shipment") || norm.includes("reorder") || norm.includes("inventory") || norm.includes("stock") || norm.includes("warehouse")) {
    return "warehouse";
  }
  if (norm.includes("expense") || norm.includes("payment") || norm.includes("journal") || norm.includes("currency") || norm.includes("supplier") || norm.includes("manual_sale")) {
    return "finance";
  }
  return "finance";
}

async function recordFinanceAudit(subdomain, {
  action,
  entityType,
  entityId,
  referenceCode = "",
  summary,
  reason,
  notes,
  beforeState = null,
  afterState = null,
  metadata = {},
  actor = null,
  activityPayload = null,
  occurredAt = new Date()
}) {
  const FinanceAudit = getFinanceAuditModel(subdomain);
  const actorId = actor?._id || actor?.userId || null;
  const actorName = actor?.fullname || actor?.name || actor?.email || actor?.actorName || "المدير العام";
  const actorRole = actor?.role != null ? String(actor.role) : "admin";
  const finalSummary = String(summary || reason || notes || action);

  const auditDoc = await new FinanceAudit({
    action,
    entityType,
    entityId: String(entityId),
    referenceCode: String(referenceCode || ""),
    summary: finalSummary,
    beforeState,
    afterState,
    metadata,
    actorId,
    actorName,
    occurredAt
  }).save();

  // 1. Unified Store Audit Bridge (Writes directly to auditlogs collection displayed on /admin/audit-logs)
  try {
    const actionLabel = getActionFriendlyLabel(action, finalSummary);
    const targetType = getTargetType(entityType);

    await logAudit({
      subdomain,
      userId: actorId,
      userName: actorName,
      userRole: actorRole,
      branchId: actor?.branchId || metadata?.branchId || null,
      action: String(action || "").toLowerCase(),
      actionLabel,
      targetType,
      targetId: entityId ? String(entityId) : null,
      targetCode: referenceCode || null,
      details: finalSummary,
      metadata: {
        ...metadata,
        entityType,
        source: "finance_bridge"
      }
    });
  } catch (auditErr) {
    console.warn("[FINANCE_AUDIT_LOG_BRIDGE_WARN]", auditErr.message);
  }

  // 2. Activity Dashboard Bridge
  let activityDoc = null;
  if (activityPayload && activityPayload.eventType) {
    try {
      const actRes = await recordActivity(subdomain, {
        ...activityPayload,
        userId: actorId || activityPayload.userId || null,
        occurredAt
      });
      activityDoc = actRes.doc;
    } catch (actErr) {
      console.warn("[FINANCE_ACTIVITY_BRIDGE_WARN]", actErr.message);
    }
  }

  return {
    audit: auditDoc.toObject(),
    activity: activityDoc
  };
}

async function listFinanceAuditLogs(subdomain, { entityType, entityId, action, limit = 50, page = 1 } = {}) {
  const FinanceAudit = getFinanceAuditModel(subdomain);
  const query = {};
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = String(entityId);
  if (action) query.action = action;

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const [total, logs] = await Promise.all([
    FinanceAudit.countDocuments(query),
    FinanceAudit.find(query)
      .sort({ occurredAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean()
  ]);

  return {
    logs,
    total,
    page: p,
    pages: Math.ceil(total / l) || 1
  };
}

module.exports = {
  recordFinanceAudit,
  listFinanceAuditLogs
};
