/**
 * Phase D — Expenses, Recurring Expenses & Manual Sales Express Controllers
 */

const expensesService = require("./expensesService");

exports.listExpenses = async (req, res, next) => {
  try {
    const result = await expensesService.listExpenses(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getExpense = async (req, res, next) => {
  try {
    const result = await expensesService.getExpenseById(req.subdomain, req.params.id);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.createExpense = async (req, res, next) => {
  try {
    const result = await expensesService.createExpense(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم تسجيل المصروف بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updateExpense = async (req, res, next) => {
  try {
    const result = await expensesService.updateExpense(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تحديث بيانات المصروف بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordExpensePayment = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await expensesService.recordExpensePayment(
      req.subdomain,
      req.params.id,
      { ...(req.body || {}), idempotencyKey },
      req.user
    );
    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: result.deduplicated
        ? "دفعة المصروف مسجلة مسبقاً (تم منع التكرار)"
        : "تم تسجيل سداد المصروف وتحديث الرصيد المتبقي بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.reverseExpensePayment = async (req, res, next) => {
  try {
    const result = await expensesService.reverseExpensePayment(
      req.subdomain,
      req.params.id,
      req.params.paymentId,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم عكس دفعة المصروف بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.correctExpensePayment = async (req, res, next) => {
  try {
    const result = await expensesService.correctExpensePayment(
      req.subdomain,
      req.params.id,
      req.params.paymentId,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تصحيح دفعة المصروف بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

// Recurring Expense Rules
exports.listRecurringRules = async (req, res, next) => {
  try {
    const result = await expensesService.listRecurringExpenseRules(req.subdomain, {
      activeOnly: req.query.activeOnly === "true"
    });
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.createRecurringRule = async (req, res, next) => {
  try {
    const result = await expensesService.createRecurringExpenseRule(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      ...result,
      message: "تم إنشاء قاعدة المصروف الدوري بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updateRecurringRule = async (req, res, next) => {
  try {
    const result = await expensesService.updateRecurringExpenseRule(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تحديث قاعدة المصروف الدوري للفترات القادمة بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.generateRecurringOccurrences = async (req, res, next) => {
  try {
    const result = await expensesService.generateRecurringExpenseOccurrences(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: `تم فحص المصروفات الدورية: تم توليد ${result.createdCount} مصروف جديد وتخطي ${result.skippedCount} مسجل مسبقاً`
    });
  } catch (err) {
    next(err);
  }
};

// Manual / Offline Sales
exports.listManualSales = async (req, res, next) => {
  try {
    const result = await expensesService.listManualSales(req.subdomain, req.query || {});
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getManualSale = async (req, res, next) => {
  try {
    const result = await expensesService.getManualSaleById(req.subdomain, req.params.id);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.createManualSale = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await expensesService.createManualSale(
      req.subdomain,
      { ...(req.body || {}), idempotencyKey },
      req.user
    );
    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: result.deduplicated
        ? "فاتورة البيع اليدوي مسجلة مسبقاً (تم منع التكرار)"
        : "تم تسجيل فاتورة البيع اليدوي وخصم المخزون بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordManualSalePayment = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await expensesService.recordManualSalePayment(
      req.subdomain,
      req.params.id,
      { ...(req.body || {}), idempotencyKey },
      req.user
    );
    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: result.deduplicated
        ? "دفعة التحصيل مسجلة مسبقاً"
        : "تم تسجيل تحصيل الدفعة وتحديث الرصيد بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.reverseManualSalePayment = async (req, res, next) => {
  try {
    const result = await expensesService.reverseManualSalePayment(
      req.subdomain,
      req.params.id,
      req.params.paymentId,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم عكس دفعة التحصيل بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.correctManualSalePayment = async (req, res, next) => {
  try {
    const result = await expensesService.correctManualSalePayment(
      req.subdomain,
      req.params.id,
      req.params.paymentId,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم تصحيح دفعة التحصيل بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordOrderSettlement = async (req, res, next) => {
  try {
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body?.idempotencyKey || null;
    const result = await expensesService.recordOnlineOrderSettlementPayment(
      req.subdomain,
      req.params.orderId || req.body?.orderId,
      { ...(req.body || {}), idempotencyKey },
      req.user
    );
    res.status(result.deduplicated ? 200 : 201).json({
      done: true,
      ...result,
      message: "تم تسجيل التحصيل النقدي للطلب الإلكتروني بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.getAutoPayroll = async (req, res, next) => {
  try {
    const payroll = await expensesService.calculateAutomaticPayroll(
      req.subdomain,
      req.query.period
    );
    res.json({ done: true, payroll });
  } catch (err) {
    next(err);
  }
};
