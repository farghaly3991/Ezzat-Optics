import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit,
  Search,
  List,
  Mic,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Layers,
  Copy,
  Check,
  Bell,
  ShieldCheck,
  BarChart3,
  ArrowRightLeft,
  AlertTriangle,
  Store,
  Building2,
  Glasses,
  Barcode,
  History,
  Grid
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ImageUploader from '../../shared/components/ImageUploader';
import SpecPickerModal from '../../storefront/catalog/components/SpecPickerModal';
import UnifiedProductForm from './components/UnifiedProductForm';
import AiProductIntakeModal from './components/AiProductIntakeModal';
import AdminRestockNotificationModal from './components/AdminRestockNotificationModal';
import AdminMatchDesiredProductsModal from './components/AdminMatchDesiredProductsModal';
import AdminMarketComparisonModal from './components/AdminMarketComparisonModal';
import DashboardProductFilterBar from '../shared/DashboardProductFilterBar';
import AdminBranchSelector from '../shared/AdminBranchSelector';
import WarehouseTransferModal from './components/WarehouseTransferModal';
import ScrapModal from './components/ScrapModal';
import StocktakingModal from './components/StocktakingModal';
import ProductLedgerModal from './components/ProductLedgerModal';
import BarcodePrintModal from './components/BarcodePrintModal';

