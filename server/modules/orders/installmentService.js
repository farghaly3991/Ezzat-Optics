const mongoose = require("mongoose");
const getOrdersModel = require("./orderModel");

/**
 * Helper to build an installment schedule given total amount, months, rate, and downPayment
 */
function buildInstallmentSchedule({
  originalAmount,
  months = 6,
  interestRate = 0,
  downPayment = 0,
  startDate = new Date(),
  guarantor = {}
}) {
  const origAmt = Math.max(0, Number(originalAmount) || 0);
  const m = Math.max(1, parseInt(months, 10) || 6);
  const rate = Math.max(0, Number(interestRate) || 0);
  const dp = Math.min(origAmt, Math.max(0, Number(downPayment) || 0));

  // Amount subject to installment after down payment
  const financedPrincipal = Math.max(0, origAmt - dp);
  // Interest / fee added
  const interestAmount = Math.round((financedPrincipal * (rate / 100)) * 100) / 100;
  const totalFinanced = financedPrincipal + interestAmount;
  const totalAmount = dp + totalFinanced;

  // Monthly installment amount
  const monthlyAmount = Math.round((totalFinanced / m) * 100) / 100;

  // Generate payment schedule
  const payments = [];
  const baseDate = new Date(startDate || Date.now());

  for (let i = 1; i <= m; i++) {
    const dueDate = new Date(baseDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    // If it's the last installment, adjust any penny difference
    let instAmount = monthlyAmount;
    if (i === m) {
      const sumPrevious = monthlyAmount * (m - 1);
      instAmount = Math.max(0, Math.round((totalFinanced - sumPrevious) * 100) / 100);
    }

    payments.push({
      installmentIndex: i,
      dueDate,
      amount: instAmount,
      paidAmount: 0,
      status: "pending",
      paidAt: null,
      paymentMethod: "cash",
      collectedBy: null,
      collectedByName: "",
      notes: "",
      receiptNumber: ""
    });
  }

  return {
    isInstallment: true,
    plan: {
      months: m,
      interestRate: rate,
      originalAmount: origAmt,
      interestAmount,
      totalAmount,
      downPayment: dp,
      downPaymentPaid: dp > 0,
      monthlyAmount,
      startDate: baseDate
    },
    summary: {
      totalRequired: totalAmount,
      totalPaid: dp, // Down payment paid upfront
      totalRemaining: totalFinanced,
      paidInstallmentsCount: 0,
      remainingInstallmentsCount: m,
      nextDueDate: payments[0]?.dueDate || null,
      status: totalFinanced <= 0 ? "completed" : "active"
    },
    guarantor: {
      nationalId: String(guarantor.nationalId || "").trim(),
      name: String(guarantor.name || "").trim(),
      phone: String(guarantor.phone || "").trim(),
      relationship: String(guarantor.relationship || "").trim()
    },
    payments
  };
}

/**
 * Fetch overview & aggregated statistics for installments
 */
async function getInstallmentsOverview(subdomain, query = {}, user = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = { "installment.isInstallment": true };

  // Branch scoping: If user is Branch Admin (Role 4) or Branch Staff, restrict strictly to their branch
  if (user && user.role !== 5 && user.branchId) {
    filter.branchId = user.branchId;
  } else if (query.branchId && query.branchId !== "all") {
    filter.branchId = query.branchId;
  }

  // Status filter (active, completed, defaulted)
  if (query.status && query.status !== "all") {
    filter["installment.summary.status"] = query.status;
  }

  // Search filter by orderId, customer name, phone, or guarantor nationalId
  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    const regex = new RegExp(s, "i");
    filter.$or = [
      { orderId: regex },
      { "customer.name": regex },
      { "customer.phone": regex },
      { "installment.guarantor.nationalId": regex },
      { "installment.guarantor.name": regex }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 25);
  const skip = (page - 1) * limit;

  const [orders, totalCount] = await Promise.all([
    Orders.find(filter)
      .populate("branchId", "name code city isMain")
      .populate("userId", "fullname email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Orders.countDocuments(filter)
  ]);

  // Aggregated KPIs across all matching installment orders (unpaginated)
  const allMatching = await Orders.find(filter, {
    items: 1,
    installment: 1,
    status: 1
  }).lean();

  let totalProductsCount = 0;
  let totalAmountRequired = 0;
  let totalAmountCollected = 0;
  let totalAmountRemaining = 0;
  let maxRemainingMonths = 0;
  let activeOrders = 0;
  let completedOrders = 0;
  let overdueInstallmentsCount = 0;
  let overdueAmount = 0;

  const now = new Date();

  for (const ord of allMatching) {
    const inst = ord.installment || {};
    const sum = inst.summary || {};
    const plan = inst.plan || {};

    // Count products
    if (Array.isArray(ord.items)) {
      totalProductsCount += ord.items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    }

    totalAmountRequired += Number(sum.totalRequired || plan.totalAmount || 0);
    totalAmountCollected += Number(sum.totalPaid || 0);
    totalAmountRemaining += Number(sum.totalRemaining || 0);

    if (sum.status === "completed") {
      completedOrders++;
    } else {
      activeOrders++;
      // Check remaining months
      const remCount = Number(sum.remainingInstallmentsCount || 0);
      if (remCount > maxRemainingMonths) {
        maxRemainingMonths = remCount;
      }
    }

    // Check overdue payments
    if (Array.isArray(inst.payments)) {
      for (const p of inst.payments) {
        if (p.status !== "paid" && new Date(p.dueDate) < now) {
          overdueInstallmentsCount++;
          overdueAmount += Number(p.amount || 0) - Number(p.paidAmount || 0);
        }
      }
    }
  }

  return {
    kpis: {
      totalOrders: allMatching.length,
      activeOrders,
      completedOrders,
      totalProductsCount,
      totalAmountRequired: Math.round(totalAmountRequired * 100) / 100,
      totalAmountCollected: Math.round(totalAmountCollected * 100) / 100,
      totalAmountRemaining: Math.round(totalAmountRemaining * 100) / 100,
      maxRemainingMonths,
      overdueInstallmentsCount,
      overdueAmount: Math.round(overdueAmount * 100) / 100
    },
    orders,
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit) || 1
    }
  };
}

