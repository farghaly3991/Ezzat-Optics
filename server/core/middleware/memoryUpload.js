/**
 * Shared in-memory multipart upload handler (15 MB limit).
 * Used by routes that receive audio / Excel files and process them in memory.
 */

const multer = require("multer");

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

module.exports = { memoryUpload };
