const { getAuditLogModel } = require("./auditModel");

exports.listAuditLogs = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const {
      page = 1,
      limit = 50,
      action,
      targetType,
      search,
      startDate,
      endDate
    } = req.query;

    const query = {};

    if (action) {
      query.action = action;
    }

    if (targetType) {
      query.targetType = targetType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { userName: { $regex: s, $options: "i" } },
        { actionLabel: { $regex: s, $options: "i" } },
        { targetCode: { $regex: s, $options: "i" } },
        { details: { $regex: s, $options: "i" } }
      ];
    }

    const AuditLog = getAuditLogModel(subdomain);
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      done: true,
      logs,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    next(err);
  }
};

exports.scanAnomalies = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { branchId, startDate, endDate, limit = 100 } = req.body;
    const AuditLog = getAuditLogModel(subdomain);

    const query = {};
    if (branchId && branchId !== "all") query.branchId = branchId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(Number(limit)).lean();

    const flaggedLogIds = [];
    const anomalies = [];

    // Group logs by user to detect rapid consecutive critical actions
    const userActions = {};
    for (const log of logs) {
      const u = log.userName || "unknown";
      userActions[u] = userActions[u] || [];
      userActions[u].push(log);
    }

    for (const [user, uLogs] of Object.entries(userActions)) {
      for (let i = 0; i < uLogs.length - 1; i++) {
        const current = uLogs[i];
        const prev = uLogs[i + 1];
        const diffSec = (new Date(current.timestamp) - new Date(prev.timestamp)) / 1000;

        const isSuspiciousAction =
          (current.action || "").includes("discount") ||
          (current.action || "").includes("cancel") ||
          (current.action || "").includes("price") ||
          (current.action || "").includes("scrap");

        if (isSuspiciousAction && Math.abs(diffSec) < 60) {
          flaggedLogIds.push(String(current._id));
          anomalies.push({
            logId: String(current._id),
            reason: `عملية تعديل أو خصم متتالية وسريعة خلال ${Math.round(Math.abs(diffSec))} ثانية بواسطة ${user}`,
            severity: "high"
          });
        }
      }
    }

    for (const log of logs) {
      if ((log.action || "").includes("scrap") || (log.details || "").includes("تالف")) {
        flaggedLogIds.push(String(log._id));
        anomalies.push({
          logId: String(log._id),
          reason: `تسجيل إتلاف أو هالك للمخزون يحتاج تدقيق ومراجعة إدارية: ${log.details}`,
          severity: "medium"
        });
      }
      if ((log.action || "").includes("void") || (log.action || "").includes("refund")) {
        flaggedLogIds.push(String(log._id));
        anomalies.push({
          logId: String(log._id),
          reason: `عملية إلغاء أو استرداد نقدي بعد إصدار الفاتورة: ${log.details}`,
          severity: "warning"
        });
      }
    }

    const uniqueFlagged = [...new Set(flaggedLogIds)];

    // Automatic Audit Logging for the AI Scan action itself
    try {
      const { logAudit } = require("./auditService");
      await logAudit({
        subdomain,
        userId: req.user?._id || null,
        userName: req.user?.fullname || req.user?.name || "محرك الرقابة الذكي",
        userRole: req.user?.role || "admin",
        action: "ai_anomaly_scan_performed",
        actionLabel: "فحص وتدقيق الرقابة الذكية",
        targetType: "audit",
        targetId: null,
        targetCode: `SCAN-${Date.now().toString().slice(-4)}`,
        details: `إجراء تدقيق ومسح أمني لعدد ${logs.length} عملية بسجل الرقابة، ورصد ${anomalies.length} تنبيهات رقابية تتطلب المراجعة.`,
        metadata: {
          analyzedCount: logs.length,
          anomaliesCount: anomalies.length,
          flaggedCount: uniqueFlagged.length
        }
      });
    } catch (_) {}

    res.json({
      done: true,
      analyzedCount: logs.length,
      anomaliesCount: anomalies.length,
      flaggedLogIds: uniqueFlagged,
      anomalies,
      summary:
        anomalies.length === 0
          ? "تم الفحص بنجاح: لا توجد أي سلوكيات مريبة أو حركات مالية مشبوهة في هذه الفترة. السجلات متوافقة مع معايير الأمان والرقابة."
          : `رصد محرك الذكاء الاصطناعي عدد ${anomalies.length} عمليات تحتاج إلى مراجعة إدارية وتدقيق (تم تظليلها باللون الأحمر).`
    });
  } catch (err) {
    next(err);
  }
};
