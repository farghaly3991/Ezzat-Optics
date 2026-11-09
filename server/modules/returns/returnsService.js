const getReturnRequestModel = require("./returnModel");
const getOrdersModel = require("../orders/orderModel");
const getProductsModel = require("../products/productModel");
const { paymobService } = require("../paymob");
const { recordOrderReturnOrCancelRestore } = require("../finance/inventory/inventoryService");
const { recordOrderLifecycleEvents } = require("../activity/activityService");
const { logAudit } = require("../audit/auditService");

/**
 * Generate unique human-readable request number
 */
function generateRequestNumber(type = "return") {
  const prefix = type === "maintenance" ? "MNT" : "RET";
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${randomPart}`;
}

/**
 * Check if order is eligible for return (delivered within <= 15 days)
 */
function evaluateReturnEligibility(order) {
  if (!order || !["delivered", "completed"].includes(order.status)) {
    return {
      eligible: false,
      reason: "لا يمكن طلب استرجاع إلا بعد استلام وتوصيل الطلب بنجاح"
    };
  }

  const deliveredEntry = (order.timeline || []).find((t) => t.status === "delivered");
  const deliveryDate =
    order.pickupCompletedAt ||
    (deliveredEntry ? new Date(deliveredEntry.at) : null) ||
    new Date(order.updatedAt || order.createdAt);

  const daysElapsed = Math.floor((Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
  const isWithin15Days = daysElapsed <= 15;

  return {
    eligible: isWithin15Days,
    daysElapsed,
    daysRemaining: Math.max(0, 15 - daysElapsed),
    deliveryDate
  };
}

/**
 * Evaluate warranty coverage for an order item
 */
function evaluateItemWarranty(orderItem, deliveryDate) {
  const warrantyMonths = Number(orderItem.warrantyPeriodMonths || 0);
  if (!warrantyMonths || warrantyMonths <= 0) {
    return {
      status: "not_applicable",
      isUnderWarranty: false,
      warrantyExpiryDate: null,
      monthsTotal: 0
    };
  }

  const baseDate = deliveryDate ? new Date(deliveryDate) : new Date();
  const expiryDate = new Date(baseDate);
  expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);

  const isUnderWarranty = Date.now() <= expiryDate.getTime();
  return {
    status: isUnderWarranty ? "in_warranty" : "out_of_warranty",
    isUnderWarranty,
    warrantyExpiryDate: expiryDate,
    monthsTotal: warrantyMonths
  };
}

/**
 * Create a new return or maintenance request from client
 */
async function createClientRequest(subdomain, user, data = {}) {
  const Orders = getOrdersModel(subdomain);
  const ReturnRequest = getReturnRequestModel(subdomain);

  const { orderId, type = "return", items = [], reason = "", notes = "", images = [] } = data;

  const isDirectMaintenance = type === "maintenance" && (!orderId || orderId === "DIRECT" || orderId === "WALKIN");

  if (!orderId && !isDirectMaintenance) {
    throw new Error("رقم الطلب مطلوب");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("يرجى اختيار منتج واحد على الأقل للطلب");
  }

  let order = null;
  let eligibility = { eligible: true, daysElapsed: 0, daysRemaining: 15 };
  let processedItems = [];
  let overallWarrantyStatus = "not_applicable";
  let maxWarrantyExpiry = null;

  if (orderId && !isDirectMaintenance) {
    order = await Orders.findOne({ orderId }).lean();
    if (!order && type !== "maintenance") {
      throw new Error("الطلب غير موجود");
    }
  }

  if (order) {
    // Authorization check: clients can only return their own orders, while staff/admin can return any order at counter
    const isStaffOrAdmin = user && (Number(user.role) >= 2 || user.role === "admin" || user.role === "cashier");
    if (!isStaffOrAdmin && user?._id && order.userId && String(order.userId) !== String(user._id)) {
      throw new Error("غير مصرح لك بتقديم طلب لهذا الطلب");
    }

    eligibility = evaluateReturnEligibility(order);

    const isWarrantyClaim = data.isWarrantyClaim || items.some(it => it.condition === "defective" || it.condition === "damaged");
    if (type === "return" && !eligibility.eligible && !isWarrantyClaim) {
      throw new Error(
        eligibility.reason ||
          `لقد تجاوز هذا الطلب فترة الإرجاع المسموحة (15 يوماً من الاستلام)، حيث مضى ${eligibility.daysElapsed} يوماً.`
      );
    }

    for (const reqItem of items) {
      const matchedOrderItem = (order.items || []).find(
        (it) => String(it.productId) === String(reqItem.productId)
      );
      if (!matchedOrderItem) continue;

      const qty = Math.min(
        Math.max(1, Number(reqItem.quantity || 1)),
        Number(matchedOrderItem.quantity || 1)
      );

      const warrantyEval = evaluateItemWarranty(matchedOrderItem, eligibility.deliveryDate);

      if (warrantyEval.isUnderWarranty) {
        overallWarrantyStatus = "in_warranty";
      } else if (overallWarrantyStatus !== "in_warranty" && warrantyEval.status === "out_of_warranty") {
        overallWarrantyStatus = "out_of_warranty";
      }

      if (warrantyEval.warrantyExpiryDate) {
        if (!maxWarrantyExpiry || warrantyEval.warrantyExpiryDate > maxWarrantyExpiry) {
          maxWarrantyExpiry = warrantyEval.warrantyExpiryDate;
        }
      }

      processedItems.push({
        productId: String(matchedOrderItem.productId),
        name: matchedOrderItem.name,
        price: Number(matchedOrderItem.price || 0),
        quantity: qty,
        image: matchedOrderItem.image || "",
        warrantyPeriodMonths: Number(matchedOrderItem.warrantyPeriodMonths || 0),
        isUnderWarranty: warrantyEval.isUnderWarranty,
        reason: reqItem.reason || reason || "",
        condition: reqItem.condition || "opened"
      });
    }
  } else if (isDirectMaintenance || type === "maintenance") {
    // Direct service or walk-in maintenance without prior store order
    for (const reqItem of items) {
      processedItems.push({
        productId: String(reqItem.productId || "DIRECT-MAINT"),
        name: reqItem.name || "شنبر / نظارة صيانة خارجية",
        price: Number(reqItem.price || 0),
        quantity: Math.max(1, Number(reqItem.quantity || 1)),
        image: reqItem.image || "",
        warrantyPeriodMonths: 0,
        isUnderWarranty: Boolean(reqItem.isUnderWarranty),
        reason: reqItem.reason || reason || "",
        condition: reqItem.condition || "opened"
      });
    }
    overallWarrantyStatus = data.warrantyStatus || (data.isWarrantyFree ? "in_warranty" : "out_of_warranty");
  }

  if (processedItems.length === 0) {
    throw new Error("المنتجات المحددة غير موجودة في هذا الطلب");
  }

  const requestNumber = generateRequestNumber(type);
  const now = new Date();

  const initialStatus = "requested";
  const initialTitle =
    type === "maintenance" ? "تم تسجيل طلب الصيانة" : "تم تقديم طلب الإرجاع";
  const initialNote =
    type === "maintenance"
      ? `تم تقديم طلب الصيانة للمنتج (${overallWarrantyStatus === "in_warranty" ? "مشمول بالضمان" : "خارج الضمان"}). سنقوم بمراجعة الطلب والتواصل معك.`
      : `تم استلام طلب استرجاع المنتجات. متبقي ${eligibility.daysRemaining} يوماً على فترة الـ 15 يوماً.`;

  const customerData = {
    name: order?.customer?.name || data.customer?.name || user?.fullname || user?.name || "عميل",
    phone: order?.customer?.phone || data.customer?.phone || user?.phone || "",
    address: order?.customer?.address || data.customer?.address || "",
    city: order?.customer?.city || data.customer?.city || ""
  };

  const returnDoc = new ReturnRequest({
    requestNumber,
    type,
    orderId: order?.orderId || orderId || "DIRECT-MAINTENANCE",
    orderMongoId: order?._id || null,
    userId: user?._id || order?.userId || null,
    branchId: data.branchId || null,
    customer: customerData,
    items: processedItems,
    reason: String(reason || "").trim(),
    notes: String(notes || "").trim(),
    images: Array.isArray(images) ? images : [],
    warrantyStatus: overallWarrantyStatus,
    warrantyExpiryDate: maxWarrantyExpiry,
    isWithinReturnWindow: eligibility.eligible,
    status: initialStatus,
    courier: {},
    refund: {
      amount: processedItems.reduce((sum, it) => sum + it.price * it.quantity, 0),
      method: "none",
      status: "none",
      transactionId: order?.payment?.transactionId || "",
      restocked: false
    },
    timeline: [
      {
        status: initialStatus,
        title: initialTitle,
        note: initialNote,
        at: now,
        by: "client"
      }
    ]
  });

  await returnDoc.save();

  // Automatic Audit Logging
  try {
    await logAudit({
      subdomain,
      userId: user?._id || null,
      userName: user?.fullname || user?.name || customerData.name || "عميل المركز",
      userRole: user?.role || "customer",
      branchId: data.branchId || null,
      action: type === "maintenance" ? "maintenance_ticket_created" : "return_request_created",
      actionLabel: type === "maintenance" ? "تسجيل تذكرة صيانة" : "تقديم طلب إرجاع",
      targetType: type === "maintenance" ? "maintenance" : "return",
      targetId: String(returnDoc._id),
      targetCode: returnDoc.requestNumber,
      details: type === "maintenance"
        ? `تسجيل تذكرة صيانة جديدة برقم ${returnDoc.requestNumber} للعميل ${customerData.name} - العطل/الطلب: ${reason || 'صيانة وتعديل شاسيه'}`
        : `تقديم طلب إرجاع رقم ${returnDoc.requestNumber} للطلب ${order?.orderId || orderId}`,
      metadata: {
        requestNumber: returnDoc.requestNumber,
        orderId: returnDoc.orderId,
        type: returnDoc.type,
        customerName: customerData.name,
        customerPhone: customerData.phone,
        itemsCount: processedItems.length,
        warrantyStatus: returnDoc.warrantyStatus
      }
    });
  } catch (auditErr) {
    console.warn("[AUDIT_RETURN_WARN]", auditErr.message);
  }

  return returnDoc;
}

/**
 * Get all requests belonging to a user
 */
async function getUserRequests(subdomain, userId) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  return ReturnRequest.find({ userId }).sort({ createdAt: -1 }).lean();
}

/**
 * Get a request by its public tracking number
 */
async function getRequestByNumber(subdomain, requestNumber) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  return ReturnRequest.findOne({ requestNumber }).lean();
}

/**
 * Admin: Get paginated requests with filters
 */
async function getAdminRequests(subdomain, query = {}) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const { type, status, search, page = 1, limit = 20 } = query;

  const filter = {};
  if (type && type !== "all") {
    filter.type = type;
  }
  if (status && status !== "all") {
    filter.status = status;
  }
  if (search && search.trim()) {
    const rx = { $regex: search.trim(), $options: "i" };
    filter.$or = [
      { requestNumber: rx },
      { orderId: rx },
      { "customer.name": rx },
      { "customer.phone": rx }
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 20);

  if (query.branchId && query.branchId !== "all") {
    filter.branchId = query.branchId;
  }

  const total = await ReturnRequest.countDocuments(filter);
  const requests = await ReturnRequest.find(filter)
    .populate("assignedTechId", "fullname email phone role")
    .populate("branchId", "name code city")
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  return {
    requests,
    total,
    page: p,
    pages: Math.ceil(total / l) || 1
  };
}

/**
 * Admin: Update status and courier assignment
 */
async function updateRequestStatus(subdomain, requestId, updateData = {}, adminUser) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const reqDoc = await ReturnRequest.findById(requestId);
  if (!reqDoc) {
    throw new Error("طلب الإرجاع/الصيانة غير موجود");
  }

  const { status, note = "", courier = {} } = updateData;
  const now = new Date();

  if (courier.name !== undefined) reqDoc.courier.name = String(courier.name || "").trim();
  if (courier.phone !== undefined) reqDoc.courier.phone = String(courier.phone || "").trim();
  if (courier.trackingReference !== undefined)
    reqDoc.courier.trackingReference = String(courier.trackingReference || "").trim();
  if (courier.scheduledDate !== undefined)
    reqDoc.courier.scheduledDate = courier.scheduledDate ? new Date(courier.scheduledDate) : null;

  if (status && status !== reqDoc.status) {
    reqDoc.status = status;

    let title = `تحديث الحالة إلى: ${status}`;
    if (status === "approved") title = "تمت الموافقة على الطلب وجاري تجهيز المندوب";
    else if (status === "courier_assigned")
      title = `تم تعيين مندوب الاستلام (${reqDoc.courier.name || "مندوب الشحن"})`;
    else if (status === "picked_up") title = "تم استلام الشحنة من العميل بنجاح";
    else if (status === "inspected") title = "تم فحص الشحنة في مركز الاسترجاع";
    else if (status === "in_maintenance") title = "جاري صيانة وفحص الجهاز بالمركز الفني";
    else if (status === "repaired") title = "تم إصلاح العطل بنجاح";
    else if (status === "delivered_back") title = "تم تسليم الجهاز للعميل بعد الصيانة";
    else if (status === "rejected") title = "تم رفض الطلب";

    reqDoc.timeline.push({
      status,
      title,
      note: note || (reqDoc.courier.name ? `المندوب: ${reqDoc.courier.name}` : ""),
      at: now,
      by: adminUser?.name || "admin"
    });
  } else if (note) {
    reqDoc.timeline.push({
      status: reqDoc.status,
      title: "تحديث ملاحظات المندوب والجدولة",
      note,
      at: now,
      by: adminUser?.name || "admin"
    });
  }

  await reqDoc.save();

  // Automatic Audit Logging for Status Update
  try {
    await logAudit({
      subdomain,
      userId: adminUser?._id || null,
      userName: adminUser?.fullname || adminUser?.name || "مسؤول النظام",
      userRole: adminUser?.role || "admin",
      branchId: reqDoc.branchId || null,
      action: reqDoc.type === "maintenance" ? `maintenance_status_${status || reqDoc.status}` : `return_status_${status || reqDoc.status}`,
      actionLabel: reqDoc.type === "maintenance" ? `تحديث حالة الصيانة: ${status || reqDoc.status}` : `تحديث حالة الإرجاع: ${status || reqDoc.status}`,
      targetType: reqDoc.type || "maintenance",
      targetId: String(reqDoc._id),
      targetCode: reqDoc.requestNumber,
      details: `تحديث حالة طلب ${reqDoc.type === 'maintenance' ? 'الصيانة' : 'الإرجاع'} #${reqDoc.requestNumber} إلى [${status || reqDoc.status}]${note ? ` - ملاحظة: ${note}` : ''}`,
      metadata: {
        requestNumber: reqDoc.requestNumber,
        status: status || reqDoc.status,
        note,
        courier: reqDoc.courier
      }
    });
  } catch (auditErr) {
    console.warn("[AUDIT_STATUS_WARN]", auditErr.message);
  }

  return reqDoc;
}

