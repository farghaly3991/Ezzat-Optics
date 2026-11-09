const jwt = require("jsonwebtoken");
const getUsersModel = require("./userModel");
const getOrdersModel = require("../orders/orderModel");
const getClientProfileModel = require("../recommendation/clientProfileModel");
const getBranchModel = require("../branches/branchModel");
const getAdminDataModel = require("../settings/adminDataModel");

function makeToken(user, secret) {
  return jwt.sign(
    { userId: user._id, role: user.role, email: user.email, name: user.fullname },
    secret,
    { expiresIn: "30d" }
  );
}

exports.login = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const identifier = (req.body.identifier || req.body.phone || req.body.email || "").toString().trim();
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: "رقم الهاتف أو البريد الإلكتروني وكلمة المرور مطلوبة" });
    }

    const cleanPhone = identifier.replace(/[\s-]/g, "");
    const user = await Users.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier },
        { phone: cleanPhone }
      ]
    });
    if (!user) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });

    // Check online account access for regular customers (role 1 / "user")
    if ([1, "1", "user"].includes(user.role)) {
      const AdminData = getAdminDataModel(req.subdomain);
      const adminSettings = await AdminData.findOne().lean();
      if (adminSettings && adminSettings.allowCustomerStoreAccounts === false) {
        return res.status(403).json({ error: "تسجيل دخول العملاء للمتجر الإلكتروني غير متاح حالياً من إعدادات المتجر" });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const secret = req.JWT_SECRET || process.env.JWT_SECRET || "default_jwt_secret";
    const token = makeToken(user, secret);

    res.json({
      done: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        fullname: user.fullname,
        phone: user.phone,
        address: user.address,
        role: user.role
      },
      message: "تم تسجيل الدخول بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    let { email, password, fullname, phone, address, city } = req.body;

    if (!fullname || !password || !phone) {
      return res.status(400).json({ error: "جميع الحقول الأساسية مطلوبة (الاسم، رقم الهاتف، كلمة المرور)" });
    }

    const cleanPhone = phone.toString().trim().replace(/[\s-]/g, "");
    if (!email || !email.trim()) {
      email = `${cleanPhone}@optics.local`;
    } else {
      email = email.toLowerCase().trim();
    }

    const existingPhone = await Users.findOne({
      $or: [{ phone: phone.trim() }, { phone: cleanPhone }]
    });
    if (existingPhone) {
      return res.status(400).json({ error: "رقم الهاتف هذا مسجل بالفعل مسبقاً" });
    }

    const existingEmail = await Users.findOne({ email });
    if (existingEmail && !email.endsWith("@optics.local")) {
      return res.status(400).json({ error: "هذا البريد الإلكتروني مسجل بالفعل" });
    }

    const AdminData = getAdminDataModel(req.subdomain);
    const adminSettings = await AdminData.findOne().lean();
    if (adminSettings && adminSettings.allowCustomerStoreAccounts === false) {
      return res.status(403).json({ error: "إنشاء حسابات عملاء جديدة على المتجر الإلكتروني غير متاح حالياً" });
    }

    const user = await new Users({
      email,
      password,
      fullname: fullname.trim(),
      phone: phone.trim(),
      address: address || "",
      city: city || "",
      role: 1,
      hasOnlineAccount: true
    }).save();

    const secret = req.JWT_SECRET || process.env.JWT_SECRET || "default_jwt_secret";
    const token = makeToken(user, secret);

    res.json({
      done: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        fullname: user.fullname,
        phone: user.phone,
        role: user.role
      },
      message: "تم إنشاء حسابك بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.json({ done: true, user: req.user });
};

exports.toggleWishlist = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const { recordActivity, extractActorContext } = require("../activity/activityService");
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: "معرف المنتج مطلوب" });

    const user = await Users.findById(req.user._id);
    const index = user.wishlist.findIndex((id) => id.toString() === productId.toString());
    let added = false;

    if (index > -1) {
      user.wishlist.splice(index, 1);
    } else {
      user.wishlist.push(productId);
      added = true;
    }

    await user.save();

    try {
      const actor = extractActorContext(req, { userId: req.user._id });
      await recordActivity(req.subdomain, {
        eventType: added ? "wishlist_added" : "wishlist_removed",
        productId,
        userId: actor.userId,
        visitorId: actor.visitorId,
        sessionId: actor.sessionId,
        cartId: actor.cartId
      });
    } catch (actErr) {
      console.warn("[ACTIVITY_WISHLIST_WARN]", actErr.message);
    }

    res.json({ done: true, wishlist: user.wishlist, added });
  } catch (err) {
    next(err);
  }
};

