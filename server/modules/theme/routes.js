/**
 * Theme module routes (admin): AI theme generation (twin-engine) and presets.
 */

const express = require("express");
const router = express.Router();

const { aiDispatcher } = require("../../core/middleware/aiDispatcher");
const aiTheme = require("./aiTheme");
const standardTheme = require("./standardTheme");

router.post("/admin/theme/generate", aiDispatcher(aiTheme.generateTheme, standardTheme.generateTheme));
router.get("/admin/theme/presets", standardTheme.getPresets);

module.exports = router;
