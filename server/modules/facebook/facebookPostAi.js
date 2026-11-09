/**
 * Facebook Post & Commercial Social Marketing AI Module
 * Thin delegating facade over the Unified Campaign Engine & Visuals Engine.
 */

const { checkAiAvailable } = require("../../core/middleware/aiDispatcher");
const visualEngine = require("../visual-engine");
const campaignEngine = require("../campaign-engine");
const { getMarketingProductSignals } = require("../analytics/analyticsService");

// Presets
const AD_PRESETS = campaignEngine.AD_PRESETS;

// Buffer & Product Context Resolution
const loadImageSourceAsBuffer = async (imageUrl) => {
  return await visualEngine.loadAssetAsBuffer(imageUrl);
};

const resolveSelectedProductsContext = async (subdomain, productIds = []) => {
  return await visualEngine.resolveSelectedProductsContext(subdomain, productIds);
};

// Core Business Functions Delegated to Engines
const generateFacebookPostCopy = async (subdomain, payload = {}, adminData = {}) => {
  return await campaignEngine.generateAdPostCopy(subdomain, payload, adminData);
};

const generateFacebookPostImageWithAi = async (req, payload = {}) => {
  return await campaignEngine.generateAdPosterImage(req, payload);
};

const generateSmartFacebookCampaign = async (subdomain, payload = {}, adminData = {}) => {
  return await campaignEngine.generateSmartCampaign(subdomain, payload, adminData);
};

// Express Route Handlers
exports.getPresets = (req, res) => {
  res.json({ done: true, presets: AD_PRESETS });
};

exports.handleGetAdSignals = async (req, res) => {
  try {
    const data = await getMarketingProductSignals(req.subdomain, req.query || {});
    res.json({
      done: true,
      ...data
    });
  } catch (err) {
    console.error("[FB_GET_AD_SIGNALS_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "تعذر استخراج الدلالات التسويقية للمنتجات"
    });
  }
};

exports.handleGenerateSmartCampaign = async (req, res) => {
  try {
    const result = await generateSmartFacebookCampaign(
      req.subdomain,
      req.body || {},
      req.adminData || {}
    );
    res.json({
      done: true,
      ...result,
      message: "تم تحليل نشاط المنصة واختيار المنتجات وتجهيز الإعلان الكامل بنجاح! 🚀"
    });
  } catch (err) {
    console.error("[FB_SMART_CAMPAIGN_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "حدث خطأ أثناء توليد الحملة الذكية"
    });
  }
};

exports.handleGeneratePostCopy = async (req, res) => {
  try {
    if (!checkAiAvailable(req)) {
      return res.status(403).json({
        done: false,
        error: "خدمة الذكاء الاصطناعي للنصوص غير مفعلة. يرجى التحقق من إعدادات الـ AI."
      });
    }

    const result = await generateFacebookPostCopy(req.subdomain, req.body || {}, req.adminData);
    res.json({
      done: true,
      ...result,
      message: "تم توليد البوست الدعائي بنجاح!"
    });
  } catch (err) {
    console.error("[FB_GENERATE_COPY_ERR]", err.message);
    res.status(err.status || 500).json({
      done: false,
      error: err.message || "حدث خطأ أثناء توليد نص البوست الدعائي"
    });
  }
};

exports.handleGeneratePostImage = async (req, res) => {
  try {
    const result = await generateFacebookPostImageWithAi(req, req.body || {});
    res.json({
      done: true,
      ...result,
      message: `تم تصميم وتوليد صورة البوست الإعلاني بالذكاء الاصطناعي (بدمج ${result.attachedProductImagesCount || 1} صور منتجات)!`
    });
  } catch (err) {
    console.error("[FB_GENERATE_IMAGE_ERR]", err.response?.data || err.message);
    const apiErrMsg =
      err.response?.data?.error?.message ||
      err.message ||
      "حدث خطأ أثناء توليد صورة البوست بالذكاء الاصطناعي";
    res.status(err.status || 500).json({
      done: false,
      error: apiErrMsg
    });
  }
};

// Re-exports for backwards compatibility
exports.AD_PRESETS = AD_PRESETS;
exports.loadImageSourceAsBuffer = loadImageSourceAsBuffer;
exports.resolveSelectedProductsContext = resolveSelectedProductsContext;
exports.generateFacebookPostCopy = generateFacebookPostCopy;
exports.generateFacebookPostImageWithAi = generateFacebookPostImageWithAi;
exports.generateSmartFacebookCampaign = generateSmartFacebookCampaign;
