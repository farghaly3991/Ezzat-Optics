import React, { useState, useEffect } from 'react';
import {
  Receipt,
  CalendarClock,
  ShoppingBag,
  Plus,
  CheckCircle2,
  RefreshCw,
  Edit,
  Wallet,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  UserCheck,
  DollarSign,
  PieChart,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

const EXPENSE_CATEGORY_LABELS = {
  rent: 'إيجار المحل / المقر (Rent)',
  electricity: 'كهرباء (Electricity)',
  water: 'مياه (Water)',
  gas: 'غاز (Gas)',
  internet_phone: 'إنترنت واتصالات (Internet & Phone)',
  salaries_wages: 'رواتب وأجور (Salaries & Wages)',
  commissions_bonuses: 'عمولات ومكافآت (Commissions)',
  marketing_ads: 'تسويق وإعلانات ممولة (Marketing & Ads)',
  packaging_supplies: 'تغليف ومستلزمات شحن (Packaging)',
  maintenance_repairs: 'صيانة وإصلاحات (Maintenance)',
  software_subscriptions: 'اشتراكات برمجيات ومنصات (Subscriptions)',
  transport_logistics: 'نقل ومشال ولوجستيات (Logistics)',
  taxes_government_fees: 'ضرائب ورسوم حكومية (Taxes & Fees)',
  bank_payment_gateway_fees: 'عمولات بنكية وبوابات دفع (Gateway Fees)',
  partner_withdrawal: 'مسحوبات أصحاب المحل والشركاء (Owner/Partner Drawings)',
  partner_profit_distribution: 'توزيعات أرباح الشركاء (Profit Distribution)',
  miscellaneous_operating: 'مصروفات تشغيلية متنوعة (Misc)'
};

const MANUAL_SALE_SOURCE_LABELS = {
  manual_offline: 'بيع مباشر يدوي (Manual Offline)',
  pos: 'نقطة بيع الكاشير (POS)',
  showroom: 'معرض / فرع البيع (Showroom)',
  phone_order: 'طلب هاتفي مباشر (Phone Order)',
  whatsapp_direct: 'طلب واتساب مباشر (WhatsApp)',
  b2b_invoice: 'فاتورة جملة / شركات (B2B Invoice)'
};

export default function FinanceExpensesSalesPanel({
  token,
  currency,
  showToast,
  catalogProducts = [],
  onRefreshAudit
}) {
  const [section, setSection] = useState('expenses'); // 'expenses' | 'recurring' | 'manual_sales' | 'partners'
  const [expensesData, setExpensesData] = useState({ expenses: [], summary: {} });
  const [recurringRules, setRecurringRules] = useState([]);
  const [manualSalesData, setManualSalesData] = useState({ sales: [], summary: {} });
  const [autoPayroll, setAutoPayroll] = useState(null);
  const [showPayrollDetails, setShowPayrollDetails] = useState(false);
  const [levelError, setLevelError] = useState(null);

  // Partners & Drawings State
  const [partnersData, setPartnersData] = useState({ summary: {}, partners: [], recentWithdrawals: [] });
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    phone: '',
    sharePercentage: 50,
    initialCapital: '',
    notes: ''
  });
  const [partnerWithdrawalModal, setPartnerWithdrawalModal] = useState({
    isOpen: false,
    partnerId: '',
    partnerName: '',
    amount: '',
    notes: '',
    paymentMethod: 'cash'
  });

  // Create Expense Form (D1)
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'rent',
    amount: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    payeeName: '',
    partnerId: '',
    partnerName: '',
    notes: '',
    payImmediately: true,
    paidAmount: '',
    paymentMethod: 'cash'
  });

  // Create/Edit Recurring Rule Form (D2)
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    title: '',
    category: 'rent',
    amount: '',
    frequency: 'monthly',
    dayOfMonth: 1,
    payeeName: '',
    generateCurrentPeriod: true
  });
  const [genPeriodKey, setGenPeriodKey] = useState(new Date().toISOString().slice(0, 7));

  // Create Manual Sale Form (D3)
  const [saleForm, setSaleForm] = useState({
    sourceChannel: 'showroom',
    customerName: 'عميل معرض مباشر',
    customerPhone: '',
    productId: '',
    quantity: 1,
    unitPrice: '',
    discountAmount: 0,
    shippingCharge: 0,
    actualCarrierCost: 0,
    initialPaidAmount: '',
    paymentMethod: 'cash',
    notes: ''
  });

  // Record Payment Modal (D4)
  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    targetType: 'expense', // 'expense' | 'manual_sale'
    targetDoc: null,
    amount: '',
    paymentMethod: 'cash',
    referenceNote: ''
  });

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadPhaseDData = async () => {
    setLevelError(null);
    try {
      const [expRes, recRes, msRes, payrollRes, partnersRes] = await Promise.all([
        axios.get('/api/admin/finance/expenses', authHeader),
        axios.get('/api/admin/finance/expenses/recurring-rules', authHeader),
        axios.get('/api/admin/finance/expenses/manual-sales', authHeader),
        axios.get('/api/admin/finance/expenses/auto-payroll', authHeader).catch(() => ({ data: null })),
        axios.get('/api/admin/finance/partners', authHeader).catch(() => ({ data: { partners: [], summary: {}, recentWithdrawals: [] } }))
      ]);
      setExpensesData(expRes.data || { expenses: [], summary: {} });
      setRecurringRules(recRes.data?.rules || []);
      setManualSalesData(msRes.data || { sales: [], summary: {} });
      setPartnersData(partnersRes.data || { partners: [], summary: {}, recentWithdrawals: [] });
      if (payrollRes?.data?.payroll) {
        setAutoPayroll(payrollRes.data.payroll);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setLevelError(err.response?.data?.error || 'يتطلب هذا القسم مستوى Advanced أو أعلى');
      } else {
        console.error('Error loading Phase D data:', err);
      }
    }
  };

  useEffect(() => {
    if (token) loadPhaseDData();
  }, [token]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/admin/finance/expenses',
        {
          title: expenseForm.title,
          category: expenseForm.category,
          amount: Number(expenseForm.amount),
          effectiveDate: expenseForm.effectiveDate,
          dueDate: expenseForm.dueDate || undefined,
          payeeName: expenseForm.payeeName,
          partnerId: expenseForm.partnerId || undefined,
          partnerName: expenseForm.partnerName || undefined,
          notes: expenseForm.notes,
          payImmediately: expenseForm.payImmediately,
          paidAmount:
            expenseForm.paidAmount !== '' ? Number(expenseForm.paidAmount) : Number(expenseForm.amount),
          paymentMethod: expenseForm.paymentMethod,
          idempotencyKey: `EXP-UI-${Date.now()}`
        },
        authHeader
      );
      showToast('تم تسجيل المصروف وتحديث الذمم والمدفوعات بنجاح');
      setExpenseForm({
        title: '',
        category: 'rent',
        amount: '',
        effectiveDate: new Date().toISOString().slice(0, 10),
        dueDate: '',
        payeeName: '',
        partnerId: '',
        partnerName: '',
        notes: '',
        payImmediately: true,
        paidAmount: '',
        paymentMethod: 'cash'
      });
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل المصروف', 'error');
    }
  };

  const handleCreatePartner = async (e) => {
    e.preventDefault();
    if (!partnerForm.name.trim()) {
      showToast('يرجى إدخال اسم الشريك', 'error');
      return;
    }
    try {
      await axios.post(
        '/api/admin/finance/partners',
        {
          name: partnerForm.name.trim(),
          phone: partnerForm.phone.trim(),
          sharePercentage: Number(partnerForm.sharePercentage || 50),
          initialCapital: Number(partnerForm.initialCapital || 0),
          notes: partnerForm.notes.trim()
        },
        authHeader
      );
      showToast('تم تسجيل الشريك وحصته بنجاح');
      setShowAddPartnerModal(false);
      setPartnerForm({ name: '', phone: '', sharePercentage: 50, initialCapital: '', notes: '' });
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل الشريك', 'error');
    }
  };

  const handleRecordPartnerWithdrawalSubmit = async (e) => {
    e.preventDefault();
    if (!partnerWithdrawalModal.partnerId) {
      showToast('يرجى تحديد الشريك', 'error');
      return;
    }
    if (!partnerWithdrawalModal.amount || Number(partnerWithdrawalModal.amount) <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }
    try {
      await axios.post(
        '/api/admin/finance/partners/withdrawal',
        {
          partnerId: partnerWithdrawalModal.partnerId,
          amount: Number(partnerWithdrawalModal.amount),
          notes: partnerWithdrawalModal.notes || undefined,
          paymentMethod: partnerWithdrawalModal.paymentMethod
        },
        authHeader
      );
      showToast('تم تسجيل مسحوبات الشريك وإثبات القيد في الخزينة والرقابة');
      setPartnerWithdrawalModal({
        isOpen: false,
        partnerId: '',
        partnerName: '',
        amount: '',
        notes: '',
        paymentMethod: 'cash'
      });
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل المسحوبات', 'error');
    }
  };

  const handleSaveRecurringRule = async (e) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await axios.put(
          `/api/admin/finance/expenses/recurring-rules/${editingRule._id}`,
          {
            title: ruleForm.title,
            category: ruleForm.category,
            amount: Number(ruleForm.amount),
            frequency: ruleForm.frequency,
            dayOfMonth: Number(ruleForm.dayOfMonth),
            payeeName: ruleForm.payeeName
          },
          authHeader
        );
        showToast('تم تحديث قاعدة المصروف الدوري للفترات القادمة دون المساس بالسجلات التاريخية السابقة');
      } else {
        await axios.post(
          '/api/admin/finance/expenses/recurring-rules',
          {
            title: ruleForm.title,
            category: ruleForm.category,
            amount: Number(ruleForm.amount),
            frequency: ruleForm.frequency,
            dayOfMonth: Number(ruleForm.dayOfMonth),
            payeeName: ruleForm.payeeName,
            generateCurrentPeriod: ruleForm.generateCurrentPeriod
          },
          authHeader
        );
        showToast('تم إنشاء قاعدة المصروف الدوري بنجاح');
      }
      setEditingRule(null);
      setRuleForm({
        title: '',
        category: 'rent',
        amount: '',
        frequency: 'monthly',
        dayOfMonth: 1,
        payeeName: '',
        generateCurrentPeriod: true
      });
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حفظ القاعدة الدورية', 'error');
    }
  };

  const handleGenerateOccurrences = async () => {
    try {
      const res = await axios.post(
        '/api/admin/finance/expenses/recurring-rules/generate',
        { periodKey: genPeriodKey },
        authHeader
      );
      showToast(
        `تم توليد استحقاقات الفترة (${res.data?.periodKey}): جُدّد ${res.data?.createdCount || 0} وتم تخطي ${
          res.data?.skippedCount || 0
        } مسجلة مسبقاً (حماية منع التكرار)`
      );
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر توليد الاستحقاقات', 'error');
    }
  };

  const handleCreateManualSale = async (e) => {
    e.preventDefault();
    if (!saleForm.productId) {
      showToast('يرجى اختيار المنتج أولاً', 'error');
      return;
    }
    try {
      await axios.post(
        '/api/admin/finance/expenses/manual-sales',
        {
          sourceChannel: saleForm.sourceChannel,
          customerName: saleForm.customerName,
          customerPhone: saleForm.customerPhone,
          discountAmount: Number(saleForm.discountAmount || 0),
          shippingCharge: Number(saleForm.shippingCharge || 0),
          actualCarrierCost: Number(saleForm.actualCarrierCost || 0),
          initialPaidAmount:
            saleForm.initialPaidAmount !== '' ? Number(saleForm.initialPaidAmount) : undefined,
          paymentMethod: saleForm.paymentMethod,
          notes: saleForm.notes,
          idempotencyKey: `MS-UI-${Date.now()}`,
          items: [
            {
              productId: saleForm.productId,
              quantity: Number(saleForm.quantity || 1),
              unitPrice: saleForm.unitPrice !== '' ? Number(saleForm.unitPrice) : undefined
            }
          ]
        },
        authHeader
      );
      showToast('تم تسجيل عملية البيع اليدوي وخصم المخزون وحساب تكلفة البضاعة المباعة (COGS)');
      setSaleForm({
        sourceChannel: 'showroom',
        customerName: 'عميل معرض مباشر',
        customerPhone: '',
        productId: '',
        quantity: 1,
        unitPrice: '',
        discountAmount: 0,
        shippingCharge: 0,
        actualCarrierCost: 0,
        initialPaidAmount: '',
        paymentMethod: 'cash',
        notes: ''
      });
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل البيع اليدوي', 'error');
    }
  };

  const handleRecordModalPayment = async (e) => {
    e.preventDefault();
    const { targetType, targetDoc, amount, paymentMethod, referenceNote } = paymentModal;
    if (!targetDoc) return;
    try {
      const url =
        targetType === 'expense'
          ? `/api/admin/finance/expenses/${targetDoc._id}/payments`
          : `/api/admin/finance/expenses/manual-sales/${targetDoc._id}/payments`;
      await axios.post(
        url,
        {
          amount: Number(amount),
          paymentMethod,
          referenceNote,
          idempotencyKey: `PAY-D-${targetDoc._id}-${Date.now()}`
        },
        authHeader
      );
      showToast('تم تسجيل الدفعة المالية وتحديث الرصيد المتبقي');
      setPaymentModal({
        isOpen: false,
        targetType: 'expense',
        targetDoc: null,
        amount: '',
        paymentMethod: 'cash',
        referenceNote: ''
      });
      loadPhaseDData();
      if (onRefreshAudit) onRefreshAudit();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر تسجيل الدفعة', 'error');
    }
  };

  if (levelError) {
    return (
      <div className="p-6 rounded-card bg-orange-500/10 border border-orange-500/30 text-xs font-bold text-orange-600">
        {levelError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">المصروفات المستحقة (Incurred)</span>
          <div className="text-xl font-black text-ink">
            {(expensesData.summary?.totalIncurred || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">
            مسدد منها فعلياً: {(expensesData.summary?.totalPaid || 0).toLocaleString()} {currency}
          </span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">مصروفات مستحقة غير مدفوعة</span>
          <div className="text-xl font-black text-red-500">
            {(expensesData.summary?.totalOutstanding || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">الاستحقاق المحاسبي ≠ الدفع النقدي</span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">إجمالي المبيعات اليدوية / المعرض</span>
          <div className="text-xl font-black text-emerald-600">
            {(manualSalesData.summary?.totalSalesAmount || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-ink-soft block">
            تكلفة بضاعتها (COGS): {(manualSalesData.summary?.totalCogs || 0).toLocaleString()} {currency}
          </span>
        </div>

        <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
          <span className="text-xs font-bold text-ink-soft">التحصيل النقدي من المبيعات اليدوية</span>
          <div className="text-xl font-black text-indigo-600">
            {(manualSalesData.summary?.totalCollected || 0).toLocaleString()} {currency}
          </div>
          <span className="text-[11px] text-orange-600 font-bold block">
            ذمم عملاء متبقية: {(manualSalesData.summary?.totalReceivable || 0).toLocaleString()} {currency}
          </span>
        </div>
      </div>

      {/* Automated OPEX Payroll Engine Widget */}
      {autoPayroll && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-slate-900/5 dark:via-slate-800/20 to-indigo-500/10 border border-emerald-500/30 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-ink">
                    المحرك الآلي لرواتب الموظفين (Automated OPEX Payroll)
                  </h4>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    حساب آلي بدون إدخال يدوي
                  </span>
                </div>
                <p className="text-xs text-ink-soft">
                  فترة الاستحقاق: {autoPayroll.period} — يتم تجميع رواتب الموظفين الدائمين الفعلية وطرح الخصومات المطبقة آلياً
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPayrollDetails(!showPayrollDetails)}
                className="px-3.5 py-1.5 rounded-xl bg-surface border border-line hover:border-primary text-ink text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>{showPayrollDetails ? 'إخفاء تفاصيل الموظفين' : 'عرض كشف تفاصيل الرواتب'}</span>
                {showPayrollDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-surface border border-line">
              <span className="text-[11px] text-ink-soft font-bold block">إجمالي الرواتب الأساسية (Gross)</span>
              <div className="text-lg font-black text-ink">
                {(autoPayroll.totalBaseSalary || 0).toLocaleString()} {currency}
              </div>
              <span className="text-[10px] text-ink-soft block">
                {autoPayroll.staffCount || 0} موظف دائم مسجل بعقد شهري
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface border border-line">
              <span className="text-[11px] text-rose-600 font-bold block">الخصومات المقتطعة آلياً</span>
              <div className="text-lg font-black text-rose-600">
                -{(autoPayroll.totalDeductions || 0).toLocaleString()} {currency}
              </div>
              <span className="text-[10px] text-ink-soft block">
                مأخوذة من سجل الخصومات والجزاءات
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
              <span className="text-[11px] text-emerald-800 dark:text-emerald-200 font-black block">
                صافي مسير الرواتب المحسوب بـ OPEX
              </span>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {(autoPayroll.netPayroll || 0).toLocaleString()} {currency}
              </div>
              <span className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 block">
                يدخل تلقائياً في قائمة الدخل وصافي الربح التشغيلي
              </span>
            </div>
          </div>

          {/* Collapsible Details Table */}
          {showPayrollDetails && autoPayroll.breakdown?.length > 0 && (
            <div className="pt-2 border-t border-line overflow-x-auto animate-in fade-in">
              <table className="w-full text-right text-xs">
                <thead className="text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="py-2 px-3">الموظف</th>
                    <th className="py-2 px-3">الدور والفرع</th>
                    <th className="py-2 px-3">الراتب الأساسي</th>
                    <th className="py-2 px-3">الخصومات المسجلة</th>
                    <th className="py-2 px-3">الصافي المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink font-bold">
                  {autoPayroll.breakdown.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-surface/50">
                      <td className="py-2 px-3 font-black text-ink">{emp.fullname}</td>
                      <td className="py-2 px-3 text-ink-soft text-[11px]">{emp.jobTitle || 'موظف'}</td>
                      <td className="py-2 px-3 font-mono">{(emp.baseSalary || 0).toLocaleString()} {currency}</td>
                      <td className="py-2 px-3 font-mono text-rose-600">
                        {emp.deductions > 0 ? `-${emp.deductions.toLocaleString()} ${currency}` : '0'}
                      </td>
                      <td className="py-2 px-3 font-mono font-black text-emerald-600">
                        {(emp.netSalary || 0).toLocaleString()} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 text-xs font-black">
        <button
          type="button"
          onClick={() => setSection('expenses')}
          className={`px-4 py-2.5 rounded-btn flex items-center gap-1.5 ${
            section === 'expenses' ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>1. سجل المصروفات والمدفوعات ({expensesData.expenses?.length || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('recurring')}
          className={`px-4 py-2.5 rounded-btn flex items-center gap-1.5 ${
            section === 'recurring' ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>2. قواعد المصروفات الدورية وتوليد الفترات ({recurringRules.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('manual_sales')}
          className={`px-4 py-2.5 rounded-btn flex items-center gap-1.5 ${
            section === 'manual_sales' ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>3. المبيعات اليدوية ونقاط البيع ({manualSalesData.sales?.length || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('partners')}
          className={`px-4 py-2.5 rounded-btn flex items-center gap-1.5 ${
            section === 'partners' ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>4. حصص ومسحوبات الشركاء ({partnersData.partners?.length || 0})</span>
        </button>
      </div>

      {/* SECTION 1: ONE-OFF & GENERATED EXPENSES */}
      {section === 'expenses' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateExpense}
            className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs font-bold"
          >
            <h4 className="text-sm font-black text-ink">+ تسجيل مصروف تشغيلي جديد</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-ink-soft mb-1">بيان المصروف *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="مثال: فاتورة كهرباء شهر أكتوبر"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">التصنيف *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-soft mb-1">قيمة المصروف *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">تاريخ الاستحقاق الفعلي *</label>
                <input
                  type="date"
                  required
                  value={expenseForm.effectiveDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, effectiveDate: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
            </div>

            {(expenseForm.category === 'partner_withdrawal' || expenseForm.category === 'partner_profit_distribution') && (
              <div className="p-3.5 rounded-card bg-amber-500/10 border border-amber-500/30 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-amber-800 dark:text-amber-200 mb-1">اختر الشريك صاحب السحب / الحصة *</label>
                  <select
                    required
                    value={expenseForm.partnerId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const p = (partnersData.partners || []).find((x) => x._id === pId);
                      setExpenseForm({
                        ...expenseForm,
                        partnerId: pId,
                        partnerName: p ? p.name : '',
                        payeeName: p ? p.name : expenseForm.payeeName
                      });
                    }}
                    className="w-full bg-paper border border-line rounded-btn p-2 text-ink font-bold"
                  >
                    <option value="">-- حدد الشريك المستفيد من المسحوبات --</option>
                    {(partnersData.partners || []).map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} (حصة: {p.sharePercentage}% — مسحوباته الحالية: {(p.totalWithdrawals || 0).toLocaleString()} {currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300">
                  💡 سيتم ربط المصروف مباشرة ببطاقة الشريك وحسابه الرأسمالي لحساب توازن المسحوبات مقابل نسبته بدقة ومنع أي نزاع مالي بين الشركاء.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-ink-soft mb-1">الجهة المستفيدة (Payee)</label>
                <input
                  type="text"
                  value={expenseForm.payeeName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payeeName: e.target.value })}
                  placeholder="مثال: شركة الكهرباء / المؤجر"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-btn bg-paper border border-line cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={expenseForm.payImmediately}
                  onChange={(e) => setExpenseForm({ ...expenseForm, payImmediately: e.target.checked })}
                  className="accent-primary"
                />
                <span>تم السداد نقداً/بنكياً الآن (سجل دفعة فورية)</span>
              </label>

              <div className="mt-4">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-btn bg-primary text-white font-black"
                >
                  حفظ المصروف
                </button>
              </div>
            </div>
          </form>

          {/* Expenses Table */}
          <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
            <h4 className="text-sm font-black text-ink">سجل المصروفات وحالة السداد لكل فترة محاسبية</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-2.5">الكود</th>
                    <th className="p-2.5">الفترة</th>
                    <th className="p-2.5">البيان</th>
                    <th className="p-2.5">التصنيف</th>
                    <th className="p-2.5">المبلغ المستحق</th>
                    <th className="p-2.5">المدفوع</th>
                    <th className="p-2.5">المتبقي</th>
                    <th className="p-2.5">الحالة</th>
                    <th className="p-2.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(expensesData.expenses || []).map((ex) => (
                    <tr key={ex._id} className="hover:bg-paper/60">
                      <td className="p-2.5 font-mono font-black text-primary">
                        {ex.expenseCode}
                        {ex.recurringRuleId && (
                          <span className="mr-1 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 text-[9px]">
                            دوري
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono font-bold">{ex.accountingPeriod}</td>
                      <td className="p-2.5 font-bold text-ink">
                        <div>{ex.title}</div>
                        {ex.partnerName && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                              👤 شريك: {ex.partnerName} {ex.partnerSharePercent ? `(${ex.partnerSharePercent}%)` : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-ink-soft">
                        {EXPENSE_CATEGORY_LABELS[ex.category] || ex.category}
                      </td>
                      <td className="p-2.5 font-black">
                        {ex.amount} {currency}
                      </td>
                      <td className="p-2.5 font-bold text-emerald-600">
                        {ex.totalPaid} {currency}
                      </td>
                      <td className="p-2.5 font-black text-red-500">
                        {ex.outstandingBalance} {currency}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            ex.paymentStatus === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : ex.paymentStatus === 'partial'
                              ? 'bg-orange-500/15 text-orange-600'
                              : 'bg-red-500/15 text-red-500'
                          }`}
                        >
                          {ex.paymentStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {ex.outstandingBalance > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentModal({
                                isOpen: true,
                                targetType: 'expense',
                                targetDoc: ex,
                                amount: ex.outstandingBalance,
                                paymentMethod: 'cash',
                                referenceNote: ''
                              })
                            }
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-black"
                          >
                            سداد دفعة
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: RECURRING EXPENSE RULES & OCCURRENCE GENERATOR */}
      {section === 'recurring' && (
        <div className="space-y-6">
          <div className="p-4 rounded-card bg-indigo-500/10 border border-indigo-500/25 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <strong className="font-black text-indigo-600 block">
                فصل تعريف القاعدة الدورية عن سجلات الفترات الفعلية (Rule vs. Occurrence Separation):
              </strong>
              <span className="text-ink-soft">
                تعديل قيمة الإيجار أو الراتب في القاعدة الدورية يطبق على الفترات المستقبلية فقط، ولا يغير أبداً سجلات الأشهر السابقة.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={genPeriodKey}
                onChange={(e) => setGenPeriodKey(e.target.value)}
                className="bg-surface border border-line rounded-btn px-3 py-1.5 font-mono font-bold text-ink"
              />
              <button
                type="button"
                onClick={handleGenerateOccurrences}
                className="px-4 py-2 rounded-btn bg-indigo-600 text-white font-black hover:bg-indigo-700"
              >
                توليد استحقاقات الفترة المحددة ⚡
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSaveRecurringRule}
            className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs font-bold"
          >
            <h4 className="text-sm font-black text-ink">
              {editingRule
                ? `تعديل القاعدة الدورية (${editingRule.ruleCode}) للفترات القادمة`
                : '+ إضافة قاعدة مصروف دوري جديدة (إيجار، رواتب، اشتراكات...)'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-ink-soft mb-1">عنوان المصروف الدوري *</label>
                <input
                  type="text"
                  required
                  value={ruleForm.title}
                  onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                  placeholder="مثال: إيجار المعرض الشهري"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">التصنيف *</label>
                <select
                  value={ruleForm.category}
                  onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-soft mb-1">المبلغ الدوري (للفترات القادمة) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={ruleForm.amount}
                  onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">التكرار</label>
                <select
                  value={ruleForm.frequency}
                  onChange={(e) => setRuleForm({ ...ruleForm, frequency: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  <option value="monthly">شهري (Monthly)</option>
                  <option value="weekly">أسبوعي (Weekly)</option>
                  <option value="quarterly">ربع سنوي (Quarterly)</option>
                  <option value="yearly">سنوي (Yearly)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2.5 px-4 rounded-btn bg-primary text-white font-black">
                  {editingRule ? 'تحديث القاعدة' : 'حفظ القاعدة'}
                </button>
                {editingRule && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRule(null);
                      setRuleForm({
                        title: '',
                        category: 'rent',
                        amount: '',
                        frequency: 'monthly',
                        dayOfMonth: 1,
                        payeeName: '',
                        generateCurrentPeriod: true
                      });
                    }}
                    className="py-2.5 px-3 rounded-btn bg-paper border border-line text-ink"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
            <h4 className="text-sm font-black text-ink">قواعد المصروفات الدورية المسجلة</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-2.5">كود القاعدة</th>
                    <th className="p-2.5">العنوان</th>
                    <th className="p-2.5">التصنيف</th>
                    <th className="p-2.5">المبلغ الحالي</th>
                    <th className="p-2.5">التكرار</th>
                    <th className="p-2.5">آخر فترة ولّدت</th>
                    <th className="p-2.5 text-center">تعديل للمستقبل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recurringRules.map((r) => (
                    <tr key={r._id} className="hover:bg-paper/60">
                      <td className="p-2.5 font-mono font-black text-primary">{r.ruleCode}</td>
                      <td className="p-2.5 font-bold text-ink">{r.title}</td>
                      <td className="p-2.5 text-ink-soft">{EXPENSE_CATEGORY_LABELS[r.category] || r.category}</td>
                      <td className="p-2.5 font-black text-emerald-600">
                        {r.amount} {currency}
                      </td>
                      <td className="p-2.5 font-bold">{r.frequency}</td>
                      <td className="p-2.5 font-mono">{r.lastGeneratedPeriodKey || 'لم تولد بعد'}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRule(r);
                            setRuleForm({
                              title: r.title,
                              category: r.category,
                              amount: r.amount,
                              frequency: r.frequency,
                              dayOfMonth: r.dayOfMonth || 1,
                              payeeName: r.payeeName || '',
                              generateCurrentPeriod: false
                            });
                          }}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: MANUAL / OFFLINE SALES */}
      {section === 'manual_sales' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateManualSale}
            className="rounded-card bg-surface border border-line p-5 space-y-4 shadow-sm text-xs font-bold"
          >
            <h4 className="text-sm font-black text-ink">
              + تسجيل عملية بيع يدوي / خارج المتجر الإلكتروني (Manual / POS / Showroom Sale)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-ink-soft mb-1">مصدر البيع (Source Channel) *</label>
                <select
                  value={saleForm.sourceChannel}
                  onChange={(e) => setSaleForm({ ...saleForm, sourceChannel: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  {Object.entries(MANUAL_SALE_SOURCE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-ink-soft mb-1">اسم العميل *</label>
                <input
                  type="text"
                  required
                  value={saleForm.customerName}
                  onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">المنتج من الكتالوج (يخصم المخزون ويحسب COGS) *</label>
                <select
                  required
                  value={saleForm.productId}
                  onChange={(e) => {
                    const p = catalogProducts.find((pr) => pr._id === e.target.value);
                    setSaleForm({
                      ...saleForm,
                      productId: e.target.value,
                      unitPrice: p?.price ?? ''
                    });
                  }}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  <option value="">-- اختر المنتج --</option>
                  {catalogProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (السعر: {p.price} {currency} | المتاح: {p.stockCount})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-ink-soft mb-1">الكمية *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-ink-soft mb-1">سعر الوحدة *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={saleForm.unitPrice}
                    onChange={(e) => setSaleForm({ ...saleForm, unitPrice: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-ink-soft mb-1">المبلغ المحصل الآن (اتركه فارغاً إذا كان آجل) </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saleForm.initialPaidAmount}
                  onChange={(e) => setSaleForm({ ...saleForm, initialPaidAmount: e.target.value })}
                  placeholder="مثال: تحصيل كامل أو دفعة مقدمة..."
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">طريقة التحصيل</label>
                <select
                  value={saleForm.paymentMethod}
                  onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
                >
                  <option value="cash">نقدي (Cash)</option>
                  <option value="bank_transfer">تحويل بنكي / InstaPay</option>
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="card">بطاقة بنكية (POS)</option>
                </select>
              </div>
              <button
                type="submit"
                className="py-2.5 px-4 rounded-btn bg-emerald-600 text-white font-black hover:bg-emerald-700"
              >
                اعتماد البيع اليدوي وخصم المخزون
              </button>
            </div>
          </form>

          {/* Manual Sales Table */}
          <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
            <h4 className="text-sm font-black text-ink">سجل المبيعات اليدوية المستقل عن طلبات الأونلاين</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                  <tr>
                    <th className="p-2.5">رقم الفاتورة</th>
                    <th className="p-2.5">القناة / المصدر</th>
                    <th className="p-2.5">العميل</th>
                    <th className="p-2.5">الإجمالي</th>
                    <th className="p-2.5">تكلفة البضاعة (COGS)</th>
                    <th className="p-2.5">المحصل</th>
                    <th className="p-2.5">المتبقي</th>
                    <th className="p-2.5">الحالة</th>
                    <th className="p-2.5 text-center">تحصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(manualSalesData.sales || []).map((ms) => (
                    <tr key={ms._id} className="hover:bg-paper/60">
                      <td className="p-2.5 font-mono font-black text-primary">{ms.saleCode}</td>
                      <td className="p-2.5 font-bold">
                        {MANUAL_SALE_SOURCE_LABELS[ms.sourceChannel] || ms.sourceChannel}
                      </td>
                      <td className="p-2.5 font-bold text-ink">{ms.customerName}</td>
                      <td className="p-2.5 font-black">
                        {ms.totalAmount} {currency}
                      </td>
                      <td className="p-2.5 font-mono text-ink-soft">
                        {ms.totalCostOfGoodsSold} {currency}
                      </td>
                      <td className="p-2.5 font-bold text-emerald-600">
                        {ms.totalCollected} {currency}
                      </td>
                      <td className="p-2.5 font-black text-orange-600">
                        {ms.outstandingBalance} {currency}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-paper border border-line text-[10px] font-black">
                          {ms.paymentStatus}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {ms.outstandingBalance > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentModal({
                                isOpen: true,
                                targetType: 'manual_sale',
                                targetDoc: ms,
                                amount: ms.outstandingBalance,
                                paymentMethod: 'cash',
                                referenceNote: ''
                              })
                            }
                            className="px-2.5 py-1 rounded bg-primary text-white text-[10px] font-black"
                          >
                            تحصيل دفعة
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: PARTNERS & EQUITY LEDGER */}
      {section === 'partners' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-card bg-surface border border-line shadow-sm">
            <div>
              <h4 className="text-sm font-black text-ink flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>حسابات الشركاء والمسحوبات الشخصية (Partners Equity & Drawings)</span>
              </h4>
              <p className="text-xs text-ink-soft mt-0.5">
                متابعة الحصص الرأسمالية للملاك، وتوثيق المسحوبات النقدية الفردية لمنع أي نزاع مالي وضبط التوازن بين الشركاء.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(true)}
                className="px-3.5 py-2 rounded-btn bg-surface border border-line text-ink hover:bg-paper flex items-center gap-1.5 text-xs font-black shadow-sm"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>+ تسجيل شريك جديد</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstPartner = partnersData.partners?.[0];
                  setPartnerWithdrawalModal({
                    isOpen: true,
                    partnerId: firstPartner?._id || '',
                    partnerName: firstPartner?.name || '',
                    amount: '',
                    notes: '',
                    paymentMethod: 'cash'
                  });
                }}
                className="px-4 py-2 rounded-btn bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 text-xs font-black shadow-sm"
              >
                <DollarSign className="w-4 h-4" />
                <span>💸 صرف مسحوبات لشريك</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards for Partners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
              <span className="text-xs font-bold text-ink-soft">إجمالي رأس المال المكتتب</span>
              <div className="text-xl font-black text-ink">
                {(partnersData.summary?.totalInitialCapital || 0).toLocaleString()} {currency}
              </div>
              <span className="text-[11px] text-ink-soft block">
                مجموع حصص الشركاء المسجلة: {partnersData.summary?.totalSharePercentage || 0}%
              </span>
            </div>

            <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
              <span className="text-xs font-bold text-ink-soft">إجمالي المسحوبات الشخصية التراكمية</span>
              <div className="text-xl font-black text-rose-500">
                {(partnersData.summary?.totalWithdrawals || 0).toLocaleString()} {currency}
              </div>
              <span className="text-[11px] text-ink-soft block">
                مسجلة ومخصومة من سيولة الخزينة كـ Outflow
              </span>
            </div>

            <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
              <span className="text-xs font-bold text-ink-soft">صافي رأس المال المتبقي في المشروع</span>
              <div className="text-xl font-black text-emerald-600">
                {(partnersData.summary?.netRemainingCapital || 0).toLocaleString()} {currency}
              </div>
              <span className="text-[11px] text-ink-soft block">رأس المال الأولي - إجمالي المسحوبات</span>
            </div>

            <div className="p-4 rounded-card bg-surface border border-line shadow-sm space-y-1">
              <span className="text-xs font-bold text-ink-soft">عدد الشركاء النشطين</span>
              <div className="text-xl font-black text-primary">
                {partnersData.summary?.activePartnersCount || partnersData.partners?.length || 0}
              </div>
              <span className="text-[11px] text-ink-soft block">شركاء معتمدون في النظام</span>
            </div>
          </div>

          {/* Partners Equity & Comparison Table */}
          <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-ink flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                <span>جدول حصص الشركاء والمقارنة الرقابية لمنع النزاعات</span>
              </h4>
              <span className="text-[11px] text-ink-soft">
                يقارن النظام نسبة مسحوبات كل شريك الفعلية مع نسبة حصته في الملكية
              </span>
            </div>

            {(!partnersData.partners || partnersData.partners.length === 0) ? (
              <div className="p-8 text-center text-ink-soft text-xs">
                لا يوجد شركاء مسجلين حتى الآن. اضغط على "+ تسجيل شريك جديد" لبدء ضبط حصص الشركاء.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                    <tr>
                      <th className="p-2.5">الشريك</th>
                      <th className="p-2.5">رقم الهاتف</th>
                      <th className="p-2.5">الحصة المتفق عليها</th>
                      <th className="p-2.5">رأس المال المبدئي</th>
                      <th className="p-2.5">إجمالي المسحوبات</th>
                      <th className="p-2.5">نسبة المسحوبات الفعلية</th>
                      <th className="p-2.5">مؤشر التوازن والعدالة</th>
                      <th className="p-2.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {partnersData.partners.map((p) => {
                      const variance = p.withdrawalVariance || 0;
                      const isHigh = variance > 5;
                      const isLow = variance < -5;
                      return (
                        <tr key={p._id} className="hover:bg-paper/60">
                          <td className="p-2.5 font-bold text-ink flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <div>{p.name}</div>
                              {p.notes && <div className="text-[10px] text-ink-soft font-normal">{p.notes}</div>}
                            </div>
                          </td>
                          <td className="p-2.5 font-mono text-ink-soft">{p.phone || '—'}</td>
                          <td className="p-2.5 font-black text-primary">
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                              {p.sharePercentage}%
                            </span>
                          </td>
                          <td className="p-2.5 font-bold">
                            {(p.initialCapital || 0).toLocaleString()} {currency}
                          </td>
                          <td className="p-2.5 font-black text-rose-500">
                            {(p.totalWithdrawals || 0).toLocaleString()} {currency}
                          </td>
                          <td className="p-2.5 font-mono font-bold">
                            {p.actualWithdrawalRatio != null ? `${p.actualWithdrawalRatio}%` : '0%'}
                          </td>
                          <td className="p-2.5">
                            {isHigh ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 text-[10px] font-black border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" />
                                سحب أعلى من الحصة (+{variance}%)
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 text-[10px] font-black border border-blue-500/20">
                                سحب أقل من الحصة ({variance}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-black border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                متوازن وعادل
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setPartnerWithdrawalModal({
                                  isOpen: true,
                                  partnerId: p._id,
                                  partnerName: p.name,
                                  amount: '',
                                  notes: '',
                                  paymentMethod: 'cash'
                                });
                              }}
                              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black flex items-center gap-1 mx-auto"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>صرف مسحوبات</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Partner Withdrawals Log Table */}
          <div className="rounded-card bg-surface border border-line p-5 space-y-3 shadow-sm">
            <h4 className="text-sm font-black text-ink">سجل حركات مسحوبات وتوزيعات الشركاء الأخيرة</h4>
            {(!partnersData.recentWithdrawals || partnersData.recentWithdrawals.length === 0) ? (
              <div className="p-6 text-center text-ink-soft text-xs">
                لم يتم تسجيل أي مسحوبات شخصية حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-paper text-ink-soft font-bold border-b border-line">
                    <tr>
                      <th className="p-2.5">رقم السند</th>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">الشريك المستلم</th>
                      <th className="p-2.5">المبلغ المصروف</th>
                      <th className="p-2.5">طريقة الدفع</th>
                      <th className="p-2.5">البيان والملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {partnersData.recentWithdrawals.map((w) => (
                      <tr key={w._id} className="hover:bg-paper/60">
                        <td className="p-2.5 font-mono font-black text-primary">{w.expenseCode}</td>
                        <td className="p-2.5 font-mono text-ink-soft">
                          {w.effectiveDate ? new Date(w.effectiveDate).toLocaleDateString('ar-EG') : '—'}
                        </td>
                        <td className="p-2.5 font-bold text-ink">
                          {w.partnerName || w.payeeName}
                          {w.partnerSharePercent && (
                            <span className="text-ink-soft text-[10px] font-normal mr-1">
                              ({w.partnerSharePercent}%)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-black text-rose-500">
                          {(w.amount || 0).toLocaleString()} {currency}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-paper border border-line text-[10px] font-bold">
                            {w.paymentMethod || 'cash'}
                          </span>
                        </td>
                        <td className="p-2.5 text-ink-soft">{w.notes || w.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordModalPayment}
            className="bg-surface text-ink rounded-card border border-line p-5 w-full max-w-md space-y-4 shadow-2xl text-xs font-bold"
          >
            <h5 className="text-sm font-black text-ink">
              {paymentModal.targetType === 'expense'
                ? `سداد دفعة للمصروف (${paymentModal.targetDoc?.expenseCode})`
                : `تحصيل دفعة للبيع اليدوي (${paymentModal.targetDoc?.saleCode})`}
            </h5>
            <div>
              <label className="block text-ink-soft mb-1">المبلغ *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentModal.amount}
                onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">طريقة الدفع</label>
              <select
                value={paymentModal.paymentMethod}
                onChange={(e) => setPaymentModal({ ...paymentModal, paymentMethod: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value="cash">نقدي (Cash)</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="wallet">محفظة إلكترونية</option>
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">ملاحظة / رقم إيصال</label>
              <input
                type="text"
                value={paymentModal.referenceNote}
                onChange={(e) => setPaymentModal({ ...paymentModal, referenceNote: e.target.value })}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setPaymentModal({
                    isOpen: false,
                    targetType: 'expense',
                    targetDoc: null,
                    amount: '',
                    paymentMethod: 'cash',
                    referenceNote: ''
                  })
                }
                className="px-4 py-2 rounded-btn bg-paper border border-line text-ink"
              >
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-btn bg-primary text-white font-black">
                تأكيد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Partner Modal */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePartner}
            className="bg-surface text-ink rounded-card border border-line p-5 w-full max-w-md space-y-4 shadow-2xl text-xs font-bold"
          >
            <h5 className="text-sm font-black text-ink flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>إضافة شريك جديد لحصص المحل</span>
            </h5>
            <div>
              <label className="block text-ink-soft mb-1">اسم الشريك / المالك *</label>
              <input
                type="text"
                required
                value={partnerForm.name}
                onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                placeholder="مثال: د. محمود فهمي"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-bold"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={partnerForm.phone}
                onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                placeholder="010XXXXXXXX"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-soft mb-1">نسبة الحصة (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={partnerForm.sharePercentage}
                  onChange={(e) => setPartnerForm({ ...partnerForm, sharePercentage: e.target.value })}
                  placeholder="50"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-ink-soft mb-1">رأس المال المبدئي ({currency})</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={partnerForm.initialCapital}
                  onChange={(e) => setPartnerForm({ ...partnerForm, initialCapital: e.target.value })}
                  placeholder="0"
                  className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">ملاحظات إضافية</label>
              <textarea
                rows="2"
                value={partnerForm.notes}
                onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                placeholder="شريك ممول / شريك إداري..."
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(false)}
                className="px-4 py-2 rounded-btn bg-paper border border-line text-ink"
              >
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-btn bg-primary text-white font-black">
                حفظ الشريك
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partner Withdrawal Modal */}
      {partnerWithdrawalModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPartnerWithdrawalSubmit}
            className="bg-surface text-ink rounded-card border border-line p-5 w-full max-w-md space-y-4 shadow-2xl text-xs font-bold"
          >
            <h5 className="text-sm font-black text-ink flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <span>تسجيل وصرف مسحوبات شخصية لشريك</span>
            </h5>
            <div>
              <label className="block text-ink-soft mb-1">الشريك المستلم *</label>
              <select
                required
                value={partnerWithdrawalModal.partnerId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const p = (partnersData.partners || []).find((x) => x._id === pId);
                  setPartnerWithdrawalModal({
                    ...partnerWithdrawalModal,
                    partnerId: pId,
                    partnerName: p ? p.name : ''
                  });
                }}
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-bold"
              >
                <option value="">-- اختر الشريك --</option>
                {(partnersData.partners || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (حصة: {p.sharePercentage}% — سحب سابق: {(p.totalWithdrawals || 0).toLocaleString()} {currency})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">المبلغ المطلوب صرفه ({currency}) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={partnerWithdrawalModal.amount}
                onChange={(e) =>
                  setPartnerWithdrawalModal({ ...partnerWithdrawalModal, amount: e.target.value })
                }
                placeholder="مثال: 5000"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink font-mono font-bold text-base"
              />
            </div>
            <div>
              <label className="block text-ink-soft mb-1">طريقة الصرف</label>
              <select
                value={partnerWithdrawalModal.paymentMethod}
                onChange={(e) =>
                  setPartnerWithdrawalModal({ ...partnerWithdrawalModal, paymentMethod: e.target.value })
                }
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              >
                <option value="cash">نقدي من الخزينة (Cash)</option>
                <option value="bank_transfer">تحويل بنكي من الحساب (Bank)</option>
                <option value="wallet">محفظة إلكترونية (Wallet)</option>
              </select>
            </div>
            <div>
              <label className="block text-ink-soft mb-1">البيان / ملاحظات الصرف</label>
              <input
                type="text"
                value={partnerWithdrawalModal.notes}
                onChange={(e) =>
                  setPartnerWithdrawalModal({ ...partnerWithdrawalModal, notes: e.target.value })
                }
                placeholder="مثال: دفعة تحت حساب الأرباح عن شهر أكتوبر"
                className="w-full bg-paper border border-line rounded-btn p-2.5 text-ink"
              />
            </div>

            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
              ⚡ يتم تسجيل العملية فورياً كـ Outflow في الخزينة والرقابة المالية وخصمها من رصيد الشريك داخل معاملة ذرية (ACID Transaction).
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setPartnerWithdrawalModal({
                    isOpen: false,
                    partnerId: '',
                    partnerName: '',
                    amount: '',
                    notes: '',
                    paymentMethod: 'cash'
                  })
                }
                className="px-4 py-2 rounded-btn bg-paper border border-line text-ink"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-btn bg-amber-600 hover:bg-amber-700 text-white font-black"
              >
                تأكيد وصرف المسحوبات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
