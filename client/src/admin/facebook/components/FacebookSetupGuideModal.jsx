import React from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  Key,
  ShieldCheck,
  HelpCircle,
  Copy,
  BookOpen,
  Sparkles,
  Layers,
  Webhook,
  Sliders,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useStore } from '../../../shared/context/StoreContext';

const REQUIRED_PERMISSIONS = [
  {
    code: 'pages_manage_posts',
    desc: 'نشر البوستات الدعائية والصور وجدولتها تلقائياً على صفحة الفيسبوك باسم الصفحة'
  },
  {
    code: 'pages_messaging',
    desc: 'استقبال رسائل الماسنجر وقراءتها والرد التلقائي الذكي عليها من خلال المتجر'
  },
  {
    code: 'pages_read_engagement',
    desc: 'قراءة التعليقات والتفاعلات واللايكات الواردة على منشورات الصفحة لحظياً'
  },
  {
    code: 'pages_manage_metadata',
    desc: 'ربط واشتراك أحداث الـ Webhooks للصفحة تلقائياً بدون تدخل يدوي معقد'
  },
  {
    code: 'pages_show_list',
    desc: 'إظهار قائمة الصفحات التي تديرها لاختيار صفحة المتجر واستخراج توكنها'
  },
  {
    code: 'business_management',
    desc: 'الربط مع محفظة أعمال Meta Business وإدارة أصول وإعلانات الصفحة'
  }
];

