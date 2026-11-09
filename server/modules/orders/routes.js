/**
 * Orders module routes — admin order management + public checkout / tracking.
 */

const express = require("express");
const router = express.Router();

const { optionalAuth, protect } = require("../auth/authMiddleware");
const ordersController = require("./ordersController");
const publicOrders = require("./publicOrdersController");

// Public storefront: checkout, tracking, my orders, coupon validation
router.post("/store-orders-public/create", optionalAuth, publicOrders.createOrder);
router.get("/store-orders-public/track/:orderId", publicOrders.trackOrder);
router.get("/store-orders-public/my", protect, publicOrders.myOrders);
router.post("/store-coupons-public/validate", publicOrders.checkCoupon);

// Admin
router.get("/admin/orders", ordersController.listOrders);
router.post("/admin/orders/pos-sale", ordersController.createPosOrder);
router.get("/admin/orders/pos/customer-lookup", ordersController.lookupPosCustomer);
router.post("/admin/customers/:id/deposit", protect, ordersController.recordCustomerDeposit);
router.put("/admin/orders/:id/lab-status", protect, ordersController.updateLabOrderStatus);
router.get("/admin/orders/supplies/list", protect, ordersController.listSuppliesRequested);
router.put("/admin/orders/:orderId/supplies/status", protect, ordersController.updateSupplyItemStatus);

// Admin Installments Management (التقسيط المباشر مع المحل)
router.get("/admin/installments", protect, ordersController.getInstallmentsOverview);
router.get("/admin/installments/finance-summary", protect, ordersController.getFinanceInstallmentsSummary);
router.get("/admin/installments/contract-template", protect, ordersController.getInstallmentContractTemplate);
router.put("/admin/installments/contract-template", protect, ordersController.updateInstallmentContractTemplate);
router.get("/admin/installments/:orderId", protect, ordersController.getInstallmentDetails);
router.post("/admin/installments/:orderId/pay", protect, ordersController.recordInstallmentPayment);
router.put("/admin/installments/:orderId/status", protect, ordersController.updateInstallmentStatus);
router.post("/admin/installments/:orderId/generate-contract", protect, ordersController.generateInstallmentContract);
router.put("/admin/installments/:orderId/contract", protect, ordersController.saveInstallmentContractText);
router.post("/admin/installments/:orderId/documents", protect, ordersController.addInstallmentDocument);
router.delete("/admin/installments/:orderId/documents/:docId", protect, ordersController.removeInstallmentDocument);

router.get("/admin/orders/:id", ordersController.getOrder);
router.put("/admin/orders/:id/status", ordersController.updateOrderStatus);
router.post("/admin/orders/:orderId/expenses", protect, ordersController.addOrderExpense);
router.delete("/admin/orders/:orderId/expenses/:expenseId", protect, ordersController.deleteOrderExpense);

module.exports = router;