exports.listCustomers = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const Orders = getOrdersModel(req.subdomain);
    const ClientProfile = getClientProfileModel(req.subdomain);
    getBranchModel(req.subdomain);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();
    const branchId = req.query.branchId;

    // Filter regular customer accounts only (exclude staff, techs, managers, admins)
    const filter = {
      $and: [
        {
          role: {
            $nin: [2, 3, 4, 5, "2", "3", "4", "5", "admin", "manager", "staff", "technician", "super_admin"]
          }
        }
      ]
    };

    if (search) {
      filter.$and.push({
        $or: [
          { fullname: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } }
        ]
      });
    }

    if (branchId && branchId !== "all") {
      filter.$and.push({ branchId });
    }

    const total = await Users.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;

    const customers = await Users.find(filter)
      .select("-password")
      .populate("branchId", "name code city")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // High performance bulk aggregation for orders/spending across this single page's users
    const userIds = customers.map((c) => c._id);
    const phones = customers.map((c) => c.phone).filter(Boolean);

    let ordersStatsMap = new Map();
    if (userIds.length > 0 || phones.length > 0) {
      const matchCriteria = [];
      if (userIds.length > 0) matchCriteria.push({ userId: { $in: userIds } });
      if (phones.length > 0) matchCriteria.push({ "customer.phone": { $in: phones } });

      const stats = await Orders.aggregate([
        {
          $match: {
            $or: matchCriteria,
            status: { $ne: "cancelled" }
          }
        },
        {
          $group: {
            _id: {
              userId: "$userId",
              phone: "$customer.phone"
            },
            count: { $sum: 1 },
            totalSpent: { $sum: { $ifNull: ["$total", 0] } },
            lastOrderDate: { $max: "$createdAt" }
          }
        }
      ]);

      stats.forEach((st) => {
        if (st._id.userId) {
          const key = String(st._id.userId);
          const current = ordersStatsMap.get(key) || { count: 0, totalSpent: 0, lastOrderDate: null };
          ordersStatsMap.set(key, {
            count: current.count + st.count,
            totalSpent: current.totalSpent + st.totalSpent,
            lastOrderDate: current.lastOrderDate && current.lastOrderDate > st.lastOrderDate ? current.lastOrderDate : st.lastOrderDate
          });
        }
        if (st._id.phone) {
          const key = String(st._id.phone);
          const current = ordersStatsMap.get(key) || { count: 0, totalSpent: 0, lastOrderDate: null };
          ordersStatsMap.set(key, {
            count: current.count + st.count,
            totalSpent: current.totalSpent + st.totalSpent,
            lastOrderDate: current.lastOrderDate && current.lastOrderDate > st.lastOrderDate ? current.lastOrderDate : st.lastOrderDate
          });
        }
      });
    }

    const enriched = customers.map((c) => {
      const byId = ordersStatsMap.get(String(c._id)) || { count: 0, totalSpent: 0, lastOrderDate: null };
      const byPhone = c.phone ? ordersStatsMap.get(String(c.phone)) : null;
      const ordersCount = Math.max(byId.count, byPhone?.count || 0);
      const totalSpent = Math.max(byId.totalSpent, byPhone?.totalSpent || 0);
      const lastOrderDate = byId.lastOrderDate || byPhone?.lastOrderDate || null;

      return {
        ...c,
        ordersCount,
        totalSpent,
        lastOrderDate,
        branch: c.branchId ? { _id: c.branchId._id, name: c.branchId.name, city: c.branchId.city } : null
      };
    });

    res.json({
      done: true,
      customers: enriched,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Customer Profile
 */
exports.updateCustomer = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const { id } = req.params;
    const { fullname, phone, email, address, city, active, branchId } = req.body;

    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    // Protect administrative accounts
    if ([2, 3, 4, 5, "admin", "manager", "staff"].includes(user.role)) {
      return res.status(403).json({ error: "لا يمكن تعديل حسابات الموظفين أو الإدارة من سجل العملاء" });
    }

    if (fullname !== undefined) user.fullname = fullname.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (address !== undefined) user.address = address.trim();
    if (city !== undefined) user.city = city.trim();
    if (active !== undefined) user.active = Boolean(active);
    if (branchId !== undefined) user.branchId = branchId || null;
    if (req.body.hasOnlineAccount !== undefined) user.hasOnlineAccount = Boolean(req.body.hasOnlineAccount);

    // Optics Patient Profile fields
    if (req.body.birthDate !== undefined) user.birthDate = req.body.birthDate ? new Date(req.body.birthDate) : null;
    if (req.body.gender !== undefined) user.gender = req.body.gender;
    if (req.body.nextCheckupDate !== undefined) user.nextCheckupDate = req.body.nextCheckupDate ? new Date(req.body.nextCheckupDate) : null;
    if (req.body.checkupPeriodMonths !== undefined) user.checkupPeriodMonths = Number(req.body.checkupPeriodMonths) || 12;
    if (req.body.depositBalance !== undefined) user.depositBalance = Number(req.body.depositBalance) || 0;
    if (req.body.prescriptions !== undefined && Array.isArray(req.body.prescriptions)) {
      user.prescriptions = req.body.prescriptions;
    }

    if (email && email.trim().toLowerCase() !== user.email) {
      const existing = await Users.findOne({ email: email.trim().toLowerCase(), _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل من عميل آخر" });
      }
      user.email = email.trim().toLowerCase();
    }

    await user.save();

    res.json({ done: true, message: "تم تحديث بيانات العميل بنجاح", user });
  } catch (err) {
    next(err);
  }
};

/**
 * Change / Reset Customer Password
 */
exports.updateCustomerPassword = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length < 4) {
      return res.status(400).json({ error: "كلمة المرور يجب أن لا تقل عن 4 أحرف أو أرقام" });
    }

    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    if ([2, 3, 4, 5, "admin", "manager", "staff"].includes(user.role)) {
      return res.status(403).json({ error: "لا يمكن تعديل كلمة مرور الموظفين أو الإدارة من هنا" });
    }

    user.password = String(newPassword).trim();
    await user.save(); // triggers bcrypt hash in pre-save hook

    res.json({ done: true, message: "تم تغيير كلمة مرور العميل بنجاح" });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete Customer (preserving financial orders & statistics)
 */
