import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Share2,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  BookOpen,
  Webhook,
  HelpCircle,
  Save
} from 'lucide-react';
import { useStore } from '../../../shared/context/StoreContext';

export default function FacebookApiSettingsModal({ isOpen, onClose, onOpenGuide, onSettingsSaved }) {
  const { token, showToast, loadConfig } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('multi_tenant_secret_token');
  const [facebookEnabled, setFacebookEnabled] = useState(true);

  const [verifyStatus, setVerifyStatus] = useState(null); // { ok: bool, message: string, page?: any }
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeResult, setSubscribeResult] = useState(null);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/facebook/webhook`
    : '/api/facebook/webhook';

  // Load existing settings when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setVerifyStatus(null);
    axios
      .get('/api/admin/settings', authHeader)
      .then((res) => {
        if (res.data?.settings) {
          const s = res.data.settings;
          setPageId(s.FB_PAGE_ID || '');
          setAccessToken(s.FB_PAGE_ACCESS_TOKEN || '');
          setAppId(s.FB_APP_ID || '');
          setAppSecret(s.FB_APP_SECRET || '');
          setWebhookVerifyToken(s.FB_WEBHOOK_VERIFY_TOKEN || 'multi_tenant_secret_token');
          setFacebookEnabled(s.facebookEnabled !== false);
        }
      })
      .catch((err) => {
        console.error('Error fetching settings for FB modal:', err);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (txt, label = 'النص') => {
    navigator.clipboard.writeText(txt);
    showToast(`تم نسخ ${label} إلى الحافظة بنجاح 📋`, 'success');
  };

  const handleVerify = async () => {
    if (!pageId.trim() || !accessToken.trim()) {
      showToast('يرجى إدخال معرف الصفحة وتوكن الوصول أولاً قبل الفحص', 'error');
      return;
    }
    setVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await axios.post(
        '/api/admin/facebook/verify',
        {
          FB_PAGE_ID: pageId.trim(),
          FB_PAGE_ACCESS_TOKEN: accessToken.trim()
        },
        authHeader
      );
      if (res.data?.done) {
        if (res.data.resolvedPageToken && res.data.resolvedPageToken !== accessToken.trim()) {
          setAccessToken(res.data.resolvedPageToken);
        }
        setVerifyStatus({
          ok: true,
          message: res.data.message || 'تم الاتصال بصفحة الفيسبوك بنجاح!',
          page: res.data.page,
          isUserToken: res.data.isUserToken
        });
        showToast(
          res.data.isUserToken
            ? 'تم التحقق بنجاح واستخراج توكن الصفحة (Page Token) تلقائياً! اضغط حفظ الآن.'
            : 'تم التحقق بنجاح من اتصال صفحة الفيسبوك ✅',
          'success'
        );
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        'تعذر الاتصال بصفحة الفيسبوك، تأكد من صحة معرف الصفحة وصلاحية التوكن.';
      setVerifyStatus({
        ok: false,
        message: errMsg
      });
      showToast(errMsg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubscribeWebhooks = async () => {
    if (!pageId.trim() || !accessToken.trim()) {
      showToast('يرجى التأكد من إدخال معرف الصفحة وتوكن الوصول أولاً', 'error');
      return;
    }
    setSubscribing(true);
    setSubscribeResult(null);
    try {
      const res = await axios.post(
        '/api/admin/facebook/social/subscribe-webhooks',
        {
          pageId: pageId.trim(),
          accessToken: accessToken.trim()
        },
        authHeader
      );
      if (res.data?.success) {
        setSubscribeResult({ ok: true, message: res.data.message });
        showToast('تم تفعيل اشتراك الصفحة في أحداث فيسبوك بنجاح 🎉', 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'فشل تفعيل اشتراك الصفحة في أحداث فيسبوك';
      setSubscribeResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setSubscribing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        FB_PAGE_ID: pageId.trim(),
        FB_PAGE_ACCESS_TOKEN: accessToken.trim(),
        FB_APP_ID: appId.trim(),
        FB_APP_SECRET: appSecret.trim(),
        FB_WEBHOOK_VERIFY_TOKEN: webhookVerifyToken.trim() || 'multi_tenant_secret_token',
        facebookEnabled
      };

      const res = await axios.put('/api/admin/settings', payload, authHeader);
      if (res.data?.done) {
        showToast('تم حفظ إعدادات ومفاتيح ربط فيسبوك بنجاح 🎉', 'success');
        if (typeof loadConfig === 'function') {
          await loadConfig();
        }
        if (onSettingsSaved) {
          onSettingsSaved(res.data.settings);
        }
        onClose();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'فشل حفظ الإعدادات', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-surface text-ink rounded-3xl shadow-2xl border border-line max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#1877F2] via-blue-800 to-slate-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shadow-inner">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>إعدادات وتوصيل صفحة الفيسبوك</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  Meta Graph API
                </span>
              </h3>
              <p className="text-xs text-blue-100/80 font-medium mt-0.5">
                أدخل مفاتيح الربط لتفعيل النشر التلقائي، الجدولة، وصندوق المحادثات والرد الذكي
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-xs text-ink-soft font-bold">جاري تحميل إعدادات فيسبوك...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Quick Guide Banner */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-blue-700 dark:text-blue-300 font-bold">
                  <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>تحتاج مساعدة في كيفية استخراج الـ Page ID و Access Token من فيسبوك؟</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenGuide) onOpenGuide();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح الشرح المصور خطوة بخطوة</span>
                </button>
              </div>

              {/* Status Indicator / Verify Result Box */}
              {verifyStatus && (
                <div
                  className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 animate-in fade-in ${
                    verifyStatus.ok
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  }`}
                >
                  {verifyStatus.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div>{verifyStatus.message}</div>
                    {verifyStatus.page && (
                      <div className="text-[11px] font-mono text-ink-soft flex items-center gap-3 pt-1">
                        <span>الاسم: {verifyStatus.page.name}</span>
                        {verifyStatus.page.fan_count !== undefined && (
                          <span>المتابعون: {verifyStatus.page.fan_count}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Activation Toggle */}
              <div className="p-4 rounded-2xl bg-paper border border-line flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-ink">تفعيل تكامل فيسبوك وسحب التعليقات</div>
                  <div className="text-[11px] text-ink-soft">
                    تفعيل خيارات النشر والجدولة وصندوق المحادثات الذكي بالـ AI
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={facebookEnabled}
                    onChange={(e) => setFacebookEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Main Fields: Page ID & Access Token */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-ink flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-primary" />
                      <span>معرف صفحة الفيسبوك (FB_PAGE_ID)</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <span className="text-[11px] text-ink-soft">رقم الـ Page ID الخاص بصفحتك</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="مثال: 109283746512345"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-mono font-bold text-ink focus:border-primary outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-ink flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span>توكن الوصول الممتد للصفحة (FB_PAGE_ACCESS_TOKEN)</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showToken ? 'إخفاء التوكن' : 'إظهار التوكن'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      required
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAA..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs font-mono font-medium text-ink focus:border-primary outline-none"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-[11px] text-ink-soft mt-1">
                    توكن ممتد غير منتهي (Never Expires) مستخرج من Meta Graph API Explorer بصلاحيات:
                    <span className="text-ink font-mono font-bold mx-1">pages_manage_posts, pages_read_engagement, pages_messaging</span>
                  </p>
                </div>

                {/* Optional App ID & Secret */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">
                      Meta App ID (معرف التطبيق - اختياري)
                    </label>
                    <input
                      type="text"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder="مثال: 987654321012345"
                      className="w-full px-3 py-2 rounded-xl bg-paper border border-line text-xs font-mono text-ink focus:border-primary outline-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">
                      Meta App Secret (المفتاح السري - اختياري)
                    </label>
                    <input
                      type="password"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder="المفتاح السري..."
                      className="w-full px-3 py-2 rounded-xl bg-paper border border-line text-xs font-mono text-ink focus:border-primary outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Webhook Configuration Section */}
              <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-black text-ink">
                      إعدادات الـ Webhook اللحظي للتعليقات ورسائل الماسنجر (Meta Webhooks)
                    </h4>
                  </div>
                  <a
                    href={`https://developers.facebook.com/apps/${appId || '1435221868193803'}/webhooks/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-black text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <span>فتح إعدادات Webhooks في Meta</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-[11px] text-ink-soft leading-relaxed">
                  لاستقبال التعليقات والرسائل فور كتابتها على فيسبوك تلقائياً دون أي تأخير، أضف هذا الرابط والتوكن في لوحة مطوري فيسبوك (Meta App Dashboard &gt; Webhooks &gt; اختر الكائن <strong>Page</strong>):
                </p>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-[11px] font-bold text-ink-soft mb-1">رابط الاستدعاء (Callback URL):</div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-line font-mono text-[11px] text-ink select-all outline-none"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(webhookUrl, 'رابط الـ Webhook')}
                        className="p-2 rounded-lg bg-surface hover:bg-paper border border-line text-ink-soft hover:text-ink transition-colors"
                        title="نسخ الرابط"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-ink-soft mb-1">رمز التحقق السري (Verify Token):</div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={webhookVerifyToken}
                        onChange={(e) => setWebhookVerifyToken(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-line font-mono text-[11px] text-ink outline-none"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(webhookVerifyToken, 'توكن التحقق')}
                        className="p-2 rounded-lg bg-surface hover:bg-paper border border-line text-ink-soft hover:text-ink transition-colors"
                        title="نسخ التوكن"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Page Subscribe Button */}
                  <div className="pt-2 border-t border-line/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="text-[11px] text-ink-soft">
                        <strong className="text-ink">الخطوة الإلزامية الثانية:</strong> تفعيل اشتراك صفحتك في أحداث الـ Webhook عبر الـ API
                      </div>
                      <button
                        type="button"
                        disabled={subscribing}
                        onClick={handleSubscribeWebhooks}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${subscribing ? 'animate-spin' : ''}`} />
                        <span>{subscribing ? 'جاري الاشتراك...' : 'تفعيل اشتراك الصفحة (1-Click Subscribe)'}</span>
                      </button>
                    </div>

                    {subscribeResult && (
                      <div
                        className={`mt-2 p-2.5 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                          subscribeResult.ok
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {subscribeResult.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <span>{subscribeResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleVerify}
                  className="px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/30 text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  <span>{verifying ? 'جاري الفحص مع Meta...' : 'اختبار اتصال صفحة الفيسبوك'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-paper hover:bg-surface border border-line text-xs font-bold text-ink"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ وتفعيل المفاتيح'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
