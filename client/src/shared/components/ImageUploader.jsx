import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  Camera,
  Loader2,
  RefreshCw,
  CloudUpload,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../context/StoreContext';

/**
 * Standard, robust Image Uploader component:
 * Supports picking files, camera capture, drag-and-drop, staging preview,
 * and reliable Cloud/Server uploading.
 */
export default function ImageUploader({
  value,
  onChange,
  multiple = false,
  className = ''
}) {
  const { token, showToast } = useStore();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Staged local files before uploading to Cloud
  const [stagedFiles, setStagedFiles] = useState([]);
  const [cloudUploadSuccess, setCloudUploadSuccess] = useState('');
  const [showCloudLinks, setShowCloudLinks] = useState(false);

  // Camera Modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');

  const fileRef = useRef(null);
  const mobileCameraRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const images = multiple
    ? Array.isArray(value)
      ? value.filter(Boolean)
      : []
    : value
    ? [value]
    : [];

  useEffect(() => {
    return () => {
      stopCameraStream();
      stagedFiles.forEach((sf) => {
        if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl);
      });
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const openCamera = async (preferredFacing = facingMode) => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mobileCameraRef.current?.click();
      return;
    }

    try {
      stopCameraStream();
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: preferredFacing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access error, falling back to native capture input:', err);
      setIsCameraOpen(false);
      mobileCameraRef.current?.click();
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    openCamera(nextFacing);
  };

  const stageSelectedFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;
    setCloudUploadSuccess('');

    const newStaged = Array.from(filesList).map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name || `image-${idx + 1}.jpg`,
      previewUrl: URL.createObjectURL(file)
    }));

    if (multiple) {
      setStagedFiles((prev) => [...prev, ...newStaged]);
    } else {
      stagedFiles.forEach((sf) => {
        if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl);
      });
      setStagedFiles([newStaged[0]]);
    }
  };

  const capturePhotoFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const capturedFile = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stageSelectedFiles([capturedFile]);
        stopCameraStream();
        setIsCameraOpen(false);
      },
      'image/jpeg',
      0.9
    );
  };

  const removeStagedFile = (id) => {
    setStagedFiles((prev) => {
      const target = prev.find((sf) => sf.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((sf) => sf.id !== id);
    });
  };

  const handleUploadStagedToCloud = async () => {
    if (stagedFiles.length === 0) return [];
    setUploading(true);
    setCloudUploadSuccess('');

    try {
      const uploadedUrls = [];
      const effectiveToken = token || localStorage.getItem('store_token') || localStorage.getItem('token') || '';

      for (const staged of stagedFiles) {
        const formData = new FormData();
        formData.append('image', staged.file);
        formData.append('file', staged.file);

        const headers = {};
        if (effectiveToken) {
          headers['Authorization'] = `Bearer ${effectiveToken}`;
          headers['x-auth-token'] = effectiveToken;
        }

        // Note: Do NOT set 'Content-Type': 'multipart/form-data' explicitly in Axios,
        // otherwise the browser multipart boundary is stripped and causes a 500 server error.
        const res = await axios.post('/api/admin/upload', formData, { headers });

        const cloudUrl = res.data?.url || res.data?.fileUrl || res.data?.imageUrl;
        if (cloudUrl) {
          uploadedUrls.push(cloudUrl);
        }
      }

      stagedFiles.forEach((sf) => {
        if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl);
      });
      setStagedFiles([]);

      if (multiple) {
        onChange([...images, ...uploadedUrls]);
      } else if (uploadedUrls.length > 0) {
        onChange(uploadedUrls[0]);
      }

      const msg = `تم رفع ${uploadedUrls.length} صورة على الكلاود بنجاح! ✅`;
      setCloudUploadSuccess(msg);
      setShowCloudLinks(true);
      if (showToast) showToast(msg);
      return uploadedUrls;
    } catch (err) {
      console.error('Upload error:', err);
      if (showToast) {
        showToast('فشل في رفع الصورة على الكلاود. تأكد من إعدادات التخزين.', 'error');
      } else {
        alert('فشل في رفع الصورة.');
      }
      return [];
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => {
    if (multiple) {
      const updated = images.filter((_, i) => i !== idx);
      onChange(updated);
    } else {
      onChange('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    stageSelectedFiles(Array.from(e.dataTransfer.files));
  };

  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* 1. Preview Uploaded Cloud Images */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative group w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-500/40 bg-paper shadow-xs"
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="حذف الصورة"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 inset-x-0 bg-emerald-600/85 text-white text-[8px] text-center py-0.5 font-black">
                  {idx === 0 && multiple ? 'الرئيسية ☁️' : 'مرفوعة ☁️'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Preview Staged Local Images + "رفع على الكلاود" Button */}
      {stagedFiles.length > 0 && (
        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-orange-600 flex items-center gap-1.5">
              <span>📸 صور مجهزة للمعاينة ({stagedFiles.length}) — اضغط لرفعها على الكلاود:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                stagedFiles.forEach((sf) => {
                  if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl);
                });
                setStagedFiles([]);
              }}
              className="text-[10px] font-bold text-red-500 hover:underline"
            >
              إلغاء المحددة
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {stagedFiles.map((sf) => (
              <div
                key={sf.id}
                className="relative group w-20 h-20 rounded-xl overflow-hidden border-2 border-orange-500 bg-surface shadow-sm"
              >
                <img src={sf.previewUrl} alt={sf.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeStagedFile(sf.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                  title="إزالة"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 inset-x-0 bg-orange-500 text-slate-950 text-[8px] text-center py-0.5 font-black">
                  بانتظار الرفع
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={handleUploadStagedToCloud}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الرفع على الكلاود...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                <span>رفع {stagedFiles.length === 1 ? 'الصورة' : `الصور (${stagedFiles.length})`} على الكلاود الآن ☁️</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. Cloud Upload Confirmation & Links Display */}
      {(cloudUploadSuccess || images.length > 0) && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{cloudUploadSuccess || `الصور المرفوعة على الكلاود (${images.length})`}</span>
            </span>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCloudLinks(!showCloudLinks)}
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                <span>{showCloudLinks ? 'إخفاء الروابط' : 'عرض روابط الكلاود'}</span>
              </button>
            )}
          </div>

          {showCloudLinks && images.length > 0 && (
            <div className="space-y-1 max-h-28 overflow-y-auto pt-1 border-t border-emerald-500/20">
              {images.map((imgUrl, idx) => {
                const fullLink = getFullUrl(imgUrl);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-surface/90 border border-line rounded-lg px-2 py-1"
                  >
                    <a
                      href={fullLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-mono text-primary hover:underline truncate flex-1 text-left"
                      dir="ltr"
                    >
                      {fullLink}
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(fullLink);
                          if (showToast) showToast('تم نسخ رابط الصورة على الكلاود');
                        }}
                        className="p-1 rounded hover:bg-paper text-ink-soft hover:text-ink"
                        title="نسخ الرابط"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <a
                        href={fullLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded hover:bg-paper text-ink-soft hover:text-primary"
                        title="فتح الصورة"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Select / Capture Action Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-3 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/10' : 'border-line hover:border-primary/60 bg-paper/50'
        } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {/* 1. Pick from device */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-primary hover:text-white text-ink border border-line text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{multiple ? 'اختيار صور من الجهاز' : 'اختيار صورة من الجهاز'}</span>
            </button>

            {/* 2. Capture directly via Camera */}
            <button
              type="button"
              onClick={() => openCamera()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>تصوير بالكاميرا</span>
            </button>
          </div>

          <p className="text-[10px] text-ink-soft">
            اسحب الصور وأفلتها هنا، أو اخترها من جهازك (يدعم JPG, PNG, WebP)
          </p>
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => stageSelectedFiles(e.target.files)}
        />
        <input
          ref={mobileCameraRef}
          type="file"
          accept="image/*"
          capture={facingMode}
          className="hidden"
          onChange={(e) => stageSelectedFiles(e.target.files)}
        />
      </div>

      {/* 5. Direct Camera Stream Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface rounded-2xl max-w-md w-full overflow-hidden border border-line shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-ink flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" />
                <span>التقاط صورة المنتج مباشرة</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setIsCameraOpen(false);
                }}
                className="p-1 rounded-lg text-ink-soft hover:text-ink hover:bg-paper"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {cameraError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 text-center text-xs text-red-400">
                  {cameraError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="px-3 py-2 rounded-xl bg-paper hover:bg-surface border border-line text-ink text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تبديل الكاميرا ({facingMode === 'environment' ? 'الخلفية' : 'الأمامية'})</span>
              </button>

              <button
                type="button"
                onClick={capturePhotoFromVideo}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md"
              >
                <Camera className="w-4 h-4" />
                <span>التقاط الصورة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
