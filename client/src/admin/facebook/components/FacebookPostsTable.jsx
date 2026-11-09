import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  ExternalLink,
  Eye,
  Edit3,
  Send,
  Copy,
  Trash2,
  X
} from 'lucide-react';

export default function FacebookPostsTable({
  savedPosts = [],
  loadingPosts = false,
  postsStatusFilter,
  setPostsStatusFilter,
  editingPostId,
  onLoadPostIntoStudio,
  onPreviewPost,
  onPublishExistingPost,
  onConfirmScheduleExistingPost,
  onDeleteSavedPost,
  publishingPostId,
  isFacebookAvailable = false,
  showToast,
  currency = 'ج.م'
}) {
  const [schedulingModalPost, setSchedulingModalPost] = useState(null);
  const [modalScheduleDate, setModalScheduleDate] = useState('');

  const handleOpenScheduleModal = (post) => {
    setSchedulingModalPost(post);
    setModalScheduleDate(
      post.scheduledAt
        ? new Date(post.scheduledAt).toISOString().slice(0, 16)
        : ''
    );
  };

  const handleConfirmSchedule = () => {
    if (!schedulingModalPost || !modalScheduleDate) return;
    onConfirmScheduleExistingPost(schedulingModalPost._id, modalScheduleDate);
    setSchedulingModalPost(null);
  };

  return (
    <>
      <div className="rounded-card bg-surface border border-line p-5 sm:p-6 space-y-5 shadow-sm text-ink">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <h4 className="text-base font-black text-ink flex items-center gap-2">
              <span>📋 قائمة البوستات المضافة والمجدولة والمنشورة ({savedPosts.length})</span>
            </h4>
            <p className="text-xs text-ink-soft mt-0.5">
              اضغط على أي بوست لاسترجاع بياناته وتعديله في الاستوديو بالأعلى، أو اضغط &quot;معاينة فيسبوك&quot; لاستعراض شبكة الصور وتقليبها كما تظهر في فيسبوك بالضبط
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'draft', label: 'مسودات محفوظة' },
              { id: 'scheduled', label: 'مجدولة للنشر ⏰' },
              { id: 'published', label: 'تم نشرها ✅' },
              { id: 'failed', label: 'فشل النشر ⚠️' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setPostsStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-btn text-xs font-black transition-all ${
                  postsStatusFilter === st.id
                    ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-xs'
                    : 'bg-paper border border-line text-ink-soft hover:text-ink'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {loadingPosts ? (
          <div className="p-8 text-center text-xs text-ink-soft">جاري تحميل المنشورات...</div>
        ) : savedPosts.length === 0 ? (
          <div className="p-10 text-center space-y-2 bg-paper/40 rounded-2xl border border-line">
            <p className="text-sm font-black text-ink">لا توجد منشورات محفوظة في هذا التصنيف بعد</p>
            <p className="text-xs text-ink-soft">
              اختر منتجاتك بالأعلى وولّد أول بوست دعائي ليظهر هنا تلقائياً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedPosts.map((post) => {
              const isBeingEdited = editingPostId === post._id;
              const postImgs = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
              const extraPhotosCount = postImgs.length > 4 ? postImgs.length - 4 : 0;

              const statusBadge = {
                draft: {
                  label: 'مسودة جاهزة',
                  cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                },
                scheduled: {
                  label: 'مجدول للنشر التلقائي ⏰',
                  cls: 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                },
                publishing: {
                  label: 'جاري النشر...',
                  cls: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                },
                published: {
                  label: 'تم النشر على فيسبوك ✅',
                  cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                },
                failed: {
                  label: 'تعذر النشر ⚠️',
                  cls: 'bg-red-500/10 text-red-500 border-red-500/30'
                }
              }[post.status || 'draft'];

              return (
                <div
                  key={post._id}
                  onClick={() => onLoadPostIntoStudio(post)}
                  className={`cursor-pointer rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                    isBeingEdited
                      ? 'border-orange-500 bg-orange-500/5 ring-2 ring-amber-500/40 shadow-md'
                      : 'border-line bg-paper/70 hover:border-primary/50 hover:bg-surface'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${statusBadge?.cls}`}
                        >
                          {statusBadge?.label}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-surface border border-line text-ink-soft">
                          {postImgs.length <= 1
                            ? '🖼️ صورة واحدة'
                            : `🗂️ ${postImgs.length} صور في البوست`}
                        </span>
                        {isBeingEdited && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-white">
                            قيد التعديل بالأعلى ✏️
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-ink-soft font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {new Date(post.createdAt).toLocaleString('ar-EG', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Scheduled or Published Info */}
                    {post.scheduledAt && post.status === 'scheduled' && (
                      <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-700 text-xs font-black flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>
                          موعد النشر المجدول: {new Date(post.scheduledAt).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    )}

                    {post.status === 'published' && post.fbPostUrl && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 text-xs font-black flex items-center justify-between"
                      >
                        <span>تم النشر بنجاح على صفحة الفيسبوك</span>
                        <a
                          href={post.fbPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline flex items-center gap-1"
                        >
                          <span>عرض البوست على فيسبوك</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {post.lastError && post.status === 'failed' && (
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-600 text-[11px] font-bold">
                        سبب الخطأ: {post.lastError}
                      </div>
                    )}

                    {/* Mini Facebook Photo Grid Thumbnail + Post Text Preview */}
                    <div className="flex gap-3">
                      {postImgs.length > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreviewPost(post);
                          }}
                          className="w-32 h-32 rounded-xl overflow-hidden border border-line shrink-0 bg-slate-950 relative group"
                          title="اضغط لمعاينة البوست وتقليب الصور كما في فيسبوك"
                        >
                          {postImgs.length === 1 ? (
                            <img
                              src={postImgs[0]}
                              alt="Post visual"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full bg-white">
                              {postImgs.slice(0, 4).map((u, idx) => (
                                <div key={idx} className="relative w-full h-full overflow-hidden bg-slate-900">
                                  <img src={u} alt="" className="w-full h-full object-cover" />
                                  {idx === 3 && extraPhotosCount > 0 && (
                                    <div className="absolute inset-0 bg-black/70 text-white font-black text-xs flex items-center justify-center">
                                      +{extraPhotosCount}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black">
                            👁️ معاينة فيسبوك
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        {post.headline && (
                          <div className="text-xs font-black text-primary truncate">
                            {post.headline}
                          </div>
                        )}
                        <p className="text-xs text-ink font-bold whitespace-pre-line line-clamp-4 leading-relaxed">
                          {post.postText}
                        </p>
                      </div>
                    </div>

                    {/* Products Snapshot Chips */}
                    {post.productsSnapshot?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {post.productsSnapshot.map((p, idx) => (
                          <span
                            key={p._id || idx}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-surface border border-line text-ink-soft"
                          >
                            📦 {p.name} ({p.price} {currency})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPreviewPost(post)}
                        className="px-3 py-1.5 rounded-btn bg-[#1877F2]/10 hover:bg-[#1877F2] hover:text-white text-[#1877F2] border border-[#1877F2]/30 text-xs font-black flex items-center gap-1 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة فيسبوك</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onLoadPostIntoStudio(post)}
                        className="px-3 py-1.5 rounded-btn bg-primary/10 hover:bg-primary hover:text-[var(--color-primary-contrast,#ffffff)] text-primary border border-primary/25 text-xs font-black flex items-center gap-1 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل في الاستوديو</span>
                      </button>

                      {isFacebookAvailable && post.status !== 'published' && (
                        <>
                          <button
                            type="button"
                            disabled={publishingPostId === post._id}
                            onClick={() => onPublishExistingPost(post._id)}
                            className="px-3 py-1.5 rounded-btn bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1 shadow-xs disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {publishingPostId === post._id ? 'جاري النشر...' : 'نشر الآن'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenScheduleModal(post)}
                            className="px-2.5 py-1.5 rounded-btn bg-orange-500/15 hover:bg-orange-500/25 text-orange-600 border border-orange-500/30 text-xs font-black flex items-center gap-1"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>جدولة</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(post.postText || '');
                          showToast?.('تم نسخ نص المنشور');
                        }}
                        className="p-1.5 rounded-lg bg-surface border border-line text-ink-soft hover:text-ink"
                        title="نسخ النص"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteSavedPost(post._id)}
                        className="p-1.5 rounded-lg bg-surface border border-line text-red-500 hover:bg-red-500/10"
                        title="حذف المنشور"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Existing Post Modal */}
      {schedulingModalPost && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface text-ink rounded-2xl border border-line p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h4 className="text-sm font-black text-ink flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>جدولة موعد نشر البوست على فيسبوك</span>
              </h4>
              <button
                type="button"
                onClick={() => setSchedulingModalPost(null)}
                className="text-ink-soft hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink-soft">
                اختر التاريخ والوقت للنشر التلقائي:
              </label>
              <input
                type="datetime-local"
                value={modalScheduleDate}
                onChange={(e) => setModalScheduleDate(e.target.value)}
                className="w-full bg-paper border border-line rounded-btn px-3 py-2.5 text-xs font-bold text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSchedulingModalPost(null)}
                className="px-4 py-2 rounded-btn bg-paper border border-line text-xs font-bold text-ink"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSchedule}
                className="px-5 py-2 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] text-xs font-black shadow-md"
              >
                تأكيد الجدولة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
