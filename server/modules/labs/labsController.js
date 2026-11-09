const getLabModel = require("./labModel");
const getWorkOrderModel = require("./workOrderModel");
const getOrdersModel = require("../orders/orderModel");
const { logAudit } = require("../audit/auditService");
const mongoose = require("mongoose");

// ==========================================
// 1. LABS & WORKSHOPS DIRECTORY (إدارة الورش والمعامل)
// ==========================================

exports.listLabs = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const Lab = getLabModel(subdomain);
    const { search, active } = req.query;

    const query = {};
    if (active !== undefined && active !== "all") {
      query.active = active === "true" || active === true;
    }
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: "i" } },
        { phone: { $regex: s, $options: "i" } },
        { specialty: { $regex: s, $options: "i" } },
        { city: { $regex: s, $options: "i" } }
      ];
    }

    const labs = await Lab.find(query).sort({ rating: -1, createdAt: -1 }).lean();
    res.json({ labs });
  } catch (err) {
    next(err);
  }
};

exports.createLab = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const Lab = getLabModel(subdomain);
    const { name, phone, whatsappPhone, address, city, specialty, customStages, pricingNotes, branchId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "اسم المعمل / الورشة مطلوب" });
    }

    const lab = new Lab({
      name: name.trim(),
      phone: (phone || "").trim(),
      whatsappPhone: (whatsappPhone || phone || "").trim(),
      address: (address || "").trim(),
      city: (city || "القاهرة").trim(),
      specialty: (specialty || "معمل عدسات وبصريات متكامل").trim(),
      branchId: branchId && mongoose.isValidObjectId(branchId) ? branchId : null,
      customStages: Array.isArray(customStages) && customStages.length > 0 ? customStages : undefined,
      pricingNotes: (pricingNotes || "").trim()
    });

    await lab.save();
    res.status(201).json({ done: true, message: "تمت إضافة المعمل بنجاح", lab });
  } catch (err) {
    next(err);
  }
};

exports.updateLab = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const Lab = getLabModel(subdomain);
    const { labId } = req.params;

    const lab = await Lab.findById(labId);
    if (!lab) return res.status(404).json({ error: "المعمل غير موجود" });

    const fields = ["name", "phone", "whatsappPhone", "address", "city", "specialty", "customStages", "pricingNotes", "active"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) lab[f] = req.body[f];
    });

    await lab.save();
    res.json({ done: true, message: "تم تحديث بيانات المعمل بنجاح", lab });
  } catch (err) {
    next(err);
  }
};

exports.deleteLab = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const Lab = getLabModel(subdomain);
    const { labId } = req.params;

    const lab = await Lab.findById(labId);
    if (!lab) return res.status(404).json({ error: "المعمل غير موجود" });

    // Soft delete / deactivate
    lab.active = false;
    await lab.save();

    res.json({ done: true, message: "تم تعطيل المعمل بنجاح" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. WORK ORDERS MANAGEMENT (أوامر التشغيل)
// ==========================================

exports.listWorkOrders = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const { status, labId, orderId, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (labId && mongoose.isValidObjectId(labId)) {
      query.labId = labId;
    }
    if (orderId) {
      query.orderId = orderId;
    }
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { workOrderNumber: { $regex: s, $options: "i" } },
        { orderId: { $regex: s, $options: "i" } },
        { "customer.name": { $regex: s, $options: "i" } },
        { "customer.phone": { $regex: s, $options: "i" } },
        { labName: { $regex: s, $options: "i" } }
      ];
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, parseInt(limit, 10) || 50);

    const [workOrders, total] = await Promise.all([
      WorkOrder.find(query)
        .populate("labId", "name phone whatsappPhone specialty customStages rating")
        .sort({ createdAt: -1 })
        .skip((p - 1) * lim)
        .limit(lim)
        .lean(),
      WorkOrder.countDocuments(query)
    ]);

    res.json({ workOrders, total, page: p, pages: Math.ceil(total / lim) });
  } catch (err) {
    next(err);
  }
};

