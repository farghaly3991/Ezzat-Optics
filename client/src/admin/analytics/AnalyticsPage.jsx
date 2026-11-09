import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Calendar,
  Filter,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  RefreshCw,
  History,
  Download,
  Sparkles
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ProductAnalyticsView from './components/ProductAnalyticsView';
import AnalyticsAiInsightsPanel from './components/AnalyticsAiInsightsPanel';
import AnalyticsOverviewTab from './components/AnalyticsOverviewTab';
import ProductRankingsTab from './components/ProductRankingsTab';
import CustomerCancellationsTab from './components/CustomerCancellationsTab';
import CommercialDashboardTab from './components/CommercialDashboardTab';
import { exportInsightsPdf } from './components/exportInsightsPdf';
import AdminBranchSelector from '../shared/AdminBranchSelector';

export default function AnalyticsPage({ initialProductId = null }) {
  const { token, config, showToast, activeBranchId } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const currency = config?.currency || 'ج.م';

  // Sub-navigation derived from React Router URL (/admin/analytics/rankings -> 'rankings')
  const activeSubView = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const analyticsIdx = parts.indexOf('analytics');
    if (analyticsIdx !== -1 && parts[analyticsIdx + 1]) {
      return parts[analyticsIdx + 1];
    }
    return 'overview';
  }, [location.pathname]);

  const setActiveSubView = (subViewId) => {
    navigate(`/admin/analytics/${subViewId}`);
  };

  // Filters State
  const [rangePreset, setRangePreset] = useState('30d'); // '7d' | '30d' | '90d' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);

  // Product Drilldown
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || null);

  // Overview State
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  // Rankings State
  const [rankingMetric, setRankingMetric] = useState('most_viewed');
  const [rankingOrder, setRankingOrder] = useState('desc');
  const [rankingLimit, setRankingLimit] = useState(10);
  const [rankingsData, setRankingsData] = useState(null);
  const [rankingsLoading, setRankingsLoading] = useState(false);

  // Customer Cancellation Report State
  const [cancelReport, setCancelReport] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelSortBy, setCancelSortBy] = useState('cancelled_desc');
  const [cancelAllTime, setCancelAllTime] = useState(false);

  // Commercial Legacy Dashboard State
  const [commercialData, setCommercialData] = useState(null);

  // AI Insights State
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [savedInsightRecord, setSavedInsightRecord] = useState(() => {
    try {
      const local = localStorage.getItem('store_last_ai_insight');
      return local ? JSON.parse(local) : null;
    } catch {
      return null;
    }
  });
  const [loadingSavedInsight, setLoadingSavedInsight] = useState(false);

  const rangeParams = useMemo(() => {
    const p = {};
    if (rangePreset === 'custom' && customStart && customEnd) {
      p.startDate = customStart;
      p.endDate = customEnd;
    } else {
      p.range = rangePreset === 'custom' ? '30d' : rangePreset;
    }
    if (categoryId) p.categoryId = categoryId;
    if (activeBranchId && activeBranchId !== 'all') {
      p.branchId = activeBranchId;
    }
    return p;
  }, [rangePreset, customStart, customEnd, categoryId, activeBranchId]);

  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // Load categories, commercial baseline, & check for last saved AI insight once
  useEffect(() => {
    if (!token) return;
    axios
      .get('/api/admin/categories', authHeader)
      .then((res) => setCategories(res.data?.categories || []))
      .catch(console.error);

    const dashboardParams = activeBranchId && activeBranchId !== 'all' ? { branchId: activeBranchId } : {};
    axios
      .get('/api/admin/analytics/dashboard', { ...authHeader, params: dashboardParams })
      .then((res) => setCommercialData(res.data))
      .catch(console.error);

    axios
      .get('/api/admin/analytics/insights/latest', authHeader)
      .then((res) => {
        if (res.data?.hasSavedInsight && res.data?.insight) {
          setSavedInsightRecord(res.data.insight);
          try {
            localStorage.setItem('store_last_ai_insight', JSON.stringify(res.data.insight));
          } catch {}
        }
      })
      .catch(console.error);
  }, [token, activeBranchId]);

  // Load Store Overview
  const fetchOverview = () => {
    if (!token) return;
    setOverviewLoading(true);
    setOverviewError('');
    axios
      .get('/api/admin/analytics/overview', {
        params: rangeParams,
        ...authHeader
      })
      .then((res) => setOverviewData(res.data))
      .catch((err) => {
        setOverviewError(err.response?.data?.error || 'تعذر تحميل مؤشرات الأداء التحليلية');
      })
      .finally(() => setOverviewLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, [token, JSON.stringify(rangeParams), activeBranchId]);

  // Load Product Rankings independently
  useEffect(() => {
    if (!token) return;
    setRankingsLoading(true);
    axios
      .get('/api/admin/analytics/rankings', {
        params: {
          ...rangeParams,
          metric: rankingMetric,
          order: rankingOrder,
          limit: rankingLimit
        },
        ...authHeader
      })
      .then((res) => setRankingsData(res.data))
      .catch(console.error)
      .finally(() => setRankingsLoading(false));
  }, [token, JSON.stringify(rangeParams), rankingMetric, rankingOrder, rankingLimit, activeBranchId]);

  // Load Customer Cancellation Report
  useEffect(() => {
    if (!token) return;
    setCancelLoading(true);
    axios
      .get('/api/admin/analytics/customers/cancellations', {
        params: {
          ...rangeParams,
          sortBy: cancelSortBy,
          allTime: cancelAllTime ? 'true' : 'false'
        },
        ...authHeader
      })
      .then((res) => setCancelReport(res.data))
      .catch(console.error)
      .finally(() => setCancelLoading(false));
  }, [token, JSON.stringify(rangeParams), cancelSortBy, cancelAllTime, activeBranchId]);

  // On-demand AI Store Insights Generator
  const handleGenerateInsights = async () => {
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const res = await axios.post(
        '/api/admin/analytics/insights/generate',
        rangeParams,
        authHeader
      );
      const report = res.data?.report || (res.data?.insights ? res.data : null);
      if (report && Array.isArray(report.insights) && report.insights.length > 0) {
        setInsightsData(report);
        setSavedInsightRecord(report);
        setInsightsError('');
        try {
          localStorage.setItem('store_last_ai_insight', JSON.stringify(report));
        } catch {}
      } else {
        setInsightsError('لم يتم توليد أي رؤى تحليلية للفترة المحددة.');
      }
    } catch (err) {
      setInsightsError(err.response?.data?.error || 'حدث خطأ أثناء توليد الرؤى الذكية بالذكاء الاصطناعي');
    } finally {
      setInsightsLoading(false);
    }
  };

  // Load Last Saved AI Insight
  const handleLoadSavedInsight = async () => {
    setLoadingSavedInsight(true);
    setInsightsError('');
    try {
      const res = await axios.get('/api/admin/analytics/insights/latest', authHeader);
      if (res.data?.hasSavedInsight && res.data?.insight) {
        setInsightsData(res.data.insight);
        setSavedInsightRecord(res.data.insight);
        try {
          localStorage.setItem('store_last_ai_insight', JSON.stringify(res.data.insight));
        } catch {}
        showToast('تم استرجاع وعرض آخر تقرير رؤى ذكية محفوظ بنجاح 📋');
      } else if (savedInsightRecord) {
        setInsightsData(savedInsightRecord);
        showToast('تم استرجاع الرؤى المحفوظة محلياً 📋');
      } else {
        showToast('لا توجد تقارير رؤى ذكية محفوظة سابقاً في قاعدة البيانات', 'error');
      }
    } catch (err) {
      if (savedInsightRecord) {
        setInsightsData(savedInsightRecord);
        showToast('تم استرجاع الرؤى المحفوظة محلياً 📋');
      } else {
        showToast(err.response?.data?.error || 'تعذر استرجاع الرؤية المحفوظة', 'error');
      }
    } finally {
      setLoadingSavedInsight(false);
    }
  };

  // If drilling down into a specific product's analytics
  if (selectedProductId) {
    return (
      <ProductAnalyticsView
        productId={selectedProductId}
        rangeParams={rangeParams}
        onBack={() => setSelectedProductId(null)}
      />
    );
  }

  const period = overviewData?.period;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Local Branch Selector for Analytics */}
      <AdminBranchSelector
        label="تصفية الحسابات والتحليلات حسب الفرع:"
        onChange={() => {
          fetchOverview();
        }}
      />

      {/* 1. Unified Filter & Date Range Bar + Generate AI Insights CTA */}
      <div className="p-5 rounded-card bg-surface border border-line shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <span>مركز تحليلات أنشطة المتجر والأداء التجاري ورؤى الـ AI</span>
            </h3>
            {period && (
              <p className="text-[11px] font-bold text-ink-soft flex flex-wrap items-center gap-2">
                <span>
                  الفترة الحالية: من{' '}
                  <strong className="text-ink">
                    {new Date(period.startDate).toLocaleDateString('ar-EG')}
                  </strong>{' '}
                  إلى{' '}
                  <strong className="text-ink">
                    {new Date(period.endDate).toLocaleDateString('ar-EG')}
                  </strong>{' '}
                  ({period.daysSpan} يوماً)
                </span>
                <span>•</span>
                <span>
                  التجميع الزمني: <strong className="text-primary">{period.interval === 'week' ? 'أسبوعي' : 'يومي'}</strong>
                </span>
                <span>•</span>
                <span>
                  المنطقة الزمنية: <strong dir="ltr">{period.timezone}</strong>
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchOverview}
              className="p-2.5 rounded-btn bg-paper hover:bg-surface text-ink border border-line text-xs font-bold flex items-center gap-1.5 transition-all"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${overviewLoading ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSavedInsight}
              disabled={loadingSavedInsight || insightsLoading}
              className="px-3.5 py-2.5 rounded-btn bg-paper hover:bg-surface text-ink border border-line text-xs font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
              title={
                savedInsightRecord?.generatedAt
                  ? `آخر تقرير محفوظ بتاريخ: ${new Date(savedInsightRecord.generatedAt).toLocaleString('ar-EG')}`
                  : 'استرجاع وعرض آخر تقرير رؤى ذكية تم توليده وحفظه'
              }
            >
              <History className={`w-4 h-4 text-indigo-600 ${loadingSavedInsight ? 'animate-spin' : ''}`} />
              <span>
                {loadingSavedInsight
                  ? 'جاري التحميل...'
                  : 'تحميل آخر رؤية محفوظة'}
              </span>
            </button>

            {(insightsData || savedInsightRecord) && (
              <button
                type="button"
                onClick={() => exportInsightsPdf(insightsData || savedInsightRecord, config, overviewData?.current, showToast)}
                className="px-3.5 py-2.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all"
                title="تصدير وتحميل تقرير الرؤى الذكية بصيغة PDF"
              >
                <Download className="w-4 h-4" />
                <span>تحميل التقرير PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerateInsights}
              disabled={insightsLoading}
              className="px-4 py-2.5 rounded-btn bg-gradient-to-r from-indigo-600 via-primary to-sky-600 hover:opacity-95 text-white text-xs font-black shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-orange-300 ${insightsLoading ? 'animate-spin' : ''}`} />
              <span>{insightsLoading ? 'جاري تحليل المتجر وتوليد الرؤى...' : 'توليد رؤى المتجر بالـ AI (Generate Insights)'}</span>
            </button>
          </div>
        </div>

        {/* Date Range & Category Controls */}
        <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-ink-soft flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-primary" /> النطاق الزمني:
            </span>
            {[
              { id: '7d', label: 'آخر 7 أيام' },
              { id: '30d', label: 'آخر 30 يوماً' },
              { id: '90d', label: 'آخر 90 يوماً' },
              { id: 'custom', label: 'نطاق مخصص' }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setRangePreset(preset.id)}
                className={`px-3 py-1.5 rounded-btn font-black transition-all ${
                  rangePreset === preset.id
                    ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-xs'
                    : 'bg-paper text-ink border border-line hover:border-primary/40'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {rangePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-paper border border-line rounded-btn px-2.5 py-1 text-xs font-bold"
                />
                <span className="text-ink-soft">إلى</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-paper border border-line rounded-btn px-2.5 py-1 text-xs font-bold"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-ink-soft flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-primary" /> فلتر القسم:
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="bg-paper border border-line rounded-btn px-3 py-1.5 text-xs font-bold outline-none"
            >
              <option value="">جميع أقسام المتجر ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.displayName || cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-Sections Navigation Pills (Linked to React Router routes) */}
        <div className="pt-2 flex flex-wrap gap-2 text-xs font-black">
          {[
            { id: 'overview', label: 'المؤشرات العامة والرسوم الزمنية والقمع', icon: BarChart3 },
            { id: 'rankings', label: 'ترتيب وتصنيف المنتجات (16 معياراً)', icon: TrendingUp },
            { id: 'cancellations', label: 'تقرير إلغاءات ومرتجعات العملاء', icon: Users },
            { id: 'commercial', label: 'المالية وتنبيهات المخزون والأقسام', icon: DollarSign }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubView(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all ${
                  active
                    ? 'bg-secondary text-white border-secondary shadow-sm'
                    : 'bg-paper text-ink border-line hover:bg-surface'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. AI Store Insights Panel */}
      <AnalyticsAiInsightsPanel
        insightsLoading={insightsLoading}
        insightsError={insightsError}
        insightsData={insightsData}
        onExportPdf={(report) => exportInsightsPdf(report, config, overviewData?.current, showToast)}
        onClose={() => setInsightsData(null)}
      />

      {/* 3. Sub-View Panels */}
      {activeSubView === 'overview' && (
        <AnalyticsOverviewTab
          overviewLoading={overviewLoading}
          overviewError={overviewError}
          overviewData={overviewData}
          currency={currency}
        />
      )}

      {activeSubView === 'rankings' && (
        <ProductRankingsTab
          rankingsLoading={rankingsLoading}
          rankingsData={rankingsData}
          rankingMetric={rankingMetric}
          setRankingMetric={setRankingMetric}
          rankingOrder={rankingOrder}
          setRankingOrder={setRankingOrder}
          rankingLimit={rankingLimit}
          setRankingLimit={setRankingLimit}
          onSelectProduct={(id) => setSelectedProductId(id)}
          currency={currency}
        />
      )}

      {activeSubView === 'cancellations' && (
        <CustomerCancellationsTab
          cancelLoading={cancelLoading}
          cancelReport={cancelReport}
          cancelSortBy={cancelSortBy}
          setCancelSortBy={setCancelSortBy}
          cancelAllTime={cancelAllTime}
          setCancelAllTime={setCancelAllTime}
          currency={currency}
        />
      )}

      {activeSubView === 'commercial' && (
        <CommercialDashboardTab
          commercialData={commercialData}
          onSelectProduct={(id) => setSelectedProductId(id)}
          currency={currency}
        />
      )}
    </div>
  );
}
