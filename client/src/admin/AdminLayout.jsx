import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Store,
  Glasses,
  Menu,
  X,
  User,
  Eye,
  ScanBarcode,
  ShoppingBag,
  Wallet,
  TrendingUp,
  ClipboardList,
  Wrench,
  CalendarClock,
  RotateCcw,
  BellRing,
  Truck,
  Layers,
  Settings,
  LogOut,
  ExternalLink,
  LayoutDashboard,
  Code,
  UserCheck,
  Sparkles,
  Bot
} from 'lucide-react';
import { useStore } from '../shared/context/StoreContext';
import PageLoader from '../shared/components/PageLoader';
import AdminCopilotDrawer from './copilot/AdminCopilotDrawer';
import CloudSyncModal from './sync/CloudSyncModal';

/**
 * Modern Optics Store Executive Header & Navigation Bar
 * High clarity, light and cohesive aesthetic, 100% full-width workspace, clear bordered tabs.
 */
export default function AdminLayout() {
  const {
    user,
    config,
    isSuperAdmin,
    isBranchAdmin,
    isSalesStaff,
    isTechnician,
    isAdmin,
    branches,
    activeBranchId,
    loginUser,
    logoutUser,
    showToast
  } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isCloudOnline, setIsCloudOnline] = useState(false);

  // Periodic lightweight check for cloud connectivity
  useEffect(() => {
    let mounted = true;
    const checkCloud = async () => {
      try {
        const res = await fetch('/api/sync/status');
        const data = await res.json();
        if (mounted) setIsCloudOnline(Boolean(data.online));
      } catch (_) {
        if (mounted) setIsCloudOnline(false);
      }
    };
    checkCloud();
    const interval = setInterval(checkCloud, 30000); // check every 30s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Quick Login form state
  const [adminPhone, setAdminPhone] = useState('01000000000');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleAdminQuickLogin = async (e) => {
    e.preventDefault();
    setAdminLoginLoading(true);
    setAdminLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: adminPhone.trim(), password: adminPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }
      loginUser(data.user, data.token);
      showToast(`مرحباً بك ${data.user.fullname}`);
    } catch (err) {
      setAdminLoginError(err.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  if (!user || (!isAdmin && !isTechnician)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
        <div className="max-w-md w-full p-8 text-center rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-500/20">
            👓
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800">بوابة إدارة مركز البصريات</h3>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              تسجيل الدخول لطاقم العمل والمبيعات وأطباء الفحص برقم الهاتف
            </p>
          </div>

          <form onSubmit={handleAdminQuickLogin} className="space-y-4 text-right">
            {adminLoginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold text-center">
                ⚠️ {adminLoginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">رقم الهاتف أو البريد</label>
              <input
                type="text"
                required
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all text-left font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">كلمة المرور</label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all text-left font-mono"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={adminLoginLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {adminLoginLoading ? 'جاري الدخول...' : 'تسجيل الدخول للوحة التحكم'}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>الحساب الافتراضي: 01000000000</span>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>المتجر الرئيسي</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const assignedBranch = (isBranchAdmin || isSalesStaff || isTechnician)
    ? branches?.find((b) => String(b._id) === String(user.branchId))
    : null;

  const isRole6 = user?.role === 6;
  const enabledModules = config?.enabledModules || {};
  const nav = config?.navigationLabels || {};

  // Master Navigation tabs across the platform (fully dynamic & white-labeled)
  const ALL_TABS = [
    { path: 'overview', label: nav.analytics || 'الرئيسية والمؤشرات', icon: LayoutDashboard, badge: 'عام', moduleKey: 'analytics' },
    { path: 'pos', label: nav.pos || 'نقطة البيع (POS)', icon: ScanBarcode, isSpecial: true, badge: 'F1', moduleKey: 'pos' },
    { path: 'orders', label: nav.orders || 'الطلبات والمعمل', icon: ShoppingBag, badge: 'معمل', moduleKey: 'orders' },
    { path: 'labs', label: nav.labs || 'الورش والمعامل', icon: Building2, badge: 'SLA', moduleKey: 'labs' },
    { path: 'customers', label: nav.customers || 'العملاء', icon: Eye, badge: 'CRM', moduleKey: 'customers' },
    { path: 'products', label: nav.products || config?.productsTabLabel || (config?.systemProfile === 'retail' ? 'إدارة المنتجات والمخزون' : 'الشنابر والعدسات'), icon: Glasses, moduleKey: 'products' },
    { path: 'attendance', label: nav.attendance || 'تحضير الموظفين', icon: UserCheck, badge: 'سريع', moduleKey: 'attendance' },
    { path: 'procurement', label: nav.procurement || 'التوريدات والموردين', icon: Truck, badge: 'توريد', moduleKey: 'procurement' },
    { path: 'finance', label: nav.finance || 'الخزينة والمالية', icon: Wallet, moduleKey: 'finance' },
    { path: 'categories', label: nav.categories || 'الأقسام والتصنيفات', icon: Layers, moduleKey: 'categories' },
    { path: 'installments', label: nav.installments || 'الأقساط والتحصيل', icon: CalendarClock, moduleKey: 'installments' },
    { path: 'returns', label: nav.returns || 'المرتجعات والضمان', icon: RotateCcw, moduleKey: 'returns' },
    { path: 'maintenance', label: nav.maintenance || 'ورشة الصيانة والتجهيز', icon: Wrench, moduleKey: 'maintenance' },
    { path: 'desired-products', label: nav.desiredProducts || 'قوائم الانتظار ونواقص الطلب', icon: BellRing, badge: 'طلبات', moduleKey: 'desiredProducts' },
    { path: 'ai-instructions', label: nav.aiInstructions || 'تعليمات المساعد الذكي (AI)', icon: Bot, badge: 'AI', moduleKey: 'aiInstructions' },
    { path: 'coupons', label: nav.coupons || 'الكوبونات', icon: ShoppingBag, moduleKey: 'coupons' },
    { path: 'offers', label: nav.offers || 'العروض', icon: ShoppingBag, moduleKey: 'offers' },
    { path: 'carts', label: nav.carts || 'السلات المتروكة', icon: ShoppingBag, moduleKey: 'carts' },
    { path: 'facebook', label: nav.facebook || 'الفيسبوك', icon: ShoppingBag, moduleKey: 'facebook' },
    { path: 'theme', label: nav.theme || 'ثيم المتجر', icon: Settings, moduleKey: 'theme' },
    { path: 'branches', label: nav.branches || 'الفروع والموظفين', icon: Building2, moduleKey: 'branches' },
    { path: 'audit-logs', label: nav.auditLogs || 'سجل الرقابة', icon: ClipboardList, moduleKey: 'auditLogs' },
    { path: 'settings', label: nav.settings || 'إعدادات المتجر', icon: Settings, moduleKey: 'settings' },
    ...(isRole6 ? [
      { path: 'developer', label: 'بوابة المطور (Role 6)', icon: Code, badge: 'DEV', isDev: true }
    ] : [])
  ];

  // Dynamically filter tabs according to enabledModules
  const NAV_TABS = ALL_TABS.filter((item) => {
    if (item.isDev) return isRole6;
    // If a module is explicitly disabled in enabledModules, hide it from navigation
    if (item.moduleKey && enabledModules[item.moduleKey] !== undefined) {
      return Boolean(enabledModules[item.moduleKey]);
    }
    const defaultHiddenInOptics = ['coupons', 'offers', 'carts', 'facebook', 'theme'];
    return !defaultHiddenInOptics.includes(item.moduleKey);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans" dir="rtl">
      {/* 1. TOP BRAND & UTILITIES BAR (Clean White, High Clarity) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Right: Brand and Store Identity */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/admin/overview')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-900 tracking-wide">لوحة التحكم</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                    DASHBOARD
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {config?.general?.storeName || 'نظام إدارة العمليات المتكامل'}
                </p>
              </div>
            </div>

            {/* Current Active Branch Badge */}
            <div className="hidden lg:flex items-center gap-1.5 mr-3 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <Store className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 text-[11px] font-bold">الفرع:</span>
              <span className="font-black text-slate-800 text-[11px]">
                {assignedBranch?.name || 'الفرع الرئيسي'}
              </span>
            </div>
          </div>

          {/* Left: Quick Actions, User Profile, Storefront & Logout */}
          <div className="flex items-center gap-2.5">
            {/* Cloud Sync Button */}
            <button
              type="button"
              onClick={() => setSyncModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-xs ${
                isCloudOnline
                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
              title="مزامنة السحابة (Cloud Sync)"
            >
              <div className="relative">
                <span className={`w-2 h-2 rounded-full inline-block ${
                  isCloudOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`} />
              </div>
              <span>مزامنة السحابة</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                isCloudOnline ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {isCloudOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </button>

            {/* AI Executive Copilot Assistant Button */}
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              title="المساعد التنفيذي الذكي (AI Copilot)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="hidden sm:inline">المساعد الذكي</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-mono">AI</span>
            </button>

            {/* View Storefront Link */}
            <button
              onClick={() => navigate('/')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors border border-slate-200"
              title="الانتقال للمتجر الإلكتروني"
            >
              <span>المتجر</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            {/* User Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="text-right hidden md:block">
                <div className="text-xs font-black text-slate-900 leading-tight">{user.fullname}</div>
                <div className="text-[10px] text-slate-500 font-mono" dir="ltr">{user.phone}</div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                logoutUser();
                showToast('تم تسجيل الخروج بنجاح');
                navigate('/admin');
              }}
              className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 2. TABS BAR (CLEAR BORDERS, UNMISTAKABLE ACTIVE TAB) */}
        <div className="hidden xl:flex items-center px-4 sm:px-6 bg-slate-50 border-t border-slate-200 overflow-x-auto no-scrollbar gap-2 py-2">
          {NAV_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => {
                  if (isActive) {
                    return item.isSpecial
                      ? 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white border border-emerald-600 shadow-sm shadow-emerald-600/30 whitespace-nowrap shrink-0 transition-all'
                      : 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white border border-blue-600 shadow-sm shadow-blue-600/30 whitespace-nowrap shrink-0 transition-all';
                  }
                  return item.isSpecial
                    ? 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50/80 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 whitespace-nowrap shrink-0 transition-all'
                    : 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 whitespace-nowrap shrink-0 transition-all shadow-xs';
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-black shrink-0 border ${
                      pathname.includes(`/admin/${item.path}`)
                        ? 'bg-white/20 text-white border-white/30'
                        : item.isSpecial
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-white border-t border-slate-200 p-4 space-y-2 animate-in slide-in-from-top shadow-lg">
            <div className="text-[11px] font-black text-slate-500 px-2 mb-1">أقسام لوحة التحكم:</div>
            <div className="grid grid-cols-2 gap-2">
              {NAV_TABS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all ${
                        isActive
                          ? item.isSpecial
                            ? 'bg-emerald-600 text-white border-emerald-600 font-black'
                            : 'bg-blue-600 text-white border-blue-600 font-black'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 3. MAIN WORKSPACE (FULL 100% HORIZONTAL SPACE) */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet key={activeBranchId || 'all'} context={{ activeBranchId, branches }} />
        </Suspense>
      </main>

      {/* 4. FLOATING AI COPILOT LAUNCHER (Instant One-Click Access) */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          type="button"
          onClick={() => setCopilotOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-900 hover:to-purple-950 text-white shadow-2xl border border-indigo-500/30 hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="المساعد التنفيذي الذكي (AI Copilot)"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs font-black flex items-center gap-1.5">
              <span>المساعد الذكي</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-[10px] text-indigo-300 font-mono">Executive Copilot</div>
          </div>
        </button>
      </div>

      {/* 5. INTERACTIVE COPILOT DRAWER */}
      <AdminCopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />

      {/* 6. CLOUD SYNC MODAL */}
      <CloudSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}
