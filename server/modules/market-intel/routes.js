const express = require("express");
const router = express.Router();
const marketIntelController = require("./marketIntelController");

// Protected by /admin middleware in core/routes.js
router.get("/admin/market-intel/compare/:productId", marketIntelController.compareProduct);
router.post("/admin/market-intel/apply-price/:productId", marketIntelController.applyRecommendedPrice);

module.exports = router;
