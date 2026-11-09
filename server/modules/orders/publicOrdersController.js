const mongoose = require("mongoose");
const getOrdersModel = require("./orderModel");
const getProductsModel = require("../products/productModel");
const getCouponsModel = require("../coupons/couponModel");
const { validateCoupon } = require("../coupons/couponsController");
const { recordOrderLifecycleEvents, extractActorContext } = require("../activity/activityService");
const { calculateOrderShippingAuthoritative } = require("../finance/shipping/shippingCalculatorService");
const { getFinanceSettings } = require("../finance/core/settings/financeSettingsService");
const { roundMoney } = require("../finance/shared/validators");

function generateOrderId() {
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${ts}${rnd}`;
}

function buildOrderSnapshots({
  calcResult,
  discount = 0,
  deliveryMethod = "delivery",
  currency = "EGP"
}) {
  const subtotal = roundMoney(calcResult.merchandiseSubtotal || 0);
  const safeDiscount = roundMoney(Math.min(subtotal, Math.max(0, Number(discount || 0))));
  const rawLines = Array.isArray(calcResult.lines) ? calcResult.lines : [];

  let allocatedDiscountRunning = 0;
  const items = rawLines.map((line, index) => {
    const qty = Math.max(1, Number(line.quantity || 1));
    const price = roundMoney(line.price || 0);
    const costPrice = roundMoney(line.costPrice || 0);
    const oldPrice = roundMoney(line.oldPrice || 0);
    const unitDiscount = oldPrice > price ? roundMoney(oldPrice - price) : 0;
    const grossLineTotal = roundMoney(price * qty);

    let allocatedOrderDiscount = 0;
    if (safeDiscount > 0 && subtotal > 0) {
      if (index === rawLines.length - 1) {
        allocatedOrderDiscount = roundMoney(Math.max(0, safeDiscount - allocatedDiscountRunning));
      } else {
        allocatedOrderDiscount = roundMoney((grossLineTotal / subtotal) * safeDiscount);
        allocatedDiscountRunning = roundMoney(allocatedDiscountRunning + allocatedOrderDiscount);
      }
    }

    const netLineValue = roundMoney(Math.max(0, grossLineTotal - allocatedOrderDiscount));
    const lineCostTotal = roundMoney(costPrice * qty);

    return {
      productId: String(line.productId),
      name: line.name,
      price,
      costPrice,
      oldPrice,
      unitDiscount,
      allocatedOrderDiscount,
      grossLineTotal,
      netLineValue,
      lineCostTotal,
      quantity: qty,
      image: line.image || "",
      warrantyPeriodMonths: Number(line.productDoc?.warrantyPeriodMonths || line.warrantyPeriodMonths || 0),
      warrantyPolicy: String(line.productDoc?.warrantyPolicy || line.warrantyPolicy || ""),
      isService: Boolean(line.isService || line.productDoc?.categoryId?.type === "service"),
      categoryType: line.categoryType || line.productDoc?.categoryId?.type || "product",
      requiresShipping: line.requiresShipping !== false && line.categoryType !== "service",
      shippingClassId: line.shippingClassId || null,
      shippingClassCode: line.shippingClassCode || "",
      shippingClassName: line.shippingClassName || "",
      shippingMode: line.shippingMode || "MAX",
      unitCustomerShipping: roundMoney(line.unitCustomerShipping || 0),
      lineCustomerShipping: roundMoney(line.lineCustomerShipping || 0),
      unitEstimatedCarrierCost: roundMoney(line.unitEstimatedCarrierCost || 0),
      lineEstimatedCarrierCost: roundMoney(line.lineEstimatedCarrierCost || 0),
      isShippingBaseLine: Boolean(line.isShippingBaseLine)
    };
  });

  const shipping = roundMoney(calcResult.customerShippingCharge || 0);
  const netMerchandiseTotal = roundMoney(Math.max(0, subtotal - safeDiscount));
  const total = roundMoney(Math.max(0, netMerchandiseTotal + shipping));
  const productCostTotal = roundMoney(items.reduce((acc, it) => acc + (it.lineCostTotal || 0), 0));
  const estimatedCarrierCost = roundMoney(calcResult.estimatedCarrierCost || 0);

  const isPickup = deliveryMethod === "pickup";
  const shippingSnapshot = {
    deliveryMethod: isPickup ? "pickup" : "delivery",
    selectedClassId: isPickup ? null : calcResult.selectedClassId || null,
    selectedClassCode: isPickup ? "" : calcResult.selectedClassCode || "",
    selectedClassName: isPickup ? "استلام من الفرع (Pickup)" : calcResult.selectedClassName || "",
    matchMethod: isPickup ? "pickup" : calcResult.matchMethod || "default_fallback",
    baseShippingAmount: isPickup ? 0 : roundMoney(calcResult.baseShippingAmount || 0),
    additiveShippingAmount: isPickup ? 0 : roundMoney(calcResult.additiveShippingAmount || 0),
    customerShippingCharge: isPickup ? 0 : shipping,
    estimatedCarrierCost: isPickup ? 0 : estimatedCarrierCost,
    actualCarrierCost: isPickup ? 0 : null,
    actualCostStatus: isPickup ? "not_applicable" : "unknown",
    actualCostRecordedAt: isPickup ? new Date() : null,
    actualCostRecordedBy: null,
    actualCostNote: ""
  };

  const effectiveShipCust = isPickup ? 0 : shipping;
  const effectiveShipEst = isPickup ? 0 : estimatedCarrierCost;
  const estimatedGrossMargin = roundMoney(
    netMerchandiseTotal - productCostTotal + (effectiveShipCust - effectiveShipEst)
  );

  const financialSnapshot = {
    currency: currency || "EGP",
    exchangeRate: 1,
    grossMerchandiseSubtotal: subtotal,
    merchandiseGrossSubtotal: subtotal,
    discountTotal: safeDiscount,
    orderDiscountTotal: safeDiscount,
    netMerchandiseTotal,
    merchandiseNetTotal: netMerchandiseTotal,
    productCostTotal,
    totalProductCostSnapshot: productCostTotal,
    customerShippingTotal: effectiveShipCust,
    customerShippingCharge: effectiveShipCust,
    estimatedShippingCostTotal: effectiveShipEst,
    estimatedCarrierCost: effectiveShipEst,
    actualShippingCostTotal: isPickup ? 0 : null,
    actualCarrierCost: isPickup ? 0 : null,
    finalOrderTotal: total,
    estimatedGrossMargin,
    confirmedGrossMargin: isPickup ? roundMoney(netMerchandiseTotal - productCostTotal) : null,
    snapshotCreatedAt: new Date(),
    calculatedAt: new Date()
  };

  return {
    items,
    subtotal,
    shipping: isPickup ? 0 : shipping,
    discount: safeDiscount,
    total,
    shippingSnapshot,
    financialSnapshot
  };
}

exports.createOrder = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);
    const body = req.body || {};

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: "السلة فارغة، يرجى إضافة منتج واحد على الأقل" });
    }

    const deliveryMethod = body.deliveryMethod === "pickup" ? "pickup" : "delivery";
    const financeSettings = await getFinanceSettings(req.subdomain);

    if (deliveryMethod === "pickup" && financeSettings?.pickup?.enabled === false) {
      return res.status(400).json({ error: "خيار الاستلام من الفرع غير مفعل حالياً" });
    }

    const rawCustomer = body.customer || {};
    const customer = {
      name: String(rawCustomer.name || "").trim(),
      phone: String(rawCustomer.phone || "").trim(),
      address: String(rawCustomer.address || "").trim(),
      city: String(rawCustomer.city || "").trim(),
      notes: String(rawCustomer.notes || "").trim()
    };

    if (!customer.name || !customer.phone) {
      return res.status(400).json({ error: "الاسم ورقم الهاتف حقول مطلوبة لإتمام الطلب" });
    }

    if (deliveryMethod === "delivery" && !customer.address) {
      return res.status(400).json({ error: "الاسم ورقم الهاتف والعنوان حقول مطلوبة لإتمام الطلب" });
    }

    if (deliveryMethod === "pickup" && !customer.address) {
      customer.address =
        financeSettings?.pickup?.branchAddress ||
        financeSettings?.pickup?.branchName ||
        "استلام من الفرع (Pickup)";
    }

    // Verify products exist in DB before running authoritative calculation
    const validRawItems = [];
    const addedServiceIds = new Set();
    for (const it of rawItems) {
      const targetProdId = it.productId || it._id;
      if (!targetProdId || !mongoose.isValidObjectId(targetProdId)) continue;
      const prod = await Products.findById(targetProdId).populate("categoryId").lean();
      if (!prod) continue;
      const isService = prod.categoryId?.type === "service";
      const prodIdStr = String(prod._id);
      if (isService) {
        if (addedServiceIds.has(prodIdStr)) continue; // enforce single service per order
        addedServiceIds.add(prodIdStr);
      }
      validRawItems.push({
        productId: prodIdStr,
        quantity: isService ? 1 : Math.max(1, Number(it.quantity || 1)),
        productDoc: prod,
        isService,
        categoryType: prod.categoryId?.type || "product"
      });
    }

    if (validRawItems.length === 0) {
      return res.status(400).json({ error: "المنتجات المحددة غير متوفرة حالياً" });
    }

    // Authoritative server-side shipping & line calculation (never trusts client-submitted shipping)
    const calcResult = await calculateOrderShippingAuthoritative(req.subdomain, {
      items: validRawItems,
      deliveryMethod,
      address: customer.address,
      city: customer.city,
      selectedShippingClassId: body.selectedShippingClassId || body.shippingClassId || null,
      selectedShippingClassCode: body.selectedShippingClassCode || body.shippingClassCode || null,
      requireValidClassWhenConfigured: true,
      addQuantityBehavior: financeSettings?.shippingConfig?.addQuantityBehavior || "per_line",
      respectFreeShippingThreshold: Boolean(financeSettings?.shippingConfig?.respectFreeShippingThreshold),
      freeShippingThreshold: Number(req.adminData?.freeShippingOver || 0),
      fallbackShippingCost: Number(req.adminData?.shippingCost ?? 50),
      adminData: req.adminData
    });

    const prelimSubtotal = calcResult.merchandiseSubtotal;
    let rawDiscount = 0;
    const couponCode = (body.couponCode || body.coupon || "").toUpperCase().trim();

    if (couponCode) {
      const couponRes = await validateCoupon(req.subdomain, couponCode, prelimSubtotal);
      if (couponRes.valid) {
        rawDiscount = couponRes.discountAmount;
        const Coupons = getCouponsModel(req.subdomain);
        await Coupons.updateOne({ _id: couponRes.coupon._id }, { $inc: { usedCount: 1 } });
      }
    }

    const currency = financeSettings?.defaultCurrency || req.adminData?.currency || "EGP";
    const {
      items,
      subtotal,
      shipping,
      discount,
      total,
      shippingSnapshot,
      financialSnapshot
    } = buildOrderSnapshots({
      calcResult,
      discount: rawDiscount,
      deliveryMethod,
      currency
    });

    const rawMethod = body.paymentMethod || body.payment?.method;
    const method = ["card", "wallet", "kiosk"].includes(rawMethod) ? rawMethod : "cod";
    const actor = extractActorContext(req);
    const userId = actor.userId;

    // Optional merge only when explicitly requested via body.mergeWithActiveNewOrder === true
    let order = null;
    if (body.mergeWithActiveNewOrder === true) {
      const matchFilter = userId
        ? { userId, status: "new", deliveryMethod }
        : { "customer.phone": customer.phone, status: "new", deliveryMethod };
      order = await Orders.findOne(matchFilter).sort({ createdAt: -1 });
    }

    if (order) {
      const combinedInputs = [...(order.items || [])].map((m) => ({
        productId: String(m.productId),
        quantity: Number(m.quantity || 1)
      }));
      validRawItems.forEach((inc) => {
        const found = combinedInputs.find((m) => m.productId === inc.productId);
        if (found) found.quantity += inc.quantity;
        else combinedInputs.push({ productId: inc.productId, quantity: inc.quantity });
      });

      const mergedCalc = await calculateOrderShippingAuthoritative(req.subdomain, {
        items: combinedInputs,
        deliveryMethod,
        address: customer.address,
        city: customer.city,
        selectedShippingClassId: body.selectedShippingClassId || body.shippingClassId || null,
        selectedShippingClassCode: body.selectedShippingClassCode || body.shippingClassCode || null,
        requireValidClassWhenConfigured: true,
        addQuantityBehavior: financeSettings?.shippingConfig?.addQuantityBehavior || "per_line",
        respectFreeShippingThreshold: Boolean(financeSettings?.shippingConfig?.respectFreeShippingThreshold),
        freeShippingThreshold: Number(req.adminData?.freeShippingOver || 0),
        fallbackShippingCost: Number(req.adminData?.shippingCost ?? 50),
        adminData: req.adminData
      });

      const mergedSnap = buildOrderSnapshots({
        calcResult: mergedCalc,
        discount: order.discount + discount,
        deliveryMethod,
        currency
      });

      order.items = mergedSnap.items;
      order.subtotal = mergedSnap.subtotal;
      order.shipping = mergedSnap.shipping;
      order.discount = mergedSnap.discount;
      order.total = mergedSnap.total;
      order.deliveryMethod = deliveryMethod;
      order.shippingSnapshot = mergedSnap.shippingSnapshot;
      order.financialSnapshot = mergedSnap.financialSnapshot;
      order.customer = customer;
      if (actor.visitorId && !order.visitorId) order.visitorId = actor.visitorId;
      if (actor.sessionId && !order.sessionId) order.sessionId = actor.sessionId;
      if (actor.cartId && !order.cartId) order.cartId = actor.cartId;
      order.payment = { method, paid: false };
      order.timeline.push({ status: "merged", at: new Date(), note: "تم إضافة منتجات إضافية وتحديث الطلب" });

      await order.save();

      for (const it of items) {
        await Products.updateOne(
          { _id: it.productId },
          {
            $inc: {
              stockCount: -it.quantity,
              salesCount: it.quantity
            }
          }
        );
      }
      try {
        await recordOrderLifecycleEvents(req.subdomain, {
          order,
          eventType: "order_created",
          actor
        });
      } catch (actErr) {
        console.warn("[ACTIVITY_ORDER_MERGE_WARN]", actErr.message);
      }

      return res.json({ done: true, order, merged: true, message: "تم تحديث ودمج طلبك بنجاح" });
    }

    // Detect services in order
    const hasServices = items.some((it) => it.isService);
    const allServices = items.length > 0 && items.every((it) => it.isService);
    const orderType = allServices ? "service" : hasServices ? "mixed" : "product";

    // Create a new order with immutable historical snapshots
    let resolvedBranchId = body.branchId || null;
    try {
      const { ensureDefaultBranch } = require("../branches/branchService");
      const defBranch = await ensureDefaultBranch(req.subdomain);
      if (!resolvedBranchId && defBranch) {
        resolvedBranchId = defBranch._id;
      }
    } catch (e) {
      // fallback
    }

    order = await new Orders({
      orderId: generateOrderId(),
      branchId: resolvedBranchId,
      userId,
      visitorId: actor.visitorId || "",
      sessionId: actor.sessionId || body.sessionId || "",
      cartId: actor.cartId || body.cartId || "",
      customer,
      items,
      orderType,
      hasServices,
      payment: { method, paid: false },
      deliveryMethod,
      subtotal,
      shipping,
      discount,
      total,
      coupon: couponCode,
      shippingSnapshot,
      financialSnapshot,
      status: "new",
      timeline: [
        {
          status: "new",
          at: new Date(),
          note:
            orderType === "service"
              ? "تم تسجيل حجز الخدمة بنجاح وهو في انتظار تأكيد موعد الزيارة"
              : deliveryMethod === "pickup"
              ? "تم إنشاء طلب استلام من الفرع (Pickup) وهو في انتظار التأكيد"
              : "تم إنشاء الطلب بنجاح وهو في انتظار التأكيد"
        }
      ]
    }).save();

    for (const it of items) {
      const incUpdate = { salesCount: it.quantity };
      if (!it.isService) {
        incUpdate.stockCount = -it.quantity;
      }
      await Products.updateOne({ _id: it.productId }, { $inc: incUpdate });
    }

    // Phase C: Record idempotent customer_sale inventory movements & apply active costing policy (WAC / FIFO)
    try {
      const { recordSaleConsumption } = require("../finance/inventory/inventoryService");
      const cogsRes = await recordSaleConsumption(
        req.subdomain,
        {
          sourceType: "online_order",
          sourceId: String(order._id),
          sourceReference: order.orderId,
          items: order.items,
          skipProductStockMutation: true,
          occurredAt: order.createdAt || new Date()
        },
        null
      );

      if (cogsRes && cogsRes.itemsCostMap) {
        let updatedCostTotal = 0;
        let costModified = false;
        for (const item of order.items) {
          const entry = cogsRes.itemsCostMap[String(item.productId)];
          if (entry && Number.isFinite(entry.unitCost)) {
            if (item.costPrice !== entry.unitCost || item.lineCostTotal !== entry.lineCostTotal) {
              item.costPrice = entry.unitCost;
              item.lineCostTotal = entry.lineCostTotal;
              costModified = true;
            }
          }
          updatedCostTotal += Number(item.lineCostTotal || 0);
        }
        if (costModified) {
          const cleanCostTotal = Math.round(updatedCostTotal * 100) / 100;
          order.financialSnapshot.productCostTotal = cleanCostTotal;
          order.financialSnapshot.totalProductCostSnapshot = cleanCostTotal;
          const netMerch = Number(order.financialSnapshot.netMerchandiseTotal || 0);
          const custShip = Number(order.financialSnapshot.customerShippingTotal || 0);
          const estShip = Number(order.financialSnapshot.estimatedShippingCostTotal || 0);
          order.financialSnapshot.estimatedGrossMargin =
            Math.round((netMerch - cleanCostTotal + (custShip - estShip)) * 100) / 100;
          await order.save();
        }
      }
    } catch (invErr) {
      console.warn("[INVENTORY_ORDER_SALE_MOVEMENT_WARN]", invErr.message);
    }

    try {
      await recordOrderLifecycleEvents(req.subdomain, {
        order,
        eventType: "order_created",
        actor
      });
    } catch (actErr) {
      console.warn("[ACTIVITY_ORDER_CREATED_WARN]", actErr.message);
    }

    try {
      const activeCartId = order.cartId || actor.cartId || body.cartId;
      if (activeCartId) {
        const { markCartConverted } = require("../carts/cartService");
        await markCartConverted(req.subdomain, activeCartId, order._id);
      }
    } catch (cartErr) {
      console.warn("[CART_MARK_CONVERTED_WARN]", cartErr.message);
    }

    let paymentGatewayUrl = null;
    if (method !== "cod") {
      paymentGatewayUrl = `/checkout/paymob-mock?orderId=${order.orderId}&amount=${order.total}`;
    }

    res.json({
      done: true,
      order,
      paymentGatewayUrl,
      message: "تم تسجيل طلبك بنجاح!"
    });
  } catch (err) {
    next(err);
  }
};

exports.trackOrder = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const { orderId } = req.params;

    const order = await Orders.findOne({ orderId }).lean();
    if (!order) return res.status(404).json({ error: "لم يتم العثور على طلب بهذا الرقم" });

    res.json({ done: true, order });
  } catch (err) {
    next(err);
  }
};

exports.myOrders = async (req, res, next) => {
  try {
    const Orders = getOrdersModel(req.subdomain);
    const userId = req.user ? req.user._id : null;
    if (!userId) return res.status(401).json({ error: "سجل الدخول أولاً لعرض طلباتك" });
    const orders = await Orders.find({ userId }).sort({ createdAt: -1 }).lean();

    const {
      evaluateReturnEligibility,
      evaluateItemWarranty
    } = require("../returns/returnsService");

    const enrichedOrders = orders.map((ord) => {
      const eligibility = evaluateReturnEligibility(ord);
      const enrichedItems = (ord.items || []).map((it) => {
        const warranty = evaluateItemWarranty(it, eligibility.deliveryDate);
        return {
          ...it,
          warrantyStatus: warranty.status,
          isUnderWarranty: warranty.isUnderWarranty,
          warrantyExpiryDate: warranty.warrantyExpiryDate,
          warrantyMonths: warranty.monthsTotal
        };
      });

      return {
        ...ord,
        isReturnEligible: eligibility.eligible,
        returnDaysElapsed: eligibility.daysElapsed,
        returnDaysRemaining: eligibility.daysRemaining,
        deliveryDate: eligibility.deliveryDate,
        items: enrichedItems
      };
    });

    res.json({ done: true, orders: enrichedOrders });
  } catch (err) {
    next(err);
  }
};

exports.checkCoupon = async (req, res, next) => {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code) return res.status(400).json({ error: "أدخل كود الكوبون" });

    const result = await validateCoupon(req.subdomain, code, Number(subtotal));
    if (!result.valid) return res.status(400).json({ error: result.error });

    res.json({
      done: true,
      code: result.coupon.code,
      discountAmount: result.discountAmount,
      type: result.coupon.type,
      message: `تم تطبيق الخصم بنجاح: وفرت ${result.discountAmount} ج.م`
    });
  } catch (err) {
    next(err);
  }
};
