import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Wrench,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Phone,
  User,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Banknote,
  RefreshCw,
  Eye,
  Filter,
  Check,
  X,
  Package,
  Calendar,
  Layers,
  Send,
  MessageCircle,
  UserCheck,
  ExternalLink,
  Copy,
  Building2
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AdminBranchSelector from '../shared/AdminBranchSelector';

const statusLabels = {
  requested: { label: 'طلب جديد', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  approved: { label: 'تمت الموافقة', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  courier_assigned: { label: 'تم تعيين المندوب', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  picked_up: { label: 'تم الاستلام من العميل', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  inspected: { label: 'تم الفحص في المستودع', color: 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/30' },
  refunded: { label: 'تم استرداد المبلغ', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  in_maintenance: { label: 'جاري الصيانة', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  repaired: { label: 'تم الإصلاح', color: 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/30' },
  delivered_back: { label: 'تم التسليم للعميل', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  rejected: { label: 'مرفوض', color: 'bg-red-500/10 text-red-600 border-red-500/20' }
};

export default function ReturnsPage() {
  const { token, config, showToast, activeBranchId, branches = [] } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const currency = config?.currency || 'ج.م';

  const [activeTab, setActiveTab] = useState('return'); // 'return' | 'maintenance'
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [selectedReqForDetails, setSelectedReqForDetails] = useState(null);
  const [selectedReqForStatus, setSelectedReqForStatus] = useState(null);
  const [selectedReqForRefund, setSelectedReqForRefund] = useState(null);
  const [selectedReqForConvert, setSelectedReqForConvert] = useState(null);

  // Field Service Conversion Form
  const [convertForm, setConvertForm] = useState({
    serviceFee: 0,
    address: '',
    city: '',
    notes: ''
  });
  const [isConvertingService, setIsConvertingService] = useState(false);
  const [convertedResultModal, setConvertedResultModal] = useState(null);

  // Status & Courier modal form
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [trackingReference, setTrackingReference] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Refund modal form
  const [refundMethod, setRefundMethod] = useState('manual_cash'); // 'paymob_online' | 'manual_cash'
  const [refundAmount, setRefundAmount] = useState(0);
  const [restockInventory, setRestockInventory] = useState(true);
  const [refundAdminNote, setRefundAdminNote] = useState('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  // Technician Assignment State
  const [selectedReqForAssignTech, setSelectedReqForAssignTech] = useState(null);
  const [branchTechnicians, setBranchTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [isAssigningTech, setIsAssigningTech] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState(null);

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
        // Fetch all branches and collect technicians
        const res = await axios.get('/api/admin/branches', authHeader);
        const branches = res.data?.branches || [];
        const techs = [];
        for (const b of branches) {
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

  const loadRequests = () => {
    if (!token) return;
    setLoading(true);

    const params = {
      type: activeTab,
      status: statusFilter,
      search: search.trim(),
      limit: 50
    };
    if (activeBranchId && activeBranchId !== 'all') {
      params.branchId = activeBranchId;
    }

    axios
      .get('/api/admin/returns', {
        ...authHeader,
        params
      })
      .then((res) => {
        setRequests(res.data?.requests || []);
        setTotalCount(res.data?.total || 0);
      })
      .catch((err) => {
        console.error('Failed to load returns:', err);
        showToast('فشل جلب طلبات الإرجاع والصيانة', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
  }, [token, activeTab, statusFilter, activeBranchId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadRequests();
  };

  // Open Status & Courier Modal
  const handleOpenStatusModal = (req) => {
    setSelectedReqForStatus(req);
    setNewStatus(req.status);
    setStatusNote('');
    setCourierName(req.courier?.name || '');
    setCourierPhone(req.courier?.phone || '');
    setTrackingReference(req.courier?.trackingReference || '');
  };

  // Submit Status & Courier
  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedReqForStatus) return;

    setIsUpdatingStatus(true);
    try {
      const payload = {
        status: newStatus,
        note: statusNote,
        courier: {
          name: courierName,
          phone: courierPhone,
          trackingReference
        }
      };

      await axios.put(`/api/admin/returns/${selectedReqForStatus._id}/status`, payload, authHeader);
      showToast('تم تحديث حالة الطلب والمندوب بنجاح');
      setSelectedReqForStatus(null);
      loadRequests();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تحديث الحالة', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open Refund Modal
  const handleOpenRefundModal = (req) => {
    setSelectedReqForRefund(req);
    setRefundAmount(req.refund?.amount || req.items.reduce((sum, it) => sum + it.price * it.quantity, 0));
    setRefundMethod(req.refund?.transactionId ? 'paymob_online' : 'manual_cash');
    setRestockInventory(true);
    setRefundAdminNote('');
  };

  // Submit Refund
  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!selectedReqForRefund) return;

    setIsProcessingRefund(true);
    try {
      const payload = {
        refundMethod,
        refundAmount: Number(refundAmount),
        restockInventory,
        adminNote: refundAdminNote
      };

      const res = await axios.post(
        `/api/admin/returns/${selectedReqForRefund._id}/refund`,
        payload,
        authHeader
      );

      showToast(res.data?.message || 'تم رد المبلغ واستعادة المخزون بنجاح!');
      setSelectedReqForRefund(null);
      loadRequests();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل استرداد المبلغ', 'error');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  // Quick KPI calculation
  const pendingCourierCount = requests.filter((r) => ['approved', 'courier_assigned'].includes(r.status)).length;
  const refundedCount = requests.filter((r) => r.status === 'refunded').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-500 text-white flex items-center justify-center font-black shadow-lg shadow-orange-500/25">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
              <span>إدارة المرتجعات والصيانة والريفند (RMA)</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5 font-medium">
              متابعة طلبات الإرجاع، تتبع مندوب الاستلام، إدارة فترات الضمان، ورد المبالغ عبر Paymob أو يدوياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRequests}
            className="p-2.5 rounded-xl bg-paper hover:bg-surface border border-line text-ink transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي الطلبات بالقائمة</span>
          <div className="text-2xl font-black text-ink">{totalCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-orange-600">بانتظار المندوب والاستلام</span>
          <div className="text-2xl font-black text-orange-600">{pendingCourierCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-emerald-600">تم استرداد المبلغ بالكامل</span>
          <div className="text-2xl font-black text-emerald-600">{refundedCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-indigo-600">سياسة الإرجاع والضمان</span>
          <div className="text-xs font-black text-ink mt-1">
            إرجاع خلال 15 يوماً • صيانة بالضمان
          </div>
        </div>
      </div>

      {/* Local Branch Selector */}
      <AdminBranchSelector
        label="تصفية الطلبات والمرتجعات حسب الفرع:"
        onChange={() => loadRequests()}
      />

      {/* Navigation Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-1">
        <button
          onClick={() => {
            setActiveTab('return');
            setStatusFilter('all');
          }}
          className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'return'
              ? 'bg-primary text-white shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-paper'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>طلبات المرتجعات والاسترداد (Returns & Refunds)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('maintenance');
            setStatusFilter('all');
          }}
          className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'maintenance'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-paper'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>خدمات ما بعد البيع وصيانة الضمان (Warranty & Claims)</span>
        </button>
      </div>

      {/* Filters Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="p-3.5 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب، رقم المرتجع، العميل، الهاتف..."
              className="w-full pl-3 pr-8 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
            />
            <Search className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="requested">طلب جديد (requested)</option>
            <option value="approved">تمت الموافقة (approved)</option>
            <option value="courier_assigned">تم تعيين مندوب (courier_assigned)</option>
            <option value="picked_up">تم الاستلام من العميل (picked_up)</option>
            <option value="inspected">تم الفحص بالمستودع (inspected)</option>
            <option value="refunded">تم استرداد المبلغ (refunded)</option>
            <option value="in_maintenance">جاري الصيانة (in_maintenance)</option>
            <option value="repaired">تم الإصلاح (repaired)</option>
            <option value="rejected">مرفوض (rejected)</option>
          </select>
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-sm"
        >
          بحث
        </button>
      </form>

      {/* Main Table / Requests List */}
      <div className="rounded-3xl bg-surface border border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-ink-soft">
            جاري تحميل الطلبات...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <RotateCcw className="w-10 h-10 text-ink-soft mx-auto opacity-50" />
            <h4 className="text-sm font-black text-ink">لا توجد طلبات مسجلة حالياً</h4>
            <p className="text-xs text-ink-soft max-w-sm mx-auto">
              عندما يقدم العملاء طلبات إرجاع أو صيانة من حساباتهم، ستظهر هنا مباشرة لمعالجتها.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-black border-b border-line">
                <tr>
                  <th className="p-3.5">رقم الطلب والنوع</th>
                  <th className="p-3.5">العميل</th>
                  <th className="p-3.5">المنتجات</th>
                  <th className="p-3.5">سبب الطلب والضمان</th>
                  <th className="p-3.5">حالة الطلب والمندوب</th>
                  <th className="p-3.5 text-center">الإجراءات والرد المالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {requests.map((req) => {
                  const st = statusLabels[req.status] || {
                    label: req.status,
                    color: 'bg-paper text-ink'
                  };

                  return (
                    <tr key={req._id} className="hover:bg-paper/60 transition-colors">
                      {/* Request Number & Order ID */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-primary text-sm">
                          {req.requestNumber}
                        </div>
                        <span className="text-[11px] text-ink-soft block font-mono">
                          طلب أصلي: #{req.orderId}
                        </span>
                        <span className="text-[10px] text-ink-soft">
                          {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                        <div className="mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span>{req.branchId?.name || (branches.find((b) => String(b._id) === String(req.branchId))?.name) || 'الفرع الرئيسي'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="p-3.5 font-bold text-ink">
                        <div>{req.customer?.name}</div>
                        <span className="text-[11px] text-ink-soft font-mono" dir="ltr">
                          {req.customer?.phone}
                        </span>
                        {req.customer?.city && (
                          <span className="text-[10px] text-ink-soft block">
                            {req.customer?.city}
                          </span>
                        )}
                      </td>

                      {/* Products */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {req.items?.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 font-bold text-ink">
                              <span>• {it.name}</span>
                              <span className="text-ink-soft text-[11px]">({it.quantity}×)</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Reason & Warranty */}
                      <td className="p-3.5">
                        <div className="text-ink font-bold">{req.reason || 'غير محدد'}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {req.warrantyStatus === 'in_warranty' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              ✓ مشمول بالضمان
                            </span>
                          ) : req.warrantyStatus === 'out_of_warranty' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
                              خارج الضمان
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium text-ink-soft bg-paper">
                              بدون ضمان
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status & Courier */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${st.color}`}>
                          {st.label}
                        </span>
                        {req.courier?.name && (
                          <div className="text-[10px] text-indigo-600 font-bold mt-1 flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span>المندوب: {req.courier.name}</span>
                          </div>
                        )}
                        {req.assignedTechId && (
                          <div className="text-[10px] text-amber-800 dark:text-amber-200 font-bold mt-1 flex items-center gap-1 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                            <Wrench className="w-3 h-3 shrink-0" />
                            <span>الفني: {req.assignedTechId.fullname || req.assignedTechId.name || 'معين'}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Update Status & Courier */}
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(req)}
                            className="px-2.5 py-1.5 rounded-xl bg-paper hover:bg-surface border border-line text-ink text-[11px] font-bold transition-all flex items-center gap-1"
                            title="تحديث الحالة وتعيين المندوب"
                          >
                            <Truck className="w-3.5 h-3.5 text-primary" />
                            <span>المندوب والحالة</span>
                          </button>

                          {/* Assign Maintenance to Branch Technician */}
                          {req.type === 'maintenance' && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssignTechModal(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 text-[11px] font-black transition-all flex items-center gap-1"
                              title="توكيل المهمة لفني صيانة مع رابط مباشر وإشعار واتساب"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{req.assignedTechId ? 'تغيير الفني' : 'توكيل لفني'}</span>
                            </button>
                          )}

                          {/* Convert Maintenance Claim to Field Service Visit */}
                          {req.type === 'maintenance' && !req.convertedToOrderId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReqForConvert(req);
                                setConvertForm({
                                  serviceFee: 0,
                                  address: req.customer?.address || '',
                                  city: req.customer?.city || '',
                                  notes: req.reason || ''
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-black shadow-sm transition-all flex items-center gap-1"
                              title="إصدار أمر زيارة فني ومهمة صيانة ميدانية"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>أمر صيانة ميدانية</span>
                            </button>
                          )}

                          {req.convertedToOrderId && (
                            <span className="px-2 py-1 rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/40 text-[10px] font-black">
                              أمر خدمة: {req.convertedToOrderId}
                            </span>
                          )}

                          {/* Process Refund (For Returns) */}
                          {req.type === 'return' && req.status !== 'refunded' && req.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRefundModal(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-sm transition-all flex items-center gap-1"
                              title="استرداد المبلغ عبر Paymob أو يدوياً"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>رد المبلغ</span>
                            </button>
                          )}

                          {/* View Timeline */}
                          <button
                            type="button"
                            onClick={() => setSelectedReqForDetails(req)}
                            className="p-1.5 text-ink-soft hover:text-primary rounded-lg transition-colors"
                            title="عرض السجل الزمني"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* MODAL 1: STATUS & COURIER ASSIGNMENT */}
      {selectedReqForStatus && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4 relative my-auto">
            <button
              onClick={() => setSelectedReqForStatus(null)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-ink">
                  تحديث حالة الطلب وتعيين المندوب ({selectedReqForStatus.requestNumber})
                </h3>
                <p className="text-xs text-ink-soft">
                  العميل: {selectedReqForStatus.customer?.name} • الهاتف: {selectedReqForStatus.customer?.phone}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="block text-ink-soft mb-1">الحالة الجديدة للطلب:</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
                >
                  <option value="requested">طلب جديد (requested)</option>
                  <option value="approved">موافقة وتجهيز المندوب (approved)</option>
                  <option value="courier_assigned">تم تعيين مندوب الاستلام (courier_assigned)</option>
                  <option value="picked_up">تم استلام الشحنة من العميل (picked_up)</option>
                  <option value="inspected">تم فحص الشحنة في المستودع (inspected)</option>
                  {selectedReqForStatus.type === 'maintenance' && (
                    <>
                      <option value="in_maintenance">جاري الصيانة في المركز (in_maintenance)</option>
                      <option value="repaired">تم الإصلاح بنجاح (repaired)</option>
                      <option value="delivered_back">تم التسليم للعميل (delivered_back)</option>
                    </>
                  )}
                  <option value="rejected">رفض الطلب (rejected)</option>
                </select>
              </div>

              {/* Courier Details */}
              <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-2.5">
                <span className="font-black text-ink block text-[11px]">بيانات مندوب الاستلام:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-soft mb-0.5">اسم المندوب:</label>
                    <input
                      type="text"
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="مثال: أحمد محمد (شركة فاست)"
                      className="w-full p-2 rounded-xl bg-surface border border-line text-xs text-ink outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-soft mb-0.5">هاتف المندوب:</label>
                    <input
                      type="text"
                      value={courierPhone}
                      onChange={(e) => setCourierPhone(e.target.value)}
                      placeholder="010xxxxxxxx"
                      className="w-full p-2 rounded-xl bg-surface border border-line text-xs text-ink outline-none font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-ink-soft mb-0.5">رقم بوليصة الاسترجاع:</label>
                  <input
                    type="text"
                    value={trackingReference}
                    onChange={(e) => setTrackingReference(e.target.value)}
                    placeholder="رقم البوليصة إن وجد..."
                    className="w-full p-2 rounded-xl bg-surface border border-line text-xs text-ink outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">ملاحظات التحديث للعميل:</label>
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="ملاحظات تظهر للعميل في سجل التتبع..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReqForStatus(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isUpdatingStatus ? 'جاري الحفظ...' : 'تأكيد التحديث'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROCESS REFUND (PAYMOB & MANUAL CASH) */}
      {selectedReqForRefund && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4 relative my-auto">
            <button
              onClick={() => setSelectedReqForRefund(null)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-ink">
                  تأكيد استرداد المبلغ (Refund) • {selectedReqForRefund.requestNumber}
                </h3>
                <p className="text-xs text-ink-soft">
                  رد المبلغ للعميل وإعادة المنتجات المسترجعة للمخزون
                </p>
              </div>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-4 text-xs font-bold">
              {/* Method choice */}
              <div>
                <label className="block text-ink-soft mb-1.5">اختر آلية الاسترداد المالي:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('paymob_online')}
                    className={`p-3 rounded-2xl border text-right space-y-1 transition-all ${
                      refundMethod === 'paymob_online'
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-950 shadow-sm'
                        : 'bg-paper border-line text-ink-soft'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-indigo-600">
                      <CreditCard className="w-4 h-4" />
                      <span>استرداد تلقائي عبر Paymob</span>
                    </div>
                    <p className="text-[10px] text-ink-soft">
                      رد مباشر للبطاقة المسدد بها عبر بوابة Paymob
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRefundMethod('manual_cash')}
                    className={`p-3 rounded-2xl border text-right space-y-1 transition-all ${
                      refundMethod === 'manual_cash'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 shadow-sm'
                        : 'bg-paper border-line text-ink-soft'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-emerald-600">
                      <Banknote className="w-4 h-4" />
                      <span>إرجاع يدوي (كاش/تحويل)</span>
                    </div>
                    <p className="text-[10px] text-ink-soft">
                      تسليم المبلغ نقداً أو عبر محفظة مع تأكيد النظام
                    </p>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-ink-soft mb-1">مبلغ الاسترداد ({currency}):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-sm font-mono font-bold text-ink outline-none"
                />
              </div>

              {/* Restock Checkbox */}
              <div className="p-3 rounded-2xl bg-paper border border-line">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                  <input
                    type="checkbox"
                    checked={restockInventory}
                    onChange={(e) => setRestockInventory(e.target.checked)}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <span>إعادة المنتجات المسترجعة تلقائياً إلى المخزون المتاح للبيع (Restock)</span>
                </label>
                <p className="text-[10px] text-ink-soft mt-1 mr-6">
                  سيتم زيادة كمية المخزون في بطاقة الصنف وتسجيل قيد مرتجع في السجل المالي.
                </p>
              </div>

              {/* Admin Note */}
              <div>
                <label className="block text-ink-soft mb-1">ملاحظة تأكيد الاسترداد:</label>
                <input
                  type="text"
                  value={refundAdminNote}
                  onChange={(e) => setRefundAdminNote(e.target.value)}
                  placeholder="مثال: تم التحويل لحساب فودافون كاش الخاص بالعميل..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReqForRefund(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProcessingRefund}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isProcessingRefund ? 'جاري التنفيذ...' : 'تأكيد وإتمام الرد المالي'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW TIMELINE & DETAILS */}
      {selectedReqForDetails && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4 relative my-auto">
            <button
              onClick={() => setSelectedReqForDetails(null)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-base text-ink">
              السجل الزمني للطلب ({selectedReqForDetails.requestNumber})
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedReqForDetails.timeline?.map((evt, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-paper border border-line space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-ink">
                    <span>{evt.title}</span>
                    <span className="text-[10px] text-ink-soft font-mono">
                      {new Date(evt.at).toLocaleString('ar-EG')}
                    </span>
                  </div>
                  {evt.note && <p className="text-[11px] text-ink-soft">{evt.note}</p>}
                  <span className="text-[10px] text-primary font-bold block">بواسطة: {evt.by}</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReqForDetails(null)}
                className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONVERT TO FIELD SERVICE VISIT */}
      {selectedReqForConvert && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-3xl border-2 border-orange-500 shadow-2xl w-full max-w-md p-6 space-y-4 relative my-auto">
            <button
              onClick={() => setSelectedReqForConvert(null)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-orange-600">
              <Wrench className="w-6 h-6" />
              <h3 className="font-black text-base text-ink">
                إصدار أمر زيارة فني ومهمة صيانة ميدانية
              </h3>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              سيتم إنشاء أمر خدمة ميدانية رسمي في قسم الطلبات (أمر خدمة)، وتكليف فريق الصيانة بالزيارة مع فحص حساب العميل أو إنشاء حساب جديد له تلقائياً برقم هاتفه:
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsConvertingService(true);
                try {
                  const res = await axios.post(
                    `/api/admin/returns/${selectedReqForConvert._id}/convert-service`,
                    convertForm,
                    authHeader
                  );
                  showToast(res.data?.message || 'تم إصدار أمر الصيانة الميدانية بنجاح');
                  setSelectedReqForConvert(null);
                  loadRequests();
                  if (res.data?.customerAccount?.isNew) {
                    setConvertedResultModal(res.data);
                  }
                } catch (err) {
                  showToast(err.response?.data?.error || 'فشل تحويل الطلب', 'error');
                } finally {
                  setIsConvertingService(false);
                }
              }}
              className="space-y-3 text-xs font-bold"
            >
              <div className="p-3 rounded-2xl bg-paper border border-line space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-soft">العميل:</span>
                  <span className="text-ink">{selectedReqForConvert.customer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">الهاتف:</span>
                  <span className="text-ink font-mono">{selectedReqForConvert.customer?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">السلعة المعيبة:</span>
                  <span className="text-orange-600">
                    {selectedReqForConvert.items?.map((it) => it.name).join('، ') || 'منتج صيانة'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">رسوم الزيارة أو الكشف (0 = مشمول بالضمان مجاناً):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={convertForm.serviceFee}
                    onChange={(e) => setConvertForm({ ...convertForm, serviceFee: Number(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs font-mono font-bold text-ink outline-none"
                  />
                  <span className="absolute left-3 top-2.5 text-[10px] text-ink-soft">{currency}</span>
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">عنوان زيارة الفني بالتفصيل:</label>
                <input
                  type="text"
                  required
                  value={convertForm.address}
                  onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })}
                  placeholder="عنوان العميل، الشارع، العمارة، الشقة..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none"
                />
              </div>

              <div>
                <label className="block text-ink-soft mb-1">المدينة / المنطقة:</label>
                <input
                  type="text"
                  value={convertForm.city}
                  onChange={(e) => setConvertForm({ ...convertForm, city: e.target.value })}
                  placeholder="المدينة..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReqForConvert(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isConvertingService}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isConvertingService ? 'جاري الإصدار...' : 'إصدار أمر المهمة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: ASSIGN TECHNICIAN MODAL */}
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
                    طلب #{selectedReqForAssignTech.requestNumber} • عميل: {selectedReqForAssignTech.customer?.name}
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
                  {selectedReqForAssignTech.warrantyStatus === 'in_warranty' ? 'ساري بالضمان' : 'خارج الضمان'}
                </span>
              </div>
            </div>

            {/* If Already Assigned / Result Available */}
            {assignmentResult ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-emerald-600 text-sm">تم توكيل مهمة الصيانة بنجاح!</h4>
                  <p className="text-xs text-ink-soft">
                    الفني المكلف: <b>{assignmentResult.tech?.name}</b> ({assignmentResult.tech?.phone || 'لا يوجد هاتف'})
                  </p>
                </div>

                {/* Direct Link Preview & Copy */}
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
                    * الفني يمكنه فتح هذا الرابط المباشر من هاتفه المحمول مباشرة لتحديث مراحل الصيانة بدون الحاجة لحساب أدمن كامل.
                  </div>
                </div>

                {/* Actions: Send WhatsApp & Open Preview */}
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
              <form onSubmit={handleAssignTechSubmit} className="space-y-3 text-xs font-bold">
                {loadingTechs ? (
                  <div className="text-center py-6 text-ink-soft">جاري جلب قائمة فنيي الصيانة بالفرع...</div>
                ) : branchTechnicians.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-center space-y-2 text-amber-900 dark:text-amber-200">
                    <p>لا يوجد فنيو صيانة مسجلون في هذا الفرع حالياً.</p>
                    <p className="text-[11px] opacity-80">
                      يمكنك التوجه لصفحة الفروع وإضافة فني صيانة للفرع (Role 2) لتوكيله في مهمات الصيانة.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-ink mb-1.5">اختر فني الصيانة المطلوب تكليفه *</label>
                      <select
                        required
                        value={selectedTechId}
                        onChange={(e) => setSelectedTechId(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                      >
                        <option value="">-- اختر الفني من القائمة --</option>
                        {branchTechnicians.map((t) => (
                          <option key={t._id} value={t._id}>
                            🔧 {t.fullname || t.name} ({t.phone || t.email})
                          </option>
                        ))}
                      </select>
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

      {/* MODAL 5: NEW CUSTOMER CREDENTIALS RESULT */}
      {convertedResultModal && (
        <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in zoom-in-95">
          <div className="bg-surface text-ink rounded-3xl border-2 border-emerald-500 shadow-2xl w-full max-w-md p-6 space-y-4 relative my-auto text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="font-black text-lg text-ink">تم إنشاء أمر الصيانة وحساب العميل بنجاح!</h3>
            <p className="text-xs text-ink-soft leading-relaxed">
              رقم أمر الخدمة الجديد: <b>{convertedResultModal.order?.orderId}</b>
              <br />
              تم تفعيل حساب جديد للعميل ليتمكن من متابعة زيارة الفني وحالة الصيانة من حسابه:
            </p>

            <div className="p-3.5 rounded-2xl bg-paper border border-line text-xs font-mono space-y-1.5 text-right">
              <div className="flex justify-between">
                <span className="text-ink-soft">اسم المستخدم:</span>
                <span className="font-bold text-emerald-600">{convertedResultModal.customerAccount?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">كلمة المرور:</span>
                <span className="font-bold text-emerald-600">{convertedResultModal.customerAccount?.tempPassword}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConvertedResultModal(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black"
            >
              تم، العودة للقائمة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
