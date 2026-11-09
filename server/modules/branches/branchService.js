/**
 * Multi-Branch Management Service
 * Manages physical and regional store branches, manager assignments, and fallback creation.
 */

const getBranchModel = require("./branchModel");
const getUsersModel = require("../auth/userModel");
const getProductsModel = require("../products/productModel");
const getOrdersModel = require("../orders/orderModel");

/**
 * Ensures at least one default/main branch exists for the tenant
 */
async function ensureDefaultBranch(subdomain) {
  const Branch = getBranchModel(subdomain);
  let mainBranch = await Branch.findOne({ isMain: true }).lean();

  if (!mainBranch) {
    mainBranch = await Branch.findOne({ active: true }).sort({ createdAt: 1 }).lean();
  }

  if (!mainBranch) {
    const created = await Branch.create({
      name: "الفرع الرئيسي (المركز)",
      code: "MAIN-01",
      city: "القاهرة",
      address: "المعادي، القاهرة",
      phone: "01000000000",
      whatsapp: "01000000000",
      isMain: true,
      active: true
    });
    mainBranch = created.toObject();
  }

  return mainBranch;
}

/**
 * List all branches with live counts
 */
async function listBranches(subdomain, options = {}) {
  const Branch = getBranchModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const opts = options || {};
  const filter = {};
  if (opts.activeOnly) {
    filter.active = true;
  }

  const branches = await Branch.find(filter)
    .populate("managerId", "fullname email phone role")
    .sort({ isMain: -1, createdAt: 1 })
    .lean();

  if (branches.length === 0) {
    const defaultBranch = await ensureDefaultBranch(subdomain);
    return [defaultBranch];
  }

  // Attach live product count, order count & staff breakdown to each branch
  const enriched = await Promise.all(
    branches.map(async (b) => {
      const Users = getUsersModel(subdomain);
      const [productsCount, ordersCount, staffUsers] = await Promise.all([
        Products.countDocuments({ branchId: b._id }),
        Orders.countDocuments({ branchId: b._id }),
        Users.find({
          branchId: b._id,
          role: { $in: [2, 3, 4, "2", "3", "4", "branch_admin", "sales_staff", "maintenance_tech", "staff", "technician"] }
        })
          .select("role fullname email phone active")
          .lean()
      ]);

      const managersCount = staffUsers.filter((u) => Number(u.role) === 4 || u.role === "branch_admin").length;
      const salesCount = staffUsers.filter((u) => Number(u.role) === 3 || u.role === "sales_staff" || u.role === "staff").length;
      const techsCount = staffUsers.filter((u) => Number(u.role) === 2 || u.role === "maintenance_tech" || u.role === "technician").length;

      return {
        ...b,
        productsCount,
        ordersCount,
        staffCount: staffUsers.length,
        staffBreakdown: {
          managers: managersCount,
          sales: salesCount,
          techs: techsCount,
          total: staffUsers.length
        }
      };
    })
  );

  return enriched;
}

/**
 * Get branch by ID
 */
async function getBranchById(subdomain, branchId) {
  const Branch = getBranchModel(subdomain);
  const branch = await Branch.findById(branchId)
    .populate("managerId", "fullname email phone role")
    .lean();
  if (!branch) {
    const err = new Error("الفرع المطلوب غير موجود");
    err.status = 404;
    throw err;
  }
  return branch;
}

/**
 * Create a new branch (Super Admin Role 5 only)
 */
