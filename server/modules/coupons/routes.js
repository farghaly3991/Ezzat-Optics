/**
 * Coupons module routes (admin).
 * Public coupon validation lives with checkout in the orders module.
 */

const express = require("express");
const router = express.Router();

const couponsController = require("./couponsController");

router.get("/admin/coupons", couponsController.listCoupons);
router.post("/admin/coupons", couponsController.createCoupon);
router.put("/admin/coupons/:id", couponsController.updateCoupon);
router.delete("/admin/coupons/:id", couponsController.deleteCoupon);

module.exports = router;
