/**
 * Categories module routes (admin).
 */

const express = require("express");
const router = express.Router();

const categoriesController = require("./categoriesController");

router.get("/admin/categories", categoriesController.listCategories);
router.post("/admin/categories", categoriesController.createCategory);
router.put("/admin/categories/:id", categoriesController.updateCategory);
router.delete("/admin/categories/:id", categoriesController.deleteCategory);

module.exports = router;
