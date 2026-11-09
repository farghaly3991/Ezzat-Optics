import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  User,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  MessageCircle,
  UserCheck,
  Check,
  X,
  Package,
  Calendar,
  DollarSign,
  Building2,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Banknote,
  Send
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AdminBranchSelector from '../shared/AdminBranchSelector';

const statusLabels = {
  requested: { label: 'طلب جديد', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  received_at_branch: { label: 'مستلم بالفرع', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  assigned_to_tech: { label: 'تم تعيين الفني', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  in_maintenance: { label: 'قيد الفحص والإصلاح', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  parts_pending: { label: 'في انتظار قطع غيار', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  repaired: { label: 'تم الإصلاح بنجاح', color: 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/30' },
  delivered_back: { label: 'تم التسليم للعميل', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  unrepairable: { label: 'تعذر الإصلاح', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  rejected: { label: 'مرفوض', color: 'bg-red-500/10 text-red-600 border-red-500/20' }
};

export default function MaintenancePage() {
  const { token, config, showToast, activeBranchId, branches = [] } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const currency = config?.currency || 'ج.م';

  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'warranty' | 'paid' | 'service'

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== undefined) {
      setSearch(q);
    }
  }, [searchParams]);

  // Technician Assignment Modal
  const [selectedReqForAssignTech, setSelectedReqForAssignTech] = useState(null);
  const [branchTechnicians, setBranchTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [isAssigningTech, setIsAssigningTech] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState(null);

  // Financials & Custody Remittance Modal
  const [selectedReqForFinancials, setSelectedReqForFinancials] = useState(null);
  const [financialForm, setFinancialForm] = useState({
    serviceFee: 0,
    partsCost: 0,
    isWarrantyFree: true,
    amountDueFromCustomer: 0,
    collectedAmount: 0,
    paymentStatus: 'free_warranty',
    remittedToAdmin: false,
    remittedNote: ''
  });
  const [isSavingFinancials, setIsSavingFinancials] = useState(false);

  // Status Change Modal / Inline
  const [selectedReqForStatus, setSelectedReqForStatus] = useState(null);
  const [statusUpdateForm, setStatusUpdateForm] = useState({ status: '', note: '' });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadRequests = () => {
    if (!token) return;
    setLoading(true);

    const params = {
      type: 'maintenance',
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search.trim() || undefined,
      limit: 100
    };

    if (activeBranchId && activeBranchId !== 'all') {
      params.branchId = activeBranchId;
    }

    axios
      .get('/api/admin/returns', { ...authHeader, params })
      .then((res) => {
        setRequests(res.data?.requests || []);
      })
      .catch((err) => {
        showToast('فشل جلب طلبات وخدمات الصيانة', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, [token, activeBranchId, statusFilter, search]);

  // Open Assign Tech Modal with live technician workload
  const handleOpenAssignTechModal = async (req) => {
    setSelectedReqForAssignTech(req);
    setAssignmentResult(null);
    setSelectedTechId(req.assignedTechId?._id || req.assignedTechId || '');
    setAssignNote(req.techNotes || '');
    setLoadingTechs(true);

    try {
      const branchId = req.branchId?._id || req.branchId || (activeBranchId !== 'all' ? activeBranchId : null);
      if (branchId) {
        const res = await axios.get(`/api/admin/branches/${branchId}/technicians`, authHeader);
        setBranchTechnicians(res.data?.technicians || []);
      } else {
        const res = await axios.get('/api/admin/branches', authHeader);
        const allBranches = res.data?.branches || [];
        const techs = [];
        for (const b of allBranches) {
          try {
            const tRes = await axios.get(`/api/admin/branches/${b._id}/technicians`, authHeader);
            techs.push(...(tRes.data?.technicians || []));
          } catch (_) {}
        }
        setBranchTechnicians(techs);
      }
    } catch (err) {
      showToast('فشل جلب فنيي الصيانة', 'error');
    } finally {
      setLoadingTechs(false);
    }
  };

  const handleAssignTechSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTechId) {
      showToast('يرجى اختيار فني صيانة', 'error');
      return;
    }

    setIsAssigningTech(true);
    try {
      const res = await axios.put(
        `/api/admin/returns/${selectedReqForAssignTech._id}/assign-tech`,
        {
          techId: selectedTechId,
          note: assignNote
        },
        authHeader
      );
      showToast(res.data?.message || 'تم توكيل مهمة الصيانة للفني بنجاح!');
      setAssignmentResult(res.data);
      loadRequests();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل توكيل المهمة للفني', 'error');
    } finally {
      setIsAssigningTech(false);
    }
  };

  // Open Financials Modal
  const handleOpenFinancialsModal = (req) => {
    setSelectedReqForFinancials(req);
    const isFree = req.isWarrantyFree !== false && req.warrantyStatus === 'in_warranty';
    setFinancialForm({
      serviceFee: req.serviceFee || 0,
      partsCost: req.partsCost || 0,
      isWarrantyFree: isFree,
      amountDueFromCustomer: req.amountDueFromCustomer || (isFree ? 0 : (req.serviceFee || 0) + (req.partsCost || 0)),
      collectedAmount: req.collectedAmount || 0,
      paymentStatus: req.paymentStatus || (isFree ? 'free_warranty' : 'pending_collection'),
      remittedToAdmin: Boolean(req.remittedToAdmin),
      remittedNote: req.remittedNote || ''
    });
  };

  const handleSaveFinancialsSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReqForFinancials) return;

    setIsSavingFinancials(true);
    try {
      const payload = {
        serviceFee: Number(financialForm.serviceFee) || 0,
        partsCost: Number(financialForm.partsCost) || 0,
        isWarrantyFree: Boolean(financialForm.isWarrantyFree),
        amountDueFromCustomer: Boolean(financialForm.isWarrantyFree) ? 0 : Number(financialForm.amountDueFromCustomer) || 0,
        collectedAmount: Number(financialForm.collectedAmount) || 0,
        paymentStatus: financialForm.paymentStatus,
        remittedToAdmin: Boolean(financialForm.remittedToAdmin),
        remittedNote: financialForm.remittedNote
      };

      await axios.put(`/api/admin/returns/${selectedReqForFinancials._id}/financials`, payload, authHeader);
      showToast('تم حفظ التكاليف وحالة التوريد المالي بنجاح!');
      setSelectedReqForFinancials(null);
      loadRequests();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حفظ البيانات المالية', 'error');
    } finally {
      setIsSavingFinancials(false);
    }
  };

  // Open Status Update Modal
  const handleOpenStatusModal = (req) => {
    setSelectedReqForStatus(req);
    setStatusUpdateForm({ status: req.status || 'in_maintenance', note: '' });
  };

  const handleSaveStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReqForStatus) return;

    setIsUpdatingStatus(true);
    try {
      await axios.put(
        `/api/admin/returns/${selectedReqForStatus._id}/status`,
        statusUpdateForm,
        authHeader
      );
      showToast('تم تحديث حالة الصيانة بنجاح!');
      setSelectedReqForStatus(null);
      loadRequests();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تحديث الحالة', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filtering
  const filteredRequests = requests.filter((r) => {
    if (sourceFilter === 'warranty' && r.warrantyStatus !== 'in_warranty') return false;
    if (sourceFilter === 'paid' && r.warrantyStatus === 'in_warranty') return false;
    if (sourceFilter === 'service' && !r.convertedToOrderId && r.maintenanceSource !== 'direct_service') return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const numMatch = (r.requestNumber || '').toLowerCase().includes(q);
      const nameMatch = (r.customer?.name || '').toLowerCase().includes(q);
      const phoneMatch = (r.customer?.phone || '').includes(q);
      const orderMatch = (r.orderId || '').toLowerCase().includes(q);
      if (!numMatch && !nameMatch && !phoneMatch && !orderMatch) return false;
    }

    return true;
  });

  const totalMaintenance = requests.length;
  const inProgressCount = requests.filter((r) => ['assigned_to_tech', 'in_maintenance', 'parts_pending'].includes(r.status)).length;
  const repairedCount = requests.filter((r) => ['repaired', 'delivered_back'].includes(r.status)).length;
  const pendingRemitAmount = requests
    .filter((r) => r.collectedAmount > 0 && !r.remittedToAdmin)
    .reduce((acc, r) => acc + (r.collectedAmount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-black shadow-lg shadow-amber-500/25">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
              <span>إدارة عمليات الصيانة، الفنيين، والعهد المالية</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5 font-medium">
              متابعة تذاكر صيانة الضمان، الصيانة المدفوعة خارج الضمان، وتكليف الفنيين المتاحين بروابط واتساب مباشرة
            </p>
          </div>
        </div>

        <button
          onClick={loadRequests}
          className="p-2.5 rounded-xl bg-paper hover:bg-surface border border-line text-ink transition-all"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي عمليات الصيانة</span>
          <div className="text-2xl font-black text-ink">{totalMaintenance}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-amber-600">قيد الفحص والإصلاح حالياً</span>
          <div className="text-2xl font-black text-amber-600">{inProgressCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-teal-800 dark:text-teal-300">تم الإصلاح والتسليم</span>
          <div className="text-2xl font-black text-teal-800 dark:text-teal-300">{repairedCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-indigo-600">عهد نقدية مع الفنيين للتوريد</span>
          <div className="text-xl font-black text-indigo-600">
            {pendingRemitAmount.toLocaleString()} {currency}
          </div>
          <span className="text-[10px] text-ink-soft block font-medium">مبالغ محصلة بانتظار التوريد للخزينة</span>
        </div>
      </div>

      {/* Local Branch Selector Filter Bar */}
      <AdminBranchSelector
        label="تصفية الصيانة حسب الفرع:"
        onChange={() => loadRequests()}
      />

      {/* Filters Bar */}
      <div className="p-3.5 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم التذكرة، العميل، الهاتف، أو رقم الطلب..."
              className="w-full pl-3 pr-8 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
            />
            <Search className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
          >
            <option value="all">كل أنواع الصيانة</option>
            <option value="warranty">🛡️ مشمول بالضمان (مجاني)</option>
            <option value="paid">💵 صيانة مدفوعة (خارج الضمان)</option>
            <option value="service">⚡ خدمات وزيارات ميدانية</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="requested">طلب جديد (requested)</option>
            <option value="received_at_branch">مستلم بالفرع</option>
            <option value="assigned_to_tech">تم تعيين الفني</option>
            <option value="in_maintenance">قيد الفحص والإصلاح</option>
            <option value="parts_pending">في انتظار قطع غيار</option>
            <option value="repaired">تم الإصلاح بنجاح</option>
            <option value="delivered_back">تم التسليم للعميل</option>
            <option value="unrepairable">تعذر الإصلاح</option>
          </select>
        </div>

        <button
          onClick={loadRequests}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition-all"
        >
          تطبيق الفلتر
        </button>
      </div>

      {/* Main Maintenance Table */}
      <div className="rounded-3xl bg-surface border border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-ink-soft">جاري تحميل بيانات الصيانة...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Wrench className="w-10 h-10 text-ink-soft mx-auto opacity-40" />
            <h4 className="text-sm font-black text-ink">لا توجد عمليات صيانة مطابقة للفلتر المحدد</h4>
            <p className="text-xs text-ink-soft max-w-sm mx-auto">
              عند إسناد أو تسجيل طلبات صيانة من العملاء أو الفروع ستظهر هنا مباشرة لمعالجتها وتكليف الفنيين.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-black border-b border-line">
                <tr>
                  <th className="p-3.5">رقم التذكرة والفرع</th>
                  <th className="p-3.5">العميل والتواصل</th>
                  <th className="p-3.5">السلعة المعيبة والعطل</th>
                  <th className="p-3.5">نوع التكلفة والضمان</th>
                  <th className="p-3.5">الفني المسؤول والتفرغ</th>
                  <th className="p-3.5">حالة الصيانة</th>
                  <th className="p-3.5 text-center">العهد والحسابات</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRequests.map((req) => {
                  const st = statusLabels[req.status] || {
                    label: req.status,
                    color: 'bg-paper text-ink'
                  };

                  const isWarranty = req.warrantyStatus === 'in_warranty';
                  const branchName = req.branchId?.name || (branches.find((b) => String(b._id) === String(req.branchId))?.name) || 'الفرع الرئيسي';

                  return (
                    <tr key={req._id} className="hover:bg-paper/60 transition-colors">
                      {/* Ticket # and Branch Badge */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-amber-600 text-sm">
                          {req.requestNumber}
                        </div>
                        <span className="text-[10px] text-ink-soft font-mono block">
                          طلب أصلي: #{req.orderId}
                        </span>
                        {/* Always display Branch Badge */}
                        <div className="mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span>{branchName}</span>
                          </span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="p-3.5 font-bold text-ink">
                        <div>{req.customer?.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-ink-soft font-mono" dir="ltr">
                            {req.customer?.phone}
                          </span>
                          {req.customer?.phone && (
                            <a
                              href={`https://wa.me/${req.customer.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 p-0.5"
                              title="محادثة واتساب مع العميل"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {req.customer?.city && (
                          <span className="text-[10px] text-ink-soft block mt-0.5">
                            📍 {req.customer?.city}
                          </span>
                        )}
                      </td>

                      {/* Items & Issue */}
                      <td className="p-3.5">
                        <div className="font-bold text-ink">
                          {req.items?.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span>• {it.name}</span>
                              <span className="text-ink-soft text-[10px]">({it.quantity}×)</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[11px] text-ink-soft mt-1 line-clamp-2" title={req.reason}>
                          💬 {req.reason || 'عطل غير محدد'}
                        </div>
                      </td>

                      {/* Warranty & Cost Type */}
                      <td className="p-3.5">
                        {isWarranty ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>ضمان ساري (مجاني)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 inline-flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            <span>صيانة مدفوعة</span>
                          </span>
                        )}
                        <div className="text-[11px] font-mono font-bold text-ink mt-1">
                          المطلوب: {req.amountDueFromCustomer || 0} {currency}
                        </div>
                      </td>

                      {/* Assigned Tech with Workload indicator */}
                      <td className="p-3.5">
                        {req.assignedTechId ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-ink">
                              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>{req.assignedTechId.fullname || req.assignedTechId.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-ink-soft font-mono" dir="ltr">
                              <span>{req.assignedTechId.phone}</span>
                              {req.assignedTechId.phone && (
                                <a
                                  href={`https://wa.me/${req.assignedTechId.phone.replace(/[^0-9]/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-700"
                                  title="مراسلة الفني واتساب"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAssignTechModal(req)}
                            className="text-[11px] font-black text-amber-900 dark:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1.5 rounded-xl border border-amber-500/30 inline-flex items-center gap-1 transition-all shadow-xs"
                            title="انقر هنا لاختيار وتوكيل فني صيانة وإصدار رابط الواتساب"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>⚠️ توكيل لفني الآن</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${st.color}`}>
                          {st.label}
                        </span>
                        {req.techCompletedAt && (
                          <div className="text-[10px] text-teal-800 dark:text-teal-300 font-bold mt-1">
                            تم الإصلاح: {new Date(req.techCompletedAt).toLocaleDateString('ar-EG')}
                          </div>
                        )}
                      </td>

                      {/* Custody & Treasury Remittance */}
                      <td className="p-3.5 text-center">
                        {isWarranty ? (
                          <span className="text-[10px] text-emerald-600 font-bold">لا يوجد تحصيل (ضمان)</span>
                        ) : req.remittedToAdmin ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold inline-block">
                            ✓ تم توريد العهدة للخزينة
                          </span>
                        ) : req.collectedAmount > 0 ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold block">
                              عهدة مع الفني: {req.collectedAmount} {currency}
                            </span>
                            <span className="text-[9px] text-red-500 font-bold block">بانتظار التوريد للإدارة</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-ink-soft">بانتظار التحصيل</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Assign Technician */}
                          <button
                            type="button"
                            onClick={() => handleOpenAssignTechModal(req)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm text-[11px] font-black transition-all flex items-center gap-1 active:scale-95"
                            title="اختيار وتوكيل فني صيانة وإصدار رابط الواتساب"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{req.assignedTechId ? 'تغيير الفني' : 'اختيار وتوكيل فني'}</span>
                          </button>

                          {/* Status Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(req)}
                            className="px-2 py-1.5 rounded-xl bg-paper hover:bg-surface border border-line text-ink text-[11px] font-bold transition-all"
                            title="تحديث مرحلة الصيانة"
                          >
                            تحديث الحالة
                          </button>

                          {/* Financials & Remittance */}
                          <button
                            type="button"
                            onClick={() => handleOpenFinancialsModal(req)}
                            className="px-2 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 text-[11px] font-bold transition-all"
                            title="تعديل التكاليف وتوريد العهدة"
                          >
                            الحسابات والعهدة
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
      </div>

      {/* MODAL 1: ASSIGN TECHNICIAN WITH WORKLOAD AVAILABILITY */}
      {selectedReqForAssignTech && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in zoom-in-95">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4 relative my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-ink">توكيل مهمة الصيانة لفني الفرع</h3>
                  <p className="text-xs text-ink-soft">
                    تذكرة #{selectedReqForAssignTech.requestNumber} • عميل: {selectedReqForAssignTech.customer?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReqForAssignTech(null);
                  setAssignmentResult(null);
                }}
                className="text-ink-soft hover:text-ink font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="p-3 rounded-2xl bg-paper border border-line text-xs space-y-1.5 font-bold">
              <div className="flex justify-between">
                <span className="text-ink-soft">السلعة المطلوب صيانتها:</span>
                <span className="text-primary">
                  {selectedReqForAssignTech.items?.map((it) => it.name).join('، ') || 'جهاز صيانة'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">العطل أو الشكوى:</span>
                <span className="text-ink">{selectedReqForAssignTech.reason || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">حالة الضمان:</span>
                <span className="text-emerald-600">
                  {selectedReqForAssignTech.warrantyStatus === 'in_warranty' ? 'ساري بالضمان (مجاني)' : 'خارج الضمان (مدفوع)'}
                </span>
              </div>
            </div>

            {/* Assignment Result Section */}
            {assignmentResult ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-emerald-600 text-sm">تم توكيل مهمة الصيانة بنجاح!</h4>
                  <p className="text-xs text-ink-soft">
                    الفني المكلف: <b>{assignmentResult.tech?.name || assignmentResult.tech?.fullname}</b> ({assignmentResult.tech?.phone || 'لا يوجد هاتف'})
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-ink">
                    <span>رابط المهمة المباشر للفني:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(assignmentResult.taskUrl);
                        showToast('تم نسخ رابط المهمة للحافظة!');
                      }}
                      className="px-2 py-1 rounded-lg bg-surface border border-line text-[11px] hover:text-primary flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>نسخ الرابط</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={assignmentResult.taskUrl}
                    className="w-full p-2 rounded-xl bg-surface border border-line text-[11px] font-mono text-ink-soft outline-none"
                    dir="ltr"
                  />
                  <div className="text-[10px] text-ink-soft leading-relaxed">
                    * يفتح الفني هذا الرابط المباشر من هاتفه لتحديث حالة الصيانة وتدوين الإجراءات بدون الحاجة لحساب أدمن كامل.
                  </div>
                </div>

                <div className="space-y-2">
                  {assignmentResult.whatsappUrl && (
                    <a
                      href={assignmentResult.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>إرسال تفاصيل المهمة للفني عبر واتساب 📲</span>
                    </a>
                  )}

                  <a
                    href={assignmentResult.taskUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 rounded-xl bg-surface border border-line hover:border-primary text-ink text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>معاينة صفحة مهمة الفني الآن</span>
                  </a>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReqForAssignTech(null);
                      setAssignmentResult(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAssignTechSubmit} className="space-y-4 text-xs font-bold">
                {loadingTechs ? (
                  <div className="text-center py-6 text-ink-soft">جاري فحص قائمة وتفرغ فنيي الصيانة بالفرع...</div>
                ) : branchTechnicians.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-center space-y-2 text-amber-900 dark:text-amber-200">
                    <p>لا يوجد فنيو صيانة مسجلون في هذا الفرع حالياً.</p>
                    <p className="text-[11px] opacity-80">
                      يمكنك التوجه لصفحة الفروع وإضافة فني صيانة للفرع (Role 2) لتوكيله في مهمات الصيانة.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="block text-ink">
                        اختر فني الصيانة المطلوب تكليفه (موضح حالة التفرغ والمهام الجارية):
                      </label>

                      <div className="space-y-2 max-h-56 overflow-y-auto p-1">
                        {branchTechnicians.map((t) => {
                          const isSelected = selectedTechId === t._id;
                          return (
                            <label
                              key={t._id}
                              className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 transition-all ${
                                isSelected
                                  ? 'bg-primary/10 border-primary ring-1 ring-primary/30'
                                  : 'bg-paper hover:bg-surface border-line'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="selectedTech"
                                  value={t._id}
                                  checked={isSelected}
                                  onChange={() => setSelectedTechId(t._id)}
                                />
                                <div>
                                  <div className="font-black text-xs text-ink">{t.fullname || t.name}</div>
                                  <div className="text-[11px] text-ink-soft font-mono" dir="ltr">
                                    {t.phone || t.email}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    t.isAvailable
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  }`}
                                >
                                  {t.isAvailable ? '🟢 متاح الآن (0 مهام)' : `🟡 مشغول (${t.activeTasksCount} مهام جارية)`}
                                </span>

                                {t.phone && (
                                  <a
                                    href={`https://wa.me/${t.phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-emerald-600 hover:text-emerald-700"
                                    title="محادثة واتساب سريعة"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-ink-soft mb-1">تعليمات وتوجيهات خاصة للفني (اختياري):</label>
                      <textarea
                        rows={3}
                        value={assignNote}
                        onChange={(e) => setAssignNote(e.target.value)}
                        placeholder="اكتب أي ملاحظات فنية أو قطع غيار مقترحة لفحصها..."
                        className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none focus:border-primary"
                      />
                    </div>

                    <div className="pt-3 border-t border-line flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReqForAssignTech(null)}
                        className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        disabled={isAssigningTech || !selectedTechId}
                        className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>{isAssigningTech ? 'جاري التوكيل...' : 'توكيل المهمة وإصدار الرابط'}</span>
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: FINANCIALS & CUSTODY REMITTANCE */}
      {selectedReqForFinancials && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in zoom-in-95">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-md p-6 space-y-4 relative my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm text-ink">الحسابات والعهد المالية لعملية الصيانة</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReqForFinancials(null)}
                className="text-ink-soft hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFinancialsSubmit} className="space-y-3.5 text-xs font-bold">
              {/* Warranty Free Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-paper border border-line cursor-pointer">
                <input
                  type="checkbox"
                  checked={financialForm.isWarrantyFree}
                  onChange={(e) => {
                    const isFree = e.target.checked;
                    setFinancialForm({
                      ...financialForm,
                      isWarrantyFree: isFree,
                      amountDueFromCustomer: isFree ? 0 : financialForm.serviceFee + financialForm.partsCost,
                      paymentStatus: isFree ? 'free_warranty' : 'pending_collection'
                    });
                  }}
                  className="rounded text-primary focus:ring-0"
                />
                <div>
                  <div className="font-black text-ink">مشمول بالضمان مجاناً (تكلفة العميل = 0 ج.م)</div>
                  <div className="text-[10px] text-ink-soft">
                    تتحمل الشركة تكاليف الصيانة ولا يتم تحصيل أي مبالغ من العميل.
                  </div>
                </div>
              </label>

              {!financialForm.isWarrantyFree && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-ink-soft mb-1">أتعاب وفحص الصيانة ({currency}):</label>
                      <input
                        type="number"
                        min="0"
                        value={financialForm.serviceFee}
                        onChange={(e) => {
                          const fee = Number(e.target.value) || 0;
                          setFinancialForm({
                            ...financialForm,
                            serviceFee: fee,
                            amountDueFromCustomer: fee + financialForm.partsCost
                          });
                        }}
                        className="w-full p-2 rounded-xl bg-surface border border-line text-ink font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-ink-soft mb-1">تكلفة قطع الغيار ({currency}):</label>
                      <input
                        type="number"
                        min="0"
                        value={financialForm.partsCost}
                        onChange={(e) => {
                          const parts = Number(e.target.value) || 0;
                          setFinancialForm({
                            ...financialForm,
                            partsCost: parts,
                            amountDueFromCustomer: financialForm.serviceFee + parts
                          });
                        }}
                        className="w-full p-2 rounded-xl bg-surface border border-line text-ink font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-ink mb-1">إجمالي المبلغ المطلوب من العميل ({currency}):</label>
                    <input
                      type="number"
                      min="0"
                      value={financialForm.amountDueFromCustomer}
                      onChange={(e) =>
                        setFinancialForm({
                          ...financialForm,
                          amountDueFromCustomer: Number(e.target.value) || 0
                        })
                      }
                      className="w-full p-2 rounded-xl bg-surface border border-line text-ink font-mono font-black"
                    />
                  </div>
                </div>
              )}

              {/* Custody Collection & Remittance Section */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30">
                <div className="font-black text-ink text-xs">تحصيل المبالغ وتوريد عهدة الفني للإدارة:</div>

                <div>
                  <label className="block text-ink-soft mb-1">المبلغ المحصل نقداً بواسطة الفني ({currency}):</label>
                  <input
                    type="number"
                    min="0"
                    value={financialForm.collectedAmount}
                    onChange={(e) =>
                      setFinancialForm({
                        ...financialForm,
                        collectedAmount: Number(e.target.value) || 0
                      })
                    }
                    className="w-full p-2 rounded-xl bg-surface border border-line text-ink font-mono"
                  />
                </div>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-line cursor-pointer">
                  <input
                    type="checkbox"
                    checked={financialForm.remittedToAdmin}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, remittedToAdmin: e.target.checked })
                    }
                    className="rounded text-primary focus:ring-0"
                  />
                  <div>
                    <span className="font-black text-emerald-600 block">
                      تم توريد المبلغ بالكامل إلى خزينة الإدارة
                    </span>
                    <span className="text-[10px] text-ink-soft">
                      (الفني يتقاضى راتباً شهرياً ولا يستبقي المبالغ، ويتم إخلاء ذمته من العهدة)
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-ink-soft mb-1">ملاحظة التوريد أو رقم إيصال الخزينة:</label>
                  <input
                    type="text"
                    value={financialForm.remittedNote}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, remittedNote: e.target.value })
                    }
                    placeholder="مثال: تم التوريد للخزينة بحافظة رقم #102..."
                    className="w-full p-2 rounded-xl bg-surface border border-line text-ink"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReqForFinancials(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingFinancials}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-sm"
                >
                  {isSavingFinancials ? 'جاري الحفظ...' : 'حفظ البيانات المالية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STATUS UPDATE */}
      {selectedReqForStatus && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in zoom-in-95">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-sm p-6 space-y-4 relative my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-black text-sm text-ink">تحديث مرحلة الصيانة</h3>
              <button
                type="button"
                onClick={() => setSelectedReqForStatus(null)}
                className="text-ink-soft hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStatusSubmit} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-ink mb-1">الحالة الجديدة:</label>
                <select
                  value={statusUpdateForm.status}
                  onChange={(e) =>
                    setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-ink outline-none"
                >
                  <option value="received_at_branch">مستلم بالفرع</option>
                  <option value="assigned_to_tech">تم تعيين الفني</option>
                  <option value="in_maintenance">قيد الفحص والإصلاح</option>
                  <option value="parts_pending">في انتظار قطع غيار</option>
                  <option value="repaired">تم الإصلاح بنجاح</option>
                  <option value="delivered_back">تم التسليم للعميل</option>
                  <option value="unrepairable">تعذر الإصلاح</option>
                </select>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">ملاحظات التحديث:</label>
                <textarea
                  rows={3}
                  value={statusUpdateForm.note}
                  onChange={(e) =>
                    setStatusUpdateForm({ ...statusUpdateForm, note: e.target.value })
                  }
                  placeholder="ملاحظات توضيحية للعميل والإدارة..."
                  className="w-full p-2 rounded-xl bg-paper border border-line text-ink outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReqForStatus(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-black shadow-sm"
                >
                  {isUpdatingStatus ? 'جاري التحديث...' : 'تحديث الحالة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}