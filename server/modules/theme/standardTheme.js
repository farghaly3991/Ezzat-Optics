/**
 * Standard Curated Theme Controller
 * Thin delegating facade over the Unified Theme & Styling Engine.
 */

const themeEngine = require("../theme-engine");

exports.getPresets = async (req, res) => {
  const category = req.query?.category || "all";
  const presets = themeEngine.getPresetsByCategory(category);
  res.json({ done: true, engine: "standard-presets", presets });
};

exports.generateTheme = async (req, res) => {
  const { prompt = "" } = req.body;
  const selected = themeEngine.findPresetByMoodOrKeywords(prompt);
  const helperPrompt = themeEngine.buildExternalHelperPrompt(prompt);

  res.json({
    done: true,
    engine: "standard-curated",
    theme: selected,
    helperPrompt,
    message: "تم اختيار أفضل قالب متناسق مع طلبك من القوالب القياسية!"
  });
};
