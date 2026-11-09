/**
 * Theme Injector Helper (Extracted from Manara)
 * Dynamically applies custom design tokens from adminData.customTheme to document root and body
 */
import {
  getContrastTextColor,
  ensureAccessibleText,
  isDarkColor,
  deriveDarkVariant,
  toSolidHexOrRgb,
  parseColorToRgb,
} from './colorContrast';

const loadedFonts = new Set();

export function ensureFontLoaded(fontFamily, customFontUrl) {
  if (typeof document === 'undefined') return;

  if (customFontUrl && !loadedFonts.has(customFontUrl)) {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = customFontUrl;
      document.head.appendChild(link);
      loadedFonts.add(customFontUrl);
    } catch {
      /* ignore */
    }
  }

  if (fontFamily && !loadedFonts.has(fontFamily)) {
    const googleFontMap = {
      Almarai: 'Almarai:wght@300;400;700;800',
      Cairo: 'Cairo:wght@300;400;600;700;800;900',
      Tajawal: 'Tajawal:wght@300;400;500;700;800;900',
      Alexandria: 'Alexandria:wght@300;400;600;700;800;900',
      'IBM Plex Sans Arabic': 'IBM+Plex+Sans+Arabic:wght@300;400;500;600;700',
      'Readex Pro': 'Readex+Pro:wght@300;400;500;600;700',
      Amiri: 'Amiri:ital,wght@0,400;0,700;1,400',
      'Reem Kufi': 'Reem+Kufi:wght@400;500;600;700',
      'Aref Ruqaa': 'Aref+Ruqaa:wght@400;700',
      Changa: 'Changa:wght@400;600;700;800',
      Lalezar: 'Lalezar',
      Marhey: 'Marhey:wght@400;600;700',
      Lemonada: 'Lemonada:wght@400;600;700',
      'El Messiri': 'El+Messiri:wght@400;600;700',
      Lateef: 'Lateef:wght@400;600;700;800',
      'Scheherazade New': 'Scheherazade+New:wght@400;700',
      Kufam: 'Kufam:wght@400;600;700;800',
      Rakkas: 'Rakkas',
      Mada: 'Mada:wght@400;600;700;800',
      'Noto Sans Arabic': 'Noto+Sans+Arabic:wght@400;600;700;800',
      Rubik: 'Rubik:wght@400;500;600;700;800;900',
    };

    const fontSpec = googleFontMap[fontFamily];
    if (fontSpec) {
      try {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontSpec}&display=swap`;
        document.head.appendChild(link);
        loadedFonts.add(fontFamily);
      } catch {
        /* ignore */
      }
    }
  }
}

export function applyThemeTokens(theme) {
  if (!theme || typeof document === 'undefined') return;
  const root = document.documentElement;

  const primary = theme.colors?.primary || theme.primaryColor || '#c23b22';
  const secondary = theme.colors?.secondary || theme.secondaryColor || '#122338';
  const highlight = theme.colors?.highlight || theme.highlightColor || '#d97706';
  const accent = theme.colors?.accent || theme.accentColor || '#10b981';

  const darkDerived = deriveDarkVariant(primary, secondary);
  const effectiveSiteBg =
    theme.globalBg?.bgType === 'gradient' && theme.globalBg?.gradient?.colorStart
      ? theme.globalBg.gradient.colorStart
      : theme.globalBg?.bgColor || theme.cardContainer?.bgColor || '#f8f6f2';

  const isDark =
    theme.mode === 'dark' ||
    isDarkColor(effectiveSiteBg) ||
    isDarkColor(theme.globalBg?.bgColor);

  // Sync dark class on html root
  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.removeAttribute('data-theme');
  }

  // Base Layer
  let basePageBg = theme.globalBg?.bgColor || (isDark ? '#0b1120' : '#f8f6f2');
  if (theme.globalBg?.bgType === 'gradient' && theme.globalBg?.gradient) {
    const g = theme.globalBg.gradient;
    if (g.type === 'radial') {
      basePageBg = `radial-gradient(circle at center, ${g.colorStart || '#0f172a'}, ${g.colorMid ? g.colorMid + ', ' : ''}${g.colorEnd || '#030712'})`;
    } else {
      basePageBg = `linear-gradient(${g.angle || 135}deg, ${g.colorStart || '#0f172a'}, ${g.colorMid ? g.colorMid + ', ' : ''}${g.colorEnd || '#030712'})`;
    }
  }

  // Overlay
  const overlayCfg = theme.globalOverlay;
  let overlayColor = 'transparent';
  let overlayBlur = 'none';
  if (overlayCfg && overlayCfg.enabled !== false && overlayCfg.color) {
    overlayColor = overlayCfg.color;
    if (overlayCfg.backdropBlur && overlayCfg.backdropBlur !== 'none') {
      const blurVal = overlayCfg.backdropBlur === 'xl' ? '24px' : overlayCfg.backdropBlur === 'lg' ? '16px' : overlayCfg.backdropBlur === 'sm' ? '4px' : '8px';
      overlayBlur = `blur(${blurVal})`;
    }
  }

  // Core Brand Tokens
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-primary-light', primary + '22');
  root.style.setProperty('--color-secondary', secondary);
  root.style.setProperty('--color-highlight', highlight);
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--manara-accent', primary);
  root.style.setProperty('--manara-page-bg', basePageBg);
  root.style.setProperty('--manara-page-overlay-color', overlayColor);
  root.style.setProperty('--manara-page-overlay-blur', overlayBlur);

  // Derive solid background/surface colors so modals, dropdowns, and cards are never see-through
  const solidSurface = toSolidHexOrRgb(
    isDark
      ? (theme.cardContainer?.bgColor && isDarkColor(theme.cardContainer.bgColor) ? theme.cardContainer.bgColor : (darkDerived.surface || '#1e293b'))
      : (theme.cardContainer?.bgColor || '#ffffff'),
    isDark ? '#1e293b' : '#ffffff'
  );
  const solidPaper = toSolidHexOrRgb(effectiveSiteBg, isDark ? '#0b1120' : '#f8fafc');

  root.style.setProperty('--color-surface-solid', solidSurface);
  root.style.setProperty('--color-paper-solid', solidPaper);

  if (isDark) {
    const rawCardBg = theme.cardContainer?.bgColor || theme.textContainer?.bgColor;
    const isRawCardDark = rawCardBg && isDarkColor(rawCardBg) && !rawCardBg.includes('255, 255, 255');
    const surface = solidSurface;
    const cardBg = isRawCardDark ? rawCardBg : (darkDerived.cardBg || '#1e293b');
    const border = darkDerived.border || 'rgba(255, 255, 255, 0.18)';

    root.style.setProperty('--color-navy', theme.colors?.secondary || '#0f172a');
    root.style.setProperty('--manara-navy', theme.colors?.secondary || '#0f172a');
    root.style.setProperty('--manara-paper', effectiveSiteBg && isDarkColor(effectiveSiteBg) ? effectiveSiteBg : '#0b1120');
    root.style.setProperty('--color-paper', effectiveSiteBg && isDarkColor(effectiveSiteBg) ? effectiveSiteBg : '#0b1120');
    root.style.setProperty('--manara-surface', surface);
    root.style.setProperty('--color-surface', surface);
    root.style.setProperty('--card-custom-bg', cardBg);
    root.style.setProperty('--card-custom-border', border);
    root.style.setProperty('--card-bg', cardBg);
    root.style.setProperty('--card-border', border);
    root.style.setProperty('--manara-line', border);
    root.style.setProperty('--color-line', border);
    root.style.setProperty('--manara-ink', '#f8fafc');
    root.style.setProperty('--color-ink', '#f8fafc');
    root.style.setProperty('--manara-ink-soft', '#94a3b8');
    root.style.setProperty('--color-ink-soft', '#94a3b8');
    document.body.style.color = '#f8fafc';
    document.body.style.background = basePageBg;
  } else {
    const surface = solidSurface;
    const cardBg = theme.cardContainer?.bgColor || '#ffffff';
    let border = theme.cardContainer?.borderColor || 'rgba(203, 213, 225, 0.95)';

    // Strengthen border contrast if it's too faint or low opacity
    if (!border || border === 'transparent' || border.includes('0.1') || border.includes('0.2') || border.includes('0.25')) {
      border = 'rgba(203, 213, 225, 0.95)';
    }

    root.style.setProperty('--color-navy', secondary);
    root.style.setProperty('--manara-navy', secondary);
    root.style.setProperty('--manara-paper', effectiveSiteBg && !isDarkColor(effectiveSiteBg) ? effectiveSiteBg : '#f8fafc');
    root.style.setProperty('--color-paper', effectiveSiteBg && !isDarkColor(effectiveSiteBg) ? effectiveSiteBg : '#f8fafc');
    root.style.setProperty('--manara-surface', surface);
    root.style.setProperty('--color-surface', surface);
    root.style.setProperty('--card-custom-bg', cardBg);
    root.style.setProperty('--card-custom-border', border);
    root.style.setProperty('--card-bg', cardBg);
    root.style.setProperty('--card-border', border);
    root.style.setProperty('--manara-line', border);
    root.style.setProperty('--color-line', border);
    root.style.setProperty('--manara-ink', '#0f172a');
    root.style.setProperty('--color-ink', '#0f172a');
    root.style.setProperty('--manara-ink-soft', '#475569');
    root.style.setProperty('--color-ink-soft', '#475569');
    document.body.style.color = '#0f172a';
    document.body.style.background = basePageBg;
  }

  // Contrasts
  const primaryContrast = getContrastTextColor(primary);
  const secondaryContrast = isDark ? '#ffffff' : getContrastTextColor(secondary);
  root.style.setProperty('--color-primary-contrast', primaryContrast);
  root.style.setProperty('--color-secondary-contrast', secondaryContrast);

  // Dynamic Inputs configuration with strict contrast guarantee
  let inputBg = isDark ? '#1e293b' : '#ffffff';
  let inputText = isDark ? '#f8fafc' : '#0f172a';
  let inputBorder = isDark ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1';
  let inputPlaceholder = isDark ? '#94a3b8' : '#64748b';

  if (theme.inputStyling?.bgColor) {
    const customBg = toSolidHexOrRgb(theme.inputStyling.bgColor, inputBg);
    const isCustomBgDark = isDarkColor(customBg);
    inputBg = customBg;
    inputText = isCustomBgDark ? '#f8fafc' : '#0f172a';
    inputPlaceholder = isCustomBgDark ? '#94a3b8' : '#64748b';
  }

  root.style.setProperty('--color-input-bg', inputBg);
  root.style.setProperty('--color-input-text', inputText);
  root.style.setProperty('--color-input-placeholder', inputPlaceholder);
  root.style.setProperty('--color-input-border', inputBorder);

  // Card Archetype
  root.setAttribute('data-card-archetype', theme.cardArchetype || 'glassmorphic-modern');

  // Card Container
  const cardCfg = theme.cardContainer || {};
  if (cardCfg.borderRadius) {
    root.style.setProperty('--card-radius', cardCfg.borderRadius);
    root.style.setProperty('--radius-card', cardCfg.borderRadius);
  }
  if (cardCfg.bgColor) {
    root.style.setProperty('--card-bg', cardCfg.bgColor);
    root.style.setProperty('--color-surface', solidSurface);
  }
  if (cardCfg.borderColor) {
    root.style.setProperty('--card-border', cardCfg.borderColor);
  }

  // Buttons
  const btnCfg = theme.buttonTokens || theme.buttons || {};
  if (btnCfg.borderRadius || btnCfg.primaryRadius) {
    const r = btnCfg.borderRadius || btnCfg.primaryRadius;
    root.style.setProperty('--button-radius', r);
    root.style.setProperty('--btn-primary-radius', r);
  }

  // Typography
  const fontFamily = theme.typography?.fontFamily || theme.fontFamily || 'Cairo';
  ensureFontLoaded(fontFamily);
  document.body.style.fontFamily = `"${fontFamily}", system-ui, sans-serif`;

  // Dynamic CSS Injections
  injectDynamicCardStyling(theme.cardContainer);
  injectDynamicButtonMatrix(theme.buttonMatrix);
  injectDynamicInputStyling(theme.inputStyling);
}

export function injectDynamicButtonMatrix(buttonMatrix) {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('manara-dynamic-button-matrix');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'manara-dynamic-button-matrix';
    document.head.appendChild(styleEl);
  }

  if (!buttonMatrix || Object.keys(buttonMatrix).length === 0) {
    styleEl.textContent = '';
    return;
  }

  let cssRules = '';
  for (let i = 1; i <= 10; i++) {
    const key = `btn_${i}`;
    const btn = buttonMatrix[key];
    if (!btn) continue;

    const bg =
      btn.bgType === 'gradient' && btn.bgGradient
        ? `linear-gradient(${btn.bgGradient.angle || 135}deg, ${btn.bgGradient.colorStart}, ${btn.bgGradient.colorMid ? btn.bgGradient.colorMid + ', ' : ''}${btn.bgGradient.colorEnd})`
        : btn.bgColor || 'var(--color-primary, #2563eb)';

    const color = btn.fontColor || 'var(--color-primary-contrast, #ffffff)';
    const radius = btn.borderRadius || '0.75rem';
    const borderWidth = btn.borderWidth !== undefined ? `${btn.borderWidth}px` : '1px';
    const borderColor = btn.borderColor || 'transparent';
    const shadow = btn.shadow || '0 4px 12px rgba(0,0,0,0.08)';

    cssRules += `
      .ds-btn-${i} {
        background: ${bg} !important;
        color: ${color} !important;
        border-radius: ${radius} !important;
        border: ${borderWidth} solid ${borderColor} !important;
        box-shadow: ${shadow} !important;
        ${btn.fontSize ? `font-size: ${btn.fontSize} !important;` : ''}
        ${btn.fontWeight ? `font-weight: ${btn.fontWeight} !important;` : ''}
        transition: all 0.2s ease !important;
      }
      .ds-btn-${i}:hover {
        ${btn.hoverEffect?.hoverBg ? `background: ${btn.hoverEffect.hoverBg} !important;` : 'filter: brightness(1.08) !important;'}
        ${btn.hoverEffect?.hoverColor ? `color: ${btn.hoverEffect.hoverColor} !important;` : ''}
        ${btn.hoverEffect?.hoverScale ? `transform: scale(${btn.hoverEffect.hoverScale}) !important;` : 'transform: translateY(-1px) !important;'}
        ${btn.hoverEffect?.hoverShadow ? `box-shadow: ${btn.hoverEffect.hoverShadow} !important;` : ''}
      }
    `;
  }
  styleEl.textContent = cssRules;
}

export function injectDynamicInputStyling(inputCfg) {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('manara-dynamic-inputs');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'manara-dynamic-inputs';
    document.head.appendChild(styleEl);
  }

  if (!inputCfg) {
    styleEl.textContent = '';
    return;
  }

  const bg = toSolidHexOrRgb(inputCfg.bgColor || 'var(--color-input-bg, #ffffff)', 'var(--color-input-bg, #ffffff)');
  const isCustomDark = isDarkColor(bg);
  const textCol = isCustomDark ? '#f8fafc' : '#0f172a';
  const borderCol = inputCfg.borderColor || (isCustomDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(226, 232, 240, 0.9)');
  const borderW = inputCfg.borderWidth !== undefined ? `${inputCfg.borderWidth}px` : '1px';
  const radius = inputCfg.borderRadius || '0.75rem';
  const focusCol = inputCfg.focusRingColor || 'var(--color-primary, #2563eb)';

  styleEl.textContent = `
    .ds-input {
      background-color: ${bg} !important;
      border: ${borderW} solid ${borderCol} !important;
      border-radius: ${radius} !important;
      color: ${textCol} !important;
      transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
    }
    .ds-input:focus {
      border-color: ${focusCol} !important;
      outline: 2px solid ${focusCol}22 !important;
    }
  `;
}

export function injectDynamicCardStyling(cardCfg) {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('manara-dynamic-cards');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'manara-dynamic-cards';
    document.head.appendChild(styleEl);
  }

  if (!cardCfg) {
    styleEl.textContent = '';
    return;
  }

  let bgValue = cardCfg.bgColor || 'rgba(255, 255, 255, 0.98)';
  const sampleColor = cardCfg.bgColor || '#ffffff';
  const cardIsDark = isDarkColor(sampleColor);
  const rgb = parseColorToRgb(bgValue);
  if (rgb && rgb.a < 0.95) {
    bgValue = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.97)`;
  }

  if (cardCfg.bgType === 'gradient' && cardCfg.bgGradient) {
    const grad = cardCfg.bgGradient;
    const mid = grad.colorMid ? `${grad.colorMid}, ` : '';
    bgValue = `linear-gradient(${grad.angle || 135}deg, ${grad.colorStart || '#ffffff'}, ${mid}${grad.colorEnd || '#f8fafc'})`;
  }

  let blurVal = '12px';
  if (cardCfg.backdropBlur === 'sm') blurVal = '4px';
  else if (cardCfg.backdropBlur === 'md') blurVal = '8px';
  else if (cardCfg.backdropBlur === 'lg') blurVal = '16px';
  else if (cardCfg.backdropBlur === 'xl') blurVal = '24px';
  else if (cardCfg.backdropBlur === 'none') blurVal = '0px';

  let shadowVal = '0 4px 18px -2px rgba(0, 0, 0, 0.06)';
  if (cardCfg.shadow === 'float' || cardCfg.shadow === 'md') {
    shadowVal = '0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.05)';
  } else if (cardCfg.shadow === 'elevated' || cardCfg.shadow === 'lg') {
    shadowVal = '0 20px 45px -8px rgba(0, 0, 0, 0.18), 0 8px 18px -4px rgba(0, 0, 0, 0.08)';
  } else if (cardCfg.shadow === 'brutal') {
    shadowVal = '4px 4px 0px rgba(18, 35, 56, 0.95)';
  }

  const borderWidth = cardCfg.borderWidth !== undefined ? `${cardCfg.borderWidth}px` : '1px';
  const borderColor = cardCfg.borderColor || (cardIsDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(226, 232, 240, 0.85)');
  const borderRadius = cardCfg.borderRadius || '1.25rem';

  styleEl.textContent = `
    .ds-card {
      background: ${bgValue} !important;
      ${blurVal !== '0px' ? `backdrop-filter: blur(${blurVal}) !important; -webkit-backdrop-filter: blur(${blurVal}) !important;` : ''}
      border-width: ${borderWidth} !important;
      border-color: ${borderColor} !important;
      border-radius: ${borderRadius} !important;
      box-shadow: ${shadowVal} !important;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease, border-color 0.28s ease !important;
    }
    .ds-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.14) !important;
    }
  `;
}
