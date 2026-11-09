const express = require("express");
const router = express.Router();
const returnsController = require("./returnsController");
const { protect, optionalAuth, adminOnly } = require("../auth/authMiddleware");

// Storefront Client Routes
router.post("/store-orders-public/returns/request", optionalAuth, returnsController.createRequest);
router.get("/store-orders-public/returns/my", protect, returnsController.getMyRequests);
router.get("/store-orders-public/returns/track/:requestNumber", returnsController.trackRequest);

// Dedicated Technician Task Portal Routes (Mobile & WhatsApp Link Access)
router.get("/maintenance-public/task/:id", optionalAuth, returnsController.getTechnicianTask);
router.put("/maintenance-public/task/:id", optionalAuth, returnsController.updateTechnicianTask);

// Admin Routes (protected at core router with /admin)
router.get("/admin/returns", protect, adminOnly, returnsController.listAdminRequests);
router.get("/admin/returns/:id", protect, adminOnly, returnsController.getAdminRequestById);
router.put("/admin/returns/:id/status", protect, adminOnly, returnsController.updateAdminRequestStatus);
router.put("/admin/returns/:id/assign-tech", protect, adminOnly, returnsController.assignTechnician);
router.put("/admin/returns/:id/financials", protect, adminOnly, returnsController.updateMaintenanceFinancials);
router.post("/admin/returns/:id/refund", protect, adminOnly, returnsController.processAdminRefund);
router.post("/admin/returns/:id/convert-service", protect, adminOnly, returnsController.convertToFieldService);

module.exports = router;
