import React, { useState, useEffect } from 'react';
import { Palette, Save, Sparkles, Sun, Moon, Check } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import { THEME_CATEGORIES, HYDRATED_THEME_PRESETS_20 } from '../../shared/theme/themePresets';

export default function ThemeTab() {
  const { token, applyThemeTokens, showToast, config } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activePresetId, setActivePresetId] = useState(config?.customTheme?.id || '');
  const [jsonTheme, setJsonTheme] = useState('');
  
  const [customColors, setCustomColors] = useState({
    primaryColor: config?.customTheme?.primaryColor || config?.customTheme?.colors?.primary || '#2563eb',
    secondaryColor: config?.customTheme?.secondaryColor || config?.customTheme?.colors?.secondary || '#1e293b',
    highlightColor: config?.customTheme?.highlightColor || config?.customTheme?.colors?.highlight || '#f59e0b',
    accentColor: config?.customTheme?.accentColor || config?.customTheme?.colors?.accent || '#10b981',
    fontFamily: config?.customTheme?.fontFamily || config?.customTheme?.typography?.fontFamily || 'Cairo'
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const presets = HYDRATED_THEME_PRESETS_20;

  const filteredPresets = presets.filter((p) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'dark') return p.mode === 'dark';
    if (selectedCategory === 'light') return p.mode !== 'dark';
    return p.category === selectedCategory;
  });

  const handleApplyPreset = async (preset) => {
    const themeToSave = {
      ...preset.theme,
      id: preset.id,
      name: preset.name,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      highlightColor: preset.highlightColor,
      accentColor: preset.theme?.colors?.accent || '#10b981',
      colors: {
        primary: preset.primaryColor,
        secondary: preset.secondaryColor,
        highlight: preset.highlightColor,
        accent: preset.theme?.colors?.accent || '#10b981',
      },
      cardArchetype: preset.theme?.cardArchetype || 'glassmorphic-modern',
      fontFamily: preset.theme?.typography?.fontFamily || 'Cairo',
      globalBg: preset.theme?.globalBg || {},
      cardContainer: preset.theme?.cardContainer || {},
      buttonTokens: preset.theme?.buttonTokens || {},
      buttonMatrix: preset.theme?.buttonMatrix || {},
      inputStyling: preset.theme?.inputStyling || {},
    };

    setActivePresetId(preset.id);
    applyThemeTokens(themeToSave);
    try {
      await axios.put('/api/admin/settings', { customTheme: themeToSave }, authHeader);
      showToast(`تم تطبيق قالب «${preset.name}» وحفظه رسمياً للمتجر!`);
    } catch {
      showToast('تعذر حفظ القالب في السيرفر', 'error');
    }
  };

  const handleImportJson = async () => {
    if (!jsonTheme.trim()) return;
    try {
      const parsed = JSON.parse(jsonTheme);
      applyThemeTokens(parsed);
      await axios.put('/api/admin/settings', { customTheme: parsed }, authHeader);
      showToast('تم تطبيق وحفظ كود الثيم بنجاح!');
      setJsonTheme('');
    } catch (err) {
      showToast('كود JSON غير صالح: ' + err.message, 'error');
    }
  };

  const handleSaveCustomColors = async () => {
    try {
      const newTheme = {
        ...config?.customTheme,
        ...customColors,
        colors: {
          primary: customColors.primaryColor,
          secondary: customColors.secondaryColor,
          highlight: customColors.highlightColor,
          accent: customColors.accentColor,
        },
        typography: {
          ...config?.customTheme?.typography,
          fontFamily: customColors.fontFamily
        }
      };
      applyThemeTokens(newTheme);
      await axios.put('/api/admin/settings', { customTheme: newTheme }, authHeader);
      showToast('تم حفظ الألوان والخطوط المخصصة بنجاح!');
    } catch (err) {
      showToast('تعذر حفظ التخصيص', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* Color Pickers & Font */}
      <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-6">
        <h3 className="text-base font-black text-ink flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <span>تخصيص الألوان والخطوط الأساسية</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink-soft mb-1">اللون الأساسي (Primary)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={customColors.primaryColor} onChange={e => setCustomColors({...customColors, primaryColor: e.target.value})} className="w-10 h-10 rounded-btn cursor-pointer" />
              <input type="text" value={customColors.primaryColor} onChange={e => setCustomColors({...customColors, primaryColor: e.target.value})} className="flex-1 bg-paper border border-line rounded-btn px-2 py-1.5 text-xs font-mono outline-none text-ink" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-soft mb-1">اللون الثانوي (Secondary)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={customColors.secondaryColor} onChange={e => setCustomColors({...customColors, secondaryColor: e.target.value})} className="w-10 h-10 rounded-btn cursor-pointer" />
              <input type="text" value={customColors.secondaryColor} onChange={e => setCustomColors({...customColors, secondaryColor: e.target.value})} className="flex-1 bg-paper border border-line rounded-btn px-2 py-1.5 text-xs font-mono outline-none text-ink" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-soft mb-1">لون التمييز (Highlight)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={customColors.highlightColor} onChange={e => setCustomColors({...customColors, highlightColor: e.target.value})} className="w-10 h-10 rounded-btn cursor-pointer" />
              <input type="text" value={customColors.highlightColor} onChange={e => setCustomColors({...customColors, highlightColor: e.target.value})} className="flex-1 bg-paper border border-line rounded-btn px-2 py-1.5 text-xs font-mono outline-none text-ink" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-soft mb-1">لون التفاعل (Accent)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={customColors.accentColor} onChange={e => setCustomColors({...customColors, accentColor: e.target.value})} className="w-10 h-10 rounded-btn cursor-pointer" />
              <input type="text" value={customColors.accentColor} onChange={e => setCustomColors({...customColors, accentColor: e.target.value})} className="flex-1 bg-paper border border-line rounded-btn px-2 py-1.5 text-xs font-mono outline-none text-ink" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-soft mb-1">نوع الخط العربي (Font Family)</label>
          <select value={customColors.fontFamily} onChange={e => setCustomColors({...customColors, fontFamily: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs outline-none text-ink font-bold">
            <option value="Cairo">Cairo (الافتراضي المتوازن)</option>
            <option value="Alexandria">Alexandria (عصري هندسي)</option>
            <option value="Almarai">Almarai (ناعم ومقروء)</option>
            <option value="Tajawal">Tajawal (انسيابي دافئ)</option>
            <option value="Readex Pro">Readex Pro (تقني للمنتجات الحديثة)</option>
            <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic (رسمي أكاديمي)</option>
            <option value="Amiri">Amiri (ملكي كلاسيكي عريق)</option>
            <option value="Changa">Changa (رياضي قوي وجريء)</option>
            <option value="Lalezar">Lalezar (ريترو عريض جذاب)</option>
            <option value="Marhey">Marhey (مرح وحيوي)</option>
            <option value="Aref Ruqaa">Aref Ruqaa (رقعة أصيل)</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSaveCustomColors} className="px-5 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black text-xs flex items-center gap-1.5 shadow-md hover:bg-primary/90 transition-all">
            <Save className="w-4 h-4" /> حفظ الألوان والخطوط
          </button>
        </div>
      </div>

      {/* 30 Master Presets from Manara */}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-ink flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>مكتبة القوالب الاحترافية المعتمدة (30 ثيم كامل من منارة)</span>
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">اختر أي قالب لتطبيقه في لحظة واحدة مع كامل الألوان وتنسيق البطاقات والأزرار والخلفية</p>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
            {filteredPresets.length} قالب متوفر
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pb-2">
          {THEME_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all ${
                  active
                    ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                    : 'bg-paper text-ink-soft border border-line hover:border-primary/40 hover:text-ink'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresets.map((preset) => {
            const isCurrent = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`p-5 rounded-card border transition-all space-y-3 relative group bg-surface shadow-sm hover:shadow-xl ${
                  isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-line hover:border-primary/40'
                }`}
              >
                {/* Header & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-ink flex items-center gap-1.5">
                      {preset.name}
                      {preset.mode === 'dark' ? (
                        <Moon className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-orange-500" />
                      )}
                    </h4>
                    <p className="text-xs text-ink-soft line-clamp-2 mt-1">{preset.description}</p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-paper border border-line text-ink-soft whitespace-nowrap">
                    {preset.badge}
                  </span>
                </div>

                {/* Preview Gradient Bar */}
                <div
                  className="h-10 rounded-btn border border-white/20 shadow-inner flex items-center justify-center relative overflow-hidden"
                  style={{ background: preset.previewGradient }}
                >
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] font-bold text-white">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.primaryColor }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.secondaryColor }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.highlightColor }} />
                  </div>
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => handleApplyPreset(preset)}
                  className={`w-full py-2.5 rounded-btn text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    isCurrent
                      ? 'bg-emerald-600 text-white border border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'bg-paper text-ink border border-line hover:bg-primary hover:text-[var(--color-primary-contrast,#ffffff)] hover:border-primary'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check className="w-4 h-4" /> القالب النشط حالياً
                    </>
                  ) : (
                    'تطبيق هذا القالب'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paste JSON Theme Box */}
      <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-3">
        <h4 className="text-xs font-extrabold text-ink-soft uppercase tracking-wider">
          لصق كود ثيم مخصص بصيغة JSON
        </h4>
        <textarea
          value={jsonTheme}
          onChange={(e) => setJsonTheme(e.target.value)}
          placeholder='{"primaryColor": "#2563eb", "cardArchetype": "glassmorphic-modern", ...}'
          rows={3}
          className="w-full bg-paper border border-line rounded-card p-3 font-mono text-xs outline-none text-ink focus:border-primary"
        />
        <button
          onClick={handleImportJson}
          className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs hover:bg-primary/90 transition-colors shadow-md"
        >
          استيراد وحفظ الكود
        </button>
      </div>
    </div>
  );
}
