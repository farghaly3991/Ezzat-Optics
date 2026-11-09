/**
 * Phase E4 — Double-Entry Accounting Express Controllers
 */

const accountingService = require("./accountingService");

exports.listAccounts = async (req, res, next) => {
  try {
    const result = await accountingService.listChartOfAccounts(req.subdomain, {
      activeOnly: req.query.activeOnly === "true"
    });
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.createAccount = async (req, res, next) => {
  try {
    const result = await accountingService.createAccount(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم إضافة الحساب المحاسبي إلى دليل الحسابات بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.listJournalEntries = async (req, res, next) => {
  try {
    const result = await accountingService.listJournalEntries(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.createJournalEntry = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await accountingService.createJournalEntry(
      req.subdomain,
      { ...(req.body || {}), idempotencyKey },
      req.user
    );
    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: result.deduplicated
        ? "القيد المحاسبي مرحل مسبقاً (تم منع الازدواجية)"
        : "تم حفظ القيد المحاسبي المتوازن بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.postDraftEntry = async (req, res, next) => {
  try {
    const result = await accountingService.postDraftJournalEntry(
      req.subdomain,
      req.params.id,
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم اعتماد وترحيل القيد المسودة بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.reverseJournalEntry = async (req, res, next) => {
  try {
    const result = await accountingService.reverseJournalEntry(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم إصدار القيد العكسي المتوازن بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.postSourceEvent = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await accountingService.postSourceBusinessEvent(
      req.subdomain,
      { ...(req.body || {}), idempotencyKey },
      req.user
    );
    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: result.deduplicated
        ? "تم ترحيل هذه العملية مسبقاً في دفتر اليومية (تم منع التكرار)"
        : "تم ترحيل العملية المالية في دفتر اليومية بالقيد المزدوج بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.getTrialBalance = async (req, res, next) => {
  try {
    const result = await accountingService.getTrialBalanceAndReconciliation(
      req.subdomain,
      req.query || {}
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.listPeriods = async (req, res, next) => {
  try {
    const result = await accountingService.listAccountingPeriods(req.subdomain);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.closePeriod = async (req, res, next) => {
  try {
    const result = await accountingService.closeAccountingPeriod(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم إغلاق الفترة المحاسبية بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.reopenPeriod = async (req, res, next) => {
  try {
    const result = await accountingService.reopenAccountingPeriod(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم إعادة فتح الفترة المحاسبية بنجاح"
    });
  } catch (err) {
    next(err);
  }
};
