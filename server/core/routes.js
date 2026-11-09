/**
 * Central API router — mounts every feature module under /api.
 *
 * Each module owns its routes (modules/<feature>/routes.js, exposed through its index.js).
 * To add a feature: create modules/<feature>/, export `{ routes }` from its index.js,
 * and add it to MODULE_ROUTERS below. Admin-only endpoints (paths under /admin) are
 * protected once, here, so modules do not need to repeat the guard.
 */

const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../modules/auth/authMiddleware");

// Modules exposing public (storefront) and/or admin routes with absolute `/store-*`, `/auth`, `/admin/*` paths.
const MODULE_ROUTERS = [
  require("../modules/settings").routes,
  require("../modules/storefront").routes,
  require("../modules/search").routes,
  require("../modules/chat").routes,
  require("../modules/recommendation").routes,
  require("../modules/offers").routes,
  require("../modules/orders").routes,
  require("../modules/auth").routes,
  require("../modules/analytics").routes,
  require("../modules/products").routes,
  require("../modules/categories").routes,
  require("../modules/coupons").routes,
  require("../modules/excel").routes,
  require("../modules/upload").routes,
  require("../modules/theme").routes,
  require("../modules/facebook").routes,
  require("../modules/ai-instructions").routes,
  require("../modules/product-requests").routes,
  require("../modules/returns").routes,
  require("../modules/finance").financeRoutes,
  require("../modules/carts").routes,
  require("../modules/notifications").routes,
  require("../modules/market-intel").routes,
  require("../modules/branches").routes,
  require("../modules/audit/routes"),
  require("../modules/matrix-templates").routes,
  require("../modules/optics").routes,
  require("../modules/labs").routes,
  require("../modules/copilot").routes,
  require("../modules/sync/syncRoutes")
];

// Every /api/admin/* request must come from an authenticated admin.
router.use("/admin", protect, adminOnly);

MODULE_ROUTERS.forEach((moduleRouter) => router.use(moduleRouter));

module.exports = router;
