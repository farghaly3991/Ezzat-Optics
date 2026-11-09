import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Receipt,
  Boxes,
  Users,
  Wrench,
  Truck,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Save,
  DownloadCloud,
  ChevronLeft,
  X,
  ExternalLink,
  Info,
  CalendarClock,
  Building2,
  PieChart,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Scale,
  ShieldCheck,
  CheckCircle,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

export default function CommercialLedgerPanel({
  token,
  currency = 'ج.م',
  showToast
}) {
  const { activeBranchId } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState(null);
  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownSection, setDrillDownSection] = useState('all'); // 'all' | 'revenues' | 'expenses' | 'profit'
  const [showSnapshotsArchive, setShowSnapshotsArchive] = useState(false);
  const [snapshotsList, setSnapshotsList] = useState([]);

  // Period Filter & Audit Reconciliation State
  const [periodPreset, setPeriodPreset] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);

  const getPeriodDates = (preset, customS, customE) => {
    const now = new Date();
    if (preset === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: s.toISOString(), end: e.toISOString() };
    }
    if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const s = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      const e = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      return { start: s.toISOString(), end: e.toISOString() };
    }
    if (preset === 'week') {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      return { start: s.toISOString(), end: now.toISOString() };
    }
    if (preset === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { start: s.toISOString(), end: now.toISOString() };
    }
    if (preset === 'last_month') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s.toISOString(), end: e.toISOString() };
    }
    if (preset === 'custom' && customS && customE) {
      const s = new Date(customS + 'T00:00:00');
      const e = new Date(customE + 'T23:59:59');
      return { start: s.toISOString(), end: e.toISOString() };
    }
    return { start: undefined, end: undefined };
  };

  // Load Live Ledger Data with selected Period
  const loadLedgerData = async (presetOverride, sOverride, eOverride) => {
    try {
      setLoading(true);
      const targetPreset = presetOverride !== undefined ? presetOverride : periodPreset;
      const targetStart = sOverride !== undefined ? sOverride : customStart;
      const targetEnd = eOverride !== undefined ? eOverride : customEnd;
      const { start, end } = getPeriodDates(targetPreset, targetStart, targetEnd);

      const res = await axios.get('/api/admin/finance/commercial-ledger', {
        ...authHeader,
        params: {
          branchId: activeBranchId || undefined,
          periodStart: start,
          periodEnd: end
        }
      });
      if (res.data?.ledger) {
        setLedger(res.data.ledger);
        setActiveSnapshot(null); // Return to live mode
      }
    } catch (err) {
      console.error('Failed to load commercial ledger:', err);
      if (showToast) showToast('فشل تجميع بيانات الحسابات التجارية', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadLedgerData();
    }
  }, [token, activeBranchId, periodPreset]);

  // Run On-Demand Audit Reconciliation
  const handleRunAuditReconciliation = async () => {
    try {
      setReconciling(true);
      const { start, end } = getPeriodDates(periodPreset, customStart, customEnd);
      const res = await axios.get('/api/admin/finance/commercial-ledger/reconcile-audit', {
        ...authHeader,
        params: {
          branchId: activeBranchId || undefined,
          periodStart: start,
          periodEnd: end
        }
      });
      if (res.data?.reconciliation) {
        setReconciliationData(res.data.reconciliation);
        setShowReconciliationModal(true);
        if (showToast) showToast('تمت مطابقة الحسابات وسجل الرقابة بنجاح!');
      }
    } catch (err) {
      console.error('Failed to run audit reconciliation:', err);
      if (showToast) showToast('تعذر إجراء فحص مطابقة سجل الرقابة', 'error');
    } finally {
      setReconciling(false);
    }
  };

  // Save current stats to DB as a persistent audit snapshot
  const handleSaveSnapshot = async () => {
    try {
      setSavingSnapshot(true);
      const res = await axios.post(
        '/api/admin/finance/commercial-ledger/snapshot',
        { branchId: activeBranchId || undefined, periodPreset: 'all_time' },
        authHeader
      );
      if (res.data?.snapshot) {
        setActiveSnapshot(res.data.snapshot);
        if (showToast) showToast('تم حفظ لقطة إحصائية شاملة في قاعدة البيانات بنجاح!');
      }
    } catch (err) {
      console.error('Failed to save snapshot:', err);
      if (showToast) showToast('فشل حفظ اللقطة الإحصائية', 'error');
    } finally {
      setSavingSnapshot(false);
    }
  };

  // Quick Load latest saved snapshot
  const handleQuickLoadLatest = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/finance/commercial-ledger/latest-snapshot', {
        ...authHeader,
        params: { branchId: activeBranchId || undefined }
      });
      if (res.data?.snapshot) {
        setActiveSnapshot(res.data.snapshot);
        setLedger(res.data.snapshot);
        if (showToast) showToast(`تم تحميل اللقطة الإحصائية المحفوظة (${res.data.snapshot.snapshotNumber})`);
      } else {
        if (showToast) showToast('لا توجد لقطة محفوظة مسبقاً، يمكنك حفظ لقطة الآن', 'info');
      }
    } catch (err) {
      console.error('Failed to quick load snapshot:', err);
      if (showToast) showToast('فشل جلب آخر لقطة إحصائية', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open archive modal & fetch past snapshots
  const handleOpenSnapshotsArchive = async () => {
    setShowSnapshotsArchive(true);
    try {
      const res = await axios.get('/api/admin/finance/commercial-ledger/snapshots', {
        ...authHeader,
        params: { branchId: activeBranchId || undefined }
      });
      setSnapshotsList(res.data?.snapshots || []);
    } catch (err) {
      console.error('Failed to list snapshots:', err);
    }
  };

  const handleSelectPastSnapshot = (snap) => {
    setActiveSnapshot(snap);
    setLedger(snap);
    setShowSnapshotsArchive(false);
    if (showToast) showToast(`تم استعراض لقطة تاريخ: ${new Date(snap.createdAt).toLocaleDateString('ar-EG')}`);
  };

  const currentData = ledger || {};
  const rev = currentData.revenues || {};
  const exp = currentData.expenses || {};
  const assets = currentData.assets || {};
  const net = currentData.netResults || {};
  const ai = currentData.aiInsight || {};

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Control Actions */}
      <div className="p-5 rounded-3xl bg-surface border border-line flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-ink">
                  إدارة الحسابات التجارية والإحصاءات الشاملة (Commercial Ledger)
                </h3>
                {activeSnapshot ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-900 border border-blue-500/30 text-[10px] font-bold font-mono">
                    لقطة محفوظة: {activeSnapshot.snapshotNumber} ({new Date(activeSnapshot.createdAt).toLocaleDateString('ar-EG')})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-950 border border-emerald-500/30 text-[10px] font-bold">
                    قراءات وإحصائيات حية لحظية
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                تفكيك شامل لكافة مصادر الدخل، أرباح المنتجات، أرباح الأقساط المكتملة، الصيانة، الأصول، وصافي المرتبات والمصروفات
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSnapshot && (
            <button
              type="button"
              onClick={loadLedgerData}
              className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>العودة للحسابات الحية</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadLedgerData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="تحديث الأرقام"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={handleQuickLoadLatest}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="تحميل سريع لآخر لقطة إحصائية محفوظة بالداتابيس"
          >
            <DownloadCloud className="w-4 h-4 text-primary" />
            <span>تحميل سريع لآخر لقطة</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSnapshotsArchive}
            className="p-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors flex items-center gap-1 text-xs font-bold"
            title="سجل اللقطات الإحصائية السابقة"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSaveSnapshot}
            disabled={savingSnapshot || loading}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingSnapshot ? 'جاري الحفظ...' : 'حفظ لقطة في السجل'}</span>
          </button>
        </div>
      </div>

      {/* Period Filter & On-Demand Audit Reconciliation Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-ink-soft ml-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            الفترة المحاسبية:
          </span>
          {[
            { id: 'all', label: 'كامل المدة' },
            { id: 'today', label: 'اليوم' },
            { id: 'yesterday', label: 'أمس' },
            { id: 'week', label: 'آخر 7 أيام' },
            { id: 'month', label: 'هذا الشهر' },
            { id: 'last_month', label: 'الشهر الماضي' },
            { id: 'custom', label: 'فترة مخصصة' }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setPeriodPreset(preset.id);
                if (preset.id !== 'custom') {
                  loadLedgerData(preset.id);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodPreset === preset.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-paper hover:bg-surface text-ink-soft hover:text-ink border border-line'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 mr-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-line bg-paper text-ink"
              />
              <span className="text-xs text-ink-soft">إلى</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-line bg-paper text-ink"
              />
              <button
                type="button"
                onClick={() => loadLedgerData('custom', customStart, customEnd)}
                className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover"
              >
                تطبيق
              </button>
            </div>
          )}
        </div>

        {/* On-Demand Audit Reconciliation Button (Runs only when clicked) */}
        <button
          type="button"
          onClick={handleRunAuditReconciliation}
          disabled={reconciling || loading}
          className="px-3.5 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-900 border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
          title="فحص مطابقة العمليات المالية مع سجل الرقابة والأحداث (Audit Reconciliation)"
        >
          <Scale className={`w-4 h-4 text-purple-700 ${reconciling ? 'animate-spin' : ''}`} />
          <span>{reconciling ? 'جاري الفحص والمطابقة...' : 'مطابقة الحسابات وسجل الرقابة (Audit)'}</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-ink-soft text-sm">جاري تجميع وحساب السجلات التجارية وتدقيق الأرباح...</div>
      ) : !ledger ? (
        <div className="text-center py-20 text-ink-soft">تعذر استخراج تقرير الحسابات التجارية</div>
      ) : (
        <>
          {/* Core Four Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Revenues Card */}
            <div className="p-5 rounded-3xl bg-paper border border-line space-y-3 relative overflow-hidden shadow-xs hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink-soft">إجمالي الإيرادات الكلية</span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-900 border border-blue-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-ink">
                  {Number(rev.totalGrossRevenue || 0).toLocaleString()} <span className="text-sm font-bold text-ink-soft">{currency}</span>
                </div>
                <div className="text-[11px] text-ink-soft mt-1 flex items-center justify-between font-bold">
                  <span>مجمل ربح التشغيل:</span>
                  <span className="font-mono text-emerald-900 font-black">
                    +{Number(rev.totalGrossOperatingProfit || 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDrillDownSection('revenues');
                    setShowDrillDown(true);
                  }}
                  className="text-primary font-black hover:underline flex items-center gap-1"
                >
                  <span>تفاصيل مصادر الإيرادات</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. Estimated Net Profit Card */}
            <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950">صافي الربح التقديري المحقق</span>
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-950 border border-emerald-500/40">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-950">
                  {Number(net.estimatedNetProfit || 0).toLocaleString()} <span className="text-sm font-bold text-emerald-900">{currency}</span>
                </div>
                <div className="text-[11px] text-emerald-900 mt-1 flex items-center justify-between font-bold">
                  <span>هامش صافي الربحية:</span>
                  <span className="font-mono font-black">{net.netProfitMarginPercent || 0}%</span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDrillDownSection('profit');
                    setShowDrillDown(true);
                  }}
                  className="text-emerald-900 font-black hover:underline flex items-center gap-1"
                >
                  <span>معادلة احتساب الربح</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. Operating Expenses & Liabilities Card */}
            <div className="p-5 rounded-3xl bg-paper border border-line space-y-3 relative overflow-hidden shadow-xs hover:border-rose-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink-soft">المصروفات التشغيلية والرواتب</span>
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-900 border border-rose-500/20">
                  <ArrowDownLeft className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-rose-950">
                  {Number(exp.totalOperatingExpenses || 0).toLocaleString()} <span className="text-sm font-bold text-ink-soft">{currency}</span>
                </div>
                <div className="text-[11px] text-ink-soft mt-1 flex items-center justify-between font-bold">
                  <span>صافي الرواتب بعد الخصم:</span>
                  <span className="font-mono text-ink font-black">
                    {Number(exp.salariesNetPaid || 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDrillDownSection('expenses');
                    setShowDrillDown(true);
                  }}
                  className="text-primary font-black hover:underline flex items-center gap-1"
                >
                  <span>تفاصيل وتفكيك المصروفات</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4. Assets & Inventory Valuation Card */}
            <div className="p-5 rounded-3xl bg-paper border border-line space-y-3 relative overflow-hidden shadow-xs hover:border-amber-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink-soft">الأصول ومخزون البضائع</span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-900 border border-amber-500/20">
                  <Boxes className="w-4 h-4" />
                </span>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-ink">
                  {Number(assets.inventoryCostValue || 0).toLocaleString()} <span className="text-sm font-bold text-ink-soft">{currency}</span>
                </div>
                <div className="text-[11px] text-ink-soft mt-1 flex items-center justify-between font-bold">
                  <span>القيمة البيعية المتوقعة:</span>
                  <span className="font-mono text-amber-900 font-black">
                    {Number(assets.inventoryRetailValue || 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
                <span className="text-[10px] text-ink-soft font-bold">
                  {assets.totalStockUnits || 0} قطعة في {assets.totalProductsCount || 0} صنف
                </span>
                <span className="text-[10px] text-emerald-900 font-black">
                  ربح كامن: +{Number(assets.potentialInventoryProfit || 0).toLocaleString()} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* AI Financial & Behavioral Insight Box */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-800" />
                <h4 className="text-xs font-black text-ink">
                  الرؤية والتحليل الذكي لسلوك الحسابات (AI Behavioral & Financial Insight)
                </h4>
              </div>
              <span className="text-[10px] text-ink-soft font-mono">
                محدث بتاريخ: {ai.generatedAt ? new Date(ai.generatedAt).toLocaleTimeString('ar-EG') : 'الآن'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface/80 border border-line text-xs font-bold text-ink leading-relaxed">
              {ai.summary}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Strengths */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>نقاط القوة المحققة:</span>
                </span>
                <ul className="space-y-1.5 text-[11px] text-emerald-950 list-disc list-inside">
                  {(ai.strengths || []).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Risks & Warnings */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <span className="text-[11px] font-black text-amber-950 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>تنبيهات ومخاطر محتملة:</span>
                </span>
                <ul className="space-y-1.5 text-[11px] text-amber-950 list-disc list-inside">
                  {(ai.risksAndWarnings || []).map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                <span className="text-[11px] font-black text-blue-950 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>توصيات تشغيلية تنفيذية:</span>
                </span>
                <ul className="space-y-1.5 text-[11px] text-blue-950 list-disc list-inside">
                  {(ai.recommendations || []).map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Summary Strip: Inflows, Outflows, and Uncollected Installments */}
          <div className="p-4 rounded-2xl bg-paper border border-line flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-600" />
              <span>مستحقات التقسيط القائمة بذمة العملاء (لم تُسدد بعد):</span>
              <span className="font-mono text-amber-900 font-black text-sm">
                {Number(exp.installmentOutstandingReceivables || 0).toLocaleString()} {currency}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>إجمالي خصومات وجزاءات الموظفين المقتطعة:</span>
              <span className="font-mono text-emerald-900 font-black">
                -{Number(exp.salariesDeductions || 0).toLocaleString()} {currency}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setDrillDownSection('all');
                setShowDrillDown(true);
              }}
              className="px-4 py-2 rounded-xl bg-primary text-white font-black text-xs shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              <span>فتح نافذة التفاصيل المعمقة للحسابات</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* DRILL-DOWN MODAL (تفاصيل إجمالي الإيرادات، المصروفات، وصافي الربح) */}
      {showDrillDown && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface border border-line rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-line bg-paper/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-ink">
                    تفاصيل وتفكيك الحسابات والأرباح والمصروفات
                  </h3>
                  <p className="text-[11px] text-ink-soft">
                    جدول البنود الدقيقة للإيرادات، التكاليف المباشرة، والمصروفات التشغيلية
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-surface border border-line p-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDrillDownSection('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      drillDownSection === 'all' ? 'bg-primary text-white' : 'text-ink-soft'
                    }`}
                  >
                    الشامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrillDownSection('revenues')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      drillDownSection === 'revenues' ? 'bg-primary text-white' : 'text-ink-soft'
                    }`}
                  >
                    الإيرادات
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrillDownSection('expenses')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      drillDownSection === 'expenses' ? 'bg-primary text-white' : 'text-ink-soft'
                    }`}
                  >
                    المصروفات
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrillDownSection('profit')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      drillDownSection === 'profit' ? 'bg-primary text-white' : 'text-ink-soft'
                    }`}
                  >
                    صافي الربح
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDrillDown(false)}
                  className="p-2 rounded-xl text-ink-soft hover:text-ink hover:bg-paper"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* SECTION 1: REVENUES BREAKDOWN */}
              {(drillDownSection === 'all' || drillDownSection === 'revenues') && (
                <div className="space-y-3">
                  <h4 className="font-black text-ink flex items-center gap-1.5 border-b border-line pb-2">
                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                    <span>1. تفاصيل مصادر الإيرادات ومجمل الربح التجاري</span>
                  </h4>

                  <div className="border border-line rounded-2xl overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-paper text-ink-soft font-bold text-[11px] border-b border-line">
                        <tr>
                          <th className="p-3">مصدر الإيراد</th>
                          <th className="p-3">الإيراد الإجمالي</th>
                          <th className="p-3">التكلفة المباشرة (COGS / قطع)</th>
                          <th className="p-3">مجمل الربح المحقق</th>
                          <th className="p-3">ملاحظات البند</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-mono font-bold">
                        {/* POS Branch Sales */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary" />
                            <span>مبيعات نقاط البيع والكاشير (POS Direct)</span>
                          </td>
                          <td className="p-3 text-ink">{Number(rev.posDirectSales || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">محسوبة إجمالاً</td>
                          <td className="p-3 text-emerald-900">مشمولة بتجارة البضائع</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">استلام مباشر من الفرع وفواتير كاشير</td>
                        </tr>

                        {/* Online Store Sales */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                            <span>مبيعات المتجر الأونلاين (Online Store)</span>
                          </td>
                          <td className="p-3 text-ink">{Number(rev.onlineStoreSales || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">محسوبة إجمالاً</td>
                          <td className="p-3 text-emerald-900">مشمولة بتجارة البضائع</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">طلبات المنصة والشحن المنزلي</td>
                        </tr>

                        {/* Total Merchandise & COGS */}
                        <tr className="bg-paper/40">
                          <td className="p-3 font-sans font-black text-ink">
                            إجمالي تجارة المنتجات المادية (POS + Online)
                          </td>
                          <td className="p-3 text-ink">{Number(rev.totalMerchandiseSales || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-rose-950 font-black">-{Number(rev.merchandiseCogs || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-emerald-900 font-black">+{Number(rev.merchandiseGrossProfit || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-emerald-900 font-bold">هامش ربح تجارة البضائع</td>
                        </tr>

                        {/* Installments Cash Collected */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                            <span>تحصيلات التقسيط المباشر (مقدمات + أقساط مسددة)</span>
                          </td>
                          <td className="p-3 text-amber-900">{Number(rev.installmentCashCollected || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">--</td>
                          <td className="p-3 text-ink-soft">تدفق نقدي بالخزينة</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">السيولة النقدية الداخلة فعلياً من أقساط العملاء</td>
                        </tr>

                        {/* Completed Installment Interest Profit */}
                        <tr>
                          <td className="p-3 font-sans font-black text-amber-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>أرباح فوائد وهامش الأقساط المكتملة تحديداً</span>
                          </td>
                          <td className="p-3 text-amber-900">--</td>
                          <td className="p-3 text-ink-soft">0 {currency}</td>
                          <td className="p-3 text-amber-900 font-black">+{Number(rev.installmentCompletedProfit || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-amber-900 font-bold">أرباح قطعية محققة من عقود التقسيط المنتهية بالكامل</td>
                        </tr>

                        {/* Maintenance & Repairs */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-orange-600" />
                            <span>إيرادات وأرباح الصيانة الفنية المكتملة</span>
                          </td>
                          <td className="p-3 text-ink">{Number(rev.maintenanceRevenue || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-rose-950">-{Number(rev.maintenancePartsCost || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-emerald-900 font-black">+{Number(rev.maintenanceNetProfit || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">رسوم الصيانة بعد خصم قطع الغيار المستهلكة</td>
                        </tr>

                        {/* Shipping Profit or Subsidy */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            <span>أرباح / دعم الشحن والتوصيل المنزلي</span>
                          </td>
                          <td className="p-3 text-ink">{Number(rev.customerShippingCollected || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-rose-950">-{Number(rev.carrierActualShippingCost || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-black text-ink">
                            {Number(rev.shippingProfitOrSubsidy || 0) >= 0 ? '+' : ''}
                            {Number(rev.shippingProfitOrSubsidy || 0).toLocaleString()} {currency}
                          </td>
                          <td className="p-3 font-sans text-ink-soft font-normal">
                            {Number(rev.shippingProfitOrSubsidy || 0) >= 0 ? 'ربح شحن' : 'دعم شحن يتحمله المتجر'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 2: ASSETS & INVENTORY VALUATION */}
              {(drillDownSection === 'all') && (
                <div className="space-y-3">
                  <h4 className="font-black text-ink flex items-center gap-1.5 border-b border-line pb-2">
                    <Boxes className="w-4 h-4 text-amber-600" />
                    <span>2. تفاصيل الأصول ومخزون البضائع بالمستودعات</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-paper border border-line">
                      <span className="text-[11px] text-ink-soft font-bold block">القيمة الفعلية للبضاعة بسعر التكلفة:</span>
                      <span className="text-base font-black text-ink font-mono">
                        {Number(assets.inventoryCostValue || 0).toLocaleString()} {currency}
                      </span>
                      <span className="text-[10px] text-ink-soft block mt-0.5">أصل مالي متداول في المستودعات</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-paper border border-line">
                      <span className="text-[11px] text-ink-soft font-bold block">القيمة البيعية المتوقعة للمخزون:</span>
                      <span className="text-base font-black text-amber-900 font-mono">
                        {Number(assets.inventoryRetailValue || 0).toLocaleString()} {currency}
                      </span>
                      <span className="text-[10px] text-ink-soft block mt-0.5">في حال بيع كامل القطع المتوفرة</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-[11px] text-emerald-950 font-bold block">الربح الكامن في المخزن:</span>
                      <span className="text-base font-black text-emerald-950 font-mono">
                        +{Number(assets.potentialInventoryProfit || 0).toLocaleString()} {currency}
                      </span>
                      <span className="text-[10px] text-emerald-900 block mt-0.5">فارق البيع عن التكلفة الإجمالية</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: EXPENSES BREAKDOWN */}
              {(drillDownSection === 'all' || drillDownSection === 'expenses') && (
                <div className="space-y-3">
                  <h4 className="font-black text-ink flex items-center gap-1.5 border-b border-line pb-2">
                    <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                    <span>3. تفاصيل وتفكيك المصروفات التشغيلية والرواتب</span>
                  </h4>

                  <div className="border border-line rounded-2xl overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-paper text-ink-soft font-bold text-[11px] border-b border-line">
                        <tr>
                          <th className="p-3">بند المصروف</th>
                          <th className="p-3">المبلغ الإجمالي</th>
                          <th className="p-3">تخفيضات / خصومات مطبقة</th>
                          <th className="p-3">الصافي المنصرف فعلياً</th>
                          <th className="p-3">الوصف والملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-mono font-bold">
                        {/* Staff Salaries */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            <span>مرتبات الموظفين (رواتب ثابتة + مهام)</span>
                          </td>
                          <td className="p-3 text-ink">{Number(exp.salariesBase || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-emerald-900">-{Number(exp.salariesDeductions || 0).toLocaleString()} {currency} (خصومات وجزاءات)</td>
                          <td className="p-3 text-rose-950 font-black">{Number(exp.salariesNetPaid || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">صافي استحقاق الموظفين بعد استقطاع الجزاءات</td>
                        </tr>

                        {/* Couriers */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            <span>التكلفة الفعلية للدليفري المستقل وشركات الشحن</span>
                          </td>
                          <td className="p-3 text-ink">{Number(exp.independentCouriersCost || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">--</td>
                          <td className="p-3 text-rose-950 font-black">{Number(exp.independentCouriersCost || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">مستحقات المناديب المستقلين وشركات النقل</td>
                        </tr>

                        {/* Rent */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>إيجار المقرات والفروع والمخازن</span>
                          </td>
                          <td className="p-3 text-ink">{Number(exp.rentExpenses || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">--</td>
                          <td className="p-3 text-rose-950 font-black">{Number(exp.rentExpenses || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">عقود إيجار المحلات والمستودعات</td>
                        </tr>

                        {/* Utilities */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink">فواتير المرافق (كهرباء / مياه / غاز / إنترنت)</td>
                          <td className="p-3 text-ink">{Number(exp.utilitiesExpenses || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">--</td>
                          <td className="p-3 text-rose-950 font-black">{Number(exp.utilitiesExpenses || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">الفواتير الدورية المسجلة للمقرات</td>
                        </tr>

                        {/* General Expenses */}
                        <tr>
                          <td className="p-3 font-sans font-bold text-ink">مصروفات عمومية وإدارية ونثريات وبوفيه</td>
                          <td className="p-3 text-ink">{Number(exp.generalOperatingExpenses || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 text-ink-soft">--</td>
                          <td className="p-3 text-rose-950 font-black">{Number(exp.generalOperatingExpenses || 0).toLocaleString()} {currency}</td>
                          <td className="p-3 font-sans text-ink-soft font-normal">مستلزمات تشغيلية وصيانة دورية ودعاية</td>
                        </tr>

                        {/* Total Operating Expenses */}
                        <tr className="bg-rose-500/5">
                          <td className="p-3 font-sans font-black text-rose-950">إجمالي المصروفات التشغيلية الكلية</td>
                          <td className="p-3 text-rose-950 font-black" colSpan={2}>
                            (رواتب + شحن + إيجارات + مرافق + نثريات)
                          </td>
                          <td className="p-3 text-rose-950 font-black text-sm">
                            {Number(exp.totalOperatingExpenses || 0).toLocaleString()} {currency}
                          </td>
                          <td className="p-3 font-sans text-rose-950 font-bold">إجمالي عبء التشغيل</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 4: NET PROFIT FORMULA BREAKDOWN */}
              {(drillDownSection === 'all' || drillDownSection === 'profit') && (
                <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
                  <h4 className="font-black text-ink flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>4. معادلة احتساب صافي الربح التقديري (Net Profit Formula)</span>
                  </h4>

                  <div className="space-y-2 text-xs font-mono font-bold">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-surface">
                      <span className="font-sans font-bold text-ink">مجمل أرباح تجارة البضائع (المبيعات - تكلفة الشراء):</span>
                      <span className="text-emerald-900">+{Number(rev.merchandiseGrossProfit || 0).toLocaleString()} {currency}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-surface">
                      <span className="font-sans font-bold text-ink">أرباح فوائد التقسيط المكتملة تحديداً:</span>
                      <span className="text-emerald-900">+{Number(rev.installmentCompletedProfit || 0).toLocaleString()} {currency}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-surface">
                      <span className="font-sans font-bold text-ink">صافي أرباح الصيانة الفنية:</span>
                      <span className="text-emerald-900">+{Number(rev.maintenanceNetProfit || 0).toLocaleString()} {currency}</span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-surface">
                      <span className="font-sans font-bold text-ink">فارق أرباح الشحن والتوصيل:</span>
                      <span className="text-ink">
                        {Number(rev.shippingProfitOrSubsidy || 0) >= 0 ? '+' : ''}
                        {Number(rev.shippingProfitOrSubsidy || 0).toLocaleString()} {currency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-surface text-rose-950">
                      <span className="font-sans font-bold">مطروحاً منه: المصروفات التشغيلية والرواتب والإيجار:</span>
                      <span>-{Number(exp.totalOperatingExpenses - (exp.independentCouriersCost || 0)).toLocaleString()} {currency}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm font-black text-emerald-950">
                      <span className="font-sans font-black">النتيجة: صافي الربح التقديري المحقق</span>
                      <span className="text-base font-black">
                        {Number(net.estimatedNetProfit || 0).toLocaleString()} {currency} ({net.netProfitMarginPercent || 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SNAPSHOTS ARCHIVE MODAL */}
      {showSnapshotsArchive && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-line rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h4 className="text-sm font-black text-ink">سجل اللقطات الإحصائية للحسابات المحفوظة</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshotsArchive(false)}
                className="p-1 rounded-lg text-ink-soft hover:bg-paper"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-soft">
              يمكنك استعراض أي لقطة سابقة تم حفظها بميعادها وتاريخها لمقارنة فترات الأداء:
            </p>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {snapshotsList.length === 0 ? (
                <div className="p-8 text-center text-ink-soft text-xs">لا توجد لقطات محفوظة سابقة</div>
              ) : (
                snapshotsList.map((snap) => (
                  <div
                    key={snap._id}
                    onClick={() => handleSelectPastSnapshot(snap)}
                    className="p-3 rounded-2xl bg-paper border border-line hover:border-primary/50 transition-all flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-ink flex items-center gap-2">
                        <span className="font-mono">{snap.snapshotNumber}</span>
                        <span className="text-[10px] text-ink-soft font-normal">
                          بواسطة: {snap.generatedByName}
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-soft mt-0.5">
                        التاريخ: {new Date(snap.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'full' })} - {new Date(snap.createdAt).toLocaleTimeString('ar-EG')}
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <div className="font-black text-emerald-900">
                        ربح: {Number(snap.netResults?.estimatedNetProfit || 0).toLocaleString()} {currency}
                      </div>
                      <div className="text-[10px] text-ink-soft">
                        إيراد: {Number(snap.revenues?.totalGrossRevenue || 0).toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Audit Reconciliation Modal */}
      {showReconciliationModal && reconciliationData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-line rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-700 flex items-center justify-center font-bold">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-ink">
                    تقرير مطابقة الحسابات وسجل الرقابة (Audit Reconciliation)
                  </h4>
                  <p className="text-xs text-ink-soft">
                    مقارنة حركة الخزينة والإيرادات الفعلية مع سجل الأحداث والعمليات الملغاة/المتراجعة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReconciliationModal(false)}
                className="p-1 rounded-lg text-ink-soft hover:bg-paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reconciliation Match Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                reconciliationData.status === 'MATCHED'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {reconciliationData.status === 'MATCHED' ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <div className="text-sm font-black">
                    {reconciliationData.status === 'MATCHED'
                      ? 'الحسابات مطابقة تماماً لسجل الرقابة'
                      : 'توجد فروقات تحتاج إلى مراجعة وتدقيق'}
                  </div>
                  <div className="text-xs opacity-80 mt-0.5">
                    نسبة المطابقة والاتساق: {reconciliationData.reconciliationRate}%
                  </div>
                </div>
              </div>
              <div className="text-left font-mono text-sm font-black">
                الفرق: {Number(reconciliationData.netDiscrepancy || 0).toLocaleString()} {currency}
              </div>
            </div>

            {/* Inflows vs Outflows Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-paper border border-line space-y-2">
                <div className="text-xs font-bold text-ink-soft">المدخلات والمقبوضات الفعلية</div>
                <div className="text-xl font-black text-ink font-mono">
                  {Number(reconciliationData.ledgerInflows || 0).toLocaleString()} {currency}
                </div>
                <div className="text-[11px] text-ink-soft">
                  مقابل أحداث الإيداع والبيع المسجلة: {Number(reconciliationData.auditInflows || 0).toLocaleString()} {currency}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-paper border border-line space-y-2">
                <div className="text-xs font-bold text-ink-soft">المصروفات والمسحوبات</div>
                <div className="text-xl font-black text-ink font-mono">
                  {Number(reconciliationData.ledgerOutflows || 0).toLocaleString()} {currency}
                </div>
                <div className="text-[11px] text-ink-soft">
                  مقابل أحداث الصرف المسجلة: {Number(reconciliationData.auditOutflows || 0).toLocaleString()} {currency}
                </div>
              </div>
            </div>

            {/* Detected Voids & Reversals in Audit */}
            <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                  عمليات التراجع والإلغاء المرصودة في الرقابة (Reversals & Voids)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface text-ink text-[11px] font-mono font-bold">
                  {reconciliationData.voidsCount || 0} عملية
                </span>
              </div>
              <p className="text-[11px] text-ink-soft leading-relaxed">
                يقوم النظام تلقائياً بتتبع أي مبالغ تم استردادها أو إلغاؤها بعد تسجيلها في سجل الأحداث الرقابية للتأكد من عدم وجود تلاعب أو عجز خفي في صندوق النقدية.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowReconciliationModal(false)}
                className="px-5 py-2.5 rounded-xl bg-paper hover:bg-surface border border-line text-xs font-bold text-ink transition-colors"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
