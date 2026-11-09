import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building2,
  ShoppingBag,
  DollarSign,
  Edit2,
  Key,
  Trash2,
  CheckCircle2,
  X,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  UserCheck,
  UserX,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Eye,
  UserPlus
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AdminBranchSelector from '../shared/AdminBranchSelector';
import OpticsPrescriptionModal from './components/OpticsPrescriptionModal';
import DynamicClientProfileModal from './components/DynamicClientProfileModal';
import AddCustomerModal from './components/AddCustomerModal';
import CustomerProfileModal from './components/CustomerProfileModal';

export default function CustomersPage() {
  const { token, config, showToast, activeBranchId, branches = [] } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const currency = config?.currency || 'ج.م';
  const profileConfig = config?.clientProfileConfig || {};
  const isProfileEnabled = profileConfig.enabled !== false;
  const profileButtonLabel = profileConfig.actionButtonLabel || 'فحص كشف النظر';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Optics Prescriptions & Add Customer Modals
  const [prescriptionCustomer, setPrescriptionCustomer] = useState(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedProfileCustomerId, setSelectedProfileCustomerId] = useState(null);

  // Modals state
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({
    fullname: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    active: true,
    branchId: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [passwordCustomer, setPasswordCustomer] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCustomers = () => {
    if (!token) return;
    setLoading(true);

    const params = {
      page,
      limit,
      search: search.trim() || undefined
    };

    if (activeBranchId && activeBranchId !== 'all') {
      params.branchId = activeBranchId;
    }

    axios
      .get('/api/admin/customers', { ...authHeader, params })
      .then((res) => {
        setCustomers(res.data?.customers || []);
        if (res.data?.pagination) {
          setPagination({
            total: res.data.pagination.total || 0,
            totalPages: res.data.pagination.totalPages || 1
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load customers:', err);
        showToast('فشل جلب قائمة العملاء', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, [token, page, limit, activeBranchId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadCustomers();
  };

  // Selection handlers
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === customers.length && customers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((c) => c._id));
    }
  };

  // Edit Customer
  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setEditForm({
      fullname: customer.fullname || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      active: customer.active !== false,
      branchId: customer.branchId?._id || customer.branchId || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setIsSavingEdit(true);
    try {
      await axios.put(
        `/api/admin/customers/${editingCustomer._id}`,
        editForm,
        authHeader
      );
      showToast('تم تحديث بيانات العميل بنجاح');
      setEditingCustomer(null);
      loadCustomers();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تحديث بيانات العميل', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Change Password
  const handleOpenPassword = (customer) => {
    setPasswordCustomer(customer);
    setNewPassword(customer.phone || '');
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!passwordCustomer || !newPassword.trim()) return;

    setIsSavingPassword(true);
    try {
      await axios.put(
        `/api/admin/customers/${passwordCustomer._id}/password`,
        { newPassword: newPassword.trim() },
        authHeader
      );
      showToast('تم تغيير كلمة مرور العميل بنجاح');
      setPasswordCustomer(null);
      setNewPassword('');
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تغيير كلمة المرور', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;

    setIsDeleting(true);
    try {
      await axios.delete(
        `/api/admin/customers/${deletingCustomer._id}`,
        authHeader
      );
      showToast('تم حذف العميل بنجاح (مع الاحتفاظ بسجل طلباته وإحصائياته)');
      setDeletingCustomer(null);
      setSelectedIds((prev) => prev.filter((id) => id !== deletingCustomer._id));
      loadCustomers();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حذف العميل', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `هل أنت متأكد من حذف ${selectedIds.length} من العملاء المحددين؟ سيتم إزالة حساباتهم مع الإبقاء على الفواتير للسلامة المالية.`
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const res = await axios.post(
        '/api/admin/customers/bulk-delete',
        { ids: selectedIds },
        authHeader
      );
      showToast(res.data?.message || 'تم حذف العملاء المحددين بنجاح');
      setSelectedIds([]);
      loadCustomers();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حذف العملاء المحددين', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const totalSpentAll = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const activeCount = customers.filter((c) => c.active !== false).length;
  const buyersCount = customers.filter((c) => (c.ordersCount || 0) > 0).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            <span>سجل العملاء وإدارة الحسابات</span>
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            إدارة حسابات المتجر، فحص الإنفاق والطلبات، تعديل البيانات، وتعيين كلمات المرور للعملاء
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل عميل جديد</span>
          </button>
          <button
            onClick={loadCustomers}
            className="p-2.5 rounded-card bg-surface hover:bg-paper border border-line text-ink transition-all"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي العملاء المسجلين</span>
          <div className="text-2xl font-black text-ink">{pagination.total}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-emerald-600">العملاء النشطون (الصفحة)</span>
          <div className="text-2xl font-black text-emerald-600">{activeCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-primary">عملاء قاموا بالشراء</span>
          <div className="text-2xl font-black text-primary">{buyersCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">مشتريات هذه الصفحة</span>
          <div className="text-2xl font-black text-ink">
            {totalSpentAll.toLocaleString()} <span className="text-xs">{currency}</span>
          </div>
        </div>
      </div>

      {/* Local Branch Selector */}
      <AdminBranchSelector label="تصفية العملاء حسب الفرع المسجل:" />

      {/* Search & Bulk Action Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، رقم الهاتف، البريد، أو المدينة..."
              className="w-full pl-3 pr-9 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
            />
            <Search className="w-4 h-4 text-ink-soft absolute right-3 top-3 pointer-events-none" />
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-sm transition-all"
          >
            بحث
          </button>
        </form>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-xl animate-in fade-in">
            <span className="text-xs font-bold text-red-600">
              تم تحديد {selectedIds.length} عميل
            </span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBulkDeleting ? 'جاري الحذف...' : 'حذف المحددين'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Customers Main Table */}
      <div className="rounded-3xl bg-surface border border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center space-y-2">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-xs font-bold text-ink-soft">جاري تحميل سجل العملاء...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Users className="w-12 h-12 text-ink-soft mx-auto opacity-30" />
            <h4 className="text-sm font-black text-ink">لم يتم العثور على أي عملاء مطابقين</h4>
            <p className="text-xs text-ink-soft max-w-sm mx-auto">
              تأكد من شروط البحث أو الفرع المحدد، أو قم بإجراء عمليات شراء بالـ POS لإنشاء حسابات فورية.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-paper text-ink-soft font-black border-b border-line">
                <tr>
                  <th className="p-4 w-12 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-ink-soft hover:text-primary transition-colors"
                      title="تحديد الكل"
                    >
                      {selectedIds.length === customers.length && customers.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">العميل</th>
                  <th className="p-4">بيانات التواصل والمدينة</th>
                  <th className="p-4">الفرع المسجل</th>
                  <th className="p-4 text-center">عدد الطلبات</th>
                  <th className="p-4">إجمالي الإنفاق</th>
                  <th className="p-4 text-center">حالة الحساب</th>
                  <th className="p-4 text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((cust) => {
                  const isSelected = selectedIds.includes(cust._id);
                  const cleanPhone = cust.phone ? String(cust.phone).replace(/\s+/g, '') : '';
                  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}` : null;

                  return (
                    <tr
                      key={cust._id}
                      className={`hover:bg-paper/60 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(cust._id)}
                          className="text-ink-soft hover:text-primary transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Customer Name & Joined Date */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedProfileCustomerId(cust._id)}
                            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-primary font-black flex items-center justify-center shrink-0 border border-primary/30 hover:scale-105 transition-transform"
                            title="عرض البروفايل الشامل للعميل"
                          >
                            {cust.fullname ? cust.fullname.charAt(0).toUpperCase() : 'ع'}
                          </button>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedProfileCustomerId(cust._id)}
                              className="font-bold text-ink block text-xs hover:text-primary transition-colors text-right"
                            >
                              {cust.fullname || 'عميل المتجر'}
                            </button>
                            <span className="text-[10px] text-ink-soft block">
                              انضم:{' '}
                              {cust.createdAt
                                ? new Date(cust.createdAt).toLocaleDateString('ar-EG')
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info (Phone, WhatsApp, City) */}
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ink text-xs" dir="ltr">
                            {cust.phone || '-'}
                          </span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded hover:bg-emerald-50 transition-colors"
                              title="محادثة واتساب"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{cust.city || 'القاهرة'}</span>
                          {cust.address && <span className="text-[10px] truncate max-w-[120px]">({cust.address})</span>}
                        </div>
                        {cust.email && !cust.email.endsWith('@phone.store') && (
                          <div className="text-[10px] text-ink-soft/80 flex items-center gap-1 truncate max-w-[160px]">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{cust.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Branch Name */}
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink bg-paper border border-line px-2 py-0.5 rounded-lg">
                          <Building2 className="w-3 h-3 text-ink-soft" />
                          <span>{cust.branch?.name || 'الفرع الرئيسي'}</span>
                        </span>
                      </td>

                      {/* Orders Count */}
                      <td className="p-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20">
                          {cust.ordersCount || 0} طلبات
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="p-4 font-black text-ink">
                        {(cust.totalSpent || 0).toLocaleString()} {currency}
                      </td>

                      {/* Active Status */}
                      <td className="p-4 text-center">
                        {cust.active !== false ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3" />
                            <span>نشط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <UserX className="w-3 h-3" />
                            <span>معطل</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Optics Customer 360 Profile */}
                          <button
                            type="button"
                            onClick={() => setSelectedProfileCustomerId(cust._id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold transition-all shadow-xs"
                            title="عرض ملف وبروفايل العميل الشامل (الطلبات، الأمانات، الكشوفات)"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>بروفايل شامل</span>
                          </button>

                          {/* Dynamic Client Custom Profile / Prescription Button */}
                          {isProfileEnabled && (
                            <button
                              type="button"
                              onClick={() => setPrescriptionCustomer(cust)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition-all shadow-xs"
                              title={profileConfig.profileTitle || profileButtonLabel}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{profileButtonLabel}</span>
                              {(cust.customProfilesCount > 0 || cust.prescriptions?.length > 0) && (
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-black">
                                  {cust.customProfilesCount || cust.prescriptions?.length}
                                </span>
                              )}
                            </button>
                          )}

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cust)}
                            className="p-1.5 rounded-lg text-ink-soft hover:text-primary hover:bg-primary/10 transition-colors"
                            title="تعديل بيانات العميل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Password reset button */}
                          <button
                            type="button"
                            onClick={() => handleOpenPassword(cust)}
                            className="p-1.5 rounded-lg text-ink-soft hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                            title="تغيير كلمة المرور"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => setDeletingCustomer(cust)}
                            className="p-1.5 rounded-lg text-ink-soft hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="حذف حساب العميل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination Bar */}
        <div className="p-4 border-t border-line bg-paper/30 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-ink-soft">
          <div className="flex items-center gap-2">
            <span>عرض:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-paper border border-line rounded-lg px-2 py-1 text-ink outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>من إجمالي {pagination.total} عميل</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-line hover:bg-paper disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span>
              صفحة {page} من {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-line hover:bg-paper disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: EDIT CUSTOMER */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-line w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
              <h3 className="text-base font-black text-ink flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span>تعديل بيانات العميل: {editingCustomer.fullname}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1.5 rounded-xl text-ink-soft hover:text-ink hover:bg-paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">اسم العميل:</label>
                <input
                  type="text"
                  value={editForm.fullname}
                  onChange={(e) => setEditForm({ ...editForm, fullname: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">رقم الهاتف:</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary text-right"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">البريد الإلكتروني:</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">المدينة:</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">الفرع التابع له:</label>
                  <select
                    value={editForm.branchId}
                    onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  >
                    <option value="">الفرع الرئيسي / عام</option>
                    {(Array.isArray(branches) ? branches : []).map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">العنوان التفصيلي:</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="text-xs font-bold text-ink">حساب العميل نشط ومفعل</span>
                </label>
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-soft hover:bg-paper"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-sm transition-all"
                >
                  {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHANGE PASSWORD */}
      {passwordCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-line w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
              <h3 className="text-base font-black text-ink flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>تغيير كلمة المرور: {passwordCustomer.fullname}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPasswordCustomer(null)}
                className="p-1.5 rounded-xl text-ink-soft hover:text-ink hover:bg-paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              <p className="text-xs text-ink-soft leading-relaxed">
                أدخل كلمة المرور الجديدة للعميل. يمكن تعيينها كرقم هاتفه لتسهيل تسجيل دخوله فوراً.
              </p>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">كلمة المرور الجديدة:</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary font-mono"
                  required
                />
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPasswordCustomer(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-soft hover:bg-paper"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition-all"
                >
                  {isSavingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-line w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-600 flex items-center justify-center mx-auto border border-red-500/20">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-ink">
                تأكيد حذف حساب العميل
              </h3>
              <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
                هل أنت متأكد من حذف حساب العميل (<b>{deletingCustomer.fullname}</b>)؟
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-paper border border-line text-right space-y-1">
              <span className="text-[11px] font-bold text-primary block">
                🛡️ ضمان السلامة المحاسبية والإحصائية:
              </span>
              <p className="text-[10px] text-ink-soft leading-relaxed">
                سيتم حذف حساب العميل وبروفايل تفضيلاته، مع الإبقاء التام على كافة الفواتير والطلبات وسجلات الصيانة المحاسبية بدقة لعدم الإخلال بأرباح وتقارير المتجر.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-soft hover:bg-paper"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm transition-all"
              >
                {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Client Profile / Optics Prescription Modal */}
      {prescriptionCustomer && (
        <DynamicClientProfileModal
          customer={prescriptionCustomer}
          onClose={() => setPrescriptionCustomer(null)}
          onSuccess={() => loadCustomers()}
        />
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <AddCustomerModal
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={() => loadCustomers()}
          authHeader={authHeader}
          showToast={showToast}
          branches={branches}
        />
      )}

      {/* Optics Customer 360 Profile Modal */}
      {selectedProfileCustomerId && (
        <CustomerProfileModal
          customerId={selectedProfileCustomerId}
          onClose={() => setSelectedProfileCustomerId(null)}
          token={token}
          currency={currency}
          showToast={showToast}
          onOpenNewPrescription={(prof) => {
            setPrescriptionCustomer(prof);
          }}
        />
      )}
    </div>
  );
}
