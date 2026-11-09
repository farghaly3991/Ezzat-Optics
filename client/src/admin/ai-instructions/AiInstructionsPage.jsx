import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Power,
  Sparkles,
  Layers,
  Package,
  Globe,
  Sliders,
  X,
  Check,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

const INITIAL_FORM = {
  title: '',
  content: '',
  scopeType: 'global',
  categoryIds: [],
  productIds: [],
  tags: '',
  priority: 10,
  active: true
};

export default function AiInstructionsTab() {
  const { token, showToast } = useStore();

  const apiFetch = async (endpoint, options = {}) => {
    const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
    const method = (options.method || 'GET').toLowerCase();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const data = options.body
      ? typeof options.body === 'string'
        ? JSON.parse(options.body)
        : options.body
      : undefined;

    try {
      const response = await axios({
        url,
        method,
        headers,
        data
      });
      return response.data;
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'حدث خطأ في الاتصال بالخادم';
      throw new Error(msg);
    }
  };

  const [instructions, setInstructions] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, synced: 0, unsynced: 0 });
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Filters
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | true | false
  const [scopeFilter, setScopeFilter] = useState('all'); // all | global | category | product

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [bannerMessage, setBannerMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Scope Picker Filters (inside Create/Edit Form)
  const [categoryScopeSearch, setCategoryScopeSearch] = useState('');
  const [productScopeSearch, setProductScopeSearch] = useState('');
  const [productScopeCategoryId, setProductScopeCategoryId] = useState('');
  const [productScopePage, setProductScopePage] = useState(1);
  const PRODUCTS_PER_SCOPE_PAGE = 24;

  // Create/Edit panel: scroll it into view automatically when "Edit" / "Add" is pressed
  const formPanelRef = useRef(null);
  useEffect(() => {
    if (!isFormOpen) return undefined;
    const frame = requestAnimationFrame(() => {
      if (formPanelRef.current) {
        formPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isFormOpen, editingId]);

  // Live Retrieval Tester state
  const [testQuery, setTestQuery] = useState('');
  const [testCategoryId, setTestCategoryId] = useState('');
  const [testingRetrieval, setTestingRetrieval] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (token) {
      loadInitialData();
    }
  }, [token]);

  const loadInitialData = async () => {
    setLoading(true);
    setBannerMessage(null);
    try {
      const [instRes, catRes, prodRes] = await Promise.all([
        apiFetch('/admin/ai-instructions'),
        apiFetch('/admin/categories'),
        apiFetch('/admin/products?limit=1000')
      ]);

      if (instRes?.instructions) {
        setInstructions(instRes.instructions);
        setSummary(instRes.summary || { total: 0, active: 0, inactive: 0, synced: 0, unsynced: 0 });
      }
      if (catRes?.categories) {
        setCategories(catRes.categories);
      }
      if (prodRes?.products) {
        setProducts(prodRes.products);
      }
    } catch (err) {
      setBannerMessage({ type: 'error', text: err.message || 'تعذر تحميل تعليمات المساعد الذكي' });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructions = async () => {
    try {
      const params = new URLSearchParams();
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      if (statusFilter !== 'all') params.set('active', statusFilter);
      if (scopeFilter !== 'all') params.set('scopeType', scopeFilter);

      const res = await apiFetch(`/admin/ai-instructions?${params.toString()}`);
      if (res?.instructions) {
        setInstructions(res.instructions);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      showToast(err.message || 'فشل تحديث القائمة', 'error');
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchInstructions();
    }
  }, [statusFilter, scopeFilter]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setCategoryScopeSearch('');
    setProductScopeSearch('');
    setProductScopeCategoryId('');
    setProductScopePage(1);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (inst) => {
    setEditingId(inst._id);
    setFormData({
      title: inst.title || '',
      content: inst.content || '',
      scopeType: inst.scopeType || 'global',
      categoryIds: (inst.categoryIds || []).map((c) => String(c?._id || c)),
      productIds: (inst.productIds || []).map((p) => String(p?._id || p)),
      tags: Array.isArray(inst.tags) ? inst.tags.join('، ') : '',
      priority: inst.priority ?? 10,
      active: inst.active !== false
    });
    setCategoryScopeSearch('');
    setProductScopeSearch('');
    setProductScopeCategoryId('');
    setProductScopePage(1);
    setFormError('');
    setIsFormOpen(true);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const handleToggleScopeItem = (field, idStr) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(idStr);
      return {
        ...prev,
        [field]: exists ? current.filter((x) => x !== idStr) : [...current, idStr]
      };
    });
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');
    setBannerMessage(null);

    const cleanTitle = formData.title.trim();
    const cleanContent = formData.content.trim();

    if (!cleanTitle) {
      setFormError('يرجى إدخال عنوان التعليمة');
      return;
    }
    if (!cleanContent) {
      setFormError('يرجى إدخال محتوى التعليمة التوجيهية');
      return;
    }
    if (formData.scopeType === 'category' && formData.categoryIds.length === 0) {
      setFormError('يرجى اختيار قسم واحد على الأقل عند تحديد النطاق كـ «قسم محدد»');
      return;
    }
    if (formData.scopeType === 'product' && formData.productIds.length === 0) {
      setFormError('يرجى اختيار منتج واحد على الأقل عند تحديد النطاق كـ «منتج محدد»');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: cleanTitle,
        content: cleanContent,
        scopeType: formData.scopeType,
        categoryIds: formData.scopeType === 'category' ? formData.categoryIds : [],
        productIds: formData.scopeType === 'product' ? formData.productIds : [],
        tags: formData.tags
          .split(/[,،;\n]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        priority: Number(formData.priority || 0),
        active: Boolean(formData.active)
      };

      const res = editingId
        ? await apiFetch(`/admin/ai-instructions/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          })
        : await apiFetch('/admin/ai-instructions', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

      setBannerMessage({
        type: 'success',
        text: res.message || (editingId ? 'تم تحديث التعليمة بنجاح' : 'تم إنشاء التعليمة بنجاح')
      });
      showToast(res.message || 'تم الحفظ بنجاح', 'success');
      setIsFormOpen(false);
      setEditingId(null);
      await fetchInstructions();
    } catch (err) {
      setFormError(err.message || 'حدث خطأ أثناء حفظ التعليمة');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (inst) => {
    setTogglingId(inst._id);
    setBannerMessage(null);
    try {
      const res = await apiFetch(`/admin/ai-instructions/${inst._id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !inst.active })
      });
      showToast(res.message || 'تم تحديث حالة التعليمة', 'success');
      await fetchInstructions();
    } catch (err) {
      showToast(err.message || 'فشل تغيير حالة التعليمة', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleResyncOne = async (id) => {
    setSyncingId(id);
    try {
      const res = await apiFetch(`/admin/ai-instructions/${id}/sync`, {
        method: 'POST'
      });
      showToast(res.message || 'تمت مزامنة المتجه بنجاح', 'success');
      await fetchInstructions();
    } catch (err) {
      showToast(err.message || 'فشل مزامنة المتجه', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleResyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await apiFetch('/admin/ai-instructions/sync-all', {
        method: 'POST',
        body: JSON.stringify({ onlyUnsynced: false })
      });
      setBannerMessage({ type: 'success', text: res.message || 'تمت مزامنة جميع التعليمات بنجاح' });
      showToast(res.message || 'تمت المزامنة بنجاح', 'success');
      await fetchInstructions();
    } catch (err) {
      showToast(err.message || 'فشل مزامنة التعليمات', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (inst) => {
    if (!window.confirm(`هل أنت متأكد من حذف التعليمة «${inst.title}» نهائياً؟`)) return;
    setDeletingId(inst._id);
    try {
      const res = await apiFetch(`/admin/ai-instructions/${inst._id}`, {
        method: 'DELETE'
      });
      setBannerMessage({ type: 'success', text: res.message || 'تم حذف التعليمة بنجاح' });
      showToast(res.message || 'تم الحذف', 'success');
      await fetchInstructions();
    } catch (err) {
      showToast(err.message || 'تعذر حذف التعليمة', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRunRetrievalTest = async (e) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    setTestingRetrieval(true);
    try {
      const res = await apiFetch('/admin/ai-instructions/test-retrieval', {
        method: 'POST',
        body: JSON.stringify({
          query: testQuery.trim(),
          categoryId: testCategoryId || null
        })
      });
      setTestResult(res);
    } catch (err) {
      showToast(err.message || 'فشل اختبار الاسترجاع', 'error');
    } finally {
      setTestingRetrieval(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-ink-soft font-bold text-sm">
        جاري تحميل تعليمات المساعد الذكي ومتجهات البحث...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-ink">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-card border border-line shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-primary" />
            <span>تعليمات المساعد الذكي (AI Search Planner Instructions)</span>
          </h2>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            أضف قواعد وتوجيهات مخصصة لتوجيه مخطط البحث الذكي (LLM Planner) عند استخلاص الفلاتر وترشيح المنتجات للعملاء عبر البحث الدلالي (Vector Retrieval).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleResyncAll}
            disabled={syncingAll}
            className="px-4 py-2.5 rounded-btn bg-paper border border-line text-ink hover:bg-slate-100 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin text-primary' : ''}`} />
            <span>{syncingAll ? 'جاري مزامنة المتجهات...' : 'إعادة مزامنة المتجهات'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] hover:bg-primary/90 text-xs font-black flex items-center gap-2 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة تعليمة جديدة</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-card border flex items-center justify-between text-xs sm:text-sm font-bold ${
            bannerMessage.type === 'error'
              ? 'bg-red-500/10 text-red-600 border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button onClick={() => setBannerMessage(null)} className="text-ink-soft hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-card border border-line shadow-sm">
          <div className="text-xs text-ink-soft font-bold">إجمالي التعليمات</div>
          <div className="text-2xl font-black text-ink mt-1">{summary.total}</div>
        </div>
        <div className="bg-surface p-4 rounded-card border border-line shadow-sm">
          <div className="text-xs text-emerald-600 font-bold">تعليمات نشطة (Active)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{summary.active}</div>
        </div>
        <div className="bg-surface p-4 rounded-card border border-line shadow-sm">
          <div className="text-xs text-sky-600 font-bold">متجهات متزامنة (Synced Vectors)</div>
          <div className="text-2xl font-black text-sky-600 mt-1">{summary.synced}</div>
        </div>
        <div className="bg-surface p-4 rounded-card border border-line shadow-sm">
          <div className="text-xs text-orange-600 font-bold">معطلة / غير متزامنة</div>
          <div className="text-2xl font-black text-orange-600 mt-1">
            {summary.inactive} معطلة / {summary.unsynced} غير متزامنة
          </div>
        </div>
      </div>

      {/* Create / Edit Instruction Modal / Drawer Panel */}
      {isFormOpen && (
        <div
          ref={formPanelRef}
          className="scroll-mt-24 bg-surface p-6 rounded-card border-2 border-primary/40 shadow-lg space-y-5 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 className="text-base font-black text-ink flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>{editingId ? 'تعديل تعليمة المساعد الذكي' : 'إضافة تعليمة جديدة للمساعد الذكي'}</span>
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1.5 rounded-btn hover:bg-paper text-ink-soft"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-btn bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  عنوان التعليمة (Title) *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: ترشيح سماعات عزل الضوضاء للسفر والطيران"
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs sm:text-sm outline-none focus:border-primary"
                  maxLength={160}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  نطاق التطبيق (Scope)
                </label>
                <select
                  value={formData.scopeType}
                  onChange={(e) => setFormData({ ...formData, scopeType: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs sm:text-sm outline-none focus:border-primary font-bold"
                >
                  <option value="global">عام لجميع عمليات البحث (Global)</option>
                  <option value="category">مخصص لأقسام محددة (Category Scope)</option>
                  <option value="product">مخصص لمنتجات محددة (Product Scope)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-soft mb-1">
                محتوى التعليمة التوجيهية لمخطط الذكاء الاصطناعي (Instruction Content) *
              </label>
              <textarea
                rows={3}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="مثال: عندما يبحث العميل عن سماعة للسفر أو الطيران أو المذاكرة في الأماكن المزدحمة، ركز على قسم الصوتيات والسماعات ذات عزل الضوضاء النشط ANC ورشح سوني WH-1000XM5 في المقدمة لقوة البطارية (30 ساعة) والوزن الخفيف."
                className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs sm:text-sm outline-none focus:border-primary leading-relaxed"
                maxLength={2000}
              />
              <div className="text-[11px] text-ink-soft mt-1 flex justify-between">
                <span>سيتم تحويل هذا النص إلى متجه دلالي (Vector Embedding) لاسترجاعه تلقائياً عند تطابق سؤال العميل.</span>
                <span>{formData.content.length} / 2000</span>
              </div>
            </div>

            {/* Category Scope Selector */}
            {formData.scopeType === 'category' && (() => {
              const normCatQ = categoryScopeSearch.trim().toLowerCase();
              const filteredCats = categories.filter((c) => {
                if (!normCatQ) return true;
                const label = `${c.displayName || ''} ${c.name || ''} ${(c.tags || []).join(' ')}`.toLowerCase();
                return label.includes(normCatQ);
              });
              const selectedCatObjects = categories.filter((c) =>
                formData.categoryIds.includes(String(c._id))
              );

              return (
                <div className="bg-paper p-4 rounded-btn border border-line space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-ink">
                      اختر الأقسام المرتبطة بهذه التعليمة (إجمالي {categories.length} قسم متاح):
                    </label>
                    <span className="text-[11px] font-bold text-primary">
                      تم اختيار {formData.categoryIds.length} قسم
                    </span>
                  </div>

                  {/* Selected Categories Chips */}
                  {selectedCatObjects.length > 0 && (
                    <div className="p-2.5 rounded-btn bg-surface border border-primary/30 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-ink-soft">
                        <span>الأقسام المختارة حالياً:</span>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, categoryIds: [] }))}
                          className="text-red-500 hover:underline"
                        >
                          مسح الكل
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCatObjects.map((cat) => (
                          <span
                            key={cat._id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-white shadow-xs"
                          >
                            <span>{cat.displayName || cat.name}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleScopeItem('categoryIds', String(cat._id))}
                              className="hover:bg-white/20 rounded-full p-0.5"
                              title="إزالة"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={categoryScopeSearch}
                      onChange={(e) => setCategoryScopeSearch(e.target.value)}
                      placeholder="ابحث في جميع الأقسام الرئيسية والفرعية (مثال: تكييف، حائطي، كونسيلد، هواتف)..."
                      className="w-full bg-surface border border-line rounded-btn pr-8 pl-3 py-1.5 text-xs outline-none focus:border-primary"
                    />
                  </div>

                  {/* All Categories List */}
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                    {filteredCats.length === 0 ? (
                      <div className="text-xs text-ink-soft py-3 px-2">
                        لا توجد أقسام مطابقة لعبارة البحث «{categoryScopeSearch}»
                      </div>
                    ) : (
                      filteredCats.map((cat) => {
                        const selected = formData.categoryIds.includes(String(cat._id));
                        return (
                          <button
                            type="button"
                            key={cat._id}
                            onClick={() => handleToggleScopeItem('categoryIds', String(cat._id))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                              selected
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : cat.isParent
                                ? 'bg-surface text-ink border-primary/40 hover:border-primary'
                                : 'bg-surface text-ink border-line hover:border-primary/50'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            <span>{cat.displayName || cat.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                selected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-paper text-ink-soft border border-line'
                              }`}
                            >
                              {cat.productsCount || 0} منتج
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Product Scope Selector */}
            {formData.scopeType === 'product' && (() => {
              const normProdQ = productScopeSearch.trim().toLowerCase();

              // If a parent category is selected in productScopeCategoryId, include its childrenIds
              let allowedCatIds = null;
              if (productScopeCategoryId) {
                const chosenCat = categories.find((c) => String(c._id) === String(productScopeCategoryId));
                const childIds = Array.isArray(chosenCat?.childrenIds) ? chosenCat.childrenIds.map(String) : [];
                allowedCatIds = new Set([String(productScopeCategoryId), ...childIds]);
              }

              const filteredProds = products.filter((prod) => {
                if (allowedCatIds) {
                  const pCatId = String(prod.categoryId?._id || prod.categoryId || '');
                  if (!allowedCatIds.has(pCatId)) return false;
                }
                if (!normProdQ) return true;
                const haystack = `${prod.name || ''} ${prod.groupCode || ''} ${prod.categoryId?.name || ''} ${(prod.tags || []).join(' ')}`.toLowerCase();
                return haystack.includes(normProdQ);
              });

              const totalPages = Math.max(1, Math.ceil(filteredProds.length / PRODUCTS_PER_SCOPE_PAGE));
              const currentPage = Math.min(productScopePage, totalPages);
              const pagedProds = filteredProds.slice(
                (currentPage - 1) * PRODUCTS_PER_SCOPE_PAGE,
                currentPage * PRODUCTS_PER_SCOPE_PAGE
              );

              const selectedProdObjects = products.filter((p) =>
                formData.productIds.includes(String(p._id))
              );

              return (
                <div className="bg-paper p-4 rounded-btn border border-line space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-ink">
                      اختر منتجاً واحداً أو عدة منتجات مرتبطة بهذه التعليمة (إجمالي {products.length} منتج في المتجر):
                    </label>
                    <span className="text-[11px] font-bold text-primary">
                      تم اختيار {formData.productIds.length} منتج
                    </span>
                  </div>

                  {/* Selected Products Chips */}
                  {selectedProdObjects.length > 0 && (
                    <div className="p-2.5 rounded-btn bg-surface border border-primary/30 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-ink-soft">
                        <span>المنتجات المختارة ({selectedProdObjects.length}):</span>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, productIds: [] }))}
                          className="text-red-500 hover:underline"
                        >
                          إلغاء تحديد الكل
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {selectedProdObjects.map((prod) => (
                          <span
                            key={prod._id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-white shadow-xs"
                          >
                            <span>{prod.name}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleScopeItem('productIds', String(prod._id))}
                              className="hover:bg-white/20 rounded-full p-0.5"
                              title="إزالة المنتج"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search & Category Filter for Products */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2 relative">
                      <Search className="w-3.5 h-3.5 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={productScopeSearch}
                        onChange={(e) => {
                          setProductScopeSearch(e.target.value);
                          setProductScopePage(1);
                        }}
                        placeholder="ابحث باسم المنتج أو الماركة أو القدرة (مثال: تكييف كاريير، 2.25 حصان، شارب)..."
                        className="w-full bg-surface border border-line rounded-btn pr-8 pl-3 py-1.5 text-xs outline-none focus:border-primary"
                      />
                    </div>

                    <select
                      value={productScopeCategoryId}
                      onChange={(e) => {
                        setProductScopeCategoryId(e.target.value);
                        setProductScopePage(1);
                      }}
                      className="bg-surface border border-line rounded-btn px-2.5 py-1.5 text-xs font-bold outline-none focus:border-primary"
                    >
                      <option value="">جميع الأقسام ({categories.length})</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.displayName || cat.name} ({cat.productsCount || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Paginated Filtered Products */}
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                    {pagedProds.length === 0 ? (
                      <div className="text-xs text-ink-soft py-4 px-2">
                        لا توجد منتجات مطابقة للبحث أو القسم المحدد حالياً.
                      </div>
                    ) : (
                      pagedProds.map((prod) => {
                        const selected = formData.productIds.includes(String(prod._id));
                        return (
                          <button
                            type="button"
                            key={prod._id}
                            onClick={() => handleToggleScopeItem('productIds', String(prod._id))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 text-right ${
                              selected
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-surface text-ink border-line hover:border-primary/50'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            <span>{prod.name}</span>
                            {prod.price ? (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                  selected ? 'bg-white/20 text-white' : 'bg-paper text-ink-soft'
                                }`}
                              >
                                {Number(prod.price).toLocaleString()} ج.م
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Pagination Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-[11px] font-bold text-ink-soft">
                    <span>
                      عرض {pagedProds.length} من أصل {filteredProds.length} منتج مطابق
                    </span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setProductScopePage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded bg-surface border border-line text-ink disabled:opacity-40 hover:border-primary"
                        >
                          السابق
                        </button>
                        <span className="px-2 text-ink">
                          صفحة {currentPage} من {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setProductScopePage((p) => Math.min(totalPages, p + 1))}
                          className="px-2.5 py-1 rounded bg-surface border border-line text-ink disabled:opacity-40 hover:border-primary"
                        >
                          التالي
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  الكلمات الدلالية والوسوم المحفزة (Tags — مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="مثال: سفر، طيران، عزل ضوضاء، مذاكرة، هدوء"
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs sm:text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-ink-soft mb-1">
                    الأولوية (Priority)
                  </label>
                  <input
                    type="number"
                    min={-10}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs sm:text-sm outline-none focus:border-primary"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-4 select-none">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span className="text-xs font-black text-ink">تفعيل فوري</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-btn border border-line bg-paper text-ink text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black shadow-md hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ وتوليد المتجه...' : editingId ? 'حفظ التعديلات ومزامنة المتجه' : 'إنشاء التعليمة وتوليد المتجه'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-surface p-4 rounded-card border border-line shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInstructions()}
            placeholder="ابحث في عناوين ومحتوى التعليمات أو الوسوم..."
            className="w-full bg-paper border border-line rounded-btn pr-9 pl-3 py-2 text-xs outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold outline-none focus:border-primary"
          >
            <option value="all">جميع الحالات (نشط ومعطل)</option>
            <option value="true">نشط فقط (Active)</option>
            <option value="false">معطل فقط (Disabled)</option>
          </select>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2 text-xs font-bold outline-none focus:border-primary"
          >
            <option value="all">جميع النطاقات</option>
            <option value="global">عام (Global)</option>
            <option value="category">أقسام (Category)</option>
            <option value="product">منتجات (Product)</option>
          </select>

          <button
            onClick={fetchInstructions}
            className="px-4 py-2 rounded-btn bg-secondary text-white text-xs font-bold hover:opacity-90"
          >
            تطبيق الفلتر
          </button>
        </div>
      </div>

      {/* Instructions List */}
      <div className="space-y-3">
        {instructions.length === 0 ? (
          <div className="bg-surface p-10 rounded-card border border-line text-center space-y-3">
            <Bot className="w-10 h-10 text-ink-soft mx-auto opacity-60" />
            <div className="text-sm font-black text-ink">لا توجد تعليمات مسجلة حالياً</div>
            <p className="text-xs text-ink-soft max-w-md mx-auto">
              أضف تعليمات إرشادية لمساعد التسوق الذكي لتوجيهه نحو ترشيح منتجات أو أقسام معينة عند بحث العملاء بكلمات أو احتياجات محددة.
            </p>
          </div>
        ) : (
          instructions.map((inst) => {
            const isSynced = inst.syncStatus === 'synced';
            const isFailed = inst.syncStatus === 'failed';

            return (
              <div
                key={inst._id}
                className={`bg-surface p-5 rounded-card border transition-all shadow-sm ${
                  inst.active ? 'border-line' : 'border-line/60 opacity-70 bg-paper/50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-[260px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1 ${
                          inst.active
                            ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                            : 'bg-slate-500/15 text-slate-600 border border-slate-500/30'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {inst.active ? 'نشط' : 'معطل'}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                          isSynced
                            ? 'bg-sky-500/15 text-sky-700 border border-sky-500/30'
                            : isFailed
                            ? 'bg-red-500/15 text-red-600 border border-red-500/30'
                            : 'bg-orange-500/15 text-orange-700 border border-orange-500/30'
                        }`}
                        title={inst.syncError || inst.embeddingModel || ''}
                      >
                        {isSynced ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {isSynced ? 'متجه متزامن (Synced)' : isFailed ? 'فشل المزامنة' : 'قيد المزامنة'}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-paper border border-line text-ink-soft flex items-center gap-1">
                        {inst.scopeType === 'category' ? (
                          <>
                            <Layers className="w-3 h-3 text-primary" />
                            <span>نطاق قسم</span>
                          </>
                        ) : inst.scopeType === 'product' ? (
                          <>
                            <Package className="w-3 h-3 text-primary" />
                            <span>نطاق منتج</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 text-primary" />
                            <span>عام للمتجر</span>
                          </>
                        )}
                      </span>

                      {inst.priority !== 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                          أولوية: {inst.priority}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-black text-ink">{inst.title}</h4>
                    <p className="text-xs sm:text-sm text-ink-soft leading-relaxed whitespace-pre-line">
                      {inst.content}
                    </p>

                    {/* Scoped Categories / Products & Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {(inst.categoryIds || []).map((c) => (
                        <span
                          key={c._id || c}
                          className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 text-[11px] font-bold"
                        >
                          قسم: {c.name || c}
                        </span>
                      ))}
                      {(inst.productIds || []).map((p) => (
                        <span
                          key={p._id || p}
                          className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 text-[11px] font-bold"
                        >
                          منتج: {p.name || p}
                        </span>
                      ))}
                      {(inst.tags || []).map((t, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-paper border border-line text-ink-soft text-[11px] font-medium"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-soft pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        آخر تحديث: {inst.updatedAt ? new Date(inst.updatedAt).toLocaleString('ar-EG') : '—'}
                      </span>
                      {inst.lastSyncedAt && (
                        <span>
                          مزامنة المتجه: {new Date(inst.lastSyncedAt).toLocaleString('ar-EG')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(inst)}
                      disabled={togglingId === inst._id}
                      className={`px-3 py-1.5 rounded-btn text-xs font-bold border transition-all ${
                        inst.active
                          ? 'bg-paper border-line text-ink hover:bg-orange-500/10 hover:text-orange-700'
                          : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {togglingId === inst._id
                        ? '...'
                        : inst.active
                        ? 'تعطيل'
                        : 'تفعيل'}
                    </button>

                    <button
                      onClick={() => handleResyncOne(inst._id)}
                      disabled={syncingId === inst._id}
                      title="إعادة توليد ومزامنة المتجه الدلالي"
                      className="p-2 rounded-btn bg-paper border border-line text-ink-soft hover:text-primary transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingId === inst._id ? 'animate-spin text-primary' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(inst)}
                      title="تعديل التعليمة"
                      className="p-2 rounded-btn bg-paper border border-line text-ink-soft hover:text-primary transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(inst)}
                      disabled={deletingId === inst._id}
                      title="حذف التعليمة"
                      className="p-2 rounded-btn bg-paper border border-line text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Semantic Retrieval & Planner Injection Tester */}
      <div className="bg-surface p-6 rounded-card border border-line shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary" />
          <h3 className="text-base font-black text-ink">
            مختبر الاسترجاع الدلالي وحقن المخطط (Planner Vector Retrieval Tester)
          </h3>
        </div>
        <p className="text-xs text-ink-soft">
          جرب كتابة سؤال عميل كما يكتبه في شات المتجر لترى أي التعليمات النشطة سيتم استرجاعها وحقنها في سياق الـ LLM Planner بناءً على التشابه الدلالي (Cosine Similarity Threshold &ge; 0.24).
        </p>

        <form onSubmit={handleRunRetrievalTest} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="مثال: عايز سماعة ممتازة لعزل الضوضاء في السفر والطيارة..."
            className="flex-1 min-w-[240px] bg-paper border border-line rounded-btn px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-primary"
          />

          <select
            value={testCategoryId}
            onChange={(e) => setTestCategoryId(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-2.5 text-xs font-bold outline-none focus:border-primary"
          >
            <option value="">بدون سياق قسم مسبق</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                سياق القسم: {cat.displayName || cat.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={testingRetrieval || !testQuery.trim()}
            className="px-5 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black shadow-md hover:bg-primary/90 disabled:opacity-50"
          >
            {testingRetrieval ? 'جاري الفحص...' : 'اختبار الاسترجاع'}
          </button>
        </form>

        {testResult && (
          <div className="bg-paper p-4 rounded-btn border border-line space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 font-bold text-ink-soft">
              <span>
                التعليمات النشطة المفحوصة: <strong className="text-ink">{testResult.totalActiveChecked}</strong>
              </span>
              <span>
                التعليمات المطابقة فوق العتبة ({testResult.thresholdUsed}):{' '}
                <strong className="text-emerald-600">{testResult.instructions?.length || 0}</strong>
              </span>
              <span>
                استهلاك ميزانية التوكنز:{' '}
                <strong className="text-sky-600">
                  {testResult.tokenBudgetUsed} / {testResult.maxTokenBudget} tokens
                </strong>
              </span>
            </div>

            {testResult.instructions?.length === 0 ? (
              <div className="text-orange-600 font-bold py-2">
                لم تتجاوز أي تعليمة حد التشابه الأدنى ({testResult.thresholdUsed}) لهذا الاستفسار — سيستمر البحث العادي بدون حقن تعليمات إضافية.
              </div>
            ) : (
              <div className="space-y-2">
                {testResult.instructions.map((item, i) => (
                  <div
                    key={item._id}
                    className="p-3 rounded bg-surface border border-line flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-black text-ink">
                        {i + 1}. {item.title}
                      </div>
                      <div className="text-ink-soft mt-0.5">{item.content}</div>
                    </div>
                    <div className="shrink-0 text-left">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 font-black">
                        تشابه: {Math.round(item.similarityScore * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
