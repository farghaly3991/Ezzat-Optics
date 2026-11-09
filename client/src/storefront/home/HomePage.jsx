import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import HeroBanner from './components/HeroBanner';
import OffersSection from './components/OffersSection';
import PersonalizedSection from './components/PersonalizedSection';
import SmartSpecsBar from '../catalog/components/SmartSpecsBar';
import ProductCard from '../../shared/components/ProductCard';
import { Sparkles, Flame, Eye, PackagePlus, ArrowLeft, Layers, Wrench } from 'lucide-react';

export default function Home({ onSelectSpec }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    axios
      .get('/api/store-public/home')
      .then((res) => setData(res.data))
      .catch((err) => console.error('Error loading home data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 animate-pulse">
        <div className="h-80 bg-ink-soft/15 rounded-3xl w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-ink-soft/15 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  const {
    categories = [],
    activeOffers = [],
    bestSellers = [],
    topDeals = [],
    mostVisited = [],
    latest = [],
    smartSpecs = [],
    featuredServices = [],
    serviceCategories = []
  } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-12 animate-fadeIn">
      {/* 1. Hero Section */}
      <HeroBanner onExplore={() => navigate('/catalog')} />

      {/* 2. Categories Horizontal Grid */}
      {categories.length > 0 && (
        <section className="space-y-4 animate-slideUp">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-ink flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <span>تصفح حسب الأقسام والتصنيفات</span>
            </h3>
            <button
              onClick={() => navigate('/catalog')}
              className="text-xs font-bold text-primary hover:text-primary flex items-center gap-1"
            >
              <span>جميع الأقسام</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div
                key={cat._id}
                onClick={() => navigate(`/catalog/${cat._id}`)}
                className="group relative rounded-card overflow-hidden aspect-[4/3] cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border border-line"
              >
                <img
                  src={cat.image || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800&auto=format&fit=crop&q=80'}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent flex flex-col justify-end p-4 text-white">
                  <h4 className="font-black text-sm sm:text-base group-hover:text-blue-400 transition-colors">
                    {cat.name}
                  </h4>
                  <span className="text-[11px] text-slate-300 font-medium">
                    {cat.productsCount || 0} منتج متاح
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Promotional Offers Section */}
      <OffersSection offers={activeOffers} />

      {/* 4. Smart Specs Bar */}
      <SmartSpecsBar smartSpecs={smartSpecs} onSelectSpec={onSelectSpec} />

      {/* 5. Recommended For You Section (Personalized) */}
      <PersonalizedSection />

      {/* 6. Best Sellers Section */}
      {bestSellers.length > 0 && (
        <section className="space-y-4 animate-slideUp" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
                <Flame className="w-6 h-6 text-red-500 fill-current" />
                <span>الأكثر مبيعاً ورواجاً</span>
              </h3>
              <p className="text-xs text-ink-soft font-bold mt-0.5">
                المنتجات التي حازت على ثقة واختيار مئات العملاء
              </p>
            </div>

            <button
              onClick={() => navigate('/catalog')}
              className="text-xs font-bold text-primary hover:text-primary flex items-center gap-1"
            >
              <span>عرض المزيد</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {bestSellers.map((prod) => (
              <ProductCard key={prod._id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* 7. Top Deals Section */}
      {topDeals.length > 0 && (
        <section className="space-y-4 animate-slideUp" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-orange-500 fill-current" />
                <span>أقوى التخفيضات والخصومات</span>
              </h3>
              <p className="text-xs text-ink-soft font-bold mt-0.5">
                وفر الكثير مع صفقاتنا الحصرية وتخفيضات الأسعار الكبرى
              </p>
            </div>

            <button
              onClick={() => navigate('/catalog')}
              className="text-xs font-bold text-primary hover:text-primary flex items-center gap-1"
            >
              <span>عرض المزيد</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {topDeals.map((prod) => (
              <ProductCard key={prod._id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* 8. Most Visited Section */}
      {mostVisited.length > 0 && (
        <section className="space-y-4 animate-slideUp" style={{animationDelay: '0.3s'}}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" />
                <span>الأكثر مشاهدة واهتماماً</span>
              </h3>
              <p className="text-xs text-ink-soft font-bold mt-0.5">
                المنتجات التي يتصفحها الزوار باستمرار
              </p>
            </div>

            <button
              onClick={() => navigate('/catalog')}
              className="text-xs font-bold text-primary hover:text-primary flex items-center gap-1"
            >
              <span>عرض المزيد</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {mostVisited.map((prod) => (
              <ProductCard key={prod._id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* 9. Latest Products Section */}
      {latest.length > 0 && (
        <section className="space-y-4 animate-slideUp" style={{animationDelay: '0.4s'}}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
                <PackagePlus className="w-6 h-6 text-emerald-600" />
                <span>وصل حديثاً إلى المتجر</span>
              </h3>
              <p className="text-xs text-ink-soft font-bold mt-0.5">
                أحدث الإضافات والتقنيات المعاصرة
              </p>
            </div>

            <button
              onClick={() => navigate('/catalog')}
              className="text-xs font-bold text-primary hover:text-primary flex items-center gap-1"
            >
              <span>عرض الكتالوج</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {latest.map((prod) => (
              <ProductCard key={prod._id} product={prod} />
            ))}
          </div>
        </section>
      )}

      {/* 10. Services Section (خدمات التركيب والصيانة المعتمدة) */}
      {(featuredServices.length > 0 || serviceCategories.length > 0) && (
        <section className="space-y-5 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 via-surface to-orange-500/5 border border-line shadow-md animate-slideUp">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-950 dark:text-orange-100 text-xs font-black mb-2">
                <Wrench className="w-3.5 h-3.5" />
                <span>خدمات معتمدة ومضمونة</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-ink">
                خدمات التركيب والصيانة المعتمدة
              </h3>
              <p className="text-xs text-ink-soft font-bold mt-1">
                فنيون متخصصون وأسعار واضحة ودفع بعد إتمام وتنفيذ الخدمة بنجاح
              </p>
            </div>

            <button
              onClick={() => navigate('/catalog?type=service')}
              className="px-4 py-2.5 rounded-btn bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-95"
            >
              <span>تصفح جميع الخدمات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {featuredServices.map((srv) => (
              <ProductCard key={srv._id} product={srv} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
