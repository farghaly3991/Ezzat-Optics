import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  FileText,
  Calendar,
  User,
  ArrowRightLeft,
  AlertTriangle,
  ShoppingBag,
  Package,
  Layers,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../../shared/context/StoreContext';

/**
 * Product Ledger & Movement History (كارت الصنف وسجل الحركات)
 * "كارت الصنف يبني نفسه: كل حركة — توريد، بيع، تحويل، توالف، جرد — تُسجّل برصيد بعدها ومرجعها، فتعرف دائماً لماذا الرقم هو هذا الرقم."
 */
export default function ProductLedgerModal({ product, onClose }) {
  const { token } = useStore();
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState([]);
  const [productInfo, setProductInfo] = useState(product);

  useEffect(() => {
    if (!product?._id) return;
    setLoading(true);
    axios
      .get(`/api/admin/products/${product._id}/ledger`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        if (res.data?.done) {
          setLedgerData(res.data.ledger || []);
          if (res.data.product) setProductInfo(res.data.product);
        }
      })
      .catch((err) => {
        console.error('Error fetching product ledger:', err);
      })
      .finally(() => setLoading(false));
  }, [product, token]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans animate-in fade-in" dir="rtl">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">كارت الصنف وسجل الحركات والتدقيق</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Stock Ledger
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تتبع كامل لكل حركة توريد، بيع، تحويل، توالف، أو جرد لمعرفة رصيد الصنف الحالي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Snapshot Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 block text-[10px] font-bold">اسم الصنف</span>
            <span className="font-black text-slate-800 truncate block mt-0.5">{productInfo.name}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 block text-[10px] font-bold">الباركود</span>
            <span className="font-mono font-bold text-blue-600 block mt-0.5">{productInfo.barcode || '—'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 block text-[10px] font-bold">توزيع المخزون</span>
            <span className="font-bold text-slate-800 block mt-0.5">
              المحل: <strong className="text-blue-600">{productInfo.storeStock ?? productInfo.stockCount}</strong> · الخارجي: <strong className="text-slate-600">{productInfo.externalStock ?? 0}</strong>
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-400 block text-[10px] font-bold">الرصيد الفعلي الحالي</span>
            <span className="font-black text-emerald-600 text-sm block mt-0.5">
              {productInfo.stockCount} قطعة
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              جاري استخراج حركات كارت الصنف...
            </div>
          ) : ledgerData.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              لا توجد حركات مسجلة لهذا الصنف حتى الآن
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 font-black border-b border-slate-200">
                  <tr>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3 text-center">التغيير بالكمية</th>
                    <th className="p-3 text-center">الرصيد بعدها</th>
                    <th className="p-3">المرجع والملاحظات</th>
                    <th className="p-3">المسؤول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerData.map((item, idx) => {
                    const isPositive = (item.qtyChange || 0) > 0;
                    const isNegative = (item.qtyChange || 0) < 0;

                    let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                    let IconComponent = FileText;

                    if (item.typeKey === 'sale') {
                      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      IconComponent = ShoppingBag;
                    } else if (item.typeKey === 'scrap') {
                      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                      IconComponent = AlertTriangle;
                    } else if (item.typeKey === 'transfer') {
                      badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                      IconComponent = ArrowRightLeft;
                    } else if (item.typeKey === 'initial' || item.typeKey === 'procure') {
                      badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                      IconComponent = Package;
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-500 font-mono text-[11px]" dir="ltr">
                          {new Date(item.date).toLocaleString('ar-EG')}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeColor}`}>
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{item.type}</span>
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-black text-sm">
                          {isPositive && (
                            <span className="text-emerald-600 flex items-center justify-center gap-0.5">
                              +{item.qtyChange}
                              <ArrowUpRight className="w-3 h-3" />
                            </span>
                          )}
                          {isNegative && (
                            <span className="text-rose-600 flex items-center justify-center gap-0.5">
                              {item.qtyChange}
                              <ArrowDownRight className="w-3 h-3" />
                            </span>
                          )}
                          {!isPositive && !isNegative && (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-sm text-slate-800 bg-slate-50/50">
                          {item.balanceAfter}
                        </td>
                        <td className="p-3 text-slate-600 font-medium max-w-xs truncate">
                          {item.reference || '—'}
                        </td>
                        <td className="p-3 text-slate-500 font-bold text-[11px]">
                          {item.user || 'النظام'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>كل رقم مسجل بمرجع وتاريخ محدد لضمان الرقابة الصارمة لمنع التلاعب</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
