import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  ChevronLeft,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Loader2,
  RotateCcw,
  Wrench,
  ShieldCheck,
  AlertCircle,
  Phone,
  User,
  X,
  Send,
  Calendar
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

const statusMap = {
  new: { label: 'جديد', color: 'bg-blue-100 text-blue-800', icon: Clock },
  confirmed: { label: 'تم التأكيد', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  preparing: { label: 'جاري التجهيز', color: 'bg-orange-100 text-orange-800', icon: Package },
  ready_for_pickup: { label: 'جاهز للاستلام من الفرع', color: 'bg-purple-100 text-purple-800', icon: Package },
  shipped: { label: 'تم الشحن', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'تم التوصيل / الاستلام', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800', icon: XCircle },
  returned: { label: 'مسترجع', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

const serviceStatusMap = {
  new: { label: 'حجز جديد', color: 'bg-blue-100 text-blue-800', icon: Clock },
  confirmed: { label: 'تم تأكيد موعد الزيارة', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  preparing: { label: 'تجهيز الفني والمعدات', color: 'bg-orange-100 text-orange-800', icon: Package },
  shipped: { label: 'الفني في الطريق إليك', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'تم تنفيذ الخدمة بنجاح', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'تم إلغاء الحجز', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const returnStatusMap = {
  requested: { label: 'تم تقديم الطلب', color: 'bg-orange-100 text-orange-800' },
  approved: { label: 'تمت الموافقة وجاري تجهيز المندوب', color: 'bg-blue-100 text-blue-800' },
  courier_assigned: { label: 'مندوب الاستلام في الطريق إليك', color: 'bg-indigo-100 text-indigo-800' },
  picked_up: { label: 'تم استلام الشحنة من المندوب', color: 'bg-purple-100 text-purple-800' },
  inspected: { label: 'تم الفحص في المستودع', color: 'bg-teal-100 text-teal-950 dark:bg-teal-900/40 dark:text-teal-200' },
  refunded: { label: 'تم استرداد المبلغ بنجاح', color: 'bg-emerald-100 text-emerald-800' },
  in_maintenance: { label: 'جاري الفحص والصيانة بالمركز الفني', color: 'bg-indigo-100 text-indigo-800' },
  repaired: { label: 'تم إصلاح العطل بنجاح', color: 'bg-teal-100 text-teal-950 dark:bg-teal-900/40 dark:text-teal-200' },
  delivered_back: { label: 'تم تسليم الجهاز للعميل', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-800' },
};

export default function MyOrders() {
  const { token, user, showToast } = useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'returns'
  const [orders, setOrders] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals for return and maintenance
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [maintenanceModalOrder, setMaintenanceModalOrder] = useState(null);

  // Form states
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [requestReason, setRequestReason] = useState('defect');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadData = () => {
    if (!token) {
      navigate('/');
      return;
    }

    Promise.all([
      axios.get('/api/store-orders-public/my', authHeader).catch(() => ({ data: { orders: [] } })),
      axios.get('/api/store-orders-public/returns/my', authHeader).catch(() => ({ data: { requests: [] } }))
    ])
      .then(([ordersRes, returnsRes]) => {
        setOrders(ordersRes.data?.orders || []);
        setReturnRequests(returnsRes.data?.requests || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token, navigate]);

  // Open Return Request Modal
  const handleOpenReturnModal = (order) => {
    setReturnModalOrder(order);
    setSelectedProductIds((order.items || []).map((it) => it.productId));
    setRequestReason('عيب صناعة أو تلف بالمنتج');
    setRequestNotes('');
  };

  // Open Maintenance Request Modal
  const handleOpenMaintenanceModal = (order) => {
    setMaintenanceModalOrder(order);
    setSelectedProductIds((order.items || []).slice(0, 1).map((it) => it.productId));
    setRequestReason('عطل فني يحتاج فحص وصيانة');
    setRequestNotes('');
  };

  // Submit Request
  const handleSubmitRequest = async (type) => {
    const order = type === 'return' ? returnModalOrder : maintenanceModalOrder;
    if (!order) return;

    if (selectedProductIds.length === 0) {
      showToast('يرجى تحديد منتج واحد على الأقل', 'error');
      return;
    }

    const itemsPayload = (order.items || [])
      .filter((it) => selectedProductIds.includes(it.productId))
      .map((it) => ({
        productId: it.productId,
        quantity: it.quantity || 1,
        reason: requestReason
      }));

    setIsSubmitting(true);
    try {
      const payload = {
        orderId: order.orderId,
        type,
        items: itemsPayload,
        reason: requestReason,
        notes: requestNotes
      };

      const res = await axios.post('/api/store-orders-public/returns/request', payload, authHeader);
      showToast(res.data?.message || 'تم تقديم طلبك بنجاح');
      setReturnModalOrder(null);
      setMaintenanceModalOrder(null);
      setActiveTab('returns');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'فشل تقديم الطلب', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2.5">
            <Package className="w-7 h-7 text-primary" />
            <span>حسابي وطلباتي</span>
          </h1>
          <p className="text-xs text-ink-soft mt-1">
            متابعة الشحنات، فترات الضمان، وتقديم وتتبع طلبات الإرجاع والصيانة
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-paper border border-line">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>طلبات الشراء ({orders.filter((o) => o.orderType !== 'service').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'maintenance'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>
              طلبات وخدمات الصيانة (
              {returnRequests.filter((r) => r.type === 'maintenance').length +
                orders.filter((o) => o.orderType === 'service').length}
              )
            </span>
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'returns'
                ? 'bg-primary text-white shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>المرتجعات والريفند ({returnRequests.filter((r) => r.type === 'return').length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: REGULAR PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
              <ShoppingBag className="w-16 h-16 text-ink-soft/40" />
              <h2 className="text-xl font-bold text-ink">لا توجد طلبات بعد</h2>
              <p className="text-ink-soft text-sm">ابدأ التسوق واطلب منتجاتك المفضلة</p>
              <Link
                to="/catalog"
                className="bg-primary text-white px-6 py-2.5 rounded-btn font-bold hover:bg-primary/90 transition-colors shadow-sm"
              >
                تصفح المنتجات
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const isServiceOrder = order.orderType === 'service' || order.hasServices;
                const currentMap = isServiceOrder ? serviceStatusMap : statusMap;
                const st = currentMap[order.status] || currentMap.new || statusMap.new;
                const StatusIcon = st.icon;

                return (
                  <div
                    key={order._id}
                    className="bg-surface text-ink rounded-3xl border border-line shadow-sm overflow-hidden hover:shadow-md transition-all space-y-3"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between p-4 border-b border-line bg-paper/50 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-black text-ink">
                          #{order.orderId}
                        </span>
                        {isServiceOrder && (
                          <span className="text-[10px] bg-orange-500/15 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded font-black border border-orange-500/30">
                            🔧 حجز خدمة
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${st.color}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span>{st.label}</span>
                        </span>
                      </div>

                      <div className="text-xs text-ink-soft flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Order Items & Warranty Details */}
                    <div className="p-4 pt-1 space-y-3">
                      <div className="divide-y divide-line/60">
                        {order.items?.map((item, i) => (
                          <div
                            key={i}
                            className="py-2.5 first:pt-0 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  className="w-12 h-12 rounded-xl object-cover border border-line"
                                  alt=""
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-paper border border-line flex items-center justify-center text-ink-soft">
                                  <Package className="w-6 h-6" />
                                </div>
                              )}
                              <div>
                                <h4 className="text-sm font-bold text-ink">{item.name}</h4>
                                <div className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
                                  <span>الكمية: {item.quantity}</span>
                                  <span>•</span>
                                  <span className="font-mono">
                                    {(item.price || 0).toLocaleString()} {order.currency || 'ج.م'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Item Warranty Badge */}
                            <div className="flex items-center gap-2">
                              {item.warrantyMonths > 0 ? (
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 border ${
                                    item.isUnderWarranty
                                      ? 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20'
                                      : 'bg-orange-500/10 text-orange-700 border-orange-500/20'
                                  }`}
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>
                                    {item.isUnderWarranty
                                      ? `ضمان ساري (${item.warrantyMonths} شهر)`
                                      : 'منتهي الضمان'}
                                  </span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-ink-soft bg-paper border border-line">
                                  بدون ضمان
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Return Eligibility Banner & Action Buttons */}
                      <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {order.status === 'delivered' ? (
                            order.isReturnEligible ? (
                              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-black border border-emerald-500/20 flex items-center gap-1.5">
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>متاح الإرجاع (متبقي {order.returnDaysRemaining} يوماً)</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full bg-paper text-ink-soft text-xs font-bold border border-line">
                                انتهت فترة الإرجاع (15 يوماً)
                              </span>
                            )
                          ) : null}
                        </div>

                        {/* Customer Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          {order.status === 'delivered' && (
                            <>
                              {/* Request Return Button */}
                              {order.isReturnEligible && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReturnModal(order)}
                                  className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-800 border border-orange-500/30 text-xs font-black transition-all flex items-center gap-1.5"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>طلب إرجاع</span>
                                </button>
                              )}

                              {/* Request Maintenance Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenMaintenanceModal(order)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-800 border border-indigo-500/30 text-xs font-black transition-all flex items-center gap-1.5"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                <span>طلب صيانة</span>
                              </button>
                            </>
                          )}

                          <Link
                            to={`/track/${order.orderId}`}
                            className="px-3.5 py-1.5 rounded-xl bg-paper hover:bg-surface border border-line text-xs font-black text-ink transition-all flex items-center gap-1"
                          >
                            <span>تتبع الطلب</span>
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DEDICATED MAINTENANCE HUB */}
      {activeTab === 'maintenance' && (
        <>
          {returnRequests.filter((r) => r.type === 'maintenance').length === 0 &&
          orders.filter((o) => o.orderType === 'service').length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center p-8 rounded-3xl bg-surface border border-line">
              <Wrench className="w-14 h-14 text-ink-soft/40" />
              <h3 className="text-lg font-black text-ink">لا توجد طلبات أو خدمات صيانة حالياً</h3>
              <p className="text-xs text-ink-soft max-w-sm">
                يمكنك طلب صيانة لأي جهاز مشمول بالضمان من تبويب «طلبات الشراء»، أو حجز خدمة صيانة وفحص من المتجر.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Warranty & RMA Maintenance Tickets */}
              {returnRequests
                .filter((r) => r.type === 'maintenance')
                .map((req) => {
                  const rSt = returnStatusMap[req.status] || {
                    label: req.status,
                    color: 'bg-paper text-ink'
                  };
                  const isWarranty = req.warrantyStatus === 'in_warranty';

                  return (
                    <div
                      key={req._id}
                      className="p-5 rounded-3xl bg-surface border-2 border-line shadow-sm space-y-4"
                    >
                      {/* Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base text-amber-600">
                              {req.requestNumber}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-600 text-white flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5" />
                              <span>طلب صيانة جهاز</span>
                            </span>
                          </div>
                          <div className="text-xs text-ink-soft font-bold">
                            الطلب الأصلي: #{req.orderId}
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${rSt.color}`}
                          >
                            {rSt.label}
                          </span>
                          <span className="text-[11px] text-ink-soft block mt-1">
                            {new Date(req.createdAt).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Products & Warranty Cost Information */}
                      <div className="p-3.5 rounded-2xl bg-paper border border-line flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="text-ink-soft block">الجهاز المعيب:</span>
                          <span className="font-bold text-ink">
                            {req.items?.map((it) => it.name).join('، ') || 'جهاز صيانة'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isWarranty ? (
                            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-black flex items-center gap-1">
                              <ShieldCheck className="w-4 h-4" />
                              <span>مشمول بالضمان مجاناً (0 ج.م)</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-black">
                              صيانة مدفوعة (التكلفة: {req.amountDueFromCustomer || 0} ج.م)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Defect Notes */}
                      {req.reason && (
                        <div className="text-xs text-ink-soft">
                          <b className="text-ink">وصف العطل أو الشكوى:</b> {req.reason}
                        </div>
                      )}

                      {/* Assigned Tech Info */}
                      {req.assignedTechId && (
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-indigo-600" />
                            <span>
                              الفني المكلف بالصيانة: <b>{req.assignedTechId.fullname || req.assignedTechId.name}</b>
                            </span>
                          </div>
                          {req.assignedTechId.phone && (
                            <a
                              href={`https://wa.me/${req.assignedTechId.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 font-bold hover:underline"
                            >
                              تواصل واتساب مع الفني
                            </a>
                          )}
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="pt-2 border-t border-line space-y-2">
                        <span className="text-xs font-black text-ink block">مراحل تتبع الصيانة:</span>
                        <div className="space-y-2">
                          {req.timeline?.map((evt, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-xs">
                              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                              <div>
                                <div className="font-bold text-ink">{evt.title}</div>
                                {evt.note && <p className="text-[11px] text-ink-soft">{evt.note}</p>}
                                <span className="text-[10px] text-ink-soft font-mono">
                                  {new Date(evt.at).toLocaleString('ar-EG')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Direct Field Service Bookings */}
              {orders
                .filter((o) => o.orderType === 'service')
                .map((ord) => {
                  const sSt = serviceStatusMap[ord.status] || {
                    label: ord.status,
                    color: 'bg-paper text-ink'
                  };
                  return (
                    <div
                      key={ord._id}
                      className="p-5 rounded-3xl bg-surface border-2 border-line shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-base text-primary">
                              #{ord.orderId}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-600 text-white flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5" />
                              <span>حجز خدمة صيانة وزيارة</span>
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${sSt.color}`}>
                            {sSt.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-ink space-y-1">
                        <div><b>الخدمة المحجوزة:</b> {ord.items?.map((it) => it.name).join('، ')}</div>
                        <div className="font-mono font-bold text-primary">الإجمالي: {ord.total} ج.م</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* TAB 3: RETURNS & REFUNDS TRACKING */}
      {activeTab === 'returns' && (
        <>
          {returnRequests.filter((r) => r.type === 'return').length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center p-8 rounded-3xl bg-surface border border-line">
              <RotateCcw className="w-14 h-14 text-ink-soft/40" />
              <h3 className="text-lg font-black text-ink">لا توجد طلبات إرجاع حالياً</h3>
              <p className="text-xs text-ink-soft max-w-sm">
                يمكنك تقديم طلب إرجاع لأي طلب مكتمل ومستلم من تبويب «طلبات الشراء».
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {returnRequests
                .filter((r) => r.type === 'return')
                .map((req) => {
                const rSt = returnStatusMap[req.status] || {
                  label: req.status,
                  color: 'bg-paper text-ink'
                };

                return (
                  <div
                    key={req._id}
                    className="p-5 rounded-3xl bg-surface border-2 border-line shadow-sm space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-primary">
                            {req.requestNumber}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black ${
                              req.type === 'maintenance'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-orange-600 text-white'
                            }`}
                          >
                            {req.type === 'maintenance' ? '🔧 طلب صيانة' : '🔄 طلب إرجاع وريفند'}
                          </span>
                        </div>
                        <div className="text-xs text-ink-soft font-bold">
                          للطلب الأصلي: #{req.orderId}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${rSt.color}`}
                        >
                          {rSt.label}
                        </span>
                        <span className="text-[11px] text-ink-soft block mt-1">
                          {new Date(req.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Products Included */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-ink block">المنتجات بالطلب:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {req.items?.map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-2xl bg-paper border border-line flex items-center gap-2.5"
                          >
                            {it.image && (
                              <img
                                src={it.image}
                                className="w-10 h-10 rounded-lg object-cover"
                                alt=""
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-ink truncate">{it.name}</h5>
                              <div className="text-[11px] text-ink-soft flex items-center justify-between">
                                <span>الكمية: {it.quantity}</span>
                                <span className="font-mono font-bold text-primary">
                                  {it.price} ج.م
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Courier Pickup Information (If assigned) */}
                    {req.courier?.name && (
                      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-950 space-y-1.5 animate-in fade-in">
                        <div className="font-black flex items-center gap-2">
                          <Truck className="w-4 h-4 text-indigo-600" />
                          <span>بيانات مندوب الاستلام المتوجه إليك:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-bold text-[11px]">
                          <div>المندوب: {req.courier.name}</div>
                          {req.courier.phone && <div>الهاتف: {req.courier.phone}</div>}
                          {req.courier.trackingReference && (
                            <div>بوليصة الاستلام: {req.courier.trackingReference}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Refund Confirmation Notice */}
                    {req.status === 'refunded' && (
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-900 font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          تم تأكيد استلام الشحنة ورد مبلغ {req.refund?.amount} ج.م للعميل بنجاح{' '}
                          {req.refund?.method === 'paymob_online' ? '(عبر Paymob أونلاين)' : '(نقداً/تحويل)'}.
                        </span>
                      </div>
                    )}

                    {/* Timeline Journey Stepper */}
                    <div className="pt-2 border-t border-line space-y-2">
                      <span className="text-xs font-black text-ink block">مراحل تتبع الطلب:</span>
                      <div className="space-y-2">
                        {req.timeline?.map((evt, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs">
                            <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                            <div>
                              <div className="font-bold text-ink">{evt.title}</div>
                              {evt.note && <p className="text-[11px] text-ink-soft">{evt.note}</p>}
                              <span className="text-[10px] text-ink-soft font-mono">
                                {new Date(evt.at).toLocaleString('ar-EG')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL 1: REQUEST RETURN */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4 relative my-auto">
            <button
              onClick={() => setReturnModalOrder(null)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-black">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-ink">
                  طلب إرجاع للطلب #{returnModalOrder.orderId}
                </h3>
                <p className="text-xs text-ink-soft">
                  فترة الإرجاع مسموحة خلال 15 يوماً من استلام الشحنة
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitRequest('return');
              }}
              className="space-y-3.5 text-xs font-bold"
            >
              {/* Product Selection */}
              <div>
                <label className="block text-ink-soft mb-1.5">حدد المنتجات المراد إرجاعها:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {returnModalOrder.items?.map((it) => {
                    const isSelected = selectedProductIds.includes(it.productId);
                    return (
                      <label
                        key={it.productId}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-ink'
                            : 'bg-paper border-line text-ink-soft'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds((prev) => [...prev, it.productId]);
                              } else {
                                setSelectedProductIds((prev) =>
                                  prev.filter((id) => id !== it.productId)
                                );
                              }
                            }}
                            className="accent-primary"
                          />
                          <span>{it.name}</span>
                        </div>
                        <span className="font-mono">{it.price} ج.م</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-ink-soft mb-1">سبب طلب الإرجاع:</label>
                <select
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none"
                >
                  <option value="عيب صناعة أو تلف بالمنتج">عيب صناعة أو تلف بالمنتج</option>
                  <option value="المنتج غير مطابق للوصف والصور">المنتج غير مطابق للوصف والصور</option>
                  <option value="وصل منتج مختلف عن المطلوب">وصل منتج مختلف عن المطلوب</option>
                  <option value="تغيير الرأي (المنتج بحالته الأصلية)">
                    تغيير الرأي (المنتج بحالته الأصلية)
                  </option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-ink-soft mb-1">تفاصيل إضافية أو ملاحظات:</label>
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="اشرح المشكلة بالتفصيل لمساعدة فريق الفحص..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedProductIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الإرسال...' : 'إرسال طلب الإرجاع'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST MAINTENANCE */}
      {maintenanceModalOrder && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto animate-in fade-in">
          <div className="bg-surface text-ink rounded-3xl border border-line shadow-2xl w-full max-w-lg p-6 space-y-4 relative my-auto">
            <button
              onClick={() => setMaintenanceModalOrder(null)}
              className="absolute top-4 left-4 p-1.5 text-ink-soft hover:text-red-500 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-ink">
                  طلب صيانة للجهاز #{maintenanceModalOrder.orderId}
                </h3>
                <p className="text-xs text-ink-soft">
                  خدمة الصيانة الفنية متوفرة للأجهزة تحت الضمان وخارج الضمان
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitRequest('maintenance');
              }}
              className="space-y-3.5 text-xs font-bold"
            >
              {/* Product Selection */}
              <div>
                <label className="block text-ink-soft mb-1.5">اختر المنتج المراد صيانته:</label>
                <div className="space-y-2">
                  {maintenanceModalOrder.items?.map((it) => {
                    const isSelected = selectedProductIds.includes(it.productId);
                    return (
                      <label
                        key={it.productId}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-500/10 border-indigo-500 text-ink'
                            : 'bg-paper border-line text-ink-soft'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="maintenanceProduct"
                            checked={isSelected}
                            onChange={() => setSelectedProductIds([it.productId])}
                            className="accent-indigo-600"
                          />
                          <span>{it.name}</span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-black ${
                            it.isUnderWarranty
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {it.isUnderWarranty ? '✓ مشمول بالضمان' : 'خارج الضمان'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Symptoms / Defect */}
              <div>
                <label className="block text-ink-soft mb-1">وصف العطل أو المشكلة الفنية:</label>
                <textarea
                  rows={3}
                  required
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="يرجى كتابة وصف دقيق للعطل، وكيف ومتى ظهرت المشكلة..."
                  className="w-full p-2.5 rounded-xl bg-paper border border-line text-xs text-ink outline-none"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceModalOrder(null)}
                  className="px-4 py-2 rounded-xl bg-paper border border-line text-xs text-ink"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedProductIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الإرسال...' : 'إرسال طلب الصيانة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
