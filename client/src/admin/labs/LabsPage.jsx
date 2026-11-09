import React, { useState, useEffect } from 'react';
import {
  Building2,
  Wrench,
  Plus,
  Phone,
  MessageCircle,
  MapPin,
  Star,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Calendar,
  Layers,
  ChevronLeft
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import AddEditLabModal from './components/AddEditLabModal';
import WorkOrderModal from './components/WorkOrderModal';

export default function LabsPage() {
  const { token, showToast } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [activeTab, setActiveTab] = useState('labs'); // 'labs' | 'work_orders'
  const [labs, setLabs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [isAddLabModalOpen, setIsAddLabModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  // Fetch Labs & Work Orders
  const loadData = async () => {
    setLoading(true);
    try {
      const [labsRes, woRes] = await Promise.all([
        axios.get('/api/admin/labs', authHeader),
        axios.get('/api/admin/work-orders?limit=100', authHeader)
      ]);
      setLabs(labsRes.data?.labs || []);
      setWorkOrders(woRes.data?.workOrders || []);
    } catch (err) {
      console.error('Failed to load labs data:', err);
      showToast('تعذر تحميل بيانات الورش والمعامل', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const filteredLabs = labs.filter((lab) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      lab.name?.toLowerCase().includes(q) ||
      lab.specialty?.toLowerCase().includes(q) ||
      lab.city?.toLowerCase().includes(q) ||
      lab.phone?.includes(q)
    );
  });

  const filteredWorkOrders = workOrders.filter((wo) => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      wo.workOrderNumber?.toLowerCase().includes(q) ||
      wo.orderId?.toLowerCase().includes(q) ||
      wo.customer?.name?.toLowerCase().includes(q) ||
      wo.labName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shadow-xs">
            🔬
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>إدارة الورش والمعامل وأوامر التشغيل</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                SLA & Quality Engine
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة أوامر قص العدسات، مسارات التنفيذ، قياس سرعة الإنجاز، وتقييم كفاءة الورش الخارجية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingLab(null);
              setIsAddLabModalOpen(true);
            }}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معمل / ورشة جديدة</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Labs Directory vs Work Orders */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('labs')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'labs'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>دليل الورش والمعامل ({labs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('work_orders')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'work_orders'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>أوامر التشغيل الجارية ({workOrders.length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-64 hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder={activeTab === 'labs' ? 'بحث بالاسم، المدينة، التخصص...' : 'بحث برقم الأمر، العميل، المعمل...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* TAB 1: LABS DIRECTORY */}
      {activeTab === 'labs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLabs.map((lab) => {
            const stats = lab.stats || {};
            const ratingScore = lab.rating?.score || 5;

            return (
              <div
                key={lab._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all space-y-4 relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Lab Top Info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-amber-600" />
                        <span>{lab.name}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{lab.specialty}</p>
                    </div>

                    {/* Rating Badge */}
                    <div className="px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 font-mono font-black text-xs flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{ratingScore.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Location & Contact */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{lab.city} · {lab.address || 'وسط البلد'}</span>
                    </div>
                    {lab.phone && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{lab.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Performance SLA Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold">متوسط الإنجاز</div>
                      <div className="font-black text-slate-900 dark:text-white font-mono mt-0.5">
                        {stats.avgTurnaroundHours || 24} س
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold">أوامر منفذة</div>
                      <div className="font-black text-emerald-700 font-mono mt-0.5">
                        {stats.completedOrders || 0}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold">التزام الموعد</div>
                      <div className="font-black text-indigo-700 font-mono mt-0.5">
                        {stats.onTimeRate || 98}%
                      </div>
                    </div>
                  </div>

                  {/* Custom Stages Pipeline Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block">
                      مراحل أمر التشغيل المعتمدة ({lab.customStages?.length || 5}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(lab.customStages || []).map((st, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600"
                        >
                          {st.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLab(lab);
                      setIsAddLabModalOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors"
                  >
                    تعديل البيانات والمراحل
                  </button>

                  {lab.whatsappPhone && (
                    <a
                      href={`https://wa.me/${lab.whatsappPhone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      title="مراسلة المعمل بالواتساب"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: WORK ORDERS LIST */}
      {activeTab === 'work_orders' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {['all', 'in_progress', 'completed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-amber-600 text-white font-black shadow-xs'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                {st === 'all' ? 'كافة أوامر الشغل' : st === 'in_progress' ? 'قيد التجهيز بالمعمل' : 'مكتملة ومستلمة'}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {filteredWorkOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                لا توجد أوامر تشغيل مطابقة للفلاتر الحالية
              </div>
            ) : (
              filteredWorkOrders.map((wo) => (
                <div
                  key={wo._id}
                  onClick={() => setSelectedWorkOrder(wo)}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-mono font-black text-xs flex items-center justify-center">
                      WO
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-white font-mono">
                          #{wo.workOrderNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          {wo.currentStageLabel}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        طلب #{wo.orderId} · العميل: <b>{wo.customer?.name}</b> · المعمل: <b>{wo.labName}</b>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-left">
                    <div>
                      <span className="text-slate-400 block text-[10px]">التكلفة الإجمالية</span>
                      <span className="font-black text-slate-800">
                        {wo.financials?.totalCost || 0} ج.م
                      </span>
                    </div>

                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Lab Modal */}
      {isAddLabModalOpen && (
        <AddEditLabModal
          isOpen={isAddLabModalOpen}
          onClose={() => setIsAddLabModalOpen(false)}
          lab={editingLab}
          authHeader={authHeader}
          showToast={showToast}
          onSuccess={loadData}
        />
      )}

      {/* View Work Order Modal */}
      {selectedWorkOrder && (
        <WorkOrderModal
          isOpen={Boolean(selectedWorkOrder)}
          onClose={() => setSelectedWorkOrder(null)}
          order={{ orderId: selectedWorkOrder.orderId, customer: selectedWorkOrder.customer, workOrderId: selectedWorkOrder._id }}
          existingWorkOrder={selectedWorkOrder}
          labs={labs}
          authHeader={authHeader}
          showToast={showToast}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
