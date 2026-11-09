import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  Save,
  X,
  Sliders,
  Grid,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

export default function MatrixTemplatesPage() {
  const { token, showToast } = useStore();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    industry: 'optics',
    isDefault: false,
    axisXKey: 'CYL',
    axisXLabel: 'الاستجماتيزم (CYL)',
    axisXValuesStr: '0.00, -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00',
    axisYKey: 'SPH',
    axisYLabel: 'الدرجة الكروية (SPH)',
    axisYValuesStr: '0.00, -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00, -4.25, -4.50, -4.75, -5.00, -5.25, -5.50, -5.75, -6.00'
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/matrix-templates', authHeader);
      setTemplates(res.data?.templates || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل قوالب المصفوفات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadTemplates();
  }, [token]);

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setForm({
        name: template.name || '',
        description: template.description || '',
        industry: template.industry || 'optics',
        isDefault: Boolean(template.isDefault),
        axisXKey: template.axisX?.key || 'CYL',
        axisXLabel: template.axisX?.label || '',
        axisXValuesStr: (template.axisX?.values || []).join(', '),
        axisYKey: template.axisY?.key || 'SPH',
        axisYLabel: template.axisY?.label || '',
        axisYValuesStr: (template.axisY?.values || []).join(', ')
      });
    } else {
      setEditingTemplate(null);
      setForm({
        name: '',
        description: '',
        industry: 'optics',
        isDefault: false,
        axisXKey: 'CYL',
        axisXLabel: 'الاستجماتيزم (CYL)',
        axisXValuesStr: '0.00, -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00',
        axisYKey: 'SPH',
        axisYLabel: 'الدرجة الكروية (SPH)',
        axisYValuesStr: '0.00, -0.25, -0.50, -0.75, -1.00, -1.25, -1.50, -1.75, -2.00, -2.25, -2.50, -2.75, -3.00, -3.25, -3.50, -3.75, -4.00, -4.25, -4.50, -4.75, -5.00, -5.25, -5.50, -5.75, -6.00'
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const axisXValues = form.axisXValuesStr.split(/[,،\n]+/).map((s) => s.trim()).filter(Boolean);
    const axisYValues = form.axisYValuesStr.split(/[,،\n]+/).map((s) => s.trim()).filter(Boolean);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      industry: form.industry,
      isDefault: form.isDefault,
      axisX: {
        key: form.axisXKey.trim(),
        label: form.axisXLabel.trim(),
        values: axisXValues
      },
      axisY: {
        key: form.axisYKey.trim(),
        label: form.axisYLabel.trim(),
        values: axisYValues
      }
    };

    try {
      if (editingTemplate) {
        await axios.put(`/api/admin/matrix-templates/${editingTemplate._id}`, payload, authHeader);
        showToast('تم تحديث قالب المصفوفة بنجاح');
      } else {
        await axios.post('/api/admin/matrix-templates', payload, authHeader);
        showToast('تم إنشاء قالب مصفوفة جديد بنجاح');
      }
      setModalOpen(false);
      loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ القالب', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القالب؟')) return;
    try {
      await axios.delete(`/api/admin/matrix-templates/${id}`, authHeader);
      showToast('تم حذف القالب بنجاح');
      loadTemplates();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حذف القالب', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-12 font-sans text-slate-800" dir="rtl">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl shadow-md shadow-indigo-500/20">
            📐
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">محرك قوالب المصفوفات (Grid Templates Engine)</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                DYNAMIC 2D MATRIX
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              صناعة مصفوفات ثنائية الأبعاد (X × Y) لأي نشاط (بصريات، ملابس، أحذية، إلكترونيات) وربطها بالأقسام
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء قالب مصفوفة جديد</span>
        </button>
      </div>

      {/* Templates List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div
            key={tpl._id}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 hover:border-blue-300 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-slate-900">{tpl.name}</h3>
                  {tpl.isDefault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      افتراضي
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    نشاط: {tpl.industry === 'optics' ? 'بصريات' : tpl.industry === 'apparel' ? 'ملابس وأحذية' : 'عام'}
                  </span>
                </div>
                {tpl.description && (
                  <p className="text-xs text-slate-500 mt-1">{tpl.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenModal(tpl)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="تعديل"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {!tpl.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleDelete(tpl._id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Axes Info Preview */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="block text-[11px] font-black text-indigo-700 mb-0.5">
                  المحور الأفقي X ({tpl.axisX?.label || tpl.axisX?.key})
                </span>
                <span className="text-[11px] text-slate-500 block truncate font-mono">
                  {(tpl.axisX?.values || []).length} أعمدة: {(tpl.axisX?.values || []).slice(0, 5).join(', ')}...
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-black text-purple-700 mb-0.5">
                  المحور الرأسي Y ({tpl.axisY?.label || tpl.axisY?.key})
                </span>
                <span className="text-[11px] text-slate-500 block truncate font-mono">
                  {(tpl.axisY?.values || []).length} صفوف: {(tpl.axisY?.values || []).slice(0, 5).join(', ')}...
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
              <span>إجمالي خلايا المصفوفة: {((tpl.axisX?.values || []).length) * ((tpl.axisY?.values || []).length)} خلية تقاطع</span>
              <span className="text-emerald-600 font-bold">جاهز للربط بأي قسم</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create / Edit Template */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editingTemplate ? 'تعديل قالب المصفوفة' : 'إنشاء قالب مصفوفة جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم القالب *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: مصفوفة عدسات كروية واستجماتيزم، أو مقاسات أحذية وألوان..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-600 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مجال النشاط</label>
                  <select
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-600"
                  >
                    <option value="optics">بصريات ونظارات (Optics)</option>
                    <option value="apparel">ملابس وأزياء (Apparel)</option>
                    <option value="shoes">أحذية (Shoes)</option>
                    <option value="electronics">إلكترونيات وموبايلات</option>
                    <option value="general">نشاط تجاري عام</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="font-bold text-slate-700">تعيين كقالب افتراضي للنظام</span>
                  </label>
                </div>
              </div>

              {/* Axis X Configuration */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/60 space-y-2">
                <span className="font-black text-indigo-900 block">المحور الأفقي X (الأعمدة - Columns)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={form.axisXKey}
                    onChange={(e) => setForm({ ...form, axisXKey: e.target.value })}
                    placeholder="مفتاح المحور (e.g. CYL)"
                    className="bg-white border border-indigo-200 rounded-lg p-2 font-mono"
                  />
                  <input
                    type="text"
                    value={form.axisXLabel}
                    onChange={(e) => setForm({ ...form, axisXLabel: e.target.value })}
                    placeholder="اسم المحور بالعربي (e.g. الاستجماتيزم)"
                    className="bg-white border border-indigo-200 rounded-lg p-2 font-bold"
                  />
                </div>
                <label className="block text-[11px] text-slate-500">القيم المتدرجة مفصولة بفواصل:</label>
                <textarea
                  rows={2}
                  value={form.axisXValuesStr}
                  onChange={(e) => setForm({ ...form, axisXValuesStr: e.target.value })}
                  className="w-full bg-white border border-indigo-200 rounded-lg p-2 font-mono text-xs"
                />
              </div>

              {/* Axis Y Configuration */}
              <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200/60 space-y-2">
                <span className="font-black text-purple-900 block">المحور الرأسي Y (الصفوف - Rows)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={form.axisYKey}
                    onChange={(e) => setForm({ ...form, axisYKey: e.target.value })}
                    placeholder="مفتاح المحور (e.g. SPH)"
                    className="bg-white border border-purple-200 rounded-lg p-2 font-mono"
                  />
                  <input
                    type="text"
                    value={form.axisYLabel}
                    onChange={(e) => setForm({ ...form, axisYLabel: e.target.value })}
                    placeholder="اسم المحور بالعربي (e.g. الدرجة الكروية)"
                    className="bg-white border border-purple-200 rounded-lg p-2 font-bold"
                  />
                </div>
                <label className="block text-[11px] text-slate-500">القيم المتدرجة مفصولة بفواصل:</label>
                <textarea
                  rows={3}
                  value={form.axisYValuesStr}
                  onChange={(e) => setForm({ ...form, axisYValuesStr: e.target.value })}
                  className="w-full bg-white border border-purple-200 rounded-lg p-2 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-sm"
                >
                  حفظ القالب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
