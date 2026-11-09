/**
 * Design Tokens Schema Validator & Normalizer
 * Enforces production-ready design tokens and WCAG-compliant contrast colors.
 */

const { sanitizeHex, getContrastTextColor, isDarkColor } = require("./colorLuminance");

const VALID_CARD_ARCHETYPES = [
  "glassmorphic-modern",
  "cyber-futuristic",
  "luxury-gold",
  "minimal-editorial",
  "nature-warm"
];

const VALID_FONTS = [
  "Cairo",
  "Alexandria",
  "Almarai",
  "Tajawal",
  "Readex Pro",
  "IBM Plex Sans Arabic",
  "Amiri",
  "Changa",
  "Lalezar",
  "Marhey",
  "Aref Ruqaa",
  "Noto Sans Arabic",
  "Rubik"
];

function normalizeThemeTokens(inputTheme = {}) {
  const theme = typeof inputTheme === "object" && inputTheme !== null ? inputTheme : {};

  const primaryColor = sanitizeHex(
    theme.primaryColor || theme.colors?.primary,
    "#2563eb"
  );
  const secondaryColor = sanitizeHex(
    theme.secondaryColor || theme.colors?.secondary,
    "#0f172a"
  );
  const highlightColor = sanitizeHex(
    theme.highlightColor || theme.colors?.highlight,
    "#f59e0b"
  );
  const accentColor = sanitizeHex(
    theme.accentColor || theme.colors?.accent,
    "#10b981"
  );

  const primaryContrast = getContrastTextColor(primaryColor);
  const secondaryContrast = getContrastTextColor(secondaryColor);
  const highlightContrast = getContrastTextColor(highlightColor);
  const accentContrast = getContrastTextColor(accentColor);

  const cardArchetype = VALID_CARD_ARCHETYPES.includes(theme.cardArchetype)
    ? theme.cardArchetype
    : isDarkColor(secondaryColor) && primaryColor === "#eab308"
    ? "luxury-gold"
    : "glassmorphic-modern";

  const fontFamily = VALID_FONTS.includes(theme.fontFamily || theme.typography?.fontFamily)
    ? theme.fontFamily || theme.typography?.fontFamily
    : "Cairo";

  const globalBg = {
    bgType: theme.globalBg?.bgType === "solid" ? "solid" : "gradient",
    bgColor: sanitizeHex(theme.globalBg?.bgColor, "#f8fafc"),
    gradient: {
      colorStart: sanitizeHex(theme.globalBg?.gradient?.colorStart, "#f8fafc"),
      colorEnd: sanitizeHex(theme.globalBg?.gradient?.colorEnd, "#eff6ff"),
      angle: typeof theme.globalBg?.gradient?.angle === "number" ? theme.globalBg.gradient.angle : 135
    }
  };

  const cardContainer = {
    bgColor: theme.cardContainer?.bgColor || "rgba(255, 255, 255, 0.9)",
    backdropBlur: ["none", "sm", "md", "lg", "xl"].includes(theme.cardContainer?.backdropBlur)
      ? theme.cardContainer.backdropBlur
      : "md",
    borderRadius: theme.cardContainer?.borderRadius || "1.25rem",
    shadow: ["none", "sm", "md", "lg", "xl", "glow"].includes(theme.cardContainer?.shadow)
      ? theme.cardContainer.shadow
      : "lg",
    borderStyle: theme.cardContainer?.borderStyle || "solid",
    borderColor: theme.cardContainer?.borderColor || "rgba(226, 232, 240, 0.8)"
  };

  const buttons = {
    borderRadius: theme.buttons?.borderRadius || "0.75rem",
    primaryShadow: theme.buttons?.primaryShadow || "md"
  };

  const animations = {
    cardHover: ["lift", "scale", "glow"].includes(theme.animations?.cardHover)
      ? theme.animations.cardHover
      : "lift",
    pulse: theme.animations?.pulse !== false
  };

  return {
    themeName: theme.themeName || theme.name || "ثيم مخصص",
    id: theme.id || `custom-${Date.now()}`,
    primaryColor,
    secondaryColor,
    highlightColor,
    accentColor,
    primaryContrast,
    secondaryContrast,
    highlightContrast,
    accentContrast,
    colors: {
      primary: primaryColor,
      secondary: secondaryColor,
      highlight: highlightColor,
      accent: accentColor,
      primaryContrast,
      secondaryContrast,
      highlightContrast,
      accentContrast
    },
    cardArchetype,
    fontFamily,
    typography: {
      fontFamily
    },
    globalBg,
    cardContainer,
    buttons,
    animations
  };
}

module.exports = {
  normalizeThemeTokens,
  VALID_CARD_ARCHETYPES,
  VALID_FONTS
};
