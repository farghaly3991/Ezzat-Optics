const getAdminDataModel = require("./adminDataModel");
const { checkAiAvailable, checkImageAiAvailable, checkFacebookAvailable } = require("../../core/middleware/aiDispatcher");
const {
  resolveEffectiveFinanceSettings,
  updateFinanceSettings
} = require("../finance/core/settings/financeSettingsService");
const { callDeepSeek, callGemini } = require("../intake-engine");

const DEFAULT_OVERVIEW_SETTINGS = {
  salesRateOverTime: true,
  netProfitOverTime: true,
  installmentsRate: true,
  returnsRate: true,
  workOrdersAwaitingDelivery: true,
  pendingSuppliesAlerts: true,
  stockProposals: true,
  outOfStockCritical: true,
  operationalAlerts: true,

  // Advanced Visual Charts & Telemetry
  chartRevenueProfitTrend: true,
  chartSalesByCategory: true,
  chartInstallmentCompliance: true,
  chartReturnsAndScrap: true,
  chartLabFulfillment: true,

  // E-Commerce Funnel & Cart Conversion Rates
  funnelViewToCart: false,
  funnelCartToOrder: false,
  funnelOrderToCompleted: true,
  abandonedCartRate: false
};

function getBuiltinPresetForBusinessType(typeStr = "", customPrompt = "") {
  const t = (typeStr + " " + customPrompt).toLowerCase().trim();

  // 1. Optics / النظارات والبصريات
  if (t.includes("نظار") || t.includes("بصر") || t.includes("optics") || t.includes("عدسات") || t.includes("شنابر")) {
    return {
      systemProfile: "optics",
      storefrontMode: "internal_catalog",
      productsTabLabel: "الشنابر والعدسات",
      enabledModules: {
        pos: true,
        orders: true,
        labs: true,
        customers: true,
        products: true,
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
      },
      overviewSettings: {
        salesRateOverTime: true,
        netProfitOverTime: true,
        installmentsRate: true,
        returnsRate: true,
        workOrdersAwaitingDelivery: true,
        pendingSuppliesAlerts: true,
        stockProposals: true,
        outOfStockCritical: true,
        operationalAlerts: true,
        chartRevenueProfitTrend: true,
        chartSalesByCategory: true,
        chartInstallmentCompliance: true,
        chartReturnsAndScrap: true,
        chartLabFulfillment: true,
        funnelViewToCart: false,
        funnelCartToOrder: false,
        funnelOrderToCompleted: true,
        abandonedCartRate: false
      },
      navigationLabels: {
        pos: "نقطة البيع (POS)",
        orders: "الطلبات والمعمل",
        customers: "العملاء وكشوف النظر",
        products: "الشنابر والعدسات",
        categories: "الأقسام والتصنيفات",
        labs: "الورش والمعامل",
        finance: "الخزينة والمالية",
        analytics: "المؤشرات الرئيسية",
        branches: "الفروع والموظفين",
        settings: "إعدادات النظام والنشاط"
      },
      clientProfileConfig: {
        enabled: true,
        profileTitle: "كشف النظر والقياسات البصرية",
        actionButtonLabel: "فحص كشف النظر",
        dateFieldLabel: "تاريخ الكشف / الفحص",
        fields: [
          { key: "doctorName", label: "اسم الطبيب / الأخصائي الفاحص", type: "text", options: [], defaultValue: "", required: false },
          { key: "usageType", label: "نوع الاستخدام الموصى به", type: "select", options: ["مسافة (Distance)", "قراءة قريب (Reading)", "كمبيوتر وشاشات (Computer)", "استخدام دائم (Permanent)", "نظارة شمسية طبية"], defaultValue: "استخدام دائم (Permanent)", required: false },
          { key: "ipd", label: "المسافة الكلية بين البؤبؤين (IPD)", type: "number", options: [], defaultValue: "", required: false }
        ],
        enableMatrix: true,
        matrixConfig: {
          title: "جدول قياسات العين والعدسات (Refraction Matrix)",
          rows: [
            { key: "OD", label: "العين اليمنى (OD)" },
            { key: "OS", label: "العين اليسرى (OS)" }
          ],
          columns: [
            { key: "sph", label: "SPH (الكرة)", type: "text" },
            { key: "cyl", label: "CYL (السلندر)", type: "text" },
            { key: "axis", label: "AXIS (المحور)", type: "text" },
            { key: "add", label: "ADD (إضافة القراءة)", type: "text" },
            { key: "pd", label: "PD (انحراف الحدقة)", type: "text" }
          ]
        },
        enableAttachments: true,
        attachmentsLabel: "مرفقات وصور كشف النظر والروشتة"
      },
      explanation: "تم تكوين النظام بنمط 'مركز بصريات ونظارات متكامل': تم تفعيل أوامر الورش والمعامل الخارجية، وورشة صيانة الشنابر، وأقساط النظارات، وسجلات قياسات الانكسار OD/OS، وتوريدات النواقص الحساسة. كما تم إخفاء السلات المتروكة والكوبونات التسويقية لتجنب التشتت والتركيز على إدارة المتجر العيني وخدمة المرضى."
    };
  }

  // 2. Pharmacy / صيدلية
  if (t.includes("صيدل") || t.includes("دواء") || t.includes("pharmacy")) {
    return {
      systemProfile: "custom",
      storefrontMode: "internal_catalog",
      productsTabLabel: "الأدوية والمستلزمات الطبية",
      enabledModules: {
        pos: true,
        orders: true,
        labs: false,
        customers: true,
        products: true,
        maintenance: false,
        finance: true,
        categories: true,
        desiredProducts: true,
        installments: false,
        returns: true,
        coupons: false,
        offers: true,
        carts: false,
        facebook: false,
        theme: false,
        branches: true,
        auditLogs: true,
        settings: true
      },
      overviewSettings: {
        salesRateOverTime: true,
        netProfitOverTime: true,
        installmentsRate: false,
        returnsRate: true,
        workOrdersAwaitingDelivery: false,
        pendingSuppliesAlerts: true,
        stockProposals: true,
        outOfStockCritical: true,
        operationalAlerts: true,
        chartRevenueProfitTrend: true,
        chartSalesByCategory: true,
        chartInstallmentCompliance: false,
        chartReturnsAndScrap: true,
        chartLabFulfillment: false,
        funnelViewToCart: false,
        funnelCartToOrder: false,
        funnelOrderToCompleted: true,
        abandonedCartRate: false
      },
      navigationLabels: {
        pos: "كاشير الصيدلية",
        orders: "فواتير الأدوية",
        customers: "سجل المرضى والعملاء",
        products: "الأدوية والمستلزمات",
        categories: "المجموعات العلاجية",
        labs: "معامل التحضير",
        finance: "الخزينة والموردين",
        analytics: "المؤشرات وحركة الدواء",
        branches: "الفروع والصيادلة",
        settings: "إعدادات الصيدلية"
      },
      clientProfileConfig: {
        enabled: true,
        profileTitle: "الملف الطبي والأمراض المزمنة",
        actionButtonLabel: "تحديث التاريخ الدوائي",
        dateFieldLabel: "تاريخ الزيارة",
        fields: [
          { key: "allergies", label: "الحساسية الدوائية (Drug Allergies)", type: "text", options: [], defaultValue: "", required: false },
          { key: "chronicDiseases", label: "الأمراض المزمنة (ضغط/سكر/قلب)", type: "text", options: [], defaultValue: "", required: false },
          { key: "doctorName", label: "اسم الطبيب المعالج", type: "text", options: [], defaultValue: "", required: false }
        ],
        enableMatrix: false,
        enableAttachments: true,
        attachmentsLabel: "صورة الروشتة أو التحاليل"
      },
      explanation: "تم تكوين النظام بنمط 'صيدلية': تم التركيز على نواقص الأدوية والتواريخ الحرجة وسجل المرضى والروشتات، مع تعطيل معامل البصريات والورش."
    };
  }

  // 3. Clothing / متجر ملابس وأزياء
  if (t.includes("ملابس") || t.includes("أزياء") || t.includes("fashion") || t.includes("احذية") || t.includes("أحذية")) {
    return {
      systemProfile: "retail",
      storefrontMode: "online_ecommerce",
      productsTabLabel: "الملابس والمنتجات",
      enabledModules: {
        pos: true,
        orders: true,
        labs: false,
        customers: true,
        products: true,
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
      },
      overviewSettings: {
        salesRateOverTime: true,
        netProfitOverTime: true,
        installmentsRate: false,
        returnsRate: true,
        workOrdersAwaitingDelivery: false,
        pendingSuppliesAlerts: true,
        stockProposals: true,
        outOfStockCritical: true,
        operationalAlerts: true,
        chartRevenueProfitTrend: true,
        chartSalesByCategory: true,
        chartInstallmentCompliance: false,
        chartReturnsAndScrap: true,
        chartLabFulfillment: false,
        funnelViewToCart: false,
        funnelCartToOrder: false,
        funnelOrderToCompleted: true,
        abandonedCartRate: false
      },
      navigationLabels: {
        pos: "نقطة البيع (POS)",
        orders: "الطلبات والمبيعات",
        customers: "قاعدة العملاء",
        products: "الملابس والأحذية",
        categories: "الأقسام والمقاسات",
        labs: "التفصيل والتعديل",
        finance: "الخزينة والمالية",
        analytics: "المؤشرات والتقارير",
        branches: "الفروع والموظفين",
        settings: "إعدادات المتجر"
      },
      clientProfileConfig: {
        enabled: true,
        profileTitle: "مقاسات وتفضيلات العميل",
        actionButtonLabel: "تسجيل المقاسات",
        dateFieldLabel: "تاريخ القياس",
        fields: [
          { key: "size", label: "المقاس المفضل (S/M/L/XL)", type: "select", options: ["XS", "S", "M", "L", "XL", "2XL", "3XL"], defaultValue: "L", required: false },
          { key: "fitPreference", label: "نمط القَصّة المفضلة", type: "select", options: ["Slim Fit", "Regular Fit", "Oversized"], defaultValue: "Regular Fit", required: false }
        ],
        enableMatrix: false,
        enableAttachments: false
      },
      explanation: "تم تكوين النظام بنمط 'متجر أزياء وملابس': تم تفعيل الكوبونات والعروض والسلات المتروكة ونشر الفيسبوك، مع إدارة المقاسات والمرتجعات."
    };
  }

  // 4. Electronics / Maintenance / ورشة ومركز صيانة
  if (t.includes("صيان") || t.includes("إلكترون") || t.includes("موبايل") || t.includes("كمبيوتر") || t.includes("workshop")) {
    return {
      systemProfile: "custom",
      storefrontMode: "internal_catalog",
      productsTabLabel: "قطع الغيار والأجهزة",
      enabledModules: {
        pos: true,
        orders: true,
        labs: false,
        customers: true,
        products: true,
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
      },
      overviewSettings: {
        salesRateOverTime: true,
        netProfitOverTime: true,
        installmentsRate: true,
        returnsRate: true,
        workOrdersAwaitingDelivery: true,
        pendingSuppliesAlerts: true,
        stockProposals: true,
        outOfStockCritical: true,
        operationalAlerts: true,
        chartRevenueProfitTrend: true,
        chartSalesByCategory: true,
        chartInstallmentCompliance: true,
        chartReturnsAndScrap: true,
        chartLabFulfillment: true,
        funnelViewToCart: false,
        funnelCartToOrder: false,
        funnelOrderToCompleted: true,
        abandonedCartRate: false
      },
      navigationLabels: {
        pos: "نقطة البيع والصيانة",
        orders: "تذاكر الصيانة والفواتير",
        customers: "العملاء والأجهزة",
        products: "قطع الغيار والأجهزة",
        categories: "أقسام الصيانة والقطع",
        labs: "الورش الخارجية",
        finance: "الخزينة والمالية",
        analytics: "المؤشرات والأداء",
        branches: "الفروع والفنيين",
        settings: "إعدادات المركز"
      },
      clientProfileConfig: {
        enabled: true,
        profileTitle: "سجل أجهزة العميل والضمان",
        actionButtonLabel: "إضافة جهاز",
        dateFieldLabel: "تاريخ استلام الجهاز",
        fields: [
          { key: "deviceModel", label: "نوع وموديل الجهاز", type: "text", options: [], defaultValue: "", required: true },
          { key: "imeiOrSerial", label: "الرقم التسلسلي / IMEI", type: "text", options: [], defaultValue: "", required: false },
          { key: "issueDescription", label: "وصف العطل المطلوب صيانته", type: "text", options: [], defaultValue: "", required: true }
        ],
        enableMatrix: false,
        enableAttachments: true,
        attachmentsLabel: "صور حالة الجهاز قبل الفك والصيانة"
      },
      explanation: "تم تكوين النظام بنمط 'مركز صيانة وقطع غيار': تم تفعيل كروت الصيانة الفنية، والقطع الناقصة، والأقساط، مع تسجيل أرقام الأجهزة المسلسلة."
    };
  }

  // 5. Default General Retail / تجزئة عامة
  return {
    systemProfile: "retail",
    productsTabLabel: "إدارة المنتجات والمخزون",
    enabledModules: {
      pos: true,
      orders: true,
      labs: false,
      customers: true,
      products: true,
      maintenance: false,
      finance: true,
      categories: true,
      desiredProducts: true,
      installments: true,
      returns: true,
      coupons: true,
      offers: true,
      carts: false,
      facebook: false,
      theme: false,
      branches: true,
      auditLogs: true,
      settings: true
    },
    overviewSettings: {
      salesRateOverTime: true,
      netProfitOverTime: true,
      installmentsRate: true,
      returnsRate: true,
      workOrdersAwaitingDelivery: true,
      pendingSuppliesAlerts: true,
      stockProposals: true,
      outOfStockCritical: true,
      operationalAlerts: true,
      chartRevenueProfitTrend: true,
      chartSalesByCategory: true,
      chartInstallmentCompliance: true,
      chartReturnsAndScrap: true,
      chartLabFulfillment: false,
      funnelViewToCart: true,
      funnelCartToOrder: true,
      funnelOrderToCompleted: true,
      abandonedCartRate: true
    },
    navigationLabels: {
      pos: "نقطة البيع (POS)",
      orders: "الطلبات والمبيعات",
      customers: "العملاء",
      products: "إدارة المنتجات والمخزون",
      categories: "الأقسام والتصنيفات",
      labs: "الورش والمعامل",
      finance: "الخزينة والمالية",
      analytics: "الرئيسية والمؤشرات",
      branches: "الفروع والموظفين",
      settings: "إعدادات النظام والنشاط"
    },
    clientProfileConfig: {
      enabled: false
    },
    explanation: "تم تطبيق التكوين المتوازن للتجزئة العامة، مع تفعيل أدوات البيع المباشر والمخازن والأقساط والمرتجعات."
  };
}

