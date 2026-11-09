/**
 * Seed & Test Suite: Multi-Supplier Waterfall System, Demo Roles & Accounts, and Live Test Links
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { getMongooseConnection, ensureTenantConnection } = require("../core/database");
const getUsersModel = require("../modules/auth/userModel");
const getBranchModel = require("../modules/branches/branchModel");
const getSupplierModel = require("../modules/finance/procurement/supplierModel");
const getProductsModel = require("../modules/products/productModel");
const getSupplyWaterfallRequestModel = require("../modules/finance/procurement/supplyWaterfallRequestModel");
const supplyWaterfallService = require("../modules/finance/procurement/supplyWaterfallService");
const getReturnsModel = require("../modules/returns/returnModel");
const crypto = require("crypto");

async function run() {
  const subdomain = "localhost";
  console.log("🚀 Initializing Waterfall System & Demo Accounts Seed Script...");

  const DB_URL = envJson[subdomain]?.database || envJson.localhost?.database;
  await ensureTenantConnection(subdomain, DB_URL);
  const Users = getUsersModel(subdomain);
  const Branch = getBranchModel(subdomain);
  const Supplier = getSupplierModel(subdomain);
  const Products = getProductsModel(subdomain);
  const getCategoriesModel = require("../modules/categories/categoryModel");
  const Category = getCategoriesModel(subdomain);
  const WaterfallModel = getSupplyWaterfallRequestModel(subdomain);
  const Returns = getReturnsModel(subdomain);

  // 1. Ensure Main Branch exists
  let mainBranch = await Branch.findOne({ isMain: true });
  if (!mainBranch) {
    mainBranch = await Branch.create({
      name: "الفرع الرئيسي - القاهرة (المعادي)",
      code: "CAI-01",
      city: "القاهرة",
      address: "شارع النصر، المعادي",
      phone: "01001234567",
      whatsappPhone: "01001234567",
      isMain: true,
      active: true
    });
    console.log("✓ Created Main Branch:", mainBranch.name);
  }

  // 2. Helper to upsert a user with hashed password
  async function upsertUser({ fullname, email, phone, role, branchId, passwordRaw }) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    let user = await Users.findOne({ email });
    if (user) {
      user.fullname = fullname;
      user.phone = phone;
      user.role = role;
      user.branchId = branchId;
      user.password = hashedPassword;
      await user.save();
    } else {
      user = await Users.create({
        fullname,
        email,
        phone,
        role,
        branchId,
        password: hashedPassword,
        verified: true,
        address: "القاهرة، مصر",
        city: "القاهرة"
      });
    }
    return user;
  }

  console.log("\n📦 Setting up Demo Accounts with clear roles...");
  // Super Admin (Role 5)
  const superAdmin = await upsertUser({
    fullname: "مدير النظام العام (Super Admin)",
    email: "admin@almister.com",
    phone: "01000000001",
    role: 5,
    branchId: null,
    passwordRaw: "admin123456"
  });
  console.log("✓ Super Admin (Role 5): admin@almister.com / admin123456");

  // Branch Admin (Role 4)
  const branchAdmin = await upsertUser({
    fullname: "أحمد المهدي (مدير فرع القاهرة)",
    email: "cairo.manager@almister.com",
    phone: "01000000002",
    role: 4,
    branchId: mainBranch._id,
    passwordRaw: "manager123456"
  });
  console.log("✓ Branch Admin (Role 4): cairo.manager@almister.com / manager123456");

  // Sales Staff (Role 3)
  const salesStaff = await upsertUser({
    fullname: "سارة محمود (كاشير ومبيعات القاهرة)",
    email: "cairo.sales@almister.com",
    phone: "01000000003",
    role: 3,
    branchId: mainBranch._id,
    passwordRaw: "sales123456"
  });
  console.log("✓ Sales Staff (Role 3): cairo.sales@almister.com / sales123456");

  // Technician (Role 2)
  const technician = await upsertUser({
    fullname: "م. إبراهيم خليل (فني صيانة معتمد)",
    email: "cairo.tech@almister.com",
    phone: "01000000004",
    role: 2,
    branchId: mainBranch._id,
    passwordRaw: "tech123456"
  });
  console.log("✓ Technician (Role 2): cairo.tech@almister.com / tech123456");

  // Client / Customer (Role "user")
  const customer = await upsertUser({
    fullname: "محمد طارق (عميل تجريبي)",
    email: "client.demo@almister.com",
    phone: "01000000005",
    role: "user",
    branchId: null,
    passwordRaw: "client123456"
  });
  console.log("✓ Demo Client (Customer): client.demo@almister.com / client123456");

  // 3. Setup 2 Demo Suppliers for Waterfall testing
  console.log("\n🏢 Setting up Prioritized Suppliers...");
  let sup1 = await Supplier.findOne({ phone: "01011112222" });
  if (!sup1) {
    sup1 = await Supplier.create({
      supplierCode: "SUP-NILE-01",
      name: "شركة النيل للإلكترونيات (مورد رئيسي)",
      phone: "01011112222",
      whatsappPhone: "01011112222",
      email: "supplier1@nile.com",
      specialty: "أجهزة كمبيوتر وشاشات",
      active: true
    });
  }

  let sup2 = await Supplier.findOne({ phone: "01033334444" });
  if (!sup2) {
    sup2 = await Supplier.create({
      supplierCode: "SUP-AHRAM-02",
      name: "الأهرام لتكنولوجيا المعلومات (مورد بديل)",
      phone: "01033334444",
      whatsappPhone: "01033334444",
      email: "supplier2@ahram.com",
      specialty: "قطع غيار ومستلزمات مكتبية",
      active: true
    });
  }
  console.log(`✓ Supplier 1: ${sup1.name} (Phone: ${sup1.phone})`);
  console.log(`✓ Supplier 2: ${sup2.name} (Phone: ${sup2.phone})`);

  // 4. Create/Find a product with Multi-Supplier Waterfall Priority
  let cat = await Category.findOne({});
  if (!cat) {
    cat = await Category.create({ name: "أجهزة كمبيوتر ولابتوب", slug: "laptops" });
  }

  let product = await Products.findOne({ name: "لابتوب أعمال Dell Latitude 5420 Core i7" });
  if (!product) {
    product = await Products.create({
      name: "لابتوب أعمال Dell Latitude 5420 Core i7",
      categoryId: cat._id,
      price: 25000,
      costPrice: 20000,
      stockCount: 1, // critical
      criticalStockThreshold: 3,
      reorderQuantity: 5,
      branchId: mainBranch._id,
      supplierId: sup1._id,
      suppliers: [
        {
          supplierId: sup1._id,
          supplierName: sup1.name,
          phone: sup1.phone,
          whatsapp: sup1.whatsappPhone,
          priority: 1,
          supplyCost: 20000,
          notes: "المورد المفضل للضمان"
        },
        {
          supplierId: sup2._id,
          supplierName: sup2.name,
          phone: sup2.phone,
          whatsapp: sup2.whatsappPhone,
          priority: 2,
          supplyCost: 20500,
          notes: "مورد بديل في حال عدم التوفر"
        }
      ]
    });
  } else {
    product.suppliers = [
      {
        supplierId: sup1._id,
        supplierName: sup1.name,
        phone: sup1.phone,
        whatsapp: sup1.whatsappPhone,
        priority: 1,
        supplyCost: 20000
      },
      {
        supplierId: sup2._id,
        supplierName: sup2.name,
        phone: sup2.phone,
        whatsapp: sup2.whatsappPhone,
        priority: 2,
        supplyCost: 20500
      }
    ];
    await product.save();
  }
  console.log(`✓ Linked product "${product.name}" with 2 prioritized suppliers.`);

  // 5. Test Live Waterfall Supply Request Dispatch
  console.log("\n🌊 Testing Live Waterfall Supply Request Creation...");
  const dispatchResult = await supplyWaterfallService.createWaterfallRequest(subdomain, {
    productId: product._id,
    quantity: 5,
    branchId: mainBranch._id,
    notes: "طلب استعجال توريد لنفاد المخزون بالفرع الرئيسي"
  }, { userId: superAdmin._id, role: "admin", fullname: superAdmin.fullname });

  const activeReq = dispatchResult.request;
  const sup1Token = dispatchResult.firstSupplier.token;
  console.log(`✓ Created Supply Waterfall Request: #${activeReq.requestCode}`);
  console.log(`✓ First Supplier Contacted: ${dispatchResult.firstSupplier.supplierName}`);
  console.log(`🔗 Magic Token Link for Supplier 1: ${dispatchResult.taskUrl}`);
  console.log(`💬 WhatsApp Action Link: ${dispatchResult.whatsappUrl}`);

  // Test retrieval by token
  const portalView = await supplyWaterfallService.getSupplyRequestByToken(subdomain, sup1Token);
  console.log(`✓ Portal View verified: Product=${portalView.productName}, Qty=${portalView.quantity}, Active=${portalView.isCurrentlyActive}`);

  // 6. Test Cascade on Decline: Supplier 1 Declines -> Advances to Supplier 2!
  console.log("\n❌ Simulating Supplier 1 Declining (Not available)...");
  const declineResult = await supplyWaterfallService.respondSupplyRequest(subdomain, sup1Token, {
    action: "decline",
    notes: "نعتذر بشدة، الشحنة القادمة لم تصل الميناء بعد."
  });
  console.log(`✓ Decline handled. Cascaded to: ${declineResult.cascadedTo}`);

  // Re-fetch request to get Supplier 2's new token
  const updatedReq = await WaterfallModel.findById(activeReq._id).lean();
  const sup2Node = updatedReq.chain[1];
  console.log(`✓ Supplier 2 Status: ${sup2Node.status} (Priority: ${sup2Node.priority})`);
  const sup2Token = sup2Node.token;
  const baseUrl = "http://localhost:5173";
  const sup2TaskUrl = `${baseUrl}/supplier/supply-request/${sup2Token}`;
  console.log(`🔗 Magic Token Link for Supplier 2: ${sup2TaskUrl}`);

  // 7. Test Acceptance: Supplier 2 Accepts!
  console.log("\n✅ Simulating Supplier 2 Accepting (Ready for supply)...");
  const acceptResult = await supplyWaterfallService.respondSupplyRequest(subdomain, sup2Token, {
    action: "accept",
    notes: "جاهزون للتسليم غداً صباحاً بالفرع الرئيسي."
  });
  console.log(`✓ Accept result: ${acceptResult.message}`);

  // Check performance stats
  const statsResult = await supplyWaterfallService.getSupplierPerformanceStats(subdomain);
  console.log(`✓ Supplier Performance Stats:`, JSON.stringify(statsResult.overview));

  // 8. Create a fresh test request with an active magic link ready for user clicking!
  console.log("\n✨ Creating a Fresh Live Supply Request for Immediate User Testing...");
  const liveTestDispatch = await supplyWaterfallService.createWaterfallRequest(subdomain, {
    productId: product._id,
    quantity: 10,
    branchId: mainBranch._id,
    notes: "طلب توريد اختباري لتجربة الرابط المباشر من المتصفح"
  }, { userId: superAdmin._id, role: "admin", fullname: superAdmin.fullname });

  const liveToken = liveTestDispatch.firstSupplier.token;
  const liveUrl = `http://localhost:5173/supplier/supply-request/${liveToken}`;

  // 9. Setup Live Maintenance Task for Technician Testing
  console.log("\n🔧 Setting up Live Maintenance Task for Technician Testing...");
  await Returns.deleteMany({ requestNumber: /^RMA-MAINT-DEMO/ });
  const techTaskToken = crypto.randomBytes(8).toString("hex");
  const maintenanceTicket = await Returns.create({
    requestNumber: `RMA-MAINT-DEMO-${Date.now().toString().slice(-4)}`,
    orderId: "ORD-MAINT-9921",
    customer: {
      name: "عميل تجربة الصيانة",
      phone: "01099887766",
      email: "cust.maint@example.com"
    },
    items: [
      {
        productId: product._id,
        name: "صيانة شاشة لابتوب مكسورة ومفصلات",
        quantity: 1,
        condition: "maintenance_required",
        reason: "تغيير شاشة وتركيب مفصلات أصلية"
      }
    ],
    branchId: mainBranch._id,
    isWarrantyFree: false,
    serviceFee: 350,
    partsCost: 650,
    totalMaintenanceCost: 1000,
    amountDueFromCustomer: 1000,
    status: "assigned_to_tech",
    assignedTechId: technician._id,
    techAccessToken: techTaskToken,
    techTaskTokenCreatedAt: new Date(),
    deviceDefectDescription: "الشاشة مكسورة وتحتاج استبدال عاجل، الجهاز تم استلامه بالفرع",
    deviceReceivedAtBranch: true
  });

  const techTaskUrl = `http://localhost:5173/maintenance/task/${maintenanceTicket._id}?token=${techTaskToken}`;

  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL SEEDING & INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log("\n🔑 1. USER ACCOUNTS & CREDENTIALS:");
  console.log("   • Super Admin (Role 5): admin@almister.com / admin123456");
  console.log("   • Branch Admin (Role 4): cairo.manager@almister.com / manager123456 (Cairo Branch)");
  console.log("   • Sales Staff (Role 3): cairo.sales@almister.com / sales123456 (Cairo Branch)");
  console.log("   • Technician (Role 2): cairo.tech@almister.com / tech123456 (Cairo Branch)");
  console.log("   • Customer / Client: client.demo@almister.com / client123456");

  console.log("\n🔗 2. LIVE READY-TO-TEST LINKS (No Login Required):");
  console.log(`   • [Supplier Supply Request Magic Link]: ${liveUrl}`);
  console.log(`   • [Technician Maintenance Task Magic Link]: ${techTaskUrl}`);
  console.log("=".repeat(60));
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
