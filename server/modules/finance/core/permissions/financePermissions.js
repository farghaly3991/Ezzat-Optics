/**
 * Finance Module — Permissions & Capability Guards (Phases A–F)
 *
 * Reuses existing `protect` and `adminOnly` authentication/authorization
 * conventions while enforcing capability level permissions per module.
 */

const { protect, adminOnly } = require("../../../auth/authMiddleware");
const { getFinanceSettings } = require("../settings/financeSettingsService");
const { isLevelSufficient } = require("../settings/capabilityRegistry");

function requireAdminFinance(req, res, next) {
  return protect(req, res, (err) => {
    if (err) return next(err);
    return adminOnly(req, res, next);
  });
}

/**
 * Guard that checks whether a module is implemented and whether the store's
 * current Finance Capability Level unlocks it (`basic`, `advanced`, `professional`, `enterprise`).
 */
function requireImplementedModule(moduleKey, options = {}) {
  return async (req, res, next) => {
    try {
      const settings = await getFinanceSettings(req.subdomain);
      req.financeSettings = settings;
      const mod = settings.modules?.[moduleKey];
      if (!mod || !mod.implemented) {
        return res.status(501).json({
          error: `الموديول المالي "${moduleKey}" غير مفعل تشغيلياً.`,
          code: "FINANCE_MODULE_NOT_IMPLEMENTED",
          moduleKey,
          implemented: false
        });
      }

      const requiredLevel = options.minLevel || mod.minLevel || "basic";
      if (!isLevelSufficient(settings.level, requiredLevel)) {
        return res.status(403).json({
          error: `هذه الميزة تتطلب مستوى النظام المالي "${requiredLevel}" أو أعلى (المستوى الحالي: "${settings.level}"). يمكنك ترقية المستوى من إعدادات المالية دون فقدان أي بيانات.`,
          code: "FINANCE_LEVEL_INSUFFICIENT",
          moduleKey,
          currentLevel: settings.level,
          requiredLevel
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireFinanceLevel(requiredLevel) {
  return async (req, res, next) => {
    try {
      const settings = req.financeSettings || (await getFinanceSettings(req.subdomain));
      req.financeSettings = settings;
      if (!isLevelSufficient(settings.level, requiredLevel)) {
        return res.status(403).json({
          error: `هذا الإجراء يتطلب مستوى النظام المالي "${requiredLevel}" أو أعلى (المستوى الحالي: "${settings.level}").`,
          code: "FINANCE_LEVEL_INSUFFICIENT",
          currentLevel: settings.level,
          requiredLevel
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireAdminFinance,
  requireImplementedModule,
  requireFinanceLevel
};
