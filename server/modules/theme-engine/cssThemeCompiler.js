/**
 * CSS Theme Compiler
 * Compiles a Design System Token object into CSS variables and utility classes.
 */

function compileThemeToCss(themeObj = {}) {
  const t = themeObj;
  const primary = t.primaryColor || t.colors?.primary || "#2563eb";
  const primaryContrast = t.primaryContrast || t.colors?.primaryContrast || "#ffffff";
  const secondary = t.secondaryColor || t.colors?.secondary || "#0f172a";
  const secondaryContrast = t.secondaryContrast || t.colors?.secondaryContrast || "#ffffff";
  const highlight = t.highlightColor || t.colors?.highlight || "#f59e0b";
  const accent = t.accentColor || t.colors?.accent || "#10b981";
  const fontFamily = t.fontFamily || t.typography?.fontFamily || "Cairo";

  const cardBg = t.cardContainer?.bgColor || "rgba(255, 255, 255, 0.9)";
  const cardRadius = t.cardContainer?.borderRadius || "1.25rem";
  const cardBorder = t.cardContainer?.borderColor || "rgba(226, 232, 240, 0.8)";
  const btnRadius = t.buttons?.borderRadius || "0.75rem";

  const bgGradient =
    t.globalBg?.bgType === "gradient" && t.globalBg?.gradient
      ? `linear-gradient(${t.globalBg.gradient.angle || 135}deg, ${
          t.globalBg.gradient.colorStart || "#f8fafc"
        }, ${t.globalBg.gradient.colorEnd || "#eff6ff"})`
      : t.globalBg?.bgColor || "#f8fafc";

  return `:root {
  --color-primary: ${primary};
  --color-primary-contrast: ${primaryContrast};
  --color-secondary: ${secondary};
  --color-secondary-contrast: ${secondaryContrast};
  --color-highlight: ${highlight};
  --color-accent: ${accent};
  --font-family-store: '${fontFamily}', sans-serif;
  --store-bg: ${bgGradient};
  --store-card-bg: ${cardBg};
  --store-card-radius: ${cardRadius};
  --store-card-border: ${cardBorder};
  --store-btn-radius: ${btnRadius};
}

body {
  font-family: var(--font-family-store);
  background: var(--store-bg);
}
`;
}

module.exports = {
  compileThemeToCss
};
