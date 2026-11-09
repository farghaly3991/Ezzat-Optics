import React from 'react';
import {
  ImageIcon,
  LayoutTemplate,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Plus,
  CloudUpload,
  Eye,
  Link2
} from 'lucide-react';
import FacebookSvgTemplateStudio from './FacebookSvgTemplateStudio';
import ImageUploader from '../../../shared/components/ImageUploader';

export default function FacebookVisualStudio({
  postImageCountMode,
  setPostImageCountMode,
  singleVisualTab,
  setSingleVisualTab,
  svgTemplateId,
  setSvgTemplateId,
  singlePostImage,
  setSinglePostImage,
  coverImage,
  setCoverImage,
  additionalImages = [],
  setAdditionalImages,
  useAttachedImagesForAi,
  setUseAttachedImagesForAi,
  imageDesignPrompt,
  setImageDesignPrompt,
  generatingAiImage,
  generatingProductAiId,
  generatingAllProductsAi,
  perProductPrompts,
  setPerProductPrompts,
  effectivePostImages = [],
  selectedProducts = [],
  headline,
  subheadline,
  badgeText,
  ctaText,
  discountText,
  isImageAiAvailable = false,
  onGenerateAiAdImage,
  onGenerateAllProductsAiImages,
  onGenerateSingleProductAiImage,
  onPreviewPost,
  showToast,
  currency = 'ج.م'
}) {
  return (
    <div className="rounded-card bg-surface border border-line p-5 sm:p-6 space-y-6 shadow-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h4 className="text-base font-black text-ink flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs flex items-center justify-center font-black">
              3
            </span>
            <ImageIcon className="w-5 h-5 text-purple-500" />
            <span>تصميم وتوليد صور البوست الإعلاني</span>
          </h4>
          <p className="text-xs text-ink-soft mt-0.5">
            اختر أولاً هل الإعلان سيكون عبارة عن صورة واحدة مجمعة فيها كل شيء أم مجموعة صور في نفس البوست
          </p>
        </div>

        <span className="text-xs font-black px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          إجمالي صور البوست الجاهزة حالياً: {effectivePostImages.length}
        </span>
      </div>

      {/* Top 2 Clear Options: Single Merged Image vs Multiple Images in the Same Post */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setPostImageCountMode('single')}
          className={`p-4 rounded-2xl border-2 text-right transition-all flex items-start gap-3.5 ${
            postImageCountMode === 'single'
              ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary'
              : 'border-line bg-paper/60 hover:bg-surface'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg ${
              postImageCountMode === 'single'
                ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)]'
                : 'bg-surface border border-line text-ink-soft'
            }`}
          >
            🖼️
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-ink">
                خيار 1: صورة واحدة مجمعة للبوست
              </span>
              {postImageCountMode === 'single' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)]">
                  مُفعل حالياً
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              الإعلان بالكامل عبارة عن <strong>صورة واحدة فقط</strong> (سواء بوستر قوالب SVG + React أو صورة مولدة بالذكاء الاصطناعي أو صورة حقيقية مرفوعة) يوضع عليها نصوص الهوية البصرية.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPostImageCountMode('multiple')}
          className={`p-4 rounded-2xl border-2 text-right transition-all flex items-start gap-3.5 ${
            postImageCountMode === 'multiple'
              ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary'
              : 'border-line bg-paper/60 hover:bg-surface'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg ${
              postImageCountMode === 'multiple'
                ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)]'
                : 'bg-surface border border-line text-ink-soft'
            }`}
          >
            🗂️
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-ink">
                خيار 2: مجموعة صور في نفس البوست (كفر رئيسي + صور إضافية)
              </span>
              {postImageCountMode === 'multiple' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)]">
                  مُفعل حالياً
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              يجمع بين <strong>صورة الكفر الرئيسي</strong> (بقوالب البوستات الجاهزة ونصوص الهوية البصرية) <strong>بالإضافة إلى</strong> مجموعة صور إضافية للمنتجات (حقيقية أو مولدة بالذكاء الاصطناعي لكل منتج).
            </p>
          </div>
        </button>
      </div>

      {/* MODE A: SINGLE POST IMAGE */}
      {postImageCountMode === 'single' && (
        <div className="space-y-5 pt-2 animate-in fade-in">
          {/* Sub-Tabs for Single Image Mode */}
          <div className="flex flex-wrap items-center gap-2 bg-paper p-1.5 rounded-2xl border border-line">
            <button
              type="button"
              onClick={() => setSingleVisualTab('svg_template')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                singleVisualTab === 'svg_template'
                  ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>قوالب البوستات الجاهزة (SVG + React) — صورة واحدة مجمعة</span>
            </button>

            <button
              type="button"
              onClick={() => setSingleVisualTab('ai_or_real_images')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                singleVisualTab === 'ai_or_real_images'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Sparkles className="w-4 h-4 text-orange-300" />
              <span>توليد صور بالذكاء الاصطناعي أو صور حقيقية (صورة واحدة)</span>
            </button>
          </div>

          {singleVisualTab === 'svg_template' ? (
            <FacebookSvgTemplateStudio
              selectedProducts={selectedProducts}
              headline={headline}
              subheadline={subheadline}
              badgeText={badgeText}
              ctaText={ctaText}
              discountText={discountText}
              selectedTemplateId={svgTemplateId}
              onSelectTemplate={setSvgTemplateId}
              isMultiImageCover={false}
              currentCoverUrl={singlePostImage}
              onImageGenerated={(url) => setSinglePostImage(url)}
            />
          ) : (
            <div className="space-y-5 p-5 rounded-2xl bg-paper/50 border border-line">
              {/* Upload Real Image */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-black text-ink">
                      أولاً: رفع صورة حقيقية أو تصوير مباشر أو إرفاق صورة المنتج (صورة واحدة للبوست)
                    </h5>
                    <p className="text-xs text-ink-soft">
                      اختر صورة من جهازك أو التقط بالكاميرا ثم اضغط &quot;رفع على الكلاود الآن&quot; ليظهر لك رابطها المباشر، أو أرفق الصورة الأصلية للمنتج المختار.
                    </p>
                  </div>

                  {selectedProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const firstProdImg = selectedProducts
                          .map((p) => p.images?.[0] || p.image)
                          .find(Boolean);
                        if (firstProdImg) {
                          setSinglePostImage(firstProdImg);
                          showToast?.('تم إرفاق الصورة الأصلية للمنتج المختار كصورة للبوست');
                        } else {
                          showToast?.('المنتج المختار لا يحتوي على صورة أصلية', 'error');
                        }
                      }}
                      className="px-3.5 py-2 rounded-btn bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-black transition-all"
                    >
                      + إرفاق الصورة الأصلية للمنتج المختار
                    </button>
                  )}
                </div>

                <ImageUploader
                  multiple={false}
                  enableAiStudio={false}
                  label="صورة البوست الواحد (معاينة محلية ثم رفع على الكلاود)"
                  value={singlePostImage}
                  onChange={(val) => setSinglePostImage(val)}
                />
              </div>

              {/* AI Single Image Generation Box */}
              <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/25 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-black text-purple-600 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>
                        ثانياً: توليد صورة واحدة للبوست بالذكاء الاصطناعي (باستخدام الصورة المرفقة أو البرومبت أو كليهما)
                      </span>
                    </h5>
                    <p className="text-xs text-ink-soft mt-0.5">
                      يأخذ معلوماته تلقائياً من <strong>نصوص الهوية البصرية</strong> بالأعلى ومواصفات المنتجات المختارة، ويمكنه الاعتماد على الصور المرفقة أو البرومبت وحده أو كليهما معاً.
                    </p>
                  </div>

                  {!isImageAiAvailable && (
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/30 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>مفتاح ذكاء الصور غير مفعل في الإعدادات (معطل)</span>
                    </span>
                  )}
                </div>

                <div className={!isImageAiAvailable ? 'opacity-55 pointer-events-none select-none space-y-4' : 'space-y-4'}>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-black text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useAttachedImagesForAi}
                        onChange={(e) => setUseAttachedImagesForAi(e.target.checked)}
                        disabled={!isImageAiAvailable}
                        className="rounded border-line text-purple-600 focus:ring-purple-500"
                      />
                      <span>
                        استخدام الصورة المرفقة / صور المنتجات المختارة كـ Raw Data مع البرومبت (يمكن إلغاء التحديد للاعتماد على البرومبت وحده)
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-ink mb-1.5">
                      برومبت الذكاء الاصطناعي لتصميم صورة البوست (اختياري أو مستقل):
                    </label>
                    <textarea
                      rows={2}
                      disabled={!isImageAiAvailable}
                      value={imageDesignPrompt}
                      onChange={(e) => setImageDesignPrompt(e.target.value)}
                      placeholder="اكتب وصف المشهد الإعلاني المطلوب... مثال: تصميم بوستر إعلاني فخم مع إضاءة سينمائية وإبراز المنتج في المنتصف مع نصوص الهوية البصرية والخصم..."
                      className="w-full bg-surface border border-line rounded-xl p-3 text-xs font-bold text-ink outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={!isImageAiAvailable || generatingAiImage}
                      onClick={() => onGenerateAiAdImage({ targetMode: 'single' })}
                      className="px-6 py-3 rounded-btn bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {generatingAiImage ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري توليد صورة البوست بالذكاء الاصطناعي ورفعها على الكلاود...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-orange-300" />
                          <span>توليد صورة واحدة للبوست بالذكاء الاصطناعي ورفعها للكلاود</span>
                        </>
                      )}
                    </button>

                    <span className="text-[11px] font-bold text-ink-soft">
                      سيتم دمج العنوان: &quot;{headline || 'بدون عنوان'}&quot; والشارة: &quot;{badgeText || discountText || 'بدون شارة'}&quot;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE B: MULTIPLE POST IMAGES */}
      {postImageCountMode === 'multiple' && (
        <div className="space-y-6 pt-2 animate-in fade-in">
          {/* PART 1: Main Cover Image via SVG + React Templates */}
          <div className="p-5 rounded-2xl bg-indigo-500/5 border-2 border-indigo-500/25 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black">
                  أولاً: صورة الكفر الرئيسي للبوست
                </span>
                <h5 className="text-sm font-black text-ink">
                  قوالب البوستات الجاهزة (SVG + React) — توضع كأول صورة رئيسية (Cover) في البوست متعدد الصور
                </h5>
              </div>

              {coverImage && (
                <span className="text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                  ✅ تم اعتماد صورة الكفر الرئيسي على الكلاود
                </span>
              )}
            </div>

            <FacebookSvgTemplateStudio
              selectedProducts={selectedProducts}
              headline={headline}
              subheadline={subheadline}
              badgeText={badgeText}
              ctaText={ctaText}
              discountText={discountText}
              selectedTemplateId={svgTemplateId}
              onSelectTemplate={setSvgTemplateId}
              isMultiImageCover={true}
              currentCoverUrl={coverImage}
              onImageGenerated={(url) => setCoverImage(url)}
            />
          </div>

          {/* CONNECTOR BANNER */}
          <div className="flex items-center justify-center">
            <div className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black shadow-md flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>بالإضافة إلى (تُنشر مع الكفر الرئيسي في نفس البوست)</span>
            </div>
          </div>

          {/* PART 2: Additional Post Images */}
          <div className="p-5 rounded-2xl bg-purple-500/5 border-2 border-purple-500/25 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-black">
                  ثانياً: الصور الإضافية للبوست ({additionalImages.length})
                </span>
                <h5 className="text-sm font-black text-ink">
                  توليد صور بالذكاء الاصطناعي أو صور حقيقية إضافية للمنتجات في نفس البوست
                </h5>
              </div>

              {selectedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const prodImgs = selectedProducts
                      .map((p) => p.images?.[0] || p.image)
                      .filter(Boolean);
                    if (prodImgs.length === 0) {
                      showToast?.('لا توجد صور أصلية محفوظة للمنتجات المختارة', 'error');
                      return;
                    }
                    setAdditionalImages(Array.from(new Set([...additionalImages, ...prodImgs])));
                    showToast?.(`تم إرفاق ${prodImgs.length} صور أصلية للمنتجات كصور إضافية للبوست`);
                  }}
                  className="px-3.5 py-2 rounded-btn bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-black transition-all"
                >
                  + إرفاق الصور الأصلية للمنتجات المختارة ({selectedProducts.length})
                </button>
              )}
            </div>

            {/* Upload or Capture Multiple Real Images */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-ink">
                رفع مجموعة صور أو تصوير مباشر (تُعاين أولاً ثم تُرفع على الكلاود بضغطة زر وتظهر روابطها):
              </label>
              <ImageUploader
                multiple={true}
                enableAiStudio={false}
                label="الصور الإضافية المرفقة في البوست بجانب الكفر الرئيسي"
                value={additionalImages}
                onChange={setAdditionalImages}
              />
            </div>

            {/* AI Per-Product & Multi-Image Generator */}
            <div className="p-4 rounded-2xl bg-surface border border-purple-500/30 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h6 className="text-xs font-black text-purple-600 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      توليد صور إضافية للمنتجات بالذكاء الاصطناعي (بمعلومات وسعر ومواصفات كل منتج على حدة أو ببرومبت مخصص)
                    </span>
                  </h6>
                  <p className="text-[11px] text-ink-soft mt-0.5">
                    في وضع البوست متعدد الصور، يمكنك توليد صورة مخصصة لكل منتج مختار مكتوب عليها اسمه وسعره وأهم مواصفاته مع نصوص الهوية البصرية.
                  </p>
                </div>

                {!isImageAiAvailable && (
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>مفتاح ذكاء الصور غير مفعل في الإعدادات (معطل)</span>
                  </span>
                )}
              </div>

              <div className={!isImageAiAvailable ? 'opacity-55 pointer-events-none select-none space-y-4' : 'space-y-4'}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-black text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAttachedImagesForAi}
                      onChange={(e) => setUseAttachedImagesForAi(e.target.checked)}
                      disabled={!isImageAiAvailable}
                      className="rounded border-line text-purple-600 focus:ring-purple-500"
                    />
                    <span>
                      إرفاق الصورة الأصلية لكل منتج كـ Raw Data للذكاء الاصطناعي أثناء التوليد
                    </span>
                  </label>

                  {selectedProducts.length > 0 && (
                    <button
                      type="button"
                      disabled={!isImageAiAvailable || generatingAllProductsAi || Boolean(generatingProductAiId)}
                      onClick={onGenerateAllProductsAiImages}
                      className="px-4 py-2 rounded-btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {generatingAllProductsAi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري توليد صور لجميع المنتجات المختارة...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-orange-300" />
                          <span>
                            توليد صور بالذكاء الاصطناعي لكل المنتجات المختارة دفعة واحدة ({selectedProducts.length})
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Per-Product AI Prompt & Generate Cards */}
                {selectedProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedProducts.map((prod, idx) => {
                      const prodImg = prod.images?.[0] || prod.image;
                      const isGeneratingThis = generatingProductAiId === prod._id;
                      return (
                        <div
                          key={prod._id}
                          className="p-3 rounded-xl bg-paper border border-line space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            {prodImg && (
                              <img
                                src={prodImg}
                                alt={prod.name}
                                className="w-12 h-12 rounded-lg object-cover border border-line shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-black text-purple-600">
                                صورة المنتج #{idx + 1}
                              </span>
                              <h6 className="text-xs font-black text-ink truncate">
                                {prod.name}
                              </h6>
                              <span className="text-[11px] font-bold text-primary">
                                {prod.price} {currency}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-ink-soft mb-1">
                              برومبت وتوجيه الذكاء الاصطناعي لصورة هذا المنتج:
                            </label>
                            <input
                              type="text"
                              disabled={!isImageAiAvailable}
                              value={perProductPrompts[prod._id] || ''}
                              onChange={(e) =>
                                setPerProductPrompts((prev) => ({
                                  ...prev,
                                  [prod._id]: e.target.value
                                }))
                              }
                              placeholder={`مثال: إبراز ${prod.name} في خلفية عصرية مع كتابة السعر ${prod.price} ج.م...`}
                              className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-ink outline-none focus:border-purple-500"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={!isImageAiAvailable || isGeneratingThis || generatingAllProductsAi}
                            onClick={() => onGenerateSingleProductAiImage(prod)}
                            className="w-full py-2 px-3 rounded-lg bg-purple-600/15 hover:bg-purple-600 hover:text-white text-purple-600 border border-purple-500/30 text-[11px] font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            {isGeneratingThis ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>جاري توليد الصورة ورفعها للكلاود...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>توليد صورة لهذا المنتج وإضافتها للبوست</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-soft bg-paper p-3 rounded-xl border border-line">
                    اختر منتجات من الخطوة (1) بالأعلى ليظهر لك كارت توليد صورة مستقلة لكل منتج، أو استخدم البرومبت العام بالأسفل.
                  </p>
                )}

                {/* General Prompt Box for Extra AI Image */}
                <div className="pt-2 border-t border-line flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="block text-[11px] font-black text-ink mb-1">
                      أو توليد صورة إضافية ببرومبت حر (باستخدام الصور المرفقة أو البرومبت وحده أو كليهما):
                    </label>
                    <input
                      type="text"
                      disabled={!isImageAiAvailable}
                      value={imageDesignPrompt}
                      onChange={(e) => setImageDesignPrompt(e.target.value)}
                      placeholder="اكتب أي وصف لصورة إضافية تريد توليدها وإضافتها لمجموعة صور البوست..."
                      className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!isImageAiAvailable || generatingAiImage}
                    onClick={() => onGenerateAiAdImage({ targetMode: 'multiple' })}
                    className="px-4 py-2.5 rounded-btn bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                  >
                    {generatingAiImage ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري التوليد...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-orange-300" />
                        <span>توليد وإضافة للصورة الإضافية</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Cloud Links & Live Preview Strip */}
      {effectivePostImages.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-700">
              <CloudUpload className="w-4 h-4" />
              <span>
                روابط الكلاود المعتمدة لصور هذا البوست ({effectivePostImages.length} صورة جاهزة للنشر):
              </span>
            </div>

            <button
              type="button"
              onClick={onPreviewPost}
              className="px-3.5 py-1.5 rounded-btn bg-[#1877F2] hover:bg-[#1877F2]/90 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>معاينة شكل البوست في فيسبوك الآن ({effectivePostImages.length} صور)</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {effectivePostImages.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="flex items-center justify-between gap-2 bg-surface/90 border border-line rounded-lg px-2.5 py-1.5 text-[11px]"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-black shrink-0">
                    {postImageCountMode === 'multiple' && idx === 0
                      ? 'كفر رئيسي #1'
                      : `صورة #${idx + 1}`}
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="text-primary hover:underline truncate font-mono"
                  >
                    {url}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    showToast?.('تم نسخ رابط الكلاود للصورة');
                  }}
                  className="px-2 py-0.5 rounded bg-paper hover:bg-primary/10 text-ink font-bold shrink-0 border border-line flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  <span>نسخ الرابط</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
