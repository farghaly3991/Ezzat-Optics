/**
 * Multi-Branch Seeding & Architecture Setup Script
 *
 * 1. Promotes primary admin (admin@store.com) to Super Admin (role: 5).
 * 2. Creates 3 complete branches:
 *    - Branch 1: الفرع الرئيسي - القاهرة (المعادي) [isMain: true]
 *    - Branch 2: فرع الإسكندرية (سموحة) [Manager: alex_manager@store.com, role: 4]
 *    - Branch 3: فرع الجيزة (الشيخ زايد) [Manager: giza_manager@store.com, role: 4]
 * 3. Populates ~50 realistic products per branch with real categories, specs, prices, images, and embeddings.
 * 4. Seeds realistic orders, activity logs, inventory movements, and staff per branch.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getActivityModel = require("../modules/activity/activityModel");
const getInventoryMovementModel = require("../modules/finance/inventory/inventoryMovementModel");

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

async function seedMultiBranchSystem() {
  console.log("=== Starting Multi-Branch Architecture Seeding ===");
  console.log(`Connecting to tenant [${SUBDOMAIN}] database...`);

  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Products = getProductsModel(SUBDOMAIN);
  const Categories = getCategoriesModel(SUBDOMAIN);
  const Orders = getOrdersModel(SUBDOMAIN);
  const Activity = getActivityModel(SUBDOMAIN);
  const InventoryMovement = getInventoryMovementModel(SUBDOMAIN);

  // 1. Update / Ensure Super Admin (Role 5)
  console.log("\n[Step 1] Promoting / Ensuring Super Admin (Role 5)...");
  let superAdmin = await Users.findOne({ email: "admin@store.com" });
  if (superAdmin) {
    superAdmin.role = 5;
    superAdmin.fullname = "المدير العام والتنفيذي (Super Admin)";
    await superAdmin.save();
    console.log(`✓ Updated admin@store.com to Super Admin (Role: 5)`);
  } else {
    superAdmin = await Users.create({
      email: "admin@store.com",
      password: "admin",
      fullname: "المدير العام والتنفيذي (Super Admin)",
      phone: "01000000000",
      role: 5,
      active: true
    });
    console.log(`✓ Created new admin@store.com as Super Admin (Role: 5)`);
  }

  // 2. Create Branch Managers (Role 4)
  console.log("\n[Step 2] Setting up Branch Managers (Role 4)...");
  let alexManager = await Users.findOne({ email: "alex_manager@store.com" });
  if (!alexManager) {
    alexManager = await Users.create({
      email: "alex_manager@store.com",
      password: "admin",
      fullname: "م. حسام الدين السكندري (مدير فرع الإسكندرية)",
      phone: "01033334444",
      city: "الإسكندرية",
      role: 4,
      active: true
    });
  } else {
    alexManager.role = 4;
    await alexManager.save();
  }
  console.log(`✓ Branch Manager (Alexandria): alex_manager@store.com (Role: 4)`);

  let gizaManager = await Users.findOne({ email: "giza_manager@store.com" });
  if (!gizaManager) {
    gizaManager = await Users.create({
      email: "giza_manager@store.com",
      password: "admin",
      fullname: "أ. كريم عبد الشكور (مدير فرع الشيخ زايد)",
      phone: "01055556666",
      city: "الجيزة",
      role: 4,
      active: true
    });
  } else {
    gizaManager.role = 4;
    await gizaManager.save();
  }
  console.log(`✓ Branch Manager (Giza): giza_manager@store.com (Role: 4)`);

  // 3. Create or Update 3 Branches
  console.log("\n[Step 3] Creating / Updating 3 Physical Branches...");
  const branchesConfig = [
    {
      code: "MAIN-CAI",
      name: "الفرع الرئيسي - القاهرة (المعادي)",
      city: "القاهرة",
      address: "شارع 9، دجلة، المعادي، القاهرة",
      phone: "01011112222",
      whatsapp: "01011112222",
      managerId: superAdmin._id,
      isMain: true,
      active: true,
      image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"
    },
    {
      code: "ALEX-SMH",
      name: "فرع الإسكندرية (سموحة)",
      city: "الإسكندرية",
      address: "ميدان فيكتور عمانويل، سموحة، الإسكندرية",
      phone: "01033334444",
      whatsapp: "01033334444",
      managerId: alexManager._id,
      isMain: false,
      active: true,
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800"
    },
    {
      code: "GIZA-ZAYED",
      name: "فرع الجيزة (الشيخ زايد)",
      city: "الجيزة",
      address: "محور 26 يوليو، مدخل زايد 1، هايبر ون، الشيخ زايد",
      phone: "01055556666",
      whatsapp: "01055556666",
      managerId: gizaManager._id,
      isMain: false,
      active: true,
      image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800"
    }
  ];

  const branchDocs = [];
  for (const bConf of branchesConfig) {
    let branch = await Branch.findOne({ code: bConf.code });
    if (!branch) {
      branch = await Branch.create(bConf);
    } else {
      Object.assign(branch, bConf);
      await branch.save();
    }
    branchDocs.push(branch);
    console.log(`✓ Branch ready: ${branch.name} [Code: ${branch.code}, ID: ${branch._id}]`);
  }

  const [b1, b2, b3] = branchDocs;

  // Link Managers to their branchId
  superAdmin.branchId = b1._id;
  await superAdmin.save();

  alexManager.branchId = b2._id;
  await alexManager.save();

  gizaManager.branchId = b3._id;
  await gizaManager.save();

  // 4. Update Existing Products -> Link to Branch 1
  console.log("\n[Step 4] Linking existing catalog to Main Branch (Cairo)...");
  const updateExistingRes = await Products.updateMany(
    { $or: [{ branchId: null }, { branchId: { $exists: false } }] },
    { $set: { branchId: b1._id } }
  );
  console.log(`✓ Linked ${updateExistingRes.modifiedCount} existing products to Branch 1.`);

  // Load Categories for Generating New Products
  const categories = await Categories.find().lean();
  const catMap = {};
  categories.forEach((c) => {
    catMap[c.name] = c._id;
  });

  const defaultCatId = categories[0]?._id;

  // Helper template products
  const productTemplates = [
    {
      namePrefix: "لابتوب جيمينج",
      cat: "أجهزة كمبيوتر ولابتوب",
      prices: [42000, 56000, 68000, 85000, 95000],
      brands: ["ASUS ROG", "Lenovo Legion", "Acer Predator", "MSI Katana", "HP Omen"],
      specs: { "المعالج": "Intel Core i7 13th Gen", "الرام": "16GB DDR5", "كرت الشاشة": "RTX 4060 8GB", "الشاشة": "165Hz IPS" },
      image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600"
    },
    {
      namePrefix: "لابتوب بيزنس نحيف",
      cat: "أجهزة كمبيوتر ولابتوب",
      prices: [28000, 34000, 41000, 49000],
      brands: ["Dell Latitude", "ThinkPad T14", "HP EliteBook", "ZenBook OLED"],
      specs: { "المعالج": "Intel Core i5 / AMD Ryzen 7", "الرام": "16GB", "التخزين": "512GB NVMe SSD", "الوزن": "1.3 كجم" },
      image: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600"
    },
    {
      namePrefix: "هاتف ذكي رائد",
      cat: "إلكترونيات وهواتف",
      prices: [22000, 31000, 44000, 58000],
      brands: ["Samsung Galaxy S24", "Xiaomi 14 Ultra", "iPhone 15 Pro", "OnePlus 12", "Google Pixel 8 Pro"],
      specs: { "الشاشة": "AMOLED 120Hz", "الذاكرة": "256GB / 512GB", "الكاميرا": "50MP OIS Ultra Vision", "الشحن": "67W Fast Charge" },
      image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600"
    },
    {
      namePrefix: "هاتف اقتصادي متميز",
      cat: "إلكترونيات وهواتف",
      prices: [6500, 8200, 10500, 13000],
      brands: ["Redmi Note 13", "Samsung Galaxy A25", "Realme 12", "Infinix Note 40"],
      specs: { "البطارية": "5000mAh", "الشاشة": "FHD+ 90Hz", "الكاميرا": "108MP", "الرام": "8GB" },
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600"
    },
    {
      namePrefix: "ساعة ذكية رياضية",
      cat: "ساعات وإكسسوارات ذكية",
      prices: [3500, 5800, 8900, 14500],
      brands: ["Huawei Watch GT 4", "Amazfit GTR 4", "Galaxy Watch 6", "Apple Watch SE"],
      specs: { "مقاومة الماء": "5ATM", "البطارية": "حتى 14 يوماً", "المستشعرات": "نبضات القلب + SpO2 + GPS" },
      image: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600"
    },
    {
      namePrefix: "سماعة رأس لاسلكية عازلة للضوضاء",
      cat: "ساعات وإكسسوارات ذكية",
      prices: [2400, 4800, 7500, 11000],
      brands: ["Sony WH-1000XM5", "Bose QuietComfort", "Anker Soundcore Space One", "JBL Live 660NC"],
      specs: { "نوع العزل": "ANC نشط متكيف", "عمر البطارية": "40 ساعة تشغيل", "الاتصال": "Bluetooth 5.3 + AUX" },
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"
    },
    {
      namePrefix: "شاشة ألعاب احترافية",
      cat: "أجهزة كمبيوتر ولابتوب",
      prices: [9500, 14000, 19500, 26000],
      brands: ["Samsung Odyssey G5 27", "LG UltraGear 32 QHD", "ASUS TUF 24 165Hz", "BenQ ZOWIE 240Hz"],
      specs: { "التردد": "165Hz - 240Hz", "الدقة": "2K QHD 2560x1440", "زمن الاستجابة": "1ms GtG", "المنافذ": "DisplayPort + 2x HDMI" },
      image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600"
    },
    {
      namePrefix: "مكيف هواء انفرتر ذكي",
      cat: "أجهزة منزلية وتكييفات",
      prices: [24000, 31000, 42000, 54000],
      brands: ["شارب انفرتر 1.5 حصان", "كارير بلازما جرين 2.25 حصان", "إل جي دول انفرتر 3 حصان", "ميديا ميشن برو 1.5 حصان"],
      specs: { "القدرة": "1.5 إلى 3 حصان", "خاصية الانفرتر": "توفير حتى 60% كهرباء", "الفلاتر": "بلازما كلاستر معقمة" },
      image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600"
    }
  ];

  // Function to seed products for a branch
  async function seedBranchProducts(branchDoc, targetTotal = 50) {
    const existingCount = await Products.countDocuments({ branchId: branchDoc._id });
    const toCreate = Math.max(0, targetTotal - existingCount);
    console.log(`Branch [${branchDoc.name}]: existing ${existingCount} products, creating ${toCreate} new products...`);

    const newDocs = [];
    let counter = 1;

    for (const tpl of productTemplates) {
      if (newDocs.length >= toCreate) break;
      const catId = catMap[tpl.cat] || defaultCatId;

      for (let i = 0; i < tpl.brands.length; i++) {
        if (newDocs.length >= toCreate) break;
        const brand = tpl.brands[i];
        const price = tpl.prices[i % tpl.prices.length];
        const oldPrice = Math.round(price * 1.15);
        const costPrice = Math.round(price * 0.78);
        const stockCount = Math.floor(Math.random() * 25) + 3;

        const prodName = `${tpl.namePrefix} ${brand} موديل ${2026 - (i % 2)}`;

        newDocs.push({
          branchId: branchDoc._id,
          categoryId: catId,
          name: prodName,
          price,
          oldPrice,
          costPrice,
          stockCount,
          warrantyPeriodMonths: 12,
          warrantyPolicy: "ضمان محلي شامل 12 شهراً ضد عيوب الصناعة مع استبدال فوري خلال 14 يوماً",
          images: [tpl.image],
          description: `منتج عالي الجودة (${prodName}) متوفر للشحن الفوري أو الاستلام من ${branchDoc.name}. خاضع للفحص المعتمد والضمان الرسمي.`,
          specs: tpl.specs,
          tags: [brand, tpl.cat, branchDoc.city, "عروض_خاصة"],
          active: true,
          salesCount: Math.floor(Math.random() * 30),
          barcode: `${branchDoc.code}-${counter.toString().padStart(4, "0")}`
        });
        counter++;
      }
    }

    // If still need more, duplicate templates with variation numbers
    while (newDocs.length < toCreate) {
      const tpl = productTemplates[counter % productTemplates.length];
      const catId = catMap[tpl.cat] || defaultCatId;
      const brand = tpl.brands[counter % tpl.brands.length];
      const price = tpl.prices[counter % tpl.prices.length];

      newDocs.push({
        branchId: branchDoc._id,
        categoryId: catId,
        name: `${tpl.namePrefix} ${brand} إصدار Pro #${counter}`,
        price: price + (counter * 100),
        oldPrice: Math.round(price * 1.12),
        costPrice: Math.round(price * 0.75),
        stockCount: Math.floor(Math.random() * 20) + 2,
        warrantyPeriodMonths: 12,
        warrantyPolicy: "ضمان رسمي 12 شهراً معتمد",
        images: [tpl.image],
        description: `إصدار حصري متوفر لدى ${branchDoc.name}.`,
        specs: tpl.specs,
        tags: [brand, tpl.cat, branchDoc.city],
        active: true,
        salesCount: Math.floor(Math.random() * 15),
        barcode: `${branchDoc.code}-${counter.toString().padStart(4, "0")}`
      });
      counter++;
    }

    if (newDocs.length > 0) {
      await Products.insertMany(newDocs);
      console.log(`✓ Inserted ${newDocs.length} products for ${branchDoc.name}`);
    }
  }

  // Seed for Branch 1 (ensure 50 total)
  await seedBranchProducts(b1, 50);
  // Seed for Branch 2 (Alexandria: 50 products)
  await seedBranchProducts(b2, 50);
  // Seed for Branch 3 (Giza: 50 products)
  await seedBranchProducts(b3, 50);

  // 5. Seed Realistic Orders per Branch
  console.log("\n[Step 5] Seeding Orders and Financial Records per Branch...");
  const branches = [b1, b2, b3];
  const orderStatuses = ["delivered", "delivered", "delivered", "shipped", "preparing", "confirmed", "new", "cancelled"];

  for (const br of branches) {
    const existingOrders = await Orders.countDocuments({ branchId: br._id });
    if (existingOrders < 15) {
      const branchProds = await Products.find({ branchId: br._id }).limit(10).lean();
      const toCreateOrders = 15 - existingOrders;
      const newOrders = [];

      for (let i = 0; i < toCreateOrders; i++) {
        const prod = branchProds[i % branchProds.length];
        const status = orderStatuses[i % orderStatuses.length];
        const qty = Math.floor(Math.random() * 2) + 1;
        const total = (prod.price * qty) + 50;
        const daysAgo = Math.floor(Math.random() * 25);
        const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        newOrders.push({
          orderId: `ORD-${br.code}-${Date.now().toString(36).slice(-4)}-${i + 1}`.toUpperCase(),
          branchId: br._id,
          customer: {
            name: `عميل ${br.city} #${i + 1}`,
            phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
            email: `client_${br.code.toLowerCase()}_${i}@example.com`,
            address: `${br.address}، عمارة #${i + 5}`,
            city: br.city
          },
          items: [
            {
              productId: String(prod._id),
              name: prod.name,
              price: prod.price,
              costPrice: prod.costPrice,
              quantity: qty,
              image: prod.images[0] || "",
              warrantyPeriodMonths: prod.warrantyPeriodMonths || 12,
              netLineValue: prod.price * qty,
              lineCostTotal: prod.costPrice * qty
            }
          ],
          subtotal: prod.price * qty,
          shipping: 50,
          discount: 0,
          total,
          status,
          payment: { method: "cod", paid: status === "delivered" },
          deliveryMethod: "delivery",
          timeline: [
            { status: "new", at: orderDate, note: "طلب جديد تم إنشاؤه" },
            { status, at: orderDate, note: `تم تحديث حالة الطلب إلى ${status}` }
          ],
          createdAt: orderDate,
          updatedAt: orderDate
        });
      }

      if (newOrders.length > 0) {
        await Orders.insertMany(newOrders);
        console.log(`✓ Inserted ${newOrders.length} orders for ${br.name}`);
      }
    } else {
      console.log(`✓ Branch [${br.name}] already has ${existingOrders} orders.`);
    }
  }

  // 6. Seed Realistic Activity Logs per Branch
  console.log("\n[Step 6] Seeding Activity Logs (Views, Carts, Events) per Branch...");
  for (const br of branches) {
    const existingActs = await Activity.countDocuments({ branchId: br._id });
    if (existingActs < 40) {
      const branchProds = await Products.find({ branchId: br._id }).limit(15).lean();
      const acts = [];

      branchProds.forEach((p, idx) => {
        // views
        for (let v = 0; v < 8; v++) {
          acts.push({
            branchId: br._id,
            eventType: "product_viewed",
            productId: p._id,
            visitorId: `vis_${br.code}_${idx}_${v}`,
            sessionId: `sess_${br.code}_${v}`,
            unitPrice: p.price,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 20) * 24 * 60 * 60 * 1000)
          });
        }
        // carts
        acts.push({
          branchId: br._id,
          eventType: "add_to_cart",
          productId: p._id,
          visitorId: `vis_${br.code}_${idx}_0`,
          sessionId: `sess_${br.code}_0`,
          quantity: 1,
          unitPrice: p.price,
          createdAt: new Date()
        });
      });

      if (acts.length > 0) {
        await Activity.insertMany(acts);
        console.log(`✓ Inserted ${acts.length} activity events for ${br.name}`);
      }
    }
  }

  console.log("\n=== Multi-Branch Architecture Seeding Complete! ===");
  console.log("Summary:");
  console.log("1. Super Admin: admin@store.com (Password: admin, Role: 5 - Global Access)");
  console.log("2. Branch 1: الفرع الرئيسي - القاهرة (المعادي) [Code: MAIN-CAI, isMain: true]");
  console.log("3. Branch 2: فرع الإسكندرية (سموحة) [Manager: alex_manager@store.com (Pass: admin, Role: 4)]");
  console.log("4. Branch 3: فرع الجيزة (الشيخ زايد) [Manager: giza_manager@store.com (Pass: admin, Role: 4)]");
}

seedMultiBranchSystem()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
