import React, { useState, useEffect } from 'react';
import {
  Globe2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import axios from 'axios';

const POLICY_LABELS = {
  both: 'تحديث تكلفة الإحلال عند ارتفاع أو انخفاض سعر الصرف (both)',
  increases_only: 'تحديث تكلفة الإحلال عند ارتفاع سعر الصرف فقط لحماية الهامش (increases_only)',
  decreases_only: 'تحديث تكلفة الإحلال عند انخفاض سعر الصرف فقط (decreases_only)',
  manual_only: 'يدوي فقط — لا تقترح تحديثات تلقائية (manual_only)'
};

export default function FinanceCurrencyPanel({ token, currency, showToast, onRefreshAudit }) {
  const [ratesData, setRatesData] = useState({ latestByCurrency: [], history: [], baseCurrency: 'EGP' });
  const [previewData, setPreviewData] = useState(null);
  const [levelError, setLevelError] = useState(null);

  // Record Exchange Rate Form (F2)
  const [rateForm, setRateForm] = useState({
    fromCurrency: 'USD',
    toCurrency: 'EGP',
    rate: '',
    source: 'central_bank_reference',
    notes: ''
  });

  // Preview & Apply Policy State (F2 & F3)
  const [previewPolicy, setPreviewPolicy] = useState('both');
  const [previewCurrency, setPreviewCurrency] = useState('USD');
  const [previewRateOverride, setPreviewRateOverride] = useState('');
  const [updateReplacementCost, setUpdateReplacementCost] = useState(true);
  const [updateSellingPrice, setUpdateSellingPrice] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadCurrencyData = async () => {
    setLevelError(null);
    try {
      const [ratesRes, prevRes] = await Promise.all([
        axios.get('/api/admin/finance/currency/rates', authHeader),
        axios.post(
          '/api/admin/finance/currency/preview-impact',
          {
            fromCurrency: previewCurrency,
            policy: previewPolicy
          },
          authHeader
        )
      ]);
      setRatesData(ratesRes.data || { latestByCurrency: [], history: [], baseCurrency: 'EGP' });
      setPreviewData(prevRes.data || null);
    } catch (err) {
      if (err.response?.status === 403) {
        setLevelError(
          err.response?.data?.error || 'تتطلب وحدة العملات وأسعار الصرف مستوى Enterprise'
        );
      } else {
        console.error('Error loading currency data:', err);
      }
    }
  };

  useEffect(() => {
    if (token) loadCurrencyData();
  }, [token]);

  const handleRecordExchangeRate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/admin/finance/currency/rates',
        {
          fromCurrency: rateForm.fromCurrency,
          toCurrency: rateForm.toCurrency,
          rate: Number(rateForm.rate),
          source: rateForm.source,
          notes: rateForm.notes
        },
        authHeader
      );
      showToast(
        `تم تسجيل سعر الصرف المعتمد (1 ${rateForm.fromCurrency} = ${rateForm.rate} ${rateForm.toCurrency}) في السجل التاريخي`
      );
      setRateForm({ ...rateForm, rate: '', notes: '' });
      loadCurrencyData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل سعر الصرف', 'error');
    }
  };

  const handleRunPreview = async () => {
    try {
      const res = await axios.post(
        '/api/admin/finance/currency/preview-impact',
        {
          fromCurrency: previewCurrency,
          newRate: previewRateOverride !== '' ? Number(previewRateOverride) : undefined,
          policy: previewPolicy
        },
        authHeader
      );
      setPreviewData(res.data || null);
      showToast('تم حساب معاينة أثر تغير سعر الصرف على تكلفة الإحلال وأسعار البيع المقترحة');
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تشغيل المعاينة', 'error');
    }
  };

  const handleApplyConfirmedUpdates = async () => {
    if (!previewData?.items?.length) return;
    const eligibleCount = previewData.items.filter((i) => i.eligibleUnderPolicy).length;
    if (eligibleCount === 0) {
      showToast('لا توجد منتجات مؤهلة للتحديث وفق السياسة المحددة', 'error');
      return;
    }

    try {
      const res = await axios.post(
        '/api/admin/finance/currency/apply-updates',
        {
          confirmApply: true,
          fromCurrency: previewCurrency,
          newRate: previewRateOverride !== '' ? Number(previewRateOverride) : undefined,
          policy: previewPolicy,
          updateReplacementCost,
          updateSellingPrice
        },
        authHeader
      );
      showToast(
        `تم اعتماد وتطبيق التحديثات على ${res.data?.updatedCount || 0} منتج مع الحفاظ التام على تكاليف الطلبات والشحنات التاريخية`
      );
      loadCurrencyData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تطبيق التحديثات', 'error');
    }
  };

  if (levelError) {
    return (
      <div className="p-6 rounded-card bg-orange-500/10 border border-orange-500/30 text-xs font-bold text-orange-600">
        {levelError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Architectural Guarantee Banner */}
      <div className="p-4 rounded-card bg-indigo-500/10 border border-indigo-500/25 text-xs font-bold text-indigo-600 space-y-1">
        <div className="flex items-center gap-2 font-black">
          <ShieldCheck className="w-4 h-4" />
          <span>ضمانة ثبات اللقطات التاريخية ومنع التسعير التلقائي غير المعتمد (Historical Immutability):</span>
        </div>
        <p className="text-ink-soft">
          1) تحتفظ كل شحنة مورد وكل سطر شراء بالعملة الأصلية وسعر الصرف التاريخي وقت الشراء ولا يُعاد حسابها أبداً بسعر اليوم. 2) لا يُسمح لنماذج الذكاء الاصطناعي بتوليد أسعار صرف. 3) لا تتغير أسعار البيع للجمهور أبداً دون معاينة وتأكيد صريح من مدير المتجر.
        </p>
      </div>

      {/* Latest Rates & Record New Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleRecordExchangeRate}
          className="rounded-card bg-surface border border-line p-5 space-y-3.5 shadow-sm text-xs font-bold"
        >
          <h4 className="text-sm font-black text-ink flex items-center gap-1.5">
            <Globe2 className="w-4 h-4 text-primary" />
            <span>تسجيل سعر صرف رسمي / يدوي جديد</span>
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-ink-soft mb-1">عملة الشراء (From) *</label>
              <select
                value={rateForm.fromCurrency}
                onChange={(e) => setRateForm({ ...rateForm, fromCurrency: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2 text-ink font-mono"
              >
                <option value="USD">USD (دولار أمريكي)</option>
                <option value="EUR">EUR (يورو)</option>
                <option value="SAR">SAR (ريال سعودي)</option>
                <option value="AED">AED (درهم إماراتي)</option>
                <option value="GBP">GBP (جنيه إسترليني)</option>
                <option value="CNY">CNY (يوان صيني)</option>
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">سعر الصرف مقابل {ratesData.baseCurrency} *</label>
              <input
                type="number"
                min="0.0001"
                step="0.01"
                required
                value={rateForm.rate}
                onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                placeholder="مثال: 50.25"
                className="w-full bg-paper border border-line rounded-btn p-2 text-ink font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-soft mb-1">مصدر السعر المعتمد</label>
            <select
              value={rateForm.source}
              onChange={(e) => setRateForm({ ...rateForm, source: e.target.value })}
              className="w-full bg-paper border border-line rounded-btn p-2 text-ink"
            >
              <option value="central_bank_reference">البنك المركزي / السعر المرجعي الرسمي</option>
              <option value="manual_admin">إدخال إداري معتمد (Manual Admin)</option>
              <option value="supplier_invoice_contract">سعر تعاقد فاتورة المورد</option>
            </select>
          </div>

          <input
            type="text"
            value={rateForm.notes}
            onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
            placeholder="ملاحظة مرجعية (اختياري)..."
            className="w-full bg-paper border border-line rounded-btn p-2 text-ink"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-btn bg-primary text-white font-black"
          >
            حفظ سعر الصرف في السجل التاريخي
          </button>
        </form>

        {/* Latest Rates History */}
        <div className="lg:col-span-2 rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
          <h4 className="text-sm font-black text-ink">أحدث أسعار الصرف المسجلة والسجل التاريخي</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(ratesData.latestByCurrency || []).map((r) => (
              <div key={r._id} className="p-3 rounded-card bg-paper border border-line space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-primary">
                    1 {r.fromCurrency} → {r.toCurrency}
                  </span>
                  <span className="text-[10px] text-ink-soft">
                    {new Date(r.effectiveDate).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                <div className="text-lg font-black text-emerald-600 font-mono">
                  {r.rate} {r.toCurrency}
                </div>
                <span className="text-[10px] text-ink-soft block">{r.source}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Replacement Cost & Selling Price Impact Preview & Explicit Admin Confirmation */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h4 className="text-sm font-black text-ink flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>معاينة واعتماد تحديث تكلفة الإحلال وأسعار البيع المقترحة (F2 & F3)</span>
            </h4>
            <p className="text-ink-soft mt-0.5">
              حدد سياسة التحديث (عند الارتفاع فقط، عند الانخفاض فقط، أو كليهما) وعاين الفروق قبل الاعتماد النهائي
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunPreview}
            className="px-4 py-2 rounded-btn bg-indigo-600 text-white font-black flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث المعاينة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-bold">
          <div>
            <label className="block text-ink-soft mb-1">عملة الشراء المستهدفة للمعاينة</label>
            <select
              value={previewCurrency}
              onChange={(e) => setPreviewCurrency(e.target.value)}
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="SAR">SAR</option>
              <option value="AED">AED</option>
            </select>
          </div>
          <div>
            <label className="block text-ink-soft mb-1">سياسة التحديث (Cost Update Policy)</label>
            <select
              value={previewPolicy}
              onChange={(e) => setPreviewPolicy(e.target.value)}
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
            >
              {Object.entries(POLICY_LABELS).map(([k, lbl]) => (
                <option key={k} value={k}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-ink-soft mb-1">سعر صرف تجريبي للمحاكاة (اختياري)</label>
            <input
              type="number"
              min="0.0001"
              step="0.01"
              value={previewRateOverride}
              onChange={(e) => setPreviewRateOverride(e.target.value)}
              placeholder="اتركه فارغاً لاستخدام آخر سعر رسمي مسجل"
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono"
            />
          </div>
        </div>

        {previewData && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-2.5">المنتج</th>
                    <th className="p-2.5">تكلفة الشراء بالعملة الأصلية</th>
                    <th className="p-2.5">سعر الصرف التاريخي ← الجديد</th>
                    <th className="p-2.5">تكلفة الإحلال الحالية ← الجديدة</th>
                    <th className="p-2.5">سعر البيع الحالي ← المقترح</th>
                    <th className="p-2.5">الأهلية وفق السياسة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(previewData.items || []).map((it) => (
                    <tr key={it.productId} className="hover:bg-paper/60">
                      <td className="p-2.5 font-black text-ink">{it.name}</td>
                      <td className="p-2.5 font-mono">
                        {it.originalUnitCost} {it.purchaseCurrency}
                      </td>
                      <td className="p-2.5 font-mono">
                        {it.historicalExchangeRate} ← <strong className="text-primary">{it.newExchangeRate}</strong>
                      </td>
                      <td className="p-2.5 font-mono">
                        {it.currentReplacementUnitCost} ←{' '}
                        <strong className="text-orange-600">
                          {it.recalculatedReplacementCost} {currency}
                        </strong>
                      </td>
                      <td className="p-2.5 font-mono">
                        {it.currentSellingPrice} ←{' '}
                        <strong className="text-emerald-600">
                          {it.proposedSellingPrice} {currency}
                        </strong>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            it.eligibleUnderPolicy
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : 'bg-slate-500/15 text-slate-500'
                          }`}
                        >
                          {it.eligibleUnderPolicy ? 'مؤهل للتحديث ✓' : 'مستبعد بالسياسة'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-card bg-paper border border-line flex flex-wrap items-center justify-between gap-4 font-bold">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateReplacementCost}
                    onChange={(e) => setUpdateReplacementCost(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>تحديث تكلفة الإحلال الحالية (Replacement Cost)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateSellingPrice}
                    onChange={(e) => setUpdateSellingPrice(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>تحديث أسعار البيع العامة للجمهور بالأسعار المقترحة (بتأكيد المدير)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleApplyConfirmedUpdates}
                className="px-5 py-2.5 rounded-btn bg-emerald-600 text-white font-black hover:bg-emerald-700"
              >
                تأكيد واعتماد التحديثات المحددة الآن ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
