/**
 * Phase C — Inventory, Receiving & Valuation Express Controllers
 */

const inventoryService = require("./inventoryService");

exports.getInventoryValuation = async (req, res, next) => {
  try {
    const report = await inventoryService.getInventoryValuationReport(req.subdomain, {
      search: req.query.search || "",
      lowStockOnly: req.query.lowStockOnly === "true"
    });
    res.json({
      done: true,
      ...report
    });
  } catch (err) {
    next(err);
  }
};

exports.listMovements = async (req, res, next) => {
  try {
    const result = await inventoryService.listInventoryMovements(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

exports.receiveShipment = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await inventoryService.receiveSupplierShipment(
      req.subdomain,
      req.params.shipmentId || req.body?.shipmentId,
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
        ? "عملية الاستلام مسجلة مسبقاً (تم منع التكرار)"
        : "تم تسجيل الاستلام المخزني وتحديث الأرصدة وتكلفة المخزون بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordManualAdjustment = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await inventoryService.recordManualStockAdjustment(
      req.subdomain,
      {
        ...(req.body || {}),
        idempotencyKey
      },
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: result.unchanged
        ? result.message
        : "تم تسجيل تسوية المخزون وتوثيقها في سجل المراجعة بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordDamagedStock = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await inventoryService.recordDamagedOrLostStock(
      req.subdomain,
      {
        ...(req.body || {}),
        idempotencyKey
      },
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم تسجيل التالف/الفاقد المخزني وخصمه من الرصيد الفعلي بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordReturnMovement = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await inventoryService.recordExplicitInventoryReturn(
      req.subdomain,
      {
        ...(req.body || {}),
        idempotencyKey
      },
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم تسجيل حركة المرتجع المخزني بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updateReservation = async (req, res, next) => {
  try {
    const result = await inventoryService.updateStockReservation(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تحديث حجز المخزون بنجاح"
    });
  } catch (err) {
    next(err);
  }
};
