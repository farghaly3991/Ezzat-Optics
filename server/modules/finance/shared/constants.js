/**
 * Finance Module — Shared Constants, Enums, and Egyptian Geographic Dictionary
 */

const FINANCE_CAPABILITY_LEVELS = {
  BASIC: "basic",
  ADVANCED: "advanced",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise"
};

const VALID_FINANCE_LEVELS = Object.values(FINANCE_CAPABILITY_LEVELS);

const FINANCE_PHASES = {
  PHASE_A: "A", // Shipping classes, MAX/ADD calculation, pickup, order/product cost snapshots
  PHASE_B: "B", // Supplier shipments, purchase obligations, payments, outstanding balances
  PHASE_C: "C", // Inventory, stock movements, purchases, valuation (Future)
  PHASE_D: "D", // Expenses, recurring expenses, manual/offline sales (Future)
  PHASE_E: "E", // Financial reporting & double-entry accounting (Future)
  PHASE_F: "F"  // Currency & exchange-rate management (Future)
};

const SHIPPING_CALCULATION_MODES = {
  MAX: "MAX",
  ADD: "ADD"
};

const VALID_SHIPPING_MODES = ["MAX", "ADD"];

const DELIVERY_METHODS = {
  DELIVERY: "delivery",
  PICKUP: "pickup"
};

const VALID_DELIVERY_METHODS = ["delivery", "pickup"];

const SUPPLIER_SHIPMENT_STATUSES = [
  "draft",
  "ordered",
  "in_transit",
  "partially_received",
  "received",
  "closed",
  "cancelled"
];

const PAYMENT_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "overpaid"
];

const PAYMENT_ENTRY_TYPES = [
  "payment",
  "correction",
  "reversal"
];

const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "check",
  "wallet",
  "card",
  "other"
];

/**
 * Deterministic Egyptian Governorates, Major Cities, Districts, and Bilingual Aliases
 * Used by the layered address-classification engine before any optional AI fallback.
 */