exports.getWorkOrder = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const { id } = req.params;

    const workOrder = await WorkOrder.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(id) ? id : null },
        { workOrderNumber: id },
        { orderId: id }
      ]
    }).populate("labId");

    if (!workOrder) return res.status(404).json({ error: "أمر التشغيل غير موجود" });
    res.json({ workOrder });
  } catch (err) {
    next(err);
  }
};

exports.createWorkOrder = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const Lab = getLabModel(subdomain);
    const Orders = getOrdersModel(subdomain);

    const {
      orderId,
      labId,
      items,
      expectedDeliveryDate,
      financials,
      notes
    } = req.body;

    if (!orderId) return res.status(400).json({ error: "رقم الفاتورة / الطلب مطلوب" });
    if (!labId) return res.status(400).json({ error: "يرجى تحديد الورشة أو المعمل" });

    const lab = await Lab.findById(labId);
    if (!lab) return res.status(404).json({ error: "المعمل المحدد غير موجود" });

    const order = await Orders.findOne({
      $or: [
        { orderId },
        { _id: mongoose.isValidObjectId(orderId) ? orderId : null }
      ]
    });

    if (!order) return res.status(404).json({ error: "الطلب المرتبط بأمر التشغيل غير موجود" });

    // Generate work order number: WO-XXXX
    const count = await WorkOrder.countDocuments();
    const workOrderNumber = `WO-${1000 + count + 1}`;

    // Initial stage
    const initialStage = lab.customStages?.[0] || { key: "received", label: "استلام أمر الشغل" };

    const parsedFinancials = financials || {};
    const labCost = Number(parsedFinancials.labCost || 0);
    const shippingCost = Number(parsedFinancials.shippingCost || 0);
    const extraCost = Number(parsedFinancials.extraCost || 0);
    const totalCost = labCost + shippingCost + extraCost;
    const paidAmount = Number(parsedFinancials.paidAmount || 0);
    const remainingAmount = Math.max(0, totalCost - paidAmount);

    const workOrder = new WorkOrder({
      workOrderNumber,
      orderId: order.orderId,
      orderDbId: order._id,
      labId: lab._id,
      labName: lab.name,
      branchId: order.branchId || null,
      customer: {
        name: order.customer?.name || "عميل المتجر",
        phone: order.customer?.phone || ""
      },
      items: Array.isArray(items) && items.length > 0 ? items : order.items.map(it => ({
        productId: it.productId,
        name: it.name,
        unitSlotKey: it.unitSlotKey || it.lensSpecs?.eye || "",
        unitSlotLabel: it.unitSlotLabel || (it.lensSpecs?.eye === "right" ? "العين اليمنى" : it.lensSpecs?.eye === "left" ? "العين اليسرى" : ""),
        specs: it.lensSpecs || it.specs || {},
        quantity: it.quantity || 1,
        isFrame: it.productType === "frame" || it.productType === "sunglass",
        frameDetails: it.frameSpecs || {}
      })),
      currentStage: initialStage.key,
      currentStageLabel: initialStage.label,
      stageHistory: [
        {
          stageKey: initialStage.key,
          stageLabel: initialStage.label,
          updatedAt: new Date(),
          updatedBy: req.user?.fullname || "الإدارة",
          notes: "تم إنشاء وإرسال أمر التشغيل للمعمل"
        }
      ],
      financials: {
        labCost,
        shippingCost,
        extraCost,
        totalCost,
        isPaidToLab: Boolean(parsedFinancials.isPaidToLab || (paidAmount >= totalCost && totalCost > 0)),
        paidAmount,
        remainingAmount,
        paymentMethod: parsedFinancials.paymentMethod || "cash",
        paidAt: paidAmount > 0 ? new Date() : null
      },
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      notes: notes || ""
    });

    await workOrder.save();

    // Link in order
    order.workOrderId = workOrder._id;
    order.isLabOrder = true;

    // Sync expenses into order if labCost > 0
    if (totalCost > 0) {
      const existingLabExpense = order.expenses?.find(e => e.type === "lab");
      if (existingLabExpense) {
        existingLabExpense.amount = totalCost;
        existingLabExpense.title = `مصاريف معمل: ${lab.name} (أمر #${workOrderNumber})`;
      } else {
        order.expenses = order.expenses || [];
        order.expenses.push({
          title: `مصاريف معمل: ${lab.name} (أمر #${workOrderNumber})`,
          amount: totalCost,
          type: "lab",
          notes: `تكلفة تشغيل #${workOrderNumber}`,
          createdAt: new Date()
        });
      }
      order.totalExpenses = (order.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      order.netProfit = Math.max(0, (order.totalPrice || 0) - order.totalExpenses);
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: `تم تحويل الطلب لمعمل ${lab.name} (أمر تشغيل #${workOrderNumber})`,
      at: new Date(),
      note: notes || ""
    });

    await order.save();

    // Increment lab total orders stat
    lab.stats = lab.stats || {};
    lab.stats.totalOrders = (lab.stats.totalOrders || 0) + 1;
    await lab.save();

    // Audit Log
    logAudit({
      subdomain,
      userId: req.user?._id,
      userName: req.user?.fullname || "الإدارة",
      userRole: req.user?.role || "admin",
      branchId: order.branchId,
      action: "work_order_created",
      actionLabel: "إصدار أمر تشغيل جديد",
      targetType: "work_order",
      targetId: workOrder._id,
      targetCode: workOrderNumber,
      details: `تم إصدار أمر تشغيل #${workOrderNumber} للطلب #${order.orderId} لدى معمل ${lab.name}`,
      metadata: { orderId: order.orderId, labId: lab._id, totalCost }
    });

    res.status(201).json({
      done: true,
      message: `تم إنشاء أمر التشغيل ${workOrderNumber} بنجاح`,
      workOrder
    });
  } catch (err) {
    next(err);
  }
};

