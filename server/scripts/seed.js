const mongoose = require("mongoose");
require("dotenv").config();
const envJson = require("../env.json");

const getCategoriesModel = require("../modules/categories/categoryModel");
const getProductsModel = require("../modules/products/productModel");
const getOffersModel = require("../modules/offers/offerModel");
const getCouponsModel = require("../modules/coupons/couponModel");
const getUsersModel = require("../modules/auth/userModel");
const getAdminDataModel = require("../modules/settings/adminDataModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getReviewsModel = require("../modules/products/reviewModel");
const getActivityModel = require("../modules/activity/activityModel");

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

function daysAgo(days, hoursOffset = 0, minsOffset = 0) {
  return new Date(Date.now() - days * DAY_MS + hoursOffset * HOUR_MS + minsOffset * MIN_MS);
}

async function seed() {
  const dbUri = envJson.localhost?.database || process.env.DEFAULT_DB;
  console.log("Connecting to Database for seeding & realistic activity simulation:", dbUri);

  const conn = await mongoose.createConnection(dbUri).asPromise();
  const serverModule = require("../server");
  serverModule.setMongooseConnection("localhost", conn);

  const Categories = getCategoriesModel("localhost");
  const Products = getProductsModel("localhost");
  const Offers = getOffersModel("localhost");
  const Coupons = getCouponsModel("localhost");
  const Users = getUsersModel("localhost");
  const AdminData = getAdminDataModel("localhost");
  const Orders = getOrdersModel("localhost");
  const Reviews = getReviewsModel("localhost");
  const Activity = getActivityModel("localhost");

  // Preserve any existing product semantic embeddings by product name before resetting
  const existingProducts = await Products.find({}).select("name embedding").lean();
  const embeddingByName = new Map();
  for (const ep of existingProducts) {
    if (ep.name && Array.isArray(ep.embedding) && ep.embedding.length > 0) {
      embeddingByName.set(ep.name.trim(), ep.embedding);
    }
  }

  console.log("Clearing demo seed records & resetting Orders, Reviews, Activity...");
  const demoSlugs = ["electronics", "smart-watches", "audio", "laptops"];
  const oldDemoCats = await Categories.find({ slug: { $in: demoSlugs } }).select("_id").lean();
  if (oldDemoCats.length > 0) {
    await Products.deleteMany({ categoryId: { $in: oldDemoCats.map((c) => c._id) } });
    await Categories.deleteMany({ _id: { $in: oldDemoCats.map((c) => c._id) } });
  }
  await Offers.deleteMany({});
  await Coupons.deleteMany({});
  await Users.deleteMany({});
  await AdminData.deleteMany({});
  await Orders.deleteMany({});
  await Reviews.deleteMany({});
  await Activity.deleteMany({});

  console.log("Creating Admin & 8 Realistic Customers...");
  const admin = await new Users({
    fullname: "مدير المتجر التنفيذي",
    email: "admin@store.com",
    password: "admin123",
    phone: "01011112222",
    role: "admin",
    address: "التجمع الخامس، القاهرة الجديدة",
    city: "القاهرة"
  }).save();

  const c1 = await new Users({
    fullname: "أحمد محمود سالم",
    email: "customer@store.com",
    password: "customer123",
    phone: "01099998888",
    role: "user",
    address: "شارع النصر، المعادي، القاهرة",
    city: "القاهرة",
    lastLogin: daysAgo(0, -3)
  }).save();

  const c2 = await new Users({
    fullname: "سارة حسن عبد العزيز",
    email: "sara@example.com",
    password: "user123",
    phone: "01233445566",
    role: "user",
    address: "شارع الثورة، مصر الجديدة، القاهرة",
    city: "القاهرة",
    lastLogin: daysAgo(1, -2)
  }).save();

  const c3 = await new Users({
    fullname: "خالد عبد الله المنشاوي",
    email: "khaled@example.com",
    password: "user123",
    phone: "01122334455",
    role: "user",
    address: "شارع فيصل الرئيسي، الجيزة",
    city: "الجيزة",
    lastLogin: daysAgo(0, -6)
  }).save();

  const c4 = await new Users({
    fullname: "نورا إبراهيم خليل",
    email: "noura@example.com",
    password: "user123",
    phone: "01077889900",
    role: "user",
    address: "لوران، طريق الحرية، الإسكندرية",
    city: "الإسكندرية",
    lastLogin: daysAgo(0, -1)
  }).save();

  const c5 = await new Users({
    fullname: "طارق فهمي عثمان",
    email: "tarek@example.com",
    password: "user123",
    phone: "01555667788",
    role: "user",
    address: "مدينة نصر، الحي السابع، القاهرة",
    city: "القاهرة",
    lastLogin: daysAgo(2, -4)
  }).save();

  const c6 = await new Users({
    fullname: "مريم عادل الشافعي",
    email: "mariam@example.com",
    password: "user123",
    phone: "01066554433",
    role: "user",
    address: "الشيخ زايد، الحي الرابع، الجيزة",
    city: "الجيزة",
    lastLogin: daysAgo(3, -1)
  }).save();

  const c7 = await new Users({
    fullname: "يوسف كمال الدسوقي",
    email: "youssef@example.com",
    password: "user123",
    phone: "01144556677",
    role: "user",
    address: "سموحة، شارع فوزي معاذ، الإسكندرية",
    city: "الإسكندرية",
    lastLogin: daysAgo(1, -8)
  }).save();

  const c8 = await new Users({
    fullname: "هدى عبد الرحمن لطفي",
    email: "hoda@example.com",
    password: "user123",
    phone: "01288776655",
    role: "user",
    address: "المهندسين، شارع جامعة الدول، الجيزة",
    city: "الجيزة",
    lastLogin: daysAgo(4, -2)
  }).save();

  console.log("Creating Tenant Admin Settings...");
  await new AdminData({
    siteName: "فار ستور | FarStore",
    siteDescription: "وجهتك الأولى للإلكترونيات والأجهزة الذكية الفاخرة",
    logo: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200",
    backgroundImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600",
    phone: "01023456789",
    whatsapp: "01023456789",
    email: "contact@farstore.com",
    address: "التجمع الخامس، القاهرة الجديدة",
    currency: "ج.م",
    shippingCost: 50,
    freeShippingOver: 2000,
    aiEnabled: true,
    AI_BASE_URL: "https://api.deepseek.com",
    AI_MODEL: "deepseek-chat",
    customTheme: {
      id: "apple-clean",
      name: "العصري الانسيابي (Modern Clean Air)",
      primaryColor: "#0284c7",
      secondaryColor: "#0f172a",
      highlightColor: "#38bdf8",
      accentColor: "#10b981",
      cardArchetype: "glassmorphic-modern",
      fontFamily: "Alexandria",
      globalBg: {
        bgType: "gradient",
        bgColor: "#ffffff",
        gradient: { type: "linear", angle: 135, colorStart: "#ffffff", colorMid: "#f0f9ff", colorEnd: "#e0f2fe" }
      },
      cardContainer: {
        bgColor: "rgba(255, 255, 255, 0.94)",
        backdropBlur: "md",
        borderRadius: "1.25rem",
        shadow: "soft",
        borderStyle: "solid",
        borderColor: "#e0f2fe"
      },
      buttons: { borderRadius: "0.875rem", primaryShadow: "md" }
    }
  }).save();

  console.log("Creating Categories...");
  const cat1 = await new Categories({
    name: "إلكترونيات وهواتف",
    slug: "electronics",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600",
    icon: "Smartphone",
    specs: { "الذاكرة": "سعة التخزين", "المعالج": "نوع المعالج", "الشاشة": "حجم الشاشة", "اللون": "لون الجهاز" },
    tags: ["هواتف", "إلكترونيات", "أبل", "سامسونج"],
    order: 1
  }).save();

  const cat2 = await new Categories({
    name: "ساعات وإكسسوارات ذكية",
    slug: "smart-watches",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600",
    icon: "Watch",
    specs: { "اللون": "لون الهيكل", "مقاومة الماء": "العمق بالمتر", "البطارية": "ساعات التشغيل", "حجم الإطار": "المقاس بالملم" },
    tags: ["ساعات", "رياضة", "تيتانيوم", "صحة"],
    order: 2
  }).save();

  const cat3 = await new Categories({
    name: "صوتيات وسماعات",
    slug: "audio",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
    icon: "Headphones",
    specs: { "نوع العزل": "تقنية إلغاء الضوضاء", "الاتصال": "نسخة البلوتوث", "اللون": "اللون الخارجي", "البطارية": "ساعات التشغيل" },
    tags: ["صوتيات", "سماعات", "عزل ضوضاء", "سوني", "أبل"],
    order: 3
  }).save();

  const cat4 = await new Categories({
    name: "أجهزة كمبيوتر ولابتوب",
    slug: "laptops",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600",
    icon: "Laptop",
    specs: { "الرام": "سعة الذاكرة العشوائية", "كارت الشاشة": "موديل GPU", "المعالج": "نوع CPU", "سعة التخزين": "حجم الـ SSD" },
    tags: ["كمبيوتر", "لابتوب", "ألعاب", "أعمال", "ماك بوك"],
    order: 4
  }).save();

  console.log("Creating Promotional Offers...");
  const offer1 = await new Offers({
    title: "مهرجان العودة للموسم التقني 2026",
    description: "خصومات استثنائية تصل إلى 35% على أحدث السماعات والساعات وأجهزة اللابتوب والهواتف الرائدة",
    badge: "خصم 35% ⚡",
    discountPercentage: 35,
    bannerImage: "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=1200",
    startDate: daysAgo(45),
    endDate: new Date(Date.now() + 20 * DAY_MS),
    active: true,
    bgColor: "linear-gradient(135deg, #0284c7, #0f172a)"
  }).save();

  const offer2 = await new Offers({
    title: "أسبوع الصوت فائق النقاء",
    description: "توفير يصل إلى 2000 ج.م على تشكيلة السماعات الاحترافية وسماعات الرأس العازلة للضوضاء",
    badge: "وفر 2000 ج.م 🎧",
    discountPercentage: 20,
    bannerImage: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=1200",
    startDate: daysAgo(45),
    endDate: new Date(Date.now() + 10 * DAY_MS),
    active: true,
    bgColor: "linear-gradient(135deg, #10b981, #0f172a)"
  }).save();

  console.log("Creating Products (visited & salesCount start at 0 and are computed from real simulated events)...");
  const p1Name = "سماعة رأس لاسلكية سوني WH-1000XM5 عازلة للضوضاء";
  const p1 = await new Products({
    name: p1Name,
    categoryId: cat3._id,
    offerId: offer1._id,
    price: 9800,
    oldPrice: 12500,
    costPrice: 7000,
    stockCount: 18,
    salesCount: 0,
    visited: 0,
    description: "سماعة الرأس الرائدة عالمياً في عزل الضوضاء النشط بمحركات كربونية متطورة وصوت فائق الدقة LDAC مع 8 ميكروفونات ومكالمات كريستالية النقاوة.",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800",
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800"
    ],
    specs: { "نوع العزل": "ANC نشط متقدم", "الاتصال": "بلوتوث 5.2", "البطارية": "30 ساعة تشغيل", "اللون": "أسود كربوني" },
    tags: ["سوني", "سماعات", "صوتيات", "عزل ضوضاء"],
    ratings: { 5: 22, 4: 5, 3: 1, 2: 0, 1: 0 },
    ratingAvg: 4.8,
    ratingCount: 28,
    featured: true,
    embedding: embeddingByName.get(p1Name) || []
  }).save();

  const p2Name = "ساعة أبل واتش الترا 2 تيتانيوم مع حزام رياضي";
  const p2 = await new Products({
    name: p2Name,
    categoryId: cat2._id,
    offerId: offer1._id,
    price: 34500,
    oldPrice: 38000,
    costPrice: 28000,
    stockCount: 8,
    salesCount: 0,
    visited: 0,
    description: "الساعة الأكثر قوة وقدرة للمغامرين والرياضيين، بهيكل تيتانيوم مقاس 49 مم، مقاومة للماء حتى عمق 100 متر، وشاشة فائقة السطوع 3000 شمعة.",
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
      "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800",
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800"
    ],
    specs: { "اللون": "تيتانيوم طبيعي", "مقاومة الماء": "100 متر", "البطارية": "36 ساعة (72 ساعة بنمط التوفير)", "حجم الإطار": "49 مم" },
    tags: ["أبل", "ساعات", "رياضة", "تيتانيوم"],
    ratings: { 5: 18, 4: 2, 3: 0, 2: 0, 1: 0 },
    ratingAvg: 4.9,
    ratingCount: 20,
    featured: true,
    embedding: embeddingByName.get(p2Name) || []
  }).save();

  const p3Name = "هاتف أبل آيفون 15 برو ماكس تيتانيوم طبيعي 256GB";
  const p3 = await new Products({
    name: p3Name,
    categoryId: cat1._id,
    price: 59000,
    oldPrice: 63500,
    costPrice: 51000,
    stockCount: 5,
    salesCount: 0,
    visited: 0,
    description: "أقوى هاتف ذكي بتصميم من التيتانيوم المستخدم في صناعة مركبات الفضاء، شريحة A17 Pro الثورية، وزر إجراءات قابل للتخصيص وكاميرا رئيسية بدقة 48MP مع تقريب بصري 5x.",
    images: [
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800",
      "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800",
      "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800"
    ],
    specs: { "الذاكرة": "256GB", "المعالج": "A17 Pro سداسي النوى", "الشاشة": "6.7 بوصة Super Retina XDR", "اللون": "تيتانيوم طبيعي" },
    tags: ["أبل", "آيفون", "هواتف", "تيتانيوم"],
    ratings: { 5: 35, 4: 4, 3: 1, 2: 0, 1: 0 },
    ratingAvg: 4.9,
    ratingCount: 40,
    featured: true,
    embedding: embeddingByName.get(p3Name) || []
  }).save();

  const p4Name = "لابتوب أبل ماك بوك برو 16 إنش شريحة M3 Max سعة 1TB";
  const p4 = await new Products({
    name: p4Name,
    categoryId: cat4._id,
    price: 118000,
    oldPrice: 125000,
    costPrice: 98000,
    stockCount: 4,
    salesCount: 0,
    visited: 0,
    description: "الأداء الخارق للمحترفين والمطورين، معالج M3 Max بـ 16 نواة، 36GB ذاكرة موحدة، شاشة Liquid Retina XDR مبهرة وعمر بطارية يصل إلى 22 ساعة متواصلة.",
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800"
    ],
    specs: { "المعالج": "Apple M3 Max", "الرام": "36GB موحدة", "سعة التخزين": "1TB SSD فائق السرعة", "الشاشة": "16.2 بوصة Mini-LED" },
    tags: ["ماك بوك", "أبل", "لابتوب", "مونتاج", "برمجة"],
    ratings: { 5: 14, 4: 1, 3: 0, 2: 0, 1: 0 },
    ratingAvg: 4.9,
    ratingCount: 15,
    featured: true,
    embedding: embeddingByName.get(p4Name) || []
  }).save();

  const p5Name = "هاتف سامسونج جالاكسي S24 الترا مع قلم S-Pen ذاكرة 512GB";
  const p5 = await new Products({
    name: p5Name,
    categoryId: cat1._id,
    price: 49500,
    oldPrice: 54000,
    costPrice: 42000,
    stockCount: 12,
    salesCount: 0,
    visited: 0,
    description: "عصر جديد من الذكاء الاصطناعي مع Galaxy AI، إطار تيتانيوم قوي، قلم S-Pen مدمج، وكاميرا جبارة بدقة 200MP مع تقريب رقمي حتى 100x.",
    images: [
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800",
      "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800"
    ],
    specs: { "الذاكرة": "512GB", "المعالج": "Snapdragon 8 Gen 3", "الشاشة": "6.8 بوصة Dynamic AMOLED 2X", "اللون": "رمادي تيتانيوم" },
    tags: ["سامسونج", "جالاكسي", "هواتف", "ذكاء اصطناعي"],
    ratings: { 5: 20, 4: 6, 3: 2, 2: 0, 1: 0 },
    ratingAvg: 4.7,
    ratingCount: 28,
    embedding: embeddingByName.get(p5Name) || []
  }).save();

  const p6Name = "سماعة أبل إيربودز ماكس اللاسلكية سبيس جراي";
  const p6 = await new Products({
    name: p6Name,
    categoryId: cat3._id,
    offerId: offer2._id,
    price: 24500,
    oldPrice: 28000,
    costPrice: 19500,
    stockCount: 7,
    salesCount: 0,
    visited: 0,
    description: "التوازن المثالي بين الصوت عالي الدقة وسحر AirPods السلس، مع ميزة عزل الضوضاء النشطة الرائدة وشفافية الصوت والتتبع الديناميكي للرأس.",
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"
    ],
    specs: { "نوع العزل": "ANC نشط", "الاتصال": "بلوتوث 5.0", "البطارية": "20 ساعة", "اللون": "رمادي فلكي" },
    tags: ["أبل", "إيربودز", "سماعات", "صوتيات"],
    ratings: { 5: 12, 4: 2, 3: 0, 2: 0, 1: 0 },
    ratingAvg: 4.8,
    ratingCount: 14,
    embedding: embeddingByName.get(p6Name) || []
  }).save();

  const p7Name = "ساعة جارمين فينيكس 7X برو ياقوتية شمسية Garmin";
  const p7 = await new Products({
    name: p7Name,
    categoryId: cat2._id,
    price: 38000,
    oldPrice: 42000,
    costPrice: 31000,
    stockCount: 6,
    salesCount: 0,
    visited: 0,
    description: "ساعة اللياقة والمهام الشاقة الأكثر تطوراً في العالم مع شحن بالطاقة الشمسية، كشاف LED مدمج، وخرائط طبوغرافية لجميع قارات العالم.",
    images: [
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800",
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"
    ],
    specs: { "اللون": "تيتانيوم أسود DLC", "مقاومة الماء": "100 متر (10 ATM)", "البطارية": "حتى 37 يوماً بالطاقة الشمسية", "حجم الإطار": "51 مم" },
    tags: ["ساعات", "جارمين", "مغامرات", "رياضة"],
    ratings: { 5: 8, 4: 1, 3: 0, 2: 0, 1: 0 },
    ratingAvg: 4.9,
    ratingCount: 9,
    embedding: embeddingByName.get(p7Name) || []
  }).save();

  const p8Name = "لابتوب ديل إكس بي إس Dell XPS 15 شاشة OLED 3.5K";
  const p8 = await new Products({
    name: p8Name,
    categoryId: cat4._id,
    price: 74000,
    oldPrice: 82000,
    costPrice: 62000,
    stockCount: 5,
    salesCount: 0,
    visited: 0,
    description: "تحفة فنية من الألومنيوم المصقول وألياف الكربون، شاشة InfinityEdge لمسية مبهرة بدقة 3.5K OLED ومعالج إنتل كور i9 القوي مع كارت شاشة RTX 4070.",
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800",
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800"
    ],
    specs: { "المعالج": "Intel Core i9-13900H", "الرام": "32GB DDR5", "كارت الشاشة": "NVIDIA RTX 4070 8GB", "سعة التخزين": "1TB NVMe Gen4" },
    tags: ["ديل", "لابتوب", "ألعاب", "تصميم"],
    ratings: { 5: 10, 4: 3, 3: 1, 2: 0, 1: 0 },
    ratingAvg: 4.7,
    ratingCount: 14,
    embedding: embeddingByName.get(p8Name) || []
  }).save();

  // Link offers
  await Offers.findByIdAndUpdate(offer1._id, { productIds: [p1._id, p2._id] });
  await Offers.findByIdAndUpdate(offer2._id, { productIds: [p6._id] });

  console.log("Creating Reviews...");
  await Reviews.insertMany([
    {
      productId: p1._id,
      userId: c1._id,
      username: c1.fullname,
      rating: 5,
      comment: "أفضل سماعة رأس جربتها في حياتي! عزل الصوت ينقلك لعالم آخر والصوت نقي جداً.",
      createdAt: daysAgo(4)
    },
    {
      productId: p1._id,
      userId: c2._id,
      username: c2.fullname,
      rating: 5,
      comment: "مريحة جداً لساعات السفر والمذاكرة الطويلة والبطارية تدوم أكثر من 3 أيام.",
      createdAt: daysAgo(9)
    },
    {
      productId: p3._id,
      userId: c3._id,
      username: c3.fullname,
      rating: 5,
      comment: "الهاتف تحفة معمارية والتيتانيوم الطبيعي ملمسه رائع وخفيف جداً في اليد.",
      createdAt: daysAgo(6)
    },
    {
      productId: p5._id,
      userId: c7._id,
      username: c7.fullname,
      rating: 5,
      comment: "شاشة سامسونج S24 الترا لا يعلى عليها ضد الانعكاس وقلم S-Pen عملي جداً في الاجتماعات.",
      createdAt: daysAgo(11)
    },
    {
      productId: p6._id,
      userId: c2._id,
      username: c2.fullname,
      rating: 4,
      comment: "جودة بناء فاخرة جداً وصوت محيطي مذهل، فقط وزنها أثقل قليلاً من السماعات البلاستيكية.",
      createdAt: daysAgo(2)
    }
  ]);

  console.log("Creating Coupons...");
  await new Coupons({
    code: "FAR2026",
    type: "discount",
    discount: 10,
    minOrderValue: 2000,
    allowedUses: 100,
    usedCount: 6,
    expiration: new Date(Date.now() + 60 * DAY_MS),
    active: true
  }).save();

  await new Coupons({
    code: "VIP500",
    type: "fixed",
    value: 500,
    minOrderValue: 5000,
    allowedUses: 50,
    usedCount: 5,
    expiration: new Date(Date.now() + 30 * DAY_MS),
    active: true
  }).save();

  await new Coupons({
    code: "WELCOME",
    type: "discount",
    discount: 5,
    minOrderValue: 1000,
    allowedUses: 0,
    usedCount: 4,
    expiration: new Date(Date.now() + 90 * DAY_MS),
    active: true
  }).save();

  // ============================================================================
  // REALISTIC CLIENT JOURNEY & ACTIVITY SIMULATION
  // ============================================================================
  console.log("Simulating realistic client journeys (Views, Wishlists, Carts, Checkouts, Orders, Price Feedback)...");

  const offerDiscountMap = new Map([
    [String(p1._id), { offerId: offer1._id, offerDiscountPercent: 35 }],
    [String(p2._id), { offerId: offer1._id, offerDiscountPercent: 35 }],
    [String(p6._id), { offerId: offer2._id, offerDiscountPercent: 20 }]
  ]);

  const couponPercentMap = {
    FAR2026: 10,
    WELCOME: 5,
    VIP500: null // fixed 500 EGP coupon
  };

  const activityDocs = [];
  const productViewsCounter = new Map();
  const productSalesCounter = new Map();
  const userWishlistMap = new Map(); // userIdStr -> Set(productIdStr)

  const allProducts = [p1, p2, p3, p4, p5, p6, p7, p8];
  const productById = new Map(allProducts.map((p) => [String(p._id), p]));

  function pushActivity({
    eventType,
    product = null,
    user = null,
    visitorId = null,
    sessionId = null,
    cartId = null,
    orderId = null,
    quantity = null,
    couponCode = null,
    occurredAt = new Date()
  }) {
    const prodOffer = product ? offerDiscountMap.get(String(product._id)) : null;
    const hasCoupon = Boolean(couponCode && String(couponCode).trim());
    const cleanCoupon = hasCoupon ? String(couponCode).toUpperCase().trim() : null;

    activityDocs.push({
      eventType,
      productId: product ? product._id : null,
      userId: user ? user._id : null,
      visitorId: visitorId || (user ? `vis_user_${String(user._id).slice(-6)}` : null),
      sessionId: sessionId || null,
      cartId: cartId || null,
      orderId: orderId || null,
      quantity: quantity !== null ? quantity : null,
      unitPrice: product ? product.price : null,
      offerId: prodOffer ? prodOffer.offerId : null,
      offerDiscountPercent: prodOffer ? prodOffer.offerDiscountPercent : null,
      couponApplied: hasCoupon ? true : null,
      couponDiscountPercent: hasCoupon ? couponPercentMap[cleanCoupon] ?? null : null,
      occurredAt
    });

    if (eventType === "product_viewed" && product) {
      const k = String(product._id);
      productViewsCounter.set(k, (productViewsCounter.get(k) || 0) + 1);
    }

    if (user && product) {
      const uKey = String(user._id);
      if (!userWishlistMap.has(uKey)) userWishlistMap.set(uKey, new Set());
      if (eventType === "wishlist_added") {
        userWishlistMap.get(uKey).add(String(product._id));
      } else if (eventType === "wishlist_removed") {
        userWishlistMap.get(uKey).delete(String(product._id));
      }
    }
  }

  // Helper to simulate a full order journey (views -> optional wishlist -> add_to_cart -> checkout_started -> order_created -> status transitions)
  async function simulateOrderJourney({
    orderId,
    user,
    visitorId,
    sessionId,
    cartId,
    city,
    notes = "",
    items, // [{ product, quantity }]
    payment,
    shipping = 0,
    discount = 0,
    coupon = "",
    status,
    createdDaysAgo,
    timelineSteps, // [{ status, daysAgoVal, hoursOffset, note }]
    wishlistedProductsBeforeCart = [],
    priceFeedbackProducts = []
  }) {
    const baseViewTime = daysAgo(createdDaysAgo, -2, -15);
    const visId = visitorId || `vis_user_${String(user._id).slice(-6)}`;

    // 1. Customer views each product in the order
    items.forEach((it, idx) => {
      pushActivity({
        eventType: "product_viewed",
        product: it.product,
        user,
        visitorId: visId,
        sessionId,
        occurredAt: new Date(baseViewTime.getTime() + idx * 4 * MIN_MS)
      });
    });

    // 2. Optional wishlist additions before adding to cart (creates attributed wishlist-to-cart conversions!)
    wishlistedProductsBeforeCart.forEach((wProd, idx) => {
      pushActivity({
        eventType: "wishlist_added",
        product: wProd,
        user,
        visitorId: visId,
        sessionId,
        occurredAt: new Date(baseViewTime.getTime() + (15 + idx * 3) * MIN_MS)
      });
    });

    // 3. Optional price feedback signal during browsing
    priceFeedbackProducts.forEach((pfProd, idx) => {
      pushActivity({
        eventType: "price_feedback",
        product: pfProd,
        user,
        visitorId: visId,
        sessionId,
        occurredAt: new Date(baseViewTime.getTime() + (22 + idx * 2) * MIN_MS)
      });
    });

    // 4. Add items to cart
    const cartTime = daysAgo(createdDaysAgo, -1, -20);
    items.forEach((it, idx) => {
      pushActivity({
        eventType: "add_to_cart",
        product: it.product,
        user,
        visitorId: visId,
        sessionId,
        cartId,
        quantity: it.quantity,
        couponCode: coupon || null,
        occurredAt: new Date(cartTime.getTime() + idx * 3 * MIN_MS)
      });
    });

    // 5. Checkout started
    const checkoutTime = daysAgo(createdDaysAgo, 0, -25);
    items.forEach((it, idx) => {
      pushActivity({
        eventType: "checkout_started",
        product: it.product,
        user,
        visitorId: visId,
        sessionId,
        cartId,
        quantity: it.quantity,
        couponCode: coupon || null,
        occurredAt: new Date(checkoutTime.getTime() + idx * MIN_MS)
      });
    });

    // 6. Create Order document with accurate createdAt & updatedAt
    const orderCreatedTime = timelineSteps[0]?.at || daysAgo(createdDaysAgo);
    const lastStepTime = timelineSteps[timelineSteps.length - 1]?.at || orderCreatedTime;
    const subtotal = items.reduce((s, it) => s + it.product.price * it.quantity, 0);
    const total = Math.max(0, subtotal + shipping - discount);

    const orderDoc = new Orders({
      orderId,
      userId: user._id,
      visitorId: visId,
      sessionId,
      cartId,
      customer: {
        name: user.fullname,
        phone: user.phone,
        email: user.email,
        address: user.address,
        city: city || user.city || "القاهرة",
        notes
      },
      items: items.map((it) => ({
        productId: String(it.product._id),
        name: it.product.name,
        price: it.product.price,
        costPrice: it.product.costPrice,
        quantity: it.quantity,
        image: it.product.images[0] || ""
      })),
      payment,
      subtotal,
      shipping,
      discount,
      total,
      coupon,
      status,
      timeline: timelineSteps,
      createdAt: orderCreatedTime,
      updatedAt: lastStepTime
    });

    await orderDoc.save({ timestamps: false });

    // 7. Record order_created per item
    items.forEach((it) => {
      pushActivity({
        eventType: "order_created",
        product: it.product,
        user,
        visitorId: visId,
        sessionId,
        cartId,
        orderId: orderDoc._id,
        quantity: it.quantity,
        couponCode: coupon || null,
        occurredAt: orderCreatedTime
      });
    });

    // 8. Record lifecycle completion / cancellation / return events
    const deliveredStep = timelineSteps.find((t) => t.status === "delivered");
    if (deliveredStep) {
      items.forEach((it) => {
        pushActivity({
          eventType: "order_completed",
          product: it.product,
          user,
          visitorId: visId,
          sessionId,
          cartId,
          orderId: orderDoc._id,
          quantity: it.quantity,
          couponCode: coupon || null,
          occurredAt: deliveredStep.at
        });
      });

      // Only count net delivered sales in product.salesCount when status is delivered
      if (status === "delivered") {
        items.forEach((it) => {
          const k = String(it.product._id);
          productSalesCounter.set(k, (productSalesCounter.get(k) || 0) + it.quantity);
        });
      }
    }

    const cancelledStep = timelineSteps.find((t) => t.status === "cancelled");
    if (cancelledStep && status === "cancelled") {
      items.forEach((it) => {
        pushActivity({
          eventType: "order_cancelled",
          product: it.product,
          user,
          visitorId: visId,
          sessionId,
          cartId,
          orderId: orderDoc._id,
          quantity: it.quantity,
          couponCode: coupon || null,
          occurredAt: cancelledStep.at
        });
      });
    }

    const returnedStep = timelineSteps.find((t) => t.status === "returned");
    if (returnedStep && status === "returned") {
      items.forEach((it) => {
        pushActivity({
          eventType: "product_returned",
          product: it.product,
          user,
          visitorId: visId,
          sessionId,
          cartId,
          orderId: orderDoc._id,
          quantity: it.quantity,
          couponCode: coupon || null,
          occurredAt: returnedStep.at
        });
      });
    }
  }

  // ----------------------------------------------------------------------------
  // A. 16 Simulated Full Order Journeys (12 in Current 30d Window, 4 in Previous 30d Window)
  // ----------------------------------------------------------------------------

  // 1. Delivered Order (c1 - أحمد محمود - 5 days ago) - Sony XM5 x2 with FAR2026
  await simulateOrderJourney({
    orderId: "ORD-9284102941",
    user: c1,
    sessionId: "sess_c1_01",
    cartId: "cart_c1_01",
    city: "القاهرة",
    notes: "التوصيل في الفترة المسائية بعد الساعة 5",
    items: [{ product: p1, quantity: 2 }],
    payment: { method: "card", paid: true, transactionId: "TXN_PAYMOB_991823" },
    shipping: 0,
    discount: 1960,
    coupon: "FAR2026",
    status: "delivered",
    createdDaysAgo: 5,
    wishlistedProductsBeforeCart: [p1],
    timelineSteps: [
      { status: "new", at: daysAgo(5), note: "تم استلام الطلب وتأكيد الدفع الإلكتروني بنجاح" },
      { status: "confirmed", at: daysAgo(4, -4), note: "تمت مراجعة بيانات العنوان والاتصال وتأكيد الفاتورة" },
      { status: "preparing", at: daysAgo(3, -2), note: "تم تغليف المنتج وفحصه بمستودع التجمع الخامس" },
      { status: "shipped", at: daysAgo(2, -5), note: "تم تسليم الشحنة لمندوب شركة أرامكس برقم تتبع ARX-998811" },
      { status: "delivered", at: daysAgo(1, -3), note: "تم استلام الشحنة وتوقيع العميل بنجاح" }
    ]
  });

  // 2. Shipped Order (c1 - أحمد محمود - 2 days ago) - Apple Watch Ultra 2 + Galaxy S24 Ultra
  await simulateOrderJourney({
    orderId: "ORD-4112671004",
    user: c1,
    sessionId: "sess_c1_02",
    cartId: "cart_c1_02",
    city: "القاهرة",
    items: [
      { product: p2, quantity: 1 },
      { product: p5, quantity: 1 }
    ],
    payment: { method: "cod", paid: false },
    shipping: 0,
    discount: 500,
    coupon: "VIP500",
    status: "shipped",
    createdDaysAgo: 2,
    wishlistedProductsBeforeCart: [p2],
    timelineSteps: [
      { status: "new", at: daysAgo(2), note: "تم إنشاء الطلب بنجاح بخيار الدفع عند الاستلام" },
      { status: "confirmed", at: daysAgo(1, -12), note: "تم التأكيد هاتفياً مع العميل وجاهزية المستودع" },
      { status: "preparing", at: daysAgo(1, -4), note: "تم إعداد الباقة وتجهيز بوليصة الشحن" },
      { status: "shipped", at: daysAgo(0, -6), note: "الشحنة في طريقها مع مندوب التوصيل - متوقع الوصول اليوم" }
    ]
  });

  // 3. Delivered Order (c2 - سارة حسن - 7 days ago) - AirPods Max x1
  await simulateOrderJourney({
    orderId: "ORD-7391028456",
    user: c2,
    sessionId: "sess_c2_01",
    cartId: "cart_c2_01",
    city: "القاهرة",
    items: [{ product: p6, quantity: 1 }],
    payment: { method: "card", paid: true, transactionId: "TXN_PAYMOB_883102" },
    shipping: 0,
    discount: 0,
    status: "delivered",
    createdDaysAgo: 7,
    wishlistedProductsBeforeCart: [p6],
    timelineSteps: [
      { status: "new", at: daysAgo(7), note: "تم إنشاء الطلب وسداد القيمة" },
      { status: "confirmed", at: daysAgo(6), note: "تم تأكيد الحجز" },
      { status: "preparing", at: daysAgo(5), note: "تم التجهيز" },
      { status: "shipped", at: daysAgo(4), note: "تم الشحن" },
      { status: "delivered", at: daysAgo(3), note: "تم تسليم الطلب للعميلة" }
    ]
  });

  // 4. Preparing Order (c2 - سارة حسن - 1 day ago) - Apple Watch Ultra 2 x1
  await simulateOrderJourney({
    orderId: "ORD-5192847190",
    user: c2,
    sessionId: "sess_c2_02",
    cartId: "cart_c2_02",
    city: "القاهرة",
    items: [{ product: p2, quantity: 1 }],
    payment: { method: "wallet", paid: true, transactionId: "VODAFONE_CASH_7721" },
    shipping: 0,
    discount: 500,
    coupon: "VIP500",
    status: "preparing",
    createdDaysAgo: 1,
    timelineSteps: [
      { status: "new", at: daysAgo(1, -2), note: "تم استلام الطلب والدفع عبر فودافون كاش" },
      { status: "confirmed", at: daysAgo(0, -14), note: "تم تأكيد استلام التحويل وإصدار الفاتورة" },
      { status: "preparing", at: daysAgo(0, -4), note: "جاري حجز القطعة في المخزن وتجهيز الملصق" }
    ]
  });

  // 5. Delivered Order (c3 - خالد عبد الله - 10 days ago) - iPhone 15 Pro Max x1 + Sony XM5 x1
  await simulateOrderJourney({
    orderId: "ORD-3129485712",
    user: c3,
    sessionId: "sess_c3_01",
    cartId: "cart_c3_01",
    city: "الجيزة",
    items: [
      { product: p3, quantity: 1 },
      { product: p1, quantity: 1 }
    ],
    payment: { method: "card", paid: true, transactionId: "TXN_PAYMOB_551920" },
    shipping: 0,
    discount: 3440,
    coupon: "WELCOME",
    status: "delivered",
    createdDaysAgo: 10,
    wishlistedProductsBeforeCart: [p3],
    timelineSteps: [
      { status: "new", at: daysAgo(10), note: "تم تقديم الطلب" },
      { status: "confirmed", at: daysAgo(9), note: "تم التأكيد" },
      { status: "preparing", at: daysAgo(8), note: "تم التحضير" },
      { status: "shipped", at: daysAgo(7), note: "تم الشحن" },
      { status: "delivered", at: daysAgo(6), note: "تم التسليم بنجاح" }
    ]
  });

  // 6. Confirmed Order (c3 - خالد عبد الله - today) - Garmin Fenix 7X Pro
  await simulateOrderJourney({
    orderId: "ORD-8819203948",
    user: c3,
    sessionId: "sess_c3_02",
    cartId: "cart_c3_02",
    city: "الجيزة",
    items: [{ product: p7, quantity: 1 }],
    payment: { method: "cod", paid: false },
    shipping: 0,
    discount: 0,
    status: "confirmed",
    createdDaysAgo: 0,
    timelineSteps: [
      { status: "new", at: daysAgo(0, -8), note: "تم استلام الطلب بنجاح" },
      { status: "confirmed", at: daysAgo(0, -2), note: "تم التواصل هاتفياً وتأكيد موعد التسليم غداً" }
    ]
  });

  // 7. Delivered Order (c4 - نورا إبراهيم - 14 days ago) - Galaxy S24 Ultra x1
  await simulateOrderJourney({
    orderId: "ORD-6677889900",
    user: c4,
    sessionId: "sess_c4_01",
    cartId: "cart_c4_01",
    city: "الإسكندرية",
    notes: "يرجى رن جرس الباب وعدم ترك الشحنة لدى حارس العقار",
    items: [{ product: p5, quantity: 1 }],
    payment: { method: "card", paid: true, transactionId: "TXN_CARD_004918" },
    shipping: 0,
    discount: 500,
    coupon: "VIP500",
    status: "delivered",
    createdDaysAgo: 14,
    wishlistedProductsBeforeCart: [p5],
    timelineSteps: [
      { status: "new", at: daysAgo(14), note: "تم استلام الطلب" },
      { status: "confirmed", at: daysAgo(13), note: "تم التأكيد" },
      { status: "shipped", at: daysAgo(12), note: "تم الشحن للإسكندرية" },
      { status: "delivered", at: daysAgo(11), note: "تم تسليم العميلة بنجاح" }
    ]
  });

  // 8. Cancelled Order #1 (c5 - طارق فهمي - 3 days ago) - MacBook Pro M3 Max
  await simulateOrderJourney({
    orderId: "ORD-1122334455",
    user: c5,
    sessionId: "sess_c5_01",
    cartId: "cart_c5_01",
    city: "القاهرة",
    items: [{ product: p4, quantity: 1 }],
    payment: { method: "card", paid: true, transactionId: "TXN_REFUNDED_1122" },
    shipping: 0,
    discount: 0,
    status: "cancelled",
    createdDaysAgo: 3,
    priceFeedbackProducts: [p4],
    timelineSteps: [
      { status: "new", at: daysAgo(3), note: "تم إنشاء الطلب" },
      { status: "confirmed", at: daysAgo(2, -12), note: "تم تأكيد الحجز" },
      { status: "cancelled", at: daysAgo(2), note: "تم إلغاء الطلب بناءً على رغبة العميل لارتفاع السعر مقارنة بالميزانية وتم رد المبلغ" }
    ]
  });

  // 9. Cancelled Order #2 (c5 - طارق فهمي - 12 days ago) - Dell XPS 15
  await simulateOrderJourney({
    orderId: "ORD-1122334499",
    user: c5,
    sessionId: "sess_c5_02",
    cartId: "cart_c5_02",
    city: "القاهرة",
    items: [{ product: p8, quantity: 1 }],
    payment: { method: "cod", paid: false },
    shipping: 0,
    discount: 0,
    status: "cancelled",
    createdDaysAgo: 12,
    priceFeedbackProducts: [p8],
    timelineSteps: [
      { status: "new", at: daysAgo(12), note: "تم إنشاء الطلب بنظام الدفع عند الاستلام" },
      { status: "cancelled", at: daysAgo(11), note: "تعذر الوصول للعميل هاتفياً لتأكيد موعد التسليم بعد 3 محاولات" }
    ]
  });

  // 10. Delivered Order (c5 - طارق فهمي - 18 days ago) - Sony XM5 x1 (shows c5 also has completed order volume!)
  await simulateOrderJourney({
    orderId: "ORD-1122334400",
    user: c5,
    sessionId: "sess_c5_03",
    cartId: "cart_c5_03",
    city: "القاهرة",
    items: [{ product: p1, quantity: 1 }],
    payment: { method: "cod", paid: true },
    shipping: 0,
    discount: 0,
    status: "delivered",
    createdDaysAgo: 18,
    timelineSteps: [
      { status: "new", at: daysAgo(18), note: "تم إنشاء الطلب" },
      { status: "confirmed", at: daysAgo(17), note: "تم التأكيد" },
      { status: "delivered", at: daysAgo(15), note: "تم التسليم وتحصيل المبلغ" }
    ]
  });

  // 11. Delivered Order (c6 - مريم عادل - 8 days ago) - Dell XPS 15 x1 + Sony XM5 x1
  await simulateOrderJourney({
    orderId: "ORD-6001928374",
    user: c6,
    sessionId: "sess_c6_01",
    cartId: "cart_c6_01",
    city: "الجيزة",
    items: [
      { product: p8, quantity: 1 },
      { product: p1, quantity: 1 }
    ],
    payment: { method: "card", paid: true, transactionId: "TXN_PAYMOB_600192" },
    shipping: 0,
    discount: 8380,
    coupon: "FAR2026",
    status: "delivered",
    createdDaysAgo: 8,
    wishlistedProductsBeforeCart: [p8],
    timelineSteps: [
      { status: "new", at: daysAgo(8), note: "تم استلام الطلب والدفع" },
      { status: "confirmed", at: daysAgo(7), note: "تم التأكيد" },
      { status: "shipped", at: daysAgo(6), note: "تم الشحن" },
      { status: "delivered", at: daysAgo(5), note: "تم التسليم بنجاح" }
    ]
  });

  // 12. Returned Order (c8 - هدى عبد الرحمن - 16 days ago) - AirPods Max x1 (Delivered then Returned)
  await simulateOrderJourney({
    orderId: "ORD-8009182736",
    user: c8,
    sessionId: "sess_c8_01",
    cartId: "cart_c8_01",
    city: "الجيزة",
    items: [{ product: p6, quantity: 1 }],
    payment: { method: "card", paid: true, transactionId: "TXN_PAYMOB_800918" },
    shipping: 0,
    discount: 0,
    status: "returned",
    createdDaysAgo: 16,
    timelineSteps: [
      { status: "new", at: daysAgo(16), note: "تم إنشاء الطلب" },
      { status: "confirmed", at: daysAgo(15), note: "تم التأكيد" },
      { status: "shipped", at: daysAgo(14), note: "تم الشحن" },
      { status: "delivered", at: daysAgo(13), note: "تم التسليم للعميلة" },
      { status: "returned", at: daysAgo(11), note: "طلب استرجاع خلال مهلة الـ 14 يوم بسبب عدم مناسبة وزن السماعة للاستخدام الطويل" }
    ]
  });

  // 13. Cancelled Order (c8 - هدى عبد الرحمن - 6 days ago) - iPhone 15 Pro Max x1
  await simulateOrderJourney({
    orderId: "ORD-8009182799",
    user: c8,
    sessionId: "sess_c8_02",
    cartId: "cart_c8_02",
    city: "الجيزة",
    items: [{ product: p3, quantity: 1 }],
    payment: { method: "cod", paid: false },
    shipping: 0,
    discount: 0,
    status: "cancelled",
    createdDaysAgo: 6,
    priceFeedbackProducts: [p3],
    timelineSteps: [
      { status: "new", at: daysAgo(6), note: "تم إنشاء الطلب" },
      { status: "cancelled", at: daysAgo(5), note: "العميلة طلبت الإلغاء قبل الشحن لانتظار عرض خصم إضافي" }
    ]
  });

  // 14. Delivered Order (c7 - يوسف كمال - 21 days ago) - MacBook Pro M3 Max x1
  await simulateOrderJourney({
    orderId: "ORD-7001122334",
    user: c7,
    sessionId: "sess_c7_01",
    cartId: "cart_c7_01",
    city: "الإسكندرية",
    items: [{ product: p4, quantity: 1 }],
    payment: { method: "card", paid: true, transactionId: "TXN_PAYMOB_700112" },
    shipping: 0,
    discount: 500,
    coupon: "VIP500",
    status: "delivered",
    createdDaysAgo: 21,
    wishlistedProductsBeforeCart: [p4],
    timelineSteps: [
      { status: "new", at: daysAgo(21), note: "تم إنشاء الطلب" },
      { status: "confirmed", at: daysAgo(20), note: "تم التأكيد" },
      { status: "shipped", at: daysAgo(19), note: "تم الشحن" },
      { status: "delivered", at: daysAgo(18), note: "تم التسليم بنجاح" }
    ]
  });

  // --- Previous Period Orders (32 to 44 days ago) for accurate Previous-Period Comparison Deltas ---

  // 15. Delivered Order in Previous Period (c1 - 35 days ago) - Sony XM5 x2 + AirPods Max x1
  await simulateOrderJourney({
    orderId: "ORD-3500112233",
    user: c1,
    sessionId: "sess_c1_prev1",
    cartId: "cart_c1_prev1",
    city: "القاهرة",
    items: [
      { product: p1, quantity: 2 },
      { product: p6, quantity: 1 }
    ],
    payment: { method: "card", paid: true, transactionId: "TXN_PREV_3500" },
    shipping: 0,
    discount: 4410,
    coupon: "FAR2026",
    status: "delivered",
    createdDaysAgo: 35,
    wishlistedProductsBeforeCart: [p1],
    timelineSteps: [
      { status: "new", at: daysAgo(35), note: "تم استلام الطلب" },
      { status: "confirmed", at: daysAgo(34), note: "تم التأكيد" },
      { status: "delivered", at: daysAgo(32), note: "تم التسليم" }
    ]
  });

  // 16. Delivered Order in Previous Period (c3 - 38 days ago) - Apple Watch Ultra 2 x1
  await simulateOrderJourney({
    orderId: "ORD-3800112233",
    user: c3,
    sessionId: "sess_c3_prev1",
    cartId: "cart_c3_prev1",
    city: "الجيزة",
    items: [{ product: p2, quantity: 1 }],
    payment: { method: "cod", paid: true },
    shipping: 0,
    discount: 0,
    status: "delivered",
    createdDaysAgo: 38,
    timelineSteps: [
      { status: "new", at: daysAgo(38), note: "تم استلام الطلب" },
      { status: "delivered", at: daysAgo(36), note: "تم التسليم" }
    ]
  });

  // 17. Delivered Order in Previous Period (c6 - 41 days ago) - iPhone 15 Pro Max x1
  await simulateOrderJourney({
    orderId: "ORD-4100112233",
    user: c6,
    sessionId: "sess_c6_prev1",
    cartId: "cart_c6_prev1",
    city: "الجيزة",
    items: [{ product: p3, quantity: 1 }],
    payment: { method: "card", paid: true, transactionId: "TXN_PREV_4100" },
    shipping: 0,
    discount: 0,
    status: "delivered",
    createdDaysAgo: 41,
    timelineSteps: [
      { status: "new", at: daysAgo(41), note: "تم استلام الطلب" },
      { status: "delivered", at: daysAgo(39), note: "تم التسليم" }
    ]
  });

  // 18. Cancelled Order in Previous Period (c5 - 42 days ago) - Garmin Fenix 7X Pro x1
  await simulateOrderJourney({
    orderId: "ORD-4200112233",
    user: c5,
    sessionId: "sess_c5_prev1",
    cartId: "cart_c5_prev1",
    city: "القاهرة",
    items: [{ product: p7, quantity: 1 }],
    payment: { method: "cod", paid: false },
    shipping: 0,
    discount: 0,
    status: "cancelled",
    createdDaysAgo: 42,
    timelineSteps: [
      { status: "new", at: daysAgo(42), note: "تم استلام الطلب" },
      { status: "cancelled", at: daysAgo(41), note: "إلغاء بناءً على طلب العميل" }
    ]
  });

  // ----------------------------------------------------------------------------
  // B. Simulated Abandoned Carts (>24h old, with views, cart additions, some removals & checkout drop-offs)
  // ----------------------------------------------------------------------------
  const abandonedCartScenarios = [
    {
      user: c2,
      visitorId: `vis_user_${String(c2._id).slice(-6)}`,
      sessionId: "sess_abund_c2",
      cartId: "cart_abandoned_01",
      days: 4,
      products: [p4, p6],
      removedProduct: p4,
      reachedCheckout: true,
      priceFeedback: p4
    },
    {
      user: c4,
      visitorId: `vis_user_${String(c4._id).slice(-6)}`,
      sessionId: "sess_abund_c4",
      cartId: "cart_abandoned_02",
      days: 6,
      products: [p3, p2],
      removedProduct: null,
      reachedCheckout: true,
      priceFeedback: p3
    },
    {
      user: c7,
      visitorId: `vis_user_${String(c7._id).slice(-6)}`,
      sessionId: "sess_abund_c7",
      cartId: "cart_abandoned_03",
      days: 9,
      products: [p8],
      removedProduct: null,
      reachedCheckout: false,
      priceFeedback: p8
    },
    {
      user: null,
      visitorId: "vis_anon_cart_04",
      sessionId: "sess_abund_04",
      cartId: "cart_abandoned_04",
      days: 11,
      products: [p1, p2],
      removedProduct: p2,
      reachedCheckout: true,
      priceFeedback: null
    },
    {
      user: null,
      visitorId: "vis_anon_cart_05",
      sessionId: "sess_abund_05",
      cartId: "cart_abandoned_05",
      days: 15,
      products: [p5],
      removedProduct: null,
      reachedCheckout: false,
      priceFeedback: p5
    },
    {
      user: null,
      visitorId: "vis_anon_cart_06",
      sessionId: "sess_abund_06",
      cartId: "cart_abandoned_06",
      days: 19,
      products: [p3],
      removedProduct: null,
      reachedCheckout: false,
      priceFeedback: p3
    },
    {
      user: null,
      visitorId: "vis_anon_cart_07",
      sessionId: "sess_abund_07",
      cartId: "cart_abandoned_07",
      days: 24,
      products: [p4],
      removedProduct: p4,
      reachedCheckout: false,
      priceFeedback: p4
    },
    // Previous period abandoned carts (33 and 37 days ago)
    {
      user: null,
      visitorId: "vis_anon_cart_prev1",
      sessionId: "sess_abund_prev1",
      cartId: "cart_abandoned_prev1",
      days: 33,
      products: [p3, p1],
      removedProduct: null,
      reachedCheckout: true,
      priceFeedback: p3
    },
    {
      user: null,
      visitorId: "vis_anon_cart_prev2",
      sessionId: "sess_abund_prev2",
      cartId: "cart_abandoned_prev2",
      days: 37,
      products: [p4],
      removedProduct: null,
      reachedCheckout: false,
      priceFeedback: p4
    }
  ];

  for (const sc of abandonedCartScenarios) {
    const t0 = daysAgo(sc.days, -3);
    sc.products.forEach((prod, idx) => {
      pushActivity({
        eventType: "product_viewed",
        product: prod,
        user: sc.user,
        visitorId: sc.visitorId,
        sessionId: sc.sessionId,
        occurredAt: new Date(t0.getTime() + idx * 3 * MIN_MS)
      });
      pushActivity({
        eventType: "add_to_cart",
        product: prod,
        user: sc.user,
        visitorId: sc.visitorId,
        sessionId: sc.sessionId,
        cartId: sc.cartId,
        quantity: 1,
        occurredAt: new Date(t0.getTime() + (12 + idx * 3) * MIN_MS)
      });
    });

    if (sc.removedProduct) {
      pushActivity({
        eventType: "remove_from_cart",
        product: sc.removedProduct,
        user: sc.user,
        visitorId: sc.visitorId,
        sessionId: sc.sessionId,
        cartId: sc.cartId,
        quantity: 1,
        occurredAt: new Date(t0.getTime() + 25 * MIN_MS)
      });
    }

    if (sc.reachedCheckout) {
      pushActivity({
        eventType: "checkout_started",
        product: sc.products[0],
        user: sc.user,
        visitorId: sc.visitorId,
        sessionId: sc.sessionId,
        cartId: sc.cartId,
        quantity: 1,
        occurredAt: new Date(t0.getTime() + 30 * MIN_MS)
      });
    }

    if (sc.priceFeedback) {
      pushActivity({
        eventType: "price_feedback",
        product: sc.priceFeedback,
        user: sc.user,
        visitorId: sc.visitorId,
        sessionId: sc.sessionId,
        occurredAt: new Date(t0.getTime() + 35 * MIN_MS)
      });
    }
  }

  // ----------------------------------------------------------------------------
  // C. Additional Wishlist Additions & Removals for Registered Customers
  // ----------------------------------------------------------------------------
  const extraWishlistActions = [
    { user: c1, product: p3, action: "wishlist_added", days: 12 },
    { user: c1, product: p4, action: "wishlist_added", days: 9 },
    { user: c2, product: p3, action: "wishlist_added", days: 14 },
    { user: c2, product: p7, action: "wishlist_added", days: 10 },
    { user: c2, product: p7, action: "wishlist_removed", days: 8 },
    { user: c3, product: p4, action: "wishlist_added", days: 11 },
    { user: c4, product: p1, action: "wishlist_added", days: 7 },
    { user: c4, product: p6, action: "wishlist_added", days: 5 },
    { user: c4, product: p6, action: "wishlist_removed", days: 3 },
    { user: c5, product: p4, action: "wishlist_added", days: 6 },
    { user: c5, product: p8, action: "wishlist_added", days: 13 },
    { user: c6, product: p2, action: "wishlist_added", days: 4 },
    { user: c7, product: p3, action: "wishlist_added", days: 15 },
    { user: c8, product: p5, action: "wishlist_added", days: 9 },
    { user: c8, product: p2, action: "wishlist_added", days: 7 },
    { user: c8, product: p2, action: "wishlist_removed", days: 5 }
  ];

  for (const wl of extraWishlistActions) {
    pushActivity({
      eventType: wl.action,
      product: wl.product,
      user: wl.user,
      visitorId: `vis_user_${String(wl.user._id).slice(-6)}`,
      sessionId: `sess_wl_${String(wl.user._id).slice(-4)}_${wl.days}`,
      occurredAt: daysAgo(wl.days, -4)
    });
  }

  // ----------------------------------------------------------------------------
  // D. Organic Daily Browsing Sessions & Price Feedback Signals Over Last 44 Days
  // ----------------------------------------------------------------------------
  // Weighted popularity so rankings are distinct and realistic:
  // p3 (iPhone 15 Pro Max) -> most viewed
  // p1 (Sony XM5) -> high views & highest unit sales
  // p5 (Galaxy S24 Ultra) -> high views
  // p2 (Apple Watch Ultra 2) -> strong views & sales
  // p4 (MacBook Pro M3 Max) -> highest price_feedback signal rate
  // p8 (Dell XPS 15) -> second highest price_feedback signal rate
  const browsingSchedule = [
    { product: p3, viewsCurrent30d: 42, viewsPrev30d: 18, priceFeedbackCurrent: 7, priceFeedbackPrev: 2 },
    { product: p1, viewsCurrent30d: 36, viewsPrev30d: 15, priceFeedbackCurrent: 1, priceFeedbackPrev: 1 },
    { product: p5, viewsCurrent30d: 31, viewsPrev30d: 14, priceFeedbackCurrent: 4, priceFeedbackPrev: 1 },
    { product: p2, viewsCurrent30d: 27, viewsPrev30d: 12, priceFeedbackCurrent: 3, priceFeedbackPrev: 1 },
    { product: p4, viewsCurrent30d: 24, viewsPrev30d: 11, priceFeedbackCurrent: 11, priceFeedbackPrev: 4 },
    { product: p6, viewsCurrent30d: 21, viewsPrev30d: 9, priceFeedbackCurrent: 3, priceFeedbackPrev: 1 },
    { product: p8, viewsCurrent30d: 19, viewsPrev30d: 8, priceFeedbackCurrent: 6, priceFeedbackPrev: 2 },
    { product: p7, viewsCurrent30d: 15, viewsPrev30d: 7, priceFeedbackCurrent: 2, priceFeedbackPrev: 0 }
  ];

  const customerPool = [c1, c2, c3, c4, c5, c6, c7, c8];

  browsingSchedule.forEach((entry, pIdx) => {
    // Current 30-day browsing views spread across days 0..28
    for (let i = 0; i < entry.viewsCurrent30d; i++) {
      const dayOffset = (i * 3 + pIdx * 2) % 28;
      const isLoggedCustomer = i % 4 === 0;
      const cust = isLoggedCustomer ? customerPool[(i + pIdx) % customerPool.length] : null;
      const anonIdx = ((i + pIdx * 7) % 35) + 1;
      const visId = cust ? `vis_user_${String(cust._id).slice(-6)}` : `vis_organic_${anonIdx}`;
      const sessId = `sess_org_cur_${pIdx}_${i}`;
      const viewAt = daysAgo(dayOffset, -(i % 10), -(i * 7) % 50);

      pushActivity({
        eventType: "product_viewed",
        product: entry.product,
        user: cust,
        visitorId: visId,
        sessionId: sessId,
        occurredAt: viewAt
      });

      if (i < entry.priceFeedbackCurrent) {
        pushActivity({
          eventType: "price_feedback",
          product: entry.product,
          user: cust,
          visitorId: visId,
          sessionId: sessId,
          occurredAt: new Date(viewAt.getTime() + 2 * MIN_MS)
        });
      }
    }

    // Previous 30-day period browsing views spread across days 31..44
    for (let i = 0; i < entry.viewsPrev30d; i++) {
      const dayOffset = 31 + ((i * 2 + pIdx) % 14);
      const anonIdx = ((i + pIdx * 5) % 20) + 101;
      const visId = `vis_organic_prev_${anonIdx}`;
      const sessId = `sess_org_prev_${pIdx}_${i}`;
      const viewAt = daysAgo(dayOffset, -(i % 8), -(i * 5) % 50);

      pushActivity({
        eventType: "product_viewed",
        product: entry.product,
        user: null,
        visitorId: visId,
        sessionId: sessId,
        occurredAt: viewAt
      });

      if (i < entry.priceFeedbackPrev) {
        pushActivity({
          eventType: "price_feedback",
          product: entry.product,
          user: null,
          visitorId: visId,
          sessionId: sessId,
          occurredAt: new Date(viewAt.getTime() + 2 * MIN_MS)
        });
      }
    }
  });

  // Bulk insert all simulated Activity records
  await Activity.insertMany(activityDocs);

  // Synchronize every product's visited & salesCount fields with the exact simulated events
  for (const prod of allProducts) {
    const pKey = String(prod._id);
    const exactViews = productViewsCounter.get(pKey) || 0;
    const exactSales = productSalesCounter.get(pKey) || 0;
    await Products.findByIdAndUpdate(prod._id, {
      $set: {
        visited: exactViews,
        salesCount: exactSales
      }
    });
  }

  // Synchronize every customer's wishlist array with their net wishlist_added / wishlist_removed events
  for (const cust of customerPool) {
    const uKey = String(cust._id);
    const wishSet = userWishlistMap.get(uKey) || new Set();
    const wishIds = Array.from(wishSet).map((idStr) => productById.get(idStr)._id);
    await Users.findByIdAndUpdate(cust._id, { $set: { wishlist: wishIds } });
  }

  // Seed realistic Admin-Managed AI Instructions for Product Search Planner
  const AiInstruction = require("../modules/ai-instructions/aiInstructionModel")("localhost");
  const { createInstruction } = require("../modules/ai-instructions/aiInstructionService");
  await AiInstruction.deleteMany({});

  await createInstruction("localhost", {
    title: "ترشيح سماعات السفر والطيران وعزل الضوضاء",
    content:
      "عندما يبحث العميل عن سماعة للسفر أو الطيران أو المذاكرة في الأماكن المزدحمة أو يطلب عزل ضوضاء قوي، ركز على قسم الصوتيات والسماعات ورشح سوني WH-1000XM5 في المقدمة لبطاريتها التي تدوم 30 ساعة وخفة وزنها.",
    scopeType: "category",
    categoryIds: [cat3._id],
    tags: ["سفر", "طيران", "عزل ضوضاء", "مذاكرة", "سماعات", "هدوء"],
    priority: 25,
    active: true
  });

  await createInstruction("localhost", {
    title: "توجيهات أجهزة اللابتوب للبرمجة والتصميم بميزانية متوازنة",
    content:
      "عندما يطلب العميل لابتوب للبرمجة أو التصميم أو الهندسة ويبحث عن أفضل قيمة مقابل السعر تحت 80,000 ج.م، رشح ديل Dell XPS 15 بشاشة OLED أولاً، واعرض ماك بوك برو M3 Max كخيار احترافي للميزانيات المفتوحة.",
    scopeType: "category",
    categoryIds: [cat4._id],
    tags: ["لابتوب", "برمجة", "تصميم", "هندسة", "ديل", "ماك بوك"],
    priority: 20,
    active: true
  });

  await createInstruction("localhost", {
    title: "ترشيح الساعات الرياضية للمغامرات والبطارية الطويلة",
    content:
      "إذا سأل العميل عن ساعة ذكية للرياضات الشاقة أو الجري أو السباحة أو تتحمل السفر الطويل بدون شحن متكرر، رشح ساعة جارمين فينيكس 7X برو الشمسية (37 يوماً) مع مقارنتها بساعة أبل واتش الترا 2.",
    scopeType: "category",
    categoryIds: [cat2._id],
    tags: ["ساعة", "رياضة", "سباحة", "بطارية", "جارمين", "مغامرات"],
    priority: 18,
    active: true
  });

  await createInstruction("localhost", {
    title: "إبراز العروض الترويجية وكوبونات التوفير للعملاء الباحثين عن خصومات",
    content:
      "عندما يسأل العميل عن منتجات عليها عروض أو خصومات أو يبحث عن توفير في الميزانية، وجّه البحث نحو المنتجات المشمولة في مهرجان العروض وذكره بإمكانية الاستفادة من كوبون FAR2026 أو VIP500.",
    scopeType: "global",
    tags: ["عروض", "خصم", "توفير", "اقتصادي", "كوبون", "رخيص"],
    priority: 15,
    active: true
  });

  await createInstruction("localhost", {
    title: "معادلة حساب قدرة التكييف المناسبة (بالحصان) حسب مساحة الغرفة بالمتر المربع",
    content:
      "عندما يسأل العميل عن تكييف لمساحة غرفة أو ريسبشن معينة بالمتر المربع، اعتمد المعادلة القياسية في السوق المصري: كل 1 حصان يغطي من 8 إلى 10 متر مربع في الأدوار العادية (ومن 7 إلى 8 متر مربع فقط إذا كانت الغرفة في الدور الأخير أو معرضة للشمس المباشرة/واجهة قبلي).\n" +
      "جدول الحد الأدنى للقدرة الحصانية المطلوبة حسب المساحة:\n" +
      "- مساحة حتى 12 متر مربع (من 8 إلى 12 م²): تحتاج تكييف 1.5 حصان على الأقل.\n" +
      "- مساحة من 13 إلى 18 متر مربع (وحتى 20 م² في الأدوار البينية غير المشمسة): تحتاج تكييف 2.25 حصان على الأقل.\n" +
      "- مساحة من 19 إلى 24 متر مربع (وحتى 25 م²): تحتاج تكييف 3 حصان على الأقل.\n" +
      "- مساحة من 25 إلى 32 متر مربع: تحتاج تكييف 4 حصان على الأقل.\n" +
      "- مساحة من 33 إلى 40 متر مربع: تحتاج تكييف 5 حصان على الأقل.\n" +
      "- مساحة من 41 إلى 48 متر مربع: تحتاج تكييف 6 حصان على الأقل.\n" +
      "طبّق هذه القاعدة في اختيار فلتر القدرة الحصانية (specFilters / searchKeywords) بحيث لا ترشح قدرة أقل من الحد الأدنى للمساحة المذكورة، واشرح الحسبة للعميل بوضوح في الرد.",
    scopeType: "global",
    tags: [
      "تكييف",
      "تكييفات",
      "مكيف",
      "حصان",
      "مساحة",
      "غرفة",
      "أوضة",
      "ريسبشن",
      "متر",
      "متر مربع",
      "انفرتر",
      "تبريد"
    ],
    priority: 30,
    active: true
  });

  await createInstruction("localhost", {
    title: "تعليمة موسمية معطلة (مثال لتعليمة غير نشطة)",
    content:
      "توجيه مؤقت لحملة الجمعة البيضاء السابقة — لا يتم حقنه في المخطط طالما أنه في حالة معطل.",
    scopeType: "global",
    tags: ["الجمعة البيضاء", "موسم"],
    priority: 5,
    active: false
  });

  console.log("Seeding & Activity Simulation finished successfully!");
  console.log("--------------------------------------------------");
  console.log("Admin Login:         admin@store.com / admin123");
  console.log("Customers Created:   8 customers with synchronized wishlists & order histories");
  console.log("Orders Simulated:    18 orders (12 delivered, 3 active, 4 cancelled, 1 returned across periods)");
  console.log(`Activities Recorded: ${activityDocs.length} cohesive storeActivity documents`);
  console.log("AI Instructions:     6 admin instructions seeded & vector-synced (5 active incl. AC area formula, 1 disabled)");
  console.log("--------------------------------------------------");

  await conn.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
