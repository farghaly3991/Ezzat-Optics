import React, { useState, useEffect, useMemo } from 'react';
import {
  Code,
  ShieldAlert,
  Sparkles,
  Save,
  Plus,
  Trash2,
  Layers,
  FileText,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Globe,
  Tag,
  Glasses,
  Store,
  LayoutDashboard,
  ScanBarcode,
  ShoppingBag,
  Building2,
  Eye,
  Wallet,
  Wrench,
  RotateCcw,
  CalendarClock,
  BellRing,
  HelpCircle,
  AlertTriangle,
  UserCheck,
  Truck,
  ClipboardList,
  Search,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bot
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';

// Master Definitions for All System Tabs & Functional Modules
const MASTER_TABS_DEFINITIONS = [
  {
    key: 'overview',
    moduleKey: 'analytics',
    path: '/admin/overview',
    def: 'الرئيسية والمؤشرات',
    icon: LayoutDashboard,
    category: 'القيادة والتقارير',
    badge: 'عام',
    desc: 'لوحة القيادة التنفيذية، نبض العمليات الحية، ومؤشرات الأداء المالي والتشغيلي والمستشار الذكي.',
    cascadeScope: [
      'اللوحة المركزية لكافة إحصائيات ونبض العمليات الحية',
      'الملخص المالي وصافي الأرباح ومعدلات النمو اليومية',
      'المستشار الاستراتيجي الذكي (AI Executive Insighter & COO)'
    ],
    isCore: true
  },
  {
    key: 'pos',
    moduleKey: 'pos',
    path: '/admin/pos',
    def: 'نقطة البيع (POS)',
    icon: ScanBarcode,
    category: 'المبيعات والكاشير',
    badge: 'F1',
    desc: 'شاشة الكاشير والمبيعات السريعة، إدخال مقاسات النظر، واختيار طرق الدفع وطباعة الفاتورة الحرارية.',
    cascadeScope: [
      'شاشة الكاشير ونقاط البيع اليومية بالفرع',
      'إصدار فواتير البيع الفورية وإيصالات الدفع الحرارية',
      'ربط مبيعات العدسات بمصفوفة الجريد وكشوفات النظر'
    ]
  },
  {
    key: 'orders',
    moduleKey: 'orders',
    path: '/admin/orders',
    def: 'الطلبات وفواتير البيع',
    icon: ShoppingBag,
    category: 'المبيعات والكاشير',
    badge: 'فواتير',
    desc: 'سجل الطلبات الشامل ومتابعة مراحل التنفيذ (قيد التجهيز، خرج للشحن، تم التسليم، مرتجع).',
    cascadeScope: [
      'تتبع دورة حياة الطلب من الإنشاء حتى التسليم النهائي',
      'تحديث حالات الدفع وتعديل تفاصيل الفاتورة',
      'توليد بوالص الشحن وطباعة الفواتير الضريبية'
    ]
  },
  {
    key: 'attendance',
    moduleKey: 'attendance',
    path: '/admin/attendance',
    def: 'تحضير الموظفين السريع',
    icon: UserCheck,
    category: 'الموارد البشرية والفروع',
    badge: 'سريع',
    desc: 'نقطة تحضير الحضور والانصراف المباشرة بالباركود وQR الموظف، ومتابعة نوبات العمل والورديات.',
    cascadeScope: [
      'إظهار/إخفاء التاب المباشر السريع من شريط التنقل العلوي للمسؤولين',
      'تفعيل كشك مسح الباركود والـ QR Code الفوري على أجهزة الكاونتر',
      'تسجيل أوقات الحضور والانصراف والتأخير وساعات العمل الفعلية'
    ]
  },
  {
    key: 'labs',
    moduleKey: 'labs',
    path: '/admin/labs',
    def: 'الورش والمعامل الخارجية',
    icon: Building2,
    category: 'التشغيل والفنيين',
    badge: 'SLA',
    desc: 'إصدار أوامر شغل وتصنيع العدسات لمعامل خارجية، ومتابعة مراحل القص والجودة وتكلفة المعمل.',
    cascadeScope: [
      'إخفاء تاب الورش والمعامل وأوامر التشغيل الخارجية من القائمة',
      'تعطيل خيار إرسال العدسة لمعمل خارجي عند إصدار الفاتورة بالـ POS',
      'إخفاء مؤشر إنجاز المعامل والطلبات بانتظار التسليم من الـ Overview'
    ]
  },
  {
    key: 'customers',
    moduleKey: 'customers',
    path: '/admin/customers',
    def: 'العملاء وكشوف النظر',
    icon: Eye,
    category: 'العملاء والفحوصات',
    badge: 'CRM',
    desc: 'سجل العملاء، بروفايلات كشف النظر والقياسات البصرية، والأجهزة وسجلات الفحص السابقة.',
    cascadeScope: [
      'قاعدة بيانات العملاء وسجل المشتريات والمدفوعات',
      'سجل قياسات النظر والمصفوفة ومرفقات الروشتة لكل عميل',
      'ربط الفواتير بملف العميل التراكمي'
    ]
  },
  {
    key: 'products',
    moduleKey: 'products',
    path: '/admin/products',
    def: 'إدارة المنتجات والمخزون',
    icon: Glasses,
    category: 'المخزون والمنتجات',
    badge: 'مخزون',
    desc: 'كتالوج الأصناف والأسعار، مصفوفات درجات العدسات (Grid Matrix)، وجرد المخازن.',
    cascadeScope: [
      'إدارة الشنابر، العدسات اللاصقة والطبية، والإكسسوارات',
      'مصفوفة مقاسات العدسات الطبية (Sphere / Cylinder)',
      'تحديد تنبيهات حد الطلب والمخزون الحرج'
    ]
  },
  {
    key: 'procurement',
    moduleKey: 'procurement',
    path: '/admin/procurement',
    def: 'التوريدات والموردين',
    icon: Truck,
    category: 'المخزون والمنتجات',
    badge: 'توريد',
    desc: 'أوامر التوريد للنواقص، حساب تكلفة الهبوط (Landed Cost)، ومتابعة أرصدة الموردين.',
    cascadeScope: [
      'إخفاء تاب التوريدات وشحنات الموردين من القائمة',
      'إخفاء تنبيهات طلبيات التوريد المعلقة ومقترحات النواقص من الـ Overview',
      'تعطيل تدفق توريد البضائع وحساب تكاليف الشحن والجمارك'
    ]
  },
  {
    key: 'finance',
    moduleKey: 'finance',
    path: '/admin/finance',
    def: 'الخزينة والمالية',
    icon: Wallet,
    category: 'المالية والحسابات',
    badge: 'خزينة',
    desc: 'الخزينة النقدية، المصروفات التشغيلية، القيود المحاسبية، ومتابعة السيولة النقدية.',
    cascadeScope: [
      'دفتر الخزينة النقدية وإيرادات ومصروفات الفروع',
      'سندات القبض والصرف اليدوية وحسابات أرباح التشغيل',
      'انعكاس كافة حركات البيع والتقسيط والتوريد في الأستاذ العام'
    ]
  },
  {
    key: 'categories',
    moduleKey: 'categories',
    path: '/admin/categories',
    def: 'الأقسام والتصنيفات',
    icon: Layers,
    category: 'المخزون والمنتجات',
    badge: 'فئات',
    desc: 'شجرة الفئات، الماركات، وتحديد السمات الخاصة كالأشكال والمقاسات والألوان.',
    cascadeScope: [
      'تقسيم المنتجات وتصنيفها في الكتالوج والمتجر',
      'تخصيص الفلاتر الذكية (شمسية، طبية، عدسات، ذكورية/أنثوية)',
      'انعكاس تصنيفات المبيعات في تقارير ورسوم الـ Overview'
    ]
  },
  {
    key: 'installments',
    moduleKey: 'installments',
    path: '/admin/installments',
    def: 'الأقساط والتحصيل',
    icon: CalendarClock,
    category: 'المبيعات والكاشير',
    badge: 'أقساط',
    desc: 'خطط التقسيط، جدولة الدفعات الشهرية، بيانات الضامن، وسندات تحصيل الأقساط.',
    cascadeScope: [
      'إخفاء تاب الأقساط والتحصيل كلياً من القائمة الجانبية والعلوية',
      'إخفاء خيار الدفع بالتقسيط من شاشة الكاشير (POS)',
      'إخفاء مؤشر معدل الالتزام بالأقساط ومخطط التحصيل من شاشة الـ Overview'
    ]
  },
  {
    key: 'returns',
    moduleKey: 'returns',
    path: '/admin/returns',
    def: 'المرتجعات والضمان',
    icon: RotateCcw,
    category: 'المبيعات والكاشير',
    badge: 'مرتجع',
    desc: 'إدارة طلبات الإرجاع، فحص جودة المرتجع، استرجاع المخزن، وتسجيل المبالغ المستردة.',
    cascadeScope: [
      'إخفاء تاب المرتجعات والضمان من القائمة الرئيسية',
      'إخفاء مؤشر معدل المرتجعات ومخطط التالف والهدر من الـ Overview',
      'تعطيل معالجة طلبات الإرجاع ورد النقدية من الخزينة'
    ]
  },
  {
    key: 'maintenance',
    moduleKey: 'maintenance',
    path: '/admin/maintenance',
    def: 'ورشة الصيانة والتجهيز',
    icon: Wrench,
    category: 'التشغيل والفنيين',
    badge: 'صيانة',
    desc: 'تذاكر صيانة الشنابر، تعديل المقاسات، لحام الشاسيه، وقطع الغيار المستهلكة.',
    cascadeScope: [
      'إخفاء تاب ورشة التجهيز والصيانة الداخلية من القائمة',
      'إلغاء خيار حجز وتعديل الصيانة في الكتالوج وصفحة تفاصيل المنتج',
      'إخفاء تذاكر استلام الأجهزة المعطوبة والتعديلات'
    ]
  },
  {
    key: 'desiredProducts',
    moduleKey: 'desiredProducts',
    path: '/admin/desired-products',
    def: 'قوائم الانتظار ونواقص الطلب',
    icon: BellRing,
    category: 'المخزون والمنتجات',
    badge: 'طلبات',
    desc: 'إدارة طلبات المنتجات المرغوبة غير المتوفرة وقوائم انتظار العملاء وإشعارهم تلقائياً فور توفرها.',
    cascadeScope: [
      'إظهار/إخفاء تاب قوائم الانتظار والمنتجات المرغوبة في لوحة التحكم',
      'مطابقة المنتجات الجديدة دلالياً مع طلبات العملاء المسجلة مسبقاً (768-d Gemini)',
      'إرسال تنبيهات توفر المنتج للعملاء المنتظرين عبر واتساب أو الإشعارات'
    ]
  },
  {
    key: 'aiInstructions',
    moduleKey: 'aiInstructions',
    path: '/admin/ai-instructions',
    def: 'تعليمات المساعد الذكي (AI)',
    icon: Bot,
    category: 'القيادة والتقارير',
    badge: 'AI',
    desc: 'توجيهات وقواعد إدارة المتجر المخصصة للمساعد الذكي ومستشار المبيعات لترشيح أصناف أو سياسات محددة.',
    cascadeScope: [
      'إظهار/إخفاء تاب تعليمات المساعد الذكي وتوجيهات المبيعات في لوحة الإدارة',
      'حقن قواعد وتوجيهات الإدارة النشطة تلقائياً في مستشار التسوق الذكي للعملاء',
      'محاكاة واختبار تأثير التعليمات على ردود وترشيحات الذكاء الاصطناعي'
    ]
  },
  {
    key: 'coupons',
    moduleKey: 'coupons',
    path: '/admin/coupons',
    def: 'كوبونات الخصم',
    icon: Tag,
    category: 'التسويق والمتجر',
    badge: 'تسويق',
    desc: 'إنشاء وتحديد نسب الخصم والرموز الترويجية، حدود الاستخدام، وتواريخ الصلاحية.',
    cascadeScope: [
      'إخفاء تاب إدارة الكوبونات من القائمة الرئيسية للمسؤولين',
      'إخفاء حقل إدخال كود الكوبون من سلة التسوق وشاشة إتمام الطلب',
      'تعطيل فحص وتحقق الكوبونات الترويجية عبر واجهة الـ API'
    ]
  },
  {
    key: 'offers',
    moduleKey: 'offers',
    path: '/admin/offers',
    def: 'العروض الترويجية',
    icon: Sparkles,
    category: 'التسويق والمتجر',
    badge: 'عروض',
    desc: 'بانرات العروض الموسمية، تصفيات الفروع، وحزم المنتجات (Bundles).',
    cascadeScope: [
      'إخفاء تاب العروض الترويجية من لوحة التحكم',
      'إخفاء شرائط وبانرات العروض الترويجية من واجهة المتجر للعملاء',
      'تعطيل احتساب خصومات الحزم التلقائية'
    ]
  },
  {
    key: 'carts',
    moduleKey: 'carts',
    path: '/admin/carts',
    def: 'السلات المتروكة',
    icon: ShoppingBag,
    category: 'التسويق والمتجر',
    badge: 'سلات',
    desc: 'رصد المتسوقين الذين أضافوا منتجات للسلة ولم يكملوا الدفع، وإرسال تنبيهات استرداد.',
    cascadeScope: [
      'إخفاء تاب السلات المتروكة كلياً من القائمة الجانبية والعلوية للمسؤولين',
      'حذف أيقونة سلة التسوق كلياً من هيدر المتجر، وحجب أزرار "أضف للسلة" من البطاقات',
      'إيقاف مزامنة السيرفر التلقائية /api/cart/sync ومراقبة عدم النشاط',
      'إخفاء بطاقة ومعدل السلات المتروكة وقمع المبيعات كلياً من الـ Overview'
    ]
  },
  {
    key: 'facebook',
    moduleKey: 'facebook',
    path: '/admin/facebook',
    def: 'استوديو ونشر الفيسبوك',
    icon: Globe,
    category: 'التسويق والمتجر',
    badge: 'سوشيال',
    desc: 'توليد بوستات ترويجية بالذكاء الاصطناعي وجدولة النشر على صفحة الفيسبوك.',
    cascadeScope: [
      'إخفاء تاب استوديو وتوليد منشورات الفيسبوك من لوحة التحكم',
      'إيقاف مجدول النشر التلقائي للمنتجات الجديدة على صفحة الفيسبوك',
      'تعطيل استهلاك رصيد توليد الصور الإعلانية بالـ AI'
    ]
  },
  {
    key: 'theme',
    moduleKey: 'theme',
    path: '/admin/theme',
    def: 'ثيم وألوان المتجر',
    icon: Sliders,
    category: 'التسويق والمتجر',
    badge: 'تصميم',
    desc: 'اختيار ألوان الهوية البصرية، الخطوط، وتنسيق أزرار وشكل واجهة المتجر.',
    cascadeScope: [
      'إخفاء تاب تخصيص مظهر المتجر من لوحة الإدارة',
      'تثبيت الألوان والهوية على النمط المعتمد دون تغييرات عشوائية',
      'منع وصول الموظفين غير المصرح لهم لإعدادات التصميم'
    ]
  },
  {
    key: 'branches',
    moduleKey: 'branches',
    path: '/admin/branches',
    def: 'الفروع والموظفين',
    icon: Store,
    category: 'الموارد البشرية والفروع',
    badge: 'فروع',
    desc: 'الفروع، نقاط البيع المرتبطة، تعيين المديرين، وتحديد أدوار وصلاحيات الموظفين.',
    cascadeScope: [
      'إدارة الفروع الفيزيائية وعناوينها وهواتفها',
      'إضافة وتعديل بيانات الموظفين وتعيين أدوارهم وصلاحياتهم (Roles 1-6)',
      'سجل الرواتب والخصومات ومكافآت الطاقم'
    ]
  },
  {
    key: 'auditLogs',
    moduleKey: 'auditLogs',
    path: '/admin/audit-logs',
    def: 'سجل الرقابة والعمليات',
    icon: ShieldAlert,
    category: 'القيادة والتقارير',
    badge: 'أمان',
    desc: 'التسجيل الحركي لكافة التعديلات الحساسة، حركات الخزينة، الفواتير الملغاة، وفحص الـ AI.',
    cascadeScope: [
      'سجل الأمان التراكمي وتتبع عمليات الحذف والتعديل المالي',
      'ربط كل عملية بهوية الموظف والوقت وعنوان الـ IP',
      'تشغيل فحص الذكاء الاصطناعي لكشف العمليات المشبوهة أو غير المطابقة'
    ]
  },
  {
    key: 'settings',
    moduleKey: 'settings',
    path: '/admin/settings',
    def: 'إعدادات النظام والنشاط',
    icon: Sliders,
    category: 'القيادة والتقارير',
    badge: 'نظام',
    desc: 'بيانات المنشأة، الشعار، الطابعات والفواتير، بوابات الدفع، والعملة.',
    cascadeScope: [
      'الاسم التجاري، الشعار، والبيانات الضريبية على الفواتير',
      'إعدادات العملة، الضرائب، ورسوم الشحن والتوصيل',
      'إعدادات مفاتيح الـ API وربط بوابات الدفع والـ WhatsApp'
    ]
  }
];

export default function DeveloperPage() {
  const { token, config, loadConfig, showToast, user } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Search & Category state for tabs manager
  const [tabSearch, setTabSearch] = useState('');
  const [selectedTabCategory, setSelectedTabCategory] = useState('all');

  // 1. Navigation Labels State
  const defaultNav = {
    analytics: 'الرئيسية والمؤشرات',
    pos: 'نقطة البيع (POS)',
    orders: 'الطلبات وفواتير البيع',
    labs: 'الورش والمعامل',
    customers: 'العملاء وكشوف النظر',
    products: 'إدارة المنتجات والمخزون',
    attendance: 'تحضير الموظفين السريع',
    procurement: 'التوريدات والموردين',
    finance: 'الخزينة والمالية',
    categories: 'الأقسام والتصنيفات',
    installments: 'الأقساط والتحصيل',
    returns: 'المرتجعات والضمان',
    maintenance: 'ورشة الصيانة والتجهيز',
    coupons: 'كوبونات الخصم',
    offers: 'العروض الترويجية',
    carts: 'السلات المتروكة',
    facebook: 'استوديو ونشر الفيسبوك',
    theme: 'ثيم وألوان المتجر',
    desiredProducts: 'قوائم الانتظار ونواقص الطلب',
    aiInstructions: 'تعليمات المساعد الذكي (AI)',
    branches: 'الفروع والموظفين',
    auditLogs: 'سجل الرقابة والعمليات',
    settings: 'إعدادات النظام والنشاط'
  };

  const [navLabels, setNavLabels] = useState(defaultNav);

  // 2. Client Profile Configuration State
  const defaultProfileConfig = {
    enabled: true,
    profileTitle: 'كشف النظر والقياسات البصرية',
    actionButtonLabel: 'فحص كشف النظر',
    dateFieldLabel: 'تاريخ الكشف / الفحص',
    fields: [
      { key: 'doctorName', label: 'اسم الطبيب / الأخصائي الفاحص', type: 'text', options: [], defaultValue: '', required: false },
      { key: 'usageType', label: 'نوع الاستخدام الموصى به', type: 'select', options: ['مسافة (Distance)', 'قراءة قريب (Reading)', 'كمبيوتر وشاشات (Computer)', 'استخدام دائم (Permanent)', 'نظارة شمسية طبية'], defaultValue: 'استخدام دائم (Permanent)', required: false },
      { key: 'ipd', label: 'المسافة الكلية بين البؤبؤين (IPD)', type: 'number', options: [], defaultValue: '', required: false }
    ],
    enableMatrix: true,
    matrixConfig: {
      title: 'جدول قياسات العين والعدسات (Refraction Matrix)',
      rows: [
        { key: 'OD', label: 'العين اليمنى (OD)' },
        { key: 'OS', label: 'العين اليسرى (OS)' }
      ],
      columns: [
        { key: 'sph', label: 'SPH (الكرة)', type: 'text' },
        { key: 'cyl', label: 'CYL (السلندر)', type: 'text' },
        { key: 'axis', label: 'AXIS (المحور)', type: 'text' },
        { key: 'add', label: 'ADD (إضافة القراءة)', type: 'text' },
        { key: 'pd', label: 'PD (انحراف الحدقة)', type: 'text' }
      ]
    },
    enableAttachments: true,
    attachmentsLabel: 'مرفقات وصور كشف النظر والروشتة'
  };

  const [profileConfig, setProfileConfig] = useState(defaultProfileConfig);

  // 3. Industry Profile & Feature Flags
  const [systemProfile, setSystemProfile] = useState('optics');
  const [productsTabLabel, setProductsTabLabel] = useState('الشنابر والعدسات');
  const [enabledModules, setEnabledModules] = useState({
    analytics: true,
    pos: true,
    orders: true,
    labs: true,
    customers: true,
    products: true,
    attendance: true,
    procurement: true,
    maintenance: true,
    finance: true,
    categories: true,
    desiredProducts: true,
    aiInstructions: true,
    installments: true,
    returns: true,
    coupons: false,
    offers: false,
    carts: false,
    facebook: false,
    theme: false,
    branches: true,
    auditLogs: true,
    settings: true
  });

  // 4. Executive Overview Dashboard Toggle Settings
  const defaultOverviewSettings = {
    // 1. Core Financial & Sales Cards
    salesRateOverTime: true,
    netProfitOverTime: true,
    workOrdersAwaitingDelivery: true,
    pendingSuppliesAlerts: true,
    stockProposals: true,
    outOfStockCritical: true,
    operationalAlerts: true,

    // 2. Operational & Specialized Rates
    installmentsRate: true,
    returnsRate: true,

    // 3. Interactive Visual Charts & Analytics
    chartRevenueProfitTrend: true,
    chartSalesByCategory: true,
    chartInstallmentCompliance: true,
    chartReturnsAndScrap: true,
    chartLabFulfillment: true,

    // 4. E-Commerce Funnel & Cart Conversion Rates
    funnelViewToCart: false,
    funnelCartToOrder: false,
    funnelOrderToCompleted: true,
    abandonedCartRate: false
  };
  const [overviewSettings, setOverviewSettings] = useState(defaultOverviewSettings);

  // 5. Storefront Mode Architecture (In-Store Catalog vs Online E-Commerce)
  const [storefrontMode, setStorefrontMode] = useState('internal_catalog');

  // 6. AI Auto-Configurator State
  const [aiActivityType, setAiActivityType] = useState('محل نظارات وبصريات طبية');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiConfiguring, setAiConfiguring] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  // Load existing settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/admin/settings', authHeader);
      const data = res.data?.settings || res.data?.config || {};

      if (data.navigationLabels) {
        setNavLabels({ ...defaultNav, ...data.navigationLabels });
      }
      if (data.clientProfileConfig) {
        setProfileConfig({
          ...defaultProfileConfig,
          ...data.clientProfileConfig,
          matrixConfig: {
            ...defaultProfileConfig.matrixConfig,
            ...(data.clientProfileConfig.matrixConfig || {})
          }
        });
      }
      if (data.systemProfile) setSystemProfile(data.systemProfile);
      if (data.storefrontMode) setStorefrontMode(data.storefrontMode);
      if (data.productsTabLabel) setProductsTabLabel(data.productsTabLabel);
      if (data.enabledModules) {
        setEnabledModules((prev) => ({ ...prev, ...data.enabledModules }));
      }
      if (data.overviewSettings) {
        setOverviewSettings((prev) => ({ ...prev, ...data.overviewSettings }));
      }
    } catch (err) {
      console.error('Failed to load developer settings:', err);
      setError('تعذر تحميل إعدادات المطور من السيرفر');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setMessage('');
      setError('');

      const payload = {
        navigationLabels: navLabels,
        clientProfileConfig: profileConfig,
        systemProfile,
        storefrontMode,
        productsTabLabel,
        enabledModules,
        overviewSettings
      };

      await axios.put('/api/admin/settings', payload, authHeader);
      setMessage('تم حفظ كافة إعدادات المطور بنجاح وتم تحديث النظام فوراً! ✅');
      if (showToast) showToast('تم تحديث إعدادات النظام بنجاح');
      loadConfig();
    } catch (err) {
      console.error('Failed to save developer settings:', err);
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ إعدادات المطور');
      if (showToast) showToast('فشل في حفظ التعديلات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAiConfigure = async () => {
    try {
      setAiConfiguring(true);
      setError('');
      setMessage('');
      const res = await axios.post('/api/admin/settings/ai-configure', {
        businessType: aiActivityType,
        customPrompt: aiCustomPrompt,
        applyDirectly: true
      }, authHeader);

      const cfg = res.data?.config || {};
      if (cfg.systemProfile) setSystemProfile(cfg.systemProfile);
      if (cfg.storefrontMode) setStorefrontMode(cfg.storefrontMode);
      if (cfg.productsTabLabel) setProductsTabLabel(cfg.productsTabLabel);
      if (cfg.enabledModules) setEnabledModules(cfg.enabledModules);
      if (cfg.overviewSettings) setOverviewSettings(cfg.overviewSettings);
      if (cfg.navigationLabels) setNavLabels(cfg.navigationLabels);
      if (cfg.clientProfileConfig) setProfileConfig(cfg.clientProfileConfig);

      setAiExplanation(res.data?.explanation || 'تم تكوين وتطبيق الإعدادات بنجاح!');
      setMessage('تمت تهيئة وتطبيق إعدادات النظام بالذكاء الاصطناعي بنجاح! ✨');
      if (showToast) showToast('تم تطبيق تهيئة الذكاء الاصطناعي بنجاح');
      loadConfig();
    } catch (err) {
      console.error('AI Configure failed:', err);
      setError(err.response?.data?.error || 'تعذر تشغيل محرك التهيئة الذكية');
      if (showToast) showToast('فشل في تهيئة النظام بالذكاء الاصطناعي', 'error');
    } finally {
      setAiConfiguring(false);
    }
  };

  const handleSelectStorefrontMode = (mode) => {
    setStorefrontMode(mode);
    if (mode === 'internal_catalog') {
      setEnabledModules((prev) => ({ ...prev, carts: false }));
      setOverviewSettings((prev) => ({
        ...prev,
        funnelViewToCart: false,
        funnelCartToOrder: false,
        abandonedCartRate: false
      }));
    } else {
      setEnabledModules((prev) => ({ ...prev, carts: true }));
      setOverviewSettings((prev) => ({
        ...prev,
        funnelViewToCart: true,
        funnelCartToOrder: true,
        abandonedCartRate: true
      }));
    }
  };

  const handleToggleTabModule = (moduleKey, isChecked) => {
    setEnabledModules((prev) => {
      const next = { ...prev, [moduleKey]: isChecked };
      if (moduleKey === 'carts') {
        if (!isChecked) {
          setOverviewSettings((os) => ({
            ...os,
            funnelViewToCart: false,
            funnelCartToOrder: false,
            abandonedCartRate: false
          }));
        } else {
          setOverviewSettings((os) => ({
            ...os,
            funnelViewToCart: true,
            funnelCartToOrder: true,
            abandonedCartRate: true
          }));
        }
      }
      if (moduleKey === 'installments' && !isChecked) {
        setOverviewSettings((os) => ({
          ...os,
          installmentsRate: false,
          chartInstallmentCompliance: false
        }));
      }
      if (moduleKey === 'returns' && !isChecked) {
        setOverviewSettings((os) => ({
          ...os,
          returnsRate: false,
          chartReturnsAndScrap: false
        }));
      }
      if (moduleKey === 'labs' && !isChecked) {
        setOverviewSettings((os) => ({
          ...os,
          chartLabFulfillment: false,
          workOrdersAwaitingDelivery: false
        }));
      }
      if (moduleKey === 'procurement' && !isChecked) {
        setOverviewSettings((os) => ({
          ...os,
          pendingSuppliesAlerts: false,
          stockProposals: false
        }));
      }
      return next;
    });
  };

  // Industry Preset Helpers
  const applyOpticsPreset = () => {
    setSystemProfile('optics');
    setStorefrontMode('internal_catalog');
    setProductsTabLabel('الشنابر والعدسات');
    setNavLabels((prev) => ({
      ...prev,
      products: 'الشنابر والعدسات',
      customers: 'العملاء وكشوف النظر',
      labs: 'الورش والمعامل',
      attendance: 'تحضير الموظفين السريع',
      procurement: 'التوريدات والموردين'
    }));
    setEnabledModules({
      analytics: true,
      pos: true,
      orders: true,
      labs: true,
      customers: true,
      products: true,
      attendance: true,
      procurement: true,
      maintenance: true,
      finance: true,
      categories: true,
      desiredProducts: true,
      installments: true,
      returns: true,
      coupons: false,
      offers: false,
      carts: false,
      facebook: false,
      theme: false,
      branches: true,
      auditLogs: true,
      settings: true
    });
    setOverviewSettings(defaultOverviewSettings);
    setProfileConfig((prev) => ({
      ...prev,
      enabled: true,
      profileTitle: 'كشف النظر والقياسات البصرية',
      actionButtonLabel: 'فحص كشف النظر',
      dateFieldLabel: 'تاريخ الكشف / الفحص',
      enableMatrix: true
    }));
    if (showToast) showToast('تم تطبيق بروفايل بصريات (Optics) بنجاح');
  };

  const applyRetailPreset = () => {
    setSystemProfile('retail');
    setStorefrontMode('online_ecommerce');
    setProductsTabLabel('إدارة المنتجات والمخزون');
    setNavLabels((prev) => ({
      ...prev,
      products: 'إدارة المنتجات والمخزون',
      customers: 'العملاء',
      attendance: 'تحضير الموظفين السريع',
      procurement: 'التوريدات والموردين'
    }));
    setEnabledModules({
      analytics: true,
      pos: true,
      orders: true,
      labs: false,
      customers: true,
      products: true,
      attendance: true,
      procurement: true,
      maintenance: false,
      finance: true,
      categories: true,
      desiredProducts: true,
      installments: false,
      returns: true,
      coupons: true,
      offers: true,
      carts: true,
      facebook: true,
      theme: true,
      branches: true,
      auditLogs: true,
      settings: true
    });
    setOverviewSettings({
      ...defaultOverviewSettings,
      funnelViewToCart: true,
      funnelCartToOrder: true,
      funnelOrderToCompleted: true,
      abandonedCartRate: true,
      chartInstallmentCompliance: false,
      chartLabFulfillment: false,
      workOrdersAwaitingDelivery: false
    });
    setProfileConfig((prev) => ({
      ...prev,
      enabled: false
    }));
    if (showToast) showToast('تم تطبيق بروفايل تجزئة ومتجر إلكتروني (Retail) بنجاح');
  };

  const applyWorkshopPreset = () => {
    setSystemProfile('custom');
    setStorefrontMode('internal_catalog');
    setProductsTabLabel('قطع الغيار والأجهزة');
    setNavLabels((prev) => ({
      ...prev,
      products: 'قطع الغيار والأجهزة',
      customers: 'العملاء والأجهزة',
      orders: 'تذاكر الصيانة والفواتير',
      attendance: 'تحضير الموظفين السريع',
      procurement: 'قطع الغيار والتوريد'
    }));
    setEnabledModules({
      analytics: true,
      pos: true,
      orders: true,
      labs: false,
      customers: true,
      products: true,
      attendance: true,
      procurement: true,
      maintenance: true,
      finance: true,
      categories: true,
      desiredProducts: true,
      installments: true,
      returns: true,
      coupons: false,
      offers: false,
      carts: false,
      facebook: false,
      theme: false,
      branches: true,
      auditLogs: true,
      settings: true
    });
    setOverviewSettings({
      ...defaultOverviewSettings,
      chartRevenueProfitTrend: true,
      chartSalesByCategory: true,
      chartInstallmentCompliance: true,
      chartReturnsAndScrap: true,
      chartLabFulfillment: true,
      funnelViewToCart: false,
      funnelCartToOrder: false,
      funnelOrderToCompleted: true,
      abandonedCartRate: false
    });
    setProfileConfig({
      enabled: true,
      profileTitle: 'سجل أجهزة العميل والضمان',
      actionButtonLabel: 'إضافة جهاز',
      dateFieldLabel: 'تاريخ استلام الجهاز',
      fields: [
        { key: 'deviceModel', label: 'نوع وموديل الجهاز', type: 'text', options: [], defaultValue: '', required: true },
        { key: 'imeiOrSerial', label: 'الرقم التسلسلي / IMEI', type: 'text', options: [], defaultValue: '', required: false },
        { key: 'issueDescription', label: 'وصف العطل المطلوب صيانته', type: 'text', options: [], defaultValue: '', required: true }
      ],
      enableMatrix: false,
      enableAttachments: true,
      attachmentsLabel: 'صور حالة الجهاز قبل الفك والصيانة'
    });
    if (showToast) showToast('تم تطبيق بروفايل مركز صيانة وورشة فنية بنجاح');
  };

  // Field Helpers
  const handleAddField = () => {
    const key = `field_${Date.now().toString(36)}`;
    setProfileConfig((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        { key, label: 'حقل جديد', type: 'text', options: [], defaultValue: '', required: false }
      ]
    }));
  };

  const handleRemoveField = (idx) => {
    setProfileConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateField = (idx, updates) => {
    setProfileConfig((prev) => {
      const nextFields = [...prev.fields];
      nextFields[idx] = { ...nextFields[idx], ...updates };
      return { ...prev, fields: nextFields };
    });
  };

  // Matrix Row & Col Helpers
  const handleAddMatrixRow = () => {
    const key = `ROW_${Date.now().toString(36).toUpperCase()}`;
    setProfileConfig((prev) => ({
      ...prev,
      matrixConfig: {
        ...prev.matrixConfig,
        rows: [...(prev.matrixConfig.rows || []), { key, label: 'صف جديد' }]
      }
    }));
  };

  const handleRemoveMatrixRow = (idx) => {
    setProfileConfig((prev) => ({
      ...prev,
      matrixConfig: {
        ...prev.matrixConfig,
        rows: prev.matrixConfig.rows.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleAddMatrixCol = () => {
    const key = `col_${Date.now().toString(36)}`;
    setProfileConfig((prev) => ({
      ...prev,
      matrixConfig: {
        ...prev.matrixConfig,
        columns: [...(prev.matrixConfig.columns || []), { key, label: 'عمود جديد', type: 'text' }]
      }
    }));
  };

  const handleRemoveMatrixCol = (idx) => {
    setProfileConfig((prev) => ({
      ...prev,
      matrixConfig: {
        ...prev.matrixConfig,
        columns: prev.matrixConfig.columns.filter((_, i) => i !== idx)
      }
    }));
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-ink-soft flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        <span>جاري تحميل لوحة المطور...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto px-2 sm:px-4 text-ink font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shadow-inner">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-ink">بوابة المطور العام للنظام (Role 6)</h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                EXCLUSIVE DEVELOPER PORTAL
              </span>
            </div>
            <p className="text-xs text-ink-soft mt-1">
              إدارة التسميات الديناميكية، بناء وتخصيص بروفايلات العملاء، وضبط وحدات النشاط للنظام بالكامل
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 transition-all text-sm"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'جاري الحفظ...' : 'حفظ كافة التعديلات'}</span>
        </button>
      </div>

      {message && (
        <div className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-4 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-xs animate-fadeIn">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRIMARY ARCHITECTURE: Storefront Mode Selector */}
      {/* ========================================================= */}
      <div className="bg-surface rounded-3xl border-2 border-primary/25 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">نمط واجهة عرض المنتجات والمتجر (Storefront Mode)</h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                  CORE ARCHITECTURE
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                تحديد طبيعة النظام للمستخدمين والزوار: كتالوج ومعرض داخلي للفرع أم متجر إلكتروني أونلاين متكامل
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Internal Catalog */}
          <div
            onClick={() => handleSelectStorefrontMode('internal_catalog')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative ${
              storefrontMode === 'internal_catalog'
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-paper border-line hover:border-line-hover opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  storefrontMode === 'internal_catalog' ? 'bg-primary text-white' : 'bg-surface text-ink-soft'
                }`}>
                  <Glasses className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-ink">وضع الكتالوج والمعرض الداخلي للمحل</h3>
                  <span className="text-[10px] font-mono text-ink-soft">In-Store Digital Showcase & Catalog</span>
                </div>
              </div>
              <input
                type="radio"
                name="storefrontMode"
                checked={storefrontMode === 'internal_catalog'}
                onChange={() => handleSelectStorefrontMode('internal_catalog')}
                className="w-4 h-4 text-primary mt-1"
              />
            </div>
            <p className="text-xs text-ink-soft mt-3 leading-relaxed">
              شاشة استعراض وفلترة داخل الفرع موجهة للموظفين أو الزبائن لتصفح الشنابر، النظارات، ومواصفات العدسات دون سلة تسوق رقمية أو شحن، مما يلغي تماماً مشاكل إشعارات السلات المتروكة غير المبررة.
            </p>
            <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">✓ استعراض وفلترة متقدمة</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">✓ قائمة المفضلة</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600">✕ إخفاء سلة الشراء والشحن</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600">✕ تعطيل السلات المتروكة</span>
            </div>
          </div>

          {/* Option 2: Online E-Commerce */}
          <div
            onClick={() => handleSelectStorefrontMode('online_ecommerce')}
            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative ${
              storefrontMode === 'online_ecommerce'
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-paper border-line hover:border-line-hover opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  storefrontMode === 'online_ecommerce' ? 'bg-primary text-white' : 'bg-surface text-ink-soft'
                }`}>
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-ink">وضع المتجر الإلكتروني الأونلاين المتكامل</h3>
                  <span className="text-[10px] font-mono text-ink-soft">Full Public E-Commerce Experience</span>
                </div>
              </div>
              <input
                type="radio"
                name="storefrontMode"
                checked={storefrontMode === 'online_ecommerce'}
                onChange={() => handleSelectStorefrontMode('online_ecommerce')}
                className="w-4 h-4 text-primary mt-1"
              />
            </div>
            <p className="text-xs text-ink-soft mt-3 leading-relaxed">
              متجر أونلاين عام ومتكامل يتيح البيع المباشر، سلة المشتريات، الدفع والشحن، تتبع السلات المتروكة، تنبيهات التوفر التلقائية عبر البريد/SMS، وخوارزميات تفضيلات العملاء.
            </p>
            <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">✓ سلة تسوق وإتمام الطلب</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">✓ تتبع واسترداد السلات المتروكة</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">✓ قوائم الانتظار والتنبيه الآلي</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">✓ قمع المبيعات ومعدلات التحويل</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: Unified Master Tabs & Cascading Modules Manager */}
      {/* ========================================================= */}
      <div className="bg-surface rounded-3xl border-2 border-indigo-500/25 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-ink">القسم 1: مدير تبويبات النظام والوحدات المتكامل (Master System Tabs)</h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                  20 TABS / MODULES
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-1">
                التحكم الموحد والأساسي في نشاط المنشأة: إظهار أو إخفاء أي تاب، إعادة تسميتها لتعكس هويتك، والتحكم في وظائفها المتسلسلة عبر كامل النظام
              </p>
            </div>
          </div>

          {/* Quick Presets & Restore */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyOpticsPreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 ${
                systemProfile === 'optics'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-paper text-ink hover:border-primary'
              }`}
            >
              <Glasses className="w-3.5 h-3.5" />
              <span>نمط بصريات (Optics)</span>
            </button>

            <button
              type="button"
              onClick={applyRetailPreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 ${
                systemProfile === 'retail'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-paper text-ink hover:border-primary'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>نمط تجزئة (Retail)</span>
            </button>

            <button
              type="button"
              onClick={applyWorkshopPreset}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 ${
                systemProfile === 'custom'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-paper text-ink hover:border-primary'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>نمط صيانة (Workshop)</span>
            </button>

            <button
              type="button"
              onClick={() => setNavLabels(defaultNav)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-bold px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 transition-all flex items-center gap-1"
              title="استعادة كافة المسميات الافتراضية"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>استعادة التسميات الأصلية</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-paper p-3 rounded-2xl border border-line">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'الكل (20)' },
              { id: 'المبيعات والكاشير', label: 'المبيعات والكاشير' },
              { id: 'المخزون والمنتجات', label: 'المخزون والمنتجات' },
              { id: 'الموارد البشرية والفروع', label: 'الموارد البشرية' },
              { id: 'المالية والحسابات', label: 'المالية' },
              { id: 'التشغيل والفنيين', label: 'التشغيل والورش' },
              { id: 'التسويق والمتجر', label: 'التسويق والمتجر' },
              { id: 'القيادة والتقارير', label: 'القيادة والتقارير' }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedTabCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedTabCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-surface text-ink-soft hover:text-ink hover:bg-surface/80 border border-line'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-ink-soft absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              placeholder="بحث في التبويبات أو المسار..."
              className="w-full bg-surface border border-line rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-indigo-600 transition-all placeholder:text-ink-soft/60"
            />
          </div>
        </div>

        {/* Master Tabs Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MASTER_TABS_DEFINITIONS.filter((t) => {
            const matchCat = selectedTabCategory === 'all' || t.category === selectedTabCategory;
            const term = tabSearch.trim().toLowerCase();
            const currentName = (navLabels[t.key] || t.def).toLowerCase();
            const matchSearch =
              !term ||
              t.key.toLowerCase().includes(term) ||
              t.def.toLowerCase().includes(term) ||
              currentName.includes(term) ||
              t.path.toLowerCase().includes(term) ||
              t.desc.toLowerCase().includes(term);
            return matchCat && matchSearch;
          }).map((tab) => {
            const Icon = tab.icon;
            const isEnabled = enabledModules[tab.moduleKey] !== false;
            const customName = navLabels[tab.key] || '';
            const isNameModified = customName && customName !== tab.def;

            return (
              <div
                key={tab.key}
                className={`rounded-2xl p-5 border-2 transition-all space-y-3.5 shadow-2xs relative flex flex-col justify-between ${
                  isEnabled
                    ? 'bg-paper border-indigo-500/30'
                    : 'bg-surface/60 border-line/70 opacity-75'
                }`}
              >
                {/* Card Header: Icon, Meta & Master Switch */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isEnabled
                            ? 'bg-indigo-500/15 text-indigo-600'
                            : 'bg-surface text-ink-soft border border-line'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-ink">{tab.shortName || tab.def}</span>
                          {tab.badge && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-surface border border-line text-ink-soft">
                              {tab.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-ink-soft block mt-0.5">{tab.path}</span>
                      </div>
                    </div>

                    {/* Master Module Toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        disabled={tab.isCore}
                        onChange={(e) => handleToggleTabModule(tab.moduleKey, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 relative"></div>
                      <span className={`text-[10px] font-black ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isEnabled ? 'مُفعّل' : 'مخفي'}
                      </span>
                    </label>
                  </div>

                  {/* Tab Renaming Input */}
                  <div className="mt-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-ink-soft">
                      <span>مسمى التاب المخصص:</span>
                      {isNameModified && (
                        <button
                          type="button"
                          onClick={() => setNavLabels({ ...navLabels, [tab.key]: tab.def })}
                          className="text-indigo-600 hover:underline"
                        >
                          استعادة الأصل
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setNavLabels({ ...navLabels, [tab.key]: e.target.value })}
                      placeholder={tab.def}
                      className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs font-black text-ink outline-none focus:border-indigo-600 transition-all placeholder:text-ink-soft/40"
                    />
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-ink-soft mt-2 leading-relaxed">{tab.desc}</p>
                </div>

                {/* Cascading Scope Explanatory Box */}
                <div className="pt-3 border-t border-line/60 space-y-1.5 bg-surface/80 p-2.5 rounded-xl border border-line/50 text-[10px]">
                  <span className="font-black text-ink block flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span>الأثر والوظائف المتسلسلة (Cascading Scope):</span>
                  </span>
                  <ul className="space-y-1 text-ink-soft pr-2.5">
                    {tab.cascadeScope.map((scope, idx) => (
                      <li key={idx} className="list-disc list-inside leading-tight">
                        {scope}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: Schema-Driven Client Custom Profile */}
      {/* ========================================================= */}
      <div className="bg-surface rounded-3xl border-2 border-blue-500/20 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">القسم 2: محرك بروفايل وسجل العميل الديناميكي (Schema Builder)</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  DYNAMIC SCHEMA
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                تصميم حقول وسجلات العملاء بمرونة مطلقة ليلائم كشف النظر، الفحص الطبي، مقاسات الخياطة، أو غيرها
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Switch */}
          <div className="flex items-center gap-3 bg-paper px-4 py-2 rounded-2xl border border-line">
            <span className="text-xs font-black text-ink">
              {profileConfig.enabled ? 'الميزة مفعلة ✅' : 'الميزة معطلة بالكامل ❌'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profileConfig.enabled)}
                onChange={(e) => setProfileConfig({ ...profileConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {profileConfig.enabled ? (
          <div className="space-y-6">
            {/* 2.1 Profile Labels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-paper border border-line">
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  عنوان السجل الرئيسي (Profile Title)
                </label>
                <input
                  type="text"
                  value={profileConfig.profileTitle || ''}
                  onChange={(e) => setProfileConfig({ ...profileConfig, profileTitle: e.target.value })}
                  placeholder="مثال: كشف النظر والقياسات البصرية"
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs font-black text-ink outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  تسمية زر الإجراء (Action Button Label)
                </label>
                <input
                  type="text"
                  value={profileConfig.actionButtonLabel || ''}
                  onChange={(e) => setProfileConfig({ ...profileConfig, actionButtonLabel: e.target.value })}
                  placeholder="مثال: فحص كشف النظر"
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs font-black text-ink outline-none focus:border-blue-600"
                />
                <span className="text-[10px] text-ink-soft mt-0.5 block">يظهر في جدول العملاء ونقطة البيع</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">
                  تسمية حقل التاريخ
                </label>
                <input
                  type="text"
                  value={profileConfig.dateFieldLabel || ''}
                  onChange={(e) => setProfileConfig({ ...profileConfig, dateFieldLabel: e.target.value })}
                  placeholder="مثال: تاريخ الفحص / الكشف"
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs font-black text-ink outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* 2.2 Dynamic Custom Fields */}
            <div className="p-5 rounded-2xl bg-paper border border-line space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-ink">الحقول المخصصة الإضافية (Dynamic Fields)</h3>
                  <p className="text-xs text-ink-soft mt-0.5">الحقول التي يملؤها المستخدم عند إضافة سجل جديد للعميل</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1 shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة حقل جديد</span>
                </button>
              </div>

              <div className="space-y-3">
                {profileConfig.fields?.map((field, idx) => (
                  <div
                    key={field.key || idx}
                    className="p-3.5 rounded-xl bg-surface border border-line flex flex-wrap items-center gap-3 text-xs"
                  >
                    <div className="w-32">
                      <label className="text-[10px] text-ink-soft block font-mono">مفتاح الحقل</label>
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => handleUpdateField(idx, { key: e.target.value })}
                        className="w-full bg-paper border border-line rounded-lg px-2 py-1 font-mono text-[11px]"
                      />
                    </div>

                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] text-ink-soft block">تسمية الحقل (العنوان المعروض)</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                        className="w-full bg-paper border border-line rounded-lg px-2 py-1 font-bold"
                      />
                    </div>

                    <div className="w-28">
                      <label className="text-[10px] text-ink-soft block">نوع الحقل</label>
                      <select
                        value={field.type}
                        onChange={(e) => handleUpdateField(idx, { type: e.target.value })}
                        className="w-full bg-paper border border-line rounded-lg px-2 py-1 text-xs font-bold"
                      >
                        <option value="text">نص (Text)</option>
                        <option value="number">رقم (Number)</option>
                        <option value="select">قائمة خيارات</option>
                        <option value="date">تاريخ (Date)</option>
                      </select>
                    </div>

                    {field.type === 'select' && (
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] text-ink-soft block">خيارات القائمة (مفصولة بفاصلة)</label>
                        <input
                          type="text"
                          value={Array.isArray(field.options) ? field.options.join(', ') : ''}
                          onChange={(e) =>
                            handleUpdateField(idx, {
                              options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="خيار 1, خيار 2, خيار 3"
                          className="w-full bg-paper border border-line rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 pt-4">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(e) => handleUpdateField(idx, { required: e.target.checked })}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        <span className="text-[11px] font-bold">إلزامي</span>
                      </label>
                    </div>

                    <div className="pt-4 mr-auto">
                      <button
                        type="button"
                        onClick={() => handleRemoveField(idx)}
                        className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        title="حذف الحقل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2.3 2D Matrix Configuration */}
            <div className="p-5 rounded-2xl bg-paper border border-line space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-ink">مصفوفة القياسات والأرقام (2D Refraction Matrix)</h3>
                  <p className="text-xs text-ink-soft mt-0.5">
                    جدول ديناميكي ثنائي الأبعاد لقياسات العين أو الأبعاد الفنية مع صفوف وأعمدة قابلة للتخصيص
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-surface px-3 py-1.5 rounded-xl border border-line">
                  <input
                    type="checkbox"
                    checked={Boolean(profileConfig.enableMatrix)}
                    onChange={(e) => setProfileConfig({ ...profileConfig, enableMatrix: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-black">تفعيل جدول المصفوفة</span>
                </label>
              </div>

              {profileConfig.enableMatrix && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-ink-soft mb-1">عنوان جدول المصفوفة</label>
                    <input
                      type="text"
                      value={profileConfig.matrixConfig?.title || ''}
                      onChange={(e) =>
                        setProfileConfig({
                          ...profileConfig,
                          matrixConfig: { ...profileConfig.matrixConfig, title: e.target.value }
                        })
                      }
                      placeholder="مثال: جدول قياسات العين والعدسات"
                      className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs font-black text-ink outline-none"
                    />
                  </div>

                  {/* Rows and Columns setup */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Rows */}
                    <div className="p-3.5 rounded-xl bg-surface border border-line space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-ink">الصفوف (Rows)</span>
                        <button
                          type="button"
                          onClick={handleAddMatrixRow}
                          className="text-[11px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ صف</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {profileConfig.matrixConfig?.rows?.map((row, rIdx) => (
                          <div key={row.key || rIdx} className="flex items-center gap-2 text-xs">
                            <input
                              type="text"
                              value={row.key}
                              onChange={(e) => {
                                const nextRows = [...profileConfig.matrixConfig.rows];
                                nextRows[rIdx].key = e.target.value;
                                setProfileConfig({
                                  ...profileConfig,
                                  matrixConfig: { ...profileConfig.matrixConfig, rows: nextRows }
                                });
                              }}
                              className="w-20 bg-paper border border-line rounded-lg px-2 py-1 font-mono text-[11px]"
                              placeholder="Key"
                            />
                            <input
                              type="text"
                              value={row.label}
                              onChange={(e) => {
                                const nextRows = [...profileConfig.matrixConfig.rows];
                                nextRows[rIdx].label = e.target.value;
                                setProfileConfig({
                                  ...profileConfig,
                                  matrixConfig: { ...profileConfig.matrixConfig, rows: nextRows }
                                });
                              }}
                              className="flex-1 bg-paper border border-line rounded-lg px-2 py-1 font-bold"
                              placeholder="تسمية الصف"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMatrixRow(rIdx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Columns */}
                    <div className="p-3.5 rounded-xl bg-surface border border-line space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-ink">الأعمدة (Columns)</span>
                        <button
                          type="button"
                          onClick={handleAddMatrixCol}
                          className="text-[11px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ عمود</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {profileConfig.matrixConfig?.columns?.map((col, cIdx) => (
                          <div key={col.key || cIdx} className="flex items-center gap-2 text-xs">
                            <input
                              type="text"
                              value={col.key}
                              onChange={(e) => {
                                const nextCols = [...profileConfig.matrixConfig.columns];
                                nextCols[cIdx].key = e.target.value;
                                setProfileConfig({
                                  ...profileConfig,
                                  matrixConfig: { ...profileConfig.matrixConfig, columns: nextCols }
                                });
                              }}
                              className="w-20 bg-paper border border-line rounded-lg px-2 py-1 font-mono text-[11px]"
                              placeholder="Key"
                            />
                            <input
                              type="text"
                              value={col.label}
                              onChange={(e) => {
                                const nextCols = [...profileConfig.matrixConfig.columns];
                                nextCols[cIdx].label = e.target.value;
                                setProfileConfig({
                                  ...profileConfig,
                                  matrixConfig: { ...profileConfig.matrixConfig, columns: nextCols }
                                });
                              }}
                              className="flex-1 bg-paper border border-line rounded-lg px-2 py-1 font-bold"
                              placeholder="تسمية العمود"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveMatrixCol(cIdx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2.4 Attachments & Notes */}
            <div className="p-4 rounded-2xl bg-paper border border-line flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(profileConfig.enableAttachments !== false)}
                  onChange={(e) =>
                    setProfileConfig({ ...profileConfig, enableAttachments: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-xs font-black text-ink">
                  تفعيل رفع المرفقات والروشتات المصورة (Attachment Uploader)
                </span>
              </label>

              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={profileConfig.attachmentsLabel || ''}
                  onChange={(e) =>
                    setProfileConfig({ ...profileConfig, attachmentsLabel: e.target.value })
                  }
                  placeholder="تسمية المرفقات (مثال: صور الفحص والروشتة)"
                  className="w-full bg-surface border border-line rounded-xl px-3 py-1.5 text-xs font-bold"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-paper border border-line text-center text-xs text-ink-soft space-y-1">
            <p className="font-black text-sm text-ink">تم إيقاف ميزة بروفايل وسجل العميل</p>
            <p>يختفي زر الكشف/الفحص بالكامل من صفحة العملاء ومن نقطة البيع ليعمل النظام كمتجر تجزئة عادي.</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: AI Industry Auto-Configurator */}
      {/* ========================================================= */}
      <div className="bg-surface rounded-3xl border-2 border-emerald-500/20 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">القسم 4: تهيئة النظام بالذكاء الاصطناعي (AI Industry Auto-Configurator)</h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  LLM SYSTEM ARCHITECT
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                اكتب طبيعة نشاطك أو اختر نموذجاً، وسيقوم الذكاء الاصطناعي بتهيئة كافة التبويبات والموديولات وبروفايل العميل تلقائياً
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyOpticsPreset}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                systemProfile === 'optics' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Glasses className="w-4 h-4" />
              <span>نمط بصريات (Optics)</span>
            </button>

            <button
              type="button"
              onClick={applyRetailPreset}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                systemProfile === 'retail' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>متجر إلكتروني وتجزئة (E-Com)</span>
            </button>

            <button
              type="button"
              onClick={applyWorkshopPreset}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                systemProfile === 'custom' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>مركز صيانة وورشة</span>
            </button>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-ink-soft block">نماذج أنشطة تجارية مقترحة للتهيئة السريعة:</label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '👓 محل نظارات وبصريات طبية', value: 'محل نظارات وبصريات طبية وعيادة كشف نظر' },
              { label: '💊 صيدلية ومستحضرات تجميل', value: 'صيدلية ومستحضرات طبية وعلاجية' },
              { label: '👕 متجر أزياء وملابس وأحذية', value: 'متجر أزياء وملابس وأحذية حريمي ورجالي' },
              { label: '🔧 مركز صيانة وإلكترونيات', value: 'مركز صيانة هواتف وأجهزة إلكترونية وقطع غيار' },
              { label: '🛒 سوبر ماركت وبقالة تموينية', value: 'سوبر ماركت ومواد غذائية وسلع استهلاكية' },
              { label: '📦 متجر تجزئة وتجارة عامة', value: 'متجر تجزئة وتجارة عامة متنوع' }
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setAiActivityType(chip.value)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  aiActivityType === chip.value
                    ? 'bg-emerald-600 text-white border-emerald-600 font-black shadow-xs'
                    : 'bg-paper text-ink border-line hover:border-emerald-500/50'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-black text-ink block mb-1.5">طبيعة ومجال النشاط التجاري:</label>
            <input
              type="text"
              value={aiActivityType}
              onChange={(e) => setAiActivityType(e.target.value)}
              placeholder="مثال: مركز بصريات ونظارات طبية وشمسية"
              className="w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-xs font-bold text-ink outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-black text-ink block mb-1.5">تعليمات أو شروط إضافية (اختياري):</label>
            <input
              type="text"
              value={aiCustomPrompt}
              onChange={(e) => setAiCustomPrompt(e.target.value)}
              placeholder="مثال: ركز على الأقساط والمعامل وتوريد النواقص بدون سلات متروكة"
              className="w-full bg-paper border border-line rounded-xl px-4 py-2.5 text-xs font-medium text-ink outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-ink-soft">
            * يقوم المحرك بتحليل النموذج، واختيار التبويبات المناسبة، وضبط كروت المؤشرات وبروفايل العميل بدقة متناهية.
          </p>

          <button
            type="button"
            onClick={handleAiConfigure}
            disabled={aiConfiguring || !aiActivityType}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            {aiConfiguring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{aiConfiguring ? 'جاري التحليل والتهيئة...' : 'تهيئة وتطبيق النظام بالذكاء الاصطناعي ✨'}</span>
          </button>
        </div>

        {/* AI Explanation Result Box */}
        {aiExplanation && (
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تقرير وقرار الذكاء الاصطناعي لتهيئة النشاط (AI Architecture Rationale):</span>
            </div>
            <p className="text-xs text-emerald-950 font-medium leading-relaxed pr-6">
              {aiExplanation}
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION 5: Executive Overview Telemetry Switches */}
      {/* ========================================================= */}
      <div className="bg-surface rounded-3xl border-2 border-blue-500/20 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black shadow-inner">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">القسم 5: تخصيص كروت ومؤشرات ورسومات لوحة القيادة (Overview Telemetry & Visual Analytics)</h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  EXECUTIVE OVERVIEW
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                تفعيل أو إخفاء الرسوم البيانية ومؤشرات قمع المبيعات والبطاقات التشغيلية في لوحة التحكم الرئيسية (/admin/overview)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOverviewSettings(defaultOverviewSettings)}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 transition-all flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>استعادة التفعيل الافتراضي</span>
            </button>
          </div>
        </div>

        {/* SUBSECTION 1: Advanced Visual Charts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-blue-900 bg-blue-100/70 px-2.5 py-1 rounded-lg">
              1. الرسوم البيانية التفاعلية والسلاسل الزمنية (Interactive Visual Graphs & Trend Charts)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {[
              {
                key: 'chartRevenueProfitTrend',
                label: 'رسم بياني زمني للإيرادات وصافي الأرباح',
                desc: 'مخطط زمني تفاعلي يقارن مسار الإيرادات الإجمالية مع صافي الأرباح والمصروفات'
              },
              {
                key: 'chartSalesByCategory',
                label: 'مخطط توزيع المبيعات ومشاركة الأقسام',
                desc: 'رسم بياني مقارن لحجم مبيعات الشنابر، العدسات، والإكسسوارات ونسب كل قسم'
              },
              {
                key: 'chartInstallmentCompliance',
                label: 'مخطط الالتزام بسداد الأقساط والتحصيل',
                desc: 'رسم بياني يوضح نسب السداد في الموعد مقابل المتأخرات وإجمالي المحصل'
              },
              {
                key: 'chartReturnsAndScrap',
                label: 'مخطط معدلات المرتجعات وتوالف الضمان',
                desc: 'رسم مقارن بين المرتجع السليم (+1 مخزن) وتوالف الضمان بالمعمل (+1 هالك)'
              },
              {
                key: 'chartLabFulfillment',
                label: 'معدل سرعة إنجاز أوامر المعمل والورشة',
                desc: 'مخطط قياس كفاءة قص العدسات والتسليم خلال 24-48 ساعة'
              }
            ].map((item) => {
              const isEnabled = overviewSettings[item.key] !== false;
              return (
                <label
                  key={item.key}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isEnabled
                      ? 'bg-paper border-blue-500/40 shadow-2xs'
                      : 'bg-surface/50 border-line opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) =>
                      setOverviewSettings({ ...overviewSettings, [item.key]: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-ink block">{item.label}</span>
                    <span className="text-[11px] text-ink-soft block mt-1 leading-relaxed">
                      {item.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* SUBSECTION 2: E-Commerce Funnel & Cart Rates */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-900 bg-indigo-100/70 px-2.5 py-1 rounded-lg">
              2. قمع التحويل والتجارة الإلكترونية (E-Commerce Funnel & Cart Conversion Rates)
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">مخصص للمتاجر الإلكترونية أو نمط البيع الأونلاين</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {[
              {
                key: 'funnelViewToCart',
                label: 'تحويل المشاهدة إلى سلة (View to Cart)',
                desc: 'نسبة الزوار الذين أضافوا منتجات للسلة بعد التصفح'
              },
              {
                key: 'funnelCartToOrder',
                label: 'تحويل السلة إلى طلبات (Cart to Order)',
                desc: 'نسبة السلات التي تحولت إلى أوامر شراء وفواتير فعلية'
              },
              {
                key: 'funnelOrderToCompleted',
                label: 'إتمام وتسليم الطلبات (Order Completed)',
                desc: 'نسبة الطلبات المنفذة والمسلمة بنجاح دون إلغاء'
              },
              {
                key: 'abandonedCartRate',
                label: 'مؤشر تسرب السلات المتروقة (Drop-off)',
                desc: 'معدل سلات التسوق التي تركها العملاء دون إتمام الدفع'
              }
            ].map((item) => {
              const isEnabled = overviewSettings[item.key] !== false;
              return (
                <label
                  key={item.key}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isEnabled
                      ? 'bg-paper border-indigo-500/40 shadow-2xs'
                      : 'bg-surface/50 border-line opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) =>
                      setOverviewSettings({ ...overviewSettings, [item.key]: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-ink block">{item.label}</span>
                    <span className="text-[11px] text-ink-soft block mt-1 leading-relaxed">
                      {item.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* SUBSECTION 3: Operational & System Telemetry Cards */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-emerald-900 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
              3. البطاقات والمؤشرات التشغيلية التنفيذية (Operational Telemetry & System Cards)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {[
              {
                key: 'salesRateOverTime',
                label: 'معدل المبيعات وحجم الفواتير خلال الزمن',
                desc: 'عرض سرعة المبيعات الإجمالية ونمو الإيرادات الزمنية'
              },
              {
                key: 'netProfitOverTime',
                label: 'معدل صافي الربح العام وهامش الربحية',
                desc: 'عرض صافي الأرباح المحققة بعد خصم كافة التكاليف والمصروفات'
              },
              {
                key: 'installmentsRate',
                label: 'مؤشرات الأقساط الجارية ونسب التحصيل',
                desc: 'عرض إجمالي الأقساط المستحقة، المبالغ المحصلة، ونسبة الالتزام'
              },
              {
                key: 'returnsRate',
                label: 'معدلات المرتجعات وتوالف الضمان',
                desc: 'عرض نسبة المرتجعات، عدد الوحدات التالفة بالضمان، وقيمة الخسارة'
              },
              {
                key: 'workOrdersAwaitingDelivery',
                label: 'أوامر الشغل قيد التجهيز بانتظار التسليم',
                desc: 'عرض تذاكر المعمل تحت التجهيز والنظارات الجاهزة للتسليم'
              },
              {
                key: 'pendingSuppliesAlerts',
                label: 'تنبيهات وزراير توريد النواقص المعلقة',
                desc: 'عرض بطاقات العملاء بانتظار توريد نواقص وزراير الواتساب وتأكيد الوصول'
              },
              {
                key: 'stockProposals',
                label: 'مقترحات التوريد والنواقص التلقائية',
                desc: 'عرض الأصناف التي بلغت الحد الحرج مع زر التوريد التلقائي'
              },
              {
                key: 'outOfStockCritical',
                label: 'الأصناف التي نفذت بالكامل (رصيد صفر)',
                desc: 'عرض الأصناف ذات الرصيد الصفري العاجلة لإعادة الطلب'
              },
              {
                key: 'operationalAlerts',
                label: 'كروت التنبيهات التشغيلية الشاملة',
                desc: 'تنبيهات الفحص السنوي، توريد الموردين، وتحديثات المعمل'
              }
            ].map((item) => {
              const isEnabled = overviewSettings[item.key] !== false;
              return (
                <label
                  key={item.key}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isEnabled
                      ? 'bg-paper border-emerald-500/30 shadow-2xs'
                      : 'bg-surface/50 border-line opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) =>
                      setOverviewSettings({ ...overviewSettings, [item.key]: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-600 rounded mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-ink block">{item.label}</span>
                    <span className="text-[11px] text-ink-soft block mt-1 leading-relaxed">
                      {item.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save Bottom Bar */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between gap-4 p-4 rounded-2xl bg-surface/95 backdrop-blur-md border border-line shadow-xl">
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <ShieldAlert className="w-4 h-4 text-indigo-600" />
          <span>التغييرات تنعكس فوراً على المتجر وكافة المستخدمين بمجرد الحفظ.</span>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md hover:shadow-indigo-500/25 disabled:opacity-50 transition-all text-sm"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
        </button>
      </div>
    </div>
  );
}
