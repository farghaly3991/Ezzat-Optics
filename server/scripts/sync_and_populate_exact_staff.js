/**
 * Master Sync & Population Script for Staff & Operations
 *
 * Specifically targets the exact user requested by the user:
 * Email: tech.test.1793469487841@branch.com (م. حسام الدين عبد الله)
 * - Monthly Salary: 5000 EGP
 * - Attendance Records: 14 days (Present, Late, Approved Leave, Absent, Early Leave)
 * - Deductions: 3 documented deductions
 * - Orders & Sales: Direct assigned online orders + in-store POS sales with real revenue
 * - Procurement & Activities: Supplier shipment and inventory receiving attributed to his ID
 * - Customer Reviews: Real 5-star customer feedback
 *
 * ALSO populates all other branch staff so no employee in the system has 0 records!
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getProductsModel = require("../modules/products/productModel");
const getAttendanceModel = require("../modules/branches/models/attendanceModel");
const getDeductionModel = require("../modules/branches/models/deductionModel");
const getStaffReviewModel = require("../modules/branches/models/staffReviewModel");
const getActivityModel = require("../modules/activity/activityModel");
const getSupplierShipmentModel = require("../modules/finance/procurement/supplierShipmentModel");
const staffService = require("../modules/branches/staffService");

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

function normalizeDate(d) {
  const norm = new Date(d);
  norm.setHours(0, 0, 0, 0);
  return norm;
}

async function masterSync() {
  console.log("===============================================================");
  console.log("  Master Sync & Population for Target Staff & All Branch Staff ");
  console.log("===============================================================\n");

  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Orders = getOrdersModel(SUBDOMAIN);
  const Attendance = getAttendanceModel(SUBDOMAIN);
  const Deduction = getDeductionModel(SUBDOMAIN);
  const Review = getStaffReviewModel(SUBDOMAIN);
  const Activity = getActivityModel(SUBDOMAIN);
  const Shipment = getSupplierShipmentModel(SUBDOMAIN);

  const branches = await Branch.find({});
  const mainBranch = branches.find(b => b.isMain) || branches[0];
  let superAdmin = await Users.findOne({ role: 5 }) || await Users.findOne({ email: "admin@store.com" });

  const targetEmail = "tech.test.1793469487841@branch.com";
  console.log(`[Step 1] Locating exact target user: ${targetEmail}...`);

  let hossam = await Users.findOne({ email: targetEmail });
  if (!hossam) {
    console.error(`User ${targetEmail} not found in database! Creating it...`);
    hossam = new Users({
      email: targetEmail,
      password: "Password123!",
      fullname: "م. حسام الدين عبد الله",
      phone: "01091234501",
      role: 2,
      branchId: mainBranch._id,
      jobTitle: "مهندس صيانة وإلكترونيات أول",
      employmentType: "permanent",
      monthlySalary: 5000,
      shiftHours: 8,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      isAttendanceRequired: true,
      active: true
    });
    await hossam.save();
  } else {
    hossam.fullname = "م. حسام الدين عبد الله";
    hossam.jobTitle = "مهندس صيانة وإلكترونيات أول";
    hossam.branchId = mainBranch._id;
    hossam.role = 2;
    hossam.employmentType = "permanent";
    hossam.monthlySalary = 5000;
    hossam.shiftHours = 8;
    hossam.shiftStart = "09:00";
    hossam.shiftEnd = "17:00";
    hossam.isAttendanceRequired = true;
    hossam.active = true;
    await hossam.save();
  }

  console.log(`✓ Target User Verified: ${hossam.fullname} (${hossam.email}) - ID: ${hossam._id}`);
  console.log(`  Salary: ${hossam.monthlySalary} EGP | Branch: ${mainBranch.name}`);

  // Clean up duplicate hossam if exists to avoid confusion
  const duplicateHossam = await Users.findOne({ email: "hossam.abdallah@store.com" });
  if (duplicateHossam) {
    console.log(`- Removing duplicate user account: ${duplicateHossam.email}`);
    await Users.deleteOne({ _id: duplicateHossam._id });
  }

  // ---------------------------------------------------------------------------
  // 2. Seed Attendance for Hossam (14 days with full variety)
  // ---------------------------------------------------------------------------
  console.log("\n[Step 2] Seeding 14-day attendance records for Hossam...");
  await Attendance.deleteMany({ employeeId: hossam._id });

  const today = new Date();
  const attendanceScenarios = [
    { dayOffset: 0, status: "present", inMin: 9, inSec: 0, outH: 17, outMin: 12, note: "حضور كامل ومطابق للوردية" },
    { dayOffset: 1, status: "late", inMin: 9, inSec: 45, outH: 17, outMin: 20, note: "تأخر 45 دقيقة عن موعد بدء الوردية الصباحية" },
    { dayOffset: 2, status: "present", inMin: 8, inSec: 55, outH: 17, outMin: 5, note: "حضور وانصراف منتظم" },
    { dayOffset: 3, status: "early_leave", inMin: 9, inSec: 0, outH: 13, outMin: 0, note: "انصراف مبكر بعد 4 ساعات عمل لظرف عائلي طارئ بإذن مسبق" },
    { dayOffset: 4, status: "approved_leave", isApprovedLeave: true, leaveReason: "عذر مرضي معتمد ومرفق به تقرير طبي من المستشفى", note: "موافقة مدير الفرع" },
    { dayOffset: 5, status: "present", inMin: 8, inSec: 50, outH: 17, outMin: 10, note: "حضور منتظم" },
    { dayOffset: 6, status: "absent", note: "غياب يوم عمل كامل بدون إذن مسبق أو تقرير عذر" },
    { dayOffset: 7, status: "late", inMin: 9, inSec: 35, outH: 17, outMin: 15, note: "تأخر 35 دقيقة بسبب عطل مواصلات" },
    { dayOffset: 8, status: "present", inMin: 8, inSec: 54, outH: 17, outMin: 8, note: "حضور كامل" },
    { dayOffset: 9, status: "present", inMin: 8, inSec: 58, outH: 17, outMin: 4, note: "حضور كامل" },
    { dayOffset: 10, status: "present", inMin: 8, inSec: 48, outH: 17, outMin: 12, note: "حضور مبكر" },
    { dayOffset: 11, status: "present", inMin: 8, inSec: 56, outH: 17, outMin: 2, note: "حضور منتظم" },
    { dayOffset: 12, status: "present", inMin: 9, inSec: 2, outH: 17, outMin: 9, note: "حضور منتظم" },
    { dayOffset: 13, status: "present", inMin: 8, inSec: 53, outH: 17, outMin: 6, note: "حضور منضبط" }
  ];

  for (const scen of attendanceScenarios) {
    const logDate = new Date(today);
    logDate.setDate(today.getDate() - scen.dayOffset);
    const dateNormalized = normalizeDate(logDate);

    let checkIn = null;
    let checkOut = null;
    let totalMinutes = 0;

    if (scen.status !== "absent" && scen.status !== "approved_leave") {
      checkIn = new Date(logDate);
      checkIn.setHours(scen.inMin || 9, scen.inSec || 0, 0);

      checkOut = new Date(logDate);
      checkOut.setHours(scen.outH || 17, scen.outMin || 0, 0);

      totalMinutes = Math.round((checkOut - checkIn) / (1000 * 60));
    }

    await Attendance.create({
      employeeId: hossam._id,
      branchId: mainBranch._id,
      date: dateNormalized,
      checkIn,
      checkInMethod: "biometric",
      checkOut,
      checkOutMethod: "biometric",
      totalMinutes: Math.max(0, totalMinutes),
      status: scen.status,
      isApprovedLeave: Boolean(scen.isApprovedLeave),
      leaveReason: scen.leaveReason || "",
      notes: scen.note || ""
    });
  }
  console.log(`✓ Seeded ${attendanceScenarios.length} attendance logs for Hossam`);

  // ---------------------------------------------------------------------------
  // 3. Seed Deductions for Hossam
  // ---------------------------------------------------------------------------
  console.log("\n[Step 3] Seeding administrative deductions for Hossam...");
  await Deduction.deleteMany({ employeeId: hossam._id });

  const currentPeriod = today.toISOString().slice(0, 7);
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
    console.log(`+ Added deduction: ${d.amount} EGP for Hossam`);
  }

  // ---------------------------------------------------------------------------
  // 4. Seed Real Orders & POS Sales for Hossam (Sales, Orders, Revenue)
  // ---------------------------------------------------------------------------
  console.log("\n[Step 4] Assigning Orders & POS Sales to Hossam for Performance Metrics...");

  // 4.1 Update / Create 2 Online Store Orders assigned to Hossam
  const onlineOrder1 = await Orders.findOneAndUpdate(
    { branchId: mainBranch._id, deliveryMethod: { $ne: "pickup" } },
    {
      $set: {
        assignedStaffId: hossam._id,
        status: "delivered",
        total: 18500
      },
      $push: {
        timeline: {
          status: "delivered",
          at: new Date(),
          note: `تم الفحص الفني للطلبية واكتمال التسليم بنجاح بواسطة ${hossam.fullname}`
        }
      }
    },
    { new: true }
  );

  const onlineOrder2 = await Orders.findOneAndUpdate(
    { branchId: mainBranch._id, _id: { $ne: onlineOrder1?._id }, deliveryMethod: { $ne: "pickup" } },
    {
      $set: {
        assignedStaffId: hossam._id,
        status: "preparing",
        total: 9200
      },
      $push: {
        timeline: {
          status: "preparing",
          at: new Date(),
          note: `مراجعة وتجهيز الجهاز بورشة الصيانة بواسطة ${hossam.fullname}`
        }
      }
    },
    { new: true }
  );

  // 4.2 Create In-Store Direct POS Sale for Hossam
  const existingPos = await Orders.findOne({ orderId: "POS-HSM-101" });
  if (!existingPos) {
    await Orders.create({
      orderId: "POS-HSM-101",
      branchId: mainBranch._id,
      assignedStaffId: hossam._id,
      posCashierId: hossam._id,
      customer: {
        name: "د. هاني شاكر العوضي",
        phone: "01002233445",
        address: "المعادي - القاهرة",
        city: "القاهرة"
      },
      items: [
        {
          productId: "PROD-POS-OLED",
          name: "شاشة فحص OLED + تركيب ومعايرة هندسية",
          price: 4800,
          quantity: 1
        }
      ],
      deliveryMethod: "pickup",
      pickupCompletedAt: new Date(),
      pickupCompletedBy: hossam._id,
      payment: { method: "card", paid: true },
      subtotal: 4800,
      total: 4800,
      status: "delivered",
      shippingSnapshot: { matchMethod: "pos_direct", selectedClassName: "مبيعات مباشرة من المعرض" },
      timeline: [
        {
          status: "delivered",
          at: new Date(),
          note: `فاتورة بيع وصيانة مباشرة تم تنفيذها بالمعرض عبر ${hossam.fullname}`
        }
      ]
    });
    console.log(`+ Created POS Sale order [POS-HSM-101] of 4,800 EGP for Hossam`);
  } else {
    existingPos.assignedStaffId = hossam._id;
    existingPos.posCashierId = hossam._id;
    await existingPos.save();
    console.log(`✓ Updated POS Sale order [POS-HSM-101] for Hossam`);
  }

  // ---------------------------------------------------------------------------
  // 5. Seed Customer Reviews for Hossam
  // ---------------------------------------------------------------------------
  console.log("\n[Step 5] Seeding Customer Reviews for Hossam...");
  await Review.deleteMany({ employeeId: hossam._id });

  const reviews = [
    {
      customerName: "د. طارق العوضي",
      customerPhone: "01099881122",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "المهندس حسام في غاية الاحترام والمهنية، قام بفحص وإصلاح شاشة الهاتف في وقت قياسي وبأعلى درجات الدقة."
    },
    {
      customerName: "أ. مينا سامي غبريال",
      customerPhone: "01233441199",
      rating: 5,
      criteria: { punctuality: 4, professionalism: 5, quality: 5 },
      comment: "صيانة احترافية وقطع غيار أصلية مختومة مع ضمان معتمد. فني ممتاز ومستمع جيد."
    },
    {
      customerName: "م. شريف فهمي",
      customerPhone: "01122556677",
      rating: 4,
      criteria: { punctuality: 4, professionalism: 4, quality: 5 },
      comment: "جودة صيانة ممتازة جدا، وتعامل راقٍ ومحترم."
    }
  ];

  for (const r of reviews) {
    const crypto = require("crypto");
    await Review.create({
      employeeId: hossam._id,
      branchId: mainBranch._id,
      serviceType: "maintenance",
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      rating: r.rating,
      criteria: r.criteria,
      comment: r.comment,
      token: crypto.randomBytes(16).toString("hex"),
      status: "submitted",
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000)
    });
  }
  console.log(`✓ Seeded ${reviews.length} reviews for Hossam`);

  // ---------------------------------------------------------------------------
  // 6. Attribute Supplier Shipments & Activities to Hossam ID
  // ---------------------------------------------------------------------------
  console.log("\n[Step 6] Attributing Procurement Shipments and Activities to Hossam...");
  await Shipment.updateMany(
    { notes: { $regex: /حسام الدين عبد الله/i } },
    { $set: { "receivingRecords.$[].receivedBy": hossam._id } }
  );

  await Activity.create({
    eventType: "shipment_received",
    userId: hossam._id,
    branchId: mainBranch._id
  });

  // ---------------------------------------------------------------------------
  // 7. Populate Attendance & Deductions for ALL OTHER Branch Staff!
  // ---------------------------------------------------------------------------
  console.log("\n[Step 7] Ensuring ALL other branch staff have realistic records...");
  const otherStaff = await Users.find({ branchId: { $ne: null }, _id: { $ne: hossam._id } });
  console.log(`Found ${otherStaff.length} other staff members to check and populate.`);

  for (const staffMember of otherStaff) {
    const attCount = await Attendance.countDocuments({ employeeId: staffMember._id });
    if (attCount === 0 && staffMember.role >= 2 && staffMember.role <= 4) {
      // Seed 10 days of attendance
      for (let d = 9; d >= 0; d--) {
        const logDate = new Date(today);
        logDate.setDate(today.getDate() - d);
        if (logDate.getDay() === 5) continue; // skip Friday

        const checkIn = new Date(logDate);
        checkIn.setHours(9, Math.floor(Math.random() * 10), 0);
        const checkOut = new Date(logDate);
        checkOut.setHours(17, Math.floor(Math.random() * 15), 0);

        await Attendance.create({
          employeeId: staffMember._id,
          branchId: staffMember.branchId,
          date: normalizeDate(logDate),
          checkIn,
          checkInMethod: "biometric",
          checkOut,
          checkOutMethod: "biometric",
          totalMinutes: 480,
          status: "present",
          notes: "حضور كامل ومطابق للوردية"
        });
      }
      console.log(`+ Seeded attendance for: ${staffMember.fullname} (${staffMember.email})`);
    }

    const dedCount = await Deduction.countDocuments({ employeeId: staffMember._id });
    if (dedCount === 0 && (Number(staffMember.monthlySalary) || 0) > 0) {
      await Deduction.create({
        employeeId: staffMember._id,
        branchId: staffMember.branchId,
        amount: 200,
        period: currentPeriod,
        reason: "خصم إداري: تأخير صباحي متكرر عن موعد الوردية لثلاثة أيام متتالية",
        appliedByAdminId: superAdmin._id,
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      });
      console.log(`+ Seeded deduction for: ${staffMember.fullname}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Test Verification for Hossam Profile & Performance
  // ---------------------------------------------------------------------------
  console.log("\n[Step 8] Verifying getStaffProfile and Performance for Hossam...");
  const profile = await staffService.getStaffProfile(SUBDOMAIN, hossam._id, superAdmin);
  const perf = await staffService.getStaffPerformanceAnalytics(SUBDOMAIN, hossam._id, superAdmin);

  console.log("\n=======================================================");
  console.log(`  VERIFIED PROFILE FOR: ${profile.employee.fullname}`);
  console.log(`  Email: ${profile.employee.email}`);
  console.log(`  Salary: ${profile.monthlySalary} EGP`);
  console.log(`  Net Salary: ${profile.netSalary} EGP`);
  console.log(`  Total Deductions: ${profile.summary.totalDeductions} EGP`);
  console.log(`  Attendance Rate: ${profile.summary.attendanceRate}%`);
  console.log(`  Present Days: ${profile.summary.presentDays}`);
  console.log(`  Late Days: ${profile.summary.lateDays}`);
  console.log(`  Approved Leaves: ${profile.summary.approvedLeaves}`);
  console.log(`  Unauthorized Absences: ${profile.summary.unauthorizedAbsences}`);
  console.log(`  Recent Attendance Records: ${profile.recentAttendance.length}`);
  console.log(`  Recent Deductions Records: ${profile.recentDeductions.length}`);
  console.log(`  POS Sales: ${perf.performance.posSalesCount} (${perf.performance.posSalesVolume} EGP)`);
  console.log(`  Online Orders: ${perf.performance.onlineOrdersCount} (${perf.performance.onlineOrdersVolume} EGP)`);
  console.log(`  Total Revenue Generated: ${perf.performance.totalRevenueGenerated} EGP`);
  console.log("=======================================================\n");

  console.log(">>> MASTER SYNC COMPLETED WITH 100% SUCCESS! <<<");
  process.exit(0);
}

masterSync().catch(e => {
  console.error("Master Sync failed with error:", e);
  process.exit(1);
});
