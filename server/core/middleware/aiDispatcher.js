const visualEngine = require("../../modules/visual-engine");
const audioEngine = require("../../modules/audio-engine");

/**
 * AI Dispatcher Middleware
 * Checks:
 * 1. req.adminData.aiEnabled (Dashboard toggle set by admin)
 * 2. Active AI credentials (AI_API_KEY / aiApiKey)
 * Dispatches cleanly to AI handler if both conditions met, otherwise standard handler.
 */
exports.checkAiAvailable = (req) => {
  const adminData = req.adminData || {};
  const isEnabled = adminData.aiEnabled !== false; // Default true if not explicitly disabled
  const apiKey = (
    adminData.AI_API_KEY ||
    adminData.aiApiKey ||
    process.env.AI_API_KEY ||
    adminData.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
  return Boolean(isEnabled && apiKey.length > 0);
};

exports.checkImageAiAvailable = (req) => {
  const adminData = req.adminData || {};
  const isEnabled = adminData.imageAiEnabled !== false;
  if (!isEnabled) return false;
  const creds = visualEngine.getVisualCredentials(adminData);
  return Boolean(creds.isImageAiReady || creds.hasGemini);
};

exports.checkAudioAiAvailable = (req) => {
  const adminData = req.adminData || {};
  const isEnabled = adminData.aiEnabled !== false;
  if (!isEnabled) return false;
  const creds = audioEngine.getAudioCredentials(adminData);
  return Boolean(creds.isAudioReady);
};

exports.checkFacebookAvailable = (req) => {
  const adminData = req.adminData || {};
  const isEnabled = adminData.facebookEnabled !== false;
  const pageId = (adminData.FB_PAGE_ID || process.env.FB_PAGE_ID || "").trim();
  const accessToken = (adminData.FB_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || "").trim();
  return Boolean(isEnabled && pageId.length > 2 && accessToken.length > 10);
};

exports.aiDispatcher = (aiHandler, standardHandler) => {
  return async (req, res, next) => {
    try {
      const isAi = exports.checkAiAvailable(req);
      req.isAiAvailable = isAi;
      console.log(`[AI_DISPATCHER] Path: ${req.originalUrl} | AI Enabled & Configured: ${isAi}`);

      if (isAi && typeof aiHandler === "function") {
        return await aiHandler(req, res, next);
      } else if (typeof standardHandler === "function") {
        return await standardHandler(req, res, next);
      } else {
        return res.status(500).json({ error: "No suitable handler found for this request" });
      }
    } catch (err) {
      console.error("[AI_DISPATCHER_ERROR]", err);
      // If AI execution throws, fallback to standard gracefully!
      if (typeof standardHandler === "function") {
        console.warn("[AI_DISPATCHER] Falling back to standard handler after AI error...");
        return await standardHandler(req, res, next);
      }
      next(err);
    }
  };
};