export default function ProductsTab() {
  const {
    token,
    config,
    showToast,
    fetchAdminProductGroups,
    invalidateAdminGroupsCache,
    activeBranchId,
    branches = []
  } = useStore();

  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryChildren, setCategoryChildren] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGroupCode, setSelectedGroupCode] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [stockFilter, setStockFilter] = useState('');
  const [categoryType, setCategoryType] = useState('');
  const [linkedStatus, setLinkedStatus] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedSpecs, setSelectedSpecs] = useState([]);
  const [tagsFacet, setTagsFacet] = useState([]);
  const [groupCodesFacet, setGroupCodesFacet] = useState([]);
  const [specsFacet, setSpecsFacet] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Optics Tabs & Multi-Warehouse Modals
  const [opticsTab, setOpticsTab] = useState('all'); // 'all' | 'frames' | 'lenses' | 'contact_lenses' | 'accessories' | 'low_stock'
  const [transferProduct, setTransferProduct] = useState(null);
  const [scrapProduct, setScrapProduct] = useState(null);
  const [isStocktakingOpen, setIsStocktakingOpen] = useState(false);
  const [ledgerProduct, setLedgerProduct] = useState(null);
  const [barcodePrintProduct, setBarcodePrintProduct] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من مسح ${selectedProductIds.length} صنف محدد نهائياً؟`)) return;
    try {
      const res = await axios.post('/api/admin/products/bulk-delete', { ids: selectedProductIds }, authHeader);
      showToast(res.data?.message || 'تم حذف الأصناف المحددة بنجاح');
      setSelectedProductIds([]);
      loadProducts(1);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر الحذف الجماعي', 'error');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === products.length && products.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p._id));
    }
  };

  const handleToggleSelectProduct = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiIntakeOpen, setIsAiIntakeOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockModalProduct, setRestockModalProduct] = useState(null);
  const [matchModalProduct, setMatchModalProduct] = useState(null);
  const [marketCompareProduct, setMarketCompareProduct] = useState(null);

  // Variant Group Codes State inside Product Modal (Cached in StoreContext)
  const [modalGroupScope, setModalGroupScope] = useState('category'); // 'category' | 'all'
  const [availableGroups, setAvailableGroups] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Category Specs Facet state for picker
  const [categorySpecsFacet, setCategorySpecsFacet] = useState([]);
  const [pickerModal, setPickerModal] = useState({ isOpen: false, specKey: '', specLabel: '' });
  const [shippingClasses, setShippingClasses] = useState([]);
  const [supplierShipments, setSupplierShipments] = useState([]);

  const [form, setForm] = useState({
    name: '',
    categoryId: '',
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
    warrantyPolicy: ''
  });

  const loadFinanceOptions = () => {
    if (!token) return;
    axios
      .get('/api/admin/finance/shipping-classes', authHeader)
      .then((r) => setShippingClasses(r.data?.shippingClasses || []))
      .catch(() => {});
    axios
      .get('/api/admin/finance/shipments?limit=50', authHeader)
      .then((r) => setSupplierShipments(r.data?.shipments || []))
      .catch(() => {});
    axios
      .get('/api/admin/finance/suppliers', authHeader)
      .then((r) => setSuppliers(r.data?.suppliers || []))
      .catch(() => {});
  };

  const loadProducts = async (targetPage = page) => {
    try {
      const res = await axios.post(
        '/api/admin/products/filter',
        {
          categoryId: selectedCategory || undefined,
          groupCode: selectedGroupCode || undefined,
          search: search.trim() || undefined,
          tags: selectedTags,
          specFilters: selectedSpecs.filter((s) => s.values.length > 0),
          minPrice: minPrice !== '' ? Number(minPrice) : undefined,
          maxPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
          stockFilter: stockFilter || undefined,
          categoryType: categoryType || undefined,
          linkedStatus: linkedStatus || undefined,
          supplierId:
            selectedSupplier && !['has_supplier', 'no_supplier'].includes(selectedSupplier)
              ? selectedSupplier
              : undefined,
          supplierStatus: ['has_supplier', 'no_supplier'].includes(selectedSupplier)
            ? selectedSupplier
            : undefined,
          includeInactive: true,
          sortBy,
          page: targetPage,
          pageSize: 20
        },
        authHeader
      );
      setProducts(res.data?.products || []);
      setCategoryChildren(res.data?.categoryChildren || []);
      setTagsFacet(res.data?.tagsFacet || []);
      setGroupCodesFacet(res.data?.groupCodesFacet || []);
      setSpecsFacet(res.data?.specsFacet || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    } catch (err) {
      console.error('Error loading admin products:', err);
    }
  };

  const loadData = () => {
    invalidateAdminGroupsCache();
    loadProducts(page);
    loadFinanceOptions();
    axios
      .get('/api/admin/categories', authHeader)
      .then((r) => setCategories(r.data?.categories || []));
  };

  useEffect(() => {
    if (token) {
      axios
        .get('/api/admin/categories', authHeader)
        .then((r) => setCategories(r.data?.categories || []));
      loadFinanceOptions();
    }
  }, [token]);

  useEffect(() => {
    if (token) loadProducts(page);
  }, [
    token,
    activeBranchId,
    selectedCategory,
    selectedGroupCode,
    selectedTags,
    selectedSpecs,
    sortBy,
    stockFilter,
    categoryType,
    linkedStatus,
    selectedSupplier,
    page
  ]);

  // Fetch category specs facet when category changes in modal
  useEffect(() => {
    if (form.categoryId) {
      axios
        .post('/api/store-public/filter', { categoryId: form.categoryId, page: 1, pageSize: 1 })
        .then((res) => {
          setCategorySpecsFacet(res.data?.specsFacet || []);
        })
        .catch(console.error);
    } else {
      setCategorySpecsFacet([]);
    }
  }, [form.categoryId]);

  // Load grouped groupCodes from StoreContext Cache when modal opens or category/scope changes
  useEffect(() => {
    if (!isModalOpen || !token) return;
    const scopeCatId = modalGroupScope === 'category' ? form.categoryId : '';
    fetchAdminProductGroups(scopeCatId, false).then((groups) => {
      setAvailableGroups(groups || []);
    });
  }, [isModalOpen, form.categoryId, modalGroupScope, token]);

  // Helper to fill form from an existing sibling product template
  const applyTemplateProductToForm = (templateProd, targetGroupCode = '') => {
    if (!templateProd) return;
    const code = targetGroupCode || templateProd.groupCode || form.groupCode || '';
    setForm({
      name: templateProd.name || '',
      categoryId: templateProd.categoryId?._id || templateProd.categoryId || form.categoryId || '',
      groupCode: code,
      price: templateProd.price ?? '',
      oldPrice: templateProd.oldPrice ?? '',
      costPrice: templateProd.costPrice ?? '',
      stockCount: templateProd.stockCount ?? 10,
      description: templateProd.description || '',
      images: Array.isArray(templateProd.images) ? [...templateProd.images] : [],
      tagsStr: Array.isArray(templateProd.tags) ? templateProd.tags.join(', ') : '',
      specs: templateProd.specs ? { ...templateProd.specs } : {},
      active: templateProd.active !== false,
      requiresShipping: templateProd.requiresShipping !== false,
      shippingClassId: templateProd.shippingClassId?._id || templateProd.shippingClassId || '',
      shippingMode: templateProd.shippingMode || 'MAX',
      supplierShipmentId: templateProd.supplierShipmentId?._id || templateProd.supplierShipmentId || '',
      purchaseUnitCost: templateProd.costPrice ?? ''
    });
    showToast(
      `تم ملء بيانات النموذج تلقائياً من المنتج «${templateProd.name}» — عدّل الآن الصفة أو اللون أو السعر أو الصور المطلوبة!`
    );
  };

  // Handler when admin selects an existing groupCode from the dropdown
  const handleSelectExistingGroupCode = (code) => {
    if (!code) {
      setForm((prev) => ({ ...prev, groupCode: '' }));
      return;
    }
    const foundGroup = availableGroups.find((g) => g.groupCode === code);
    if (foundGroup && foundGroup.products?.length > 0 && !editingProduct) {
      applyTemplateProductToForm(foundGroup.products[0], code);
    } else {
      setForm((prev) => ({ ...prev, groupCode: code }));
    }
  };

  const handleOpenModal = (prod = null, cloneAsVariant = false) => {
    setGroupSearchQuery('');
    if (prod && !cloneAsVariant) {
      setEditingProduct(prod);
      setForm({
        name: prod.name || '',
        categoryId: prod.categoryId?._id || prod.categoryId || '',
        groupCode: prod.groupCode || '',
        price: prod.price || '',
        oldPrice: prod.oldPrice || '',
        costPrice: prod.costPrice || '',
        stockCount: prod.stockCount || '',
        description: prod.description || '',
        images: prod.images || [],
        tagsStr: (prod.tags || []).join(', '),
        specs: prod.specs || {},
        active: prod.active !== false,
        requiresShipping: prod.requiresShipping !== false,
        shippingClassId: prod.shippingClassId?._id || prod.shippingClassId || '',
        shippingMode: prod.shippingMode || 'MAX',
        supplierShipmentId: prod.supplierShipmentId?._id || prod.supplierShipmentId || '',
        purchaseUnitCost: prod.costPrice || '',
        warrantyPeriodMonths: prod.warrantyPeriodMonths || 0,
        warrantyPolicy: prod.warrantyPolicy || '',
        supplierId: prod.supplierId?._id || prod.supplierId || '',
        criticalStockThreshold: prod.criticalStockThreshold !== undefined ? prod.criticalStockThreshold : 3,
        reorderQuantity: prod.reorderQuantity !== undefined ? prod.reorderQuantity : 10,
        linkedItemIds: Array.isArray(prod.linkedItemIds)
          ? prod.linkedItemIds.map((item) => (typeof item === 'object' && item !== null ? item._id : item)).filter(Boolean)
          : []
      });
    } else if (prod && cloneAsVariant) {
      setEditingProduct(null);
      const suggestedCode =
        prod.groupCode ||
        `GRP-${String(prod._id).slice(-5).toUpperCase()}`;
      setForm({
        name: prod.name || '',
        categoryId: prod.categoryId?._id || prod.categoryId || '',
        groupCode: suggestedCode,
        price: prod.price || '',
        oldPrice: prod.oldPrice || '',
        costPrice: prod.costPrice || '',
        stockCount: prod.stockCount || 10,
        description: prod.description || '',
        images: [...(prod.images || [])],
        tagsStr: (prod.tags || []).join(', '),
        specs: { ...(prod.specs || {}) },
        active: true,
        requiresShipping: prod.requiresShipping !== false,
        shippingClassId: prod.shippingClassId?._id || prod.shippingClassId || '',
        shippingMode: prod.shippingMode || 'MAX',
        supplierShipmentId: prod.supplierShipmentId?._id || prod.supplierShipmentId || '',
        purchaseUnitCost: prod.costPrice || '',
        warrantyPeriodMonths: prod.warrantyPeriodMonths || 0,
        warrantyPolicy: prod.warrantyPolicy || '',
        supplierId: prod.supplierId?._id || prod.supplierId || '',
        criticalStockThreshold: prod.criticalStockThreshold !== undefined ? prod.criticalStockThreshold : 3,
        reorderQuantity: prod.reorderQuantity !== undefined ? prod.reorderQuantity : 10,
        linkedItemIds: Array.isArray(prod.linkedItemIds)
          ? prod.linkedItemIds.map((item) => (typeof item === 'object' && item !== null ? item._id : item)).filter(Boolean)
          : []
      });
    } else {
      setEditingProduct(null);
      setForm({
        name: '',
        categoryId: selectedCategory || categories[0]?._id || '',
        groupCode: selectedGroupCode || '',
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
        supplierId: '',
        criticalStockThreshold: 3,
        reorderQuantity: 10,
        linkedItemIds: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (formDataOrEvent) => {
    let payload = formDataOrEvent;

    if (formDataOrEvent?.preventDefault) {
      formDataOrEvent.preventDefault();
      const tags = form.tagsStr
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      payload = {
        name: form.name,
        categoryId: form.categoryId,
        groupCode: String(form.groupCode || '').trim(),
        price: Number(form.price),
        oldPrice: Number(form.oldPrice || 0),
        costPrice: Number(form.costPrice || 0),
        stockCount: Number(form.stockCount || 0),
        description: form.description,
        images: form.images,
        tags,
        specs: form.specs,
        active: form.active,
        requiresShipping: form.requiresShipping !== false,
        shippingClassId: form.shippingClassId || null,
        shippingMode: form.shippingMode === 'ADD' ? 'ADD' : 'MAX',
        supplierShipmentId: form.supplierShipmentId || null,
        supplierId: form.supplierId || null,
        criticalStockThreshold: Number(form.criticalStockThreshold ?? 3),
        reorderQuantity: Number(form.reorderQuantity ?? 10),
        warrantyPeriodMonths: Number(form.warrantyPeriodMonths || 0),
        warrantyPolicy: String(form.warrantyPolicy || '').trim(),
        purchaseUnitCost:
          form.purchaseUnitCost !== '' && form.purchaseUnitCost !== null
            ? Number(form.purchaseUnitCost)
            : Number(form.costPrice || 0)
      };
    } else {
      payload = {
        ...formDataOrEvent,
        name: String(formDataOrEvent.name || '').trim(),
        categoryId: formDataOrEvent.categoryId,
        groupCode: String(formDataOrEvent.groupCode || '').trim(),
        price: Number(formDataOrEvent.price || 0),
        oldPrice: Number(formDataOrEvent.oldPrice || 0),
        costPrice: Number(formDataOrEvent.costPrice || 0),
        stockCount: Number(formDataOrEvent.stockCount || 0),
        description: formDataOrEvent.description || '',
        images: Array.isArray(formDataOrEvent.images) ? formDataOrEvent.images : [],
        tags: Array.isArray(formDataOrEvent.tags) ? formDataOrEvent.tags : [],
        specs: formDataOrEvent.specs || {},
        active: formDataOrEvent.active !== false,
        requiresShipping: formDataOrEvent.requiresShipping !== false,
        shippingClassId: formDataOrEvent.shippingClassId || null,
        shippingMode: formDataOrEvent.shippingMode === 'ADD' ? 'ADD' : 'MAX',
        supplierShipmentId: formDataOrEvent.supplierShipmentId || null,
        supplierId: formDataOrEvent.supplierId || null,
        criticalStockThreshold: Number(formDataOrEvent.criticalStockThreshold ?? 3),
        reorderQuantity: Number(formDataOrEvent.reorderQuantity ?? 10),
        linkedItemIds: Array.isArray(formDataOrEvent.linkedItemIds) ? formDataOrEvent.linkedItemIds : [],
        warrantyPeriodMonths: Number(formDataOrEvent.warrantyPeriodMonths || 0),
        warrantyPolicy: String(formDataOrEvent.warrantyPolicy || '').trim(),
        purchaseUnitCost:
          formDataOrEvent.purchaseUnitCost !== '' && formDataOrEvent.purchaseUnitCost !== null
            ? Number(formDataOrEvent.purchaseUnitCost)
            : Number(formDataOrEvent.costPrice || 0)
      };
    }

    try {
      if (payload.isMultiVariant) {
        const res = await axios.post('/api/admin/products/multi-variant', payload, authHeader);
        showToast(res.data?.message || 'تم حفظ منتج المتغيرات بنجاح');
      } else if (editingProduct) {
        await axios.put(`/api/admin/products/${editingProduct._id}`, payload, authHeader);
        showToast('تم تعديل المنتج بنجاح');
      } else {
        await axios.post('/api/admin/products', payload, authHeader);
        showToast('تمت إضافة المنتج بنجاح');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ المنتج', 'error');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await axios.delete(`/api/admin/products/${id}`, authHeader);
      showToast('تم حذف المنتج');
      loadData();
    } catch {
      showToast('تعذر الحذف', 'error');
    }
  };

  const handleExcelImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setIsImporting(true);

    axios
      .post('/api/admin/excel/import', formData, authHeader)
      .then((res) => {
        showToast(res.data?.message || 'تم استيراد المنتجات بنجاح!');
        loadData();
      })
      .catch((err) => {
        showToast(err.response?.data?.error || 'فشل استيراد الإكسيل', 'error');
      })
      .finally(() => setIsImporting(false));
  };

  const selectedCategoryObj = categories.find((c) => c._id === form.categoryId);

  // Filter availableGroups by groupSearchQuery if typed
  const filteredModalGroups = availableGroups.filter((g) => {
    if (!groupSearchQuery.trim()) return true;
    const q = groupSearchQuery.trim().toLowerCase();
    return (
      g.groupCode.toLowerCase().includes(q) ||
      (g.products || []).some((p) => (p.name || '').toLowerCase().includes(q))
    );
  });

  // Currently active group object in the modal (if form.groupCode matches an existing group)
  const activeModalGroupObj = availableGroups.find(
    (g) => g.groupCode === String(form.groupCode || '').trim()
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Excel Studio Action Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-secondary text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-black flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>استوديو إدارة المنتجات والمتغيرات بملف Excel والـ AI</span>
          </h3>
          <p className="text-xs text-slate-300">
            استورد أو صدر مئات المنتجات، واربط المنتجات ذات الألوان أو المقاسات أو المواصفات المختلفة بمُعرف مجموعة موحد (Group Code)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/excel/template"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-card bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/15 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" /> تحميل قالب Excel
          </a>

          <a
            href="/api/admin/excel/export"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-card bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/15 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" /> تصدير الكتالوج الحالي
          </a>

          <label className="px-4 py-2.5 rounded-card bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer shadow-lg flex items-center gap-1.5 transition-all">
            <Upload className="w-4 h-4" />
            <span>{isImporting ? 'جاري الاستيراد...' : 'رفع واستيراد Excel'}</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
          </label>

          {config?.isAiAvailable !== false && (
            <button
              type="button"
              onClick={() => setIsAiIntakeOpen(true)}
              className="px-4 py-2.5 rounded-card bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-lg flex items-center gap-1.5 transition-all border border-purple-400/30"
            >
              <Mic className="w-4 h-4 text-orange-300" />
              <Sparkles className="w-3.5 h-3.5 text-orange-300" />
              <span>رفع سريع بالـ AI (صوت / كتابة)</span>
            </button>
          )}

          {categories.some((c) => c.hasGridSpecs) && (
            <button
              type="button"
              onClick={() => navigate('/admin/lens-matrix')}
              className="px-4 py-2.5 rounded-card bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg flex items-center gap-1.5 transition-all border border-indigo-400/30"
              title="إدارة وجرد مصفوفة المقاسات والأرصدة للأقسام الشبكية"
            >
              <Grid className="w-4 h-4 text-indigo-200" />
              <span>مصفوفة المقاسات والأرصدة ({categories.find((c) => c.hasGridSpecs)?.name || 'Grid Specs'})</span>
            </button>
          )}

          <button
            onClick={() => handleOpenModal(null)}
            className="px-4 py-2.5 rounded-card bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] text-xs font-black shadow-lg flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> إضافة منتج يدوياً
          </button>
        </div>
      </div>

      {/* Local Branch Selector */}
      <AdminBranchSelector
        label="تصفية المنتجات حسب الفرع:"
        onChange={() => {
          setPage(1);
          loadProducts(1);
        }}
      />

      {/* Optics Categories & Stock Operations Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpticsTab('all');
            setSelectedCategory('');
            setStockFilter('');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            opticsTab === 'all' && !stockFilter
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-ink border border-line'
          }`}
        >
          <span>📦 جميع الأصناف</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpticsTab('frames');
            const c = categories.find((cat) => (cat.name || '').includes('شنبر') || (cat.name || '').includes('إطارات') || (cat.name || '').includes('نظارات'));
            if (c) setSelectedCategory(c._id);
            setStockFilter('');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            opticsTab === 'frames'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-blue-600 dark:text-blue-400 border border-blue-500/40'
          }`}
        >
          <Glasses className="w-3.5 h-3.5" />
          <span>👓 شنابر وإطارات</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpticsTab('lenses');
            const c = categories.find((cat) => (cat.name || '').includes('عدسات طبية') || (cat.name || '').includes('بصرية') || (cat.name || '').includes('عدسات'));
            if (c) setSelectedCategory(c._id);
            setStockFilter('');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            opticsTab === 'lenses'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-purple-600 dark:text-purple-400 border border-purple-500/40'
          }`}
        >
          <span>🔬 عدسات طبية وبصرية</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpticsTab('contact_lenses');
            const c = categories.find((cat) => (cat.name || '').includes('لاصقة'));
            if (c) setSelectedCategory(c._id);
            setStockFilter('');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            opticsTab === 'contact_lenses'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-teal-600 dark:text-teal-400 border border-teal-500/40'
          }`}
        >
          <span>✨ عدسات لاصقة ومحاليل</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpticsTab('accessories');
            const c = categories.find((cat) => (cat.name || '').includes('إكسسوار') || (cat.name || '').includes('محلول'));
            if (c) setSelectedCategory(c._id);
            setStockFilter('');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            opticsTab === 'accessories'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
          }`}
        >
          <span>🧴 إكسسوارات وقطع غيار</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOpticsTab('low_stock');
            setSelectedCategory('');
            setStockFilter('low');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            opticsTab === 'low_stock' || stockFilter === 'low'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-red-600 dark:text-red-400 border border-red-500/40'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>⚠️ المخزون الحرج والنافذ</span>
        </button>

        <button
          type="button"
          onClick={() => setIsStocktakingOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm mr-auto"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>📋 جرد المخزون حسب القسم</span>
        </button>
      </div>

      {/* Horizontal Scrollable Dashboard Filter Bar (Supports Category, GroupCode, Specs, Tags, Search) */}
      <DashboardProductFilterBar
        categories={categories}
        categoryChildren={categoryChildren}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          setSelectedGroupCode('');
          setSelectedSpecs([]);
          setSelectedTags([]);
          setPage(1);
        }}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => {
          setPage(1);
          loadProducts(1);
        }}
        groupCodesFacet={groupCodesFacet}
        selectedGroupCode={selectedGroupCode}
        onSelectGroupCode={(gc) => {
          setSelectedGroupCode(gc);
          setPage(1);
        }}
        sortBy={sortBy}
        onSortChange={(val) => {
          setSortBy(val);
          setPage(1);
        }}
        stockFilter={stockFilter}
        onStockFilterChange={(val) => {
          setStockFilter(val);
          setPage(1);
        }}
        categoryType={categoryType}
        onCategoryTypeChange={(val) => {
          setCategoryType(val);
          setPage(1);
        }}
        linkedStatus={linkedStatus}
        onLinkedStatusChange={(val) => {
          setLinkedStatus(val);
          setPage(1);
        }}
        suppliers={suppliers}
        selectedSupplier={selectedSupplier}
        onSelectSupplier={(sup) => {
          setSelectedSupplier(sup);
          setPage(1);
        }}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
        onApplyPrice={() => {
          setPage(1);
          loadProducts(1);
        }}
        tagsFacet={tagsFacet}
        selectedTags={selectedTags}
        onToggleTag={(tag) => {
          setPage(1);
          setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
          );
        }}
        specsFacet={specsFacet}
        selectedSpecs={selectedSpecs}
        onToggleSpecValue={(specKey, specVal) => {
          setPage(1);
          setSelectedSpecs((prev) => {
            const existing = prev.find((s) => s.spec === specKey);
            if (!existing) return [...prev, { spec: specKey, values: [specVal] }];
            const nextValues = existing.values.includes(specVal)
              ? existing.values.filter((v) => v !== specVal)
              : [...existing.values, specVal];
            return nextValues.length > 0
              ? prev.map((s) => (s.spec === specKey ? { spec: specKey, values: nextValues } : s))
              : prev.filter((s) => s.spec !== specKey);
          });
        }}
        total={total}
        onResetAll={() => {
          setSelectedCategory('');
          setSelectedGroupCode('');
          setSearch('');
          setSortBy('latest');
          setStockFilter('');
          setSelectedSupplier('');
          setMinPrice('');
          setMaxPrice('');
          setSelectedTags([]);
          setSelectedSpecs([]);
          setPage(1);
        }}
      />

      {/* Products Table */}
      <div className="rounded-card bg-surface border border-line overflow-hidden shadow-sm text-ink">
        {/* Bulk Actions Banner */}
        {selectedProductIds.length > 0 && (
          <div className="p-3 bg-red-500/10 border-b border-red-500/25 flex items-center justify-between px-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
              <Check className="w-4 h-4" />
              <span>تم تحديد <strong>{selectedProductIds.length}</strong> صنف في الصفحة</span>
            </div>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-btn text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح المحدد (حذف جماعي)</span>
            </button>
          </div>
        )}

        <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-4 bg-paper/50">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-ink">
              قائمة المنتجات المعروضة ({products.length} من إجمالي {total})
            </h4>
            {selectedGroupCode && (
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 text-xs font-black flex items-center gap-1">
                <span>🔗 فلتر المُعرف: {selectedGroupCode}</span>
                <button
                  type="button"
                  onClick={() => setSelectedGroupCode('')}
                  className="hover:text-red-500 mr-1"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-ink-soft">
            صفحة {page} من {pages} (20 منتج لكل صفحة)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper text-ink-soft font-bold border-b border-line">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedProductIds.length === products.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-line text-primary focus:ring-primary cursor-pointer"
                    title="تحديد الكل"
                  />
                </th>
                <th className="p-3.5">المنتج</th>
                <th className="p-3.5">مُعرف المتغيرات (Group Code)</th>
                <th className="p-3.5">القسم</th>
                <th className="p-3.5">سعر البيع</th>
                <th className="p-3.5">سعر التكلفة</th>
                <th className="p-3.5">المخزون</th>
                <th className="p-3.5">المبيعات</th>
                <th className="p-3.5">الصور</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((prod) => (
                <tr
                  key={prod._id}
                  className={`hover:bg-paper/60 transition-colors ${
                    selectedProductIds.includes(prod._id) ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(prod._id)}
                      onChange={() => handleToggleSelectProduct(prod._id)}
                      className="w-4 h-4 rounded border-line text-primary focus:ring-primary cursor-pointer"
                    />
                  </td>
                  <td className="p-3.5 flex items-center gap-3">
                    <img
                      src={
                        prod.images?.[0] ||
                        'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'
                      }
                      alt=""
                      className="w-10 h-10 rounded-btn object-cover bg-paper border border-line flex-shrink-0"
                    />
                    <div>
                      <span className="font-bold text-ink block max-w-xs truncate">{prod.name}</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-ink-soft">{prod.visited || 0} مشاهدة</span>
                        <span
                          className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold border border-indigo-500/20 flex items-center gap-1"
                          title="الفرع المسجل به هذا المنتج"
                        >
                          <span>🏢</span>
                          <span>
                            {typeof prod.branchId === 'object' && prod.branchId?.name
                              ? prod.branchId.name
                              : (branches.find((b) => String(b._id) === String(prod.branchId))?.name || 'الفرع الرئيسي')}
                          </span>
                        </span>
                        {prod.supplierId?.name && (
                          <span
                            className="text-[10px] text-orange-700 dark:text-orange-300 bg-orange-500/10 px-1.5 py-0.5 rounded font-bold border border-orange-500/20"
                            title={`المورد: ${prod.supplierId.name} ${prod.supplierId.phone ? `(${prod.supplierId.phone})` : ''}`}
                          >
                            📦 {prod.supplierId.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    {prod.groupCode ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupCode(
                              selectedGroupCode === prod.groupCode ? '' : prod.groupCode
                            );
                            setPage(1);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/25 font-black text-[11px] flex items-center gap-1 transition-all"
                          title="اضغط لفلترة كل منتجات هذا المُعرف"
                        >
                          <span>🔗 {prod.groupCode}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(prod, true)}
                          className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-[var(--color-primary-contrast,#ffffff)] border border-primary/25 text-[10px] font-black transition-all"
                          title="إضافة متغير جديد (لون/مقاس/صفة مختلفة) لنفس هذا المنتج"
                        >
                          + متغير
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(prod, true)}
                        className="text-[10px] font-bold text-ink-soft hover:text-primary hover:underline"
                      >
                        + إنشاء متغير شقيق
                      </button>
                    )}
                  </td>

                  <td className="p-3.5">
                    <span className="font-bold text-ink-soft block">{prod.categoryId?.name || 'عام'}</span>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {prod.categoryId?.type === 'service' && (
                        <span className="text-[10px] font-black bg-orange-500/15 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30">
                          🔧 خدمة
                        </span>
                      )}
                      {prod.linkedItemIds && prod.linkedItemIds.length > 0 && (
                        <span className="text-[10px] font-black bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-500/30" title="عناصر وخدمات مرتبطة">
                          🔗 {prod.linkedItemIds.length} مقترح
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 font-black text-ink">
                    {prod.price} {config?.currency || 'ج.م'}
                  </td>
                  <td className="p-3.5 font-bold text-ink-soft">
                    {prod.costPrice || 0} {config?.currency || 'ج.م'}
                  </td>
                  <td className="p-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        {prod.categoryId?.type === 'service' ? (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[11px]">
                            حجز فوري
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-md font-black text-xs ${
                              prod.stockCount <= 3
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            }`}
                          >
                            الإجمالي: {prod.stockCount}
                          </span>
                        )}
                      </div>
                      {prod.categoryId?.type !== 'service' && (
                        <div className="text-[10px] text-ink-soft space-y-0.5 font-mono">
                          <div>المحل: <strong className="text-ink">{prod.storeStock ?? prod.stockCount}</strong></div>
                          <div>الخارجي: <strong className="text-ink">{prod.externalStock ?? 0}</strong></div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 font-bold text-purple-500">{prod.salesCount || 0}</td>
                  <td className="p-3.5 font-bold text-ink-soft">{(prod.images || []).length} صور</td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Barcode Label Printing (Thermal / A4) */}
                      <button
                        type="button"
                        onClick={() => setBarcodePrintProduct(prod)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="طباعة ملصق الباركود (طابعة حرارية 50x25 / 38x25 أو A4 بخطوط قص)"
                      >
                        <Barcode className="w-4 h-4" />
                      </button>

                      {/* Product Ledger & History Card */}
                      <button
                        type="button"
                        onClick={() => setLedgerProduct(prod)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="كارت الصنف وسجل الحركات والتدقيق (Ledger)"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      {/* Warehouse Stock Transfer */}
                      <button
                        type="button"
                        onClick={() => setTransferProduct(prod)}
                        className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="تحويل بضاعة بين مخزن المحل والمخزن الخارجي"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>

                      {/* Record Scrap */}
                      <button
                        type="button"
                        onClick={() => setScrapProduct(prod)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="تسجيل توالف وهدر (كسر / خدش)"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestockModalProduct(prod)}
                        className="p-1.5 text-orange-600 hover:bg-orange-500/10 rounded-lg transition-colors"
                        title="إشعار قائمة الانتظار بتوفر المنتج"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarketCompareProduct(prod)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="مقارنة وتحليل أسعار السوق بالذكاء الاصطناعي (AI Market Intel)"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatchModalProduct(prod)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="مطابقة طلبات ورغبات العملاء الذكية (AI Matching)"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      {Boolean(
                        (typeof prod.categoryId === 'object' ? prod.categoryId?.hasGridSpecs : categories.find((c) => c._id === prod.categoryId)?.hasGridSpecs)
                      ) && (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/lens-matrix?productId=${prod._id}`)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="عرض وجرد مصفوفة المقاسات (Grid Matrix)"
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenModal(prod, false)}
                        className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod._id)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Footer */}
        {pages > 1 && (
          <div className="p-4 border-t border-line bg-paper/40 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-ink-soft">
              إجمالي النتائج: <strong className="text-ink">{total}</strong> منتج
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-btn border border-line bg-surface text-ink disabled:opacity-40"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: Math.min(pages, 8) }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={`w-8 h-8 rounded-btn text-xs font-black transition-all ${
                    page === num
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-xs'
                      : 'bg-surface border border-line text-ink hover:bg-paper'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="p-2 rounded-btn border border-line bg-surface text-ink disabled:opacity-40"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6 animate-in fade-in">
          <div className="relative w-full max-w-full sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1480px] bg-surface text-ink rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 space-y-6 sm:space-y-7 my-0 sm:my-auto max-h-[95vh] sm:max-h-[92vh] overflow-y-auto border border-line animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-ink">
                  {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد (أو متغير لمنتج حالي)'}
                </h3>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => setMarketCompareProduct(editingProduct)}
                    className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 px-2.5 py-1 rounded-btn text-xs font-bold flex items-center gap-1.5 border border-indigo-500/25 transition-all shadow-sm"
                    title="مقارنة بالمنتجات الشبيهة في السوق"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>مقارنة بأسعار السوق (AI)</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-ink-soft hover:text-ink"
              >
                ✕
              </button>
            </div>

            <UnifiedProductForm
              initialData={editingProduct || form}
              categories={categories}
              shippingClasses={shippingClasses}
              supplierShipments={supplierShipments}
              availableGroups={availableGroups}
              onSubmit={handleSaveProduct}
              onCancel={() => setIsModalOpen(false)}
              submitLabel={editingProduct ? 'حفظ التعديلات' : 'إضافة وحفظ المنتج'}
            />
          </div>
        </div>
      )}

      {/* Spec Picker Modal */}
      {pickerModal.isOpen && (
        <SpecPickerModal
          specKey={pickerModal.specKey}
          specLabel={pickerModal.specLabel}
          existingValues={pickerModal.existingValues}
          onSelect={(val) => {
            setForm({ ...form, specs: { ...form.specs, [pickerModal.specKey]: val } });
          }}
          onClose={() => setPickerModal({ isOpen: false, specKey: '', specLabel: '' })}
        />
      )}

      {/* AI Quick Product Intake Modal (Documents, Voice, External Prompt Studio & Multi-Product Slider) */}
      <AiProductIntakeModal
        isOpen={isAiIntakeOpen}
        onClose={() => setIsAiIntakeOpen(false)}
        categories={categories}
        shippingClasses={shippingClasses}
        supplierShipments={supplierShipments}
        availableGroups={availableGroups}
        onSaved={loadData}
      />

      {/* Restock Waitlist Notification Modal */}
      {restockModalProduct && (
        <AdminRestockNotificationModal
          product={restockModalProduct}
          isOpen={Boolean(restockModalProduct)}
          onClose={() => setRestockModalProduct(null)}
          onNotified={() => loadProducts(page)}
        />
      )}

      {/* Match Desired Products Modal */}
      {matchModalProduct && (
        <AdminMatchDesiredProductsModal
          product={matchModalProduct}
          isOpen={Boolean(matchModalProduct)}
          onClose={() => setMatchModalProduct(null)}
        />
      )}

      {/* AI Market Intel & Competitor Comparison Modal */}
      {marketCompareProduct && (
        <AdminMarketComparisonModal
          product={marketCompareProduct}
          isOpen={Boolean(marketCompareProduct)}
          onClose={() => setMarketCompareProduct(null)}
          onPriceUpdated={(prodId, newPrice) => {
            loadProducts(page);
            if (editingProduct && editingProduct._id === prodId) {
              setEditingProduct((prev) => (prev ? { ...prev, price: newPrice } : null));
              setForm((prev) => ({ ...prev, price: newPrice }));
            }
          }}
        />
      )}

      {/* Warehouse Transfer Modal */}
      {transferProduct && (
        <WarehouseTransferModal
          product={transferProduct}
          onClose={() => setTransferProduct(null)}
          onSuccess={() => loadProducts(page)}
          token={token}
          showToast={showToast}
        />
      )}

      {/* Scrap & Damaged Stock Modal */}
      {scrapProduct && (
        <ScrapModal
          product={scrapProduct}
          onClose={() => setScrapProduct(null)}
          onSuccess={() => loadProducts(page)}
          token={token}
          currency={config?.currency || 'ج.م'}
          showToast={showToast}
        />
      )}

      {/* Category Stocktaking Modal */}
      {isStocktakingOpen && (
        <StocktakingModal
          categories={categories}
          onClose={() => setIsStocktakingOpen(false)}
          onSuccess={() => loadProducts(page)}
          token={token}
          showToast={showToast}
        />
      )}

      {/* Product Ledger & History Card Modal */}
      {ledgerProduct && (
        <ProductLedgerModal
          product={ledgerProduct}
          onClose={() => setLedgerProduct(null)}
          token={token}
          currency={config?.currency || 'ج.م'}
        />
      )}

      {/* Barcode Print Modal (Thermal 50x25, 38x25 or A4 sheets) */}
      {barcodePrintProduct && (
        <BarcodePrintModal
          product={barcodePrintProduct}
          onClose={() => setBarcodePrintProduct(null)}
          currency={config?.currency || 'ج.م'}
        />
      )}
    </div>
  );
}