/**
 * Fetch a single order's full installment profile
 */
async function getInstallmentDetails(subdomain, orderId, user = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = {
    $or: [
      { orderId: orderId },
      ...(mongoose.isValidObjectId(orderId) ? [{ _id: orderId }] : [])
    ]
  };

  if (user && user.role !== 5 && user.branchId) {
    filter.branchId = user.branchId;
  }

  const order = await Orders.findOne(filter)
    .populate("branchId", "name code city isMain")
    .populate("userId", "fullname email phone")
    .populate("installment.payments.collectedBy", "fullname role email")
    .lean();

  if (!order) {
    throw new Error("طلب التقسيط غير موجود أو لا تملك صلاحية الوصول إليه");
  }

  return order;
}

/**
 * Record payment for an installment
 */
async function recordInstallmentPayment(subdomain, orderId, paymentPayload = {}, operatorUser = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = {
    $or: [
      { orderId: orderId },
      ...(mongoose.isValidObjectId(orderId) ? [{ _id: orderId }] : [])
    ]
  };

  if (operatorUser && operatorUser.role !== 5 && operatorUser.branchId) {
    filter.branchId = operatorUser.branchId;
  }

  const order = await Orders.findOne(filter);
  if (!order) {
    throw new Error("طلب التقسيط غير موجود");
  }

  if (!order.installment || !order.installment.isInstallment) {
    throw new Error("هذا الطلب ليس مسجلاً بنظام التقسيط المباشر");
  }

  const installmentIndex = parseInt(paymentPayload.installmentIndex, 10);
  const paymentMethod = ["cash", "card", "wallet", "bank_transfer"].includes(paymentPayload.paymentMethod)
    ? paymentPayload.paymentMethod
    : "cash";
  const notes = String(paymentPayload.notes || "").trim();
  const receiptNumber = String(paymentPayload.receiptNumber || "").trim() || `RCP-INST-${Date.now().toString().slice(-6)}`;
  const now = new Date();

  const payments = order.installment.payments || [];
  let targetPayment = null;

  if (installmentIndex && payments.length > 0) {
    targetPayment = payments.find((p) => p.installmentIndex === installmentIndex);
  }

  // If no target index provided, pay the earliest unpaid installment
  if (!targetPayment) {
    targetPayment = payments.find((p) => p.status !== "paid");
  }

  if (!targetPayment) {
    throw new Error("جميع أقساط هذا الطلب مسددة بالكامل بالفعل");
  }

  const requiredAmount = Number(targetPayment.amount || 0);
  const incomingAmount = Number(paymentPayload.paidAmount) || requiredAmount;

  targetPayment.paidAmount = incomingAmount;
  targetPayment.status = incomingAmount >= requiredAmount ? "paid" : "partially_paid";
  targetPayment.paidAt = now;
  targetPayment.paymentMethod = paymentMethod;
  targetPayment.collectedBy = operatorUser?._id || null;
  targetPayment.collectedByName = operatorUser?.fullname || "مشرف النظام";
  targetPayment.notes = notes;
  targetPayment.receiptNumber = receiptNumber;

  // Recalculate summary totals
  let totalPaid = Number(order.installment.plan.downPayment || 0);
  let paidCount = 0;
  let remainingCount = 0;
  let nextDue = null;

  for (const p of payments) {
    totalPaid += Number(p.paidAmount || 0);
    if (p.status === "paid") {
      paidCount++;
    } else {
      remainingCount++;
      if (!nextDue && p.dueDate) {
        nextDue = p.dueDate;
      }
    }
  }

  const totalRequired = Number(order.installment.summary.totalRequired || order.installment.plan.totalAmount || 0);
  const totalRemaining = Math.max(0, totalRequired - totalPaid);

  order.installment.summary.totalPaid = Math.round(totalPaid * 100) / 100;
  order.installment.summary.totalRemaining = Math.round(totalRemaining * 100) / 100;
  order.installment.summary.paidInstallmentsCount = paidCount;
  order.installment.summary.remainingInstallmentsCount = remainingCount;
  order.installment.summary.nextDueDate = nextDue;

  // Check if fully paid
  const isFullySettled = totalRemaining <= 0 || (remainingCount === 0 && paidCount === payments.length);

  if (isFullySettled) {
    order.installment.summary.status = "completed";
    order.payment.paid = true;
    order.timeline.push({
      status: "completed",
      at: now,
      note: `تم سداد كامل أقساط الطلب بنجاح وإغلاق الفاتورة بواسطة ${operatorUser?.fullname || "المشرف"}`
    });
  } else {
    order.timeline.push({
      status: "payment_received",
      at: now,
      note: `تم تحصيل القسط رقم ${targetPayment.installmentIndex} بقيمة ${incomingAmount} ج.م (${
        paymentMethod === "cash" ? "نقداً" : paymentMethod === "card" ? "بطاقة" : "تحويل"
      }) بواسطة ${operatorUser?.fullname || "المشرف"}. إيصال: ${receiptNumber}`
    });
  }

  await order.save();

  // Automatic Audit Logging for Installment Collection
  try {
    const { logAudit } = require("../audit/auditService");
    await logAudit({
      subdomain,
      branchId: operatorUser?.branchId || order.branchId || null,
      userId: operatorUser?._id || null,
      userName: operatorUser?.fullname || operatorUser?.name || "مشرف الحسابات",
      userRole: operatorUser?.role || "cashier",
      action: isFullySettled ? "installment_plan_completed" : "installment_payment_collected",
      actionLabel: isFullySettled ? "سداد كامل أقساط الطلب وإغلاقه" : `تحصيل قسط رقم ${targetPayment.installmentIndex}`,
      targetType: "order",
      targetId: String(order._id),
      targetCode: order.orderId,
      details: isFullySettled
        ? `تحصيل القسط الختامي رقم ${targetPayment.installmentIndex} بمبلغ ${incomingAmount} ج.م وإغلاق عقد التقسيط بالكامل للفاتورة #${order.orderId}`
        : `تحصيل القسط رقم ${targetPayment.installmentIndex} بمبلغ ${incomingAmount} ج.م نقداً للفاتورة #${order.orderId} - إيصال #${receiptNumber}`,
      metadata: {
        orderId: order.orderId,
        installmentIndex: targetPayment.installmentIndex,
        paidAmount: incomingAmount,
        paymentMethod,
        receiptNumber,
        totalRemaining,
        remainingCount,
        isFullySettled
      }
    });
  } catch (audErr) {
    console.warn("[INSTALLMENT_AUDIT_LOG_WARN]", audErr.message);
  }

  return {
    order,
    paymentRecorded: targetPayment,
    receiptNumber: targetPayment?.receiptNumber,
    isFullySettled,
    summary: order.installment.summary
  };
}

