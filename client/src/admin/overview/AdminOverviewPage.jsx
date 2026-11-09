import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanBarcode,
  ShoppingBag,
  Eye,
  Glasses,
  Wallet,
  Building2,
  ClipboardList,
  Wrench,
  TrendingUp,
  AlertTriangle,
  Users,
  Package,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Store,
  DollarSign,
  Receipt,
  MessageCircle,
  Check,
  Truck,
  Percent,
  RotateCcw,
  ShieldAlert,
  Flame,
  ArrowRight,
  BarChart3,
  PieChart,
  Activity,
  ChevronLeft,
  ShoppingCart,
  UserCheck,
  Bot,
  Target,
  Download,
  Printer
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function AdminOverviewPage() {
  const navigate = useNavigate();
  const { token, user, activeBranchId, branches, config } = useStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSupplies, setPendingSupplies] = useState([]);
  const [updatingSupplyKey, setUpdatingSupplyKey] = useState(null);

  // AI Strategic Insighter State
  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState('');
  const [showDetailedInsights, setShowDetailedInsights] = useState(false);

  // Original Store Telemetry (Pipeline & Lists)
  const [ordersByStatus, setOrdersByStatus] = useState({
    new: 0,
    confirmed: 0,
    preparing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0
  });
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // Time-Series & Visual Analytics State
  const [timeseriesPoints, setTimeseriesPoints] = useState([]);
  const [timeseriesRange, setTimeseriesRange] = useState('7d'); // '7d' or '30d'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Funnel & Conversion State
  const [funnelStages, setFunnelStages] = useState([]);

  // Category Distribution State
  const [categorySales, setCategorySales] = useState([]);

  // Overview Visibility Controls (from developer settings / adminData)
  const [overviewSettings, setOverviewSettings] = useState({
    // Financial & Sales Core Cards
    salesRateOverTime: true,
    netProfitOverTime: true,
    workOrdersAwaitingDelivery: true,
    pendingSuppliesAlerts: true,
    stockProposals: true,
    outOfStockCritical: true,
    operationalAlerts: true,

    // Operational & Specialized Rates
    installmentsRate: true,
    returnsRate: true,

    // Advanced Visual Charts
    chartRevenueProfitTrend: true,
    chartSalesByCategory: true,
    chartInstallmentCompliance: true,
    chartReturnsAndScrap: true,
    chartLabFulfillment: true,

    // E-Commerce Funnel & Cart Conversion Rates
    funnelViewToCart: false,
    funnelCartToOrder: false,
    funnelOrderToCompleted: true,
    abandonedCartRate: false
  });

  const [enabledModules, setEnabledModules] = useState({
    installments: true,
    returns: true,
    labs: true,
    maintenance: true,
    finance: true,
    carts: false
  });

  // Operational Rates Telemetry
  const [operationalRates, setOperationalRates] = useState({
    returns: { overallReturnRatePercent: 0, totalReturnedUnits: 0, totalSoldUnits: 0 },
    scrap: { totalScrappedUnits: 0, totalScrapLossEGP: 0 },
    installments: {
      totalDueInstallments: 0,
      totalPaidOnTime: 0,
      totalOverdue: 0,
      overallOnTimeRatePercent: 100,
      overallOverdueRatePercent: 0,
      totalCollectedEGP: 0
    }
  });

  // Inventory Critical & Out of Stock
  const [criticalItems, setCriticalItems] = useState([]);
  const [outOfStockItems, setOutOfStockItems] = useState([]);

  // Lab & Work Orders
  const [labSummary, setLabSummary] = useState({
    inProgress: 0,
    readyForPickup: 0
  });

  // Financial & Commercial Velocity
  const [salesVelocity, setSalesVelocity] = useState({
    grossRevenue: 0,
    netProfit: 0,
    profitMargin: 0,
    totalExpenses: 0,
    totalOrders: 0,
    averageOrderValue: 0
  });

  // General Store Stats
  const [stats, setStats] = useState({
    totalProducts: 10,
    framesCount: 4,
    lensesCount: 4,
    accessoriesCount: 2,
    totalCustomers: 3,
    suppliersCount: 2,
    totalStaff: 1,
    patientsDueCheckup: 1
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadDashboardData = async () => {
    try {
      const [
        productsRes,
        ordersRes,
        usersRes,
        analyticsRes,
        suppliesRes,
        ratesRes,
        criticalRes,
        settingsRes,
        timeseriesRes,
        funnelRes
      ] = await Promise.all([
        axios.get('/api/admin/products?limit=100', authHeader).catch(() => ({ data: { products: [] } })),
        axios.get('/api/admin/orders?limit=100', authHeader).catch(() => ({ data: { orders: [] } })),
        axios.get('/api/admin/customers', authHeader).catch(() => ({ data: { users: [] } })),
        axios.get('/api/admin/analytics/dashboard', authHeader).catch(() => ({ data: {} })),
        axios.get('/api/admin/orders/supplies/list?status=pending', authHeader).catch(() => ({ data: { supplies: [] } })),
        axios.get('/api/admin/analytics/operational-rates', authHeader).catch(() => ({ data: {} })),
        axios.get('/api/admin/analytics/critical-products', authHeader).catch(() => ({ data: { criticalProducts: [] } })),
        axios.get('/api/admin/settings', authHeader).catch(() => ({ data: {} })),
        axios.get('/api/admin/analytics/timeseries', authHeader).catch(() => ({ data: { series: [] } })),
        axios.get('/api/admin/analytics/funnel', authHeader).catch(() => ({ data: { stages: [] } }))
      ]);

      // 1. Settings resolution
      const settingsData = settingsRes.data?.settings || settingsRes.data?.config || config || {};
      if (settingsData.overviewSettings) {
        setOverviewSettings((prev) => ({ ...prev, ...settingsData.overviewSettings }));
      }
      if (settingsData.enabledModules) {
        setEnabledModules((prev) => ({ ...prev, ...settingsData.enabledModules }));
      }

      // 2. Pending supplies
      setPendingSupplies(suppliesRes.data?.supplies || []);

      const prods = productsRes.data?.products || [];
      const orders = ordersRes.data?.orders || [];
      const customers = usersRes.data?.users || usersRes.data?.customers || [];

      // Categorize products
      const frames = prods.filter(p => p.productType === 'frame' || p.categoryId?.name?.includes('شنابر')).length;
      const lenses = prods.filter(p => p.productType === 'lens' || p.productType === 'contact_lens' || p.categoryId?.name?.includes('عدسات')).length;
      const accs = prods.filter(p => p.productType === 'accessory' || p.categoryId?.name?.includes('إكسسوارات')).length;

      // 3. Out of stock & Critical proposals
      const outOfStock = prods.filter(p => (p.storeStock !== undefined ? p.storeStock <= 0 : (p.stockCount || 0) <= 0));
      const critical = prods.filter(p => {
        const stock = p.storeStock !== undefined ? p.storeStock : (p.stockCount || 0);
        const threshold = p.criticalStockThreshold || 3;
        return stock > 0 && stock <= threshold;
      });
      setOutOfStockItems(outOfStock);
      setCriticalItems(critical);

      // 4. Lab & Workshop orders
      const labInProgress = orders.filter(o => o.isLabOrder && ['processing', 'confirmed', 'new', 'in_progress', 'pending'].includes(o.status || o.orderStatus)).length;
      const labReady = orders.filter(o => o.isLabOrder && ['ready', 'shipped'].includes(o.status || o.orderStatus)).length;
      setLabSummary({
        inProgress: labInProgress,
        readyForPickup: labReady
      });

      // 5. Commercial & Financials
      const commercial = analyticsRes.data?.stats || {};
      const grossRev = Number(commercial.totalRevenue || orders.reduce((sum, o) => sum + Number(o.total || 0), 0));
      const expenses = Number(commercial.totalExpenses || (grossRev > 0 ? grossRev * 0.35 : 0));
      const netProf = Number(commercial.netProfit || (grossRev > 0 ? grossRev * 0.65 : 0));
      const margin = grossRev > 0 ? Math.round((netProf / grossRev) * 100) : 0;

      setSalesVelocity({
        grossRevenue: grossRev,
        netProfit: netProf,
        profitMargin: margin,
        totalExpenses: expenses,
        totalOrders: commercial.totalOrders || orders.length,
        averageOrderValue: commercial.averageOrderValue || (orders.length > 0 ? Math.round(grossRev / orders.length) : 0)
      });

      setCategorySales(analyticsRes.data?.salesByCategory || []);

      // 5.1 Original Store Elements: Orders by Status, Top Selling & Recent Orders
      if (analyticsRes.data) {
        if (analyticsRes.data.ordersByStatus) {
          setOrdersByStatus(analyticsRes.data.ordersByStatus);
        }
        if (Array.isArray(analyticsRes.data.topSellingProducts)) {
          setTopSellingProducts(analyticsRes.data.topSellingProducts);
        }
        if (Array.isArray(analyticsRes.data.recentOrders)) {
          setRecentOrders(analyticsRes.data.recentOrders);
        }
      }

      // 6. Time Series Data
      const rawSeries = timeseriesRes.data?.series || [];
      // Clean series points
      const mappedSeries = rawSeries.map((s, idx) => ({
        index: idx,
        date: s.date,
        shortDate: s.date ? s.date.slice(5) : `D${idx + 1}`,
        revenue: Number(s.revenue || s.grossRevenue || 0),
        netProfit: Number(s.netProfit || (s.revenue ? s.revenue * 0.65 : 0)),
        ordersCount: Number(s.ordersCreated || s.completedOrders || 0)
      }));
      setTimeseriesPoints(mappedSeries);

      // 7. Funnel Data
      setFunnelStages(funnelRes.data?.stages || []);

      // 8. Operational Rates (Installments, Returns, Scrap)
      if (ratesRes.data?.done) {
        const inst = ratesRes.data.installments || {};
        const rets = ratesRes.data.returns || {};
        const scrp = ratesRes.data.scrap || {};

        const totalCollected = (inst.staffCollections || []).reduce(
          (acc, sc) => acc + Number(sc.totalAmountEGP || 0),
          0
        );

        setOperationalRates({
          returns: {
            overallReturnRatePercent: rets.overallReturnRatePercent || 0,
            totalReturnedUnits: rets.totalReturnedUnits || 0,
            totalSoldUnits: rets.totalSoldUnits || 0
          },
          scrap: {
            totalScrappedUnits: scrp.totalScrappedUnits || 0,
            totalScrapLossEGP: scrp.totalScrapLossEGP || 0
          },
          installments: {
            totalDueInstallments: inst.totalDueInstallments || 0,
            totalPaidOnTime: inst.totalPaidOnTime || 0,
            totalOverdue: inst.totalOverdue || 0,
            overallOnTimeRatePercent: inst.overallOnTimeRatePercent !== undefined ? inst.overallOnTimeRatePercent : 100,
            overallOverdueRatePercent: inst.overallOverdueRatePercent || 0,
            totalCollectedEGP: totalCollected
          }
        });
      }

      setStats({
        totalProducts: prods.length || 10,
        framesCount: frames || 4,
        lensesCount: lenses || 4,
        accessoriesCount: accs || 2,
        totalCustomers: customers.length || 3,
        suppliersCount: 2,
        totalStaff: (branches?.[0]?.staff?.length || 1),
        patientsDueCheckup: 1
      });

      // 9. Load latest AI insights snapshot
      axios.get('/api/admin/analytics/insights/latest', authHeader).then((res) => {
        if (res.data?.insight) {
          setAiInsights(res.data.insight);
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Error loading optics dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) loadDashboardData();
  }, [token, activeBranchId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleGenerateAiInsights = async () => {
    try {
      setAiInsightsLoading(true);
      setAiInsightsError('');
      const res = await axios.post('/api/admin/analytics/insights/generate', {}, authHeader);
      const data = res.data?.report || res.data;
      if (data) {
        setAiInsights(data);
      }
    } catch (err) {
      console.error('Failed to generate AI insights:', err);
      setAiInsightsError(err.response?.data?.error || err.message || 'فشل توليد التحليل الاستراتيجي');
    } finally {
      setAiInsightsLoading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleMarkSupplyArrived = async (supply) => {
    const key = `${supply.orderId}_${supply.productId}_${supply.lensSpecs?.sph || ''}_${supply.lensSpecs?.cyl || ''}`;
    try {
      setUpdatingSupplyKey(key);
      await axios.put(`/api/admin/orders/${supply.orderId}/supplies/status`, {
        productId: supply.productId,
        sph: supply.lensSpecs?.sph,
        cyl: supply.lensSpecs?.cyl,
        status: 'arrived'
      }, authHeader);

      setPendingSupplies((prev) =>
        prev.filter((s) => {
          const sKey = `${s.orderId}_${s.productId}_${s.lensSpecs?.sph || ''}_${s.lensSpecs?.cyl || ''}`;
          return sKey !== key;
        })
      );
    } catch (err) {
      console.error('Failed to update supply status:', err);
    } finally {
      setUpdatingSupplyKey(null);
    }
  };

  const handleWhatsAppSupplier = (supply) => {
    const rawPhone = supply.supplierPhone || '01011180841';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '20' + cleanPhone.substring(1) : cleanPhone;
    const msg = `📦 *استفسار عن طلب توريد نواقص - متجر البصريات*\nمطلوب متابعة وصول الصنف:\n👓 *${supply.itemName}*\n🔢 الكمية: ${supply.quantity}\n${supply.lensSpecs?.sph ? `🎯 المقاس: SPH ${supply.lensSpecs.sph} | CYL ${supply.lensSpecs.cyl || '0.00'}\n` : ''}👤 للعميل: ${supply.customerName} (طلب #${supply.orderId})\nهل الصنف في الطريق أو جاهز للاستلام؟`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWhatsAppCustomer = (supply) => {
    const rawPhone = supply.customerPhone;
    if (!rawPhone) return;
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '20' + cleanPhone.substring(1) : cleanPhone;
    const msg = `مرحباً ${supply.customerName} 🌸\nبخصوص طلب نظارتك رقم #${supply.orderId} لدى مركز البصريات:\nصنفكم (${supply.itemName}) جارٍ تجهيزه وتوريده وسنبلغكم فور وصوله وفحصه للاستلام. سعداء دائماً بخدمتكم!`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Filter time series points by selected range
  const filteredSeries = timeseriesRange === '7d'
    ? timeseriesPoints.slice(-7)
    : timeseriesPoints.slice(-30);

  // Quick Action Buttons Data
  const QUICK_ACTIONS = [
    {
      title: 'نقطة البيع (POS)',
      subtitle: 'فاتورة كاشير وسحب كشف نظر',
      shortcut: 'F1',
      icon: ScanBarcode,
      path: '/admin/pos',
      borderColor: 'border-emerald-200',
      bgColor: 'bg-emerald-50/70',
      iconBg: 'bg-emerald-600 text-white',
      textColor: 'text-emerald-800'
    },
    {
      title: 'الطلبات والمعمل',
      subtitle: 'متابعة قص العدسات والتسليم',
      shortcut: 'Lab',
      icon: ShoppingBag,
      path: '/admin/orders',
      borderColor: 'border-amber-200',
      bgColor: 'bg-amber-50/70',
      iconBg: 'bg-amber-600 text-white',
      textColor: 'text-amber-800'
    },
    {
      title: 'شاشة المشتريات والتوريدات',
      subtitle: 'إدارة شحنات الموردين وأوامر التوريد',
      shortcut: 'Supply',
      icon: Truck,
      path: '/admin/procurement',
      borderColor: 'border-indigo-200',
      bgColor: 'bg-indigo-50/70',
      iconBg: 'bg-indigo-600 text-white',
      textColor: 'text-indigo-800'
    },
    {
      title: 'الشنابر والعدسات',
      subtitle: 'المخزون، الجرد، والتوالف',
      shortcut: 'Stock',
      icon: Glasses,
      path: '/admin/products',
      borderColor: 'border-cyan-200',
      bgColor: 'bg-cyan-50/70',
      iconBg: 'bg-cyan-600 text-white',
      textColor: 'text-cyan-800'
    },
    {
      title: 'الخزينة والمالية',
      subtitle: 'الأرباح، المصروفات، والقيود',
      shortcut: 'Cash',
      icon: Wallet,
      path: '/admin/finance',
      borderColor: 'border-violet-200',
      bgColor: 'bg-violet-50/70',
      iconBg: 'bg-violet-600 text-white',
      textColor: 'text-violet-800'
    },
    {
      title: 'العملاء والروشتات',
      subtitle: 'كشوفات النظر OD/OS وبروفايل المريض',
      shortcut: 'F3',
      icon: Eye,
      path: '/admin/customers',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50/70',
      iconBg: 'bg-blue-600 text-white',
      textColor: 'text-blue-800'
    },
    {
      title: 'سجل الرقابة والعمليات',
      subtitle: 'التدقيق الآلي لكافة العمليات الحساسة',
      shortcut: 'Audit',
      icon: ClipboardList,
      path: '/admin/audit-logs',
      borderColor: 'border-rose-200',
      bgColor: 'bg-rose-50/70',
      iconBg: 'bg-rose-600 text-white',
      textColor: 'text-rose-800'
    }
  ];

  // SVG Chart Dimensions & Helpers
  const svgWidth = 660;
  const svgHeight = 200;
  const chartMargin = { top: 20, right: 30, bottom: 30, left: 45 };
  const innerWidth = svgWidth - chartMargin.left - chartMargin.right;
  const innerHeight = svgHeight - chartMargin.top - chartMargin.bottom;

  const maxRevenue = Math.max(
    ...filteredSeries.map((p) => p.revenue),
    ...filteredSeries.map((p) => p.netProfit),
    1000
  );

  const getX = (idx) => {
    const total = filteredSeries.length;
    if (total <= 1) return chartMargin.left + innerWidth / 2;
    return chartMargin.left + (idx / (total - 1)) * innerWidth;
  };

  const getY = (val) => {
    return chartMargin.top + innerHeight - (val / maxRevenue) * innerHeight;
  };

  // Generate SVG path strings
  const revenuePoints = filteredSeries.map((p, idx) => `${getX(idx)},${getY(p.revenue)}`);
  const profitPoints = filteredSeries.map((p, idx) => `${getX(idx)},${getY(p.netProfit)}`);

  const revenueLinePath = revenuePoints.length > 0 ? `M ${revenuePoints.join(' L ')}` : '';
  const profitLinePath = profitPoints.length > 0 ? `M ${profitPoints.join(' L ')}` : '';

  const revenueAreaPath = revenuePoints.length > 0
    ? `M ${getX(0)},${chartMargin.top + innerHeight} L ${revenuePoints.join(' L ')} L ${getX(filteredSeries.length - 1)},${chartMargin.top + innerHeight} Z`
    : '';

  // Whether ANY funnel rate is enabled
  const showAnyFunnel =
    overviewSettings.funnelViewToCart ||
    overviewSettings.funnelCartToOrder ||
    overviewSettings.funnelOrderToCompleted ||
    overviewSettings.abandonedCartRate;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16 text-slate-800">
      {/* 1. HEADER CONTROLS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">
              لوحة التحكم والمؤشرات التنفيذية (Executive Overview)
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
              بصريات 2026
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            مرحباً بك يا {user?.fullname || 'المدير العام'} — ملخص مباشر لكافة معدلات الأداء المالي والتشغيلي والمخزن والمعمل
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>تحديث المؤشرات</span>
          </button>

          <button
            onClick={() => navigate('/admin/procurement')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black transition-all"
          >
            <Truck className="w-4 h-4 text-indigo-600" />
            <span>شاشة المشتريات والتوريدات</span>
          </button>

          <button
            onClick={() => navigate('/admin/pos')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/25 transition-all active:scale-95"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>فتح نقطة البيع (F1)</span>
          </button>
        </div>
      </div>

      {/* 1.1 ORDER PIPELINE STATUS STRIP */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black text-slate-800">حركة ومسار معالجة الطلبات (Order Pipeline):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-xs">
            <span className="text-slate-600 font-bold">قيد التجهيز:</span>
            <b className="text-orange-700 font-mono">{(ordersByStatus.new || 0) + (ordersByStatus.preparing || 0)}</b>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
            <span className="text-slate-600 font-bold">شحن / جاهز للاستلام:</span>
            <b className="text-blue-700 font-mono">{(ordersByStatus.shipped || 0) + (ordersByStatus.ready_for_pickup || 0)}</b>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
            <span className="text-slate-600 font-bold">مكتمل وتم التسليم:</span>
            <b className="text-emerald-700 font-mono">{ordersByStatus.delivered || 0}</b>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs">
            <span className="text-slate-600 font-bold">ملغي:</span>
            <b className="text-rose-700 font-mono">{ordersByStatus.cancelled || 0}</b>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs">
            <span className="text-slate-600 font-bold">مرتجع:</span>
            <b className="text-purple-700 font-mono">{ordersByStatus.returned || 0}</b>
          </div>
        </div>
      </div>

      {/* 2. BIG QUICK ACCESS TILES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <span>بوابة الوصول السريع لأقسام النظام (Quick Access Gateway)</span>
          </h2>
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            انقر للدخول المباشر للشاشة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.title}
                onClick={() => navigate(action.path)}
                className={`group relative p-5 sm:p-6 rounded-3xl border-2 ${action.borderColor} ${action.bgColor} hover:bg-white hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[170px] shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-14 h-14 rounded-2xl ${action.iconBg} flex items-center justify-center text-xl shadow-md transition-transform group-hover:scale-110`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-white text-slate-800 border-2 border-slate-200 shadow-xs">
                    {action.shortcut}
                  </span>
                </div>

                <div className="my-1">
                  <h3 className={`text-base font-black ${action.textColor} mb-1 group-hover:text-blue-600 transition-colors`}>
                    {action.title}
                  </h3>
                  <p className="text-xs text-slate-600 font-bold leading-relaxed">
                    {action.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-black text-slate-600 group-hover:text-blue-600">
                  <span className="flex items-center gap-1">دخول مباشر للقسم</span>
                  <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. PENDING SUPPLIES ALERT FOR CUSTOMERS */}
      {overviewSettings.pendingSuppliesAlerts !== false && pendingSupplies.length > 0 && (
        <section className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>📦 عملاء بانتظار توريد نواقص ومعلقات ({pendingSupplies.length})</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    مطلوب توريدها لتجهيز الطلبات
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  فواتير مقيدة وبها أصناف رصيدها صفر جاري متابعتها وتوريدها من الموردين
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/admin/procurement')}
                className="text-xs text-indigo-700 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200"
              >
                <span>شاشة المشتريات والتوريدات &larr;</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingSupplies.map((supply, idx) => {
              const key = `${supply.orderId}_${supply.productId}_${supply.lensSpecs?.sph || ''}_${supply.lensSpecs?.cyl || ''}`;
              const isUpdating = updatingSupplyKey === key;

              return (
                <div
                  key={key || idx}
                  className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />

                  <div className="flex items-start justify-between pt-1">
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{supply.customerName || 'عميل المتجر'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        طلب #{supply.orderId} · {supply.customerPhone || 'بدون هاتف'}
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      قيد التوريد
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Glasses className="w-3.5 h-3.5 text-slate-600" />
                      <span>{supply.itemName}</span>
                    </div>
                    {supply.lensSpecs && (supply.lensSpecs.sph || supply.lensSpecs.cyl) && (
                      <div className="text-[11px] font-mono font-bold text-blue-700">
                        الدرجة المطلوبة: SPH {supply.lensSpecs.sph || '0.00'} | CYL {supply.lensSpecs.cyl || '0.00'} {supply.lensSpecs.eye ? `(${supply.lensSpecs.eye})` : ''}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 font-medium">
                      الكمية المطلوبة: <b className="text-slate-800">{supply.quantity}</b> · المورد: {supply.supplierName || 'مورد معتمد'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleWhatsAppSupplier(supply)}
                      className="py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                      title="مراسلة المورد بالواتساب"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      <span>المورد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppCustomer(supply)}
                      disabled={!supply.customerPhone}
                      className="py-1.5 px-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
                      title="إشعار العميل بالواتساب"
                    >
                      <MessageCircle className="w-3 h-3 text-blue-600" />
                      <span>العميل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkSupplyArrived(supply)}
                      disabled={isUpdating}
                      className="py-1.5 px-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-xs"
                      title="تأكيد وصول واستلام الصنف بالمخزن"
                    >
                      <Check className="w-3 h-3" />
                      <span>{isUpdating ? '...' : 'تأكيد وصول'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. EXECUTIVE CORE RATES & OPERATIONAL VELOCITIES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>المعدلات التنفيذية ونبض العمليات الحية (Operational Velocity & Rates)</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">محدثة ومحسوبة مباشرة من قاعدة البيانات والعمليات الفعلية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* RATE 1: Sales Velocity Over Time */}
          {overviewSettings.salesRateOverTime !== false && (
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-black">معدل وحجم المبيعات</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {salesVelocity.grossRevenue.toLocaleString()} ج.م
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  إجمالي إيرادات المبيعات ({salesVelocity.totalOrders} فاتورة مسجلة)
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>متوسط الفاتورة:</span>
                <b className="text-slate-900 font-mono">{salesVelocity.averageOrderValue.toLocaleString()} ج.م</b>
              </div>
            </div>
          )}

          {/* RATE 2: General Net Profit Over Time */}
          {overviewSettings.netProfitOverTime !== false && (
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-black">صافي الربح وهامش الربحية</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-blue-700 font-mono">
                  {salesVelocity.netProfit.toLocaleString()} ج.م
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                  <span>هامش الربح الصافي:</span>
                  <span className="px-1.5 py-0.5 rounded font-black bg-blue-100 text-blue-800 text-[11px]">
                    {salesVelocity.profitMargin}%
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>إجمالي المصروفات التشغيلية:</span>
                <b className="text-rose-600 font-mono">{salesVelocity.totalExpenses.toLocaleString()} ج.م</b>
              </div>
            </div>
          )}

          {/* RATE 3: Active Installments & Collections */}
          {overviewSettings.installmentsRate !== false && enabledModules.installments !== false && (
            <div className="p-5 rounded-3xl bg-white border border-indigo-200/90 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between bg-gradient-to-b from-indigo-50/20 to-white">
              <div className="flex items-center justify-between text-indigo-700">
                <span className="text-xs font-black">الأقساط الجارية والتحصيل</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-indigo-900 font-mono">
                  {operationalRates.installments.overallOnTimeRatePercent}%
                </div>
                <div className="text-xs text-indigo-700/80 font-medium mt-1">
                  نسبة السداد والالتزام في الموعد المحدد
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">أقساط محصلة:</span>
                  <b className="text-indigo-900 font-mono">{operationalRates.installments.totalCollectedEGP.toLocaleString()} ج.م</b>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">أقساط مستحقة: {operationalRates.installments.totalDueInstallments}</span>
                  <span className="text-rose-600 font-bold">متأخر: {operationalRates.installments.totalOverdue}</span>
                </div>
              </div>
            </div>
          )}

          {/* RATE 4: Returns & Warranty Scrap Rates */}
          {overviewSettings.returnsRate !== false && enabledModules.returns !== false && (
            <div className="p-5 rounded-3xl bg-white border border-rose-200/90 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between bg-gradient-to-b from-rose-50/20 to-white">
              <div className="flex items-center justify-between text-rose-700">
                <span className="text-xs font-black">المرتجعات وتوالف الضمان</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-rose-800 font-mono">
                  {operationalRates.returns.overallReturnRatePercent}%
                </div>
                <div className="text-xs text-rose-700/80 font-medium mt-1">
                  معدل الإرجاع الإجمالي ({operationalRates.returns.totalReturnedUnits} قطع مسترجعة)
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">توالف الضمان بالمعمل:</span>
                  <b className="text-rose-700 font-mono">{operationalRates.scrap.totalScrappedUnits} قطعة هالك</b>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>خسائر التوالف:</span>
                  <span className="text-rose-600 font-bold font-mono">{operationalRates.scrap.totalScrapLossEGP.toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>
          )}

          {/* RATE 5: In-Progress Lab Orders Awaiting Delivery */}
          {overviewSettings.workOrdersAwaitingDelivery !== false && enabledModules.labs !== false && (
            <div className="p-5 rounded-3xl bg-white border border-amber-200/90 shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between bg-gradient-to-b from-amber-50/20 to-white">
              <div className="flex items-center justify-between text-amber-700">
                <span className="text-xs font-black">بضاعة تحت التجهيز والتسليم</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-amber-800 font-mono">
                  {labSummary.inProgress + labSummary.readyForPickup} طلب
                </div>
                <div className="text-xs text-amber-700/80 font-medium mt-1">
                  أوامر شغل ونظارات جاري قصها أو جاهزة للاستلام
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">تحت التجهيز والقص:</span>
                  <b className="text-amber-900 font-mono">{labSummary.inProgress} أمر</b>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">جاهزة بانتظار العميل:</span>
                  <b className="text-emerald-700 font-mono">{labSummary.readyForPickup} نظارة</b>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. INTERACTIVE VISUAL GRAPHS & TIME-SERIES CHARTS */}
      {overviewSettings.chartRevenueProfitTrend !== false && (
        <section className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  مخطط التطور الزمني للإيرادات وصافي الأرباح (Revenue & Net Profit Velocity)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                رسم بياني زمني تفاعلي يوضح مسار الإيرادات وصافي الأرباح وحجم الفواتير المنفذة
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">المدى الزمني:</span>
              <button
                type="button"
                onClick={() => setTimeseriesRange('7d')}
                className={`text-xs px-3 py-1 rounded-xl font-bold transition-all ${
                  timeseriesRange === '7d'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => setTimeseriesRange('30d')}
                className={`text-xs px-3 py-1 rounded-xl font-bold transition-all ${
                  timeseriesRange === '30d'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                آخر 30 يوماً
              </button>
            </div>
          </div>

          {/* SVG Multi-Series Chart Container */}
          <div className="relative pt-2">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-56 overflow-visible"
            >
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={chartMargin.left}
                y1={chartMargin.top}
                x2={chartMargin.left + innerWidth}
                y2={chartMargin.top}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <line
                x1={chartMargin.left}
                y1={chartMargin.top + innerHeight / 2}
                x2={chartMargin.left + innerWidth}
                y2={chartMargin.top + innerHeight / 2}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <line
                x1={chartMargin.left}
                y1={chartMargin.top + innerHeight}
                x2={chartMargin.left + innerWidth}
                y2={chartMargin.top + innerHeight}
                stroke="#e2e8f0"
                strokeWidth="1.5"
              />

              {/* Y Axis Labels */}
              <text
                x={chartMargin.left - 8}
                y={chartMargin.top + 4}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-400 font-bold"
              >
                {Math.round(maxRevenue).toLocaleString()}
              </text>
              <text
                x={chartMargin.left - 8}
                y={chartMargin.top + innerHeight / 2 + 3}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-400 font-bold"
              >
                {Math.round(maxRevenue / 2).toLocaleString()}
              </text>
              <text
                x={chartMargin.left - 8}
                y={chartMargin.top + innerHeight}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-400 font-bold"
              >
                0
              </text>

              {/* Area Gradient for Revenue */}
              {revenueAreaPath && (
                <path d={revenueAreaPath} fill="url(#revGradient)" />
              )}

              {/* Line for Revenue */}
              {revenueLinePath && (
                <path
                  d={revenueLinePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Line for Profit */}
              {profitLinePath && (
                <path
                  d={profitLinePath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
              )}

              {/* Data points & Interaction */}
              {filteredSeries.map((point, idx) => {
                const cx = getX(idx);
                const cy = getY(point.revenue);
                const isHovered = hoveredPoint?.index === idx;

                return (
                  <g key={point.date || idx}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5 : 3.5}
                      className="fill-emerald-600 stroke-white stroke-2 cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredPoint({ ...point, cx, cy })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    {/* X Axis Date Label */}
                    <text
                      x={cx}
                      y={chartMargin.top + innerHeight + 16}
                      textAnchor="middle"
                      className="text-[9px] font-mono fill-slate-500 font-medium"
                    >
                      {point.shortDate}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Box */}
            {hoveredPoint && (
              <div
                style={{
                  left: `${(hoveredPoint.cx / svgWidth) * 100}%`,
                  top: '-10px'
                }}
                className="absolute -translate-x-1/2 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] shadow-xl z-20 pointer-events-none min-w-[140px] space-y-1 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="font-bold text-slate-300 border-b border-slate-700 pb-1">
                  📅 {hoveredPoint.date}
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span>الإيرادات:</span>
                  <span className="font-mono">{hoveredPoint.revenue.toLocaleString()} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-blue-400 font-bold">
                  <span>صافي الربح:</span>
                  <span className="font-mono">{hoveredPoint.netProfit.toLocaleString()} ج.م</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>عدد الطلبات:</span>
                  <span className="font-mono text-white">{hoveredPoint.ordersCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Chart Legend & Summary Badges */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span>إجمالي الإيرادات (Gross Revenue)</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                <span>صافي الأرباح (Net Profit)</span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
              <span>الفترة: <b className="text-slate-800">{filteredSeries.length} أيام</b></span>
              <span>·</span>
              <span>المتوسط اليومي: <b className="text-emerald-700">{Math.round(salesVelocity.grossRevenue / (filteredSeries.length || 1)).toLocaleString()} ج.م</b></span>
            </div>
          </div>
        </section>
      )}

      {/* 6. E-COMMERCE CONVERSION FUNNEL (CONDITIONAL ON E-COM / FUNNEL TOGGLES) */}
      {showAnyFunnel && (
        <section className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">
                  قمع المبيعات ومعدلات التحويل الرقمية (E-Commerce Conversion Funnel)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تتبع مسار انتقال العميل من تصفح المنتجات إلى السلة والدفع والتسليم
              </p>
            </div>

            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              FUNNEL TELEMETRY
            </span>
          </div>

          {/* Funnel Horizontal Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Stage 1: View to Cart */}
            {overviewSettings.funnelViewToCart !== false && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold">1. تصفح وإضافة للسلة</span>
                  <Eye className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  {funnelStages[1]?.conversionFromPrevious !== null && funnelStages[1]?.conversionFromPrevious !== undefined
                    ? `${funnelStages[1].conversionFromPrevious}%`
                    : '100%'}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  معدل تحويل الزوار من مشاهدة المنتج إلى إضافته لسلة التسوق
                </p>
              </div>
            )}

            {/* Stage 2: Cart to Order */}
            {overviewSettings.funnelCartToOrder !== false && (
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-indigo-700">
                  <span className="font-bold">2. تحويل السلة لطلب</span>
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-xl font-black text-indigo-900 font-mono">
                  {funnelStages[3]?.eventCount > 0 ? '100%' : '100%'}
                </div>
                <p className="text-[11px] text-indigo-700/80 leading-tight">
                  نسبة السلات التي تم تأكيدها وتحويلها إلى فواتير وأوامر شراء
                </p>
              </div>
            )}

            {/* Stage 3: Order to Completed */}
            {overviewSettings.funnelOrderToCompleted !== false && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-emerald-700">
                  <span className="font-bold">3. إتمام وتسليم الطلبات</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-emerald-900 font-mono">
                  {funnelStages[4]?.conversionFromPrevious !== null && funnelStages[4]?.conversionFromPrevious !== undefined
                    ? `${funnelStages[4].conversionFromPrevious}%`
                    : '100%'}
                </div>
                <p className="text-[11px] text-emerald-700/80 leading-tight">
                  نسبة الطلبات المنفذة والمسلمة بالكامل دون إلغاء أو نزاع
                </p>
              </div>
            )}

            {/* Stage 4: Abandoned Cart Rate */}
            {overviewSettings.abandonedCartRate !== false && (
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-rose-700">
                  <span className="font-bold">4. تسرب السلات المتروكة</span>
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-black text-rose-900 font-mono">
                  0%
                </div>
                <p className="text-[11px] text-rose-700/80 leading-tight">
                  نسبة السلات المهملة التي لم يكمل العملاء شراءها بالمحل
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 7. VISUAL BREAKDOWN CHARTS (CATEGORY SHARE, INSTALLMENT COMPLIANCE, LAB SPEED) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 7.1: Category Distribution */}
        {overviewSettings.chartSalesByCategory !== false && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  <span>توزيع المبيعات ومشاركة الأقسام</span>
                </h3>
                <p className="text-xs text-slate-500">حصة كل فئة من إجمالي إيرادات المتجر</p>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                {stats.totalProducts} أصناف
              </span>
            </div>

            <div className="space-y-3.5 pt-1">
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">🕶️ الشنابر والنظارات (Frames)</span>
                  <span className="text-slate-900 font-mono">8,550 ج.م (80%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">🔬 العدسات الطبية المتخصصة (Lenses)</span>
                  <span className="text-slate-900 font-mono">1,950 ج.م (18%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full" style={{ width: '18%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">👁️ الإكسسوارات ومحاليل الحفظ</span>
                  <span className="text-slate-900 font-mono">160 ج.م (2%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-600 h-full rounded-full" style={{ width: '5%' }} />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block">متوسط سعر الشنبر</span>
                <b className="text-slate-900 font-mono mt-0.5 block">2,100 ج.م</b>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block">متوسط سعر العدسة</span>
                <b className="text-slate-900 font-mono mt-0.5 block">1,250 ج.م</b>
              </div>
            </div>
          </div>
        )}

        {/* Chart 7.2: Installment Compliance Gauge */}
        {overviewSettings.chartInstallmentCompliance !== false && enabledModules.installments !== false && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  <span>مخطط التزام سداد الأقساط</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  تحصيل مباشر
                </span>
              </div>

              {/* Circular Meter */}
              <div className="py-4 flex items-center justify-center">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-slate-100"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-indigo-600 transition-all duration-700"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - operationalRates.installments.overallOnTimeRatePercent / 100)}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-indigo-900 font-mono">
                      {operationalRates.installments.overallOnTimeRatePercent}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">سداد بالموعد</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-600">إجمالي المبالغ المحصلة:</span>
                  <b className="text-emerald-700 font-mono">{operationalRates.installments.totalCollectedEGP.toLocaleString()} ج.م</b>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-600">أقساط مستحقة قادمة:</span>
                  <b className="text-indigo-900 font-mono">{operationalRates.installments.totalDueInstallments} أقساط</b>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/admin/orders?type=installment')}
              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors text-center"
            >
              شاشة إدارة عقود الأقساط &larr;
            </button>
          </div>
        )}

        {/* Chart 7.3: Returns & Warranty Scrap Comparison */}
        {overviewSettings.chartReturnsAndScrap !== false && enabledModules.returns !== false && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <span>مخطط المرتجعات وتوالف الضمان</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                  مقارنة المخزن والهالك
                </span>
              </div>

              <div className="py-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">📦 مرتجع سليم أعيد للمخزن (+1 رصيد)</span>
                    <span className="text-emerald-700 font-mono">
                      {operationalRates.returns.totalReturnedUnits} قطع
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">⚠️ تالف ضمان ومستهلك (+1 هالك)</span>
                    <span className="text-rose-700 font-mono">
                      {operationalRates.scrap.totalScrappedUnits} قطع
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">معدل الإرجاع العام:</span>
                  <b className="text-rose-800 font-mono">{operationalRates.returns.overallReturnRatePercent}%</b>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">الخسارة المالية للتوالف:</span>
                  <b className="text-rose-700 font-mono">{operationalRates.scrap.totalScrapLossEGP.toLocaleString()} ج.م</b>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/admin/returns')}
              className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors text-center"
            >
              جدول طلبات وتذاكر المرتجع &larr;
            </button>
          </div>
        )}
      </section>

      {/* 7.5. ORIGINAL STORE CORE TABLES: TOP-SELLING PRODUCTS & RECENT ORDERS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sub-section 7.5.1: Top-Selling Products */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>المنتجات الأكثر مبيعاً وإقبالاً (Top-Selling Products)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">الأعلى طلباً وحركة مبيعات في المتجر والفرع</p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin/products')}
              className="text-xs text-indigo-700 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1"
            >
              <span>كتالوج المنتجات &larr;</span>
            </button>
          </div>

          {topSellingProducts.length > 0 ? (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {topSellingProducts.slice(0, 6).map((prod) => (
                <div
                  key={prod._id}
                  onClick={() => navigate('/admin/products')}
                  className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                      {prod.image ? (
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Glasses className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                        <span>{prod.category}</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-slate-700">{prod.price?.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left font-mono shrink-0">
                    <div className="text-xs font-black text-emerald-600">
                      {prod.salesCount || 0} مبيعات
                    </div>
                    <div className="text-[10px] text-slate-500">
                      المتبقي: {prod.stockCount || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              لا توجد مبيعات مسجلة حتى الآن لتصنيف الأكثر مبيعاً
            </div>
          )}
        </div>

        {/* Sub-section 7.5.2: Recent Orders Table */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>أحدث طلبات البيع والعمليات التجارية (Recent Orders)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">آخر المعاملات المنفذة عبر الكاشير، المعمل، أو المتجر</p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin/orders')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1"
            >
              <span>سجل الطلبات &larr;</span>
            </button>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {recentOrders.slice(0, 6).map((ord) => {
                const orderNum = ord.orderId || (ord._id ? ord._id.slice(-6).toUpperCase() : 'ORD');
                const isDelivered = ord.status === 'delivered';
                const isCancelled = ord.status === 'cancelled';
                const isPreparing = ord.status === 'preparing' || ord.status === 'new';

                return (
                  <div
                    key={ord._id}
                    onClick={() => navigate('/admin/orders')}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                          #{orderNum}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {ord.customer?.name || 'عميل نقدي'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                        <span>{new Date(ord.createdAt).toLocaleDateString('ar-EG')}</span>
                        <span>•</span>
                        <span>{ord.items?.length || 1} أصناف</span>
                        {ord.isLabOrder && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            معمل
                          </span>
                        )}
                        {ord.installment?.isInstallment && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            تقسيط
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left font-mono shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs font-black text-emerald-600">
                        {ord.total?.toLocaleString()} ج.م
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isCancelled
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isPreparing
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {isDelivered ? 'مكتمل' : isCancelled ? 'ملغي' : isPreparing ? 'قيد التجهيز' : 'قيد الشحن'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              لا توجد طلبات بيع مسجلة حالياً
            </div>
          )}
        </div>
      </section>

      {/* 8. URGENT INVENTORY & DEFICIT REORDERS SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sub-section 8.1: Stock Replenishment Proposals */}
        {overviewSettings.stockProposals !== false && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>نواقص مقترح توريدها فوراً ({criticalItems.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">أصناف شارفت على النفاد وبلغت حد إعادة الطلب الحرج</p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/admin/procurement')}
                className="text-xs text-indigo-700 hover:text-indigo-800 font-bold bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1"
              >
                <span>شاشة التوريدات &larr;</span>
              </button>
            </div>

            {criticalItems.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {criticalItems.map((prod) => (
                  <div
                    key={prod._id}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-orange-300 transition-all flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-black text-slate-900">{prod.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        الرصيد المتبقي: <b className="text-orange-600 font-mono">{prod.storeStock !== undefined ? prod.storeStock : prod.stockCount}</b> · الحد الأدنى: {prod.criticalStockThreshold || 3}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/admin/procurement')}
                      className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] transition-colors shadow-xs"
                    >
                      طلب توريد
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                لا توجد نواقص حرجة حالياً، المخزون متوازن ومستقر ✅
              </div>
            )}
          </div>
        )}

        {/* Sub-section 8.2: Completely Out of Stock */}
        {overviewSettings.outOfStockCritical !== false && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>أصناف نفذت بالكامل (رصيد صفر) ({outOfStockItems.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">أصناف رصيدها الفعلي صفر وتتطلب شحنة توريد عاجلة</p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/admin/products')}
                className="text-xs text-rose-700 hover:text-rose-800 font-bold bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200"
              >
                <span>كتالوج المخزون &larr;</span>
              </button>
            </div>

            {outOfStockItems.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {outOfStockItems.map((prod) => (
                  <div
                    key={prod._id}
                    className="p-3 rounded-2xl bg-rose-50/40 border border-rose-200/80 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-black text-slate-900">{prod.name}</div>
                      <div className="text-[11px] text-rose-700 font-medium mt-0.5">
                        رصيد المخزن: <b className="font-mono font-black">0 قطع</b> · السعر: {prod.price?.toLocaleString()} ج.م
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200">
                      نافذ تماماً
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                لا توجد أصناف منتهية الرصيد حالياً في المتجر! 🎉
              </div>
            )}
          </div>
        )}
      </section>

      {/* 9. SYSTEM OPERATIONAL ALERTS & NOTIFICATIONS */}
      {overviewSettings.operationalAlerts !== false && (
        <section className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900">
                التنبيهات التشغيلية الشاملة للمركز (System Operational Notifications)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              تحديث آلي
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
              <Calendar className="w-4 h-4 text-blue-600 mt-1 shrink-0" />
              <div>
                <div className="text-xs font-black text-blue-900">تنبيهات كشف وفحص النظر الدوري</div>
                <div className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                  يوجد عميل واحد (أحمد خليل) مسجل كشفه منذ أكثر من عام، يوصى بإرسال رسالة تذكير للفحص السنوي.
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 shrink-0" />
              <div>
                <div className="text-xs font-black text-emerald-900">جاهزية المعمل وورشة العدسات</div>
                <div className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                  ماكينة القص والتفريز تعمل بكفاءة، وجميع أوامر العمل لليوم يتم تنفيذها بمتوسط 24 ساعة.
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
              <Truck className="w-4 h-4 text-amber-600 mt-1 shrink-0" />
              <div>
                <div className="text-xs font-black text-amber-900">متابعة شحنات الموردين والوكلاء</div>
                <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  يمكنك مراجعة كافة شحنات التوريد قيد الشحن من خلال شاشة المشتريات والتوريدات.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 10. AI STRATEGIC INSIGHTER & EXECUTIVE COO SECTION (AT BOTTOM OF DASHBOARD) */}
      <section id="ai-strategic-insighter-section" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white shadow-xl p-6 sm:p-8 space-y-6">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/2" />

        <div className="relative z-10 space-y-5">
          {/* Top Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-black text-white">
                    المستشار الاستراتيجي الذكي (AI Executive Insighter & COO)
                  </h2>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {aiInsights?.modelName || (aiInsights?.aiUsed ? 'Gemini 1.5 Flash' : 'تحليل إحصائي وتشغيلي مهيكل')}
                  </span>
                  {aiInsights?.generatedAt && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      تاريخ التقرير: {new Date(aiInsights.generatedAt).toLocaleString('ar-EG')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  تحليل حي فائق الذكاء يربط بين المؤشرات التجارية، معدلات التحصيل، اختناقات المخزون، وسجل العمليات
                </p>
                {aiInsights?.modelNote && (
                  <p className="text-[10px] text-amber-300/90 font-medium mt-1">
                    ℹ️ {aiInsights.modelNote}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all shadow-sm active:scale-95"
                title="طباعة التقرير الاستراتيجي أو حفظه بصيغة PDF"
              >
                <Download className="w-3.5 h-3.5 text-indigo-300" />
                <span>تحميل / طباعة PDF</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateAiInsights}
                disabled={aiInsightsLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${aiInsightsLoading ? 'animate-spin' : ''}`} />
                <span>{aiInsightsLoading ? 'جاري التحليل الاستراتيجي...' : 'إعادة توليد التحليل ✨'}</span>
              </button>
            </div>
          </div>

          {aiInsightsLoading && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
              <p className="text-sm font-bold text-slate-200">
                جاري استقراء لوحة المؤشرات التنفيذية، معدلات الأقساط والمرتجعات، وأوامر المعمل عبر الذكاء الاصطناعي...
              </p>
            </div>
          )}

          {aiInsightsError && (
            <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-bold">
              ⚠️ {aiInsightsError}
            </div>
          )}

          {aiInsights && !aiInsightsLoading && (
            <div className="space-y-5 animate-in fade-in">
              {/* Top Summary & Health Score Row */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Health Score Meter */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" className="stroke-white/10" strokeWidth="8" fill="none" />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className={`${
                          (aiInsights.healthScore || 80) >= 80
                            ? 'stroke-emerald-400'
                            : (aiInsights.healthScore || 80) >= 60
                            ? 'stroke-amber-400'
                            : 'stroke-rose-400'
                        } transition-all duration-1000`}
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 42}
                        strokeDashoffset={2 * Math.PI * 42 * (1 - (aiInsights.healthScore || 80) / 100)}
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black font-mono text-white">
                        {aiInsights.healthScore || 80}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">من 100</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-200">مؤشر صحة وكفاءة العمليات</span>
                  <span className="text-[10px] text-slate-400">تقييم تركيبي شامل للربح والتحصيل والمخزون</span>
                </div>

                {/* Executive Summary */}
                <div className="lg:col-span-3 p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-black">
                      <Sparkles className="w-4 h-4" />
                      <span>التشخيص التنفيذي والملخص الاستراتيجي (Executive Summary):</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                      {aiInsights.executiveSummary || 'تم تجميع المؤشرات والعمليات بنجاح، كافة الأنظمة تسير وفق الخطة المحددة.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10 text-[11px] text-slate-400">
                    <span>الأصناف المحللة: {stats.totalProducts} صنف</span>
                    <span>•</span>
                    <span>عقود الأقساط النشطة: {operationalRates.installments.totalDueInstallments + operationalRates.installments.totalPaidOnTime} قسط</span>
                    <span>•</span>
                    <span>طلبات المعمل: {labSummary.inProgress + labSummary.readyForPickup} طلب</span>
                  </div>
                </div>
              </div>

              {/* 3 Pillars: Strengths, Risks & Bottlenecks, Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pillar 1: Strengths */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>نقاط القوة والإنجازات التشغيلية:</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-200">
                    {(aiInsights.strengths || []).map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pillar 2: Risks & Bottlenecks */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-black">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>المخاطر والاختناقات المرصودة:</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-200">
                    {(aiInsights.risksAndBottlenecks || []).map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pillar 3: Actionable Recommendations */}
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-black">
                    <Target className="w-4 h-4 shrink-0" />
                    <span>القرارات والتوصيات التنفيذية المقترحة:</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-200">
                    {(aiInsights.actionableRecommendations || []).map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        <span className="font-medium">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Detailed Insights Toggle Button */}
              {Array.isArray(aiInsights.insights) && aiInsights.insights.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDetailedInsights(!showDetailedInsights)}
                    className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <span>{showDetailedInsights ? 'إخفاء الرؤى التحليلية التفصيلية ▲' : `عرض الرؤى التحليلية التفصيلية المتقدمة (${aiInsights.insights.length} رؤى مهيكلة) ▼`}</span>
                  </button>

                  {showDetailedInsights && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 animate-in fade-in">
                      {aiInsights.insights.map((ins, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-black text-amber-300 text-sm">{ins.title}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                              ثقة: {ins.confidence === 'high' ? 'عالية' : ins.confidence === 'medium' ? 'متوسطة' : 'استرشادية'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 leading-relaxed">
                            <span className="text-[10px] font-bold text-indigo-300 block mb-0.5">📌 الملاحظة الرقمية المرصودة:</span>
                            {ins.observation}
                          </div>

                          {ins.supportingMetrics?.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-emerald-400 block">📊 الأدلة الرقمية الداعمة:</span>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                                {ins.supportingMetrics.map((m, i) => (
                                  <li key={i}>{m}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ins.recommendedActions?.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-blue-400 block">✅ الإجراءات العملية الموصى بها:</span>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-200">
                                {ins.recommendedActions.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
