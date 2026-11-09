const getOrdersModel = require("./orderModel");
const getUsersModel = require("../auth/userModel");
const { withTransaction } = require("../../core/transactionHelper");

async function deductItemStockWithMatrix(Products, it, prescriptionSnapshot, session = null) {
  try {
    const product = await Products.findById(it.productId).session(session || undefined);
    if (!product) return;

    const qty = Number(it.quantity || 1);
    product.stockCount = Math.max(0, Number(product.stockCount || 0) - qty);
    product.storeStock = Math.max(0, Number(product.storeStock ?? product.stockCount ?? 0) - qty);
    product.salesCount = Number(product.salesCount || 0) + qty;

    // Deduct exact (SPH x CYL) slot if product is a matrix-managed lens
    if (product.opticsSpecs?.matrixStock) {
      if (it.gridCoords && it.gridCoords.sph) {
        const key = `${it.gridCoords.sph}_${it.gridCoords.cyl || "0.00"}`;
        const count = it.gridCoords.eye === "both" ? 2 : qty;
        if (product.opticsSpecs.matrixStock[key] !== undefined) {
          product.opticsSpecs.matrixStock[key] = Math.max(0, Number(product.opticsSpecs.matrixStock[key] || 0) - count);
        }
      } else if (prescriptionSnapshot || it.lensSpecs) {
        const rx = prescriptionSnapshot || {};
        const sphR = rx.sphR !== undefined ? rx.sphR : (rx.rightEye?.sph ?? it.lensSpecs?.rightEye?.sph);
        const cylR = rx.cylR !== undefined ? rx.cylR : (rx.rightEye?.cyl ?? it.lensSpecs?.rightEye?.cyl ?? "0.00");
        const sphL = rx.sphL !== undefined ? rx.sphL : (rx.leftEye?.sph ?? it.lensSpecs?.leftEye?.sph);
        const cylL = rx.cylL !== undefined ? rx.cylL : (rx.leftEye?.cyl ?? it.lensSpecs?.leftEye?.cyl ?? "0.00");

        if (sphR !== undefined && sphR !== "") {
          const keyR = `${sphR}_${cylR}`;
          if (product.opticsSpecs.matrixStock[keyR] !== undefined) {
            product.opticsSpecs.matrixStock[keyR] = Math.max(0, Number(product.opticsSpecs.matrixStock[keyR] || 0) - 1);
          }
        }
        if (sphL !== undefined && sphL !== "") {
          const keyL = `${sphL}_${cylL}`;
          if (product.opticsSpecs.matrixStock[keyL] !== undefined) {
            product.opticsSpecs.matrixStock[keyL] = Math.max(0, Number(product.opticsSpecs.matrixStock[keyL] || 0) - 1);
          }
        }
      }
      product.markModified("opticsSpecs.matrixStock");
    }

    await product.save({ session: session || undefined });
  } catch (err) {
    console.warn("[STOCK_DEDUCT_ERR]", err.message);
  }
}