/**
 * Update installment status manually
 */
async function updateInstallmentStatus(subdomain, orderId, status, notes = "", operatorUser = null) {
  const Orders = getOrdersModel(subdomain);
  const order = await Orders.findOne({
    $or: [
      { orderId: orderId },
      ...(mongoose.isValidObjectId(orderId) ? [{ _id: orderId }] : [])
    ]
  });

  if (!order || !order.installment) {
    throw new Error("طلب التقسيط غير موجود");
  }

  const validStatuses = ["active", "completed", "defaulted", "cancelled"];
  if (!validStatuses.includes(status)) {
    throw new Error("حالة التقسيط غير صالحة");
  }

  order.installment.summary.status = status;
  if (status === "completed") {
    order.payment.paid = true;
  }

  order.timeline.push({
    status: `installment_${status}`,
    at: new Date(),
    note: `تم تحديث حالة التقسيط إلى (${status}) بواسطة ${operatorUser?.fullname || "المشرف"}. ${notes}`
  });

  await order.save();
  return order;
}

/**
 * Add / Attach Document to Installment
 */
async function addInstallmentDocument(subdomain, orderId, docData, operatorUser = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = {
    $or: [
      { orderId: orderId },
      ...(mongoose.isValidObjectId(orderId) ? [{ _id: orderId }] : [])
    ]
  };

  const order = await Orders.findOne(filter);
  if (!order || !order.installment) {
    throw new Error("طلب التقسيط غير موجود");
  }

  if (!docData.url) {
    throw new Error("رابط أو مسار المستند مطلوب");
  }

  const newDoc = {
    docType: docData.docType || "other",
    title: docData.title || "مستند تقسيط",
    url: docData.url,
    uploadedAt: new Date(),
    uploadedBy: operatorUser?._id || null,
    uploadedByName: operatorUser?.fullname || operatorUser?.name || "المشرف",
    notes: docData.notes || ""
  };

  if (!Array.isArray(order.installment.documents)) {
    order.installment.documents = [];
  }
  order.installment.documents.push(newDoc);

  order.timeline.push({
    status: "installment_document_added",
    at: new Date(),
    note: `تم إرفاق مستند (${newDoc.title}) في ملف التقسيط بواسطة ${newDoc.uploadedByName}`
  });

  await order.save();
  return {
    order,
    document: order.installment.documents[order.installment.documents.length - 1],
    documents: order.installment.documents
  };
}

