/**
 * AI Theme Generation Controller
 * Thin delegating facade over the Unified Theme & Styling Engine.
 */

const themeEngine = require("../theme-engine");

exports.generateTheme = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "أدخل وصف المظهر المطلوب لتوليده" });
    }

    const result = await themeEngine.generateThemeWithAi(prompt, req.adminData || {});
    res.json(result);
  } catch (err) {
    console.error("[AI_THEME_GENERATION_FAILED]", err.message);
    next(err);
  }
};
