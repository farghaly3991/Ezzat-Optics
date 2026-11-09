import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  AlertTriangle,
  Plus,
  Eye,
  Edit,
  Clock,
  CheckCircle2,
  Filter,
  Users,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Trash2,
  Search,
  ExternalLink,
  X,
  FileText,
  Flame,
  TrendingUp,
  Zap,
  AlertCircle,
  Package,
  Calendar,
  ArrowUpRight,
  ShoppingBag,
  RefreshCw,
  Sparkles,
  BellRing
} from 'lucide-react';
import axios from 'axios';
import ShipmentDetailsModal from './ShipmentDetailsModal';
import SupplierModal from '../../../shared/components/SupplierModal';
import SupplyRequestModal from '../../../shared/components/SupplyRequestModal';

const SHIPMENT_STATUS_LABELS = {
  draft: 'مسودة (Draft)',
  ordered: 'تم الطلب من المورد (Ordered)',
  in_transit: 'في الطريق (In Transit)',
  partially_received: 'مستلم جزئياً (Partially Received)',
  received: 'تم الاستلام (Received)',
  cancelled: 'ملغاة (Cancelled)'
};

const PAYMENT_STATUS_BADGES = {
  unpaid: { label: 'غير مدفوعة (Unpaid)', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  partially_paid: {
    label: 'مدفوعة جزئياً (Partial)',
    cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20'
  },
  paid: { label: 'مدفوعة بالكامل (Paid)', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  overpaid: { label: 'مدفوعة بالزيادة (Overpaid)', cls: 'bg-purple-500/10 text-purple-600 border-purple-500/20' }
};

export default function ProcurementShipmentsPanel({
  procurementOverview,
  shipments = [],
  suppliers = [],
  catalogProducts = [],
  shipmentFilterStatus,
  setShipmentFilterStatus,
  shipmentOverdueOnly,
  setShipmentOverdueOnly,
  shipmentSearch,
  setShipmentSearch,
  currency = 'ج.م',
  authHeader,
  showToast,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('shipments'); // 'shipments' | 'suppliers'
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState(null);
  const [shipmentForm, setShipmentForm] = useState({
    referenceId: '',
    shipmentDate: new Date().toISOString().slice(0, 10),
    supplierId: '',
    supplierName: '',
    supplierPhone: '',
    supplierEmail: '',
    supplierAddress: '',
    expectedGoodsValue: '',
    dueDate: '',
    status: 'ordered',
    notes: ''
  });

  const [activeShipmentDetails, setActiveShipmentDetails] = useState(null);

  // Fast-selling & stockout forecast state
  const [forecastDays, setForecastDays] = useState(30);
  const [forecastData, setForecastData] = useState(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);

  const loadForecast = async (days = forecastDays) => {
    setIsForecastLoading(true);
    try {
      const res = await axios.get(
        `/api/admin/finance/procurement/fast-selling-forecast?days=${days}&limit=10`,
        authHeader
      );
      setForecastData(res.data);
    } catch (err) {
      console.error('Error fetching fast selling forecast:', err);
    } finally {
      setIsForecastLoading(false);
    }
  };

  useEffect(() => {
    loadForecast(forecastDays);
  }, [forecastDays]);

  // Unified Supply Reorders & Grid Critical Stock State
  const [reordersList, setReordersList] = useState([]);
  const [loadingReorders, setLoadingReorders] = useState(false);
  const [gridCriticalItems, setGridCriticalItems] = useState([]);
  const [matrixProducts, setMatrixProducts] = useState([]);
  const [generalProducts, setGeneralProducts] = useState([]);
  const [loadingGridCritical, setLoadingGridCritical] = useState(false);
  const [selectedGridItemForSupply, setSelectedGridItemForSupply] = useState(null);
  const [selectedGridRows, setSelectedGridRows] = useState({});
  const [bulkSupplierId, setBulkSupplierId] = useState('');
  const [supplierValidationError, setSupplierValidationError] = useState(false);
  const [isSubmittingBulkReorder, setIsSubmittingBulkReorder] = useState(false);
  const [lastCreatedReorder, setLastCreatedReorder] = useState(null);
  const [gridQuantities, setGridQuantities] = useState({});
  const [shortageSection, setShortageSection] = useState('all'); // 'all' | 'matrix_lenses' | 'general_categories'
  const [matrixViewMode, setMatrixViewMode] = useState('grid_2d'); // 'grid_2d' | 'flat_list'
  const [activeMatrixProductId, setActiveMatrixProductId] = useState('all');
  const [hoveredProcCell, setHoveredProcCell] = useState(null); // { productId, sph, cyl } | null

  const loadReorders = async () => {
    setLoadingReorders(true);
    try {
      const res = await axios.get('/api/admin/finance/procurement/reorders', authHeader);
      setReordersList(res.data?.reorders || []);
    } catch (err) {
      console.error('Failed to load reorders:', err);
    } finally {
      setLoadingReorders(false);
    }
  };

  const loadGridCritical = async () => {
    setLoadingGridCritical(true);
    try {
      const res = await axios.get('/api/admin/finance/procurement/grid-critical-stock', authHeader);
      const items = res.data?.items || [];
      const matProds = res.data?.matrixProducts || [];
      const genProds = res.data?.generalProducts || [];
      setGridCriticalItems(items);
      setMatrixProducts(matProds);
      setGeneralProducts(genProds);

      const initialQtys = {};
      items.forEach((it) => {
        initialQtys[it.id] = it.suggestedQuantity || 4;
      });
      matProds.forEach((mp) => {
        Object.values(mp.matrixMap || {}).forEach((cell) => {
          if (initialQtys[cell.id] === undefined) {
            initialQtys[cell.id] = cell.suggestedQuantity || 4;
          }
        });
      });
      genProds.forEach((gp) => {
        initialQtys[gp.id] = gp.suggestedQuantity || 10;
      });
      setGridQuantities((prev) => ({ ...initialQtys, ...prev }));
    } catch (err) {
      console.error('Failed to load grid critical stock:', err);
    } finally {
      setLoadingGridCritical(false);
    }
  };

  useEffect(() => {
    loadReorders();
    loadGridCritical();
  }, []);

  useEffect(() => {
    if (activeTab === 'reorders') {
      loadReorders();
    } else if (activeTab === 'grid_critical') {
      loadGridCritical();
    }
  }, [activeTab]);

  const handleUpdateReorderStatus = async (reorderId, newStatus) => {
    try {
      await axios.patch(`/api/admin/finance/procurement/reorders/${reorderId}/status`, { status: newStatus }, authHeader);
      showToast(
        newStatus === 'completed'
          ? 'تم اعتماد استلام الطلب وتغذية أرصدة المخزون ومصفوفة الدرج تلقائياً ✅'
          : 'تم تحديث حالة أمر التوريد'
      );
      loadReorders();
      loadGridCritical();
      onRefresh?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث الحالة', 'error');
    }
  };

  const handleConvertReorderToShipment = (reo) => {
    if (!reo) return;
    const matchedSup =
      suppliers.find((s) => String(s._id) === String(reo.supplierId?._id || reo.supplierId)) ||
      suppliers.find((s) => s.name === reo.supplierName);

    setEditingShipment(null);
    setShipmentForm({
      referenceId: `SHP-${reo.reorderCode}`,
      shipmentDate: new Date().toISOString().slice(0, 10),
      supplierId: matchedSup?._id || reo.supplierId?._id || reo.supplierId || '',
      supplierName: matchedSup?.name || reo.supplierName || '',
      supplierPhone: matchedSup?.phone || reo.supplierWhatsapp || reo.supplierPhone || '',
      supplierEmail: matchedSup?.email || '',
      supplierAddress: matchedSup?.address || '',
      expectedGoodsValue: reo.totalEstimatedCost || '',
      dueDate: '',
      status: reo.status === 'completed' ? 'received' : 'ordered',
      notes: `شحنة والتزام مالي محول من أمر التوريد المركزي رقم (${reo.reorderCode}) — إجمالي الكميات: ${reo.totalQuantity} وحدة — الأصناف: ${(reo.items || [])
        .map((i) => `${i.name} (x${i.quantity})`)
        .join('، ')}`
    });
    setIsShipmentModalOpen(true);
  };

  const handleBulkGridReorder = async () => {
    if (isSubmittingBulkReorder) return;

    const selectedIds = Object.keys(selectedGridRows).filter((k) => selectedGridRows[k]);
    if (selectedIds.length === 0) {
      showToast('⚠️ يرجى تحديد مقاس عدسة أو صنف واحد على الأقل من الجداول أدناه أولاً', 'error');
      return;
    }

    // Strictly require the user to select a supplier instead of silently falling back to suppliers[0]
    if (!bulkSupplierId) {
      setSupplierValidationError(true);
      showToast('⚠️ يرجى اختيار المورد من القائمة العلوية أولاً قبل إصدار أمر التوريد الجماعي', 'error');
      return;
    }

    const sup = suppliers.find((s) => String(s._id) === String(bulkSupplierId));
    if (!sup) {
      setSupplierValidationError(true);
      showToast('⚠️ يرجى تحديد مورد صالح من القائمة أولاً', 'error');
      return;
    }

    setSupplierValidationError(false);

    // Gather both selected matrix cells (from 2D grid or flat list) AND selected general category products
    const allMatrixCellsMap = new Map();
    gridCriticalItems.forEach((it) => allMatrixCellsMap.set(it.id, it));
    matrixProducts.forEach((mp) => {
      Object.values(mp.matrixMap || {}).forEach((cell) => {
        if (!allMatrixCellsMap.has(cell.id)) {
          allMatrixCellsMap.set(cell.id, {
            id: cell.id,
            productId: mp.productId,
            productName: mp.productName,
            categoryName: mp.categoryName,
            costPrice: mp.costPrice,
            currentStock: cell.currentStock,
            specs: {
              sph: cell.sph,
              cyl: cell.cyl,
              axisXName: mp.axisXName || 'SPH',
              axisYName: mp.axisYName || 'CYL'
            }
          });
        }
      });
    });

    const generalMap = new Map();
    generalProducts.forEach((gp) => generalMap.set(gp.id, gp));

    const itemsToReorder = [];
    selectedIds.forEach((sid) => {
      if (allMatrixCellsMap.has(sid)) {
        const i = allMatrixCellsMap.get(sid);
        itemsToReorder.push({
          productId: i.productId,
          baseProductName: i.productName,
          name: `${i.productName} (SPH: ${i.specs?.sph || ''} | CYL: ${i.specs?.cyl || ''})`,
          quantity: Math.max(1, Number(gridQuantities[i.id] || 4)),
          unitCost: Number(i.costPrice || 0),
          currentStock: Number(i.currentStock || 0),
          stockAtOrder: Number(i.currentStock || 0),
          specs: i.specs || {}
        });
      } else if (generalMap.has(sid)) {
        const gp = generalMap.get(sid);
        itemsToReorder.push({
          productId: gp.productId,
          name: gp.productName,
          category: gp.categoryName,
          quantity: Math.max(1, Number(gridQuantities[gp.id] || gp.suggestedQuantity || 10)),
          unitCost: Number(gp.costPrice || 0),
          stockAtOrder: Number(gp.currentStock || 0),
          specs: {}
        });
      }
    });

    if (itemsToReorder.length === 0) {
      showToast('لم يتم العثور على بنود صالحة ضمن التحديد الحالي', 'error');
      return;
    }

    setIsSubmittingBulkReorder(true);
    try {
      const payload = {
        supplierId: sup._id,
        supplierName: sup.name,
        supplierPhone: sup.phone,
        supplierWhatsapp: sup.whatsappPhone || sup.phone,
        items: itemsToReorder,
        notes: `أمر توريد مجمع من لوحة النواقص ومصفوفة الجريد (${itemsToReorder.length} بند محدد)`,
        channel: 'whatsapp_direct'
      };

      const res = await axios.post('/api/admin/finance/procurement/reorders/dispatch', payload, authHeader);
      const createdReorder = res.data?.reorder;
      setLastCreatedReorder({
        reorder: createdReorder,
        trackingPortalUrl: res.data?.trackingPortalUrl || createdReorder?.trackingPortalUrl || '',
        shortWhatsAppUrl: res.data?.shortWhatsAppUrl || `/api/procurement-public/whatsapp/${createdReorder?.reorderCode}`,
        directWhatsAppLink: res.data?.directWhatsAppLink || ''
      });
      showToast(
        `✅ تم إصدار أمر التوريد رقم (${createdReorder?.reorderCode || 'جديد'}) للمورد ${sup.name} وحفظه في سجل أوامر التوريد المركزية`
      );
      setSelectedGridRows({});
      await Promise.all([loadGridCritical(), loadReorders()]);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر إصدار أمر التوريد الجماعي', 'error');
    } finally {
      setIsSubmittingBulkReorder(false);
    }
  };

  const handleStartShipmentForProduct = (item) => {
    const matchedSup =
      suppliers.find((s) => s._id === (item.supplier?._id || item.supplierId)) ||
      (item.supplier?._id ? item.supplier : null);

    setEditingShipment(null);
    setShipmentForm({
      referenceId: `SHP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${item.sku || 'REORDER'}`,
      shipmentDate: new Date().toISOString().slice(0, 10),
      supplierId: matchedSup?._id || '',
      supplierName: matchedSup?.name || '',
      supplierPhone: matchedSup?.phone || matchedSup?.whatsappPhone || '',
      supplierEmail: matchedSup?.email || '',
      supplierAddress: matchedSup?.address || '',
      expectedGoodsValue: '',
      dueDate: '',
      status: 'ordered',
      notes: `إعادة توريد بناءً على سرعة البيع: ${item.name} (${item.sku || 'بدون كود'}) | المخزون الحالي: ${item.currentStock} | الكمية المقترحة: ${item.suggestedReorderQuantity} قطعة`
    });
    setIsShipmentModalOpen(true);
  };

  const handleWhatsAppSupplierForProduct = (item) => {
    const sup = item.supplier;
    const rawPhone = (sup?.whatsappPhone || sup?.phone || '').replace(/[^0-9]/g, '');
    if (!rawPhone) {
      showToast?.('لا يوجد رقم هاتف أو واتساب مسجل لهذا المورد', 'error');
      return;
    }
    const cleanPhone = rawPhone.startsWith('0') ? '2' + rawPhone : rawPhone;
    const msg = `مرحباً ${sup?.name || 'موردنا العزيز'}،\nنود الاستفسار وطلب توريد جديد للمنتج التالي نظراً لارتفاع معدل الطلب وقرب نفاد المخزون:\n\n📦 المنتج: ${item.name}\n🔖 كود المنتج (SKU): ${item.sku || '-'}\n📊 المخزون الحالي المتبقي: ${item.currentStock} قطعة\n🎯 الكمية المقترحة للطلب: ${item.suggestedReorderQuantity} قطعة\n\nيرجى تأكيد التوفر وعرض السعر وموعد التوريد المتوقع. شكرًا لك.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleOpenShipmentModal = (shipment = null) => {
    if (shipment) {
      setEditingShipment(shipment);
      const matchedSup =
        suppliers.find((s) => s._id === (shipment.supplierId?._id || shipment.supplierId)) ||
        suppliers.find((s) => s.name === shipment.supplier?.name || s.name === shipment.supplierName);

      setShipmentForm({
        referenceId: shipment.referenceId || '',
        shipmentDate: shipment.shipmentDate
          ? new Date(shipment.shipmentDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        supplierId: matchedSup?._id || shipment.supplierId?._id || shipment.supplierId || '',
        supplierName: matchedSup?.name || shipment.supplier?.name || shipment.supplierName || '',
        supplierPhone: matchedSup?.phone || matchedSup?.whatsappPhone || shipment.supplier?.phone || '',
        supplierEmail: matchedSup?.email || shipment.supplier?.email || '',
        supplierAddress: matchedSup?.address || shipment.supplier?.address || '',
        expectedGoodsValue: shipment.expectedGoodsValue ?? '',
        dueDate: shipment.dueDate ? new Date(shipment.dueDate).toISOString().slice(0, 10) : '',
        status: shipment.status || 'ordered',
        notes: shipment.notes || ''
      });
    } else {
      setEditingShipment(null);
      setShipmentForm({
        referenceId: '',
        shipmentDate: new Date().toISOString().slice(0, 10),
        supplierId: '',
        supplierName: '',
        supplierPhone: '',
        supplierEmail: '',
        supplierAddress: '',
        expectedGoodsValue: '',
        dueDate: '',
        status: 'ordered',
        notes: ''
      });
    }
    setIsShipmentModalOpen(true);
  };

  const handleSaveShipment = async (e) => {
    e.preventDefault();
    if (!shipmentForm.supplierId) {
      showToast('يرجى اختيار المورد من قائمة الموردين المعتمدين أولاً', 'error');
      return;
    }

    const payload = {
      referenceId: shipmentForm.referenceId || undefined,
      shipmentDate: shipmentForm.shipmentDate,
      supplierId: shipmentForm.supplierId,
      supplierName: shipmentForm.supplierName,
      supplierPhone: shipmentForm.supplierPhone,
      supplierEmail: shipmentForm.supplierEmail,
      supplierAddress: shipmentForm.supplierAddress,
      expectedGoodsValue: Number(shipmentForm.expectedGoodsValue || 0),
      dueDate: shipmentForm.dueDate || null,
      status: shipmentForm.status,
      notes: shipmentForm.notes
    };

    try {
      if (editingShipment) {
        await axios.put(`/api/admin/finance/shipments/${editingShipment._id}`, payload, authHeader);
        showToast('تم تحديث بيانات شحنة المورد بنجاح');
      } else {
        await axios.post('/api/admin/finance/shipments', payload, authHeader);
        showToast('تم تسجيل شحنة المورد والتزام الشراء بنجاح');
      }
      setIsShipmentModalOpen(false);
      onRefresh?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ شحنة المورد', 'error');
    }
  };

  const openShipmentDetails = async (shipmentId) => {
    try {
      const res = await axios.get(`/api/admin/finance/shipments/${shipmentId}`, authHeader);
      setActiveShipmentDetails(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل تفاصيل الشحنة', 'error');
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return suppliers;
    const q = supplierSearchQuery.trim().toLowerCase();
    return suppliers.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.specialty || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.whatsappPhone || '').includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearchQuery]);

  const selectedShipmentSupplier = useMemo(() => {
    if (!shipmentForm.supplierId) return null;
    return suppliers.find((s) => s._id === shipmentForm.supplierId) || null;
  }, [suppliers, shipmentForm.supplierId]);

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete?._id) return;
    setIsDeletingSupplier(true);
    try {
      await axios.delete(`/api/admin/finance/suppliers/${supplierToDelete._id}`, authHeader);
      showToast?.(`تم حذف المورد «${supplierToDelete.name}» بنجاح ✓`, 'success');
      setSupplierToDelete(null);
      onRefresh?.();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر حذف المورد', 'error');
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Switcher: Shipments vs Suppliers Directory vs Fast-Selling Forecast */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-card bg-surface border border-line shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('shipments')}
            className={`px-4 py-2 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'shipments'
                ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-surface'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>شحنات الموردين والالتزامات ({shipments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-surface'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>دليل الموردين المعتمدين ({suppliers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reorders')}
            className={`px-4 py-2 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'reorders'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-surface'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>سجل أوامر التوريد المركزية ({reordersList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grid_critical')}
            className={`px-4 py-2 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'grid_critical'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-surface'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>
              نواقص المخزون ومصفوفة العدسات ({gridCriticalItems.length + generalProducts.filter((p) => p.needsReorder).length})
            </span>
            {gridCriticalItems.some((i) => i.isOutOfStock) && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                {gridCriticalItems.filter((i) => i.isOutOfStock).length} مقاس نافذ
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fast_selling')}
            className={`px-4 py-2 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'fast_selling'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-surface'
            }`}
          >
            <Flame className={`w-4 h-4 ${forecastData?.urgentCount > 0 ? 'text-orange-300 animate-pulse' : 'text-orange-500'}`} />
            <span>الأكثر مبيعاً وتوقعات التوريد</span>
            {forecastData?.topFastSelling?.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] font-black">
                {forecastData.topFastSelling.length}
              </span>
            )}
            {forecastData?.urgentCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse shadow-sm">
                {forecastData.urgentCount} حرج
              </span>
            )}
          </button>
        </div>

        {activeTab === 'suppliers' && (
          <button
            type="button"
            onClick={() => {
              setEditingSupplier(null);
              setIsSupplierModalOpen(true);
            }}
            className="px-4 py-2 rounded-btn bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md hover:bg-emerald-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مورد جديد</span>
          </button>
        )}

        {activeTab === 'shipments' && (
          <button
            type="button"
            onClick={() => handleOpenShipmentModal(null)}
            className="px-4 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black flex items-center gap-1.5 shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل شحنة مورد جديدة</span>
          </button>
        )}

        {activeTab === 'fast_selling' && (
          <button
            type="button"
            onClick={() => loadForecast(forecastDays)}
            disabled={isForecastLoading}
            className="px-4 py-2 rounded-btn bg-surface border border-line hover:border-orange-500 text-ink text-xs font-black flex items-center gap-1.5 shadow-sm hover:bg-paper transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-500 ${isForecastLoading ? 'animate-spin' : ''}`} />
            <span>تحديث التحليلات الآن</span>
          </button>
        )}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'shipments' && (
        <>
          {/* Urgent Stockout Alert Banner */}
          {forecastData?.urgentCount > 0 && (
            <div className="p-4 rounded-card bg-gradient-to-r from-orange-500/15 via-red-500/10 to-transparent border border-orange-500/30 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-600 flex items-center justify-center shrink-0 border border-orange-500/30">
                  <Flame className="w-5 h-5 text-orange-600 animate-pulse" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-ink flex items-center gap-2">
                    <span>تنبيه نفاذ مخزون وشيك للأكثر مبيعاً ({forecastData.urgentCount} منتجات مهددة)</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                      تحرك سريع
                    </span>
                  </h5>
                  <p className="text-[11px] text-ink-soft mt-0.5">
                    التحليلات رصدت منتجات سريعة البيع ستنفد من المخزون خلال أقل من 7 أيام. يُنصح بمراجعة قسم التوقعات وحجز طلبيات من الموردين فوراً.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('fast_selling')}
                className="px-4 py-2 rounded-btn bg-orange-600 hover:bg-orange-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>معاينة توقعات التوريد والموردين</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي التزامات الموردين</span>
          <div className="text-xl font-black text-ink">
            {(procurementOverview?.summary?.totalObligations || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">
            عدد الشحنات: {procurementOverview?.summary?.totalShipments || 0}
          </span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي المدفوع للموردين</span>
          <div className="text-xl font-black text-emerald-600">
            {(procurementOverview?.summary?.totalPaid || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">دفعات نقدية وتحويلات مسجلة</span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">الرصيد المتبقي المستحق (Outstanding)</span>
          <div className="text-xl font-black text-orange-600">
            {(procurementOverview?.summary?.totalOutstanding || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">التزامات قائمة غير مسددة بالكامل</span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">التنبيهات ومواعيد الاستحقاق</span>
          <div className="text-xl font-black text-red-500">
            {procurementOverview?.summary?.overdueCount || 0} متأخرة
          </div>
          <span className="text-[11px] text-ink-soft block">
            +{procurementOverview?.summary?.upcomingDueCount || 0} تستحق خلال 7 أيام
          </span>
        </div>
      </div>

      {/* Overdue Alerts Banner */}
      {procurementOverview?.alerts?.length > 0 && (
        <div className="p-4 rounded-card bg-red-500/10 border border-red-500/25 space-y-2">
          <div className="flex items-center gap-2 text-xs font-black text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span>تنبيهات استحقاق شحنات الموردين ({procurementOverview.alerts.length}):</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {procurementOverview.alerts.slice(0, 6).map((al) => (
              <div
                key={al.shipmentId}
                onClick={() => openShipmentDetails(al.shipmentId)}
                className="cursor-pointer p-2.5 rounded-btn bg-surface border border-red-500/20 flex items-center justify-between text-xs hover:bg-paper"
              >
                <div>
                  <span className="font-mono font-black text-primary">{al.referenceId}</span>
                  <span className="font-bold text-ink mr-2">— {al.supplierName}</span>
                  <span className="block text-[10px] text-red-500 font-bold">
                    {al.alertType === 'overdue'
                      ? `متأخرة منذ ${al.daysOverdue} يوم`
                      : `تستحق خلال ${al.daysUntilDue} يوم`}
                  </span>
                </div>
                <span className="font-black text-red-600">
                  متبقي: {al.outstandingBalance} {currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipments List & Filtering */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-ink flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span>شحنات الموردين والالتزامات المالية (Supplier Shipments)</span>
            </h4>
            <p className="text-xs text-ink-soft mt-0.5">
              إدارة شحنات البضائع الواردة، ربط بنود الشراء، وتسجيل الدفعات النقدية وتتبع الرصيد المتبقي
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenShipmentModal(null)}
            className="px-4 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black flex items-center gap-1.5 shadow-md hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل شحنة مورد جديدة</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-card bg-paper border border-line text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-ink-soft">حالة الدفع:</span>
            <select
              value={shipmentFilterStatus}
              onChange={(e) => setShipmentFilterStatus(e.target.value)}
              className="bg-surface border border-line rounded p-1.5 text-ink font-bold"
            >
              <option value="all">الكل</option>
              <option value="unpaid">غير مدفوعة (Unpaid)</option>
              <option value="partially_paid">مدفوعة جزئياً (Partial)</option>
              <option value="paid">مدفوعة بالكامل (Paid)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={shipmentOverdueOnly}
              onChange={(e) => setShipmentOverdueOnly(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-red-500 font-black">الشحنات المتأخرة فقط</span>
          </label>

          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
              placeholder="بحث برقم الشحنة أو اسم المورد..."
              className="w-full bg-surface border border-line rounded p-1.5 text-ink"
            />
          </div>
        </div>

        {/* Shipments Table */}
        {shipments.length === 0 ? (
          <div className="p-8 text-center bg-paper rounded-card border border-line text-xs text-ink-soft space-y-2">
            <p className="font-black text-ink">لا توجد شحنات موردين مسجلة تطابق البحث</p>
            <p>سجل شحنات المشتريات من الموردين لإنشاء الالتزامات المالية وتتبع تسديدها.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                <tr>
                  <th className="p-3">رقم المرجع</th>
                  <th className="p-3">تاريخ الشحنة</th>
                  <th className="p-3">المورد</th>
                  <th className="p-3">إجمالي الالتزام</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">الرصيد المتبقي</th>
                  <th className="p-3">الاستحقاق</th>
                  <th className="p-3">حالة السداد</th>
                  <th className="p-3">حالة الشحنة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shipments.map((shp) => {
                  const payBadge = PAYMENT_STATUS_BADGES[shp.paymentStatus] || {
                    label: shp.paymentStatus,
                    cls: 'bg-slate-500/10 text-slate-500'
                  };
                  return (
                    <tr key={shp._id} className="hover:bg-paper/60">
                      <td className="p-3 font-mono font-black text-primary">{shp.referenceId}</td>
                      <td className="p-3 text-ink-soft">
                        {shp.shipmentDate ? new Date(shp.shipmentDate).toLocaleDateString('ar-EG') : '—'}
                      </td>
                      <td className="p-3 font-bold text-ink">
                        <div>{shp.supplier?.name || shp.supplierName}</div>
                        {shp.supplier?.phone && (
                          <span className="text-[10px] text-ink-soft block">{shp.supplier.phone}</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-ink">
                        {shp.approvedObligationTotal} {currency}
                      </td>
                      <td className="p-3 font-bold text-emerald-600">
                        {shp.totalPaid} {currency}
                      </td>
                      <td className="p-3 font-black text-orange-600">
                        {shp.outstandingBalance} {currency}
                      </td>
                      <td className="p-3">
                        {shp.dueDate ? (
                          <span
                            className={`text-[11px] font-bold ${
                              shp.isOverdue ? 'text-red-500 font-black' : 'text-ink-soft'
                            }`}
                          >
                            {new Date(shp.dueDate).toLocaleDateString('ar-EG')}
                            {shp.isOverdue && ' (متأخرة)'}
                          </span>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${payBadge.cls}`}
                        >
                          {payBadge.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] font-bold text-ink">
                          {SHIPMENT_STATUS_LABELS[shp.status] || shp.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openShipmentDetails(shp._id)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                            title="عرض التفاصيل والدفعات والمنتجات"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenShipmentModal(shp)}
                            className="p-1.5 text-ink-soft hover:bg-paper rounded-lg"
                            title="تعديل الشحنة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* Suppliers Directory Tab */}
      {activeTab === 'suppliers' && (
        <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>دليل الموردين المعتمدين (Suppliers Directory)</span>
              </h4>
              <p className="text-xs text-ink-soft mt-0.5">
                إدارة شبكة الموردين، بيانات الاتصال، التخصصات، وأرقام الواتساب للتواصل وإرسال طلبات التوريد المباشرة
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingSupplier(null);
                setIsSupplierModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-btn bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مورد جديد</span>
            </button>
          </div>

          {/* Supplier Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-ink-soft absolute right-3 top-3" />
            <input
              type="text"
              value={supplierSearchQuery}
              onChange={(e) => setSupplierSearchQuery(e.target.value)}
              placeholder="البحث باسم المورد، التخصص، رقم الهاتف أو الواتساب، البريد..."
              className="w-full bg-paper border border-line rounded-btn py-2.5 pr-9 pl-4 text-xs text-ink outline-none focus:border-primary font-bold"
            />
          </div>

          {/* Suppliers Cards Grid */}
          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center bg-paper rounded-card border border-line text-xs text-ink-soft space-y-3">
              <Building2 className="w-8 h-8 text-ink-soft/40 mx-auto" />
              <p className="font-black text-ink">لم يتم العثور على موردين مسجلين</p>
              <p>قم بإضافة مورديك لربطهم بالمنتجات وإرسال رسائل إعادة الطلب التلقائية عبر الواتساب بنقرة واحدة.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingSupplier(null);
                  setIsSupplierModalOpen(true);
                }}
                className="px-4 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول مورد الآن</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => {
                const whatsappNumber = (sup.whatsappPhone || sup.phone || '').replace(/[^0-9]/g, '');
                const cleanPhone = whatsappNumber.startsWith('0')
                  ? '2' + whatsappNumber
                  : whatsappNumber;
                return (
                  <div
                    key={sup._id}
                    className="p-4 rounded-2xl bg-paper/70 border border-line hover:border-primary/40 space-y-3 flex flex-col justify-between transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-ink">{sup.name}</h5>
                            {sup.specialty && (
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                                {sup.specialty}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            sup.active !== false
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}
                        >
                          {sup.active !== false ? 'نشط' : 'معطل'}
                        </span>
                      </div>

                      {/* Contact Channels */}
                      <div className="pt-2 border-t border-line/60 space-y-1.5 text-[11px] text-ink-soft">
                        {(sup.phone || sup.whatsappPhone) && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-ink-soft" />
                              <span className="font-mono text-ink font-bold">
                                {sup.phone || sup.whatsappPhone}
                              </span>
                            </div>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1 text-[10px] font-black transition-all"
                                title="مراسلة المورد عبر واتساب"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>واتساب</span>
                              </a>
                            )}
                          </div>
                        )}

                        {sup.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-ink-soft shrink-0" />
                            <a
                              href={`mailto:${sup.email}`}
                              className="text-primary hover:underline truncate"
                            >
                              {sup.email}
                            </a>
                          </div>
                        )}

                        {sup.address && (
                          <div className="flex items-center gap-1.5 text-ink-soft">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sup.address}</span>
                          </div>
                        )}

                        {sup.notes && (
                          <p className="text-[10px] text-ink-soft/80 bg-surface p-2 rounded-xl border border-line/50 line-clamp-2">
                            {sup.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-line flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSupplier(sup);
                          setIsSupplierModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-btn bg-surface border border-line text-ink hover:text-primary text-[11px] font-bold flex items-center gap-1 hover:bg-paper"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSupplierToDelete(sup)}
                        className="px-3 py-1.5 rounded-btn bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Unified Central Reorders Log (سجل أوامر التوريد المركزية) */}
      {activeTab === 'reorders' && (
        <div className="space-y-4">
          {/* Workflow Explanation Banner: Difference between Central Reorders vs Financial Shipments */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-emerald-500/10 border border-amber-500/25 space-y-2">
            <div className="text-xs font-black text-ink flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>كيف تعمل دورة المشتريات؟ (الفرق بين سجل أوامر التوريد وشحنات الموردين والالتزامات)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
              <div className="p-2.5 rounded-xl bg-surface/90 border border-amber-500/20">
                <span className="font-black text-amber-700 dark:text-amber-400 block mb-0.5">
                  1️⃣ المرحلة الأولى: سجل أوامر التوريد المركزية (هنا)
                </span>
                هو <strong>طلب شراء مبدئي (Purchase Order)</strong> يصدر للمورد عبر الواتساب أو بوابة المورد عند اكتشاف نواقص في الدرج أو المحل (من شاشة النواقص أو الكاشير أو المساعد الذكي). لا يسجل مديونية مالية على المحل حتى يوافق المورد، وعند تغيير حالته إلى <strong>«مكتمل ومستلم»</strong> يغذّي رصيد المحل وخانات درج العدسات تلقائياً.
              </div>
              <div className="p-2.5 rounded-xl bg-surface/90 border border-emerald-500/20">
                <span className="font-black text-emerald-700 dark:text-emerald-400 block mb-0.5">
                  2️⃣ المرحلة الثانية: شحنات الموردين والالتزامات المالية
                </span>
                عند وصول فاتورة المورد الفعلية، اضغط على زر <strong>«تحويل لشحنة والتزام مالي»</strong> بجانب أي أمر توريد هنا ليتم فتح فاتورة شحنة مالية بها مواعيد الاستحقاق والمدفوعات المسددة من الخزينة والرصيد المتبقي للمورد.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>سجل أوامر التوريد المركزية (Unified Supply Reorders)</span>
              </h3>
              <p className="text-[11px] text-ink-soft">
                جميع طلبات التوريد الصادرة للموردين من شاشة النواقص، نقطة البيع (POS)، أو المساعد التنفيذي الذكي
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('grid_critical')}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-black hover:bg-purple-700 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إصدار أمر توريد نواقص جديد</span>
              </button>
              <button
                type="button"
                onClick={loadReorders}
                disabled={loadingReorders}
                className="px-3 py-1.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink hover:bg-surface flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${loadingReorders ? 'animate-spin' : ''}`} />
                <span>تحديث السجل</span>
              </button>
            </div>
          </div>

          {loadingReorders ? (
            <div className="p-12 text-center text-ink-soft text-xs animate-pulse">
              جاري تحميل أوامر التوريد...
            </div>
          ) : reordersList.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface border border-dashed border-line text-center space-y-2">
              <Package className="w-10 h-10 text-ink-soft mx-auto" />
              <h4 className="text-sm font-black text-ink">لا توجد أوامر توريد مسجلة حتى الآن</h4>
              <p className="text-xs text-ink-soft">
                عند إصدار طلب توريد لصنف ناقص في نقطة البيع أو الأوردر أو مصفوفة الجريد، سيظهر هنا مباشرة
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                    <tr>
                      <th className="p-3">كود التوريد</th>
                      <th className="p-3">المورد والتواصل</th>
                      <th className="p-3">الأصناف والمقاسات المطلوبة</th>
                      <th className="p-3 text-center">إجمالي الكمية</th>
                      <th className="p-3 text-center">التكلفة التقديرية</th>
                      <th className="p-3 text-center">حالة أمر التوريد (وتغذية المخزون)</th>
                      <th className="p-3">تاريخ الطلب</th>
                      <th className="p-3 text-center">إجراءات ومتابعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {reordersList.map((reo) => (
                      <tr key={reo._id} className="hover:bg-paper/50 transition-colors">
                        <td className="p-3 font-mono font-black text-primary">
                          <div>{reo.reorderCode}</div>
                          {reo.waterfallRequestCode && (
                            <span className="text-[10px] text-purple-600 font-bold block">
                              تتبع: {reo.waterfallRequestCode}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-black text-ink">{reo.supplierName}</div>
                          {reo.supplierWhatsapp || reo.supplierPhone ? (
                            <div className="text-[11px] text-ink-soft font-mono flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span dir="ltr">{reo.supplierWhatsapp || reo.supplierPhone}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-ink-soft">بدون هاتف</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1.5 max-w-md">
                            {(reo.items || []).map((it, idx) => (
                              <div key={idx} className="p-2 rounded-xl bg-paper border border-line text-[11px] font-bold space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-ink font-black">{it.name}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-primary/10 font-mono text-primary font-black shrink-0">
                                    إجمالي: x{it.quantity}
                                  </span>
                                </div>
                                {it.specs && (it.specs.sph || it.specs.cyl) && (
                                  <div className="text-[10px] text-purple-700 dark:text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 inline-block">
                                    SPH: {it.specs.sph || '0.00'} | CYL: {it.specs.cyl || '0.00'}
                                  </div>
                                )}
                                {Array.isArray(it.specs?.matrixBreakdown) && it.specs.matrixBreakdown.length > 0 && (
                                  <details className="group pt-1 border-t border-line/60">
                                    <summary className="cursor-pointer text-[10px] text-purple-600 dark:text-purple-400 font-black flex items-center justify-between select-none">
                                      <span>👓 تفصيل مقاسات الدرج المطلوبة ({it.specs.matrixBreakdown.length} مقاس SPH×CYL)</span>
                                      <span className="text-[9px] underline">عرض / طي الجدول</span>
                                    </summary>
                                    <div className="mt-1.5 max-h-40 overflow-y-auto grid grid-cols-2 gap-1 p-1.5 rounded-lg bg-surface border border-line font-mono text-[10px]">
                                      {it.specs.matrixBreakdown.map((cell, cIdx) => (
                                        <div
                                          key={cIdx}
                                          className={`px-1.5 py-1 rounded border flex items-center justify-between ${
                                            Number(cell.currentStock) <= 0
                                              ? 'bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-300'
                                              : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
                                          }`}
                                        >
                                          <span dir="ltr">
                                            {cell.sph}/{cell.cyl}
                                          </span>
                                          <span className="font-black">
                                            مطلوب: {cell.neededQty || cell.quantity}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                                {(it.customerName || it.orderId) && (
                                  <div className="text-[9px] text-ink-soft flex items-center gap-2 mt-0.5">
                                    {it.customerName && <span>عميل: {it.customerName}</span>}
                                    {it.orderId && <span>أوردر: #{it.orderId}</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center font-black font-mono text-ink text-sm">
                          {reo.totalQuantity} وحدة
                        </td>
                        <td className="p-3 text-center font-black font-mono text-emerald-700 dark:text-emerald-400">
                          {Number(reo.totalEstimatedCost || 0).toLocaleString()} {currency}
                        </td>
                        <td className="p-3 text-center">
                          <select
                            value={reo.status || 'sent'}
                            onChange={(e) => handleUpdateReorderStatus(reo._id, e.target.value)}
                            className="bg-paper border border-line rounded-lg px-2 py-1 text-[11px] font-bold outline-none text-ink text-center"
                          >
                            <option value="pending">قيد الانتظار (pending)</option>
                            <option value="sent">تم الإرسال للمورد (sent)</option>
                            <option value="partially_fulfilled">مستلم جزئياً (partially)</option>
                            <option value="completed">مكتمل ومستلم - تغذية الدرج ✅</option>
                            <option value="cancelled">ملغي (cancelled)</option>
                          </select>
                        </td>
                        <td className="p-3 text-[11px] text-ink-soft">
                          {new Date(reo.sentAt || reo.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {(reo.supplierWhatsapp || reo.supplierPhone) && (
                              <button
                                type="button"
                                onClick={() => {
                                  window.open(`/api/procurement-public/whatsapp/${reo.reorderCode}`, '_blank');
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[10px] font-black flex items-center gap-1 transition-all"
                                title="إرسال الطلب عبر واتساب للمورد"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>واتساب</span>
                              </button>
                            )}
                            {reo.trackingPortalUrl && (
                              <a
                                href={reo.trackingPortalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 text-[10px] font-black flex items-center gap-1 transition-all"
                                title="فتح رابط متابعة وتأكيد المورد (شامل جدول مقاسات الجريد)"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>بوابة المورد</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleConvertReorderToShipment(reo)}
                              className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black flex items-center gap-1 transition-all"
                              title="تحويل أمر التوريد إلى شحنة والتزام مالي في الحسابات"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span>تحويل لشحنة مالية</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Unified Shortages & 2D Lens Matrix Grid (نواقص المخزون ومصفوفة العدسات - كل الأقسام) */}
      {activeTab === 'grid_critical' && (
        <div className="space-y-5">
          {/* Post-Creation Confirmation Banner: Shows exactly where the order went + WhatsApp + Tracking Link */}
          {lastCreatedReorder?.reorder && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 space-y-3 shadow-md animate-fadeIn">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-ink">
                      تم إصدار وحفظ أمر التوريد بنجاح برقم:{' '}
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">
                        {lastCreatedReorder.reorder.reorderCode}
                      </span>
                    </h4>
                    <p className="text-xs text-ink-soft mt-0.5">
                      المورد: <strong>{lastCreatedReorder.reorder.supplierName}</strong> | إجمالي الوحدات:{' '}
                      <strong>{lastCreatedReorder.reorder.totalQuantity} وحدة</strong> | التكلفة التقديرية:{' '}
                      <strong>
                        {Number(lastCreatedReorder.reorder.totalEstimatedCost || 0).toLocaleString()} {currency}
                      </strong>
                      <span className="block text-[11px] text-emerald-700 dark:text-emerald-300 font-bold mt-1">
                        📍 أين تجد هذا الطلب؟ تم حفظه في تبويب «سجل أوامر التوريد المركزية ({reordersList.length})» ويمكنك إرساله للمورد أو متابعته من الأزرار التالية:
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLastCreatedReorder(null)}
                  className="p-1 rounded-lg hover:bg-paper text-ink-soft"
                  title="إغلاق التنبيه"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={lastCreatedReorder.shortWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>📱 إرسال طلب التوريد عبر واتساب للمورد</span>
                </a>
                {lastCreatedReorder.trackingPortalUrl && (
                  <a
                    href={lastCreatedReorder.trackingPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>🔗 فتح رابط متابعة وتأكيد المورد (شامل جدول SPH×CYL)</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('reorders')}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Clock className="w-4 h-4" />
                  <span>📋 عرض في سجل أوامر التوريد المركزية</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertReorderToShipment(lastCreatedReorder.reorder)}
                  className="px-3.5 py-2 rounded-xl bg-surface border border-line hover:border-primary text-ink text-xs font-black flex items-center gap-1.5 transition-all"
                >
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>💰 تحويل إلى شحنة والتزام مالي</span>
                </button>
              </div>
            </div>
          )}

          {/* Header & Bulk Action Controls */}
          <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-ink flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                <span>نواقص المخزون ومصفوفة العدسات الشاملة (كل الأقسام والكاتيجوريز)</span>
              </h3>
              <p className="text-[11px] text-ink-soft mt-0.5">
                اختر المقاسات الناقصة من جدول مصفوفة الجريد ثنائي الأبعاد (`SPH × CYL`) أو نواقص الشنابر والأصناف الأخرى، ثم حدد المورد وأصدر أمر التوريد
              </p>
            </div>

            {/* Bulk Action Controls with Strict Supplier Validation & Double-Click Protection */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <select
                    value={bulkSupplierId}
                    onChange={(e) => {
                      setBulkSupplierId(e.target.value);
                      if (e.target.value) setSupplierValidationError(false);
                    }}
                    className={`px-3 py-2 rounded-xl bg-paper border text-xs font-bold text-ink outline-none transition-all ${
                      supplierValidationError
                        ? 'border-red-500 ring-2 ring-red-500/20 bg-red-500/5'
                        : 'border-line focus:border-purple-500'
                    }`}
                  >
                    <option value="">-- اختر المورد لإصدار الأمر الجماعي (إلزامي) --</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.specialty || s.phone || 'مورد معتمد'})
                      </option>
                    ))}
                  </select>
                  {!bulkSupplierId && suppliers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        // Auto-select supplier linked to first selected item or default lens supplier
                        const firstSelectedId = Object.keys(selectedGridRows).find((k) => selectedGridRows[k]);
                        const matchedItem =
                          gridCriticalItems.find((i) => i.id === firstSelectedId) ||
                          generalProducts.find((g) => g.id === firstSelectedId);
                        const supId =
                          matchedItem?.supplier?._id ||
                          matchedItem?.supplier ||
                          matrixProducts[0]?.supplier?._id ||
                          suppliers[0]?._id;
                        if (supId) {
                          setBulkSupplierId(String(supId));
                          setSupplierValidationError(false);
                        }
                      }}
                      className="px-2.5 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[11px] font-black hover:bg-amber-500/20 transition-all"
                      title="تحديد المورد المقترح تلقائياً حسب الصنف"
                    >
                      تحديد المورد المقترح تلقائياً
                    </button>
                  )}
                </div>
                {supplierValidationError && (
                  <span className="text-[10px] font-black text-red-500 mt-1">
                    ⚠️ يجب اختيار المورد من القائمة أولاً قبل الإرسال!
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleBulkGridReorder}
                disabled={isSubmittingBulkReorder}
                className={`px-4 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all ${
                  isSubmittingBulkReorder
                    ? 'bg-purple-400 cursor-not-allowed opacity-75'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isSubmittingBulkReorder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري إصدار أمر التوريد...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      إصدار أمر توريد جماعي للمحدد ({Object.keys(selectedGridRows).filter((k) => selectedGridRows[k]).length})
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={loadGridCritical}
                disabled={loadingGridCritical}
                className="p-2 rounded-xl bg-paper border border-line text-ink hover:bg-surface transition-all"
                title="تحديث فحص المخزون ومصفوفات الجريد"
              >
                <RefreshCw className={`w-4 h-4 text-purple-600 ${loadingGridCritical ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Section Switcher: All vs 2D Lens Matrix vs Other Store Categories (Frames, Sunglasses, Accessories) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-line">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShortageSection('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  shortageSection === 'all'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                🔍 عرض الكل: العدسات + باقي الأقسام
              </button>
              <button
                type="button"
                onClick={() => setShortageSection('matrix_lenses')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  shortageSection === 'matrix_lenses'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                <span>👓 مصفوفة درجات العدسات (SPH × CYL)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-300 text-[10px]">
                  {gridCriticalItems.length} مقاس ناقص
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShortageSection('general_categories')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  shortageSection === 'general_categories'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                <span>🕶️ باقي الأقسام والكاتيجوريز (الشنابر، النظارات، المحاليل)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px]">
                  {generalProducts.filter((p) => p.needsReorder).length} نواقص / من إجمالي {generalProducts.length}
                </span>
              </button>
            </div>

            {shortageSection !== 'general_categories' && (
              <div className="flex items-center gap-1.5 bg-paper p-1 rounded-xl border border-line">
                <span className="text-[11px] font-bold text-ink-soft px-2">طريقة عرض العدسات:</span>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('grid_2d')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    matrixViewMode === 'grid_2d'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  🏁 جدول جريد حقيقي (SPH × CYL)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('flat_list')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    matrixViewMode === 'flat_list'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  📋 قائمة مسطحة
                </button>
              </div>
            )}
          </div>

          {loadingGridCritical ? (
            <div className="p-12 text-center text-ink-soft text-xs animate-pulse">
              جاري فحص المخزون ومصفوفات الجريد لجميع الأقسام...
            </div>
          ) : (
            <>
              {/* PART 1: General Store Categories Shortages (Frames, Sunglasses, Accessories, Solutions) */}
              {(shortageSection === 'all' || shortageSection === 'general_categories') && (
                <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-sm space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-ink flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-amber-600" />
                        <span>نواقص وأرصدة البضاعة لباقي الأقسام (النظارات، الشنابر، الإكسسوارات، المحاليل)</span>
                      </h4>
                      <p className="text-[11px] text-ink-soft">
                        جميع الأصناف غير المصفوفية مرتبة تصاعدياً حسب الرصيد المتبقي في المحل — حدد الأصناف المطلوبة لتضمينها في أمر التوريد
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...selectedGridRows };
                        generalProducts
                          .filter((gp) => gp.needsReorder)
                          .forEach((gp) => {
                            updated[gp.id] = true;
                          });
                        setSelectedGridRows(updated);
                        const firstSup = generalProducts.find((gp) => gp.needsReorder && gp.supplier?._id)?.supplier?._id;
                        if (firstSup && !bulkSupplierId) {
                          setBulkSupplierId(String(firstSup));
                          setSupplierValidationError(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-black hover:bg-amber-500/20 transition-all"
                    >
                      تحديد كل نواقص الشنابر والأقسام العامة ({generalProducts.filter((p) => p.needsReorder).length})
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                        <tr>
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                generalProducts.length > 0 &&
                                generalProducts.every((gp) => selectedGridRows[gp.id])
                              }
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedGridRows((prev) => {
                                  const next = { ...prev };
                                  generalProducts.forEach((gp) => {
                                    next[gp.id] = checked;
                                  });
                                  return next;
                                });
                              }}
                              className="w-4 h-4 rounded text-purple-600"
                            />
                          </th>
                          <th className="p-3">الصنف / الموديل</th>
                          <th className="p-3">القسم (Category)</th>
                          <th className="p-3 text-center">رصيد المحل الحالي</th>
                          <th className="p-3 text-center">حالة المخزون</th>
                          <th className="p-3 text-center">الكمية المطلوبة للتوريد</th>
                          <th className="p-3">المورد المرتبط</th>
                          <th className="p-3 text-center">طلب فردي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {generalProducts.map((gp) => (
                          <tr
                            key={gp.id}
                            className={`hover:bg-paper/50 transition-colors ${
                              selectedGridRows[gp.id] ? 'bg-purple-500/5' : ''
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedGridRows[gp.id])}
                                onChange={(e) =>
                                  setSelectedGridRows((prev) => ({
                                    ...prev,
                                    [gp.id]: e.target.checked
                                  }))
                                }
                                className="w-4 h-4 rounded text-purple-600"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-black text-ink">{gp.productName}</div>
                              {gp.sku && <div className="text-[10px] font-mono text-ink-soft">SKU: {gp.sku}</div>}
                            </td>
                            <td className="p-3 text-ink-soft font-bold">{gp.categoryName}</td>
                            <td className="p-3 text-center font-mono font-black text-sm text-ink">
                              {gp.currentStock} قطعة
                            </td>
                            <td className="p-3 text-center">
                              {gp.isOutOfStock ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/30 font-black text-[11px]">
                                  نافذ (0)
                                </span>
                              ) : gp.isCritical ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-black text-[11px]">
                                  حرج جداً (≤ {gp.criticalThreshold})
                                </span>
                              ) : gp.isLowStock ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-[11px]">
                                  رصيد منخفض (يحتاج توريد)
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-[11px]">
                                  متوفر ({gp.currentStock})
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={gridQuantities[gp.id] ?? gp.suggestedQuantity ?? 10}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  setGridQuantities((prev) => ({ ...prev, [gp.id]: val }));
                                }}
                                className="w-16 px-2 py-1 rounded-lg bg-paper border border-line text-xs font-mono font-black text-center text-ink outline-none"
                              />
                            </td>
                            <td className="p-3 text-[11px] font-bold text-ink-soft">
                              {gp.supplier?.name || 'غير محدد'}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGridItemForSupply({
                                    productId: gp.productId,
                                    name: gp.productName,
                                    quantity: Number(gridQuantities[gp.id] || gp.suggestedQuantity || 10),
                                    costPrice: gp.costPrice || 0,
                                    supplierId: gp.supplier?._id || gp.supplier,
                                    currentStock: gp.currentStock
                                  });
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[10px] font-black border border-amber-500/25 flex items-center gap-1 mx-auto transition-all"
                              >
                                <BellRing className="w-3 h-3 text-amber-600" />
                                <span>طلب توريد</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PART 2: Optical Lens Matrix (2D Grid Table SPH × CYL OR Flat List) */}
              {(shortageSection === 'all' || shortageSection === 'matrix_lenses') && (
                <div className="space-y-4">
                  {matrixViewMode === 'grid_2d' ? (
                    <div className="space-y-4">
                      {/* Lens Product Selector Pills */}
                      <div className="p-3 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-ink ml-2">اختر العدسة لعرض جدول الجريد (SPH × CYL):</span>
                          <button
                            type="button"
                            onClick={() => setActiveMatrixProductId('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                              activeMatrixProductId === 'all'
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-paper text-ink-soft hover:text-ink border border-line'
                            }`}
                          >
                            عرض جميع العدسات ({matrixProducts.length})
                          </button>
                          {matrixProducts.map((mp) => (
                            <button
                              key={mp.productId}
                              type="button"
                              onClick={() => setActiveMatrixProductId(String(mp.productId))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                                String(activeMatrixProductId) === String(mp.productId)
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'bg-paper text-ink-soft hover:text-ink border border-line'
                              }`}
                            >
                              <span>{mp.productName.split('(')[0].trim()}</span>
                              <span className="px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-500 text-[10px]">
                                {mp.depletedOrCriticalCount} ناقص
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2D Matrix Grid Tables per Lens Product */}
                      {matrixProducts
                        .filter(
                          (mp) =>
                            activeMatrixProductId === 'all' ||
                            String(mp.productId) === String(activeMatrixProductId)
                        )
                        .map((mp) => {
                          const productCellIds = Object.values(mp.matrixMap || {})
                            .filter((c) => c.isOutOfStock || c.isCritical)
                            .map((c) => c.id);
                          const selectedCountForLens = Object.values(mp.matrixMap || {}).filter(
                            (c) => selectedGridRows[c.id]
                          ).length;

                          return (
                            <div
                              key={mp.productId}
                              className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-line">
                                <div>
                                  <h4 className="text-sm font-black text-ink flex items-center gap-2">
                                    <span>👓 {mp.productName}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[10px] font-black">
                                      {mp.outOfStockCellsCount} مقاس نافذ (0)
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black">
                                      {mp.criticalCellsCount} مقاس حرج (1)
                                    </span>
                                    {selectedCountForLens > 0 && (
                                      <span className="px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black">
                                        تم تحديد {selectedCountForLens} مقاس للتوريد
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-[11px] text-ink-soft mt-0.5">
                                    المورد المرتبط: <strong>{mp.supplier?.name || 'غير محدد'}</strong> | تكلفة الزوج:{' '}
                                    <strong>{mp.costPrice} {currency}</strong> — اضغط على أي خانة في الجدول لتحديدها وتعديل الكمية المطلوبة
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedGridRows((prev) => {
                                        const next = { ...prev };
                                        productCellIds.forEach((cid) => {
                                          next[cid] = true;
                                        });
                                        return next;
                                      });
                                      if (mp.supplier?._id && !bulkSupplierId) {
                                        setBulkSupplierId(String(mp.supplier._id));
                                        setSupplierValidationError(false);
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-purple-600/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-black hover:bg-purple-600/20 transition-all"
                                  >
                                    ✅ تحديد كل النواقص لهذه العدسة ({productCellIds.length} مقاس)
                                  </button>
                                  {selectedCountForLens > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedGridRows((prev) => {
                                          const next = { ...prev };
                                          Object.values(mp.matrixMap || {}).forEach((c) => {
                                            delete next[c.id];
                                          });
                                          return next;
                                        });
                                      }}
                                      className="px-2.5 py-1.5 rounded-xl bg-paper border border-line text-ink-soft hover:text-red-500 text-xs font-bold transition-all"
                                    >
                                      إلغاء تحديد هذه العدسة
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Legend */}
                              <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500 inline-block" />
                                  <span>أحمر = رصيد نافد (0 بالدرج)</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500 inline-block" />
                                  <span>برتقالي = رصيد حرج (1 بالدرج)</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/40 inline-block" />
                                  <span>أخضر = رصيد آمن ومتوفر</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded bg-purple-600 inline-block" />
                                  <span>بنفسجي = محدّد ضمن أمر التوريد القادم</span>
                                </span>
                              </div>

                              {/* Real 2D Matrix Grid Table: SPH (rows) × CYL (columns) */}
                              <div
                                className="overflow-x-auto rounded-xl border border-line"
                                onMouseLeave={() => setHoveredProcCell(null)}
                              >
                                <table className="w-full border-collapse text-center font-mono text-[11px]">
                                  <thead>
                                    <tr className="bg-paper border-b border-line text-ink">
                                      <th className="p-2 border-l border-line bg-purple-500/10 text-purple-800 dark:text-purple-200 font-black sticky right-0 z-10 min-w-[90px]">
                                        SPH \ CYL
                                      </th>
                                      {(mp.cylAxis || []).map((cylVal) => {
                                        const isActiveCol =
                                          hoveredProcCell?.productId === mp.productId &&
                                          hoveredProcCell?.cyl === cylVal;
                                        return (
                                          <th
                                            key={cylVal}
                                            className={`p-2 border-l border-line font-black min-w-[82px] transition-colors ${
                                              isActiveCol
                                                ? 'bg-purple-600 text-white'
                                                : ''
                                            }`}
                                            dir="ltr"
                                          >
                                            CYL {cylVal}
                                          </th>
                                        );
                                      })}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-line">
                                    {(mp.sphAxis || []).map((sphVal) => {
                                      const isActiveRow =
                                        hoveredProcCell?.productId === mp.productId &&
                                        hoveredProcCell?.sph === sphVal;
                                      return (
                                        <tr
                                          key={sphVal}
                                          className={isActiveRow ? 'bg-purple-500/10' : 'hover:bg-paper/40'}
                                        >
                                          <td
                                            className={`p-2 border-l border-line font-black sticky right-0 z-10 transition-colors ${
                                              isActiveRow
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-paper text-ink'
                                            }`}
                                            dir="ltr"
                                          >
                                            SPH {sphVal}
                                          </td>
                                          {(mp.cylAxis || []).map((cylVal) => {
                                            const cellKey = `${sphVal}_${cylVal}`;
                                            const cell = mp.matrixMap?.[cellKey];
                                            if (!cell) {
                                              return (
                                                <td key={cylVal} className="p-2 border-l border-line text-ink-soft/30">
                                                  —
                                                </td>
                                              );
                                            }
                                            const isSelected = Boolean(selectedGridRows[cell.id]);
                                            const isExactHovered =
                                              hoveredProcCell?.productId === mp.productId &&
                                              hoveredProcCell?.sph === sphVal &&
                                              hoveredProcCell?.cyl === cylVal;
                                            const cellBg = isSelected
                                              ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                              : cell.isOutOfStock
                                              ? 'bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-500/25'
                                              : cell.isCritical
                                              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25'
                                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20';

                                            return (
                                              <td
                                                key={cylVal}
                                                onMouseEnter={() =>
                                                  setHoveredProcCell({
                                                    productId: mp.productId,
                                                    sph: sphVal,
                                                    cyl: cylVal
                                                  })
                                                }
                                                onClick={() => {
                                                  setSelectedGridRows((prev) => ({
                                                    ...prev,
                                                    [cell.id]: !prev[cell.id]
                                                  }));
                                                  if (mp.supplier?._id && !bulkSupplierId) {
                                                    setBulkSupplierId(String(mp.supplier._id));
                                                    setSupplierValidationError(false);
                                                  }
                                                }}
                                                className={`relative p-1.5 border-l border-line cursor-pointer transition-all select-none ${cellBg} ${
                                                  isExactHovered ? 'ring-2 ring-purple-600 z-10' : ''
                                                }`}
                                                title={`SPH ${sphVal} / CYL ${cylVal} — الرصيد الحالي بالدرج: ${cell.currentStock}`}
                                              >
                                                {isExactHovered && (
                                                  <div
                                                    dir="ltr"
                                                    className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-lg bg-slate-900/95 px-2 py-0.5 text-[10px] font-black text-white shadow-lg border border-purple-400/50"
                                                  >
                                                    <span className="text-amber-300">SPH: {sphVal}</span>
                                                    <span className="mx-1 text-slate-400">|</span>
                                                    <span className="text-cyan-300">CYL: {cylVal}</span>
                                                  </div>
                                                )}
                                              <div className="flex flex-col items-center justify-center gap-0.5">
                                                <span className="font-black text-xs">
                                                  {cell.currentStock} {cell.isOutOfStock ? '⚠️' : ''}
                                                </span>
                                                {isSelected ? (
                                                  <div
                                                    className="flex items-center gap-0.5 mt-0.5"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <span className="text-[9px] font-bold">طلب:</span>
                                                    <input
                                                      type="number"
                                                      min="1"
                                                      value={gridQuantities[cell.id] ?? cell.suggestedQuantity ?? 4}
                                                      onChange={(e) => {
                                                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                                        setGridQuantities((prev) => ({ ...prev, [cell.id]: val }));
                                                      }}
                                                      className="w-11 px-1 py-0.5 rounded bg-white text-purple-900 font-black text-center text-[10px] outline-none"
                                                    />
                                                  </div>
                                                ) : (cell.isOutOfStock || cell.isCritical) ? (
                                                  <span className="text-[9px] opacity-80">
                                                    {cell.isOutOfStock ? 'نافد (اضغط للطلب)' : 'حرج (اضغط للطلب)'}
                                                  </span>
                                                ) : (
                                                  <span className="text-[9px] opacity-60">متوفر</span>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        })}
                                      </tr>
                                  );
                                })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    /* Flat Table View (الجدول المسطح التقليدي) */
                    <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                            <tr>
                              <th className="p-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={
                                    gridCriticalItems.length > 0 &&
                                    gridCriticalItems.every((i) => selectedGridRows[i.id])
                                  }
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const updated = { ...selectedGridRows };
                                    gridCriticalItems.forEach((i) => {
                                      updated[i.id] = checked;
                                    });
                                    setSelectedGridRows(updated);
                                  }}
                                  className="w-4 h-4 rounded text-purple-600"
                                />
                              </th>
                              <th className="p-3">المنتج / العدسة</th>
                              <th className="p-3">القسم والتصنيف</th>
                              <th className="p-3">المقاس وشبكة الجريد</th>
                              <th className="p-3 text-center">الرصيد الحالي</th>
                              <th className="p-3 text-center">الكمية المطلوبة للتوريد</th>
                              <th className="p-3">المورد المقترح</th>
                              <th className="p-3 text-center">إجراء التوريد</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {gridCriticalItems.map((it) => (
                              <tr key={it.id} className="hover:bg-paper/50 transition-colors">
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedGridRows[it.id])}
                                    onChange={(e) =>
                                      setSelectedGridRows((prev) => ({
                                        ...prev,
                                        [it.id]: e.target.checked
                                      }))
                                    }
                                    className="w-4 h-4 rounded text-purple-600"
                                  />
                                </td>
                                <td className="p-3 font-black text-ink">{it.productName}</td>
                                <td className="p-3 text-ink-soft text-[11px]">{it.categoryName}</td>
                                <td className="p-3 font-mono">
                                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-black border border-purple-500/20">
                                    {it.specs?.axisXName || 'SPH'}: {it.specs?.sph || '0.00'} |{' '}
                                    {it.specs?.axisYName || 'CYL'}: {it.specs?.cyl || '0.00'}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-mono font-black text-[11px] ${
                                      it.isOutOfStock
                                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                    }`}
                                  >
                                    {it.currentStock} {it.isOutOfStock ? '(نافذ)' : '(حرج)'}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={gridQuantities[it.id] ?? 4}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                      setGridQuantities((prev) => ({ ...prev, [it.id]: val }));
                                    }}
                                    className="w-16 px-2 py-1 rounded-lg bg-paper border border-line text-xs font-mono font-black text-center text-ink outline-none"
                                  />
                                </td>
                                <td className="p-3 text-[11px] text-ink-soft">
                                  {it.supplier?.name || 'غير محدد (اختر المورد)'}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedGridItemForSupply({
                                        productId: it.productId,
                                        name: `${it.productName} (${it.specs?.axisXName || 'SPH'}: ${
                                          it.specs?.sph || ''
                                        } | ${it.specs?.axisYName || 'CYL'}: ${it.specs?.cyl || ''})`,
                                        quantity: Number(gridQuantities[it.id] || 4),
                                        costPrice: it.costPrice || 0,
                                        supplierId: it.supplier?._id || it.supplier,
                                        lensSpecs: it.specs,
                                        currentStock: it.currentStock
                                      });
                                    }}
                                    className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[10px] font-black border border-amber-500/25 flex items-center gap-1 mx-auto transition-all"
                                  >
                                    <BellRing className="w-3 h-3 text-amber-600" />
                                    <span>طلب توريد</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Fast-Selling & Procurement Forecast Tab */}
      {activeTab === 'fast_selling' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0 border border-orange-500/25">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink flex items-center gap-2">
                    <span>تحليلات المنتجات الأكثر مبيعاً وتوقعات إعادة التوريد</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] font-black">
                      AI & Velocity Forecast
                    </span>
                  </h3>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed max-w-3xl">
                    فحص وتحليل سجلات النشاط (Activity Logs) والطلبات المكتملة لرصد أسرع المنتجات بيعاً، وحساب معدل الدوران اليومي وتاريخ نفاد المخزون، مع اقتراح كميات إعادة الشراء وتوفير تواصل مباشر مع الموردين قبل نفاد البضائع.
                  </p>
                </div>
              </div>

              {/* Timeframe Selector */}
              <div className="flex items-center gap-1.5 p-1 rounded-btn bg-paper border border-line">
                <span className="text-[11px] font-bold text-ink-soft px-2">الفترة:</span>
                {[
                  { days: 14, label: '14 يوماً' },
                  { days: 30, label: '30 يوماً (شهر)' },
                  { days: 60, label: '60 يوماً' },
                  { days: 90, label: '90 يوماً' }
                ].map((tf) => (
                  <button
                    key={tf.days}
                    type="button"
                    onClick={() => setForecastDays(tf.days)}
                    className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-all ${
                      forecastDays === tf.days
                        ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
                <span className="text-[11px] font-bold text-ink-soft">المنتجات الأكثر مبيعاً</span>
                <div className="text-xl font-black text-ink flex items-baseline gap-1.5">
                  <span>{forecastData?.topFastSelling?.length || 0}</span>
                  <span className="text-xs font-bold text-ink-soft">منتج مرصود</span>
                </div>
                <span className="text-[10px] text-ink-soft block">مرتبة تنازلياً حسب سرعة وحجم البيع</span>
              </div>

              <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
                <span className="text-[11px] font-bold text-ink-soft">حالات خطر نفاذ المخزون</span>
                <div className="text-xl font-black text-red-500 flex items-baseline gap-1.5">
                  <span>{forecastData?.urgentCount || 0}</span>
                  <span className="text-xs font-bold text-red-500/80">منتجات حرجة</span>
                </div>
                <span className="text-[10px] text-red-500 font-bold block">مخزون يكفي لأقل من 7 أيام</span>
              </div>

              <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
                <span className="text-[11px] font-bold text-ink-soft">إجمالي القطع المباعة للأعلى</span>
                <div className="text-xl font-black text-emerald-600 flex items-baseline gap-1.5">
                  <span>{(forecastData?.summary?.totalUnitsSold || 0).toLocaleString()}</span>
                  <span className="text-xs font-bold text-ink-soft">قطعة مباعة</span>
                </div>
                <span className="text-[10px] text-ink-soft block">خلال آخر {forecastData?.timeframeDays || forecastDays} يوماً</span>
              </div>

              <div className="p-3.5 rounded-card bg-paper border border-line space-y-1">
                <span className="text-[11px] font-bold text-ink-soft">التنبيه والطلب الاستباقي</span>
                <div className="text-xl font-black text-orange-600 flex items-baseline gap-1.5">
                  <span>{(forecastData?.summary?.totalSuggestedReorder || 0).toLocaleString()}</span>
                  <span className="text-xs font-bold text-ink-soft">قطعة مقترحة</span>
                </div>
                <span className="text-[10px] text-ink-soft block">حجم التوريد التقديري لتغطية شهر</span>
              </div>
            </div>
          </div>

          {/* Forecast Products Cards Grid */}
          {isForecastLoading ? (
            <div className="p-12 text-center bg-surface rounded-card border border-line text-ink-soft space-y-3">
              <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
              <p className="font-black text-ink text-xs">جاري فحص سجلات النشاط واحتساب معدل المبيعات...</p>
            </div>
          ) : !forecastData?.topFastSelling || forecastData.topFastSelling.length === 0 ? (
            <div className="p-12 text-center bg-surface rounded-card border border-line text-ink-soft space-y-3">
              <ShoppingBag className="w-10 h-10 text-ink-soft/40 mx-auto" />
              <p className="font-black text-ink text-sm">لم يتم تسجيل مبيعات للمنتجات خلال الفترة المحددة</p>
              <p className="text-xs max-w-md mx-auto text-ink-soft">
                بمجرد إتمام طلبات جديدة في المتجر ستظهر هنا تحليلات سرعة البيع ومقترحات التوريد تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black text-ink flex items-center gap-2">
                  <span>قائمة أعلى 10 منتجات مبيعاً وتوقعات التوريد والموردين:</span>
                </h4>
                <span className="text-[11px] text-ink-soft">
                  المصدر: الطلبات المكتملة + سجل النشاط (Store Activities)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {forecastData.topFastSelling.map((item, index) => {
                  const sup = item.supplier;
                  const rankBadges = [
                    { label: 'المركز الأول #1', cls: 'bg-orange-500 text-white shadow-orange-500/20 shadow-md' },
                    { label: 'المركز الثاني #2', cls: 'bg-slate-400 text-white shadow-slate-400/20 shadow-md' },
                    { label: 'المركز الثالث #3', cls: 'bg-orange-700 text-white shadow-orange-700/20 shadow-md' }
                  ];

                  const urgencyBadges = {
                    stockout: { label: 'نفد المخزون بالكامل (0 قطعة)', cls: 'bg-red-500 text-white' },
                    critical: { label: `نفاذ وشيك: متبقي ${item.daysUntilStockout} يوم فقط!`, cls: 'bg-red-500/15 text-red-600 border border-red-500/30' },
                    warning: { label: `تحذير: متبقي ${item.daysUntilStockout} يوم`, cls: 'bg-orange-500/15 text-orange-600 border border-orange-500/30' },
                    moderate: { label: `مستقر: يكفي لـ ${item.daysUntilStockout} يوم`, cls: 'bg-blue-500/10 text-blue-600 border border-blue-500/20' },
                    safe: { label: `مخزون وفير: يكفي +${item.daysUntilStockout > 365 ? 'سنة' : item.daysUntilStockout + ' يوم'}`, cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' }
                  };

                  const currentUrgency = urgencyBadges[item.urgencyLevel] || urgencyBadges.safe;

                  return (
                    <div
                      key={item._id}
                      className="p-5 rounded-card bg-surface border border-line hover:border-orange-500/40 shadow-sm transition-all space-y-4"
                    >
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        {/* Product Header & Image */}
                        <div className="flex items-start gap-4">
                          <div className="relative shrink-0">
                            {item.mainImage ? (
                              <img
                                src={item.mainImage}
                                alt={item.name}
                                className="w-16 h-16 rounded-xl object-cover border border-line"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-paper border border-line flex items-center justify-center text-ink-soft">
                                <Package className="w-8 h-8 opacity-40" />
                              </div>
                            )}
                            <div className="absolute -top-2 -right-2">
                              {index < 3 ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${rankBadges[index].cls}`}>
                                  #{index + 1}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-paper border border-line text-ink">
                                  #{index + 1}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="text-sm font-black text-ink">{item.name}</h5>
                              {item.category?.name && (
                                <span className="px-2 py-0.5 rounded-full bg-paper border border-line text-[10px] font-bold text-ink-soft">
                                  {item.category.name}
                                </span>
                              )}
                              {item.sku && (
                                <span className="text-[11px] font-mono font-bold text-ink-soft">
                                  كود: {item.sku}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${currentUrgency.cls}`}>
                                {currentUrgency.label}
                              </span>
                              {item.price > 0 && (
                                <span className="text-xs font-bold text-ink-soft">
                                  سعر البيع: <strong className="text-ink">{item.price} {currency}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Supplier Box & Action Buttons */}
                        <div className="w-full lg:w-auto p-3 rounded-xl bg-paper border border-line space-y-2 shrink-0">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold text-ink-soft flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                              <span>المورد المعتمد:</span>
                            </span>
                            {sup ? (
                              <span className="font-black text-ink">{sup.name}</span>
                            ) : (
                              <span className="text-orange-600 font-bold text-[11px]">غير محدد</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {sup && (sup.whatsappPhone || sup.phone) && (
                              <button
                                type="button"
                                onClick={() => handleWhatsAppSupplierForProduct(item)}
                                className="px-3 py-1.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-sm transition-all"
                                title="مراسلة المورد عبر واتساب بطلب التوريد"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>طلب واتساب</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartShipmentForProduct(item)}
                              className="px-3 py-1.5 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] text-[11px] font-black flex items-center gap-1.5 shadow-sm transition-all"
                              title="تسجيل شحنة توريد جديدة لهذا المنتج"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>تسجيل شحنة توريد</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 4 Analytics Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-line/60">
                        <div className="p-2.5 rounded-xl bg-paper/60 border border-line/60 space-y-0.5">
                          <span className="text-[10px] font-bold text-ink-soft block">
                            المبيعات ({forecastData?.timeframeDays || 30} يوماً)
                          </span>
                          <span className="text-sm font-black text-ink">
                            {item.unitsSold} قطعة
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-paper/60 border border-line/60 space-y-0.5">
                          <span className="text-[10px] font-bold text-ink-soft block">
                            معدل البيع اليومي (Velocity)
                          </span>
                          <span className="text-sm font-black text-orange-600 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>{item.dailyVelocity} قطعة / يوم</span>
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-paper/60 border border-line/60 space-y-0.5">
                          <span className="text-[10px] font-bold text-ink-soft block">
                            المخزون الحالي المتبقي
                          </span>
                          <span className={`text-sm font-black ${item.currentStock <= 0 ? 'text-red-500' : 'text-ink'}`}>
                            {item.currentStock} قطعة
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-paper/60 border border-line/60 space-y-0.5">
                          <span className="text-[10px] font-bold text-ink-soft block">
                            حجم التوريد المقترح (Reorder Qty)
                          </span>
                          <span className="text-sm font-black text-emerald-600 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" />
                            <span>+{item.suggestedReorderQuantity} قطعة</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create / Edit Shipment */}
      {isShipmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h4 className="text-sm font-black text-ink">
                {editingShipment ? 'تعديل شحنة المورد' : 'تسجيل شحنة مورد والتزام شراء جديد'}
              </h4>
              <button onClick={() => setIsShipmentModalOpen(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShipment} className="space-y-3.5 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">رقم مرجع الشحنة (اختياري — يُولّد تلقائياً)</label>
                  <input
                    type="text"
                    value={shipmentForm.referenceId}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, referenceId: e.target.value })}
                    placeholder="تلقائي: SHP-YYYYMMDD-XXXX"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">تاريخ الشحنة *</label>
                  <input
                    type="date"
                    required
                    value={shipmentForm.shipmentDate}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, shipmentDate: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>

              {/* Mandatory Supplier Selection from Registered Suppliers */}
              <div className="p-3.5 rounded-card bg-paper border border-line space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-ink font-black flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>المورد المعتمد للشحنة *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSupplier(null);
                      setIsSupplierModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-btn bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 border border-emerald-600/30 text-[11px] font-black flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ إضافة مورد جديد فوراً</span>
                  </button>
                </div>

                {suppliers.length === 0 ? (
                  <div className="p-3 rounded-btn bg-orange-500/10 border border-orange-500/20 text-orange-600 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>لا يوجد موردون مسجلون في المنظومة حتى الآن. يجب إضافة مورد أولاً لتسجيل الشحنة.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSupplier(null);
                        setIsSupplierModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-btn bg-orange-600 text-white font-bold shrink-0 hover:bg-orange-700"
                    >
                      إضافة مورد الآن
                    </button>
                  </div>
                ) : (
                  <div>
                    <select
                      required
                      value={shipmentForm.supplierId}
                      onChange={(e) => {
                        const supId = e.target.value;
                        const sup = suppliers.find((s) => s._id === supId);
                        if (sup) {
                          setShipmentForm({
                            ...shipmentForm,
                            supplierId: sup._id,
                            supplierName: sup.name,
                            supplierPhone: sup.phone || sup.whatsappPhone || '',
                            supplierEmail: sup.email || '',
                            supplierAddress: sup.address || ''
                          });
                        } else {
                          setShipmentForm({
                            ...shipmentForm,
                            supplierId: '',
                            supplierName: '',
                            supplierPhone: '',
                            supplierEmail: '',
                            supplierAddress: ''
                          });
                        }
                      }}
                      className="w-full bg-surface border border-line rounded-btn p-2.5 text-ink font-bold text-xs"
                    >
                      <option value="">-- اضغط لاختيار المورد من قائمة الموردين المعتمدين * --</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} {s.specialty ? `(${s.specialty})` : ''} — {s.phone || s.whatsappPhone || 'بدون هاتف'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Display selected supplier details card */}
                {selectedShipmentSupplier && (
                  <div className="p-3 rounded-btn bg-surface border border-primary/20 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-ink text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>{selectedShipmentSupplier.name}</span>
                        {selectedShipmentSupplier.specialty && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {selectedShipmentSupplier.specialty}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">مورد معتمد ✓</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft pt-1 border-t border-line">
                      {(selectedShipmentSupplier.phone || selectedShipmentSupplier.whatsappPhone) && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-ink-soft" />
                          <span>{selectedShipmentSupplier.phone || selectedShipmentSupplier.whatsappPhone}</span>
                        </span>
                      )}
                      {selectedShipmentSupplier.whatsappPhone && (
                        <span className="flex items-center gap-1 text-emerald-600 font-mono font-bold">
                          <MessageCircle className="w-3 h-3" />
                          <span>واتساب: {selectedShipmentSupplier.whatsappPhone}</span>
                        </span>
                      )}
                      {selectedShipmentSupplier.email && (
                        <span className="flex items-center gap-1 font-mono">
                          <Mail className="w-3 h-3 text-ink-soft" />
                          <span>{selectedShipmentSupplier.email}</span>
                        </span>
                      )}
                      {selectedShipmentSupplier.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-ink-soft" />
                          <span>{selectedShipmentSupplier.address}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">قيمة البضاعة / الالتزام *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={shipmentForm.expectedGoodsValue}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, expectedGoodsValue: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">تاريخ استحقاق السداد</label>
                  <input
                    type="date"
                    value={shipmentForm.dueDate}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, dueDate: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">حالة الشحنة</label>
                  <select
                    value={shipmentForm.status}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, status: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  >
                    {Object.entries(SHIPMENT_STATUS_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">ملاحظات الشحنة</label>
                <textarea
                  rows={2}
                  value={shipmentForm.notes}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, notes: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsShipmentModalOpen(false)}
                  className="px-4 py-2 rounded-btn bg-paper border border-line text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black"
                >
                  حفظ الشحنة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipment Details Drawer/Modal */}
      {activeShipmentDetails && (
        <ShipmentDetailsModal
          activeShipmentDetails={activeShipmentDetails}
          onClose={() => setActiveShipmentDetails(null)}
          catalogProducts={catalogProducts}
          currency={currency}
          authHeader={authHeader}
          showToast={showToast}
          onRefreshDetails={openShipmentDetails}
          onRefreshParent={onRefresh}
        />
      )}
      {/* Reusable Supplier Modal (Add / Edit) */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        authHeader={authHeader}
        showToast={showToast}
        onSuccess={(savedSup) => {
          onRefresh?.();
          if (savedSup?._id && isShipmentModalOpen) {
            setShipmentForm((prev) => ({
              ...prev,
              supplierId: savedSup._id,
              supplierName: savedSup.name,
              supplierPhone: savedSup.phone || savedSup.whatsappPhone || '',
              supplierEmail: savedSup.email || '',
              supplierAddress: savedSup.address || ''
            }));
          }
        }}
      />

      {/* Delete Supplier Confirmation Modal */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-card border border-red-500/30 p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 text-xs font-bold">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-ink">تأكيد حذف المورد</h4>
                <p className="text-[11px] text-red-500">تحذير أمني وقانوني للبيانات المالية</p>
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              هل أنت متأكد من رغبتك في حذف المورد{' '}
              <strong className="text-ink underline">«{supplierToDelete.name}»</strong>؟
              <br />
              لن يمكن إتمام الحذف إذا كان المورد مرتبطاً بأي شحنات توريد سابقة أو منتجات في المتجر،
              وذلك لضمان دقة التقارير المحاسبية والمخزنية.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                disabled={isDeletingSupplier}
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 rounded-btn bg-paper border border-line text-ink hover:bg-surface"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                disabled={isDeletingSupplier}
                onClick={handleDeleteSupplier}
                className="px-5 py-2 rounded-btn bg-red-600 hover:bg-red-700 text-white font-black flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingSupplier ? 'جاري التحقق والحذف...' : 'تأكيد الحذف نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Critical Stock Supply Request Modal */}
      {selectedGridItemForSupply && (
        <SupplyRequestModal
          isOpen={true}
          item={selectedGridItemForSupply}
          onClose={() => setSelectedGridItemForSupply(null)}
          onSuccess={() => {
            showToast('تم تسجيل أمر التوريد بنجاح وإدراجه في السجل المركزي');
            setSelectedGridItemForSupply(null);
            loadGridCritical();
            loadReorders();
          }}
        />
      )}
    </div>
  );
}
