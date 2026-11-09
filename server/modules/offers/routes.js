/**
 * Offers module routes — admin management + public active offers.
 */

const express = require("express");
const router = express.Router();

const offersController = require("./offersController");

// Public storefront
router.get("/store-public/offers", offersController.getActiveOffers);

// Admin
router.get("/admin/offers", offersController.listOffers);
router.post("/admin/offers", offersController.createOffer);
router.put("/admin/offers/:id", offersController.updateOffer);
router.delete("/admin/offers/:id", offersController.deleteOffer);

module.exports = router;
