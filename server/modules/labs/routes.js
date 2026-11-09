const express = require("express");
const router = express.Router();
const labsController = require("./labsController");

// Public Lab Tracking & Stage Updating (No auth required, token-guarded)
router.get("/public/work-orders/:token", labsController.getPublicWorkOrder);
router.put("/public/work-orders/:token/stage", labsController.updatePublicWorkOrderStage);

// Admin Labs Directory
router.get("/admin/labs", labsController.listLabs);
router.post("/admin/labs", labsController.createLab);
router.put("/admin/labs/:labId", labsController.updateLab);
router.delete("/admin/labs/:labId", labsController.deleteLab);

// Admin Work Orders
router.get("/admin/work-orders", labsController.listWorkOrders);
router.post("/admin/work-orders", labsController.createWorkOrder);
router.get("/admin/work-orders/:id", labsController.getWorkOrder);
router.put("/admin/work-orders/:id/stage", labsController.updateWorkOrderStage);
router.put("/admin/work-orders/:id/financials", labsController.updateWorkOrderFinancials);
router.put("/admin/work-orders/:id/rate", labsController.rateWorkOrder);

module.exports = router;
