import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import ImageUploader from '../../shared/components/ImageUploader';
import { Link } from 'react-router-dom';
import {
  Save,
  Settings,
  Cloud,
  CreditCard,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Share2,
  BookOpen,
  RefreshCw,
  Bell,
  Send,
  ShieldAlert,
  Zap,
  TrendingDown,
  Package,
  Key,
  Sliders,
  Glasses,
  Eye,
  Layers
} from 'lucide-react';

export default function SettingsTab() {
  const { token, config, loadConfig, showToast, user, isSuperAdmin } = useStore();
  const isRole6 = user?.role === 6 || isSuperAdmin;
  const [settings, setSettings] = useState({
    siteName: '',
    siteDescription: '',
    logo: '',
    backgroundImage: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    currency: 'ج.م',
    shippingCost: 0,
    freeShippingOver: 0,
    allowCustomerStoreAccounts: false,
    enableOpticsPrescriptions: true,
    aiEnabled: false,
    AI_API_KEY: '',
    AI_BASE_URL: '',
    AI_MODEL: '',
    GEMINI_API_KEY: '',
    imageAiEnabled: true,
    IMAGE_AI_API_KEY: '',
    IMAGE_AI_BASE_URL: 'https://api.openai.com/v1',
    IMAGE_AI_MODEL: 'gpt-image-1',
    facebookEnabled: true,
    FB_PAGE_ID: '',
    FB_PAGE_ACCESS_TOKEN: '',
    FB_APP_ID: '',
    FB_APP_SECRET: '',
    AWS_API_KEY_ID: '',
    AWS_API_KEY_SECRET: '',
    payment: {
      apiKey: '',
      hmacSecret: '',
      cardIntegrationId: '',
      walletIntegrationId: '',
      kioskIntegrationId: '',
      cardIframeId: ''
    },
    cartNotifications: {
      enabled: true,
      channel: 'in_app', // 'disabled' | 'in_app' | 'web_push' | 'both'
      notifyOnPriceDrop: true,
      notifyOnPriceIncrease: false,
      notifyOnOutOfStock: true,
      notifyOnCriticalStock: true,
      autoUpdateCartOnOutOfStock: false,
      vapidPublicKey: '',
      vapidPrivateKey: '',
      vapidSubject: 'mailto:support@almister.com',
      fcmServerKey: ''
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testingNotif, setTestingNotif] = useState(false);
  const [testNotifStatus, setTestNotifStatus] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSyncCategories = async () => {
    setSyncingCategories(true);
    setSyncMessage('');
    try {
      const res = await axios.post('/api/admin/ai/sync-schema', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setSyncMessage(`تمت المزامنة بنجاح! تم استخراج مواصفات ${res.data.count || 0} أقسام وحفظها لمحرك الذكاء الاصطناعي.`);
      } else {
        setSyncMessage('تم إرسال طلب المزامنة بنجاح.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'فشل في مزامنة أقسام المتجر للذكاء الاصطناعي');
    } finally {
      setSyncingCategories(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.settings) {
        setSettings(prev => ({
          ...prev,
          ...res.data.settings,
          payment: { ...prev.payment, ...(res.data.settings.payment || {}) },
          cartNotifications: { ...prev.cartNotifications, ...(res.data.settings.cartNotifications || {}) }
        }));
      }
    } catch (err) {
      setError('فشل في تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestingNotif(true);
    setTestNotifStatus(null);
    try {
      const res = await axios.post('/api/admin/notifications/test', {
        title: '🔔 إشعار تجريبي لاختبار التنبيهات',
        message: 'تم استلام الإشعار بنجاح! نظام الإشعارات وتنبيهات السلات يعمل بكفاءة وبشكل مستقل.',
        channel: settings.cartNotifications?.channel || 'in_app'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTestNotifStatus({ ok: true, text: 'تم إرسال الإشعار التجريبي بنجاح عبر القنوات المحددة!' });
      if (showToast) showToast('تم إرسال الإشعار التجريبي بنجاح', 'success');
    } catch (err) {
      const msg = err.response?.data?.error || 'فشل إرسال الإشعار التجريبي';
      setTestNotifStatus({ ok: false, text: msg });
      if (showToast) showToast(msg, 'error');
    } finally {
      setTestingNotif(false);
    }
  };

  const applyOpticsPreset = () => {
    setSettings((prev) => ({
      ...prev,
      systemProfile: 'optics',
      enableOpticsPrescriptions: true,
      allowCustomerStoreAccounts: false,
      enabledModules: {
        pos: true,
        orders: true,
        maintenance: true,
        customers: true,
        products: true,
        lensMatrix: true,
        matrixTemplates: true,
        desiredProducts: true,
        finance: true,
        analytics: true,
        installments: true,
        returns: true,
        categories: true,
        branches: true,
        auditLogs: true,
        settings: true,
        storefront: false,
        theme: false,
        coupons: false,
        offers: false,
        carts: false,
        facebook: false,
        aiInstructions: false
      }
    }));
    if (showToast) showToast('تم تفعيل نمط محل البصريات (Optics Store) — تذكر الضغط على حفظ التعديلات');
  };

  const applyRetailPreset = () => {
    setSettings((prev) => ({
      ...prev,
      systemProfile: 'retail',
      enableOpticsPrescriptions: false,
      allowCustomerStoreAccounts: true,
      enabledModules: {
        pos: true,
        orders: true,
        maintenance: true,
        customers: true,
        products: true,
        lensMatrix: true,
        matrixTemplates: true,
        desiredProducts: true,
        finance: true,
        analytics: true,
        installments: true,
        returns: true,
        categories: true,
        branches: true,
        auditLogs: true,
        settings: true,
        storefront: true,
        theme: true,
        coupons: true,
        offers: true,
        carts: true,
        facebook: true,
        aiInstructions: true
      }
    }));
    if (showToast) showToast('تم تفعيل نمط المتجر الإلكتروني والتجزئة الكامل — تذكر الضغط على حفظ التعديلات');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await axios.put('/api/admin/settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('تم حفظ الإعدادات بنجاح');
      loadConfig(); // Refresh public config
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-ink-soft">جاري التحميل...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-ink flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            إعدادات المتجر
          </h2>
          <p className="text-sm text-ink-soft mt-1">إدارة الإعدادات العامة للمتجر، الذكاء الاصطناعي، التخزين وبوابات الدفع</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-[var(--color-primary-contrast,#ffffff)] px-6 py-2.5 rounded-btn font-bold flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
        >
          <Save className="w-4 h-4" />
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      {message && (
        <div className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 p-4 rounded-card flex items-center gap-2 font-bold text-sm">
          <CheckCircle2 className="w-5 h-5" /> {message}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-4 rounded-card flex items-center gap-2 font-bold text-sm">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Quick Jump Links Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-surface border border-line text-xs font-bold shadow-sm">
        <span className="text-ink-soft">انتقال سريع للأقسام:</span>
        <a href="#general-settings" className="px-3 py-1.5 rounded-xl bg-paper hover:bg-primary/10 hover:text-primary border border-line transition-all">إعدادات عامة</a>
        <a href="#ai-settings" className="px-3 py-1.5 rounded-xl bg-paper hover:bg-primary/10 hover:text-primary border border-line transition-all">الذكاء الاصطناعي</a>
        <a href="#notifications-settings" className="px-3 py-1.5 rounded-xl bg-paper hover:bg-primary/10 hover:text-primary border border-line transition-all">الإشعارات والتنبيهات</a>
        <a href="#payment-settings" className="px-3 py-1.5 rounded-xl bg-paper hover:bg-primary/10 hover:text-primary border border-line transition-all">بوابات الدفع</a>
        <a href="#cloud-settings" className="px-3 py-1.5 rounded-xl bg-paper hover:bg-primary/10 hover:text-primary border border-line transition-all">التخزين السحابي</a>
        {isRole6 && (
          <Link
            to="/admin/developer"
            className="mr-auto px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all font-black flex items-center gap-1.5 shadow-xs"
          >
            <span>⚙️ الانتقال لبوابة المطور (Role 6) ←</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Settings */}
        <div id="general-settings" className="bg-surface p-6 rounded-card shadow-sm border border-line space-y-4 text-ink">
          <h3 className="text-lg font-black text-ink flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            إعدادات عامة
          </h3>
          
          <div>
            <label className="block text-sm font-bold text-ink-soft mb-1">اسم المتجر</label>
            <input type="text" value={settings.siteName} onChange={e => setSettings({...settings, siteName: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" />
          </div>
          <div>
            <label className="block text-sm font-bold text-ink-soft mb-1">وصف المتجر</label>
            <textarea value={settings.siteDescription} onChange={e => setSettings({...settings, siteDescription: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" rows="3" />
          </div>
          <div>
             <label className="block text-sm font-bold text-ink-soft mb-1">شعار المتجر (Logo)</label>
             <ImageUploader value={settings.logo} onChange={val => setSettings({...settings, logo: val})} />
          </div>
          <div>
             <label className="block text-sm font-bold text-ink-soft mb-1">صورة الخلفية للواجهة (Hero)</label>
             <ImageUploader value={settings.backgroundImage} onChange={val => setSettings({...settings, backgroundImage: val})} />
          </div>

          {/* Customer Online Storefront Access Global Toggle */}
          <div className="p-4 rounded-2xl bg-paper border border-line flex items-center justify-between gap-4">
            <div>
              <span className="block text-sm font-bold text-ink">
                سماح العملاء بالدخول وإنشاء حسابات على المتجر الإلكتروني
              </span>
              <span className="block text-xs text-ink-soft mt-0.5">
                عند التفعيل، يمكن للعملاء تسجيل الدخول بحساباتهم والشراء عبر المتجر. عند التعطيل، يعمل النظام ككاشير وإدارة داخلية فقط.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={Boolean(settings.allowCustomerStoreAccounts)}
                onChange={(e) => setSettings({ ...settings, allowCustomerStoreAccounts: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line">
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">العملة</label>
              <input type="text" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">رقم الهاتف</label>
              <input type="text" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">تكلفة الشحن الثابتة</label>
              <input type="number" value={settings.shippingCost} onChange={e => setSettings({...settings, shippingCost: Number(e.target.value)})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">شحن مجاني للطلبات فوق</label>
              <input type="number" value={settings.freeShippingOver} onChange={e => setSettings({...settings, freeShippingOver: Number(e.target.value)})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" />
            </div>
          </div>
        </div>

        {/* AI & Cloud Settings */}
        <div className="space-y-6">
          {/* AI Model 1: Text, Planner & Voice AI */}
          <div className="bg-surface p-6 rounded-card shadow-sm border border-line space-y-4 text-ink">
            <h3 className="text-lg font-black text-ink flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <span>الموديل الأول: الذكاء الاصطناعي للنصوص والصوت (Planner & Voice AI)</span>
            </h3>
            
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={settings.aiEnabled} onChange={e => setSettings({...settings, aiEnabled: e.target.checked})} className="w-4 h-4 text-primary rounded border-line focus:ring-primary" />
              <span className="text-sm font-bold text-ink">تفعيل ميزات الذكاء الاصطناعي للنصوص والصوت</span>
            </label>

            {settings.aiEnabled && (
              <>
                <div>
                  <label className="block text-sm font-bold text-ink-soft mb-1">AI API Key (DeepSeek / OpenRouter)</label>
                  <input type="password" value={settings.AI_API_KEY || ''} onChange={e => setSettings({...settings, AI_API_KEY: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" placeholder="sk-..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-ink-soft mb-1">AI Base URL</label>
                    <input type="text" value={settings.AI_BASE_URL || ''} onChange={e => setSettings({...settings, AI_BASE_URL: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" placeholder="https://api.deepseek.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-ink-soft mb-1">AI Model</label>
                    <input type="text" value={settings.AI_MODEL || ''} onChange={e => setSettings({...settings, AI_MODEL: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary text-ink" placeholder="deepseek-chat" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-soft mb-1">Gemini API Key (لتفريغ الصوت الفوري والموديل الاحتياطي)</label>
                  <input type="password" value={settings.GEMINI_API_KEY || ''} onChange={e => setSettings({...settings, GEMINI_API_KEY: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" placeholder="AQ... أو AIza..." />
                </div>

                {/* Categories & Specs AI Sync Box */}
                <div className="pt-4 border-t border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-ink flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" />
                        مزامنة أقسام ومواصفات المتجر مع الـ AI
                      </h4>
                      <p className="text-[11px] text-ink-soft mt-0.5">
                        يتم جمع جميع الأقسام ومواصفاتها وتحديث الـ System Prompt لمساعد البحث والمقارنات الذكي.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncCategories}
                    disabled={syncingCategories}
                    className="w-full py-2.5 px-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-btn font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${syncingCategories ? 'animate-spin' : ''}`} />
                    {syncingCategories ? 'جاري مزامنة بيانات الأقسام...' : 'مزامنة بيانات الأقسام للذكاء الاصطناعي الآن'}
                  </button>

                  {syncMessage && (
                    <div className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-btn flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      {syncMessage}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* AI Model 2: Image Enhancement & Multi-Angle Generation AI (e.g. GPT Image / DALL-E) */}
          <div className="bg-surface p-6 rounded-card shadow-sm border border-line space-y-4 text-ink">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-ink flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <span>الموديل الثاني: ذكاء اصطناعي للصور والزوايا (Image AI)</span>
              </h3>
              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                  settings.imageAiEnabled !== false && (settings.IMAGE_AI_API_KEY || '').trim().length > 5
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    : 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                }`}
              >
                {settings.imageAiEnabled !== false && (settings.IMAGE_AI_API_KEY || '').trim().length > 5
                  ? 'مفعل (تظهر خيارات تحسين الصور والزوايا)'
                  : 'غير مضاف (يكتفي برفع أو تصوير الصورة)'}
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              موديل مخصص لتحسين صور المنتجات أو توليد زوايا متعددة (مثل OpenAI GPT Image / DALL-E). في حال إدخال بياناته ستظهر خيارات التحسين والزوايا تلقائياً عند إضافة أو تعديل المنتجات، وفي حال عدم وجودها سيكتفي النظام برفع الصورة أو تصويرها مباشرة.
            </p>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.imageAiEnabled !== false}
                onChange={(e) => setSettings({ ...settings, imageAiEnabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded border-line focus:ring-purple-500"
              />
              <span className="text-sm font-bold text-ink">تفعيل استوديو تحسين وتوليد صور المنتجات (عند توفر المفتاح)</span>
            </label>

            {settings.imageAiEnabled !== false && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-sm font-bold text-ink-soft mb-1">Image AI API Key (مثل OpenAI GPT Key)</label>
                  <input
                    type="password"
                    value={settings.IMAGE_AI_API_KEY || ''}
                    onChange={(e) => setSettings({ ...settings, IMAGE_AI_API_KEY: e.target.value })}
                    className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-purple-500 font-mono text-ink"
                    placeholder="sk-proj-..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-ink-soft mb-1">Image AI Base URL</label>
                    <input
                      type="text"
                      value={settings.IMAGE_AI_BASE_URL || ''}
                      onChange={(e) => setSettings({ ...settings, IMAGE_AI_BASE_URL: e.target.value })}
                      className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-purple-500 text-ink"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-ink-soft mb-1">Image AI Model</label>
                    <input
                      type="text"
                      value={settings.IMAGE_AI_MODEL || ''}
                      onChange={(e) => setSettings({ ...settings, IMAGE_AI_MODEL: e.target.value })}
                      className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-purple-500 text-ink"
                      placeholder="gpt-image-1 أو dall-e-3"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cloud Storage */}
          <div id="cloud-settings" className="bg-surface p-6 rounded-card shadow-sm border border-line space-y-4 text-ink">
            <h3 className="text-lg font-black text-ink flex items-center gap-2 mb-4">
              <Cloud className="w-5 h-5 text-primary" />
              التخزين السحابي (AWS S3 / R2)
            </h3>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Access Key ID</label>
              <input type="text" value={settings.AWS_API_KEY_ID} onChange={e => setSettings({...settings, AWS_API_KEY_ID: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Secret Access Key</label>
              <input type="password" value={settings.AWS_API_KEY_SECRET} onChange={e => setSettings({...settings, AWS_API_KEY_SECRET: e.target.value})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="bg-surface p-6 rounded-card shadow-sm border border-line space-y-4 md:col-span-2 text-ink">
          <h3 className="text-lg font-black text-ink flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            بوابة الدفع (Paymob)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">API Key</label>
              <input type="password" value={settings.payment?.apiKey} onChange={e => setSettings({...settings, payment: {...settings.payment, apiKey: e.target.value}})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">HMAC Secret</label>
              <input type="password" value={settings.payment?.hmacSecret} onChange={e => setSettings({...settings, payment: {...settings.payment, hmacSecret: e.target.value}})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Card Integration ID</label>
              <input type="text" value={settings.payment?.cardIntegrationId} onChange={e => setSettings({...settings, payment: {...settings.payment, cardIntegrationId: e.target.value}})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Card Iframe ID</label>
              <input type="text" value={settings.payment?.cardIframeId} onChange={e => setSettings({...settings, payment: {...settings.payment, cardIframeId: e.target.value}})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Wallet Integration ID</label>
              <input type="text" value={settings.payment?.walletIntegrationId} onChange={e => setSettings({...settings, payment: {...settings.payment, walletIntegrationId: e.target.value}})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink-soft mb-1">Kiosk Integration ID</label>
              <input type="text" value={settings.payment?.kioskIntegrationId} onChange={e => setSettings({...settings, payment: {...settings.payment, kioskIntegrationId: e.target.value}})} className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-sm outline-none focus:border-primary font-mono text-ink" />
            </div>
          </div>
        </div>

        {/* Standalone Notifications & Cart Price/Stock Alerts */}
        <div className="bg-surface p-6 rounded-card shadow-sm border border-line space-y-6 md:col-span-2 text-ink">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div>
              <h3 className="text-lg font-black text-ink flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                <span>إعدادات تنبيهات وتغيرات سلات التسوق (Cart Price & Stock Alerts)</span>
              </h3>
              <p className="text-xs text-ink-soft mt-1">
                موديول الإشعارات المستقل: إرسال تنبيهات تلقائية عند انخفاض أسعار المنتجات أو نفاذها للمستخدمين الذين أضافوها لسلاتهم، مجمعة ومحسوبة بدقة.
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer self-start sm:self-auto bg-paper px-4 py-2 rounded-btn border border-line hover:border-primary/50 transition-colors">
              <input
                type="checkbox"
                checked={settings.cartNotifications?.enabled !== false}
                onChange={e => setSettings({
                  ...settings,
                  cartNotifications: {
                    ...settings.cartNotifications,
                    enabled: e.target.checked
                  }
                })}
                className="w-5 h-5 text-primary rounded border-line focus:ring-primary"
              />
              <span className="text-sm font-bold text-ink">
                {settings.cartNotifications?.enabled !== false ? 'النظام مفعل' : 'النظام معطل'}
              </span>
            </label>
          </div>

          {/* Delivery Channels */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-ink">
              قنوات إرسال التنبيهات (Notification Channels)
            </label>
            <p className="text-xs text-ink-soft">
              حدد الطريقة التي ترغب بإشعار العملاء بها عند حدوث تغيير في أسعار أو مخزون سلاتهم:
            </p>

            {(() => {
              const hasPushCredentials = Boolean(
                (settings.cartNotifications?.vapidPublicKey && settings.cartNotifications?.vapidPrivateKey) ||
                settings.cartNotifications?.fcmServerKey
              );

              const channels = [
                {
                  id: 'disabled',
                  title: 'إلغاء التنبيهات بالكامل (Disabled)',
                  desc: 'عدم إرسال أي تنبيهات عند تغير الأسعار أو المخزون (بدون استهلاك موارد)',
                  available: true
                },
                {
                  id: 'in_app',
                  title: 'داخل الموقع فقط (In-App Notifications)',
                  desc: 'تظهر التنبيهات والعروض الترويجية في جرس الإشعارات بالهيدر وحساب المستخدم بالموقع',
                  available: true
                },
                {
                  id: 'web_push',
                  title: 'إشعارات الويب الحقيقية (Web Push)',
                  desc: 'إرسال إشعارات لمتصفح الزائر حتى عند إغلاق المتجر (يتطلب مفاتيح VAPID أو FCM)',
                  available: hasPushCredentials,
                  reason: 'غير متاح حالياً: يلزم إدخال بيانات الربط في قسم Web Push أدناه'
                },
                {
                  id: 'both',
                  title: 'كلاهما معاً (In-App + Web Push)',
                  desc: 'تسجيل التنبيه في الموقع وإرسال إشعار فوري للمتصفح في آن واحد لأقصى معدل تفاعل',
                  available: hasPushCredentials,
                  reason: 'غير متاح حالياً: يلزم إدخال بيانات الربط في قسم Web Push أدناه'
                }
              ];

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {channels.map((chan) => {
                    const isSelected = (settings.cartNotifications?.channel || 'in_app') === chan.id;
                    const isDisabled = !chan.available;

                    return (
                      <div
                        key={chan.id}
                        onClick={() => {
                          if (isDisabled) return;
                          setSettings({
                            ...settings,
                            cartNotifications: {
                              ...settings.cartNotifications,
                              channel: chan.id
                            }
                          });
                        }}
                        className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
                          isDisabled
                            ? 'opacity-50 cursor-not-allowed bg-paper/50 border-line'
                            : isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm cursor-pointer'
                            : 'border-line hover:border-primary/40 bg-paper cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="cartNotificationChannel"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => {}}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="font-bold text-sm text-ink">{chan.title}</span>
                          </div>
                          {!chan.available && (
                            <span className="text-[10px] font-bold bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full border border-orange-500/20">
                              غير مهيأ
                            </span>
                          )}
                          {chan.available && isSelected && (
                            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              مختار
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-soft">{chan.desc}</p>
                        {isDisabled && chan.reason && (
                          <p className="text-[11px] text-orange-600 mt-2 font-medium">⚠️ {chan.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Trigger Event Toggles */}
          <div className="space-y-3 pt-4 border-t border-line">
            <label className="block text-sm font-bold text-ink">
              حالات التنبيه المفعلة (Alert Triggers)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Price Drop */}
              <label className="flex items-start gap-3 p-3 bg-paper rounded-xl border border-line cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.cartNotifications?.notifyOnPriceDrop !== false}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      notifyOnPriceDrop: e.target.checked
                    }
                  })}
                  className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-line focus:ring-emerald-500"
                />
                <div>
                  <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-emerald-500" />
                    تنبيهات انخفاض الأسعار (عروض مغرية)
                  </span>
                  <p className="text-xs text-ink-soft mt-0.5">
                    صياغة تسويقية حماسية: "انخفض سعر منتج في سلتك! الحق العرض قبل نفاذ الكمية" مع حساب الوفر والخصم.
                  </p>
                </div>
              </label>

              {/* Price Increase */}
              <label className="flex items-start gap-3 p-3 bg-paper rounded-xl border border-line cursor-pointer hover:border-orange-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(settings.cartNotifications?.notifyOnPriceIncrease)}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      notifyOnPriceIncrease: e.target.checked
                    }
                  })}
                  className="w-4 h-4 mt-0.5 text-orange-600 rounded border-line focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    تنبيهات زيادة الأسعار
                  </span>
                  <p className="text-xs text-ink-soft mt-0.5">
                    إشعار شفاف وهادئ بتعديل سعر منتج موجود في سلة التسوق الخاصة بالعميل.
                  </p>
                </div>
              </label>

              {/* Out of Stock */}
              <label className="flex items-start gap-3 p-3 bg-paper rounded-xl border border-line cursor-pointer hover:border-red-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.cartNotifications?.notifyOnOutOfStock !== false}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      notifyOnOutOfStock: e.target.checked
                    }
                  })}
                  className="w-4 h-4 mt-0.5 text-red-600 rounded border-line focus:ring-red-500"
                />
                <div>
                  <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    تنبيهات نفاذ المخزون
                  </span>
                  <p className="text-xs text-ink-soft mt-0.5">
                    تنبيه العميل بأن المنتج الموجود في سلة تسوقه نفدت كميته مؤقتاً.
                  </p>
                </div>
              </label>

              {/* Critical Stock */}
              <label className="flex items-start gap-3 p-3 bg-paper rounded-xl border border-line cursor-pointer hover:border-orange-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.cartNotifications?.notifyOnCriticalStock !== false}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      notifyOnCriticalStock: e.target.checked
                    }
                  })}
                  className="w-4 h-4 mt-0.5 text-orange-600 rounded border-line focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-orange-500" />
                    تنبيهات اقتراب نفاذ المخزون (الحد الحرج)
                  </span>
                  <p className="text-xs text-ink-soft mt-0.5">
                    رسالة تحفيزية: "سارع بإتمام طلبك! الكمية المتبقية أوشكت على النفاد".
                  </p>
                </div>
              </label>

              {/* Auto update cart on out of stock */}
              <label className="flex items-start gap-3 p-3 bg-paper rounded-xl border border-line cursor-pointer hover:border-primary/40 transition-colors md:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(settings.cartNotifications?.autoUpdateCartOnOutOfStock)}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      autoUpdateCartOnOutOfStock: e.target.checked
                    }
                  })}
                  className="w-4 h-4 mt-0.5 text-primary rounded border-line focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    تحديث عناصر السلة تلقائياً عند نفاذ المخزون
                  </span>
                  <p className="text-xs text-ink-soft mt-0.5">
                    عند نفاذ كمية المنتج، يتم وضع علامة عدم توفر تلقائياً وتحديث إجمالي السلة لتجنب أخطاء الدفع.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Web Push & FCM Integration Settings */}
          <div className="space-y-4 pt-4 border-t border-line">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-ink flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  بيانات تكامل إشعارات الويب الحقيقية (Web Push / VAPID / FCM)
                </h4>
                <p className="text-xs text-ink-soft mt-0.5">
                  أدخل مفاتيح VAPID القياسية للويب أو مفتاح خادم FCM لتفعيل إرسال إشعارات المتصفح الحقيقية.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={testingNotif}
                className="bg-paper hover:bg-line text-ink border border-line px-3.5 py-1.5 rounded-btn text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-primary" />
                {testingNotif ? 'جاري الإرسال...' : 'إرسال إشعار تجريبي'}
              </button>
            </div>

            {testNotifStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  testNotifStatus.ok
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                    : 'bg-red-500/10 text-red-500 border-red-500/25'
                }`}
              >
                {testNotifStatus.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{testNotifStatus.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">VAPID Public Key</label>
                <input
                  type="text"
                  placeholder="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv..."
                  value={settings.cartNotifications?.vapidPublicKey || ''}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      vapidPublicKey: e.target.value
                    }
                  })}
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs outline-none focus:border-primary font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">VAPID Private Key</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  value={settings.cartNotifications?.vapidPrivateKey || ''}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      vapidPrivateKey: e.target.value
                    }
                  })}
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs outline-none focus:border-primary font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">VAPID Subject / Email</label>
                <input
                  type="text"
                  placeholder="mailto:support@almister.com"
                  value={settings.cartNotifications?.vapidSubject || ''}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      vapidSubject: e.target.value
                    }
                  })}
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs outline-none focus:border-primary text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1">FCM Server Key (Google Firebase)</label>
                <input
                  type="password"
                  placeholder="AAAA..."
                  value={settings.cartNotifications?.fcmServerKey || ''}
                  onChange={e => setSettings({
                    ...settings,
                    cartNotifications: {
                      ...settings.cartNotifications,
                      fcmServerKey: e.target.value
                    }
                  })}
                  className="w-full bg-paper border border-line rounded-btn px-3 py-2 text-xs outline-none focus:border-primary font-mono text-ink"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

