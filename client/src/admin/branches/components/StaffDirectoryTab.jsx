import React, { useState } from 'react';
import {
  User,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Clock,
  QrCode,
  AlertCircle,
  TrendingUp,
  Award,
  Trash2,
  Edit,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Star,
  Users
} from 'lucide-react';
import axios from 'axios';

export default function StaffDirectoryTab({
  staff = [],
  manager = null,
  technicians = [],
  branchId,
  branchName,
  isSuperAdmin,
  isBranchAdmin,
  token,
  showToast,
  onRefresh,
  onOpenAddStaff,
  onOpenEditStaff,
  onOpenProfile,
  onOpenDeduction
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // Combine manager, staff, technicians into unified list with unique IDs
  const allStaffCombined = React.useMemo(() => {
    const list = [];
    const seen = new Set();

    if (manager && manager._id) {
      list.push({ ...manager, role: 4, roleName: 'مدير الفرع' });
      seen.add(String(manager._id));
    }

    staff.forEach((s) => {
      if (!seen.has(String(s._id))) {
        list.push({ ...s, roleName: 'موظف مبيعات' });
        seen.add(String(s._id));
      }
    });

    technicians.forEach((t) => {
      if (!seen.has(String(t._id))) {
        list.push({ ...t, roleName: 'فني صيانة' });
        seen.add(String(t._id));
      }
    });

    return list;
  }, [manager, staff, technicians]);

  const filteredStaff = allStaffCombined.filter((emp) => {
    if (roleFilter !== 'all' && String(emp.role) !== roleFilter) return false;
    if (typeFilter !== 'all' && (emp.employmentType || 'permanent') !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = emp.fullname?.toLowerCase().includes(q);
      const matchEmail = emp.email?.toLowerCase().includes(q);
      const matchPhone = emp.phone?.toLowerCase().includes(q);
      const matchJob = emp.jobTitle?.toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchJob;
    }
    return true;
  });

  const handleDeleteStaff = async (emp) => {
    if (!window.confirm(`هل أنت متأكد من حذف الموظف «${emp.fullname}» من طاقم عمل الفرع؟`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/branches/${branchId}/staff/${emp._id}`, authHeader);
      showToast(`تم حذف الموظف «${emp.fullname}» بنجاح`);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل حذف الموظف', 'error');
    }
  };

  const roleLabels = {
    5: 'سوبر آدمن',
    4: 'مدير فرع',
    3: 'موظف مبيعات',
    2: 'فني صيانة'
  };

  return (
    <div className="space-y-6">
      
      {/* Action Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، البريد، الهاتف، المسمى..."
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-paper border border-line text-ink focus:outline-none focus:border-primary"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-paper border border-line text-ink"
          >
            <option value="all">جميع الأدوار ({allStaffCombined.length})</option>
            <option value="4">مديرو الفروع</option>
            <option value="3">موظفو المبيعات والكاشير</option>
            <option value="2">فنيو الصيانة</option>
          </select>

          {/* Employment Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-paper border border-line text-ink"
          >
            <option value="all">كافة أنواع التعاقد</option>
            <option value="permanent">موظف دائم (براتب شهري)</option>
            <option value="per_task">موظف بالطلب أو بالمهمة</option>
          </select>
        </div>

        {(isSuperAdmin || isBranchAdmin) && (
          <button
            onClick={onOpenAddStaff}
            className="px-4 py-2.5 rounded-xl bg-primary text-white font-black text-xs flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة موظف جديد للفرع</span>
          </button>
        )}
      </div>

      {/* Staff Cards Grid */}
      {filteredStaff.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-surface border border-line text-ink-soft space-y-2">
          <Users className="w-12 h-12 mx-auto text-ink-soft/40" />
          <p className="font-bold">لم يتم العثور على موظفين في هذا الفرع تطابق معايير البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map((emp) => {
            const isMgr = emp.role === 4;
            const isPermanent = (emp.employmentType || 'permanent') === 'permanent';

            return (
              <div
                key={emp._id}
                className="rounded-3xl bg-surface border border-line p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* Card Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-lg">
                        {emp.fullname?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="font-black text-ink text-sm flex items-center gap-1.5">
                          <span>{emp.fullname}</span>
                          {isMgr && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              مدير
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-ink-soft">
                          {emp.jobTitle || roleLabels[emp.role] || 'عضو طاقم العمل'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        isPermanent
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25'
                      }`}
                    >
                      {isPermanent ? 'دائم براتب' : 'بالمهمة'}
                    </span>
                  </div>

                  {/* Contact details */}
                  <div className="text-[11px] space-y-1 text-ink-soft font-bold">
                    <div className="truncate">{emp.email}</div>
                    <div>الهاتف: {emp.phone || 'غير مسجل'}</div>
                  </div>

                  {/* Compensation & Shift badges */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line text-[11px]">
                    <div className="p-2 rounded-xl bg-paper border border-line">
                      <span className="text-ink-soft block text-[10px]">الراتب الشهري</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-300">
                        {emp.monthlySalary ? `${Number(emp.monthlySalary).toLocaleString()} ج.م` : 'بالقطعة / صفر'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-paper border border-line">
                      <span className="text-ink-soft block text-[10px]">ساعات العمل</span>
                      <span className="font-black text-ink">
                        {emp.shiftStart && emp.shiftEnd ? `${emp.shiftStart}-${emp.shiftEnd}` : 'مرن'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenProfile(emp)}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>الملف الشامل</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenDeduction(emp)}
                      title="تسجيل خصم مالي"
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onOpenEditStaff(emp)}
                      title="تعديل بيانات الموظف"
                      className="p-2 rounded-xl bg-paper border border-line text-ink hover:text-primary transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {!isMgr && (
                      <button
                        onClick={() => handleDeleteStaff(emp)}
                        title="حذف الموظف من الفرع"
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
