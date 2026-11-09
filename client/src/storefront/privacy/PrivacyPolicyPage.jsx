import React from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  UserCheck,
  Trash2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Globe,
  Share2
} from 'lucide-react';
import { useStore } from '../../shared/context/StoreContext';

export default function PrivacyPolicyPage() {
  const { config } = useStore();

  const storeName = config?.siteName || 'المتجر العصري';
  const email = 'mohammad.farghaly1993@gmail.com';
  const phone = '01092338291';
  const address = config?.address || 'القاهرة، جمهورية مصر العربية';

  return (
    <div className="min-h-screen bg-paper text-ink py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Header Hero */}
        <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-black">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>وثيقة رسمية معتمدة لحماية البيانات والخصوصية</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              سياسة الخصوصية وحماية البيانات
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">
              نلتزم في <strong className="text-white">{storeName}</strong> بحماية خصوصيتك وأمان بياناتك الشخصية وفقاً لأعلى معايير الأمان الدولية وسياسات حماية البيانات المعتمدة لدى منصة Meta.
            </p>
            <div className="pt-2 text-[11px] text-slate-400 font-mono">
              تاريخ آخر تحديث: نوفمبر 2026
            </div>
          </div>

          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Content Cards */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed">
          {/* 1. Introduction */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-primary font-black text-base">
              <Lock className="w-5 h-5" />
              <h2>1. مقدمة ونطاق التطبيق (Introduction)</h2>
            </div>
            <p className="text-ink-soft">
              توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية البيانات الشخصية للزوار والعملاء عند استخدام موقع متجر <strong className="text-ink">{storeName}</strong>، أو عند التفاعل مع صفحاتنا الرسمية على منصات التواصل الاجتماعي (بما في ذلك Facebook وMessenger وتطبيقات Meta ذات الصلة).
            </p>
          </div>

          {/* 2. Information We Collect */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary font-black text-base">
              <Eye className="w-5 h-5" />
              <h2>2. البيانات التي نجمعها (Information We Collect)</h2>
            </div>
            <p className="text-ink-soft">
              نقوم بجمع البيانات الضرورية فقط لتقديم خدمة تسوق متميزة وتنفيذ طلبات الشراء وتوفير الدعم الفني:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <li className="p-3 rounded-xl bg-paper border border-line/70 space-y-1">
                <strong className="text-ink font-black flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  بيانات الحساب والطلبات
                </strong>
                <p className="text-[11px] text-ink-soft">
                  الاسم الكامل، رقم الهاتف، عنوان التوصيل، والبريد الإلكتروني لإتمام عمليات الشحن وإصدار الفواتير.
                </p>
              </li>

              <li className="p-3 rounded-xl bg-paper border border-line/70 space-y-1">
                <strong className="text-ink font-black flex items-center gap-1.5 text-xs">
                  <Share2 className="w-3.5 h-3.5 text-blue-500" />
                  بيانات تفاعلات منصات Meta
                </strong>
                <p className="text-[11px] text-ink-soft">
                  الاسم العام للمستخدم على فيسبوك، ومعرّف المستخدم (Scoped ID)، والرسائل والتعليقات الواردة على المنشورات للرد التلقائي عليها.
                </p>
              </li>

              <li className="p-3 rounded-xl bg-paper border border-line/70 space-y-1">
                <strong className="text-ink font-black flex items-center gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  بيانات استفسارات التقسيط
                </strong>
                <p className="text-[11px] text-ink-soft">
                  الرغبات الشرائية، وخطط التقسيط المختارة، وأرقام التواصل المتروكة طواعية للتواصل المباشر مع فريق المبيعات.
                </p>
              </li>

              <li className="p-3 rounded-xl bg-paper border border-line/70 space-y-1">
                <strong className="text-ink font-black flex items-center gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-purple-500" />
                  البيانات التقنية والجلسات
                </strong>
                <p className="text-[11px] text-ink-soft">
                  بيانات سلة المشتريات، وتفضيلات اللغة والمظهر، لضمان استقرار وسرعة تجربة التصفح.
                </p>
              </li>
            </ul>
          </div>

          {/* 3. How We Use Data & Meta Integration */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-primary font-black text-base">
              <UserCheck className="w-5 h-5" />
              <h2>3. كيف نستخدم بياناتك وتكامل فيسبوك (Usage & Meta Platform)</h2>
            </div>
            <p className="text-ink-soft">
              تُستخدم البيانات المجمعة للأغراض التشغيلية التالية حصراً:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-ink-soft font-medium pr-1">
              <li>معالجة وتنفيذ طلبات الشراء، وتأكيد عمليات الدفع والشحن حتى باب المنزل.</li>
              <li>الرد الآلي والفوري عبر الذكاء الاصطناعي (AI Shopping Assistant) على استفسارات الأسعار، المواصفات، وشروط التقسيط.</li>
              <li>إرسال تحديثات حالة الطلب وأرقام التتبع عبر رسائل الهاتف أو الماسنجر.</li>
              <li>تحسين جودة الخدمة ورضا العملاء والرد على الشكاوى والمقترحات.</li>
            </ol>
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-900 dark:text-blue-200 mt-2">
              🔒 <strong>تعهد الخصوصية:</strong> نحن لا نبيع، ولا نؤجر، ولا نتاجر ببياناتك الشخصية مع أي أطراف ثالثة لأغراض إعلانية غير مصرح بها.
            </div>
          </div>

          {/* 4. Data Deletion Instructions (Mandatory for Meta) */}
          <div className="p-6 rounded-2xl bg-surface border-2 border-primary/20 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-primary font-black text-base">
              <Trash2 className="w-5 h-5 text-rose-500" />
              <h2>4. تعليمات طلب حذف البيانات (User Data Deletion Instructions)</h2>
            </div>
            <p className="text-ink-soft">
              وفقاً لقواعد منصة Meta for Developers ولوائح حماية البيانات العامة، يحق لأي مستخدم أو عميل طلب حذف بياناته الشخصية المسجلة لدينا في أي وقت:
            </p>
            <div className="p-4 rounded-xl bg-paper border border-line space-y-2">
              <div className="font-black text-xs text-ink">خطوات تقديم طلب حذف البيانات:</div>
              <ol className="list-decimal list-inside space-y-1 text-ink-soft text-xs pr-1">
                <li>
                  أرسل رسالة بريد إلكتروني إلى مسؤول الخصوصية على: <a href={`mailto:${email}`} className="text-primary underline font-bold">{email}</a> مع عنوان <strong>"طلب حذف بيانات مستخدم"</strong>.
                </li>
                <li>
                  أو تواصل معنا هاتفياً أو عبر واتساب على الرقم الرسمي للمتجر: <strong className="text-ink font-mono">{phone}</strong>.
                </li>
                <li>
                  قم بذكر اسمك ورقم الهاتف أو رابط حسابك على فيسبوك الذي ترغب بحذف سجلاته.
                </li>
              </ol>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                ✓ سيتم فحص طلبك ومسح كافة السجلات والمحادثات المرتبطة بحسابك بشكل نهائي من خوادمنا خلال 48 ساعة من تاريخ الطلب مع إشعارك بالتأكيد.
              </div>
            </div>
          </div>

          {/* 5. Contact Information */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-primary font-black text-base">
              <Mail className="w-5 h-5" />
              <h2>5. التواصل مع مسؤول حماية البيانات (Contact Us)</h2>
            </div>
            <p className="text-ink-soft">
              إذا كان لديك أي سؤال أو استفسار حول سياسة الخصوصية أو ممارسات حماية البيانات في المتجر، يمكنك التواصل معنا عبر الوسائل الرسمية التالية:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-bold text-ink">
              <div className="p-3 rounded-xl bg-paper border border-line flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{email}</span>
              </div>
              <div className="p-3 rounded-xl bg-paper border border-line flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span className="font-mono">{phone}</span>
              </div>
              <div className="p-3 rounded-xl bg-paper border border-line flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