/**
 * Remove / Delete Document from Installment
 */
async function removeInstallmentDocument(subdomain, orderId, documentId, operatorUser = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = {
    $or: [
      { orderId: orderId },
      ...(mongoose.isValidObjectId(orderId) ? [{ _id: orderId }] : [])
    ]
  };

  const order = await Orders.findOne(filter);
  if (!order || !order.installment) {
    throw new Error("طلب التقسيط غير موجود");
  }

  const beforeLen = order.installment.documents?.length || 0;
  order.installment.documents = (order.installment.documents || []).filter(
    (d) => String(d._id) !== String(documentId)
  );

  if (order.installment.documents.length !== beforeLen) {
    order.timeline.push({
      status: "installment_document_removed",
      at: new Date(),
      note: `تم حذف مستند من ملف التقسيط بواسطة ${operatorUser?.fullname || "المشرف"}`
    });
    await order.save();
  }

  return {
    order,
    documents: order.installment.documents
  };
}

/**
 * Save manual custom edits to legal contract text
 */
async function saveInstallmentContractText(subdomain, orderId, contractText, operatorUser = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = {
    $or: [
      { orderId: orderId },
      ...(mongoose.isValidObjectId(orderId) ? [{ _id: orderId }] : [])
    ]
  };

  const order = await Orders.findOne(filter);
  if (!order || !order.installment) {
    throw new Error("طلب التقسيط غير موجود");
  }

  order.installment.legalContractText = String(contractText || "").trim();
  order.installment.contractGeneratedAt = new Date();

  order.timeline.push({
    status: "installment_contract_updated",
    at: new Date(),
    note: `تم تعديل وتثبيت صياغة العقد الرسمي بواسطة ${operatorUser?.fullname || "المشرف"}`
  });

  await order.save();
  return order;
}

