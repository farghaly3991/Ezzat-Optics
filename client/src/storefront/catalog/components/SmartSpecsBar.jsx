import React from 'react';
import { Tag, ArrowLeft } from 'lucide-react';

export default function SmartSpecsBar({ smartSpecs = [], onSelectSpec }) {
  if (!smartSpecs || smartSpecs.length === 0) return null;

  return (
    <section className="my-10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-ink flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <span>تصفح حسب أبرز المواصفات والميزات</span>
        </h3>
        <span className="text-xs text-ink-soft font-bold">انقر لاختيار المواصفة وتصفية المنتجات</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {smartSpecs.map((specItem) => (
          <div
            key={specItem.specKey}
            className="rounded-card p-4 bg-surface border border-line hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-ink">{specItem.specKey}</span>
              <span className="text-[10px] font-bold bg-paper text-ink-soft border border-line px-2 py-0.5 rounded-full">
                {specItem.totalCount} منتج
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {specItem.topValues.map((v) => (
                <button
                  key={v.value}
                  onClick={() => onSelectSpec(specItem.specKey, v.value)}
                  className="text-xs font-bold px-2.5 py-1 rounded-btn bg-paper hover:bg-primary hover:text-[var(--color-primary-contrast,#ffffff)] text-ink border border-line transition-all flex items-center gap-1"
                >
                  <span>{v.value}</span>
                  <span className="text-[9px] opacity-70">({v.count})</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
