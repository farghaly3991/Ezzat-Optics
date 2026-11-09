/**
 * Preset Catalog & Design System Library
 * Houses and manages the 30 master e-commerce design themes.
 */

const path = require("path");
let MASTER_PRESETS = [];

try {
  MASTER_PRESETS = require("../theme/themePresets.json");
} catch (e) {
  MASTER_PRESETS = [];
}

const CATEGORY_MAP = {
  all: "الكل",
  minimal: "بسيط ومينيمال",
  modern: "عصري وتكنولوجي",
  luxury: "فخامة وأناقة",
  nature_warm: "طبيعي وهادئ",
  dark_cyber: "داكن ومستقبلي",
  academic: "أكاديمي ورسمي",
  funky: "حيوي ومرح",
  dark: "الوضع الداكن",
  light: "الوضع الفاتح"
};

function isPresetDark(p) {
  if (!p) return false;
  if (p.mode === "dark") return true;
  if (p.category === "dark_cyber") return true;
  if (
    p.id.includes("-dark") ||
    p.id.includes("midnight-") ||
    p.id.includes("cyber-") ||
    p.id.includes("cyberpunk-")
  ) {
    return true;
  }
  return false;
}

function getAllPresets() {
  return MASTER_PRESETS;
}

function getPresetById(presetId) {
  if (!presetId) return null;
  return MASTER_PRESETS.find((p) => p.id === String(presetId)) || null;
}

function getPresetsByCategory(category = "all") {
  if (!category || category === "all") return MASTER_PRESETS;
  if (category === "dark") return MASTER_PRESETS.filter(isPresetDark);
  if (category === "light") return MASTER_PRESETS.filter((p) => !isPresetDark(p));
  return MASTER_PRESETS.filter((p) => p.category === category);
}

/**
 * Intelligent Semantic Search & Mood Mapping across curated presets
 */
function findPresetByMoodOrKeywords(query = "") {
  if (!query || typeof query !== "string") {
    return MASTER_PRESETS[0] || null;
  }

  const q = query.toLowerCase().trim();

  // Keyword to Preset ID mappings
  const intentRules = [
    {
      keywords: ["نيون", "سايبر", "مستقبلي", "إلكتروني", "جيمنج", "cyber", "neon", "gaming"],
      presetId: "cyberpunk-neon"
    },
    {
      keywords: ["ذهب", "ملكي", "فخم", "فاخر", "بريميوم", "luxury", "gold", "vip"],
      presetId: "royal-academic"
    },
    {
      keywords: ["طبيعي", "أخضر", "زمرد", "واحة", "عضوي", "نباتي", "nature", "green", "emerald", "oasis"],
      presetId: "emerald-oasis"
    },
    {
      keywords: ["هادئ", "بسيط", "أبيض", "فاتح", "مينيمال", "راقي", "minimal", "clean", "white"],
      presetId: "nordic-minimal"
    },
    {
      keywords: ["أزرق", "تقني", "بحر", "سماء", "كحلي", "blue", "tech", "navy", "sapphire"],
      presetId: "sapphire-executive"
    },
    {
      keywords: ["برتقالي", "شمس", "حماس", "طاقة", "تخفيضات", "عروض", "غروب", "sunset", "horizon"],
      presetId: "sunset-horizon"
    },
    {
      keywords: ["داكن", "سواد", "ليل", "فحم", "دارك", "dark", "midnight", "obsidian"],
      presetId: "midnight-obsidian-gold"
    },
    {
      keywords: ["حلوى", "وردي", "أنثوي", "زهري", "عطور", "مكياج", "pink", "candy", "cosmetics"],
      presetId: "candy-pop"
    }
  ];

  for (const rule of intentRules) {
    if (rule.keywords.some((kw) => q.includes(kw))) {
      const match = MASTER_PRESETS.find((p) => p.id === rule.presetId || p.category === rule.presetId);
      if (match) return match;
    }
  }

  // Broad text search across name, description, and badge
  const matched = MASTER_PRESETS.find(
    (p) =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.badge && p.badge.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
  );

  return matched || MASTER_PRESETS[0] || null;
}

module.exports = {
  getAllPresets,
  getPresetById,
  getPresetsByCategory,
  findPresetByMoodOrKeywords,
  isPresetDark,
  CATEGORY_MAP
};
