import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Filter,
  User,
  Calendar,
  Clock,
  ArrowRightLeft,
  Trash2,
  Receipt,
  Eye,
  Wrench,
  CheckCircle2,
  FileText,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Building2,
  SlidersHorizontal
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AuditDeepImpactModal from './AuditDeepImpactModal';

/**
 * AuditLogsPage (سجل العمليات والرقابة التراكمي المتقدم بالذكاء الاصطناعي)
 * Tracks all store events: sales, deposits, lab status transitions,
 * stock transfers between warehouses, scrap recordings, and prescription edits.
 */
export default function AuditLogsPage() {
  const { token, showToast, activeBranchId, branches = [] } = useStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Selected Log for Deep Impact Diff Modal
  const [selectedLogForImpact, setSelectedLogForImpact] = useState(null);

  // AI Anomaly Detection State
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadLogs = (targetPage = page) => {
    if (!token) return;
    setLoading(true);

    const params = {
      page: targetPage,
      limit: 30,
      search: search.trim() || undefined,
      action: actionFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      branchId: activeBranchId !== 'all' ? activeBranchId : undefined
    };

    axios
      .get('/api/admin/audit-logs', { ...authHeader, params })
      .then((res) => {
        setLogs(res.data?.logs || []);
        setTotal(res.data?.total || 0);
        setPages(res.data?.pages || 1);
        setPage(res.data?.page || 1);
      })
      .catch((err) => {
        showToast('تعذر تحميل سجل العمليات', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs(1);
  }, [actionFilter, startDate, endDate, activeBranchId]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadLogs(1);
  };

  const handleScanAnomalies = async () => {
    if (!token) return;
    setScanning(true);
    setScanResult(null);

    try {
      const res = await axios.post(
        '/api/admin/audit-logs/scan-anomalies',
        {
          branchId: activeBranchId !== 'all' ? activeBranchId : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit: 150
        },
        authHeader
      );

      if (res.data?.done) {
        setScanResult(res.data);
        if (res.data.anomaliesCount > 0) {
          showToast(`تم رصد ${res.data.anomaliesCount} عمليات تستدعي التدقيق الإداري`, 'info');
        } else {
          showToast('الفحص سليم: لا توجد أي سلوكيات مريبة في هذه الفترة');
        }
      }
    } catch (err) {
      console.error('Failed to scan anomalies:', err);
      showToast('تعذر إجراء فحص الرقابة بالذكاء الاصطناعي', 'error');
    } finally {
      setScanning(false);
    }
  };

  const getActionBadge = (action, label) => {
    if (action.includes('sale') || action.includes('order')) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-black inline-flex items-center gap-1">
          <Receipt className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (action.includes('transfer')) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[11px] font-black inline-flex items-center gap-1">
          <ArrowRightLeft className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (action.includes('scrap')) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20 text-[11px] font-black inline-flex items-center gap-1">
          <Trash2 className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (action.includes('lab')) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[11px] font-black inline-flex items-center gap-1">
          <Wrench className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (action.includes('prescription')) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 border border-teal-500/20 text-[11px] font-black inline-flex items-center gap-1">
          <Eye className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-ink text-[11px] font-bold">
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in text-right">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 justify-end mb-1">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>سجل غير قابل للتعديل أو الحذف (WORM Compliant)</span>
            </span>
          </div>
          <h2 className="text-xl font-black flex items-center gap-2 justify-end">
            <span>سجل الرقابة وتدقيق العمليات (Audit Trail Logs)</span>
            <ClipboardList className="w-6 h-6 text-primary" />
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            توثيق دقيق لكل عملية بيع، تعديل، صرف أمانات، تحويل بين المخازن، أو تسجيل توالف بالتوقيت واسم الموظف
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleScanAnomalies}
            disabled={scanning || loading}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
            title="فحص وتحليل السجلات بواسطة الذكاء الاصطناعي لكشف العمليات المريبة والتلاعب"
          >
            {scanning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>{scanning ? 'جاري الفحص الذكي...' : 'تدقيق الـ AI للعمليات المريبة'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadLogs(page)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>
      </div>

      {/* AI Anomaly Scan Result Banner */}
      {scanResult && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm animate-fadeIn ${
            scanResult.anomaliesCount === 0
              ? 'bg-emerald-500/10 text-emerald-900 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-950 border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-2.5 font-bold">
            {scanResult.anomaliesCount === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="font-black text-sm">{scanResult.summary}</p>
              <p className="text-[11px] text-ink-soft mt-0.5">
                تم تحليل <strong>{scanResult.analyzedCount} عملية</strong> مسجلة في هذه النافذة الزمنية.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScanResult(null)}
            className="text-xs underline text-ink-soft hover:text-ink shrink-0"
          >
            إخفاء التقرير
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-3">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الموظف، كود الطلب، تفاصيل العملية..."
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
            />
            <Search className="w-4 h-4 text-ink-soft absolute right-3 top-2.5 pointer-events-none" />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-paper border border-line rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">جميع أنواع العمليات</option>
            <option value="pos_direct_sale_created">فواتير بيع مباشر</option>
            <option value="pos_lab_order_created">أوامر شغل معمل</option>
            <option value="order_lab_status_updated">تحديثات أوامر المعمل</option>
            <option value="warehouse_stock_transfer">تحويل بين المخازن</option>
            <option value="inventory_scrap_recorded">تسجيل توالف وهدر</option>
            <option value="customer_deposit_recorded">سندات قبض وأمانات</option>
            <option value="prescription_added">كشوفات النظر</option>
          </select>

          <div className="flex items-center gap-1 text-xs text-ink-soft">
            <span className="font-bold">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-paper border border-line rounded-xl px-2.5 py-1.5 text-xs font-mono text-ink outline-none"
            />
          </div>

          <div className="flex items-center gap-1 text-xs text-ink-soft">
            <span className="font-bold">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-paper border border-line rounded-xl px-2.5 py-1.5 text-xs font-mono text-ink outline-none"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-sm transition-all"
          >
            تصفية
          </button>
        </form>
      </div>

      {/* Main Logs Table */}
      <div className="rounded-card bg-surface border border-line overflow-hidden shadow-sm">
        <div className="p-3.5 bg-paper border-b border-line flex items-center justify-between text-xs font-bold text-ink-soft">
          <span>إجمالي السجلات المطابقة: <strong className="text-ink">{total} عملية</strong></span>
          <span>صفحة {page} من {pages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper/70 text-ink-soft font-bold border-b border-line">
              <tr>
                <th className="p-3.5">التوقيت والتاريخ</th>
                <th className="p-3.5">الموظف المسؤول</th>
                <th className="p-3.5">نوع العملية</th>
                <th className="p-3.5">الهدف / المعرف</th>
                <th className="p-3.5">التفاصيل والبيان</th>
                <th className="p-3.5 text-center">أثر العملية والتحول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-ink-soft font-bold animate-pulse">
                    جاري تحميل سجل العمليات...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-ink-soft font-bold">
                    لا توجد سجلات مطابقة لشروط البحث المحددة.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-paper/60 transition-colors">
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-ink text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-ink-soft font-mono">
                        {new Date(log.timestamp).toLocaleDateString('ar-EG')}
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-bold text-ink flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>{log.userName || 'المدير العام'}</span>
                      </div>
                      <span className="text-[10px] text-ink-soft block mr-5">{log.userRole}</span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {getActionBadge(log.action, log.actionLabel)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {log.targetCode ? (
                        <span className="font-mono font-black text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {log.targetCode}
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <p className="text-ink font-bold leading-relaxed">{log.details}</p>
                      {log.impactSummary && (
                        <div className="mt-1.5 p-2 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] font-bold text-indigo-950 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-indigo-950 font-black ml-1">أثر التحول:</span>
                            <span className="text-indigo-900/90 font-medium">{log.impactSummary}</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLogForImpact(log)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black transition-all active:scale-95 shadow-2xs"
                        title="عرض تقرير أثر العملية والتغييرات التفصيلية في المخزن والمالية والداتابيز"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                        <span>أثر العملية</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="p-4 bg-paper border-t border-line flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => loadLogs(page - 1)}
              className="px-3 py-1.5 rounded-btn border border-line bg-surface hover:bg-paper text-ink font-bold disabled:opacity-50"
            >
              الصفحة السابقة
            </button>
            <span className="font-bold text-ink">
              {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => loadLogs(page + 1)}
              className="px-3 py-1.5 rounded-btn border border-line bg-surface hover:bg-paper text-ink font-bold disabled:opacity-50"
            >
              الصفحة التالية
            </button>
          </div>
        )}
      </div>

      {/* Deep Impact & Diff Modal */}
      {selectedLogForImpact && (
        <AuditDeepImpactModal
          log={selectedLogForImpact}
          onClose={() => setSelectedLogForImpact(null)}
        />
      )}
    </div>
  );
}
