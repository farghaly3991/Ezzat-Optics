const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { uploadBufferToStorage } = require("../upload/uploadController");

/**
 * Loads an image asset from a variety of sources:
 * - Data URLs: data:image/png;base64,...
 * - Local filesystem paths: /uploads/..., uploads/..., or absolute paths
 * - Remote HTTP / HTTPS URLs
 *
 * Returns: { buffer: Buffer, mimeType: string, filename: string, size: number } or null
 */
async function loadAssetAsBuffer(source) {
  if (!source || typeof source !== "string") return null;
  const cleanSource = source.trim();

  try {
    // 1. Base64 Data URI
    if (cleanSource.startsWith("data:image/")) {
      const match = cleanSource.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        const ext = mimeType.split("/")[1] || "png";
        return {
          buffer,
          mimeType,
          filename: `inline-asset-${Date.now()}.${ext}`,
          size: buffer.length
        };
      }
    }

    // 2. Local uploads directory or local path
    if (cleanSource.startsWith("/uploads/") || cleanSource.startsWith("uploads/")) {
      const relPath = cleanSource.replace(/^\/+/, "");
      // Check relative to server root
      const candidates = [
        ...(process.env.UPLOADS_DIR ? [path.join(process.env.UPLOADS_DIR, relPath.replace(/^uploads[\\/]/, ""))] : []),
        path.join(__dirname, "../..", relPath),
        path.join(__dirname, "../../..", relPath),
        path.resolve(cleanSource)
      ];

      for (const localPath of candidates) {
        if (fs.existsSync(localPath)) {
          const ext = path.extname(localPath).toLowerCase();
          const mimeType =
            ext === ".png"
              ? "image/png"
              : ext === ".webp"
              ? "image/webp"
              : ext === ".gif"
              ? "image/gif"
              : "image/jpeg";
          const buffer = fs.readFileSync(localPath);
          return {
            buffer,
            mimeType,
            filename: path.basename(localPath),
            size: buffer.length
          };
        }
      }
    }

    // 3. Absolute local path
    if (path.isAbsolute(cleanSource) && fs.existsSync(cleanSource)) {
      const ext = path.extname(cleanSource).toLowerCase();
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";
      const buffer = fs.readFileSync(cleanSource);
      return {
        buffer,
        mimeType,
        filename: path.basename(cleanSource),
        size: buffer.length
      };
    }

    // 4. Remote HTTP/HTTPS URL
    if (cleanSource.startsWith("http://") || cleanSource.startsWith("https://")) {
      const resp = await axios.get(cleanSource, {
        responseType: "arraybuffer",
        timeout: 20000,
        headers: {
          "User-Agent": "MultiTenantStore-VisualEngine/1.0"
        }
      });
      const mimeType = (resp.headers["content-type"] || "image/jpeg").split(";")[0].trim();
      const buffer = Buffer.from(resp.data);
      const urlExt = path.extname(cleanSource.split("?")[0]) || ".jpg";
      return {
        buffer,
        mimeType,
        filename: `remote-asset-${Date.now()}${urlExt}`,
        size: buffer.length
      };
    }
  } catch (err) {
    console.warn(`[VISUAL_ASSET_LOAD_WARN] Failed to load asset "${cleanSource.slice(0, 80)}":`, err.message);
  }

  return null;
}

/**
 * Saves a visual asset Buffer to persistent cloud/disk storage using uploadBufferToStorage.
 * Returns the public URL string.
 */
async function saveVisualAsset(buffer, mimeType = "image/png", filename = "asset.png", req = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Invalid buffer provided to saveVisualAsset");
  }
  return await uploadBufferToStorage(buffer, mimeType, filename, req);
}

module.exports = {
  loadAssetAsBuffer,
  saveVisualAsset
};
