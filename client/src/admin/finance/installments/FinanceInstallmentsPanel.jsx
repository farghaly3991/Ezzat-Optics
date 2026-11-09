import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  DollarSign,
  Wallet,
  Clock,
  Building2
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../shared/context/StoreContext';

export default function FinanceInstallmentsPanel({ token, currency = 'ج.م', showToast }) {
  const navigate = useNavigate();
  const { activeBranchId } = useStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const loadFinanceSummary = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/installments/finance-summary', {
        ...authHeader,
        params: { branchId: activeBranchId || undefined }
      });
      if (res.data?.done) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load installments finance summary:', err);
      if (showToast) showToast('فشل تحميل تقرير الحسابات الخاص بالأقساط', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFinanceSummary();
    }
  }, [token, activeBranchId]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-surface border border-line flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-900 border border-amber-500/30 flex items-center justify-center font-black text-xl">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-ink">
              حسابات ومستحقات التقسيط المباشر (Installments & Receivables)
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              متابعة التدفقات النقدية المحصلة، المستحقات الآجلة بذمة العملاء، ومخطط السيولة القادمة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadFinanceSummary}
            disabled={loading}
            className="p-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="تحديث الحسابات"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>

          <button
            onClick={() => navigate('/admin/installments')}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-black flex items-center gap-2 shadow-sm hover:opacity-90 transition-all"
          >
            <span>إدارة عقود الأقساط والتحصيل</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-ink-soft text-sm">جاري تجميع وتحليل حسابات ومستحقات الأقساط...</div>
      ) : !data ? (
        <div className="text-center py-16 text-ink-soft">تعذر جلب البيانات المالية</div>
      ) : (
        <>
          {/* The Three Core Pillars Requested by User */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. إيه اللي ليك (Total Receivables Portfolio) */}
            <div className="p-5 rounded-3xl bg-paper border border-line relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink-soft">إجمالي محفظة التقسيط (إيه اللي ليك كلياً)</span>
                <span className="p-2 rounded-xl bg-blue-500/15 text-blue-900">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-ink">
                {Number(data.totalReceivablesOriginal || 0).toLocaleString()} <span className="text-sm font-bold text-ink-soft">{currency}</span>
              </div>
              <p className="text-[11px] text-ink-soft font-bold">
                إجمالي قيمة المبيعات المقسطة بالمحل شاملة الأرباح والرسوم
              </p>
            </div>

            {/* 2. إيه اللي داخل (Cash Inflows Collected) */}
            <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950">النقدية المحصلة فعلياً (إيه اللي دخل الخزينة)</span>
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-900">
                  <ArrowDownLeft className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950">
                {Number(data.totalCashCollected || 0).toLocaleString()} <span className="text-sm font-bold text-emerald-900">{currency}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-black text-emerald-900">
                <span>معدل التحصيل: {data.collectionRate}%</span>
                <span>تدفقات نقدية فعلية</span>
              </div>
            </div>

            {/* 3. إيه اللي لسه ليك (Remaining Future Balance) */}
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950">المستحقات المتبقية في السوق (إيه اللي لسه ليك)</span>
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-900">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-950">
                {Number(data.totalRemainingReceivables || 0).toLocaleString()} <span className="text-sm font-bold text-amber-900">{currency}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                <span>أصول متداولة وحقوق آجلة للمحل</span>
                {data.overdueAmount > 0 && (
                  <span className="text-rose-950 bg-rose-500/20 px-2 py-0.5 rounded-md font-black">
                    متأخرات: {Number(data.overdueAmount).toLocaleString()} {currency}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Statistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-surface border border-line text-center">
              <span className="text-[11px] text-ink-soft font-bold block">إجمالي عقود التقسيط</span>
              <span className="text-xl font-black text-ink">{data.totalContracts || 0} عقد</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface border border-line text-center">
              <span className="text-[11px] text-amber-900 font-bold block">عقود جارية وقيد التحصيل</span>
              <span className="text-xl font-black text-amber-950">{data.activeContractsCount || 0} عقد نشط</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface border border-line text-center">
              <span className="text-[11px] text-emerald-900 font-bold block">عقود مسددة بالكامل</span>
              <span className="text-xl font-black text-emerald-950">{data.completedContractsCount || 0} عقد منتهي</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface border border-line text-center">
              <span className="text-[11px] text-rose-900 font-bold block">إجمالي المتأخرات الحرجة</span>
              <span className="text-xl font-black text-rose-950">
                {Number(data.overdueAmount || 0).toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Expected Cash Flow Inflow Projection for Upcoming Months */}
          <div className="p-5 rounded-3xl bg-surface border border-line space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-ink">
                  جدول التدفقات النقدية المتوقعة للأقساط (Monthly Cash Flow Projections)
                </h4>
                <p className="text-xs text-ink-soft mt-0.5">
                  المبالغ المجدول تحصيلها في كل شهر قادم بناءً على تواريخ استحقاق الأقساط الجارية
                </p>
              </div>
              <span className="text-xs font-black text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                مخطط السيولة القادمة
              </span>
            </div>

            {(!data.monthlyProjection || data.monthlyProjection.length === 0) ? (
              <div className="text-center py-10 text-ink-soft text-xs font-bold">
                لا توجد أقساط مجدولة قادمة حالياً. كافة الأقساط مسددة أو لم يتم تسجيل مبيعات تقسيط بعد.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {data.monthlyProjection.map((item) => (
                  <div
                    key={item.period}
                    className="p-3.5 rounded-2xl bg-paper border border-line hover:border-primary/40 transition-colors text-center space-y-1"
                  >
                    <span className="text-[11px] font-mono font-bold text-ink-soft block">
                      {item.period}
                    </span>
                    <div className="text-base font-black text-emerald-950">
                      {Number(item.expectedInflow).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-ink-soft font-bold block">{currency} متوقع</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
