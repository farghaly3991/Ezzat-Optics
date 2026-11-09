import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Barcode,
  Layers,
  Copy,
  Check,
  Eye,
  Sliders,
  Scissors
} from 'lucide-react';

/**
 * Professional Barcode Label Printing Modal
 * Features:
 * - Single Thermal Barcode Sticker (50x25mm / 38x25mm / Jewelry Butterfly Eyewear tag)
 * - Full A4 Sheet with dotted cut lines (فرخ ملصقات كامل بخطوط قص)
 * - 1:1 Actual physical size preview
 * - Configurable quantity & custom label text
 */
export default function BarcodePrintModal({ product, onClose }) {
  const [printMode, setPrintMode] = useState('thermal_50x25'); // 'thermal_50x25' | 'thermal_38x25' | 'a4_sheet'
  const [copies, setCopies] = useState(1);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeStoreName, setIncludeStoreName] = useState(true);

  if (!product) return null;

  const barcodeValue = product.barcode || `OPT-${String(product._id).slice(-8).toUpperCase()}`;
  const storeName = 'HI LUXE OPTICS';
  const priceFormatted = Number(product.price || 0).toLocaleString('ar-EG');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-in fade-in" dir="rtl">
      {/* Hide everything else on print, show only printable area */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #barcode-printable-area, #barcode-printable-area * {
            visibility: visible !important;
          }
          #barcode-printable-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: ${printMode === 'a4_sheet' ? '10mm' : '0'};
            size: ${printMode === 'a4_sheet' ? 'A4 portrait' : 'auto'};
          }
        }
      `}</style>

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col no-print">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">شاشة طباعة ملصقات الباركود</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Label Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديد نوع الطابعة والمقاس ومعاينة الملصق بحجمه الحقيقي قبل الطباعة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Bar */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-2">نوع الطابعة ومقاس الملصق:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPrintMode('thermal_50x25')}
                className={`p-3 rounded-xl border text-right transition-all ${
                  printMode === 'thermal_50x25'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600 font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-black text-xs">طابعة حرارية (50 × 25 مم)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">ملصق فردي قياسي للبصريات</div>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('thermal_38x25')}
                className={`p-3 rounded-xl border text-right transition-all ${
                  printMode === 'thermal_38x25'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600 font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-black text-xs">طابعة حرارية (38 × 25 مم)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">ملصق صغير شنابر وإكسسوارات</div>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('a4_sheet')}
                className={`p-3 rounded-xl border text-right transition-all ${
                  printMode === 'a4_sheet'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-1 ring-emerald-600 font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-black text-xs flex items-center gap-1">
                  <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                  <span>طابعة A4 عادية (فرخ مقصص)</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">فرخ ملصقات كامل بخطوط قص</div>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <label className="text-slate-700 font-bold">عدد النسخ / الملصقات:</label>
              <input
                type="number"
                min="1"
                max="200"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-center text-sm"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-bold">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>إظهار السعر</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-bold">
                <input
                  type="checkbox"
                  checked={includeStoreName}
                  onChange={(e) => setIncludeStoreName(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>اسم المحل</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live 1:1 Preview Container */}
        <div className="p-6 bg-slate-100 flex flex-col items-center justify-center min-h-[220px]">
          <div className="text-[11px] font-bold text-slate-400 mb-3 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span>معاينة الملصق بالحجم الطبيعي التقديري على الشاشة:</span>
          </div>

          {/* Actual Sticker Box */}
          <div
            className="bg-white border-2 border-slate-300 shadow-md p-2 rounded flex flex-col justify-between items-center text-center transition-all"
            style={{
              width: printMode === 'thermal_38x25' ? '180px' : '220px',
              height: '110px'
            }}
          >
            {includeStoreName && (
              <div className="text-[9px] font-black text-slate-600 tracking-wider uppercase border-b border-slate-100 pb-0.5 w-full">
                {storeName}
              </div>
            )}

            <div className="text-[10px] font-extrabold text-slate-800 truncate max-w-full px-1">
              {product.name}
            </div>

            {/* Barcode Visualization (CSS Striped pattern mimicking 1D Barcode) */}
            <div className="flex flex-col items-center my-0.5">
              <div
                className="h-8 w-36 bg-repeat-x flex items-end justify-center"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #000 0, #000 1.5px, #fff 1.5px, #fff 3px, #000 3px, #000 4px, #fff 4px, #fff 6px)'
                }}
              />
              <span className="font-mono text-[9px] font-black text-slate-900 tracking-widest mt-0.5">
                {barcodeValue}
              </span>
            </div>

            <div className="w-full flex items-center justify-between text-[9px] px-1 border-t border-slate-100 pt-0.5">
              <span className="text-slate-500 font-bold">
                {product.opticsSpecs?.size || product.specs?.['المقاس'] || 'STD'}
              </span>
              {includePrice && (
                <span className="font-black text-slate-900 font-mono text-[10px]">
                  {priceFormatted} ج.م
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            الصنف: <strong className="text-slate-800">{product.name}</strong> · الإجمالي المطلوب: <strong className="text-blue-600">{copies} ملصق</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الملصقات الآن</span>
            </button>
          </div>
        </div>
      </div>

      {/* PRINTABLE HIDDEN AREA FOR WINDOW.PRINT */}
      <div id="barcode-printable-area" className="hidden print:block">
        {printMode === 'a4_sheet' ? (
          // A4 Grid with Dotted Cut Lines
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '4mm',
              padding: '5mm',
              direction: 'rtl'
            }}
          >
            {Array.from({ length: copies }).map((_, i) => (
              <div
                key={i}
                style={{
                  border: '1px dashed #777',
                  padding: '3mm',
                  borderRadius: '2mm',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '28mm',
                  pageBreakInside: 'avoid'
                }}
              >
                {includeStoreName && (
                  <div style={{ fontSize: '7pt', fontWeight: 'bold' }}>{storeName}</div>
                )}
                <div style={{ fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {product.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      height: '8mm',
                      width: '32mm',
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #000 0, #000 1.5px, #fff 1.5px, #fff 3px, #000 3px, #000 4px, #fff 4px, #fff 6px)'
                    }}
                  />
                  <div style={{ fontSize: '7pt', fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 'bold' }}>
                    {barcodeValue}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7pt', fontWeight: 'bold' }}>
                  <span>{product.opticsSpecs?.size || product.specs?.['المقاس'] || ''}</span>
                  {includePrice && <span>{priceFormatted} EGP</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Single / Sequential Thermal Stickers
          <div style={{ direction: 'rtl' }}>
            {Array.from({ length: copies }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: printMode === 'thermal_38x25' ? '38mm' : '50mm',
                  height: '25mm',
                  padding: '2mm',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  pageBreakAfter: 'always',
                  boxSizing: 'border-box'
                }}
              >
                {includeStoreName && (
                  <div style={{ fontSize: '6pt', fontWeight: 'bold' }}>{storeName}</div>
                )}
                <div style={{ fontSize: '7.5pt', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {product.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      height: '8mm',
                      width: printMode === 'thermal_38x25' ? '28mm' : '36mm',
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #000 0, #000 1.5px, #fff 1.5px, #fff 3px, #000 3px, #000 4px, #fff 4px, #fff 6px)'
                    }}
                  />
                  <div style={{ fontSize: '6.5pt', fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 'bold' }}>
                    {barcodeValue}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '6.5pt', fontWeight: 'bold' }}>
                  <span>{product.opticsSpecs?.size || product.specs?.['المقاس'] || ''}</span>
                  {includePrice && <span>{priceFormatted} EGP</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
