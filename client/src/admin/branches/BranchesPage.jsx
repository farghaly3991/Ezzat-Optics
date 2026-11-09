import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Edit,
  Store,
  MapPin,
  Phone,
  MessageCircle,
  UserCheck,
  UserPlus,
  Users,
  Package,
  CheckCircle,
  XCircle,
  Star,
  ExternalLink,
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  Truck,
  ScanLine,
  Lock,
  ArrowRight,
  ChevronDown
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

// Modular Tab & Modal Components
import StaffDirectoryTab from './components/StaffDirectoryTab';
import AttendanceHubTab from './components/AttendanceHubTab';
import DeductionsTab from './components/DeductionsTab';
import ShippingCouriersTab from './components/ShippingCouriersTab';
import StaffReviewsTab from './components/StaffReviewsTab';
import StaffProfileModal from './components/StaffProfileModal';
import AddEditStaffModal from './components/AddEditStaffModal';
import QuickAttendanceKioskModal from './components/QuickAttendanceKioskModal';
import AddDeductionModal from './components/AddDeductionModal';
import AddEditCourierModal from './components/AddEditCourierModal';

export default function BranchesPage() {
  const {
    token,
    user,
    showToast,
    isSuperAdmin,
    isBranchAdmin,
    fetchBranches: refreshGlobalBranches
  } = useStore();

  const [branchesList, setBranchesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Focused branch: null means viewing all branch cards (for Super Admin)
  // When set to an ID, view focuses on that specific branch's HR & operations
  const [focusedBranchId, setFocusedBranchId] = useState(null);

  // Sub-tabs when focused on a branch: 'staff' | 'attendance' | 'deductions' | 'couriers' | 'reviews'
  const [branchTab, setBranchTab] = useState('staff');

  // Branch Add/Edit Modal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Branch Staff data
  const [branchStaffData, setBranchStaffData] = useState({
    manager: null,
    staff: [],
    technicians: []
  });
  const [loadingStaff, setLoadingStaff] = useState(false);

  // HR Modals
  const [profileModalStaff, setProfileModalStaff] = useState(null);
  const [addEditStaffModal, setAddEditStaffModal] = useState({ isOpen: false, staff: null });
  const [kioskModalOpen, setKioskModalOpen] = useState(false);
  const [addDeductionModal, setAddDeductionModal] = useState({ isOpen: false, preselectedStaff: null });
  const [addEditCourierModal, setAddEditCourierModal] = useState({ isOpen: false, courier: null });

  const initialForm = {
    name: '',
    code: '',
    city: 'القاهرة',
    address: '',
    phone: '',
    whatsapp: '',
    image: '',
    isMain: false,
    active: true,
    createManager: false,
    managerName: '',
    managerEmail: '',
    managerPassword: ''
  };

  const [form, setForm] = useState(initialForm);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const loadBranches = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/branches', authHeader);
      const list = res.data?.branches || [];
      setBranchesList(list);

      // If branch admin (Role 4), lock focus to their assigned branch
      if (isBranchAdmin && user?.branchId) {
        setFocusedBranchId(String(user.branchId));
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تحميل الفروع', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadBranches();
    }
  }, [token]);

  // Load Staff for the focused branch
  const loadBranchStaff = async (bId) => {
    const targetId = bId || focusedBranchId;
    if (!targetId) return;

    try {
      setLoadingStaff(true);
      const res = await axios.get(`/api/admin/branches/${targetId}/staff`, authHeader);
      setBranchStaffData({
        manager: res.data?.manager || null,
        staff: res.data?.staff || [],
        technicians: res.data?.technicians || []
      });
    } catch (err) {
      setBranchStaffData({ manager: null, staff: [], technicians: [] });
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (focusedBranchId) {
      loadBranchStaff(focusedBranchId);
    }
  }, [focusedBranchId]);

  // Visible branches strictly filtered (Branch Admin only ever sees their own branch)
  const visibleBranches = isBranchAdmin && user?.branchId
    ? branchesList.filter((b) => String(b._id) === String(user.branchId))
    : branchesList;

  const currentFocusedBranch = branchesList.find((b) => String(b._id) === String(focusedBranchId)) || visibleBranches[0];

  const handleOpenAddBranch = () => {
    setEditingBranch(null);
    setForm(initialForm);
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name || '',
      code: branch.code || '',
      city: branch.city || 'القاهرة',
      address: branch.address || '',
      phone: branch.phone || '',
      whatsapp: branch.whatsapp || '',
      image: branch.image || '',
      isMain: Boolean(branch.isMain),
      active: branch.active !== false,
      createManager: false,
      managerName: branch.managerId?.fullname || '',
      managerEmail: branch.managerId?.email || '',
      managerPassword: ''
    });
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('يرجى كتابة اسم الفرع', 'error');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        image: form.image.trim(),
        isMain: Boolean(form.isMain),
        active: Boolean(form.active)
      };

      if (form.createManager && form.managerEmail && form.managerPassword) {
        payload.managerData = {
          fullname: form.managerName.trim() || `مدير ${form.name}`,
          email: form.managerEmail.trim(),
          password: form.managerPassword,
          phone: form.phone
        };
      }

      if (editingBranch) {
        await axios.put(`/api/admin/branches/${editingBranch._id}`, payload, authHeader);
        showToast(`تم تعديل بيانات الفرع «${form.name}» بنجاح!`);
      } else {
        await axios.post('/api/admin/branches', payload, authHeader);
        showToast(`تم إنشاء الفرع «${form.name}» بنجاح!`);
      }

      setIsBranchModalOpen(false);
      loadBranches();
      refreshGlobalBranches();
    } catch (err) {
      showToast(err.response?.data?.error || 'حدث خطأ أثناء حفظ الفرع', 'error');
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (branch.isMain) {
      showToast('لا يمكن حذف الفرع الرئيسي للمتجر', 'error');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف الفرع «${branch.name}» نهائياً؟`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/branches/${branch._id}`, authHeader);
      showToast('تم حذف الفرع بنجاح');
      loadBranches();
      refreshGlobalBranches();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حذف الفرع', 'error');
    }
  };

  const filteredBranches = visibleBranches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name?.toLowerCase().includes(q) ||
      b.code?.toLowerCase().includes(q) ||
      b.city?.toLowerCase().includes(q) ||
      b.address?.toLowerCase().includes(q)
    );
  });

  const allStaffCombined = [
    ...(branchStaffData.manager ? [branchStaffData.manager] : []),
    ...(branchStaffData.staff || []),
    ...(branchStaffData.technicians || [])
  ];

  const totalBranchesCount = branchesList.length;
  const activeBranchesCount = branchesList.filter((b) => b.active).length;
  const totalStaffCount = branchesList.reduce((acc, b) => acc + (b.staffCount || b.staffBreakdown?.total || 0), 0);
  const totalProductsCount = branchesList.reduce((acc, b) => acc + (b.productsCount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-line shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xl shadow-xs">
            🏢
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-ink">
                إدارة الفروع وشؤون الموظفين والتشغيل (Branches & HR)
              </h2>
              {isBranchAdmin && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-950 border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  مدير فرع معتمد (عزل كامل)
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft mt-0.5">
              إدارة الفروع وعزل الصلاحيات، شؤون الموظفين، الحضور والانصراف بالـ QR، والخصومات ومصاريف التشغيل
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            loadBranches();
            if (focusedBranchId) loadBranchStaff(focusedBranchId);
          }}
          title="تحديث البيانات"
          className="p-2.5 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${loading || loadingStaff ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* VIEW 1: SUPER ADMIN BRANCHES NETWORK OVERVIEW (When no branch is focused) */}
      {!focusedBranchId && isSuperAdmin && (
        <div className="space-y-6 animate-in fade-in">
          {/* Overview Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-ink">{totalBranchesCount}</div>
                <div className="text-xs text-ink-soft">إجمالي الفروع المسجلة</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-emerald-600">{activeBranchesCount}</div>
                <div className="text-xs text-ink-soft">فروع نشطة حالياً</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-ink">{totalStaffCount}</div>
                <div className="text-xs text-ink-soft">إجمالي طاقم العمل</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-black text-ink">{totalProductsCount}</div>
                <div className="text-xs text-ink-soft">منتجات مخصصة بالفروع</div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم، الكود، المدينة، أو العنوان..."
                  className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-paper border border-line text-ink focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              onClick={handleOpenAddBranch}
              className="px-4 py-2.5 rounded-xl bg-primary text-white font-black text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فرع جديد</span>
            </button>
          </div>

          {/* Branches Cards Grid */}
          {loading ? (
            <div className="text-center py-16 text-ink-soft text-sm">جاري تحميل بيانات الفروع...</div>
          ) : filteredBranches.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-surface border border-line text-ink-soft space-y-2">
              <Building2 className="w-12 h-12 mx-auto text-ink-soft/40" />
              <p className="font-bold">لم يتم العثور على فروع مطابقة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBranches.map((branch) => {
                const breakdown = branch.staffBreakdown || {
                  total: branch.staffCount || 0,
                  managers: branch.managerId ? 1 : 0,
                  sales: 0,
                  techs: 0
                };

                return (
                  <div
                    key={branch._id}
                    className="relative rounded-3xl overflow-hidden border border-line transition-all duration-200 bg-surface flex flex-col justify-between shadow-sm hover:shadow-md"
                  >
                    {branch.image && (
                      <div className="h-32 w-full relative overflow-hidden bg-paper">
                        <img
                          src={branch.image}
                          alt={branch.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/20" />
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            {!branch.image && (
                              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-primary border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center font-bold text-xl shadow-xs">
                                🏢
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-ink text-base">{branch.name}</h3>
                                {branch.isMain && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                    الرئيسي
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-ink-soft font-bold">
                                كود: {branch.code}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              branch.active
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-600 border-red-500/20'
                            }`}
                          >
                            {branch.active ? 'نشط' : 'معطل'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 text-xs text-ink-soft py-2.5 border-y border-line/60">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{branch.city} - {branch.address}</span>
                          </div>

                          {branch.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span dir="ltr">{branch.phone}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">
                              المدير: {branch.managerId?.fullname || 'غير معين'}
                            </span>
                          </div>
                        </div>

                        {/* Staff Count Breakdown */}
                        <div className="py-2.5 flex flex-wrap items-center gap-1.5 border-b border-line/40">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{breakdown.total} موظف</span>
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-paper border border-line text-ink-soft">
                            👔 {breakdown.managers} مدير
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-paper border border-line text-ink-soft">
                            🛒 {breakdown.sales} مبيعات
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-paper border border-line text-ink-soft">
                            🔧 {breakdown.techs} فني
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setFocusedBranchId(branch._id);
                            setBranchTab('staff');
                          }}
                          className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5"
                        >
                          <Users className="w-4 h-4" />
                          <span>إدارة موظفي وعمليات هذا الفرع ←</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditBranch(branch)}
                            title="تعديل بيانات الفرع"
                            className="p-2 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {!branch.isMain && (
                            <button
                              onClick={() => handleDeleteBranch(branch)}
                              title="حذف الفرع"
                              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FOCUSED BRANCH HR & OPERATIONS WORKSPACE */}
      {focusedBranchId && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Focused Branch Top Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/20 via-surface to-indigo-950/10 border-2 border-primary/20 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {isSuperAdmin && (
                <button
                  onClick={() => setFocusedBranchId(null)}
                  className="px-3.5 py-2 rounded-xl bg-paper border border-line text-ink hover:text-primary hover:border-primary text-xs font-black transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة لكافة الفروع</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <h3 className="text-base font-black text-ink">
                  {currentFocusedBranch?.name} ({currentFocusedBranch?.city})
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-paper border border-line font-bold text-ink-soft">
                  كود: {currentFocusedBranch?.code}
                </span>
                {currentFocusedBranch?.managerId && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-950 border border-indigo-500/30">
                    المدير: {currentFocusedBranch.managerId.fullname}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Switcher for Super Admin */}
            {isSuperAdmin && visibleBranches.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-soft font-bold">التبديل إلى فرع آخر:</span>
                <select
                  value={focusedBranchId}
                  onChange={(e) => setFocusedBranchId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-paper border border-line text-xs font-black text-ink focus:outline-none focus:border-primary"
                >
                  {visibleBranches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sub-Tabs Navigation for this branch */}
          <div className="flex flex-wrap gap-2 border-b border-line pb-2 text-xs font-black">
            <button
              onClick={() => setBranchTab('staff')}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all ${
                branchTab === 'staff'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-surface text-ink-soft hover:text-ink border border-line'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>دليل موظفي الفرع ({allStaffCombined.length})</span>
            </button>

            <button
              onClick={() => setBranchTab('attendance')}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all ${
                branchTab === 'attendance'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-surface text-ink-soft hover:text-ink border border-line'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>سجل الحضور والانصراف (QR)</span>
            </button>

            <button
              onClick={() => setBranchTab('deductions')}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all ${
                branchTab === 'deductions'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-surface text-ink-soft hover:text-ink border border-line'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              <span>سجل الخصومات والجزاءات</span>
            </button>

            <button
              onClick={() => setBranchTab('couriers')}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all ${
                branchTab === 'couriers'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-surface text-ink-soft hover:text-ink border border-line'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>جهات الشحن ومندوبو التوصيل</span>
            </button>

            <button
              onClick={() => setBranchTab('reviews')}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all ${
                branchTab === 'reviews'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'bg-surface text-ink-soft hover:text-ink border border-line'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>تقييمات العملاء للفنيين والمناديب</span>
            </button>
          </div>

          {/* TAB CONTENT */}

          {/* 1. Staff Directory Tab */}
          {branchTab === 'staff' && (
            <StaffDirectoryTab
              staff={branchStaffData.staff}
              manager={branchStaffData.manager}
              technicians={branchStaffData.technicians}
              branchId={focusedBranchId}
              branchName={currentFocusedBranch?.name}
              isSuperAdmin={isSuperAdmin}
              isBranchAdmin={isBranchAdmin}
              token={token}
              showToast={showToast}
              onRefresh={() => loadBranchStaff(focusedBranchId)}
              onOpenAddStaff={() => setAddEditStaffModal({ isOpen: true, staff: null })}
              onOpenEditStaff={(staffMember) => setAddEditStaffModal({ isOpen: true, staff: staffMember })}
              onOpenProfile={(staffMember) => setProfileModalStaff(staffMember)}
              onOpenDeduction={(staffMember) => setAddDeductionModal({ isOpen: true, preselectedStaff: staffMember })}
            />
          )}

          {/* 2. Attendance Hub Tab */}
          {branchTab === 'attendance' && (
            <AttendanceHubTab
              branchId={focusedBranchId}
              branchName={currentFocusedBranch?.name}
              staffList={allStaffCombined}
              token={token}
              showToast={showToast}
              onOpenKiosk={() => setKioskModalOpen(true)}
            />
          )}

          {/* 3. Deductions Tab */}
          {branchTab === 'deductions' && (
            <DeductionsTab
              branchId={focusedBranchId}
              branchName={currentFocusedBranch?.name}
              staffList={allStaffCombined}
              token={token}
              showToast={showToast}
              onOpenAddDeduction={() => setAddDeductionModal({ isOpen: true, preselectedStaff: null })}
            />
          )}

          {/* 4. Shipping Couriers Tab */}
          {branchTab === 'couriers' && (
            <ShippingCouriersTab
              branchId={focusedBranchId}
              branchName={currentFocusedBranch?.name}
              staffList={allStaffCombined}
              token={token}
              showToast={showToast}
              onOpenAddCourier={() => setAddEditCourierModal({ isOpen: true, courier: null })}
              onOpenEditCourier={(courier) => setAddEditCourierModal({ isOpen: true, courier })}
            />
          )}

          {/* 5. Staff Reviews Tab */}
          {branchTab === 'reviews' && (
            <StaffReviewsTab
              branchId={focusedBranchId}
              branchName={currentFocusedBranch?.name}
              staffList={allStaffCombined}
              token={token}
              showToast={showToast}
            />
          )}

        </div>
      )}

      {/* ----------------- MODALS ----------------- */}

      {/* Staff Comprehensive Profile Modal */}
      {profileModalStaff && (
        <StaffProfileModal
          staff={profileModalStaff}
          branchId={focusedBranchId}
          branchName={currentFocusedBranch?.name}
          onClose={() => setProfileModalStaff(null)}
          token={token}
          showToast={showToast}
        />
      )}

      {/* Add / Edit Staff Modal */}
      <AddEditStaffModal
        isOpen={addEditStaffModal.isOpen}
        editingStaff={addEditStaffModal.staff}
        branchId={focusedBranchId}
        branchesList={branchesList}
        isSuperAdmin={isSuperAdmin}
        token={token}
        showToast={showToast}
        onClose={() => setAddEditStaffModal({ isOpen: false, staff: null })}
        onSuccess={() => loadBranchStaff(focusedBranchId)}
      />

      {/* Quick Attendance Kiosk Modal */}
      <QuickAttendanceKioskModal
        isOpen={kioskModalOpen}
        onClose={() => setKioskModalOpen(false)}
        branchId={focusedBranchId}
        branchName={currentFocusedBranch?.name}
        token={token}
        showToast={showToast}
        onSuccess={() => loadBranchStaff(focusedBranchId)}
      />

      {/* Add Deduction Modal */}
      <AddDeductionModal
        isOpen={addDeductionModal.isOpen}
        onClose={() => setAddDeductionModal({ isOpen: false, preselectedStaff: null })}
        branchId={focusedBranchId}
        staffList={allStaffCombined}
        preselectedStaffId={addDeductionModal.preselectedStaff?._id}
        token={token}
        showToast={showToast}
        onSuccess={() => loadBranchStaff(focusedBranchId)}
      />

      {/* Add / Edit Courier Modal */}
      <AddEditCourierModal
        isOpen={addEditCourierModal.isOpen}
        onClose={() => setAddEditCourierModal({ isOpen: false, courier: null })}
        editingCourier={addEditCourierModal.courier}
        staffList={allStaffCombined}
        branchId={focusedBranchId}
        token={token}
        showToast={showToast}
        onSuccess={() => loadBranchStaff(focusedBranchId)}
      />

      {/* Add / Edit Branch Modal (Super Admin only) */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-surface border border-line rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-line flex items-center justify-between bg-paper/50">
              <h3 className="text-base font-black text-ink">
                {editingBranch ? `تعديل الفرع: ${editingBranch.name}` : 'إضافة فرع جديد للمتجر'}
              </h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="p-2 rounded-xl bg-paper border border-line text-ink-soft hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="p-5 space-y-4 text-xs font-bold max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">اسم الفرع *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="فرع المهندسين..."
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">كود الفرع (Code)</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="MHD-01"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">المدينة *</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="الجيزة"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">العنوان التفصيلي</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="شارع جامعة الدول..."
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-soft mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01000000000"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">واتساب</label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="01000000000"
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink-soft mb-1">رابط صورة الفرع</label>
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono text-[11px]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-paper border border-line space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isMain}
                    onChange={(e) => setForm({ ...form, isMain: e.target.checked })}
                    className="rounded text-primary"
                  />
                  <span>تعيين كالفرع الرئيسي للمتجر (Main Central Branch)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded text-primary"
                  />
                  <span>الفرع نشط ويستقبل الطلبات</span>
                </label>
              </div>

              {/* Manager Creation if new branch */}
              {!editingBranch && (
                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer font-black text-ink">
                    <input
                      type="checkbox"
                      checked={form.createManager}
                      onChange={(e) => setForm({ ...form, createManager: e.target.checked })}
                      className="rounded text-primary"
                    />
                    <span>إنشاء حساب مدير لهذا الفرع (Role 4 - Branch Admin)</span>
                  </label>

                  {form.createManager && (
                    <div className="space-y-2 pt-2 border-t border-indigo-500/20">
                      <div>
                        <label className="block text-ink-soft mb-1">اسم المدير</label>
                        <input
                          type="text"
                          value={form.managerName}
                          onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                          placeholder="اسم المدير..."
                          className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-ink-soft mb-1">البريد الإلكتروني *</label>
                          <input
                            type="email"
                            required={form.createManager}
                            value={form.managerEmail}
                            onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
                            placeholder="manager@branch.com"
                            className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                          />
                        </div>
                        <div>
                          <label className="block text-ink-soft mb-1">كلمة المرور *</label>
                          <input
                            type="password"
                            required={form.createManager}
                            value={form.managerPassword}
                            onChange={(e) => setForm({ ...form, managerPassword: e.target.value })}
                            placeholder="••••••••"
                            className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 rounded-btn bg-paper border border-line text-ink text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-btn bg-primary text-white text-xs font-black shadow-md hover:bg-primary/90"
                >
                  {editingBranch ? 'تحديث الفرع' : 'إنشاء وحفظ الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
