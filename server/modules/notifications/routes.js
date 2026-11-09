const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../auth/authMiddleware");
const notificationController = require("./notificationController");

// ==========================================
// STOREFRONT PUBLIC ROUTES
// ==========================================
router.get(
  "/store-public/notifications",
  optionalAuth,
  notificationController.getNotifications
);

router.post(
  "/store-public/notifications/mark-read/:id",
  optionalAuth,
  notificationController.markAsRead
);

router.post(
  "/store-public/notifications/mark-read-all",
  optionalAuth,
  (req, res, next) => {
    req.body = req.body || {};
    req.body.markAll = true;
    return notificationController.markAsRead(req, res, next);
  }
);

router.post(
  "/store-public/notifications/subscribe-push",
  optionalAuth,
  notificationController.subscribePush
);

// Standard aliases
router.get(
  "/notifications",
  optionalAuth,
  notificationController.getNotifications
);

router.post(
  "/notifications/subscribe-push",
  optionalAuth,
  notificationController.subscribePush
);

// ==========================================
// ADMIN DASHBOARD ROUTES
// (Protected by /admin router middleware in core/routes.js)
// ==========================================
router.get(
  "/admin/notifications/settings-status",
  notificationController.getSettingsStatus
);

router.post(
  "/admin/notifications/test",
  notificationController.sendTestNotification
);

module.exports = router;
