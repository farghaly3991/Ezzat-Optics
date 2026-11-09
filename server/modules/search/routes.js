/**
 * Search module routes (public): semantic product search (twin-engine AI / standard).
 */

const express = require("express");
const router = express.Router();

const { aiDispatcher } = require("../../core/middleware/aiDispatcher");
const { memoryUpload } = require("../../core/middleware/memoryUpload");
const aiSearch = require("./aiSearch");
const standardSearch = require("./standardSearch");
const visualEngine = require("../visual-engine");
const audioEngine = require("../audio-engine");

router.get("/store-public/search", aiDispatcher(aiSearch.searchProducts, standardSearch.searchProducts));

/**
 * Visual Multimodal Search (Search Catalog by Product Photo or Image URL)
 */
router.post("/store-public/search/visual", memoryUpload.single("image"), async (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    const mimeType = req.file?.mimetype || "image/jpeg";
    const imageUrl = req.body?.imageUrl || "";

    if (!fileBuffer && !imageUrl) {
      return res.status(400).json({ done: false, error: "يرجى رفع صورة أو توفير رابط صورة للبحث" });
    }

    const result = await visualEngine.searchCatalogByImage(req.subdomain, {
      imageBuffer: fileBuffer,
      mimeType,
      imageUrl,
      limit: Number(req.query.limit) || 8,
      adminData: req.adminData || {}
    });

    res.json({ done: true, ...result });
  } catch (err) {
    console.error("[VISUAL_SEARCH_ERR]", err.message);
    res.status(500).json({ done: false, error: err.message || "فشل البحث الدلالي بالصورة" });
  }
});

/**
 * Voice Search (Search Catalog by Voice Audio or Audio Recording)
 */
router.post("/store-public/search/voice", memoryUpload.single("audio"), async (req, res) => {
  try {
    const audioBuffer = req.file?.buffer;
    const mimeType = req.file?.mimetype || "audio/webm";
    const audioData = req.body?.audio || "";

    if (!audioBuffer && !audioData) {
      return res.status(400).json({ done: false, error: "يرجى تسجيل أو رفع مقطع صوتي للبحث" });
    }

    const result = await audioEngine.searchCatalogByVoice(req.subdomain, {
      audioSource: audioBuffer || audioData,
      mimeType,
      limit: Number(req.query.limit) || 8,
      adminData: req.adminData || {}
    });

    res.json({ done: true, ...result });
  } catch (err) {
    console.error("[VOICE_SEARCH_ERR]", err.message);
    res.status(500).json({ done: false, error: err.message || "فشل البحث الدلالي بالصوت" });
  }
});

/**
 * Universal Voice-to-Text Transcription (Gemini Multimodal Audio Primary)
 * Used across Storefront Search, POS, Lens Matrix Voice Entry, Copilot, and AI Intake.
 */
router.post("/store-public/voice/transcribe", memoryUpload.single("audio"), async (req, res) => {
  try {
    let audioBuffer = req.file?.buffer;
    const mimeType = req.file?.mimetype || req.body?.mimeType || "audio/webm";
    const audioData = req.body?.audio || req.body?.audioData || "";

    if (!audioBuffer && audioData) {
      const base64Clean = String(audioData).replace(/^data:audio\/[a-zA-Z0-9+-]+;base64,/, "");
      audioBuffer = Buffer.from(base64Clean, "base64");
    }

    if (!audioBuffer || audioBuffer.length < 100) {
      return res.status(400).json({ done: false, error: "التسجيل الصوتي قصير جداً أو فارغ" });
    }

    const contextHint = String(req.body?.contextHint || "").trim();
    let customPrompt = undefined;
    if (contextHint === "matrix") {
      customPrompt =
        'أنت نظام ذكي لتحويل الأوامر الصوتية الخاصة بجرد وتعبئة مصفوفة المقاسات والعدسات (SPH و CYL) إلى نص عربي دقيق. اكتب الجملة المنطوقة والأرقام والدرجات (مثل سالب 2، نص، ربع، سلندر، سفير، ما عدا) تماماً كما نُطقت بدون أي شرح أو علامات تنصيص. إذا كان التسجيل صامتاً فاكتب "صوت غير واضح".';
    } else if (contextHint === "pos" || contextHint === "search") {
      customPrompt =
        'أنت نظام ذكي لتحويل البحث الصوتي في متجر بصريات وتجارة إلكترونية في مصر إلى نص دقيق. استمع للتسجيل واكتب اسم المنتج أو الماركة أو المقاس أو الوصف المنطوق بالعامية المصرية أو العربية أو الإنجليزية تماماً كما نُطق بدون أي إضافات أو علامات تنصيص. إذا كان التسجيل صامتاً فاكتب "صوت غير واضح".';
    }

    const text = await audioEngine.transcribeAudio(audioBuffer, mimeType, {
      adminData: req.adminData || {},
      prompt: customPrompt
    });

    res.json({
      done: true,
      text: (text || "").trim(),
      provider: "gemini_audio"
    });
  } catch (err) {
    console.warn("[VOICE_TRANSCRIBE_ERR]:", err.message);
    res.status(500).json({
      done: false,
      error: err.message || "تعذر التعرف على الصوت عبر Gemini"
    });
  }
});

module.exports = router;