/**
 * Admin: Process refund (via Paymob API or manual cash) and optionally restock inventory
 */
async function processRefund(subdomain, requestId, refundPayload = {}, adminUser) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  const reqDoc = await ReturnRequest.findById(requestId);
  if (!reqDoc) {
    throw new Error("طلب الإرجاع غير موجود");
  }

  const {
    refundMethod = "manual_cash",
    refundAmount,
    restockInventory = true,
    adminNote = ""
  } = refundPayload;

  const amount = Number(refundAmount !== undefined ? refundAmount : reqDoc.refund?.amount || 0);
  if (amount <= 0) {
    throw new Error("مبلغ الاسترداد يجب أن يكون أكبر من صفر");
  }

  const order = await Orders.findOne({ orderId: reqDoc.orderId }).lean();
  const transactionId =
    reqDoc.refund?.transactionId || order?.payment?.transactionId || "";

  let paymobResult = null;

  // 1. Process Paymob Refund if requested
  if (refundMethod === "paymob_online") {
    if (!transactionId) {
      throw new Error("لا يوجد رقم عملية Paymob مسجل في هذا الطلب (Transaction ID غير متوفر)");
    }

    paymobResult = await paymobService.processRefund(subdomain, {
      transactionId,
      amountCents: Math.round(amount * 100),
      reason: `طلب إرجاع ${reqDoc.requestNumber}`
    });
  }

  // 2. Restock inventory if requested
  if (restockInventory !== false) {
    for (const it of reqDoc.items || []) {
      if (it.productId) {
        await Products.updateOne(
          { _id: it.productId },
          {
            $inc: {
              stockCount: Number(it.quantity || 1),
              salesCount: -Number(it.quantity || 1)
            }
          }
        );
      }
    }

    // Record return inventory restoration in finance ledger
    if (order) {
      try {
        await recordOrderReturnOrCancelRestore(
          subdomain,
          {
            order,
            movementType: "customer_return",
            returnToSellableInventory: true,
            skipProductStockMutation: true,
            reason: `استرجاع بضائع لطلب الإرجاع ${reqDoc.requestNumber}`,
            occurredAt: new Date()
          },
          adminUser
        );
      } catch (finErr) {
        console.warn("[RETURN_FINANCE_RESTORE_WARN]", finErr.message);
      }
    }
    reqDoc.refund.restocked = true;
  } else if (refundPayload.sendToScrap || (reqDoc.items || []).some(it => it.condition === "defective" || it.condition === "damaged")) {
    for (const it of reqDoc.items || []) {
      if (it.productId) {
        const prod = await Products.findById(it.productId);
        if (prod) {
          const scrapQty = Number(it.quantity || 1);
          const unitCost = Number(prod.costPrice || (Number(it.price || 0) * 0.5));
          const totalLoss = unitCost * scrapQty;
          if (!Array.isArray(prod.scrapRecords)) prod.scrapRecords = [];
          prod.scrapRecords.unshift({
            quantity: scrapQty,
            reason: `مرتجع معيب/تالف تحت الضمان - طلب ${reqDoc.requestNumber} (${it.reason || 'عيب صناعة'})`,
            warehouse: "store",
            unitCost,
            totalLoss,
            recordedBy: adminUser?.fullname || adminUser?.name || "مسؤول الضمان",
            date: new Date()
          });
          await prod.save();
        }
      }
    }
    reqDoc.refund.restocked = false;
    reqDoc.refund.sentToScrap = true;
  }

  const now = new Date();
  reqDoc.status = "refunded";
  reqDoc.refund.amount = amount;
  reqDoc.refund.method = refundMethod;
  reqDoc.refund.status = "processed";
  reqDoc.refund.processedAt = now;
  reqDoc.refund.processedBy = adminUser?._id || null;
  reqDoc.refund.adminNote = adminNote;
  if (paymobResult?.refundId) {
    reqDoc.refund.paymobRefundId = paymobResult.refundId;
  }

  reqDoc.timeline.push({
    status: "refunded",
    title:
      refundMethod === "paymob_online"
        ? "تم استرداد المبلغ إلكترونياً عبر Paymob"
        : "تم تأكيد رد المبلغ للعميل يدوياً (كاش/تحويل)",
    note:
      `تم استرداد مبلغ ${amount} ج.م بنجاح` +
      (restockInventory ? " مع إعادة المنتجات للمخزون المتاح للبيع" : "") +
      (adminNote ? ` • ملاحظة: ${adminNote}` : ""),
    at: now,
    by: adminUser?.name || "admin"
  });

  await reqDoc.save();

  // Update the original order's timeline with return and refund audit note
  if (order) {
    try {
      const returnedProductNames = (reqDoc.items || [])
        .map((it) => `${it.name} (كمية ${it.quantity || 1})`)
        .join("، ");
      const refundMethodText =
        refundMethod === "paymob_online" ? "إلكترونياً عبر Paymob" : "يدوياً (كاش/تحويل)";

      await Orders.updateOne(
        { _id: order._id },
        {
          $push: {
            timeline: {
              status: "refund_processed",
              at: now,
              note: `تم إتمام استرداد مالي لطلب الإرجاع ${reqDoc.requestNumber} بمبلغ ${amount} ج.م (${refundMethodText}) للمنتجات: [${returnedProductNames}]${
                restockInventory ? " وتمت استعادة المنتجات للمخزون" : ""
              }`
            }
          }
        }
      );
    } catch (ordTimelineErr) {
      console.warn("[ORDER_REFUND_TIMELINE_WARN]", ordTimelineErr.message);
    }
  }

  // Record lifecycle event for commercial analytics
  if (order) {
    try {
      await recordOrderLifecycleEvents(subdomain, {
        order,
        eventType: "product_returned",
        occurredAt: now
      });
    } catch (actErr) {
      console.warn("[ACTIVITY_RETURN_EVENT_WARN]", actErr.message);
    }
  }

  // Automatic Audit Logging for Return Refund
  try {
    const isDefectiveScrap = Boolean(reqDoc.refund.sentToScrap || restockInventory === false);
    await logAudit({
      subdomain,
      branchId: adminUser?.branchId || reqDoc.branchId || null,
      userId: adminUser?._id || null,
      userName: adminUser?.fullname || adminUser?.name || "مسؤول المرتجعات",
      userRole: adminUser?.role || "admin",
      action: isDefectiveScrap ? "order_return_scrapped" : "order_return_restocked",
      actionLabel: isDefectiveScrap ? "إرجاع تالف وقيد هالك ضمان" : "استرجاع سليم وإعادة للمخزون",
      targetType: "return",
      targetId: String(reqDoc._id),
      targetCode: reqDoc.requestNumber,
      details: isDefectiveScrap
        ? `استرداد مالي لمرتجع تالف تحت الضمان #${reqDoc.requestNumber} بمبلغ ${amount} ج.م وقيد البضاعة كهدر وتالف تشغيلي بالورشة`
        : `استرداد مالي لمرتجع سليم #${reqDoc.requestNumber} بمبلغ ${amount} ج.م وإعادة الأصناف إلى رصيد المخزن المتاح للبيع فوراً`,
      metadata: {
        requestNumber: reqDoc.requestNumber,
        orderId: reqDoc.orderId,
        refundAmount: amount,
        refundMethod,
        restockInventory,
        isDefectiveScrap,
        itemsCount: (reqDoc.items || []).length
      }
    });
  } catch (audErr) {
    console.warn("[RETURN_REFUND_AUDIT_LOG_WARN]", audErr.message);
  }

  return reqDoc;
}