exports.updateWorkOrderStage = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const Lab = getLabModel(subdomain);
    const Orders = getOrdersModel(subdomain);
    const { id } = req.params;
    const { stageKey, stageLabel, notes } = req.body;

    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) return res.status(404).json({ error: "أمر التشغيل غير موجود" });

    const lab = await Lab.findById(workOrder.labId);
    const stageObj = lab?.customStages?.find(s => s.key === stageKey);
    const finalLabel = stageLabel || stageObj?.label || stageKey;

    workOrder.currentStage = stageKey;
    workOrder.currentStageLabel = finalLabel;

    const updater = req.user?.fullname || "إدارة المتجر";
    workOrder.stageHistory.push({
      stageKey,
      stageLabel: finalLabel,
      updatedAt: new Date(),
      updatedBy: updater,
      notes: notes || ""
    });

    // Check if stage represents completion / reception back at store
    const isCompletedStage = stageKey === "ready" || stageKey === "delivered" || stageKey === "completed";
    if (isCompletedStage && !workOrder.receivedAt) {
      workOrder.receivedAt = new Date();
      workOrder.status = "completed";
      const sentTime = workOrder.sentAt ? new Date(workOrder.sentAt).getTime() : (workOrder.createdAt ? new Date(workOrder.createdAt).getTime() : Date.now());
      const diffMs = Math.max(0, workOrder.receivedAt.getTime() - sentTime);
      workOrder.turnaroundHours = Math.round((diffMs / 3600000) * 10) / 10;

      // Update lab stats (avgTurnaroundHours & onTimeRate)
      if (lab) {
        lab.stats = lab.stats || {};
        lab.stats.completedOrders = (lab.stats.completedOrders || 0) + 1;
        const currentAvg = lab.stats.avgTurnaroundHours || 24;
        lab.stats.avgTurnaroundHours = Math.round(((currentAvg + workOrder.turnaroundHours) / 2) * 10) / 10;
        await lab.save();
      }
    }

    await workOrder.save();

    // Mirror to order timeline
    const order = await Orders.findOne({ orderId: workOrder.orderId });
    if (order) {
      order.timeline = order.timeline || [];
      order.timeline.push({
        status: `تحديث أمر التشغيل (${workOrder.workOrderNumber}): ${finalLabel}`,
        at: new Date(),
        note: notes || ""
      });
      if (stageKey === "ready" || stageKey === "delivered") {
        order.labStatus = "ready_for_pickup";
      }
      await order.save();
    }

    logAudit({
      subdomain,
      userId: req.user?._id,
      userName: updater,
      userRole: req.user?.role || "admin",
      branchId: workOrder.branchId,
      action: "work_order_stage_updated",
      actionLabel: "تحديث مرحلة أمر التشغيل",
      targetType: "work_order",
      targetId: workOrder._id,
      targetCode: workOrder.workOrderNumber,
      details: `تم تحديث مرحلة أمر التشغيل #${workOrder.workOrderNumber} إلى «${finalLabel}»`,
      metadata: { stageKey, notes }
    });

    res.json({
      done: true,
      message: `تم تحديث حالة أمر التشغيل إلى «${finalLabel}» بنجاح`,
      workOrder
    });
  } catch (err) {
    next(err);
  }
};

