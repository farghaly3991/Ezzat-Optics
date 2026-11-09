/**
 * Enterprise Staff & Operations Controller
 */

const staffService = require("./staffService");

exports.listStaff = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id;
    const staff = await staffService.listStaff(req.subdomain, branchId, req.user);
    res.json({ done: true, staff });
  } catch (err) {
    next(err);
  }
};

exports.getStaffProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.params.staffId || req.params.id;
    const profile = await staffService.getStaffProfile(req.subdomain, userId, req.user);
    res.json({ done: true, profile, ...profile });
  } catch (err) {
    next(err);
  }
};

exports.addStaff = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id || req.body.branchId;
    const staff = await staffService.addStaff(req.subdomain, branchId, req.body, req.user);
    res.status(201).json({
      done: true,
      staff,
      message: `تم إضافة «${staff.fullname}» لطاقم عمل الفرع بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id || req.body.branchId;
    const userId = req.params.userId || req.params.staffId;
    const staff = await staffService.updateStaff(
      req.subdomain,
      branchId,
      userId,
      req.body,
      req.user
    );
    res.json({
      done: true,
      staff,
      message: `تم تحديث بيانات «${staff.fullname}» بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.removeStaff = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id;
    const userId = req.params.userId || req.params.staffId;
    const result = await staffService.removeStaff(
      req.subdomain,
      branchId,
      userId,
      req.user
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.recordAttendance = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id || req.body.branchId;
    const record = await staffService.recordAttendance(
      req.subdomain,
      { ...req.body, branchId },
      req.user
    );
    res.json({ done: true, record, message: "تم تسجيل وتحديث الحضور بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.verifyQrAttendance = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id;
    const result = await staffService.verifyQrAttendance(
      req.subdomain,
      req.body.qrCode,
      branchId,
      req.body.action || "auto",
      req.user
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.listAttendance = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id;
    const records = await staffService.listAttendance(
      req.subdomain,
      branchId,
      req.query,
      req.user
    );
    res.json({ done: true, records });
  } catch (err) {
    next(err);
  }
};

exports.addDeduction = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id || req.body.branchId;
    const deduction = await staffService.addDeduction(
      req.subdomain,
      { ...req.body, branchId },
      req.user
    );
    res.status(201).json({
      done: true,
      deduction,
      message: `تم تسجيل خصم بقيمة ${deduction.amount} ج.م بنجاح`
    });
  } catch (err) {
    next(err);
  }
};

exports.listDeductions = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id;
    const deductions = await staffService.listDeductions(
      req.subdomain,
      branchId,
      req.query,
      req.user
    );
    res.json({ done: true, deductions });
  } catch (err) {
    next(err);
  }
};

exports.deleteDeduction = async (req, res, next) => {
  try {
    const result = await staffService.deleteDeduction(req.subdomain, req.params.id, req.user);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.params.staffId || req.params.id;
    const result = await staffService.getStaffPerformanceAnalytics(
      req.subdomain,
      userId,
      req.user
    );
    const analyticsObj = result.analytics || result.performance || result;
    res.json({
      done: true,
      ...analyticsObj,
      analytics: analyticsObj,
      performance: analyticsObj
    });
  } catch (err) {
    next(err);
  }
};

exports.listStaffReviews = async (req, res, next) => {
  try {
    const reviews = await staffService.listStaffReviews(
      req.subdomain,
      req.params.branchId,
      req.query,
      req.user
    );
    res.json({ done: true, reviews });
  } catch (err) {
    next(err);
  }
};

exports.createReviewRequest = async (req, res, next) => {
  try {
    const employeeId = req.params.userId || req.params.staffId || req.body.employeeId || req.body.staffId;
    const branchId = req.params.branchId || req.body.branchId;
    const role = req.body.role || "courier";
    const reviewRequest = await staffService.createReviewRequest(req.subdomain, {
      ...req.body,
      employeeId,
      branchId,
      serviceType: role === "technician" ? "maintenance_service" : "delivery"
    });
    res.status(201).json({
      done: true,
      reviewToken: reviewRequest.reviewToken,
      reviewRequest
    });
  } catch (err) {
    next(err);
  }
};

exports.submitReviewPublic = async (req, res, next) => {
  try {
    const result = await staffService.submitCustomerReview(
      req.subdomain,
      req.params.token,
      req.body
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};
