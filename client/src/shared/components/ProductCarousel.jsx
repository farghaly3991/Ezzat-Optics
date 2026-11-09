import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Maximize2, X, Image as ImageIcon } from 'lucide-react';

export default function ProductCarousel({ images = [], alt = 'صورة المنتج' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Fallback image if empty
  const imageList = images && images.length > 0
    ? images
    : ['https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'];

  const handleNext = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % imageList.length);
  };

  const handlePrev = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Main Image Frame with Controls */}
      <div className="relative aspect-[4/3] sm:aspect-[4/3] max-h-[280px] sm:max-h-none rounded-2xl sm:rounded-3xl overflow-hidden bg-paper border border-line shadow-sm group">
        <img
          src={imageList[currentIndex]}
          alt={`${alt} - صورة ${currentIndex + 1}`}
          className="w-full h-full object-contain sm:object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Counter Badge */}
        {imageList.length > 1 && (
          <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 bg-secondary/70 backdrop-blur-md text-white text-[10px] sm:text-xs font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-md">
            {currentIndex + 1} / {imageList.length}
          </div>
        )}

        {/* Lightbox Trigger Button */}
        <button
          onClick={() => setIsLightboxOpen(true)}
          className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 p-1.5 sm:p-2 rounded-btn bg-surface/90 hover:bg-surface text-ink border border-line backdrop-blur-md shadow-md hover:scale-110 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
          title="عرض مكبّر عالي الدقة"
        >
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Navigation Arrows (visible if more than 1 image) */}
        {imageList.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 sm:p-2.5 rounded-full bg-surface/90 hover:bg-surface text-ink border border-line shadow-xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all opacity-90 sm:opacity-80 sm:group-hover:opacity-100"
              aria-label="الصورة السابقة"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={handleNext}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 p-1.5 sm:p-2.5 rounded-full bg-surface/90 hover:bg-surface text-ink border border-line shadow-xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all opacity-90 sm:opacity-80 sm:group-hover:opacity-100"
              aria-label="الصورة التالية"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Dots Indicator */}
            <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1 sm:gap-1.5">
              {imageList.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                    i === currentIndex ? 'w-5 sm:w-6 bg-primary shadow-md' : 'w-1.5 sm:w-2 bg-ink-soft/40 hover:bg-ink'
                  }`}
                  aria-label={`الانتقال للصورة ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails Gallery Strip */}
      {imageList.length > 1 && (
        <div className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          {imageList.map((imgUrl, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative flex-shrink-0 w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-card overflow-hidden border-2 transition-all duration-200 ${
                idx === currentIndex
                  ? 'border-primary ring-2 sm:ring-4 ring-primary/20 scale-105 shadow-md'
                  : 'border-line opacity-60 hover:opacity-100 hover:border-primary'
              }`}
            >
              <img src={imgUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Zoom Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-6 left-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageList[currentIndex]}
              alt=""
              className="max-h-[80vh] max-w-full rounded-card object-contain shadow-2xl animate-in zoom-in-95 duration-200"
            />

            {imageList.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute right-4 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all hover:scale-110"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute left-4 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all hover:scale-110"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
