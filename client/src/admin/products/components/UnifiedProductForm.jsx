import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Copy,
  List,
  Save,
  Trash2,
  Check,
  ArrowRight,
  ArrowLeft,
  Layers,
  Sparkles,
  RotateCcw,
  Building2,
  Plus,
  Wrench,
  Link2,
  Barcode,
  X,
  CheckCircle2,
  Sliders,
  Eye,
  Camera,
  RefreshCw,
  Glasses,
  Store
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import ImageUploader from '../../../shared/components/ImageUploader';
import ProductAiImageStudio from './ProductAiImageStudio';
import SpecPickerModal from '../../../storefront/catalog/components/SpecPickerModal';
import SupplierModal from '../../../shared/components/SupplierModal';

/**
 * Unified, Reusable Product Form Component
 * Used for:
 *   1. Manual product creation (starts empty)
 *   2. Existing product editing
 *   3. Inside the multi-product slider/stack after AI file extraction (pre-filled)
 */
export default function UnifiedProductForm({
  initialData = null,
  categories = [],
  shippingClasses = [],
  supplierShipments = [],
  availableGroups = [],
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = 'حفظ المنتج',
  isSubmitting = false,
  mode = 'standalone', // 'standalone' | 'slider_card' | 'embedded'
  sliderInfo = null // { index, total, onNext, onPrev }
}) {
  const {
    token,
    showToast,
    branches = [],
    activeBranchId,
    isSuperAdmin,
    isBranchAdmin,
    user
  } = useStore();
  const effectiveToken = token || (typeof window !== 'undefined' ? localStorage.getItem('store_token') : '') || '';
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${effectiveToken}` } }), [effectiveToken]);

  const [suppliersList, setSuppliersList] = useState([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [candidateItems, setCandidateItems] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');

  useEffect(() => {
    if (!effectiveToken) return;
    axios
      .get('/api/admin/finance/suppliers', authHeader)
      .then((res) => {
        setSuppliersList(res.data?.suppliers || []);
      })
      .catch((err) => console.warn('Could not load suppliers for product form:', err.message));

    axios
      .get('/api/admin/products?limit=250', authHeader)
      .then((res) => {
        setCandidateItems(res.data?.products || []);
      })
      .catch((err) => console.warn('Could not load candidate items for linking:', err.message));
  }, [effectiveToken]);

  const initialBranchId =
    initialData?.branchId?._id ||
    initialData?.branchId ||
    (isBranchAdmin && user?.branchId ? String(user.branchId) : null) ||
    (activeBranchId && activeBranchId !== 'all' ? activeBranchId : null) ||
    (branches[0]?._id ? String(branches[0]._id) : '');

  const [form, setForm] = useState({
    branchId: initialBranchId,
    name: '',
    barcode: '',
    categoryId: '',
    groupCode: '',
    price: '',
    oldPrice: '',
    costPrice: '',
    stockCount: 10,
    storeStock: 10,
    externalStock: 0,
    opticsSpecs: {
      brand: '',
      modelCode: '',
      color: '',
      size: '',
      frameShape: '',
      frameStyle: 'full_rim',
      frameMaterial: '',
      gender: 'unisex'
    },
    description: '',
    images: [],
    tagsStr: '',
    specs: {},
    active: true,
    requiresShipping: true,
    shippingClassId: '',
    shippingMode: 'MAX',
    supplierShipmentId: '',
    purchaseUnitCost: '',
    warrantyPeriodMonths: 0,
    warrantyPolicy: '',
    suppliers: [],
    supplierId: '',
    criticalStockThreshold: 3,
    reorderQuantity: 10,
    linkedItemIds: []
  });

  const [modalGroupScope, setModalGroupScope] = useState('category'); // 'category' | 'all'
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [categorySpecsFacet, setCategorySpecsFacet] = useState([]);
  const [pickerModal, setPickerModal] = useState({ isOpen: false, specKey: '', specLabel: '' });

  // Multi-Variant System State
  const [isMultiVariantMode, setIsMultiVariantMode] = useState(false);
  const [variantAttributes, setVariantAttributes] = useState([
    { id: 1, name: 'اللون', values: [] },
    { id: 2, name: 'الذاكرة / السعة', values: [] }
  ]);
  const [newAttrName, setNewAttrName] = useState('');
  const [attrInputValues, setAttrInputValues] = useState({});
  const [variantRows, setVariantRows] = useState([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState([]);
  const [fastApply, setFastApply] = useState({ price: '', costPrice: '', stockCount: '' });
  const [variantImageModal, setVariantImageModal] = useState({ isOpen: false, rowIndex: null, variantName: '' });
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Sync initialData into form state whenever initialData changes
  useEffect(() => {
    if (initialData) {
      setForm({
        branchId:
          initialData.branchId?._id ||
          initialData.branchId ||
          (isBranchAdmin && user?.branchId ? String(user.branchId) : null) ||
          (activeBranchId && activeBranchId !== 'all' ? activeBranchId : null) ||
          (branches[0]?._id ? String(branches[0]._id) : ''),
        name: initialData.name || '',
        barcode: initialData.barcode || '',
        categoryId: initialData.categoryId?._id || initialData.categoryId || (categories[0]?._id || ''),
        groupCode: initialData.groupCode || '',
        price: initialData.price !== undefined ? initialData.price : '',
        oldPrice: initialData.oldPrice || '',
        costPrice: initialData.costPrice || '',
        stockCount: initialData.stockCount !== undefined ? initialData.stockCount : 10,
        storeStock: initialData.storeStock !== undefined ? initialData.storeStock : (initialData.stockCount ?? 10),
        externalStock: initialData.externalStock !== undefined ? initialData.externalStock : 0,
        opticsSpecs: {
          brand: initialData.opticsSpecs?.brand || '',
          modelCode: initialData.opticsSpecs?.modelCode || '',
          color: initialData.opticsSpecs?.color || '',
          size: initialData.opticsSpecs?.size || '',
          frameShape: initialData.opticsSpecs?.frameShape || '',
          frameStyle: initialData.opticsSpecs?.frameStyle || 'full_rim',
          frameMaterial: initialData.opticsSpecs?.frameMaterial || '',
          gender: initialData.opticsSpecs?.gender || 'unisex'
        },
        description: initialData.description || '',
        images: Array.isArray(initialData.images) ? [...initialData.images] : [],
        tagsStr: Array.isArray(initialData.tags)
          ? initialData.tags.join(', ')
          : typeof initialData.tagsStr === 'string'
          ? initialData.tagsStr
          : '',
        specs: initialData.specs && typeof initialData.specs === 'object' ? { ...initialData.specs } : {},
        active: initialData.active !== false,
        requiresShipping: initialData.requiresShipping !== false,
        shippingClassId: initialData.shippingClassId?._id || initialData.shippingClassId || '',
        shippingMode: initialData.shippingMode || 'MAX',
        supplierShipmentId: initialData.supplierShipmentId?._id || initialData.supplierShipmentId || '',
        purchaseUnitCost: initialData.purchaseUnitCost ?? initialData.costPrice ?? '',
        warrantyPeriodMonths: Number(initialData.warrantyPeriodMonths || 0),
        warrantyPolicy: initialData.warrantyPolicy || '',
        supplierId: initialData.supplierId?._id || initialData.supplierId || '',
        suppliers: Array.isArray(initialData.suppliers) ? initialData.suppliers : [],
        criticalStockThreshold: initialData.criticalStockThreshold !== undefined ? initialData.criticalStockThreshold : 3,
        reorderQuantity: initialData.reorderQuantity !== undefined ? initialData.reorderQuantity : 10,
        linkedItemIds: Array.isArray(initialData.linkedItemIds)
          ? initialData.linkedItemIds.map((item) => (typeof item === 'object' && item !== null ? item._id : item)).filter(Boolean)
          : []
      });

      // If existing product has a groupCode, check and load all sibling variants
      if (initialData.groupCode && effectiveToken) {
        setIsLoadingVariants(true);
        axios
          .get(`/api/admin/products/group-variants/${encodeURIComponent(initialData.groupCode)}`, authHeader)
          .then((res) => {
            const sibs = res.data?.variants || [];
            if (sibs.length > 0) {
              setIsMultiVariantMode(true);
              const attrMap = {};
              sibs.forEach((sib) => {
                Object.entries(sib.specs || {}).forEach(([k, v]) => {
                  if (!k) return;
                  if (!attrMap[k]) attrMap[k] = new Set();
                  if (v !== undefined && v !== null && String(v).trim()) {
                    attrMap[k].add(String(v).trim());
                  }
                });
              });

              const loadedAttrs = Object.entries(attrMap).map(([name, valSet], idx) => ({
                id: idx + 1,
                name,
                values: Array.from(valSet)
              }));

              if (loadedAttrs.length > 0) {
                setVariantAttributes(loadedAttrs);
              }

              const rows = sibs.map((sib, idx) => ({
                id: `var-${sib._id || idx}`,
                _id: sib._id,
                specs: { ...(sib.specs || {}) },
                price: sib.price ?? '',
                oldPrice: sib.oldPrice ?? '',
                costPrice: sib.costPrice ?? '',
                stockCount: sib.stockCount ?? 10,
                barcode: sib.barcode || String(sib._id || ''),
                images: Array.isArray(sib.images) ? [...sib.images] : []
              }));
              setVariantRows(rows);
            }
          })
          .catch((err) => console.warn('Could not load group variants:', err.message))
          .finally(() => setIsLoadingVariants(false));
      } else {
        setIsMultiVariantMode(false);
        setVariantRows([]);
        setDeletedVariantIds([]);
      }
    } else {
      setForm({
        branchId:
          (isBranchAdmin && user?.branchId ? String(user.branchId) : null) ||
          (activeBranchId && activeBranchId !== 'all' ? activeBranchId : null) ||
          (branches[0]?._id ? String(branches[0]._id) : ''),
        name: '',
        barcode: '',
        categoryId: categories[0]?._id || '',
        groupCode: '',
        price: '',
        oldPrice: '',
        costPrice: '',
        stockCount: 10,
        description: '',
        images: [],
        tagsStr: '',
        specs: {},
        active: true,
        requiresShipping: true,
        shippingClassId: '',
        shippingMode: 'MAX',
        supplierShipmentId: '',
        purchaseUnitCost: '',
        warrantyPeriodMonths: 0,
        warrantyPolicy: '',
    suppliers: [],
        supplierId: '',
        criticalStockThreshold: 3,
        reorderQuantity: 10,
        linkedItemIds: []
      });
      setIsMultiVariantMode(false);
      setVariantRows([]);
      setDeletedVariantIds([]);
    }
  }, [initialData, categories, effectiveToken]);

  // Recompute Cartesian product combination rows when attributes change
  const recomputeCartesianRows = (attrs, currentRows = variantRows) => {
    const activeAttrs = attrs.filter((a) => a.name.trim() && a.values.length > 0);
    if (activeAttrs.length === 0) {
      setVariantRows([]);
      return;
    }

    let combinations = [{}];
    for (const attr of activeAttrs) {
      const nextCombs = [];
      for (const curr of combinations) {
        for (const val of attr.values) {
          nextCombs.push({
            ...curr,
            [attr.name.trim()]: val
          });
        }
      }
      combinations = nextCombs;
    }

    const newRows = combinations.map((comb, idx) => {
      const existing = currentRows.find((r) =>
        Object.entries(comb).every(([k, v]) => r.specs?.[k] === v)
      );
      if (existing) {
        return existing;
      }
      return {
        id: `comb-${idx}-${Date.now()}`,
        specs: comb,
        price: form.price || '',
        oldPrice: form.oldPrice || '',
        costPrice: form.costPrice || '',
        stockCount: form.stockCount !== undefined && form.stockCount !== '' ? form.stockCount : 10,
        barcode: '',
        images: []
      };
    });

    setVariantRows(newRows);
  };

  const handleAddAttrValue = (attrId) => {
    const val = (attrInputValues[attrId] || '').trim();
    if (!val) return;
    setVariantAttributes((prev) => {
      const updated = prev.map((a) => {
        if (a.id === attrId) {
          if (a.values.includes(val)) return a;
          return { ...a, values: [...a.values, val] };
        }
        return a;
      });
      recomputeCartesianRows(updated);
      return updated;
    });
    setAttrInputValues((prev) => ({ ...prev, [attrId]: '' }));
  };

  const handleRemoveAttrValue = (attrId, valToRemove) => {
    setVariantAttributes((prev) => {
      const updated = prev.map((a) => {
        if (a.id === attrId) {
          return { ...a, values: a.values.filter((v) => v !== valToRemove) };
        }
        return a;
      });
      recomputeCartesianRows(updated);
      return updated;
    });
  };

  const handleAddAttribute = () => {
    const name = newAttrName.trim();
    if (!name) return;
    if (variantAttributes.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      if (showToast) showToast('هذه الخاصية مضافة بالفعل', 'warning');
      return;
    }
    const newAttr = { id: Date.now(), name, values: [] };
    const updated = [...variantAttributes, newAttr];
    setVariantAttributes(updated);
    setNewAttrName('');
  };

  const handleRemoveAttribute = (attrId) => {
    setVariantAttributes((prev) => {
      const updated = prev.filter((a) => a.id !== attrId);
      recomputeCartesianRows(updated);
      return updated;
    });
  };

  const handleDeleteVariantRow = (rowId) => {
    const rowToDelete = variantRows.find((r) => r.id === rowId);
    if (!rowToDelete) return;
    if (rowToDelete._id) {
      setDeletedVariantIds((prev) => (prev.includes(rowToDelete._id) ? prev : [...prev, rowToDelete._id]));
    }
    setVariantRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleRestoreAllCombinations = () => {
    recomputeCartesianRows(variantAttributes, []);
    setDeletedVariantIds([]);
    if (showToast) showToast('تمت استعادة كافة التركيبات المحتملة', 'info');
  };

  const handleFastApply = () => {
    if (fastApply.price === '' && fastApply.costPrice === '' && fastApply.stockCount === '') {
      if (showToast) showToast('أدخل قيمة واحدة على الأقل للتطبيق على الكل', 'warning');
      return;
    }
    setVariantRows((prev) =>
      prev.map((r) => ({
        ...r,
        price: fastApply.price !== '' ? fastApply.price : r.price,
        costPrice: fastApply.costPrice !== '' ? fastApply.costPrice : r.costPrice,
        stockCount: fastApply.stockCount !== '' ? fastApply.stockCount : r.stockCount
      }))
    );
    if (showToast) showToast('تم تطبيق القيم على جميع الخيارات المتاحة في الجدول', 'success');
  };

  const selectedCategoryObj = categories.find((c) => c._id === form.categoryId);

  // Filter availableGroups by groupSearchQuery
  const filteredModalGroups = availableGroups.filter((g) => {
    if (!groupSearchQuery.trim()) return true;
    const q = groupSearchQuery.trim().toLowerCase();
    return (
      g.groupCode.toLowerCase().includes(q) ||
      (g.products || []).some((p) => (p.name || '').toLowerCase().includes(q))
    );
  });

  const activeModalGroupObj = availableGroups.find(
    (g) => g.groupCode === String(form.groupCode || '').trim()
  );

  const applyTemplateProductToForm = (templateProd, groupCode) => {
    if (!templateProd) return;
    setForm((prev) => ({
      ...prev,
      name: templateProd.name || prev.name,
      groupCode: groupCode || prev.groupCode,
      price: templateProd.price ?? prev.price,
      oldPrice: templateProd.oldPrice ?? prev.oldPrice,
      costPrice: templateProd.costPrice ?? prev.costPrice,
      stockCount: templateProd.stockCount ?? prev.stockCount,
      description: templateProd.description || prev.description,
      images: Array.isArray(templateProd.images) ? [...templateProd.images] : prev.images,
      tagsStr: Array.isArray(templateProd.tags) ? templateProd.tags.join(', ') : prev.tagsStr,
      specs: templateProd.specs ? { ...templateProd.specs } : prev.specs,
      active: templateProd.active !== false,
      requiresShipping: templateProd.requiresShipping !== false,
      shippingClassId: templateProd.shippingClassId?._id || templateProd.shippingClassId || prev.shippingClassId,
      shippingMode: templateProd.shippingMode || prev.shippingMode,
      warrantyPeriodMonths: templateProd.warrantyPeriodMonths || prev.warrantyPeriodMonths,
      warrantyPolicy: templateProd.warrantyPolicy || prev.warrantyPolicy
    }));
  };

  const handleAddSupplierToChain = (supplierId) => {
    if (!supplierId) return;
    const sup = suppliersList.find((s) => s._id === supplierId);
    if (!sup) return;
    const current = Array.isArray(form.suppliers) ? [...form.suppliers] : [];
    if (current.some((c) => (c.supplierId?._id || c.supplierId) === supplierId)) {
      if (showToast) showToast('هذا المورد مضاف بالفعل في قائمة الأولويات', 'warning');
      return;
    }
    const nextPriority = current.length + 1;
    current.push({
      supplierId: sup._id,
      supplierName: sup.name,
      phone: sup.phone || '',
      whatsapp: sup.whatsappPhone || sup.phone || '',
      priority: nextPriority,
      supplyCost: Number(form.costPrice || 0),
      notes: ''
    });
    setForm((prev) => ({
      ...prev,
      suppliers: current,
      supplierId: current[0]?.supplierId || prev.supplierId
    }));
  };

  const handleRemoveSupplierFromChain = (index) => {
    const current = Array.isArray(form.suppliers) ? [...form.suppliers] : [];
    current.splice(index, 1);
    const reindexed = current.map((c, idx) => ({ ...c, priority: idx + 1 }));
    setForm((prev) => ({
      ...prev,
      suppliers: reindexed,
      supplierId: reindexed[0]?.supplierId || ''
    }));
  };

  const handleMoveSupplierPriority = (index, direction) => {
    const current = Array.isArray(form.suppliers) ? [...form.suppliers] : [];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[index];
    current[index] = current[targetIdx];
    current[targetIdx] = temp;
    const reindexed = current.map((c, idx) => ({ ...c, priority: idx + 1 }));
    setForm((prev) => ({
      ...prev,
      suppliers: reindexed,
      supplierId: reindexed[0]?.supplierId || ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const tags = form.tagsStr
      .split(/[,،;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const isServiceCategory = selectedCategoryObj?.type === 'service';

    if (isMultiVariantMode) {
      if (variantRows.length === 0) {
        if (showToast) showToast('يرجى إضافة خيارات وتركيبات للمنتج في الجدول بالأسفل', 'error');
        return;
      }
      if (deletedVariantIds.length > 0) {
        const ok = window.confirm(
          `تنبيه: سيتم حذف ${deletedVariantIds.length} من خيارات هذا المنتج نهائياً من قاعدة البيانات وسلات العملاء والمفضلة مع إشعارهم. هل أنت متأكد من الحفظ والمتابعة؟`
        );
        if (!ok) return;
      }

      const multiPayload = {
        isMultiVariant: true,
        baseProduct: {
          branchId: form.branchId,
          name: form.name.trim(),
          categoryId: form.categoryId,
          groupCode: String(form.groupCode || '').trim(),
          description: form.description,
          warrantyPeriodMonths: Number(form.warrantyPeriodMonths || 0),
          warrantyPolicy: String(form.warrantyPolicy || '').trim(),
          supplierId: (form.suppliers && form.suppliers[0]?.supplierId) || form.supplierId || null,
      suppliers: Array.isArray(form.suppliers) ? form.suppliers : [],
          criticalStockThreshold: Number(form.criticalStockThreshold !== '' ? form.criticalStockThreshold : 3),
          reorderQuantity: Number(form.reorderQuantity !== '' ? form.reorderQuantity : 10),
          shippingClassId: form.shippingClassId || null,
          shippingMode: form.shippingMode || 'MAX',
          requiresShipping: isServiceCategory ? false : form.requiresShipping !== false,
          tags,
          specs: form.specs,
          images: form.images
        },
        variants: variantRows.map((r) => ({
          _id: r._id || undefined,
          specs: r.specs || {},
          price: Number(r.price || 0),
          oldPrice: Number(r.oldPrice || 0),
          costPrice: Number(r.costPrice || 0),
          stockCount: Number(r.stockCount ?? 0),
          barcode: String(r.barcode || '').trim(),
          images: Array.isArray(r.images) ? r.images : []
        })),
        deletedVariantIds
      };

      if (onSubmit) {
        onSubmit(multiPayload);
      }
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      barcode: String(form.barcode || '').trim(),
      categoryId: form.categoryId,
      groupCode: String(form.groupCode || '').trim(),
      price: Number(form.price || 0),
      oldPrice: Number(form.oldPrice || 0),
      costPrice: Number(form.costPrice || 0),
      storeStock: Number(form.storeStock !== undefined ? form.storeStock : (form.stockCount || 0)),
      externalStock: Number(form.externalStock || 0),
      stockCount: Number(form.storeStock !== undefined ? form.storeStock : (form.stockCount || 0)) + Number(form.externalStock || 0),
      opticsSpecs: form.opticsSpecs || {},
      tags,
      specs: form.specs,
      requiresShipping: isServiceCategory ? false : form.requiresShipping !== false,
      warrantyPeriodMonths: Number(form.warrantyPeriodMonths || 0),
      warrantyPolicy: String(form.warrantyPolicy || '').trim(),
      supplierId: (form.suppliers && form.suppliers[0]?.supplierId) || form.supplierId || null,
      suppliers: Array.isArray(form.suppliers) ? form.suppliers : [],
      criticalStockThreshold: Number(form.criticalStockThreshold !== '' ? form.criticalStockThreshold : 3),
      reorderQuantity: Number(form.reorderQuantity !== '' ? form.reorderQuantity : 10),
      linkedItemIds: Array.isArray(form.linkedItemIds) ? form.linkedItemIds : [],
      purchaseUnitCost:
        form.purchaseUnitCost !== '' && form.purchaseUnitCost !== null
          ? Number(form.purchaseUnitCost)
          : Number(form.costPrice || 0)
    };

    if (onSubmit) {
      onSubmit(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold text-ink">
      {/* Slider Navigation Bar (if in multi-product review mode) */}
      {sliderInfo && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black">
              المنتج {sliderInfo.index + 1} من {sliderInfo.total}
            </span>
            <span className="text-[11px] font-bold text-ink-soft truncate max-w-xs">
              {form.name || 'منتج مستخرج جديد'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={sliderInfo.index <= 0}
              onClick={sliderInfo.onPrev}
              className="p-1.5 rounded-lg border border-line bg-surface text-ink disabled:opacity-40 hover:bg-paper"
              title="المنتج السابق"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={sliderInfo.index >= sliderInfo.total - 1}
              onClick={sliderInfo.onNext}
              className="p-1.5 rounded-lg border border-line bg-surface text-ink disabled:opacity-40 hover:bg-paper"
              title="المنتج التالي"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 transition-colors"
                title="حذف هذا المنتج من القائمة المستخرجة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mode Switcher: Single Product vs Multi-Variant Product */}
      {selectedCategoryObj?.allowMultiVariants !== false ? (
        <div className="p-3.5 rounded-2xl bg-paper border-2 border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-black text-ink">نوع وطريقة إدخال المنتج:</span>
              {isLoadingVariants && (
                <span className="text-[10px] text-primary flex items-center gap-1 font-bold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> جاري فحص خيارات المجموعة...
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink-soft mt-0.5">
              حدد ما إذا كان هذا المنتج بسيطاً (سعر ومخزون موحد) أو متعدداً (ألوان، مقاسات، أو سعات مختلفة)
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-surface border border-line p-1 gap-1 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsMultiVariantMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                !isMultiVariantMode
                  ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                  : 'text-ink-soft hover:text-ink hover:bg-paper'
              }`}
            >
              <span>🏷️ منتج بسيط فردي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMultiVariantMode(true);
                if (!form.groupCode) {
                  const autoCode =
                    'grp_' +
                    (form.name
                      ? form.name.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').slice(0, 20)
                      : 'prod') +
                    '_' +
                    Math.random().toString(36).slice(2, 6);
                  setForm((prev) => ({ ...prev, groupCode: autoCode }));
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                isMultiVariantMode
                  ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                  : 'text-ink-soft hover:text-ink hover:bg-paper'
              }`}
            >
              <span>⚡ منتج متعدد الخيارات (Variants)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-surface border border-line flex items-center justify-between text-xs text-ink-soft">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-bold text-ink">نمط الإدخال: منتج بسيط فردي</span>
            <span className="text-[10px] bg-paper px-2 py-0.5 rounded border border-line">
              (نمط الخيارات المتعددة معطّل بناءً على سياسة قسم "{selectedCategoryObj?.name}")
            </span>
          </div>
        </div>
      )}

      {/* Grid Specs Banner if category uses 2D matrix */}
      {selectedCategoryObj?.hasGridSpecs && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-black text-xs">
              <span className="p-1 rounded-lg bg-indigo-600 text-white text-[10px]">📊</span>
              <span>مصفوفة مقاسات شبكية (2D Grid Stock Matrix)</span>
              <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-full font-bold">
                {selectedCategoryObj?.gridConfig?.axisY?.key || 'SPH'} × {selectedCategoryObj?.gridConfig?.axisX?.key || 'CYL'}
              </span>
            </div>
            <p className="text-[11px] text-ink-soft">
              هذا القسم يُدار بنظام رف المقاسات الثنائي. رصيد الصنف الإجمالي سيتزامن تلقائياً مع مجموع خانات المصفوفة، والبيع يخصم المقاس بدقة.
            </p>
          </div>
          {initialData?._id ? (
            <a
              href={`/admin/lens-matrix?productId=${initialData._id}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shrink-0 transition-transform active:scale-95"
            >
              <span>فتح مصفوفة المقاسات (Grid)</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-[11px] font-bold text-indigo-600 bg-white/70 dark:bg-black/30 px-3 py-1.5 rounded-lg border border-indigo-200/50">
              💡 احفظ المنتج أولاً لإدخال وجرد مصفوفة مقاساته
            </span>
          )}
        </div>
      )}

      {/* 1. Basic Information */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-ink-soft mb-1">اسم المنتج التجاري *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: شنبر ريبان Ray-Ban أفياتور أسود، عدسة بلوكات 1.56..."
              className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50 font-bold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-ink-soft text-xs font-bold">
                {isMultiVariantMode ? 'باركود المعرف العام (اختياري)' : 'باركود المنتج (Barcode)'}
              </label>
              <button
                type="button"
                onClick={() => {
                  const randomBarcode = '622' + Math.floor(1000000000 + Math.random() * 9000000000);
                  setForm((prev) => ({ ...prev, barcode: randomBarcode }));
                }}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                توليد باركود
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder={isMultiVariantMode ? 'تلقائي / محدد بالجدول' : 'امسح بالماسح أو اتركه فارغاً'}
                className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-mono text-xs placeholder:text-ink-soft/40"
              />
              <span className="absolute left-2.5 top-2.5 text-ink-soft/50 text-[10px] font-mono">
                {form.barcode ? `${form.barcode.length} خانة` : 'تلقائي'}
              </span>
            </div>
          </div>
        </div>

                {/* Multi-Branch Assignment Section */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="font-black text-ink flex items-center gap-1.5 text-xs">
              <Building2 className="w-4 h-4 text-primary" />
              <span>الفرع التابع له هذا المنتج (Branch Assignment) *</span>
            </label>
            {isBranchAdmin ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                مقيد بنطاق فرعك المخصص
              </span>
            ) : (
              <span className="text-[10px] font-bold text-ink-soft">
                يمكن للسوبر آدمن تعيين وتغيير فرع المنتج
              </span>
            )}
          </div>

          {isBranchAdmin ? (
            <div className="p-2.5 rounded-btn bg-surface border border-line text-ink font-bold text-xs flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span>
                {branches.find((b) => String(b._id) === String(form.branchId))?.name || 'الفرع المخصص'}
              </span>
            </div>
          ) : (
            <select
              value={form.branchId || ''}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="w-full bg-surface border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-bold text-xs"
            >
              <option value="" disabled>-- اختر الفرع التابع له المنتج --</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  🏢 {b.name} ({b.city}) {b.isMain ? '★ [الفرع الرئيسي]' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={isMultiVariantMode ? 'sm:col-span-3' : 'sm:col-span-2'}>
            <label className="block text-ink-soft mb-1">القسم / التصنيف *</label>
            <select
              value={form.categoryId}
              onChange={(e) => {
                const newCatId = e.target.value;
                const targetCat = categories.find((c) => c._id === newCatId);
                if (targetCat && targetCat.allowMultiVariants === false) {
                  setIsMultiVariantMode(false);
                }
                setForm((prev) => ({
                  ...prev,
                  categoryId: newCatId,
                  ...(targetCat?.type === 'service' ? { requiresShipping: false } : {}),
                  opticsSpecs: {
                    ...(prev.opticsSpecs || {}),
                    isMatrixManaged: Boolean(targetCat?.hasGridSpecs)
                  }
                }));
              }}
              className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-bold"
            >
              <option value="">-- بدون قسم --</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.type === 'service' ? '🔧 [خدمة] ' : '📦 [منتج] '}{c.name}
                </option>
              ))}
            </select>
          </div>

          {!isMultiVariantMode && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-ink-soft mb-1 text-[11px]" title="مخزن المحل متاح فورياً للبيع في شاشة الكاشير">
                  🏪 مخزن المحل (للبيع) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={form.storeStock ?? form.stockCount}
                  onChange={(e) => {
                    const stVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const extVal = Number(form.externalStock || 0);
                    setForm({
                      ...form,
                      storeStock: stVal,
                      stockCount: stVal + extVal
                    });
                  }}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-mono font-bold"
                  placeholder="مخزن المحل"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1 text-[11px]" title="المستودع الخارجي الاحتياطي">
                  🏢 المخزن الخارجي
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.externalStock ?? 0}
                  onChange={(e) => {
                    const extVal = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const stVal = Number(form.storeStock ?? form.stockCount ?? 0);
                    setForm({
                      ...form,
                      externalStock: extVal,
                      stockCount: stVal + extVal
                    });
                  }}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-mono font-bold"
                  placeholder="المخزن الخارجي"
                />
              </div>
            </div>
          )}
        </div>

        {/* Optical Frame Specifications Card (شنبر / إطار) */}
        <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-black text-ink flex items-center gap-2 text-xs">
              <Glasses className="w-4 h-4 text-primary" />
              <span>مواصفات الشنبر والإطار (الماركة، الموديل، اللون، المقاس، والشكل)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                const b = form.opticsSpecs?.brand?.trim() || '';
                const m = form.opticsSpecs?.modelCode?.trim() || '';
                const c = form.opticsSpecs?.color?.trim() || '';
                const s = form.opticsSpecs?.frameShape?.trim() || '';
                const autoName = `شنبر ${b} ${m} ${c} ${s}`.replace(/\s+/g, ' ').trim();
                if (autoName && autoName !== 'شنبر') {
                  setForm((prev) => ({ ...prev, name: autoName }));
                }
              }}
              className="text-[10px] text-primary hover:underline font-black flex items-center gap-1"
            >
              <span>⚡ ملء الاسم تلقائياً من المواصفات</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* الماركة */}
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">الماركة (Brand)</label>
              <input
                type="text"
                value={form.opticsSpecs?.brand || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, brand: val },
                    specs: { ...prev.specs, 'الماركة': val }
                  }));
                }}
                placeholder="مثال: Ray-Ban, Carrera..."
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary font-bold"
              />
            </div>

            {/* الموديل */}
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">الموديل (Model / Code)</label>
              <input
                type="text"
                value={form.opticsSpecs?.modelCode || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, modelCode: val },
                    specs: { ...prev.specs, 'الموديل': val }
                  }));
                }}
                placeholder="مثال: RB3025, 5402..."
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary font-bold"
              />
            </div>

            {/* اللون */}
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">اللون (Color)</label>
              <input
                type="text"
                value={form.opticsSpecs?.color || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, color: val },
                    specs: { ...prev.specs, 'اللون': val }
                  }));
                }}
                placeholder="مثال: أسود لامع، هافان، ذهبي..."
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary font-bold"
              />
            </div>

            {/* المقاس */}
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">المقاس (Size)</label>
              <input
                type="text"
                value={form.opticsSpecs?.size || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, size: val },
                    specs: { ...prev.specs, 'المقاس': val }
                  }));
                }}
                placeholder="مثال: 52-18-140"
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary font-bold font-mono"
              />
            </div>

            {/* الشكل */}
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">الشكل (Shape)</label>
              <select
                value={form.opticsSpecs?.frameShape || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, frameShape: val },
                    specs: { ...prev.specs, 'الشكل': val }
                  }));
                }}
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary font-bold"
              >
                <option value="">-- اختر الشكل --</option>
                <option value="أفياتور (Aviator)">أفياتور (Aviator)</option>
                <option value="مستطيل (Rectangle)">مستطيل (Rectangle)</option>
                <option value="دائري (Round)">دائري (Round)</option>
                <option value="كات آي (Cat Eye)">كات آي (Cat Eye)</option>
                <option value="مربع (Square)">مربع (Square)</option>
                <option value="بيضاوي (Oval)">بيضاوي (Oval)</option>
                <option value="مضلع / هندسي (Hexagonal)">مضلع / هندسي</option>
                <option value="رياضي (Sport)">رياضي (Sport)</option>
              </select>
            </div>
          </div>

          {/* نوع الإطار والخامة والفئة */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">نوع الإطار (Style)</label>
              <select
                value={form.opticsSpecs?.frameStyle || 'full_rim'}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, frameStyle: val },
                    specs: { ...prev.specs, 'نوع الإطار': val }
                  }));
                }}
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary"
              >
                <option value="full_rim">إطار كامل (Full Rim)</option>
                <option value="semi_rimless">نصف إطار (Semi-Rimless)</option>
                <option value="rimless">بدون إطار (Rimless)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-ink-soft mb-1">الخامة (Material)</label>
              <select
                value={form.opticsSpecs?.frameMaterial || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, frameMaterial: val },
                    specs: { ...prev.specs, 'الخامة': val }
                  }));
                }}
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary"
              >
                <option value="">-- اختياري --</option>
                <option value="معدن (Metal)">معدن (Metal)</option>
                <option value="أسيتات / بلاستيك (Acetate)">أسيتات / بلاستيك (Acetate)</option>
                <option value="تيتانيوم (Titanium)">تيتانيوم خفيف (Titanium)</option>
                <option value="بلاستيك مرن (TR90)">بلاستيك مرن (TR90)</option>
                <option value="كربون فايبر">كربون فايبر (Carbon Fiber)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-ink-soft mb-1">الفئة (Gender)</label>
              <select
                value={form.opticsSpecs?.gender || 'unisex'}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    opticsSpecs: { ...prev.opticsSpecs, gender: val },
                    specs: { ...prev.specs, 'الفئة': val }
                  }));
                }}
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary"
              >
                <option value="unisex">للجنسين (Unisex)</option>
                <option value="men">رجالي (Men)</option>
                <option value="women">حريمي (Women)</option>
                <option value="kids">أطفالي (Kids)</option>
              </select>
            </div>
          </div>
        </div>

        {isMultiVariantMode ? (
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="text-xs">
              <span className="font-black text-indigo-700 dark:text-indigo-300 block">
                ⚡ وضع منتج متعدد الخيارات (Multi-Variant Mode) نشط
              </span>
              <span className="text-ink-soft text-[11px]">
                يتم تحديد أسعار البيع والتكلفة والكميات والباركود والصور لكل خيار ولون ومقاس بشكل مستقل في جدول مصفوفة المتغيرات بالأسفل.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">سعر البيع النهائي *</label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-mono"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">السعر القديم (إن وجد)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.oldPrice}
                onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-mono"
              />
            </div>

            <div>
              <label className="block text-ink-soft mb-1">سعر التكلفة (لحساب الأرباح)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink font-mono"
              />
            </div>
          </div>
        )}

        {selectedCategoryObj?.type === 'service' && (
          <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-2.5 text-orange-800 dark:text-orange-200">
            <Wrench className="w-5 h-5 text-orange-600 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-black block text-xs">هذا العنصر مصنف كـ «خدمة صيانة / تركيب»</span>
              <span>
                الخدمات لا تتطلب شحناً مادياً أو مصاريف شحن، ويتم تتبعها كحجز موعد وتنفيذ ميداني من قِبل الفني.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Warranty & Maintenance Policy (مدة الضمان وسياسة الصيانة) */}
      <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-indigo-600 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>فترة الضمان وسياسة الصيانة (Warranty & Maintenance)</span>
          </span>
          <span className="text-[11px] text-ink-soft font-bold">
            {Number(form.warrantyPeriodMonths || 0) > 0
              ? `${form.warrantyPeriodMonths} شهراً (${Math.round((form.warrantyPeriodMonths / 12) * 10) / 10} سنة)`
              : 'بدون ضمان / غير معرف'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-ink-soft mb-1 font-bold">
              مدة الضمان من تاريخ الشراء (بالأشهر):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={form.warrantyPeriodMonths ?? 0}
                onChange={(e) =>
                  setForm({ ...form, warrantyPeriodMonths: Math.max(0, parseInt(e.target.value, 10) || 0) })
                }
                placeholder="0 = بدون ضمان"
                className="w-full bg-paper border border-line rounded-btn p-2 text-xs font-bold text-ink outline-none focus:border-indigo-500 font-mono"
              />
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, warrantyPeriodMonths: 12 })}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-surface border border-line hover:border-indigo-500 text-ink"
                >
                  سنة
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, warrantyPeriodMonths: 24 })}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-surface border border-line hover:border-indigo-500 text-ink"
                >
                  سنتين
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-ink-soft mb-1 font-bold">
              شروط أو ملاحظات الضمان (اختياري):
            </label>
            <input
              type="text"
              value={form.warrantyPolicy || ''}
              onChange={(e) => setForm({ ...form, warrantyPolicy: e.target.value })}
              placeholder="مثال: ضمان ضد عيوب الصناعة مع المركز المعتمد"
              className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Shipping Class / Mode & Supplier Shipment */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black text-emerald-600">
            🚚 إعدادات الشحن وربط شحنة المورد
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-ink">
            <input
              type="checkbox"
              checked={form.requiresShipping !== false}
              onChange={(e) => setForm({ ...form, requiresShipping: e.target.checked })}
              className="accent-primary"
            />
            <span>هذا المنتج يتطلب شحناً</span>
          </label>
        </div>

        {form.requiresShipping !== false && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">
                فئة الشحن المرتبطة بالمنتج (Shipping Class):
              </label>
              <select
                value={form.shippingClassId}
                onChange={(e) => {
                  const cls = shippingClasses.find((c) => c._id === e.target.value);
                  setForm({
                    ...form,
                    shippingClassId: e.target.value,
                    shippingMode: cls?.defaultCalculationMode || form.shippingMode || 'MAX'
                  });
                }}
                className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink"
              >
                <option value="">-- حسب فئة عنوان العميل تلقائياً --</option>
                {shippingClasses.map((sc) => (
                  <option key={sc._id} value={sc._id}>
                    {sc.name} ({sc.code}) — للعميل: {sc.customerPrice}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-ink-soft mb-1">
                نمط احتساب الشحن في السلة (Calculation Mode):
              </label>
              <select
                value={form.shippingMode}
                onChange={(e) => setForm({ ...form, shippingMode: e.target.value })}
                className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-black text-ink"
              >
                <option value="MAX">MAX — يدخل في حساب أعلى شحن أساسي مرة واحدة</option>
                <option value="ADD">ADD — يُضاف شحنه فوق مبلغ الشحن الأساسي</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3.5. Supplier & Critical Stock Reorder Configuration */}
      <div className="p-3.5 rounded-2xl bg-orange-500/5 border border-orange-500/25 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-black text-orange-700 dark:text-orange-400">
              المورد المعتمد وتنبيهات إعادة التوريد الذكية
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-2.5 py-1 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[11px] font-bold border border-orange-500/30 flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مورد جديد فوراً</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-[11px] text-ink-soft mb-1 font-bold">
              المورد المسؤول عن هذا المنتج:
            </label>
            <select
              value={form.supplierId || ''}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink"
            >
              <option value="">-- بدون مورد محدد حالياً --</option>
              {suppliersList.map((sup) => (
                <option key={sup._id} value={sup._id}>
                  {sup.name} {sup.specialty ? `(${sup.specialty})` : ''} - {sup.phone || sup.whatsappPhone || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-ink-soft mb-1 font-bold">
              حد المخزون الحرج للتنبيه (Threshold):
            </label>
            <input
              type="number"
              min="0"
              value={form.criticalStockThreshold}
              onChange={(e) => setForm({ ...form, criticalStockThreshold: e.target.value })}
              placeholder="3"
              className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink font-mono"
            />
            <span className="text-[10px] text-ink-soft">إشعار إذا قل المخزون عن هذا الرقم</span>
          </div>

          <div>
            <label className="block text-[11px] text-ink-soft mb-1 font-bold">
              الكمية المقترحة لإعادة الطلب (Reorder Qty):
            </label>
            <input
              type="number"
              min="1"
              value={form.reorderQuantity}
              onChange={(e) => setForm({ ...form, reorderQuantity: e.target.value })}
              placeholder="10"
              className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink font-mono"
            />
            <span className="text-[10px] text-ink-soft">الكمية الافتراضية في رسالة واتساب المورد</span>
          </div>
        </div>

        {/* Multi-Supplier Waterfall Priority Chain */}
        <div className="pt-3 border-t border-orange-500/20 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-ink flex items-center gap-1.5">
                <span>سلسلة الموردين والأولويات الذكية (Waterfall Chain)</span>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[10px] font-black">
                  {(form.suppliers || []).length} موردين
                </span>
              </span>
              <p className="text-[10px] text-ink-soft">
                عند إرسال طلب توريد، يتم إرسال رابط تأكيد التوريد للأول، وفي حال اعتذاره ينتقل الطلب تلقائياً للبديل التالي.
              </p>
            </div>

            {/* Quick Add Supplier Selector */}
            <div className="flex items-center gap-2">
              <select
                id="quickAddSupplierSelect"
                className="bg-surface border border-line rounded-btn p-1.5 text-xs font-bold text-ink"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddSupplierToChain(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">+ اختر مورد لإضافته للأولويات...</option>
                {suppliersList.map((sup) => (
                  <option key={sup._id} value={sup._id}>
                    {sup.name} ({sup.phone || 'بدون هاتف'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Suppliers List */}
          {(form.suppliers || []).length === 0 ? (
            <p className="text-[11px] text-ink-soft py-2 italic bg-paper/50 rounded-xl px-3 border border-line">
              لم يتم تحديد سلسلة أولويات بعد. سيتم الاعتماد على المورد الأساسي المختار أعلاه.
            </p>
          ) : (
            <div className="space-y-1.5">
              {(form.suppliers || []).map((sup, idx) => (
                <div
                  key={sup.supplierId?._id || sup.supplierId || idx}
                  className="p-2.5 rounded-xl bg-surface border border-line flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                      idx === 0
                        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                        : 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                    }`}>
                      {idx === 0 ? '⭐ #1 المورد الأساسي' : `بديل #${idx + 1}`}
                    </span>
                    <strong className="text-ink truncate">{sup.supplierName || 'مورد'}</strong>
                    {sup.phone && (
                      <span className="text-[10px] text-ink-soft font-mono" dir="ltr">
                        {sup.phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSupplierPriority(idx, 'up')}
                      className="p-1 rounded bg-paper border border-line text-ink hover:text-primary disabled:opacity-30 text-[10px]"
                      title="رفع الأولوية"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === (form.suppliers.length - 1)}
                      onClick={() => handleMoveSupplierPriority(idx, 'down')}
                      className="p-1 rounded bg-paper border border-line text-ink hover:text-primary disabled:opacity-30 text-[10px]"
                      title="خفض الأولوية"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSupplierFromChain(idx)}
                      className="p-1 rounded bg-paper border border-line text-red-500 hover:bg-red-500/10 text-[10px]"
                      title="حذف من السلسلة"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Category Specs Section */}
      {selectedCategoryObj?.specs && Object.keys(selectedCategoryObj.specs).length > 0 && (
        <div className="p-3.5 rounded-2xl bg-paper/60 border border-line space-y-2.5">
          <label className="block text-ink font-black">
            المواصفات الفنية الخاصة بالقسم ({selectedCategoryObj.name}):
          </label>
          <div className="space-y-2">
            {Object.entries(selectedCategoryObj.specs).map(([specKey, specLabel]) => (
              <div key={specKey} className="flex items-center gap-2">
                <span className="w-28 text-ink-soft truncate">{specLabel}</span>
                <input
                  type="text"
                  value={form.specs[specKey] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      specs: { ...form.specs, [specKey]: e.target.value }
                    })
                  }
                  className="flex-1 bg-surface border border-line rounded-btn p-2 outline-none focus:border-primary text-xs text-ink"
                  placeholder={`قيمة ${specLabel}...`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MULTI-VARIANT MATRIX ENGINE or SINGLE PRODUCT GROUP CODE */}
      {isMultiVariantMode ? (
        <div className="p-4 sm:p-5 rounded-3xl bg-indigo-500/5 border-2 border-indigo-500/30 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
            <div>
              <h3 className="text-sm font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>نظام المتغيرات ومصفوفة الخيارات (Multi-Variant Cartesian Matrix)</span>
              </h3>
              <p className="text-[11px] text-ink-soft mt-0.5">
                أدخل خصائص المنتج المتغيرة (مثل الألوان أو السعات أو الرامات)، وسيتم توليد كافة التركيبات المحتملة تلقائياً في الجدول.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                {variantRows.length} خيارات نشطة
              </span>
            </div>
          </div>

          {/* Group Code Field for the multi-variant set */}
          <div className="p-3 rounded-2xl bg-surface border border-line space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-ink flex items-center gap-1.5">
                <span>معرف المجموعة المشترك (Group Code):</span>
                <span className="text-[10px] text-ink-soft font-normal">(يربط كافة هذه الخيارات في واجهة المتجر كمنتج واحد)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const autoCode =
                    'grp_' +
                    (form.name
                      ? form.name.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').slice(0, 20)
                      : 'prod') +
                    '_' +
                    Math.random().toString(36).slice(2, 6);
                  setForm((prev) => ({ ...prev, groupCode: autoCode }));
                }}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                توليد كود تلقائي
              </button>
            </div>
            <input
              type="text"
              required
              value={form.groupCode || ''}
              onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
              placeholder="مثال: s24-ultra-titanium"
              className="w-full bg-paper border border-line rounded-btn p-2 text-xs font-mono font-bold text-ink"
            />
          </div>

          {/* Step A: Attributes & Multi-Value Chips */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>1. حدد خصائص وقيم الخيارات (Attributes & Values):</span>
              </h4>
              {selectedCategoryObj?.specs && Object.keys(selectedCategoryObj.specs).length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-ink-soft">اقتراحات القسم:</span>
                  {Object.values(selectedCategoryObj.specs).slice(0, 4).map((specLabel) => (
                    <button
                      key={specLabel}
                      type="button"
                      onClick={() => {
                        if (!variantAttributes.some((a) => a.name === specLabel)) {
                          const updated = [...variantAttributes, { id: Date.now(), name: specLabel, values: [] }];
                          setVariantAttributes(updated);
                        }
                      }}
                      className="px-2 py-0.5 rounded-lg bg-surface border border-line text-[10px] font-bold text-ink hover:border-primary"
                    >
                      + {specLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {variantAttributes.map((attr) => (
                <div
                  key={attr.id}
                  className="p-3 rounded-2xl bg-surface border border-line space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-line pb-1.5">
                    <span className="text-xs font-black text-ink">{attr.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(attr.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="حذف هذه الخاصية"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Chips of values */}
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                    {attr.values.length === 0 ? (
                      <span className="text-[11px] text-ink-soft/60 italic">لا توجد قيم مضافة بعد...</span>
                    ) : (
                      attr.values.map((v) => (
                        <span
                          key={v}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-xs font-bold"
                        >
                          <span>{v}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttrValue(attr.id, v)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add value input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder={`أضف قيمة لـ ${attr.name} واضغط Enter...`}
                      value={attrInputValues[attr.id] || ''}
                      onChange={(e) =>
                        setAttrInputValues((prev) => ({ ...prev, [attr.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAttrValue(attr.id);
                        }
                      }}
                      className="flex-1 bg-paper border border-line rounded-btn p-1.5 text-xs text-ink font-bold outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAttrValue(attr.id)}
                      className="px-2.5 py-1.5 rounded-btn bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add New Attribute Card */}
              <div className="p-3 rounded-2xl bg-surface/60 border-2 border-dashed border-line flex flex-col justify-center gap-2">
                <span className="text-xs font-bold text-ink-soft">إضافة خاصية جديدة (مثل اللون، المقاس، الرام):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="اسم الخاصية..."
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAttribute();
                      }
                    }}
                    className="flex-1 bg-paper border border-line rounded-btn p-1.5 text-xs text-ink font-bold outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddAttribute}
                    className="px-3 py-1.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-bold hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step B: Fast Apply Bar */}
          <div className="p-3 rounded-2xl bg-surface border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>شريط التعبئة السريعة (تطبيق موحد على جميع التركيبات):</span>
              </span>
              <span className="text-[10px] text-ink-soft">لتوفير الوقت عند إدخال عشرات الخيارات</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="number"
                placeholder="سعر بيع موحد..."
                value={fastApply.price}
                onChange={(e) => setFastApply({ ...fastApply, price: e.target.value })}
                className="bg-paper border border-line rounded-btn p-1.5 text-xs font-mono font-bold text-ink"
              />
              <input
                type="number"
                placeholder="سعر تكلفة موحد..."
                value={fastApply.costPrice}
                onChange={(e) => setFastApply({ ...fastApply, costPrice: e.target.value })}
                className="bg-paper border border-line rounded-btn p-1.5 text-xs font-mono font-bold text-ink"
              />
              <input
                type="number"
                placeholder="كمية مخزون موحدة..."
                value={fastApply.stockCount}
                onChange={(e) => setFastApply({ ...fastApply, stockCount: e.target.value })}
                className="bg-paper border border-line rounded-btn p-1.5 text-xs font-mono font-bold text-ink"
              />
              <button
                type="button"
                onClick={handleFastApply}
                className="py-1.5 px-3 rounded-btn bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors"
              >
                تطبيق على الكل
              </button>
            </div>
          </div>

          {/* Step C: Combinations Matrix Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
                <span>2. جدول تركيبات الخيارات (Cartesian Matrix Table):</span>
              </h4>
              {deletedVariantIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreAllCombinations}
                  className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>استعادة كافة التركيبات المحذوفة</span>
                </button>
              )}
            </div>

            {variantRows.length === 0 ? (
              <div className="p-8 text-center bg-surface rounded-2xl border-2 border-dashed border-line text-ink-soft text-xs space-y-1">
                <Layers className="w-8 h-8 text-indigo-400 mx-auto" />
                <p className="font-black text-ink">لم يتم توليد أي تركيبات بعد</p>
                <p className="text-[11px]">أضف قيماً في الخصائص أعلاه (مثل إضافة لون وسعة) لتوليد جدول التركيبات تلقائياً.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-line overflow-hidden bg-surface shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-paper border-b border-line text-ink-soft text-[11px] font-bold">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5 min-w-[160px]">التركيبة والمواصفات</th>
                        <th className="p-2.5 w-28">سعر البيع *</th>
                        <th className="p-2.5 w-24">التكلفة</th>
                        <th className="p-2.5 w-24">المخزون *</th>
                        <th className="p-2.5 min-w-[180px]">الباركود (Barcode)</th>
                        <th className="p-2.5 w-28 text-center">الصور</th>
                        <th className="p-2.5 w-12 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-bold">
                      {variantRows.map((row, idx) => {
                        const specSummary = Object.entries(row.specs || {})
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ');

                        return (
                          <tr key={row.id} className="hover:bg-paper/50 transition-colors">
                            <td className="p-2.5 text-center text-ink-soft font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(row.specs || {}).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-500/20"
                                  >
                                    <span className="text-ink-soft">{k}:</span> {v}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="p-2.5">
                              <input
                                type="number"
                                required
                                min="0"
                                step="any"
                                value={row.price}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setVariantRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, price: val } : r))
                                  );
                                }}
                                placeholder="0"
                                className="w-full bg-paper border border-line rounded-btn p-1.5 text-xs font-mono font-bold text-ink outline-none focus:border-primary"
                              />
                            </td>

                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={row.costPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setVariantRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, costPrice: val } : r))
                                  );
                                }}
                                placeholder="0"
                                className="w-full bg-paper border border-line rounded-btn p-1.5 text-xs font-mono font-bold text-ink outline-none focus:border-primary"
                              />
                            </td>

                            <td className="p-2.5">
                              <input
                                type="number"
                                required
                                min="0"
                                value={row.stockCount}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setVariantRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, stockCount: val } : r))
                                  );
                                }}
                                placeholder="10"
                                className="w-full bg-paper border border-line rounded-btn p-1.5 text-xs font-mono font-bold text-ink outline-none focus:border-primary"
                              />
                            </td>

                            <td className="p-2.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={row.barcode || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setVariantRows((prev) =>
                                      prev.map((r) => (r.id === row.id ? { ...r, barcode: val } : r))
                                    );
                                  }}
                                  placeholder="تلقائي من المعرف"
                                  className="w-full bg-paper border border-line rounded-btn p-1.5 text-[11px] font-mono text-ink outline-none focus:border-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const autoCode =
                                      '622' + Math.floor(1000000000 + Math.random() * 9000000000);
                                    setVariantRows((prev) =>
                                      prev.map((r) => (r.id === row.id ? { ...r, barcode: autoCode } : r))
                                    );
                                  }}
                                  className="p-1.5 rounded-lg border border-line hover:bg-paper text-primary shrink-0"
                                  title="توليد باركود فريد لهذا الخيار"
                                >
                                  <Barcode className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setVariantImageModal({
                                    isOpen: true,
                                    rowIndex: idx,
                                    variantName: specSummary || `الخيار ${idx + 1}`
                                  })
                                }
                                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition-all ${
                                  row.images && row.images.length > 0
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-paper border-line text-ink hover:border-primary'
                                }`}
                              >
                                {row.images && row.images.length > 0 ? (
                                  <>
                                    <img
                                      src={row.images[0]}
                                      alt="thumb"
                                      className="w-4 h-4 rounded object-cover"
                                    />
                                    <span>{row.images.length} صور</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>إضافة صور</span>
                                  </>
                                )}
                              </button>
                            </td>

                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteVariantRow(row.id)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-white hover:bg-red-500 transition-colors"
                                title="استبعاد هذا الخيار لعدم توفره"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-indigo-500/5 border-2 border-indigo-500/25 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-indigo-600 flex items-center gap-1.5">
                <span>🔗 مُعرف مجموعة المتغيرات (Group Code — لنفس المنتج بألوان أو مقاسات مختلفة)</span>
              </h4>
              <p className="text-[11px] text-ink-soft mt-0.5">
                اختر مُعرفاً موجوداً لملء الفورم تلقائياً وعرض المتغيرات الشقيقة، أو اكتب كوداً جديداً
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableGroups.length > 0 && (
              <div>
                <label className="block text-[11px] font-black text-ink mb-1">
                  اختر من المجموعات السابقة:
                </label>
                <select
                  value={
                    availableGroups.some((g) => g.groupCode === form.groupCode)
                      ? form.groupCode
                      : ''
                  }
                  onChange={(e) => {
                    const code = e.target.value;
                    const found = availableGroups.find((g) => g.groupCode === code);
                    if (found && found.products?.length > 0) {
                      applyTemplateProductToForm(found.products[0], code);
                    } else {
                      setForm({ ...form, groupCode: code });
                    }
                  }}
                  className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink"
                >
                  <option value="">-- اختر مجموعة محفوظة --</option>
                  {filteredModalGroups.map((g) => (
                    <option key={g.groupCode} value={g.groupCode}>
                      {g.groupCode} ({g.count} منتجات)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-black text-ink mb-1">
                كود المجموعة الموحد (Group Code):
              </label>
              <input
                type="text"
                value={form.groupCode}
                onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
                placeholder="مثال: IPHONE-15-PRO أو SONY-XM5"
                className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-black text-ink font-mono placeholder:text-ink-soft/50"
              />
            </div>
          </div>

          {/* Existing sibling products inside selected Group Code */}
          {activeModalGroupObj && activeModalGroupObj.products?.length > 0 && (
            <div className="pt-2 border-t border-indigo-500/20 space-y-2">
              <span className="text-[11px] font-black text-indigo-600 block">
                📦 المنتجات الشقيقة في المجموعة «{activeModalGroupObj.groupCode}» ({activeModalGroupObj.products.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                {activeModalGroupObj.products.map((sib) => (
                  <div
                    key={sib._id}
                    onClick={() => applyTemplateProductToForm(sib, activeModalGroupObj.groupCode)}
                    className="cursor-pointer p-2 rounded-xl bg-surface hover:bg-indigo-500/10 border border-line hover:border-indigo-500/40 flex items-center justify-between gap-2 transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={sib.images?.[0] || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover border border-line shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-ink truncate">{sib.name}</div>
                        <div className="text-[10px] text-primary">{sib.price} ج.م</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 text-[10px] font-bold shrink-0">
                      نسخ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggested Linked Items & Services (خدمات وعناصر مقترحة مرتبطة) */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>خدمات وعناصر مقترحة مرتبطة (Cross-Selling & Complementary Services)</span>
            </h4>
            <p className="text-[11px] text-ink-soft mt-0.5">
              اختر خدمات صيانة/تركيب أو منتجات تكميلية تظهر للمشتري كاقتراح للشراء بنقرة واحدة
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-950 dark:text-indigo-200 text-[10px] font-black">
            {form.linkedItemIds?.length || 0} عنصر مرتبط
          </span>
        </div>

        {/* Selected Linked Items Badges */}
        {form.linkedItemIds && form.linkedItemIds.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {form.linkedItemIds.map((itemId) => {
              const itemObj = candidateItems.find((p) => p._id === itemId) || { _id: itemId, name: 'عنصر مرتبط' };
              const isService = itemObj?.categoryId?.type === 'service';
              return (
                <div
                  key={itemId}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-bold shadow-sm"
                >
                  <span className="text-xs">{isService ? '🔧' : '📦'}</span>
                  <span className="text-ink truncate max-w-[200px]">{itemObj.name}</span>
                  {itemObj.price !== undefined && (
                    <span className="text-primary font-mono text-[11px]">{itemObj.price} ج.م</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        linkedItemIds: prev.linkedItemIds.filter((id) => id !== itemId)
                      }));
                    }}
                    className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors mr-1"
                    title="إزالة الارتباط"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search & Pick candidate */}
        <div className="pt-2 border-t border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="ابحث بالاسم لتصفية المقترحات..."
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
            className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink outline-none focus:border-primary"
          />
          <select
            value=""
            onChange={(e) => {
              const addId = e.target.value;
              if (!addId) return;
              if (!form.linkedItemIds.includes(addId)) {
                setForm((prev) => ({
                  ...prev,
                  linkedItemIds: [...prev.linkedItemIds, addId]
                }));
              }
            }}
            className="w-full bg-surface border border-line rounded-btn p-2 text-xs font-bold text-ink"
          >
            <option value="">-- اضغط هنا لإضافة خدمة أو منتج مقترح --</option>
            {candidateItems
              .filter((p) => p._id !== (initialData?._id || '') && !form.linkedItemIds.includes(p._id))
              .filter((p) => {
                if (!candidateSearch.trim()) return true;
                const q = candidateSearch.trim().toLowerCase();
                return (
                  p.name.toLowerCase().includes(q) ||
                  (p.categoryId?.name && p.categoryId.name.toLowerCase().includes(q))
                );
              })
              .slice(0, 50)
              .map((p) => (
                <option key={p._id} value={p._id}>
                  {p.categoryId?.type === 'service' ? '🔧 [خدمة] ' : '📦 [منتج] '} {p.name} ({p.price} ج.م)
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* 6. Standard Image Uploader (Clean & Pure) */}
      <div className="space-y-2">
        <label className="block text-ink-soft mb-1 font-bold">
          صور المنتج (رفع من الجهاز أو تصوير بالكاميرا):
        </label>
        <ImageUploader
          multiple={true}
          value={form.images || []}
          onChange={(imgs) => setForm({ ...form, images: imgs })}
        />
      </div>

      {/* 7. NEW STANDALONE AI IMAGE STUDIO (Positioned directly under Image Upload section) */}
      <ProductAiImageStudio
        uploadedImages={form.images || []}
        productContext={{
          name: form.name,
          categoryName: selectedCategoryObj?.name || '',
          specs: form.specs || {}
        }}
        onApplyImage={(url) => {
          setForm((prev) => ({
            ...prev,
            images: [...prev.images, url]
          }));
        }}
        onAddImages={(urls) => {
          setForm((prev) => ({
            ...prev,
            images: [...prev.images, ...urls]
          }));
        }}
      />

      {/* 8. Category Predefined Tags Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-ink-soft text-xs font-bold">
            الوسوم (Tags) {selectedCategoryObj?.name ? `الخاصة بقسم (${selectedCategoryObj.name})` : ''}
          </label>
          {selectedCategoryObj?.tags && selectedCategoryObj.tags.length > 0 && (
            <span className="text-[11px] text-ink-soft">
              اضغط على الوسم لتحديده (المحدد بالأخضر)
            </span>
          )}
        </div>

        {selectedCategoryObj?.tags && selectedCategoryObj.tags.length > 0 ? (
          <div className="p-3 rounded-2xl bg-paper/60 border border-line space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedCategoryObj.tags.map((tag) => {
                const currentTags = form.tagsStr
                  ? form.tagsStr.split(/[,،;\n]+/).map((t) => t.trim()).filter(Boolean)
                  : [];
                const isSelected = currentTags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const newTags = isSelected
                        ? currentTags.filter((t) => t !== tag)
                        : [...currentTags, tag];
                      setForm({ ...form, tagsStr: newTags.join(', ') });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-surface text-ink border-line hover:border-emerald-500/50 hover:bg-emerald-500/10'
                    }`}
                  >
                    <span>{tag}</span>
                    {isSelected && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={form.tagsStr}
              onChange={(e) => setForm({ ...form, tagsStr: e.target.value })}
              placeholder="أدخل وسوم مفصولة بفاصلة (مثال: أبل، إلكترونيات، ضمان سنتين)..."
              className="w-full bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* 9. Description */}
      <div>
        <label className="block text-ink-soft mb-1">وصف المنتج</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="اكتب وصفاً تسويقياً ومواصفات المنتج..."
          className="w-full bg-paper border border-line rounded-btn p-2.5 outline-none focus:border-primary text-ink placeholder:text-ink-soft/50"
        />
      </div>

      {/* 10. Form Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-line">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-btn bg-paper border border-line text-ink font-bold hover:bg-surface"
          >
            إلغاء
          </button>
        )}

        <div className="flex items-center gap-2 mr-auto">
          {sliderInfo && sliderInfo.onNext && (
            <button
              type="button"
              onClick={sliderInfo.onNext}
              className="px-4 py-2.5 rounded-btn bg-paper border border-line text-ink text-xs font-bold flex items-center gap-1.5"
            >
              <span>التالي</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black text-xs shadow-md hover:bg-primary/90 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الحفظ...' : submitLabel}</span>
          </button>
        </div>
      </div>

      {/* Quick Supplier Creation Modal */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSuccess={(newSupplier) => {
          if (newSupplier?._id) {
            setSuppliersList((prev) => [newSupplier, ...prev.filter((s) => s._id !== newSupplier._id)]);
            setForm((prev) => ({ ...prev, supplierId: newSupplier._id }));
            if (showToast) showToast(`تمت إضافة المورد «${newSupplier.name}» وتحديده للمنتج`, 'success');
          }
        }}
      />

      {/* Variant Image Manager Modal */}
      {variantImageModal.isOpen && variantImageModal.rowIndex !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl rounded-3xl bg-surface border border-line shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-ink">
                    إدارة صور الخيار: {variantImageModal.variantName}
                  </h3>
                  <p className="text-[11px] text-ink-soft">
                    ارفع صوراً حقيقية لهذا الخيار أو استخدم استوديو الذكاء الاصطناعي لإنشاء خلفيات تسويقية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVariantImageModal({ isOpen: false, rowIndex: null, variantName: '' })}
                className="p-1.5 rounded-xl hover:bg-paper text-ink-soft hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <ImageUploader
                multiple={true}
                value={variantRows[variantImageModal.rowIndex]?.images || []}
                onChange={(newImgs) => {
                  setVariantRows((prev) =>
                    prev.map((r, i) => (i === variantImageModal.rowIndex ? { ...r, images: newImgs } : r))
                  );
                }}
              />

              <ProductAiImageStudio
                uploadedImages={variantRows[variantImageModal.rowIndex]?.images || []}
                productContext={{
                  name: `${form.name} (${variantImageModal.variantName})`,
                  categoryName: selectedCategoryObj?.name || '',
                  specs: variantRows[variantImageModal.rowIndex]?.specs || {}
                }}
                onApplyImage={(url) => {
                  setVariantRows((prev) =>
                    prev.map((r, i) =>
                      i === variantImageModal.rowIndex ? { ...r, images: [...(r.images || []), url] } : r
                    )
                  );
                }}
                onAddImages={(urls) => {
                  setVariantRows((prev) =>
                    prev.map((r, i) =>
                      i === variantImageModal.rowIndex ? { ...r, images: [...(r.images || []), ...urls] } : r
                    )
                  );
                }}
              />
            </div>

            <div className="pt-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setVariantImageModal({ isOpen: false, rowIndex: null, variantName: '' })}
                className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black text-xs hover:bg-primary/90 shadow-md"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
