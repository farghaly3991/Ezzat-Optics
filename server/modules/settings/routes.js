/**
 * Settings module routes — public store config + admin settings & AI schema sync.
 */

const express = require("express");
const router = express.Router();

const settingsController = require("./settingsController");

// Public storefront
router.get("/store-public/config", settingsController.getPublicConfig);

// Admin
router.get("/admin/settings", settingsController.getAdminSettings);
router.put("/admin/settings", settingsController.updateAdminSettings);
router.post("/admin/ai/sync-schema", settingsController.syncAiSchema);
router.post("/admin/settings/ai-configure", settingsController.aiConfigureSettings);

module.exports = router;
