import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutTemplate,
  Sparkles,
  CheckCircle2,
  Download,
  RefreshCw,
  Palette
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

const SVG_TEMPLATES = [
  {
    id: 'modern_spotlight',
    name: 'العرض العصري المتألق',
    desc: 'تصميم عصري متدرج يبرز المنتج والمواصفات والسعر بوضوح',
    bgStart: '#1e3a8a',
    bgEnd: '#3b82f6',
    accent: '#f59e0b',
    cardBg: '#ffffff',
    textMain: '#ffffff',
    cardText: '#0f172a'
  },
  {
    id: 'dark_luxury',
    name: 'الفخامة الملكية الداكنة',
    desc: 'خلفية داكنة فخمة مع لمسات ذهبية مثالية للأجهزة والمنتجات القيمة',
    bgStart: '#090d16',
    bgEnd: '#1e293b',
    accent: '#fbbf24',
    cardBg: '#111827',
    textMain: '#f8fafc',
    cardText: '#f8fafc'
  },
  {
    id: 'flash_retail',
    name: 'الخصم الخاطف (Flash Sale)',
    desc: 'تصميم ناري أحمر وأصفر مخصص للعروض القوية والتصفيات السريعة',
    bgStart: '#7f1d1d',
    bgEnd: '#dc2626',
    accent: '#facc15',
    cardBg: '#ffffff',
    textMain: '#ffffff',
    cardText: '#111827'
  },
  {
    id: 'emerald_bundle',
    name: 'كولاج التوفير الزمردي',
    desc: 'قالب شبكي منظم لعرض منتج أو عدة منتجات معاً في باكدج واحد',
    bgStart: '#064e3b',
    bgEnd: '#10b981',
    accent: '#fde047',
    cardBg: '#ffffff',
    textMain: '#ffffff',
    cardText: '#064e3b'
  }
];

/**
 * تحويل رابط الصورة إلى Data URL لضمان رسمها داخل الـ SVG وتصديرها كـ PNG بدون مشاكل CORS
 */
