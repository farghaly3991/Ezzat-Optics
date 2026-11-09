import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Edit2, X, Wrench, Package, Grid, CheckSquare, Square, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ImageUploader from '../../shared/components/ImageUploader';

export default function CategoriesTab() {
  const { token, showToast } = useStore();
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const DEFAULT_CYL_VALUES = '0.00, -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00';
  const DEFAULT_SPH_VALUES = '+6.00, +5.00, +4.00, +3.00, +2.00, +1.00, 0.00, -1.00, -2.00, -3.00, -4.00, -5.00, -6.00';

  const [form, setForm] = useState({
    name: '',
    image: '',
    type: 'product',
    tags: '',
    specsList: [],
    allowMultiVariants: true,
    hasGridSpecs: false,
    gridAxisXKey: 'CYL',
    gridAxisXLabel: 'الاستجماتيزم (CYL)',
    gridAxisXValues: DEFAULT_CYL_VALUES,
    gridAxisYKey: 'SPH',
    gridAxisYLabel: 'الدرجة الكروية (SPH)',
    gridAxisYValues: DEFAULT_SPH_VALUES
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadCategories = () => {
    axios.get('/api/admin/categories', authHeader).then((r) => setCategories(r.data?.categories || []));
  };

  useEffect(() => {
    if (token) loadCategories();
  }, [token]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
      await axios.delete(`/api/admin/categories/${id}`, authHeader);
      showToast('تم حذف القسم');
      loadCategories();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حذف القسم', 'error');
    }
  };

  const openModal = (cat = null) => {
    if (cat) {
      setEditingId(cat._id);
      
      // Convert specs object to array
      const specsList = [];
      if (cat.specs) {
        Object.keys(cat.specs).forEach(k => {
          specsList.push({ key: k, label: cat.specs[k] });
        });
      }

      const gridCfg = cat.gridConfig || {};
      const axisX = gridCfg.axisX || {};
      const axisY = gridCfg.axisY || {};
      const defaultSlots = [
        { key: 'OD', label: 'العين اليمنى (OD)' },
        { key: 'OS', label: 'العين اليسرى (OS)' }
      ];
      
      setForm({
        name: cat.name || '',
        image: cat.image || '',
        type: cat.type || 'product',
        tags: Array.isArray(cat.tags) ? cat.tags.join(', ') : '',
        specsList,
        allowMultiVariants: cat.allowMultiVariants !== false,
        hasGridSpecs: Boolean(cat.hasGridSpecs),
        gridAxisXKey: axisX.key || 'CYL',
        gridAxisXLabel: axisX.label || 'الاستجماتيزم (CYL)',
        gridAxisXValues: Array.isArray(axisX.values) ? axisX.values.join(', ') : DEFAULT_CYL_VALUES,
        gridAxisYKey: axisY.key || 'SPH',
        gridAxisYLabel: axisY.label || 'الدرجة الكروية (SPH)',
        gridAxisYValues: Array.isArray(axisY.values) ? axisY.values.join(', ') : DEFAULT_SPH_VALUES,
        unitSlots: Array.isArray(gridCfg.unitSlots) && gridCfg.unitSlots.length > 0 ? gridCfg.unitSlots : defaultSlots,
        allowMultiUnits: gridCfg.allowMultiUnits !== false
      });
    } else {
      setEditingId(null);
      setForm({
        name: '',
        image: '',
        type: 'product',
        tags: '',
        specsList: [],
        allowMultiVariants: true,
        hasGridSpecs: false,
        gridAxisXKey: 'CYL',
        gridAxisXLabel: 'الاستجماتيزم (CYL)',
        gridAxisXValues: DEFAULT_CYL_VALUES,
        gridAxisYKey: 'SPH',
        gridAxisYLabel: 'الدرجة الكروية (SPH)',
        gridAxisYValues: DEFAULT_SPH_VALUES,
        unitSlots: [
          { key: 'OD', label: 'العين اليمنى (OD)' },
          { key: 'OS', label: 'العين اليسرى (OS)' }
        ],
        allowMultiUnits: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    // Convert tags string to array
    const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean);

    // Convert specs array to object
    const specsObj = {};
    form.specsList.forEach(s => {
      if (s.key.trim() && s.label.trim()) {
        specsObj[s.key.trim()] = s.label.trim();
      }
    });

    const gridConfig = form.hasGridSpecs ? {
      axisX: {
        key: form.gridAxisXKey.trim() || 'CYL',
        label: form.gridAxisXLabel.trim() || 'الاستجماتيزم (CYL)',
        unit: 'D',
        values: form.gridAxisXValues.split(',').map(v => v.trim()).filter(Boolean)
      },
      axisY: {
        key: form.gridAxisYKey.trim() || 'SPH',
        label: form.gridAxisYLabel.trim() || 'الدرجة الكروية (SPH)',
        unit: 'D',
        values: form.gridAxisYValues.split(',').map(v => v.trim()).filter(Boolean)
      },
      unitSlots: Array.isArray(form.unitSlots) && form.unitSlots.length > 0 ? form.unitSlots : [
        { key: 'OD', label: 'العين اليمنى (OD)' },
        { key: 'OS', label: 'العين اليسرى (OS)' }
      ],
      allowMultiUnits: form.allowMultiUnits !== false
    } : undefined;

    const payload = {
      name: form.name,
      image: form.image,
      type: form.type || 'product',
      tags: tagsArr,
      specs: specsObj,
      allowMultiVariants: form.allowMultiVariants,
      hasGridSpecs: form.hasGridSpecs,
      layoutMode: form.hasGridSpecs ? 'matrix_grid' : 'standard',
      gridConfig
    };

    try {
      if (editingId) {
        await axios.put(`/api/admin/categories/${editingId}`, payload, authHeader);
        showToast('تم تعديل القسم بنجاح');
      } else {
        await axios.post('/api/admin/categories', payload, authHeader);
        showToast('تمت إضافة القسم بنجاح');
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ القسم', 'error');
    }
  };

  const addSpec = () => {
    setForm({ ...form, specsList: [...form.specsList, { key: '', label: '' }] });
  };

  const updateSpec = (idx, field, val) => {
    const list = [...form.specsList];
    list[idx][field] = val;
    setForm({ ...form, specsList: list });
  };

  const removeSpec = (idx) => {
    const list = [...form.specsList];
    list.splice(idx, 1);
    setForm({ ...form, specsList: list });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-secondary flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <span>الأقسام والتصنيفات ({categories.length})</span>
        </h3>

        <button
          onClick={() => openModal()}
          className="px-4 py-2.5 rounded-card bg-primary text-[var(--color-primary-contrast,#ffffff)] font-bold text-xs flex items-center gap-1.5 shadow-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> إضافة قسم جديد
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((c) => (
          <div key={c._id} className="rounded-card bg-surface p-4 border border-line space-y-3 shadow-sm group text-ink">
            <div className="relative">
              <img
                src={c.image || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                alt={c.name}
                className="w-full h-32 rounded-card object-cover bg-paper border border-line"
              />
              <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/90 border border-line backdrop-blur rounded-lg p-1">
                <button
                  onClick={() => openModal(c)}
                  className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(c._id)}
                  className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm text-ink">{c.name}</h4>
                <span className="text-[11px] text-ink-soft font-bold">{c.productsCount || 0} عنصر متاح</span>
              </div>
              <div>
                {c.type === 'service' ? (
                  <span className="text-[10px] bg-teal-500/15 text-teal-800 dark:text-teal-200 border border-teal-500/30 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    <span>خدمات</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-500/10 text-ink-soft border border-line px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>منتجات</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line/60">
              {c.hasGridSpecs && (
                <span className="text-[10px] bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                  <Grid className="w-3 h-3" />
                  <span>مصفوفة Grid</span>
                </span>
              )}
              {c.allowMultiVariants === false && (
                <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  🔒 بسيط فقط
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-t-3xl sm:rounded-card p-5 sm:p-6 w-full max-w-full sm:max-w-lg space-y-4 shadow-2xl border border-line relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto my-0 sm:my-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-lg hover:bg-paper transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-black text-sm text-ink">{editingId ? 'تعديل القسم' : 'إضافة قسم جديد'}</h3>
            <form onSubmit={handleSave} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-ink-soft mb-1">اسم القسم *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: إلكترونيات أو خدمات تكييف"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50"
                />
              </div>

              {/* Category Type (Products vs Services) */}
              <div>
                <label className="block text-ink-soft mb-1.5">نوع التصنيف والمحتوى *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'product' })}
                    className={`p-3 rounded-btn border text-right transition-all flex items-center gap-2.5 ${
                      form.type !== 'service'
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-line bg-paper text-ink-soft hover:bg-surface'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-black text-xs text-ink">منتجات مادية</div>
                      <div className="text-[10px] text-ink-soft font-normal">سلع وشحن ومخزون</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'service' })}
                    className={`p-3 rounded-btn border text-right transition-all flex items-center gap-2.5 ${
                      form.type === 'service'
                        ? 'border-teal-600 bg-teal-500/15 text-teal-800 dark:text-teal-200 shadow-sm'
                        : 'border-line bg-paper text-ink-soft hover:bg-surface'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center shrink-0">
                      <Wrench className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                    </div>
                    <div>
                      <div className="font-black text-xs text-ink">خدمات وأعمال (Service)</div>
                      <div className="text-[10px] text-ink-soft font-normal">صيانة، تركيب، دفع لاحق</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">صورة القسم</label>
                <ImageUploader value={form.image} onChange={(val) => setForm({ ...form, image: val })} />
              </div>

              <div>
                <label className="block text-ink-soft mb-1">الوسوم (مفصولة بفاصلة)</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="مثال: هواتف, سامسونج, أبل"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50"
                />
              </div>

              <div className="pt-2 border-t border-line">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-ink-soft">المواصفات الديناميكية (Specs)</label>
                  <button type="button" onClick={addSpec} className="text-primary hover:underline text-[11px] flex items-center gap-1">
                    <Plus className="w-3 h-3" /> إضافة مواصفة
                  </button>
                </div>
                
                <div className="space-y-2">
                  {form.specsList.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="المفتاح (مثال: ram)"
                        value={s.key}
                        onChange={e => updateSpec(idx, 'key', e.target.value)}
                        className="flex-1 bg-paper border border-line rounded-btn px-2 py-2 outline-none focus:border-primary text-xs text-ink placeholder:text-ink-soft/50"
                      />
                      <input
                        type="text"
                        placeholder="الاسم المعروض (مثال: الرام)"
                        value={s.label}
                        onChange={e => updateSpec(idx, 'label', e.target.value)}
                        className="flex-1 bg-paper border border-line rounded-btn px-2 py-2 outline-none focus:border-primary text-xs text-ink placeholder:text-ink-soft/50"
                      />
                      <button type="button" onClick={() => removeSpec(idx)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {form.specsList.length === 0 && (
                    <div className="text-center py-2 text-ink-soft text-[10px]">لا توجد مواصفات مضافة</div>
                  )}
                </div>
              </div>

              {/* Advanced Category Policies: Multi-Variants & 2D Grid Specs */}
              <div className="pt-3 border-t border-line space-y-3">
                {/* 1. Multi-Variants Policy */}
                <div className="p-3 rounded-xl bg-paper border border-line">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowMultiVariants}
                      onChange={(e) => setForm({ ...form, allowMultiVariants: e.target.checked })}
                      className="mt-0.5 rounded text-primary focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="font-black text-xs text-ink block">
                        السماح بإنشاء منتجات متعددة الخيارات (Multi-Variant Mode)
                      </span>
                      <span className="text-[11px] text-ink-soft font-normal block mt-0.5">
                        عند التعطيل، يُلغى ويُخفى زر التبديل إلى "متعدد الخيارات" في شاشة إضافة المنتج داخل هذا القسم لتجنب الأخطاء التشغيلية.
                      </span>
                    </div>
                  </label>
                </div>

                {/* 2. 2D Grid Specs Engine */}
                <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasGridSpecs}
                      onChange={(e) => setForm({ ...form, hasGridSpecs: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0 w-4 h-4"
                    />
                    <div>
                      <span className="font-black text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <Grid className="w-3.5 h-3.5 text-indigo-600" />
                        <span>تفعيل مصفوفة مقاسات شبكية ثنائية الأبعاد (2D Grid Specs Engine)</span>
                      </span>
                      <span className="text-[11px] text-ink-soft font-normal block mt-0.5">
                        تتيح إدارة منتجات هذا القسم كدرج/جدول مقاسات ذي بعدين (مثل عدسات SPH × CYL أو مقاسات العرض والطول)، ومزامنة رصيد الصنف تلقائياً مع مجموع المصفوفة.
                      </span>
                    </div>
                  </label>

                  {form.hasGridSpecs && (
                    <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-800/40 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-300">
                          إعداد محاور المصفوفة (Axis X & Axis Y):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              gridAxisXKey: 'CYL',
                              gridAxisXLabel: 'الاستجماتيزم (CYL)',
                              gridAxisXValues: DEFAULT_CYL_VALUES,
                              gridAxisYKey: 'SPH',
                              gridAxisYLabel: 'الدرجة الكروية (SPH)',
                              gridAxisYValues: DEFAULT_SPH_VALUES
                            }));
                          }}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>استعادة مقاسات عدسات البصريات (SPH x CYL)</span>
                        </button>
                      </div>

                      {/* Axis X */}
                      <div className="bg-paper p-2.5 rounded-lg border border-line space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-ink-soft mb-0.5">رمز محور الأعمدة X (مثال: CYL)</label>
                            <input
                              type="text"
                              value={form.gridAxisXKey}
                              onChange={(e) => setForm({ ...form, gridAxisXKey: e.target.value })}
                              className="w-full bg-surface border border-line rounded px-2 py-1.5 text-xs text-ink font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-ink-soft mb-0.5">اسم محور الأعمدة المعروض</label>
                            <input
                              type="text"
                              value={form.gridAxisXLabel}
                              onChange={(e) => setForm({ ...form, gridAxisXLabel: e.target.value })}
                              className="w-full bg-surface border border-line rounded px-2 py-1.5 text-xs text-ink font-bold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-ink-soft mb-0.5">قيم الأعمدة (مفصولة بفواصل)</label>
                          <input
                            type="text"
                            value={form.gridAxisXValues}
                            onChange={(e) => setForm({ ...form, gridAxisXValues: e.target.value })}
                            placeholder="0.00, -0.25, -0.50, -0.75..."
                            className="w-full bg-surface border border-line rounded px-2 py-1.5 text-xs text-ink font-mono"
                          />
                        </div>
                      </div>

                      {/* Axis Y */}
                      <div className="bg-paper p-2.5 rounded-lg border border-line space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-ink-soft mb-0.5">رمز محور الصفوف Y (مثال: SPH)</label>
                            <input
                              type="text"
                              value={form.gridAxisYKey}
                              onChange={(e) => setForm({ ...form, gridAxisYKey: e.target.value })}
                              className="w-full bg-surface border border-line rounded px-2 py-1.5 text-xs text-ink font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-ink-soft mb-0.5">اسم محور الصفوف المعروض</label>
                            <input
                              type="text"
                              value={form.gridAxisYLabel}
                              onChange={(e) => setForm({ ...form, gridAxisYLabel: e.target.value })}
                              className="w-full bg-surface border border-line rounded px-2 py-1.5 text-xs text-ink font-bold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-ink-soft mb-0.5">قيم الصفوف (مفصولة بفواصل)</label>
                          <input
                            type="text"
                            value={form.gridAxisYValues}
                            onChange={(e) => setForm({ ...form, gridAxisYValues: e.target.value })}
                            placeholder="+4.00, +3.00, 0.00, -1.00..."
                            className="w-full bg-surface border border-line rounded px-2 py-1.5 text-xs text-ink font-mono"
                          />
                        </div>
                      </div>
                      {/* Unit Slots Configuration (الوحدات والمسميات الديناميكية) */}
                      <div className="bg-paper p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-black text-xs text-indigo-950 dark:text-indigo-200 block">
                              وحدات وتسميات الاختيار في الفاتورة (Dynamic Unit Slots):
                            </span>
                            <span className="text-[10px] text-ink-soft block mt-0.5">
                              حدد الوحدات التي تخرج من هذا الصنف تحت مسميات واضحة (مثل: عدسة يمين/شمال للنظارات، أو أجزاء مخصصة لأي نشاط).
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newKey = `unit_${(form.unitSlots?.length || 0) + 1}`;
                              setForm({
                                ...form,
                                unitSlots: [...(form.unitSlots || []), { key: newKey, label: `وحدة جديدة ${(form.unitSlots?.length || 0) + 1}` }]
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-700 transition-colors shadow-xs"
                          >
                            + إضافة وحدة جديدة
                          </button>
                        </div>

                        {/* List of Slots */}
                        <div className="space-y-2 pt-1">
                          {(form.unitSlots || []).map((slot, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2 bg-surface p-2 rounded-lg border border-line">
                              <span className="text-[11px] font-bold text-ink-soft w-6 text-center">#{sIdx + 1}</span>
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] text-ink-soft mb-0.5">رمز الوحدة (الكود)</label>
                                  <input
                                    type="text"
                                    value={slot.key}
                                    onChange={(e) => {
                                      const copy = [...form.unitSlots];
                                      copy[sIdx].key = e.target.value;
                                      setForm({ ...form, unitSlots: copy });
                                    }}
                                    className="w-full bg-paper border border-line rounded px-2 py-1 text-xs font-mono font-bold text-ink"
                                    placeholder="OD / unit_1"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] text-ink-soft mb-0.5">المسمى المعروض بالفاتورة والأوردر</label>
                                  <input
                                    type="text"
                                    value={slot.label}
                                    onChange={(e) => {
                                      const copy = [...form.unitSlots];
                                      copy[sIdx].label = e.target.value;
                                      setForm({ ...form, unitSlots: copy });
                                    }}
                                    className="w-full bg-paper border border-line rounded px-2 py-1 text-xs font-bold text-ink"
                                    placeholder="العين اليمنى / القطعة الأمامية"
                                    required
                                  />
                                </div>
                              </div>
                              {form.unitSlots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm({
                                      ...form,
                                      unitSlots: form.unitSlots.filter((_, idx) => idx !== sIdx)
                                    });
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                                  title="حذف هذه الوحدة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Allow Multi Units Toggle */}
                        <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.allowMultiUnits !== false}
                              onChange={(e) => setForm({ ...form, allowMultiUnits: e.target.checked })}
                              className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span className="font-bold text-ink text-[11px]">
                              السماح باختيار وحدات متعددة معاً كطقم/زوج في الفاتورة (Multi-Unit Selection)
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-paper border border-line rounded-btn font-bold text-ink hover:bg-surface"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-[var(--color-primary-contrast,#ffffff)] rounded-btn font-black shadow-md hover:bg-primary/90"
                >
                  حفظ القسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
