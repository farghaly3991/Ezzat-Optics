/**
 * Multi-Branch Routes
 */

const express = require("express");
const router = express.Router();
const branchController = require("./branchController");
const staffController = require("./staffController");
const { protect, adminOnly, superAdminOnly } = require("../auth/authMiddleware");

// Storefront public listing & public customer review
router.get("/store-public/branches", branchController.listPublic);
router.post("/store-public/staff-reviews/:token", staffController.submitReviewPublic);
router.post("/public/staff-reviews/:token", staffController.submitReviewPublic);
router.post("/api/public/staff-reviews/:token", staffController.submitReviewPublic);

// Admin branches routes
router.get("/admin/branches", protect, adminOnly, branchController.list);
router.get("/admin/branches/:id", protect, adminOnly, branchController.getOne);

// Branch Staff Endpoints (Supports both :id and :branchId)
router.get("/admin/branches/:id/staff", protect, adminOnly, branchController.getStaff);
router.get("/admin/branches/:branchId/staff", protect, adminOnly, branchController.getStaff);
router.post("/admin/branches/:id/staff", protect, adminOnly, staffController.addStaff);
router.post("/admin/branches/:branchId/staff", protect, adminOnly, staffController.addStaff);
router.put("/admin/branches/:id/staff/:userId", protect, adminOnly, staffController.updateStaff);
router.put("/admin/branches/:branchId/staff/:userId", protect, adminOnly, staffController.updateStaff);
router.delete("/admin/branches/:id/staff/:userId", protect, adminOnly, staffController.removeStaff);
router.delete("/admin/branches/:branchId/staff/:userId", protect, adminOnly, staffController.removeStaff);
router.put("/admin/branches/:id/manager", protect, superAdminOnly, branchController.setManager);
router.get("/admin/branches/:id/technicians", protect, adminOnly, branchController.getTechnicians);

// Enterprise HR, Staff Profiles & Attendance Routes
router.get("/admin/branches/:branchId/staff-list", protect, adminOnly, staffController.listStaff);
router.get("/admin/branches/:branchId/staff/:userId/profile", protect, adminOnly, staffController.getStaffProfile);
router.get("/admin/branches/staff/:userId/profile", protect, adminOnly, staffController.getStaffProfile);
router.get("/admin/branches/:branchId/staff/:userId/performance", protect, adminOnly, staffController.getPerformance);
router.get("/admin/branches/staff/:userId/performance", protect, adminOnly, staffController.getPerformance);

// Attendance & QR Scanner
router.get("/admin/branches/:branchId/attendance", protect, adminOnly, staffController.listAttendance);
router.post("/admin/branches/:branchId/attendance", protect, adminOnly, staffController.recordAttendance);
router.post("/admin/branches/:branchId/attendance/qr-scan", protect, adminOnly, staffController.verifyQrAttendance);
router.post("/admin/branches/:branchId/attendance/verify-qr", protect, adminOnly, staffController.verifyQrAttendance);

// Deductions & Penalties
router.get("/admin/branches/:branchId/deductions", protect, adminOnly, staffController.listDeductions);
router.post("/admin/branches/:branchId/deductions", protect, adminOnly, staffController.addDeduction);
router.delete("/admin/branches/deductions/:id", protect, adminOnly, staffController.deleteDeduction);
router.delete("/admin/branches/:branchId/deductions/:id", protect, adminOnly, staffController.deleteDeduction);

// Customer Reviews for Staff (Technicians & Delivery Couriers)
router.get("/admin/branches/:branchId/reviews", protect, adminOnly, staffController.listStaffReviews);
router.get("/admin/branches/:branchId/staff-reviews", protect, adminOnly, staffController.listStaffReviews);
router.post("/admin/branches/:branchId/staff/:userId/review-token", protect, adminOnly, staffController.createReviewRequest);
router.post("/admin/branches/staff-reviews/dispatch", protect, adminOnly, staffController.createReviewRequest);

// Super Admin only (Role 5) mutations
router.post("/admin/branches", protect, superAdminOnly, branchController.create);
router.put("/admin/branches/:id", protect, superAdminOnly, branchController.update);
router.delete("/admin/branches/:id", protect, superAdminOnly, branchController.delete);

module.exports = router;
