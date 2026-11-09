import React from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Tag,
  Sparkles
} from 'lucide-react';

const DASHBOARD_SORTS = [
  { value: 'latest', label: 'الأحدث إضافة' },
  { value: 'sales_desc', label: 'الأكثر مبيعاً' },
  { value: 'price_asc', label: 'السعر: الأقل للأعلى' },
  { value: 'price_desc', label: 'السعر: الأعلى للأقل' },
  { value: 'visited_desc', label: 'الأكثر مشاهدة' },
  { value: 'rating_desc', label: 'الأعلى تقييماً' }
];

/**
 * شريط فلترة أفقي معياري قابل للتمرير (Horizontal Scrollable Dashboard Filter Bar)
 * يُستخدم في استوديو منشورات فيسبوك وفي جدول إدارة المنتجات بالداشبورد بدون تكرار كود
 */
export default function DashboardProductFilterBar({
  categories = [],
  categoryChildren = [],
  selectedCategory = '',
  onSelectCategory,
  search = '',
  onSearchChange,
  onSearchSubmit,
  groupCodesFacet = [],
  selectedGroupCode = '',
  onSelectGroupCode,
  sortBy = 'latest',
  onSortChange,
  stockFilter = '',
  onStockFilterChange,
  categoryType = '',
  onCategoryTypeChange,
  linkedStatus = '',
  onLinkedStatusChange,
  suppliers = [],
  selectedSupplier = '',
  onSelectSupplier,
  minPrice = '',
  maxPrice = '',
  onMinPriceChange,
  onMaxPriceChange,
  onApplyPrice,
  tagsFacet = [],
  selectedTags = [],
  onToggleTag,
  specsFacet = [],
  selectedSpecs = [],
  onToggleSpecValue,
  total = 0,
  onResetAll
}) {
  const activeSpecCount = selectedSpecs.reduce((sum, s) => sum + (s.values?.length || 0), 0);
  const activeFiltersCount =
    (selectedCategory ? 1 : 0) +
    (selectedGroupCode ? 1 : 0) +
    selectedTags.length +
    activeSpecCount +
    (stockFilter ? 1 : 0) +
    (selectedSupplier ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (search.trim() ? 1 : 0);

  return (
    <div className="rounded-card bg-surface border border-line p-4 space-y-3.5 shadow-sm text-ink">
      {/* Row 1: Search (Name or Group Code), Group Code Dropdown, Stock Filter, Price Range, Sort & Total Count */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (onSearchSubmit) onSearchSubmit();
          }}
          className="relative flex-1 min-w-[220px]"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث باسم المنتج أو بمُعرف المجموعة (Group Code) مباشرة..."
            className="w-full bg-paper border border-line rounded-btn pr-9 pl-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary placeholder:text-ink-soft/60"
          />
          <Search className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </form>

        {/* Group Code Quick Select Dropdown */}
        {typeof onSelectGroupCode === 'function' && groupCodesFacet.length > 0 && (
          <select
            value={selectedGroupCode}
            onChange={(e) => onSelectGroupCode(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">🔗 كل مُعرفات المتغيرات ({groupCodesFacet.length})</option>
            {groupCodesFacet.map((g) => (
              <option key={g.groupCode} value={g.groupCode}>
                مُعرف: {g.groupCode} ({g.count} منتج)
              </option>
            ))}
          </select>
        )}

        {/* Compact Price Range */}
        <div className="flex items-center gap-1.5 bg-paper border border-line rounded-btn px-2.5 py-1">
          <span className="text-[11px] font-extrabold text-ink-soft whitespace-nowrap">السعر:</span>
          <input
            type="number"
            placeholder="من"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value)}
            onBlur={onApplyPrice}
            className="w-16 bg-transparent text-xs font-bold text-ink outline-none text-center"
          />
          <span className="text-ink-soft text-xs">-</span>
          <input
            type="number"
            placeholder="إلى"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
            onBlur={onApplyPrice}
            className="w-16 bg-transparent text-xs font-bold text-ink outline-none text-center"
          />
        </div>

        {/* Stock Status Filter */}
        {typeof onStockFilterChange === 'function' && (
          <select
            value={stockFilter}
            onChange={(e) => onStockFilterChange(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">كل حالات المخزون</option>
            <option value="in_stock">متوفر بالمخزون</option>
            <option value="critical">مخزون حرج (تنبيه إعادة الطلب)</option>
            <option value="low">مخزون منخفض (5 فأقل)</option>
            <option value="out">نفد من المخزون</option>
          </select>
        )}

        {/* Category Type Filter (Products vs Services) */}
        {typeof onCategoryTypeChange === 'function' && (
          <select
            value={categoryType}
            onChange={(e) => onCategoryTypeChange(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">كل الأنواع (منتجات وخدمات)</option>
            <option value="product">📦 منتجات مادية فقط</option>
            <option value="service">🔧 خدمات وصيانة فقط</option>
          </select>
        )}

        {/* Linked / Cross-Sell Items Filter */}
        {typeof onLinkedStatusChange === 'function' && (
          <select
            value={linkedStatus}
            onChange={(e) => onLinkedStatusChange(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">كل حالات الارتباط</option>
            <option value="has_linked">🔗 مرتبط بخدمات/مقترحات</option>
            <option value="no_linked">بدون مقترحات</option>
          </select>
        )}

        {/* Supplier Filter */}
        {typeof onSelectSupplier === 'function' && (
          <select
            value={selectedSupplier}
            onChange={(e) => onSelectSupplier(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">كل الموردين</option>
            <option value="has_supplier">✅ مرتبط بمورد</option>
            <option value="no_supplier">❌ بدون مورد</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                مورد: {s.name} {s.specialty ? `(${s.specialty})` : ''}
              </option>
            ))}
          </select>
        )}

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            {DASHBOARD_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Total Counter & Reset */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-btn bg-primary/10 text-primary border border-primary/20 text-xs font-black whitespace-nowrap">
            {total} منتج مطابق
          </span>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onResetAll}
              className="px-3 py-1.5 rounded-btn bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-black flex items-center gap-1 transition-all whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>مسح الفلاتر ({activeFiltersCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Horizontal Scrollable Categories Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-line pt-2.5">
        <span className="text-[11px] font-black text-ink-soft flex items-center gap-1 whitespace-nowrap shrink-0">
          <Layers className="w-3.5 h-3.5 text-primary" />
          الأقسام:
        </span>

        <button
          type="button"
          onClick={() => onSelectCategory('')}
          className={`px-3 py-1.5 rounded-btn text-xs font-black whitespace-nowrap transition-all shrink-0 ${
            selectedCategory === ''
              ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
              : 'bg-paper text-ink border border-line hover:border-primary'
          }`}
        >
          جميع الأقسام
        </button>

        {categories.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat._id);
          return (
            <button
              key={cat._id}
              type="button"
              onClick={() => onSelectCategory(cat._id)}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                isSelected
                  ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                  : 'bg-paper text-ink border border-line hover:border-primary'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Subcategories Horizontal Strip (if any) */}
      {categoryChildren.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-black text-ink-soft whitespace-nowrap shrink-0">
            📂 الفئات الفرعية:
          </span>
          {categoryChildren.map((child) => (
            <button
              key={child._id}
              type="button"
              onClick={() => onSelectCategory(child._id)}
              className={`px-2.5 py-1 rounded-btn text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                String(selectedCategory) === String(child._id)
                  ? 'bg-primary border-primary text-[var(--color-primary-contrast,#ffffff)]'
                  : 'bg-paper border-line text-ink hover:border-primary'
              }`}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}

      {/* Variant Group Codes Strip for the Active Category (or All Categories) */}
      {typeof onSelectGroupCode === 'function' && groupCodesFacet.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-line pt-2">
          <span className="text-[11px] font-black text-ink-soft whitespace-nowrap shrink-0">
            🔗 مُعرفات المنتجات المجمعة (Group Codes):
          </span>
          <button
            type="button"
            onClick={() => onSelectGroupCode('')}
            className={`px-2.5 py-1 rounded-btn text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
              !selectedGroupCode
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-paper border-line text-ink-soft hover:text-ink'
            }`}
          >
            الكل
          </button>
          {groupCodesFacet.map((g) => {
            const isSelected = selectedGroupCode === g.groupCode;
            return (
              <button
                key={g.groupCode}
                type="button"
                onClick={() => onSelectGroupCode(isSelected ? '' : g.groupCode)}
                className={`px-2.5 py-1 rounded-btn text-[11px] font-black whitespace-nowrap border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-paper border-line text-indigo-600 hover:border-indigo-500/50'
                }`}
              >
                🔗 {g.groupCode} <span className="text-[9px] opacity-80">({g.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: Horizontal Scrollable Specs & Attributes Facets Strip */}
      {specsFacet.length > 0 && (
        <div className="space-y-2 border-t border-line pt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-ink-soft flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              فلترة أفقية سريعة حسب السمات والمواصفات (اسحب أفقياً):
            </span>
            {activeSpecCount > 0 && (
              <span className="text-[10px] font-black text-primary">
                تم اختيار {activeSpecCount} سمة
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1.5 no-scrollbar">
            {specsFacet.map((sf) => {
              const selectedForSpec =
                selectedSpecs.find((s) => s.spec === sf.spec)?.values || [];

              return (
                <div
                  key={sf.spec}
                  className="flex items-center gap-1.5 bg-paper/80 border border-line rounded-xl px-2.5 py-1.5 shrink-0"
                >
                  <span className="text-[11px] font-black text-ink whitespace-nowrap pl-1 border-l border-line">
                    {sf.label || sf.spec}:
                  </span>
                  <div className="flex items-center gap-1">
                    {sf.values.map((v) => {
                      const isPicked = selectedForSpec.includes(v.value);
                      return (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => onToggleSpecValue(sf.spec, v.value)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border ${
                            isPicked
                              ? 'bg-primary border-primary text-[var(--color-primary-contrast,#ffffff)] shadow-xs'
                              : 'bg-surface border-line text-ink-soft hover:text-ink hover:border-primary/50'
                          }`}
                        >
                          <span>{v.value}</span>
                          <span className="text-[9px] opacity-70 mr-1">({v.count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 4: Horizontal Scrollable Tags Strip */}
      {tagsFacet.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-line pt-2">
          <span className="text-[11px] font-black text-ink-soft flex items-center gap-1 whitespace-nowrap shrink-0">
            <Tag className="w-3.5 h-3.5 text-emerald-500" />
            الوسوم:
          </span>
          {tagsFacet.map((t) => {
            const isSelected = selectedTags.includes(t.tag);
            return (
              <button
                key={t.tag}
                type="button"
                onClick={() => onToggleTag(t.tag)}
                className={`px-2.5 py-1 rounded-btn text-[11px] font-bold whitespace-nowrap border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-paper border-line text-ink-soft hover:text-ink hover:border-emerald-500/50'
                }`}
              >
                #{t.tag} <span className="text-[9px] opacity-75">({t.count})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
