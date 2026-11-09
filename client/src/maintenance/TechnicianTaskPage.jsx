import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  MessageCircle,
  Save,
  Check,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import axios from 'axios';

export default function TechnicianTaskPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [status, setStatus] = useState('in_maintenance');
  const [techAction, setTechAction] = useState('');
  const [techNotes, setTechNotes] = useState('');

  const loadTask = async () => {
    try {
      setLoading(true);
      setError('');
      const url = `/api/maintenance-public/task/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const res = await axios.get(url);
      const data = res.data?.task;
      setTask(data);
      if (data) {
        setStatus(data.status || 'in_maintenance');
        setTechAction(data.techAction || '');
        setTechNotes(data.techNotes || '');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'تعذر تحميل بيانات مهمة الصيانة. تأكد من صحة الرابط.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadTask();
    }
  }, [id, token]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg('');
      const url = `/api/maintenance-public/task/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const res = await axios.put(url, {
        status,
        techAction,
        techNotes
      });
      setTask(res.data?.task || task);
      setSuccessMsg('تم حفظ وتحديث حالة مهمة الصيانة بنجاح!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'فشل تحديث المهمة');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">جاري تحميل تفاصيل مهمة الصيانة...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-6 rounded-3xl text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-black text-white">تعذر الوصول للمهمة</h2>
          <p className="text-xs text-slate-300 leading-relaxed">{error || 'الرابط غير صالح أو المهمة غير موجودة'}</p>
        </div>
      </div>
    );
  }

  const cleanPhone = task.customer?.phone ? task.customer.phone.replace(/[^0-9]/g, '') : '';
  const waPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header Banner */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 shadow-xl space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>مهمة صيانة فنية</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/10 text-orange-300 border border-white/10">
                    #{task.requestNumber}
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  {task.branchId?.name ? `🏢 ${task.branchId.name}` : 'فرع الصيانة المعتمد'}
                </p>
              </div>
            </div>

            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
              بوابة الفني المعتمد
            </span>
          </div>
        </div>

        {/* Customer & Device Information Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Customer Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-black text-white text-sm pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>بيانات العميل</span>
              <span className="text-[10px] text-slate-400 font-normal">صاحب الجهاز</span>
            </h3>
            <div className="space-y-1.5 text-slate-300">
              <div className="text-white font-bold">{task.customer?.name}</div>
              <div className="font-mono" dir="ltr">{task.customer?.phone}</div>
              {task.customer?.city && (
                <div className="text-slate-400 text-[11px]">{task.customer.city} {task.customer.address ? `- ${task.customer.address}` : ''}</div>
              )}
            </div>

            {/* Quick Contact Buttons */}
            <div className="flex items-center gap-2 pt-2">
              {task.customer?.phone && (
                <>
                  <a
                    href={`tel:${task.customer.phone}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700 text-center"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>اتصال</span>
                  </a>
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center gap-1.5 transition-colors border border-emerald-500/30 text-center"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>واتساب</span>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Device Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-black text-white text-sm pb-2 border-b border-slate-800 flex items-center justify-between">
              <span>الجهاز والشكوى</span>
              <span className="text-[10px] font-mono text-slate-400">طلب #{task.orderId}</span>
            </h3>
            <div className="space-y-1.5 text-slate-300">
              <div className="text-white font-bold">{task.items?.[0]?.name || 'جهاز صيانة'}</div>
              <div className="text-amber-200 font-bold bg-amber-500/20 p-2.5 rounded-xl border border-amber-500/40">
                العطل المبلغ: {task.reason || task.notes || 'فحص عام وإصلاح'}
              </div>
              <div className="text-[11px] text-slate-400">
                حالة الضمان: {task.warrantyStatus === 'in_warranty' ? '✅ ساري الضمان' : '⚠️ خارج الضمان'}
              </div>
            </div>
          </div>
        </div>

        {/* Update Status Form */}
        <form onSubmit={handleSave} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <h2 className="text-sm font-black text-white pb-3 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>تحديث التقرير الفني وحالة الإصلاح</span>
          </h2>

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">حالة مهمة الصيانة الحالية *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'in_maintenance', label: '🔍 قيد الفحص والإصلاح', color: 'border-indigo-500 bg-indigo-500/10 text-indigo-300' },
                { id: 'parts_pending', label: '⏳ في انتظار قطع غيار', color: 'border-amber-500 bg-amber-500/20 text-amber-200' },
                { id: 'repaired', label: '✅ تم الإصلاح بنجاح', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' },
                { id: 'unrepairable', label: '❌ تعذر الإصلاح / مرفوض', color: 'border-red-500 bg-red-500/10 text-red-300' }
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setStatus(opt.id)}
                  className={`p-3 rounded-2xl border text-center font-black transition-all ${
                    status === opt.id ? opt.color + ' ring-2 ring-primary/40' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">الإجراء الفني المتخذ وقطع الغيار المستخدمة</label>
            <textarea
              rows={3}
              value={techAction}
              onChange={(e) => setTechAction(e.target.value)}
              placeholder="مثال: تم فحص الدائرة واستبدال منظم الشحن وتركيب شاشة أصلية وتجربة الجهاز..."
              className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary text-xs"
            />
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">ملاحظات وتوصيات الفني للفرع والعميل</label>
            <textarea
              rows={2}
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              placeholder="مثال: الجهاز جاهز للتسليم مع ضمان شهر على الجزء الذي تم استبداله..."
              className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ وتحديث حالة الصيانة'}</span>
          </button>
        </form>

        {/* Timeline Log */}
        {task.timeline && task.timeline.length > 0 && (
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
            <h3 className="font-bold text-slate-300 pb-2 border-b border-slate-800">سجل تطورات المهمة</h3>
            <div className="space-y-2">
              {task.timeline.map((evt, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-white font-bold">{evt.title}</div>
                    {evt.note && <div className="text-slate-400 text-[11px]">{evt.note}</div>}
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      بواسطة: {evt.by} • {new Date(evt.at).toLocaleString('ar-EG')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
