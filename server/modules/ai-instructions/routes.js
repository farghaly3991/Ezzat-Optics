/**
 * AI Instructions module routes (admin): admin-managed assistant instructions + semantic retrieval.
 * Static segments (sync-all, test-retrieval) must stay before `/:id`.
 */

const express = require("express");
const router = express.Router();

const aiInstructionsController = require("./aiInstructionsController");

router.get("/admin/ai-instructions", aiInstructionsController.list);
router.post("/admin/ai-instructions", aiInstructionsController.create);
router.post("/admin/ai-instructions/sync-all", aiInstructionsController.resyncAll);
router.post("/admin/ai-instructions/test-retrieval", aiInstructionsController.testRetrieval);
router.put("/admin/ai-instructions/:id", aiInstructionsController.update);
router.patch("/admin/ai-instructions/:id/toggle", aiInstructionsController.toggle);
router.post("/admin/ai-instructions/:id/sync", aiInstructionsController.resyncOne);
router.delete("/admin/ai-instructions/:id", aiInstructionsController.remove);

module.exports = router;
