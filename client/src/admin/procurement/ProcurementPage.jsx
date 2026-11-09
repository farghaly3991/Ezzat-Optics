import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Truck, RefreshCw, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../shared/context/StoreContext';
import ProcurementShipmentsPanel from '../finance/procurement/ProcurementShipmentsPanel';

/**
 * Dedicated Procurement & Suppliers Management Page
 * High-clarity executive hub for managing supplier shipments, purchase reorders,
 * lens matrix restocks, warehouse receiving, and supplier payments.
 */
export default function ProcurementPage() {
  const { token, config, showToast } = useStore();
  const navigate = useNavigate();

  const [procurementOverview, setProcurementOverview] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [shipmentFilterStatus, setShipmentFilterStatus] = useState('all');
  const [shipmentOverdueOnly, setShipmentOverdueOnly] = useState(false);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const effectiveToken = token || (typeof window !== 'undefined' ? localStorage.getItem('store_token') : '') || '';
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${effectiveToken}` } }), [effectiveToken]);
  const currency = config?.currency || 'ج.م';

  const loadProcurementData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (shipmentFilterStatus !== 'all') params.set('paymentStatus', shipmentFilterStatus);
      if (shipmentOverdueOnly) params.set('overdueOnly', 'true');
      if (shipmentSearch.trim()) params.set('search', shipmentSearch.trim());

      const [overviewRes, shipmentsRes, suppliersRes, prodsRes] = await Promise.all([
        axios.get('/api/admin/finance/procurement/overview', authHeader).catch(() => ({ data: null })),
        axios.get(`/api/admin/finance/shipments?${params.toString()}`, authHeader).catch(() => ({ data: { shipments: [] } })),
        axios.get('/api/admin/finance/suppliers', authHeader).catch(() => ({ data: { suppliers: [] } })),
        axios.post('/api/admin/products/filter', { page: 1, pageSize: 150, includeInactive: true }, authHeader).catch(() => ({ data: { products: [] } }))
      ]);

      setProcurementOverview(overviewRes.data || null);
      setShipments(shipmentsRes.data?.shipments || []);
      setSuppliers(suppliersRes.data?.suppliers || []);
      setCatalogProducts(prodsRes.data?.products || []);
    } catch (err) {
      console.error('Error loading procurement data:', err);
      showToast('خطأ أثناء تحميل بيانات التوريدات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token && !effectiveToken) return;
    loadProcurementData();
  }, [token, effectiveToken]);

  useEffect(() => {
    if (token || effectiveToken) {
      loadProcurementData();
    }
  }, [shipmentFilterStatus, shipmentOverdueOnly]);

  return (
    <div className="space-y-6 animate-in fade-in text-ink" dir="rtl">
      {/* Page Header */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800">إدارة التوريدات والموردين</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                المشتريات والشحنات
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة شحنات الموردين، أوامر التوريد الخارجية، استلام وتفريغ البضائع والمصفوفات بالمخزن، وسداد الفواتير
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/finance/procurement')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-bold transition-all"
            title="عرض الالتزامات المالية في الخزينة"
          >
            <span>الالتزامات بالخزينة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={loadProcurementData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black border border-blue-200 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* Main Procurement Panel */}
      <ProcurementShipmentsPanel
        procurementOverview={procurementOverview}
        shipments={shipments}
        suppliers={suppliers}
        catalogProducts={catalogProducts}
        shipmentFilterStatus={shipmentFilterStatus}
        setShipmentFilterStatus={setShipmentFilterStatus}
        shipmentOverdueOnly={shipmentOverdueOnly}
        setShipmentOverdueOnly={setShipmentOverdueOnly}
        shipmentSearch={shipmentSearch}
        setShipmentSearch={setShipmentSearch}
        currency={currency}
        authHeader={authHeader}
        showToast={showToast}
        onRefresh={loadProcurementData}
      />
    </div>
  );
}
