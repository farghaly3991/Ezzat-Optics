/**
 * Phase B — Procurement, Supplier Shipments, Purchase Obligations & Payments Service
 *
 * Implements:
 * - Supplier directory CRUD
 * - Supplier Shipment creation with collision-safe server-generated reference IDs
 * - Associating products with a shipment (from shipment screen or product create/edit workflow)
 * - Historical purchase line snapshots independent of editable `product.costPrice`
 * - Separate auditable payment records, partial payments, corrections, and reversals
 * - Authoritative balance calculation (`originalObligation`, `totalPaid`, `outstandingBalance`, `paymentStatus`, `isOverdue`)
 * - Accounting distinctions:
 *   1. Supplier obligation != cash paid
 *   2. Shipment creation != goods received (`status` defaults to `"ordered"`, not `"received"`)
 *   3. Payment != inventory received (payments never auto-increment product stock)
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const getSupplierModel = require("./supplierModel");
const getSupplierShipmentModel = require("./supplierShipmentModel");
const getProductsModel = require("../../products/productModel");
const {
  createPaymentEntry,
  reversePaymentEntry,
  correctPaymentEntry,
  listPaymentsForEntity
} = require("../core/payments/paymentService");
const { calculateObligationBalance } = require("../core/balances/balanceService");
const { recordFinanceAudit, listFinanceAuditLogs } = require("../core/audit/auditService");
const { emitFinanceEvent, FINANCE_DOMAIN_EVENTS } = require("../core/events/financeEventBus");
const { onSupplierShipmentReceivingHook } = require("../inventory/inventoryInterface");
const { resolveCurrencySnapshot } = require("../currency/currencyInterface");
const { evaluateDueStatus, dispatchReminderNotification } = require("../shared/remindersInterface");
const { SUPPLIER_SHIPMENT_STATUSES } = require("../shared/constants");
const {
  createFinanceError,
  roundMoney,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateCurrencyCode,
  validateObjectId,
  validateOptionalDate
} = require("../shared/validators");

async function generateUniqueReference(Model, fieldName, prefix) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const rnd = crypto.randomBytes(3).toString("hex").toUpperCase();
    const candidate = `${prefix}-${datePart}-${rnd}`;
    const exists = await Model.exists({ [fieldName]: candidate });
    if (!exists) return candidate;
  }
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ============================================================================
// 1. Suppliers Directory
// ============================================================================

async function listSuppliers(subdomain, { activeOnly = false, search = "" } = {}) {
  const Supplier = getSupplierModel(subdomain);
  const query = {};
  if (activeOnly) query.active = true;
  if (search && String(search).trim()) {
    const rx = { $regex: String(search).trim(), $options: "i" };
    query.$or = [{ name: rx }, { supplierCode: rx }, { phone: rx }, { contactPerson: rx }];
  }
  return Supplier.find(query).sort({ createdAt: -1 }).lean();
}

async function createSupplier(subdomain, payload = {}, actor = null) {
  const Supplier = getSupplierModel(subdomain);
  const name = String(payload.name || "").trim();
  if (!name) {
    throw createFinanceError("اسم المورد مطلوب", 400);
  }

  let supplierCode = String(payload.supplierCode || "").trim().toUpperCase();
  if (!supplierCode) {
    supplierCode = await generateUniqueReference(Supplier, "supplierCode", "SUP");
  } else {
    const dup = await Supplier.exists({ supplierCode });
    if (dup) throw createFinanceError(`كود المورد (${supplierCode}) مسجل مسبقاً`, 400);
  }

  const created = await new Supplier({
    supplierCode,
    name,
    contactPerson: String(payload.contactPerson || "").trim(),
    phone: String(payload.phone || "").trim(),
    whatsappPhone: String(payload.whatsappPhone || payload.phone || "").trim(),
    email: String(payload.email || "").trim(),
    specialty: String(payload.specialty || "").trim(),
    description: String(payload.description || "").trim(),
    address: String(payload.address || "").trim(),
    taxOrCommercialId: String(payload.taxOrCommercialId || "").trim(),
    notes: String(payload.notes || "").trim(),
    active: payload.active !== false,
    createdBy: actor?._id || actor?.userId || null
  }).save();

  return created.toObject();
}

async function getSupplierById(subdomain, supplierId) {
  const Supplier = getSupplierModel(subdomain);
  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier) throw createFinanceError("المورد غير موجود", 404);
  return supplier;
}

async function updateSupplier(subdomain, supplierId, payload = {}, actor = null) {
  const Supplier = getSupplierModel(subdomain);
  const existing = await Supplier.findById(supplierId);
  if (!existing) throw createFinanceError("المورد غير موجود", 404);

  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) throw createFinanceError("اسم المورد مطلوب", 400);
    existing.name = name;
  }
  if (payload.phone !== undefined) existing.phone = String(payload.phone || "").trim();
  if (payload.whatsappPhone !== undefined) existing.whatsappPhone = String(payload.whatsappPhone || "").trim();
  if (payload.email !== undefined) existing.email = String(payload.email || "").trim();
  if (payload.specialty !== undefined) existing.specialty = String(payload.specialty || "").trim();
  if (payload.description !== undefined) existing.description = String(payload.description || "").trim();
  if (payload.address !== undefined) existing.address = String(payload.address || "").trim();
  if (payload.notes !== undefined) existing.notes = String(payload.notes || "").trim();
  if (payload.contactPerson !== undefined) existing.contactPerson = String(payload.contactPerson || "").trim();
  if (payload.taxOrCommercialId !== undefined) existing.taxOrCommercialId = String(payload.taxOrCommercialId || "").trim();
  if (payload.active !== undefined) existing.active = Boolean(payload.active);

  await existing.save();

  await recordFinanceAudit(subdomain, {
    action: "SUPPLIER_UPDATED",
    entityType: "supplier",
    entityId: existing._id,
    notes: `تم تحديث بيانات المورد: ${existing.name}`,
    actor
  });

  return existing.toObject();
}

async function deleteSupplier(subdomain, supplierId, actor = null) {
  const Supplier = getSupplierModel(subdomain);
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw createFinanceError("المورد غير موجود", 404);

  const Products = getProductsModel(subdomain);
  const SupplierShipment = getSupplierShipmentModel(subdomain);

  const [productCount, shipmentCount] = await Promise.all([
    Products.countDocuments({ supplierId }),
    SupplierShipment.countDocuments({ supplierId })
  ]);

  if (productCount > 0 || shipmentCount > 0) {
    throw createFinanceError(
      `لا يمكن حذف المورد (${supplier.name}) لوجود ${productCount} منتج و ${shipmentCount} شحنة مرتبطة به. يرجى فك الارتباط أولاً أو إلغاء تفعيل حسابه.`,
      400
    );
  }

  await Supplier.findByIdAndDelete(supplierId);

  await recordFinanceAudit(subdomain, {
    action: "SUPPLIER_DELETED",
    entityType: "supplier",
    entityId: supplierId,
    notes: `تم حذف المورد: ${supplier.name} (${supplier.supplierCode})`,
    actor
  });

  return { success: true, message: `تم حذف المورد (${supplier.name}) بنجاح` };
}

// ============================================================================
// 2. Internal Helper: Recompute & Persist Shipment Balances from Payment Ledger
// ============================================================================

async function recalculateAndSaveShipmentState(subdomain, shipmentDoc, now = new Date()) {
  const linesTotal = roundMoney(
    (shipmentDoc.purchaseLines || []).reduce((acc, l) => acc + Number(l.lineTotal || 0), 0)
  );
  shipmentDoc.linesTotal = linesTotal;

  const paymentRecords = await listPaymentsForEntity(subdomain, {
    entityType: "supplier_shipment",
    entityId: shipmentDoc._id
  });

  const balanceSummary = calculateObligationBalance({
    expectedGoodsValue: shipmentDoc.expectedGoodsValue,
    linesTotal,
    explicitApprovedObligation: shipmentDoc.explicitApprovedObligation,
    paymentRecords,
    dueDate: shipmentDoc.dueDate,
    shipmentStatus: shipmentDoc.status,
    now
  });

  shipmentDoc.approvedObligationTotal = balanceSummary.originalObligation;
  shipmentDoc.totalPaid = balanceSummary.totalPaid;
  shipmentDoc.outstandingBalance = balanceSummary.outstandingBalance;
  shipmentDoc.overpaidAmount = balanceSummary.overpaidAmount;
  shipmentDoc.paymentStatus = balanceSummary.paymentStatus;

  await shipmentDoc.save();

  return {
    shipment: enrichShipmentWithDueEvaluation(shipmentDoc.toObject(), now),
    payments: paymentRecords,
    balanceSummary
  };
}

function enrichShipmentWithDueEvaluation(shipmentObj, now = new Date()) {
  const dueEval = evaluateDueStatus({
    dueDate: shipmentObj.dueDate,
    outstandingBalance: shipmentObj.outstandingBalance,
    status: shipmentObj.status,
    now
  });
  return {
    ...shipmentObj,
    originalObligation: shipmentObj.approvedObligationTotal,
    isOverdue: dueEval.isOverdue,
    isUpcomingDue: dueEval.isUpcomingDue,
    daysOverdue: dueEval.daysOverdue,
    daysUntilDue: dueEval.daysUntilDue,
    dueSeverity: dueEval.severity,
    dueEvaluation: dueEval
  };
}

// ============================================================================
// 3. Supplier Shipments CRUD
// ============================================================================

async function createSupplierShipment(subdomain, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const Supplier = getSupplierModel(subdomain);

  // Resolve supplier from supplierId or inline supplier object/fields
  let supplierDoc = null;
  if (payload.supplierId && mongoose.isValidObjectId(payload.supplierId)) {
    supplierDoc = await Supplier.findById(payload.supplierId).lean();
  }

  const rawSupplier = payload.supplier || {};
  const supplierName = String(
    rawSupplier.name || payload.supplierName || supplierDoc?.name || ""
  ).trim();

  if (!supplierName) {
    throw createFinanceError("يرجى إدخال اسم المورد أو اختيار مورد مسجل", 400);
  }

  const supplierSnapshot = {
    name: supplierName,
    contactPerson: String(
      rawSupplier.contactPerson ?? payload.supplierContactPerson ?? supplierDoc?.contactPerson ?? ""
    ).trim(),
    phone: String(rawSupplier.phone ?? payload.supplierPhone ?? supplierDoc?.phone ?? "").trim(),
    email: String(rawSupplier.email ?? payload.supplierEmail ?? supplierDoc?.email ?? "").trim(),
    address: String(rawSupplier.address ?? payload.supplierAddress ?? supplierDoc?.address ?? "").trim()
  };

  // Auto-save supplier in directory if requested or if no supplierId was given
  let resolvedSupplierId = supplierDoc ? supplierDoc._id : null;
  if (!resolvedSupplierId && payload.saveSupplierToDirectory !== false) {
    const existingSupplier = await Supplier.findOne({ name: supplierName }).lean();
    if (existingSupplier) {
      resolvedSupplierId = existingSupplier._id;
    } else {
      const newSup = await createSupplier(subdomain, supplierSnapshot, actor);
      resolvedSupplierId = newSup._id;
    }
  }

  // Generate collision-safe server reference ID
  let referenceId = String(payload.referenceId || "").trim().toUpperCase();
  if (referenceId) {
    const exists = await SupplierShipment.exists({ referenceId });
    if (exists) {
      throw createFinanceError(`رقم مرجع الشحنة (${referenceId}) مستخدم مسبقاً`, 400);
    }
  } else {
    referenceId = await generateUniqueReference(SupplierShipment, "referenceId", "SHP");
  }

  const requestedPurchaseCurrency = payload.originalCurrency || payload.purchaseCurrency || payload.currency || "EGP";
  const currencySnap = await resolveCurrencySnapshot(
    subdomain,
    requestedPurchaseCurrency,
    payload.baseCurrency || "EGP",
    payload.exchangeRateUsed || payload.exchangeRate || null
  );
  const currency = currencySnap.baseCurrency || "EGP";
  const originalCurrency = currencySnap.originalCurrency || requestedPurchaseCurrency;
  const exchangeRateUsed = Number(currencySnap.exchangeRate || 1);

  const rawExpectedValue = validateNonNegativeAmount(
    payload.expectedGoodsValue ?? payload.originalGoodsValue ?? payload.goodsValue ?? 0,
    "القيمة المتوقعة للبضاعة"
  );
  const originalGoodsValue =
    payload.originalGoodsValue !== undefined && payload.originalGoodsValue !== null
      ? validateNonNegativeAmount(payload.originalGoodsValue, "قيمة البضاعة بالعملة الأصلية")
      : rawExpectedValue;

  const expectedGoodsValue =
    originalCurrency !== currency && payload.expectedGoodsValue === undefined
      ? roundMoney(originalGoodsValue * exchangeRateUsed)
      : originalCurrency !== currency && payload.convertExpectedFromOriginal === true
      ? roundMoney(originalGoodsValue * exchangeRateUsed)
      : roundMoney(rawExpectedValue * (originalCurrency !== currency && !payload.alreadyConverted ? exchangeRateUsed : 1));

  const explicitApprovedObligation =
    payload.approvedObligationTotal !== undefined && payload.approvedObligationTotal !== null && payload.approvedObligationTotal !== ""
      ? validateNonNegativeAmount(payload.approvedObligationTotal, "إجمالي الالتزام المعتمد")
      : null;

  const shipmentDate = validateOptionalDate(payload.shipmentDate, "تاريخ الشحنة") || new Date();
  const dueDate = validateOptionalDate(payload.dueDate, "تاريخ الاستحقاق");

  // Accounting distinction: Shipment creation alone must NOT imply that goods have arrived!
  // Default status is "ordered" (unless "draft" or "in_transit" is specified).
  const requestedStatus = payload.status || "ordered";
  const status = SUPPLIER_SHIPMENT_STATUSES.includes(requestedStatus) ? requestedStatus : "ordered";

  const actorId = actor?._id || actor?.userId || null;

  const shipmentDoc = await new SupplierShipment({
    referenceId,
    externalInvoiceRef: String(payload.externalInvoiceRef || "").trim(),
    shipmentDate,
    supplierId: resolvedSupplierId,
    supplier: supplierSnapshot,
    currency,
    originalCurrency,
    originalGoodsValue,
    exchangeRateUsed,
    exchangeRateDate: currencySnap.effectiveDate || shipmentDate,
    exchangeRateSource: payload.exchangeRateSource || currencySnap.rateSource || "base_currency",
    expectedGoodsValue,
    linesTotal: 0,
    explicitApprovedObligation,
    approvedObligationTotal: explicitApprovedObligation ?? expectedGoodsValue,
    totalPaid: 0,
    outstandingBalance: explicitApprovedObligation ?? expectedGoodsValue,
    overpaidAmount: 0,
    paymentStatus: "unpaid",
    dueDate,
    status,
    purchaseLines: [],
    notes: String(payload.notes || "").trim(),
    attachments: Array.isArray(payload.attachments) ? payload.attachments.filter(Boolean) : [],
    createdBy: actorId,
    updatedBy: actorId
  }).save();

  await recordFinanceAudit(subdomain, {
    action: "supplier_shipment_created",
    entityType: "supplier_shipment",
    entityId: String(shipmentDoc._id),
    referenceCode: shipmentDoc.referenceId,
    summary: `إنشاء شحنة مورد جديدة (${shipmentDoc.referenceId}) من المورد "${supplierName}"`,
    afterState: shipmentDoc.toObject(),
    actor,
    activityPayload: {
      eventType: "shipment_created",
      shipmentId: shipmentDoc._id,
      amount: shipmentDoc.approvedObligationTotal,
      currency: shipmentDoc.currency,
      note: `إنشاء شحنة المورد ${shipmentDoc.referenceId} (${supplierName})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.SUPPLIER_SHIPMENT_CREATED, {
    subdomain,
    shipment: shipmentDoc.toObject()
  });

  // Optional: If initial purchase lines were included in creation payload, associate them now
  if (Array.isArray(payload.purchaseLines) && payload.purchaseLines.length > 0) {
    await associateProductsWithShipment(
      subdomain,
      shipmentDoc._id,
      { lines: payload.purchaseLines, syncProductCostPrice: payload.syncProductCostPrice },
      actor
    );
  }

  // Optional: If an initial payment was provided at creation, record it as a real payment record
  if (payload.initialPayment && Number(payload.initialPayment.amount || payload.initialPayment) > 0) {
    const initialAmt =
      typeof payload.initialPayment === "object"
        ? payload.initialPayment.amount
        : payload.initialPayment;
    await recordShipmentPayment(
      subdomain,
      shipmentDoc._id,
      {
        amount: initialAmt,
        currency,
        paymentMethod: payload.initialPayment?.paymentMethod || "cash",
        referenceNote: payload.initialPayment?.referenceNote || "دفعة مبدئية عند تسجيل الشحنة",
        notes: payload.initialPayment?.notes || "",
        idempotencyKey: payload.initialPayment?.idempotencyKey || null
      },
      actor
    );
  }

  return getSupplierShipmentById(subdomain, shipmentDoc._id);
}

/**
 * Associate one or more products with a supplier shipment.
 * Preserves historical purchase line details (`productId`, `productNameSnapshot`, `quantity`, `unitCost`, `currency`, `lineTotal`).
 */
