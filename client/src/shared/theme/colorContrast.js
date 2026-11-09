/**
 * Color Contrast & Luminance Engine (WCAG 2.1 compliant)
 * Extracted directly from Manara project
 */

const NAMED_COLORS = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'rgba(0,0,0,0)',
  navy: '#122338',
  slate: '#64748b',
  gray: '#6b7280',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
};

export function parseColorToRgb(colorStr) {
  if (!colorStr) return null;
  const str = colorStr.trim().toLowerCase();

  if (NAMED_COLORS[str]) {
    return parseColorToRgb(NAMED_COLORS[str]);
  }

  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  const rgbMatch = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: Math.min(255, Math.max(0, parseFloat(rgbMatch[1]))),
      g: Math.min(255, Math.max(0, parseFloat(rgbMatch[2]))),
      b: Math.min(255, Math.max(0, parseFloat(rgbMatch[3]))),
      a: rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbMatch[4]))) : 1,
    };
  }

  const hslMatch = str.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a: Math.min(1, Math.max(0, a)),
    };
  }

  return null;
}

export function calculateRelativeLuminance(colorStr) {
  const rgb = parseColorToRgb(colorStr);
  if (!rgb) return 0.5;

  const toLinear = (c8) => {
    const c = c8 / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(rgb.r);
  const gLinear = toLinear(rgb.g);
  const bLinear = toLinear(rgb.b);

  if (rgb.a < 1) {
    const bgLum = 1.0;
    const fgLum = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
    return fgLum * rgb.a + bgLum * (1 - rgb.a);
  }

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

export function getContrastRatio(color1, color2) {
  const lum1 = calculateRelativeLuminance(color1);
  const lum2 = calculateRelativeLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function areColorsTooClose(color1, color2, minRatio = 3.0) {
  if (!color1 || !color2) return false;
  const ratio = getContrastRatio(color1, color2);
  return ratio < minRatio;
}

export function isDarkColor(colorStr) {
  if (!colorStr || colorStr === 'transparent') return false;
  return calculateRelativeLuminance(colorStr) <= 0.45;
}

export function getContrastTextColor(bgColor, darkFallback = '#0f172a', lightFallback = '#ffffff', threshold = 0.45) {
  if (!bgColor || bgColor === 'transparent') {
    return darkFallback;
  }
  const luminance = calculateRelativeLuminance(bgColor);
  return luminance > threshold ? darkFallback : lightFallback;
}

export function ensureAccessibleText(bgColor, intendedTextColor, fallbackDark = '#0f172a', fallbackLight = '#ffffff', minRatio = 3.0) {
  if (!bgColor || bgColor === 'transparent') {
    return intendedTextColor || fallbackDark;
  }
  if (!intendedTextColor) {
    return getContrastTextColor(bgColor, fallbackDark, fallbackLight);
  }
  if (areColorsTooClose(bgColor, intendedTextColor, minRatio)) {
    return getContrastTextColor(bgColor, fallbackDark, fallbackLight);
  }
  return intendedTextColor;
}

export function deriveDarkVariant(primaryColor = '#c23b22', secondaryColor = '#122338') {
  const pRgb = parseColorToRgb(primaryColor) || { r: 194, g: 59, b: 34, a: 1 };
  const sRgb = parseColorToRgb(secondaryColor) || { r: 18, g: 35, b: 56, a: 1 };

  const darkPaper = '#0b1120';
  const darkSurface = 'rgba(30, 41, 59, 0.94)';
  const darkCard = 'rgba(30, 41, 59, 0.94)';
  const darkBorder = 'rgba(255, 255, 255, 0.18)';
  const darkInputBg = 'rgba(15, 23, 42, 0.88)';
  const darkInputBorder = 'rgba(255, 255, 255, 0.22)';

  const darkAccentSoft = `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.22)`;
  const darkSecondarySoft = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.25)`;

  return {
    paper: darkPaper,
    surface: darkSurface,
    cardBg: darkCard,
    border: darkBorder,
    inputBg: darkInputBg,
    inputBorder: darkInputBorder,
    ink: '#f8fafc',
    inkSoft: '#94a3b8',
    accentSoft: darkAccentSoft,
    secondarySoft: darkSecondarySoft,
    primaryContrast: getContrastTextColor(primaryColor),
    secondaryContrast: getContrastTextColor(secondaryColor),
  };
}

export function toSolidHexOrRgb(colorStr, fallback = '#ffffff') {
  if (!colorStr || colorStr === 'transparent') return fallback;
  const rgb = parseColorToRgb(colorStr);
  if (!rgb) return fallback;
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
