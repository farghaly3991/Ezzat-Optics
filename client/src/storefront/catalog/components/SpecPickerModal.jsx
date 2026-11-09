import React, { useState } from 'react';
import { X, Check, Plus } from 'lucide-react';

export default function SpecPickerModal({ specKey, specLabel, existingValues = [], onSelect, onClose }) {
  const [newValue, setNewValue] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        style={{ backgroundColor: 'var(--color-surface-solid, #ffffff)' }}
        className="text-ink rounded-card shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
          className="flex items-center justify-between p-4 border-b border-line"
        >
          <h3 className="font-bold text-ink">اختيار قيمة لـ «{specLabel}»</h3>
          <button onClick={onClose} className="p-1 hover:bg-paper rounded-full text-ink-soft hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto max-h-[50vh]">
          {existingValues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {existingValues.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => { onSelect(item.value); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-paper hover:border-primary hover:bg-primary/10 transition-colors text-sm text-ink"
                >
                  <span>{item.value}</span>
                  <span className="text-xs text-ink-soft">({item.count})</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft text-center py-4">لا توجد قيم مسجلة بعد لهذه المواصفة</p>
          )}
        </div>

        <div
          style={{ backgroundColor: 'var(--color-paper-solid, #f8fafc)' }}
          className="p-4 border-t border-line"
        >
          <div className="flex gap-2">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`قيمة جديدة لـ «${specLabel}»`}
              className="flex-1 bg-surface border border-line rounded-btn px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-ink-soft/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newValue.trim()) {
                  onSelect(newValue.trim());
                  onClose();
                }
              }}
            />
            <button
              onClick={() => { if (newValue.trim()) { onSelect(newValue.trim()); onClose(); } }}
              disabled={!newValue.trim()}
              className="bg-primary text-[var(--color-primary-contrast,#ffffff)] px-4 py-2 rounded-btn text-sm font-bold hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
