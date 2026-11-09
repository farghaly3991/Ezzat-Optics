/**
 * Upload module routes (admin): image/file upload.
 */

const express = require("express");
const router = express.Router();

const uploadController = require("./uploadController");

router.post("/admin/upload", uploadController.uploadFile);

module.exports = router;
