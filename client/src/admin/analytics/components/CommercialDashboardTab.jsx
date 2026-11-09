import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  Layers,
  Building2,
  PackageCheck,
  Send,
  MessageCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  Square,
  FileText,
  Clock,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import SupplierReorderModal from '../../../shared/components/SupplierReorderModal';

export default function CommercialDashboardTab({
  commercialData,
  onSelectProduct,
  currency = 'ج.م'
}) {
  const { token, showToast } = useStore();
  const effectiveToken =
    token || (typeof window !== 'undefined' ? localStorage.getItem('store_token') : '') || '';
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${effectiveToken}` } }),
    [effectiveToken]
  );

  // Critical products state
  const [criticalProducts, setCriticalProducts] = useState([]);
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [criticalCounts, setCriticalCounts] = useState({
    all: 0,
    outOfStock: 0,
    critical: 0,
    withSupplier: 0,
    withoutSupplier: 0
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'out_of_stock' | 'critical'
  const [hasSupplier, setHasSupplier] = useState('all'); // 'all' | 'with_supplier' | 'without_supplier'

  // Selection & Modal state
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  // Reorder history state
  const [reordersHistory, setReordersHistory] = useState([]);
  const [reordersLoading, setReordersLoading] = useState(false);

  const loadCriticalProducts = useCallback(async () => {
    if (!effectiveToken) return;
    setCriticalLoading(true);
    try {
      const res = await axios.get(
        `/api/admin/analytics/critical-products?page=${page}&limit=${limit}&statusFilter=${statusFilter}&hasSupplier=${hasSupplier}`,
        authHeader
      );
      setCriticalProducts(res.data?.products || []);
      setTotalPages(res.data?.pagination?.pages || 1);
      setTotalItems(res.data?.pagination?.total || 0);
      setCriticalCounts(
        res.data?.counts || {
          all: 0,
          outOfStock: 0,
          critical: 0,
          withSupplier: 0,
          withoutSupplier: 0
        }
      );
    } catch (err) {
      console.warn('Could not load critical products:', err.message);
    } finally {
      setCriticalLoading(false);
    }
  }, [effectiveToken, page, limit, statusFilter, hasSupplier, authHeader]);

  const loadReordersHistory = useCallback(async () => {
    if (!effectiveToken) return;
    setReordersLoading(true);
    try {
      const res = await axios.get('/api/admin/analytics/reorders', authHeader);
      setReordersHistory(res.data?.reorders || []);
    } catch (err) {
      console.warn('Could not load procurement reorders:', err.message);
    } finally {
      setReordersLoading(false);
    }
  }, [effectiveToken, authHeader]);

  useEffect(() => {
    loadCriticalProducts();
  }, [loadCriticalProducts]);

  useEffect(() => {
    loadReordersHistory();
  }, [loadReordersHistory]);

  const handleToggleSelectProduct = (id) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = criticalProducts.map((p) => p._id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const isAllPageSelected =
    criticalProducts.length > 0 &&
    criticalProducts.every((p) => selectedProductIds.includes(p._id));

  const handleOpenReorderModal = (singleId = null) => {
    if (singleId) {
      setSelectedProductIds([singleId]);
    }
    setIsReorderModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 1. Top KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-1 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold">إجمالي الإيرادات (الكلية)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-ink">
            {commercialData?.stats?.totalRevenue?.toLocaleString() || 0}{' '}
            <span className="text-xs font-bold text-ink-soft">{currency}</span>
          </p>
          <span className="text-[11px] font-bold text-emerald-500">من الطلبات غير الملغاة</span>
        </div>

        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-1 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold">صافي الأرباح التجارية</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">
            {commercialData?.stats?.netProfit?.toLocaleString() || 0}{' '}
            <span className="text-xs font-bold text-ink-soft">{currency}</span>
          </p>
          <span className="text-[11px] font-bold text-primary">حساب سعر البيع - التكلفة</span>
        </div>

        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-1 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold">إجمالي الطلبات الكلي</span>
            <ShoppingBag className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-ink">{commercialData?.stats?.totalOrders || 0}</p>
          <span className="text-[11px] font-bold text-purple-500">
            متوسط الطلب: {commercialData?.stats?.averageOrderValue || 0} {currency}
          </span>
        </div>

        <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-1 text-ink">
          <div className="flex items-center justify-between text-ink-soft">
            <span className="text-xs font-bold">تنبيهات المخزون الحرج</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-500">
            {criticalCounts.all || commercialData?.stats?.lowStockCount || 0}
          </p>
          <span className="text-[11px] font-bold text-red-500">
            {criticalCounts.outOfStock} نفدت • {criticalCounts.critical} قاربت على النفاد
          </span>
        </div>
      </div>

      {/* 2. Critical & Out of Stock Manager with Reorder Queue */}
      <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-5 text-ink">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-ink flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>إدارة المنتجات الحرجة وإعادة التوريد للموردين</span>
            </h3>
            <p className="text-xs text-ink-soft mt-1">
              عرض المنتجات النافذة أو القاربة على النفاد وتصفحها (Top 5 / Top 10 والصفحات التالية) وإرسال طلبات توريد مجمعة بالواتساب
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadCriticalProducts();
                loadReordersHistory();
              }}
              className="p-2 rounded-btn bg-paper border border-line text-ink-soft hover:text-ink hover:bg-surface text-xs font-bold flex items-center gap-1"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${criticalLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            <button
              type="button"
              disabled={selectedProductIds.length === 0}
              onClick={() => handleOpenReorderModal()}
              className="px-4 py-2 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>طلب توريد للأصناف المحددة ({selectedProductIds.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-card bg-paper border border-line text-xs font-bold">
          {/* Status Sub-filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-soft ml-1">حالة المخزون:</span>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-btn text-[11px] font-black transition-all ${
                statusFilter === 'all'
                  ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)]'
                  : 'bg-surface text-ink hover:bg-paper'
              }`}
            >
              الكل ({criticalCounts.all})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('out_of_stock');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-btn text-[11px] font-black transition-all ${
                statusFilter === 'out_of_stock'
                  ? 'bg-red-600 text-white'
                  : 'bg-surface text-red-600 hover:bg-red-500/10'
              }`}
            >
              نفد تماماً ({criticalCounts.outOfStock})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('critical');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-btn text-[11px] font-black transition-all ${
                statusFilter === 'critical'
                  ? 'bg-orange-600 text-white'
                  : 'bg-surface text-orange-600 hover:bg-orange-500/10'
              }`}
            >
              مخزون حرج ({criticalCounts.critical})
            </button>
          </div>

          {/* Supplier Link Sub-filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-soft ml-1">ربط المورد:</span>
            <button
              type="button"
              onClick={() => {
                setHasSupplier('all');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-btn text-[11px] font-bold ${
                hasSupplier === 'all' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-ink-soft'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => {
                setHasSupplier('with_supplier');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-btn text-[11px] font-bold ${
                hasSupplier === 'with_supplier' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-ink-soft'
              }`}
            >
              مرتبط بمورد ({criticalCounts.withSupplier})
            </button>
            <button
              type="button"
              onClick={() => {
                setHasSupplier('without_supplier');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-btn text-[11px] font-bold ${
                hasSupplier === 'without_supplier' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-ink-soft'
              }`}
            >
              بدون مورد ({criticalCounts.withoutSupplier})
            </button>
          </div>

          {/* Page Limit Selector */}
          <div className="flex items-center gap-1.5 text-ink-soft">
            <span>العرض:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-surface border border-line rounded p-1 text-xs font-bold text-ink"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>20 صنف</option>
            </select>
          </div>
        </div>

        {/* Products Table */}
        {criticalProducts.length === 0 ? (
          <div className="p-8 text-center bg-paper rounded-card border border-line text-xs text-ink-soft space-y-2">
            <PackageCheck className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-black text-ink">مستوى المخزون آمن ومستقر</p>
            <p>لا توجد منتجات تطابق معايير المخزون الحرج أو النفاذ في الوقت الراهن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllOnPage}
                      className="p-1 hover:text-primary transition-all"
                      title={isAllPageSelected ? 'إلغاء تحديد الصفحة' : 'تحديد كل الصفحة'}
                    >
                      {isAllPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-ink-soft" />
                      )}
                    </button>
                  </th>
                  <th className="p-3">المنتج</th>
                  <th className="p-3">المخزون الحالي</th>
                  <th className="p-3">حد التنبيه</th>
                  <th className="p-3">طلب مقترح</th>
                  <th className="p-3">المورد المسؤول</th>
                  <th className="p-3 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {criticalProducts.map((prod) => {
                  const isChecked = selectedProductIds.includes(prod._id);
                  const isOutOfStock = prod.stockCount === 0;
                  return (
                    <tr
                      key={prod._id}
                      className={`hover:bg-paper/60 transition-all ${isChecked ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectProduct(prod._id)}
                          className="p-1"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-ink-soft" />
                          )}
                        </button>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.image || 'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'}
                            alt=""
                            className="w-10 h-10 rounded-btn object-cover bg-paper border border-line shrink-0"
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onSelectProduct?.(prod._id)}
                              className="font-black text-ink hover:text-primary block truncate max-w-[220px] text-right"
                            >
                              {prod.name}
                            </button>
                            <span className="text-[11px] text-ink-soft">{prod.category}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                            isOutOfStock
                              ? 'bg-red-500/10 text-red-600 border-red-500/25'
                              : 'bg-orange-500/10 text-orange-600 border-orange-500/25'
                          }`}
                        >
                          {isOutOfStock ? 'نفد تماماً (0)' : `متبقي ${prod.stockCount} قطع`}
                        </span>
                      </td>

                      <td className="p-3 font-mono font-bold text-ink-soft">
                        {prod.criticalStockThreshold ?? 3}
                      </td>

                      <td className="p-3 font-mono font-black text-primary">
                        +{prod.reorderQuantity ?? 10}
                      </td>

                      <td className="p-3">
                        {prod.supplier ? (
                          <div className="space-y-0.5">
                            <span className="font-black text-ink block">{prod.supplier.name}</span>
                            <span className="text-[10px] text-ink-soft block font-mono">
                              {prod.supplier.phone || prod.supplier.whatsappPhone || ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-soft text-[11px] italic">غير مرتبط بمورد</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenReorderModal(prod._id)}
                          className="px-3 py-1.5 rounded-btn bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-black inline-flex items-center gap-1.5 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>طلب توريد</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs font-bold text-ink-soft">
            <span>
              عرض الصفحة <strong className="text-ink">{page}</strong> من{' '}
              <strong className="text-ink">{totalPages}</strong> (إجمالي {totalItems} صنف حرج)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-btn bg-paper border border-line text-ink disabled:opacity-40 hover:bg-surface flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-btn bg-paper border border-line text-ink disabled:opacity-40 hover:bg-surface flex items-center gap-1"
              >
                <span>التالي</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Sales by Category & Reorders History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales by Category */}
        <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-4 text-ink">
          <h3 className="text-base font-black text-ink flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>توزيع المبيعات حسب الأقسام</span>
          </h3>

          <div className="space-y-3">
            {(commercialData?.salesByCategory || []).length > 0 ? (
              commercialData.salesByCategory.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-ink">
                    <span>{cat.name}</span>
                    <span className="font-black text-ink">
                      {cat.total?.toLocaleString()} {currency}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-paper border border-line rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (cat.total / (commercialData?.stats?.totalRevenue || 1)) * 100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد مبيعات مسجلة حتى الآن</p>
            )}
          </div>
        </div>

        {/* Procurement Reorders History Log */}
        <div className="p-6 rounded-card bg-surface border border-line shadow-sm space-y-4 text-ink">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-ink flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>أرشيف طلبات التوريد المرسلة للموردين</span>
            </h3>
            <span className="text-xs text-ink-soft">
              {reordersHistory.length} طلبات مسجلة
            </span>
          </div>

          {reordersHistory.length === 0 ? (
            <p className="text-xs text-ink-soft py-8 text-center">
              لم يتم إرسال طلبات توريد حتى الآن. عند إرسال طلب عبر الواتساب سيظهر في هذا السجل فوراً.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {reordersHistory.map((reo) => {
                const whatsappNumber = (reo.supplierWhatsapp || reo.supplierPhone || '').replace(/\D/g, '');
                const cleanPhone = whatsappNumber.startsWith('0') ? '2' + whatsappNumber : whatsappNumber;
                return (
                  <div
                    key={reo._id}
                    className="p-3 rounded-xl bg-paper/70 border border-line flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-primary">{reo.reorderCode}</span>
                        <span className="font-bold text-ink truncate">— {reo.supplierName}</span>
                      </div>
                      <div className="text-[11px] text-ink-soft flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {reo.sentAt ? new Date(reo.sentAt).toLocaleDateString('ar-EG') : 'الآن'}
                        </span>
                        <span>•</span>
                        <span>{reo.items?.length || 0} أصناف</span>
                        <span>•</span>
                        <strong className="text-emerald-600 font-mono">
                          {reo.totalQuantity} وحدة
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20"
                          title="مراسلة المورد"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                        {reo.status === 'sent' ? 'مرسل ✓' : reo.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Supplier Reorder Modal */}
      <SupplierReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        initialProductIds={selectedProductIds}
        authHeader={authHeader}
        showToast={showToast}
        onReorderSuccess={() => {
          setSelectedProductIds([]);
          loadCriticalProducts();
          loadReordersHistory();
          showToast?.('تم تسجيل طلب التوريد بنجاح ✓', 'success');
        }}
      />
    </div>
  );
}
