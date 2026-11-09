import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FileUp,
  Mic,
  Sparkles,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Volume2,
  Radio,
  StopCircle,
  Package,
  Trash2,
  PlusCircle,
  Layers,
  Copy,
  ArrowRight,
  ArrowLeft,
  Upload,
  Sliders,
  FileCode,
  CheckCircle2
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';
import { playSound } from '../../../shared/lib/audioEffects';
import UnifiedProductForm from './UnifiedProductForm';

/**
 * Enhanced AI Product Intake Modal
 * Supports:
 *   1. Uploading any document (Image, PDF, Word docx, Text/CSV)
 *   2. Voice recording (Gemini / Web Speech API)
 *   3. Ready-to-copy rich prompt for external AI (ChatGPT, Claude, Gemini) + JSON importer
 *   4. Multi-Product Slider / Stack where each slide renders UnifiedProductForm!
 */
export default function AiProductIntakeModal({
  isOpen,
  onClose,
  categories = [],
  shippingClasses = [],
  supplierShipments = [],
  availableGroups = [],
  onSaved
}) {
  const { token, config, showToast } = useStore();

  // 1. Category Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categorySpecsFacet, setCategorySpecsFacet] = useState([]);

  // 2. Intake Method Tab: 'document' | 'voice' | 'prompt_studio'
  const [intakeTab, setIntakeTab] = useState('document');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Voice & Text Input State
  const [voiceMode, setVoiceMode] = useState('record'); // 'record' (Gemini/Server Audio) | 'speech' (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');

  // External Prompt Studio State
  const [categoryPromptData, setCategoryPromptData] = useState(null);
  const [isFetchingPrompt, setIsFetchingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

  // Execution & Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 3. Extracted Products Review (Slider / Stack State)
  const [extractedProducts, setExtractedProducts] = useState([]);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Set default category
  useEffect(() => {
    if (isOpen && !selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0]._id);
    }
  }, [isOpen, categories, selectedCategoryId]);

  // Fetch category specs facet and prompt whenever category changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setCategorySpecsFacet([]);
      setCategoryPromptData(null);
      return;
    }

    axios
      .post('/api/store-public/filter', { categoryId: selectedCategoryId, page: 1, pageSize: 1 })
      .then((res) => {
        setCategorySpecsFacet(res.data?.specsFacet || []);
      })
      .catch(console.error);

    // Fetch ready prompt for this category
    setIsFetchingPrompt(true);
    axios
      .get(`/api/admin/products/ai-category-prompt/${selectedCategoryId}`, authHeader)
      .then((res) => {
        if (res.data?.done) {
          setCategoryPromptData(res.data);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch category prompt:', err.message);
      })
      .finally(() => setIsFetchingPrompt(false));
  }, [selectedCategoryId]);

  // Web Speech API initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ar-EG';

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopAllVoiceActivities();
    };
  }, []);

  const stopAllVoiceActivities = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && isRecordingAudio) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    clearInterval(timerRef.current);
    setIsListening(false);
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setVoiceMode('record');
      setErrorMsg('المتصفح لا يدعم التعرف المباشر. تم التحويل لوضع تسجيل الميكروفون الذكي.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setErrorMsg('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech start error:', err);
      }
    }
  };

  const startAudioRecording = async () => {
    if (!selectedCategoryId) {
      setErrorMsg('يرجى اختيار القسم أولاً قبل تسجيل الصوت');
      return;
    }

    setErrorMsg('');
    try {
      playSound('start_record');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        clearInterval(timerRef.current);
        setIsRecordingAudio(false);
        setRecordingSeconds(0);
        stream.getTracks().forEach((t) => t.stop());
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 500) {
          await uploadAndProcessVoiceAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      // Start browser SpeechRecognition in parallel as an automatic fallback
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      playSound('error');
      setErrorMsg('تعذر الوصول إلى الميكروفون. تأكد من السماح بصلاحية الميكروفون في المتصفح.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      playSound('stop_record');
      mediaRecorderRef.current.stop();
    }
  };

  const applyExtractionResponse = (data) => {
    const items = (data.products || []).map((p, idx) => ({
      tempId: p.tempId || `prod_${Date.now()}_${idx}`,
      categoryId: p.categoryId || selectedCategoryId,
      name: p.name || '',
      price: p.price || 0,
      oldPrice: p.oldPrice || 0,
      costPrice: p.costPrice || 0,
      stockCount: p.stockCount !== undefined ? p.stockCount : 10,
      description: p.description || '',
      tagsStr: Array.isArray(p.tags) ? p.tags.join(', ') : '',
      images: Array.isArray(p.images) ? p.images : [],
      specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
      active: true,
      warrantyPeriodMonths: Number(p.warrantyPeriodMonths || 0),
      warrantyPolicy: p.warrantyPolicy || ''
    }));

    if (items.length > 0) {
      setExtractedProducts(items);
      setActiveProductIndex(0);
      playSound('ready');
      if (showToast) showToast(`تم استخراج ${items.length} منتج بنجاح! راجع كل منتج في السلايدر أدناه.`);
    } else {
      setErrorMsg('لم يتم العثور على أي منتجات في الملف أو النص المدخل');
      playSound('error');
    }
  };

  // Upload Voice Audio (Primary: Gemini Multimodal Audio -> Fallback: Browser SpeechRecognition Transcript)
  const uploadAndProcessVoiceAudio = async (audioBlob) => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('categoryId', selectedCategoryId);

      const res = await axios.post('/api/admin/products/ai-voice', formData, {
        headers: {
          ...authHeader.headers
        }
      });

      if (res.data?.done) {
        applyExtractionResponse(res.data);
        return;
      }
    } catch (err) {
      console.warn('Primary Gemini audio extraction failed, attempting fallback:', err.response?.data?.error || err.message);
    }

    // Fallback: Use parallel Browser SpeechRecognition transcript if captured
    if (transcript && transcript.trim()) {
      try {
        if (showToast) showToast('تم التحويل التلقائي للتعرف الصوتي البديل للمتصفح...', 'info');
        const fallbackRes = await axios.post(
          '/api/admin/products/ai-extract',
          {
            categoryId: selectedCategoryId,
            text: transcript.trim()
          },
          authHeader
        );
        if (fallbackRes.data?.done) {
          applyExtractionResponse(fallbackRes.data);
          setIsProcessing(false);
          return;
        }
      } catch (fallbackErr) {
        console.warn('Fallback text extraction failed:', fallbackErr.message);
      }
    }

    playSound('error');
    setErrorMsg('تعذر استخراج المنتجات من الصوت عبر Gemini أو متصفح الويب. جرب التحدث بوضوح أو كتابة النص.');
    setIsProcessing(false);
  };

  // Process Document File (PDF, Word docx, Image, Text)
  const handleProcessDocument = async () => {
    if (!selectedFile) {
      setErrorMsg('يرجى اختيار ملف مستند أو صورة أولاً');
      return;
    }
    if (!selectedCategoryId) {
      setErrorMsg('يرجى اختيار القسم أولاً');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('categoryId', selectedCategoryId);

      const res = await axios.post('/api/admin/products/ai-document', formData, {
        headers: {
          ...authHeader.headers
        }
      });

      if (res.data?.done) {
        applyExtractionResponse(res.data);
      } else {
        playSound('error');
        setErrorMsg(res.data?.error || 'تعذر استخراج المنتجات من هذا الملف');
      }
    } catch (err) {
      playSound('error');
      setErrorMsg(err.response?.data?.error || err.message || 'فشلت معالجة الملف بالذكاء الاصطناعي');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process Typed Text
  const handleAnalyzeText = async () => {
    if (!transcript.trim()) {
      setErrorMsg('يرجى كتابة أو نطق تفاصيل المنتج أولاً');
      return;
    }
    if (!selectedCategoryId) {
      setErrorMsg('يرجى اختيار القسم أولاً');
      return;
    }

    stopAllVoiceActivities();
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const res = await axios.post(
        '/api/admin/products/ai-extract',
        {
          categoryId: selectedCategoryId,
          text: transcript.trim()
        },
        authHeader
      );

      if (res.data?.done) {
        applyExtractionResponse(res.data);
      } else {
        setErrorMsg(res.data?.error || 'تعذر استخراج بيانات المنتجات');
      }
    } catch (err) {
      playSound('error');
      setErrorMsg(err.response?.data?.error || err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsProcessing(false);
    }
  };

  // Import JSON from External AI (ChatGPT / Claude / Gemini)
  const handleImportJson = async () => {
    if (!pastedJson.trim()) {
      setErrorMsg('يرجى لصق كود الـ JSON الناتج من الشات الخارجي أولاً');
      return;
    }
    if (!selectedCategoryId) {
      setErrorMsg('يرجى اختيار القسم أولاً');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const res = await axios.post(
        '/api/admin/products/ai-document',
        {
          categoryId: selectedCategoryId,
          jsonText: pastedJson.trim()
        },
        authHeader
      );

      if (res.data?.done) {
        applyExtractionResponse(res.data);
      } else {
        setErrorMsg(res.data?.error || 'فشل استيراد وتحليل كود الـ JSON');
      }
    } catch (err) {
      playSound('error');
      setErrorMsg(err.response?.data?.error || err.message || 'كود الـ JSON غير صالح');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!categoryPromptData?.prompt) return;
    navigator.clipboard.writeText(categoryPromptData.prompt);
    setCopiedPrompt(true);
    if (showToast) showToast('تم نسخ الـ Prompt المخصص! ارفعه الآن إلى ChatGPT مع ملفك');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  // Save single product from the active slide
  const handleSaveSingleProduct = async (formData) => {
    setIsSaving(true);
    try {
      await axios.post('/api/admin/products', formData, authHeader);
      playSound('success');
      if (showToast) showToast(`تم حفظ المنتج «${formData.name}» بنجاح!`);

      // Remove saved product from the extracted list
      const remaining = extractedProducts.filter((_, idx) => idx !== activeProductIndex);
      setExtractedProducts(remaining);
      if (activeProductIndex >= remaining.length && remaining.length > 0) {
        setActiveProductIndex(remaining.length - 1);
      }

      if (remaining.length === 0 && onSaved) {
        onSaved();
        onClose();
      }
    } catch (err) {
      playSound('error');
      if (showToast) showToast(err.response?.data?.error || 'تعذر حفظ المنتج', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Save all remaining extracted products at once
  const handleSaveAllProducts = async () => {
    if (extractedProducts.length === 0) return;
    setIsSaving(true);

    try {
      const itemsToSave = extractedProducts.map((p) => ({
        name: p.name,
        categoryId: p.categoryId || selectedCategoryId,
        groupCode: p.groupCode || '',
        price: Number(p.price || 0),
        oldPrice: Number(p.oldPrice || 0),
        costPrice: Number(p.costPrice || 0),
        stockCount: Number(p.stockCount || 10),
        description: p.description || '',
        images: Array.isArray(p.images) ? p.images : [],
        tags: typeof p.tagsStr === 'string'
          ? p.tagsStr.split(/[,،;\n]+/).map((t) => t.trim()).filter(Boolean)
          : Array.isArray(p.tags)
          ? p.tags
          : [],
        specs: p.specs || {},
        active: true,
        warrantyPeriodMonths: Number(p.warrantyPeriodMonths || 0),
        warrantyPolicy: p.warrantyPolicy || ''
      }));

      const res = await axios.post('/api/admin/products/bulk', { products: itemsToSave }, authHeader);
      playSound('success');
      if (showToast) showToast(res.data?.message || `تم حفظ جميع المنتجات (${itemsToSave.length}) بنجاح!`);

      setExtractedProducts([]);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      playSound('error');
      if (showToast) showToast(err.response?.data?.error || 'تعذر حفظ المنتجات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedCategoryObj = categories.find((c) => c._id === selectedCategoryId);
  const currentProduct = extractedProducts[activeProductIndex];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-full sm:max-w-4xl bg-surface text-ink rounded-t-3xl sm:rounded-card shadow-2xl p-4 sm:p-6 space-y-5 my-0 sm:my-auto max-h-[94vh] sm:max-h-[92vh] overflow-y-auto border border-line animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-orange-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink">
                استوديو إدخال المنتجات الذكي بالـ AI (ملفات، صوت، وبرومبت مخصص)
              </h3>
              <p className="text-xs text-ink-soft">
                استخرج المنتجات ومواصفاتها الفنية تلقائياً من ملفات PDF، صور، مستندات Word، أو عبر الصوت وشات ChatGPT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-ink-soft hover:text-ink hover:bg-paper rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Select Category */}
        <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-black text-primary flex items-center gap-1.5">
              <span>1. اختر القسم المستهدف لتطبيق مواصفاته الفنية (Category Specs):</span>
            </span>

            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="min-w-[200px] bg-surface border border-primary/40 focus:border-primary rounded-xl px-3 py-1.5 text-xs font-black text-ink outline-none"
            >
              <option value="">-- اختر القسم --</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCategoryObj?.specs && Object.keys(selectedCategoryObj.specs).length > 0 && (
            <div className="pt-2 border-t border-primary/15 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-bold text-ink-soft">المواصفات المطلوبة للقسم:</span>
              {Object.entries(selectedCategoryObj.specs).map(([key, label]) => (
                <span
                  key={key}
                  className="px-2 py-0.5 rounded-lg bg-surface border border-line text-ink font-bold"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* STEP 2: Input Method Tabs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-line pb-1 text-xs font-black">
            {/* Tab 1: Document Upload */}
            <button
              type="button"
              onClick={() => setIntakeTab('document')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                intakeTab === 'document'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-soft hover:text-ink hover:bg-paper'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>رفع ملف (PDF، Word، صورة، نص)</span>
            </button>

            {/* Tab 2: Voice Audio */}
            <button
              type="button"
              onClick={() => setIntakeTab('voice')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                intakeTab === 'voice'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-soft hover:text-ink hover:bg-paper'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>تسجيل صوتي أو كتابة</span>
            </button>

            {/* Tab 3: External AI Prompt Studio */}
            <button
              type="button"
              onClick={() => setIntakeTab('prompt_studio')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                intakeTab === 'prompt_studio'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-purple-600 hover:bg-purple-500/10'
              }`}
            >
              <Sliders className="w-4 h-4 text-orange-300" />
              <span>النسخ لـ AI خارجي (ChatGPT)</span>
            </button>
          </div>

          {/* TAB CONTENT 1: Document Upload */}
          {intakeTab === 'document' && (
            <div className="p-4 rounded-2xl bg-paper/60 border border-line space-y-3.5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files?.[0]) {
                    setSelectedFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  isDragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-line hover:border-primary/60 bg-surface'
                }`}
              >
                <div className="space-y-2 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-ink">
                      {selectedFile ? selectedFile.name : 'اسحب وأفلت الملف هنا، أو انقر للاختيار'}
                    </h4>
                    <p className="text-[11px] text-ink-soft mt-1">
                      يدعم ملفات PDF، مستندات Word (.docx)، الصور (PNG, JPG, WebP)، أو ملفات النصوص (TXT, CSV)
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf, .docx, .doc, .png, .jpg, .jpeg, .webp, .txt, .csv, .md"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-paper hover:bg-surface border border-line text-xs font-black text-ink shadow-2xs"
                  >
                    {selectedFile ? 'تغيير الملف المختار' : 'اختيار ملف من جهازك'}
                  </button>
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold text-ink truncate max-w-sm">
                    الملف الجاهز للتحليل: <strong>{selectedFile.name}</strong> (
                    {Math.round(selectedFile.size / 1024)} KB)
                  </span>

                  <button
                    type="button"
                    disabled={isProcessing || !selectedCategoryId}
                    onClick={handleProcessDocument}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-orange-300" />
                        <span>جارٍ استخراج المنتجات والمواصفات...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-orange-300" />
                        <span>استخراج المنتجات من الملف بالـ AI</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 2: Voice & Text Intake */}
          {intakeTab === 'voice' && (
            <div className="p-4 rounded-2xl bg-paper/60 border border-line space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-ink">
                  تسجيل صوتي أو كتابة تفاصيل المنتجات:
                </span>
                <div className="flex bg-surface p-1 rounded-xl border border-line text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setVoiceMode('record')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      voiceMode === 'record' ? 'bg-primary text-white' : 'text-ink-soft'
                    }`}
                  >
                    ميكروفون ذكي (Gemini)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceMode('speech')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      voiceMode === 'speech' ? 'bg-primary text-white' : 'text-ink-soft'
                    }`}
                  >
                    تعرف المتصفح المباشر
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Mic Action */}
                <div className="flex flex-col items-center justify-center p-4 bg-surface rounded-2xl border border-dashed border-line text-center">
                  {voiceMode === 'record' ? (
                    <button
                      type="button"
                      onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                      disabled={isProcessing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all ${
                        isRecordingAudio
                          ? 'bg-red-500 animate-pulse'
                          : 'bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700'
                      }`}
                    >
                      {isRecordingAudio ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={isProcessing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all ${
                        isListening ? 'bg-red-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                  )}

                  <p className="font-black text-ink mt-2 text-xs">
                    {isRecordingAudio
                      ? `جارٍ التسجيل (${recordingSeconds} ث)... انقر للإيقاف`
                      : isListening
                      ? 'جارٍ الاستماع... تحدث الآن'
                      : 'اضغط للتحدث بالصوت'}
                  </p>
                </div>

                {/* Textarea */}
                <div className="md:col-span-2 space-y-2">
                  <textarea
                    rows={3}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="أو اكتب تفاصيل المنتجات والأسعار هنا مباشرة..."
                    className="w-full p-2.5 rounded-xl bg-surface border border-line text-xs font-bold text-ink outline-none focus:border-primary resize-none"
                  />
                  <button
                    type="button"
                    disabled={isProcessing || !transcript.trim() || !selectedCategoryId}
                    onClick={handleAnalyzeText}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-orange-300" />
                        <span>جارٍ التحليل واستخراج المنتجات...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-orange-300" />
                        <span>تحليل النص واستخراج المنتجات بالـ AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 3: External AI Prompt Studio (ChatGPT / Claude copy-paste) */}
          {intakeTab === 'prompt_studio' && (
            <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/25 space-y-3.5">
              <div className="p-3.5 rounded-xl bg-slate-950 text-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-purple-300 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-orange-400" />
                    <span>Prompt جاهز للنسخ إلى ChatGPT / Claude (مخصص لقسم «{selectedCategoryObj?.name}»):</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPrompt ? 'تم النسخ!' : 'نسخ الـ Prompt'}</span>
                  </button>
                </div>

                <textarea
                  readOnly
                  rows={4}
                  value={categoryPromptData?.prompt || 'جارٍ توليد الـ Prompt...'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-200 outline-none resize-none"
                  dir="ltr"
                />

                <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800">
                  <p className="font-black text-orange-400">تعليمات الاستخدام السريع:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-300">
                    <li>اضغط «نسخ الـ Prompt» أعلاه.</li>
                    <li>افتح ChatGPT أو Claude أو Gemini، وارفق ملفك (PDF، Word، صورة، إلخ) والصق الـ Prompt.</li>
                    <li>انسخ كود الـ JSON الناتج من الشات، والصقه في المربع أدناه واضغط «استيراد».</li>
                  </ol>
                </div>
              </div>

              {/* Paste JSON Textarea */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-ink">
                  الصق كود الـ JSON الناتج من الذكاء الاصطناعي الخارجي هنا:
                </label>
                <textarea
                  rows={4}
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder={`{\n  "products": [\n    {\n      "name": "اسم المنتج",\n      "price": 100\n    }\n  ]\n}`}
                  className="w-full p-2.5 rounded-xl bg-surface border border-line font-mono text-xs text-ink outline-none focus:border-purple-500"
                  dir="ltr"
                />

                <button
                  type="button"
                  disabled={isProcessing || !pastedJson.trim()}
                  onClick={handleImportJson}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-orange-300" />
                      <span>جارٍ قراءة وهيكلة المنتجات...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>تحليل واستيراد المنتجات من الـ JSON مباشرة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 3: Multi-Product Slider / Stack (renders UnifiedProductForm for each extracted product) */}
        {extractedProducts.length > 0 && currentProduct && (
          <div className="pt-4 border-t-2 border-line space-y-4 animate-in fade-in">
            {/* Top Bar for Extracted Slider */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                  3
                </span>
                <div>
                  <h4 className="font-black text-sm text-emerald-700 dark:text-emerald-300">
                    المنتجات المستخرجة جاهزة للمراجعة ({extractedProducts.length} منتج)
                  </h4>
                  <p className="text-[11px] text-ink-soft">
                    يمكنك تعديل أي تفاصيل، إضافة صور عبر استوديو الصور بالـ AI، ثم حفظ كل منتج أو حفظ الكل دفعة واحدة
                  </p>
                </div>
              </div>

              {/* Bulk Save Button */}
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAllProducts}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'جارٍ الحفظ...' : `حفظ جميع المنتجات دفعة واحدة (${extractedProducts.length})`}</span>
              </button>
            </div>

            {/* Slider Tabs Pill Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {extractedProducts.map((p, idx) => (
                <button
                  key={p.tempId || idx}
                  type="button"
                  onClick={() => setActiveProductIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all flex items-center gap-1.5 border ${
                    activeProductIndex === idx
                      ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] border-primary shadow-xs'
                      : 'bg-surface text-ink border-line hover:bg-paper'
                  }`}
                >
                  <span>منتج {idx + 1}</span>
                  <span className="text-[10px] opacity-75 truncate max-w-[100px]">{p.name || ''}</span>
                </button>
              ))}
            </div>

            {/* Active Card rendering the UNIFIED PRODUCT FORM */}
            <div className="p-4 sm:p-5 rounded-3xl bg-surface border-2 border-primary/30 shadow-md">
              <UnifiedProductForm
                key={currentProduct.tempId || activeProductIndex}
                initialData={currentProduct}
                categories={categories}
                shippingClasses={shippingClasses}
                supplierShipments={supplierShipments}
                availableGroups={availableGroups}
                mode="slider_card"
                sliderInfo={{
                  index: activeProductIndex,
                  total: extractedProducts.length,
                  onNext: () =>
                    setActiveProductIndex((prev) =>
                      Math.min(extractedProducts.length - 1, prev + 1)
                    ),
                  onPrev: () => setActiveProductIndex((prev) => Math.max(0, prev - 1))
                }}
                submitLabel="حفظ هذا المنتج الفردي في الكتالوج"
                onSubmit={handleSaveSingleProduct}
                onDelete={() => {
                  const rem = extractedProducts.filter((_, i) => i !== activeProductIndex);
                  setExtractedProducts(rem);
                  if (activeProductIndex >= rem.length && rem.length > 0) {
                    setActiveProductIndex(rem.length - 1);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
