import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  Copy,
  Check,
  Layers,
  Crop,
  Sliders,
  CloudUpload,
  Loader2,
  ExternalLink,
  Plus,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

/**
 * Standalone AI Image Studio Component
 * Integrated under the standard image upload section in UnifiedProductForm.
 * Provides 3 distinct workflows:
 *   1. Enhance current image & studio background
 *   2. Generate multi-angle marketing views & aspect ratios
 *   3. Extract/isolate a specific product from a multi-item/collection image
 */
export default function ProductAiImageStudio({
  productContext = {},
  uploadedImages = [],
  onApplyImage,
  onAddImages
}) {
  const { token, config, showToast } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  // 1. Workflow Mode: 'enhance_only' | 'enhance_and_angles' | 'extract_item_from_collection'
  const [mode, setMode] = useState('enhance_only');
  const [anglesCount, setAnglesCount] = useState(2);
  const [customNotes, setCustomNotes] = useState('');
  const [selectedReferenceImage, setSelectedReferenceImage] = useState('');

  // 2. Generated Prompt & Copy state
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // 3. Execution & Results state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState([]); // array of { id, url, isCloudUploaded, uploading }

  // 4. External AI Paste/Import state
  const [externalInput, setExternalInput] = useState('');
  const [isImportingExternal, setIsImportingExternal] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const isServerAiReady = Boolean(config?.isImageAiAvailable);

  // Default to first uploaded image as reference if available
  useEffect(() => {
    if (!selectedReferenceImage && uploadedImages.length > 0) {
      setSelectedReferenceImage(uploadedImages[0]);
    }
  }, [uploadedImages, selectedReferenceImage]);

  // Dynamically build the prompt whenever context, mode, or notes change
  useEffect(() => {
    const prodName = productContext?.name || productContext?.productName || 'المنتج التجاري';
    const catName = productContext?.categoryName || '';
    const specsMap = productContext?.specs || {};

    const specsText = Object.entries(specsMap)
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    let objectiveText = '';
    if (mode === 'enhance_only') {
      objectiveText =
        'Enhanced professional commercial e-commerce studio product photography. Clean 4k studio lighting, high resolution, sharp details, pure neutral studio background with subtle soft ground shadow.';
    } else if (mode === 'enhance_and_angles') {
      objectiveText =
        `Generate ${anglesCount} diverse commercial e-commerce perspectives: front hero angle, 45-degree isometric side view showing depth and ports, macro close-up of premium textures, and lifestyle clean showcase. Pure commercial studio lighting, 8k crisp details.`;
    } else if (mode === 'extract_item_from_collection') {
      objectiveText =
        `From this multi-item collection / catalog photo, isolate and extract ONLY the single specific product: "${prodName}". Crop out all surrounding gadgets or items, center this exact item, and render it alone in professional commercial e-commerce studio lighting with a clean neutral background.`;
    }

    const full = [
      `Commercial e-commerce product photograph of: "${prodName}"${catName ? ` (${catName})` : ''}.`,
      specsText ? `Product Specifications: ${specsText}.` : '',
      `Objective: ${objectiveText}`,
      customNotes.trim() ? `Custom Instructions / Notes: ${customNotes.trim()}.` : '',
      'Photorealistic, 8k resolution, perfectly centered, pure commercial e-commerce presentation, zero watermark text.'
    ]
      .filter(Boolean)
      .join('\n');

    setGeneratedPrompt(full);
  }, [productContext, mode, anglesCount, customNotes]);

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopiedPrompt(true);
    if (showToast) showToast('تم نسخ الـ Prompt بنجاح! يمكنك لصقه في ChatGPT أو Midjourney');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  // Direct In-App Generation (via Server AI)
  const handleRunInAppAi = async () => {
    if (!isServerAiReady) {
      if (showToast) showToast('خدمة الذكاء الاصطناعي للصور غير مفعلة في السيرفر. استخدم خيار النسخ إلى AI خارجي.', 'error');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const res = await axios.post(
        '/api/admin/products/ai-image',
        {
          imageUrl: selectedReferenceImage || uploadedImages[0] || '',
          productName: productContext?.name || productContext?.productName || 'منتج تجاري',
          categoryName: productContext?.categoryName || '',
          specs: productContext?.specs || {},
          mode,
          anglesCount: Number(anglesCount) || 2,
          notes: customNotes
        },
        authHeader
      );

      const generatedUrls = res.data?.images || [];
      if (generatedUrls.length > 0) {
        const newItems = generatedUrls.map((url, i) => ({
          id: `ai_${Date.now()}_${i}`,
          url,
          isCloudUploaded: true,
          uploading: false
        }));
        setResults((prev) => [...newItems, ...prev]);
        if (showToast) showToast(res.data?.message || 'تمت معالجة وتوليد الصور بنجاح! ✨');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'فشلت معالجة الصورة بالذكاء الاصطناعي';
      setErrorMsg(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Import external AI result (URLs or Base64)
  const handleImportExternal = () => {
    if (!externalInput.trim()) return;
    const lines = externalInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newItems = lines.map((item, i) => ({
      id: `ext_${Date.now()}_${i}`,
      url: item,
      isCloudUploaded: item.startsWith('http') && !item.includes('base64'),
      uploading: false
    }));

    setResults((prev) => [...newItems, ...prev]);
    setExternalInput('');
    if (showToast) showToast(`تم استيراد ${newItems.length} صورة بنجاح`);
  };

  // Upload an individual base64 / external image to Store Cloud
  const handleUploadSingleToCloud = async (resultItem) => {
    setResults((prev) =>
      prev.map((r) => (r.id === resultItem.id ? { ...r, uploading: true } : r))
    );

    try {
      const res = await axios.post(
        '/api/admin/products/ai-image-upload',
        {
          image: resultItem.url,
          filename: `ai-${mode}-${Date.now()}.png`
        },
        authHeader
      );

      const uploadedUrl = res.data?.url;
      if (uploadedUrl) {
        setResults((prev) =>
          prev.map((r) =>
            r.id === resultItem.id
              ? { ...r, url: uploadedUrl, isCloudUploaded: true, uploading: false }
              : r
          )
        );
        if (showToast) showToast('تم رفع الصورة إلى سحابة المتجر بنجاح! ☁️');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'فشل رفع الصورة إلى السحابة';
      if (showToast) showToast(msg, 'error');
      setResults((prev) =>
        prev.map((r) => (r.id === resultItem.id ? { ...r, uploading: false } : r))
      );
    }
  };

  // Add image to parent product form
  const handleAddToProduct = (url) => {
    if (onApplyImage) {
      onApplyImage(url);
      if (showToast) showToast('تمت إضافة الصورة إلى قائمة صور المنتج ✅');
    }
  };

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 overflow-hidden transition-all text-xs font-bold">
      {/* Header Banner Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-right hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-orange-300" />
          </div>
          <div>
            <h4 className="text-xs font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
              <span>استوديو معالجة وتوليد صور المنتجات بالذكاء الاصطناعي (AI Image Studio)</span>
            </h4>
            <p className="text-[11px] text-ink-soft mt-0.5">
              تحسين جودة الصور، توليد زوايا متعددة، أو عزل المنتج من صورة جماعية — مع توليد Prompt مخصص ومباشر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-purple-600">
          <span className="text-[10px] bg-purple-500/15 px-2 py-0.5 rounded-full">
            {isOpen ? 'إغلاق الاستوديو' : 'فتح الاستوديو'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expandable Studio Body */}
      {isOpen && (
        <div className="p-4 pt-2 border-t border-purple-500/20 space-y-4 animate-in fade-in">
          {/* Workflow Mode Tabs */}
          <div>
            <label className="block text-[11px] font-black text-ink mb-1.5">
              1. اختر نوع المعالجة المطلوب بالذكاء الاصطناعي:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option A: Enhance */}
              <button
                type="button"
                onClick={() => setMode('enhance_only')}
                className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1 ${
                  mode === 'enhance_only'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-surface text-ink border-line hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs">✨ تحسين الصورة الحالية</span>
                  <Wand2 className="w-4 h-4" />
                </div>
                <span className={`text-[10px] ${mode === 'enhance_only' ? 'text-purple-100' : 'text-ink-soft'}`}>
                  إزالة التشويش، تحسين الإضاءة وتفريغ الخلفية لوضع المنتج في بيئة استوديو احترافية
                </span>
              </button>

              {/* Option B: Multi Angles & Ratios */}
              <button
                type="button"
                onClick={() => setMode('enhance_and_angles')}
                className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1 ${
                  mode === 'enhance_and_angles'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-surface text-ink border-line hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs">📐 توليد زوايا وأبعاد متعددة</span>
                  <Layers className="w-4 h-4" />
                </div>
                <span className={`text-[10px] ${mode === 'enhance_and_angles' ? 'text-purple-100' : 'text-ink-soft'}`}>
                  إنشاء لقطات جانبية وزاوية 45° ولقطات مقربة (Macro) بمقاسات 1:1 و 4:5 لوسائل التواصل
                </span>
              </button>

              {/* Option C: Extract from Collection */}
              <button
                type="button"
                onClick={() => setMode('extract_item_from_collection')}
                className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1 ${
                  mode === 'extract_item_from_collection'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-surface text-ink border-line hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs">🎯 عزل منتج من صورة مجمعة</span>
                  <Crop className="w-4 h-4" />
                </div>
                <span className={`text-[10px] ${mode === 'extract_item_from_collection' ? 'text-purple-100' : 'text-ink-soft'}`}>
                  رفع صورة كتالوج أو رف تحتوي عدة أجهزة، وعزل جهاز هذا المنتج فقط بناءً على مواصفاته
                </span>
              </button>
            </div>
          </div>

          {/* Configuration Settings per Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-surface border border-line">
            {/* Reference Image Selector if multiple images uploaded */}
            <div>
              <label className="block text-[11px] text-ink-soft mb-1">
                الصورة المرجعية للمعالجة:
              </label>
              {uploadedImages.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {uploadedImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedReferenceImage(img)}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        selectedReferenceImage === img
                          ? 'border-purple-600 ring-2 ring-purple-500/40'
                          : 'border-line opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      {selectedReferenceImage === img && (
                        <span className="absolute inset-0 bg-purple-600/30 flex items-center justify-center text-white text-[10px]">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-orange-600">
                  ⚠️ لم تقم برفع صور بعد في الأعلى؛ يمكنك الاعتماد على مواصفات المنتج والـ Prompt، أو ارفع صورة في الأعلى لاستخدامها كمرجع.
                </p>
              )}
            </div>

            {/* Extra Options based on Mode */}
            {mode === 'enhance_and_angles' && (
              <div>
                <label className="block text-[11px] text-ink-soft mb-1">
                  عدد الزوايا الإضافية المراد توليدها:
                </label>
                <select
                  value={anglesCount}
                  onChange={(e) => setAnglesCount(Number(e.target.value))}
                  className="w-full bg-paper border border-line rounded-btn p-2 text-xs font-bold text-ink"
                >
                  <option value={2}>زاويتان (أمامية + زاوية 45° ثلاثية الأبعاد)</option>
                  <option value={3}>3 زوايا (أمامية + جانبية + لقطة مقربة للتفاصيل)</option>
                  <option value={4}>4 زوايا كاملة (شاملة الخلفية والمقاس التسويقي)</option>
                </select>
              </div>
            )}

            {mode === 'extract_item_from_collection' && (
              <div className="col-span-full">
                <span className="text-[11px] text-purple-700 dark:text-purple-300 font-bold">
                  سيتم عزل المنتج الحالي «{productContext?.name || 'المنتج'}» بناءً على لونه ومواصفاته الفنية المدخلة تلقائياً.
                </span>
              </div>
            )}
          </div>

          {/* Custom Notes / Prompt Additions */}
          <div>
            <label className="block text-[11px] text-ink-soft mb-1">
              ملاحظات أو تعديلات مخصصة للـ Prompt (اختياري):
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="مثال: اجعل الخلفية رخام رمادي فاتح، مع إضاءة دافئة بدون انعكاسات قوية..."
              className="w-full bg-surface border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-purple-500"
            />
          </div>

          {/* Generated Ready Prompt Studio (The core user requirement) */}
          <div className="p-3.5 rounded-xl bg-slate-950 text-slate-100 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-purple-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-orange-400" />
                <span>الـ Prompt الذكي الجاهز (يحتوي مواصفات القسم وتفاصيل المنتج كاملة):</span>
              </span>

              <button
                type="button"
                onClick={handleCopyPrompt}
                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black flex items-center gap-1 transition-all shadow-xs"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPrompt ? 'تم النسخ!' : 'نسخ الـ Prompt'}</span>
              </button>
            </div>

            <textarea
              readOnly
              rows={4}
              value={generatedPrompt}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-200 outline-none resize-none"
              dir="ltr"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-400">
              <span>💡 يمكنك نسخ هذا البرومبت واستخدامه مباشرة في ChatGPT Plus، Midjourney، Ideogram، أو Flux.</span>
            </div>
          </div>

          {/* Action Execution Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-500/20">
            {/* Direct In-App Generation Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRunInAppAi}
                className="px-4 py-2.5 rounded-btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-orange-300" />
                    <span>جاري المعالجة بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-orange-300" />
                    <span>تنفيذ مباشر عبر السيرفر</span>
                  </>
                )}
              </button>

              {!isServerAiReady && (
                <span className="text-[10px] text-ink-soft">
                  (مفتاح توليد الصور غير مفعل بالسيرفر؛ استخدم النسخ إلى AI خارجي)
                </span>
              )}
            </div>

            {/* External Paste / Import Trigger */}
            <div className="text-[10px] text-ink-soft">
              أو الصق النتيجة من الذكاء الاصطناعي الخارجي بالأسفل
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* External Import Section (Paste URLs or Base64) */}
          <div className="p-3 rounded-xl bg-surface border border-line space-y-2">
            <label className="block text-[11px] font-black text-ink">
              استيراد صور ناتجة من شات خارجي (روابط URLs أو Base64):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={externalInput}
                onChange={(e) => setExternalInput(e.target.value)}
                placeholder="الصق رابط الصورة أو كود data:image/png;base64,... هنا"
                className="flex-1 bg-paper border border-line rounded-btn p-2 text-xs text-ink outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={handleImportExternal}
                className="px-4 py-2 rounded-btn bg-paper hover:bg-surface border border-line text-ink text-xs font-bold transition-colors"
              >
                استيراد
              </button>
            </div>
          </div>

          {/* Results Gallery with "رفع إلى السحابة" and "إضافة للمنتج" Buttons */}
          {results.length > 0 && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" />
                  <span>الصور المستخرجة / المولدة ({results.length}):</span>
                </span>
                <span className="text-[10px] text-ink-soft">
                  اضغط «إضافة للمنتج» لربطها بالمنتج الحالي، أو ارفعها على الكلاود
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-surface border border-line space-y-2 flex flex-col justify-between"
                  >
                    <div className="relative rounded-lg overflow-hidden bg-black/10 aspect-square">
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                      {item.isCloudUploaded && (
                        <span className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black shadow-xs">
                          كلاود ☁️
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {/* Upload to Cloud button if not already uploaded */}
                      {!item.isCloudUploaded && (
                        <button
                          type="button"
                          disabled={item.uploading}
                          onClick={() => handleUploadSingleToCloud(item)}
                          className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                        >
                          {item.uploading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>جاري الرفع...</span>
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-3 h-3" />
                              <span>رفع إلى السحابة (Cloud)</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Add to product images */}
                      <button
                        type="button"
                        onClick={() => handleAddToProduct(item.url)}
                        className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>إضافة لصور المنتج</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
