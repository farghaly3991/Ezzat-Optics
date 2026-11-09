import React from 'react';
import {
  Layers,
  Sparkles,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';
import DashboardProductFilterBar from '../../shared/DashboardProductFilterBar';

export default function FacebookProductPicker({
  products = [],
  totalProducts = 0,
  loadingProducts = false,
  page = 1,
  pages = 1,
  setPage,
  categories = [],
  categoryChildren = [],
  selectedCategory,
  onSelectCategory,
  tagsFacet = [],
  selectedTags = [],
  onToggleTag,
  specsFacet = [],
  selectedSpecs = [],
  onToggleSpecValue,
  search,
  setSearch,
  sortBy,
  setSortBy,
  stockFilter,
  setStockFilter,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  onResetFilters,
  selectedProducts = [],
  onToggleProductSelection,
  onResetStudioEditor,
  editingPostId,
  currency = 'ج.م'
}) {
  return (
    <div className="rounded-card bg-surface border border-line p-5 sm:p-6 space-y-5 shadow-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h4 className="text-base font-black text-ink flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs flex items-center justify-center font-black">
              1
            </span>
            <Layers className="w-5 h-5 text-primary" />
            <span>
              اختيار منتجات الإعلان (تم اختيار{' '}
              <strong className="text-primary">{selectedProducts.length}</strong> منتج)
            </span>
          </h4>
          <p className="text-xs text-ink-soft mt-0.5">
            يمكنك اختيار منتج واحد، أو اختيار عدة منتجات لنشرها معاً في بوست واحد كباكدج أو ألبوم صور
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editingPostId && (
            <span className="text-xs font-black text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/25">
              قيد تعديل بوست محفوظ ✏️
            </span>
          )}
          <button
            type="button"
            onClick={onResetStudioEditor}
            className="px-3.5 py-1.5 rounded-btn bg-paper hover:bg-surface border border-line text-ink-soft hover:text-ink text-xs font-bold flex items-center gap-1.5 transition-all"
            title="تفريغ الاستوديو وبدء إنشاء بوست جديد"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بوست جديد فارغ</span>
          </button>
        </div>
      </div>

      {/* Selected Products Chips Bar */}
      {selectedProducts.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 space-y-2">
          <div className="flex items-center justify-between text-xs font-black text-primary">
            <span>المنتجات المختارة حالياً للإعلان ({selectedProducts.length}):</span>
            <span className="text-[11px] font-normal text-ink-soft">
              اضغط على أي منتج لإزالته من الاختيار
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((p) => (
              <div
                key={p._id}
                onClick={() => onToggleProductSelection(p)}
                className="cursor-pointer group px-3 py-1.5 rounded-xl bg-surface border border-primary/30 flex items-center gap-2 shadow-xs hover:border-red-500 hover:bg-red-500/10 transition-all"
              >
                <div className="w-6 h-6 rounded-md overflow-hidden bg-paper shrink-0">
                  <img
                    src={p.images?.[0] || p.image || 'https://via.placeholder.com/48'}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs font-black text-ink group-hover:text-red-500 truncate max-w-[150px]">
                  {p.name}
                </span>
                {p.signalBadge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {p.signalBadge}
                  </span>
                )}
                <span className="text-[11px] font-bold text-primary">
                  {p.price} {currency}
                </span>
                <X className="w-3.5 h-3.5 text-ink-soft group-hover:text-red-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Filter Bar Component */}
      <DashboardProductFilterBar
        categories={categories}
        categoryChildren={categoryChildren}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        tagsFacet={tagsFacet}
        selectedTags={selectedTags}
        onToggleTag={onToggleTag}
        specsFacet={specsFacet}
        selectedSpecs={selectedSpecs}
        onToggleSpecValue={onToggleSpecValue}
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        onResetFilters={onResetFilters}
        totalProducts={totalProducts}
        loadingProducts={loadingProducts}
      />

      {/* Products Selection Grid */}
      <div className="rounded-card bg-surface border border-line p-4 space-y-4">
        {loadingProducts && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 animate-pulse">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="h-44 rounded-xl bg-paper border border-line" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center space-y-2 text-ink-soft">
            <p className="text-sm font-black text-ink">لا توجد منتجات مطابقة للفلاتر الحالية</p>
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-bold"
            >
              عرض كافة المنتجات
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map((prod) => {
              const isSelected = selectedProducts.some((p) => p._id === prod._id);
              const specValues = Object.values(prod.specs || {}).filter(Boolean).slice(0, 2);

              return (
                <div
                  key={prod._id}
                  onClick={() => onToggleProductSelection(prod)}
                  className={`group cursor-pointer rounded-2xl border p-2.5 transition-all flex flex-col justify-between gap-2 relative ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-md'
                      : 'border-line bg-paper/60 hover:bg-surface hover:border-primary/50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center absolute top-4 right-4 z-10 shadow-sm transition-all ${
                      isSelected
                        ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] scale-110'
                        : 'bg-black/50 text-white backdrop-blur-xs group-hover:bg-primary/80'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>

                  <div>
                    <div className="aspect-square rounded-xl overflow-hidden bg-surface border border-line mb-2">
                      <img
                        src={
                          prod.images?.[0] ||
                          'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'
                        }
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>

                    <span className="text-[10px] font-bold text-ink-soft block truncate">
                      {prod.categoryId?.name || 'عام'}
                    </span>
                    <h5 className="text-xs font-black text-ink line-clamp-2 leading-snug mt-0.5">
                      {prod.name}
                    </h5>

                    {specValues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {specValues.map((sv, i) => (
                          <span
                            key={i}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface border border-line text-ink-soft truncate max-w-full"
                          >
                            {sv}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-line flex items-center justify-between">
                    <span className="text-xs font-black text-primary">
                      {prod.price} {currency}
                    </span>
                    {prod.oldPrice > prod.price && (
                      <span className="text-[10px] text-ink-soft line-through">
                        {prod.oldPrice}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Server Pagination Bar */}
        {pages > 1 && (
          <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-bold text-ink-soft">
              صفحة <strong className="text-ink">{page}</strong> من{' '}
              <strong className="text-ink">{pages}</strong> (يُعرض 20 منتج لكل صفحة)
            </div>

            <div className="flex items-center gap-2">
              {page < pages && (
                <button
                  type="button"
                  disabled={loadingProducts}
                  onClick={() => setPage(page + 1)}
                  className="px-3.5 py-2 rounded-btn bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-black transition-all"
                >
                  عرض الـ 20 منتج التالية ←
                </button>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-btn border border-line bg-paper text-ink disabled:opacity-40"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPage(num)}
                    className={`w-8 h-8 rounded-btn text-xs font-black transition-all ${
                      page === num
                        ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-xs'
                        : 'bg-paper border border-line text-ink hover:bg-surface'
                    }`}
                  >
                    {num}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className="p-2 rounded-btn border border-line bg-paper text-ink disabled:opacity-40"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
