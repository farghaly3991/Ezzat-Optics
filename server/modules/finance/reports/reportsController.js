/**
 * Phase E — Financial Reports Express Controllers (E2 Basic & E3 Advanced)
 */

const reportsService = require("./reportsService");
const { getFinanceSettings } = require("../core/settings/financeSettingsService");
const { isLevelSufficient } = require("../core/settings/capabilityRegistry");

exports.getBasicDashboard = async (req, res, next) => {
  try {
    const report = await reportsService.getBasicFinancialDashboard(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...report
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdvancedReport = async (req, res, next) => {
  try {
    const settings = await getFinanceSettings(req.subdomain);
    if (!isLevelSufficient(settings.level, "advanced")) {
      return res.status(403).json({
        error: `التقارير المالية التحليلية المتقدمة تتطلب مستوى "advanced" أو أعلى (المستوى الحالي: "${settings.level}").`,
        code: "FINANCE_LEVEL_INSUFFICIENT",
        currentLevel: settings.level,
        requiredLevel: "advanced"
      });
    }

    const report = await reportsService.getAdvancedFinancialReport(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...report
    });
  } catch (err) {
    next(err);
  }
};

exports.getCommercialLedger = async (req, res, next) => {
  try {
    const commercialLedgerService = require("./commercialLedgerService");
    const branchId = req.user?.role !== 5 && req.user?.branchId ? req.user.branchId : req.query.branchId;
    const ledger = await commercialLedgerService.computeCommercialLedger(req.subdomain, {
      branchId,
      periodStart: req.query.periodStart,
      periodEnd: req.query.periodEnd
    });
    res.json({ done: true, ledger });
  } catch (err) {
    next(err);
  }
};

exports.reconcileCommercialAudit = async (req, res, next) => {
  try {
    const commercialLedgerService = require("./commercialLedgerService");
    const branchId = req.user?.role !== 5 && req.user?.branchId ? req.user.branchId : req.query.branchId;
    const report = await commercialLedgerService.reconcileCommercialLedgerWithAudit(req.subdomain, {
      branchId,
      periodStart: req.query.periodStart,
      periodEnd: req.query.periodEnd
    });
    res.json({ done: true, reconciliation: report });
  } catch (err) {
    next(err);
  }
};

exports.saveCommercialSnapshot = async (req, res, next) => {
  try {
    const commercialLedgerService = require("./commercialLedgerService");
    const branchId = req.user?.role !== 5 && req.user?.branchId ? req.user.branchId : req.body.branchId;
    const snapshot = await commercialLedgerService.saveAuditSnapshot(req.subdomain, req.user, {
      branchId,
      periodPreset: req.body.periodPreset,
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd
    });
    res.json({ done: true, message: "تم حفظ اللقطة الإحصائية في قاعدة البيانات بنجاح", snapshot });
  } catch (err) {
    next(err);
  }
};

exports.getLatestCommercialSnapshot = async (req, res, next) => {
  try {
    const commercialLedgerService = require("./commercialLedgerService");
    const branchId = req.user?.role !== 5 && req.user?.branchId ? req.user.branchId : req.query.branchId;
    const snapshot = await commercialLedgerService.getLatestAuditSnapshot(req.subdomain, branchId);
    res.json({ done: true, snapshot });
  } catch (err) {
    next(err);
  }
};

exports.listCommercialSnapshots = async (req, res, next) => {
  try {
    const commercialLedgerService = require("./commercialLedgerService");
    const branchId = req.user?.role !== 5 && req.user?.branchId ? req.user.branchId : req.query.branchId;
    const snapshots = await commercialLedgerService.listAuditSnapshots(req.subdomain, branchId);
    res.json({ done: true, snapshots });
  } catch (err) {
    next(err);
  }
};
