/**
 * Phase F — Currency & Exchange-Rate Express Controllers
 */

const currencyService = require("./currencyService");

exports.listExchangeRates = async (req, res, next) => {
  try {
    const result = await currencyService.listExchangeRates(req.subdomain, {
      fromCurrency: req.query.fromCurrency || "",
      activeOnly: req.query.activeOnly === "true",
      limit: req.query.limit || 50
    });
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.recordExchangeRate = async (req, res, next) => {
  try {
    const result = await currencyService.recordExchangeRate(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم تسجيل سعر الصرف الجديد وتحديث سجل أسعار الصرف بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.previewCostImpact = async (req, res, next) => {
  try {
    const result = await currencyService.previewExchangeRateCostImpact(
      req.subdomain,
      {
        fromCurrency: req.body?.fromCurrency || req.query?.fromCurrency,
        newRate: req.body?.newRate ?? req.query?.newRate,
        updatePolicy:
          req.body?.updatePolicy ||
          req.body?.policy ||
          req.query?.updatePolicy ||
          req.query?.policy
      }
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.applyApprovedUpdates = async (req, res, next) => {
  try {
    const result = await currencyService.applyApprovedCostAndPriceUpdates(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: result.sellingPricesUpdated
        ? "تم اعتماد وتطبيق تحديثات التكلفة الاستبدالية وأسعار البيع المعتمدة بنجاح"
        : "تم تحديث التكلفة الاستبدالية للمنتجات مع الحفاظ على أسعار البيع الحالية والتكاليف التاريخية دون تغيير"
    });
  } catch (err) {
    next(err);
  }
};
