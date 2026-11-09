import React, { useState, useEffect, useMemo } from 'react';
import { Eye, Grid, CheckCircle2, AlertTriangle, X, ArrowLeft, Sparkles, Layers, Check } from 'lucide-react';

export default function PosGridPickerModal({
  isOpen,
  onClose,
  product,
  categories = [],
  appliedPrescription = null,
  onConfirm
}) {
  if (!isOpen || !product) return null;

  // 1. Determine Category & Grid Config
  const categoryObj = useMemo(() => {
    if (typeof product.categoryId === 'object' && product.categoryId) return product.categoryId;
    return categories.find((c) => c._id === product.categoryId) || {};
  }, [product, categories]);

  const gridConfig = categoryObj.gridConfig || {};
  const axisX = gridConfig.axisX || {
    key: 'CYL',
    label: 'الاستجماتيزم (CYL)',
    values: ['0.00', '-0.25', '-0.50', '-0.75', '-1.00', '-1.25', '-1.50', '-1.75', '-2.00']
  };
  const axisY = gridConfig.axisY || {
    key: 'SPH',
    label: 'الدرجة الكروية (SPH)',
    values: ['+4.00', '+3.00', '+2.00', '+1.00', '0.00', '-0.50', '-1.00', '-1.50', '-2.00', '-2.50', '-3.00', '-3.50', '-4.00', '-5.00', '-6.00']
  };

  const xValues = axisX.values || ['0.00', '-0.50', '-1.00', '-1.50', '-2.00'];
  const yValues = axisY.values || ['0.00', '-1.00', '-2.00', '-3.00', '-4.00'];

  // Dynamic Unit Slots (e.g. OD & OS for glasses, or custom parts for other industries)
  const unitSlots = useMemo(() => {
    if (Array.isArray(gridConfig.unitSlots) && gridConfig.unitSlots.length > 0) {
      return gridConfig.unitSlots;
    }
    return [
      { key: 'OD', label: 'العين اليمنى (OD)' },
      { key: 'OS', label: 'العين اليسرى (OS)' }
    ];
  }, [gridConfig]);

  const allowMultiUnits = gridConfig.allowMultiUnits !== false;

  // 2. State per Unit Slot
  // Mapping of slotKey -> { enabled: boolean, sph: string, cyl: string, quantity: number }
  const [slotStates, setSlotStates] = useState({});
  const [activeSlotKey, setActiveSlotKey] = useState(unitSlots[0]?.key || 'OD');

  // Matrix stock map from product
  const matrixStock = product.opticsSpecs?.matrixStock || {};

  // Initialize or sync slots when product or prescription opens
  useEffect(() => {
    const initial = {};
    unitSlots.forEach((slot) => {
      let defaultSph = yValues.includes('0.00') ? '0.00' : yValues[0] || '0.00';
      let defaultCyl = xValues.includes('0.00') ? '0.00' : xValues[0] || '0.00';

      // Check prescription auto-sync
      const isRight = slot.key === 'OD' || slot.key === 'R' || slot.label?.includes('يمين');
      const isLeft = slot.key === 'OS' || slot.key === 'L' || slot.label?.includes('يسار') || slot.label?.includes('شمال');

      if (isRight && appliedPrescription?.rightEye?.sph) {
        defaultSph = String(appliedPrescription.rightEye.sph);
        defaultCyl = String(appliedPrescription.rightEye.cyl || '0.00');
      } else if (isLeft && appliedPrescription?.leftEye?.sph) {
        defaultSph = String(appliedPrescription.leftEye.sph);
        defaultCyl = String(appliedPrescription.leftEye.cyl || '0.00');
      }

      initial[slot.key] = {
        enabled: true, // all enabled by default in multi-unit mode
        sph: defaultSph,
        cyl: defaultCyl,
        quantity: 1
      };
    });

    setSlotStates(initial);
    setActiveSlotKey(unitSlots[0]?.key || 'OD');
  }, [product, unitSlots, appliedPrescription]);

  // Handler to toggle a slot
  const toggleSlotEnabled = (slotKey) => {
    if (!allowMultiUnits) {
      // Radio mode
      setSlotStates((prev) => {
        const next = {};
        unitSlots.forEach((s) => {
          next[s.key] = { ...prev[s.key], enabled: s.key === slotKey };
        });
        return next;
      });
      setActiveSlotKey(slotKey);
      return;
    }

    setSlotStates((prev) => ({
      ...prev,
      [slotKey]: {
        ...prev[slotKey],
        enabled: !prev[slotKey]?.enabled
      }
    }));
  };

  // Handler to update values for active slot
  const updateActiveSlot = (field, value) => {
    setSlotStates((prev) => ({
      ...prev,
      [activeSlotKey]: {
        ...prev[activeSlotKey],
        [field]: value
      }
    }));
  };

  // Helper to get stock for a given slot state
  const getSlotStock = (slotData) => {
    if (!slotData) return 0;
    const cellKey = `${slotData.sph}_${slotData.cyl}`;
    return Number(matrixStock[cellKey] || 0);
  };

  // Apply prescription directly to current slot or all
  const applyPrescription = (which) => {
    if (!appliedPrescription) return;
    setSlotStates((prev) => {
      const next = { ...prev };
      unitSlots.forEach((slot) => {
        const isRight = slot.key === 'OD' || slot.key === 'R' || slot.label?.includes('يمين');
        const isLeft = slot.key === 'OS' || slot.key === 'L' || slot.label?.includes('يسار') || slot.label?.includes('شمال');

        if ((which === 'all' || which === 'R') && isRight && appliedPrescription.rightEye) {
          next[slot.key] = {
            ...next[slot.key],
            enabled: true,
            sph: String(appliedPrescription.rightEye.sph || '0.00'),
            cyl: String(appliedPrescription.rightEye.cyl || '0.00')
          };
        }
        if ((which === 'all' || which === 'L') && isLeft && appliedPrescription.leftEye) {
          next[slot.key] = {
            ...next[slot.key],
            enabled: true,
            sph: String(appliedPrescription.leftEye.sph || '0.00'),
            cyl: String(appliedPrescription.leftEye.cyl || '0.00')
          };
        }
      });
      return next;
    });
  };

  // Submit confirmed items
  const handleConfirm = () => {
    const selectedUnits = [];
    unitSlots.forEach((slot) => {
      const state = slotStates[slot.key];
      if (state && state.enabled) {
        const avail = getSlotStock(state);
        selectedUnits.push({
          product,
          quantity: Math.max(1, Number(state.quantity || 1)),
          coords: {
            sph: state.sph,
            cyl: state.cyl,
            unitSlotKey: slot.key,
            unitSlotLabel: slot.label,
            eye: slot.key,
            availableQty: avail
          }
        });
      }
    });

    if (selectedUnits.length === 0) {
      alert('يرجى تحديد وحدة واحدة على الأقل لإدراجها في الفاتورة');
      return;
    }

    onConfirm(selectedUnits);
    onClose();
  };

  const activeSlot = slotStates[activeSlotKey] || { enabled: true, sph: '0.00', cyl: '0.00', quantity: 1 };
  const activeStock = getSlotStock(activeSlot);
  const enabledCount = unitSlots.filter((s) => slotStates[s.key]?.enabled).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Grid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white">
                تحديد مقاسات ووحدات الصنف (Grid Matrix Selection)
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-xs">{product.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prescription Quick Sync Banner if customer has prescription */}
        {appliedPrescription && (
          <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>الروشتة الطبية المسجلة للعميل:</span>
              </span>
              <button
                type="button"
                onClick={() => applyPrescription('all')}
                className="text-[10px] font-bold text-indigo-700 hover:underline bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-200"
              >
                تطبيق الروشتة على كافة الوحدات ✓
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => applyPrescription('R')}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700/60 text-right hover:border-indigo-500 transition-all shadow-xs"
              >
                <div className="font-bold text-[11px] text-indigo-900 dark:text-indigo-300">العين اليمنى (OD):</div>
                <div className="font-mono text-xs font-black">
                  SPH: {appliedPrescription.rightEye?.sph || '0.00'} | CYL: {appliedPrescription.rightEye?.cyl || '0.00'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyPrescription('L')}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700/60 text-right hover:border-indigo-500 transition-all shadow-xs"
              >
                <div className="font-bold text-[11px] text-indigo-900 dark:text-indigo-300">العين اليسرى (OS):</div>
                <div className="font-mono text-xs font-black">
                  SPH: {appliedPrescription.leftEye?.sph || '0.00'} | CYL: {appliedPrescription.leftEye?.cyl || '0.00'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Unit Slots Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              الوحدات المطلوبة في هذا الطلب ({enabledCount} محددة):
            </span>
            <span className="text-[10px] text-slate-400">
              {allowMultiUnits ? 'يمكنك تفعيل وحدة واحدة أو كلاهما معاً' : 'اختر وحدة واحدة فقط'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {unitSlots.map((slot) => {
              const state = slotStates[slot.key] || { enabled: true, sph: '0.00', cyl: '0.00' };
              const isSelected = activeSlotKey === slot.key;
              const isEnabled = state.enabled;
              const stock = getSlotStock(state);

              return (
                <div
                  key={slot.key}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-xs'
                      : isEnabled
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      : 'border-slate-200/60 opacity-50 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                  onClick={() => setActiveSlotKey(slot.key)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {slot.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSlotEnabled(slot.key);
                      }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-white transition-colors ${
                        isEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={isEnabled ? 'إلغاء تضمين هذه الوحدة' : 'تضمين هذه الوحدة في الفاتورة'}
                    >
                      {isEnabled && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isEnabled ? (
                    <div className="text-[11px] font-mono font-bold flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>SPH: {state.sph}</span>
                      <span>CYL: {state.cyl}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans ${stock > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                        {stock > 0 ? `${stock} متاح` : 'نواقص'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">غير محددة في هذا الطلب</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration for Current Active Slot */}
        {activeSlot.enabled && (
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                ضبط مقاس: {unitSlots.find((s) => s.key === activeSlotKey)?.label || activeSlotKey}
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-500">
                الرصيد في الدرج: <b className="text-slate-900 dark:text-white">{activeStock} قطعة</b>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Axis Y (e.g. SPH) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {axisY.label || 'الدرجة الكروية (SPH)'} *
                </label>
                <select
                  value={activeSlot.sph}
                  onChange={(e) => updateActiveSlot('sph', e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-mono font-bold text-xs outline-none focus:border-indigo-500"
                >
                  {yValues.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              </div>

              {/* Axis X (e.g. CYL) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {axisX.label || 'الاستجماتيزم (CYL)'} *
                </label>
                <select
                  value={activeSlot.cyl}
                  onChange={(e) => updateActiveSlot('cyl', e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 font-mono font-bold text-xs outline-none focus:border-indigo-500"
                >
                  {xValues.map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock State Indicator for Active Slot */}
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                activeStock > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {activeStock > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <div>
                  <span className="font-black text-xs block">
                    مقاس (SPH: {activeSlot.sph} | CYL: {activeSlot.cyl})
                  </span>
                  <span className="text-[10px] opacity-80 block">
                    {activeStock > 0
                      ? `متوفر بالدرج (${activeStock} متاح)`
                      : '⚠️ رصيد هذا المقاس صفر، سيتم قيده كطلب توريد تلقائياً'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500">
            سيتم إدراج <b className="text-indigo-600">{enabledCount}</b> عناصر في الفاتورة
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={enabledCount === 0}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>تأكيد وإدراج بالفاتورة ({enabledCount})</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