exports.updateWorkOrderFinancials = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const Orders = getOrdersModel(subdomain);
    const { id } = req.params;
    const { labCost, shippingCost, extraCost, paidAmount, isPaidToLab, paymentMethod } = req.body;

    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) return res.status(404).json({ error: "أمر التشغيل غير موجود" });

    const f = workOrder.financials || {};
    if (labCost !== undefined) f.labCost = Number(labCost || 0);
    if (shippingCost !== undefined) f.shippingCost = Number(shippingCost || 0);
    if (extraCost !== undefined) f.extraCost = Number(extraCost || 0);
    f.totalCost = (f.labCost || 0) + (f.shippingCost || 0) + (f.extraCost || 0);

    if (paidAmount !== undefined) f.paidAmount = Number(paidAmount || 0);
    f.remainingAmount = Math.max(0, f.totalCost - f.paidAmount);
    f.isPaidToLab = isPaidToLab !== undefined ? Boolean(isPaidToLab) : f.paidAmount >= f.totalCost && f.totalCost > 0;
    if (paymentMethod) f.paymentMethod = paymentMethod;
    if (f.paidAmount > 0 && !f.paidAt) f.paidAt = new Date();

    workOrder.financials = f;
    await workOrder.save();

    // Mirror to order expenses
    const order = await Orders.findOne({ orderId: workOrder.orderId });
    if (order && f.totalCost > 0) {
      order.expenses = order.expenses || [];
      const expIdx = order.expenses.findIndex(e => e.type === "lab");
      const title = `مصاريف معمل: ${workOrder.labName} (أمر #${workOrder.workOrderNumber})`;
      if (expIdx > -1) {
        order.expenses[expIdx].amount = f.totalCost;
        order.expenses[expIdx].title = title;
      } else {
        order.expenses.push({
          title,
          amount: f.totalCost,
          type: "lab",
          notes: `تكلفة تشغيل #${workOrder.workOrderNumber}`,
          createdAt: new Date()
        });
      }
      order.totalExpenses = order.expenses.reduce((s, e) => s + (e.amount || 0), 0);
      order.netProfit = Math.max(0, (order.totalPrice || 0) - order.totalExpenses);
      await order.save();
    }

    res.json({ done: true, message: "تم تحديث مصاريف وتكاليف أمر التشغيل بنجاح", workOrder });
  } catch (err) {
    next(err);
  }
};

exports.rateWorkOrder = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const Lab = getLabModel(subdomain);
    const { id } = req.params;
    const { rating, comment } = req.body;

    const numRating = Math.max(1, Math.min(5, Number(rating || 5)));
    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) return res.status(404).json({ error: "أمر التشغيل غير موجود" });

    workOrder.adminFeedback = {
      rating: numRating,
      comment: (comment || "").trim(),
      ratedAt: new Date(),
      ratedBy: req.user?._id || null
    };
    await workOrder.save();

    // Recompute lab rating
    const LabModel = Lab;
    const allRated = await WorkOrder.find({
      labId: workOrder.labId,
      "adminFeedback.rating": { $ne: null }
    }).select("adminFeedback.rating");

    if (allRated.length > 0) {
      const avg = allRated.reduce((s, w) => s + (w.adminFeedback.rating || 5), 0) / allRated.length;
      await LabModel.findByIdAndUpdate(workOrder.labId, {
        rating: {
          score: Math.round(avg * 10) / 10,
          reviewsCount: allRated.length
        }
      });
    }

    res.json({ done: true, message: "تم حفظ تقييم المعمل وأمر التشغيل بنجاح", workOrder });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. PUBLIC LAB PORTAL & EXTERNAL TRACKING (بوابة المعمل الخارجية بدون تسجيل دخول)