exports.deleteCustomer = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const ClientProfile = getClientProfileModel(req.subdomain);
    const { id } = req.params;

    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    if ([2, 3, 4, 5, "admin", "manager", "staff"].includes(user.role)) {
      return res.status(403).json({ error: "لا يمكن حذف حسابات الموظفين أو الإدارة من هنا" });
    }

    const userPhone = user.phone;

    // Delete user document
    await Users.findByIdAndDelete(id);

    // Delete customer interest persona / profile
    try {
      await ClientProfile.deleteMany({
        $or: [{ userId: id }, { phone: userPhone }]
      });
    } catch (_) {}

    // Note: Orders, returns, and financial audit records are PRESERVED for accurate accounting and history!

    res.json({ done: true, message: "تم حذف العميل بنجاح (مع الاحتفاظ بالسجلات المحاسبية والطلبات)" });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk Delete Selected Customers
 */
exports.bulkDeleteCustomers = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const ClientProfile = getClientProfileModel(req.subdomain);
    const { ids = [] } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد عميل واحد على الأقل للحذف" });
    }

    // Safety: exclude administrative accounts
    const targetUsers = await Users.find({
      _id: { $in: ids },
      role: { $nin: [2, 3, 4, 5, "2", "3", "4", "5", "admin", "manager", "staff"] }
    }).select("_id phone").lean();

    const validIds = targetUsers.map((u) => u._id);
    const phones = targetUsers.map((u) => u.phone).filter(Boolean);

    if (validIds.length === 0) {
      return res.status(400).json({ error: "لم يتم العثور على عملاء مؤهلين للحذف" });
    }

    await Users.deleteMany({ _id: { $in: validIds } });

    try {
      await ClientProfile.deleteMany({
        $or: [
          { userId: { $in: validIds } },
          { phone: { $in: phones } }
        ]
      });
    } catch (_) {}

    res.json({
      done: true,
      message: `تم حذف ${validIds.length} من العملاء المحددين بنجاح`,
      deletedCount: validIds.length
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Create Customer directly from dashboard / POS
 * No email or password required by default (auto-generated from phone)
 */
exports.createCustomer = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const {
      fullname,
      phone,
      email,
      password,
      address = "",
      city = "",
      branchId = null,
      birthDate = null,
      gender = "",
      checkupPeriodMonths = 12,
      prescriptions = [],
      depositBalance = 0
    } = req.body;

    if (!fullname || !fullname.trim()) {
      return res.status(400).json({ error: "اسم العميل مطلوب" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: "رقم هاتف العميل مطلوب" });
    }

    const cleanPhone = phone.trim();
    // Check if phone already registered
    const existingPhone = await Users.findOne({ phone: cleanPhone });
    if (existingPhone) {
      return res.status(400).json({ error: "رقم الهاتف مسجل بالفعل لعميل آخر", existingUser: existingPhone });
    }

    // Auto generate email if not provided
    const cleanEmail = email && email.trim()
      ? email.trim().toLowerCase()
      : `${cleanPhone.replace(/[^0-9]/g, "") || Date.now()}@customer.store`;

    const cleanPassword = password && String(password).trim()
      ? String(password).trim()
      : cleanPhone.slice(-6) || "123456";

    const newCustomer = new Users({
      fullname: fullname.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password: cleanPassword,
      address: address.trim(),
      city: city.trim(),
      branchId: branchId || null,
      role: 1,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || "",
      checkupPeriodMonths: Number(checkupPeriodMonths) || 12,
      prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
      depositBalance: Number(depositBalance) || 0
    });

    await newCustomer.save();

    res.status(201).json({
      done: true,
      message: "تم إنشاء ملف العميل البصري بنجاح",
      user: newCustomer
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Add new optical prescription to customer record
 */
exports.addCustomerPrescription = async (req, res, next) => {
  try {
    const Users = getUsersModel(req.subdomain);
    const { id } = req.params;
    const { prescription } = req.body;

    if (!prescription) {
      return res.status(400).json({ error: "بيانات كشف النظر مطلوبة" });
    }

    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    user.prescriptions.unshift(prescription);

    // Calculate next checkup date automatically
    const months = user.checkupPeriodMonths || 12;
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + months);
    user.nextCheckupDate = nextDate;

    await user.save();

    const { logAudit } = require("../audit/auditService");
    await logAudit({
      subdomain: req.subdomain,
      userId: req.user?._id,
      userName: req.user?.fullname || req.user?.name || "المسؤول",
      userRole: req.user?.role || "admin",
      action: "prescription_added",
      actionLabel: "إضافة كشف نظر جديد لعميل",
      targetType: "customer",
      targetId: String(user._id),
      targetCode: user.phone,
      details: `تم تسجيل كشف نظر جديد للعميل ${user.fullname} (طبيب: ${prescription.doctorName || "غير محدد"})`,
      metadata: { prescription }
    });

    res.json({
      done: true,
      message: "تم حفظ كشف النظر بنجاح في سجل العميل",
      prescriptions: user.prescriptions,
      nextCheckupDate: user.nextCheckupDate
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Get Comprehensive Customer 360 Profile (بروفايل العميل الشامل)
 * Returns customer info, age, previous orders, ongoing active orders,
 * deposit balance, total paid, remaining payable, and prescription history.
 */
exports.getCustomerProfile = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;

    const Users = getUsersModel(subdomain);
    const getOrdersModel = require("../orders/orderModel");
    const Orders = getOrdersModel(subdomain);

    const user = await Users.findById(id).lean();
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    // Clean phone for lookup
    const cleanPhone = (user.phone || "").replace(/[\s-]/g, "");

    // Fetch all customer orders (past and present)
    const orders = await Orders.find({
      $or: [
        { userId: user._id },
        { "customer.phone": user.phone },
        { "customer.phone": cleanPhone }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();

    let totalSpent = 0;
    let totalPaid = 0;
    let remainingPayable = 0;
    const activeOrders = [];
    const completedOrders = [];

    for (const ord of orders) {
      const ordTotal = Number(ord.total || 0);
      const pays = ord.paymentsSnapshot || {
        totalAmount: ordTotal,
        paidAmount: ord.payment?.paid ? ordTotal : 0,
        remainingAmount: ord.payment?.paid ? 0 : ordTotal
      };

      totalSpent += ordTotal;
      totalPaid += Number(pays.paidAmount || 0);

      const isCompleted = ord.status === "delivered" || ord.status === "cancelled";
      if (!isCompleted) {
        activeOrders.push(ord);
        remainingPayable += Number(pays.remainingAmount || 0);
      } else if (ord.status === "delivered") {
        completedOrders.push(ord);
      }
    }

    // Calculate age if birthDate is present
    let age = null;
    if (user.birthDate) {
      const birth = new Date(user.birthDate);
      const diffMs = Date.now() - birth.getTime();
      const ageDate = new Date(diffMs);
      age = Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    // Determine latest prescription and whether re-exam is recommended
    const prescriptions = user.prescriptions || [];
    const latestPrescription = prescriptions[0] || null;

    let requiresReExam = false;
    let daysSinceLastExam = null;

    if (latestPrescription && latestPrescription.examDate) {
      const examTime = new Date(latestPrescription.examDate).getTime();
      daysSinceLastExam = Math.floor((Date.now() - examTime) / (1000 * 60 * 60 * 24));
      if (daysSinceLastExam > 365) {
        requiresReExam = true;
      }
    } else if (user.nextCheckupDate) {
      if (new Date(user.nextCheckupDate) <= new Date()) {
        requiresReExam = true;
      }
    }

    res.json({
      done: true,
      profile: {
        _id: user._id,
        fullname: user.fullname,
        phone: user.phone,
        email: user.email,
        address: user.address,
        city: user.city,
        birthDate: user.birthDate,
        age,
        gender: user.gender,
        depositBalance: Number(user.depositBalance || 0),
        nextCheckupDate: user.nextCheckupDate,
        checkupPeriodMonths: user.checkupPeriodMonths || 12,
        requiresReExam,
        daysSinceLastExam,
        prescriptions,
        latestPrescription,
        stats: {
          totalOrdersCount: orders.length,
          activeOrdersCount: activeOrders.length,
          completedOrdersCount: completedOrders.length,
          totalSpent,
          totalPaid,
          remainingPayable,
          depositBalance: Number(user.depositBalance || 0)
        },
        activeOrders,
        completedOrders,
        allOrders: orders
      }
    });
  } catch (err) {
    next(err);
  }
};

const getStoreClientProfileModel = require("./clientProfileModel");

exports.listCustomerCustomProfiles = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const Users = getUsersModel(subdomain);
    const user = await Users.findById(id).lean();
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    const ClientProfiles = getStoreClientProfileModel(subdomain);
    let profiles = await ClientProfiles.find({ userId: user._id })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Backward compatibility: If no records in storeClientProfile but prescriptions exist on user
    if (profiles.length === 0 && user.prescriptions && user.prescriptions.length > 0) {
      profiles = user.prescriptions.map((p, idx) => ({
        _id: p._id || `legacy-${idx}`,
        userId: user._id,
        date: p.examDate || p.createdAt || Date.now(),
        title: p.doctorName ? `كشف د/ ${p.doctorName}` : "كشف نظر سابق",
        fieldValues: {
          doctorName: p.doctorName || "",
          usageType: p.usageType || "",
          ipd: p.ipd || ""
        },
        matrixData: {
          OD: {
            sph: p.rightEye?.sph || "",
            cyl: p.rightEye?.cyl || "",
            axis: p.rightEye?.axis || "",
            add: p.rightEye?.add || "",
            pd: p.rightEye?.pd || ""
          },
          OS: {
            sph: p.leftEye?.sph || "",
            cyl: p.leftEye?.cyl || "",
            axis: p.leftEye?.axis || "",
            add: p.leftEye?.add || "",
            pd: p.leftEye?.pd || ""
          }
        },
        attachments: p.attachment ? [p.attachment] : [],
        notes: p.notes || ""
      }));
    }

    res.json({ done: true, profiles });
  } catch (err) {
    next(err);
  }
};

exports.createCustomerCustomProfile = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const { date, title, fieldValues = {}, matrixData = {}, attachments = [], notes = "" } = req.body;

    const Users = getUsersModel(subdomain);
    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    const ClientProfiles = getStoreClientProfileModel(subdomain);
    const newProfile = await ClientProfiles.create({
      userId: user._id,
      date: date ? new Date(date) : new Date(),
      title: title || "",
      fieldValues,
      matrixData,
      attachments,
      notes,
      branchId: req.user?.branchId || null,
      createdBy: req.user?._id || null
    });

    // Sync to user.latestPrescription for seamless backward compatibility if matrixData has OD/OS
    if (matrixData?.OD || matrixData?.OS) {
      const rightEye = matrixData.OD || {};
      const leftEye = matrixData.OS || {};
      const legacyPrescription = {
        rightEye: {
          sph: rightEye.sph || "",
          cyl: rightEye.cyl || "",
          axis: rightEye.axis || "",
          add: rightEye.add || "",
          pd: rightEye.pd || ""
        },
        leftEye: {
          sph: leftEye.sph || "",
          cyl: leftEye.cyl || "",
          axis: leftEye.axis || "",
          add: leftEye.add || "",
          pd: leftEye.pd || ""
        },
        ipd: fieldValues.ipd || "",
        doctorName: fieldValues.doctorName || "",
        usageType: fieldValues.usageType || "",
        examDate: date ? new Date(date) : new Date(),
        notes,
        attachment: attachments[0] || ""
      };
      user.prescriptions.unshift(legacyPrescription);
      await user.save();
    }

    const { logAudit } = require("../audit/auditService");
    await logAudit({
      subdomain,
      userId: req.user?._id,
      branchId: req.user?.branchId,
      action: "CLIENT_PROFILE_RECORD_CREATED",
      targetType: "user",
      targetId: user._id,
      details: {
        profileId: newProfile._id,
        title: newProfile.title,
        date: newProfile.date
      }
    });

    res.status(201).json({
      done: true,
      message: "تم حفظ سجل العميل بنجاح",
      profile: newProfile
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomerCustomProfile = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id, profileId } = req.params;
    const ClientProfiles = getStoreClientProfileModel(subdomain);
    await ClientProfiles.findOneAndDelete({ _id: profileId, userId: id });

    res.json({ done: true, message: "تم حذف السجل بنجاح" });
  } catch (err) {
    next(err);
  }
};
