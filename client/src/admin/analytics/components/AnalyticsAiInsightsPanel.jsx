import React from 'react';
import {
  Sparkles,
  Download,
  RefreshCw
} from 'lucide-react';

export default function AnalyticsAiInsightsPanel({
  insightsLoading,
  insightsError,
  insightsData,
  onExportPdf,
  onClose
}) {
  if (!insightsLoading && !insightsError && !insightsData) return null;

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-xl space-y-5 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-orange-300" />
          </div>
          <div>
            <h4 className="text-base font-black text-white flex items-center gap-2 flex-wrap">
              <span>الرؤى والتوصيات التحليلية الذكية (AI Store Insights)</span>
              {insightsData && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {insightsData.aiUsed ? `AI Model: ${insightsData.model}` : 'تحليل إحصائي مهيكل مدعوم بالأدلة'}
                </span>
              )}
              {insightsData?.generatedAt && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  تاريخ التقرير: {new Date(insightsData.generatedAt).toLocaleString('ar-EG')}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-300">
              يفصل هذا القسم بين الحقائق الرقمية المرصودة والفرضيات المحتملة — ولا يفترض علاقة سببية قاطعة من مجرد الارتباط الإحصائي
            </p>
          </div>
        </div>

        {insightsData && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onExportPdf(insightsData)}
              className="text-xs font-black text-white px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل التقرير PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/10"
            >
              إخفاء الرؤى ✕
            </button>
          </div>
        )}
      </div>

      {insightsLoading && (
        <div className="py-10 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-300 mx-auto" />
          <p className="text-sm font-bold text-slate-200">
            جاري تجميع مؤشرات المتجر وترتيب المنتجات والقمع التسويقي وتوليد الرؤى التحليلية...
          </p>
        </div>
      )}

      {insightsError && !insightsData && (
        <div className="p-4 rounded-2xl bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-bold">
          ⚠️ {insightsError}
        </div>
      )}

      {insightsData && !insightsLoading && (
        <>
          {/* Sample sizes & Data limitations banner */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1.5">
            <div className="flex flex-wrap items-center gap-4 font-black text-orange-300">
              <span>حجم العينة في التقرير:</span>
              <span>إجمالي أحداث النشاط: {insightsData.sampleSizes?.totalActivityEvents || 0}</span>
              <span>الزوار الفريدون: {insightsData.sampleSizes?.uniqueVisitors || 0}</span>
              <span>إجمالي الطلبات: {insightsData.sampleSizes?.totalOrdersInPeriod || 0}</span>
            </div>
            {Array.isArray(insightsData.dataLimitations) && insightsData.dataLimitations.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-slate-300/90">
                {insightsData.dataLimitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Insights Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(insightsData.insights || []).map((ins, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-sm font-black text-orange-300">{ins.title}</h5>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                        ins.confidence === 'high'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : ins.confidence === 'medium'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                          : 'bg-orange-500/20 text-orange-300 border border-orange-400/30'
                      }`}
                    >
                      درجة الثقة: {ins.confidence === 'high' ? 'عالية' : ins.confidence === 'medium' ? 'متوسطة' : 'منخفضة (عينة محدودة)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] font-black text-sky-300 block">📌 الحقيقة المرصودة (Observation):</span>
                    <p className="text-xs text-slate-100 leading-relaxed">{ins.observation}</p>
                  </div>

                  {ins.supportingMetrics?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-emerald-300 block">📊 الأدلة الرقمية الداعمة (Supporting Metrics):</span>
                      <ul className="space-y-1 text-[11px] text-slate-200 list-disc list-inside">
                        {ins.supportingMetrics.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ins.possibleExplanations?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-purple-300 block">💡 تفسيرات وفرضيات محتملة (Hypotheses):</span>
                      <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                        {ins.possibleExplanations.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ins.recommendedActions?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-orange-300 block">✅ الإجراءات الموصى بها (Recommended Actions):</span>
                      <ul className="space-y-1 text-[11px] text-slate-100 font-bold list-disc list-inside">
                        {ins.recommendedActions.map((act, i) => (
                          <li key={i}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {ins.limitations && (
                  <div className="pt-2 border-t border-white/10 text-[10px] text-slate-400">
                    <strong>حدود الاستنتاج (Limitations):</strong> {ins.limitations}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
