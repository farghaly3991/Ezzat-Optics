import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Calendar,
  User,
  FileText,
  Upload,
  CheckCircle2,
  Trash2,
  Eye,
  History,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import ImageUploader from '../../../shared/components/ImageUploader';

/**
 * Generic Dynamic Client Profile Modal
 * Reads its form schema dynamically from `clientProfileConfig`.
 */
export default function DynamicClientProfileModal({
  isOpen = true,
  onClose,
  customer,
  onApplyToPos = null
}) {
  const { token, config, showToast } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Read dynamic configuration from store settings
  const profileConfig = config?.clientProfileConfig || {
    enabled: true,
    profileTitle: 'كشف النظر والقياسات البصرية',
    actionButtonLabel: 'فحص كشف النظر',
    dateFieldLabel: 'تاريخ الفحص / الكشف',
    fields: [
      { key: 'doctorName', label: 'اسم الطبيب المعالج', type: 'text' },
      { key: 'usageType', label: 'نوع الاستخدام', type: 'select', options: ['مسافة', 'قراءة قريب', 'كمبيوتر', 'دائم'] },
      { key: 'ipd', label: 'المسافة الكلية بين البؤبؤين (IPD)', type: 'number' }
    ],
    enableMatrix: true,
    matrixConfig: {
      title: 'جدول قياسات العين والعدسات',
      rows: [
        { key: 'OD', label: 'العين اليمنى (OD)' },
        { key: 'OS', label: 'العين اليسرى (OS)' }
      ],
      columns: [
        { key: 'sph', label: 'SPH (كروي)' },
        { key: 'cyl', label: 'CYL (اسطواني)' },
        { key: 'axis', label: 'AXIS (المحور)' },
        { key: 'add', label: 'ADD (إضافة القراءة)' },
        { key: 'pd', label: 'PD (المسافة)' }
      ]
    },
    enableAttachments: true,
    attachmentsLabel: 'مرفقات وصور الروشتة/الكشف'
  };

  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'new'
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Profile Form State
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recordTitle, setRecordTitle] = useState('');
  const [fieldValues, setFieldValues] = useState({});
  const [matrixData, setMatrixData] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes] = useState('');

  // Selected Profile for detail view
  const [expandedProfileId, setExpandedProfileId] = useState(null);

  // Fetch client profiles
  const loadProfiles = async () => {
    if (!customer?._id || !token) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `/api/admin/customers/${customer._id}/custom-profiles`,
        authHeader
      );
      const list = res.data?.profiles || [];
      setProfiles(list);
      if (list.length > 0) {
        setExpandedProfileId(list[0]._id);
      } else {
        setActiveTab('new');
      }
    } catch (err) {
      console.warn('Could not load custom profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer?._id) {
      loadProfiles();
    }
  }, [isOpen, customer?._id]);

  if (!isOpen || !customer) return null;

  const handleFieldChange = (key, val) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleMatrixCellChange = (rowKey, colKey, val) => {
    setMatrixData((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {}),
        [colKey]: val
      }
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        date: recordDate,
        title: recordTitle || `${profileConfig.profileTitle} - ${recordDate}`,
        fieldValues,
        matrixData,
        attachments,
        notes
      };

      await axios.post(
        `/api/admin/customers/${customer._id}/custom-profiles`,
        payload,
        authHeader
      );

      showToast(`تم حفظ ${profileConfig.profileTitle} بنجاح`);
      setActiveTab('history');
      setRecordTitle('');
      setFieldValues({});
      setMatrixData({});
      setAttachments([]);
      setNotes('');
      loadProfiles();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ السجل', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟')) return;
    try {
      await axios.delete(
        `/api/admin/customers/${customer._id}/custom-profiles/${profileId}`,
        authHeader
      );
      showToast('تم حذف السجل بنجاح');
      loadProfiles();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر الحذف', 'error');
    }
  };

  const handleApply = (prof) => {
    if (onApplyToPos) {
      onApplyToPos(prof);
      showToast('تم تطبيق القياسات على الفاتورة الحالية');
      onClose();
    }
  };

  const rows = profileConfig.matrixConfig?.rows || [];
  const columns = profileConfig.matrixConfig?.columns || [];

  return (
    <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col my-auto relative">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-line bg-paper/60 sticky top-0 z-20 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-ink">
                {profileConfig.profileTitle} — {customer.fullname || customer.name}
              </h3>
              <p className="text-[11px] text-ink-soft">
                هيكل ديناميكي مرن لسجلات وقياسات العميل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'history' ? 'new' : 'history')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'new'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-paper text-ink-soft hover:text-ink border border-line'
              }`}
            >
              {activeTab === 'new' ? (
                <>
                  <History className="w-3.5 h-3.5" />
                  <span>عرض السجلات السابقة</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إضافة سجل / قياس جديد</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-ink-soft hover:text-red-500 rounded-xl hover:bg-paper transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* TAB: History View */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {loading ? (
                <div className="p-12 text-center text-xs text-ink-soft animate-pulse">
                  جاري تحميل السجلات...
                </div>
              ) : profiles.length === 0 ? (
                <div className="p-12 rounded-3xl bg-paper border border-dashed border-line text-center space-y-3">
                  <FileText className="w-10 h-10 text-ink-soft mx-auto" />
                  <h4 className="text-sm font-black text-ink">
                    لا توجد سجلات مسجلة لـ {customer.fullname || customer.name} بعد
                  </h4>
                  <p className="text-xs text-ink-soft">
                    يمكنك إدخال أول قياس/كشف الآن بالضغط على الزر أدناه
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className="px-5 py-2 rounded-xl bg-primary text-white font-black text-xs hover:bg-primary/90 transition-all shadow-sm inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة سجل جديد الآن</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profiles.map((prof, idx) => {
                    const isExpanded = expandedProfileId === prof._id;
                    const formattedDate = new Date(prof.date).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });

                    return (
                      <div
                        key={prof._id || idx}
                        className="rounded-2xl bg-paper border border-line overflow-hidden shadow-sm transition-all"
                      >
                        {/* Summary Bar */}
                        <div
                          onClick={() => setExpandedProfileId(isExpanded ? null : prof._id)}
                          className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-surface/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-mono font-black text-xs flex items-center justify-center">
                              #{profiles.length - idx}
                            </span>
                            <div>
                              <h5 className="text-xs sm:text-sm font-black text-ink">
                                {prof.title || `${profileConfig.profileTitle} - ${formattedDate}`}
                              </h5>
                              <div className="flex items-center gap-2 text-[11px] text-ink-soft font-mono mt-0.5">
                                <Calendar className="w-3 h-3 text-primary" />
                                <span>{formattedDate}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {onApplyToPos && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApply(prof);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تطبيق على الفاتورة</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProfile(prof._id);
                              }}
                              className="p-1.5 text-ink-soft hover:text-red-500 rounded-lg hover:bg-surface transition-colors"
                              title="حذف هذا السجل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="p-1 text-ink-soft">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Detail View */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-line bg-surface space-y-4 animate-fadeIn text-xs">
                            {/* Dynamic Fields Grid */}
                            {profileConfig.fields && profileConfig.fields.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {profileConfig.fields.map((f) => (
                                  <div key={f.key} className="p-2.5 rounded-xl bg-paper border border-line space-y-1">
                                    <span className="text-[10px] text-ink-soft block font-bold">{f.label}:</span>
                                    <span className="font-black text-ink block text-xs">
                                      {prof.fieldValues?.[f.key] || '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Matrix Data View */}
                            {profileConfig.enableMatrix && prof.matrixData && (
                              <div className="space-y-2">
                                <span className="font-black text-ink block text-[11px]">
                                  {profileConfig.matrixConfig?.title || 'جدول القياسات'}:
                                </span>
                                <div className="border border-line rounded-xl overflow-hidden">
                                  <table className="w-full text-right text-xs">
                                    <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                                      <tr>
                                        <th className="p-2.5">المحور / الجهة</th>
                                        {columns.map((col) => (
                                          <th key={col.key} className="p-2.5 text-center">{col.label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                      {rows.map((row) => (
                                        <tr key={row.key} className="hover:bg-paper/30">
                                          <td className="p-2.5 font-bold text-ink">{row.label}</td>
                                          {columns.map((col) => (
                                            <td key={col.key} className="p-2.5 text-center font-mono font-black text-primary">
                                              {prof.matrixData?.[row.key]?.[col.key] || '—'}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {prof.notes && (
                              <div className="p-3 rounded-xl bg-paper border border-line text-xs space-y-1">
                                <span className="font-bold text-ink-soft block text-[10px]">ملاحظات الفاحص:</span>
                                <p className="text-ink leading-relaxed">{prof.notes}</p>
                              </div>
                            )}

                            {/* Attachments / Photos */}
                            {prof.attachments && prof.attachments.length > 0 && (
                              <div className="space-y-2">
                                <span className="font-black text-ink block text-[11px]">
                                  {profileConfig.attachmentsLabel || 'المرفقات والصور'}:
                                </span>
                                <div className="flex flex-wrap gap-2.5">
                                  {prof.attachments.map((att, aIdx) => (
                                    <a
                                      key={aIdx}
                                      href={att}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group relative block w-20 h-20 rounded-xl overflow-hidden border border-line bg-paper"
                                    >
                                      <img src={att} alt="Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                        <Eye className="w-4 h-4" />
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: New Profile Form */}
          {activeTab === 'new' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs flex items-center gap-2 text-primary font-bold">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>إدخال سجل وقياسات جديدة للعميل بناءً على الهيكلية الديناميكية المعتمدة</span>
              </div>

              {/* Title & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                <div>
                  <label className="block text-ink-soft mb-1">{profileConfig.dateFieldLabel || 'تاريخ الكشف / الفحص'} *</label>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">عنوان / وصف السجل (اختياري)</label>
                  <input
                    type="text"
                    placeholder={`مثال: ${profileConfig.profileTitle} الدوري...`}
                    value={recordTitle}
                    onChange={(e) => setRecordTitle(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Dynamic Fields Section */}
              {profileConfig.fields && profileConfig.fields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                  {profileConfig.fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-ink-soft mb-1">{f.label}</label>
                      {f.type === 'select' ? (
                        <select
                          value={fieldValues[f.key] ?? (f.defaultValue || '')}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink outline-none focus:border-primary"
                        >
                          <option value="">-- اختر --</option>
                          {(f.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          step="any"
                          value={fieldValues[f.key] ?? ''}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          placeholder={f.label}
                          className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink outline-none focus:border-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic Matrix (Refraction / Measurements Grid) */}
              {profileConfig.enableMatrix && rows.length > 0 && columns.length > 0 && (
                <div className="space-y-2">
                  <span className="font-black text-ink block text-xs">
                    {profileConfig.matrixConfig?.title || 'جدول القياسات'}:
                  </span>
                  <div className="border border-line rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                        <tr>
                          <th className="p-3">المحور / الجهة</th>
                          {columns.map((col) => (
                            <th key={col.key} className="p-3 text-center">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {rows.map((row) => (
                          <tr key={row.key} className="hover:bg-paper/30">
                            <td className="p-3 font-black text-ink">{row.label}</td>
                            {columns.map((col) => (
                              <td key={col.key} className="p-2 text-center">
                                <input
                                  type="text"
                                  placeholder="0.00"
                                  value={matrixData[row.key]?.[col.key] ?? ''}
                                  onChange={(e) => handleMatrixCellChange(row.key, col.key, e.target.value)}
                                  className="w-20 px-2 py-1.5 rounded-lg bg-paper border border-line text-xs font-mono font-black text-center text-ink outline-none focus:border-primary"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              {profileConfig.enableAttachments && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink block">
                    {profileConfig.attachmentsLabel || 'مرفقات وصور الروشتة/الكشف'}:
                  </label>
                  <ImageUploader
                    images={attachments}
                    onChange={(urls) => setAttachments(urls)}
                    multiple={true}
                    folder="prescriptions"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-ink-soft block mb-1">ملاحظات إضافية:</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات طبية أو فنية إضافية..."
                  className="w-full bg-paper border border-line rounded-xl p-2.5 text-xs text-ink outline-none focus:border-primary"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-ink-soft hover:bg-paper"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'جاري الحفظ...' : 'حفظ السجل بالبروفايل'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
