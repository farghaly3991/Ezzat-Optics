const axios = require("axios");
const path = require("path");
const fs = require("fs");

/**
 * Normalizes and extracts Buffer and MIME type from various audio sources:
 * - Direct Buffer
 * - Base64 Data URLs (data:audio/webm;base64,..., data:audio/mp3;base64,...)
 * - Local filesystem path
 * - Remote HTTP / HTTPS URL
 *
 * Returns: { buffer: Buffer, mimeType: string, filename: string, size: number } or null
 */
async function loadAudioAsBuffer(source, options = {}) {
  if (!source) return null;

  const defaultMime = options.mimeType || "audio/webm";

  // 1. If already a Buffer
  if (Buffer.isBuffer(source)) {
    return {
      buffer: source,
      mimeType: defaultMime,
      filename: options.filename || `recording-${Date.now()}.webm`,
      size: source.length
    };
  }

  if (typeof source !== "string") return null;
  const cleanSource = source.trim();

  try {
    // 2. Base64 Data URI
    if (cleanSource.startsWith("data:audio/")) {
      const match = cleanSource.match(/^data:(audio\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        const ext = mimeType.split("/")[1]?.replace(/[^a-zA-Z0-9]/g, "") || "webm";
        return {
          buffer,
          mimeType,
          filename: `inline-audio-${Date.now()}.${ext}`,
          size: buffer.length
        };
      }
    }

    // 3. Local filesystem path
    if (fs.existsSync(cleanSource)) {
      const ext = path.extname(cleanSource).toLowerCase().replace(".", "");
      const mimeMap = {
        webm: "audio/webm",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
        aac: "audio/aac",
        flac: "audio/flac"
      };
      const mimeType = mimeMap[ext] || defaultMime;
      const buffer = fs.readFileSync(cleanSource);
      return {
        buffer,
        mimeType,
        filename: path.basename(cleanSource),
        size: buffer.length
      };
    }

    // 4. Remote HTTP / HTTPS URL
    if (cleanSource.startsWith("http://") || cleanSource.startsWith("https://")) {
      const resp = await axios.get(cleanSource, {
        responseType: "arraybuffer",
        timeout: 25000,
        headers: { "User-Agent": "MultiTenantStore-AudioEngine/1.0" }
      });
      const mimeType = (resp.headers["content-type"] || defaultMime).split(";")[0].trim();
      const buffer = Buffer.from(resp.data);
      const urlExt = path.extname(cleanSource.split("?")[0]) || ".webm";
      return {
        buffer,
        mimeType,
        filename: `remote-audio-${Date.now()}${urlExt}`,
        size: buffer.length
      };
    }
  } catch (err) {
    console.warn(`[AUDIO_ASSET_LOAD_WARN] Failed to load audio source "${cleanSource.slice(0, 80)}":`, err.message);
  }

  return null;
}

module.exports = {
  loadAudioAsBuffer
};
