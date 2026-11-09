import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, CheckCircle2, ShieldCheck, Heart, MessageSquare, Send } from 'lucide-react';
import axios from 'axios';

export default function StaffPublicReviewPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [rating, setRating] = useState(5);
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [professionalismRating, setProfessionalismRating] = useState(5);
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      await axios.post(`/api/public/staff-reviews/${token}`, {
        rating,
        punctualityRating,
        professionalismRating,
        comment,
        customerName
      });
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'عذراً، تعذر إرسال التقييم أو ربما انتهت صلاحية الرابط.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (currentVal, setter) => {
    return (
      <div className="flex items-center gap-1.5 justify-center py-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => setter(star)}
            className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none"
          >
            <Star
              className={`w-7 h-7 ${
                star <= currentVal
                  ? 'text-amber-500 fill-amber-500 drop-shadow'
                  : 'text-slate-300 dark:text-slate-600'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-8 text-center space-y-4 shadow-xl animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-ink">شكراً جزيلاً لتقييمك!</h2>
          <p className="text-xs text-ink-soft leading-relaxed">
            رأيك يهمنا ويساعدنا على مكافأة موظفينا المتميزين والارتقاء الدائم بمستوى الخدمة والتوصيل.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-2xl bg-primary text-white font-black text-xs shadow-md hover:bg-primary/90 transition-all"
          >
            العودة لمتجرنا
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center font-black">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-black text-ink">تقييم تجربة الخدمة والتوصيل</h2>
          <p className="text-xs text-ink-soft">
            يسعدنا معرفة تقييمك لمندوب التوصيل أو فني الصيانة لتطوير خدماتنا باستمرار
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs font-bold">
          
          {/* Overall Rating */}
          <div className="p-4 rounded-2xl bg-paper border border-line text-center space-y-1">
            <label className="block text-ink font-black text-sm">التقييم العام للخدمة</label>
            <p className="text-[11px] text-ink-soft">كيف كانت تجربتك الإجمالية مع الموظف؟</p>
            {renderStars(rating, setRating)}
          </div>

          {/* Punctuality Rating */}
          <div className="p-3.5 rounded-2xl bg-paper border border-line text-center space-y-1">
            <label className="block text-ink font-bold">الالتزام بالميعاد وسرعة الوصول</label>
            {renderStars(punctualityRating, setPunctualityRating)}
          </div>

          {/* Professionalism Rating */}
          <div className="p-3.5 rounded-2xl bg-paper border border-line text-center space-y-1">
            <label className="block text-ink font-bold">اللباقة والاحترافية وحسن التعامل</label>
            {renderStars(professionalismRating, setProfessionalismRating)}
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-ink-soft mb-1">اسمك الكريم (اختياري)</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="مثال: أحمد مصطفى"
              className="w-full bg-paper border border-line rounded-btn p-3 text-ink"
            />
          </div>

          {/* Feedback comments */}
          <div>
            <label className="block text-ink-soft mb-1">ملاحظات أو تعليق إضافي للمتجر</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="اكتب أي ملاحظة أو رسالة شكر أو تنبيه هنا..."
              className="w-full bg-paper border border-line rounded-btn p-3 text-ink resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-xs shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'جاري إرسال التقييم...' : 'إرسال التقييم الآن'}</span>
          </button>

        </form>

      </div>
    </div>
  );
}