async function createBranch(subdomain, payload = {}, adminUser = {}) {
  const Branch = getBranchModel(subdomain);
  const Users = getUsersModel(subdomain);

  const {
    name,
    code,
    image = "",
    city,
    address,
    phone = "",
    whatsapp = "",
    isMain = false,
    active = true,
    managerData = null,
    managerId = null
  } = payload;

  if (!name || !name.trim()) {
    const err = new Error("اسم الفرع مطلوب");
    err.status = 400;
    throw err;
  }

  const cleanCode = String(code || name.slice(0, 4))
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .trim() || `BR-${Date.now().toString(36).toUpperCase()}`;

  const existingCode = await Branch.findOne({ code: cleanCode });
  if (existingCode) {
    const err = new Error(`كود الفرع (${cleanCode}) مسجل مسبقاً، يرجى اختيار كود آخر`);
    err.status = 400;
    throw err;
  }

  let finalManagerId = managerId;

  // If managerData provided (create new manager user on the fly)
  if (managerData && managerData.email && managerData.password) {
    let mgrUser = await Users.findOne({ email: managerData.email.toLowerCase().trim() });
    if (!mgrUser) {
      mgrUser = await Users.create({
        email: managerData.email.toLowerCase().trim(),
        password: managerData.password,
        fullname: managerData.fullname || `مدير ${name}`,
        phone: managerData.phone || phone || "01000000000",
        role: 4, // Role 4: Branch Admin
        active: true
      });
    } else {
      mgrUser.role = 4;
      await mgrUser.save();
    }
    finalManagerId = mgrUser._id;
  }

  if (isMain) {
    await Branch.updateMany({}, { $set: { isMain: false } });
  }

  const branch = await Branch.create({
    name: name.trim(),
    code: cleanCode,
    image,
    city: city || "القاهرة",
    address: address || "العنوان الرئيسي",
    phone: phone.trim(),
    whatsapp: whatsapp.trim(),
    managerId: finalManagerId,
    isMain: Boolean(isMain),
    active: active !== false
  });

  // Link manager to this branch
  if (finalManagerId) {
    await Users.findByIdAndUpdate(finalManagerId, {
      $set: { branchId: branch._id, role: 4 }
    });
  }

  return branch.toObject();
}

/**
 * Update existing branch (Super Admin Role 5 only)
 */
async function updateBranch(subdomain, branchId, payload = {}, adminUser = {}) {
  const Branch = getBranchModel(subdomain);
  const Users = getUsersModel(subdomain);

  const branch = await Branch.findById(branchId);
  if (!branch) {
    const err = new Error("الفرع المطلوب غير موجود");
    err.status = 404;
    throw err;
  }

  const {
    name,
    code,
    image,
    city,
    address,
    phone,
    whatsapp,
    isMain,
    active,
    managerId,
    managerData
  } = payload;

  if (code && code.trim().toUpperCase() !== branch.code) {
    const cleanCode = code.trim().toUpperCase();
    const existing = await Branch.findOne({ code: cleanCode, _id: { $ne: branchId } });
    if (existing) {
      const err = new Error(`كود الفرع (${cleanCode}) مسجل لفرع آخر`);
      err.status = 400;
      throw err;
    }
    branch.code = cleanCode;
  }

  if (name !== undefined) branch.name = name.trim();
  if (image !== undefined) branch.image = image;
  if (city !== undefined) branch.city = city.trim();
  if (address !== undefined) branch.address = address.trim();
  if (phone !== undefined) branch.phone = phone.trim();
  if (whatsapp !== undefined) branch.whatsapp = whatsapp.trim();
  if (active !== undefined) branch.active = Boolean(active);

  if (isMain === true) {
    await Branch.updateMany({ _id: { $ne: branchId } }, { $set: { isMain: false } });
    branch.isMain = true;
  } else if (isMain === false && branch.isMain) {
    // Ensure at least one branch remains main
    const other = await Branch.findOne({ _id: { $ne: branchId } });
    if (other) {
      other.isMain = true;
      await other.save();
      branch.isMain = false;
    }
  }

  // Handle manager update
  if (managerData && managerData.email && managerData.password) {
    let mgrUser = await Users.findOne({ email: managerData.email.toLowerCase().trim() });
    if (!mgrUser) {
      mgrUser = await Users.create({
        email: managerData.email.toLowerCase().trim(),
        password: managerData.password,
        fullname: managerData.fullname || `مدير ${branch.name}`,
        phone: managerData.phone || branch.phone || "01000000000",
        role: 4,
        branchId: branch._id,
        active: true
      });
    } else {
      mgrUser.role = 4;
      mgrUser.branchId = branch._id;
      await mgrUser.save();
    }
    branch.managerId = mgrUser._id;
  } else if (managerId !== undefined) {
    branch.managerId = managerId || null;
    if (managerId) {
      await Users.findByIdAndUpdate(managerId, {
        $set: { branchId: branch._id, role: 4 }
      });
    }
  }

  await branch.save();
  return branch.toObject();
}

/**
 * Delete branch (Super Admin Role 5 only)
 */
