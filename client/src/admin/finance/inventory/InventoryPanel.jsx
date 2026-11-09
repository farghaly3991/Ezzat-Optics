import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  Boxes,
  AlertTriangle,
  ArrowUpDown,
  RefreshCw,
  Download,
  ShieldAlert,
  RotateCcw,
  Sliders
} from 'lucide-react';
import axios from 'axios';

const MOVEMENT_TYPE_LABELS = {
  supplier_receipt: 'استلام من شحنة مورد (+)',
  customer_sale: 'بيع لعميل (-)',
  customer_return: 'مرتجع عميل قابل للبيع (+)',
  order_cancellation_restore: 'استرجاع طلب ملغى (+)',
  supplier_return: 'مرتجع إلى المورد (-)',
  damaged_or_lost: 'تالف أو مفقود (-)',
  manual_adjustment: 'تسوية جرد يدوية (±)',
  reservation_hold: 'حجز مخزون (Hold)',
  reservation_release: 'تحرير حجز (Release)'
};

export default function FinanceInventoryPanel({ token, currency, showToast, shipments = [], onRefreshAudit }) {
  const [valuation, setValuation] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [levelError, setLevelError] = useState(null);

  // Receiving Form State (C2)
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectedShipmentDoc, setSelectedShipmentDoc] = useState(null);
  const [receivingLines, setReceivingLines] = useState([]);
  const [receivingNotes, setReceivingNotes] = useState('');

  // Action Forms State (C1 / C3)
  const [activeActionTab, setActiveActionTab] = useState('receive'); // 'receive' | 'adjust' | 'damaged' | 'return'
  const [adjustForm, setAdjustForm] = useState({
    productId: '',
    newPhysicalStock: '',
    unitCostOverride: '',
    reason: ''
  });
  const [damagedForm, setDamagedForm] = useState({
    productId: '',
    quantity: 1,
    reason: ''
  });
  const [returnForm, setReturnForm] = useState({
    returnType: 'customer_return',
    productId: '',
    quantity: 1,
    referenceCode: '',
    reason: ''
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadInventoryData = async () => {
    setLoading(true);
    setLevelError(null);
    try {
      const movParams = new URLSearchParams({ limit: '60' });
      if (movementTypeFilter !== 'all') movParams.set('movementType', movementTypeFilter);

      const [valRes, movRes] = await Promise.all([
        axios.get('/api/admin/finance/inventory/valuation', authHeader),
        axios.get(`/api/admin/finance/inventory/movements?${movParams.toString()}`, authHeader)
      ]);
      setValuation(valRes.data || null);
      setMovements(movRes.data?.movements || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setLevelError(err.response?.data?.error || 'يتطلب هذا القسم مستوى Advanced أو أعلى');
      } else {
        console.error('Error loading inventory data:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadInventoryData();
  }, [token, movementTypeFilter]);

  const handleSelectShipmentForReceiving = async (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    if (!shipmentId) {
      setSelectedShipmentDoc(null);
      setReceivingLines([]);
      return;
    }
    try {
      const res = await axios.get(`/api/admin/finance/shipments/${shipmentId}`, authHeader);
      const sh = res.data?.shipment;
      setSelectedShipmentDoc(sh || null);
      const lines = (sh?.purchaseLines || []).map((l) => {
        const remaining = Math.max(
          0,
          Number(l.quantity || 0) - Number(l.receivedQuantity || 0) - Number(l.rejectedQuantity || 0)
        );
        return {
          lineId: l.lineId,
          productId: l.productId,
          productName: l.productNameSnapshot,
          orderedQty: l.quantity,
          alreadyReceivedQty: l.receivedQuantity || 0,
          alreadyRejectedQty: l.rejectedQuantity || 0,
          receivedQuantity: remaining,
          rejectedQuantity: 0,
          discrepancyNote: ''
        };
      });
      setReceivingLines(lines);
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تحميل بنود الشحنة', 'error');
    }
  };

  const handleConfirmReceiveShipment = async (e) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      showToast('يرجى اختيار شحنة المورد أولاً', 'error');
      return;
    }
    try {
      await axios.post(
        `/api/admin/finance/inventory/receive/${selectedShipmentId}`,
        {
          idempotencyKey: `RCV-UI-${selectedShipmentId}-${Date.now()}`,
          notes: receivingNotes,
          lines: receivingLines.map((l) => ({
            lineId: l.lineId,
            productId: l.productId,
            receivedQuantity: Number(l.receivedQuantity || 0),
            rejectedQuantity: Number(l.rejectedQuantity || 0),
            discrepancyNote: l.discrepancyNote
          }))
        },
        authHeader
      );
      showToast('تم تأكيد استلام البضاعة وتحديث دفتر المخزون وتكلفة الوحدة بنجاح');
      setReceivingNotes('');
      await handleSelectShipmentForReceiving(selectedShipmentId);
      loadInventoryData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل استلام الشحنة', 'error');
    }
  };

  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/admin/finance/inventory/adjust',
        {
          productId: adjustForm.productId,
          newPhysicalStock: Number(adjustForm.newPhysicalStock),
          unitCostOverride:
            adjustForm.unitCostOverride !== '' ? Number(adjustForm.unitCostOverride) : undefined,
          reason: adjustForm.reason,
          idempotencyKey: `ADJ-UI-${adjustForm.productId}-${Date.now()}`
        },
        authHeader
      );
      showToast('تم تنفيذ تسوية الجرد اليدوية وتوثيقها في السجل المالي');
      setAdjustForm({ productId: '', newPhysicalStock: '', unitCostOverride: '', reason: '' });
      loadInventoryData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تنفيذ التسوية', 'error');
    }
  };

  const handleDamagedStock = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/admin/finance/inventory/damaged',
        {
          productId: damagedForm.productId,
          quantity: Number(damagedForm.quantity),
          reason: damagedForm.reason,
          idempotencyKey: `DMG-UI-${damagedForm.productId}-${Date.now()}`
        },
        authHeader
      );
      showToast('تم تسجيل المخزون التالف/المفقود وخصمه من الرصيد المتاح');
      setDamagedForm({ productId: '', quantity: 1, reason: '' });
      loadInventoryData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل التالف', 'error');
    }
  };

  const handleReturnMovement = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/admin/finance/inventory/returns',
        {
          returnType: returnForm.returnType,
          productId: returnForm.productId,
          quantity: Number(returnForm.quantity),
          referenceCode: returnForm.referenceCode,
          reason: returnForm.reason,
          idempotencyKey: `RET-UI-${returnForm.productId}-${Date.now()}`
        },
        authHeader
      );
      showToast('تم تسجيل حركة المرتجع في دفتر المخزون بنجاح');
      setReturnForm({ returnType: 'customer_return', productId: '', quantity: 1, referenceCode: '', reason: '' });
      loadInventoryData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل المرتجع', 'error');
    }
  };

  const handleExportValuationCsv = () => {
    if (!valuation?.items?.length) return;
    const headers = [
      'Product ID',
      'Product Name',
      'Category',
      'Physical Stock',
      'Reserved Stock',
      'Available Stock',
      'Historical Purchase Cost',
      'Book Unit Cost',
      'Replacement Cost',
      'Selling Price',
      'Total Book Value'
    ];
    const rows = valuation.items.map((it) => [
      it.productId,
      `"${String(it.name || '').replace(/"/g, '""')}"`,
      `"${String(it.category || '').replace(/"/g, '""')}"`,
      it.physicalStock,
      it.reservedStock,
      it.availableStock,
      it.historicalPurchaseCost,
      it.inventoryBookUnitCost,
      it.replacementUnitCost,
      it.sellingPrice,
      it.totalBookValue
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (levelError) {
    return (
      <div className="p-6 rounded-card bg-orange-500/10 border border-orange-500/30 text-xs font-bold text-orange-600">
        {levelError}
      </div>
    );
  }

  const items = valuation?.items || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">السياسة المحاسبية للتكلفة</span>
          <div className="text-base font-black text-primary uppercase">
            {valuation?.costingPolicy === 'fifo'
              ? 'FIFO (الوارد أولاً يصرف أولاً)'
              : 'Weighted Average (المتوسط المرجح)'}
          </div>
          <span className="text-[11px] text-ink-soft block">محمية ضد التلاعب التاريخي</span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">الرصيد الفعلي / المحجوز / المتاح</span>
          <div className="text-lg font-black text-ink">
            {valuation?.summary?.totalPhysicalStock || 0} فعلي |{' '}
            <span className="text-emerald-600">{valuation?.summary?.totalAvailableStock || 0} متاح</span>
          </div>
          <span className="text-[11px] text-orange-600 font-bold block">
            محجوز للطلبات: {valuation?.summary?.totalReservedStock || 0} قطعة
          </span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">القيمة الدفترية للمخزون (Book Value)</span>
          <div className="text-xl font-black text-indigo-600">
            {(valuation?.summary?.totalBookValue || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">وفق سياسة التقييم المعتمدة</span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">القيمة البيعية المتوقعة</span>
          <div className="text-xl font-black text-emerald-600">
            {(valuation?.summary?.totalPotentialRevenue || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">بأسعار البيع العامة الحالية</span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">تنبيهات انخفاض ونفاد المخزون</span>
          <div className="text-xl font-black text-red-500">
            {valuation?.summary?.lowStockCount || 0} منخفض / {valuation?.summary?.outOfStockCount || 0} نافد
          </div>
          <span className="text-[11px] text-ink-soft block">تحتاج لإعادة طلب من الموردين</span>
        </div>
      </div>

      {/* Operations Tabs: Receive Shipment | Manual Adjustment | Damaged Stock | Returns */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <button
              type="button"
              onClick={() => setActiveActionTab('receive')}
              className={`px-3.5 py-2 rounded-btn flex items-center gap-1.5 ${
                activeActionTab === 'receive'
                  ? 'bg-primary text-white'
                  : 'bg-paper text-ink border border-line'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              <span>1. استلام شحنات الموردين (كلي / جزئي)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveActionTab('adjust')}
              className={`px-3.5 py-2 rounded-btn flex items-center gap-1.5 ${
                activeActionTab === 'adjust'
                  ? 'bg-primary text-white'
                  : 'bg-paper text-ink border border-line'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>2. تسوية جرد يدوية ومطابقة</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveActionTab('damaged')}
              className={`px-3.5 py-2 rounded-btn flex items-center gap-1.5 ${
                activeActionTab === 'damaged'
                  ? 'bg-primary text-white'
                  : 'bg-paper text-ink border border-line'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>3. تسجيل تالف أو مفقود</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveActionTab('return')}
              className={`px-3.5 py-2 rounded-btn flex items-center gap-1.5 ${
                activeActionTab === 'return'
                  ? 'bg-primary text-white'
                  : 'bg-paper text-ink border border-line'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>4. مرتجعات العملاء والموردين</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadInventoryData}
            className="px-3 py-1.5 rounded-btn bg-paper border border-line text-xs font-bold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث البيانات</span>
          </button>
        </div>

        {/* 1. Receive Supplier Shipment Form */}
        {activeActionTab === 'receive' && (
          <form onSubmit={handleConfirmReceiveShipment} className="space-y-4 text-xs font-bold">
            <div className="p-3 rounded-btn bg-indigo-500/10 border border-indigo-500/20 text-indigo-600">
              ملاحظة معمارية: الاستلام الفعلي للبضاعة هو وحده الذي ينشئ حركة إدخال مخزني (Inventory-In). سداد المورد لا يعني استلام البضاعة، واستلام البضاعة لا يعني أنه تم سداد المورد.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-soft mb-1">اختر شحنة المورد المراد استلامها *</label>
                <select
                  value={selectedShipmentId}
                  onChange={(e) => handleSelectShipmentForReceiving(e.target.value)}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  <option value="">-- اختر شحنة مورد --</option>
                  {shipments.map((sh) => (
                    <option key={sh._id} value={sh._id}>
                      {sh.referenceId} — {sh.supplier?.name} ({sh.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-soft mb-1">ملاحظات محضر الفحص والاستلام</label>
                <input
                  type="text"
                  value={receivingNotes}
                  onChange={(e) => setReceivingNotes(e.target.value)}
                  placeholder="مثال: استلام الدفعة الأولى بمخزن الفرع الرئيسي..."
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
            </div>

            {selectedShipmentDoc && receivingLines.length === 0 && (
              <div className="p-4 rounded-btn bg-orange-500/10 border border-orange-500/25 text-orange-600">
                لا توجد منتجات مرتبطة بهذه الشحنة بعد. اربط المنتجات بالشحنة من تبويب «المرحلة B: شحنات الموردين» أولاً.
              </div>
            )}

            {receivingLines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border border-line rounded-btn">
                  <thead className="bg-paper text-ink-soft border-b border-line">
                    <tr>
                      <th className="p-2.5">المنتج</th>
                      <th className="p-2.5">الكمية المطلوبة</th>
                      <th className="p-2.5">المستلم سابقاً</th>
                      <th className="p-2.5">الكمية المستلمة الآن (الصحيحة)</th>
                      <th className="p-2.5">الكمية المرفوضة/التالفة</th>
                      <th className="p-2.5">ملاحظة الفروق (Discrepancy)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {receivingLines.map((rl, idx) => (
                      <tr key={rl.lineId}>
                        <td className="p-2.5 font-black text-ink">{rl.productName}</td>
                        <td className="p-2.5">{rl.orderedQty}</td>
                        <td className="p-2.5 text-emerald-600">
                          {rl.alreadyReceivedQty} (مرفوض: {rl.alreadyRejectedQty})
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            value={rl.receivedQuantity}
                            onChange={(e) => {
                              const copy = [...receivingLines];
                              copy[idx].receivedQuantity = Number(e.target.value);
                              setReceivingLines(copy);
                            }}
                            className="w-24 bg-paper border border-line rounded p-1.5 text-ink"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            value={rl.rejectedQuantity}
                            onChange={(e) => {
                              const copy = [...receivingLines];
                              copy[idx].rejectedQuantity = Number(e.target.value);
                              setReceivingLines(copy);
                            }}
                            className="w-24 bg-paper border border-line rounded p-1.5 text-red-500"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={rl.discrepancyNote}
                            onChange={(e) => {
                              const copy = [...receivingLines];
                              copy[idx].discrepancyNote = e.target.value;
                              setReceivingLines(copy);
                            }}
                            placeholder="سبب النقص أو الرفض إن وجد..."
                            className="w-full bg-paper border border-line rounded p-1.5 text-ink"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {receivingLines.length > 0 && (
              <button
                type="submit"
                className="px-5 py-2.5 rounded-btn bg-emerald-600 text-white font-black hover:bg-emerald-700"
              >
                تأكيد الاستلام الفعلي وتحديث المخزون والتكلفة
              </button>
            )}
          </form>
        )}

        {/* 2. Manual Stock Adjustment Form */}
        {activeActionTab === 'adjust' && (
          <form onSubmit={handleManualAdjustment} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-bold items-end">
            <div>
              <label className="block text-ink-soft mb-1">المنتج *</label>
              <select
                required
                value={adjustForm.productId}
                onChange={(e) => {
                  const found = items.find((i) => String(i.productId) === e.target.value);
                  setAdjustForm({
                    ...adjustForm,
                    productId: e.target.value,
                    newPhysicalStock: found ? found.physicalStock : ''
                  });
                }}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value="">-- اختر المنتج --</option>
                {items.map((it) => (
                  <option key={it.productId} value={it.productId}>
                    {it.name} (الحالي: {it.physicalStock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">الرصيد الفعلي الجديد بعد الجرد *</label>
              <input
                type="number"
                min="0"
                required
                value={adjustForm.newPhysicalStock}
                onChange={(e) => setAdjustForm({ ...adjustForm, newPhysicalStock: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">سبب التسوية الجردية (إلزامي للتدقيق) *</label>
              <input
                type="text"
                required
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="مثال: مطابقة الجرد الشهري الفعلي..."
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <button type="submit" className="py-2.5 px-4 rounded-btn bg-primary text-white font-black">
              اعتماد تسوية الجرد
            </button>
          </form>
        )}

        {/* 3. Damaged or Lost Stock Form */}
        {activeActionTab === 'damaged' && (
          <form onSubmit={handleDamagedStock} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-bold items-end">
            <div>
              <label className="block text-ink-soft mb-1">المنتج *</label>
              <select
                required
                value={damagedForm.productId}
                onChange={(e) => setDamagedForm({ ...damagedForm, productId: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value="">-- اختر المنتج --</option>
                {items.map((it) => (
                  <option key={it.productId} value={it.productId}>
                    {it.name} (المتاح: {it.availableStock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">الكمية التالفة أو المفقودة *</label>
              <input
                type="number"
                min="1"
                required
                value={damagedForm.quantity}
                onChange={(e) => setDamagedForm({ ...damagedForm, quantity: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">السبب وتفاصيل الواقعة *</label>
              <input
                type="text"
                required
                value={damagedForm.reason}
                onChange={(e) => setDamagedForm({ ...damagedForm, reason: e.target.value })}
                placeholder="مثال: تلف أثناء التخزين..."
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <button type="submit" className="py-2.5 px-4 rounded-btn bg-red-600 text-white font-black">
              تسجيل تالف / فاقد مخزني
            </button>
          </form>
        )}

        {/* 4. Customer or Supplier Return Form */}
        {activeActionTab === 'return' && (
          <form onSubmit={handleReturnMovement} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-bold items-end">
            <div>
              <label className="block text-ink-soft mb-1">نوع المرتجع *</label>
              <select
                value={returnForm.returnType}
                onChange={(e) => setReturnForm({ ...returnForm, returnType: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value="customer_return">مرتجع عميل إلى المخزون القابل للبيع (+)</option>
                <option value="supplier_return">مرتجع بضاعة إلى المورد (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">المنتج *</label>
              <select
                required
                value={returnForm.productId}
                onChange={(e) => setReturnForm({ ...returnForm, productId: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value="">-- اختر المنتج --</option>
                {items.map((it) => (
                  <option key={it.productId} value={it.productId}>
                    {it.name} (الحالي: {it.physicalStock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">الكمية *</label>
              <input
                type="number"
                min="1"
                required
                value={returnForm.quantity}
                onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">سبب المرتجع / مرجع العملية *</label>
              <input
                type="text"
                required
                value={returnForm.reason}
                onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                placeholder="مثال: مرتجع سليم من العميل..."
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <button type="submit" className="py-2.5 px-4 rounded-btn bg-indigo-600 text-white font-black">
              تسجيل حركة المرتجع
            </button>
          </form>
        )}
      </div>

      {/* Inventory Valuation Table */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-ink flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />
              <span>تقييم المخزون وفصل التكاليف الأربع (Inventory Valuation & 4-Cost Separation)</span>
            </h4>
            <p className="text-xs text-ink-soft">
              يفصل النظام بين: 1) تكلفة الشراء التاريخية، 2) التكلفة الدفترية للمخزون (WAC/FIFO)، 3) تكلفة الإحلال الحالية، 4) سعر البيع العام
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportValuationCsv}
            className="px-3.5 py-2 rounded-btn bg-paper border border-line text-xs font-black flex items-center gap-1.5 hover:bg-surface"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper text-ink-soft font-bold border-b border-line">
              <tr>
                <th className="p-2.5">المنتج</th>
                <th className="p-2.5">الرصيد الفعلي</th>
                <th className="p-2.5">المحجوز</th>
                <th className="p-2.5">المتاح للبيع</th>
                <th className="p-2.5">تكلفة الشراء التاريخية</th>
                <th className="p-2.5">التكلفة الدفترية (Book Cost)</th>
                <th className="p-2.5">تكلفة الإحلال (Replacement)</th>
                <th className="p-2.5">سعر البيع العام</th>
                <th className="p-2.5">إجمالي القيمة الدفترية</th>
                <th className="p-2.5">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.productId} className="hover:bg-paper/60">
                  <td className="p-2.5 font-black text-ink">
                    <div>{it.name}</div>
                    {it.lastPurchaseCurrency && it.lastPurchaseCurrency !== 'EGP' && (
                      <span className="text-[10px] text-indigo-600 font-mono">
                        آخر شراء: {it.lastPurchaseOriginalUnitCost} {it.lastPurchaseCurrency} (سعر صرف:{' '}
                        {it.lastPurchaseExchangeRate})
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 font-bold">{it.physicalStock}</td>
                  <td className="p-2.5 text-orange-600 font-bold">{it.reservedStock}</td>
                  <td className="p-2.5 font-black text-emerald-600">{it.availableStock}</td>
                  <td className="p-2.5 font-mono">
                    {it.historicalPurchaseCost} {currency}
                  </td>
                  <td className="p-2.5 font-mono font-black text-indigo-600">
                    {it.inventoryBookUnitCost} {currency}
                  </td>
                  <td className="p-2.5 font-mono text-orange-600">
                    {it.replacementUnitCost} {currency}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-emerald-600">
                    {it.sellingPrice} {currency}
                  </td>
                  <td className="p-2.5 font-black text-ink">
                    {it.totalBookValue.toLocaleString()} {currency}
                  </td>
                  <td className="p-2.5">
                    {it.isOutOfStock ? (
                      <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-600 text-[10px] font-black">
                        نافد
                      </span>
                    ) : it.isLowStock ? (
                      <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 text-[10px] font-black">
                        منخفض
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 text-[10px] font-black">
                        متوفر
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Movement Ledger */}
      <div className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-black text-ink flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <span>دفتر حركات المخزون غير القابل للتكرار (Idempotent Inventory Movements Ledger)</span>
          </h4>
          <select
            value={movementTypeFilter}
            onChange={(e) => setMovementTypeFilter(e.target.value)}
            className="bg-paper border border-line rounded-btn px-3 py-1.5 text-xs font-bold text-ink"
          >
            <option value="all">كل أنواع الحركات</option>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-right text-xs">
            <thead className="bg-paper text-ink-soft font-bold border-b border-line sticky top-0">
              <tr>
                <th className="p-2.5">كود الحركة</th>
                <th className="p-2.5">التاريخ</th>
                <th className="p-2.5">المنتج</th>
                <th className="p-2.5">نوع الحركة</th>
                <th className="p-2.5">التغير في الكمية</th>
                <th className="p-2.5">الرصيد قبل / بعد</th>
                <th className="p-2.5">تكلفة الوحدة</th>
                <th className="p-2.5">إجمالي التكلفة</th>
                <th className="p-2.5">المرجع / السبب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {movements.map((mv) => (
                <tr key={mv._id} className="hover:bg-paper/60">
                  <td className="p-2.5 font-mono font-black text-primary">{mv.movementCode}</td>
                  <td className="p-2.5 text-ink-soft whitespace-nowrap">
                    {new Date(mv.occurredAt || mv.createdAt).toLocaleString('ar-EG')}
                  </td>
                  <td className="p-2.5 font-bold text-ink">{mv.productNameSnapshot}</td>
                  <td className="p-2.5 font-bold">
                    {MOVEMENT_TYPE_LABELS[mv.movementType] || mv.movementType}
                  </td>
                  <td
                    className={`p-2.5 font-mono font-black ${
                      mv.quantityDelta > 0
                        ? 'text-emerald-600'
                        : mv.quantityDelta < 0
                        ? 'text-red-500'
                        : 'text-orange-600'
                    }`}
                  >
                    {mv.quantityDelta > 0 ? `+${mv.quantityDelta}` : mv.quantityDelta}
                  </td>
                  <td className="p-2.5 font-mono text-ink-soft">
                    {mv.physicalStockBefore} ← <strong className="text-ink">{mv.physicalStockAfter}</strong>
                  </td>
                  <td className="p-2.5 font-mono">
                    {mv.unitCost} {currency}
                  </td>
                  <td className="p-2.5 font-mono font-bold">
                    {mv.totalCostImpact} {currency}
                  </td>
                  <td className="p-2.5 text-ink-soft">
                    {mv.referenceCode ? `[${mv.referenceCode}] ` : ''}
                    {mv.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
