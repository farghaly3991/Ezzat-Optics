import React from 'react';
import { Sparkles, ArrowLeft, ShieldCheck, Zap, RotateCcw } from 'lucide-react';
import { useStore } from '../../../shared/context/StoreContext';

export default function HeroBanner({ onExplore }) {
  const { config } = useStore();

  const bgStyle = config?.backgroundImage
    ? { background: `url(${config.backgroundImage}) center/cover no-repeat` }
    : {};

  return (
    <section 
      className="relative rounded-3xl overflow-hidden shadow-2xl text-white p-6 sm:p-12 mb-10 border border-line animate-fadeIn"
      style={bgStyle}
    >
      {!config?.backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary to-secondary z-0" />
      )}
      {config?.backgroundImage && (
        <div className="absolute inset-0 bg-slate-900/70 z-0" />
      )}

      {/* Decorative SVG Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30 overflow-hidden">
        {/* Waves */}
        <svg className="absolute bottom-0 w-full h-24 text-primary animate-float" viewBox="0 0 1440 320" fill="currentColor" preserveAspectRatio="none">
          <path d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
        {/* Circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl space-y-6 animate-slideUp">
        {config?.logo && (
          <img src={config.logo} alt="Logo" className="h-16 w-auto object-contain mb-4 animate-float" />
        )}
        
        {!config?.logo && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 border border-primary/50 text-white text-xs font-black">
            <Sparkles className="w-3.5 h-3.5" />
            <span>موسم العروض الحصرية</span>
          </div>
        )}

        <h2 className="text-3xl sm:text-5xl font-black tracking-tight flex flex-col gap-3 sm:gap-4 leading-normal">
          <span className="text-white">
            ارتقِ بتجربتك الرقمية مع
          </span>
          <span className="text-highlight">
            {config?.siteName || 'أحدث الأجهزة'}
          </span>
        </h2>

        <p className="text-slate-200 text-sm sm:text-base leading-relaxed max-w-lg font-medium">
          {config?.siteDescription || 'استكشف تشكيلة استثنائية من المنتجات الرائدة بأفضل الأسعار مع ضمان محلي وشحن سريع حتى باب منزلك.'}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => onExplore('catalog')}
            className="px-6 py-3.5 rounded-card bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-extrabold text-sm shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <span>تصفح الكتالوج بالكامل</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Highlights Row */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/15 text-xs text-slate-300 font-bold">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-highlight" />
            <span>توصيل فوري خلال 24-48 ساعة</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>منتجات أصلية معتمدة 100%</span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span>دفع آمن عند الاستلام وPaymob</span>
          </div>
        </div>
      </div>
    </section>
  );
}