const EGYPT_GEOGRAPHY_DICTIONARY = [
  {
    key: "cairo",
    governorateAr: "القاهرة",
    governorateEn: "cairo",
    aliases: ["القاهره", "قاهرة", "محافظة القاهرة", "cairo governorate", "greater cairo"],
    citiesAndDistricts: [
      "مدينة نصر", "nasr city", "مصر الجديدة", "heliopolis", "المعادي", "maadi",
      "التجمع الخامس", "fifth settlement", "التجمع الأول", "التجمع الثالث", "القاهرة الجديدة", "new cairo",
      "الرحاب", "rehab", "مدينتي", "madinaty", "الشروق", "shorouk", "بدر", "badr city",
      "حلوان", "helwan", "شبرا", "shubra", "عين شمس", "ain shams", "المرج", "marg",
      "المطرية", "mataria", "الزمالك", "zamalek", "وسط البلد", "downtown", "العباسية", "abbasia",
      "حدائق القبة", "الزيتون", "المقطم", "mokattam", "المنيل", "manyal", "السيدة زينب", "الحسين", "النزهة"
    ]
  },
  {
    key: "giza",
    governorateAr: "الجيزة",
    governorateEn: "giza",
    aliases: ["الجيزه", "جيزة", "جيزه", "محافظة الجيزة", "giza governorate"],
    citiesAndDistricts: [
      "المهندسين", "mohandessin", "الدقي", "dokki", "العجوزة", "agouza", "الهرم", "haram",
      "فيصل", "faisal", "حدائق الأهرام", "hadayek el ahram", "6 أكتوبر", "6 اكتوبر", "السادس من أكتوبر",
      "6th of october", "october city", "الشيخ زايد", "sheikh zayed", "zayed", "امبابة", "إمبابة", "imbaba",
      "الوراق", "بولاق الدكرور", "البدرشين", "الحوامدية", "العياط", "الصف", "أوسيم", "كرداسة", "أبو النمرس"
    ]
  },
  {
    key: "alexandria",
    governorateAr: "الإسكندرية",
    governorateEn: "alexandria",
    aliases: ["الاسكندرية", "الاسكندريه", "إسكندرية", "اسكندريه", "اسكندرية", "alex", "محافظة الإسكندرية"],
    citiesAndDistricts: [
      "سموحة", "smouha", "سيدي جابر", "sidi بشر", "سيدي بشر", "sidi bishr", "المنتزه", "montaza",
      "ميامي", "miami", "العجمي", "agami", "برج العرب", "borg el arab", "محطة الرمل", "سبورتنج",
      "كليوباترا", "جليم", "ستانلي", "سان ستيفانو", "لوران", "فيكتوريا", "العامرية", "المندرة", "العصافرة", "شدس", "رشدي"
    ]
  },
  {
    key: "qalyubia",
    governorateAr: "القليوبية",
    governorateEn: "qalyubia",
    aliases: ["القليوبيه", "قليوبية", "محافظة القليوبية", "qalyubiya", "kalyobiya"],
    citiesAndDistricts: [
      "بنها", "banha", "شبرا الخيمة", "shubra el kheima", "العبور", "obour", "العبور سيتي",
      "قليوب", "qalyub", "الخانكة", "khanka", "القناطر الخيرية", "طوخ", "شبين القناطر", "كفر شكر", "قها", "الخصوص"
    ]
  },
  {
    key: "dakahlia",
    governorateAr: "الدقهلية",
    governorateEn: "dakahlia",
    aliases: ["الدقهليه", "دقهلية", "محافظة الدقهلية", "dakahleya"],
    citiesAndDistricts: [
      "المنصورة", "mansoura", "طلخا", "talkha", "ميت غمر", "mit ghamr", "السنبلاوين", "sinbillawin",
      "دكرنس", "أجا", "بلقاس", "شربين", "المنزلة", "جمصة", "نبروه", "الجمالية", "منية النصر"
    ]
  },
  {
    key: "sharqia",
    governorateAr: "الشرقية",
    governorateEn: "sharqia",
    aliases: ["الشرقيه", "شرقية", "محافظة الشرقية", "sharkia"],
    citiesAndDistricts: [
      "الزقازيق", "zagazig", "العاشر من رمضان", "10th of ramadan", "بلبيس", "bilbeis",
      "منيا القمح", "فاقوس", "أبو حماد", "ههيا", "كفر صقر", "أبو كبير", "ديرب نجم", "الحسينية", "القرين"
    ]
  },
  {
    key: "gharbia",
    governorateAr: "الغربية",
    governorateEn: "gharbia",
    aliases: ["الغربيه", "غربية", "محافظة الغربية", "gharbeya"],
    citiesAndDistricts: [
      "طنطا", "tanta", "المحلة الكبرى", "المحلة", "mahalla", "el mahalla", "كفر الزيات", "زفتى", "سمنود", "بسيون", "قطور", "السنطة"
    ]
  },
  {
    key: "monufia",
    governorateAr: "المنوفية",
    governorateEn: "monufia",
    aliases: ["المنوفيه", "منوفية", "محافظة المنوفية", "menoufia", "menofia"],
    citiesAndDistricts: [
      "شبين الكوم", "shebin el kom", "منوف", "menouf", "مدينة السادات", "sadat city", "أشمون", "الباجور", "قويسنا", "بركة السبع", "تلا", "الشهداء"
    ]
  },
  {
    key: "beheira",
    governorateAr: "البحيرة",
    governorateEn: "beheira",
    aliases: ["البحيره", "بحيرة", "محافظة البحيرة", "behira"],
    citiesAndDistricts: [
      "دمنهور", "damanhour", "كفر الدوار", "kafr el dawwar", "رشيد", "إيتاي البارود", "أبو حمص", "كوم حمادة", "الدلنجات", "حوش عيسى", "إدكو", "وادي النطرون"
    ]
  },
  {
    key: "kafr_el_sheikh",
    governorateAr: "كفر الشيخ",
    governorateEn: "kafr el sheikh",
    aliases: ["محافظة كفر الشيخ", "kafr elsheikh"],
    citiesAndDistricts: [
      "دسوق", "desouk", "فوه", "مطوبس", "بيلا", "الحامول", "بلطيم", "سيدي سالم", "قلين", "الرياض"
    ]
  },
  {
    key: "damietta",
    governorateAr: "دمياط",
    governorateEn: "damietta",
    aliases: ["محافظة دمياط", "dumyat"],
    citiesAndDistricts: [
      "دمياط الجديدة", "new damietta", "رأس البر", "ras el bar", "فارسكور", "الزرقا", "كفر سعد", "عزبة البرج"
    ]
  },
  {
    key: "port_said",
    governorateAr: "بورسعيد",
    governorateEn: "port said",
    aliases: ["بور سعيد", "محافظة بورسعيد", "portsaid"],
    citiesAndDistricts: ["بورفؤاد", "port fouad", "حي الشرق", "حي العرب", "حي المناخ", "حي الضواحي", "حي الزهور"]
  },
  {
    key: "ismailia",
    governorateAr: "الإسماعيلية",
    governorateEn: "ismailia",
    aliases: ["الاسماعيلية", "الاسماعيليه", "اسماعيلية", "محافظة الإسماعيلية"],
    citiesAndDistricts: ["فايد", "التل الكبير", "القنطرة شرق", "القنطرة غرب", "أبو صوير", "القصاصين"]
  },
  {
    key: "suez",
    governorateAr: "السويس",
    governorateEn: "suez",
    aliases: ["محافظة السويس"],
    citiesAndDistricts: ["الأربعين", "عتاقة", "فيصل السويس", "الجناين", "العين السخنة", "ain sokhna"]
  },
  {
    key: "fayoum",
    governorateAr: "الفيوم",
    governorateEn: "fayoum",
    aliases: ["محافظة الفيوم", "fayum", "faiyum"],
    citiesAndDistricts: ["سنورس", "إبشواي", "إطسا", "طامية", "يوسف الصديق"]
  },
  {
    key: "beni_suef",
    governorateAr: "بني سويف",
    governorateEn: "beni suef",
    aliases: ["بنى سويف", "محافظة بني سويف", "benisuef"],
    citiesAndDistricts: ["الواسطى", "ناصر", "إهناسيا", "ببا", "سمسطا", "الفشن", "بني سويف الجديدة"]
  },
  {
    key: "minya",
    governorateAr: "المنيا",
    governorateEn: "minya",
    aliases: ["محافظة المنيا", "menia", "el minya"],
    citiesAndDistricts: ["ملوي", "mallawi", "مغاغة", "بني مزار", "مطاي", "سمالوط", "أبو قرقاص", "ديرمواس", "العدوة", "المنيا الجديدة"]
  },
  {
    key: "assiut",
    governorateAr: "أسيوط",
    governorateEn: "assiut",
    aliases: ["اسيوط", "محافظة أسيوط", "محافظة اسيوط", "asyut", "assiut governorate"],
    citiesAndDistricts: [
      "مدينة أسيوط", "assiut city", "asyut city", "منفلوط", "manfalut", "أبو تيج", "ابو تيج", "abu tig", "abutig",
      "ديروط", "dayrout", "القوصية", "qusiya", "أبنوب", "abnoub", "الفتح", "ساحل سليم", "البداري",
      "صدفا", "الغنايم", "أسيوط الجديدة", "new assiut"
    ]
  },
  {
    key: "sohag",
    governorateAr: "سوهاج",
    governorateEn: "sohag",
    aliases: ["محافظة سوهاج", "suhag"],
    citiesAndDistricts: ["أخميم", "جرجا", "girga", "طهطا", "tahta", "طما", "المراغة", "البلينا", "دار السلام", "جهينة", "ساقلتة", "المنشأة"]
  },
  {
    key: "qena",
    governorateAr: "قنا",
    governorateEn: "qena",
    aliases: ["محافظة قنا"],
    citiesAndDistricts: ["نجع حمادي", "nag hammadi", "قوص", "دشنا", "أبو تشت", "فرشوط", "نقادة", "الوقف", "قفط"]
  },
  {
    key: "luxor",
    governorateAr: "الأقصر",
    governorateEn: "luxor",
    aliases: ["الاقصر", "أقصر", "محافظة الأقصر"],
    citiesAndDistricts: ["إسنا", "esna", "أرمنت", "الطود", "القرنة", "البياضية", "الزينية"]
  },
  {
    key: "aswan",
    governorateAr: "أسوان",
    governorateEn: "aswan",
    aliases: ["اسوان", "محافظة أسوان"],
    citiesAndDistricts: ["كوم أمبو", "kom ombo", "إدفو", "edfu", "دراو", "نصر النوبة", "أبو سمبل"]
  },
  {
    key: "red_sea",
    governorateAr: "البحر الأحمر",
    governorateEn: "red sea",
    aliases: ["البحر الاحمر", "محافظة البحر الأحمر"],
    citiesAndDistricts: ["الغردقة", "hurghada", "سفاجا", "القصير", "مرسى علم", "marsa alam", "رأس غارب", "الجونة", "el gouna"]
  },
  {
    key: "matrouh",
    governorateAr: "مطروح",
    governorateEn: "matrouh",
    aliases: ["مرسى مطروح", "marsa matrouh", "محافظة مطروح"],
    citiesAndDistricts: ["العلمين", "alamein", "الساحل الشمالي", "north coast", "الحمام", "الضبعة", "سيدي عبد الرحمن", "سيوة", "siwa"]
  },
  {
    key: "new_valley",
    governorateAr: "الوادي الجديد",
    governorateEn: "new valley",
    aliases: ["الوادى الجديد", "محافظة الوادي الجديد"],
    citiesAndDistricts: ["الخارجة", "الداخلة", "الفرافرة", "باريس", "بلاط"]
  },
  {
    key: "north_sinai",
    governorateAr: "شمال سيناء",
    governorateEn: "north sinai",
    aliases: ["محافظة شمال سيناء"],
    citiesAndDistricts: ["العريش", "arish", "بئر العبد", "الشيخ زويد", "رفح", "الحسنة", "نخل"]
  },
  {
    key: "south_sinai",
    governorateAr: "جنوب سيناء",
    governorateEn: "south sinai",
    aliases: ["محافظة جنوب سيناء"],
    citiesAndDistricts: ["شرم الشيخ", "sharm el sheikh", "دهب", "dahab", "الطور", "نويبع", "طابا", "سانت كاترين", "رأس سدر", "ras sedr"]
  }
];

