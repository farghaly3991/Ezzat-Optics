import React from 'react';
import { Phone, Mail, MapPin, ShieldCheck, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';

/**
 * Modern vibrant footer with explicit Farweb branding, direct contacts, and store identity.
 */
export default function Footer() {
  const { config } = useStore();

  const storePhone = config?.phone || config?.general?.phone || '01000000000';
  const storeEmail = config?.email || config?.general?.email || 'contact@ezzat-optics.com';
  const storeAddress = config?.address || config?.general?.address || 'القاهرة، مصر';
  const storeName = config?.siteName || config?.general?.storeName || 'Ezzat Optics - عزت للبصريات';

  return (
    <footer className="mt-16 border-t border-slate-200/80 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white text-xs select-none">
      {/* Upper Info Grid */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-white/10">
          {/* 1. Store Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-black text-base">
              <span className="text-xl">👓</span>
              <span className="text-cyan-400 font-mono tracking-wide">{storeName}</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed font-medium">
              نظام إدارة البصريات والمبيعات المتكامل (POS & Management System) - إصدار الديسكتوب الذكي.
            </p>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px] pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>نظام موثق ومؤمن بالكامل - محلي وسحابي</span>
            </div>
          </div>

          {/* 2. Store Contacts (from Dashboard) */}
          <div className="space-y-3">
            <h4 className="text-white font-black text-xs uppercase tracking-wider text-slate-400">بيانات الفرع والفرع الرئيسي</h4>
            <div className="space-y-2 font-bold text-slate-300">
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-cyan-400" />
                <span dir="ltr">{storePhone}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>{storeEmail}</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>{storeAddress}</span>
              </p>
            </div>
          </div>

          {/* 3. Technology Partner / Farweb Direct Badge */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/60 to-indigo-950/80 border border-blue-500/30 space-y-2.5 shadow-lg shadow-blue-500/10">
            <div className="flex items-center gap-2 text-cyan-300 font-black text-xs">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>تطوير ودعم تقني معتمد</span>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed font-medium">
              تم تطوير وبرمجة هذا النظام بواسطة مهندس النظم <strong className="text-white font-black">Farweb</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href="https://facebook.com/farweb1"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] transition-all shadow-md shadow-blue-600/30"
              >
                <span>صفحة فيسبوك</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://wa.me/201092338291"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition-all shadow-md shadow-emerald-600/30"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span dir="ltr">01092338291</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Vibrant Copyright Bar (Distinct & Bold) */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold">
          <div className="flex items-center gap-2 text-slate-300">
            <span>جميع الحقوق محفوظة © {new Date().getFullYear()}</span>
            <span className="text-slate-500">|</span>
            <span className="text-white font-black">{storeName}</span>
          </div>

          {/* Explicit Vibrant Farweb Trademark */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/25">
            <span className="text-slate-100 text-[11px] font-medium">Developed by</span>
            <a
              href="https://facebook.com/farweb1"
              target="_blank"
              rel="noreferrer"
              className="font-black text-sm text-amber-200 hover:text-white transition-colors underline flex items-center gap-1"
            >
              <span>Farweb</span>
              <ExternalLink className="w-3 h-3 text-amber-200" />
            </a>
            <span className="text-white/60 text-xs">|</span>
            <a
              href="tel:01092338291"
              className="font-mono text-xs font-black text-white hover:text-cyan-200 transition-colors"
              dir="ltr"
            >
              01092338291
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
