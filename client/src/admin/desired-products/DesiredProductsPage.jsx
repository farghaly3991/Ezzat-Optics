import React, { useState, useEffect } from 'react';
import {
  Bell,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Phone,
  Trash2,
  RefreshCw,
  MessageCircle,
  ExternalLink,
  Layers,
  Send,
  Users,
  Wrench,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AdminRestockNotificationModal from '../products/components/AdminRestockNotificationModal';
import ConvertDesiredModal from './ConvertDesiredModal';

export default function DesiredProductsPage() {
  const { token, showToast, config } = useStore();

  const [activeTab, setActiveTab] = useState('desired'); // 'desired' | 'waitlists' | 'optics_supplies'
  const [requests, setRequests] = useState([]);
  const [waitlistSummary, setWaitlistSummary] = useState([]);
  const [opticsSupplies, setOpticsSupplies] = useState([]);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [selectedWaitlistProduct, setSelectedWaitlistProduct] = useState(null);
  const [convertingRequest, setConvertingRequest] = useState(null);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadData = () => {
    if (!token) return;
    setLoading(true);

    const fetchWaStatus = axios.get(
      '/api/admin/product-requests/whatsapp-status',
      authHeader
    );
    const fetchCats = axios.get('/api/admin/categories', authHeader);
    const fetchBranches = axios.get('/api/admin/branches', authHeader).catch(() => ({ data: {} }));
    const fetchOpticsSupplies = axios.get('/api/admin/orders/supplies/list', authHeader).catch(() => ({ data: { supplies: [] } }));

    if (activeTab === 'optics_supplies') {
      fetchOpticsSupplies
        .then((res) => {
          setOpticsSupplies(res.data?.supplies || []);
        })
        .catch((err) => {
          console.error('Error loading optics supplies:', err);
          showToast('فشل جلب قائمة نواقص وعدسات التوريد', 'error');
        })
        .finally(() => setLoading(false));
      return;
    }

    // Always fetch optics supplies in background for the counter badge
    fetchOpticsSupplies.then((res) => setOpticsSupplies(res.data?.supplies || [])).catch(() => {});

    if (activeTab === 'desired') {
      const fetchDesired = axios.get(
        '/api/admin/product-requests/desired-products',
        {
          ...authHeader,
          params: {
            page,
            limit: 30,
            status: statusFilter,
            categoryId: selectedCategory,
            search: search.trim()
          }
        }
      );

      Promise.all([fetchDesired, fetchWaStatus, fetchCats, fetchBranches])
        .then(([dRes, waRes, cRes, bRes]) => {
          setRequests(Array.isArray(dRes.data?.requests) ? dRes.data.requests : []);
          setTotalCount(typeof dRes.data?.totalCount === 'number' ? dRes.data.totalCount : 0);
          setWhatsAppStatus(waRes.data || null);
          const rawCats = cRes.data?.categories || cRes.data;
          setCategories(Array.isArray(rawCats) ? rawCats : []);
          setBranches(Array.isArray(bRes.data?.branches) ? bRes.data.branches : []);
        })
        .catch((err) => {
          console.error('Error loading desired products:', err);
          showToast('فشل جلب قائمة الطلبات المرغوبة', 'error');
        })
        .finally(() => setLoading(false));
    } else {
      const fetchSummary = axios.get(
        '/api/admin/product-requests/waitlists/summary',
        authHeader
      );

      Promise.all([fetchSummary, fetchWaStatus, fetchCats, fetchBranches])
        .then(([sRes, waRes, cRes, bRes]) => {
          setWaitlistSummary(Array.isArray(sRes.data?.summary) ? sRes.data.summary : []);
          setWhatsAppStatus(waRes.data || null);
          const rawCats = cRes.data?.categories || cRes.data;
          setCategories(Array.isArray(rawCats) ? rawCats : []);
          setBranches(Array.isArray(bRes.data?.branches) ? bRes.data.branches : []);
        })
        .catch((err) => {
          console.error('Error loading waitlist summary:', err);
          showToast('فشل جلب ملخص قوائم الانتظار', 'error');
        })
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadData();
  }, [token, activeTab, statusFilter, selectedCategory, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;

    try {
      await axios.delete(
        `/api/admin/product-requests/desired-products/${id}`,
        authHeader
      );
      showToast('تم حذف الطلب بنجاح');
      setRequests((prev) => prev.filter((r) => r._id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch (err) {
      showToast('فشل حذف الطلب', 'error');
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const notifiedCount = requests.filter((r) => r.status === 'notified').length;
  const convertedCount = requests.filter((r) => r.status === 'converted_to_service').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-primary" />
            <span>المنتجات المرغوبة وقوائم الانتظار</span>
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            متابعة طلبات العملاء المستقبلية، وتحويلها لخدمات وصيانة، وتوليد حسابات تلقائية برقم الهاتف
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2.5 rounded-card bg-surface hover:bg-paper border border-line text-ink transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي الطلبات المسجلة</span>
          <div className="text-2xl font-black text-ink">{totalCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-orange-600">طلبات مستقبلية معلقة</span>
          <div className="text-2xl font-black text-orange-600">{pendingCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-emerald-600">تم إشعارهم بالتوفر</span>
          <div className="text-2xl font-black text-emerald-600">{notifiedCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-primary">تم تحويلها لخدمات / صيانة</span>
          <div className="text-2xl font-black text-primary">{convertedCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">خدمة واتساب السحابية</span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                whatsAppStatus?.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'
              }`}
            />
            <span className="text-xs font-black text-ink">
              {whatsAppStatus?.isConfigured ? 'مفعلة للإرسال الآلي' : 'يدوي فقط'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-1">
        <button
          onClick={() => {
            setActiveTab('desired');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'desired'
              ? 'bg-primary text-white shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-paper'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>طلبات المنتجات المستقبلية (AI Desired Products)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('waitlists');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'waitlists'
              ? 'bg-primary text-white shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-paper'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>قوائم انتظار المنتجات النافذة ({waitlistSummary.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('optics_supplies');
            setPage(1);
          }}
          className={`px-4 py-2.5 rounded-btn text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'optics_supplies'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-ink-soft hover:text-ink hover:bg-paper'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>👓 نواقص وطلبات توريد العدسات ({opticsSupplies.length})</span>
        </button>
      </div>

      {/* TAB 1: DESIRED PRODUCTS */}
      {activeTab === 'desired' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="p-3.5 rounded-2xl bg-surface border border-line flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[180px]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بنص الطلب، اسم العميل، أو الهاتف..."
                  className="w-full pl-3 pr-8 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                />
                <Search className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">معلق (Pending)</option>
                <option value="matched">مطابق (Matched)</option>
                <option value="notified">تم الإشعار (Notified)</option>
                <option value="converted_to_service">تم التحويل لخدمة / صيانة</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
              >
                <option value="">كل الأقسام</option>
                {(Array.isArray(categories) ? categories : []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.displayName || c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-sm"
            >
              بحث
            </button>
          </form>

          {/* List of Requests */}
          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-ink-soft">
              جاري تحميل الطلبات المستقبلية...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center space-y-2 rounded-3xl bg-surface border border-line">
              <Sparkles className="w-10 h-10 text-ink-soft mx-auto opacity-50" />
              <h4 className="text-sm font-black text-ink">لا توجد طلبات مستقبلية مسجلة</h4>
              <p className="text-xs text-ink-soft max-w-sm mx-auto">
                عندما يبحث العملاء في الشات الذكي عن منتج غير متوفر، سيتم استخلاص مواصفاته وحفظه هنا آلياً لتتمكن من إشعاره أو تحويله إلى خدمة/صيانة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {requests.map((req) => (
                <div
                  key={req._id}
                  className="p-4 rounded-2xl bg-surface border border-line shadow-sm space-y-3 hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Status & Date */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          req.status === 'converted_to_service'
                            ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                            : req.status === 'notified'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : req.status === 'matched'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            : 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                        }`}
                      >
                        {req.status === 'converted_to_service'
                          ? `✓ تم التحويل لخدمة (#${req.convertedOrderCode || 'مؤكد'})`
                          : req.status === 'notified'
                          ? '✓ تم إشعار العميل'
                          : req.status === 'matched'
                          ? 'مطابق لمنتج جديد'
                          : 'بانتظار توفر منتج'}
                      </span>

                      <span className="text-[10px] text-ink-soft">
                        {new Date(req.createdAt).toLocaleDateString('ar-EG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    {/* Query & Extracted Name */}
                    <div>
                      <h4 className="font-black text-sm text-ink leading-snug">
                        {req.extractedName || req.queryText}
                      </h4>
                      <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">
                        نص استفسار العميل: "{req.queryText}"
                      </p>
                    </div>

                    {/* Category & Price Target */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {req.categoryName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-paper border border-line text-ink-soft">
                          القسم: {req.categoryName}
                        </span>
                      )}
                      {(req.targetPrice?.min || req.targetPrice?.max) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          الميزانية:{' '}
                          {req.targetPrice.max
                            ? `حتى ${req.targetPrice.max.toLocaleString()} ج.م`
                            : `من ${req.targetPrice.min.toLocaleString()} ج.م`}
                        </span>
                      )}
                    </div>

                    {/* Extracted Specs Badges */}
                    {req.specs && Object.keys(req.specs).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(req.specs).map(([k, v]) => (
                          <span
                            key={k}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-paper border border-line text-ink"
                          >
                            <b className="text-primary">{k}:</b> {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customer Info & Footer Actions */}
                  <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-ink-soft min-w-0">
                      {req.customerName && (
                        <span className="font-bold text-ink block text-xs truncate">
                          👤 {req.customerName}
                        </span>
                      )}
                      {req.phone ? (
                        <span className="font-mono font-bold text-ink block truncate" dir="ltr">
                          📱 {req.phone}
                        </span>
                      ) : (
                        <span className="text-[10px] truncate block">
                          معرف الجهاز: {req.visitorId?.slice(0, 8)}...
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Convert to Service / Maintenance Button */}
                      {req.status === 'converted_to_service' ? (
                        <Link
                          to={`/admin/maintenance?search=${encodeURIComponent(req.convertedOrderCode || '')}`}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 flex items-center gap-1 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                          <span>عرض المعاملة (#{req.convertedOrderCode})</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConvertingRequest(req)}
                          className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-black border border-primary/30 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="تحويل هذا الطلب لخدمة أو صيانة وإنشاء حساب للعميل"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>تحويل لخدمة / صيانة</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(req._id)}
                        className="p-1.5 rounded-lg text-ink-soft hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="حذف الطلب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OPTICS SUPPLIES REQUESTS */}
      {activeTab === 'optics_supplies' && (
        <div className="space-y-4">
          <div className="p-4 rounded-card bg-surface border border-line shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-ink-soft">
                إجمالي الأصناف المطلوب توريدها: <strong className="text-ink">{opticsSupplies.length} صنف</strong>
              </span>
              <h3 className="text-sm font-black text-ink flex items-center gap-2">
                <span>طلبات توريد العدسات والنواقص المسجلة من فواتير البيع</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-3">رقم الفاتورة / التاريخ</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">الصنف ومواصفات المقاس</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">المورد المقترح</th>
                    <th className="p-3 text-center">إرسال للمورد (واتساب)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {opticsSupplies.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-ink-soft font-bold">
                        لا توجد طلبات توريد معلقة حالياً. جميع الأصناف متوفرة بالمخزن! ✨
                      </td>
                    </tr>
                  ) : (
                    opticsSupplies.map((sup, idx) => {
                      const l = sup.lensSpecs;
                      let specsText = '';
                      if (l) {
                        specsText = `OD: SPH ${l.odSph || '0.00'} / CYL ${l.odCyl || '0.00'} | OS: SPH ${l.osSph || '0.00'} / CYL ${l.osCyl || '0.00'}`;
                        if (l.lensIndex) specsText += ` | معامل: ${l.lensIndex}`;
                        if (l.coatings) specsText += ` | طلاء: ${l.coatings}`;
                      }

                      const handleWhatsAppSupplier = () => {
                        const phone = sup.supplierPhone || '';
                        let cleanPhone = phone.replace(/[^\d+]/g, '');
                        if (!cleanPhone.startsWith('+')) {
                          if (cleanPhone.startsWith('0')) cleanPhone = '20' + cleanPhone.substring(1);
                          else cleanPhone = '20' + cleanPhone;
                        } else {
                          cleanPhone = cleanPhone.replace('+', '');
                        }

                        let msg = `السلام عليكم ورحمة الله،\nبرجاء تجهيز وتوريد الصنف التالي لفرعنا:\n`;
                        msg += `- *الصنف:* ${sup.itemName}\n`;
                        if (specsText) msg += `- *المقاسات والمواصفات:* ${specsText}\n`;
                        msg += `- *الكمية:* ${sup.quantity} قطعة\n`;
                        msg += `- *رقم إذن البيع/الطلب:* ${sup.orderId}\n`;
                        msg += `- *العميل:* ${sup.customerName}\nشكراً لتعاونكم.`;

                        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                        window.open(url, '_blank');
                      };

                      return (
                        <tr key={idx} className="hover:bg-paper/70 transition-colors">
                          <td className="p-3">
                            <Link
                              to={`/admin/orders?search=${sup.orderId}`}
                              className="font-mono font-black text-primary hover:underline block"
                            >
                              {sup.orderId}
                            </Link>
                            <span className="text-[10px] text-ink-soft">
                              {sup.createdAt ? new Date(sup.createdAt).toLocaleDateString('ar-EG') : ''}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-ink">
                            <div>{sup.customerName || 'عميل نقدي'}</div>
                            <span className="text-[10px] text-ink-soft font-mono">{sup.customerPhone}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-ink block">{sup.itemName}</span>
                            {specsText && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono block mt-0.5">
                                {specsText}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-black text-ink">{sup.quantity}</td>
                          <td className="p-3">
                            <span className="font-bold text-ink block">{sup.supplierName || 'غير محدد'}</span>
                            <span className="text-[10px] text-ink-soft font-mono">{sup.supplierPhone}</span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={handleWhatsAppSupplier}
                              className="px-3 py-1.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm inline-flex items-center gap-1.5 transition-all"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>مراسلة المورد</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTOCK WAITLISTS */}
      {activeTab === 'waitlists' && (
        <div className="space-y-4">
          <div className="rounded-card bg-surface border border-line overflow-hidden shadow-sm">
            <div className="p-4 border-b border-line bg-paper/50 flex items-center justify-between">
              <h4 className="text-xs font-black text-ink">
                المنتجات التي ينتظرها العملاء ({waitlistSummary.length} منتج)
              </h4>
              <span className="text-[11px] text-ink-soft font-bold">
                تحديث لحظي لحجوزات التوفر
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-3.5">المنتج</th>
                    <th className="p-3.5">القسم</th>
                    <th className="p-3.5">سعر المنتج</th>
                    <th className="p-3.5 text-center">عدد العملاء المنتظرين</th>
                    <th className="p-3.5">تاريخ آخر طلب</th>
                    <th className="p-3.5 text-center">إجراء الإشعار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {waitlistSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-ink-soft font-bold">
                        لا توجد طلبات انتظار نشطة لأي منتج حالياً.
                      </td>
                    </tr>
                  ) : (
                    waitlistSummary.map((item) => (
                      <tr key={item._id} className="hover:bg-paper/60 transition-colors">
                        <td className="p-3.5 flex items-center gap-3">
                          <img
                            src={
                              item.productSnapshot?.image ||
                              'https://images.unsplash.com/photo-1591076482161-42ce6da69f68?w=800'
                            }
                            alt=""
                            className="w-10 h-10 rounded-btn object-cover bg-paper border border-line flex-shrink-0"
                          />
                          <div>
                            <span className="font-bold text-ink block max-w-xs truncate">
                              {item.productSnapshot?.name || 'منتج غير معروف'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-ink-soft font-bold">
                          {item.productSnapshot?.categoryName || 'عام'}
                        </td>
                        <td className="p-3.5 font-black text-ink">
                          {item.productSnapshot?.price?.toLocaleString()} {config?.currency || 'ج.م'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-600 font-black text-xs">
                            {item.count} عميل منتظر
                          </span>
                        </td>
                        <td className="p-3.5 text-ink-soft">
                          {item.latestRequestAt
                            ? new Date(item.latestRequestAt).toLocaleDateString('ar-EG')
                            : '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedWaitlistProduct({
                                _id: item._id,
                                name: item.productSnapshot?.name,
                                price: item.productSnapshot?.price,
                                images: [item.productSnapshot?.image],
                                stockCount: 0
                              })
                            }
                            className="px-3 py-1.5 rounded-btn bg-primary hover:bg-primary/90 text-white font-black text-[11px] shadow-sm flex items-center gap-1.5 mx-auto transition-all active:scale-95"
                          >
                            <Send className="w-3 h-3" />
                            <span>إشعار التوفر</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPTICS SUPPLIES REQUESTS */}
      {activeTab === 'optics_supplies' && (
        <div className="space-y-4">
          <div className="p-4 rounded-card bg-surface border border-line shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-ink-soft">
                إجمالي الأصناف المطلوب توريدها: <strong className="text-ink">{opticsSupplies.length} صنف</strong>
              </span>
              <h3 className="text-sm font-black text-ink flex items-center gap-2">
                <span>طلبات توريد العدسات والنواقص المسجلة من فواتير البيع</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-3">رقم الفاتورة / التاريخ</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">الصنف ومواصفات المقاس</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">المورد المقترح</th>
                    <th className="p-3 text-center">إرسال للمورد (واتساب)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {opticsSupplies.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-ink-soft font-bold">
                        لا توجد طلبات توريد معلقة حالياً. جميع الأصناف متوفرة بالمخزن! ✨
                      </td>
                    </tr>
                  ) : (
                    opticsSupplies.map((sup, idx) => {
                      const l = sup.lensSpecs;
                      let specsText = '';
                      if (l) {
                        specsText = `OD: SPH ${l.odSph || '0.00'} / CYL ${l.odCyl || '0.00'} | OS: SPH ${l.osSph || '0.00'} / CYL ${l.osCyl || '0.00'}`;
                        if (l.lensIndex) specsText += ` | معامل: ${l.lensIndex}`;
                        if (l.coatings) specsText += ` | طلاء: ${l.coatings}`;
                      }

                      const handleWhatsAppSupplier = () => {
                        const phone = sup.supplierPhone || '';
                        let cleanPhone = phone.replace(/[^\d+]/g, '');
                        if (!cleanPhone.startsWith('+')) {
                          if (cleanPhone.startsWith('0')) cleanPhone = '20' + cleanPhone.substring(1);
                          else cleanPhone = '20' + cleanPhone;
                        } else {
                          cleanPhone = cleanPhone.replace('+', '');
                        }

                        let msg = `السلام عليكم ورحمة الله،\nبرجاء تجهيز وتوريد الصنف التالي لفرعنا:\n`;
                        msg += `- *الصنف:* ${sup.itemName}\n`;
                        if (specsText) msg += `- *المقاسات والمواصفات:* ${specsText}\n`;
                        msg += `- *الكمية:* ${sup.quantity} قطعة\n`;
                        msg += `- *رقم إذن البيع/الطلب:* ${sup.orderId}\n`;
                        msg += `- *العميل:* ${sup.customerName}\nشكراً لتعاونكم.`;

                        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                        window.open(url, '_blank');
                      };

                      return (
                        <tr key={idx} className="hover:bg-paper/70 transition-colors">
                          <td className="p-3">
                            <Link
                              to={`/admin/orders?search=${sup.orderId}`}
                              className="font-mono font-black text-primary hover:underline block"
                            >
                              {sup.orderId}
                            </Link>
                            <span className="text-[10px] text-ink-soft">
                              {sup.createdAt ? new Date(sup.createdAt).toLocaleDateString('ar-EG') : ''}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-ink">
                            <div>{sup.customerName || 'عميل نقدي'}</div>
                            <span className="text-[10px] text-ink-soft font-mono">{sup.customerPhone}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-ink block">{sup.itemName}</span>
                            {specsText && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono block mt-0.5">
                                {specsText}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-black text-ink">{sup.quantity}</td>
                          <td className="p-3">
                            <span className="font-bold text-ink block">{sup.supplierName || 'غير محدد'}</span>
                            <span className="text-[10px] text-ink-soft font-mono">{sup.supplierPhone}</span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={handleWhatsAppSupplier}
                              className="px-3 py-1.5 rounded-btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm inline-flex items-center gap-1.5 transition-all"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>مراسلة المورد</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Restock Notification Modal */}
      {selectedWaitlistProduct && (
        <AdminRestockNotificationModal
          product={selectedWaitlistProduct}
          isOpen={Boolean(selectedWaitlistProduct)}
          onClose={() => setSelectedWaitlistProduct(null)}
          onNotified={() => loadData()}
        />
      )}

      {/* Convert Desired Product to Service / Maintenance Modal */}
      {convertingRequest && (
        <ConvertDesiredModal
          request={convertingRequest}
          isOpen={Boolean(convertingRequest)}
          onClose={() => setConvertingRequest(null)}
          onConverted={() => loadData()}
          branches={branches}
        />
      )}
    </div>
  );
}
