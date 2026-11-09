import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Plus,
  RotateCcw,
  RefreshCw,
  Scale
} from 'lucide-react';
import axios from 'axios';

const PRESET_RANGES = [
  { key: 'today', label: 'اليوم (Today)' },
  { key: 'yesterday', label: 'أمس (Yesterday)' },
  { key: 'current_week', label: 'الأسبوع الحالي (Current Week)' },
  { key: 'previous_week', label: 'الأسبوع السابق (Previous Week)' },
  { key: 'current_month', label: 'الشهر الحالي (Current Month)' },
  { key: 'previous_month', label: 'الشهر السابق (Previous Month)' },
  { key: 'quarter', label: 'ربع سنوي (3 أشهر)' },
  { key: 'half_year', label: 'نصف سنوي (6 أشهر)' },
  { key: 'year', label: 'سنوي (Year)' },
  { key: 'custom', label: 'فترة مخصصة (Custom Range)' }
];

export default function FinanceReportsAccountingPanel({
  token,
  currency,
  showToast,
  financeLevel = 'advanced',
  onRefreshAudit
}) {
  const [mode, setMode] = useState('reports'); // 'reports' | 'accounting'

  // Reports State (E2 & E3)
  const [rangePreset, setRangePreset] = useState('current_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [basicDashboard, setBasicDashboard] = useState(null);
  const [advancedReport, setAdvancedReport] = useState(null);

  // Accounting State (E4)
  const [accounts, setAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [accountingLevelError, setAccountingLevelError] = useState(null);

  // Manual Journal Entry Form
  const [jeForm, setJeForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    debitAccountCode: '5200',
    creditAccountCode: '1110',
    amount: '',
    status: 'posted'
  });

  // Period Close Form
  const [periodForm, setPeriodForm] = useState({
    periodKey: new Date().toISOString().slice(0, 7),
    notes: ''
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadReports = async () => {
    try {
      const params = new URLSearchParams({ range: rangePreset });
      if (rangePreset === 'custom') {
        if (customStart) params.set('startDate', customStart);
        if (customEnd) params.set('endDate', customEnd);
      }

      const basicRes = await axios.get(`/api/admin/finance/reports/basic?${params.toString()}`, authHeader);
      setBasicDashboard(basicRes.data || null);

      if (financeLevel !== 'basic') {
        const advRes = await axios.get(`/api/admin/finance/reports/advanced?${params.toString()}`, authHeader);
        setAdvancedReport(advRes.data || null);
      } else {
        setAdvancedReport(null);
      }
    } catch (err) {
      console.error('Error loading financial reports:', err);
    }
  };

  const loadAccounting = async () => {
    setAccountingLevelError(null);
    try {
      const [accRes, jeRes, tbRes, perRes] = await Promise.all([
        axios.get('/api/admin/finance/accounting/accounts', authHeader),
        axios.get('/api/admin/finance/accounting/journal-entries', authHeader),
        axios.get('/api/admin/finance/accounting/trial-balance', authHeader),
        axios.get('/api/admin/finance/accounting/periods', authHeader)
      ]);
      setAccounts(accRes.data?.accounts || []);
      setJournalEntries(jeRes.data?.entries || []);
      setTrialBalance(tbRes.data || null);
      setPeriods(perRes.data?.periods || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setAccountingLevelError(
          err.response?.data?.error || 'تتطلب المحاسبة ذات القيد المزدوج مستوى Professional أو Enterprise'
        );
      } else {
        console.error('Error loading accounting data:', err);
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    if (mode === 'reports') {
      loadReports();
    } else {
      loadAccounting();
    }
  }, [token, mode, rangePreset, financeLevel]);

  const handleCreateBalancedJournalEntry = async (e) => {
    e.preventDefault();
    const amt = Number(jeForm.amount || 0);
    if (amt <= 0) {
      showToast('يرجى إدخال قيمة صحيحة للقيد', 'error');
      return;
    }
    try {
      await axios.post(
        '/api/admin/finance/accounting/journal-entries',
        {
          entryDate: jeForm.entryDate,
          description: jeForm.description,
          status: jeForm.status,
          idempotencyKey: `JE-UI-${Date.now()}`,
          lines: [
            { accountCode: jeForm.debitAccountCode, debit: amt, credit: 0, memo: jeForm.description },
            { accountCode: jeForm.creditAccountCode, debit: 0, credit: amt, memo: jeForm.description }
          ]
        },
        authHeader
      );
      showToast('تم ترحيل قيد اليومية المتوازن بنجاح');
      setJeForm({
        ...jeForm,
        description: '',
        amount: ''
      });
      loadAccounting();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ قيد اليومية', 'error');
    }
  };

  const handleReverseJournalEntry = async (entryId) => {
    const reason = window.prompt('يرجى إدخال سبب عكس القيد المحاسبي:');
    if (!reason) return;
    try {
      await axios.post(
        `/api/admin/finance/accounting/journal-entries/${entryId}/reverse`,
        { reason },
        authHeader
      );
      showToast('تم إنشاء قيد عكسي مقابل مع الاحتفاظ بالسجل التاريخي');
      loadAccounting();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر عكس القيد', 'error');
    }
  };

  const handleClosePeriod = async () => {
    try {
      await axios.post(
        '/api/admin/finance/accounting/periods/close',
        {
          periodKey: periodForm.periodKey,
          notes: periodForm.notes || 'إقفال الفترة المحاسبية من لوحة التحكم'
        },
        authHeader
      );
      showToast(`تم إقفال الفترة المحاسبية (${periodForm.periodKey}) ومنع الترحيل المباشر إليها`);
      loadAccounting();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر إقفال الفترة', 'error');
    }
  };

  const handleReopenPeriod = async (pKey) => {
    const reason = window.prompt(`يرجى إدخال سبب إعادة فتح الفترة المحاسبية (${pKey}):`);
    if (!reason) return;
    try {
      await axios.post(
        '/api/admin/finance/accounting/periods/reopen',
        { periodKey: pKey, reason },
        authHeader
      );
      showToast(`تم إعادة فتح الفترة (${pKey}) بتصريح موثق`);
      loadAccounting();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر إعادة فتح الفترة', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-xs font-black">
          <button
            type="button"
            onClick={() => setMode('reports')}
            className={`px-4 py-2.5 rounded-btn flex items-center gap-1.5 ${
              mode === 'reports' ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>التقارير المالية وقائمة الدخل والتدفقات النقدية (E2 & E3)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('accounting')}
            className={`px-4 py-2.5 rounded-btn flex items-center gap-1.5 ${
              mode === 'accounting' ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>المحاسبة ذات القيد المزدوج وميزان المراجعة (E4 — Professional+)</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: FINANCIAL REPORTS (E2 & E3)                                   */}
      {/* ===================================================================== */}
      {mode === 'reports' && (
        <div className="space-y-6">
          {/* Date Filter Bar */}
          <div className="p-4 rounded-card bg-surface border border-line shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink font-black">الفترة الزمنية للتقرير:</span>
              <select
                value={rangePreset}
                onChange={(e) => setRangePreset(e.target.value)}
                className="bg-paper border border-line rounded-btn px-3 py-2 text-ink font-black"
              >
                {PRESET_RANGES.map((pr) => (
                  <option key={pr.key} value={pr.key}>
                    {pr.label}
                  </option>
                ))}
              </select>

              {rangePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-paper border border-line rounded-btn p-1.5 text-ink"
                  />
                  <span>إلى</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-paper border border-line rounded-btn p-1.5 text-ink"
                  />
                  <button
                    type="button"
                    onClick={loadReports}
                    className="px-3 py-1.5 rounded-btn bg-primary text-white font-black"
                  >
                    تطبيق
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={loadReports}
              className="px-3 py-1.5 rounded-btn bg-paper border border-line flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث الأرقام</span>
            </button>
          </div>

          {/* Data Completeness Guard Banner */}
          {advancedReport?.dataCompleteness && !advancedReport.dataCompleteness.isComplete && (
            <div className="p-4 rounded-card bg-orange-500/10 border border-orange-500/30 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-black text-orange-600">
                <AlertTriangle className="w-4 h-4" />
                <span>حارس اكتمال البيانات المحاسبية (Data Completeness Guard — ربح تقديري غير نهائي):</span>
              </div>
              <p className="text-ink-soft font-bold">{advancedReport.dataCompleteness.disclaimer}</p>
              <ul className="list-disc list-inside text-[11px] text-orange-700 font-bold">
                {(advancedReport.dataCompleteness.missingInputs || []).map((m, i) => (
                  <li key={i}>{m.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Basic Financial Dashboard Metrics (Clearly Labeled Accrual vs Cash) */}
          {basicDashboard?.metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(basicDashboard.metrics).map(([key, m]) => (
                <div key={key} className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-ink">{m.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper border border-line font-mono text-primary">
                      {m.basis}
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    {(m.totalSalesValue ?? m.netCashInflow ?? m.totalPaidAmount ?? m.totalIncurred ?? m.customerShippingCharged ?? m.supplierPayablesOutstanding ?? 0).toLocaleString()}{' '}
                    {currency}
                  </div>
                  <p className="text-[11px] text-ink-soft leading-relaxed">{m.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Advanced Income Statement & Cash Flow Statement */}
          {advancedReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Statement */}
              <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm text-xs">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h4 className="text-sm font-black text-ink">
                    1. قائمة الدخل التشغيلية (Accrual Income Statement)
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      advancedReport.incomeStatement?.canShowDefinitiveProfit
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-orange-500/15 text-orange-600'
                    }`}
                  >
                    {advancedReport.incomeStatement?.profitConfidenceLabel}
                  </span>
                </div>

                <div className="space-y-2 font-bold">
                  <div className="flex justify-between p-2 rounded bg-paper">
                    <span>صافي مبيعات المتجر الإلكتروني:</span>
                    <span>
                      {advancedReport.incomeStatement?.onlineProductSalesNet} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-paper">
                    <span>صافي المبيعات اليدوية ونقاط البيع:</span>
                    <span>
                      {advancedReport.incomeStatement?.manualSalesNet} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-indigo-500/10 text-indigo-600 font-black">
                    <span>إجمالي صافي المبيعات المعتمدة (Total Net Sales):</span>
                    <span>
                      {advancedReport.incomeStatement?.totalNetSales} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-paper text-red-500">
                    <span>(-) تكلفة البضاعة المباعة (COGS):</span>
                    <span>
                      -{advancedReport.incomeStatement?.totalCostOfGoodsSold} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-emerald-500/10 text-emerald-600 font-black">
                    <span>
                      مجمل الربح (Gross Profit — {advancedReport.incomeStatement?.grossMarginPercent}%):
                    </span>
                    <span>
                      {advancedReport.incomeStatement?.grossProfit} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-paper">
                    <span>صافي نتيجة الشحن (محصل ناقص تكلفة الناقل الفعلية):</span>
                    <span>
                      {advancedReport.incomeStatement?.netShippingResult} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-paper text-red-500">
                    <span>(-) المصروفات التشغيلية المستحقة (Operating Expenses):</span>
                    <span>
                      -{advancedReport.incomeStatement?.totalOperatingExpensesIncurred} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-btn bg-primary text-white font-black text-sm">
                    <span>صافي النتيجة التشغيلية (Net Operating Result):</span>
                    <span>
                      {advancedReport.incomeStatement?.netOperatingResult} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash Flow & Period Comparison */}
              <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs">
                <h4 className="text-sm font-black text-ink border-b border-line pb-2">
                  2. قائمة التدفقات النقدية الفعلية (Actual Cash Flow) ومقارنة الفترة السابقة
                </h4>

                <div className="space-y-2 font-bold">
                  <div className="flex justify-between p-2 rounded bg-emerald-500/10 text-emerald-600">
                    <span>(+) إجمالي النقدية المحصلة فعلياً من العملاء:</span>
                    <span>
                      +{advancedReport.cashFlowStatement?.cashInflowsFromCustomers} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-paper text-red-500">
                    <span>(-) النقدية المسددة للموردين (سداد ذمم دائنة — لا يُكرر كمصروف):</span>
                    <span>
                      -{advancedReport.cashFlowStatement?.cashOutflowsToSuppliers} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-paper text-red-500">
                    <span>(-) النقدية المسددة للمصروفات التشغيلية:</span>
                    <span>
                      -{advancedReport.cashFlowStatement?.cashOutflowsForExpenses} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-btn bg-indigo-600 text-white font-black text-sm">
                    <span>صافي التدفق النقدي للفترة (Net Cash Flow):</span>
                    <span>
                      {advancedReport.cashFlowStatement?.netCashFlow} {currency}
                    </span>
                  </div>
                </div>

                {advancedReport.periodComparison && (
                  <div className="pt-3 border-t border-line space-y-2">
                    <span className="font-black text-ink block">
                      مقارنة مع الفترة المماثلة السابقة (Previous Period Comparison):
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded bg-paper border border-line">
                        <span className="text-[10px] text-ink-soft block">تغير المبيعات</span>
                        <strong className="font-black text-primary">
                          {advancedReport.periodComparison.deltas?.netSalesDelta >= 0 ? '+' : ''}
                          {advancedReport.periodComparison.deltas?.netSalesDelta} {currency}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded bg-paper border border-line">
                        <span className="text-[10px] text-ink-soft block">تغير صافي التشغيل</span>
                        <strong className="font-black text-emerald-600">
                          {advancedReport.periodComparison.deltas?.netOperatingResultDelta >= 0 ? '+' : ''}
                          {advancedReport.periodComparison.deltas?.netOperatingResultDelta} {currency}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded bg-paper border border-line">
                        <span className="text-[10px] text-ink-soft block">تغير التدفق النقدي</span>
                        <strong className="font-black text-indigo-600">
                          {advancedReport.periodComparison.deltas?.netCashFlowDelta >= 0 ? '+' : ''}
                          {advancedReport.periodComparison.deltas?.netCashFlowDelta} {currency}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: DOUBLE-ENTRY ACCOUNTING (E4 — PROFESSIONAL+)                  */}
      {/* ===================================================================== */}
      {mode === 'accounting' && (
        <div className="space-y-6">
          {accountingLevelError ? (
            <div className="p-6 rounded-card bg-orange-500/10 border border-orange-500/30 text-xs font-bold text-orange-600">
              {accountingLevelError}
            </div>
          ) : (
            <>
              {/* Egyptian Chartered Accountant Disclaimer */}
              <div className="p-4 rounded-card bg-indigo-500/10 border border-indigo-500/25 text-xs font-bold text-indigo-600">
                ⚖️ تنبيه مهني: شجرة الحسابات والقيود المزدوجة مُعدة وفق الأعراف التجارية والمحاسبية المتعارف عليها في مصر، ويُوصى بمراجعتها دورياً مع المحاسب القانوني للشركة للامتثال الضريبي والقانوني الرسمي.
              </div>

              {/* Trial Balance & Sub-Ledger Reconciliation KPI */}
              {trialBalance && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-card bg-surface border border-line shadow-sm">
                    <span className="text-xs font-bold text-ink-soft">إجمالي المدين (Total Debit)</span>
                    <div className="text-xl font-black text-ink">
                      {(trialBalance.trialBalance?.totalDebit || 0).toLocaleString()} {currency}
                    </div>
                  </div>
                  <div className="p-4 rounded-card bg-surface border border-line shadow-sm">
                    <span className="text-xs font-bold text-ink-soft">إجمالي الدائن (Total Credit)</span>
                    <div className="text-xl font-black text-ink">
                      {(trialBalance.trialBalance?.totalCredit || 0).toLocaleString()} {currency}
                    </div>
                  </div>
                  <div className="p-4 rounded-card bg-surface border border-line shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-ink-soft">توازن ميزان المراجعة</span>
                      <div className="text-base font-black text-emerald-600">
                        {trialBalance.trialBalance?.isBalanced
                          ? 'متوازن تماماً (Debit = Credit) ✓'
                          : 'غير متوازن ⚠️'}
                      </div>
                    </div>
                    <Scale className="w-6 h-6 text-primary" />
                  </div>
                </div>
              )}

              {/* Create Balanced Journal Entry & Period Closing Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form
                  onSubmit={handleCreateBalancedJournalEntry}
                  className="lg:col-span-2 rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs font-bold"
                >
                  <h4 className="text-sm font-black text-ink">
                    + تسجيل قيد يومية مزدوج متوازن (Balanced Double-Entry Journal Entry)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-ink-soft mb-1">الحساب المدين (Debit) *</label>
                      <select
                        value={jeForm.debitAccountCode}
                        onChange={(e) => setJeForm({ ...jeForm, debitAccountCode: e.target.value })}
                        className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                      >
                        {accounts.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} — {a.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1">الحساب الدائن (Credit) *</label>
                      <select
                        value={jeForm.creditAccountCode}
                        onChange={(e) => setJeForm({ ...jeForm, creditAccountCode: e.target.value })}
                        className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                      >
                        {accounts.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} — {a.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1">المبلغ المتوازن *</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={jeForm.amount}
                        onChange={(e) => setJeForm({ ...jeForm, amount: e.target.value })}
                        className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-soft mb-1">تاريخ القيد *</label>
                      <input
                        type="date"
                        required
                        value={jeForm.entryDate}
                        onChange={(e) => setJeForm({ ...jeForm, entryDate: e.target.value })}
                        className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <input
                      type="text"
                      required
                      value={jeForm.description}
                      onChange={(e) => setJeForm({ ...jeForm, description: e.target.value })}
                      placeholder="بيان القيد المحاسبي بالتفصيل..."
                      className="flex-1 bg-paper border border-line rounded-btn p-2.5 text-ink"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-btn bg-primary text-white font-black"
                    >
                      ترحيل القيد المتوازن
                    </button>
                  </div>
                </form>

                {/* Period Closing Control */}
                <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm text-xs font-bold">
                  <h4 className="text-sm font-black text-ink flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>إقفال الفترات المحاسبية (Period Closing)</span>
                  </h4>
                  <p className="text-[11px] text-ink-soft">
                    إقفال الشهر يمنع إضافة أو تعديل قيود محاسبية مباشرة فيه إلا عبر قيد تسوية في فترة مفتوحة أو إعادة فتح بتصريح موثق.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="month"
                      value={periodForm.periodKey}
                      onChange={(e) => setPeriodForm({ ...periodForm, periodKey: e.target.value })}
                      className="flex-1 bg-paper border border-line rounded-btn p-2 font-mono text-ink"
                    />
                    <button
                      type="button"
                      onClick={handleClosePeriod}
                      className="px-3 py-2 rounded-btn bg-red-600 text-white font-black"
                    >
                      إقفال الفترة
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2">
                    {periods.map((p) => (
                      <div
                        key={p._id}
                        className="p-2 rounded bg-paper border border-line flex items-center justify-between"
                      >
                        <span className="font-mono font-black">
                          {p.periodKey} — {p.status === 'closed' ? 'مُقفلة 🔒' : 'مفتوحة 🔓'}
                        </span>
                        {p.status === 'closed' && (
                          <button
                            type="button"
                            onClick={() => handleReopenPeriod(p.periodKey)}
                            className="text-[10px] px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 font-black"
                          >
                            إعادة فتح
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Journal Entries Table */}
              <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
                <h4 className="text-sm font-black text-ink">دفتر القيود اليومية (Journal Entries Ledger)</h4>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                      <tr>
                        <th className="p-2.5">رقم القيد</th>
                        <th className="p-2.5">التاريخ / الفترة</th>
                        <th className="p-2.5">البيان</th>
                        <th className="p-2.5">إجمالي المدين</th>
                        <th className="p-2.5">إجمالي الدائن</th>
                        <th className="p-2.5">الحالة</th>
                        <th className="p-2.5 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {journalEntries.map((je) => (
                        <tr key={je._id} className="hover:bg-paper/60">
                          <td className="p-2.5 font-mono font-black text-primary">{je.entryNumber}</td>
                          <td className="p-2.5 font-mono">
                            {new Date(je.entryDate).toLocaleDateString('ar-EG')} ({je.accountingPeriod})
                          </td>
                          <td className="p-2.5 font-bold text-ink">{je.description}</td>
                          <td className="p-2.5 font-mono font-black text-emerald-600">
                            {je.totalDebit} {currency}
                          </td>
                          <td className="p-2.5 font-mono font-black text-indigo-600">
                            {je.totalCredit} {currency}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-paper border border-line text-[10px] font-black">
                              {je.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {je.status === 'posted' && (
                              <button
                                type="button"
                                onClick={() => handleReverseJournalEntry(je._id)}
                                className="px-2 py-1 rounded bg-red-500/10 text-red-500 text-[10px] font-black"
                              >
                                قيد عكسي
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