exports.listOrders = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const { search = "", status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (search.trim()) {
      query.$or = [
        { orderId: { $regex: search.trim(), $options: "i" } },
        { "customer.name": { $regex: search.trim(), $options: "i" } },
        { "customer.phone": { $regex: search.trim(), $options: "i" } }
      ];
    }
    if (status && status !== "all") {
      query.status = status;
    }
    if (req.query.orderType === "service") {
      query.$or = [{ orderType: "service" }, { hasServices: true }];
    } else if (req.query.orderType === "product") {
      query.orderType = { $nin: ["service", "mixed"] };
      query.hasServices = { $ne: true };
    }

    // Branch scoping: Branch Admin constrained, Super Admin can filter
    if (req.branchFilter && req.branchFilter.branchId) {
      query.branchId = req.branchFilter.branchId;
    } else if (req.query.branchId && req.query.branchId !== "all") {
      query.branchId = req.query.branchId;
    }

    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.max(1, parseInt(limit) || 20);

    const total = await Orders.countDocuments(query);
    const orders = await Orders.find(query)
      .populate("branchId", "name code city isMain")
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    res.json({ done: true, orders, total, page: p, pages: Math.ceil(total / l) || 1 });
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const order = await Orders.findById(req.params.id).populate("branchId", "name code city isMain");
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json({ done: true, order });
  } catch (err) {
    next(err);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const getProductsModel = require("../products/productModel");
    const { recordOrderLifecycleEvents } = require("../activity/activityService");
    const rawStatus = String(req.body?.status || "").trim();
    const note = req.body?.note || "";

    const statusAliasMap = {
      awaiting_pickup: "ready_for_pickup",
      completed: "delivered"
    };
    const status = statusAliasMap[rawStatus] || rawStatus;

    const validStatuses = [
      "new",
      "confirmed",
      "preparing",
      "ready_for_pickup",
      "shipped",
      "delivered",
      "cancelled"
    ];
    if (status === "returned") {
      return res.status(400).json({
        error: "لا يمكن تعيين حالة مرتجع مباشرة من الأوردر. يرجى إدارة المرتجعات والاسترداد المالي للسلع من قسم المرتجعات والاسترداد لضمان دقة المخزون والرد المالي."
      });
    }
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "حالة طلب غير صالحة" });
    }

    const order = await Orders.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    const previousStatus = order.status;
    if (previousStatus === status) {
      return res.json({ done: true, order, unchanged: true, message: "الطلب بالفعل في هذه الحالة" });
    }

    const isPickup =
      order.deliveryMethod === "pickup" ||
      order.shippingSnapshot?.deliveryMethod === "pickup";

    if (isPickup && status === "delivered") {
      if (["cancelled", "returned"].includes(previousStatus)) {
        return res.status(400).json({ error: "لا يمكن إتمام استلام طلب ملغي أو مرتجع" });
      }
      if (previousStatus === "new") {
        return res.status(400).json({
          error:
            "لا يمكن تحويل طلب الاستلام من الفرع إلى مكتمل مباشرة قبل تأكيده وتجهيزه للاستلام (Confirmed → Awaiting Pickup → Completed)"
        });
      }
    }

    order.status = status;
    const now = new Date();
    order.timeline.push({
      status,
      at: now,
      note: note || `تم تغيير حالة الطلب إلى ${status}`
    });

    if (status === "delivered") {
      if (order.payment.method === "cod") {
        order.payment.paid = true;
      }
      if (isPickup) {
        order.pickupCompletedAt = now;
      }
    }

    await order.save();
    try {
      await order.populate("branchId", "name code city isMain");
    } catch (_) {}

    // Restore product stock when an active order is cancelled or returned to sellable inventory
    const returnToSellableInventory = req.body?.returnToSellableInventory !== false;
    if (
      ["cancelled", "returned"].includes(status) &&
      !["cancelled", "returned"].includes(previousStatus) &&
      returnToSellableInventory
    ) {
      try {
        const Products = getProductsModel(req.subdomain);
        for (const item of order.items || []) {
          if (item.productId) {
            const qty = Math.max(1, Number(item.quantity || 1));
            await Products.updateOne(
              { _id: item.productId },
              {
                $inc: {
                  stockCount: qty,
                  salesCount: -qty
                }
              }
            );
          }
        }

        // Phase C: Record idempotent return / cancellation restore movement in inventory ledger
        const { recordOrderReturnOrCancelRestore } = require("../finance/inventory/inventoryService");
        await recordOrderReturnOrCancelRestore(
          req.subdomain,
          {
            order,
            movementType: status === "returned" ? "customer_return" : "order_cancellation_restore",
            returnToSellableInventory: true,
            skipProductStockMutation: true,
            reason: note || (status === "returned" ? "مرتجع عميل للمخزون" : "إلغاء طلب واستعادة المخزون"),
            occurredAt: now
          },
          req.user
        );
      } catch (stockErr) {
        console.warn("[ORDER_STOCK_RESTORE_WARN]", stockErr.message);
      }
    }

    // تسجيل أحداث دورة حياة الطلب في سجل الأنشطة مع منع الازدواجية
    try {
      let targetEventType = null;
      if (status === "delivered") targetEventType = "order_completed";
      else if (status === "cancelled") targetEventType = "order_cancelled";
      else if (status === "returned") targetEventType = "product_returned";

      if (targetEventType) {
        await recordOrderLifecycleEvents(req.subdomain, {
          order,
          eventType: targetEventType,
          occurredAt: now
        });
      }
    } catch (actErr) {
      console.warn("[ACTIVITY_ORDER_STATUS_WARN]", actErr.message);
    }

    res.json({ done: true, order, message: "تم تحديث حالة الطلب بنجاح" });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates an in-store POS / manual sale order.
 * - Saves as completed order (status: "delivered", paid: true, pickup)
 * - Decrements stockCount and increments salesCount
 * - Records inventory consumption in finance ledger (COGS)
 * - Records lifecycle events for commercial analytics & revenue
 */
