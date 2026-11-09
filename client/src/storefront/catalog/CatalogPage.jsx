import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Filter,
  SlidersHorizontal,
  X,
  Search,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Wrench
} from 'lucide-react';
import axios from 'axios';
import ProductCard from '../../shared/components/ProductCard';
import { useStore } from '../../shared/context/StoreContext';

const SORTS = [
  { value: 'latest', label: 'الأحدث أولاً' },
  { value: 'price_asc', label: 'السعر: من الأقل للأعلى' },
  { value: 'price_desc', label: 'السعر: من الأعلى للأقل' },
  { value: 'rating_desc', label: 'الأعلى تقييماً' },
  { value: 'visited_desc', label: 'الأكثر مشاهدة' },
  { value: 'sales_desc', label: 'الأكثر مبيعاً' }
];

export default function Catalog() {
  const { config } = useStore();
  const { catId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const urlType = new URLSearchParams(location.search).get('type') || '';
  const [categoryType, setCategoryType] = useState(urlType);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('type') || '';
    setCategoryType(t);
  }, [location.search]);

  const [categories, setCategories] = useState([]);
  const selectedCategory = catId || '';
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedSpecs, setSelectedSpecs] = useState([]);

  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState([]);
  const [tagsFacet, setTagsFacet] = useState([]);
  const [specsFacet, setSpecsFacet] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [categoryChildren, setCategoryChildren] = useState([]);
  const [categoryTags, setCategoryTags] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Load categories
  useEffect(() => {
    axios
      .get('/api/store-public/categories')
      .then((res) => setCategories(res.data?.categories || []))
      .catch(() => {
        // Fallback to public categories
        axios.get('/api/store-public/home').then((r) => setCategories(r.data?.categories || []));
      });
  }, []);

  // Fetch products with filters
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/store-public/filter', {
        categoryId: selectedCategory || undefined,
        categoryType: categoryType || undefined,
        search: search.trim() || undefined,
        tags: selectedTags,
        specFilters: selectedSpecs.filter((s) => s.values.length > 0),
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sortBy,
        page,
        pageSize: 20
      });

      setProducts(res.data?.products || []);
      setTagsFacet(res.data?.tagsFacet || []);
      setSpecsFacet(res.data?.specsFacet || []);
      setCurrentCategory(res.data?.category || null);
      setCategoryChildren(res.data?.categoryChildren || []);
      setCategoryTags(res.data?.categoryTags || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    } catch (err) {
      console.error('Error fetching catalog products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCategory, selectedTags, selectedSpecs, sortBy, page, categoryType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const toggleTag = (t) => {
    setPage(1);
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const toggleSpecValue = (specKey, specVal) => {
    setPage(1);
    setSelectedSpecs((prev) => {
      const existing = prev.find((s) => s.spec === specKey);
      if (!existing) {
        return [...prev, { spec: specKey, values: [specVal] }];
      }
      const values = existing.values.includes(specVal)
        ? existing.values.filter((v) => v !== specVal)
        : [...existing.values, specVal];

      return values.length > 0
        ? prev.map((s) => (s.spec === specKey ? { spec: specKey, values } : s))
        : prev.filter((s) => s.spec !== specKey);
    });
  };

  const resetAllFilters = () => {
    navigate('/catalog');
    setSelectedTags([]);
    setSelectedSpecs([]);
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('latest');
    setPage(1);
  };

  const activeFiltersCount =
    (selectedCategory ? 1 : 0) +
    selectedTags.length +
    selectedSpecs.reduce((sum, s) => sum + s.values.length, 0) +
    (minPrice || maxPrice ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Title & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-ink">كتالوج المنتجات والخدمات</h2>
          <p className="text-xs text-ink-soft font-bold mt-1">
            إجمالي {total} عنصر متوفر
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Mobile Filter Toggle Button */}
          <button
            onClick={() => setIsMobileFiltersOpen(true)}
            className="lg:hidden flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-card bg-surface border border-line text-xs font-bold text-ink shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span>الفلاتر ({activeFiltersCount})</span>
          </button>

          {/* Sort Dropdown */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="w-full bg-surface border border-line rounded-card px-4 py-2.5 text-xs font-bold text-ink outline-none focus:border-primary shadow-sm appearance-none pl-9"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Category Type Tabs (الكل vs المنتجات vs الخدمات) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setCategoryType('');
            setPage(1);
            navigate('/catalog', { replace: true });
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            !categoryType
              ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
              : 'bg-surface hover:bg-paper text-ink border border-line'
          }`}
        >
          الكل
        </button>

        <button
          onClick={() => {
            setCategoryType('product');
            setPage(1);
            navigate('/catalog?type=product', { replace: true });
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            categoryType === 'product'
              ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
              : 'bg-surface hover:bg-paper text-ink border border-line'
          }`}
        >
          <span>📦 المنتجات والمشتريات</span>
        </button>

        <button
          onClick={() => {
            setCategoryType('service');
            setPage(1);
            navigate('/catalog?type=service', { replace: true });
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            categoryType === 'service'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-orange-700 dark:text-orange-300 border border-orange-500/30'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>🔧 الخدمات وأعمال الصيانة</span>
        </button>
      </div>

      {/* Categories Horizontal Chips Bar */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => { navigate('/catalog'); setPage(1); }}
            className={`px-4 py-2 rounded-card text-xs font-black whitespace-nowrap transition-all ${
              selectedCategory === ''
                ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-md'
                : 'bg-surface text-ink border border-line hover:bg-paper'
            }`}
          >
            جميع الأقسام
          </button>
          {categories
            .filter((c) => !c.parentId || selectedCategory === c._id)
            .map((c) => (
              <button
                key={c._id}
                onClick={() => { navigate(`/catalog/${c._id}`); setPage(1); }}
                className={`px-4 py-2 rounded-card text-xs font-black whitespace-nowrap transition-all ${
                  selectedCategory === c._id
                    ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-md'
                    : 'bg-surface text-ink border border-line hover:bg-paper'
                }`}
              >
                {c.name}
              </button>
            ))}
        </div>

        {/* Subcategories & Tags Bar (acting as subcategories) */}
        {selectedCategory && (categoryChildren.length > 0 || categoryTags.length > 0) && (
          <div className="p-4 bg-surface border border-line rounded-card space-y-3 shadow-sm animate-in fade-in">
            {/* Child categories if any */}
            {categoryChildren.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-xs font-black text-ink-soft whitespace-nowrap flex items-center gap-1">
                  <span>📂</span> الفئات التابعة:
                </span>
                {categoryChildren.map((child) => (
                  <button
                    key={child._id}
                    onClick={() => { navigate(`/catalog/${child._id}`); setPage(1); }}
                    className="text-xs font-bold px-3 py-1.5 rounded-btn border border-line hover:border-primary bg-paper hover:bg-surface text-ink transition-all whitespace-nowrap shadow-xs"
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )}

            {/* Tags acting as subcategories */}
            {categoryTags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-xs font-black text-ink-soft whitespace-nowrap flex items-center gap-1">
                  <span>🏷️</span> التصنيفات الفرعية:
                </span>
                <button
                  onClick={() => setSelectedTags([])}
                  className={`text-xs font-bold px-3 py-1.5 rounded-btn transition-all whitespace-nowrap ${
                    selectedTags.length === 0
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                      : 'bg-paper text-ink-soft border border-line hover:text-ink'
                  }`}
                >
                  الكل
                </button>
                {categoryTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-btn border transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-primary border-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                          : 'bg-paper border-line hover:border-primary text-ink-soft hover:text-ink'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Grid with Sidebar Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block space-y-6">
          <div className="p-5 space-y-6 bg-surface border border-line rounded-card text-ink shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <span className="text-sm font-black text-ink flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-primary" />
                <span>تصفية النتائج</span>
              </span>

              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 font-bold"
                >
                  <RotateCcw className="w-3 h-3" /> إعادة تعيين
                </button>
              )}
            </div>

            {/* Keyword Search */}
            <div>
              <label className="block text-xs font-extrabold text-ink-soft mb-2">البحث بالاسم</label>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث..."
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs text-ink outline-none focus:border-primary placeholder:text-ink-soft/50"
                />
                <button type="submit" className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  <Search className="w-3.5 h-3.5 text-ink-soft" />
                </button>
              </form>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-xs font-extrabold text-ink-soft mb-2">النطاق السعري</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="من"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full bg-paper border border-line rounded-btn px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary text-center"
                />
                <span className="text-ink-soft text-xs">-</span>
                <input
                  type="number"
                  placeholder="إلى"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-paper border border-line rounded-btn px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary text-center"
                />
              </div>
              <button
                onClick={() => { setPage(1); fetchProducts(); }}
                className="w-full mt-2 py-2 bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs rounded-btn transition-colors shadow-sm"
              >
                تطبيق السعر
              </button>
            </div>

            {/* Tags Facet */}
            {tagsFacet.length > 0 && (
              <div>
                <label className="block text-xs font-extrabold text-ink-soft mb-2">الوسوم</label>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {tagsFacet.map((t) => {
                    const isSelected = selectedTags.includes(t.tag);
                    return (
                      <button
                        key={t.tag}
                        onClick={() => toggleTag(t.tag)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-btn transition-all ${
                          isSelected
                            ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                            : 'bg-paper hover:bg-surface text-ink-soft hover:text-ink border border-line'
                        }`}
                      >
                        <span>{t.tag}</span>
                        <span className="text-[10px] opacity-70 mr-1">({t.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Specs Facets */}
            {specsFacet.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-line">
                <label className="block text-xs font-extrabold text-ink">المواصفات</label>
                {specsFacet.map((sf) => (
                  <div key={sf.spec} className="space-y-1.5">
                    <span className="text-xs font-bold text-ink block">{sf.label || sf.spec}:</span>
                    <div className="flex flex-wrap gap-1">
                      {sf.values.map((v) => {
                        const isSelected = selectedSpecs
                          .find((s) => s.spec === sf.spec)
                          ?.values.includes(v.value);
                        return (
                          <button
                            key={v.value}
                            onClick={() => toggleSpecValue(sf.spec, v.value)}
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-primary border-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                                : 'bg-paper border-line hover:border-primary text-ink-soft hover:text-ink'
                            }`}
                          >
                            <span>{v.value}</span>
                            <span className="text-[9px] opacity-70 mr-1">({v.count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Products Grid */}
        <div className="lg:col-span-3 space-y-8">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 bg-paper border border-line rounded-card" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center space-y-4 bg-surface border border-line rounded-card text-ink">
              <div className="w-16 h-16 rounded-full bg-paper border border-line text-ink-soft flex items-center justify-center mx-auto text-3xl">
                🔍
              </div>
              <h3 className="text-lg font-black text-ink">لا توجد منتجات مطابقة لخيارات الفلترة</h3>
              <p className="text-xs text-ink-soft max-w-sm mx-auto">
                جرب تغيير خيارات البحث، إزالة بعض الوسوم أو مسح الفلاتر لعرض مزيد من المنتجات.
              </p>
              <button
                onClick={resetAllFilters}
                className="px-5 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-bold shadow-md hover:bg-primary/90 transition-colors"
              >
                إعادة تعيين كافة الفلاتر
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((prod) => (
                <ProductCard key={prod._id} product={prod} />
              ))}
            </div>
          )}

          {/* Server Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2.5 rounded-card border border-line bg-surface text-ink hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              {Array.from({ length: pages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className={`w-9 h-9 rounded-card font-black text-xs transition-all ${
                    page === num
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-md'
                      : 'bg-surface border border-line text-ink hover:bg-paper'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="p-2.5 rounded-card border border-line bg-surface text-ink hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="absolute inset-0" onClick={() => setIsMobileFiltersOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-xs bg-surface text-ink shadow-2xl flex flex-col justify-between p-5 border-l border-line animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <span className="text-sm font-black text-ink flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <span>تصفية النتائج</span>
                </span>
                <button
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="p-1.5 rounded-lg text-ink-soft hover:bg-paper"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {/* Keyword Search */}
                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1.5">البحث بالاسم</label>
                  <form
                    onSubmit={(e) => {
                      handleSearchSubmit(e);
                      setIsMobileFiltersOpen(false);
                    }}
                    className="relative"
                  >
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ابحث..."
                      className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs text-ink outline-none focus:border-primary"
                    />
                    <button type="submit" className="absolute left-2.5 top-1/2 -translate-y-1/2">
                      <Search className="w-3.5 h-3.5 text-ink-soft" />
                    </button>
                  </form>
                </div>

                {/* Price Filter */}
                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1.5">النطاق السعري</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="من"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-full bg-paper border border-line rounded-btn px-2 py-1.5 text-xs text-center"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder="إلى"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full bg-paper border border-line rounded-btn px-2 py-1.5 text-xs text-center"
                    />
                  </div>
                </div>

                {/* Tags */}
                {tagsFacet.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1.5">الوسوم</label>
                    <div className="flex flex-wrap gap-1">
                      {tagsFacet.map((t) => {
                        const isSelected = selectedTags.includes(t.tag);
                        return (
                          <button
                            key={t.tag}
                            onClick={() => toggleTag(t.tag)}
                            className={`text-xs font-bold px-2 py-1 rounded-btn border ${
                              isSelected
                                ? 'bg-primary border-primary text-[var(--color-primary-contrast,#ffffff)]'
                                : 'bg-paper border-line text-ink-soft'
                            }`}
                          >
                            {t.tag} ({t.count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Specs */}
                {specsFacet.length > 0 && (
                  <div className="space-y-4 pt-3 border-t border-line">
                    <label className="block text-xs font-bold text-ink">المواصفات</label>
                    {specsFacet.map((sf) => (
                      <div key={sf.spec} className="space-y-1">
                        <span className="text-xs font-bold text-ink block">{sf.label || sf.spec}:</span>
                        <div className="flex flex-wrap gap-1">
                          {sf.values.map((v) => {
                            const isSelected = selectedSpecs
                              .find((s) => s.spec === sf.spec)
                              ?.values.includes(v.value);
                            return (
                              <button
                                key={v.value}
                                onClick={() => toggleSpecValue(sf.spec, v.value)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                                  isSelected
                                    ? 'bg-primary border-primary text-[var(--color-primary-contrast,#ffffff)]'
                                    : 'bg-paper border-line text-ink-soft'
                                }`}
                              >
                                {v.value} ({v.count})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-line flex gap-2">
                <button
                  onClick={() => {
                    fetchProducts();
                    setIsMobileFiltersOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs shadow-sm"
                >
                  تطبيق الفلاتر
                </button>
                <button
                  onClick={() => {
                    resetAllFilters();
                    setIsMobileFiltersOpen(false);
                  }}
                  className="px-3 py-2.5 rounded-btn border border-line text-ink-soft text-xs font-bold"
                >
                  إعادة ضبط
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