/**
 * Comprehensive Finance Summary for Installments
 * Calculates:
 * 1. "إيه اللي ليك" (Total Receivables / الأقساط غير المحصلة)
 * 2. "إيه اللي داخل" (Cash Inflow / الأقساط المحصلة فعلياً)
 * 3. "إيه اللي لسه ليك" (Remaining Future Receivables)
 * 4. Upcoming monthly cash flow schedule (for the next 6-12 months)
 */
async function getFinanceInstallmentsSummary(subdomain, branchId = null) {
  const Orders = getOrdersModel(subdomain);
  const filter = { "installment.isInstallment": true };

  if (branchId && branchId !== "all" && mongoose.isValidObjectId(branchId)) {
    filter.branchId = branchId;
  }

  const orders = await Orders.find(filter, {
    orderId: 1,
    customer: 1,
    branchId: 1,
    items: 1,
    installment: 1,
    createdAt: 1
  }).lean();

  let totalReceivablesOriginal = 0; // إجمالي قيمة الأقساط المطلوبة كلياً
  let totalCashCollected = 0; // إجمالي ما دخل الخزينة فعلياً (مقدمات + أقساط)
  let totalRemainingReceivables = 0; // إجمالي ما تبقى للمحل في ذمة العملاء (إيه اللي لسه ليك)
  let overdueAmount = 0; // متأخرات
  let activeContractsCount = 0;
  let completedContractsCount = 0;

  // Monthly breakdown for upcoming 12 months
  const monthlyProjection = {};
  const now = new Date();

  for (const ord of orders) {
    const inst = ord.installment || {};
    const sum = inst.summary || {};
    const plan = inst.plan || {};

    const req = Number(sum.totalRequired || plan.totalAmount || 0);
    const paid = Number(sum.totalPaid || 0);
    const rem = Number(sum.totalRemaining || Math.max(0, req - paid));

    totalReceivablesOriginal += req;
    totalCashCollected += paid;
    totalRemainingReceivables += rem;

    if (sum.status === "completed") {
      completedContractsCount++;
    } else {
      activeContractsCount++;
    }

    if (Array.isArray(inst.payments)) {
      for (const p of inst.payments) {
        if (p.status !== "paid" && p.dueDate) {
          const d = new Date(p.dueDate);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthlyProjection[monthKey] = (monthlyProjection[monthKey] || 0) + Number(p.amount || 0);

          if (d < now) {
            overdueAmount += Number(p.amount || 0) - Number(p.paidAmount || 0);
          }
        }
      }
    }
  }

  // Format monthly projection array sorted chronologically
  const projectionList = Object.keys(monthlyProjection)
    .sort()
    .slice(0, 12)
    .map((key) => ({
      period: key,
      expectedInflow: Math.round(monthlyProjection[key] * 100) / 100
    }));

  return {
    totalContracts: orders.length,
    activeContractsCount,
    completedContractsCount,
    totalReceivablesOriginal: Math.round(totalReceivablesOriginal * 100) / 100, // إجمالي حجم محفظة التقسيط
    totalCashCollected: Math.round(totalCashCollected * 100) / 100, // إيه اللي داخل (الكاش المحصل)
    totalRemainingReceivables: Math.round(totalRemainingReceivables * 100) / 100, // إيه اللي لسه ليك (المستحقات المتبقية)
    overdueAmount: Math.round(overdueAmount * 100) / 100, // المتأخرات
    collectionRate:
      totalReceivablesOriginal > 0
        ? Math.round((totalCashCollected / totalReceivablesOriginal) * 100)
        : 100,
    monthlyProjection: projectionList
  };
}

module.exports = {
  buildInstallmentSchedule,
  getInstallmentsOverview,
  getInstallmentDetails,
  recordInstallmentPayment,
  updateInstallmentStatus,
  addInstallmentDocument,
  removeInstallmentDocument,
  saveInstallmentContractText,
  getFinanceInstallmentsSummary
};
