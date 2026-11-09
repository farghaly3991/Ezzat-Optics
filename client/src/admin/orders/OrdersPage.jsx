import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingBag, Search, Eye, Truck, PackageCheck, CheckCircle2, Printer, Receipt, Plus, Wrench, ShoppingCart, Building2, Glasses, Clock, MessageCircle, BellRing } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import InvoiceModal from './components/InvoiceModal';
import AdminBranchSelector from '../shared/AdminBranchSelector';
import LabOrderActionModal from './components/LabOrderActionModal';
import OpticsThermalReceiptModal from '../pos/components/OpticsThermalReceiptModal';
import WorkOrderModal from '../labs/components/WorkOrderModal';
import SupplyRequestModal from '../pos/components/SupplyRequestModal';

export default function OrdersTab() {
  const navigate = useNavigate();
  const { token, config, showToast, activeBranchId, branches = [] } = useStore();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [orderTypeFilter, setOrderTypeFilter] = useState(''); // '' | 'lab' | 'direct' | 'service'

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== undefined) {
      setSearch(q);
    }
  }, [searchParams]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [activeLabOrderForAction, setActiveLabOrderForAction] = useState(null);
  const [activeThermalReceiptOrder, setActiveThermalReceiptOrder] = useState(null);
  const [actualCostInput, setActualCostInput] = useState('');
  const [actualCostNote, setActualCostNote] = useState('');
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [couriersList, setCouriersList] = useState([]);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [labsList, setLabsList] = useState([]);
  const [activeWorkOrderModalOrder, setActiveWorkOrderModalOrder] = useState(null);
  const [existingWorkOrderForModal, setExistingWorkOrderForModal] = useState(null);
  const [supplyRequestItem, setSupplyRequestItem] = useState(null);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseType, setNewExpenseType] = useState('lab');
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const currency = config?.currency || 'ج.م';

  const loadOrders = (type = orderTypeFilter, branchId = activeBranchId) => {
    let url = '/api/admin/orders?limit=150';
    if (type && type !== 'lab' && type !== 'direct') url += `&orderType=${type}`;
    if (branchId && branchId !== 'all') url += `&branchId=${branchId}`;
    axios.get(url, authHeader).then((r) => setOrders(r.data?.orders || []));
  };

  useEffect(() => {
    if (token) {
      loadOrders(orderTypeFilter, activeBranchId);
      axios.get('/api/admin/finance/shipping/couriers', authHeader)
        .then((r) => setCouriersList(r.data?.couriers || []))
        .catch(() => {});
      axios.get('/api/admin/labs', authHeader)
        .then((r) => setLabsList(r.data?.labs || []))
        .catch(() => {});
    }
  }, [token, orderTypeFilter, activeBranchId]);

  const handleOpenWorkOrderModal = async (ord) => {
    try {
      const res = await axios.get(`/api/admin/work-orders?orderId=${ord.orderId || ord._id}`, authHeader);
      const foundWO = (res.data?.workOrders || [])[0] || null;
      setExistingWorkOrderForModal(foundWO);
      setActiveWorkOrderModalOrder(ord);
    } catch (e) {
      setExistingWorkOrderForModal(null);
      setActiveWorkOrderModalOrder(ord);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !newExpenseTitle.trim() || !newExpenseAmount) return;
    setIsAddingExpense(true);
    try {
      const res = await axios.post(
        `/api/admin/orders/${selectedOrder.orderId || selectedOrder._id}/expenses`,
        {
          title: newExpenseTitle,
          amount: Number(newExpenseAmount),
          type: newExpenseType
        },
        authHeader
      );
      showToast('تمت إضافة المصروف وتحديث الأرباح بنجاح');
      setNewExpenseTitle('');
      setNewExpenseAmount('');
      if (res.data?.order) {
        setSelectedOrder(res.data.order);
      }
      loadOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر إضافة المصروف', 'error');
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!selectedOrder || !window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      const res = await axios.delete(
        `/api/admin/orders/${selectedOrder.orderId || selectedOrder._id}/expenses/${expenseId}`,
        authHeader
      );
      showToast('تم حذف المصروف');
      if (res.data?.order) {
        setSelectedOrder(res.data.order);
      }
      loadOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حذف المصروف', 'error');
    }
  };

  const handleOpenOrderDetails = (ord) => {
    setSelectedOrder(ord);
    const existingCourierId = ord.courier?.courierId?._id || ord.courier?.courierId || '';
    setSelectedCourierId(existingCourierId);
    setActualCostInput(
      ord.actualShippingCost !== undefined && ord.actualShippingCost !== null
        ? String(ord.actualShippingCost)
        : ord.shippingSnapshot?.actualCarrierCost !== null &&
          ord.shippingSnapshot?.actualCarrierCost !== undefined
        ? String(ord.shippingSnapshot.actualCarrierCost)
        : ''
    );
    setActualCostNote(ord.shippingCostNotes || ord.shippingSnapshot?.actualCostNote || '');
  };

  const handleCourierChange = (cId) => {
    setSelectedCourierId(cId);
    const courier = couriersList.find((c) => String(c._id) === String(cId));
    if (courier) {
      if (courier.type === 'internal_staff') {
        setActualCostInput('0');
        setActualCostNote(`مندوب داخلي براتب شهري (تكلفة إضافية = 0 ج.م ضمن OPEX)`);
      } else {
        setActualCostInput(String(courier.defaultCost || 45));
        setActualCostNote(`${courier.companyName || courier.name} - ${courier.phone || ''}`);
      }
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await axios.put(`/api/admin/orders/${orderId}/status`, { status: newStatus }, authHeader);
      showToast('تم تحديث حالة الطلب بنجاح');
      loadOrders();
      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder(res.data?.order || { ...selectedOrder, status: newStatus });
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحديث الحالة', 'error');
    }
  };

  const handleCompletePickup = async (orderId) => {
    try {
      const res = await axios.post(
        `/api/admin/finance/orders/${orderId}/complete-pickup`,
        { note: 'تم تأكيد استلام العميل للطلب من الفرع' },
        authHeader
      );
      showToast(res.data?.message || 'تم تأكيد استلام العميل للطلب من الفرع بنجاح');
      loadOrders();
      if (selectedOrder && selectedOrder._id === orderId && res.data?.order) {
        setSelectedOrder(res.data.order);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تأكيد الاستلام من الفرع', 'error');
    }
  };

  const handleSaveActualShippingCost = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSavingCost(true);
    try {
      const costNum = Number(actualCostInput || 0);

      // Save courier assignment if courier selected
      if (selectedCourierId) {
        await axios.post(
          `/api/admin/finance/shipping/orders/${selectedOrder._id}/assign-courier`,
          {
            courierId: selectedCourierId,
            actualCost: costNum,
            notes: actualCostNote
          },
          authHeader
        );
      }

      const res = await axios.post(
        `/api/admin/finance/orders/${selectedOrder._id}/actual-shipping-cost`,
        {
          actualCarrierCost: costNum,
          note: actualCostNote
        },
        authHeader
      );
      showToast('تم حفظ جهة الشحن وتكلفة التوصيل الفعلية بدقة!');
      if (res.data?.order) {
        setSelectedOrder(res.data.order);
      }
      loadOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل تكلفة الشحن الفعلية', 'error');
    } finally {
      setIsSavingCost(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-black text-ink flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <span>إدارة الطلبات والشحنات ({orders.length})</span>
        </h3>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/admin/carts')}
            className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border border-purple-500/20 text-xs font-black transition-all flex items-center gap-1.5"
            title="فحص السلات المتروكة وتنبيه العملاء"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>السلات المتروكة (Carts)</span>
          </button>

          <button
            onClick={() => navigate('/admin/pos')}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>+ إنشاء عملية بيع وفاتورة (POS)</span>
          </button>

          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب أو العميل..."
              className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs outline-none focus:border-primary pr-8 text-ink placeholder:text-ink-soft/50"
            />
            <Search className="w-3.5 h-3.5 text-ink-soft absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Local Branch Selector */}
      <AdminBranchSelector
        label="تصفية الطلبات حسب الفرع:"
        onChange={() => loadOrders(orderTypeFilter)}
      />

      {/* Optics & Order Type Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOrderTypeFilter('')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            !orderTypeFilter
              ? 'bg-primary text-[var(--color-primary-contrast,#ffffff)] shadow-sm'
              : 'bg-surface hover:bg-paper text-ink border border-line'
          }`}
        >
          جميع الفواتير والطلبات ({orders.length})
        </button>

        <button
          onClick={() => setOrderTypeFilter('lab')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            orderTypeFilter === 'lab'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-blue-600 dark:text-blue-400 border border-blue-500/40'
          }`}
        >
          <Glasses className="w-3.5 h-3.5" />
          <span>👓 أوامر معمل وتجهيز النظارات ({orders.filter((o) => o.isLabOrder).length})</span>
        </button>

        <button
          onClick={() => setOrderTypeFilter('direct')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            orderTypeFilter === 'direct'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>🧾 مبيعات فورية مكتملة ({orders.filter((o) => !o.isLabOrder && o.orderType !== 'service').length})</span>
        </button>

        <button
          onClick={() => setOrderTypeFilter('service')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            orderTypeFilter === 'service'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-surface hover:bg-paper text-orange-700 dark:text-orange-400 border border-orange-500/40'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>🔧 خدمات وصيانة ({orders.filter((o) => o.orderType === 'service' || o.hasServices).length})</span>
        </button>
      </div>

      <div className="rounded-card bg-surface border border-line overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper text-ink-soft font-bold border-b border-line">
              <tr>
                <th className="p-3.5">رقم الطلب / النوع</th>
                <th className="p-3.5">العميل</th>
                <th className="p-3.5">طريقة الاستلام</th>
                <th className="p-3.5">المبلغ والمدفوع</th>
                <th className="p-3.5">طريقة الدفع</th>
                <th className="p-3.5 text-center">حالة الطلب والتسليم</th>
                <th className="p-3.5 text-center">الطباعة وأمر التشغيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders
                .filter((o) => {
                  const matchSearch =
                    (o.orderId || '').toLowerCase().includes(search.toLowerCase()) ||
                    (o.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                    (o.customer?.phone || '').includes(search);
                  if (!matchSearch) return false;
                  if (orderTypeFilter === 'lab') return Boolean(o.isLabOrder);
                  if (orderTypeFilter === 'direct') return !o.isLabOrder && o.orderType !== 'service';
                  if (orderTypeFilter === 'service') return o.orderType === 'service' || o.hasServices;
                  return true;
                })
                .map((ord) => {
                  const isPickup =
                    ord.deliveryMethod === 'pickup' ||
                    ord.shippingSnapshot?.deliveryMethod === 'pickup';
                  const pays = ord.paymentsSnapshot || {
                    totalAmount: ord.total,
                    paidAmount: ord.total,
                    remainingAmount: 0
                  };
                  return (
                    <tr key={ord._id} className="hover:bg-paper/70 transition-colors">
                      <td className="p-3.5">
                        <span className="font-mono font-black text-primary block">{ord.orderId}</span>
                        {ord.isLabOrder && (
                          <span className="mt-1 text-[9px] bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-black border border-blue-500/40 inline-flex items-center gap-1">
                            <Glasses className="w-2.5 h-2.5" />
                            <span>أمر معمل وتجهيز</span>
                          </span>
                        )}
                        {ord.orderType === 'service' && (
                          <span className="mt-1 text-[9px] bg-orange-500/15 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-black border border-orange-500/40 inline-block">
                            🔧 حجز خدمة
                          </span>
                        )}
                        <div className="mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span>{ord.branchId?.name || (branches.find((b) => String(b._id) === String(ord.branchId))?.name) || 'الفرع الرئيسي'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 font-bold text-ink">
                        <div>{ord.customer?.name}</div>
                        <span className="text-[10px] text-ink-soft">{ord.customer?.phone}</span>
                      </td>
                      <td className="p-3.5">
                        {isPickup ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 border border-purple-500/30 text-[10px] font-black inline-flex items-center gap-1">
                            <PackageCheck className="w-3 h-3" />
                            <span>استلام من الفرع</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] font-bold inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span>توصيل</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-black text-ink">
                          {ord.total} {currency}
                        </div>
                        {pays && (
                          <div className="text-[10px] mt-0.5">
                            {pays.remainingAmount > 0 ? (
                              <span className="text-amber-600 font-bold">
                                متبقي: {pays.remainingAmount} {currency}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">خالصة بالكامل</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-ink">
                        {ord.payment?.method === 'cod' ? 'عند الاستلام' : ord.payment?.method === 'cash' ? 'نقدًا' : 'إلكتروني'}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <select
                            value={ord.status}
                            onChange={(e) => handleUpdateStatus(ord._id, e.target.value)}
                            className="bg-paper border border-line rounded-btn px-2.5 py-1 text-xs font-bold outline-none text-ink w-36 text-center"
                          >
                            <option value="new">جديد (new)</option>
                            <option value="confirmed">تم التأكيد (confirmed)</option>
                            <option value="preparing">قيد التجهيز (preparing)</option>
                            <option value="ready_for_pickup">بانتظار الاستلام (ready_for_pickup)</option>
                            <option value="shipped">تم الشحن (shipped)</option>
                            <option value="delivered">مكتمل / تم التسليم (delivered)</option>
                            <option value="cancelled">ملغي (cancelled)</option>
                          </select>

                          {isPickup &&
                            ['confirmed', 'preparing', 'ready_for_pickup'].includes(ord.status) && (
                              <button
                                type="button"
                                onClick={() => handleCompletePickup(ord._id)}
                                className="px-2.5 py-1 rounded-btn bg-emerald-600 text-white text-[10px] font-black hover:bg-emerald-700 whitespace-nowrap shadow-sm"
                                title="تأكيد أن العميل حضر واستلم الطلب من الفرع"
                              >
                                ✓ تأكيد استلام العميل
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setActiveThermalReceiptOrder(ord)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="معاينة وطباعة الفاتورة وإيصال المعمل الحراري (80mm)"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPrintingOrder(ord)}
                            className="p-1.5 text-ink-soft hover:text-primary hover:bg-paper rounded-lg transition-colors"
                            title="طباعة بوليصة A4"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenWorkOrderModal(ord)}
                            className="p-1.5 text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="أمر تشغيل خارجي للمعمل (Work Order)"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenOrderDetails(ord)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="عرض تفاصيل الطلب"
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
      </div>

      {/* Order Detail & Financial Snapshot Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface rounded-card border border-line p-6 w-full max-w-2xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto text-ink">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <div>
                <h4 className="font-mono font-black text-sm text-primary">
                  تفاصيل الطلب واللقطة المالية التاريخية: {selectedOrder.orderId}
                </h4>
                <span className="text-[11px] text-ink-soft">
                  طريقة الاستلام:{' '}
                  {selectedOrder.deliveryMethod === 'pickup'
                    ? 'استلام من الفرع (Pickup — شحن صفر)'
                    : `توصيل (${selectedOrder.shippingSnapshot?.selectedClassName || 'قياسي'})`}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-ink-soft hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1 font-bold text-ink p-3.5 bg-paper border border-line rounded-card">
              <p>العميل: {selectedOrder.customer?.name}</p>
              <p>الهاتف: {selectedOrder.customer?.phone}</p>
              <p>
                العنوان: {selectedOrder.customer?.address}
                {selectedOrder.customer?.city ? ` - ${selectedOrder.customer.city}` : ''}
              </p>
              {selectedOrder.customer?.notes && (
                <p className="text-primary">ملاحظات: {selectedOrder.customer?.notes}</p>
              )}
            </div>

            {/* Line Items with Historical Snapshots */}
            <div>
              <h5 className="text-xs font-black text-ink mb-2">
                المنتجات ولقطات الأسعار والتكلفة والشحن وقت الطلب:
              </h5>
              <div className="divide-y divide-line border border-line rounded-card overflow-hidden">
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="p-3 bg-paper/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-black text-ink block">
                        {it.name} (x{it.quantity})
                      </span>
                      <span className="text-[11px] text-ink-soft">
                        سعر البيع باللقطة: {it.price} {currency} | تكلفة الوحدة باللقطة:{' '}
                        {it.costPrice || 0} {currency} | نمط الشحن: {it.shippingMode || 'MAX'}
                        {it.isShippingBaseLine ? ' (القاعدة الأعلى Base)' : ''}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-left font-bold">
                        <span className="text-ink block">
                          صافي السطر: {it.netLineValue ?? it.price * it.quantity} {currency}
                        </span>
                        <span className="text-[10px] text-primary">
                          مساهمة الشحن: +{it.lineCustomerShipping || 0} {currency}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSupplyRequestItem({
                            productId: it.productId,
                            name: it.name,
                            quantity: it.quantity,
                            costPrice: it.costPrice || 0,
                            price: it.price || 0,
                            unitSlotKey: it.unitSlotKey || '',
                            unitSlotLabel: it.unitSlotLabel || '',
                            specs: it.specs || it.lensSpecs || {}
                          });
                        }}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[10px] font-black border border-amber-500/25 flex items-center gap-1 shadow-sm transition-all"
                        title="إنشاء وإرسال أمر توريد للمورد لهذا الصنف"
                      >
                        <BellRing className="w-3 h-3 text-amber-600" />
                        <span>📦 طلب توريد</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order-Level Financial Snapshot Summary */}
            <div className="p-3.5 rounded-card bg-paper border border-line text-xs space-y-1.5 font-bold">
              <div className="flex justify-between">
                <span className="text-ink-soft">إجمالي البضاعة قبل الخصم:</span>
                <span>{selectedOrder.subtotal} {currency}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>قيمة الخصم:</span>
                  <span>-{selectedOrder.discount} {currency}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-soft">
                  شحن العميل (القاعدة: {selectedOrder.shippingSnapshot?.baseShippingAmount ?? selectedOrder.shipping}{' '}
                  + إضافات ADD: {selectedOrder.shippingSnapshot?.additiveShippingAmount ?? 0}):
                </span>
                <span>{selectedOrder.shipping} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">لقطة تكلفة البضاعة الإجمالية:</span>
                <span>
                  {selectedOrder.financialSnapshot?.productCostTotal ?? 0} {currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">تكلفة الناقل المقدرة / الفعلية:</span>
                <span>
                  مقدرة: {selectedOrder.shippingSnapshot?.estimatedCarrierCost ?? 0} {currency} | فعلية:{' '}
                  {selectedOrder.shippingSnapshot?.actualCarrierCost !== null &&
                  selectedOrder.shippingSnapshot?.actualCarrierCost !== undefined
                    ? `${selectedOrder.shippingSnapshot.actualCarrierCost} ${currency} (${selectedOrder.shippingSnapshot.actualCostStatus})`
                    : 'غير محددة بعد (Unknown)'}
                </span>
              </div>
              <div className="pt-2 border-t border-line flex justify-between text-sm font-black text-ink">
                <span>الإجمالي النهائي للطلب:</span>
                <span className="text-primary">
                  {selectedOrder.total} {currency}
                </span>
              </div>
            </div>

            {/* Work Order & External Lab Integration */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                <div>
                  <h6 className="text-xs font-black text-ink">أمر تشغيل المعمل الخارجي (Work Order)</h6>
                  <p className="text-[11px] text-ink-soft">
                    {selectedOrder.workOrderId
                      ? `تم ربط أمر تشغيل رقم: ${selectedOrder.workOrderId}`
                      : 'تجهيز وتفصيل وتوجيه هذا الطلب لمعمل قص/تجميع خارجي'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenWorkOrderModal(selectedOrder)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Wrench className="w-4 h-4" />
                <span>{selectedOrder.workOrderId ? 'عرض / متابعة أمر التشغيل' : 'إنشاء أمر تشغيل للمعمل'}</span>
              </button>
            </div>

            {/* Order Expenses & True Net Profit */}
            <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <h6 className="text-xs font-black text-ink">مصاريف الطلب والتشغيل (Expenses & Net Profit)</h6>
                  <span className="text-[11px] text-ink-soft">
                    تسجيل تكاليف المعمل، الشحن، العمولات لحساب صافي الربح الحقيقي بدقة
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-ink-soft block">صافي الربح التقديري:</span>
                  <span className={`text-sm font-black ${(selectedOrder.netProfit ?? (selectedOrder.total - (selectedOrder.financialSnapshot?.productCostTotal || 0) - (selectedOrder.totalExpenses || 0))) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {(selectedOrder.netProfit ?? (selectedOrder.total - (selectedOrder.financialSnapshot?.productCostTotal || 0) - (selectedOrder.totalExpenses || 0))).toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              {/* Expenses List */}
              {selectedOrder.expenses && selectedOrder.expenses.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedOrder.expenses.map((exp, idx) => (
                    <div key={exp._id || idx} className="flex items-center justify-between p-2 rounded-xl bg-surface border border-line text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 text-[10px]">
                          {exp.type === 'lab' ? 'معمل' : exp.type === 'shipping' ? 'شحن' : exp.type === 'commission' ? 'عمولة' : 'أخرى'}
                        </span>
                        <span className="text-ink">{exp.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-red-500 font-black">-{Number(exp.amount).toLocaleString()} {currency}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp._id)}
                          className="text-ink-soft hover:text-red-500 p-1"
                          title="حذف المصروف"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold text-ink-soft pt-1">
                    <span>إجمالي مصاريف الطلب:</span>
                    <span className="font-mono font-black text-red-500">
                      -{Number(selectedOrder.totalExpenses || 0).toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-ink-soft italic">لا توجد مصاريف إضافية مسجلة على هذا الطلب بعد.</p>
              )}

              {/* Add Expense Form */}
              <form onSubmit={handleAddExpense} className="pt-2 border-t border-line flex flex-wrap gap-2 items-center text-xs">
                <input
                  type="text"
                  placeholder="بيان المصروف (مثلاً: مصنعية معمل، بوليصة شحن)..."
                  value={newExpenseTitle}
                  onChange={(e) => setNewExpenseTitle(e.target.value)}
                  className="flex-1 min-w-[140px] bg-surface border border-line rounded-xl p-2 text-ink"
                  required
                />
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  placeholder="المبلغ"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="w-24 bg-surface border border-line rounded-xl p-2 text-ink font-mono font-black"
                  required
                />
                <select
                  value={newExpenseType}
                  onChange={(e) => setNewExpenseType(e.target.value)}
                  className="bg-surface border border-line rounded-xl p-2 text-ink"
                >
                  <option value="lab">معمل</option>
                  <option value="shipping">شحن</option>
                  <option value="commission">عمولة</option>
                  <option value="packaging">تغليف</option>
                  <option value="other">أخرى</option>
                </select>
                <button
                  type="submit"
                  disabled={isAddingExpense}
                  className="px-3 py-2 rounded-xl bg-primary text-white font-black hover:bg-primary/90 disabled:opacity-50 transition-all text-xs"
                >
                  {isAddingExpense ? '...' : '+ إضافة'}
                </button>
              </form>
            </div>

            {/* Order Timeline & Return/Refund History */}
            {selectedOrder.timeline?.length > 0 && (
              <div className="space-y-2">
                <span className="block text-ink-soft text-xs font-bold">
                  سجل الأحداث وملاحظات الاسترداد المالي والمرتجعات (Timeline & Refunds):
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedOrder.timeline.map((evt, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs font-bold space-y-0.5 ${
                        evt.status === 'refund_processed'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : 'bg-paper border-line text-ink'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px] text-ink-soft">
                        <span className="font-mono">{evt.status}</span>
                        <span>{new Date(evt.at).toLocaleString('ar-EG')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{evt.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-Order Actual Carrier Shipping Cost & Courier Assignment */}
            {selectedOrder.deliveryMethod !== 'pickup' && (
              <form
                onSubmit={handleSaveActualShippingCost}
                className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/25 space-y-3 text-xs font-bold"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-indigo-600 font-black flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    <span>🚚 تعيين مندوب التوصيل وتوثيق تكلفة الشحن الفعلية على المتجر:</span>
                  </span>

                  {selectedCourierId && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const courier = couriersList.find((c) => String(c._id) === String(selectedCourierId));
                          const targetStaffId = courier?.staffUserId?._id || courier?.staffUserId || courier?._id;
                          const res = await axios.post(
                            `/api/admin/branches/${selectedOrder.branchId || 'main'}/staff/${targetStaffId}/review-token`,
                            { role: 'courier' },
                            authHeader
                          );
                          const link = `${window.location.origin}/review/staff/${res.data.reviewToken}`;
                          await navigator.clipboard.writeText(link);
                          showToast('تم نسخ رابط تقييم المندوب! أرسله للعميل عبر واتساب');
                        } catch (err) {
                          showToast('تعذر توليد رابط التقييم', 'error');
                        }
                      }}
                      className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-[10px] font-black transition-colors"
                    >
                      ★ نسخ رابط تقييم المندوب للعميل
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-ink-soft text-[10px] mb-1">المندوب / شركة الشحن:</label>
                    <select
                      value={selectedCourierId}
                      onChange={(e) => handleCourierChange(e.target.value)}
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    >
                      <option value="">-- اختر من دليل الشحن --</option>
                      {couriersList.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} {c.type === 'internal_staff' ? '(موظف دائم: 0 ج.م)' : `(${c.defaultCost} ج.م)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-ink-soft text-[10px] mb-1">
                      التكلفة الفعلية على المتجر (ج.م):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={actualCostInput}
                      onChange={(e) => setActualCostInput(e.target.value)}
                      placeholder="0 ج.م للموظف الثابت..."
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink font-black"
                    />
                  </div>

                  <div>
                    <label className="block text-ink-soft text-[10px] mb-1">رقم البوليصة / ملاحظة:</label>
                    <input
                      type="text"
                      value={actualCostNote}
                      onChange={(e) => setActualCostNote(e.target.value)}
                      placeholder="بوليصة الشحن أو ملاحظة..."
                      className="w-full bg-surface border border-line rounded-btn p-2 text-ink"
                    />
                  </div>
                </div>

                {actualCostInput === '0' && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                    ✓ التكلفة الإضافية للشحن = 0 ج.م (مندوب براتب شهري ثابت مسجل ضمن مصاريف التشغيل OPEX)
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingCost}
                    className="px-5 py-2 rounded-btn bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {isSavingCost ? 'جاري الحفظ...' : 'اعتماد وحفظ تكلفة الشحن'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {printingOrder && (
        <InvoiceModal
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
          config={config}
        />
      )}

      {/* Optics Lab Order Action Modal */}
      {activeLabOrderForAction && (
        <LabOrderActionModal
          order={activeLabOrderForAction}
          onClose={() => setActiveLabOrderForAction(null)}
          onUpdated={(updatedOrd) => {
            loadOrders();
            setActiveLabOrderForAction(null);
          }}
          onPrintSlip={(ord) => {
            setActiveThermalReceiptOrder(ord);
          }}
          showToast={showToast}
          token={token}
          currency={currency}
        />
      )}

      {/* 80mm Thermal Receipt / Lab Slip Modal */}
      {activeThermalReceiptOrder && (
        <OpticsThermalReceiptModal
          order={activeThermalReceiptOrder}
          onClose={() => setActiveThermalReceiptOrder(null)}
          showToast={showToast}
          currency={currency}
        />
      )}

      {/* Dynamic Work Order Modal */}
      {activeWorkOrderModalOrder && (
        <WorkOrderModal
          isOpen={true}
          order={activeWorkOrderModalOrder}
          existingWorkOrder={existingWorkOrderForModal}
          labs={labsList}
          authHeader={authHeader}
          showToast={showToast}
          onClose={() => {
            setActiveWorkOrderModalOrder(null);
            setExistingWorkOrderForModal(null);
          }}
          onSuccess={() => {
            loadOrders();
            setActiveWorkOrderModalOrder(null);
            setExistingWorkOrderForModal(null);
          }}
        />
      )}

      {/* Unified Supply Request Modal from Order Item */}
      {supplyRequestItem && (
        <SupplyRequestModal
          isOpen={true}
          item={supplyRequestItem}
          orderId={selectedOrder?.orderId}
          customerName={selectedOrder?.customer?.name}
          customerPhone={selectedOrder?.customer?.phone}
          onClose={() => setSupplyRequestItem(null)}
          onSuccess={() => {
            showToast('تم إرسال وإدراج أمر التوريد بنجاح');
            setSupplyRequestItem(null);
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
