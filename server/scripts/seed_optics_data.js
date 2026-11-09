/**
 * Optics Store System — Initial Database Seed
 * Seeds:
 * 1. Default Branch (Main Optics Store)
 * 2. Simplified Optics Categories (Frames, Lenses, Accessories)
 * 3. Real-world Products with detailed Optics Specifications
 * 4. Realistic Customers with Full Optometry Prescriptions (OD/OS, SPH, CYL, AXIS, ADD, PD)
 */

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { getMongooseConnection, setMongooseConnection, ensureTenantConnection } = require("../core/database");
const getBranchModel = require("../modules/branches/branchModel");
const getCategoryModel = require("../modules/categories/categoryModel");
const getProductModel = require("../modules/products/productModel");
const getUsersModel = require("../modules/auth/userModel");

async function seedOpticsData() {
  const subdomain = "optics";
  console.log("Connecting to Optics database...");
  const dbUri = process.env.DEFAULT_DB;
  const conn = await ensureTenantConnection(subdomain, dbUri);
  setMongooseConnection("localhost", conn);
  console.log("Connected to MongoDB:", conn.name);

  // Models
  const Branch = getBranchModel(subdomain);
  const Category = getCategoryModel(subdomain);
  const Product = getProductModel(subdomain);
  const User = getUsersModel(subdomain);

  // 1. Ensure Main Branch
  let mainBranch = await Branch.findOne({ isMain: true });
  if (!mainBranch) {
    mainBranch = await new Branch({
      name: "الفرع الرئيسي - مركز البصريات الحديث",
      code: "OPT-MAIN",
      address: "شارع التحرير - الدقي",
      city: "الجيزة",
      phone: "01011180841",
      isMain: true,
      active: true
    }).save();
    console.log("Created Main Branch:", mainBranch.name);
  } else {
    console.log("Existing Main Branch found:", mainBranch.name);
  }

  // 2. Seed Optics Categories
  const categoriesData = [
    {
      name: "النظارات والشنابر (Frames & Eyewear)",
      slug: "frames-eyewear",
      icon: "Glasses",
      type: "product",
      order: 1,
      active: true
    },
    {
      name: "العدسات الطبية واللاصقة (Optical & Contact Lenses)",
      slug: "lenses-care",
      icon: "Eye",
      type: "product",
      order: 2,
      active: true
    },
    {
      name: "إكسسوارات ومستلزمات البصريات (Accessories)",
      slug: "accessories",
      icon: "Sparkles",
      type: "product",
      order: 3,
      active: true
    }
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    let existing = await Category.findOne({ slug: cat.slug });
    if (!existing) {
      existing = await new Category(cat).save();
      console.log("Created Category:", existing.name);
    }
    categoryMap[cat.slug] = existing._id;
  }

  // 3. Seed Realistic Optics Products
  const productsData = [
    // --- Frames & Sunglasses ---
    {
      name: "شمبر رايبان أفياتور كلاسيك - ذهبي (Ray-Ban RB3025)",
      categoryId: categoryMap["frames-eyewear"],
      branchId: mainBranch._id,
      productType: "frame",
      price: 2450,
      costPrice: 1600,
      stockCount: 15,
      barcode: "RB-3025-GOLD-58",
      opticsSpecs: {
        brand: "Ray-Ban",
        modelCode: "RB3025",
        eyewearType: "medical",
        frameStyle: "full_rim",
        frameMaterial: "معدن فائق الجودة",
        frameShape: "أفياتور Aviator",
        size: "58-14-135",
        color: "ذهبي كلاسيكي",
        gender: "unisex"
      },
      description: "إطار رايبان أفياتور الأيقوني الأصلي، مناسب لكافة أنواع العدسات الطبية والشمسية، متين ومريح للارتداء طوال اليوم."
    },
    {
      name: "شمبر لاكوست هاف فريم تيتانيوم - رمادي معدني (Lacoste L2840)",
      categoryId: categoryMap["frames-eyewear"],
      branchId: mainBranch._id,
      productType: "frame",
      price: 1850,
      costPrice: 1200,
      stockCount: 8,
      barcode: "LAC-2840-TI-54",
      opticsSpecs: {
        brand: "Lacoste",
        modelCode: "L2840",
        eyewearType: "medical",
        frameStyle: "semi_rimless",
        frameMaterial: "تيتانيوم خفيف Titanium",
        frameShape: "مستطيل Rectangular",
        size: "54-17-140",
        color: "رمادي معدني Gunmetal",
        gender: "men"
      },
      description: "شمبر لاكوست نص فريم فائق الخفة ومقاوم للصدأ والتحسس بفضل مادة التيتانيوم، مثالي للعمل ورجال الأعمال."
    },
    {
      name: "نظارة غوتشي كات آي حريمي أسيتات فاخر (Gucci GG0010S)",
      categoryId: categoryMap["frames-eyewear"],
      branchId: mainBranch._id,
      productType: "frame",
      price: 3600,
      costPrice: 2400,
      stockCount: 6,
      barcode: "GUC-0010-CAT-52",
      opticsSpecs: {
        brand: "Gucci",
        modelCode: "GG0010S",
        eyewearType: "medical",
        frameStyle: "full_rim",
        frameMaterial: "أسيتات إيطالي فاخر Acetate",
        frameShape: "كات آي Cat-Eye",
        size: "52-18-145",
        color: "أسود ملكي مع تفاصيل ذهبية",
        gender: "women"
      },
      description: "تصميم أنثوي جذاب وفخم من دار غوتشي، مناسب للنظارات الطبية أو كشمسية متميزة."
    },
    {
      name: "شمبر أطفال سيليكون مرن غير قابل للكسر (Kids Flexi Junior)",
      categoryId: categoryMap["frames-eyewear"],
      branchId: mainBranch._id,
      productType: "frame",
      price: 650,
      costPrice: 380,
      stockCount: 20,
      barcode: "KID-FLEX-BLU-46",
      opticsSpecs: {
        brand: "Nano / Junior Safe",
        modelCode: "NF46",
        eyewearType: "medical",
        frameStyle: "full_rim",
        frameMaterial: "سيليكون طبي TR90 مرن",
        frameShape: "دائري مريح",
        size: "46-15-125",
        color: "أزرق في أصفر",
        gender: "kids"
      },
      description: "شمبر أطفال مرن 360 درجة بدون مفصلات معدنية لتوفير أقصى درجات الأمان ومقاومة الكسر أثناء اللعب، مع حزام تثبيت خلفي."
    },

    // --- Lenses ---
    {
      name: "زوج عدسات بلو كت حماية شاشات مضغوطة 1.56 (Blue Cut UV420)",
      categoryId: categoryMap["lenses-care"],
      branchId: mainBranch._id,
      productType: "lens",
      price: 450,
      costPrice: 220,
      stockCount: 50,
      barcode: "LENS-BC-156-STD",
      opticsSpecs: {
        lensType: "single_vision",
        lensIndex: "1.56",
        lensBrand: "Hi-Protection / Commercial",
        lensMaterial: "Plastic (CR-39)",
        coatings: ["Blue Cut", "Anti-Reflective", "UV420", "Hard Coat"],
        isMatrixManaged: true,
        matrixStock: {
          "-1.00_-0.50": 6,
          "-1.50_-0.50": 8,
          "-2.00_-0.75": 10,
          "-2.50_-1.00": 6,
          "-3.00_-0.50": 4
        }
      },
      description: "العدسة الأكثر طلباً لحماية العين من إجهاد شاشات الموبايل والكمبيوتر، حجب كامل للضوء الأزرق الضار وتقليل الصداع وجفاف العين."
    },
    {
      name: "زوج عدسات إيسيلور كريزال إيزي برو الفرنسية 1.61 (Essilor Crizal)",
      categoryId: categoryMap["lenses-care"],
      branchId: mainBranch._id,
      productType: "lens",
      price: 1400,
      costPrice: 950,
      stockCount: 25,
      barcode: "LENS-CRIZAL-161",
      opticsSpecs: {
        lensType: "single_vision",
        lensIndex: "1.61 (عالي الضغط)",
        lensBrand: "Essilor Crizal (France)",
        lensMaterial: "High Index Polycarbonate",
        coatings: ["Anti-Reflective", "Hydrophobic (طارد للماء)", "Oleophobic (مقاوم للبصمات)", "Anti-Static", "UV400"],
        isMatrixManaged: true
      },
      description: "عدسات فرنسية فاخرة بنقاء رؤية لا مثيل له، رقيقة وخفيفة ومضادة للخدش والانعكاسات وسهلة التنظيف جداً."
    },
    {
      name: "زوج عدسات فوتوكروميك متغيرة مع الشمس 1.56 (Transitions Grey)",
      categoryId: categoryMap["lenses-care"],
      branchId: mainBranch._id,
      productType: "lens",
      price: 750,
      costPrice: 420,
      stockCount: 30,
      barcode: "LENS-PHOTO-156-GRY",
      opticsSpecs: {
        lensType: "single_vision",
        lensIndex: "1.56",
        lensBrand: "SunChange Optics",
        lensMaterial: "Plastic (CR-39)",
        coatings: ["Photochromic (تتحول لرمادي في الشمس)", "Anti-Reflective", "UV400"],
        isMatrixManaged: true
      },
      description: "عدسة 2 في 1: شفافة تماماً داخل الغرف والمكاتب، وتتحول أوتوماتيكياً للون رمادي داكن عند التعرض لأشعة الشمس لحماية العين من الوهج."
    },
    {
      name: "زوج عدسات بروجريسيف تدريجية متعددة البؤر (Progressive FreeForm 1.56)",
      categoryId: categoryMap["lenses-care"],
      branchId: mainBranch._id,
      productType: "lens",
      price: 2200,
      costPrice: 1400,
      stockCount: 15,
      barcode: "LENS-PROG-FF-156",
      opticsSpecs: {
        lensType: "progressive",
        lensIndex: "1.56",
        lensBrand: "VisionPro FreeForm",
        lensMaterial: "Resin HD",
        coatings: ["Blue Cut", "Anti-Reflective", "Hard Coat", "UV400"],
        isMatrixManaged: false
      },
      description: "عدسات تدريجية متطورة بدون خط فاصل لكبار السن ولمن يحتاجون القراءة والمسافات والكمبيوتر في نظارة واحدة بتكيف سريع ومريح."
    },
    {
      name: "عدسات لاصقة فريش لوك كولور بليندز شهرية - عسلي (FreshLook Pure Hazel)",
      categoryId: categoryMap["lenses-care"],
      branchId: mainBranch._id,
      productType: "contact_lens",
      price: 380,
      costPrice: 240,
      stockCount: 20,
      barcode: "CL-FRESH-HAZEL",
      opticsSpecs: {
        replacementDuration: "شهرية (Monthly)",
        lensColor: "عسلي طبيعي (Pure Hazel)",
        baseCurve: "8.6",
        diameter: "14.5"
      },
      description: "عدسات لاصقة ملونة بمظهر طبيعي ومريحة للعين طوال اليوم، متوفرة بمقاسات طبية وبدون مقاس (بلانو)."
    },

    // --- Accessories ---
    {
      name: "محلول تعقيم وحفظ العدسات اللاصقة رينو بلس 360 مل (ReNu MultiPlus)",
      categoryId: categoryMap["accessories"],
      branchId: mainBranch._id,
      productType: "accessory",
      price: 160,
      costPrice: 110,
      stockCount: 40,
      barcode: "ACC-RENU-360ML",
      description: "محلول رينو متعدد الأغراض لتنظيف وتعقيم وترطيب وحفظ كافة أنواع العدسات اللاصقة اللينة مع حافظة عدسات مجانية."
    }
  ];

  for (const item of productsData) {
    let existing = await Product.findOne({ barcode: item.barcode });
    if (!existing) {
      existing = await new Product(item).save();
      console.log("Created Product:", existing.name);
    } else {
      // Update opticsSpecs
      existing.opticsSpecs = item.opticsSpecs;
      existing.productType = item.productType;
      await existing.save();
      console.log("Updated Product Specs:", existing.name);
    }
  }

  // 4. Seed Realistic Customers with Detailed Eye Prescriptions
  const customersData = [
    {
      fullname: "أحمد محمد خليل",
      phone: "01012345678",
      email: "ahmed.khalil@optics-demo.com",
      password: "password123",
      address: "12 شارع مصدق - الدقي",
      city: "الجيزة",
      birthDate: new Date("1990-05-14"),
      gender: "male",
      checkupPeriodMonths: 12,
      nextCheckupDate: new Date("2027-05-14"),
      depositBalance: 200, // عنده عربون 200 جنيه تحت الحساب
      prescriptions: [
        {
          date: new Date("2026-05-14"),
          doctorName: "د. طارق الشناوي (استشاري طب وجراحة العيون)",
          clinicName: "عيادات النور التخصصية",
          usageType: "distance",
          rightEye: {
            sph: "-2.25",
            cyl: "-0.75",
            axis: "175",
            add: "0.00",
            pd: "31",
            prism: "",
            base: ""
          },
          leftEye: {
            sph: "-2.75",
            cyl: "-1.00",
            axis: "180",
            add: "0.00",
            pd: "31.5",
            prism: "",
            base: ""
          },
          ipd: "62.5",
          notes: "يفضل عدسات بلو كت للحماية من شاشات البرمجة والكمبيوتر."
        }
      ]
    },
    {
      fullname: "سارة محمود عبد العزيز",
      phone: "01198765432",
      email: "sara.mahmoud@optics-demo.com",
      password: "password123",
      address: "45 شارع عباس العقاد - مدينة نصر",
      city: "القاهرة",
      birthDate: new Date("1982-11-20"),
      gender: "female",
      checkupPeriodMonths: 6,
      nextCheckupDate: new Date("2026-12-15"),
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date("2026-06-15"),
          doctorName: "د. هشام الفقي",
          clinicName: "مركز العيون الدولي",
          usageType: "progressive",
          rightEye: {
            sph: "+1.50",
            cyl: "-0.50",
            axis: "90",
            add: "+2.00",
            pd: "30",
            prism: "",
            base: ""
          },
          leftEye: {
            sph: "+1.75",
            cyl: "-0.50",
            axis: "85",
            add: "+2.00",
            pd: "30",
            prism: "",
            base: ""
          },
          ipd: "60",
          notes: "تحتاج نظارة قراءة ومسافات بروجريسيف مدمجة بدون خط فاصل."
        }
      ]
    },
    {
      fullname: "الطفل زياد عمرو النجار",
      phone: "01234567890",
      email: "ziad.amr@optics-demo.com",
      password: "password123",
      address: "عمارة 8 الحي الأول - التجمع الخامس",
      city: "القاهرة الجديدة",
      birthDate: new Date("2016-08-10"),
      gender: "male",
      checkupPeriodMonths: 6,
      nextCheckupDate: new Date("2026-11-10"),
      depositBalance: 0,
      prescriptions: [
        {
          date: new Date("2026-05-10"),
          doctorName: "د. إيمان عبد الحميد (بصريات أطفال)",
          clinicName: "مستشفى العيون التخصصي",
          usageType: "distance",
          rightEye: {
            sph: "-1.50",
            cyl: "-1.50",
            axis: "15",
            add: "0.00",
            pd: "27",
            prism: "",
            base: ""
          },
          leftEye: {
            sph: "-1.25",
            cyl: "-1.75",
            axis: "165",
            add: "0.00",
            pd: "27",
            prism: "",
            base: ""
          },
          ipd: "54",
          notes: "استجماتيزم مركب، يوصى بشمبر سيليكون مرن وعدسات بولي كربونات مقاومة للصدمات."
        }
      ]
    }
  ];

  for (const cust of customersData) {
    let existing = await User.findOne({ phone: cust.phone });
    if (!existing) {
      existing = await new User(cust).save();
      console.log("Created Customer Record:", existing.fullname);
    } else {
      existing.prescriptions = cust.prescriptions;
      existing.birthDate = cust.birthDate;
      existing.gender = cust.gender;
      existing.nextCheckupDate = cust.nextCheckupDate;
      existing.depositBalance = cust.depositBalance;
      await existing.save();
      console.log("Updated Customer Prescriptions:", existing.fullname);
    }
  }

  console.log("\n=== Optics Seed Completed Successfully! ===");
  process.exit(0);
}

seedOpticsData().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
