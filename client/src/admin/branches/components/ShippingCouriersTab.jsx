import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Edit,
  Trash2,
  Phone,
  DollarSign,
  User,
  Star,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  Copy,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

export default function ShippingCouriersTab({
  branchId,
  branchName,
  staffList = [],
  token,
  showToast,
  onOpenAddCourier,
  onOpenEditCourier
}) {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(false);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const loadCouriers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/finance/shipping/couriers', authHeader);
      setCouriers(res.data?.couriers || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل جهات الشحن', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCouriers();
  }, []);

  const handleCopyReviewLink = async (courier) => {
    try {
      const targetStaffId = courier.staffUserId?._id || courier.staffUserId || courier._id;
      const targetBranch = branchId || courier.branchId || 'main';

      const res = await axios.post(
        `/api/admin/branches/${targetBranch}/staff/${targetStaffId}/review-token`,
        { role: 'courier' },
        authHeader
      );

      const reviewUrl = `${window.location.origin}/review/staff/${res.data.reviewToken}`;
      await navigator.clipboard.writeText(reviewUrl);
      showToast('تم نسخ رابط تقييم المندوب! يمكنك إرساله للعميل عبر الواتساب بنقرة واحدة');
    } catch (err) {
      showToast('تعذر توليد رابط التقييم', 'error');
    }
  };

  const typeLabels = {
    internal_staff: 'موظف دائم بالمتجر (راتب شهري)',
    external_carrier: 'شركة شحن خارجية (أرامكس/بوسطة)',
    freelancer: 'مندوب حر (بالأوردر)'
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner explaining marginal cost */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-500/25 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-black text-ink">دليل مناديب الشحن والتكاليف الحقيقية على المتجر</h4>
          </div>
          <p className="text-xs text-ink-soft">
            ★ في حال شحن الطلب بواسطة <span className="font-black text-emerald-700 dark:text-emerald-300">موظف دائم بالمتجر</span>، تكون التكلفة الإضافية الواقعة على المتجر = <span className="font-black text-emerald-700 dark:text-emerald-300">0 ج.م</span> لأن راتبه محسوب في مصاريف التشغيل (OPEX). بينما شركات الشحن والمناديب المستقلين يتم تسجيل التكلفة الفعلية للأوردر بدقة لحساب صافي الربح الحقيقي.
          </p>
        </div>

        <button
          onClick={onOpenAddCourier}
          className="px-4 py-2.5 rounded-xl bg-primary text-white font-black text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مندوب / شركة شحن</span>
        </button>
      </div>

      {/* Couriers Grid */}
      {loading ? (
        <div className="text-center py-16 text-ink-soft text-sm">جاري تحميل دليل الشحن...</div>
      ) : couriers.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface border border-line text-ink-soft space-y-2">
          <Truck className="w-12 h-12 mx-auto text-ink-soft/40" />
          <p className="font-bold">لم يتم تسجيل أي مناديب أو جهات شحن بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {couriers.map((c) => {
            const isInternal = c.type === 'internal_staff';

            return (
              <div
                key={c._id}
                className="rounded-3xl bg-surface border border-line p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg ${
                          isInternal
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25'
                        }`}
                      >
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-ink text-sm flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.companyName && (
                            <span className="text-[10px] text-ink-soft">({c.companyName})</span>
                          )}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isInternal
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {typeLabels[c.type] || c.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Phone & Status */}
                  <div className="text-[11px] text-ink-soft font-bold space-y-1">
                    <div>الهاتف: {c.phone || 'غير مسجل'}</div>
                    {c.notes && <div className="text-[10px] text-ink-soft">ملاحظة: {c.notes}</div>}
                  </div>

                  {/* Financial Cost Card */}
                  <div className="p-3 rounded-2xl bg-paper border border-line flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-ink-soft block font-bold">التكلفة الفعلية على المتجر:</span>
                      <span
                        className={`text-base font-black ${
                          isInternal ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink'
                        }`}
                      >
                        {isInternal ? '0 ج.م (راتب شهري)' : `${c.defaultCost} ج.م / أوردر`}
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-ink-soft block font-bold">الطلبات المسندة:</span>
                      <span className="text-xs font-black text-ink">{c.activeOrdersCount || 0} طلب</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleCopyReviewLink(c)}
                    title="نسخ رابط تقييم العميل للمندوب"
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black transition-colors flex items-center gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>رابط التقييم للعميل</span>
                  </button>

                  <button
                    onClick={() => onOpenEditCourier(c)}
                    className="p-2 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
