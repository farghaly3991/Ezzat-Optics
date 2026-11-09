import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  ShoppingBag,
  Tag,
  Users,
  Palette,
  Settings,
  Share2,
  Bot,
  Wallet,
  BellRing,
  ScanBarcode,
  RotateCcw,
  ShoppingCart,
  Building2,
  Wrench,
  CalendarClock,
  Eye,
  Glasses,
  Truck,
  ClipboardList,
  UserCheck
} from 'lucide-react';

/**
 * Modern Sidebar Navigation Items for Optics Store System
 * Grouped logically for fast counter work and management.
 */
export const ADMIN_NAV_GROUPS = [
  {
    title: 'نقطة البيع والعمليات',
    items: [
      { path: 'pos', label: 'نقطة البيع والفواتير (POS)', icon: ScanBarcode, badge: 'رئيسي' },
      { path: 'orders', label: 'أوامر الشغل والفواتير (Orders & Lab)', icon: ShoppingBag },
      { path: 'installments', label: 'إدارة الأقساط والتحصيل', icon: CalendarClock },
      { path: 'maintenance', label: 'ورشة المعمل والتجهيز (Lab Workshop)', icon: Wrench },
      { path: 'returns', label: 'المرتجعات والضمان', icon: RotateCcw }
    ]
  },
  {
    title: 'العملاء وكشوفات النظر',
    items: [
      { path: 'customers', label: 'سجل العملاء والروشتات (CRM & Eyes)', icon: Eye, badge: 'كشوفات' }
    ]
  },
  {
    title: 'مخزون وتوريدات البصريات',
    items: [
      { path: 'products', label: 'الشنابر والعدسات والمخزن', icon: Glasses },
      { path: 'desired-products', label: 'قوائم الانتظار ونواقص الطلب', icon: BellRing, badge: 'طلبات' },
      { path: 'procurement', label: 'التوريدات وشحنات الموردين', icon: Truck, badge: 'توريد' },
      { path: 'categories', label: 'أقسام البصريات', icon: Layers }
    ]
  },
  {
    title: 'المالية والتقارير',
    items: [
      { path: 'overview', label: 'لوحة التحكم والمؤشرات (Dashboard)', icon: LayoutDashboard },
      { path: 'finance', label: 'الخزينة والمصروفات والأستاذ المساعد', icon: Wallet },
      { path: 'analytics', label: 'الأرباح وتحليلات المبيعات', icon: TrendingUp },
      { path: 'ai-instructions', label: 'تعليمات المساعد الذكي (AI)', icon: Bot, badge: 'AI' }
    ]
  },
  {
    title: 'الفروع وإعدادات النظام',
    items: [
      { path: 'attendance', label: 'تحضير الموظفين السريع', icon: UserCheck, badge: 'سريع' },
      { path: 'branches', label: 'الفروع والموظفين (Branches & HR)', icon: Building2 },
      { path: 'audit-logs', label: 'سجل العمليات والرقابة (Audit Logs)', icon: ClipboardList },
      { path: 'settings', label: 'بيانات المحل وإعدادات الطابعات', icon: Settings }
    ]
  }
];

// Flat list for easy lookup and backward compatibility
export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap(g => g.items);

export const DEFAULT_ADMIN_PATH = 'overview';
