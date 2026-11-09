/**
 * Storefront module routes (public): home sections, categories, product filtering/details,
 * client activity tracking, reviews, and product comparison.
 */

const express = require("express");
const router = express.Router();

const { optionalAuth } = require("../auth/authMiddleware");
const storefrontController = require("./storefrontController");

router.get("/store-public/home", storefrontController.getHomeSections);
router.get("/store-public/categories", storefrontController.getPublicCategories);
router.post("/store-public/filter", storefrontController.filterProducts);
router.get("/store-public/product/:id", optionalAuth, storefrontController.getProductDetails);
router.post("/store-public/activity", optionalAuth, storefrontController.recordClientActivity);
router.post("/store-public/price-feedback/toggle", optionalAuth, storefrontController.togglePriceFeedback);
router.post("/store-public/review/:id", optionalAuth, storefrontController.addReview);
router.get("/store-public/compare", storefrontController.compareProducts);

module.exports = router;
