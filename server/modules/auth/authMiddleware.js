const jwt = require("jsonwebtoken");
const getUsersModel = require("./userModel");

exports.protect = async (req, res, next) => {
  try {
    let token = req.headers["x-auth-token"] || req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });
    }
    if (token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }
    const secret = req.JWT_SECRET || process.env.JWT_SECRET || "default_jwt_secret";
    const decoded = jwt.verify(token, secret);

    const Users = getUsersModel(req.subdomain);
    const user = await Users.findById(decoded.userId).select("-password").lean();
    if (!user) {
      return res.status(401).json({ error: "المستخدم غير موجود" });
    }
    req.user = user;
    req.decoded = decoded;

    // Attach role helpers (6: Developer / Super Super Admin, 5: Super Admin, 4: Branch Manager, 3: Sales Staff, 2: Maintenance Tech, 1: Customer)
    const numRole = Number(user.role);
    req.isSuperAdmin = numRole === 6 || numRole === 5 || user.role === "super_admin" || (user.role === "admin" && !user.branchId);
    req.isBranchAdmin = numRole === 4 || user.role === "branch_admin";
    req.isSalesStaff = numRole === 3 || user.role === "sales_staff" || user.role === "staff";
    req.isTechnician = numRole === 2 || user.role === "maintenance_tech" || user.role === "technician";
    req.isStaff = req.isSuperAdmin || req.isBranchAdmin || req.isSalesStaff || req.isTechnician;
    req.isAdmin = req.isSuperAdmin || req.isBranchAdmin || req.isSalesStaff || req.isTechnician || user.role === "admin";

    // Branch scoping
    if ((req.isBranchAdmin || req.isSalesStaff || req.isTechnician) && user.branchId) {
      req.branchFilter = { branchId: user.branchId };
      req.currentBranchId = String(user.branchId);
    } else if (req.isSuperAdmin) {
      const bId = req.query?.branchId || req.headers?.["x-branch-id"] || null;
      req.branchFilter = bId && bId !== "all" ? { branchId: bId } : {};
      req.currentBranchId = bId && bId !== "all" ? String(bId) : null;
    } else {
      req.branchFilter = {};
      req.currentBranchId = null;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: "جلسة منتهية أو توكن غير صالح", details: err.message });
  }
};

exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.isAdmin) {
    return res.status(403).json({ error: "غير مصرح، هذه العملية تتطلب صلاحيات طاقم الإدارة أو المبيعات (Role 3-5)" });
  }
  next();
};

exports.branchAdminOnly = (req, res, next) => {
  if (!req.user || (!req.isBranchAdmin && !req.isSuperAdmin)) {
    return res.status(403).json({ error: "غير مصرح، هذه العملية تتطلب صلاحيات مدير فرع أو سوبر آدمن (Role 4-5)" });
  }
  next();
};

exports.superAdminOnly = (req, res, next) => {
  if (!req.user || !req.isSuperAdmin) {
    return res.status(403).json({ error: "غير مصرح، هذه العملية مخصصة للسوبر آدمن فقط (Role 5)" });
  }
  next();
};

exports.optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers["x-auth-token"] || req.headers.authorization;
    if (token) {
      if (token.startsWith("Bearer ")) {
        token = token.slice(7).trim();
      }
      const secret = req.JWT_SECRET || process.env.JWT_SECRET || "default_jwt_secret";
      const decoded = jwt.verify(token, secret);
      const Users = getUsersModel(req.subdomain);
      const user = await Users.findById(decoded.userId).select("-password").lean();
      if (user) {
        req.user = user;
        req.decoded = decoded;
        const numRole = Number(user.role);
        req.isSuperAdmin = numRole === 5 || user.role === "super_admin" || (user.role === "admin" && !user.branchId);
        req.isBranchAdmin = numRole === 4 || user.role === "branch_admin";
        req.isSalesStaff = numRole === 3 || user.role === "sales_staff" || user.role === "staff";
        req.isTechnician = numRole === 2 || user.role === "maintenance_tech" || user.role === "technician";
        req.isStaff = req.isSuperAdmin || req.isBranchAdmin || req.isSalesStaff || req.isTechnician;
        req.isAdmin = req.isSuperAdmin || req.isBranchAdmin || req.isSalesStaff || req.isTechnician || user.role === "admin";
        if ((req.isBranchAdmin || req.isSalesStaff || req.isTechnician) && user.branchId) {
          req.branchFilter = { branchId: user.branchId };
          req.currentBranchId = String(user.branchId);
        }
      }
    }
  } catch (e) {
    // Ignore optional auth failure
  }
  next();
};
