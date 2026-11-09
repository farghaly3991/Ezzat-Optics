/**
 * Shipping Couriers & Actual Fulfillment Cost Service
 * Handles internal salaried staff couriers (0 EGP marginal cost) and external carriers with presets.
 */

const getShippingCourierModel = require("./shippingCourierModel");
const getUsersModel = require("../../auth/userModel");
const getOrdersModel = require("../../orders/orderModel");

/**
 * List all active shipping couriers / delivery personnel
 */
async function listCouriers(subdomain, options = {}) {
  const Courier = getShippingCourierModel(subdomain);
  const query = options.activeOnly ? { active: true } : {};
  if (options.branchId) query.branchId = options.branchId;

  const couriers = await Courier.find(query)
    .populate("userId", "fullname phone email role employmentType monthlySalary")
    .sort({ type: 1, createdAt: 1 })
    .lean();

  return couriers;
}

/**
 * Create a new courier in the directory
 */
async function createCourier(subdomain, payload = {}) {
  const Courier = getShippingCourierModel(subdomain);
  const Users = getUsersModel(subdomain);

  const { name, type = "external_carrier", userId = null, branchId = null, phone = "", defaultCost = 0, notes = "" } = payload;

  if (!name) {
    const err = new Error("اسم شركة الشحن أو المندوب مطلوب");
    err.status = 400;
    throw err;
  }

  let finalCost = Number(defaultCost) || 0;
  let finalPhone = phone;

  // If internal staff, default cost is 0 EGP (salary is counted in OPEX)
  if (type === "internal_staff" && userId) {
    finalCost = 0;
    const staffUser = await Users.findById(userId).lean();
    if (staffUser && !finalPhone) {
      finalPhone = staffUser.phone || "";
    }
  }

  const created = await Courier.create({
    name: name.trim(),
    type,
    userId: userId || null,
    branchId: branchId || null,
    phone: finalPhone.trim(),
    defaultCost: finalCost,
    active: true,
    notes: notes.trim()
  });

  return created.toObject();
}

/**
 * Update an existing courier
 */
async function updateCourier(subdomain, courierId, payload = {}) {
  const Courier = getShippingCourierModel(subdomain);
  const courier = await Courier.findById(courierId);
  if (!courier) {
    const err = new Error("جهة الشحن غير موجودة");
    err.status = 404;
    throw err;
  }

  const { name, type, userId, branchId, phone, defaultCost, active, notes } = payload;

  if (name !== undefined) courier.name = name.trim();
  if (type !== undefined) courier.type = type;
  if (userId !== undefined) courier.userId = userId || null;
  if (branchId !== undefined) courier.branchId = branchId || null;
  if (phone !== undefined) courier.phone = phone.trim();
  if (active !== undefined) courier.active = Boolean(active);
  if (notes !== undefined) courier.notes = notes.trim();

  if (courier.type === "internal_staff") {
    courier.defaultCost = 0;
  } else if (defaultCost !== undefined) {
    courier.defaultCost = Math.max(0, Number(defaultCost) || 0);
  }

  await courier.save();
  return courier.toObject();
}

/**
 * Delete a courier
 */
async function deleteCourier(subdomain, courierId) {
  const Courier = getShippingCourierModel(subdomain);
  await Courier.findByIdAndDelete(courierId);
  return { success: true, message: "تمت إزالة جهة الشحن بنجاح" };
}

/**
 * Assign courier to an order and record actual store shipping cost
 */
async function assignOrderCourier(subdomain, orderId, assignmentData = {}, adminUser = {}) {
  const Orders = getOrdersModel(subdomain);
  const Courier = getShippingCourierModel(subdomain);

  const order = await Orders.findById(orderId);
  if (!order) {
    const err = new Error("الطلب غير موجود");
    err.status = 404;
    throw err;
  }

  const { courierId, manualName, manualPhone, actualCost, notes } = assignmentData;

  let courierName = manualName || "مندوب توصيل";
  let courierPhone = manualPhone || "";
  let courierType = "external_carrier";
  let cost = Number(actualCost) || 0;
  let courierRef = null;

  if (courierId) {
    const cObj = await Courier.findById(courierId).populate("userId").lean();
    if (cObj) {
      courierName = cObj.name;
      courierPhone = cObj.phone || cObj.userId?.phone || "";
      courierType = cObj.type;
      courierRef = cObj._id;

      if (cObj.type === "internal_staff") {
        // Internal salaried staff -> Actual marginal shipping cost on the store is 0
        cost = 0;
      } else {
        cost = actualCost !== undefined ? Number(actualCost) : cObj.defaultCost || 0;
      }
    }
  }

  order.courier = {
    name: courierName,
    phone: courierPhone,
    type: courierType,
    courierId: courierRef,
    assignedAt: new Date(),
    assignedBy: adminUser?._id || null
  };

  order.actualShippingCost = cost;
  order.shippingCostNotes =
    courierType === "internal_staff"
      ? "توصيل عبر موظف المتجر الداخلي (تكلفة شحن إضافية صفر — مغطى بالمرتب الشهري)"
      : notes || `تكلفة الشحن الفعلية المسجلة: ${cost} ج.م`;

  await order.save();

  return {
    success: true,
    orderId: order._id,
    courier: order.courier,
    actualShippingCost: order.actualShippingCost,
    notes: order.shippingCostNotes
  };
}

module.exports = {
  listCouriers,
  createCourier,
  updateCourier,
  deleteCourier,
  assignOrderCourier
};
