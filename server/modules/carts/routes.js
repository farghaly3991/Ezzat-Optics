const express = require("express");
const router = express.Router();
const cartController = require("./cartController");

// Public storefront cart sync
router.post("/store-public/cart/sync", cartController.syncCart);

// Admin cart management & recovery endpoints (protected by /admin in core/routes.js)
router.get("/admin/carts/inactive", cartController.getInactiveCarts);
router.post("/admin/carts/recovery/send", cartController.sendRecoveryNotification);
router.post("/admin/carts/recovery/bulk-send", cartController.bulkSendRecovery);

module.exports = router;
