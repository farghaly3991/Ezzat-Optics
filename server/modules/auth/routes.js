/**
 * Auth module routes — login/register/session + admin customer list.
 */

const express = require("express");
const router = express.Router();

const authController = require("./authController");
const { protect } = require("./authMiddleware");

// Public / customer session
router.post("/auth/login", authController.login);
router.post("/auth/register", authController.register);
router.get("/auth/me", protect, authController.getMe);
router.post("/auth/wishlist/toggle", protect, authController.toggleWishlist);

// Admin: customers management
router.get("/admin/customers", authController.listCustomers);
router.get("/admin/customers/:id/profile", authController.getCustomerProfile);
router.post("/admin/customers", authController.createCustomer);
router.put("/admin/customers/:id", authController.updateCustomer);
router.post("/admin/customers/:id/prescriptions", authController.addCustomerPrescription);
router.get("/admin/customers/:id/custom-profiles", authController.listCustomerCustomProfiles);
router.post("/admin/customers/:id/custom-profiles", authController.createCustomerCustomProfile);
router.delete("/admin/customers/:id/custom-profiles/:profileId", authController.deleteCustomerCustomProfile);
router.put("/admin/customers/:id/password", authController.updateCustomerPassword);
router.delete("/admin/customers/:id", authController.deleteCustomer);
router.post("/admin/customers/bulk-delete", authController.bulkDeleteCustomers);

module.exports = router;