exports.getPublicConfig = async (req, res, next) => {
  try {
    const AdminData = getAdminDataModel(req.subdomain);
    let data = await AdminData.findOne().lean();

    if (!data) {
      data = await new AdminData().save();
      data = data.toObject();
    }

    const isAi = checkAiAvailable({ adminData: data });
    const isImageAi = checkImageAiAvailable({ adminData: data });
    const isFb = checkFacebookAvailable({ adminData: data });
    const finance = resolveEffectiveFinanceSettings(data.financeSettings || {}, data.currency || "EGP");

    // تصفية المفاتيح السرية قبل إرسالها للعامة
    res.json({
      done: true,
      config: {
        siteName: data.siteName,
        siteDescription: data.siteDescription,
        logo: data.logo,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        address: data.address,
        currency: data.currency,
        shippingCost: data.shippingCost,
        freeShippingOver: data.freeShippingOver,
        customTheme: data.customTheme,
        backgroundImage: data.backgroundImage,
        isAiAvailable: isAi,
        aiEnabled: data.aiEnabled !== false,
        isImageAiAvailable: isImageAi,
        imageAiEnabled: data.imageAiEnabled !== false,
        imageAiModel: data.IMAGE_AI_MODEL || process.env.IMAGE_AI_MODEL || "",
        isFacebookAvailable: isFb,
        facebookEnabled: data.facebookEnabled !== false,
        fbPageId: data.FB_PAGE_ID || process.env.FB_PAGE_ID || "",
        systemProfile: data.systemProfile || "optics",
        storefrontMode: data.storefrontMode || "internal_catalog",
        productsTabLabel: data.productsTabLabel || "الشنابر والعدسات",
        allowCustomerStoreAccounts: data.allowCustomerStoreAccounts === true,
        enableOpticsPrescriptions: data.enableOpticsPrescriptions !== false,
        overviewSettings: data.overviewSettings || DEFAULT_OVERVIEW_SETTINGS,
        navigationLabels: data.navigationLabels || {
          pos: "نقطة البيع (POS)",
          orders: "الطلبات والمعمل",
          customers: "العملاء وكشوف النظر",
          products: "الشنابر والعدسات",
          categories: "الأقسام والتصنيفات",
          labs: "الورش والمعامل",
          attendance: "تحضير الموظفين السريع",
          procurement: "التوريدات والموردين",
          finance: "الخزينة والمالية",
          analytics: "المؤشرات الرئيسية",
          aiInstructions: "تعليمات المساعد الذكي (AI)",
          desiredProducts: "قوائم الانتظار ونواقص الطلب",
          branches: "الفروع والموظفين",
          settings: "إعدادات النظام والنشاط"
        },
        clientProfileConfig: data.clientProfileConfig,
        enabledModules: data.enabledModules || {
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
        },
        finance: {
          pickup: finance.pickup,
          shippingConfig: finance.shippingConfig
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdminSettings = async (req, res, next) => {
  try {
    const AdminData = getAdminDataModel(req.subdomain);
    let data = await AdminData.findOne().lean();
    if (!data) {
      data = await new AdminData().save();
      data = data.toObject();
    }
    data.financeSettings = resolveEffectiveFinanceSettings(data.financeSettings || {}, data.currency || "EGP");
    const isAi = checkAiAvailable({ adminData: data });
    const isImageAi = checkImageAiAvailable({ adminData: data });
    const isFb = checkFacebookAvailable({ adminData: data });
    res.json({
      done: true,
      settings: data,
      isAiAvailable: isAi,
      isImageAiAvailable: isImageAi,
      isFacebookAvailable: isFb
    });
  } catch (err) {
    next(err);
  }
};

exports.updateAdminSettings = async (req, res, next) => {
  try {
    const AdminData = getAdminDataModel(req.subdomain);
    const body = { ...(req.body || {}) };
    const incomingFinanceSettings = body.financeSettings;
    delete body.financeSettings;

    let data = await AdminData.findOne();
    if (!data) {
      data = new AdminData();
    }

    Object.assign(data, body);
    await data.save();

    if (incomingFinanceSettings && typeof incomingFinanceSettings === "object") {
      await updateFinanceSettings(req.subdomain, incomingFinanceSettings, req.user);
      data = await AdminData.findOne();
    }

    const plainData = data.toObject ? data.toObject() : data;
    plainData.financeSettings = resolveEffectiveFinanceSettings(
      plainData.financeSettings || {},
      plainData.currency || "EGP"
    );

    const isAi = checkAiAvailable({ adminData: plainData });
    const isImageAi = checkImageAiAvailable({ adminData: plainData });
    const isFb = checkFacebookAvailable({ adminData: plainData });

    res.json({
      done: true,
      settings: plainData,
      isAiAvailable: isAi,
      isImageAiAvailable: isImageAi,
      isFacebookAvailable: isFb,
      message: "تم حفظ إعدادات المتجر والمظهر بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

const { syncStoreCategorySchema } = require("../../core/ai/schemaExtractor");

exports.syncAiSchema = async (req, res, next) => {
  try {
    const synced = await syncStoreCategorySchema(req.subdomain);
    res.json({
      done: true,
      message: `تمت مزامنة ${synced.categoriesCount} قسماً و ${synced.totalProducts} منتجاً بنجاح لقاعدة معرفة الذكاء الاصطناعي!`,
      data: {
        categoriesCount: synced.categoriesCount,
        activeCategoriesCount: synced.activeCategoriesCount,
        totalProducts: synced.totalProducts,
        lastSyncedAt: synced.lastSyncedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.aiConfigureSettings = async (req, res, next) => {
  try {
    const { businessType = "محل نظارات وبصريات طبية", customPrompt = "", applyDirectly = true } = req.body || {};
    const AdminData = getAdminDataModel(req.subdomain);
    let adminDoc = await AdminData.findOne();
    if (!adminDoc) {
      adminDoc = new AdminData();
    }
    const adminData = adminDoc.toObject ? adminDoc.toObject() : adminDoc;

    let resultConfig = null;
    const isAi = checkAiAvailable({ adminData });

    if (isAi) {
      const systemPrompt = `أنت خبير واستشاري أنظمة إدارة المتاجر والمؤسسات (Enterprise ERP & Retail Architecture Specialist).
مهمتك: استقبال نوع النشاط التجاري المحدد والتعليمات المخصصة، واقتراح التكوين المثالي للنظام والموديولات البرمجية ولوحة المؤشرات وبروفايل العميل بما يخدم طبيعة النشاط دون تشتيت.

يجب الرد بصيغة JSON فقط بهذه البنية:
{
  "systemProfile": "optics" | "retail" | "custom",
  "productsTabLabel": "اسم التبويب",
  "enabledModules": {
    "pos": boolean,
    "orders": boolean,
    "labs": boolean,
    "customers": boolean,
    "products": boolean,
    "maintenance": boolean,
    "finance": boolean,
    "categories": boolean,
    "desiredProducts": boolean,
    "installments": boolean,
    "returns": boolean,
    "coupons": boolean,
    "offers": boolean,
    "carts": boolean,
    "facebook": boolean,
    "theme": boolean,
    "branches": boolean,
    "auditLogs": boolean,
    "settings": boolean
  },
  "overviewSettings": {
    "salesRateOverTime": boolean,
    "netProfitOverTime": boolean,
    "installmentsRate": boolean,
    "returnsRate": boolean,
    "workOrdersAwaitingDelivery": boolean,
    "pendingSuppliesAlerts": boolean,
    "stockProposals": boolean,
    "outOfStockCritical": boolean,
    "operationalAlerts": boolean,
    "chartRevenueProfitTrend": boolean,
    "chartSalesByCategory": boolean,
    "chartInstallmentCompliance": boolean,
    "chartReturnsAndScrap": boolean,
    "chartLabFulfillment": boolean,
    "funnelViewToCart": boolean,
    "funnelCartToOrder": boolean,
    "funnelOrderToCompleted": boolean,
    "abandonedCartRate": boolean
  },
  "navigationLabels": {
    "pos": "string",
    "orders": "string",
    "customers": "string",
    "products": "string",
    "categories": "string",
    "labs": "string",
    "finance": "string",
    "analytics": "string",
    "branches": "string",
    "settings": "string"
  },
  "clientProfileConfig": {
    "enabled": boolean,
    "profileTitle": "string",
    "actionButtonLabel": "string",
    "dateFieldLabel": "string",
    "fields": [
      { "key": "string", "label": "string", "type": "text"|"number"|"select", "options": ["..."], "defaultValue": "string", "required": boolean }
    ],
    "enableMatrix": boolean,
    "matrixConfig": {
      "title": "string",
      "rows": [{ "key": "string", "label": "string" }],
      "columns": [{ "key": "string", "label": "string" }]
    },
    "enableAttachments": boolean,
    "attachmentsLabel": "string"
  },
  "explanation": "شرح باللغة العربية يوضح باختصار أسباب هذا التكوين وكيف يخدم طبيعة النشاط التجاري"
}`;

      const userPrompt = `نوع النشاط التجاري: "${businessType}"\nتعليمات إضافية: "${customPrompt || "قم بضبط وتفعيل النظام بأفضل صورة ملائمة لنشاط هذا المحل أو المؤسسة"}"`;

      try {
        resultConfig = await callDeepSeek(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          adminData,
          0.3
        );
      } catch (dErr) {
        try {
          resultConfig = await callGemini(systemPrompt, userPrompt, adminData);
        } catch (gErr) {
          console.warn("[AI_CONFIGURE_FALLBACK]", gErr.message);
        }
      }
    }

    if (!resultConfig || !resultConfig.enabledModules) {
      resultConfig = getBuiltinPresetForBusinessType(businessType, customPrompt);
    }

    // Ensure overviewSettings exists and defaults
    resultConfig.overviewSettings = {
      ...DEFAULT_OVERVIEW_SETTINGS,
      ...(resultConfig.overviewSettings || {})
    };

    // If applyDirectly is true, update the adminData in MongoDB
    if (applyDirectly) {
      if (resultConfig.systemProfile) adminDoc.systemProfile = resultConfig.systemProfile;
      if (resultConfig.productsTabLabel) adminDoc.productsTabLabel = resultConfig.productsTabLabel;
      if (resultConfig.enabledModules) adminDoc.enabledModules = { ...(adminDoc.enabledModules || {}), ...resultConfig.enabledModules };
      if (resultConfig.overviewSettings) adminDoc.overviewSettings = { ...(adminDoc.overviewSettings || {}), ...resultConfig.overviewSettings };
      if (resultConfig.navigationLabels) adminDoc.navigationLabels = { ...(adminDoc.navigationLabels || {}), ...resultConfig.navigationLabels };
      if (resultConfig.clientProfileConfig) adminDoc.clientProfileConfig = { ...(adminDoc.clientProfileConfig || {}), ...resultConfig.clientProfileConfig };

      await adminDoc.save();
    }

    res.json({
      done: true,
      applied: Boolean(applyDirectly),
      businessType,
      config: resultConfig,
      explanation: resultConfig.explanation || "تم ضبط النظام بنجاح بما يلائم نشاطك التجاري.",
      message: applyDirectly
        ? "تمت تهيئة وتطبيق إعدادات النظام والموديولات بنجاح وفق نوع النشاط! ✨"
        : "تم تحليل النشاط واقتراح التكوين المثالي بنجاح."
    });
  } catch (err) {
    next(err);
  }
};

