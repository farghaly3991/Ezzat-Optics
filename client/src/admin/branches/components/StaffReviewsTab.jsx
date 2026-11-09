import React, { useState, useEffect } from 'react';
import {
  Star,
  User,
  Calendar,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Copy,
  Link as LinkIcon
} from 'lucide-react';
import axios from 'axios';

export default function StaffReviewsTab({
  branchId,
  branchName,
  staffList = [],
  token,
  showToast
}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('all');

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const loadReviews = async () => {
    try {
      setLoading(true);
      const url = selectedStaffId === 'all'
        ? `/api/admin/branches/${branchId}/reviews`
        : `/api/admin/branches/${branchId}/reviews?staffId=${selectedStaffId}`;

      const res = await axios.get(url, authHeader);
      setReviews(res.data?.reviews || []);
    } catch (err) {
      // If no dedicated endpoint, graceful fallback
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      loadReviews();
    }
  }, [branchId, selectedStaffId]);

  const handleCopyLink = async (staffMember) => {
    try {
      const res = await axios.post(
        `/api/admin/branches/${branchId}/staff/${staffMember._id}/review-token`,
        { role: staffMember.role === 2 ? 'technician' : 'courier' },
        authHeader
      );
      const url = `${window.location.origin}/review/staff/${res.data.reviewToken}`;
      await navigator.clipboard.writeText(url);
      showToast(`تم نسخ رابط التقييم للموظف «${staffMember.fullname}»! أرسله للعميل الآن عبر واتساب.`);
    } catch (err) {
      showToast('تعذر توليد رابط التقييم', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Action Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-paper border border-line text-ink font-bold"
          >
            <option value="all">كافة تقييمات الفنيين والمناديب</option>
            {staffList.map((s) => (
              <option key={s._id} value={s._id}>
                {s.fullname} ({s.jobTitle || 'عضو طاقم'})
              </option>
            ))}
          </select>

          <button
            onClick={loadReviews}
            title="تحديث التقييمات"
            className="p-2 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Generate quick review link */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-soft font-bold">توليد رابط تقييم سريع:</span>
          <select
            onChange={(e) => {
              const staff = staffList.find((s) => s._id === e.target.value);
              if (staff) handleCopyLink(staff);
              e.target.value = '';
            }}
            defaultValue=""
            className="px-3 py-2 text-xs rounded-xl bg-primary text-white font-black cursor-pointer shadow-md"
          >
            <option value="" disabled>اختر موظفاً لنسخ رابطه...</option>
            {staffList.map((s) => (
              <option key={s._id} value={s._id} className="text-ink bg-surface">
                {s.fullname} ({s.jobTitle || 'موظف'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reviews Cards */}
      {loading ? (
        <div className="text-center py-16 text-ink-soft text-sm">جاري جلب تقييمات العملاء...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface border border-line text-ink-soft space-y-2">
          <Star className="w-12 h-12 mx-auto text-amber-500/30" />
          <p className="font-bold">لا توجد تقييمات عملاء مسجلة بعد</p>
          <p className="text-xs">انسخ رابط التقييم وأرسله للعميل بعد تسليم الأوردر أو إتمام الصيانة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <div
              key={r._id}
              className="p-4 rounded-2xl bg-surface border border-line space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-ink">{r.customerName || 'عميل المتجر'}</h4>
                  <span className="text-[10px] text-ink-soft">{r.customerPhone || 'تقييم موثق'}</span>
                </div>
                <div className="flex items-center text-amber-500 font-black text-sm">
                  ★ {r.rating} / 5
                </div>
              </div>

              {r.comment && (
                <p className="text-xs text-ink-soft italic bg-paper p-2.5 rounded-xl border border-line">
                  «{r.comment}»
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-soft font-bold pt-2 border-t border-line">
                <div>الالتزام بالميعاد: <span className="text-ink">{r.punctualityRating || 5}/5</span></div>
                <div>الاحترافية والتعامل: <span className="text-ink">{r.professionalismRating || 5}/5</span></div>
              </div>

              <div className="text-[9px] text-ink-soft flex justify-between">
                <span>الموظف: {r.staffId?.fullname || 'فني / مندوب'}</span>
                <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
