/**
 * End-to-End Simulation & Test Suite: Engineer Hossam El-Din Abdallah (Main Branch - Cairo Maadi)
 *
 * Simulates and verifies the complete lifecycle for employee "م. حسام الدين عبد الله":
 * 1. Identity & Employment Profile (Permanent, 11,000 EGP salary, fixed 8h shift)
 * 2. Sales & Orders Operations (reviewing orders, updating status, adding timeline notes)
 * 3. Procurement & Supply Operations (creating supplier shipment, associating parts, receiving goods, recording payment)
 * 4. Diverse Daily Attendance Log (present, late, approved leave with medical excuse, unauthorized absence, early leave)
 * 5. Deductions & Penalties (administrative deductions with documented causes)
 * 6. Store Activities Logging (attributed to Hossam)
 * 7. Verification of Comprehensive Dossier & Calculations via staffService.getStaffProfile
 *
 * Can be run anytime via:
 * node server/tests/test_hossam_e2e_simulation.js
 */

const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getProductsModel = require("../modules/products/productModel");
const getCategoriesModel = require("../modules/categories/categoryModel");
const getSupplierModel = require("../modules/finance/procurement/supplierModel");
const getSupplierShipmentModel = require("../modules/finance/procurement/supplierShipmentModel");
const getAttendanceModel = require("../modules/branches/models/attendanceModel");
const getDeductionModel = require("../modules/branches/models/deductionModel");
const getActivityModel = require("../modules/activity/activityModel");

const {
  createSupplier,
  createSupplierShipment,
  associateProductsWithShipment,
  recordShipmentPayment
} = require("../modules/finance/procurement/procurementService");
const { receiveSupplierShipment } = require("../modules/finance/inventory/inventoryService");
const staffService = require("../modules/branches/staffService");

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

function normalizeDate(d) {
  const norm = new Date(d);
  norm.setHours(0, 0, 0, 0);
  return norm;
}