export default function FacebookSetupGuideModal({ isOpen, onClose }) {
  const { showToast } = useStore();

  if (!isOpen) return null;

  const copyText = (txt) => {
    navigator.clipboard.writeText(txt);
    showToast(`تم نسخ: ${txt}`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-surface text-ink rounded-3xl shadow-2xl border border-line max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-2xl shadow-inner">
              📘
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>الدليل المعتمد الشامل لربط صفحة الفيسبوك بالمتجر والـ AI (2026)</span>
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                الدليل التفاعلي المحدّث خطوة بخطوة لاستخراج التوكن، إعدادات Webhooks، وتفعيل النشر والرد الذكي
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Step-by-Step Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs leading-relaxed">
          {/* Intro Banner */}
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-ink space-y-1.5">
            <div className="font-black text-sm text-blue-600 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>خريطة طريق الربط المتكامل مع Meta</span>
            </div>
            <p className="text-ink-soft leading-relaxed">
              يرشدك هذا الدليل التفصيلي لربط أي صفحة فيسبوك جديدة بالمتجر بنجاح 100%، بدءاً من إنشاء التطبيق في منصة Meta الحديثة، مروراً بالـ Permissions والـ Graph Explorer، ووصولاً للـ Webhooks اللحظي والرد الذكي بالـ AI.
            </p>
          </div>

          {/* Step 1: Create App with modern Use Cases */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>الخطوة 1: إنشاء التطبيق واختيار التخصصات (Use Cases)</span>
              </span>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-black flex items-center gap-1"
              >
                <span>فتح Meta for Developers</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-ink-soft font-bold pr-1">
              <li>
                ادخل إلى <strong className="text-ink">developers.facebook.com/apps</strong> وسجل الدخول بحساب فيسبوك الذي يمتلك إدارة الصفحة.
              </li>
              <li>
                اضغط على زر <strong className="text-ink">"Create App" (إنشاء تطبيق)</strong>.
              </li>
              <li>
                <strong className="text-ink">في واجهة ميتا الحديثة:</strong> اختر التخصصات التي تناسب متجرك، مثل:
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-normal">
                  <span className="p-2 rounded-lg bg-surface border border-line text-ink">
                    ✓ <strong>Manage everything on your Page</strong> (إدارة محتوى وتفاعلات الصفحة)
                  </span>
                  <span className="p-2 rounded-lg bg-surface border border-line text-ink">
                    ✓ <strong>Analytics and automation</strong> (التحليلات والأتمتة الذكية)
                  </span>
                </div>
              </li>
              <li>
                اكتب اسماً للتطبيق يوضح وظيفته (مثلاً: <code className="bg-surface px-1.5 py-0.5 rounded border border-line text-ink">Store AI Commerce</code>) ثم اضغط <strong className="text-ink">Create App</strong>.
              </li>
            </ol>
          </div>

          {/* Step 2: Page ID */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>الخطوة 2: استخراج معرف الصفحة (FB_PAGE_ID)</span>
              </span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-ink-soft font-bold pr-1">
              <li>افتح صفحة متجرك على فيسبوك من المتصفح بحساب الأدمن.</li>
              <li>
                ادخل إلى قسم <strong className="text-ink">"حول" (About)</strong> ⬅️ ثم <strong className="text-ink">"شفافية الصفحة" (Page Transparency)</strong>.
              </li>
              <li>
                ستجد رقماً طويلاً اسمه <strong className="text-ink">معرف الصفحة (Page ID)</strong> (مثل: <code className="bg-surface px-1.5 py-0.5 rounded border border-line text-ink">108175751517418</code>).
              </li>
              <li>انسخ هذا الرقم وضعه في خانة <strong>معرف صفحة الفيسبوك (FB_PAGE_ID)</strong> في إعدادات المتجر.</li>
            </ol>
          </div>

          {/* Step 3: Graph API Explorer & Permissions */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>الخطوة 3: فتح Graph API Explorer وإضافة الصلاحيات</span>
              </span>
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-black flex items-center gap-1"
              >
                <span>فتح Graph API Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-ink-soft font-bold pr-1">
              <li>
                افتح أداة <strong className="text-ink">Graph API Explorer</strong>، ومن القائمة الجانبية اليمنى:
              </li>
              <li>
                في خانة <strong className="text-ink">Meta App</strong>: تأكد من اختيار اسم تطبيقك الذي أنشأته.
              </li>
              <li>
                في قسم <strong className="text-ink">Permissions (الصلاحيات)</strong>: أضف الصلاحيات الأساسية التالية (يمكنك الضغط على زر النسخ بجانب كل صلاحية للبحث عنها فوراً):
              </li>
            </ol>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {REQUIRED_PERMISSIONS.map((perm) => (
                <div
                  key={perm.code}
                  className="p-2.5 rounded-xl bg-surface border border-line flex flex-col justify-between gap-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <code className="font-mono font-black text-[11px] text-primary">{perm.code}</code>
                    <button
                      type="button"
                      onClick={() => copyText(perm.code)}
                      className="p-1 rounded hover:bg-paper text-ink-soft hover:text-ink"
                      title="نسخ الصلاحية"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-soft leading-tight">{perm.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Page Token Selection (Auto-generated) */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-2.5">
            <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs inline-block">
              الخطوة 4: التبديل لاسم الصفحة واستخراج التوكن بنقرة واحدة (Copy Token)
            </span>
            <ol className="list-decimal list-inside space-y-2 text-ink-soft font-bold pr-1">
              <li>
                في القائمة اليمنى بأداة Graph Explorer، انظر إلى خانة <strong className="text-ink">User or Page</strong>.
              </li>
              <li>
                افتح القائمة واختر <strong className="text-ink">اسم صفحتك مباشرة (Page)</strong> بدلاً من اسم حسابك الشخصي (User).
              </li>
              <li>
                <strong className="text-ink text-emerald-600 dark:text-emerald-400">ملاحظة ذكية:</strong> بمجرد اختيار اسم الصفحة، يقوم فيسبوك تلقائياً وبشكل فوري بتوليد وعرض التوكن الخاص بالصفحة في خانة Access Token دون الحاجة للضغط المتكرر على زر Generate!
              </li>
              <li>
                اضغط على زر <strong className="text-ink">"Copy Token" 📋</strong> الموجود مباشرة بجانب خانة التوكن الزرقاء في أعلى اليمين.
              </li>
              <li>
                الصق هذا التوكن في خانة <strong className="text-ink">FB_PAGE_ACCESS_TOKEN</strong> في إعدادات فيسبوك في المتجر.
              </li>
            </ol>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-bold space-y-1">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-100 font-black">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>تحذير لمنع خطأ فيسبوك الشهير (#200):</span>
              </div>
              <p className="leading-relaxed">
                إذا كان الاختيار في خانة User or Page هو حسابك الشخصي (User Token)، سينجح اختبار الاتصال فقط لكن سيفشل نشر البوستات مع رسالة خطأ:
                <code className="text-[11px] font-mono bg-surface px-1.5 py-0.5 rounded border border-line text-rose-600 block mt-1" dir="ltr">
                  (#200) Unpublished posts must be posted to a page as the page itself.
                </code>
                لذا تأكد دائماً أن الخانة مختار فيها <strong>اسم صفحة المتجر</strong>.
              </p>
            </div>
          </div>

          {/* Step 5: Webhooks & 1-Click Page Subscribe */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-2.5">
            <span className="px-3 py-1 rounded-full bg-purple-600 text-white font-black text-xs inline-block">
              الخطوة 5: ضبط الـ Webhooks وتفعيل اشتراك الصفحة (1-Click Subscribe)
            </span>
            <ol className="list-decimal list-inside space-y-2 text-ink-soft font-bold pr-1">
              <li>
                في لوحة تحكم تطبيق فيسبوك (Meta App Dashboard)، اذهب إلى <strong className="text-ink">Webhooks</strong> واختر الكائن <strong className="text-ink">Page</strong>.
              </li>
              <li>
                اضغط <strong className="text-ink">Edit Subscription</strong> وضع البيانات التالية:
                <div className="mt-1 space-y-1 font-mono text-[11px]">
                  <div className="p-1.5 rounded bg-surface border border-line text-ink">
                    Callback URL: <strong>https://store1.almister.com/api/facebook/webhook</strong>
                  </div>
                  <div className="p-1.5 rounded bg-surface border border-line text-ink">
                    Verify Token: <strong>multi_tenant_secret_token</strong>
                  </div>
                </div>
              </li>
              <li>
                بعد نجاح التحقق، فعّل الاشتراك في الحقول: <code className="bg-surface px-1 rounded text-primary">feed</code> (للتعليقات) و <code className="bg-surface px-1 rounded text-primary">messages</code> (للماسنجر).
              </li>
              <li>
                <strong className="text-ink">الخطوة الإلزامية في متجرك:</strong> افتح إعدادات فيسبوك في المتجر واضغط الزر الأرجواني:
                <br />
                👉 <strong className="text-purple-600 underline">«تفعيل اشتراك الصفحة (1-Click Subscribe)»</strong>
                <br />
                هذا الزر يرسل أمر <code className="font-mono bg-surface px-1 rounded">POST /{'{page-id}'}/subscribed_apps</code> لميتا لتفعيل تدفق الأحداث الحية فوراً!
              </li>
            </ol>
          </div>

          {/* Step 6: Advanced Messaging Handover & App Control */}
          <div className="p-4 rounded-2xl bg-paper border border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>الخطوة 6: إعطاء التطبيق التحكم الكامل بالرسائل (Take Control)</span>
              </span>
              <a
                href="https://www.facebook.com/settings/?tab=advanced_messaging"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-black flex items-center gap-1"
              >
                <span>فتح إعدادات المراسلة المتقدمة</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-ink-soft">
              لكي يتولى تطبيق المتجر الرد والتحكم في الرسائل دون أي نزاع مع تطبيقات سابقة أو ردود فيسبوك الافتراضية:
            </p>

            <ol className="list-decimal list-inside space-y-2 text-ink-soft font-bold pr-1">
              <li>
                افتح الرابط المباشر من حساب صفحة البيزنيس:{' '}
                <a
                  href="https://www.facebook.com/settings/?tab=advanced_messaging"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline font-mono"
                >
                  facebook.com/settings/?tab=advanced_messaging
                </a>
              </li>
              <li>
                انزل إلى قسم <strong className="text-ink">إعدادات التطبيقات بروتوكول التسليم (Handover Protocol / App Settings)</strong>.
              </li>
              <li>
                أمام خيار <strong className="text-ink">Messenger receiver (مستلم الماسنجر)</strong> اضغط على <strong className="text-ink">تكوين (Configure)</strong>.
              </li>
              <li>
                حدد تطبيق متجرك (<code className="bg-surface px-1 py-0.5 rounded text-primary font-mono">Analytics and automation</code>) ليكون هو <strong className="text-emerald-600 dark:text-emerald-400">Primary Receiver (المستلم الأساسي)</strong> ليتولى التحكم التام (Take Control) في كافة المحادثات الواردة.
              </li>
              <li>
                إذا كان هناك تطبيق قديم مربوط بالصفحة، قُم بإلغاء ربطه أو تعيينه كـ Secondary Receiver.
              </li>
            </ol>
          </div>

          {/* Step 7: Permanent Token & Meta Automations */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>الخطوة 7: التوكن الدائم التلقائي وإيقاف الردود القديمة في Meta Business Suite</span>
            </span>
            <ul className="list-disc list-inside space-y-2 text-ink font-bold pr-1">
              <li>
                <strong className="text-emerald-700 dark:text-emerald-300">الترقية التلقائية لتوكن دائم (Permanent Token):</strong>
                <br />
                <span className="text-ink-soft font-normal">
                  سيرفر المتجر مبرمج تلقائياً لتبادل أي توكن تدخله مع Meta OAuth API فور حفظه، وتحويله إلى توكن دائم لا تنتهي صلاحيته مدى الحياة (Expires At: 0)، فلا تقلق بشأن تجديده إطلاقاً!
                </span>
              </li>
              <li>
                <strong className="text-emerald-700 dark:text-emerald-300">إيقاف الردود القديمة في Meta Business Suite:</strong>
                <br />
                <span className="text-ink-soft font-normal">
                  إذا كانت الصفحة بها ردود آلية قديمة خاصة بمشاريع أخرى، ادخل إلى Meta Business Suite ⬅️ Inbox ⬅️ Automations، وقُم بإيقاف خيار (Instant Reply / FAQ) حتى لا يتداخل مع ذكاء المتجر الاصطناعي ويجيب متجرك وحده بدقة!
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-paper border-t border-line flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-ink-soft flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            باتباع هذه الخطوات يكتمل الربط بنسبة 100% للنشر وجدولة البوستات والرد الذكي بالـ AI.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-btn bg-primary text-[var(--color-primary-contrast,#ffffff)] font-black text-xs shadow-md hover:bg-primary/90"
          >
            إغلاق الدليل
          </button>
        </div>
      </div>
    </div>
  );
}