/**
 * Convert Warranty/Maintenance Request into a Field Service Order
 * - Finds existing user by phone or creates a new customer account
 * - Creates a new store order of orderType: "service", hasServices: true
 * - Updates the return request with reference to the new order
 */
async function convertToFieldServiceOrder(subdomain, requestId, options = {}, adminUser) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const Orders = getOrdersModel(subdomain);
  const Users = require("../auth/userModel")(subdomain);
  const { recordOrderLifecycleEvents } = require("../activity/activityService");

  const reqDoc = await ReturnRequest.findById(requestId);
  if (!reqDoc) {
    throw new Error("طلب الصيانة/الضمان غير موجود");
  }

  const rawPhone = String(reqDoc.customer?.phone || "").trim();
  const cleanPhone = rawPhone.replace(/[\s-]/g, "");
  const customerName = String(reqDoc.customer?.name || "عميل الصيانة").trim();
  const customerAddress = String(options.address || reqDoc.customer?.address || "عنوان العميل المسجل").trim();
  const customerCity = String(options.city || reqDoc.customer?.city || "الفرع الرئيسي").trim();

  let assignedUserId = reqDoc.userId || null;
  let customerAccount = null;

  if (cleanPhone && cleanPhone.length >= 6) {
    let userDoc = await Users.findOne({
      $or: [{ phone: cleanPhone }, { phone: rawPhone }]
    });

    if (userDoc) {
      assignedUserId = userDoc._id;
      customerAccount = {
        created: false,
        userId: userDoc._id,
        fullname: userDoc.fullname,
        phone: userDoc.phone,
        email: userDoc.email,
        isNew: false
      };
    } else {
      // Auto create new customer account with phone as username and password
      const autoEmail = `${cleanPhone}@service.store`;
      const defaultPassword = cleanPhone;

      const newUser = new Users({
        fullname: customerName,
        phone: cleanPhone,
        email: autoEmail,
        password: defaultPassword,
        address: customerAddress,
        city: customerCity,
        role: "user"
      });
      await newUser.save();

      assignedUserId = newUser._id;
      customerAccount = {
        created: true,
        userId: newUser._id,
        fullname: newUser.fullname,
        phone: newUser.phone,
        email: newUser.email,
        username: cleanPhone,
        tempPassword: defaultPassword,
        isNew: true
      };
    }
  }

  const now = new Date();
  const orderId = `SRV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  // Build service order item from the warranty request
  const serviceFee = Number(options.serviceFee || 0);
  const itemNames = (reqDoc.items || []).map((i) => i.name).filter(Boolean).join("، ") || "فحص وصيانة أجهزة";

  const serviceItem = {
    productId: (reqDoc.items?.[0]?.productId) || `service-warr-${Date.now()}`,
    name: `مهمة صيانة وزيارة منزلية: ${itemNames}`,
    price: serviceFee,
    costPrice: 0,
    quantity: 1,
    image: reqDoc.items?.[0]?.image || "",
    isService: true,
    categoryType: "service",
    requiresShipping: false,
    shippingMode: "NONE",
    grossLineTotal: serviceFee,
    netLineValue: serviceFee,
    lineCostTotal: 0
  };

  const newOrder = new Orders({
    orderId,
    userId: assignedUserId,
    customer: {
      name: customerName,
      phone: rawPhone || cleanPhone,
      email: customerAccount?.email || "",
      address: customerAddress,
      city: customerCity,
      notes: `صيانة ميدانية ناتجة عن طلب الضمان رقم ${reqDoc.requestNumber}. سبب الطلب: ${reqDoc.reason || "فحص وإصلاح"}`
    },
    items: [serviceItem],
    deliveryMethod: "delivery",
    orderType: "service",
    hasServices: true,
    payment: {
      method: serviceFee > 0 ? "cod" : "cod",
      paid: serviceFee === 0
    },
    subtotal: serviceFee,
    shipping: 0,
    discount: 0,
    total: serviceFee,
    status: "new",
    timeline: [
      {
        status: "new",
        at: now,
        note: `تم فتح أمر صيانة وزيارة ميدانية مرتبط بطلب الضمان ${reqDoc.requestNumber} بواسطة الإدارة`
      }
    ]
  });

  await newOrder.save();

  // Update return request with the converted order reference
  reqDoc.status = "in_maintenance";
  reqDoc.convertedToOrderId = newOrder.orderId;
  reqDoc.convertedOrderMongoId = newOrder._id;
  reqDoc.convertedAt = now;

  reqDoc.timeline.push({
    status: "in_maintenance",
    title: "تم إصدار أمر صيانة وزيارة ميدانية",
    note: `تم إنشاء أمر خدمة ميدانية برقم (${newOrder.orderId}) وتكليف فريق الصيانة بالزيارة.` +
      (customerAccount?.isNew ? ` وتم تفعيل حساب للعميل ببيانات هاتفه.` : ""),
    at: now,
    by: adminUser?.name || "admin"
  });

  await reqDoc.save();

  try {
    await recordOrderLifecycleEvents(subdomain, {
      order: newOrder,
      eventType: "order_created",
      occurredAt: now
    });
  } catch (err) {
    console.warn("[SERVICE_ORDER_EVENT_WARN]", err.message);
  }

  return {
    order: newOrder,
    request: reqDoc,
    customerAccount
  };
}

/**
 * Assign maintenance task to a technician (Role 2)
 */
async function assignTechnicianToRequest(subdomain, requestId, payload = {}, adminUser = {}) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const getUsersModel = require("../auth/userModel");
  const Users = getUsersModel(subdomain);

  const reqDoc = await ReturnRequest.findById(requestId);
  if (!reqDoc) throw new Error("طلب الصيانة غير موجود");

  const { techId, note = "", branchId } = payload;
  if (!techId) throw new Error("يرجى اختيار فني الصيانة المعين للمهمة");

  const techUser = await Users.findById(techId).select("fullname email phone role branchId");
  if (!techUser) throw new Error("فني الصيانة المحدد غير موجود");

  reqDoc.assignedTechId = techUser._id;
  if (branchId) reqDoc.branchId = branchId;
  else if (techUser.branchId && !reqDoc.branchId) reqDoc.branchId = techUser.branchId;

  reqDoc.status = "assigned_to_tech";
  if (!reqDoc.accessToken) {
    reqDoc.accessToken = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  reqDoc.timeline.push({
    status: "assigned_to_tech",
    title: `تم إسناد مهمة الصيانة إلى الفني (${techUser.fullname})`,
    note: note || `تم توكيل الجهاز للفني برقم تواصل: ${techUser.phone}`,
    by: adminUser?.fullname || "إدارة الفرع",
    at: new Date()
  });

  await reqDoc.save();

  // Automatic Audit Logging
  try {
    await logAudit({
      subdomain,
      userId: adminUser?._id || null,
      userName: adminUser?.fullname || adminUser?.name || "إدارة الفرع",
      userRole: adminUser?.role || "admin",
      branchId: reqDoc.branchId || null,
      action: "maintenance_technician_assigned",
      actionLabel: "إسناد صيانة لفني الورشة",
      targetType: "maintenance",
      targetId: String(reqDoc._id),
      targetCode: reqDoc.requestNumber,
      details: `إسناد تذكرة الصيانة #${reqDoc.requestNumber} للفني ${techUser.fullname} وتوليد رابط المهمة الميداني`,
      metadata: {
        requestNumber: reqDoc.requestNumber,
        techId: String(techUser._id),
        techName: techUser.fullname,
        techPhone: techUser.phone
      }
    });
  } catch (auditErr) {
    console.warn("[AUDIT_ASSIGN_WARN]", auditErr.message);
  }

  // Generate task link and message template
  const taskPath = `/maintenance/task/${reqDoc._id}?token=${reqDoc.accessToken}`;
  const origin = process.env.CLIENT_URL || process.env.BASE_URL || "http://localhost:5173";
  const taskUrl = `${origin.replace(/\/+$/, "")}${taskPath}`;
  const firstItem = reqDoc.items?.[0]?.name || "جهاز صيانة";
  const rawMsg = `مرحباً أستاذ ${techUser.fullname}،\nتم إسناد مهمة صيانة جديدة لك بالفرع.\nرقم التذكرة: #${reqDoc.requestNumber}\nالجهاز: ${firstItem}\nالعميل: ${reqDoc.customer?.name} (${reqDoc.customer?.phone})\nلمتابعة تفاصيل المهمة وتحديث حالتها مباشرة اضغط هنا:\n${taskUrl}`;

  const cleanPhone = (techUser.phone || "").replace(/[^0-9]/g, "");
  const waPhone = cleanPhone.startsWith("0") ? `2${cleanPhone}` : cleanPhone;
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(rawMsg)}`
    : "";

  return {
    success: true,
    request: reqDoc,
    taskPath,
    taskUrl,
    whatsappUrl,
    accessToken: reqDoc.accessToken,
    tech: techUser,
    messageTemplate: rawMsg
  };
}

/**
 * Get technician task by ID and token
 */
async function getTechnicianTask(subdomain, requestId, token, user) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const reqDoc = await ReturnRequest.findById(requestId)
    .populate("assignedTechId", "fullname email phone")
    .populate("branchId", "name code city phone whatsapp")
    .lean();

  if (!reqDoc) throw new Error("مهمة الصيانة غير موجودة");

  const isTokenMatch = token && reqDoc.accessToken && String(token).trim() === String(reqDoc.accessToken).trim();
  const isAssignedUser = user && reqDoc.assignedTechId && String(user._id) === String(reqDoc.assignedTechId._id || reqDoc.assignedTechId);
  const isAdminUser = user && (Number(user.role) >= 3 || user.role === "admin");

  if (!isTokenMatch && !isAssignedUser && !isAdminUser) {
    const err = new Error("غير مصرح، رابط المهمة غير صالح أو منتهي الصلاحية");
    err.status = 403;
    throw err;
  }

  return reqDoc;
}

/**
 * Update technician task by ID and token
 */
async function updateTechnicianTask(subdomain, requestId, payload = {}, token, user) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const reqDoc = await ReturnRequest.findById(requestId);
  if (!reqDoc) throw new Error("مهمة الصيانة غير موجودة");

  const isTokenMatch = token && reqDoc.accessToken && String(token).trim() === String(reqDoc.accessToken).trim();
  const isAssignedUser = user && reqDoc.assignedTechId && String(user._id) === String(reqDoc.assignedTechId);
  const isAdminUser = user && (Number(user.role) >= 3 || user.role === "admin");

  if (!isTokenMatch && !isAssignedUser && !isAdminUser) {
    const err = new Error("غير مصرح لتحديث هذه المهمة");
    err.status = 403;
    throw err;
  }

  const { status, techNotes = "", techAction = "" } = payload;
  const now = new Date();

  if (status) reqDoc.status = status;
  if (techNotes) reqDoc.techNotes = techNotes;
  if (techAction) reqDoc.techAction = techAction;

  if (status === "repaired" || status === "unrepairable") {
    reqDoc.techCompletedAt = now;
  }

  const techName = user?.fullname || "فني الصيانة المسؤول";
  reqDoc.timeline.push({
    status: status || reqDoc.status,
    title: `تحديث من الفني (${techName})`,
    note: `${techAction ? `الإجراء الفني: ${techAction} | ` : ""}${techNotes || `تم تحديث الحالة إلى ${status}`}`,
    by: techName,
    at: now
  });

  await reqDoc.save();

  // Automatic Audit Logging for Technician
  try {
    await logAudit({
      subdomain,
      userId: user?._id || null,
      userName: user?.fullname || user?.name || techName,
      userRole: user?.role || "technician",
      branchId: reqDoc.branchId || null,
      action: status === "repaired" ? "maintenance_repaired" : "maintenance_technician_action",
      actionLabel: status === "repaired" ? "اكتمال إصلاح الصيانة بالورشة" : "تحديث إجراء فني للصيانة",
      targetType: "maintenance",
      targetId: String(reqDoc._id),
      targetCode: reqDoc.requestNumber,
      details: `تحديث تذكرة الصيانة #${reqDoc.requestNumber} إلى حالة (${status || reqDoc.status}) - الإجراء الفني: ${techAction || 'إصلاح وضبط الشاسيه بالورشة'}`,
      metadata: {
        requestNumber: reqDoc.requestNumber,
        status: status || reqDoc.status,
        techAction,
        techNotes
      }
    });
  } catch (auditErr) {
    console.warn("[AUDIT_TECH_WARN]", auditErr.message);
  }

  return reqDoc;
}