async function associateProductsWithShipment(subdomain, shipmentId, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const Products = getProductsModel(subdomain);

  const validShipmentId = validateObjectId(shipmentId, "معرف الشحنة");
  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }

  if (shipmentDoc.status === "cancelled") {
    throw createFinanceError("لا يمكن ربط منتجات بشحنة ملغاة", 400);
  }

  const rawLines = Array.isArray(payload.lines)
    ? payload.lines
    : payload.productId
    ? [payload]
    : [];

  if (rawLines.length === 0) {
    throw createFinanceError("يرجى تحديد منتج واحد على الأقل لربطه بالشحنة", 400);
  }

  const actorId = actor?._id || actor?.userId || null;
  const associatedProductsSummary = [];

  for (const rawLine of rawLines) {
    const validProdId = validateObjectId(rawLine.productId, "معرف المنتج");
    const product = await Products.findById(validProdId);
    if (!product) {
      throw createFinanceError(`المنتج المطلوب ربطه غير موجود (${rawLine.productId})`, 404);
    }

    const quantity = Math.max(1, Math.round(Number(rawLine.quantity || 1)));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw createFinanceError("كمية الشراء يجب أن تكون 1 أو أكثر", 400);
    }

    const lineOriginalCurrency = rawLine.originalCurrency
      ? validateCurrencyCode(rawLine.originalCurrency)
      : rawLine.currency && validateCurrencyCode(rawLine.currency) !== shipmentDoc.currency
      ? validateCurrencyCode(rawLine.currency)
      : shipmentDoc.originalCurrency || shipmentDoc.currency || "EGP";

    let lineExchangeRate = Number(
      rawLine.exchangeRateUsed || rawLine.exchangeRate || shipmentDoc.exchangeRateUsed || 1
    );

    if (lineOriginalCurrency !== (shipmentDoc.currency || "EGP") && (!lineExchangeRate || lineExchangeRate === 1)) {
      const resolvedLineSnap = await resolveCurrencySnapshot(
        subdomain,
        lineOriginalCurrency,
        shipmentDoc.currency || "EGP",
        rawLine.exchangeRateUsed || rawLine.exchangeRate || null
      );
      lineExchangeRate = Number(resolvedLineSnap.exchangeRate || 1);
    }

    const rawEnteredUnitCost = validateNonNegativeAmount(
      rawLine.originalUnitCost !== undefined && rawLine.originalUnitCost !== ""
        ? rawLine.originalUnitCost
        : rawLine.unitCost !== undefined && rawLine.unitCost !== ""
        ? rawLine.unitCost
        : product.costPrice || 0,
      "تكلفة شراء الوحدة"
    );

    const isForeignLine = lineOriginalCurrency !== (shipmentDoc.currency || "EGP");
    const originalUnitCost = rawEnteredUnitCost;
    const originalLineTotal = roundMoney(quantity * originalUnitCost);

    const unitCost =
      isForeignLine &&
      (rawLine.originalUnitCost !== undefined || rawLine.alreadyConverted !== true)
        ? roundMoney(originalUnitCost * lineExchangeRate)
        : roundMoney(
            rawLine.unitCost !== undefined && rawLine.unitCost !== ""
              ? Number(rawLine.unitCost)
              : originalUnitCost
          );

    const lineCurrency = shipmentDoc.currency || "EGP";
    const lineTotal = roundMoney(quantity * unitCost);

    // Check if an explicit lineId was provided to update an existing line, or if replaceExistingProductLine is set
    const existingLineIdx = shipmentDoc.purchaseLines.findIndex(
      (l) =>
        (rawLine.lineId && l.lineId === rawLine.lineId) ||
        (rawLine.replaceExistingForProduct !== false && String(l.productId) === String(product._id))
    );

    const existingLineObj = existingLineIdx >= 0 ? shipmentDoc.purchaseLines[existingLineIdx] : null;

    const lineRecord = {
      lineId: existingLineObj
        ? existingLineObj.lineId
        : `LINE-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      productId: product._id,
      productNameSnapshot: product.name,
      groupCodeSnapshot: product.groupCode || "",
      quantity,
      unitCost,
      currency: lineCurrency,
      lineTotal,
      receivedQuantity: existingLineObj ? Number(existingLineObj.receivedQuantity || 0) : 0,
      rejectedQuantity: existingLineObj ? Number(existingLineObj.rejectedQuantity || 0) : 0,
      returnedToSupplierQuantity: existingLineObj
        ? Number(existingLineObj.returnedToSupplierQuantity || 0)
        : 0,
      discrepancyNote: existingLineObj ? existingLineObj.discrepancyNote || "" : "",
      originalCurrency: lineOriginalCurrency,
      originalUnitCost,
      originalLineTotal,
      exchangeRateUsed: isForeignLine ? lineExchangeRate : 1,
      exchangeRateDate: shipmentDoc.exchangeRateDate || new Date(),
      exchangeRateSource: shipmentDoc.exchangeRateSource || (isForeignLine ? "manual" : "base_currency"),
      gridCoords: rawLine.gridCoords || null,
      matrixUpdates: rawLine.matrixUpdates || null,
      notes: String(rawLine.notes || "").trim(),
      associatedAt: new Date(),
      associatedBy: actorId
    };

    if (existingLineIdx >= 0) {
      shipmentDoc.purchaseLines[existingLineIdx] = lineRecord;
    } else {
      shipmentDoc.purchaseLines.push(lineRecord);
    }

    // Link product back to this supplier shipment without creating duplicate products
    // Note: Do NOT mutate product.stockCount here (accounting separation of procurement vs Phase C receiving)
    product.supplierShipmentId = shipmentDoc._id;
    product.lastPurchaseCost = unitCost;
    product.replacementUnitCost = unitCost;
    product.lastPurchaseCurrency = lineOriginalCurrency;
    product.lastPurchaseOriginalUnitCost = originalUnitCost;
    product.lastPurchaseExchangeRate = isForeignLine ? lineExchangeRate : 1;
    product.lastPurchaseRateDate = new Date();
    if (payload.syncProductCostPrice === true && unitCost > 0) {
      product.costPrice = unitCost;
    }
    await product.save();

    associatedProductsSummary.push({
      productId: String(product._id),
      productName: product.name,
      quantity,
      unitCost,
      lineTotal
    });

    await recordFinanceAudit(subdomain, {
      action: "shipment_product_associated",
      entityType: "supplier_shipment",
      entityId: String(shipmentDoc._id),
      referenceCode: shipmentDoc.referenceId,
      summary: `ربط المنتج "${product.name}" (الكمية: ${quantity}، تكلفة الوحدة: ${unitCost}) بالشحنة ${shipmentDoc.referenceId}`,
      afterState: lineRecord,
      actor,
      activityPayload: {
        eventType: "shipment_product_associated",
        shipmentId: shipmentDoc._id,
        productId: product._id,
        quantity,
        unitPrice: unitCost,
        amount: lineTotal,
        currency: lineCurrency,
        note: `ربط منتج بشحنة المورد ${shipmentDoc.referenceId}: ${product.name}`
      }
    });
  }

  shipmentDoc.updatedBy = actorId;
  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc);

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.SUPPLIER_SHIPMENT_PRODUCT_ASSOCIATED, {
    subdomain,
    shipment: recalculated.shipment,
    associatedProducts: associatedProductsSummary
  });

  return recalculated;
}

/**
 * Remove a purchase line from a shipment and recalculate obligation & balances.
 */
async function removePurchaseLineFromShipment(subdomain, shipmentId, lineId, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const Products = getProductsModel(subdomain);

  const validShipmentId = validateObjectId(shipmentId, "معرف الشحنة");
  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }

  const lineIdx = shipmentDoc.purchaseLines.findIndex(
    (l) => l.lineId === lineId || String(l.productId) === String(lineId)
  );
  if (lineIdx === -1) {
    throw createFinanceError("بند الشراء المطلوب حذفه غير موجود في هذه الشحنة", 404);
  }

  const [removedLine] = shipmentDoc.purchaseLines.splice(lineIdx, 1);

  // Clear product's supplierShipmentId if it pointed to this shipment
  await Products.updateOne(
    { _id: removedLine.productId, supplierShipmentId: shipmentDoc._id },
    { $set: { supplierShipmentId: null } }
  );

  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc);

  await recordFinanceAudit(subdomain, {
    action: "shipment_product_disassociated",
    entityType: "supplier_shipment",
    entityId: String(shipmentDoc._id),
    referenceCode: shipmentDoc.referenceId,
    summary: `إزالة المنتج "${removedLine.productNameSnapshot}" من الشحنة ${shipmentDoc.referenceId}`,
    beforeState: removedLine,
    actor
  });

  return recalculated;
}

/**
 * Update shipment metadata, status, expectedGoodsValue, or dueDate.
 * Explicitly rejects attempts to manually overwrite `totalPaid` or `outstandingBalance`!
 */
async function updateSupplierShipment(subdomain, shipmentId, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const validShipmentId = validateObjectId(shipmentId, "معرف الشحنة");

  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }

  if (payload.totalPaid !== undefined || payload.paidAmount !== undefined) {
    throw createFinanceError(
      "لا يمكن تعديل المبلغ المدفوع يدوياً؛ يجب تسجيل عملية دفع أو تصحيح أو عكس رسمية في سجل المدفوعات",
      400,
      "MANUAL_PAID_EDIT_FORBIDDEN"
    );
  }

  const beforeState = shipmentDoc.toObject();
  const actorId = actor?._id || actor?.userId || null;

  if (payload.shipmentDate !== undefined) {
    shipmentDoc.shipmentDate = validateOptionalDate(payload.shipmentDate, "تاريخ الشحنة") || shipmentDoc.shipmentDate;
  }

  if (payload.externalInvoiceRef !== undefined) {
    shipmentDoc.externalInvoiceRef = String(payload.externalInvoiceRef || "").trim();
  }

  if (payload.supplier && typeof payload.supplier === "object") {
    if (payload.supplier.name) shipmentDoc.supplier.name = String(payload.supplier.name).trim();
    if (payload.supplier.contactPerson !== undefined) {
      shipmentDoc.supplier.contactPerson = String(payload.supplier.contactPerson || "").trim();
    }
    if (payload.supplier.phone !== undefined) {
      shipmentDoc.supplier.phone = String(payload.supplier.phone || "").trim();
    }
    if (payload.supplier.email !== undefined) {
      shipmentDoc.supplier.email = String(payload.supplier.email || "").trim();
    }
    if (payload.supplier.address !== undefined) {
      shipmentDoc.supplier.address = String(payload.supplier.address || "").trim();
    }
  }

  if (payload.expectedGoodsValue !== undefined) {
    shipmentDoc.expectedGoodsValue = validateNonNegativeAmount(
      payload.expectedGoodsValue,
      "القيمة المتوقعة للبضاعة"
    );
  }

  if (payload.approvedObligationTotal !== undefined) {
    shipmentDoc.explicitApprovedObligation =
      payload.approvedObligationTotal === null || payload.approvedObligationTotal === ""
        ? null
        : validateNonNegativeAmount(payload.approvedObligationTotal, "إجمالي الالتزام المعتمد");
  }

  if (payload.notes !== undefined) {
    shipmentDoc.notes = String(payload.notes || "").trim();
  }

  if (Array.isArray(payload.attachments)) {
    shipmentDoc.attachments = payload.attachments.filter(Boolean);
  }

  // Handle Due Date change with explicit audit & activity recording
  let dueDateChanged = false;
  if (payload.dueDate !== undefined) {
    const nextDue = validateOptionalDate(payload.dueDate, "تاريخ الاستحقاق");
    const prevTime = shipmentDoc.dueDate ? new Date(shipmentDoc.dueDate).getTime() : null;
    const nextTime = nextDue ? nextDue.getTime() : null;

    if (prevTime !== nextTime) {
      dueDateChanged = true;
      shipmentDoc.dueDateHistory.push({
        previousDueDate: shipmentDoc.dueDate || null,
        newDueDate: nextDue,
        reason: String(payload.dueDateReason || "تحديث تاريخ الاستحقاق").trim(),
        changedBy: actorId,
        changedAt: new Date()
      });
      shipmentDoc.dueDate = nextDue;
    }
  }

  // Handle status change (including receiving hook for Phase C boundary)
  let transitionedToReceived = false;
  if (payload.status !== undefined) {
    if (!SUPPLIER_SHIPMENT_STATUSES.includes(payload.status)) {
      throw createFinanceError(`حالة الشحنة غير صالحة: ${payload.status}`, 400);
    }
    if (shipmentDoc.status !== "received" && payload.status === "received") {
      transitionedToReceived = true;
      shipmentDoc.receivedAt = new Date();
    }
    shipmentDoc.status = payload.status;
  }

  shipmentDoc.updatedBy = actorId;
  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc);

  if (dueDateChanged) {
    await recordFinanceAudit(subdomain, {
      action: "shipment_due_date_changed",
      entityType: "supplier_shipment",
      entityId: String(shipmentDoc._id),
      referenceCode: shipmentDoc.referenceId,
      summary: `تغيير تاريخ استحقاق الشحنة ${shipmentDoc.referenceId}`,
      beforeState: { dueDate: beforeState.dueDate },
      afterState: { dueDate: shipmentDoc.dueDate },
      actor,
      activityPayload: {
        eventType: "shipment_due_date_changed",
        shipmentId: shipmentDoc._id,
        amount: recalculated.shipment.outstandingBalance,
        currency: shipmentDoc.currency,
        note: `تعديل تاريخ استحقاق الشحنة ${shipmentDoc.referenceId}`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.SUPPLIER_SHIPMENT_DUE_DATE_CHANGED, {
      subdomain,
      shipment: recalculated.shipment
    });
  }

  if (transitionedToReceived) {
    const phaseCHookResult = await onSupplierShipmentReceivingHook(subdomain, recalculated.shipment);
    await recordFinanceAudit(subdomain, {
      action: "supplier_shipment_received",
      entityType: "supplier_shipment",
      entityId: String(shipmentDoc._id),
      referenceCode: shipmentDoc.referenceId,
      summary: `تحديث حالة الشحنة ${shipmentDoc.referenceId} إلى مستلمة (Received)`,
      metadata: { phaseCHookResult },
      actor,
      activityPayload: {
        eventType: "shipment_received",
        shipmentId: shipmentDoc._id,
        amount: recalculated.shipment.approvedObligationTotal,
        currency: shipmentDoc.currency,
        note: `تأكيد وصول شحنة المورد ${shipmentDoc.referenceId}`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.SUPPLIER_SHIPMENT_RECEIVED, {
      subdomain,
      shipment: recalculated.shipment,
      phaseCHookResult
    });
  } else if (!dueDateChanged) {
    await recordFinanceAudit(subdomain, {
      action: "supplier_shipment_updated",
      entityType: "supplier_shipment",
      entityId: String(shipmentDoc._id),
      referenceCode: shipmentDoc.referenceId,
      summary: `تحديث بيانات شحنة المورد ${shipmentDoc.referenceId}`,
      beforeState: {
        status: beforeState.status,
        expectedGoodsValue: beforeState.expectedGoodsValue,
        approvedObligationTotal: beforeState.approvedObligationTotal
      },
      afterState: {
        status: recalculated.shipment.status,
        expectedGoodsValue: recalculated.shipment.expectedGoodsValue,
        approvedObligationTotal: recalculated.shipment.approvedObligationTotal
      },
      actor,
      activityPayload: {
        eventType: "shipment_updated",
        shipmentId: shipmentDoc._id,
        amount: recalculated.shipment.approvedObligationTotal,
        currency: shipmentDoc.currency,
        note: `تحديث شحنة المورد ${shipmentDoc.referenceId}`
      }
    });
  }

  return recalculated;
}

// ============================================================================
// 4. Payments, Corrections, and Reversals against Supplier Shipments
// ============================================================================

async function recordShipmentPayment(subdomain, shipmentId, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const validShipmentId = validateObjectId(shipmentId, "معرف الشحنة");

  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }
  if (shipmentDoc.status === "cancelled") {
    throw createFinanceError("لا يمكن تسجيل دفعة مالية لشحنة ملغاة", 400);
  }

  const amount = validatePositiveAmount(payload.amount, "مبلغ الدفعة");
  const currency = payload.currency
    ? validateCurrencyCode(payload.currency)
    : shipmentDoc.currency || "EGP";

  // Prevent accidental overpayment unless allowOverpayment is explicitly true
  if (
    !payload.allowOverpayment &&
    shipmentDoc.approvedObligationTotal > 0 &&
    roundMoney(shipmentDoc.totalPaid + amount) > roundMoney(shipmentDoc.approvedObligationTotal)
  ) {
    const currentRemaining = roundMoney(
      Math.max(0, shipmentDoc.approvedObligationTotal - shipmentDoc.totalPaid)
    );
    throw createFinanceError(
      `مبلغ الدفعة (${amount} ${currency}) يتجاوز الرصيد المستحق المتبقي للشحنة (${currentRemaining} ${currency})`,
      400,
      "PAYMENT_EXCEEDS_OUTSTANDING_BALANCE"
    );
  }

  const paymentResult = await createPaymentEntry(subdomain, {
    entityType: "supplier_shipment",
    entityId: shipmentDoc._id,
    entityReferenceCode: shipmentDoc.referenceId,
    direction: "outflow",
    amount,
    currency,
    expectedCurrency: shipmentDoc.currency,
    paymentMethod: payload.paymentMethod || "cash",
    paidAt: payload.paidAt || new Date(),
    referenceNote: payload.referenceNote || "",
    notes: payload.notes || "",
    attachments: payload.attachments || [],
    idempotencyKey: payload.idempotencyKey || null,
    dedupeWindowMs: payload.dedupeWindowMs !== undefined ? Number(payload.dedupeWindowMs) : 8000,
    actor
  });

  // Always recalculate from ledger records
  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc);

  if (!paymentResult.deduplicated) {
    await recordFinanceAudit(subdomain, {
      action: "shipment_payment_recorded",
      entityType: "finance_payment",
      entityId: String(paymentResult.payment._id),
      referenceCode: paymentResult.payment.paymentReference,
      summary: `تسجيل دفعة بقيمة ${amount} ${currency} للشحنة ${shipmentDoc.referenceId}`,
      afterState: {
        payment: paymentResult.payment,
        shipmentTotalPaid: recalculated.shipment.totalPaid,
        shipmentOutstandingBalance: recalculated.shipment.outstandingBalance,
        paymentStatus: recalculated.shipment.paymentStatus
      },
      actor,
      activityPayload: {
        eventType: "shipment_payment_recorded",
        shipmentId: shipmentDoc._id,
        paymentId: paymentResult.payment._id,
        amount,
        currency,
        note: `دفعة مالية (${paymentResult.payment.paymentReference}) للشحنة ${shipmentDoc.referenceId}`
      }
    });

    await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.FINANCE_PAYMENT_RECORDED, {
      subdomain,
      payment: paymentResult.payment,
      shipment: recalculated.shipment
    });
  }

  return {
    payment: paymentResult.payment,
    deduplicated: paymentResult.deduplicated,
    shipment: recalculated.shipment,
    payments: recalculated.payments,
    balanceSummary: recalculated.balanceSummary
  };
}

async function reverseShipmentPayment(subdomain, shipmentId, paymentId, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const validShipmentId = validateObjectId(shipmentId, "معرف الشحنة");

  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }

  const reversalResult = await reversePaymentEntry(subdomain, {
    paymentId,
    reason: payload.reason || payload.notes || "عكس دفعة مالية",
    actor
  });

  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc);

  await recordFinanceAudit(subdomain, {
    action: "shipment_payment_reversed",
    entityType: "finance_payment",
    entityId: String(reversalResult.reversalPayment._id),
    referenceCode: reversalResult.reversalPayment.paymentReference,
    summary: `عكس الدفعة ${reversalResult.originalPayment.paymentReference} للشحنة ${shipmentDoc.referenceId}`,
    beforeState: { originalPayment: reversalResult.originalPayment },
    afterState: {
      reversalPayment: reversalResult.reversalPayment,
      shipmentTotalPaid: recalculated.shipment.totalPaid,
      shipmentOutstandingBalance: recalculated.shipment.outstandingBalance,
      paymentStatus: recalculated.shipment.paymentStatus
    },
    actor,
    activityPayload: {
      eventType: "shipment_payment_reversed",
      shipmentId: shipmentDoc._id,
      paymentId: reversalResult.reversalPayment._id,
      amount: reversalResult.reversalPayment.amount,
      currency: shipmentDoc.currency,
      note: `عكس الدفعة ${reversalResult.originalPayment.paymentReference} (${reversalResult.reversalPayment.notes})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.FINANCE_PAYMENT_REVERSED, {
    subdomain,
    originalPayment: reversalResult.originalPayment,
    reversalPayment: reversalResult.reversalPayment,
    shipment: recalculated.shipment
  });

  return {
    ...reversalResult,
    shipment: recalculated.shipment,
    payments: recalculated.payments,
    balanceSummary: recalculated.balanceSummary
  };
}

