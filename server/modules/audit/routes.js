const express = require("express");
const router = express.Router();
const auditController = require("./auditController");

router.get("/admin/audit-logs", auditController.listAuditLogs);
router.post("/admin/audit-logs/scan-anomalies", auditController.scanAnomalies);

module.exports = router;
