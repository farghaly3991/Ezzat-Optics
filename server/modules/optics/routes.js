const express = require("express");
const router = express.Router();
const controller = require("./lensMatrixController");
const { memoryUpload } = require("../../core/middleware/memoryUpload");

router.get("/admin/lens-matrix/products", controller.listLensProducts);
router.get("/admin/lens-matrix/:id", controller.getLensMatrix);
router.put("/admin/lens-matrix/:id", controller.updateLensMatrix);
router.post("/admin/lens-matrix/:id/stocktake", controller.submitLensStocktake);
router.post("/admin/lens-matrix/:id/quick-adjust", controller.quickAdjustLensCell);
router.post("/admin/lens-matrix/:id/ai-command", controller.interpretMatrixCommand);
router.get("/admin/lens-matrix/:id/export-excel", controller.exportLensExcel);
router.post("/admin/lens-matrix/:id/import-excel", memoryUpload.single("file"), controller.importLensExcel);

module.exports = router;