async function deleteBranch(subdomain, branchId, adminUser = {}) {
  const Branch = getBranchModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const branch = await Branch.findById(branchId);
  if (!branch) {
    const err = new Error("الفرع المطلوب غير موجود");
    err.status = 404;
    throw err;
  }

  if (branch.isMain) {
    const err = new Error("لا يمكن حذف الفرع الرئيسي للمتجر");
    err.status = 400;
    throw err;
  }

  const defaultBranch = await ensureDefaultBranch(subdomain);

  // Migrate or re-assign any orphaned products & orders to default main branch
  await Promise.all([
    Products.updateMany({ branchId: branch._id }, { $set: { branchId: defaultBranch._id } }),
    Orders.updateMany({ branchId: branch._id }, { $set: { branchId: defaultBranch._id } })
  ]);

  await Branch.findByIdAndDelete(branchId);

  return {
    deleted: true,
    message: `تم حذف الفرع وإعادة توجيه منتجاته وطلباته للفرع الرئيسي (${defaultBranch.name})`
  };
}

/**
 * Get all staff members belonging to a specific branch
 */
async function getBranchStaff(subdomain, branchId) {
  const Users = getUsersModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const branch = await Branch.findById(branchId).populate("managerId", "-password").lean();
  if (!branch) {
    const err = new Error("الفرع المطلوب غير موجود");
    err.status = 404;
    throw err;
  }

  const staff = await Users.find({
    branchId: branch._id,
    role: { $in: [2, 3, 4, "2", "3", "4", "branch_admin", "sales_staff", "maintenance_tech", "staff", "technician"] }
  })
    .select("-password")
    .sort({ role: -1, createdAt: 1 })
    .lean();

  const manager = staff.find((u) => String(u._id) === String(branch.managerId?._id || branch.managerId) || Number(u.role) === 4);
  const salesStaff = staff.filter((u) => Number(u.role) === 3 || u.role === "sales_staff" || u.role === "staff");
  const technicians = staff.filter((u) => Number(u.role) === 2 || u.role === "maintenance_tech" || u.role === "technician");

  return {
    branch,
    manager: manager || branch.managerId || null,
    salesStaff,
    technicians,
    allStaff: staff
  };
}

/**
 * Add a new staff member to a branch (Role 4: Manager, Role 3: Sales Staff, Role 2: Maintenance Tech)
 */
