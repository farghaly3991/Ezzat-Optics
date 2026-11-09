/**
 * Finance Module — Express Router (Public & Admin Endpoints for Phases A–F)
 */

const express = require("express");
const router = express.Router();

const { optionalAuth } = require("../auth/authMiddleware");
const {
  requireAdminFinance,
  requireImplementedModule
} = require("./core/permissions/financePermissions");
const shippingController = require("./shipping/shippingController");
const shippingCourierController = require("./shipping/shippingCourierController");
const procurementController = require("./procurement/procurementController");
const supplyWaterfallController = require("./procurement/supplyWaterfallController");
const inventoryController = require("./inventory/inventoryController");
const expensesController = require("./expenses/expensesController");
const partnerController = require("./partners/partnerController");
const reportsController = require("./reports/reportsController");
const accountingController = require("./accounting/accountingController");
const currencyController = require("./currency/currencyController");

// ============================================================================
// 1. Public Storefront Shipping & Address Classification Routes (Phase A)
// ============================================================================
router.get("/store-public/shipping/options", optionalAuth, shippingController.getPublicShippingOptions);
router.post("/store-public/shipping/classify-address", optionalAuth, shippingController.classifyAddressPublic);
router.post("/store-public/shipping/preview", optionalAuth, shippingController.previewCheckoutShippingPublic);

// ============================================================================
// Public Supplier Portal (Tokenized Magic Link from WhatsApp)
// ============================================================================
router.get("/procurement-public/supply-request/:token", supplyWaterfallController.getSupplyRequestByToken);
router.post("/procurement-public/supply-request/:token/respond", supplyWaterfallController.respondSupplyRequest);
router.get("/procurement-public/whatsapp/:reorderCode", supplyWaterfallController.redirectToReorderWhatsApp);

// ============================================================================
// 2. Admin Finance Routes (Protected by protect + adminOnly)
// ============================================================================
router.use("/admin/finance", requireAdminFinance);

// Finance Capability Settings & Audit Log
router.get("/admin/finance/settings", shippingController.getAdminFinanceSettings);
router.put("/admin/finance/settings", shippingController.updateAdminFinanceSettings);
router.get("/admin/finance/audit", procurementController.listFinanceAudit);

// Phase A: Shipping Classes, Simulator, Post-Order Actual Carrier Cost & Pickup Completion
router.get("/admin/finance/shipping-classes", shippingController.listAdminShippingClasses);
router.post("/admin/finance/shipping-classes", shippingController.createAdminShippingClass);
router.put("/admin/finance/shipping-classes/:id", shippingController.updateAdminShippingClass);
router.patch("/admin/finance/shipping-classes/:id/toggle", shippingController.toggleAdminShippingClass);
router.patch("/admin/finance/shipping-classes/:id/toggle-status", shippingController.toggleAdminShippingClass);
router.put("/admin/finance/shipping-classes/:id/toggle", shippingController.toggleAdminShippingClass);
router.put("/admin/finance/shipping-classes/:id/toggle-status", shippingController.toggleAdminShippingClass);
router.delete("/admin/finance/shipping-classes/:id", shippingController.deleteAdminShippingClass);
router.post("/admin/finance/shipping/preview", shippingController.previewAdminShippingCalculation);
router.post("/admin/finance/orders/:orderId/actual-shipping-cost", shippingController.recordAdminOrderActualShippingCost);
router.post("/admin/finance/orders/:orderId/assign-courier", shippingCourierController.assignOrderCourier);
router.post("/admin/finance/orders/:orderId/complete-pickup", shippingController.completeAdminOrderPickup);
router.post("/admin/finance/orders/:orderId/settle-payment", expensesController.recordOrderSettlement);

// Shipping Couriers Directory (Internal Staff & External Carriers)
router.get("/admin/finance/couriers", shippingCourierController.listCouriers);
router.post("/admin/finance/couriers", shippingCourierController.createCourier);
router.put("/admin/finance/couriers/:id", shippingCourierController.updateCourier);
router.delete("/admin/finance/couriers/:id", shippingCourierController.deleteCourier);

