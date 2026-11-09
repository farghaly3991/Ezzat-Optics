/**
 * Excel module routes (admin): import template, import, export.
 */

const express = require("express");
const router = express.Router();

const { memoryUpload } = require("../../core/middleware/memoryUpload");
const excelController = require("./excelController");

router.get("/admin/excel/template", excelController.getTemplate);
router.post("/admin/excel/import", memoryUpload.single("file"), excelController.importExcel);
router.get("/admin/excel/export", excelController.exportExcel);

module.exports = router;