/**
 * Update maintenance financial costs, collection status, and treasury remittance
 */
async function updateMaintenanceFinancials(subdomain, requestId, financialData = {}, adminUser = null) {
  const ReturnRequest = getReturnRequestModel(subdomain);
  const reqDoc = await ReturnRequest.findById(requestId);
  if (!reqDoc) throw new Error("طلب الصيانة غير موجود");

  const serviceFee = Number(financialData.serviceFee) || 0;
  const partsCost = Number(financialData.partsCost) || 0;
  const isWarrantyFree = financialData.isWarrantyFree !== undefined ? Boolean(financialData.isWarrantyFree) : reqDoc.isWarrantyFree;
  const totalCost = isWarrantyFree ? 0 : (serviceFee + partsCost);
  const amountDue = isWarrantyFree ? 0 : (financialData.amountDueFromCustomer !== undefined ? Number(financialData.amountDueFromCustomer) : totalCost);

  reqDoc.serviceFee = serviceFee;
  reqDoc.partsCost = partsCost;
  reqDoc.totalMaintenanceCost = totalCost;
  reqDoc.isWarrantyFree = isWarrantyFree;
  reqDoc.amountDueFromCustomer = amountDue;

  if (financialData.paymentStatus) {
    reqDoc.paymentStatus = financialData.paymentStatus;
  } else if (isWarrantyFree) {
    reqDoc.paymentStatus = "free_warranty";
  }

  if (financialData.collectedAmount !== undefined) {
    reqDoc.collectedAmount = Number(financialData.collectedAmount) || 0;
    if (reqDoc.collectedAmount > 0 && !reqDoc.collectedAt) {
      reqDoc.collectedAt = new Date();
    }
  }

  if (financialData.remittedToAdmin !== undefined) {
    reqDoc.remittedToAdmin = Boolean(financialData.remittedToAdmin);
    if (reqDoc.remittedToAdmin) {
      reqDoc.remittedAt = new Date();
      reqDoc.paymentStatus = "remitted_to_admin";
    }
    if (financialData.remittedNote) {
      reqDoc.remittedNote = String(financialData.remittedNote).trim();
    }
  }

  reqDoc.timeline.push({
    status: reqDoc.status,
    title: reqDoc.remittedToAdmin
      ? `تم توريد عهدة الصيانة (${reqDoc.collectedAmount} ج.م) بالكامل لخزينة الإدارة`
      : `تم تحديث الحسابات والتكلفة (المطلوب: ${reqDoc.amountDueFromCustomer} ج.م)`,
    note: reqDoc.remittedNote || `رسوم خدمة: ${serviceFee} ج.م، قطع غيار: ${partsCost} ج.م، حالة الضمان: ${isWarrantyFree ? 'مشمول بالضمان مجاناً' : 'صيانة مدفوعة'}`,
    by: adminUser?.fullname || "إدارة الحسابات",
    at: new Date()
  });

  await reqDoc.save();

  // Automatic Audit Logging for Financials & Treasury Remittance
  try {
    await logAudit({
      subdomain,
      userId: adminUser?._id || null,
      userName: adminUser?.fullname || adminUser?.name || "إدارة الحسابات",
      userRole: adminUser?.role || "admin",
      branchId: reqDoc.branchId || null,
      action: reqDoc.remittedToAdmin ? "maintenance_remitted_to_treasury" : "maintenance_financials_recorded",
      actionLabel: reqDoc.remittedToAdmin ? "توريد عهدة صيانة للخزينة" : "تحديد تكاليف الصيانة والتحصيل",
      targetType: "maintenance",
      targetId: String(reqDoc._id),
      targetCode: reqDoc.requestNumber,
      details: reqDoc.remittedToAdmin
        ? `توريد متحصلات الصيانة #${reqDoc.requestNumber} بقيمة ${reqDoc.collectedAmount} ج.م بالكامل إلى خزينة الإدارة`
        : `قيد حسابات صيانة #${reqDoc.requestNumber}: أتعاب خدمة ${serviceFee} ج.م، قطع غيار ${partsCost} ج.م، المحصل: ${reqDoc.collectedAmount} ج.م`,
      metadata: {
        requestNumber: reqDoc.requestNumber,
        serviceFee,
        partsCost,
        totalCost,
        isWarrantyFree,
        amountDue,
        collectedAmount: reqDoc.collectedAmount,
        remittedToAdmin: reqDoc.remittedToAdmin,
        paymentStatus: reqDoc.paymentStatus
      }
    });
  } catch (auditErr) {
    console.warn("[AUDIT_FINANCE_WARN]", auditErr.message);
  }

  return reqDoc;
}

module.exports = {
  createClientRequest,
  getUserRequests,
  getRequestByNumber,
  getAdminRequests,
  updateRequestStatus,
  processRefund,
  convertToFieldServiceOrder,
  evaluateReturnEligibility,
  evaluateItemWarranty,
  assignTechnicianToRequest,
  getTechnicianTask,
  updateTechnicianTask,
  updateMaintenanceFinancials
};