async function addBranchStaff(subdomain, branchId, staffData = {}, adminUser = {}) {
  const Users = getUsersModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const branch = await Branch.findById(branchId);
  if (!branch) {
    const err = new Error("الفرع المطلوب غير موجود");
    err.status = 404;
    throw err;
  }

  const { fullname, email, password, phone = "", role = 3 } = staffData;
  if (!email || !password || !fullname) {
    const err = new Error("الاسم والبريد الإلكتروني وكلمة المرور مطلوبة لإضافة الموظف");
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  let user = await Users.findOne({ email: normalizedEmail });

  const numRole = Number(role) || 3;

  if (user) {
    user.branchId = branch._id;
    user.role = numRole;
    user.fullname = fullname.trim();
    if (phone) user.phone = phone.trim();
    user.password = password; // Trigger pre-save hash
    user.active = true;
    await user.save();
  } else {
    user = await Users.create({
      email: normalizedEmail,
      password,
      fullname: fullname.trim(),
      phone: phone ? phone.trim() : "01000000000",
      role: numRole,
      branchId: branch._id,
      active: true
    });
  }

  if (numRole === 4) {
    branch.managerId = user._id;
    await branch.save();
  }

  return {
    _id: user._id,
    fullname: user.fullname,
    email: user.email,
    phone: user.phone,
    role: user.role,
    branchId: user.branchId,
    active: user.active
  };
}

/**
 * Update staff member details / role in a branch
 */
async function updateBranchStaff(subdomain, branchId, staffUserId, updateData = {}, adminUser = {}) {
  const Users = getUsersModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const branch = await Branch.findById(branchId).lean();
  let user = await Users.findById(staffUserId);
  if (!user) {
    const err = new Error("الموظف غير مسجل بهذا الفرع");
    err.status = 404;
    throw err;
  }

  const isUserInBranch = String(user.branchId) === String(branchId);
  const isBranchManager = branch && String(branch.managerId) === String(user._id);
  if (!isUserInBranch && !isBranchManager) {
    const isSuper = Number(adminUser?.role) === 5 || adminUser?.role === "super_admin" || adminUser?.isSuperAdmin;
    if (isSuper) {
      user.branchId = branchId;
    } else {
      const err = new Error("الموظف غير مسجل بهذا الفرع");
      err.status = 404;
      throw err;
    }
  }

  const {
    fullname,
    phone,
    role,
    active,
    password,
    monthlySalary,
    employmentType,
    jobTitle,
    workDays,
    shiftHours,
    shiftStart,
    shiftEnd,
    isAttendanceRequired
  } = updateData;
  if (fullname) user.fullname = fullname.trim();
  if (phone) user.phone = phone.trim();
  if (active !== undefined) user.active = Boolean(active);
  if (monthlySalary !== undefined) user.monthlySalary = Math.max(0, Number(monthlySalary) || 0);
  if (employmentType !== undefined) {
    user.employmentType = employmentType === "per_task" || employmentType === "per_task_freelance" ? "per_task" : "permanent";
  }
  if (jobTitle !== undefined) user.jobTitle = jobTitle.trim();
  if (Array.isArray(workDays)) user.workDays = workDays;
  if (shiftHours !== undefined) user.shiftHours = Math.max(1, Math.min(24, Number(shiftHours) || 8));
  if (shiftStart !== undefined) user.shiftStart = shiftStart;
  if (shiftEnd !== undefined) user.shiftEnd = shiftEnd;
  if (isAttendanceRequired !== undefined) user.isAttendanceRequired = Boolean(isAttendanceRequired);
  if (role !== undefined) {
    user.role = Number(role) || 3;
    if (Number(role) === 4) {
      await Branch.findByIdAndUpdate(branchId, { managerId: user._id });
    }
  }
  if (password && password.trim()) {
    user.password = password.trim();
  }

  await user.save();
  return {
    _id: user._id,
    fullname: user.fullname,
    email: user.email,
    phone: user.phone,
    role: user.role,
    branchId: user.branchId,
    monthlySalary: user.monthlySalary,
    employmentType: user.employmentType,
    active: user.active
  };
}

/**
 * Remove or detach staff member from a branch
 */
async function removeBranchStaff(subdomain, branchId, staffUserId, adminUser = {}) {
  const Users = getUsersModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const branch = await Branch.findById(branchId);
  if (branch && String(branch.managerId) === String(staffUserId)) {
    branch.managerId = null;
    await branch.save();
  }

  await Users.findByIdAndUpdate(staffUserId, {
    $set: { branchId: null, role: 1 }
  });

  return { success: true, message: "تمت إزالة الموظف من طاقم عمل الفرع بنجاح" };
}

/**
 * Reassign manager of a branch
 */
async function assignBranchManager(subdomain, branchId, managerUserId, adminUser = {}) {
  const Users = getUsersModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const user = await Users.findById(managerUserId);
  if (!user) {
    const err = new Error("المستخدم المحدد غير موجود");
    err.status = 404;
    throw err;
  }

  user.branchId = branchId;
  user.role = 4;
  await user.save();

  await Branch.findByIdAndUpdate(branchId, { managerId: user._id });

  return {
    success: true,
    manager: { _id: user._id, fullname: user.fullname, email: user.email, role: 4 }
  };
}

/**
 * Get technicians of a branch (Role 2)
 */
async function getBranchTechnicians(subdomain, branchId) {
  const Users = getUsersModel(subdomain);
  const getReturnModel = require("../returns/returnModel");
  const Return = getReturnModel(subdomain);

  const query = {
    role: { $in: [2, "2", "maintenance_tech", "technician"] },
    active: true
  };
  if (branchId && branchId !== "all") {
    query.branchId = branchId;
  }
  const techs = await Users.find(query).select("_id fullname email phone role branchId").lean();

  // Compute live active maintenance tasks count & workload for each technician
  const enrichedTechs = await Promise.all(
    techs.map(async (t) => {
      const activeTasksCount = await Return.countDocuments({
        assignedTechId: t._id,
        status: { $in: ["assigned_to_tech", "in_maintenance", "parts_pending"] }
      });
      const cleanPhone = (t.phone || "").replace(/[^0-9]/g, "");
      const waPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
      return {
        ...t,
        activeTasksCount,
        isAvailable: activeTasksCount === 0,
        workloadStatus: activeTasksCount === 0 ? "متاح حالياً (0 مهام)" : `مشغول (${activeTasksCount} مهام جارية)`,
        whatsappUrl: waPhone ? `https://wa.me/${waPhone}` : null
      };
    })
  );

  return enrichedTechs;
}

module.exports = {
  ensureDefaultBranch,
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchStaff,
  addBranchStaff,
  updateBranchStaff,
  removeBranchStaff,
  assignBranchManager,
  getBranchTechnicians
};