async function correctShipmentPayment(subdomain, shipmentId, paymentId, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const validShipmentId = validateObjectId(shipmentId, "معرف الشحنة");

  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }

  const correctionResult = await correctPaymentEntry(subdomain, {
    paymentId,
    newAmount: payload.newAmount ?? payload.correctedAmount ?? payload.amount,
    reason: payload.reason || payload.notes || "",
    actor
  });

  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc);

  await recordFinanceAudit(subdomain, {
    action: "shipment_payment_corrected",
    entityType: "finance_payment",
    entityId: String(correctionResult.correctionPayment._id),
    referenceCode: correctionResult.correctionPayment.paymentReference,
    summary: `تصحيح الدفعة ${correctionResult.originalPayment.paymentReference} للشحنة ${shipmentDoc.referenceId} بفرق ${correctionResult.delta}`,
    beforeState: { previousEffectiveAmount: correctionResult.previousEffectiveAmount },
    afterState: {
      newEffectiveAmount: correctionResult.newEffectiveAmount,
      delta: correctionResult.delta,
      shipmentTotalPaid: recalculated.shipment.totalPaid,
      shipmentOutstandingBalance: recalculated.shipment.outstandingBalance,
      paymentStatus: recalculated.shipment.paymentStatus
    },
    actor,
    activityPayload: {
      eventType: "shipment_payment_corrected",
      shipmentId: shipmentDoc._id,
      paymentId: correctionResult.correctionPayment._id,
      amount: correctionResult.delta,
      currency: shipmentDoc.currency,
      note: `تصحيح الدفعة ${correctionResult.originalPayment.paymentReference} إلى ${correctionResult.newEffectiveAmount}`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.FINANCE_PAYMENT_CORRECTED, {
    subdomain,
    ...correctionResult,
    shipment: recalculated.shipment
  });

  return {
    ...correctionResult,
    shipment: recalculated.shipment,
    payments: recalculated.payments,
    balanceSummary: recalculated.balanceSummary
  };
}

// ============================================================================
// 5. Queries, Detail Views & Overdue Alerts
// ============================================================================

async function getSupplierShipmentById(subdomain, shipmentId, now = new Date()) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const validId = validateObjectId(shipmentId, "معرف الشحنة");

  const shipmentDoc = await SupplierShipment.findById(validId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }

  const recalculated = await recalculateAndSaveShipmentState(subdomain, shipmentDoc, now);
  const auditTrail = await listFinanceAuditLogs(subdomain, {
    entityId: String(shipmentDoc._id),
    limit: 50
  });

  return {
    shipment: recalculated.shipment,
    payments: recalculated.payments,
    balanceSummary: recalculated.balanceSummary,
    auditLogs: auditTrail.logs
  };
}

