import React from 'react';
import {
  Sparkles,
  Percent,
  RefreshCw,
  Copy
} from 'lucide-react';

export default function FacebookCopyComposer({
  presets = [],
  selectedPreset,
  setSelectedPreset,
  discountText,
  setDiscountText,
  customPrompt,
  setCustomPrompt,
  generatingCopy,
  onGenerateCopy,
  selectedProducts = [],
  isAiAvailable = true,
  postText,
  setPostText,
  headline,
  setHeadline,
  subheadline,
  setSubheadline,
  badgeText,
  setBadgeText,
  ctaText,
  setCtaText,
  setImageOverlayText,
  showToast
}) {
  return (
    <div className="rounded-card bg-surface border border-line p-5 sm:p-6 space-y-5 shadow-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
        <h4 className="text-base font-black text-ink flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs flex items-center justify-center font-black">
            2
          </span>
          <Sparkles className="w-5 h-5 text-orange-500" />
          <span>إعدادات وتوليد نص البوست الدعائي ونصوص الهوية البصرية</span>
        </h4>
        <span className="text-xs font-bold text-ink-soft">
          نصوص الهوية البصرية تُولّد مرة واحدة وتُستخدم على بوستر الإعلان والكفر الرئيسي
        </span>
      </div>

      {/* Presets Selection Grid */}
      <div className="space-y-2">
        <label className="block text-xs font-black text-ink">
          أسلوب وطريقة كلام الإعلان (Ad Attitude Presets):
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {presets.map((preset) => {
            const isPicked = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPreset(preset.id)}
                className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-1 ${
                  isPicked
                    ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-xs'
                    : 'border-line bg-paper hover:bg-surface'
                }`}
              >
                <span className="text-xs font-black text-ink">{preset.label}</span>
                <span className="text-[10px] text-ink-soft leading-snug line-clamp-2">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Discount & Custom Prompt Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-black text-ink mb-1.5 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
            <span>قيمة أو نسبة الخصم / العرض (اختياري)</span>
          </label>
          <input
            type="text"
            value={discountText}
            onChange={(e) => setDiscountText(e.target.value)}
            placeholder="مثال: خصم 15% أو خصم 2000 جنيه لفترة محدودة..."
            className="w-full bg-paper border border-line rounded-btn px-3 py-2.5 text-xs font-bold text-ink outline-none focus:border-primary"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-black text-ink mb-1.5">
            ملاحظات إضافية أو توجيهات خاصة للـ Prompt (اختياري - يمكن تركه فارغاً)
          </label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="مثال: ركز على أن التكييف موفر للكهرباء والتركيب مجاني خلال 24 ساعة..."
            className="w-full bg-paper border border-line rounded-btn px-3 py-2.5 text-xs font-bold text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Generate AI Post Copy Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          disabled={generatingCopy || selectedProducts.length === 0 || !isAiAvailable}
          onClick={onGenerateCopy}
          className="px-6 py-3 rounded-btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {generatingCopy ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري صياغة البوست الإعلاني ونصوص الهوية البصرية...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-orange-300" />
              <span>
                توليد بوست دعائي بالذكاء الاصطناعي ({selectedProducts.length} منتج مختار)
              </span>
            </>
          )}
        </button>

        {!isAiAvailable && (
          <span className="text-xs font-bold text-orange-600 bg-orange-500/10 border border-orange-500/30 px-3 py-1.5 rounded-lg">
            ⚠️ مفتاح الذكاء الاصطناعي للنصوص غير مفعل حالياً في الإعدادات (الزر معطل لحين إضافة المفتاح).
          </span>
        )}
      </div>

      {/* Editable Generated Post Text & Visual Identity Texts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 border-t border-line">
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-ink">
              النص الكامل للبوست على فيسبوك (قابل للتعديل):
            </label>
            {postText && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(postText);
                  showToast?.('تم نسخ نص البوست');
                }}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> نسخ النص
              </button>
            )}
          </div>
          <textarea
            rows={8}
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="سيظهر هنا نص البوست الدعائي بعد الضغط على زر التوليد، أو يمكنك كتابته وتعديله مباشرة..."
            className="w-full bg-paper border border-line rounded-xl p-3.5 text-xs font-bold text-ink leading-relaxed outline-none focus:border-primary"
          />
        </div>

        <div className="lg:col-span-5 space-y-3 bg-paper/60 p-4 rounded-xl border border-line">
          <h5 className="text-xs font-black text-ink">
            نصوص الهوية البصرية (توضع تلقائياً على صورة البوست / الكفر الرئيسي):
          </h5>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft mb-1">
              العنوان الرئيسي على الصورة (Headline)
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => {
                setHeadline(e.target.value);
                setImageOverlayText?.(e.target.value);
              }}
              placeholder="مثال: أقوى عروض الصيف من المتجر العصري"
              className="w-full bg-surface border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-ink-soft mb-1">
              العنوان الفرعي (Subheadline)
            </label>
            <input
              type="text"
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              placeholder="مثال: تكييفات شارب وكاريير بأفضل سعر في مصر"
              className="w-full bg-surface border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-ink-soft mb-1">
                شارة الخصم (Badge)
              </label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="خصم 15% 🔥"
                className="w-full bg-surface border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-soft mb-1">
                زر الدعوة للشراء (CTA)
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="اطلب الآن لباب البيت"
                className="w-full bg-surface border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
