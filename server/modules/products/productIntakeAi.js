/**
 * Product Intake AI Controller
 * Seamlessly delegates all multimodal catalog intake, visual inspection, and speech transcription
 * to the Unified Intake Engine, Visual Engine, and Audio Engine.
 */

const { checkAiAvailable } = require("../../core/middleware/aiDispatcher");
const intakeEngine = require("../intake-engine");
const visualEngine = require("../visual-engine");
const audioEngine = require("../audio-engine");

/**
 * Handle Voice AI Product Intake (Audio Recording -> Audio Engine -> Intake Engine)
 */
exports.handleVoiceProductIntake = async (req, res, next) => {
  try {
    if (!checkAiAvailable(req)) {
      return res.status(403).json({
        done: false,
        error: "خدمة الذكاء الاصطناعي غير مفعلة. يرجى التحقق من إعدادات الـ AI."
      });
    }

    const { categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).json({ done: false, error: "يرجى اختيار القسم أولاً قبل تسجيل الصوت" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ done: false, error: "لم يتم إرسال أي تسجيل صوتي" });
    }

    const result = await intakeEngine.processVoiceIntake({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype || "audio/webm",
      subdomain: req.subdomain,
      categoryId,
      adminData: req.adminData || {}
    });

    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    console.error("[VOICE_PRODUCT_INTAKE_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "حدث خطأ أثناء معالجة التسجيل الصوتي واستخراج المنتجات"
    });
  }
};

/**
 * Handle Text AI Product Intake (Raw text description -> Planner LLM -> Structured products)
 */
exports.handleTextProductIntake = async (req, res, next) => {
  try {
    if (!checkAiAvailable(req)) {
      return res.status(403).json({
        done: false,
        error: "خدمة الذكاء الاصطناعي غير مفعلة. يرجى التحقق من إعدادات الـ AI."
      });
    }

    const { categoryId, text } = req.body;
    if (!categoryId) {
      return res.status(400).json({ done: false, error: "يرجى اختيار القسم أولاً" });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ done: false, error: "يرجى كتابة تفاصيل المنتجات أولاً" });
    }

    const extraction = await intakeEngine.extractProductsForCategory(
      req.subdomain,
      categoryId,
      text.trim(),
      req.adminData || {}
    );

    res.json({
      done: true,
      transcribedText: text.trim(),
      ...extraction
    });
  } catch (err) {
    console.error("[TEXT_PRODUCT_INTAKE_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "حدث خطأ أثناء تحليل النص واستخراج المنتجات"
    });
  }
};

/**
 * Handle Multi-Format Document AI Product Intake
 * (Direct JSON paste, Text PDF, Scanned Image PDF, Word docx, Excel spreadsheets, CSV, Images)
 */
exports.handleDocumentProductIntake = async (req, res, next) => {
  try {
    const categoryId = req.body?.categoryId;
    if (!categoryId) {
      return res.status(400).json({ done: false, error: "يرجى اختيار القسم أولاً" });
    }

    const result = await intakeEngine.processDocumentIntake({
      fileBuffer: req.file?.buffer,
      mimeType: req.file?.mimetype || "",
      filename: req.file?.originalname || "",
      jsonText: req.body?.jsonText || "",
      rawText: req.body?.text || "",
      subdomain: req.subdomain,
      categoryId,
      adminData: req.adminData || {}
    });

    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    console.error("[DOCUMENT_PRODUCT_INTAKE_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "حدث خطأ أثناء فحص واستخراج بيانات المنتجات من الملف"
    });
  }
};

/**
 * Generate External AI Prompt for a Category (for ChatGPT / Claude / Gemini manual workflow)
 */
exports.handleCategoryPromptGet = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      return res.status(400).json({ done: false, error: "معرف القسم مطلوب" });
    }

    const result = await intakeEngine.generateExternalPromptForCategory(req.subdomain, categoryId);
    return res.json({ done: true, ...result });
  } catch (err) {
    console.error("[CATEGORY_PROMPT_GET_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "تعذر توليد الـ Prompt للقسم المطلوب"
    });
  }
};

/**
 * Upload AI Studio Image to Persistent Storage (Delegates to Visual Engine)
 */
exports.handleUploadAiImageToStorage = async (req, res, next) => {
  try {
    const { image, filename = "ai-studio-image.png" } = req.body || {};
    if (!image) {
      return res.status(400).json({ done: false, error: "بيانات الصورة مطلوبة (base64 أو URL)" });
    }

    const loaded = await visualEngine.loadAssetAsBuffer(image);
    if (!loaded?.buffer) {
      return res.status(400).json({ done: false, error: "تنسيق الصورة غير مدعوم أو تعذر تحميلها" });
    }

    const uploadedUrl = await visualEngine.saveVisualAsset(loaded.buffer, loaded.mimeType, filename, req);
    return res.json({ done: true, url: uploadedUrl });
  } catch (err) {
    console.error("[AI_IMAGE_UPLOAD_ERR]", err.message);
    res.status(500).json({
      done: false,
      error: err.message || "فشل رفع الصورة إلى السحابة"
    });
  }
};

/**
 * Handle Product Image AI Studio (Enhance, Angles, Extract from Collection - Delegates to Visual Engine)
 */
exports.handleProductImageAi = async (req, res, next) => {
  try {
    const result = await visualEngine.generateProductStudioImages(req, req.body || {});
    res.json({
      done: true,
      ...result,
      message:
        result.mode === "enhance_and_angles"
          ? `تم تحسين الصورة وتوليد ${result.images.length} زوايا مختلفة بنجاح!`
          : result.mode === "extract_item_from_collection"
          ? "تم عزل واستخراج المنتج من الصورة المجمعة بنجاح!"
          : "تم تحسين صورة المنتج بالذكاء الاصطناعي بنجاح!"
    });
  } catch (err) {
    console.error("[PRODUCT_IMAGE_AI_ERR]", err.response?.data || err.message);
    const apiErrMsg =
      err.response?.data?.error?.message ||
      err.message ||
      "فشل في معالجة الصورة بالذكاء الاصطناعي";
    res.status(err.status || 500).json({
      done: false,
      error: apiErrMsg
    });
  }
};

// Backwards-compatible utility function re-exports
exports.parseDocumentText = (buf, mime, fname) => intakeEngine.parseDocument(buf, mime, fname);
exports.callDeepSeek = intakeEngine.callDeepSeek;
exports.callGemini = intakeEngine.callGemini;
exports.transcribeAudio = (buf, mime, admin) => audioEngine.transcribeVoiceIntake(buf, mime, admin);
exports.extractProductsForCategory = intakeEngine.extractProductsForCategory;
exports.getCategorySpecsContext = intakeEngine.getCategorySpecsContext;
exports.generateExternalPromptForCategory = intakeEngine.generateExternalPromptForCategory;
exports.processProductImageWithAi = (req, payload) => visualEngine.generateProductStudioImages(req, payload);
