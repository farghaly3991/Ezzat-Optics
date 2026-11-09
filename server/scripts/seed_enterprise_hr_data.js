/**
 * Enterprise HR, Attendance, Deductions, Couriers & Reviews Seeder
 * 
 * Sets up clean, realistic Arabic staff data across all branches:
 * - Permanent staff (with monthlySalary > 0, fixed or flexible shifts)
 * - Per-task staff (with monthlySalary = 0)
 * - Removes repeated/test titles like "فني صيانة معتمد تجريبي"
 * - Daily attendance logs (check-in/out, present, late, approved_leave)
 * - Deductions with administrative reasons, periods, and admin sign-offs
 * - Shipping couriers (internal staff with 0 EGP marginal cost + external carriers + freelancers)
 * - Customer reviews for technicians and delivery couriers
 * - Activity logs
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const getAttendanceModel = require("../modules/branches/models/attendanceModel");
const getDeductionModel = require("../modules/branches/models/deductionModel");
const getStaffReviewModel = require("../modules/branches/models/staffReviewModel");
const getShippingCourierModel = require("../modules/finance/shipping/shippingCourierModel");
const getActivityModel = require("../modules/activity/activityModel");

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

function normalizeDate(d) {
  const norm = new Date(d);
  norm.setHours(0, 0, 0, 0);
  return norm;
}

async function seedEnterpriseHR() {
  console.log("=================================================");
  console.log("=== Seeding Enterprise Staff, HR & Operations ===");
  console.log("=================================================");

  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Attendance = getAttendanceModel(SUBDOMAIN);
  const Deduction = getDeductionModel(SUBDOMAIN);
  const Review = getStaffReviewModel(SUBDOMAIN);
  const Courier = getShippingCourierModel(SUBDOMAIN);
  const Activity = getActivityModel(SUBDOMAIN);

  // 1. Fetch Branches
  const branches = await Branch.find({});
  if (branches.length === 0) {
    console.error("No branches found in database! Please run seed_branches.js first.");
    process.exit(1);
  }

  console.log(`Found ${branches.length} branches:`, branches.map(b => `${b.name} (${b._id})`));

  let mainBranch = branches.find(b => b.isMain) || branches[0];
  let alexBranch = branches.find(b => b.name?.includes("إسكندرية") || b.code === "ALX") || branches[1] || mainBranch;
  let gizaBranch = branches.find(b => b.name?.includes("جيزة") || b.name?.includes("زايد") || b.code === "GZ") || branches[2] || mainBranch;

  // Find Super Admin
  let superAdmin = await Users.findOne({ role: 5 });
  if (!superAdmin) {
    superAdmin = await Users.findOne({ email: "admin@store.com" });
  }
  const superAdminId = superAdmin ? superAdmin._id : null;
  console.log(`Super Admin: ${superAdmin?.fullname || "Admin"} (${superAdmin?._id})`);

  // 2. Clean up repetitive dummy names
  console.log("\n[Step 1] Cleaning up repetitive or generic placeholder staff names...");
  const dummyUpdated = await Users.updateMany(
    { fullname: { $regex: /فني صيانة معتمد تجريبي/i } },
    { $set: { fullname: "م. حسام الدين عبد الله", jobTitle: "مهندس صيانة إلكترونيات أول" } }
  );
  console.log(`Updated placeholder accounts count: ${dummyUpdated.modifiedCount}`);

  // 3. Define and Upsert Defined Staff Profiles
  console.log("\n[Step 2] Provisioning Realistic Staff Across Branches...");

  const staffCatalog = [
    // --- MAIN BRANCH (القاهرة) ---
    {
      branchId: mainBranch._id,
      email: "hossam.abdallah@store.com",
      fullname: "م. حسام الدين عبد الله",
      role: 3,
      jobTitle: "مهندس صيانة وإلكترونيات أول",
      phone: "01091234501",
      employmentType: "permanent",
      monthlySalary: 11000,
      shiftHours: 8,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      isAttendanceRequired: true,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29408150102345",
      emergencyPhone: "01009876543"
    },
    {
      branchId: mainBranch._id,
      email: "ziad.sherif@store.com",
      fullname: "كابتن زياد طارق الشريف",
      role: 3,
      jobTitle: "مندوب توصيل ودعم لوجستي معتمد",
      phone: "01011223344",
      employmentType: "permanent",
      monthlySalary: 7500,
      shiftHours: 8,
      shiftStart: "10:00",
      shiftEnd: "18:00",
      isAttendanceRequired: true,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29610200109876",
      emergencyPhone: "01122334455"
    },
    {
      branchId: mainBranch._id,
      email: "sara.kamel@store.com",
      fullname: "سارة مصطفى كامل",
      role: 2,
      jobTitle: "مسؤولة مبيعات وخدمة عملاء",
      phone: "01234567891",
      employmentType: "permanent",
      monthlySalary: 8500,
      shiftHours: 8,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      isAttendanceRequired: true,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29805120104567",
      emergencyPhone: "01287654321"
    },
    {
      branchId: mainBranch._id,
      email: "ahmed.naggar@store.com",
      fullname: "أحمد كمال النجار",
      role: 3,
      jobTitle: "فني تركيبات وصيانة بالطلب",
      phone: "01155443322",
      employmentType: "per_task",
      monthlySalary: 0,
      shiftHours: 0,
      shiftStart: "00:00",
      shiftEnd: "00:00",
      isAttendanceRequired: false,
      workDays: [],
      nationalId: "29203110107890",
      emergencyPhone: "01012349876"
    },

    // --- ALEXANDRIA BRANCH (الإسكندرية) ---
    {
      branchId: alexBranch._id,
      email: "islam.badri@store.com",
      fullname: "م. إسلام كمال البدري",
      role: 3,
      jobTitle: "كبير فنيي الصيانة وقطع الغيار",
      phone: "01022334455",
      employmentType: "permanent",
      monthlySalary: 10500,
      shiftHours: 8,
      shiftStart: "10:00",
      shiftEnd: "18:00",
      isAttendanceRequired: true,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29307040201234",
      emergencyPhone: "01099887766"
    },
    {
      branchId: alexBranch._id,
      email: "ahmed.desouki@store.com",
      fullname: "أحمد وائل دسوقي",
      role: 2,
      jobTitle: "مشرف مبيعات ومخازن",
      phone: "01144556677",
      employmentType: "permanent",
      monthlySalary: 8000,
      shiftHours: 8,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      isAttendanceRequired: false, // Flexible shift
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29509180205678",
      emergencyPhone: "01233445566"
    },
    {
      branchId: alexBranch._id,
      email: "karim.menshawy@store.com",
      fullname: "كابتن كريم يوسف المنشاوي",
      role: 3,
      jobTitle: "مندوب شحن وتوزيع حر (بالطلب)",
      phone: "01288990011",
      employmentType: "per_task",
      monthlySalary: 0,
      shiftHours: 0,
      shiftStart: "00:00",
      shiftEnd: "00:00",
      isAttendanceRequired: false,
      workDays: [],
      nationalId: "29701010208765",
      emergencyPhone: "01055667788"
    },

    // --- GIZA BRANCH (الجيزة - زايد) ---
    {
      branchId: gizaBranch._id,
      email: "omar.gazzar@store.com",
      fullname: "م. عمر محمود الجزار",
      role: 3,
      jobTitle: "أخصائي صيانة أجهزة ذكية",
      phone: "01066778899",
      employmentType: "permanent",
      monthlySalary: 9500,
      shiftHours: 8,
      shiftStart: "09:30",
      shiftEnd: "17:30",
      isAttendanceRequired: true,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29504192103456",
      emergencyPhone: "01199887700"
    },
    {
      branchId: gizaBranch._id,
      email: "mona.zahran@store.com",
      fullname: "منى عبد الحميد زهران",
      role: 2,
      jobTitle: "مسؤولة خدمة عملاء واستقبال",
      phone: "01277889900",
      employmentType: "permanent",
      monthlySalary: 7200,
      shiftHours: 8,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      isAttendanceRequired: true,
      workDays: ["sat", "sun", "mon", "tue", "wed", "thu"],
      nationalId: "29906222106789",
      emergencyPhone: "01044332211"
    },
    {
      branchId: gizaBranch._id,
      email: "mahmoud.abdelaal@store.com",
      fullname: "كابتن محمود عبد العال",
      role: 3,
      jobTitle: "مندوب توصيل بالطلب والمهمة",
      phone: "01511223344",
      employmentType: "per_task",
      monthlySalary: 0,
      shiftHours: 0,
      shiftStart: "00:00",
      shiftEnd: "00:00",
      isAttendanceRequired: false,
      workDays: [],
      nationalId: "29612052109012",
      emergencyPhone: "01200998877"
    }
  ];

  const createdStaffMap = {};

  for (const item of staffCatalog) {
    let user = await Users.findOne({ email: item.email });
    const qrCode = `EMP-${String(item.branchId).slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!user) {
      user = new Users({
        email: item.email,
        password: "Password123!",
        fullname: item.fullname,
        phone: item.phone,
        role: item.role,
        branchId: item.branchId,
        employmentType: item.employmentType,
        monthlySalary: item.monthlySalary,
        workDays: item.workDays,
        shiftHours: item.shiftHours,
        shiftStart: item.shiftStart,
        shiftEnd: item.shiftEnd,
        isAttendanceRequired: item.isAttendanceRequired,
        qrAttendanceCode: qrCode,
        jobTitle: item.jobTitle,
        nationalId: item.nationalId,
        emergencyPhone: item.emergencyPhone,
        active: true
      });
      await user.save();
      console.log(`+ Created staff: ${item.fullname} (${item.jobTitle}) - Salary: ${item.monthlySalary} EGP`);
    } else {
      user.fullname = item.fullname;
      user.jobTitle = item.jobTitle;
      user.branchId = item.branchId;
      user.employmentType = item.employmentType;
      user.monthlySalary = item.monthlySalary;
      user.workDays = item.workDays;
      user.shiftHours = item.shiftHours;
      user.shiftStart = item.shiftStart;
      user.shiftEnd = item.shiftEnd;
      user.isAttendanceRequired = item.isAttendanceRequired;
      user.nationalId = item.nationalId;
      user.emergencyPhone = item.emergencyPhone;
      user.active = true;
      if (!user.qrAttendanceCode) user.qrAttendanceCode = qrCode;
      await user.save();
      console.log(`✓ Updated staff: ${item.fullname} (${item.jobTitle}) - Salary: ${item.monthlySalary} EGP`);
    }

    createdStaffMap[item.email] = user;
  }

  // 4. Seed Attendance Records for the past 14 days
  console.log("\n[Step 3] Seeding Daily Attendance Logs (Past 14 Days)...");
  
  // Find all permanent staff who require attendance
  const permanentStaff = Object.values(createdStaffMap).filter(u => u.employmentType === "permanent" && u.isAttendanceRequired);
  console.log(`Found ${permanentStaff.length} permanent staff requiring daily attendance`);

  const today = new Date();
  let attendanceCount = 0;

  for (const emp of permanentStaff) {
    for (let i = 13; i >= 0; i--) {
      const logDate = new Date(today);
      logDate.setDate(today.getDate() - i);
      const dayOfWeek = logDate.getDay(); // 5 = Friday (weekend in Egypt)

      if (dayOfWeek === 5) {
        // Friday is weekly holiday, skip
        continue;
      }

      const dateNormalized = normalizeDate(logDate);

      // Check if already exists
      const existing = await Attendance.findOne({
        employeeId: emp._id,
        date: dateNormalized
      });

      if (existing) continue;

      // Realistic variation:
      // ~85% present on-time
      // ~10% late
      // ~5% approved leave
      const rand = Math.random();

      if (rand < 0.06 && i > 2) {
        // Approved leave
        await Attendance.create({
          employeeId: emp._id,
          branchId: emp.branchId,
          date: dateNormalized,
          status: "approved_leave",
          isApprovedLeave: true,
          leaveReason: "إجازة اعتيادية مصدق عليها من الإدارة",
          notes: "تمت الموافقة المسبقة من مدير الفرع"
        });
        attendanceCount++;
      } else if (rand < 0.18) {
        // Late arrival
        const checkIn = new Date(logDate);
        const shiftH = parseInt(emp.shiftStart.split(":")[0]) || 9;
        const shiftM = parseInt(emp.shiftStart.split(":")[1]) || 0;
        checkIn.setHours(shiftH, shiftM + Math.floor(25 + Math.random() * 30), 0); // 25-55 mins late

        const checkOut = new Date(logDate);
        const endH = parseInt(emp.shiftEnd.split(":")[0]) || 17;
        const endM = parseInt(emp.shiftEnd.split(":")[1]) || 0;
        checkOut.setHours(endH, endM + Math.floor(Math.random() * 20), 0);

        const totalMinutes = Math.round((checkOut - checkIn) / (1000 * 60));

        await Attendance.create({
          employeeId: emp._id,
          branchId: emp.branchId,
          date: dateNormalized,
          checkIn,
          checkInMethod: "biometric",
          checkOut,
          checkOutMethod: "biometric",
          totalMinutes: Math.max(0, totalMinutes),
          status: "late",
          notes: "تأخر عن موعد بدء الوردية المجدولة"
        });
        attendanceCount++;
      } else {
        // Present on time
        const checkIn = new Date(logDate);
        const shiftH = parseInt(emp.shiftStart.split(":")[0]) || 9;
        const shiftM = parseInt(emp.shiftStart.split(":")[1]) || 0;
        checkIn.setHours(shiftH, shiftM - Math.floor(Math.random() * 12), 0); // 0-12 mins early

        const checkOut = new Date(logDate);
        const endH = parseInt(emp.shiftEnd.split(":")[0]) || 17;
        const endM = parseInt(emp.shiftEnd.split(":")[1]) || 0;
        checkOut.setHours(endH, endM + Math.floor(Math.random() * 15), 0);

        const totalMinutes = Math.round((checkOut - checkIn) / (1000 * 60));

        await Attendance.create({
          employeeId: emp._id,
          branchId: emp.branchId,
          date: dateNormalized,
          checkIn,
          checkInMethod: "biometric",
          checkOut,
          checkOutMethod: "biometric",
          totalMinutes: Math.max(0, totalMinutes),
          status: "present",
          notes: "حضور كامل ومطابق للوردية"
        });
        attendanceCount++;
      }
    }
  }
  console.log(`✓ Seeded ${attendanceCount} new attendance records`);

  // 5. Seed Realistic Deductions
  console.log("\n[Step 4] Seeding Administrative Deductions...");
  const currentPeriod = today.toISOString().slice(0, 7); // e.g. "2026-11"
  const prevMonthDate = new Date(today);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevPeriod = prevMonthDate.toISOString().slice(0, 7);

  const deductionsToCreate = [
    {
      email: "hossam.abdallah@store.com",
      amount: 350,
      period: currentPeriod,
      reason: "خصم إداري: تلف جزئي لمجس فحص إلكتروني أثناء أعمال الصيانة الدقيقة بورشة الفرع",
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      email: "ahmed.desouki@store.com",
      amount: 250,
      period: currentPeriod,
      reason: "خصم تأخير متكرر: تجاوز الحد المسموح للتأخير الصباحي لثلاثة أيام متتالية دون إذن مسبق",
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    },
    {
      email: "omar.gazzar@store.com",
      amount: 200,
      period: prevPeriod,
      reason: "خصم غياب نصف يوم عمل رسمي دون إخطار الإدارة مسبقاً",
      date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
    },
    {
      email: "ziad.sherif@store.com",
      amount: 150,
      period: currentPeriod,
      reason: "تأخير في تسليم تقرير تسوية تحصيل فواتير شحنات التوصيل المسائية",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  ];

  let deductionCount = 0;
  for (const d of deductionsToCreate) {
    const emp = createdStaffMap[d.email];
    if (!emp) continue;

    const exists = await Deduction.findOne({
      employeeId: emp._id,
      reason: d.reason
    });

    if (!exists) {
      await Deduction.create({
        employeeId: emp._id,
        branchId: emp.branchId,
        amount: d.amount,
        period: d.period,
        reason: d.reason,
        appliedByAdminId: superAdminId,
        date: d.date
      });
      deductionCount++;
      console.log(`+ Added deduction: ${d.amount} EGP for ${emp.fullname} (${d.reason.slice(0, 30)}...)`);
    }
  }
  console.log(`✓ Seeded ${deductionCount} new deduction records`);

  // 6. Seed Shipping Couriers (Internal Staff + External Carriers + Freelancers)
  console.log("\n[Step 5] Seeding Shipping Couriers & Logistics...");

  const ziadUser = createdStaffMap["ziad.sherif@store.com"];
  const karimUser = createdStaffMap["karim.menshawy@store.com"];

  const couriersToSeed = [
    {
      name: "كابتن زياد طارق الشريف (داخلي - الفرع الرئيسي)",
      type: "internal_staff",
      userId: ziadUser ? ziadUser._id : null,
      branchId: mainBranch._id,
      phone: "01011223344",
      defaultCost: 0, // 0 EGP marginal cost for salaried internal staff
      active: true,
      notes: "مندوب توصيل داخلي معين بمرتب شهري ثابت (هامش التكلفة الإضافية 0 ج.م)"
    },
    {
      name: "كابتن كريم يوسف المنشاوي (حر - الإسكندرية)",
      type: "freelancer",
      userId: karimUser ? karimUser._id : null,
      branchId: alexBranch._id,
      phone: "01288990011",
      defaultCost: 35,
      active: true,
      notes: "مندوب توصيل حر بالطلب لمناطق الإسكندرية وسموحة والساحل"
    },
    {
      name: "شركة بوسطة للشحن السريع (Bosta Express)",
      type: "external_carrier",
      userId: null,
      branchId: null,
      phone: "19000",
      defaultCost: 45,
      active: true,
      notes: "شريك الشحن السريع المعتمد للمحافظات والوجه البحري والدلتا"
    },
    {
      name: "أرامكس مصر للشحن واللوجستيات (Aramex Egypt)",
      type: "external_carrier",
      userId: null,
      branchId: null,
      phone: "16777",
      defaultCost: 65,
      active: true,
      notes: "تغطية شاملة لجميع المحافظات والمناطق النائية مع خدمة الدفع عند الاستلام"
    }
  ];

  let courierCount = 0;
  for (const c of couriersToSeed) {
    let existing = await Courier.findOne({ name: c.name });
    if (!existing) {
      await Courier.create(c);
      courierCount++;
      console.log(`+ Added courier: ${c.name} [Type: ${c.type}, Default Cost: ${c.defaultCost} EGP]`);
    } else {
      existing.type = c.type;
      existing.userId = c.userId;
      existing.branchId = c.branchId;
      existing.phone = c.phone;
      existing.defaultCost = c.defaultCost;
      existing.notes = c.notes;
      await existing.save();
      console.log(`✓ Updated courier: ${c.name} [Cost: ${c.defaultCost} EGP]`);
    }
  }

  // 7. Seed Customer Reviews for Technicians & Couriers
  console.log("\n[Step 6] Seeding Customer Reviews for Technicians & Couriers...");

  const reviewsToSeed = [
    // Reviews for Hossam (Main Branch Technician)
    {
      employeeEmail: "hossam.abdallah@store.com",
      branchId: mainBranch._id,
      serviceType: "maintenance",
      customerName: "د. طارق العوضي",
      customerPhone: "01099881122",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "المهندس حسام في غاية الاحترام والمهنية، قام بفحص وإصلاح شاشة الهاتف في وقت قياسي وبأعلى درجات الدقة والنظافة."
    },
    {
      employeeEmail: "hossam.abdallah@store.com",
      branchId: mainBranch._id,
      serviceType: "maintenance",
      customerName: "أ. مينا سامي غبريال",
      customerPhone: "01233441199",
      rating: 5,
      criteria: { punctuality: 4, professionalism: 5, quality: 5 },
      comment: "صيانة احترافية وقطع غيار أصلية مختومة مع ضمان معتمد. فني ممتاز ومستمع جيد."
    },
    {
      employeeEmail: "hossam.abdallah@store.com",
      branchId: mainBranch._id,
      serviceType: "maintenance",
      customerName: "م. شريف فهمي",
      customerPhone: "01122556677",
      rating: 4,
      criteria: { punctuality: 4, professionalism: 4, quality: 5 },
      comment: "جودة صيانة ممتازة جدا، فقط تأخر التسليم ربع ساعة عن الموعد المتفق عليه لضغط الورشة."
    },

    // Reviews for Ziad (Main Branch Courier)
    {
      employeeEmail: "ziad.sherif@store.com",
      branchId: mainBranch._id,
      serviceType: "delivery",
      customerName: "سارة النحاس",
      customerPhone: "01004455667",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "الكابتن زياد قمة في الذوق، وصل في الميعاد بالدقيقة وتواصل معي تليفونياً قبل الوصول بربع ساعة."
    },
    {
      employeeEmail: "ziad.sherif@store.com",
      branchId: mainBranch._id,
      serviceType: "delivery",
      customerName: "د. إبراهيم الخولي",
      customerPhone: "01223344556",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "شحنة مغلفة بعناية تامة ومندوب توصيل راقٍ ومبتسم. شكراً لفريق المتجر."
    },

    // Reviews for Islam Badri (Alexandria Technician)
    {
      employeeEmail: "islam.badri@store.com",
      branchId: alexBranch._id,
      serviceType: "maintenance",
      customerName: "أحمد عبد المنعم العطار",
      customerPhone: "01144558899",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "المهندس إسلام بدري عبقري صيانة حقيقي! حل مشكلة في بوردة الجهاز عجزت عنها مراكز أخرى في الإسكندرية."
    },
    {
      employeeEmail: "islam.badri@store.com",
      branchId: alexBranch._id,
      serviceType: "maintenance",
      customerName: "نهال المرشدي",
      customerPhone: "01011889977",
      rating: 5,
      criteria: { punctuality: 4, professionalism: 5, quality: 5 },
      comment: "خدمة راقية وسرعة في استبدال البطارية مع فحص شامل للأداء قبل الاستلام."
    },

    // Reviews for Karim (Alexandria Courier)
    {
      employeeEmail: "karim.menshawy@store.com",
      branchId: alexBranch._id,
      serviceType: "delivery",
      customerName: "مصطفى قاسم",
      customerPhone: "01299887766",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "توصيل سريع جداً في منطقة سموحة، المندوب كريم أمين ولبق ووصل الطلب بحالة ممتازة."
    },

    // Reviews for Omar Gazzar (Giza Technician)
    {
      employeeEmail: "omar.gazzar@store.com",
      branchId: gizaBranch._id,
      serviceType: "maintenance",
      customerName: "م. حازم القاضي",
      customerPhone: "01077665544",
      rating: 5,
      criteria: { punctuality: 5, professionalism: 5, quality: 5 },
      comment: "مهندس عمر ممتاز ومتمكن للغاية في تشخيص الأعطال البرمجية والعتادية المعقدة."
    }
  ];

  let reviewCount = 0;
  for (const r of reviewsToSeed) {
    const emp = createdStaffMap[r.employeeEmail];
    if (!emp) continue;

    const exists = await Review.findOne({
      employeeId: emp._id,
      customerName: r.customerName
    });

    if (!exists) {
      const crypto = require("crypto");
      const token = crypto.randomBytes(16).toString("hex");

      await Review.create({
        employeeId: emp._id,
        branchId: r.branchId,
        serviceType: r.serviceType,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        rating: r.rating,
        criteria: r.criteria,
        comment: r.comment,
        token,
        status: "submitted",
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000)
      });
      reviewCount++;
      console.log(`+ Added review: ${r.rating}★ for ${emp.fullname} by ${r.customerName}`);
    }
  }
  console.log(`✓ Seeded ${reviewCount} new customer reviews`);

  // 8. Log Administrative Activities
  console.log("\n[Step 7] Recording Administrative Activities...");
  try {
    const activities = [
      {
        eventType: "expense_recorded",
        userId: superAdminId,
        branchId: mainBranch._id
      }
    ];

    for (const act of activities) {
      await Activity.create(act);
    }
    console.log(`✓ Seeded activity log entries`);
  } catch (actErr) {
    console.log("Activity log notice:", actErr.message);
  }

  console.log("\n=================================================");
  console.log("=== Enterprise HR Seeding Completed Cleanly! ===");
  console.log("=================================================");
  process.exit(0);
}

seedEnterpriseHR().catch((err) => {
  console.error("Error during HR seeding:", err);
  process.exit(1);
});
