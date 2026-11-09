import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  ThumbsUp,
  MessageCircle,
  Share2,
  Globe,
  MoreHorizontal,
  Edit3,
  Copy,
  ExternalLink,
  Grid,
  GalleryHorizontal,
  Check
} from 'lucide-react';

/**
 * FacebookPostPreviewModal
 * يعرض البوست كما يظهر في فيسبوك بالضبط:
 * - ترويسة صفحة المتجر + النص الكامل للبوست
 * - شبكة صور فيسبوك الواقعية (1، 2، 3، 4، أو +N عند وجود أكثر من 4 صور)
 * - كاروسيل تفاعلي للتنقل بين جميع الصور يميناً ويساراً واستعراض كل صورة بحجم كامل
 */
export default function FacebookPostPreviewModal({
  post,
  isOpen,
  onClose,
  onLoadIntoEditor,
  storeName = 'المتجر العصري',
  storeLogo = ''
}) {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'carousel'
  const [activeSlide, setActiveSlide] = useState(0);
  const [expandText, setExpandText] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setViewMode('grid');
      setActiveSlide(0);
      setExpandText(true);
    }
  }, [isOpen, post?._id]);

  if (!isOpen || !post) return null;

  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  const totalImages = images.length;
  const remainingCount = totalImages > 4 ? totalImages - 4 : 0;

  const openCarouselAt = (idx) => {
    setActiveSlide(idx);
    setViewMode('carousel');
  };

  const nextSlide = () => {
    if (totalImages <= 1) return;
    setActiveSlide((prev) => (prev + 1) % totalImages);
  };

  const prevSlide = () => {
    if (totalImages <= 1) return;
    setActiveSlide((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  const postText = post.postText || '';
  const isLongText = postText.length > 320;
  const displayedText =
    !expandText && isLongText ? `${postText.slice(0, 320)}...` : postText;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface text-ink rounded-3xl border border-line shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Control Bar */}
        <div className="px-5 py-3.5 bg-paper border-b border-line flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#1877F2]/15 text-[#1877F2] flex items-center justify-center font-black text-sm">
              f
            </span>
            <div>
              <h4 className="text-sm font-black text-ink">
                معاينة البوست كما سيظهر على فيسبوك
              </h4>
              <p className="text-[11px] text-ink-soft">
                {totalImages === 0
                  ? 'بوست نصي بدون صور'
                  : totalImages === 1
                  ? 'بوست بصورة واحدة مجمعة'
                  : `بوست متعدد الصور (${totalImages} صور — كفر رئيسي + صور إضافية)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalImages > 1 && (
              <div className="flex items-center bg-surface border border-line rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-[#1877F2] text-white shadow-xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>شبكة فيسبوك</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('carousel')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all ${
                    viewMode === 'carousel'
                      ? 'bg-[#1877F2] text-white shadow-xs'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <GalleryHorizontal className="w-3.5 h-3.5" />
                  <span>تقليب الصور ({totalImages})</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-surface border border-line text-ink-soft hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Authentic Facebook Post Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#F0F2F5] dark:bg-slate-950 flex-1">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden mx-auto max-w-xl">
            {/* Facebook Page Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {storeLogo ? (
                  <img
                    src={storeLogo}
                    alt={storeName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1877F2] to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-xs">
                    {storeName.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <h5 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                      {storeName}
                    </h5>
                    <span className="w-4 h-4 rounded-full bg-[#1877F2] text-white text-[9px] flex items-center justify-center font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>
                      {post.scheduledAt && post.status === 'scheduled'
                        ? `مجدول: ${new Date(post.scheduledAt).toLocaleString('ar-EG', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}`
                        : 'الآن'}
                    </span>
                    <span>·</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Post Copy Text */}
            {postText && (
              <div className="px-4 pb-3 text-right" dir="rtl">
                <p className="text-[13px] leading-relaxed whitespace-pre-line font-medium text-slate-800 dark:text-slate-100">
                  {displayedText}
                </p>
                {isLongText && (
                  <button
                    type="button"
                    onClick={() => setExpandText((prev) => !prev)}
                    className="text-xs font-black text-[#1877F2] hover:underline mt-1"
                  >
                    {expandText ? 'عرض أقل' : 'عرض المزيد...'}
                  </button>
                )}
              </div>
            )}

            {/* Post Visuals: Either Facebook Photo Grid OR Interactive Photo Carousel */}
            {totalImages > 0 && (
              <div className="border-t border-b border-slate-200 dark:border-slate-800 bg-black relative">
                {viewMode === 'grid' ? (
                  /* FACEBOOK PHOTO GRID VIEW */
                  <div>
                    {totalImages === 1 && (
                      <div
                        onClick={() => openCarouselAt(0)}
                        className="cursor-pointer relative group overflow-hidden"
                      >
                        <img
                          src={images[0]}
                          alt="Post cover"
                          className="w-full max-h-[500px] object-contain mx-auto bg-slate-950 group-hover:scale-[1.01] transition-transform"
                        />
                      </div>
                    )}

                    {totalImages === 2 && (
                      <div className="grid grid-cols-2 gap-1 bg-white dark:bg-slate-900">
                        {images.slice(0, 2).map((imgUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => openCarouselAt(idx)}
                            className="aspect-square cursor-pointer overflow-hidden relative group bg-slate-950"
                          >
                            <img
                              src={imgUrl}
                              alt={`Slide ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {totalImages === 3 && (
                      <div className="grid grid-cols-2 gap-1 bg-white dark:bg-slate-900 h-[420px]">
                        <div
                          onClick={() => openCarouselAt(0)}
                          className="h-full cursor-pointer overflow-hidden relative group bg-slate-950"
                        >
                          <img
                            src={images[0]}
                            alt="Main Cover"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
                            الكفر الرئيسي
                          </span>
                        </div>
                        <div className="grid grid-rows-2 gap-1 h-full">
                          {images.slice(1, 3).map((imgUrl, idx) => (
                            <div
                              key={idx + 1}
                              onClick={() => openCarouselAt(idx + 1)}
                              className="h-full cursor-pointer overflow-hidden relative group bg-slate-950"
                            >
                              <img
                                src={imgUrl}
                                alt={`Slide ${idx + 2}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {totalImages >= 4 && (
                      <div className="grid grid-cols-2 gap-1 bg-white dark:bg-slate-900">
                        {images.slice(0, 4).map((imgUrl, idx) => {
                          const isLastTileWithMore = idx === 3 && remainingCount > 0;
                          return (
                            <div
                              key={idx}
                              onClick={() => openCarouselAt(idx)}
                              className="aspect-square cursor-pointer overflow-hidden relative group bg-slate-950"
                            >
                              <img
                                src={imgUrl}
                                alt={`Slide ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              {idx === 0 && (
                                <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-bold">
                                  الكفر الرئيسي
                                </span>
                              )}
                              {isLastTileWithMore && (
                                <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center text-white transition-all group-hover:bg-black/55">
                                  <span className="text-3xl sm:text-4xl font-black tracking-tight">
                                    +{remainingCount}
                                  </span>
                                  <span className="text-[11px] font-bold text-white/90 mt-1">
                                    اضغط لتقليب كل الصور ({totalImages})
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* INTERACTIVE CAROUSEL VIEW */
                  <div className="relative bg-slate-950 select-none">
                    <div className="relative h-[420px] sm:h-[460px] flex items-center justify-center overflow-hidden">
                      <img
                        src={images[activeSlide]}
                        alt={`Slide ${activeSlide + 1}`}
                        className="max-w-full max-h-full object-contain transition-all duration-300"
                      />

                      {/* Counter Pill */}
                      <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/75 text-white text-xs font-black border border-white/15">
                        صورة {activeSlide + 1} من {totalImages}
                        {activeSlide === 0 && totalImages > 1 ? ' (الكفر الرئيسي)' : ''}
                      </div>

                      {/* Copy Cloud URL Pill */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(images[activeSlide])}
                        className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/75 hover:bg-black text-white text-[11px] font-bold border border-white/15 flex items-center gap-1.5"
                      >
                        {copiedUrl === images[activeSlide] ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">تم نسخ رابط الكلاود</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ رابط الصورة</span>
                          </>
                        )}
                      </button>

                      {/* Prev / Next Controls */}
                      {totalImages > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={prevSlide}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/65 hover:bg-black text-white flex items-center justify-center border border-white/20 shadow-lg transition-all"
                            title="الصورة السابقة"
                          >
                            <ChevronRight className="w-6 h-6" />
                          </button>
                          <button
                            type="button"
                            onClick={nextSlide}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/65 hover:bg-black text-white flex items-center justify-center border border-white/20 shadow-lg transition-all"
                            title="الصورة التالية"
                          >
                            <ChevronLeft className="w-6 h-6" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Thumbnails Strip */}
                    {totalImages > 1 && (
                      <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {images.map((imgUrl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveSlide(idx)}
                            className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                              activeSlide === idx
                                ? 'border-[#1877F2] scale-105 shadow-md'
                                : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={imgUrl}
                              alt={`Thumb ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/75 text-white text-[9px] font-black">
                              {idx + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Simulated Facebook Engagement Stats & Action Buttons */}
            <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[10px]">
                  👍
                </span>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] -mr-2">
                  ❤️
                </span>
                <span className="mr-1 font-bold">أنت و 148 آخرين</span>
              </div>
              <div className="flex items-center gap-3">
                <span>34 تعليقاً</span>
                <span>12 مشاركة</span>
              </div>
            </div>

            <div className="px-2 py-1 grid grid-cols-3 gap-1 text-slate-600 dark:text-slate-300 text-xs font-bold">
              <button
                type="button"
                className="py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
              >
                <ThumbsUp className="w-4 h-4" />
                <span>أعجبني</span>
              </button>
              <button
                type="button"
                className="py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تعليق</span>
              </button>
              <button
                type="button"
                className="py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-paper border-t border-line flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {onLoadIntoEditor && (
              <button
                type="button"
                onClick={() => {
                  onLoadIntoEditor(post);
                  onClose();
                }}
                className="px-4 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black flex items-center gap-1.5 shadow-sm hover:opacity-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>استرجاع وتعديل هذا البوست في الاستوديو بالأعلى</span>
              </button>
            )}

            {post.fbPostUrl && (
              <a
                href={post.fbPostUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-btn bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/30 text-xs font-black flex items-center gap-1.5 hover:bg-[#1877F2]/20"
              >
                <span>فتح على فيسبوك</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-btn bg-surface border border-line text-xs font-bold text-ink hover:bg-paper"
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    </div>
  );
}
