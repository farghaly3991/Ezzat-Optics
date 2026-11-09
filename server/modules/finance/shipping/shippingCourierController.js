/**
 * Shipping Couriers & Actual Cost Controller
 */

const courierService = require("./shippingCourierService");

exports.listCouriers = async (req, res, next) => {
  try {
    const couriers = await courierService.listCouriers(req.subdomain, {
      branchId: req.query.branchId,
      activeOnly: req.query.activeOnly === "true"
    });
    res.json({ done: true, couriers });
  } catch (err) {
    next(err);
  }
};

exports.createCourier = async (req, res, next) => {
  try {
    const courier = await courierService.createCourier(req.subdomain, req.body);
    res.status(201).json({
      done: true,
      courier,
      message: `تمت إضافة جهة الشحن «${courier.name}» بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCourier = async (req, res, next) => {
  try {
    const courier = await courierService.updateCourier(req.subdomain, req.params.id, req.body);
    res.json({
      done: true,
      courier,
      message: `تم تحديث بيانات جهة الشحن «${courier.name}» بنجاح!`
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourier = async (req, res, next) => {
  try {
    const result = await courierService.deleteCourier(req.subdomain, req.params.id);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.assignOrderCourier = async (req, res, next) => {
  try {
    const result = await courierService.assignOrderCourier(
      req.subdomain,
      req.params.orderId,
      req.body,
      req.user
    );
    res.json({ done: true, ...result, message: "تم تعيين جهة الشحن وتحديث التكلفة الفعلية للطلب بنجاح!" });
  } catch (err) {
    next(err);
  }
};