exports.createPosOrder = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const Orders = getOrdersModel(subdomain);
    const getProductsModel = require("../products/productModel");
    const Products = getProductsModel(subdomain);
    const { getFinanceSettings } = require("../finance/core/settings/financeSettingsService");
    const { recordSaleConsumption } = require("../finance/inventory/inventoryService");
    const { recordOrderLifecycleEvents } = require("../activity/activityService");

    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: "الفاتورة فارغة، يرجى إضافة منتج واحد على الأقل" });
    }

    const financeSettings = await getFinanceSettings(subdomain).catch(() => ({}));
    const currency = financeSettings?.defaultCurrency || "EGP";

    // Validate and build item lines
    const items = [];
    let subtotal = 0;
    let totalCost = 0;

    for (const item of rawItems) {
      const pid = item.productId || item._id;
      if (!pid) continue;

      const product = await Products.findById(pid).lean();
      if (!product) {
        return res.status(404).json({ error: `المنتج غير موجود: ${item.name || pid}` });
      }

      const qty = Math.max(1, Number(item.quantity || 1));
      const unitPrice =
        item.price !== undefined && item.price !== null
          ? Number(item.price)
          : Number(product.price || 0);
      const unitCost = Number(product.costPrice || 0);
      const grossLine = unitPrice * qty;

      subtotal += grossLine;
      totalCost += unitCost * qty;

      items.push({
        productId: String(product._id),
        name: item.name || product.name,
        price: unitPrice,
        costPrice: unitCost,
        quantity: qty,
        image: (product.images && product.images[0]) || product.image || item.image || "",
        warrantyPeriodMonths: Number(product.warrantyPeriodMonths || 0),
        warrantyPolicy: String(product.warrantyPolicy || ""),
        grossLineTotal: grossLine,
        netLineValue: grossLine,
        lineCostTotal: unitCost * qty,
        requiresShipping: false,
        shippingMode: "NONE"
      });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "لم يتم تحديد أي منتجات صالحة للبيع" });
    }

    const discount = Math.max(0, Number(body.discount || 0));
    const total = Math.max(0, subtotal - discount);

    // Customer details & Auto Account Intelligence
    const rawCustomer = body.customer || {};
    const rawPhone = String(rawCustomer.phone || "").trim();
    const cleanPhone = rawPhone.replace(/[\s-]/g, "");
    const customerName = String(rawCustomer.name || "عميل المتجر (مباشر)").trim();
    const customerEmail = String(rawCustomer.email || "").trim();
    const customerAddress = String(rawCustomer.address || "استلام مباشر من الفرع").trim();
    const customerCity = String(rawCustomer.city || "الفرع الرئيسي").trim();

    const { ensureCustomerAccount } = require("../auth/customerAccountUtil");
    let assignedUserId = null;
    let customerAccount = null;

    try {
      const acct = await ensureCustomerAccount(subdomain, {
        phone: rawPhone,
        name: customerName,
        email: customerEmail,
        address: customerAddress,
        city: customerCity
      });
      if (acct.userId) {
        assignedUserId = acct.userId;
        customerAccount = acct;
      }
    } catch (userErr) {
      console.warn("[POS_CUSTOMER_AUTO_ACCOUNT_WARN]", userErr.message);
    }

    const customer = {
      name: customerName,
      phone: rawPhone || "00000000000",
      email: customerEmail || (customerAccount ? customerAccount.email : ""),
      address: customerAddress,
      city: customerCity,
      notes: String(body.notes || rawCustomer.notes || "").trim()
    };

    const isInstallment = body.paymentMethod === "installment";
    const paymentMethod = isInstallment
      ? "installment"
      : ["cash", "card", "wallet"].includes(body.paymentMethod)
      ? body.paymentMethod
      : "cash";

    const now = new Date();
    const orderId = `POS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    let installmentData = null;
    if (isInstallment) {
      const { buildInstallmentSchedule } = require("./installmentService");
      const planInput = body.installmentPlan || {};
      installmentData = buildInstallmentSchedule({
        originalAmount: total,
        months: planInput.months || 6,
        interestRate: planInput.interestRate || 0,
        downPayment: planInput.downPayment || 0,
        startDate: planInput.startDate || now,
        guarantor: planInput.guarantor || {}
      });
    }

    const shippingSnapshot = {
      deliveryMethod: "pickup",
      selectedClassId: null,
      selectedClassCode: "",
      selectedClassName: "مبيعات مباشرة من الفرع (POS)",
      matchMethod: "pos_direct",
      baseShippingAmount: 0,
      additiveShippingAmount: 0,
      customerShippingCharge: 0,
      estimatedCarrierCost: 0,
      actualCarrierCost: 0,
      actualCostStatus: "not_applicable",
      actualCostRecordedAt: now,
      actualCostNote: "فاتورة بيع مباشر من المتجر"
    };

    const financialSnapshot = {
      currency,
      exchangeRate: 1,
      grossMerchandiseSubtotal: subtotal,
      merchandiseGrossSubtotal: subtotal,
      discountTotal: discount,
      orderDiscountTotal: discount,
      netMerchandiseTotal: total,
      merchandiseNetTotal: total,
      productCostTotal: totalCost,
      totalProductCostSnapshot: totalCost,
      customerShippingTotal: 0,
      customerShippingCharge: 0,
      estimatedShippingCostTotal: 0,
      estimatedCarrierCost: 0,
      actualShippingCostTotal: 0,
      actualCarrierCost: 0,
      finalOrderTotal: total,
      estimatedGrossMargin: total - totalCost,
      confirmedGrossMargin: total - totalCost,
      snapshotCreatedAt: now,
      calculatedAt: now
    };

    let branchId = body.branchId || req.user?.branchId || null;
    if (!branchId) {
      try {
        const getBranchModel = require("../branches/branchModel");
        const Branch = getBranchModel(subdomain);
        const mainBranch = await Branch.findOne({ isMain: true }).lean();
        if (mainBranch) branchId = mainBranch._id;
      } catch (brErr) {
        console.warn("[POS_BRANCH_RESOLUTION_WARN]", brErr.message);
      }
    }

    const isLabOrder = Boolean(body.isLabOrder);
    const labDeliveryDate = body.labDeliveryDate ? new Date(body.labDeliveryDate) : null;
    const labNotes = String(body.labNotes || "").trim();
    const rawRx = body.prescriptionSnapshot || {};
    const prescriptionSnapshot = {
      sphR: String(rawRx.sphR ?? rawRx.rightEye?.sph ?? ""),
      cylR: String(rawRx.cylR ?? rawRx.rightEye?.cyl ?? ""),
      axisR: String(rawRx.axisR ?? rawRx.rightEye?.axis ?? ""),
      addR: String(rawRx.addR ?? rawRx.rightEye?.add ?? ""),
      pdR: String(rawRx.pdR ?? rawRx.rightEye?.pd ?? ""),
      sphL: String(rawRx.sphL ?? rawRx.leftEye?.sph ?? ""),
      cylL: String(rawRx.cylL ?? rawRx.leftEye?.cyl ?? ""),
      axisL: String(rawRx.axisL ?? rawRx.leftEye?.axis ?? ""),
      addL: String(rawRx.addL ?? rawRx.leftEye?.add ?? ""),
      pdL: String(rawRx.pdL ?? rawRx.leftEye?.pd ?? ""),
      ipd: String(rawRx.ipd ?? rawRx.pd ?? ""),
      doctorName: String(rawRx.doctorName ?? ""),
      usageType: String(rawRx.usageType ?? rawRx.useType ?? "distance")
    };

    const rawPaidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) : total;
    const previousDepositDeducted = Math.max(0, Number(body.previousDepositDeducted || 0));
    const effectivePaid = Math.min(total, rawPaidAmount + previousDepositDeducted);
    const remainingAmount = Math.max(0, total - effectivePaid);

    const paymentsSnapshot = {
      totalAmount: total,
      paidAmount: effectivePaid,
      remainingAmount,
      previousDepositDeducted,
      paymentMethod
    };

    // Build Optics item details (including frames & lenses specs)
    for (let i = 0; i < items.length; i++) {
      const rawIt = rawItems[i] || {};
      items[i].productType = rawIt.productType || "frame";
      items[i].lensSpecs = rawIt.lensSpecs || {};
      items[i].frameSpecs = rawIt.frameSpecs || {};
      items[i].isRequestedSupply = Boolean(rawIt.isRequestedSupply);
      items[i].supplyStatus = rawIt.isRequestedSupply ? "requested" : "in_stock";
      items[i].supplierId = rawIt.supplierId || null;
      items[i].supplierName = rawIt.supplierName || "";
      items[i].supplierPhone = rawIt.supplierPhone || "";
    }

    const order = new Orders({
      orderId,
      branchId,
      userId: assignedUserId,
      customer,
      items,
      deliveryMethod: "pickup",
      pickupCompletedAt: isLabOrder ? null : now,
      payment: {
        method: isInstallment ? "installment" : (paymentMethod === "cash" ? "cod" : paymentMethod),
        paid: remainingAmount === 0
      },
      installment: installmentData || { isInstallment: false },
      subtotal,
      shipping: 0,
      discount,
      total: isInstallment ? installmentData.plan.totalAmount : total,
      coupon: "",
      shippingSnapshot,
      financialSnapshot,
      isLabOrder,
      labStatus: isLabOrder ? "pending_lab" : "not_applicable",
      labDeliveryDate,
      labNotes,
      prescriptionSnapshot,
      paymentsSnapshot,
      status: isLabOrder ? "preparing" : "delivered",
      timeline: [
        {
          status: isLabOrder ? "preparing" : "delivered",
          at: now,
          note: isLabOrder
            ? `تم تسجيل أمر شغل نظارة طبية للمعمل (تاريخ التسليم: ${labDeliveryDate ? labDeliveryDate.toLocaleDateString("ar-EG") : "قيد التحديد"}) - مدفوع: ${effectivePaid} ج.م، متبقي: ${remainingAmount} ج.م`
            : isInstallment
            ? `تم تسجيل عملية بيع بالتقسيط المباشر مع المحل (${installmentData?.plan?.months} شهر، قسط شهري: ${installmentData?.plan?.monthlyAmount} ج.م، مقدم مدفوع: ${installmentData?.plan?.downPayment} ج.م)`
            : `تم تسجيل عملية بيع فورية وإصدار الفاتورة (${
                paymentMethod === "cash"
                  ? "نقداً"
                  : paymentMethod === "card"
                  ? "بطاقة دفع"
                  : "محفظة إلكترونية"
              })`
        }
      ]
    });

    // Execute Database Mutations within an ACID Transaction Session
    await withTransaction(subdomain, async (session) => {
      // If customer deposit was used, deduct from user's account
      if (assignedUserId && previousDepositDeducted > 0) {
        try {
          const getUsersModel = require("../auth/userModel");
          const Users = getUsersModel(subdomain);
          await Users.updateOne(
            { _id: assignedUserId },
            { $inc: { depositBalance: -previousDepositDeducted } }
          ).session(session || undefined);
        } catch (depErr) {
          console.warn("[CUSTOMER_DEPOSIT_DEDUCT_WARN]", depErr.message);
        }
      }

      await order.save({ session: session || undefined });

      // Stock deduction timing rule:
      // If direct sale (not a lab order), deduct stock immediately within transaction.
      // If lab order, do NOT deduct stock until glasses are completed, remaining balance paid, and delivered to customer!
      if (!isLabOrder) {
        order.stockDeducted = true;
        for (const it of items) {
          await deductItemStockWithMatrix(Products, it, order.prescriptionSnapshot, session);
        }
      } else {
        order.stockDeducted = false;
      }
    });

    try {
      await order.populate("branchId", "name code city isMain");
    } catch (_) {}

    // Record inventory consumption in finance ledger
    try {
      if (order.stockDeducted) {
        await recordSaleConsumption(
          subdomain,
          {
            sourceType: "online_order",
            sourceId: String(order._id),
            sourceReference: order.orderId,
            items: order.items,
            costingPolicy: financeSettings?.costingPolicy || "WAC",
            skipProductStockMutation: true,
            actorId: req.user?._id || null
          }
        );
      }
    } catch (invErr) {
      console.warn("[POS_INVENTORY_CONSUMPTION_WARN]", invErr.message);
    }

    // Audit Logging
    try {
      const { logAudit } = require("../audit/auditService");
      await logAudit({
        subdomain,
        branchId: req.user?.branchId || order.branchId || null,
        userId: req.user?._id,
        userName: req.user?.fullname || req.user?.name || "كاشير الفرع",
        userRole: req.user?.role || "admin",
        action: isInstallment
          ? "pos_installment_order_created"
          : (isLabOrder ? "pos_lab_order_created" : "pos_direct_sale_created"),
        actionLabel: isInstallment
          ? "إصدار فاتورة بيع بالتقسيط المباشر"
          : (isLabOrder ? "تسجيل أمر شغل معمل جديد" : "إصدار فاتورة بيع مباشرة (POS)"),
        targetType: "order",
        targetId: String(order._id),
        targetCode: order.orderId,
        details: isInstallment
          ? `فاتورة بيع بالتقسيط ${order.orderId} للعميل ${customer.name} بإجمالي ${total} ج.م (مقدم: ${installmentData?.plan?.downPayment || 0} ج.م، متبقي: ${installmentData?.summary?.totalRemaining || 0} ج.م على ${installmentData?.plan?.months || 6} شهور)`
          : `فاتورة ${order.orderId} للعميل ${customer.name} بإجمالي ${total} ج.م (مدفوع: ${effectivePaid} ج.م)`,
        metadata: {
          total,
          paidAmount: effectivePaid,
          remainingAmount,
          isLabOrder,
          isInstallment,
          downPayment: installmentData?.plan?.downPayment || 0,
          totalRemaining: installmentData?.summary?.totalRemaining || 0,
          months: installmentData?.plan?.months || 0,
          monthlyAmount: installmentData?.plan?.monthlyAmount || 0,
          customerName: customer.name,
          customerPhone: customer.phone
        }
      });
    } catch (audErr) {
      console.warn("[POS_AUDIT_LOG_WARN]", audErr.message);
    }

    // Record lifecycle events for analytics & dashboard
    try {
      await recordOrderLifecycleEvents(subdomain, {
        order,
        eventType: "order_created",
        occurredAt: now
      });
      await recordOrderLifecycleEvents(subdomain, {
        order,
        eventType: "order_completed",
        occurredAt: now
      });
    } catch (actErr) {
      console.warn("[POS_ACTIVITY_WARN]", actErr.message);
    }

    return res.status(201).json({
      done: true,
      order,
      customerAccount,
      message: customerAccount?.isNew
        ? `تم تسجيل عملية البيع وإنشاء حساب عميل فوري (اسم المستخدم وكلمة المرور: ${customerAccount.phone})`
        : "تم تسجيل عملية البيع وإصدار الفاتورة بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Real-time customer intelligence lookup for POS Cashier
 * Returns customer info, previous order count, total spend, and recent purchases
 */
exports.lookupPosCustomer = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const query = String(req.query.q || req.query.phone || "").trim();
    if (!query) {
      return res.json({ done: true, found: false, customer: null, orders: [], stats: null });
    }

    const Users = getUsersModel(subdomain);
    const Orders = getOrdersModel(subdomain);

    const cleanPhone = query.replace(/[\s-]/g, "");
    const safeRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // Search in Users collection
    let user = await Users.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: query },
        { email: query.toLowerCase() },
        { fullname: safeRegex }
      ]
    }).lean();

    // Query past orders
    const orderQuery = user
      ? { $or: [{ userId: user._id }, { "customer.phone": cleanPhone }, { "customer.phone": query }] }
      : { $or: [{ "customer.phone": cleanPhone }, { "customer.phone": query }, { "customer.name": safeRegex }] };

    const orders = await Orders.find(orderQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const ordersCount = orders.length;
    const totalSpent = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const lastOrder = orders[0] || null;

    let customerInfo = null;
    let age = null;
    let latestPrescription = null;
    let requiresReExam = false;
    let daysSinceLastExam = null;
    let remainingPayable = 0;

    // Calculate remaining payable on active orders
    for (const ord of orders) {
      if (ord.status !== "delivered" && ord.status !== "cancelled") {
        const pays = ord.paymentsSnapshot || {};
        remainingPayable += Number(pays.remainingAmount || 0);
      }
    }

    if (user) {
      if (user.birthDate) {
        const birth = new Date(user.birthDate);
        const diffMs = Date.now() - birth.getTime();
        const ageDate = new Date(diffMs);
        age = Math.abs(ageDate.getUTCFullYear() - 1970);
      }

      // Latest prescription lookup
      const userPrescription = (user.prescriptions && user.prescriptions[0]) || null;
      let orderPrescription = null;
      if (lastOrder && lastOrder.prescriptionSnapshot && (lastOrder.prescriptionSnapshot.sphR || lastOrder.prescriptionSnapshot.rightEye)) {
        orderPrescription = {
          ...lastOrder.prescriptionSnapshot,
          examDate: lastOrder.createdAt,
          source: `طلب سابق: ${lastOrder.orderId}`
        };
      }

      latestPrescription = userPrescription || orderPrescription;

      if (latestPrescription && latestPrescription.examDate) {
        const examTime = new Date(latestPrescription.examDate).getTime();
        daysSinceLastExam = Math.floor((Date.now() - examTime) / (1000 * 60 * 60 * 24));
        if (daysSinceLastExam > 365) {
          requiresReExam = true;
        }
      } else if (user.nextCheckupDate && new Date(user.nextCheckupDate) <= new Date()) {
        requiresReExam = true;
      }

      customerInfo = {
        _id: user._id,
        name: user.fullname,
        phone: user.phone,
        email: user.email,
        address: user.address,
        city: user.city,
        hasAccount: true,
        age,
        birthDate: user.birthDate,
        gender: user.gender,
        depositBalance: user.depositBalance || 0,
        remainingPayable,
        prescriptions: user.prescriptions || [],
        latestPrescription,
        prescriptionImage: latestPrescription?.prescriptionImage || "",
        requiresReExam,
        daysSinceLastExam,
        nextCheckupDate: user.nextCheckupDate
      };
    } else if (lastOrder && lastOrder.customer) {
      if (lastOrder.prescriptionSnapshot && (lastOrder.prescriptionSnapshot.sphR || lastOrder.prescriptionSnapshot.rightEye)) {
        latestPrescription = {
          ...lastOrder.prescriptionSnapshot,
          examDate: lastOrder.createdAt,
          source: `طلب سابق: ${lastOrder.orderId}`
        };
        const examTime = new Date(lastOrder.createdAt).getTime();
        daysSinceLastExam = Math.floor((Date.now() - examTime) / (1000 * 60 * 60 * 24));
        if (daysSinceLastExam > 365) requiresReExam = true;
      }

      customerInfo = {
        _id: null,
        name: lastOrder.customer.name,
        phone: lastOrder.customer.phone,
        email: lastOrder.customer.email,
        address: lastOrder.customer.address,
        city: lastOrder.customer.city,
        hasAccount: false,
        age: null,
        depositBalance: 0,
        remainingPayable,
        prescriptions: latestPrescription ? [latestPrescription] : [],
        latestPrescription,
        prescriptionImage: latestPrescription?.prescriptionImage || "",
        requiresReExam,
        daysSinceLastExam
      };
    }

    return res.json({
      done: true,
      found: Boolean(customerInfo),
      customer: customerInfo,
      stats: customerInfo
        ? {
            ordersCount,
            totalSpent,
            remainingPayable,
            depositBalance: customerInfo.depositBalance || 0,
            lastPurchaseAt: lastOrder ? lastOrder.createdAt : null
          }
        : null,
      recentOrders: orders.map((o) => ({
        orderId: o.orderId,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        itemsCount: (o.items || []).length
      }))
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================================================
// DIRECT IN-STORE INSTALLMENTS CONTROLLERS (التقسيط المباشر مع المحل)
// ==========================================================================

exports.getInstallmentsOverview = async (req, res, next) => {
  try {
    const { getInstallmentsOverview } = require("./installmentService");
    const result = await getInstallmentsOverview(req.subdomain, req.query, req.user);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getInstallmentDetails = async (req, res, next) => {
  try {
    const { getInstallmentDetails } = require("./installmentService");
    const order = await getInstallmentDetails(req.subdomain, req.params.orderId, req.user);
    res.json({ done: true, order });
  } catch (err) {
    next(err);
  }
};

exports.recordInstallmentPayment = async (req, res, next) => {
  try {
    const { recordInstallmentPayment } = require("./installmentService");
    const result = await recordInstallmentPayment(req.subdomain, req.params.orderId, req.body, req.user);
    res.json({ done: true, message: "تم تسجيل قسط بنجاح وتحديث الحسابات والمتبقي", ...result });
  } catch (err) {
    next(err);
  }
};

exports.updateInstallmentStatus = async (req, res, next) => {
  try {
    const { updateInstallmentStatus } = require("./installmentService");
    const order = await updateInstallmentStatus(req.subdomain, req.params.orderId, req.body.status, req.body.notes, req.user);
    res.json({ done: true, message: "تم تحديث حالة التقسيط بنجاح", order });
  } catch (err) {
    next(err);
  }
};

exports.getFinanceInstallmentsSummary = async (req, res, next) => {
  try {
    const { getFinanceInstallmentsSummary } = require("./installmentService");
    const branchId = req.user?.role !== 5 && req.user?.branchId ? req.user.branchId : req.query.branchId;
    const summary = await getFinanceInstallmentsSummary(req.subdomain, branchId);
    res.json({ done: true, ...summary });
  } catch (err) {
    next(err);
  }
};

exports.generateInstallmentContract = async (req, res, next) => {
  try {
    const { generateInstallmentContract } = require("./installmentContractEngine");
    const result = await generateInstallmentContract(req.subdomain, req.params.orderId, req.body.customTemplate);
    res.json({ done: true, message: "تم توليد صياغة العقد الرسمي بنجاح", ...result });
  } catch (err) {
    next(err);
  }
};

exports.saveInstallmentContractText = async (req, res, next) => {
  try {
    const { saveInstallmentContractText } = require("./installmentService");
    const order = await saveInstallmentContractText(req.subdomain, req.params.orderId, req.body.contractText, req.user);
    res.json({ done: true, message: "تم حفظ نص العقد المعدل بنجاح", order });
  } catch (err) {
    next(err);
  }
};

exports.getInstallmentContractTemplate = async (req, res, next) => {
  try {
    const { getContractTemplate } = require("./installmentContractEngine");
    const template = await getContractTemplate(req.subdomain);
    res.json({ done: true, template });
  } catch (err) {
    next(err);
  }
};

exports.updateInstallmentContractTemplate = async (req, res, next) => {
  try {
    const { updateContractTemplate } = require("./installmentContractEngine");
    const result = await updateContractTemplate(req.subdomain, req.body.template);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.addInstallmentDocument = async (req, res, next) => {
  try {
    const { addInstallmentDocument } = require("./installmentService");
    const result = await addInstallmentDocument(req.subdomain, req.params.orderId, req.body, req.user);
    res.json({ done: true, message: "تم إرفاق المستند بنجاح في ملف التقسيط", ...result });
  } catch (err) {
    next(err);
  }
};

exports.removeInstallmentDocument = async (req, res, next) => {
  try {
    const { removeInstallmentDocument } = require("./installmentService");
    const result = await removeInstallmentDocument(req.subdomain, req.params.orderId, req.params.docId, req.user);
    res.json({ done: true, message: "تم حذف المستند من ملف التقسيط", ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Record Customer Cash Deposit (دفعة تحت الحساب بدون فاتورة ولا حجز بضاعة)
 */
exports.recordCustomerDeposit = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params; // customer ID
    const { amount, paymentMethod = "cash", notes = "" } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: "المبلغ المدفوع يجب أن يكون أكبر من صفر" });
    }

    const getUsersModel = require("../auth/userModel");
    const Users = getUsersModel(subdomain);
    const user = await Users.findById(id);
    if (!user) {
      return res.status(404).json({ error: "العميل غير موجود" });
    }

    // Increase customer deposit balance
    user.depositBalance = (user.depositBalance || 0) + numAmount;
    await user.save();

    const voucherNumber = `DEP-${Date.now().toString().slice(-6)}`;
    const now = new Date();

    // Record cash-in entry in finance box / ledger
    try {
      const getPaymentModel = require("../finance/core/payments/paymentModel");
      const Payment = getPaymentModel(subdomain);
      await new Payment({
        paymentReference: voucherNumber,
        entityType: "order_settlement",
        entityId: user._id,
        entityReferenceCode: `DEP-${user.phone || user.fullname}`,
        direction: "inflow",
        entryType: "full_settlement",
        amount: numAmount,
        currency: "EGP",
        paymentMethod: paymentMethod || "cash",
        notes: `دفعة نقدية تحت الحساب للعميل: ${user.fullname} (${notes || "إيصال استلام نقدية"})`,
        recordedBy: req.user?._id || null,
        status: "cleared"
      }).save();
    } catch (finErr) {
      console.warn("[FINANCE_DEPOSIT_ENTRY_WARN]", finErr.message);
    }

    // Automatic Audit Logging
    try {
      const { logAudit } = require("../audit/auditService");
      await logAudit({
        subdomain,
        userId: req.user?._id || null,
        userName: req.user?.fullname || req.user?.name || "أمين الخزينة",
        userRole: req.user?.role || "cashier",
        branchId: req.user?.branchId || null,
        action: "customer_deposit_recorded",
        actionLabel: "تسجيل دفعة تحت الحساب",
        targetType: "customer",
        targetId: String(user._id),
        targetCode: voucherNumber,
        details: `تحصيل مبلغ ${numAmount} ج.م نقدية تحت الحساب (أمانة عميل) للعميل ${user.fullname} - سند قبض #${voucherNumber}`,
        metadata: {
          customerId: String(user._id),
          customerName: user.fullname,
          amount: numAmount,
          depositBalance: user.depositBalance,
          voucherNumber,
          paymentMethod,
          notes
        }
      });
    } catch (auditErr) {
      console.warn("[AUDIT_DEPOSIT_WARN]", auditErr.message);
    }

    res.status(201).json({
      done: true,
      message: `تم تسجيل مبلغ ${numAmount} ج.م دفعة نقدية تحت الحساب بنجاح وإيداعه في الصندوق`,
      voucher: {
        voucherNumber,
        date: now,
        customerName: user.fullname,
        customerPhone: user.phone,
        amount: numAmount,
        depositBalance: user.depositBalance,
        paymentMethod,
        notes
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Update Lab Order Status & Collect Remaining Balance upon delivery
 */
exports.updateLabOrderStatus = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { id } = req.params;
    const { labStatus, remainingPaymentCollected = 0, notes = "", labWorkshopCost = null } = req.body;

    const Orders = getOrdersModel(subdomain);
    const order = await Orders.findById(id);
    if (!order) {
      return res.status(404).json({ error: "الطلب أو أمر الشغل غير موجود" });
    }

    const now = new Date();
    if (labStatus) {
      order.labStatus = labStatus;
    }

    if (labWorkshopCost !== null && labWorkshopCost !== undefined) {
      order.labWorkshopCost = Number(labWorkshopCost) || 0;
      order.labWorkshopNotes = notes || "تكلفة ورشة قص وتجهيز العدسات";
    }

    const extraPaid = Number(remainingPaymentCollected) || 0;
    if (extraPaid > 0) {
      if (!order.paymentsSnapshot) {
        order.paymentsSnapshot = {
          totalAmount: order.total,
          paidAmount: 0,
          remainingAmount: order.total
        };
      }
      order.paymentsSnapshot.paidAmount += extraPaid;
      order.paymentsSnapshot.remainingAmount = Math.max(0, order.paymentsSnapshot.totalAmount - order.paymentsSnapshot.paidAmount);
      if (order.paymentsSnapshot.remainingAmount === 0) {
        order.payment.paid = true;
      }
    }

    if (labStatus === "delivered" || order.paymentsSnapshot?.remainingAmount === 0) {
      order.status = "delivered";
      order.pickupCompletedAt = now;
    } else if (labStatus === "ready") {
      order.status = "ready_for_pickup";
    }

    // Stock deduction upon delivery (if not already deducted)
    let stockWasDeductedNow = false;
    if (order.status === "delivered" && !order.stockDeducted) {
      const getProductsModel = require("../products/productModel");
      const Products = getProductsModel(subdomain);
      for (const it of order.items || []) {
        if (it.productId) {
          await deductItemStockWithMatrix(Products, it, order.prescriptionSnapshot);
        }
      }
      order.stockDeducted = true;
      stockWasDeductedNow = true;
    }

    order.timeline.push({
      status: labStatus || order.status,
      at: now,
      note: `تحديث أمر المعمل إلى (${labStatus}) ${extraPaid > 0 ? `- تم تحصيل متبقي: ${extraPaid} ج.م` : ""} ${stockWasDeductedNow ? " (تم خصم البضاعة من المخزن للتسليم)" : ""} ${notes ? `(${notes})` : ""}`
    });

    await order.save();

    // Audit Log
    try {
      const { logAudit } = require("../audit/auditService");
      await logAudit({
        subdomain,
        branchId: req.user?.branchId || order.branchId || null,
        userId: req.user?._id,
        userName: req.user?.fullname || req.user?.name || "مسؤول المعمل",
        userRole: req.user?.role || "admin",
        action: "order_lab_status_updated",
        actionLabel: "تحديث حالة أمر المعمل والتسليم",
        targetType: "order",
        targetId: String(order._id),
        targetCode: order.orderId,
        details: `أمر الشغل ${order.orderId} أصبح بحالة (${labStatus})${extraPaid > 0 ? ` مع تحصيل ${extraPaid} ج.م` : ""}${stockWasDeductedNow ? " وخصم المخزون" : ""}`,
        metadata: { labStatus, extraPaid, stockDeducted: order.stockDeducted, labWorkshopCost: order.labWorkshopCost }
      });
    } catch (_) {}

    res.json({
      done: true,
      message: "تم تحديث حالة أمر الشغل بنجاح",
      order
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: List Supplies Requested (الأصناف المطلوب توريدها من فواتير البيع المعلقة)
 */
exports.listSuppliesRequested = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const Orders = getOrdersModel(subdomain);
    const statusFilter = req.query.status || "pending"; // 'pending' | 'arrived' | 'all'

    const ordersWithSupplies = await Orders.find({
      "items.isRequestedSupply": true
    })
      .sort({ createdAt: -1 })
      .lean();

    const supplyRows = [];
    for (const ord of ordersWithSupplies) {
      for (const item of ord.items || []) {
        if (item.isRequestedSupply) {
          const itemStatus = item.supplyStatus || "requested";
          if (statusFilter === "pending" && itemStatus === "arrived") continue;
          if (statusFilter === "arrived" && itemStatus !== "arrived") continue;

          supplyRows.push({
            orderId: ord.orderId,
            orderDbId: ord._id,
            createdAt: ord.createdAt,
            customerName: ord.customer?.name || "",
            customerPhone: ord.customer?.phone || "",
            userId: ord.userId || null,
            productId: item.productId,
            itemName: item.name,
            quantity: item.quantity,
            lensSpecs: item.lensSpecs,
            frameSpecs: item.frameSpecs,
            supplierId: item.supplierId,
            supplierName: item.supplierName,
            supplierPhone: item.supplierPhone,
            supplyStatus: itemStatus
          });
        }
      }
    }

    res.json({
      done: true,
      count: supplyRows.length,
      supplies: supplyRows
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics: Update Supply Item Status (e.g. requested -> ordered -> arrived)
 */
exports.updateSupplyItemStatus = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { orderId } = req.params;
    const { productId, sph, cyl, status } = req.body;

    const Orders = getOrdersModel(subdomain);
    const mongoose = require("mongoose");
    const order = await Orders.findOne({
      $or: [
        { orderId },
        { _id: mongoose.isValidObjectId(orderId) ? new mongoose.Types.ObjectId(orderId) : null }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    let itemUpdated = false;
    for (const item of order.items || []) {
      if (item.productId === productId || String(item._id) === productId || item.name === productId) {
        if (sph && item.lensSpecs?.sph && item.lensSpecs.sph !== sph) continue;
        if (cyl && item.lensSpecs?.cyl && item.lensSpecs.cyl !== cyl) continue;
        item.supplyStatus = status || "arrived";
        itemUpdated = true;
        break;
      }
    }

    if (!itemUpdated && order.items.length > 0) {
      const reqItem = order.items.find((it) => it.isRequestedSupply);
      if (reqItem) {
        reqItem.supplyStatus = status || "arrived";
        itemUpdated = true;
      }
    }

    await order.save();

    res.json({
      done: true,
      message: status === "arrived" ? "تم تأكيد وصول الصنف وجاهزيته بنجاح" : "تم تحديث حالة التوريد بنجاح",
      order
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics / General: Add an expense to an order (مصاريف إضافية / ورشة / شحن)
 */
exports.addOrderExpense = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { orderId } = req.params;
    const { title, amount, type, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "عنوان المصروف مطلوب" });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "قيمة المصروف يجب أن تكون أكبر من صفر" });
    }

    const Orders = getOrdersModel(subdomain);
    const mongoose = require("mongoose");
    const order = await Orders.findOne({
      $or: [
        { orderId },
        { _id: mongoose.isValidObjectId(orderId) ? new mongoose.Types.ObjectId(orderId) : null }
      ]
    });

    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    order.expenses = order.expenses || [];
    order.expenses.push({
      title: title.trim(),
      amount: numAmount,
      type: type || "lab",
      notes: (notes || "").trim(),
      createdAt: new Date()
    });

    order.totalExpenses = order.expenses.reduce((s, e) => s + (e.amount || 0), 0);
    order.netProfit = Math.max(0, (order.totalPrice || 0) - order.totalExpenses);

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: `إضافة مصروف (${title.trim()}): ${numAmount} ج.م`,
      at: new Date(),
      note: notes || ""
    });

    await order.save();

    res.json({
      done: true,
      message: "تم تسجيل المصروف بنجاح واحتسابه في موازنة وصافي ربح الطلب",
      order
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Optics / General: Delete an expense from order
 */
exports.deleteOrderExpense = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { orderId, expenseId } = req.params;

    const Orders = getOrdersModel(subdomain);
    const mongoose = require("mongoose");
    const order = await Orders.findOne({
      $or: [
        { orderId },
        { _id: mongoose.isValidObjectId(orderId) ? new mongoose.Types.ObjectId(orderId) : null }
      ]
    });

    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    order.expenses = (order.expenses || []).filter(e => String(e._id) !== expenseId);
    order.totalExpenses = order.expenses.reduce((s, e) => s + (e.amount || 0), 0);
    order.netProfit = Math.max(0, (order.totalPrice || 0) - order.totalExpenses);

    await order.save();

    res.json({
      done: true,
      message: "تم حذف المصروف بنجاح وتحديث الموازنة",
      order
    });
  } catch (err) {
    next(err);
  }
};


