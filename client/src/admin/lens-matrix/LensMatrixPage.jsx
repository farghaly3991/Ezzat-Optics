import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Eye,
  Grid,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Save,
  Search,
  RefreshCw,
  Printer,
  Sparkles,
  ClipboardList,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Package,
  Sliders,
  X,
  Mic,
  Zap,
  RotateCcw,
  Volume2,
  Bot
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import { useGeminiVoiceInput } from '../../shared/utils/useGeminiVoiceInput';

export default function LensMatrixPage() {
  const { token, config, showToast } = useStore();
  const [searchParams] = useSearchParams();
  const urlProductId = searchParams.get('productId');
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // Lens Products & Selection
  const [lensProducts, setLensProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(urlProductId || '');
  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState(null); // { product, template, matrixStock }

  // Editable Grid State
  const [gridStock, setGridStock] = useState({});
  const [unallocatedStock, setUnallocatedStock] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // View Options
  const [powerView, setPowerView] = useState('minus'); // 'minus' (قصر نظر) | 'plus' (طول نظر) | 'all'
  const [mode, setMode] = useState('edit'); // 'edit' | 'stocktake'

  // Quick Checker State
  const [checkerSph, setCheckerSph] = useState('-1.50');
  const [checkerCyl, setCheckerCyl] = useState('-0.50');
  const [checkerResult, setCheckerResult] = useState(null);
  const [checkerAdjusting, setCheckerAdjusting] = useState(false);

  // Stocktaking Session State
  const [stocktakeCounts, setStocktakeCounts] = useState({});
  const [stocktakeReason, setStocktakeReason] = useState('جرد دوري لدروج العدسات');
  const [stocktakeNotes, setStocktakeNotes] = useState('');
  const [stocktakeSubmitting, setStocktakeSubmitting] = useState(false);

  // Excel Import Ref
  const fileInputRef = useRef(null);

  // Quick Bulk Fill & Voice Engine State
  const [bulkFillQty, setBulkFillQty] = useState(2);
  const [voiceCommandText, setVoiceCommandText] = useState('');
  const [smartFeedback, setSmartFeedback] = useState(null);
  const [isExecutingAiCmd, setIsExecutingAiCmd] = useState(false);

  // Hovered / Focused Cell Crosshair State ({ sph, cyl } | null)
  const [hoveredCell, setHoveredCell] = useState(null);

  // 1. Load All Lens Products
  const loadLensProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/lens-matrix/products', authHeader);
      const prods = res.data?.products || [];
      setLensProducts(prods);
      if (urlProductId && prods.some(p => p._id === urlProductId)) {
        setSelectedProductId(urlProductId);
      } else if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0]._id);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل قائمة العدسات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadLensProducts();
  }, [token]);

  // 2. Load Matrix Data for Selected Product
  const loadProductMatrix = async (prodId) => {
    if (!prodId) return;
    try {
      setLoading(true);
      const res = await axios.get(`/api/admin/lens-matrix/${prodId}`, authHeader);
      const data = res.data || {};
      setMatrixData(data);
      setGridStock(data.matrixStock || {});
      setUnallocatedStock(data.product?.unallocatedStock || 0);

      // Initialize stocktake counts with current stock
      setStocktakeCounts(data.matrixStock || {});
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل مصفوفة العدسة', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductId && token) {
      loadProductMatrix(selectedProductId);
    }
  }, [selectedProductId, token]);

  // Template Axis Metadata & Ranges (Supports both Optical SPH×CYL and Custom Developer/Category 2D Matrices)
  const axisXLabel = useMemo(() => {
    return matrixData?.template?.axisX?.label || 'الاستجماتيزم (CYL)';
  }, [matrixData]);

  const axisYLabel = useMemo(() => {
    return matrixData?.template?.axisY?.label || 'الدرجة الكروية (SPH)';
  }, [matrixData]);

  const axisXShort = useMemo(() => {
    const key = matrixData?.template?.axisX?.key;
    if (key && key.toLowerCase() !== 'cyl') return matrixData?.template?.axisX?.label || key.toUpperCase();
    return 'CYL';
  }, [matrixData]);

  const axisYShort = useMemo(() => {
    const key = matrixData?.template?.axisY?.key;
    if (key && key.toLowerCase() !== 'sph') return matrixData?.template?.axisY?.label || key.toUpperCase();
    return 'SPH';
  }, [matrixData]);

  const cylValues = useMemo(() => {
    return matrixData?.template?.axisX?.values || [
      '0.00', '-0.25', '-0.50', '-0.75', '-1.00', '-1.25', '-1.50', '-1.75', '-2.00'
    ];
  }, [matrixData]);

  const allSphValues = useMemo(() => {
    return matrixData?.template?.axisY?.values || [
      '+6.00', '+5.75', '+5.50', '+5.25', '+5.00', '+4.75', '+4.50', '+4.25',
      '+4.00', '+3.75', '+3.50', '+3.25', '+3.00', '+2.75', '+2.50', '+2.25',
      '+2.00', '+1.75', '+1.50', '+1.25', '+1.00', '+0.75', '+0.50', '+0.25',
      '0.00',
      '-0.25', '-0.50', '-0.75', '-1.00', '-1.25', '-1.50', '-1.75', '-2.00',
      '-2.25', '-2.50', '-2.75', '-3.00', '-3.25', '-3.50', '-3.75', '-4.00',
      '-4.25', '-4.50', '-4.75', '-5.00', '-5.25', '-5.50', '-5.75', '-6.00'
    ];
  }, [matrixData]);

  // Check if Y-axis actually uses signed diopter values (+ / -) or is a custom non-optical matrix (e.g. S/M/L, 40/41/42)
  const hasSignedDiopterAxis = useMemo(() => {
    return allSphValues.some((v) => String(v).startsWith('-') || String(v).startsWith('+'));
  }, [allSphValues]);

  // Keep Quick Checker defaults synchronized with the active template's axes
  useEffect(() => {
    if (allSphValues.length > 0 && !allSphValues.includes(checkerSph)) {
      setCheckerSph(allSphValues.includes('-1.50') ? '-1.50' : allSphValues[0]);
    }
    if (cylValues.length > 0 && !cylValues.includes(checkerCyl)) {
      setCheckerCyl(cylValues.includes('-0.50') ? '-0.50' : cylValues[0]);
    }
  }, [allSphValues, cylValues]);

  // Filter Y-axis rows based on powerView toggle (only when signed diopter values exist)
  const filteredSphValues = useMemo(() => {
    if (!hasSignedDiopterAxis) {
      return allSphValues;
    }
    if (powerView === 'minus') {
      return allSphValues.filter((sph) => String(sph).startsWith('-') || sph === '0.00');
    }
    if (powerView === 'plus') {
      return allSphValues.filter((sph) => String(sph).startsWith('+') || sph === '0.00');
    }
    return allSphValues;
  }, [allSphValues, powerView, hasSignedDiopterAxis]);

  // Live Total Matrix Count
  const liveTotalStock = useMemo(() => {
    let total = 0;
    for (const val of Object.values(gridStock)) {
      total += Number(val || 0);
    }
    return total + Number(unallocatedStock || 0);
  }, [gridStock, unallocatedStock]);

  // 1-Click Uniform Bulk Fill
  const handleBulkFillUniform = (targetQty) => {
    const qty = Math.max(0, parseInt(targetQty, 10) || 0);
    const updated = { ...gridStock };
    let count = 0;
    filteredSphValues.forEach((sph) => {
      cylValues.forEach((cyl) => {
        const key = `${sph}_${cyl}`;
        if (qty === 0) {
          delete updated[key];
        } else {
          updated[key] = qty;
        }
        count++;
      });
    });
    setGridStock(updated);
    showToast(`تم تطبيق كمية (${qty}) على جميع خانات العرض (${count} خانة)`);
    setSmartFeedback(`تمت تعبئة ${count} خانة بمقدار ${qty} قطعة`);
  };

  // Apply structured matrix plan (from Backend Unified AI / Rule Engine)
  const applyMatrixCommandPlan = (plan) => {
    const updated = mode === 'stocktake' ? { ...stocktakeCounts } : { ...gridStock };
    const setCellVal = (key, q) => {
      const num = Math.max(0, parseInt(q, 10) || 0);
      if (num === 0 && mode !== 'stocktake') {
        delete updated[key];
      } else {
        updated[key] = num;
      }
    };

    const rules = Array.isArray(plan.rules) ? plan.rules : [];
    const hasPlusRule = rules.some((r) => r.group === 'plus' || (r.sph && String(r.sph).startsWith('+')));
    const hasMinusRule = rules.some((r) => r.group === 'minus' || (r.sph && String(r.sph).startsWith('-')));

    // Determine target SPH rows for baseQty
    const targetBaseRows =
      plan.baseScope === 'visible' && !hasPlusRule && !hasMinusRule
        ? filteredSphValues
        : allSphValues;

    // Track excluded cells so baseQty does not overwrite them
    const excludedKeys = new Set();
    rules.forEach((r) => {
      if (r.action !== 'exclude') return;
      if (r.type === 'group' && r.group === 'plus') {
        allSphValues
          .filter((s) => String(s).startsWith('+'))
          .forEach((s) => cylValues.forEach((c) => excludedKeys.add(`${s}_${c}`)));
      } else if (r.type === 'group' && r.group === 'minus') {
        allSphValues
          .filter((s) => String(s).startsWith('-'))
          .forEach((s) => cylValues.forEach((c) => excludedKeys.add(`${s}_${c}`)));
      } else if (r.type === 'row' && r.sph) {
        cylValues.forEach((c) => excludedKeys.add(`${r.sph}_${c}`));
      } else if (r.type === 'col' && r.cyl) {
        allSphValues.forEach((s) => excludedKeys.add(`${s}_${r.cyl}`));
      } else if (r.type === 'cell' && r.sph && r.cyl) {
        excludedKeys.add(`${r.sph}_${r.cyl}`);
      }
    });

    let filledCount = 0;
    if (plan.baseQty !== null && plan.baseQty !== undefined) {
      targetBaseRows.forEach((sph) => {
        cylValues.forEach((cyl) => {
          const key = `${sph}_${cyl}`;
          if (excludedKeys.has(key)) {
            delete updated[key];
            return;
          }
          setCellVal(key, plan.baseQty);
          filledCount++;
        });
      });
    }

    let customCount = 0;
    rules.forEach((r) => {
      if (r.action === 'exclude') return;
      const qty = Math.max(0, parseInt(r.qty, 10) || 0);
      if (r.type === 'group' && r.group === 'plus') {
        allSphValues
          .filter((s) => String(s).startsWith('+'))
          .forEach((s) => {
            cylValues.forEach((c) => {
              setCellVal(`${s}_${c}`, qty);
              customCount++;
            });
          });
      } else if (r.type === 'group' && r.group === 'minus') {
        allSphValues
          .filter((s) => String(s).startsWith('-'))
          .forEach((s) => {
            cylValues.forEach((c) => {
              setCellVal(`${s}_${c}`, qty);
              customCount++;
            });
          });
      } else if (r.type === 'row' && r.sph) {
        cylValues.forEach((c) => {
          setCellVal(`${r.sph}_${c}`, qty);
          customCount++;
        });
      } else if (r.type === 'col' && r.cyl) {
        allSphValues.forEach((s) => {
          setCellVal(`${s}_${r.cyl}`, qty);
          customCount++;
        });
      } else if (r.type === 'cell' && r.sph && r.cyl) {
        setCellVal(`${r.sph}_${r.cyl}`, qty);
        customCount++;
      }
    });

    if (mode === 'stocktake') {
      setStocktakeCounts(updated);
    } else {
      setGridStock(updated);
    }

    // If the command modified or excluded plus rows while user was viewing 'minus' only, switch view to 'all' so user sees the full result
    if (hasSignedDiopterAxis && hasPlusRule && powerView === 'minus') {
      setPowerView('all');
    }

    const msg =
      plan.summaryAr ||
      (plan.baseQty !== null && plan.baseQty !== undefined
        ? `✅ تم تعبئة (${plan.baseQty}) في ${filledCount} خانة${
            excludedKeys.size > 0 ? `، واستثناء ${excludedKeys.size} خانة` : ''
          }${customCount > 0 ? `، وتخصيص ${customCount} خانة بنجاح!` : ' بنجاح!'}`
        : `✅ تم تطبيق التعديلات على ${customCount} خانة بنجاح!`);

    setSmartFeedback(msg);
    showToast(msg);
  };

  // Smart Natural Language & Voice Command Interpreter (Backend Unified AI + Local Fallback)
  const handleExecuteVoiceCommand = async (rawText) => {
    const text = (rawText || voiceCommandText || '').trim();
    if (!text) {
      showToast('يرجى قول أو كتابة الأمر أولاً', 'error');
      return;
    }

    setIsExecutingAiCmd(true);
    try {
      const res = await axios.post(
        `/api/admin/lens-matrix/${selectedProductId}/ai-command`,
        {
          command: text,
          allSphValues,
          visibleSphValues: filteredSphValues,
          cylValues
        },
        authHeader
      );

      if (res.data?.done && res.data?.plan) {
        applyMatrixCommandPlan(res.data.plan);
        return;
      }
    } catch (err) {
      showToast(
        err.response?.data?.error ||
          'تعذر استخراج مقادير واضحة. جرب: «دخل في كل الخلايا 2 ما عدا طويلة النظر 4»',
        'error'
      );
    } finally {
      setIsExecutingAiCmd(false);
    }
  };

  // Gemini Primary + Official Browser SpeechRecognition Fallback Voice Hook
  const {
    isListening: isListeningVoice,
    isProcessing: isProcessingVoice,
    toggleVoice: handleToggleVoice
  } = useGeminiVoiceInput({
    contextHint: 'matrix',
    showToast,
    onInterim: (interimText) => {
      if (interimText) setVoiceCommandText(interimText);
    },
    onTranscript: (transcript, provider) => {
      setVoiceCommandText(transcript);
      const sourceLabel = provider === 'gemini' ? 'Gemini Audio' : 'متصفح الويب';
      showToast(`🎙️ تم التقاط الأمر الصوتي (${sourceLabel}): «${transcript}»`, 'info');
      handleExecuteVoiceCommand(transcript);
    },
    onError: (msg) => {
      showToast(msg, 'error');
    }
  });

  // Stocktake Variances
  const stocktakeSummary = useMemo(() => {
    let countedTotal = 0;
    let bookTotal = 0;
    for (const val of Object.values(gridStock)) {
      bookTotal += Number(val || 0);
    }
    bookTotal += Number(unallocatedStock || 0);

    for (const val of Object.values(stocktakeCounts)) {
      countedTotal += Number(val || 0);
    }
    const varianceQty = countedTotal - bookTotal;
    const unitCost = Number(matrixData?.product?.costPrice || (Number(matrixData?.product?.price || 0) * 0.5));
    const varianceValue = Math.abs(varianceQty) * unitCost;

    return { bookTotal, countedTotal, varianceQty, varianceValue, unitCost };
  }, [gridStock, stocktakeCounts, unallocatedStock, matrixData]);

  // 3. Save Matrix
  const handleSaveMatrix = async () => {
    if (!selectedProductId) return;
    setIsSaving(true);
    try {
      const res = await axios.put(
        `/api/admin/lens-matrix/${selectedProductId}`,
        {
          matrixStock: gridStock,
          unallocatedStock: Number(unallocatedStock || 0)
        },
        authHeader
      );
      showToast(res.data?.message || 'تم حفظ مصفوفة العدسات بنجاح');
      loadProductMatrix(selectedProductId);
      loadLensProducts();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ المصفوفة', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Submit Stocktake
  const handleSubmitStocktake = async () => {
    if (!selectedProductId) return;
    if (stocktakeSummary.varianceQty !== 0 && !stocktakeReason.trim()) {
      showToast('يرجى كتابة سبب الفرق قبل اعتماد الجرد', 'error');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من اعتماد الجرد؟ فارق الكمية (${stocktakeSummary.varianceQty >= 0 ? `+${stocktakeSummary.varianceQty}` : stocktakeSummary.varianceQty} قطعة)`)) return;

    setStocktakeSubmitting(true);
    try {
      const res = await axios.post(
        `/api/admin/lens-matrix/${selectedProductId}/stocktake`,
        {
          countedMatrix: stocktakeCounts,
          countedUnallocated: Number(unallocatedStock || 0),
          reason: stocktakeReason.trim(),
          notes: stocktakeNotes.trim()
        },
        authHeader
      );
      showToast(res.data?.message || 'تم اعتماد الجرد بنجاح');
      setMode('edit');
      loadProductMatrix(selectedProductId);
      loadLensProducts();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر اعتماد الجرد', 'error');
    } finally {
      setStocktakeSubmitting(false);
    }
  };

  // 5. Quick Checker
  const handleQuickCheck = async (action = 'check', qty = 1) => {
    if (!selectedProductId || !checkerSph || !checkerCyl) return;
    setCheckerAdjusting(true);
    try {
      const res = await axios.post(
        `/api/admin/lens-matrix/${selectedProductId}/quick-adjust`,
        { sph: checkerSph, cyl: checkerCyl, action, quantity: qty },
        authHeader
      );
      if (action === 'check') {
        setCheckerResult(res.data);
      } else {
        showToast(res.data?.message || 'تم التعديل');
        setCheckerResult((prev) => (prev ? { ...prev, available: res.data?.newCellQty } : null));
        loadProductMatrix(selectedProductId);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر فحص المقاس', 'error');
    } finally {
      setCheckerAdjusting(false);
    }
  };

  // 6. Excel Export
  const handleExportExcel = () => {
    if (!selectedProductId) return;
    window.open(`/api/admin/lens-matrix/${selectedProductId}/export-excel?token=${token}`, '_blank');
  };

  // 7. Excel Import
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProductId) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('جاري قراءة واستيراد جدول الأرصدة...', 'info');
      const res = await axios.post(
        `/api/admin/lens-matrix/${selectedProductId}/import-excel`,
        formData,
        authHeader
      );
      showToast(res.data?.message || 'تم استيراد جدول الأرصدة بنجاح');
      loadProductMatrix(selectedProductId);
      loadLensProducts();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل استيراد ملف الإكسيل', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 pb-12 font-sans text-slate-800" dir="rtl">
      {/* 1. Header & Selector Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-md shadow-blue-500/20">
            👁️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                مصفوفة دروج المقاسات ({axisYShort} × {axisXShort})
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                HI-LUXE MATRIX
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              إدارة أرصدة الدرج ثنائية الأبعاد ({axisYLabel} × {axisXLabel}) — تعبئة مباشرة أو جلسة جرد محاسبية
            </p>
          </div>
        </div>

        {/* Lens Product Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">اختر نوع العدسة:</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-blue-600 min-w-[220px]"
            >
              {lensProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.storeStock ?? p.stockCount} حبة)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadProductMatrix(selectedProductId)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Lens Overview Card */}
      {matrixData?.product && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white border border-blue-200/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">{matrixData.product.name}</span>
                {matrixData.product.opticsSpecs?.lensIndex && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-800">
                    معامل: {matrixData.product.opticsSpecs.lensIndex}
                  </span>
                )}
                {matrixData.product.opticsSpecs?.lensBrand && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800">
                    {matrixData.product.opticsSpecs.lensBrand}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                سعر البيع: <strong className="text-slate-900">{matrixData.product.price} {config?.currency || 'ج.م'}</strong> | سعر التكلفة: <strong className="text-slate-900">{matrixData.product.costPrice} {config?.currency || 'ج.م'}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-xs">
              رصيد المصفوفة المحسوب: <strong className="text-blue-700 text-sm font-black font-mono">{liveTotalStock}</strong>
            </div>
            {/* Unallocated Old Stock Slot (Tip from manual) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900" title="رصيد قديم غير موزع على المقاسات يظهر في الجرد">
              <span className="text-[11px]">رصيد غير موزع:</span>
              <input
                type="number"
                min="0"
                value={unallocatedStock}
                onChange={(e) => setUnallocatedStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-14 bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-center outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Interactive Controls & Action Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Power Checker (04 تحقق التوفر) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black text-slate-900">04 تحقق التوفر السريع للمقاس</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">فحص مباشر</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">{axisYLabel}</label>
              <select
                value={checkerSph}
                onChange={(e) => {
                  setCheckerSph(e.target.value);
                  setCheckerResult(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800"
              >
                {allSphValues.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">{axisXLabel}</label>
              <select
                value={checkerCyl}
                onChange={(e) => {
                  setCheckerCyl(e.target.value);
                  setCheckerResult(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800"
              >
                {cylValues.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickCheck('check')}
              disabled={checkerAdjusting}
              className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-colors disabled:opacity-50"
            >
              {checkerAdjusting ? 'جاري الفحص...' : 'فحص المتاح'}
            </button>
            {checkerResult && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickCheck('add', 1)}
                  className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-black"
                  title="توريد حبة واحدة"
                >
                  +1 توريد
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCheck('sub', 1)}
                  disabled={checkerResult.available <= 0}
                  className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-black disabled:opacity-40"
                  title="صرف حبة واحدة"
                >
                  -1 صرف
                </button>
              </div>
            )}
          </div>

          {checkerResult && (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
              checkerResult.available > 0
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-red-50/70 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center gap-1.5">
                {checkerResult.available > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <span>مقاس ({checkerSph} / {checkerCyl})</span>
              </div>
              <span className="font-black font-mono text-sm">
                المتاح: {checkerResult.available} حبة
              </span>
            </div>
          )}
        </div>

        {/* View Options & Mode Switcher */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900">خيارات عرض الدرج ونمط العمل</h3>
            <span className="text-[10px] font-bold text-slate-400">
              {hasSignedDiopterAxis ? 'فلترة الإشارات (+/-)' : `${allSphValues.length} × ${cylValues.length} خانة`}
            </span>
          </div>

          {hasSignedDiopterAxis ? (
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPowerView('minus')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                  powerView === 'minus' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                قصر نظر (Minus -)
              </button>
              <button
                type="button"
                onClick={() => setPowerView('plus')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                  powerView === 'plus' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                طول نظر (Plus +)
              </button>
              <button
                type="button"
                onClick={() => setPowerView('all')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                  powerView === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل (+ و -)
              </button>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 flex items-center justify-between">
              <span>محاور مخصصة للقسم:</span>
              <span className="font-mono text-indigo-700">{axisYLabel} × {axisXLabel}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                mode === 'edit'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="وضع التعبئة المباشرة: لإدخال أرصدة أول المدة أو تعديل خانات الدرج مباشرة بدون تسجيل عجز مالي"
            >
              <Grid className="w-4 h-4" />
              <span>02 إدخال وتعديل الأرصدة</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('stocktake')}
              className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                mode === 'stocktake'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="وضع جلسة الجرد الفعلي: تعدّ الدرج فعلياً ويقوم النظام بمقارنته مع الرصيد الدفتري وحساب العجز أو الزيادة مالياً"
            >
              <ClipboardList className="w-4 h-4" />
              <span>05 جلسة الجرد (Stocktake)</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200/70 leading-relaxed">
            {mode === 'edit' ? (
              <span>💡 <strong>وضع الإدخال المباشر:</strong> يُستخدم لتعبئة رصيد أول المدة أو تعديل الأرصدة يدوياً (لا يُسجّل أي عجز أو تالف مالي).</span>
            ) : (
              <span>⚖️ <strong>وضع جلسة الجرد:</strong> أدخل العدد الفعلي الموجود في الدرج؛ سيقارنه النظام بالرصيد الدفتري ويحسب قيمة العجز/الزيادة مالياً.</span>
            )}
          </div>
        </div>

        {/* 03 استيراد Excel & 06 تصدير وطباعة */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-black text-slate-900">03 استيراد / 06 تصدير وطباعة الجدول</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>استيراد جدول الأرصدة</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportExcel}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>تصدير Excel للشبكة</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة مصفوفة المقاسات (A4)</span>
          </button>
        </div>
      </div>

      {/* Stocktake Control Banner (When in Stocktaking Mode) */}
      {mode === 'stocktake' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-3 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-600" />
              <div>
                <h4 className="text-xs font-black text-amber-900">جلسة جرد نشطة لمصفوفة العدسات</h4>
                <p className="text-[11px] text-amber-800">
                  أدخل الكميات الفعلية المعدودة في الخلايا بالأسفل — البرنامج يحسب الفروق المالية تلقائياً قبل الاعتماد
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-slate-700">
                الدفتري: <strong className="font-mono">{stocktakeSummary.bookTotal}</strong> | المعدود: <strong className="font-mono">{stocktakeSummary.countedTotal}</strong>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                stocktakeSummary.varianceQty === 0
                  ? 'bg-emerald-500 text-white'
                  : stocktakeSummary.varianceQty > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-red-600 text-white'
              }`}>
                {stocktakeSummary.varianceQty > 0 && <TrendingUp className="w-3.5 h-3.5" />}
                {stocktakeSummary.varianceQty < 0 && <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  الفارق: {stocktakeSummary.varianceQty > 0 ? `+${stocktakeSummary.varianceQty} زيادة` : stocktakeSummary.varianceQty < 0 ? `${stocktakeSummary.varianceQty} عجز` : 'مطابق تماماً'}
                  {stocktakeSummary.varianceValue > 0 && ` (${stocktakeSummary.varianceValue} ج.م)`}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <input
              type="text"
              required
              value={stocktakeReason}
              onChange={(e) => setStocktakeReason(e.target.value)}
              placeholder="سبب الفرق (إلزامي في حال وجود عجز/زيادة — يُحفظ مع القيد المالي)"
              className="bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-amber-600 font-bold"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={stocktakeNotes}
                onChange={(e) => setStocktakeNotes(e.target.value)}
                placeholder="ملاحظات إضافية أو اسم الفاحص..."
                className="flex-1 bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none"
              />
              <button
                type="button"
                onClick={handleSubmitStocktake}
                disabled={stocktakeSubmitting}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {stocktakeSubmitting ? 'جاري الاعتماد...' : 'اعتماد وترحيل الجرد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Voice & 1-Click Quick Bulk Fill Bar */}
      {mode === 'edit' && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-purple-50/60 border border-indigo-200/80 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>التعبئة السريعة والأوامر الذكية والصوتية للدرج</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    إدخال بضغطة زر
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  املأ جميع الأدراج بعدد ثابت بلمسة واحدة، أو استخدم الأمر الصوتي/النصي الطبيعي لتوزيع الكميات والاستثناءات فوراً
                </p>
              </div>
            </div>

            {/* Quick 1-Click Uniform Fill Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">ملء سريع:</span>
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleBulkFillUniform(n)}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-600 hover:text-white border border-slate-200 hover:border-indigo-600 text-slate-700 text-xs font-black transition-all shadow-xs active:scale-95"
                  title={`ملء جميع الأدراج بـ ${n} قطع`}
                >
                  {n} حبة للكل
                </button>
              ))}

              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 gap-1 shadow-xs">
                <input
                  type="number"
                  min="0"
                  value={bulkFillQty}
                  onChange={(e) => setBulkFillQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-10 text-center font-mono font-bold text-xs outline-none"
                  title="كمية مخصصة"
                />
                <button
                  type="button"
                  onClick={() => handleBulkFillUniform(bulkFillQty)}
                  className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black transition-colors"
                >
                  تطبيق
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleBulkFillUniform(0)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 text-xs font-bold transition-all shadow-xs"
                title="تصفير خانات المصفوفة"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Voice / Natural Language Command Bar */}
          <div className="pt-2 border-t border-indigo-200/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={voiceCommandText}
                onChange={(e) => setVoiceCommandText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteVoiceCommand()}
                placeholder="أمر ذكي / صوتي: مثال «كل الأدراج فيها 2 ما عدا -2.00 سلندر -0.50 فيه 4، وسفير -1 فيه 3»..."
                className="w-full bg-white border border-indigo-200 rounded-2xl py-2 px-3 pl-10 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 placeholder:text-slate-400 placeholder:font-normal shadow-xs"
              />
              <button
                type="button"
                onClick={handleToggleVoice}
                disabled={isProcessingVoice}
                className={`absolute left-2 top-1.5 p-1.5 rounded-xl transition-all ${
                  isListeningVoice
                    ? 'bg-red-500 text-white animate-pulse shadow-md'
                    : isProcessingVoice
                    ? 'bg-amber-500 text-white animate-spin'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title={
                  isListeningVoice
                    ? 'جاري التسجيل الصوتي (Gemini + المتصفح)... اضغط للإيقاف'
                    : isProcessingVoice
                    ? 'جاري تحليل الصوت عبر Gemini...'
                    : 'اضغط للتحدث بالصوت (Gemini Audio + متصفح الويب)'
                }
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={isExecutingAiCmd}
              onClick={() => handleExecuteVoiceCommand()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isExecutingAiCmd ? 'animate-spin' : ''}`} />
              <span>{isExecutingAiCmd ? 'جاري التحليل والتنفيذ...' : 'تنفيذ الأمر الذكي'}</span>
            </button>
          </div>

          {smartFeedback && (
            <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50/80 border border-emerald-200/60 rounded-xl px-3 py-1.5 flex items-center justify-between animate-in fade-in">
              <span>{smartFeedback}</span>
              <button
                type="button"
                onClick={() => setSmartFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. The 2D Interactive Matrix Grid */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-black text-slate-900">
              شبكة مقاسات: {matrixData?.product?.name}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              (الصفوف: {axisYLabel} | الأعمدة: {axisXLabel})
            </span>

            {/* Live Hovered / Focused Cell Coordinate Indicator */}
            {hoveredCell ? (
              <div className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black font-mono flex items-center gap-2 shadow-sm animate-in fade-in">
                <span>🎯 الخانة الحالية:</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded">
                  {axisYShort}: {hoveredCell.sph}
                </span>
                <span>×</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded">
                  {axisXShort}: {hoveredCell.cyl}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-lg">
                💡 مرر الماوس على أي خلية لإظهار إحداثيات ({axisYShort} × {axisXShort})
              </span>
            )}
          </div>

          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleSaveMatrix}
              disabled={isSaving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ تعديلات المصفوفة'}</span>
            </button>
          )}
        </div>

        <div
          className="overflow-x-auto max-h-[650px] overflow-y-auto"
          onMouseLeave={() => setHoveredCell(null)}
        >
          <table className="w-full text-center text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-black sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="p-2.5 border border-slate-200 bg-slate-200/90 text-slate-800 w-24 shrink-0 font-mono">
                  {axisYShort} \ {axisXShort}
                </th>
                {cylValues.map((cyl) => {
                  const isActiveCol = hoveredCell?.cyl === cyl;
                  return (
                    <th
                      key={cyl}
                      className={`p-2.5 border border-slate-200 font-mono min-w-[76px] transition-colors ${
                        isActiveCol
                          ? 'bg-indigo-600 text-white font-black shadow-inner'
                          : 'text-slate-800'
                      }`}
                    >
                      {cyl}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredSphValues.map((sph) => {
                const isActiveRow = hoveredCell?.sph === sph;
                return (
                  <tr
                    key={sph}
                    className={`transition-colors ${
                      isActiveRow ? 'bg-indigo-50/60' : 'hover:bg-blue-50/30'
                    }`}
                  >
                    {/* Row SPH Header */}
                    <td
                      className={`p-2 font-black border border-slate-200 sticky right-0 z-10 text-xs transition-colors ${
                        isActiveRow
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-900'
                      }`}
                    >
                      {sph}
                    </td>

                    {/* Matrix Cells */}
                    {cylValues.map((cyl) => {
                      const key = `${sph}_${cyl}`;
                      const currentBookQty = gridStock[key] || 0;
                      const isStocktake = mode === 'stocktake';
                      const displayValue = isStocktake
                        ? (stocktakeCounts[key] !== undefined ? stocktakeCounts[key] : currentBookQty)
                        : (gridStock[key] ?? '');

                      const diff = isStocktake ? (Number(stocktakeCounts[key] || 0) - currentBookQty) : 0;
                      const isExactHovered = hoveredCell?.sph === sph && hoveredCell?.cyl === cyl;
                      const isCrosshairLine = hoveredCell?.sph === sph || hoveredCell?.cyl === cyl;

                      return (
                        <td
                          key={key}
                          onMouseEnter={() => setHoveredCell({ sph, cyl })}
                          className={`relative p-1 border transition-colors ${
                            isExactHovered
                              ? 'border-indigo-600 bg-indigo-100/70 z-10 ring-2 ring-indigo-500/40'
                              : isCrosshairLine
                              ? 'border-indigo-200 bg-indigo-50/40'
                              : isStocktake && diff !== 0
                              ? diff > 0
                                ? 'border-slate-200 bg-blue-100/60 font-black'
                                : 'border-slate-200 bg-red-100/60 font-black'
                              : currentBookQty > 0
                              ? 'border-slate-200 bg-emerald-50/40'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          {/* Floating Coordinate Pill on Hover / Focus */}
                          {isExactHovered && (
                            <div
                              dir="ltr"
                              className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-lg bg-slate-900/95 px-2 py-0.5 text-[10px] font-black text-white shadow-lg border border-indigo-400/50"
                            >
                              <span className="text-amber-300">{axisYShort}: {sph}</span>
                              <span className="mx-1 text-slate-400">|</span>
                              <span className="text-cyan-300">{axisXShort}: {cyl}</span>
                            </div>
                          )}

                          <input
                            type="number"
                            min="0"
                            value={displayValue}
                            onFocus={() => setHoveredCell({ sph, cyl })}
                            title={`${axisYShort}: ${sph} | ${axisXShort}: ${cyl}`}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                              if (isStocktake) {
                                setStocktakeCounts((prev) => ({
                                  ...prev,
                                  [key]: val === '' ? 0 : val
                                }));
                              } else {
                                setGridStock((prev) => {
                                  const next = { ...prev };
                                  if (val === '' || val === 0) {
                                    delete next[key];
                                  } else {
                                    next[key] = val;
                                  }
                                  return next;
                                });
                              }
                            }}
                            placeholder="·"
                            className={`w-full py-1 text-center font-bold text-xs outline-none rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-600 ${
                              isStocktake && diff !== 0
                                ? diff > 0 ? 'text-blue-700' : 'text-red-700'
                                : currentBookQty > 2
                                ? 'text-emerald-700 font-black'
                                : currentBookQty > 0
                                ? 'text-amber-700 font-bold'
                                : 'text-slate-300 placeholder:text-slate-300'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 px-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>رصيد متوفر (3+)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span>رصيد منخفض (1-2)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
              <span>منتهي (0)</span>
            </span>
          </div>

          <div className="font-bold text-slate-700">
            إجمالي رصيد المحل الحالي: <strong className="text-blue-700 font-black">{liveTotalStock}</strong> حبة
          </div>
        </div>
      </div>
    </div>
  );
}
