/**
 * Phase B — Supplier Shipments & Procurement Express Controllers
 */

const procurementService = require("./procurementService");
const procurementReorderService = require("./procurementReorderService");
const { listFinanceAuditLogs } = require("../core/audit/auditService");

exports.listSuppliers = async (req, res, next) => {
  try {
    const suppliers = await procurementService.listSuppliers(req.subdomain, {
      activeOnly: req.query.activeOnly === "true",
      search: req.query.search || ""
    });
    res.json({ done: true, suppliers });
  } catch (err) {
    next(err);
  }
};

exports.getSupplierDetails = async (req, res, next) => {
  try {
    const supplier = await procurementService.getSupplierById(req.subdomain, req.params.id);
    res.json({ done: true, supplier });
  } catch (err) {
    next(err);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await procurementService.createSupplier(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      supplier,
      message: "تم تسجيل بيانات المورد بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await procurementService.updateSupplier(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({ done: true, supplier, message: "تم تحديث بيانات المورد بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const result = await procurementService.deleteSupplier(
      req.subdomain,
      req.params.id,
      req.user
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getGridCriticalProducts = async (req, res, next) => {
  try {
    const result = await procurementReorderService.getGridCriticalAndOutOfStockProducts(
      req.subdomain,
      req.query || {}
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getCriticalProducts = async (req, res, next) => {
  try {
    const result = await procurementReorderService.getCriticalAndOutOfStockProducts(
      req.subdomain,
      req.query || {}
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getFastSellingForecast = async (req, res, next) => {
  try {
    const result = await procurementReorderService.getFastSellingProcurementForecast(
      req.subdomain,
      req.query || {}
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.generateReorderProposal = async (req, res, next) => {
  try {
    const result = await procurementReorderService.generateSupplierReordersProposal(
      req.subdomain,
      req.body || {},
      req
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.dispatchReorder = async (req, res, next) => {
  try {
    const result = await procurementReorderService.dispatchAndRecordSupplierReorder(
      req.subdomain,
      req.body || {},
      req.user,
      req
    );
    res.json({ done: true, ...result, message: "تم تسجيل وإرسال طلب التوريد بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.listReorders = async (req, res, next) => {
  try {
    const result = await procurementReorderService.listSupplierReorders(
      req.subdomain,
      req.query || {}
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.updateReorderStatus = async (req, res, next) => {
  try {
    const result = await procurementReorderService.updateSupplierReorderStatus(
      req.subdomain,
      req.params.id,
      req.body?.status,
      req.user
    );
    res.json({ done: true, reorder: result, message: "تم تحديث حالة طلب التوريد بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.getProcurementOverview = async (req, res, next) => {
  try {
    const overview = await procurementService.getProcurementOverviewAndAlerts(req.subdomain);
    res.json({
      done: true,
      summary: overview.summary,
      alerts: overview.alerts,
      overdueShipments: overview.overdueShipments,
      upcomingDueShipments: overview.upcomingDueShipments,
      recentActivities: overview.recentActivities
    });
  } catch (err) {
    next(err);
  }
};

exports.listShipments = async (req, res, next) => {
  try {
    const result = await procurementService.listSupplierShipments(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

exports.getShipmentDetails = async (req, res, next) => {
  try {
    const result = await procurementService.getSupplierShipmentById(
      req.subdomain,
      req.params.id
    );
    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

exports.createShipment = async (req, res, next) => {
  try {
    const result = await procurementService.createSupplierShipment(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم إنشاء شحنة المورد بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updateShipment = async (req, res, next) => {
  try {
    const result = await procurementService.updateSupplierShipment(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تحديث شحنة المورد بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.associateShipmentProducts = async (req, res, next) => {
  try {
    const result = await procurementService.associateProductsWithShipment(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم ربط المنتجات بشحنة المورد وتحديث الالتزام المالي بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.removeShipmentLine = async (req, res, next) => {
  try {
    const result = await procurementService.removePurchaseLineFromShipment(
      req.subdomain,
      req.params.id,
      req.params.lineId,
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم إزالة البند من الشحنة وتحديث الأرصدة"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;

    const result = await procurementService.recordShipmentPayment(
      req.subdomain,
      req.params.id,
      {
        ...(req.body || {}),
        idempotencyKey
      },
      req.user
    );

    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: result.deduplicated
        ? "هذه الدفعة مسجلة مسبقاً (تم منع التكرار)"
        : "تم تسجيل الدفعة المالية وتحديث الرصيد المتبقي بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.reversePayment = async (req, res, next) => {
  try {
    const result = await procurementService.reverseShipmentPayment(
      req.subdomain,
      req.params.id,
      req.params.paymentId,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم عكس الدفعة المالية وتحديث الرصيد المستحق بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.correctPayment = async (req, res, next) => {
  try {
    const result = await procurementService.correctShipmentPayment(
      req.subdomain,
      req.params.id,
      req.params.paymentId,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تسجيل تصحيح الدفعة وتحديث الرصيد بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.listFinanceAudit = async (req, res, next) => {
  try {
    const result = await listFinanceAuditLogs(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};