async function runHossamSimulation() {
  console.log("======================================================================");
  console.log("  E2E Test & Simulation: م. حسام الدين عبد الله (الفرع الرئيسي - المعادي)");
  console.log("======================================================================\n");

  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Orders = getOrdersModel(SUBDOMAIN);
  const Products = getProductsModel(SUBDOMAIN);
  const Supplier = getSupplierModel(SUBDOMAIN);
  const SupplierShipment = getSupplierShipmentModel(SUBDOMAIN);
  const Attendance = getAttendanceModel(SUBDOMAIN);
  const Deduction = getDeductionModel(SUBDOMAIN);
  const Activity = getActivityModel(SUBDOMAIN);

  // -------------------------------------------------------------------------
  // 1. Identify Branch & Super Admin
  // -------------------------------------------------------------------------
  console.log("[Phase 1] Locating Main Branch and Super Admin...");
  const mainBranch = await Branch.findOne({ isMain: true }) || (await Branch.find({}))[0];
  assert(mainBranch, "Main Branch must exist in database");
  console.log(`✓ Main Branch found: ${mainBranch.name} (${mainBranch._id})`);

  let superAdmin = await Users.findOne({ role: 5 });
  if (!superAdmin) superAdmin = await Users.findOne({ email: "admin@store.com" });
  assert(superAdmin, "Super Admin must exist");
  console.log(`✓ Super Admin: ${superAdmin.fullname} (${superAdmin._id})`);

  // -------------------------------------------------------------------------
  // 2. Locate or Provision Engineer Hossam
  // -------------------------------------------------------------------------
  console.log("\n[Phase 2] Verifying & Refreshing Engineer Hossam Profile...");
  let hossam = await Users.findOne({ email: "hossam.abdallah@store.com" });
  if (!hossam) {
    hossam = new Users({
      email: "hossam.abdallah@store.com",
      password: "Password123!",
      fullname: "م. حسام الدين عبد الله",
      phone: "01091234501",
      role: 3,
      branchId: mainBranch._id,
      jobTitle: "مهندس صيانة وإلكترونيات أول",
      employmentType: "permanent",
      monthlySalary: 11000,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      shiftHours: 8,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      isAttendanceRequired: true,
      active: true
    });
    await hossam.save();
    console.log(`+ Created profile for: ${hossam.fullname}`);
  } else {
    hossam.fullname = "م. حسام الدين عبد الله";
    hossam.jobTitle = "مهندس صيانة وإلكترونيات أول";
    hossam.branchId = mainBranch._id;
    hossam.employmentType = "permanent";
    hossam.monthlySalary = 11000;
    hossam.shiftHours = 8;
    hossam.shiftStart = "09:00";
    hossam.shiftEnd = "17:00";
    hossam.isAttendanceRequired = true;
    hossam.active = true;
    await hossam.save();
    console.log(`✓ Updated profile for: ${hossam.fullname} (Salary: 11,000 EGP, Permanent)`);
  }

  assert.strictEqual(hossam.monthlySalary, 11000);
  assert.strictEqual(hossam.employmentType, "permanent");
  assert.strictEqual(String(hossam.branchId), String(mainBranch._id));

  const hossamActor = {
    _id: hossam._id,
    userId: hossam._id,
    fullname: hossam.fullname,
    email: hossam.email,
    role: hossam.role
  };

  // -------------------------------------------------------------------------
  // 3. Sales & Orders Operations
  // -------------------------------------------------------------------------
  console.log("\n[Phase 3] Simulating Sales & Order Follow-ups by Hossam...");
  let branchOrders = await Orders.find({ branchId: mainBranch._id }).limit(2);
  
  if (branchOrders.length < 2) {
    // Create mock order if needed
    const mockOrder1 = await Orders.create({
      orderId: `ORD-HSM-${Date.now()}-1`,
      branchId: mainBranch._id,
      customer: {
        name: "د. شريف عبد المنعم",
        phone: "01098877665",
        address: "شارع النصر، المعادي الجديدة",
        city: "القاهرة"
      },
      items: [
        {
          productId: "PROD-SAMPLE-1",
          name: "هاتف ذكي مع خدمة صيانة معتمدة",
          price: 18500,
          quantity: 1
        }
      ],
      total: 18500,
      status: "new",
      payment: { method: "cod", paid: false }
    });
    branchOrders = [mockOrder1];
  }

  // Hossam handles order 1: Confirms order with inspection note
  const order1 = branchOrders[0];
  order1.status = "confirmed";
  order1.timeline.push({
    status: "confirmed",
    at: new Date(),
    note: "تمت مراجعة الفاتورة وفحص قطع الغيار في قسم الصيانة بواسطة م. حسام الدين عبد الله"
  });
  await order1.save();
  console.log(`✓ Order [${order1.orderId}] confirmed with timeline signed by: ${hossam.fullname}`);

  // Hossam handles order 2 if exists or adds another note
  if (branchOrders.length > 1) {
    const order2 = branchOrders[1];
    order2.status = "preparing";
    order2.timeline.push({
      status: "preparing",
      at: new Date(),
      note: "تم تجهيز شحنة الطلب وتثبيت شهادة الفحص الهندسي والضمان بواسطة م. حسام الدين عبد الله"
    });
    await order2.save();
    console.log(`✓ Order [${order2.orderId}] set to preparing with timeline signed by: ${hossam.fullname}`);
  }

  // -------------------------------------------------------------------------
  // 4. Procurement & Supply Operations
  // -------------------------------------------------------------------------
  console.log("\n[Phase 4] Simulating Supply & Procurement Operations by Hossam...");

  // 4.1 Ensure Supplier
  let supplier = await Supplier.findOne({ name: "الشركة الدولية للإلكترونيات وقطع الغيار الأصلية" });
  if (!supplier) {
    supplier = await createSupplier(SUBDOMAIN, {
      name: "الشركة الدولية للإلكترونيات وقطع الغيار الأصلية",
      specialty: "شاشات بديلة ودوائر إلكترونية وبطاريات معتمدة",
      contactPerson: "م. حسام الدين عبد الله (منسق استلام الفرع)",
      phone: "01019988776",
      email: "supply@international-parts-eg.com",
      address: "مبنى التوريدات، المنطقة التكنولوجية، المعادي"
    }, hossamActor);
    console.log(`+ Registered Supplier: ${supplier.name}`);
  } else {
    console.log(`✓ Found Supplier: ${supplier.name}`);
  }

  // 4.2 Ensure Procurement Product
  const Category = getCategoriesModel(SUBDOMAIN);
  let category = await Category.findOne({ name: "قطع غيار وصيانة" });
  if (!category) {
    category = await Category.findOne({});
  }
  if (!category) {
    category = await Category.create({
      name: "قطع غيار وصيانة",
      slug: "spare-parts"
    });
  }

  let partProduct = await Products.findOne({ name: "شاشة استبدال فحص OLED بديلة (نسخة أصلية للمختبر)" });
  if (!partProduct) {
    partProduct = await Products.create({
      name: "شاشة استبدال فحص OLED بديلة (نسخة أصلية للمختبر)",
      category: category.name,
      categoryId: category._id,
      price: 1850,
      costPrice: 1200,
      stockCount: 5,
      reservedStock: 0,
      supplierId: supplier._id,
      sku: `SKU-OLED-${Date.now().toString().slice(-4)}`,
      branchId: mainBranch._id,
      active: true
    });
    console.log(`+ Created Spare Part Product: ${partProduct.name} (Initial stock: ${partProduct.stockCount})`);
  } else {
    console.log(`✓ Found Spare Part Product: ${partProduct.name} (Stock: ${partProduct.stockCount})`);
  }

  const initialStock = partProduct.stockCount;

  // 4.3 Create Supplier Shipment handled by Hossam
  console.log("Creating supplier shipment initiated by Hossam...");
  const shipmentRef = `SHP-HSM-${Date.now().toString(36).toUpperCase()}`;
  const shipmentResult = await createSupplierShipment(SUBDOMAIN, {
    referenceId: shipmentRef,
    supplierId: supplier._id,
    supplierName: supplier.name,
    expectedGoodsValue: 12000,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    notes: "شحنة توريد قطع غيار عاجلة بطلب واستلام م. حسام الدين عبد الله - ورشة الفرع الرئيسي بالمعادي"
  }, hossamActor);

  const shipment = shipmentResult.shipment;
  console.log(`✓ Supplier Shipment created: [${shipment.referenceId}] (ID: ${shipment._id})`);

  // 4.4 Associate Purchase Lines
  const purchaseLines = [
    {
      productId: partProduct._id,
      quantity: 10,
      unitCost: 1200,
      lineTotal: 12000,
      notes: "10 شاشات بديلة OLED لفحص أجهزة العملاء"
    }
  ];
  await associateProductsWithShipment(SUBDOMAIN, shipment._id, { lines: purchaseLines }, hossamActor);
  console.log(`✓ Associated 10 units of [${partProduct.name}] with shipment (Total: 12,000 EGP)`);

  // 4.5 Receive Shipment Goods into Inventory
  console.log("Receiving shipment goods into stock by Hossam...");
  const receiptResult = await receiveSupplierShipment(SUBDOMAIN, shipment._id, {
    lines: [
      {
        productId: partProduct._id,
        receivedQuantity: 10
      }
    ],
    notes: "تم فحص الشحنة ومطابقة الفاتورة واستلام كامل الكمية بدون عيوب بواسطة م. حسام الدين عبد الله"
  }, hossamActor);

  const updatedPart = await Products.findById(partProduct._id);
  console.log(`✓ Goods received into inventory! Stock updated from ${initialStock} to: ${updatedPart.stockCount}`);
  assert(updatedPart.stockCount >= initialStock + 10, "Stock count must increment after confirmed receipt");

  // 4.6 Record Partial Payment
  console.log("Recording partial supplier payment entry...");
  await recordShipmentPayment(SUBDOMAIN, shipment._id, {
    amount: 5000,
    method: "bank_transfer",
    reference: `TXN-${Date.now().toString(36).toUpperCase()}`,
    notes: "دفعة مقدمة مسجلة للتوريد بواسطة قسم الصيانة والمخازن"
  }, hossamActor);
  console.log("✓ Partial payment of 5,000 EGP recorded in ledger");

  // -------------------------------------------------------------------------
  // 5. Daily Attendance Logs (Diverse Realistic History)
  // -------------------------------------------------------------------------
  console.log("\n[Phase 5] Seeding Diverse Daily Attendance History for Hossam (Past 14 Days)...");
  // Clean existing attendance to ensure clean deterministic test profile
  await Attendance.deleteMany({ employeeId: hossam._id });

  const today = new Date();
  const attendanceScenarios = [
    // Day 0: Present on time
    { dayOffset: 0, status: "present", checkInOffsetMins: -8, durationMins: 488, note: "حضور كامل ومطابق للوردية" },
    // Day 1: Late arrival
    { dayOffset: 1, status: "late", checkInOffsetMins: 45, durationMins: 440, note: "تأخر 45 دقيقة عن موعد بدء الوردية الصباحية" },
    // Day 2: Present on time
    { dayOffset: 2, status: "present", checkInOffsetMins: -5, durationMins: 485, note: "حضور وانصراف منتظم" },
    // Day 3: Early leave
    { dayOffset: 3, status: "early_leave", checkInOffsetMins: 0, durationMins: 240, note: "انصراف مبكر بعد 4 ساعات عمل لظرف عائلي طارئ بإذن مسبق" },
    // Day 4: Approved medical leave
    { dayOffset: 4, status: "approved_leave", isApprovedLeave: true, leaveReason: "عذر مرضي معتمد ومرفق به تقرير طبي من المستشفى", note: "موافقة مدير الفرع" },
    // Day 5: Present on time
    { dayOffset: 5, status: "present", checkInOffsetMins: -10, durationMins: 490, note: "حضور منتظم" },
    // Day 6: Unauthorized absence
    { dayOffset: 6, status: "absent", checkInOffsetMins: 0, durationMins: 0, note: "غياب يوم عمل كامل بدون إذن مسبق أو تقرير عذر" },
    // Day 7: Late arrival
    { dayOffset: 7, status: "late", checkInOffsetMins: 35, durationMins: 445, note: "تأخر 35 دقيقة بسبب عطل مواصلات" },
    // Day 8: Present on time
    { dayOffset: 8, status: "present", checkInOffsetMins: -6, durationMins: 486, note: "حضور كامل" },
    // Day 9: Present on time
    { dayOffset: 9, status: "present", checkInOffsetMins: -4, durationMins: 484, note: "حضور كامل" },
    // Day 10: Present on time
    { dayOffset: 10, status: "present", checkInOffsetMins: -12, durationMins: 492, note: "حضور مبكر" },
    // Day 11: Present on time
    { dayOffset: 11, status: "present", checkInOffsetMins: -2, durationMins: 482, note: "حضور منتظم" }
  ];

  for (const scen of attendanceScenarios) {
    const logDate = new Date(today);
    logDate.setDate(today.getDate() - scen.dayOffset);
    const dateNormalized = normalizeDate(logDate);

    let checkIn = null;
    let checkOut = null;
    let totalMinutes = scen.durationMins || 0;

    if (scen.status !== "absent" && scen.status !== "approved_leave") {
      checkIn = new Date(logDate);
      checkIn.setHours(9, scen.checkInOffsetMins || 0, 0);

      checkOut = new Date(checkIn);
      checkOut.setMinutes(checkIn.getMinutes() + (scen.durationMins || 480));
    }

    await Attendance.create({
      employeeId: hossam._id,
      branchId: mainBranch._id,
      date: dateNormalized,
      checkIn,
      checkInMethod: "biometric",
      checkOut,
      checkOutMethod: "biometric",
      totalMinutes,
      status: scen.status,
      isApprovedLeave: Boolean(scen.isApprovedLeave),
      leaveReason: scen.leaveReason || "",
      notes: scen.note || ""
    });
  }
  console.log(`✓ Seeded ${attendanceScenarios.length} diverse attendance logs (Present, Late, Approved Leave, Absent, Early Leave)`);

  // -------------------------------------------------------------------------
  // 6. Deductions & Penalties Log
  // -------------------------------------------------------------------------
  console.log("\n[Phase 6] Seeding Administrative Deductions & Penalties...");
  await Deduction.deleteMany({ employeeId: hossam._id });

  const currentPeriod = today.toISOString().slice(0, 7); // e.g. "2026-11"
  const deductionsToCreate = [
    {
      amount: 250,
      reason: "خصم إداري: غياب يوم عمل كامل بدون إذن مسبق أو تقرير عذر",
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    },
    {
      amount: 150,
      reason: "جزاء إداري: تأخر متكرر عن موعد بدء وردية العمل لمرتين دون تصريح",
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    },
    {
      amount: 350,
      reason: "خصم إداري: تلف جزئي لمجس فحص إلكتروني أثناء أعمال الصيانة الدقيقة بورشة الفرع",
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  ];

  let totalExpectedDeductions = 0;
  for (const d of deductionsToCreate) {
    await Deduction.create({
      employeeId: hossam._id,
      branchId: mainBranch._id,
      amount: d.amount,
      period: currentPeriod,
      reason: d.reason,
      appliedByAdminId: superAdmin._id,
      date: d.date
    });
    totalExpectedDeductions += d.amount;
    console.log(`+ Added deduction: ${d.amount} EGP (${d.reason.slice(0, 40)}...)`);
  }
  console.log(`✓ Total deductions recorded for period [${currentPeriod}]: ${totalExpectedDeductions} EGP`);

  // -------------------------------------------------------------------------
  // 7. Activities Log Attributed to Hossam
  // -------------------------------------------------------------------------
  console.log("\n[Phase 7] Recording Activity Log Entries for Hossam...");
  const activities = [
    {
      eventType: "shipment_created",
      userId: hossam._id,
      branchId: mainBranch._id
    },
    {
      eventType: "shipment_received",
      userId: hossam._id,
      branchId: mainBranch._id
    },
    {
      eventType: "expense_recorded",
      userId: hossam._id,
      branchId: mainBranch._id
    }
  ];

  for (const act of activities) {
    await Activity.create(act);
  }
  console.log(`✓ Attributed ${activities.length} activity events to: ${hossam.fullname}`);

  // -------------------------------------------------------------------------
  // 8. Verification: Comprehensive Dossier via staffService.getStaffProfile
  // -------------------------------------------------------------------------
  console.log("\n[Phase 8] Testing Dossier Query via staffService.getStaffProfile...");
  const profileResult = await staffService.getStaffProfile(SUBDOMAIN, hossam._id, superAdmin);

  assert(profileResult, "Profile response must exist");
  assert(profileResult.employee, "Employee data must exist in profile");
  assert(profileResult.summary, "Summary metrics must exist in profile");
  assert(Array.isArray(profileResult.recentAttendance), "recentAttendance must be an array");
  assert(Array.isArray(profileResult.recentDeductions), "recentDeductions must be an array");

  console.log("\n--- Comprehensive Dossier Verification ---");
  console.log(`Employee Name: ${profileResult.employee.fullname}`);
  console.log(`Job Title: ${profileResult.employee.jobTitle}`);
  console.log(`Base Monthly Salary: ${profileResult.employee.monthlySalary} EGP`);
  console.log(`Calculated Net Salary: ${profileResult.calculatedNetSalary} EGP`);
  console.log(`Attendance Rate: ${profileResult.summary.attendanceRate}%`);
  console.log(`Present Days: ${profileResult.summary.presentDays}`);
  console.log(`Late Days: ${profileResult.summary.lateDays}`);
  console.log(`Approved Leaves: ${profileResult.summary.approvedLeaves}`);
  console.log(`Unauthorized Absences: ${profileResult.summary.unauthorizedAbsences}`);
  console.log(`Total Deductions: ${profileResult.summary.totalDeductions} EGP`);
  console.log(`Recent Attendance Logs count: ${profileResult.recentAttendance.length}`);
  console.log(`Recent Deductions Logs count: ${profileResult.recentDeductions.length}`);

  // Validations
  assert.strictEqual(profileResult.summary.totalDeductions, totalExpectedDeductions, "Total deductions in summary must match");
  assert.strictEqual(profileResult.calculatedNetSalary, 11000 - totalExpectedDeductions, "Net salary must equal salary minus deductions");
  assert.strictEqual(profileResult.summary.approvedLeaves, 1, "Must have exactly 1 approved leave recorded");
  assert.strictEqual(profileResult.summary.unauthorizedAbsences, 1, "Must have exactly 1 unauthorized absence recorded");
  assert.strictEqual(profileResult.summary.lateDays, 2, "Must have exactly 2 late arrival days recorded");

  console.log("\n======================================================================");
  console.log("  >>> ALL TESTS & SIMULATIONS PASSED WITH 100% SUCCESS! <<<");
  console.log("======================================================================\n");
  process.exit(0);
}

runHossamSimulation().catch((err) => {
  console.error("Simulation Test Failed with error:", err);
  process.exit(1);
});
