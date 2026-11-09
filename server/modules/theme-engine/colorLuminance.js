/**
 * Color Luminance & WCAG 2.1 Contrast Calculation Engine
 * Provides server-side accessibility checks and automated contrast calculation.
 */

const NAMED_COLORS = {
  white: "#ffffff",
  black: "#000000",
  navy: "#122338",
  slate: "#64748b",
  gray: "#6b7280",
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  emerald: "#10b981",
  indigo: "#6366f1",
  purple: "#8b5cf6"
};

function parseColorToRgb(colorStr) {
  if (!colorStr) return null;
  const str = String(colorStr).trim().toLowerCase();

  if (NAMED_COLORS[str]) {
    return parseColorToRgb(NAMED_COLORS[str]);
  }

  if (str.startsWith("#")) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255
      };
    }
  }

  const rgbMatch = str.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1
    };
  }

  return null;
}

function calculateRelativeLuminance(r, g, b) {
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;

  const rLinear = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const gLinear = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const bLinear = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

function getContrastRatio(foreground, background) {
  const fgRgb = parseColorToRgb(foreground) || { r: 0, g: 0, b: 0 };
  const bgRgb = parseColorToRgb(background) || { r: 255, g: 255, b: 255 };

  const lum1 = calculateRelativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const lum2 = calculateRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

function isDarkColor(colorStr) {
  const rgb = parseColorToRgb(colorStr);
  if (!rgb) return false;
  const luminance = calculateRelativeLuminance(rgb.r, rgb.g, rgb.b);
  return luminance < 0.2;
}

function getContrastTextColor(backgroundColor) {
  const rgb = parseColorToRgb(backgroundColor);
  if (!rgb) return "#ffffff";
  const lum = calculateRelativeLuminance(rgb.r, rgb.g, rgb.b);
  return lum > 0.35 ? "#0f172a" : "#ffffff";
}

function sanitizeHex(hex, fallback = "#2563eb") {
  if (!hex || typeof hex !== "string") return fallback;
  const clean = hex.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(clean)) {
    return clean;
  }
  return fallback;
}

module.exports = {
  parseColorToRgb,
  calculateRelativeLuminance,
  getContrastRatio,
  isDarkColor,
  getContrastTextColor,
  sanitizeHex
};