// Phase B: Suppliers, Supplier Shipments, Purchase Lines, Payments, Reversals & Alerts
router.get("/admin/finance/procurement/overview", procurementController.getProcurementOverview);
router.get("/admin/finance/suppliers", procurementController.listSuppliers);
router.post("/admin/finance/suppliers", procurementController.createSupplier);
router.get("/admin/finance/suppliers/:id", procurementController.getSupplierDetails);
router.put("/admin/finance/suppliers/:id", procurementController.updateSupplier);
router.delete("/admin/finance/suppliers/:id", procurementController.deleteSupplier);

// Critical Stock & Supplier WhatsApp Reorders
router.get("/admin/finance/procurement/critical-products", procurementController.getCriticalProducts);
router.get("/admin/finance/procurement/grid-critical-stock", procurementController.getGridCriticalProducts);
router.get("/admin/finance/procurement/fast-selling-forecast", procurementController.getFastSellingForecast);
router.post("/admin/finance/procurement/reorders/propose", procurementController.generateReorderProposal);
router.post("/admin/finance/procurement/reorders/dispatch", procurementController.dispatchReorder);
router.get("/admin/finance/procurement/reorders", procurementController.listReorders);
router.patch("/admin/finance/procurement/reorders/:id/status", procurementController.updateReorderStatus);
router.put("/admin/finance/procurement/reorders/:id/status", procurementController.updateReorderStatus);

// Multi-Supplier Waterfall Procurement Routes
router.post("/admin/finance/procurement/waterfall/create", supplyWaterfallController.createWaterfallRequest);
router.get("/admin/finance/procurement/waterfall/requests", supplyWaterfallController.listWaterfallRequests);
router.get("/admin/finance/procurement/waterfall/stats", supplyWaterfallController.getSupplierPerformanceStats);
router.get("/admin/finance/shipments", procurementController.listShipments);
router.post("/admin/finance/shipments", procurementController.createShipment);
router.get("/admin/finance/shipments/:id", procurementController.getShipmentDetails);
router.put("/admin/finance/shipments/:id", procurementController.updateShipment);
router.post("/admin/finance/shipments/:id/lines", procurementController.associateShipmentProducts);
router.post("/admin/finance/shipments/:id/products", procurementController.associateShipmentProducts);
router.delete("/admin/finance/shipments/:id/lines/:lineId", procurementController.removeShipmentLine);
router.delete("/admin/finance/shipments/:id/products/:lineId", procurementController.removeShipmentLine);
router.post("/admin/finance/shipments/:id/payments", procurementController.recordPayment);
router.post("/admin/finance/shipments/:id/payments/:paymentId/reverse", procurementController.reversePayment);
router.post("/admin/finance/shipments/:id/payments/:paymentId/correct", procurementController.correctPayment);

// Phase C: Inventory Movements, Receiving, Returns, Damaged Stock, Manual Adjustments & Valuation (Min Level: Advanced)
router.use("/admin/finance/inventory", requireImplementedModule("inventory", { minLevel: "advanced" }));
router.get("/admin/finance/inventory/valuation", inventoryController.getInventoryValuation);
router.get("/admin/finance/inventory/summary", inventoryController.getInventoryValuation);
router.get("/admin/finance/inventory/movements", inventoryController.listMovements);
router.post("/admin/finance/inventory/receive/:shipmentId", inventoryController.receiveShipment);
router.post("/admin/finance/inventory/receive", inventoryController.receiveShipment);
router.post("/admin/finance/inventory/adjust", inventoryController.recordManualAdjustment);
router.post("/admin/finance/inventory/damaged", inventoryController.recordDamagedStock);
router.post("/admin/finance/inventory/returns", inventoryController.recordReturnMovement);
router.post("/admin/finance/inventory/reservations", inventoryController.updateReservation);

