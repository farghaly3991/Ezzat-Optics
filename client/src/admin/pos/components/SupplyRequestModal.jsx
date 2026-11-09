import React, { useState, useEffect } from 'react';
import {
  X,
  BellRing,
  Phone,
  MessageCircle,
  Send,
  CheckCircle2,
  User,
  Package,
  Building2,
  Plus,
  Hash,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

/**
 * Unified Supply Request Modal (طلب توريد لصنف أو عدسة غير متوفرة)
 * Compatible with POS, Order details, and Standalone critical stock.
 */
export default function SupplyRequestModal({
  isOpen = true,
  item,
  orderId = '',
  customerName = '',
  customerPhone = '',
  onClose,
  onConfirmSupply,
  onSuccess
}) {
  const { token, showToast } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Quick Add Supplier inline state
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierSpecialty, setNewSupplierSpecialty] = useState('');
  const [savingNewSupplier, setSavingNewSupplier] = useState(false);

  // Form State
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load suppliers on mount
  useEffect(() => {
    if (!token) return;
    setLoadingSuppliers(true);
    axios
      .get('/api/admin/finance/suppliers', authHeader)
      .then((res) => {
        const list = res.data?.suppliers || [];
        setSuppliers(list);
        if (list.length > 0) {
          // If product has a default supplier, pre-select it
          const defaultSup = list.find(
            (s) => String(s._id) === String(item?.supplierId || item?.supplier?._id)
          );
          setSelectedSupplierId(defaultSup ? defaultSup._id : list[0]._id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSuppliers(false));
  }, [token]);

  if (!isOpen || !item) return null;

  const currentSupplier = suppliers.find((s) => String(s._id) === String(selectedSupplierId));

  const buildWhatsAppMessage = () => {
    const sName = currentSupplier?.name || 'مورد البصريات';
    const itemName = item.unitSlotLabel ? `${item.name} (${item.unitSlotLabel})` : item.name;
    const sph = item.lensSpecs?.sph || item.specs?.sph || '';
    const cyl = item.lensSpecs?.cyl || item.specs?.cyl || '';
    const axis = item.lensSpecs?.axis || item.specs?.axis || '';

    return `📦 *طلب توريد عاجل - مركز البصريات (HI LUXE)*
السادة: *${sName}*
تحية طيبة، مطلوب توريد الصنف التالي على وجه السرعة:

👓 *الصنف:* ${itemName}
🔢 *الكمية المطلوبة:* ${quantity} قطعة
${sph ? `🎯 *المقاس المطلوب:* SPH ${sph} | CYL ${cyl || '0.00'}${axis ? ` | AXIS ${axis}°` : ''}` : ''}
${item.unitSlotLabel ? `👁️ *الوحدة / جهة التركيب:* ${item.unitSlotLabel}` : ''}
${customerName ? `👤 *العميل المرتبط:* ${customerName} (${customerPhone || 'بدون هاتف'})` : ''}
${orderId ? `🔖 *رقم الفاتورة / الطلب:* #${orderId}` : ''}
${notes ? `📝 *ملاحظات إضافية:* ${notes}` : ''}

برجاء تأكيد توفر الصنف وموعد التوريد المتوقع. شاكرين لحضراتكم!`;
  };

  const handleSendWhatsApp = () => {
    const phone = currentSupplier?.whatsappPhone || currentSupplier?.phone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      showToast?.('يرجى تحديد مورد لديه رقم هاتف أو واتساب', 'error');
      return;
    }
    const intlPhone = cleanPhone.startsWith('0') ? '20' + cleanPhone.substring(1) : cleanPhone;
    const text = buildWhatsAppMessage();
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierName.trim() || !newSupplierPhone.trim()) {
      showToast?.('يرجى إدخال اسم المورد ورقم الهاتف', 'error');
      return;
    }
    setSavingNewSupplier(true);
    try {
      const res = await axios.post(
        '/api/admin/finance/suppliers',
        {
          name: newSupplierName.trim(),
          phone: newSupplierPhone.trim(),
          whatsappPhone: newSupplierPhone.trim(),
          specialty: newSupplierSpecialty.trim()
        },
        authHeader
      );
      const created = res.data?.supplier;
      if (created) {
        showToast?.('تمت إضافة المورد الجديد بنجاح');
        setSuppliers((prev) => [created, ...prev]);
        setSelectedSupplierId(created._id);
        setIsAddingSupplier(false);
        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierSpecialty('');
      }
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر إضافة المورد', 'error');
    } finally {
      setSavingNewSupplier(false);
    }
  };

  const handleConfirmAndSaveReorder = async (e) => {
    e.preventDefault();
    if (!currentSupplier && !selectedSupplierId) {
      showToast?.('يرجى اختيار مورد من القائمة أو إضافة مورد جديد', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const messageText = buildWhatsAppMessage();
      const payload = {
        supplierId: currentSupplier?._id,
        supplierName: currentSupplier?.name,
        supplierPhone: currentSupplier?.phone,
        supplierWhatsapp: currentSupplier?.whatsappPhone || currentSupplier?.phone,
        items: [
          {
            productId: item.productId || item._id,
            name: item.unitSlotLabel ? `${item.name} (${item.unitSlotLabel})` : item.name,
            quantity: Math.max(1, Number(quantity) || 1),
            unitCost: Number(item.costPrice || item.unitCost || 0),
            stockAtOrder: Number(item.stockCount || item.currentStock || 0),
            specs: item.lensSpecs || item.specs || {},
            unitSlotKey: item.unitSlotKey || '',
            unitSlotLabel: item.unitSlotLabel || '',
            orderId: String(orderId || ''),
            customerName: String(customerName || ''),
            customerPhone: String(customerPhone || '')
          }
        ],
        notes,
        channel: 'whatsapp_direct',
        messageText
      };

      await axios.post('/api/admin/finance/procurement/reorders/dispatch', payload, authHeader);
      showToast?.('تم تسجيل أمر التوريد بنجاح في سجل المشتريات المركزي');

      if (onConfirmSupply) {
        onConfirmSupply({
          supplierId: currentSupplier?._id,
          supplierName: currentSupplier?.name,
          supplierPhone: currentSupplier?.phone,
          quantity: Number(quantity),
          notes
        });
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'تعذر حفظ طلب التوريد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sph = item.lensSpecs?.sph || item.specs?.sph || '';
  const cyl = item.lensSpecs?.cyl || item.specs?.cyl || '';
  const axis = item.lensSpecs?.axis || item.specs?.axis || '';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface rounded-3xl max-w-lg w-full shadow-2xl border border-line overflow-hidden flex flex-col text-ink my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between bg-gradient-to-r from-amber-600 to-orange-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <BellRing className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">إنشاء أمر توريد لصنف ناقص / غير متوفر</h3>
              <p className="text-[11px] text-amber-100">
                يتم إدراجه مركزياً في سجل التوريدات وإرساله للمورد مباشرة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Missing Item Snapshot Card */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
            <div className="font-black text-ink flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span className="text-sm">{item.name}</span>
                {item.unitSlotLabel && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black text-[10px]">
                    {item.unitSlotLabel}
                  </span>
                )}
              </div>
              <span className="text-red-500 font-bold font-mono text-[11px]">
                الرصيد: {item.stockCount ?? item.currentStock ?? 0}
              </span>
            </div>

            {(sph || cyl || axis) && (
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-amber-800 dark:text-amber-200">
                <span>مقاس العدسة:</span>
                <span className="bg-surface px-2 py-0.5 rounded border border-line">
                  SPH: {sph || '0.00'}
                </span>
                <span className="bg-surface px-2 py-0.5 rounded border border-line">
                  CYL: {cyl || '0.00'}
                </span>
                {axis && (
                  <span className="bg-surface px-2 py-0.5 rounded border border-line">
                    AXIS: {axis}°
                  </span>
                )}
              </div>
            )}

            {(customerName || orderId) && (
              <div className="flex items-center gap-3 pt-1 border-t border-amber-500/20 text-[11px] text-ink-soft">
                {customerName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-amber-600" />
                    <span>العميل: {customerName}</span>
                  </span>
                )}
                {orderId && (
                  <span className="flex items-center gap-1 font-mono">
                    <Hash className="w-3 h-3 text-amber-600" />
                    <span>فاتورة: #{orderId}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Supplier Selector or Inline Add */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <span>المورد المطلوب التوريد منه *</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAddingSupplier(!isAddingSupplier)}
                className="text-xs font-black text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingSupplier ? 'إلغاء' : 'إضافة مورد جديد'}</span>
              </button>
            </div>

            {isAddingSupplier ? (
              <form onSubmit={handleCreateSupplier} className="p-3 rounded-2xl bg-paper border border-line space-y-2 text-xs animate-fadeIn">
                <span className="font-black text-primary block text-[11px]">تسجيل مورد جديد بالقائمة:</span>
                <input
                  type="text"
                  placeholder="اسم شركة المورد / الموزع *"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-ink outline-none"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    placeholder="رقم الهاتف / الواتساب *"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold font-mono text-ink outline-none"
                    dir="ltr"
                    required
                  />
                  <input
                    type="text"
                    placeholder="التخصص (عدسات، شنابر...)"
                    value={newSupplierSpecialty}
                    onChange={(e) => setNewSupplierSpecialty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-ink outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingSupplier(false)}
                    className="px-3 py-1.5 rounded-lg text-ink-soft hover:bg-surface text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={savingNewSupplier}
                    className="px-4 py-1.5 rounded-lg bg-primary text-white font-black text-xs hover:bg-primary/90"
                  >
                    {savingNewSupplier ? 'جاري الحفظ...' : 'حفظ المورد'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-primary"
                  required
                >
                  {suppliers.length === 0 ? (
                    <option value="">لا يوجد موردين مسجلين - اضغط إضافة مورد جديد</option>
                  ) : (
                    suppliers.map((sup) => (
                      <option key={sup._id} value={sup._id}>
                        {sup.name} {sup.phone ? `(${sup.phone})` : ''} {sup.specialty ? `- [${sup.specialty}]` : ''}
                      </option>
                    ))
                  )}
                </select>
                {currentSupplier?.phone && (
                  <span className="text-[11px] text-ink-soft font-mono block pr-1">
                    هاتف المورد: {currentSupplier.phone}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Quantity Specification (تحديد كمية الطلب) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">الكمية المطلوب توريدها *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 rounded-xl bg-paper border border-line text-sm font-mono font-black text-ink outline-none text-center focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink block mb-1">تكلفة الوحدة التقديرية:</label>
              <div className="px-3 py-2 rounded-xl bg-paper border border-line text-sm font-mono font-bold text-ink-soft text-center">
                {Number(item.costPrice || item.unitCost || 0).toLocaleString()} ج.م
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-ink block mb-1">ملاحظات التوريد أو تاريخ الوعد:</label>
            <input
              type="text"
              placeholder="مثال: وعد بالتوريد غداً الساعة 2 ظهراً، كود العدسة الخاص بالمورد..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-paper border border-line text-xs font-bold text-ink outline-none focus:border-amber-500"
            />
          </div>

          {/* Quick WhatsApp Action Button */}
          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={!currentSupplier}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            <span>مراسلة المورد بالطلب وتفاصيله عبر واتساب الآن</span>
          </button>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-line bg-paper/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-ink-soft hover:bg-paper"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirmAndSaveReorder}
            disabled={isSubmitting || !currentSupplier}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الاعتماد والربط...' : 'تأكيد وإدراج بأوامر التوريد'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
