import React from 'react';
import { Building2, Globe, Store, Lock, Check } from 'lucide-react';
import { useStore } from '../../shared/context/StoreContext';

/**
 * Reusable Branch Selector Bar for Admin Pages, Tables & Analytics
 * - For Super Admin: lets them switch between 'all' and any branch, with clear visual highlight.
 * - For Branch Admin & Sales Staff: locks to their branch and shows other branches as disabled.
 */
export default function AdminBranchSelector({
  value,
  onChange,
  showAll = true,
  label = 'تصفية حسب الفرع:'
}) {
  const {
    branches = [],
    activeBranchId,
    setActiveBranchId,
    isSuperAdmin,
    user
  } = useStore();

  const selectedId = value !== undefined ? String(value || 'all') : String(activeBranchId || 'all');
  const userBranchId = user?.branchId ? String(user.branchId) : null;

  const handleSelect = (branchId) => {
    if (!isSuperAdmin) return; // Non-super admins cannot switch
    const target = String(branchId || 'all');
    setActiveBranchId(target);
    window.dispatchEvent(new CustomEvent('branch-changed', { detail: target }));
    if (typeof onChange === 'function') {
      onChange(target);
    }
  };

  const currentBranchObj = branches.find((b) => String(b._id) === selectedId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-line shadow-xs text-xs">
      {/* Buttons Row */}
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        <div className="flex items-center gap-1.5 text-ink-soft font-bold pl-2 border-l border-line ml-1">
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </div>

        {/* All Branches Button */}
        {showAll && (
          <button
            type="button"
            disabled={!isSuperAdmin}
            onClick={() => handleSelect('all')}
            title={!isSuperAdmin ? 'عرض كل الفروع متاح فقط للسوبر أدمن العام' : 'عرض إحصائيات وبيانات كل الفروع المجمعة'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              selectedId === 'all'
                ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-md ring-2 ring-primary/30'
                : !isSuperAdmin
                ? 'opacity-40 cursor-not-allowed bg-paper text-ink-soft border border-line'
                : 'bg-paper hover:bg-surface text-ink border border-line hover:border-primary/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>كل الفروع المجمعة</span>
            {!isSuperAdmin && <Lock className="w-2.5 h-2.5 text-ink-soft ml-0.5" />}
          </button>
        )}

        {/* Branch Buttons */}
        {branches.map((b) => {
          const isSelected = selectedId === String(b._id);
          const isUserAssignedBranch = userBranchId && String(b._id) === userBranchId;
          const isClickable = isSuperAdmin;

          let btnClass = '';
          if (isSelected) {
            btnClass = isSuperAdmin
              ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-md ring-2 ring-primary/30 font-black'
              : 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/30 font-black';
          } else if (!isClickable) {
            btnClass = 'opacity-40 cursor-not-allowed bg-paper text-ink-soft border border-line';
          } else {
            btnClass = 'bg-paper hover:bg-surface text-ink border border-line hover:border-primary/50 font-bold';
          }

          return (
            <button
              key={b._id}
              type="button"
              disabled={!isClickable}
              onClick={() => handleSelect(b._id)}
              title={
                !isClickable
                  ? isUserAssignedBranch
                    ? 'هذا هو فرعك المخصص المعتمد'
                    : 'فرع غير مصرح بالوصول إليه (مقيد للسوبر أدمن)'
                  : `تصفية البيانات لفرع ${b.name}`
              }
              className={`px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 ${btnClass}`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>{b.name}</span>
              {b.isMain && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 font-bold">
                  الرئيسي
                </span>
              )}
              {isSelected && !isSuperAdmin && (
                <Check className="w-3 h-3 text-white mr-0.5" />
              )}
              {!isClickable && !isUserAssignedBranch && (
                <Lock className="w-2.5 h-2.5 text-ink-soft ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Scope Status Label */}
      <div className="text-[11px] font-medium text-ink-soft shrink-0">
        {!isSuperAdmin ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>صلاحياتك مقيدة تلقائياً ببيانات فرعك المخصص فقط</span>
          </span>
        ) : selectedId === 'all' ? (
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
            🌐 وضع مجمع (كل الفروع): يوضح اسم الفرع بجانب كل صف/إحصائية
          </span>
        ) : (
          <span className="text-primary font-bold">
            🏢 تصفية حصرية لـ: {currentBranchObj?.name || selectedId}
          </span>
        )}
      </div>
    </div>
  );
}