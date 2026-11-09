/**
 * Multi-Branch Express Controller
 */

const branchService = require("./branchService");

exports.list = async (req, res, next) => {
  try {
    let branches = await branchService.listBranches(req.subdomain, {
      activeOnly: req.query.activeOnly === "true"
    });

    // If branch manager (Role 4), only return their assigned branch
    const isSuper = req.isSuperAdmin || Number(req.user?.role) === 5 || req.user?.role === "super_admin";
    if (!isSuper && (req.isBranchAdmin || Number(req.user?.role) === 4) && req.user?.branchId) {
      branches = branches.filter((b) => String(b._id) === String(req.user.branchId));
    }

    res.json({ done: true, branches });
  } catch (err) {
    next(err);
  }
};

exports.listPublic = async (req, res, next) => {
  try {
    const branches = await branchService.listBranches(req.subdomain, {
      activeOnly: true
    });
    res.json({ done: true, branches });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const isSuper = req.isSuperAdmin || Number(req.user?.role) === 5 || req.user?.role === "super_admin";
    if (!isSuper && (req.isBranchAdmin || Number(req.user?.role) === 4) && req.user?.branchId) {
      if (String(req.params.id) !== String(req.user.branchId)) {
        return res.status(403).json({ error: "غير مصرح لك بالوصول لبيانات هذا الفرع" });
      }
    }
    const branch = await branchService.getBranchById(req.subdomain, req.params.id);
    res.json({ done: true, branch });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const branch = await branchService.createBranch(req.subdomain, req.body || {}, req.user);
    res.status(201).json({
      done: true,
      branch,
      message: `تم إنشاء الفرع «${branch.name}» بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const branch = await branchService.updateBranch(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      branch,
      message: `تم تحديث بيانات الفرع «${branch.name}» بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await branchService.deleteBranch(req.subdomain, req.params.id, req.user);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getStaff = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.params.id;
    const isSuper = req.isSuperAdmin || Number(req.user?.role) === 5 || req.user?.role === "super_admin";
    if (!isSuper && (req.isBranchAdmin || Number(req.user?.role) === 4) && req.user?.branchId) {
      if (String(branchId) !== String(req.user.branchId)) {
        return res.status(403).json({ error: "غير مصرح لك بالوصول لطاقم هذا الفرع" });
      }
    }
    const data = await branchService.getBranchStaff(req.subdomain, branchId);
    res.json({ done: true, ...data });
  } catch (err) {
    next(err);
  }
};

exports.addStaff = async (req, res, next) => {
  try {
    const staff = await branchService.addBranchStaff(req.subdomain, req.params.id, req.body, req.user);
    res.status(201).json({
      done: true,
      staff,
      message: `تم إضافة «${staff.fullname}» لطاقم عمل الفرع بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const staff = await branchService.updateBranchStaff(
      req.subdomain,
      req.params.id,
      req.params.userId,
      req.body,
      req.user
    );
    res.json({
      done: true,
      staff,
      message: `تم تحديث بيانات «${staff.fullname}» بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.removeStaff = async (req, res, next) => {
  try {
    const result = await branchService.removeBranchStaff(
      req.subdomain,
      req.params.id,
      req.params.userId,
      req.user
    );
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.setManager = async (req, res, next) => {
  try {
    const result = await branchService.assignBranchManager(
      req.subdomain,
      req.params.id,
      req.body.managerUserId,
      req.user
    );
    res.json({ done: true, ...result, message: "تم تعيين وتحديث مدير الفرع بنجاح!" });
  } catch (err) {
    next(err);
  }
};

exports.getTechnicians = async (req, res, next) => {
  try {
    const technicians = await branchService.getBranchTechnicians(req.subdomain, req.params.id);
    res.json({ done: true, technicians });
  } catch (err) {
    next(err);
  }
};
