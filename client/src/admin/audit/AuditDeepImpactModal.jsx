import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Boxes,
  Wallet,
  ShoppingBag,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Tag
} from 'lucide-react';

/**
 * AuditDeepImpactModal
 * Detailed executive modal displaying the before/after state, mathematical diff,
 * inventory movements, finance adjustments, and affected database collections for an audit event.
 */
export default function AuditDeepImpactModal({ log, onClose }) {
  if (!log) return null;

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'inventory' | 'finance' | 'orders' | 'database' | 'raw'

  const deepImpact = log.deepImpact || {};
  const inventoryItems = deepImpact.inventory || [];
  const financeMetrics = deepImpact.finance || [];
  const orderSteps = deepImpact.orders || [];
  const dbMutations = deepImpact.database || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">تقرير أثر العملية وتتبع التحولات الرقمية</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 font-bold">
                  Deep Diff
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {log.actionLabel} — المنفذ: <strong className="text-white">{log.userName || 'المدير العام'}</strong> ({log.userRole})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Executive Impact Summary Callout */}
        <div className="p-4 bg-indigo-50/70 border-b border-indigo-100 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-black text-indigo-950 text-sm flex items-center gap-2">
              <span>الأثر المباشر للعملية (Executive Summary):</span>
              {log.targetCode && (
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                  #{log.targetCode}
                </span>
              )}
            </div>
            <p className="text-indigo-900/90 leading-relaxed font-bold">
              {log.impactSummary || log.details}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            نظرة شاملة
          </button>

          {inventoryItems.length > 0 && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>أثر المخزن ({inventoryItems.length})</span>
            </button>
          )}

          {financeMetrics.length > 0 && (
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'finance'
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>الأثر المالي ({financeMetrics.length})</span>
            </button>
          )}

          {orderSteps.length > 0 && (
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>مسار العمليات ({orderSteps.length})</span>
            </button>
          )}

          {dbMutations.length > 0 && (
            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'database'
                  ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>جداول الداتابيز ({dbMutations.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap mr-auto ${
              activeTab === 'raw'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>بيانات JSON الخام</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-right text-xs">

          {/* 1. Inventory Diff Section */}
          {(activeTab === 'all' || activeTab === 'inventory') && inventoryItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  <span>تحولات أرصدة المخزون والمصفوفة (Inventory & Matrix Diff)</span>
                </h4>
                <span className="text-[11px] font-bold text-slate-500">
                  {inventoryItems.length} بنود متأثرة
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3">الصنف / البند ومقاس العدسة</th>
                      <th className="p-3 text-center">الرصيد السابق (Before)</th>
                      <th className="p-3 text-center">الرصيد الجديد (After)</th>
                      <th className="p-3 text-center">التغير الصافي (Delta)</th>
                      <th className="p-3">ملاحظة الأثر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryItems.map((inv, idx) => {
                      const isPositive = inv.delta > 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-bold text-slate-900">
                            {inv.item}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-500">
                            {inv.before} {inv.unit || 'قطعة'}
                          </td>
                          <td className="p-3 text-center font-mono font-black text-slate-900">
                            {inv.after} {inv.unit || 'قطعة'}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono font-black text-xs ${
                                isPositive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                              <span>{isPositive ? `+${inv.delta}` : inv.delta}</span>
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {inv.note || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Financial Metrics Diff Section */}
          {(activeTab === 'all' || activeTab === 'finance') && financeMetrics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>الأثر المالي وتدفقات الخزينة (Financial Impact & Ledger Diff)</span>
                </h4>
                <span className="text-[11px] font-bold text-slate-500">
                  {financeMetrics.length} حركات مالية
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {financeMetrics.map((fin, idx) => {
                  const isPositive = fin.delta > 0;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-800 text-xs">{fin.metric}</span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-mono font-black text-[11px] ${
                            isPositive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {isPositive ? '+' : ''}{fin.delta.toLocaleString()} {fin.currency || 'ج.م'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500">
                          قبل: <strong className="font-mono text-slate-700">{fin.before.toLocaleString()}</strong>
                        </span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-slate-800">
                          بعد: <strong className="font-mono text-indigo-700 font-black">{fin.after.toLocaleString()}</strong>
                        </span>
                      </div>

                      {fin.note && (
                        <p className="text-[10px] text-slate-500 leading-tight">
                          💡 {fin.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Orders & Lab Operations Diff Section */}
          {(activeTab === 'all' || activeTab === 'orders') && orderSteps.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-600" />
                <span>مسار دورة التشغيل وأوامر المعمل (Order & Work Order Lifecycle)</span>
              </h4>

              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 space-y-3 shadow-2xs">
                {orderSteps.map((ord, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <div className="font-black text-slate-900 text-xs flex items-center gap-2">
                        <span>الطلب:</span>
                        <span className="font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {ord.orderCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{ord.note}</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                        {ord.previousStage}
                      </span>
                      <span className="text-slate-400">➔</span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-black">
                        {ord.newStage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Database Mutations Section */}
          {(activeTab === 'all' || activeTab === 'database') && dbMutations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>المجموعات والجداول المتأثرة بقاعدة البيانات (MongoDB Affected Collections)</span>
                </h4>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {dbMutations.length} مجموعات
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3">اسم المجموعة (Collection)</th>
                      <th className="p-3 text-center">نوع الإجراء (Action)</th>
                      <th className="p-3">بيان التعديل / الإدراج</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dbMutations.map((db, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-mono font-black text-indigo-700">
                          {db.collectionName}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            db.action === 'INSERT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {db.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {db.summary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Raw JSON viewer tab */}
          {activeTab === 'raw' && (
            <div className="space-y-2">
              <h4 className="text-sm font-black text-slate-800">بيانات السجل والـ Metadata بالكامل:</h4>
              <pre className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed" dir="ltr">
                {JSON.stringify(log, null, 2)}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black transition-all shadow-xs active:scale-95"
          >
            إغلاق التقرير
          </button>
        </div>

      </div>
    </div>
  );
}
