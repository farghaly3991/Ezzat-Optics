const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const adminDataSchema = new mongoose.Schema(
  {
    admin: { type: Number, default: 1 },
    siteName: { type: String, default: "المتجر العصري" },
    siteDescription: { type: String, default: "أفضل وأحدث المنتجات والعروض الحصرية" },
    logo: { type: String, default: "" },
    phone: { type: String, default: "01000000000" },
    whatsapp: { type: String, default: "01000000000" },
    email: { type: String, default: "store@example.com" },
    address: { type: String, default: "القاهرة، مصر" },
    cashNumber: { type: String, default: "01000000000" },
    currency: { type: String, default: "EGP" },
    shippingCost: { type: Number, default: 50 },
    freeShippingOver: { type: Number, default: 1000 },

    // بوابات الدفع
    paymob: {
      apiKey: { type: String, default: "" },
      hmacSecret: { type: String, default: "" },
      cardIntegrationId: { type: String, default: "" },
      walletIntegrationId: { type: String, default: "" },
      kioskIntegrationId: { type: String, default: "" },
      cardIframeId: { type: String, default: "" }
    },

    // إعدادات الذكاء الاصطناعي (الموديل الأساسي: مثل DeepSeek + الموديل الاحتياطي الافتراضي: Gemini)
    aiEnabled: { type: Boolean, default: true },
    AI_API_KEY: { type: String, default: () => process.env.AI_API_KEY || "" },
    aiApiKey: { type: String, default: () => process.env.AI_API_KEY || "" },
    AI_BASE_URL: { type: String, default: () => process.env.AI_BASE_URL || "https://api.deepseek.com" },
    AI_MODEL: { type: String, default: () => process.env.AI_MODEL || "deepseek-chat" },
    GEMINI_API_KEY: { type: String, default: () => process.env.GEMINI_API_KEY || "" },
    GEMINI_FALLBACK_MODEL: { type: String, default: () => process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash" },

    // إعدادات الذكاء الاصطناعي للصور (الموديل الثاني: تحسين الصور وتوليد الزوايا مثل GPT Image / DALL-E)
    imageAiEnabled: { type: Boolean, default: true },
    IMAGE_AI_API_KEY: { type: String, default: "" },
    IMAGE_AI_BASE_URL: { type: String, default: "https://api.openai.com/v1" },
    IMAGE_AI_MODEL: { type: String, default: "gpt-image-1" },

    // إعدادات ربط صفحة الفيسبوك (Meta Graph API Integration)
    facebookEnabled: { type: Boolean, default: true },
    FB_PAGE_ID: { type: String, default: "" },
    FB_PAGE_ACCESS_TOKEN: { type: String, default: "" },
    FB_APP_ID: { type: String, default: "" },
    FB_APP_SECRET: { type: String, default: "" },

    // إعدادات الرفع والخلفية
    AWS_API_KEY_ID: { type: String, default: "" },
    AWS_API_KEY_SECRET: { type: String, default: "" },
    backgroundImage: { type: String, default: "" },

    // توكنز التصميم والهوية المخصصة للمستأجر
    customTheme: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        primaryColor: "#2563eb",
        secondaryColor: "#0f172a",
        highlightColor: "#f59e0b",
        accentColor: "#10b981",
        cardArchetype: "glassmorphic-modern",
        fontFamily: "Cairo",
        globalBg: {
          bgType: "gradient",
          bgColor: "#f8fafc",
          gradient: {
            colorStart: "#f8fafc",
            colorEnd: "#eff6ff",
            angle: 135
          }
        },
        cardContainer: {
          bgColor: "rgba(255, 255, 255, 0.9)",
          backdropBlur: "md",
          borderRadius: "1.25rem",
          shadow: "lg",
          borderStyle: "solid",
          borderColor: "rgba(226, 232, 240, 0.8)"
        },
        buttons: {
          borderRadius: "0.75rem",
          primaryShadow: "md"
        },
        animations: {
          cardHover: "lift",
          pulse: true
        }
      }
    },

    // إعدادات النظام المالي ومستويات القدرات (Finance Foundation & Phases A–F)
    financeSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // صيغة وقالب العقد القانوني للتقسيط المباشر مع المتجر
    installmentContractTemplate: {
      type: String,
      default: ""
    },

    // نمط النظام ووحدات الميزات (Industry Profile & Feature Flags)
    systemProfile: {
      type: String,
      enum: ["optics", "retail", "custom"],
      default: "optics"
    },
    // صلاحية حسابات العملاء الخارجية على المتجر
    allowCustomerStoreAccounts: { type: Boolean, default: false },

    // تفعيل كشوفات النظر ومقاسات الانكسار الطبية
    enableOpticsPrescriptions: { type: Boolean, default: true },

    overviewSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        salesRateOverTime: true,
        netProfitOverTime: true,
        installmentsRate: true,
        returnsRate: true,
        workOrdersAwaitingDelivery: true,
        pendingSuppliesAlerts: true,
        stockProposals: true,
        outOfStockCritical: true,
        operationalAlerts: true
      }
    },

    enabledModules: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        pos: true,
        orders: true,
        maintenance: true,
        customers: true,
        products: true,
        lensMatrix: true,
        desiredProducts: true,
        finance: true,
        analytics: true,
        attendance: true,
        procurement: true,
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
        aiInstructions: true
      }
    },

    // مرادفات وكلمات البحث الدلالية المخصصة للمتجر (Optional Per-Tenant Search Synonyms)
    searchSynonyms: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    },

    // مسميات التبويبات والقوائم المخصصة للنشاط (Navigation White-Labeling - Role 6)
    navigationLabels: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        pos: "نقطة البيع",
        orders: "الطلبات",
        customers: "العملاء",
        products: "المنتجات",
        categories: "الأقسام والتصنيفات",
        labs: "الورش والمعامل",
        attendance: "تحضير الموظفين",
        procurement: "التوريدات والموردين",
        finance: "المالية والمشتريات",
        installments: "الأقساط والتحصيل",
        returns: "المرتجعات والضمان",
        coupons: "كوبونات الخصم",
        offers: "العروض الترويجية",
        carts: "السلات المتروكة",
        facebook: "استوديو الفيسبوك",
        aiInstructions: "تعليمات المساعد الذكي (AI)",
        desiredProducts: "قوائم الانتظار ونواقص الطلب",
        theme: "ثيم وألوان المتجر",
        auditLogs: "سجل الرقابة والعمليات",
        analytics: "التقارير والإحصائيات",
        branches: "الفروع والمخازن",
        settings: "الإعدادات"
      }
    },

    // منشئ بروفايل وسجلات العميل المخصصة (Dynamic Client Profile Configuration - Role 6)
    clientProfileConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        enabled: true,
        profileTitle: "كشف النظر والقياسات البصرية",
        actionButtonLabel: "فحص كشف النظر",
        dateFieldLabel: "تاريخ الكشف / الفحص",
        fields: [
          {
            key: "doctorName",
            label: "اسم الطبيب / الأخصائي الفاحص",
            type: "text",
            defaultValue: "",
            required: false
          },
          {
            key: "usageType",
            label: "نوع الاستخدام الموصى به",
            type: "select",
            options: [
              "مسافة (Distance)",
              "قراءة قريب (Reading)",
              "كمبيوتر وشاشات (Computer)",
              "استخدام دائم (Permanent)",
              "نظارة شمسية طبية (Prescription Sunglasses)"
            ],
            defaultValue: "استخدام دائم (Permanent)",
            required: false
          },
          {
            key: "ipd",
            label: "المسافة الكلية بين البؤبؤين (IPD)",
            type: "number",
            defaultValue: "",
            required: false
          }
        ],
        enableMatrix: true,
        matrixConfig: {
          title: "جدول قياسات العين والعدسات (Refraction Matrix)",
          rows: [
            { key: "OD", label: "العين اليمنى (OD)" },
            { key: "OS", label: "العين اليسرى (OS)" }
          ],
          columns: [
            { key: "sph", label: "SPH (كروي)" },
            { key: "cyl", label: "CYL (اسطواني)" },
            { key: "axis", label: "AXIS (المحور)" },
            { key: "add", label: "ADD (إضافة القراءة)" },
            { key: "pd", label: "PD (المسافة)" }
          ]
        },
        enableAttachments: true,
        attachmentsLabel: "مرفقات وصور كشف النظر والروشتة"
      }
    },

    // إعدادات تنبيهات وتغيرات سلات التسوق والإشعارات المستقلة
    cartNotifications: {
      enabled: { type: Boolean, default: true },
      channel: {
        type: String,
        enum: ["disabled", "in_app", "web_push", "both"],
        default: "in_app"
      },
      notifyOnPriceDrop: { type: Boolean, default: true },
      notifyOnPriceIncrease: { type: Boolean, default: false },
      notifyOnOutOfStock: { type: Boolean, default: true },
      notifyOnCriticalStock: { type: Boolean, default: true },
      autoUpdateCartOnOutOfStock: { type: Boolean, default: false },
      vapidPublicKey: { type: String, default: "" },
      vapidPrivateKey: { type: String, default: "" },
      vapidSubject: { type: String, default: "mailto:support@almister.com" },
      fcmServerKey: { type: String, default: "" }
    },

    // نمط واجهة العرض للمنتجات (Storefront Mode: internal_catalog vs online_ecommerce)
    storefrontMode: {
      type: String,
      enum: ["internal_catalog", "online_ecommerce"],
      default: "internal_catalog"
    }
  },
  { timestamps: true, strict: false }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.adminData || connection.model("adminData", adminDataSchema);
};