// Phase D: Expenses, Recurring Expenses & Manual/Offline Sales (Min Level: Advanced)
router.use("/admin/finance/expenses", requireImplementedModule("expenses", { minLevel: "advanced" }));
router.get("/admin/finance/expenses/auto-payroll", expensesController.getAutoPayroll);
router.get("/admin/finance/expenses", expensesController.listExpenses);
router.post("/admin/finance/expenses", expensesController.createExpense);
router.get("/admin/finance/expenses/recurring-rules", expensesController.listRecurringRules);
router.post("/admin/finance/expenses/recurring-rules", expensesController.createRecurringRule);
router.put("/admin/finance/expenses/recurring-rules/:id", expensesController.updateRecurringRule);
router.post("/admin/finance/expenses/recurring-rules/generate", expensesController.generateRecurringOccurrences);
router.get("/admin/finance/expenses/manual-sales", expensesController.listManualSales);
router.post("/admin/finance/expenses/manual-sales", expensesController.createManualSale);
router.get("/admin/finance/expenses/manual-sales/:id", expensesController.getManualSale);
router.post("/admin/finance/expenses/manual-sales/:id/payments", expensesController.recordManualSalePayment);
router.post("/admin/finance/expenses/manual-sales/:id/payments/:paymentId/reverse", expensesController.reverseManualSalePayment);
router.post("/admin/finance/expenses/manual-sales/:id/payments/:paymentId/correct", expensesController.correctManualSalePayment);
router.get("/admin/finance/expenses/:id", expensesController.getExpense);
router.put("/admin/finance/expenses/:id", expensesController.updateExpense);
router.post("/admin/finance/expenses/:id/payments", expensesController.recordExpensePayment);
router.post("/admin/finance/expenses/:id/payments/:paymentId/reverse", expensesController.reverseExpensePayment);
router.post("/admin/finance/expenses/:id/payments/:paymentId/correct", expensesController.correctExpensePayment);

// Partners & Owner Withdrawals Ledger (مسحوبات وحصص الشركاء وأصحاب المحل)
router.get("/admin/finance/partners", partnerController.listPartners);
router.post("/admin/finance/partners", partnerController.createPartner);
router.put("/admin/finance/partners/:id", partnerController.updatePartner);
router.post("/admin/finance/partners/withdrawal", partnerController.recordPartnerWithdrawal);

// Phase E2 & E3: Financial Reporting (Basic Dashboard available on Basic+; Advanced Reports on Advanced+)
router.use("/admin/finance/reports", requireImplementedModule("reports", { minLevel: "basic" }));
router.get("/admin/finance/reports/basic", reportsController.getBasicDashboard);
router.get("/admin/finance/reports/advanced", reportsController.getAdvancedReport);

// Commercial Ledger & Profitability (الحسابات التجارية والإحصاءات الشاملة)
router.get("/admin/finance/commercial-ledger", reportsController.getCommercialLedger);
router.get("/admin/finance/commercial-ledger/reconcile-audit", reportsController.reconcileCommercialAudit);
router.post("/admin/finance/commercial-ledger/snapshot", reportsController.saveCommercialSnapshot);
router.get("/admin/finance/commercial-ledger/latest-snapshot", reportsController.getLatestCommercialSnapshot);
router.get("/admin/finance/commercial-ledger/snapshots", reportsController.listCommercialSnapshots);

// Phase E4: Double-Entry Accounting (Min Level: Professional)
router.use("/admin/finance/accounting", requireImplementedModule("accounting", { minLevel: "professional" }));
router.get("/admin/finance/accounting/accounts", accountingController.listAccounts);
router.post("/admin/finance/accounting/accounts", accountingController.createAccount);
router.get("/admin/finance/accounting/journal-entries", accountingController.listJournalEntries);
router.post("/admin/finance/accounting/journal-entries", accountingController.createJournalEntry);
router.post("/admin/finance/accounting/journal-entries/:id/post", accountingController.postDraftEntry);
router.post("/admin/finance/accounting/journal-entries/:id/reverse", accountingController.reverseJournalEntry);
router.post("/admin/finance/accounting/post-source-event", accountingController.postSourceEvent);
router.get("/admin/finance/accounting/trial-balance", accountingController.getTrialBalance);
router.get("/admin/finance/accounting/periods", accountingController.listPeriods);
router.post("/admin/finance/accounting/periods/close", accountingController.closePeriod);
router.post("/admin/finance/accounting/periods/reopen", accountingController.reopenPeriod);

// Phase F: Purchase Currency, Exchange Rates & Replacement Cost Recalculation (Min Level: Enterprise)
router.use("/admin/finance/currency", requireImplementedModule("currency", { minLevel: "enterprise" }));
router.get("/admin/finance/currency/rates", currencyController.listExchangeRates);
router.post("/admin/finance/currency/rates", currencyController.recordExchangeRate);
router.post("/admin/finance/currency/preview-impact", currencyController.previewCostImpact);
router.get("/admin/finance/currency/preview-impact", currencyController.previewCostImpact);
router.post("/admin/finance/currency/apply-updates", currencyController.applyApprovedUpdates);

module.exports = router;
