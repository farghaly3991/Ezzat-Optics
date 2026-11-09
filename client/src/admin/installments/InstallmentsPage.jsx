import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Plus,
  Eye,
  User,
  Phone,
  Building2,
  DollarSign,
  TrendingUp,
  Boxes,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../shared/context/StoreContext';
import InstallmentDetailsModal from './components/InstallmentDetailsModal';

export default function InstallmentsPage() {
  const navigate = useNavigate();
  const { token, config, showToast, user } = useStore();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    kpis: {},
    orders: [],
    pagination: { page: 1, limit: 25, total: 0, pages: 1 }
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [branches, setBranches] = useState([]);

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };
  const currency = config?.currency || 'ج.م';

  // Load branches list for filter
  useEffect(() => {
    if (!token) return;
    axios
      .get('/api/admin/branches', authHeader)
      .then((res) => {
        const list = res.data?.branches || res.data || [];
        setBranches(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.warn('Failed to load branches:', err));
  }, [token]);

  const loadInstallments = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/installments', {
        ...authHeader,
        params: {
          page,
          search: search.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          branchId: branchFilter !== 'all' ? branchFilter : undefined
        }
      });
      if (res.data?.done) {
        setData({
          kpis: res.data.kpis || {},
          orders: res.data.orders || [],
          pagination: res.data.pagination || { page: 1, limit: 25, total: 0, pages: 1 }
        });
      }
    } catch (err) {
      console.error('Failed to load installments:', err);
      if (showToast) showToast('فشل جلب بيانات الأقساط', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadInstallments(1);
    }
  }, [token, statusFilter, branchFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadInstallments(1);
  };

  const handleOpenOrder = (ord) => {
    setSelectedOrder(ord);
    setShowModal(true);
  };

  const handlePaymentSuccess = (updatedOrder) => {
    loadInstallments(data.pagination.page);
    setSelectedOrder(updatedOrder);
  };

  const kpis = data.kpis || {};

  return (
    <div className="space-y-6 animate-in fade-in pb-12 text-ink">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-950 border border-amber-500/30 flex items-center justify-center font-black text-xl shadow-xs">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-ink">
              إدارة عمليات التقسيط المباشر مع المحل (In-Store Direct Installments)
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              متابعة عقود التقسيط، جدول التحصيل الشهري، مديونيات العملاء، وسداد الأقساط
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadInstallments(data.pagination.page)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="تحديث البيانات"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>

          <button
            onClick={() => navigate('/admin/finance/installments')}
            className="px-3.5 py-2.5 rounded-xl bg-paper border border-line hover:border-primary text-ink text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <DollarSign className="w-4 h-4 text-emerald-800" />
            <span>الحسابات والمستحقات</span>
          </button>

          <button
            onClick={() => navigate('/admin/pos')}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-black flex items-center gap-2 shadow-sm hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إصدار فاتورة تقسيط بنقطة البيع (POS)</span>
          </button>
        </div>
      </div>

      {/* Top 5 Core KPIs (User Requested Specifics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. إجمالي المبالغ المطلوبة */}
        <div className="p-4 rounded-2xl bg-paper border border-line text-center space-y-1">
          <span className="text-[11px] text-ink-soft font-bold block">إجمالي المبالغ المطلوبة</span>
          <div className="text-lg sm:text-xl font-black text-ink">
            {Number(kpis.totalAmountRequired || 0).toLocaleString()} <span className="text-xs font-bold text-ink-soft">{currency}</span>
          </div>
          <span className="text-[10px] text-ink-soft block font-bold">إجمالي محفظة التقسيط الكلية</span>
        </div>

        {/* 2. المبالغ المحصلة فعلياً */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
          <span className="text-[11px] text-emerald-950 font-black block">المبالغ التي تم تحصيلها</span>
          <div className="text-lg sm:text-xl font-black text-emerald-950">
            {Number(kpis.totalAmountCollected || 0).toLocaleString()} <span className="text-xs font-bold text-emerald-900">{currency}</span>
          </div>
          <span className="text-[10px] text-emerald-900 block font-bold">
            دخلت الخزينة (مقدمات وأقساط)
          </span>
        </div>

        {/* 3. المبالغ الباقية (مستحقات للمحل) */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
          <span className="text-[11px] text-amber-950 font-black block">المبالغ المتبقية للتحصيل</span>
          <div className="text-lg sm:text-xl font-black text-amber-950">
            {Number(kpis.totalAmountRemaining || 0).toLocaleString()} <span className="text-xs font-bold text-amber-900">{currency}</span>
          </div>
          <span className="text-[10px] text-amber-900 block font-bold">
            مستحقات في ذمة العملاء (ليك)
          </span>
        </div>

        {/* 4. الحد الأقصى لعدد الشهور المتبقية */}
        <div className="p-4 rounded-2xl bg-paper border border-line text-center space-y-1">
          <span className="text-[11px] text-ink-soft font-bold block">أقصى مدة شهور متبقية</span>
          <div className="text-lg sm:text-xl font-black text-primary">
            {kpis.maxRemainingMonths || 0} <span className="text-xs font-bold text-ink-soft">شهور</span>
          </div>
          <span className="text-[10px] text-ink-soft block font-bold">لجميع الأوردرات الجارية</span>
        </div>

        {/* 5. إجمالي المنتجات والعقود */}
        <div className="p-4 rounded-2xl bg-paper border border-line text-center space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-ink-soft font-bold block">المنتجات والعقود المقسطة</span>
          <div className="text-lg sm:text-xl font-black text-ink">
            {kpis.totalProductsCount || 0} <span className="text-xs font-bold text-ink-soft">قطعة</span>
          </div>
          <span className="text-[10px] text-ink-soft block font-bold">
            في {kpis.totalOrders || 0} عقداً ({kpis.activeOrders || 0} ساري / {kpis.completedOrders || 0} مكتمل)
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث برقم الطلب، اسم العميل، الهاتف، أو الرقم القومي..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-paper border border-line text-xs font-medium text-ink outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-paper border border-line hover:border-primary text-xs font-bold text-ink transition-colors"
          >
            بحث
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch filter if Super Admin */}
          {user?.role === 5 && branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="p-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
            >
              <option value="all">كافة الفروع</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">عقود جارية (قيد السداد)</option>
            <option value="completed">عقود مكتملة (مسددة بالكامل)</option>
            <option value="defaulted">عقود متعثرة</option>
          </select>
        </div>
      </div>

      {/* Installments Table */}
      <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-20 text-ink-soft text-sm">جاري جلب عقود الأقساط والتحصيلات...</div>
        ) : data.orders.length === 0 ? (
          <div className="text-center py-20 text-ink-soft space-y-3">
            <CalendarClock className="w-12 h-12 mx-auto text-ink-soft/40" />
            <p className="font-bold text-sm">لا توجد عمليات تقسيط مطابقة للفلاتر المحددة</p>
            <p className="text-xs">
              يمكنك إنشاء فاتورة تقسيط مباشر جديدة عبر نقطة البيع (POS) باختيار طريقة السداد "تقسيط مباشر"
            </p>
            <button
              onClick={() => navigate('/admin/pos')}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إصدار فاتورة تقسيط الآن</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-bold border-b border-line text-[11px]">
                <tr>
                  <th className="p-3.5">رقم الطلب / التاريخ</th>
                  <th className="p-3.5">العميل والفرع</th>
                  <th className="p-3.5">المنتجات المقسطة</th>
                  <th className="p-3.5">خطة التقسيط</th>
                  <th className="p-3.5">نسبة ومبلغ السداد</th>
                  <th className="p-3.5">القسط القادم</th>
                  <th className="p-3.5">حالة العقد</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.orders.map((ord) => {
                  const inst = ord.installment || {};
                  const plan = inst.plan || {};
                  const sum = inst.summary || {};
                  const isCompleted = sum.status === 'completed';
                  const percentPaid =
                    sum.totalRequired > 0
                      ? Math.min(100, Math.round((Number(sum.totalPaid || 0) / Number(sum.totalRequired)) * 100))
                      : 100;

                  return (
                    <tr key={ord._id} className="hover:bg-paper/50 transition-colors">
                      {/* Order ID & Date */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-ink">{ord.orderId}</div>
                        <div className="text-[10px] text-ink-soft mt-0.5">
                          {new Date(ord.createdAt).toLocaleDateString('ar-EG', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </td>

                      {/* Customer & Branch */}
                      <td className="p-3.5">
                        <div className="font-bold text-ink">{ord.customer?.name}</div>
                        <div className="text-[10px] text-ink-soft font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          <span>{ord.customer?.phone}</span>
                        </div>
                        <div className="text-[10px] text-ink-soft">
                          {ord.branchId?.name || 'الفرع الرئيسي'}
                        </div>
                      </td>

                      {/* Products */}
                      <td className="p-3.5">
                        <div className="max-w-[180px] truncate text-ink font-bold">
                          {ord.items && ord.items.length > 0
                            ? ord.items.map((it) => it.name).join('، ')
                            : 'منتجات المتجر'}
                        </div>
                        <div className="text-[10px] text-ink-soft">
                          {ord.items?.length || 0} صنف (
                          {ord.items?.reduce((a, b) => a + (Number(b.quantity) || 1), 0) || 0} قطعة)
                        </div>
                      </td>

                      {/* Installment Plan Details */}
                      <td className="p-3.5">
                        <div className="font-black text-primary">
                          {plan.months || 0} شهور × {Number(plan.monthlyAmount || 0).toLocaleString()} {currency}
                        </div>
                        <div className="text-[10px] text-ink-soft font-bold mt-0.5">
                          فائدة: {plan.interestRate || 0}% | مقدم: {Number(plan.downPayment || 0).toLocaleString()} {currency}
                        </div>
                      </td>

                      {/* Payment Progress */}
                      <td className="p-3.5 min-w-[150px]">
                        <div className="flex items-center justify-between text-[10px] font-black text-ink mb-1">
                          <span className="text-emerald-950 font-bold">
                            مدفوع: {Number(sum.totalPaid || 0).toLocaleString()} {currency}
                          </span>
                          <span className="text-amber-950 font-bold">
                            باقي: {Number(sum.totalRemaining || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCompleted ? 'bg-emerald-600' : 'bg-primary'
                            }`}
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-ink-soft text-left font-mono mt-0.5 font-bold">
                          {percentPaid}% ({sum.paidInstallmentsCount || 0}/{plan.months || 0} قسط)
                        </div>
                      </td>

                      {/* Next Due Date */}
                      <td className="p-3.5">
                        {isCompleted ? (
                          <span className="text-[10px] text-emerald-950 font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                            <span>مسدد بالكامل</span>
                          </span>
                        ) : sum.nextDueDate ? (
                          <div>
                            <div className="font-black text-ink">
                              {new Date(sum.nextDueDate).toLocaleDateString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-[10px] font-bold text-primary">
                              مستحق: {Number(plan.monthlyAmount || 0).toLocaleString()} {currency}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-ink-soft">--</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-950 border border-emerald-500/40'
                              : sum.status === 'defaulted'
                              ? 'bg-rose-500/20 text-rose-950 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-950 border border-amber-500/40'
                          }`}
                        >
                          {isCompleted
                            ? 'مسدد بالكامل'
                            : sum.status === 'defaulted'
                            ? 'متعثر'
                            : 'ساري التحصيل'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenOrder(ord)}
                            className="px-2.5 py-1.5 rounded-xl bg-paper hover:bg-surface border border-line text-xs font-bold text-ink hover:text-primary transition-all flex items-center gap-1 shadow-xs"
                            title="عرض العقد وسجل الأقساط"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isCompleted ? 'عرض الملف' : 'تحصيل وسداد'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.pagination?.pages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between text-xs font-bold text-ink-soft bg-paper">
            <span>
              إجمالي: {data.pagination.total} عقد (صفحة {data.pagination.page} من {data.pagination.pages})
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={data.pagination.page <= 1}
                onClick={() => loadInstallments(data.pagination.page - 1)}
                className="p-1.5 rounded-lg border border-line bg-surface disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={data.pagination.page >= data.pagination.pages}
                onClick={() => loadInstallments(data.pagination.page + 1)}
                className="p-1.5 rounded-lg border border-line bg-surface disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details & Payment Modal */}
      {showModal && selectedOrder && (
        <InstallmentDetailsModal
          order={selectedOrder}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          token={token}
          currency={currency}
          showToast={showToast}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