async function listSupplierShipments(subdomain, {
  search = "",
  status = "",
  paymentStatus = "",
  supplierId = "",
  overdueOnly = false,
  page = 1,
  limit = 50,
  now = new Date()
} = {}) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const query = {};

  if (search && String(search).trim()) {
    const rx = { $regex: String(search).trim(), $options: "i" };
    query.$or = [
      { referenceId: rx },
      { externalInvoiceRef: rx },
      { "supplier.name": rx },
      { "supplier.phone": rx },
      { "purchaseLines.productNameSnapshot": rx }
    ];
  }

  if (status && status !== "all") {
    query.status = status;
  }

  if (paymentStatus && paymentStatus !== "all") {
    query.paymentStatus = paymentStatus;
  }

  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    query.supplierId = new mongoose.Types.ObjectId(supplierId);
  }

  if (overdueOnly === true || overdueOnly === "true") {
    query.outstandingBalance = { $gt: 0 };
    query.dueDate = { $ne: null, $lt: now instanceof Date ? now : new Date(now) };
    query.status = { $nin: ["cancelled", "closed"] };
  }

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const [total, rawShipments] = await Promise.all([
    SupplierShipment.countDocuments(query),
    SupplierShipment.find(query)
      .sort({ shipmentDate: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean()
  ]);

  const shipments = rawShipments.map((s) => enrichShipmentWithDueEvaluation(s, now));

  return {
    shipments,
    total,
    page: p,
    pages: Math.ceil(total / l) || 1
  };
}

async function getProcurementOverviewAndAlerts(subdomain, { now = new Date() } = {}) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const Activity = require("../../activity/activityModel")(subdomain);

  const allShipments = await SupplierShipment.find({ status: { $ne: "cancelled" } })
    .sort({ dueDate: 1, createdAt: -1 })
    .lean();

  let totalObligations = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  const overdueShipments = [];
  const upcomingDueShipments = [];
  const alerts = [];

  for (const raw of allShipments) {
    const enriched = enrichShipmentWithDueEvaluation(raw, now);
    totalObligations = roundMoney(totalObligations + Number(enriched.approvedObligationTotal || 0));
    totalPaid = roundMoney(totalPaid + Number(enriched.totalPaid || 0));
    totalOutstanding = roundMoney(totalOutstanding + Number(enriched.outstandingBalance || 0));

    if (enriched.isOverdue) {
      overdueShipments.push(enriched);
      alerts.push({
        shipmentId: String(enriched._id),
        referenceId: enriched.referenceId,
        supplierName: enriched.supplier?.name || "",
        outstandingBalance: enriched.outstandingBalance,
        dueDate: enriched.dueDate,
        daysOverdue: enriched.daysOverdue,
        daysUntilDue: enriched.daysUntilDue,
        alertType: "overdue"
      });
    } else if (enriched.isUpcomingDue) {
      upcomingDueShipments.push(enriched);
      alerts.push({
        shipmentId: String(enriched._id),
        referenceId: enriched.referenceId,
        supplierName: enriched.supplier?.name || "",
        outstandingBalance: enriched.outstandingBalance,
        dueDate: enriched.dueDate,
        daysOverdue: 0,
        daysUntilDue: enriched.daysUntilDue,
        alertType: "upcoming_due"
      });
    }
  }

  const recentActivities = await Activity.find({
    eventType: {
      $in: [
        "shipment_created",
        "shipment_updated",
        "shipment_product_associated",
        "shipment_received",
        "shipment_payment_recorded",
        "shipment_payment_corrected",
        "shipment_payment_reversed",
        "shipment_due_date_changed"
      ]
    }
  })
    .sort({ occurredAt: -1 })
    .limit(25)
    .lean();

  return {
    summary: {
      shipmentsCount: allShipments.length,
      totalShipments: allShipments.length,
      totalObligations,
      totalPaid,
      totalOutstanding,
      overdueCount: overdueShipments.length,
      upcomingDueCount: upcomingDueShipments.length
    },
    alerts,
    overdueShipments,
    upcomingDueShipments,
    recentActivities,
    dispatchReminderPreview: async () =>
      dispatchReminderNotification(subdomain, {
        overdueShipments,
        upcomingDueShipments,
        evaluatedAt: now
      })
  };
}

module.exports = {
  listSuppliers,
  createSupplier,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  createSupplierShipment,
  updateSupplierShipment,
  associateProductsWithShipment,
  removePurchaseLineFromShipment,
  recordShipmentPayment,
  reverseShipmentPayment,
  correctShipmentPayment,
  getSupplierShipmentById,
  listSupplierShipments,
  getProcurementOverviewAndAlerts
};
