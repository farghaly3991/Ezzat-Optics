const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const getOrdersModel = require("../modules/orders/orderModel");
const getAttendanceModel = require("../modules/branches/models/attendanceModel");
const getDeductionModel = require("../modules/branches/models/deductionModel");

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

function normalizeDate(d) {
  const norm = new Date(d);
  norm.setHours(0, 0, 0, 0);
  return norm;
}

async function run() {
  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Orders = getOrdersModel(SUBDOMAIN);
  const Attendance = getAttendanceModel(SUBDOMAIN);
  const Deduction = getDeductionModel(SUBDOMAIN);

  const mainBranch = (await Branch.findOne({ isMain: true })) || (await Branch.findOne({}));
  const targetEmail = "tech.test.1793469487841@branch.com";
  const hossam = await Users.findOne({ email: targetEmail });

  if (!hossam) {
    console.error("Target user not found!");
    process.exit(1);
  }

  console.log(`Setting up orders & attendance for ${hossam.fullname} (${hossam._id})...`);

  // 1. Ensure 2 POS orders
  await Orders.deleteMany({ orderId: { $in: ["POS-HSM-101", "POS-HSM-102"] } });

  await Orders.create({
    orderId: "POS-HSM-101",
    branchId: mainBranch._id,
    assignedStaffId: hossam._id,
    posCashierId: hossam._id,
    customer: {
      name: "أحمد مصطفى القاضي",
      phone: "01002233445",
      address: "شارع النصر، المعادي",
      city: "القاهرة"
    },
    items: [
      {
        productId: "PROD-POS-1",
        name: "شاشة استبدال فحص OLED أصلية + صيانة وتركيب",
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
    shippingSnapshot: { matchMethod: "pos_direct", selectedClassName: "مبيعات مباشرة من الفرع" },
    timeline: [
      {
        status: "delivered",
        at: new Date(),
        note: `عملية بيع فورية وصيانة معتمدة تم تنفيذها بالمعرض بواسطة ${hossam.fullname}`
      }
    ]
  });

  await Orders.create({
    orderId: "POS-HSM-102",
    branchId: mainBranch._id,
    assignedStaffId: hossam._id,
    posCashierId: hossam._id,
    customer: {
      name: "د. سامح عبد الرازق",
      phone: "01233445566",
      address: "دجلة المعادي",
      city: "القاهرة"
    },
    items: [
      {
        productId: "PROD-POS-2",
        name: "بطارية ليثيوم 5000mAh أصلية + فحص دوائر الشحن",
        price: 2400,
        quantity: 1
      }
    ],
    deliveryMethod: "pickup",
    pickupCompletedAt: new Date(),
    pickupCompletedBy: hossam._id,
    payment: { method: "cod", paid: true },
    subtotal: 2400,
    total: 2400,
    status: "delivered",
    shippingSnapshot: { matchMethod: "pos_direct", selectedClassName: "مبيعات مباشرة من الفرع" },
    timeline: [
      {
        status: "delivered",
        at: new Date(),
        note: `فاتورة بيع مباشر واستبدال بطارية فورية عبر ${hossam.fullname}`
      }
    ]
  });

  console.log("✓ Created 2 POS Orders totaling 7,200 EGP");

  // 2. Ensure 2 Online Orders
  await Orders.deleteMany({ orderId: { $in: ["ORD-ONLINE-HSM-01", "ORD-ONLINE-HSM-02"] } });

  await Orders.create({
    orderId: "ORD-ONLINE-HSM-01",
    branchId: mainBranch._id,
    assignedStaffId: hossam._id,
    customer: {
      name: "م. رامي فهمي",
      phone: "01122334455",
      address: "عمارات العروبة، المعادي الجديدة",
      city: "القاهرة"
    },
    items: [
      {
        productId: "PROD-ONL-1",
        name: "هاتف محمول مع شهادة فحص معتمد",
        price: 16500,
        quantity: 1
      }
    ],
    deliveryMethod: "delivery",
    payment: { method: "card", paid: true },
    subtotal: 16500,
    total: 16500,
    status: "delivered",
    timeline: [
      {
        status: "confirmed",
        at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        note: `تم فحص وتأكيد الطلبية بواسطة ${hossam.fullname}`
      },
      {
        status: "delivered",
        at: new Date(),
        note: `اكتمال الفحص والتسليم بنجاح بإشراف ${hossam.fullname}`
      }
    ]
  });

  await Orders.create({
    orderId: "ORD-ONLINE-HSM-02",
    branchId: mainBranch._id,
    assignedStaffId: hossam._id,
    customer: {
      name: "أ. نورهان السعدني",
      phone: "01099887766",
      address: "زهراء المعادي - الشطر العاشر",
      city: "القاهرة"
    },
    items: [
      {
        productId: "PROD-ONL-2",
        name: "سماعات ذكية + ملحقات صيانة",
        price: 5400,
        quantity: 1
      }
    ],
    deliveryMethod: "delivery",
    payment: { method: "cod", paid: false },
    subtotal: 5400,
    total: 5400,
    status: "preparing",
    timeline: [
      {
        status: "preparing",
        at: new Date(),
        note: `جاري تجهيز وتغليف المنتج وضبط إعدادات التشغيل بواسطة ${hossam.fullname}`
      }
    ]
  });

  console.log("✓ Created 2 Online Orders totaling 21,900 EGP");

  // 3. Ensure attendance has explicit checkIn and checkOut Date objects
  await Attendance.deleteMany({ employeeId: hossam._id });
  const today = new Date();

  // Exactly 7 days for the 7-day display
  const days = [
    { offset: 0, status: "present", inH: 9, inM: 2, outH: 17, outM: 8, method: "biometric" },
    { offset: 1, status: "late", inH: 9, inM: 42, outH: 17, outM: 15, method: "biometric", notes: "تأخر 42 دقيقة بسبب الزحام المروري" },
    { offset: 2, status: "present", inH: 8, inM: 55, outH: 17, outM: 5, method: "biometric" },
    { offset: 3, status: "early_leave", inH: 9, inM: 0, outH: 13, outM: 0, method: "biometric", notes: "انصراف مبكر لظرف طارئ" },
    { offset: 4, status: "approved_leave", isApprovedLeave: true, leaveReason: "عذر مرضي معتمد ومرفق به تقرير طبي", method: "manual" },
    { offset: 5, status: "present", inH: 8, inM: 52, outH: 17, outM: 10, method: "biometric" },
    { offset: 6, status: "absent", notes: "غياب غير مصرح به بدون إذن مسبق" }
  ];

  for (const d of days) {
    const dDate = new Date(today);
    dDate.setDate(today.getDate() - d.offset);
    const norm = normalizeDate(dDate);

    let checkIn = null;
    let checkOut = null;
    let totalMinutes = 0;

    if (d.status !== "absent" && d.status !== "approved_leave") {
      checkIn = new Date(dDate);
      checkIn.setHours(d.inH, d.inM, 0);

      checkOut = new Date(dDate);
      checkOut.setHours(d.outH, d.outM, 0);

      totalMinutes = Math.round((checkOut - checkIn) / (1000 * 60));
    }

    await Attendance.create({
      employeeId: hossam._id,
      branchId: mainBranch._id,
      date: norm,
      checkIn,
      checkInMethod: d.method || "biometric",
      checkOut,
      checkOutMethod: d.method || "biometric",
      totalMinutes,
      status: d.status,
      isApprovedLeave: Boolean(d.isApprovedLeave),
      leaveReason: d.leaveReason || "",
      notes: d.notes || ""
    });
  }

  console.log("✓ Seeded exactly 7 days of attendance with clean Date timestamps and statuses");

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
