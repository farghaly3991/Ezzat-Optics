/**
 * Products module routes (admin): CRUD, filtering, bulk create, AI intake (voice / text / image).
 * Route order matters: static segments (groups, filter, bulk, ai-*) must stay before `/:id`.
 */

const express = require("express");
const router = express.Router();

const { memoryUpload } = require("../../core/middleware/memoryUpload");
const productsController = require("./productsController");
const productIntakeAi = require("./productIntakeAi");
const storefrontController = require("../storefront/storefrontController");

router.get("/admin/products", productsController.listProducts);
router.get("/admin/products/groups", productsController.listProductGroups);
router.post("/admin/products/filter", (req, res, next) => {
  req.body = { ...(req.body || {}), includeInactive: req.body?.includeInactive !== false };
  return storefrontController.filterProducts(req, res, next);
});
router.post("/admin/products/bulk", productsController.bulkCreateProducts);
router.post("/admin/products/bulk-delete", productsController.bulkDeleteProducts);
router.get("/admin/products/:id/ledger", productsController.getProductLedger);
router.post("/admin/products/ai-voice", memoryUpload.single("audio"), productIntakeAi.handleVoiceProductIntake);
router.post("/admin/products/ai-extract", productIntakeAi.handleTextProductIntake);
router.post("/admin/products/ai-document", memoryUpload.single("file"), productIntakeAi.handleDocumentProductIntake);
router.get("/admin/products/ai-category-prompt/:categoryId", productIntakeAi.handleCategoryPromptGet);
router.post("/admin/products/ai-image", productIntakeAi.handleProductImageAi);
router.post("/admin/products/ai-image-upload", productIntakeAi.handleUploadAiImageToStorage);
router.get("/admin/products/lookup/:code", productsController.lookupProductByCode);
router.get("/admin/products/group-variants/:groupCode", productsController.getGroupVariants);
router.post("/admin/products/multi-variant", productsController.saveMultiVariantProduct);
router.post("/admin/products/stocktaking", productsController.performStocktaking);
router.post("/admin/products/:id/transfer-stock", productsController.transferWarehouseStock);
router.post("/admin/products/:id/scrap", productsController.recordProductScrap);
router.get("/admin/products/:id", productsController.getProduct);
router.post("/admin/products", productsController.createProduct);
router.put("/admin/products/:id", productsController.updateProduct);
router.delete("/admin/products/:id", productsController.deleteProduct);

module.exports = router;