// ==========================================

exports.getPublicWorkOrder = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const Lab = getLabModel(subdomain);
    const { token } = req.params;

    const workOrder = await WorkOrder.findOne({ publicTrackingToken: token }).lean();
    if (!workOrder) return res.status(404).json({ error: "رابط أمر التشغيل غير صالح أو منتهي" });

    const lab = await Lab.findById(workOrder.labId).lean();

    res.json({
      workOrder,
      labStages: lab?.customStages || []
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePublicWorkOrderStage = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const WorkOrder = getWorkOrderModel(subdomain);
    const Lab = getLabModel(subdomain);
    const Orders = getOrdersModel(subdomain);
    const { token } = req.params;
    const { stageKey, stageLabel, notes } = req.body;

    const workOrder = await WorkOrder.findOne({ publicTrackingToken: token });
    if (!workOrder) return res.status(404).json({ error: "رابط أمر التشغيل غير صالح" });

    const lab = await Lab.findById(workOrder.labId);
    const stageObj = lab?.customStages?.find(s => s.key === stageKey);
    const finalLabel = stageLabel || stageObj?.label || stageKey;

    const updater = `فني معمل ${workOrder.labName || ""}`.trim() || "فني المعمل";
    workOrder.currentStage = stageKey;
    workOrder.currentStageLabel = finalLabel;
    workOrder.stageHistory.push({
      stageKey,
      stageLabel: finalLabel,
      updatedAt: new Date(),
      updatedBy: updater,
      notes: notes || "تم التحديث عبر رابط المعمل الذكي"
    });

    const isCompletedStage = stageKey === "ready" || stageKey === "delivered" || stageKey === "completed";
    if (isCompletedStage && !workOrder.receivedAt) {
      workOrder.receivedAt = new Date();
      workOrder.status = "completed";
      const sentTime = workOrder.sentAt ? new Date(workOrder.sentAt).getTime() : (workOrder.createdAt ? new Date(workOrder.createdAt).getTime() : Date.now());
      const diffMs = Math.max(0, workOrder.receivedAt.getTime() - sentTime);
      workOrder.turnaroundHours = Math.round((diffMs / 3600000) * 10) / 10;
    }

    await workOrder.save();

    // Mirror to order timeline
    const order = await Orders.findOne({ orderId: workOrder.orderId });
    if (order) {
      order.timeline = order.timeline || [];
      order.timeline.push({
        status: `المعمل قام بتحديث أمر التشغيل #${workOrder.workOrderNumber}: ${finalLabel}`,
        at: new Date(),
        note: notes || ""
      });
      if (stageKey === "ready" || stageKey === "delivered") {
        order.labStatus = "ready_for_pickup";
      }
      await order.save();
    }

    logAudit({
      subdomain,
      userId: req.user?._id,
      userName: updater,
      userRole: req.user?.role || "admin",
      branchId: workOrder.branchId,
      action: "work_order_stage_updated",
      actionLabel: "تحديث مرحلة أمر التشغيل",
      targetType: "work_order",
      targetId: workOrder._id,
      targetCode: workOrder.workOrderNumber,
      details: `تم تحديث مرحلة أمر التشغيل #${workOrder.workOrderNumber} إلى «${finalLabel}»`,
      metadata: { stageKey, notes }
    });

    res.json({
      done: true,
      message: `تم تحديث المرحلة بنجاح إلى «${finalLabel}»`,
      workOrder
    });
  } catch (err) {
    next(err);
  }
};
