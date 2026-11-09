/**
 * Finance Module — Shared Input & Financial Validators
 */

const mongoose = require("mongoose");

function createFinanceError(message, status = 400, code = "FINANCE_VALIDATION_ERROR") {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = code;
  return err;
}

function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function validateNonNegativeAmount(value, fieldLabel = "المبلغ") {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw createFinanceError(`قيمة غير صالحة لحقل ${fieldLabel} (يجب أن تكون رقماً أكبر من أو يساوي صفر)`, 400);
  }
  return roundMoney(num);
}

function validatePositiveAmount(value, fieldLabel = "المبلغ") {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw createFinanceError(`قيمة غير صالحة لحقل ${fieldLabel} (يجب أن تكون رقماً أكبر من صفر)`, 400);
  }
  return roundMoney(num);
}

function validateCurrencyCode(code, fallback = "EGP") {
  const raw = String(code || fallback || "EGP").trim().toUpperCase();
  // Support common currency codes or Arabic symbol "ج.م" normalized to EGP for internal consistency
  if (raw === "ج.م" || raw === "جنيه" || raw === "LE" || raw === "EGP") {
    return "EGP";
  }
  if (!/^[A-Z]{3}$/.test(raw)) {
    throw createFinanceError(`كود العملة غير صالح: "${code}". استخدم رمز عملة قياسي مثل EGP أو USD`, 400);
  }
  return raw;
}

function validateObjectId(id, fieldLabel = "المعرف") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw createFinanceError(`${fieldLabel} غير صالح`, 400);
  }
  return new mongoose.Types.ObjectId(id);
}

function validateOptionalDate(dateInput, fieldLabel = "التاريخ") {
  if (dateInput === null || dateInput === undefined || dateInput === "") {
    return null;
  }
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    throw createFinanceError(`${fieldLabel} غير صالح`, 400);
  }
  return parsed;
}

module.exports = {
  createFinanceError,
  roundMoney,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateCurrencyCode,
  validateObjectId,
  validateOptionalDate
};
