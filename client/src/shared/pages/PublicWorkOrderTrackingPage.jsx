import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Wrench, CheckCircle2, Clock, Glasses, Check, Sparkles, Building2 } from 'lucide-react';
import axios from 'axios';

export default function PublicWorkOrderTrackingPage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState(null);
  const [stages, setStages] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      const res = await axios.get(`/api/public/work-orders/${token}`);
      setWorkOrder(res.data?.workOrder);
      setStages(res.data?.labStages || []);
    } catch (err) {
      setError(err.response?.data?.error || 'رابط أمر التشغيل غير صالح أو قديم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleUpdateStage = async (stageKey, stageLabel) => {
    setUpdating(true);
    setSuccessMsg('');
    try {
      const res = await axios.put(`/api/public/work-orders/${token}/stage`, {
        stageKey,
        stageLabel,
        notes: 'تم التحديث بواسطة المعمل'
      });
      setWorkOrder(res.data.workOrder);
      setSuccessMsg(`تم تحديث الحالة بنجاح إلى «${stageLabel}»`);
    } catch (err) {
      alert(err.response?.data?.error || 'تعذر تحديث الحالة');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل أمر التشغيل...</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto">
            ⚠️
          </div>
          <h3 className="font-black text-slate-900 text-sm">عذراً، تعذر الوصول لأمر التشغيل</h3>
          <p className="text-xs text-slate-500">{error || 'الرابط غير صالح'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-3 sm:p-6" dir="rtl">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Top Brand Banner */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black mx-auto shadow-md shadow-blue-500/20">
            👓
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">بوابة الورش والمعامل الذكية</span>
            <h1 className="text-base font-black text-slate-900">
              أمر تشغيل وتجهيز نظارة: #{workOrder.workOrderNumber}
            </h1>
            <p className="text-xs text-slate-500">
              المرسل: مركز البصريات (HI LUXE) · العميل: {workOrder.customer?.name}
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Stages Progression Buttons */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900">مراحل تنفيذ العمل (اضغط لتحديث الحالة):</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
              الحالة الحالية: {workOrder.currentStageLabel}
            </span>
          </div>

          <div className="space-y-2">
            {stages.map((st, idx) => {
              const isCurrent = workOrder.currentStage === st.key;
              const isPassed = workOrder.stageHistory?.some((h) => h.stageKey === st.key);

              return (
                <button
                  key={st.key}
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStage(st.key, st.label)}
                  className={`w-full p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md font-black'
                      : isPassed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : isPassed
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs">{st.label}</span>
                  </div>

                  {isCurrent ? (
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-black">
                      قيد التنفيذ الآن
                    </span>
                  ) : isPassed ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="text-[10px] text-slate-400">اضغط للاعتماد</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Items & Measurements */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <span className="text-xs font-black text-slate-900 block">
            المقاسات والمواصفات المطلوب تركيبها:
          </span>

          <div className="space-y-2">
            {(workOrder.items || []).map((it, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Glasses className="w-4 h-4 text-blue-600" />
                    <span>{it.name}</span>
                  </div>
                  {it.unitSlotLabel && (
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-black text-[10px]">
                      {it.unitSlotLabel}
                    </span>
                  )}
                </div>

                {it.specs?.sph && (
                  <div className="p-2 rounded-xl bg-white border border-slate-200 font-mono font-bold text-blue-700 text-xs flex items-center justify-between">
                    <span>SPH: {it.specs.sph}</span>
                    <span>CYL: {it.specs.cyl || '0.00'}</span>
                    {it.specs.axis && <span>AXIS: {it.specs.axis}°</span>}
                    {it.specs.pd && <span>PD: {it.specs.pd} mm</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {workOrder.notes && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
              <span className="font-bold text-amber-900 block">تعليمات وملاحظات فنية خاصة:</span>
              <p className="text-amber-800">{workOrder.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
