/**
 * Analytics module routes (admin): commercial dashboard, overview, time series, funnel,
 * product rankings, product analytics, cancellations report, and AI insights.
 */

const express = require("express");
const router = express.Router();

const analyticsController = require("./analyticsController");
const procurementController = require("../finance/procurement/procurementController");

router.get("/admin/analytics/dashboard", analyticsController.getCommercialDashboard);
router.get("/admin/analytics/overview", analyticsController.getStoreOverview);
router.get("/admin/analytics/timeseries", analyticsController.getTimeSeries);
router.get("/admin/analytics/funnel", analyticsController.getFunnel);
router.get("/admin/analytics/rankings", analyticsController.getProductRankings);
router.get("/admin/analytics/products/:productId", analyticsController.getProductAnalytics);
router.get("/admin/analytics/customers/cancellations", analyticsController.getCustomerCancellations);
router.get("/admin/analytics/marketing-signals", analyticsController.getMarketingSignals);
router.get("/admin/analytics/relationships/affinity", analyticsController.getProductAffinity);
router.get("/admin/analytics/relationships/elasticity", analyticsController.getPriceElasticity);
router.get("/admin/analytics/relationships/friction", analyticsController.getDropOffFriction);
router.get("/admin/analytics/insights/latest", analyticsController.getSavedInsights);
router.get("/admin/analytics/operational-rates", analyticsController.getOperationalRates);
router.post("/admin/analytics/insights", analyticsController.generateInsights);
router.post("/admin/analytics/insights/generate", analyticsController.generateInsights);

// Commercial Inventory Alerts & WhatsApp Procurement Reorders
router.get("/admin/analytics/critical-products", procurementController.getCriticalProducts);
router.post("/admin/analytics/reorders/propose", procurementController.generateReorderProposal);
router.post("/admin/analytics/reorders/dispatch", procurementController.dispatchReorder);
router.get("/admin/analytics/reorders", procurementController.listReorders);

module.exports = router;

