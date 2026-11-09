/**
 * AI Theme Generator
 * Generates custom e-commerce design themes using DeepSeek & Gemini with curated fallback.
 */

const { THEME_DESIGN_SYSTEM_PROMPT, buildExternalHelperPrompt } = require("./themePromptBuilder");
const { normalizeThemeTokens } = require("./designTokensValidator");
const { findPresetByMoodOrKeywords } = require("./presetCatalog");
const { callDeepSeek, callGemini } = require("../intake-engine");

async function generateThemeWithAi(prompt = "", adminData = {}) {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    throw new Error("يرجى إدخال وصف المظهر المطلوب لتوليده بالذكاء الاصطناعي");
  }

  const helperPrompt = buildExternalHelperPrompt(cleanPrompt);
  let parsedTheme = null;
  let engineUsed = "ai-generator";

  try {
    parsedTheme = await callDeepSeek(
      [
        { role: "system", content: THEME_DESIGN_SYSTEM_PROMPT },
        { role: "user", content: `المطلوب: صمم ثيم لمتجر متوافق مع هذا الوصف: "${cleanPrompt}"` }
      ],
      adminData,
      0.6
    );
  } catch (deepSeekErr) {
    console.warn("[THEME_DEEPSEEK_FALLBACK]", deepSeekErr.message);
    try {
      parsedTheme = await callGemini(
        THEME_DESIGN_SYSTEM_PROMPT,
        `المطلوب: صمم ثيم لمتجر متوافق مع هذا الوصف: "${cleanPrompt}"`,
        adminData
      );
    } catch (geminiErr) {
      console.warn("[THEME_GEMINI_FALLBACK]", geminiErr.message);
      engineUsed = "curated-fallback";
      const matchedPreset = findPresetByMoodOrKeywords(cleanPrompt);
      parsedTheme = matchedPreset?.theme || matchedPreset || {};
    }
  }

  const normalizedTheme = normalizeThemeTokens(parsedTheme);

  return {
    done: true,
    engine: engineUsed,
    theme: normalizedTheme,
    helperPrompt,
    message:
      engineUsed === "ai-generator"
        ? "تم توليد الثيم الاحترافي بالذكاء الاصطناعي بنجاح!"
        : "تم اختيار أفضل قالب متناسق مع طلبك من القوالب القياسية المعتمدة!"
  };
}

module.exports = {
  generateThemeWithAi
};
