const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../auth/authMiddleware");
const productRequestsController = require("./productRequestsController");

// ==========================================
// STOREFRONT PUBLIC ROUTES
// ==========================================
router.post(
  "/store-public/waitlist/join",
  optionalAuth,
  productRequestsController.joinWaitlist
);

router.get(
  "/store-public/waitlist/status/:productId",
  optionalAuth,
  productRequestsController.checkWaitlistStatus
);

router.post(
  "/store-public/desired-products/plan-and-save",
  optionalAuth,
  productRequestsController.planAndSaveDesiredProduct
);

router.get(
  "/store-public/notifications",
  optionalAuth,
  productRequestsController.getStorefrontNotifications
);

router.post(
  "/store-public/notifications/mark-read/:id",
  optionalAuth,
  productRequestsController.markNotificationRead
);

router.post(
  "/store-public/notifications/mark-read-all",
  optionalAuth,
  (req, res, next) => {
    req.body = req.body || {};
    req.body.markAll = true;
    return productRequestsController.markNotificationRead(req, res, next);
  }
);

// ==========================================
// ADMIN DASHBOARD ROUTES
// (Guarded by /admin in core/routes.js)
// ==========================================
router.get(
  "/admin/product-requests/whatsapp-status",
  productRequestsController.getWhatsAppStatus
);

router.get(
  "/admin/product-requests/waitlists/summary",
  productRequestsController.getProductWaitlistSummary
);

router.get(
  "/admin/product-requests/waitlists/:productId",
  productRequestsController.getProductWaitlist
);

router.post(
  "/admin/product-requests/waitlists/:productId/notify",
  productRequestsController.notifyProductWaitlist
);

router.get(
  "/admin/product-requests/desired-products",
  productRequestsController.getDesiredProducts
);

router.post(
  "/admin/product-requests/desired-products/match/:productId",
  productRequestsController.matchProductRequests
);

router.post(
  "/admin/product-requests/desired-products/match-custom",
  productRequestsController.matchProductRequests
);

router.post(
  "/admin/product-requests/desired-products/:requestId/notify",
  productRequestsController.notifyDesiredProductRequest
);

router.post(
  "/admin/product-requests/desired-products/:requestId/convert",
  productRequestsController.convertDesiredProductToService
);

router.delete(
  "/admin/product-requests/desired-products/:requestId",
  productRequestsController.deleteDesiredProduct
);

module.exports = router;
