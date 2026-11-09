import React from 'react';
import {
  Layers,
  CheckCircle2,
  FileText,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

export default function FinanceSettingsPanel({
  financeSettings,
  capabilityRegistry,
  auditLogs = [],
  authHeader,
  showToast,
  onRefreshSettings,
  onRefreshAudit
}) {
  const handleChangeFinanceLevel = async (newLevel) => {
    try {
      await axios.put('/api/admin/finance/settings', { level: newLevel }, authHeader);
      showToast(`تم تحديث مستوى النظام المالي إلى (${newLevel}) مع الحفاظ الكامل على البيانات التاريخية`);
      onRefreshSettings?.();
      onRefreshAudit?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث المستوى المالي', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <h4 className="text-sm font-black text-ink flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span>مستوى قدرات النظام المالي (Finance Capability Level)</span>
        </h4>
        <p className="text-xs text-ink-soft">
          تغيير مستوى النظام المالي أو إخفاء واجهة وحدة لا يحذف أو يعيد كتابة أي سجلات مالية أو لقطات تاريخية مسجلة.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              key: 'basic',
              title: 'Basic (الأساسي)',
              desc: 'المرحلتان A + B + لوحة التقارير الأساسية (E2): فئات الشحن، الموردين، والملخص المالي الأساسي'
            },
            {
              key: 'advanced',
              title: 'Advanced (المتقدم)',
              desc: 'يشمل المراحل A–D + التقارير المتقدمة (E3): المخزون وتقييم التكلفة، المصروفات، والمبيعات اليدوية'
            },
            {
              key: 'professional',
              title: 'Professional (الاحترافي)',
              desc: 'يشمل المراحل A–E كاملة بما فيها المحاسبة ذات القيد المزدوج وميزان المراجعة وإقفال الفترات (E4)'
            },
            {
              key: 'enterprise',
              title: 'Enterprise (المؤسسي)',
              desc: 'يشمل المراحل A–F كاملة بما فيها تعدد عملات الشراء، أسعار الصرف، ومعاينة تكلفة الإحلال (Phase F)'
            }
          ].map((lvl) => {
            const isSelected = financeSettings?.level === lvl.key;
            return (
              <div
                key={lvl.key}
                onClick={() => handleChangeFinanceLevel(lvl.key)}
                className={`cursor-pointer p-4 rounded-card border-2 transition-all space-y-1.5 ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-line bg-paper hover:bg-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-ink">{lvl.title}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-[11px] text-ink-soft leading-relaxed">{lvl.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Phase A-F Architectural Registry Status */}
        <div className="pt-4 border-t border-line space-y-2">
          <h5 className="text-xs font-black text-ink">حالة المراحل المعمارية (Phases A–F Registry):</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {[
              { code: 'A', name: 'Phase A: فئات الشحن ولقطات الطلبات', active: true },
              { code: 'B', name: 'Phase B: شحنات والتزامات ومدفوعات الموردين', active: true },
              { code: 'C', name: 'Phase C: حركات المخزون وتقييم التكلفة (WAC/FIFO)', active: true },
              { code: 'D', name: 'Phase D: المصروفات والمبيعات اليدوية', active: true },
              { code: 'E', name: 'Phase E: التقارير المالية والمحاسبة المزدوجة', active: true },
              { code: 'F', name: 'Phase F: إدارة العملات وأسعار الصرف', active: true }
            ].map((ph) => (
              <div
                key={ph.code}
                className="p-3 rounded-btn bg-paper border border-line flex items-center justify-between"
              >
                <span className="font-bold text-ink">{ph.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    ph.active
                      ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                      : 'bg-slate-500/15 text-slate-500 border border-slate-500/30'
                  }`}
                >
                  {ph.active ? 'مُفعّل تشغيلياً ✓' : 'مُجهّز معمارياً'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Immutable Finance Audit Log */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-ink flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span>سجل التدقيق المالي غير القابل للتعديل (Finance Audit Trail)</span>
          </h4>
          <button
            type="button"
            onClick={onRefreshAudit}
            className="px-3 py-1.5 rounded-btn bg-paper border border-line text-xs font-bold flex items-center gap-1 hover:bg-surface"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث السجل</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper text-ink-soft font-bold border-b border-line sticky top-0">
              <tr>
                <th className="p-2.5">التوقيت</th>
                <th className="p-2.5">الوحدة</th>
                <th className="p-2.5">الحدث</th>
                <th className="p-2.5">المسؤول</th>
                <th className="p-2.5">السبب / التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {auditLogs.map((log) => (
                <tr key={log._id} className="hover:bg-paper/50">
                  <td className="p-2.5 text-ink-soft whitespace-nowrap">
                    {new Date(log.occurredAt || log.createdAt).toLocaleString('ar-EG')}
                  </td>
                  <td className="p-2.5 font-bold text-primary">{log.module}</td>
                  <td className="p-2.5 font-mono font-black text-ink">{log.action}</td>
                  <td className="p-2.5 font-bold text-ink">{log.actorName || log.actorRole}</td>
                  <td className="p-2.5 text-ink-soft">{log.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
