/**
 * Global Express error handler (must be mounted after all routes).
 * Normalises Mongo duplicate-key, JWT, and finance/domain errors into `{ error, code, status }`.
 */

function errorHandler(err, req, res, next) {
  if (!err) return next();
  console.error(`[SERVER_ERROR] [${req.method}] ${req.originalUrl}:`, err);

  let status = err.status || err.statusCode || 500;
  let message = "حدث خطأ غير متوقع في الخادم.";

  if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyPattern || {})[0] || "البيانات";
    message = `هذه القيمة مسجلة مسبقاً (${field}).`;
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    status = 401;
    message = "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.";
  } else if (err.message) {
    message = err.message;
  }

  res.status(status).json({
    error: message,
    code: typeof err.code === "string" ? err.code : undefined,
    status
  });
}

module.exports = { errorHandler };
