import React from 'react';
import {
  Share2,
  Eye,
  Save,
  Plus,
  Send,
  Calendar,
  BookOpen
} from 'lucide-react';

export default function FacebookPublishScheduleBar({
  editingPostId,
  savingPost,
  postText,
  scheduledAtInput,
  setScheduledAtInput,
  isFacebookAvailable = false,
  onSaveOrUpdatePost,
  onOpenPreview,
  onOpenGuide
}) {
  return (
    <div className="rounded-card bg-surface border border-line p-5 sm:p-6 space-y-5 shadow-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <h4 className="text-base font-black text-ink flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs flex items-center justify-center font-black">
            4
          </span>
          <Share2 className="w-5 h-5 text-blue-600" />
          <span>حفظ البوست، معاينته كما في فيسبوك، النشر المباشر، أو الجدولة</span>
        </h4>

        <button
          type="button"
          onClick={onOpenPreview}
          className="px-4 py-2 rounded-btn bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border border-[#1877F2]/30 text-xs font-black flex items-center gap-1.5"
        >
          <Eye className="w-4 h-4" />
          <span>استعراض البوست كما سيظهر في فيسبوك بالضبط</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Save / Update Post Buttons */}
        <div className="lg:col-span-4 space-y-2">
          <button
            type="button"
            disabled={savingPost || !postText.trim()}
            onClick={() =>
              onSaveOrUpdatePost({ publishNow: false, scheduleMode: false, forceNew: false })
            }
            className="w-full py-3.5 px-5 rounded-btn bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {savingPost
                ? 'جاري الحفظ...'
                : editingPostId
                ? 'حفظ التعديلات على البوست الحالي ✏️'
                : 'إضافة وحفظ البوست في القائمة بالأسفل'}
            </span>
          </button>

          {editingPostId && (
            <button
              type="button"
              disabled={savingPost || !postText.trim()}
              onClick={() =>
                onSaveOrUpdatePost({ publishNow: false, scheduleMode: false, forceNew: true })
              }
              className="w-full py-2.5 px-4 rounded-btn bg-paper hover:bg-surface border border-line text-ink font-black text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>حفظ كنسخة بوست جديد في القائمة</span>
            </button>
          )}

          <p className="text-[11px] text-ink-soft text-center">
            يُحفظ البوست بكامل منتجاته وصوره في القائمة بالأسفل لتتمكن من استرجاعه أو تعديله أو نشره في أي وقت.
          </p>
        </div>

        {/* Direct Publish & Schedule Controls */}
        <div className="lg:col-span-8">
          {isFacebookAvailable ? (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-blue-600">
                  نشر مباشر الآن على صفحة الفيسبوك:
                </label>
                <button
                  type="button"
                  disabled={savingPost || !postText.trim()}
                  onClick={() =>
                    onSaveOrUpdatePost({ publishNow: true, scheduleMode: false })
                  }
                  className="w-full py-2.5 px-4 rounded-btn bg-[#1877F2] hover:bg-[#1877F2]/90 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{savingPost ? 'جاري النشر على فيسبوك...' : 'نشر فوري الآن على صفحة الفيسبوك'}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-ink">
                  أو جدولة النشر التلقائي في موعد محدد:
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={scheduledAtInput}
                    onChange={(e) => setScheduledAtInput(e.target.value)}
                    className="flex-1 bg-surface border border-line rounded-btn px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={savingPost || !postText.trim() || !scheduledAtInput}
                    onClick={() =>
                      onSaveOrUpdatePost({ publishNow: false, scheduleMode: true })
                    }
                    className="px-4 py-2 rounded-btn bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>جدولة</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-black text-orange-700 flex items-center gap-1.5">
                  <span>⚠️ ربط صفحة الفيسبوك (Facebook Page API) غير مهيأ بعد</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenGuide}
                  className="px-3.5 py-1.5 rounded-btn bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>دليل تفعيل ونشر فيسبوك</span>
                </button>
              </div>

              <p className="text-[11px] text-ink-soft leading-relaxed">
                لتفعيل النشر المباشر وجدولة المنشورات التلقائية على صفحة متجرك في فيسبوك، يرجى إدخال بيانات <strong>Meta Facebook Integration (Page ID & Page Access Token)</strong> في تبويب الإعدادات باتباع الدليل التفصيلي خطوة بخطوة.
              </p>

              <div className="flex flex-wrap items-center gap-2 opacity-50 pointer-events-none select-none">
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 rounded-btn bg-slate-400 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> نشر فوري على فيسبوك (معطل)
                </button>
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 rounded-btn bg-slate-400 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" /> جدولة النشر التلقائي (معطل)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
