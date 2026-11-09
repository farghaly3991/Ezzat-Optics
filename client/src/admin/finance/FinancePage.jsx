import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Building2,
  Boxes,
  Receipt,
  BarChart3,
  Globe2,
  ShieldCheck,
  Wallet,
  CalendarClock,
  PieChart
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import CommercialLedgerPanel from './commercial/CommercialLedgerPanel';
import ShippingClassesPanel from './shipping/ShippingClassesPanel';
import ProcurementShipmentsPanel from './procurement/ProcurementShipmentsPanel';
import FinanceInventoryPanel from './inventory/InventoryPanel';
import FinanceExpensesSalesPanel from './expenses/ExpensesSalesPanel';
import FinanceReportsAccountingPanel from './reports/ReportsAccountingPanel';
import FinanceCurrencyPanel from './currency/CurrencyPanel';
import FinanceSettingsPanel from './settings/FinanceSettingsPanel';
import FinanceInstallmentsPanel from './installments/FinanceInstallmentsPanel';
import OpticsPerformanceMetricsCard from './reports/OpticsPerformanceMetricsCard';
import AdminBranchSelector from '../shared/AdminBranchSelector';

export default function FinancePage() {
  const { token, config, showToast, activeBranchId } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active sub-tab from URL pathname (e.g. /admin/finance/procurement -> 'procurement')
  const currentSubTab = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const financeIdx = parts.indexOf('finance');
    if (financeIdx !== -1 && parts[financeIdx + 1]) {
      return parts[financeIdx + 1];
    }
    return 'commercial';
  }, [location.pathname]);

  const setSubTab = (tabKey) => {
    navigate(`/admin/finance/${tabKey}`);
  };

  // Phase A & Settings State
  const [shippingClasses, setShippingClasses] = useState([]);
  const [financeSettings, setFinanceSettings] = useState(null);
  const [capabilityRegistry, setCapabilityRegistry] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [pickupForm, setPickupForm] = useState({
    enabled: true,
    branchName: 'الفرع الرئيسي',
    branchAddress: '',
    instructions: 'سيتم إشعارك فور جاهزية الطلب للاستلام من الفرع.'
  });
  const [shippingConfigForm, setShippingConfigForm] = useState({
    addQuantityBehavior: 'per_line',
    respectFreeShippingThreshold: false
  });

  // Phase B State
  const [procurementOverview, setProcurementOverview] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [shipmentFilterStatus, setShipmentFilterStatus] = useState('all');
  const [shipmentOverdueOnly, setShipmentOverdueOnly] = useState(false);
  const [shipmentSearch, setShipmentSearch] = useState('');

  const effectiveToken = token || (typeof window !== 'undefined' ? localStorage.getItem('store_token') : '') || '';
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${effectiveToken}` } }), [effectiveToken]);
  const currency = config?.currency || 'ج.م';

  const loadShippingAndSettings = async () => {
    try {
      const [classesRes, settingsRes] = await Promise.all([
        axios.get('/api/admin/finance/shipping-classes', authHeader),
        axios.get('/api/admin/finance/settings', authHeader)
      ]);
      setShippingClasses(classesRes.data?.shippingClasses || []);
      const s = settingsRes.data?.settings || {};
      setFinanceSettings(s);
      setCapabilityRegistry(settingsRes.data?.registry || null);
      if (s.pickup) {
        setPickupForm({
          enabled: s.pickup.enabled !== false,
          branchName: s.pickup.branchName || 'الفرع الرئيسي',
          branchAddress: s.pickup.branchAddress || '',
          instructions: s.pickup.instructions || ''
        });
      }
      if (s.shippingConfig) {
        setShippingConfigForm({
          addQuantityBehavior: s.shippingConfig.addQuantityBehavior || 'per_line',
          respectFreeShippingThreshold: Boolean(s.shippingConfig.respectFreeShippingThreshold)
        });
      }
    } catch (err) {
      console.error('Error loading finance shipping/settings:', err);
    }
  };

  const loadProcurementData = async () => {
    try {
      const params = new URLSearchParams();
      if (shipmentFilterStatus !== 'all') params.set('paymentStatus', shipmentFilterStatus);
      if (shipmentOverdueOnly) params.set('overdueOnly', 'true');
      if (shipmentSearch.trim()) params.set('search', shipmentSearch.trim());

      const [overviewRes, shipmentsRes, suppliersRes, prodsRes] = await Promise.all([
        axios.get('/api/admin/finance/procurement/overview', authHeader),
        axios.get(`/api/admin/finance/shipments?${params.toString()}`, authHeader),
        axios.get('/api/admin/finance/suppliers', authHeader),
        axios.post('/api/admin/products/filter', { page: 1, pageSize: 100, includeInactive: true }, authHeader)
      ]);

      setProcurementOverview(overviewRes.data || null);
      setShipments(shipmentsRes.data?.shipments || []);
      setSuppliers(suppliersRes.data?.suppliers || []);
      setCatalogProducts(prodsRes.data?.products || []);
    } catch (err) {
      console.error('Error loading procurement data:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await axios.get('/api/admin/finance/audit?limit=60', authHeader);
      setAuditLogs(res.data?.logs || []);
    } catch (err) {
      console.error('Error loading finance audit logs:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadShippingAndSettings();
    loadProcurementData();
    loadAuditLogs();
  }, [token]);

  useEffect(() => {
    if (token && currentSubTab === 'procurement') {
      loadProcurementData();
    }
  }, [shipmentFilterStatus, shipmentOverdueOnly]);

  const subTabs = [
    { key: 'commercial', label: 'الحسابات التجارية والإحصاءات الشاملة', icon: PieChart },
    { key: 'reports', label: 'التقارير والمحاسبة والقوائم', icon: BarChart3 },
    { key: 'installments', label: 'التقسيط والمستحقات الآجلة', icon: CalendarClock },
    {
      key: 'procurement',
      label: 'الموردين والالتزامات',
      icon: Building2,
      badge: procurementOverview?.summary?.overdueCount > 0 ? procurementOverview.summary.overdueCount : null
    },
    { key: 'inventory', label: 'المخزون والاستلام والتكلفة', icon: Boxes },
    { key: 'expenses', label: 'المصروفات والتشغيل', icon: Receipt },
    { key: 'shipping', label: 'الشحن والاستلام', icon: Truck },
    { key: 'settings', label: 'الإعدادات وسجل التدقيق', icon: ShieldCheck }
  ];

  return (
    <div className="space-y-6 animate-in fade-in text-ink">
      {/* Sub-navigation Header */}
      <div className="p-5 rounded-3xl bg-surface border border-line shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-ink flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span>النظام المالي المتكامل (Finance Architecture — Phases A–F)</span>
          </h3>
          <p className="text-xs text-ink-soft mt-0.5">
            الشحن والاستلام، شحنات الموردين، المخزون وتقييم التكلفة (WAC/FIFO)، المصروفات والمبيعات اليدوية، التقارير والمحاسبة المزدوجة، والعملات وأسعار الصرف
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-black">
          {subTabs.map((t) => {
            const Icon = t.icon;
            const isSelected = currentSubTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                className={`px-3.5 py-2.5 rounded-card flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-md'
                    : 'bg-paper text-ink border border-line hover:bg-surface'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {t.badge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Local Branch Selector for Finance */}
      <AdminBranchSelector
        label="تصفية العمليات المالية والمخزون حسب الفرع:"
      />

      {/* Optics High-Performance Financial Intelligence & OPEX Card */}
      <OpticsPerformanceMetricsCard
        token={effectiveToken}
        currency={currency}
        showToast={showToast}
      />

      {/* Sub-tab Views */}
      {currentSubTab === 'commercial' && (
        <CommercialLedgerPanel
          token={effectiveToken}
          currency={currency}
          showToast={showToast}
        />
      )}

      {currentSubTab === 'shipping' && (
        <ShippingClassesPanel
          shippingClasses={shippingClasses}
          pickupForm={pickupForm}
          setPickupForm={setPickupForm}
          shippingConfigForm={shippingConfigForm}
          setShippingConfigForm={setShippingConfigForm}
          authHeader={authHeader}
          currency={currency}
          showToast={showToast}
          onRefresh={() => {
            loadShippingAndSettings();
            loadAuditLogs();
          }}
        />
      )}

      {currentSubTab === 'procurement' && (
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
          onRefresh={() => {
            loadProcurementData();
            loadAuditLogs();
          }}
        />
      )}

      {currentSubTab === 'inventory' && (
        <FinanceInventoryPanel
          token={effectiveToken}
          currency={currency}
          showToast={showToast}
          shipments={shipments}
          onRefreshAudit={loadAuditLogs}
        />
      )}
      {currentSubTab === 'expenses' && (
        <FinanceExpensesSalesPanel
          token={effectiveToken}
          currency={currency}
          showToast={showToast}
          catalogProducts={catalogProducts}
          onRefreshAudit={loadAuditLogs}
        />
      )}
      {currentSubTab === 'reports' && (
        <FinanceReportsAccountingPanel
          token={effectiveToken}
          currency={currency}
          showToast={showToast}
          financeLevel={financeSettings?.level || 'advanced'}
          onRefreshAudit={loadAuditLogs}
        />
      )}
      {currentSubTab === 'installments' && (
        <FinanceInstallmentsPanel
          token={effectiveToken}
          currency={currency}
          showToast={showToast}
        />
      )}
      {currentSubTab === 'currency' && (
        <FinanceCurrencyPanel
          token={effectiveToken}
          currency={currency}
          showToast={showToast}
          onRefreshAudit={loadAuditLogs}
        />
      )}

      {currentSubTab === 'settings' && (
        <FinanceSettingsPanel
          financeSettings={financeSettings}
          capabilityRegistry={capabilityRegistry}
          auditLogs={auditLogs}
          authHeader={authHeader}
          showToast={showToast}
          onRefreshSettings={loadShippingAndSettings}
          onRefreshAudit={loadAuditLogs}
        />
      )}
    </div>
  );
}
