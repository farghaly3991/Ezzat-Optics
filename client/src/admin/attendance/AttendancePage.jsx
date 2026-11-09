import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Building2,
  ScanLine,
  RefreshCw,
  Clock,
  Sparkles,
  Users,
  ShieldCheck,
  Calendar,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AttendanceHubTab from '../branches/components/AttendanceHubTab';
import QuickAttendanceKioskModal from '../branches/components/QuickAttendanceKioskModal';

export default function AttendancePage() {
  const { token, user, showToast, branches } = useStore();
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branchesList, setBranchesList] = useState([]);
  const [branchStaff, setBranchStaff] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [kioskModalOpen, setKioskModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 1. Load branches if not in store or ensure freshness
  useEffect(() => {
    if (branches && branches.length > 0) {
      setBranchesList(branches);
      if (!selectedBranchId) {
        const defaultBranch = (user?.branchId && branches.find(b => String(b._id) === String(user.branchId))) || branches[0];
        if (defaultBranch) setSelectedBranchId(String(defaultBranch._id));
      }
    } else {
      loadBranches();
    }
  }, [branches, user]);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const res = await axios.get('/api/admin/branches', authHeader);
      const list = res.data?.branches || [];
      setBranchesList(list);
      if (list.length > 0 && !selectedBranchId) {
        const defaultBranch = (user?.branchId && list.find(b => String(b._id) === String(user.branchId))) || list[0];
        if (defaultBranch) setSelectedBranchId(String(defaultBranch._id));
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoadingBranches(false);
    }
  };

  // 2. Load staff for selected branch
  useEffect(() => {
    if (selectedBranchId && token) {
      loadStaff(selectedBranchId);
    }
  }, [selectedBranchId, token, refreshTrigger]);

  const loadStaff = async (bId) => {
    try {
      setLoadingStaff(true);
      const res = await axios.get(`/api/admin/branches/${bId}/staff`, authHeader);
      const manager = res.data?.manager;
      const staff = res.data?.staff || [];
      const combined = [
        ...(manager ? [{ ...manager, roleTitle: 'مدير الفرع' }] : []),
        ...staff
      ];
      setBranchStaff(combined);
    } catch (err) {
      console.error('Failed to load branch staff:', err);
      setBranchStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const currentBranch = branchesList.find(b => String(b._id) === String(selectedBranchId));

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-2 sm:px-4 text-ink font-sans">
      {/* Top Header Card */}
      <div className="bg-surface p-6 rounded-3xl border border-line shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-ink">تحضير الموظفين السريع (Quick Attendance Hub)</h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                نقطة التحضير المباشرة
              </span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              تسجيل الحضور والانصراف السريع عبر الباركود وQR الموظف، ومتابعة نوبات العمل والورديات دون الدخول في تفاصيل الفروع
            </p>
          </div>
        </div>

        {/* Actions & Branch Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {branchesList.length > 1 && (
            <div className="flex items-center gap-1.5 bg-paper border border-line rounded-2xl px-3 py-1.5 shadow-2xs">
              <Building2 className="w-4 h-4 text-ink-soft" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-black text-ink outline-none cursor-pointer py-1"
              >
                {branchesList.map((b) => (
                  <option key={b._id} value={b._id} className="bg-surface text-ink">
                    {b.name} {b.city ? `(${b.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setKioskModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-2xl font-black flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
          >
            <ScanLine className="w-4 h-4" />
            <span>فتح كشك الباركود / الـ QR ⚡</span>
          </button>

          <button
            type="button"
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            disabled={loadingStaff}
            className="p-2.5 rounded-2xl bg-paper hover:bg-line/40 text-ink border border-line text-xs transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStaff ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedBranchId ? (
        <div className="bg-surface rounded-3xl border border-line shadow-xs p-5 sm:p-6">
          <AttendanceHubTab
            branchId={selectedBranchId}
            branchName={currentBranch?.name || 'الفرع المحدد'}
            staffList={branchStaff}
            token={token}
            showToast={showToast}
            onOpenKiosk={() => setKioskModalOpen(true)}
          />
        </div>
      ) : (
        <div className="bg-surface rounded-3xl border border-line p-12 text-center text-ink-soft space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-sm font-bold">لا يوجد فرع نشط حالياً أو لم يتم العثور على فروع مسجلة</p>
        </div>
      )}

      {/* Quick Attendance Kiosk Scanner Modal */}
      <QuickAttendanceKioskModal
        isOpen={kioskModalOpen}
        onClose={() => setKioskModalOpen(false)}
        branchId={selectedBranchId}
        branchName={currentBranch?.name || ''}
        token={token}
        showToast={showToast}
        onSuccess={() => {
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </div>
  );
}
