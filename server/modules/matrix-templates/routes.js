const express = require("express");
const router = express.Router();
const controller = require("./matrixTemplatesController");

router.get("/admin/matrix-templates", controller.listTemplates);
router.get("/admin/matrix-templates/:id", controller.getTemplateById);
router.post("/admin/matrix-templates", controller.createTemplate);
router.put("/admin/matrix-templates/:id", controller.updateTemplate);
router.delete("/admin/matrix-templates/:id", controller.deleteTemplate);

module.exports = router;
