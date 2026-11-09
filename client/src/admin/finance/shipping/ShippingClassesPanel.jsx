import React, { useState } from 'react';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  PackageCheck,
  Calculator
} from 'lucide-react';
import axios from 'axios';

export default function ShippingClassesPanel({
  shippingClasses = [],
  pickupForm,
  setPickupForm,
  shippingConfigForm,
  setShippingConfigForm,
  authHeader,
  currency = 'ج.م',
  showToast,
  onRefresh
}) {
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classForm, setClassForm] = useState({
    code: '',
    name: '',
    description: '',
    customerPrice: '',
    actualCost: '',
    defaultCalculationMode: 'MAX',
    active: true,
    coverageText: '',
    governorate: '',
    citiesStr: '',
    districtsStr: ''
  });

  // Shipping & Address Simulator State
  const [simAddress, setSimAddress] = useState('محافظة أسيوط، مركز منفلوط، شارع الجمهورية');
  const [simCity, setSimCity] = useState('أسيوط');
  const [simDeliveryMethod, setSimDeliveryMethod] = useState('delivery');
  const [simLines, setSimLines] = useState([
    { name: 'منتج أ (MAX - 40)', customerShippingPrice: 40, shippingMode: 'MAX', quantity: 1, requiresShipping: true },
    { name: 'منتج ب (MAX - 65)', customerShippingPrice: 65, shippingMode: 'MAX', quantity: 1, requiresShipping: true },
    { name: 'منتج ج (ADD - 30)', customerShippingPrice: 30, shippingMode: 'ADD', quantity: 1, requiresShipping: true }
  ]);
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleOpenClassModal = (cls = null) => {
    if (cls) {
      setEditingClass(cls);
      const firstReg = cls.coverageRegions?.[0] || {};
      setClassForm({
        code: cls.code || '',
        name: cls.name || '',
        description: cls.description || '',
        customerPrice: cls.customerPrice ?? 0,
        actualCost: cls.actualCost ?? 0,
        defaultCalculationMode: cls.defaultCalculationMode || 'MAX',
        active: cls.active !== false,
        coverageText: cls.coverageText || '',
        governorate: firstReg.governorate || '',
        citiesStr: (firstReg.cities || []).join('، '),
        districtsStr: (firstReg.districts || []).join('، ')
      });
    } else {
      setEditingClass(null);
      setClassForm({
        code: `CLASS_${String.fromCharCode(65 + shippingClasses.length)}`,
        name: `فئة شحن ${String.fromCharCode(65 + shippingClasses.length)}`,
        description: '',
        customerPrice: 50,
        actualCost: 40,
        defaultCalculationMode: 'MAX',
        active: true,
        coverageText: '',
        governorate: '',
        citiesStr: '',
        districtsStr: ''
      });
    }
    setIsClassModalOpen(true);
  };

  const handleSaveShippingClass = async (e) => {
    e.preventDefault();
    const coverageRegions = [];
    if (classForm.governorate.trim() || classForm.citiesStr.trim() || classForm.districtsStr.trim()) {
      coverageRegions.push({
        governorate: classForm.governorate.trim(),
        cities: classForm.citiesStr
          .split(/[,،;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        districts: classForm.districtsStr
          .split(/[,،;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      });
    }

    const payload = {
      code: classForm.code,
      name: classForm.name,
      description: classForm.description,
      customerPrice: Number(classForm.customerPrice || 0),
      actualCost: Number(classForm.actualCost || 0),
      defaultCalculationMode: classForm.defaultCalculationMode,
      active: classForm.active,
      coverageText: classForm.coverageText,
      coverageRegions
    };

    try {
      if (editingClass) {
        await axios.put(`/api/admin/finance/shipping-classes/${editingClass._id}`, payload, authHeader);
        showToast('تم تحديث فئة الشحن بنجاح');
      } else {
        await axios.post('/api/admin/finance/shipping-classes', payload, authHeader);
        showToast('تم إنشاء فئة الشحن بنجاح');
      }
      setIsClassModalOpen(false);
      onRefresh?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ فئة الشحن', 'error');
    }
  };

  const handleToggleClassStatus = async (cls) => {
    try {
      await axios.patch(
        `/api/admin/finance/shipping-classes/${cls._id}/toggle`,
        { active: !cls.active },
        authHeader
      );
      showToast(!cls.active ? 'تم تفعيل فئة الشحن' : 'تم تعطيل فئة الشحن');
      onRefresh?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تغيير الحالة', 'error');
    }
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف فئة الشحن؟')) return;
    try {
      await axios.delete(`/api/admin/finance/shipping-classes/${id}`, authHeader);
      showToast('تم حذف فئة الشحن بنجاح');
      onRefresh?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حذف فئة الشحن', 'error');
    }
  };

  const handleSavePickupAndShippingConfig = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        '/api/admin/finance/settings',
        {
          pickup: pickupForm,
          shippingConfig: shippingConfigForm
        },
        authHeader
      );
      showToast('تم حفظ إعدادات الاستلام من الفرع وحساب الشحن بنجاح');
      onRefresh?.();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ الإعدادات', 'error');
    }
  };

  const handleRunSimulator = async () => {
    setIsSimulating(true);
    try {
      const [addrRes, calcRes] = await Promise.all([
        axios.post('/api/store-public/shipping/classify-address', {
          address: simAddress,
          city: simCity
        }),
        axios.post(
          '/api/admin/finance/shipping/preview',
          {
            deliveryMethod: simDeliveryMethod,
            address: simAddress,
            city: simCity,
            items: simLines.map((l, idx) => ({
              productId: `SIM-${idx + 1}`,
              name: l.name,
              price: 100,
              quantity: Number(l.quantity || 1),
              requiresShipping: l.requiresShipping !== false,
              shippingMode: l.shippingMode,
              customerShippingPrice: Number(l.customerShippingPrice || 0),
              shippingClassId: l.shippingClassId || undefined
            }))
          },
          authHeader
        )
      ]);
      setSimResult({
        addressMatch: addrRes.data,
        quote: calcRes.data?.quote
      });
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تشغيل المحاكي', 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Shipping Classes Management */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-ink flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>فئات الشحن والتغطية الجغرافية (Shipping Classes & Coverage)</span>
            </h4>
            <p className="text-xs text-ink-soft mt-0.5">
              حدّد لكل فئة سعر الشحن للعميل، والتكلفة الفعلية لشركة الشحن، ونطاق التغطية الجغرافية النصي والمهيكل
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenClassModal(null)}
            className="px-4 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black flex items-center gap-1.5 shadow-md hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فئة شحن جديدة</span>
          </button>
        </div>

        {shippingClasses.length === 0 ? (
          <div className="p-8 text-center bg-paper rounded-card border border-line text-xs text-ink-soft space-y-2">
            <p className="font-black text-ink">لا توجد فئات شحن مخصصة بعد</p>
            <p>أضف فئات مثل (A, B, C, D) لتحديد أسعار الشحن والتغطية الجغرافية لكل محافظة أو منطقة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                <tr>
                  <th className="p-3">المُعرف (Code)</th>
                  <th className="p-3">اسم الفئة</th>
                  <th className="p-3">سعر الشحن للعميل</th>
                  <th className="p-3">تكلفة الناقل الفعلية</th>
                  <th className="p-3">النمط الافتراضي</th>
                  <th className="p-3">التغطية الجغرافية</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shippingClasses.map((cls) => (
                  <tr key={cls._id} className="hover:bg-paper/60">
                    <td className="p-3 font-mono font-black text-primary">{cls.code}</td>
                    <td className="p-3 font-bold text-ink">
                      <div>{cls.name}</div>
                      {cls.description && (
                        <span className="text-[10px] text-ink-soft block">{cls.description}</span>
                      )}
                    </td>
                    <td className="p-3 font-black text-emerald-600">
                      {cls.customerPrice} {currency}
                    </td>
                    <td className="p-3 font-bold text-ink-soft">
                      {cls.actualCost} {currency}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                          cls.defaultCalculationMode === 'ADD'
                            ? 'bg-orange-500/15 text-orange-600 border border-orange-500/30'
                            : 'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30'
                        }`}
                      >
                        {cls.defaultCalculationMode}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs">
                      <p className="text-[11px] text-ink line-clamp-2">
                        {cls.coverageText || 'تغطية عامة (جميع المناطق)'}
                      </p>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleToggleClassStatus(cls)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          cls.active
                            ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                            : 'bg-slate-500/15 text-slate-500 border border-slate-500/30'
                        }`}
                      >
                        {cls.active ? 'نشطة (Active)' : 'معطلة (Inactive)'}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenClassModal(cls)}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded-lg"
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(cls._id)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pickup Settings & MAX/ADD Quantity Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSavePickupAndShippingConfig}
          className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs font-bold"
        >
          <h4 className="text-sm font-black text-ink flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-primary" />
            <span>إعدادات الاستلام من الفرع (Pickup) وسلوك الكميات</span>
          </h4>

          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-card bg-paper border border-line">
            <input
              type="checkbox"
              checked={pickupForm.enabled}
              onChange={(e) => setPickupForm({ ...pickupForm, enabled: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="font-black text-ink">
              تفعيل خيار «الاستلام من الفرع (Pickup)» في صفحة إتمام الطلب (شحن = 0 {currency})
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-ink-soft mb-1">اسم الفرع / نقطة الاستلام</label>
              <input
                type="text"
                value={pickupForm.branchName}
                onChange={(e) => setPickupForm({ ...pickupForm, branchName: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">عنوان الفرع للاستلام</label>
              <input
                type="text"
                value={pickupForm.branchAddress}
                onChange={(e) => setPickupForm({ ...pickupForm, branchAddress: e.target.value })}
                placeholder="مثال: شارع التحرير، الدقي..."
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-soft mb-1">تعليمات الاستلام للعميل</label>
            <input
              type="text"
              value={pickupForm.instructions}
              onChange={(e) => setPickupForm({ ...pickupForm, instructions: e.target.value })}
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="pt-2 border-t border-line space-y-2">
            <label className="block text-ink font-black">
              سلوك الكمية لبنود الشحن الإضافي (ADD Quantity Behavior):
            </label>
            <select
              value={shippingConfigForm.addQuantityBehavior}
              onChange={(e) =>
                setShippingConfigForm({ ...shippingConfigForm, addQuantityBehavior: e.target.value })
              }
              className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink outline-none focus:border-primary"
            >
              <option value="per_line">
                لكل سطر منتج في السلة (per_line — الافتراضي المتوافق مع خوارزمية السلة)
              </option>
              <option value="per_unit">
                لكل وحدة/قطعة إضافية من المنتج (per_unit — ضرب قيمة ADD في الكمية)
              </option>
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black shadow-md hover:bg-primary/90"
          >
            حفظ إعدادات الاستلام والشحن
          </button>
        </form>

        {/* Interactive MAX / ADD & Address Simulator */}
        <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-ink flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span>محاكي خوارزمية الشحن (MAX / ADD) وتصنيف العنوان</span>
            </h4>
            <button
              type="button"
              onClick={handleRunSimulator}
              disabled={isSimulating}
              className="px-3.5 py-2 rounded-btn bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSimulating ? 'جاري الحساب...' : 'تشغيل المحاكي الآن ⚡'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-ink-soft font-bold mb-1">عنوان العميل التجريبي:</label>
              <input
                type="text"
                value={simAddress}
                onChange={(e) => setSimAddress(e.target.value)}
                className="w-full bg-paper border border-line rounded-btn p-2 text-ink font-bold"
              />
            </div>
            <div>
              <label className="block text-ink-soft font-bold mb-1">طريقة الاستلام:</label>
              <select
                value={simDeliveryMethod}
                onChange={(e) => setSimDeliveryMethod(e.target.value)}
                className="w-full bg-paper border border-line rounded-btn p-2 text-ink font-bold"
              >
                <option value="delivery">توصيل (Delivery)</option>
                <option value="pickup">استلام من الفرع (Pickup)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-ink-soft">بنود السلة التجريبية:</span>
              <button
                type="button"
                onClick={() =>
                  setSimLines([
                    ...simLines,
                    {
                      name: `منتج ${simLines.length + 1}`,
                      customerShippingPrice: 30,
                      shippingMode: 'ADD',
                      quantity: 1,
                      requiresShipping: true
                    }
                  ])
                }
                className="text-[11px] font-black text-primary hover:underline"
              >
                + إضافة سطر للسلة
              </button>
            </div>

            {simLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-paper p-2 rounded-btn border border-line">
                <input
                  type="text"
                  value={line.name}
                  onChange={(e) => {
                    const copy = [...simLines];
                    copy[idx].name = e.target.value;
                    setSimLines(copy);
                  }}
                  className="col-span-4 bg-surface border border-line rounded p-1.5 text-[11px] font-bold text-ink"
                />
                <input
                  type="number"
                  value={line.customerShippingPrice}
                  onChange={(e) => {
                    const copy = [...simLines];
                    copy[idx].customerShippingPrice = Number(e.target.value);
                    setSimLines(copy);
                  }}
                  className="col-span-3 bg-surface border border-line rounded p-1.5 text-[11px] font-bold text-ink"
                  placeholder="سعر الشحن"
                />
                <select
                  value={line.shippingMode}
                  onChange={(e) => {
                    const copy = [...simLines];
                    copy[idx].shippingMode = e.target.value;
                    setSimLines(copy);
                  }}
                  className="col-span-3 bg-surface border border-line rounded p-1.5 text-[11px] font-black text-ink"
                >
                  <option value="MAX">MAX</option>
                  <option value="ADD">ADD</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSimLines(simLines.filter((_, i) => i !== idx))}
                  className="col-span-2 text-red-500 hover:bg-red-500/10 p-1 rounded text-center font-black"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {simResult && (
            <div className="p-3.5 rounded-card bg-indigo-500/10 border border-indigo-500/25 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black text-indigo-600">
                  القاعدة الأعلى (Base MAX): {simResult.quote?.baseShippingAmount} {currency}
                </span>
                <span className="font-black text-orange-600">
                  إضافات (ADD): +{simResult.quote?.additiveShippingAmount} {currency}
                </span>
                <span className="px-2.5 py-1 rounded-btn bg-primary text-white font-black">
                  إجمالي الشحن النهائي: {simResult.quote?.customerShippingCharge} {currency}
                </span>
              </div>
              {simResult.addressMatch && (
                <div className="text-[11px] font-bold text-ink-soft pt-1 border-t border-indigo-500/20">
                  نتيجة تصنيف العنوان:{' '}
                  <strong className="text-ink">
                    {simResult.addressMatch.matchedClass
                      ? `${simResult.addressMatch.matchedClass.name} (${simResult.addressMatch.matchedClass.code}) — ${simResult.addressMatch.matchMethod}`
                      : simResult.addressMatch.message}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Shipping Class Create / Edit */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface text-ink rounded-card border border-line p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h4 className="text-sm font-black text-ink">
                {editingClass ? 'تعديل فئة الشحن' : 'إضافة فئة شحن جديدة'}
              </h4>
              <button onClick={() => setIsClassModalOpen(false)} className="text-ink-soft hover:text-ink">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShippingClass} className="space-y-3.5 text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">مُعرف الفئة الثابت (Code) *</label>
                  <input
                    type="text"
                    required
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value.toUpperCase() })}
                    placeholder="مثال: A أو B أو UPPER_EGYPT"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">اسم الفئة *</label>
                  <input
                    type="text"
                    required
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    placeholder="مثال: الفئة A - القاهرة والجيزة"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">سعر الشحن للعميل *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={classForm.customerPrice}
                    onChange={(e) => setClassForm({ ...classForm, customerPrice: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">تكلفة الشحن الفعلية (للناقل)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={classForm.actualCost}
                    onChange={(e) => setClassForm({ ...classForm, actualCost: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">طريقة الحساب الافتراضية</label>
                  <select
                    value={classForm.defaultCalculationMode}
                    onChange={(e) => setClassForm({ ...classForm, defaultCalculationMode: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-black"
                  >
                    <option value="MAX">MAX (الأعلى مرة واحدة)</option>
                    <option value="ADD">ADD (يُضاف للقاعدة)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">
                  نطاق التغطية الجغرافية النصي (كما يكتبه مدير المتجر بالعربية أو الإنجليزية):
                </label>
                <textarea
                  rows={3}
                  value={classForm.coverageText}
                  onChange={(e) => setClassForm({ ...classForm, coverageText: e.target.value })}
                  placeholder="مثال: محافظة أسيوط: مدينة أسيوط، منفلوط، أبو تيج، ديروط والمراكز المجاورة / Assiut Governorate: Assiut city, Manfalut, Abu Tig"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>

              <div className="p-3 rounded-card bg-paper border border-line space-y-2.5">
                <span className="block text-[11px] font-black text-primary">
                  حقول موقع مهيكلة إضافية (اختياري لزيادة دقة المطابقة الحتمية):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={classForm.governorate}
                    onChange={(e) => setClassForm({ ...classForm, governorate: e.target.value })}
                    placeholder="المحافظة (مثال: أسيوط)"
                    className="bg-surface border border-line rounded-btn p-2 text-ink"
                  />
                  <input
                    type="text"
                    value={classForm.citiesStr}
                    onChange={(e) => setClassForm({ ...classForm, citiesStr: e.target.value })}
                    placeholder="المدن مفصولة بفاصلة"
                    className="bg-surface border border-line rounded-btn p-2 text-ink"
                  />
                  <input
                    type="text"
                    value={classForm.districtsStr}
                    onChange={(e) => setClassForm({ ...classForm, districtsStr: e.target.value })}
                    placeholder="الأحياء/المراكز مفصولة بفاصلة"
                    className="bg-surface border border-line rounded-btn p-2 text-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2 rounded-btn bg-paper border border-line text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black"
                >
                  حفظ الفئة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
