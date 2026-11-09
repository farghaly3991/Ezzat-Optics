const getCouponsModel = require("./couponModel");

exports.listCoupons = async (req, res, next) => {
  try {
    const Coupons = getCouponsModel(req.subdomain);
    const coupons = await Coupons.find().sort({ createdAt: -1 }).lean();
    res.json({ done: true, coupons });
  } catch (err) {
    next(err);
  }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const Coupons = getCouponsModel(req.subdomain);
    const body = req.body || {};
    if (!body.code) return res.status(400).json({ error: "كود الكوبون مطلوب" });

    const code = body.code.toUpperCase().trim();
    const existing = await Coupons.findOne({ code });
    if (existing) return res.status(400).json({ error: "كود الكوبون موجود مسبقاً" });

    const coupon = await new Coupons({ ...body, code }).save();
    res.json({ done: true, coupon, message: "تم إنشاء الكوبون بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const Coupons = getCouponsModel(req.subdomain);
    const body = req.body || {};
    if (body.code) body.code = body.code.toUpperCase().trim();

    const updated = await Coupons.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!updated) return res.status(404).json({ error: "الكوبون غير موجود" });
    res.json({ done: true, coupon: updated, message: "تم تحديث الكوبون بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    const Coupons = getCouponsModel(req.subdomain);
    await Coupons.findByIdAndDelete(req.params.id);
    res.json({ done: true, message: "تم حذف الكوبون بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.validateCoupon = async (subdomain, code, subtotal) => {
  const Coupons = getCouponsModel(subdomain);
  const coupon = await Coupons.findOne({ code: code.toUpperCase().trim(), active: true });
  if (!coupon) return { valid: false, error: "كوبون غير صالح أو غير موجود" };

  if (coupon.expiration && new Date(coupon.expiration) < new Date()) {
    return { valid: false, error: "هذا الكوبون منتهي الصلاحية" };
  }

  if (coupon.allowedUses > 0 && coupon.usedCount >= coupon.allowedUses) {
    return { valid: false, error: "تم استنفاد الحد الأقصى لاستخدام هذا الكوبون" };
  }

  if (coupon.minOrderValue > 0 && subtotal < coupon.minOrderValue) {
    return { valid: false, error: `الحد الأدنى لتطبيق هذا الكوبون هو ${coupon.minOrderValue} ج.م` };
  }

  let discountAmount = 0;
  if (coupon.type === "discount") {
    discountAmount = Math.round((subtotal * (coupon.discount || 0)) / 100);
  } else {
    discountAmount = Math.min(coupon.value || 0, subtotal);
  }

  return { valid: true, coupon, discountAmount };
};