async function urlToDataUri(url) {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export default function FacebookSvgTemplateStudio({
  selectedProducts = [],
  headline = '',
  subheadline = '',
  badgeText = '',
  ctaText = '',
  discountText = '',
  selectedTemplateId = 'modern_spotlight',
  isMultiImageCover = false,
  currentCoverUrl = '',
  onSelectTemplate,
  onImageGenerated
}) {
  const { token, config, showToast } = useStore();
  const svgRef = useRef(null);

  const [dataUrlMap, setDataUrlMap] = useState({});
  const [exporting, setExporting] = useState(false);
  const [customAccent, setCustomAccent] = useState('');
  const [lastUploadedUrl, setLastUploadedUrl] = useState(currentCoverUrl || '');

  const activeTemplate =
    SVG_TEMPLATES.find((t) => t.id === selectedTemplateId) || SVG_TEMPLATES[0];

  const accentColor = customAccent || activeTemplate.accent;
  const storeName = config?.siteName || 'المتجر العصري';
  const currency = config?.currency || 'ج.م';
  const contactPhone = config?.whatsapp || config?.phone || '';

  const displayHeadline =
    headline?.trim() ||
    (selectedProducts.length === 1
      ? selectedProducts[0].name
      : `أقوى العروض من ${storeName}`);

  const displaySubheadline =
    subheadline?.trim() ||
    selectedProducts
      .slice(0, 3)
      .map((p) => p.name)
      .join(' • ');

  const displayBadge =
    badgeText?.trim() || discountText?.trim() || 'عرض خاص 🔥';

  const displayCta =
    ctaText?.trim() ||
    (contactPhone ? `اطلب الآن: ${contactPhone}` : 'اطلب الآن عبر رسائل الصفحة');

  // تحميل صور المنتجات المختارة كـ Base64 Data URLs
  useEffect(() => {
    let isMounted = true;
    const loadImages = async () => {
      const nextMap = {};
      for (const p of selectedProducts.slice(0, 4)) {
        const imgUrl = p.images?.[0] || p.image || '';
        if (imgUrl) {
          nextMap[p._id] = await urlToDataUri(imgUrl);
        }
      }
      if (isMounted) setDataUrlMap(nextMap);
    };
    loadImages();
    return () => {
      isMounted = false;
    };
  }, [selectedProducts]);

  /**
   * تحويل الـ SVG المعروض إلى ملف صورة PNG بدقة 1080x1080 ورفعه للسيرفر لاعتماده كصورة البوست
   */
  const handleRenderAndUploadPoster = async (downloadOnly = false) => {
    if (!svgRef.current) return;
    setExporting(true);

    try {
      const svgElement = svgRef.current;
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const domUrl = URL.createObjectURL(svgBlob);

      const pngBlob = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1080;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 1080, 1080);
          URL.revokeObjectURL(domUrl);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('تعذر تحويل القالب إلى صورة PNG'));
            },
            'image/png',
            0.95
          );
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(domUrl);
          reject(err);
        };
        img.src = domUrl;
      });

      if (downloadOnly) {
        const dlUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = `facebook-post-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(dlUrl);
        showToast('تم تحميل تصميم البوست بنجاح');
        setExporting(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', pngBlob, `fb-svg-poster-${Date.now()}.png`);

      const uploadRes = await axios.post('/api/admin/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const uploadedUrl = uploadRes.data?.url;
      if (uploadedUrl) {
        setLastUploadedUrl(uploadedUrl);
        if (onImageGenerated) onImageGenerated(uploadedUrl);
        showToast(
          isMultiImageCover
            ? 'تم رفع واعتماد تصميم الكفر الرئيسي للبوست على الكلاود بنجاح! ☁️🎨'
            : 'تم رفع واعتماد تصميم القالب كصورة للبوست على الكلاود بنجاح! ☁️🎨'
        );
      }
    } catch (err) {
      console.error('SVG Poster Export Error:', err);
      showToast('حدث خطأ أثناء تحويل القالب إلى صورة', 'error');
    } finally {
      setExporting(false);
    }
  };

  const visibleProducts = selectedProducts.slice(0, 4);
  const isSingle = visibleProducts.length <= 1;
  const singleProd = visibleProducts[0] || {
    _id: 'demo',
    name: 'اختر منتجاً لمعاينة التصميم',
    price: 0,
    oldPrice: 0,
    specs: {}
  };

  const singleSpecsEntries = Object.entries(singleProd.specs || {})
    .filter(([, v]) => Boolean(v))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Template Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {SVG_TEMPLATES.map((tpl) => {
          const isSelected = tpl.id === activeTemplate.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelectTemplate && onSelectTemplate(tpl.id)}
              className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                  : 'border-line bg-paper hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-ink">{tpl.name}</span>
                <span
                  className="w-4 h-4 rounded-full border border-white/40 shrink-0 shadow-xs"
                  style={{
                    background: `linear-gradient(135deg, ${tpl.bgStart}, ${tpl.bgEnd})`
                  }}
                />
              </div>
              <p className="text-[10px] text-ink-soft leading-snug line-clamp-2">{tpl.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Live Interactive SVG Poster Preview & Action Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-paper/60 border border-line rounded-2xl p-4">
        {/* SVG Canvas Preview (1:1 Square) */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-[440px] aspect-square rounded-2xl overflow-hidden shadow-2xl border border-line bg-slate-900">
            <svg
              ref={svgRef}
              viewBox="0 0 1080 1080"
              width="100%"
              height="100%"
              xmlns="http://www.w3.org/2000/svg"
              style={{ direction: 'rtl', fontFamily: 'Cairo, Tajawal, sans-serif' }}
            >
              <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={activeTemplate.bgStart} />
                  <stop offset="100%" stopColor={activeTemplate.bgEnd} />
                </linearGradient>
                <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={accentColor} />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#000000" floodOpacity="0.35" />
                </filter>
                <clipPath id="singleImgClip">
                  <rect x="520" y="290" width="470" height="540" rx="32" />
                </clipPath>
                <clipPath id="gridClip0">
                  <rect x="90" y="300" width="420" height="230" rx="22" />
                </clipPath>
                <clipPath id="gridClip1">
                  <rect x="570" y="300" width="420" height="230" rx="22" />
                </clipPath>
                <clipPath id="gridClip2">
                  <rect x="90" y="620" width="420" height="230" rx="22" />
                </clipPath>
                <clipPath id="gridClip3">
                  <rect x="570" y="620" width="420" height="230" rx="22" />
                </clipPath>
              </defs>

              {/* Background */}
              <rect width="1080" height="1080" fill="url(#bgGrad)" />

              {/* Decorative Ambient Circles */}
              <circle cx="960" cy="120" r="260" fill={accentColor} opacity="0.12" />
              <circle cx="120" cy="960" r="310" fill="#ffffff" opacity="0.06" />
              <circle cx="540" cy="540" r="460" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="2" />

              {/* Top Bar: Store Name & Badge */}
              <rect x="70" y="52" width="320" height="64" rx="32" fill="rgba(255,255,255,0.14)" />
              <text
                x="230"
                y="93"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="28"
                fontWeight="900"
              >
                {storeName.slice(0, 22)}
              </text>

              {/* Discount / Offer Badge */}
              <rect
                x="650"
                y="48"
                width="360"
                height="72"
                rx="36"
                fill={accentColor}
                filter="url(#dropShadow)"
              />
              <text
                x="830"
                y="94"
                textAnchor="middle"
                fill="#0f172a"
                fontSize="30"
                fontWeight="900"
              >
                {displayBadge.slice(0, 22)}
              </text>

              {/* Main Headline & Subheadline */}
              <text
                x="540"
                y="185"
                textAnchor="middle"
                fill={activeTemplate.textMain}
                fontSize="46"
                fontWeight="900"
              >
                {displayHeadline.slice(0, 38)}
              </text>
              <text
                x="540"
                y="238"
                textAnchor="middle"
                fill={accentColor}
                fontSize="25"
                fontWeight="700"
              >
                {displaySubheadline.slice(0, 58)}
              </text>

              {/* Main Content Area: Single Product Hero OR Multi-Product Grid */}
              {isSingle ? (
                <g>
                  {/* Left Info Card */}
                  <rect
                    x="70"
                    y="275"
                    width="420"
                    height="570"
                    rx="36"
                    fill={activeTemplate.cardBg}
                    filter="url(#dropShadow)"
                  />

                  <text
                    x="280"
                    y="345"
                    textAnchor="middle"
                    fill={activeTemplate.cardText}
                    fontSize="32"
                    fontWeight="900"
                  >
                    {(singleProd.name || '').slice(0, 24)}
                  </text>

                  {/* Price Callout Box */}
                  <rect
                    x="105"
                    y="380"
                    width="350"
                    height="120"
                    rx="24"
                    fill={accentColor}
                  />
                  <text
                    x="280"
                    y="435"
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="44"
                    fontWeight="900"
                  >
                    {singleProd.price || 0} {currency}
                  </text>
                  {singleProd.oldPrice > singleProd.price && (
                    <text
                      x="280"
                      y="478"
                      textAnchor="middle"
                      fill="#334155"
                      fontSize="24"
                      fontWeight="700"
                      textDecoration="line-through"
                    >
                      بدلاً من {singleProd.oldPrice} {currency}
                    </text>
                  )}

                  {/* Specs List inside Card */}
                  {singleSpecsEntries.length > 0 ? (
                    singleSpecsEntries.map(([specLabel, specVal], idx) => (
                      <g key={specLabel} transform={`translate(105, ${530 + idx * 68})`}>
                        <rect
                          x="0"
                          y="0"
                          width="350"
                          height="54"
                          rx="14"
                          fill={activeTemplate.id === 'dark_luxury' ? '#1e293b' : '#f1f5f9'}
                        />
                        <text
                          x="175"
                          y="35"
                          textAnchor="middle"
                          fill={activeTemplate.cardText}
                          fontSize="22"
                          fontWeight="800"
                        >
                          {`${specLabel}: ${specVal}`.slice(0, 28)}
                        </text>
                      </g>
                    ))
                  ) : (
                    <g transform="translate(105, 560)">
                      <rect
                        x="0"
                        y="0"
                        width="350"
                        height="70"
                        rx="16"
                        fill={activeTemplate.id === 'dark_luxury' ? '#1e293b' : '#f1f5f9'}
                      />
                      <text
                        x="175"
                        y="44"
                        textAnchor="middle"
                        fill={activeTemplate.cardText}
                        fontSize="24"
                        fontWeight="800"
                      >
                        ✅ ضمان الجودة وأفضل سعر
                      </text>
                    </g>
                  )}

                  {/* Right Product Image Frame */}
                  <rect
                    x="510"
                    y="275"
                    width="490"
                    height="570"
                    rx="38"
                    fill="#ffffff"
                    filter="url(#dropShadow)"
                  />
                  {dataUrlMap[singleProd._id] ? (
                    <image
                      href={dataUrlMap[singleProd._id]}
                      x="520"
                      y="290"
                      width="470"
                      height="540"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath="url(#singleImgClip)"
                    />
                  ) : (
                    <g>
                      <rect x="520" y="290" width="470" height="540" rx="32" fill="#e2e8f0" />
                      <text
                        x="755"
                        y="565"
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="30"
                        fontWeight="800"
                      >
                        صورة المنتج
                      </text>
                    </g>
                  )}
                </g>
              ) : (
                /* Multi-Product Grid (2 to 4 Products) */
                <g>
                  {visibleProducts.map((prod, idx) => {
                    const col = idx % 2;
                    const row = Math.floor(idx / 2);
                    const x = col === 0 ? 80 : 560;
                    const y = row === 0 ? 290 : 610;
                    const imgData = dataUrlMap[prod._id];

                    return (
                      <g key={prod._id || idx}>
                        <rect
                          x={x}
                          y={y}
                          width="440"
                          height="295"
                          rx="26"
                          fill={activeTemplate.cardBg}
                          filter="url(#dropShadow)"
                        />
                        {imgData ? (
                          <image
                            href={imgData}
                            x={x + 10}
                            y={y + 10}
                            width="420"
                            height="210"
                            preserveAspectRatio="xMidYMid slice"
                            clipPath={`url(#gridClip${idx})`}
                          />
                        ) : (
                          <rect
                            x={x + 10}
                            y={y + 10}
                            width="420"
                            height="200"
                            rx="20"
                            fill="#e2e8f0"
                          />
                        )}
                        <text
                          x={x + 295}
                          y={y + 260}
                          textAnchor="middle"
                          fill={activeTemplate.cardText}
                          fontSize="22"
                          fontWeight="800"
                        >
                          {(prod.name || '').slice(0, 18)}
                        </text>
                        <rect
                          x={x + 16}
                          y={y + 228}
                          width="145"
                          height="50"
                          rx="14"
                          fill={accentColor}
                        />
                        <text
                          x={x + 88}
                          y={y + 261}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize="22"
                          fontWeight="900"
                        >
                          {prod.price} {currency}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Bottom CTA Footer Bar */}
              <rect
                x="70"
                y="935"
                width="940"
                height="96"
                rx="48"
                fill="url(#accentGrad)"
                filter="url(#dropShadow)"
              />
              <text
                x="540"
                y="996"
                textAnchor="middle"
                fill="#0f172a"
                fontSize="34"
                fontWeight="900"
              >
                {displayCta.slice(0, 42)}
              </text>
            </svg>
          </div>
        </div>

        {/* Controls & Export Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
            <h4 className="text-xs font-black text-ink flex items-center gap-1.5">
              <LayoutTemplate className="w-4 h-4 text-primary" />
              <span>استوديو قوالب البوستات التفاعلي (SVG + React)</span>
            </h4>
            <p className="text-[11px] text-ink-soft leading-relaxed">
              يقوم القالب بدمج صور المنتجات المختارة تلقائياً مع العنوان الترويجي، شارة الخصم، السعر، وأهم المواصفات بدقة قياسية <strong>1080×1080</strong> جاهزة للنشر المباشر على فيسبوك.
            </p>

            {/* Accent Color Customizer */}
            <div className="flex items-center justify-between pt-2 border-t border-line">
              <span className="text-xs font-bold text-ink-soft flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-orange-500" />
                لون الشارات والتمييز:
              </span>
              <div className="flex items-center gap-1.5">
                {['#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4'].map((clr) => (
                  <button
                    key={clr}
                    type="button"
                    onClick={() => setCustomAccent(clr)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      accentColor === clr ? 'scale-125 border-white shadow-md' : 'border-transparent opacity-80'
                    }`}
                    style={{ backgroundColor: clr }}
                  />
                ))}
                {customAccent && (
                  <button
                    type="button"
                    onClick={() => setCustomAccent('')}
                    className="text-[10px] font-bold text-ink-soft hover:text-ink underline mr-1"
                  >
                    افتراضي
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={exporting || selectedProducts.length === 0}
              onClick={() => handleRenderAndUploadPoster(false)}
              className="w-full py-3 px-4 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري تحويل التصميم ورفعه على الكلاود...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isMultiImageCover
                      ? 'رفع واعتماد هذا القالب كصورة الكفر الرئيسي على الكلاود ☁️'
                      : 'رفع واعتماد هذا القالب كصورة للبوست على الكلاود (1080×1080) ☁️'}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={exporting}
              onClick={() => handleRenderAndUploadPoster(true)}
              className="w-full py-2.5 px-4 rounded-btn bg-surface hover:bg-paper border border-line text-ink font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>تحميل التصميم كصورة PNG على جهازك</span>
            </button>

            {(lastUploadedUrl || currentCoverUrl) && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-[11px] animate-in fade-in">
                <div className="font-black text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>تم الرفع على الكلاود بنجاح! رابط الصورة:</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-surface border border-line rounded-lg px-2.5 py-1.5">
                  <a
                    href={
                      (lastUploadedUrl || currentCoverUrl).startsWith('http')
                        ? lastUploadedUrl || currentCoverUrl
                        : `${window.location.origin}${lastUploadedUrl || currentCoverUrl}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono text-primary hover:underline truncate flex-1 text-left"
                    dir="ltr"
                  >
                    {(lastUploadedUrl || currentCoverUrl).startsWith('http')
                      ? lastUploadedUrl || currentCoverUrl
                      : `${window.location.origin}${lastUploadedUrl || currentCoverUrl}`}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const u = (lastUploadedUrl || currentCoverUrl).startsWith('http')
                        ? lastUploadedUrl || currentCoverUrl
                        : `${window.location.origin}${lastUploadedUrl || currentCoverUrl}`;
                      navigator.clipboard.writeText(u);
                      showToast('تم نسخ رابط الكلاود');
                    }}
                    className="px-2 py-0.5 rounded bg-paper border border-line text-[10px] font-bold text-ink hover:text-primary"
                  >
                    نسخ الرابط
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