// Phase C — Inventory Movement Types & Costing Methods
const INVENTORY_COSTING_METHODS = ["weighted_average", "fifo"];

const INVENTORY_MOVEMENT_TYPES = [
  "supplier_receipt",
  "customer_sale",
  "customer_return",
  "order_cancellation_restore",
  "supplier_return",
  "damaged_or_lost",
  "manual_adjustment",
  "reservation_hold",
  "reservation_release"
];

// Phase D — Expense Categories, Recurrence Frequencies & Manual Sale Sources
const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "salaries",
  "internet",
  "subscriptions",
  "packaging",
  "marketing",
  "maintenance",
  "shipping_variance",
  "operational",
  "partner_withdrawal",
  "partner_profit_distribution",
  "other"
];

const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly"
];

const MANUAL_SALE_SOURCES = [
  "manual_offline",
  "pos",
  "showroom",
  "phone_order",
  "whatsapp_direct",
  "b2b_invoice"
];

// Phase E — Accounting Types & Journal Statuses
const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cogs",
  "expense"
];

const JOURNAL_ENTRY_STATUSES = [
  "draft",
  "posted",
  "reversed"
];

// Phase F — Supported Currencies & Cost Update Policies
const SUPPORTED_CURRENCIES = [
  "EGP",
  "USD",
  "EUR",
  "SAR",
  "AED",
  "GBP",
  "CNY",
  "KWD"
];

const CURRENCY_COST_UPDATE_POLICIES = [
  "both",
  "increases_only",
  "decreases_only",
  "manual_only"
];

module.exports = {
  FINANCE_CAPABILITY_LEVELS,
  VALID_FINANCE_LEVELS,
  FINANCE_PHASES,
  SHIPPING_CALCULATION_MODES,
  VALID_SHIPPING_MODES,
  DELIVERY_METHODS,
  VALID_DELIVERY_METHODS,
  SUPPLIER_SHIPMENT_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_ENTRY_TYPES,
  PAYMENT_METHODS,
  EGYPT_GEOGRAPHY_DICTIONARY,
  INVENTORY_COSTING_METHODS,
  INVENTORY_MOVEMENT_TYPES,
  EXPENSE_CATEGORIES,
  RECURRENCE_FREQUENCIES,
  MANUAL_SALE_SOURCES,
  ACCOUNT_TYPES,
  JOURNAL_ENTRY_STATUSES,
  SUPPORTED_CURRENCIES,
  CURRENCY_COST_UPDATE_POLICIES
};

