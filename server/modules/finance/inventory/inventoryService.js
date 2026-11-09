/**
 * Phase C — Inventory Movements, Supplier Receiving & Costing Service
 *
 * Implements:
 * - C1: Idempotent inventory ledger (`storeInventoryMovement`) distinguishing physical stock
 *       (`product.stockCount`), reserved stock (`product.reservedStock`), and available stock.
 * - C2: Full and partial receiving workflow for `storeSupplierShipment` with discrepancy and
 *       rejected-quantity tracking. Only confirmed receipt creates inventory-in movements.
 * - C3: Consistent inventory costing policy (`weighted_average` or `fifo`) with separate
 *       tracking for historical purchase cost (`lastPurchaseCost`), book cost (`inventoryBookUnitCost`),
 *       current replacement cost (`replacementUnitCost`), and selling price (`price`).
 * - C4: Inventory valuation, stock movement queries, damaged/lost stock write-offs,
 *       customer/supplier returns, and manual stock reconciliations.
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const getProductsModel = require("../../products/productModel");
const getInventoryMovementModel = require("./inventoryMovementModel");
const getInventoryCostLayerModel = require("./inventoryBatchModel");
const getSupplierShipmentModel = require("../procurement/supplierShipmentModel");
const { getFinanceSettings } = require("../core/settings/financeSettingsService");
const { recordFinanceAudit } = require("../core/audit/auditService");
const {
  emitFinanceEvent,
  FINANCE_DOMAIN_EVENTS
} = require("../core/events/financeEventBus");
const {
  createFinanceError,
  roundMoney,
  validateNonNegativeAmount,
  validatePositiveAmount,
  validateObjectId
} = require("../shared/validators");

async function generateMovementCode(MovementModel, prefix = "MOV") {
  for (let i = 0; i < 6; i++) {
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    const ts = Date.now().toString(36).toUpperCase().slice(-5);
    const code = `${prefix}-${ts}-${rand}`;
    const exists = await MovementModel.exists({ movementCode: code });
    if (!exists) return code;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Helper: Resolve a product's current baseline unit cost when no book cost is set yet.
 */
function resolveBaselineUnitCost(productDoc) {
  if (
    productDoc.inventoryBookUnitCost !== null &&
    productDoc.inventoryBookUnitCost !== undefined &&
    Number(productDoc.inventoryBookUnitCost) > 0
  ) {
    return roundMoney(Number(productDoc.inventoryBookUnitCost));
  }
  if (
    productDoc.lastPurchaseCost !== null &&
    productDoc.lastPurchaseCost !== undefined &&
    Number(productDoc.lastPurchaseCost) > 0
  ) {
    return roundMoney(Number(productDoc.lastPurchaseCost));
  }
  return roundMoney(Math.max(0, Number(productDoc.costPrice || 0)));
}

/**
 * Consume FIFO cost layers for an outgoing movement and compute exact FIFO unit/total cost.
 */
async function consumeCostLayersForOutflow(subdomain, productDoc, quantityOut, fallbackUnitCost) {
  const CostLayer = getInventoryCostLayerModel(subdomain);
  const openLayers = await CostLayer.find({
    productId: productDoc._id,
    status: "open",
    remainingQuantity: { $gt: 0 }
  }).sort({ receivedAt: 1, createdAt: 1 });

  let remainingToConsume = quantityOut;
  let totalFifoCost = 0;
  const fifoAllocations = [];

  for (const layer of openLayers) {
    if (remainingToConsume <= 0) break;
    const take = Math.min(remainingToConsume, layer.remainingQuantity);
    if (take <= 0) continue;

    const allocCost = roundMoney(take * Number(layer.unitCost || 0));
    totalFifoCost = roundMoney(totalFifoCost + allocCost);
    fifoAllocations.push({
      layerId: layer._id,
      shipmentId: layer.shipmentId || null,
      quantityTaken: take,
      unitCost: roundMoney(layer.unitCost),
      totalCost: allocCost
    });

    layer.remainingQuantity -= take;
    if (layer.remainingQuantity <= 0) {
      layer.remainingQuantity = 0;
      layer.status = "depleted";
    }
    await layer.save();
    remainingToConsume -= take;
  }

  // If product had legacy stock prior to cost layers, value the remainder at fallbackUnitCost
  if (remainingToConsume > 0) {
    const fallbackCostTotal = roundMoney(remainingToConsume * fallbackUnitCost);
    totalFifoCost = roundMoney(totalFifoCost + fallbackCostTotal);
    fifoAllocations.push({
      layerId: null,
      shipmentId: null,
      quantityTaken: remainingToConsume,
      unitCost: roundMoney(fallbackUnitCost),
      totalCost: fallbackCostTotal
    });
  }

  const effectiveUnitCost =
    quantityOut > 0 ? roundMoney(totalFifoCost / quantityOut) : roundMoney(fallbackUnitCost);

  // Compute remaining open FIFO average for book cost display
  const remainingOpenLayers = await CostLayer.find({
    productId: productDoc._id,
    status: "open",
    remainingQuantity: { $gt: 0 }
  }).lean();

  let remainingQtySum = 0;
  let remainingValueSum = 0;
  for (const l of remainingOpenLayers) {
    remainingQtySum += Number(l.remainingQuantity || 0);
    remainingValueSum += Number(l.remainingQuantity || 0) * Number(l.unitCost || 0);
  }
  const nextFifoBookUnitCost =
    remainingQtySum > 0 ? roundMoney(remainingValueSum / remainingQtySum) : effectiveUnitCost;

  return {
    fifoUnitCost: effectiveUnitCost,
    fifoTotalCost: totalFifoCost,
    fifoAllocations,
    nextFifoBookUnitCost
  };
}

/**
 * Core idempotent inventory movement recorder.
 * Mutates `product.stockCount` (unless `skipProductStockMutation === true` when caller already mutated it)
 * and updates valuation fields (`inventoryBookUnitCost`, `lastPurchaseCost`, `replacementUnitCost`).
 */
async function recordInventoryMovement(subdomain, payload = {}, actor = null) {
  const InventoryMovement = getInventoryMovementModel(subdomain);
  const CostLayer = getInventoryCostLayerModel(subdomain);
  const Products = getProductsModel(subdomain);

  const cleanIdempotencyKey = payload.idempotencyKey
    ? String(payload.idempotencyKey).trim()
    : null;

  if (cleanIdempotencyKey) {
    const existing = await InventoryMovement.findOne({
      idempotencyKey: cleanIdempotencyKey
    }).lean();
    if (existing) {
      return {
        movement: existing,
        deduplicated: true
      };
    }
  }

  const validProductId = validateObjectId(payload.productId, "معرف المنتج");
  const productDoc = await Products.findById(validProductId);
  if (!productDoc) {
    throw createFinanceError("المنتج غير موجود في قاعدة البيانات", 404, "PRODUCT_NOT_FOUND");
  }

  const settings = await getFinanceSettings(subdomain);
  const costingMethod = settings?.inventoryConfig?.costingMethod || "weighted_average";
  const currency = settings?.defaultCurrency || "EGP";

  const movementType = String(payload.movementType || "").trim();
  const quantity = Math.max(0, Math.round(Number(payload.quantity || 0)));
  if (quantity <= 0) {
    throw createFinanceError("كمية حركة المخزون يجب أن تكون أكبر من صفر", 400);
  }

  const stockBefore = Number(productDoc.stockCount || 0);
  const reservedBefore = Number(productDoc.reservedStock || 0);
  const baselineBookCost = resolveBaselineUnitCost(productDoc);

  let direction = payload.direction || "in";
  let signedQuantity = quantity;
  let stockAfter = stockBefore;
  let reservedAfter = reservedBefore;
  let unitCost = baselineBookCost;
  let totalCost = roundMoney(quantity * unitCost);
  let inventoryBookUnitCostAfter = baselineBookCost;
  let fifoAllocations = [];

  if (movementType === "reservation_hold") {
    direction = "reservation";
    signedQuantity = 0;
    const availableBefore = Math.max(0, stockBefore - reservedBefore);
    if (payload.enforceAvailableStock !== false && quantity > availableBefore) {
      throw createFinanceError(
        `الكمية المطلوب حجزها (${quantity}) تتجاوز المخزون المتاح للبيع (${availableBefore})`,
        400,
        "INSUFFICIENT_AVAILABLE_STOCK"
      );
    }
    reservedAfter = reservedBefore + quantity;
  } else if (movementType === "reservation_release") {
    direction = "reservation";
    signedQuantity = 0;
    reservedAfter = Math.max(0, reservedBefore - quantity);
  } else if (
    ["supplier_receipt", "customer_return", "order_cancellation_restore"].includes(movementType) ||
    (movementType === "manual_adjustment" && payload.direction === "in")
  ) {
    direction = "in";
    signedQuantity = quantity;
    stockAfter = payload.skipProductStockMutation ? stockBefore : stockBefore + quantity;
    const rawIncomingCost =
      payload.unitCost !== undefined && payload.unitCost !== null
        ? validateNonNegativeAmount(payload.unitCost, "تكلفة الوحدة الواردة")
        : baselineBookCost;
    unitCost = roundMoney(rawIncomingCost);
    totalCost = roundMoney(quantity * unitCost);

    // Weighted Average Cost calculation on positive existing stock
    const effectiveExistingStock = Math.max(0, payload.skipProductStockMutation ? stockBefore - quantity : stockBefore);
    if (effectiveExistingStock + quantity > 0) {
      const totalValueBefore = effectiveExistingStock * baselineBookCost;
      const totalValueAfter = totalValueBefore + totalCost;
      const wacAfter = roundMoney(totalValueAfter / (effectiveExistingStock + quantity));
      inventoryBookUnitCostAfter = wacAfter;
    } else {
      inventoryBookUnitCostAfter = unitCost;
    }

    // Create cost layer for FIFO / batch traceability
    const layerSource =
      movementType === "supplier_receipt"
        ? "supplier_receipt"
        : movementType === "manual_adjustment"
        ? "manual_adjustment"
        : "customer_return";

    await new CostLayer({
      productId: productDoc._id,
      shipmentId:
        payload.shipmentId && mongoose.isValidObjectId(payload.shipmentId)
          ? payload.shipmentId
          : null,
      shipmentReference: String(payload.sourceReference || "").trim(),
      sourceType: layerSource,
      receivedAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
      initialQuantity: quantity,
      remainingQuantity: quantity,
      unitCost,
      currency: payload.currency || currency,
      originalCurrency: payload.originalCurrency || payload.currency || currency,
      originalUnitCost:
        payload.originalUnitCost !== undefined && payload.originalUnitCost !== null
          ? Number(payload.originalUnitCost)
          : unitCost,
      exchangeRateUsed: Number(payload.exchangeRateUsed || 1),
      status: "open"
    }).save();

    if (costingMethod === "fifo") {
      const openLayers = await CostLayer.find({
        productId: productDoc._id,
        status: "open",
        remainingQuantity: { $gt: 0 }
      }).lean();
      const sumQ = openLayers.reduce((acc, l) => acc + Number(l.remainingQuantity || 0), 0);
      const sumV = openLayers.reduce(
        (acc, l) => acc + Number(l.remainingQuantity || 0) * Number(l.unitCost || 0),
        0
      );
      if (sumQ > 0) {
        inventoryBookUnitCostAfter = roundMoney(sumV / sumQ);
      }
    }
  } else {
    // Outflow movement: customer_sale, supplier_return, damaged_or_lost, or negative manual_adjustment
    direction = "out";
    signedQuantity = -quantity;
    if (
      !payload.skipProductStockMutation &&
      payload.allowNegativeStock !== true &&
      stockBefore < quantity
    ) {
      throw createFinanceError(
        `الرصيد الفعلي للمنتج "${productDoc.name}" (${stockBefore}) غير كافٍ لصرف الكمية (${quantity})`,
        400,
        "INSUFFICIENT_PHYSICAL_STOCK"
      );
    }

    stockAfter = payload.skipProductStockMutation
      ? stockBefore
      : Math.max(0, stockBefore - quantity);

    // Consume FIFO layers and compute valuation under active policy
    const fallbackOutCost =
      payload.unitCost !== undefined && payload.unitCost !== null
        ? validateNonNegativeAmount(payload.unitCost, "تكلفة الوحدة")
        : baselineBookCost;

    const fifoResult = await consumeCostLayersForOutflow(
      subdomain,
      productDoc,
      quantity,
      fallbackOutCost
    );
    fifoAllocations = fifoResult.fifoAllocations;

    if (movementType === "supplier_return" && payload.unitCost !== undefined && payload.unitCost !== null) {
      unitCost = roundMoney(Number(payload.unitCost));
      totalCost = roundMoney(quantity * unitCost);
      inventoryBookUnitCostAfter =
        costingMethod === "fifo" ? fifoResult.nextFifoBookUnitCost : baselineBookCost;
    } else if (costingMethod === "fifo") {
      unitCost = fifoResult.fifoUnitCost;
      totalCost = fifoResult.fifoTotalCost;
      inventoryBookUnitCostAfter = fifoResult.nextFifoBookUnitCost;
    } else {
      // Weighted Average Cost policy
      unitCost = roundMoney(baselineBookCost);
      totalCost = roundMoney(quantity * unitCost);
      inventoryBookUnitCostAfter = roundMoney(baselineBookCost);
    }
  }

  const availableAfter = Math.max(0, stockAfter - reservedAfter);
  const movementCode = await generateMovementCode(InventoryMovement, "MOV");
  const actorId = actor?._id || actor?.userId || null;

  const movementDoc = await new InventoryMovement({
    movementCode,
    productId: productDoc._id,
    productNameSnapshot: productDoc.name,
    groupCodeSnapshot: productDoc.groupCode || "",
    movementType,
    direction,
    quantity,
    signedQuantity,
    stockBefore: payload.skipProductStockMutation ? stockBefore - signedQuantity : stockBefore,
    stockAfter,
    reservedBefore,
    reservedAfter,
    availableAfter,
    costingMethodUsed: costingMethod,
    unitCost,
    totalCost,
    inventoryBookUnitCostAfter,
    currency: payload.currency || currency,
    originalCurrency: payload.originalCurrency || payload.currency || currency,
    originalUnitCost:
      payload.originalUnitCost !== undefined && payload.originalUnitCost !== null
        ? Number(payload.originalUnitCost)
        : unitCost,
    exchangeRateUsed: Number(payload.exchangeRateUsed || 1),
    fifoAllocations,
    sourceType: payload.sourceType || "manual_adjustment",
    sourceId: String(payload.sourceId || ""),
    sourceLineId: String(payload.sourceLineId || ""),
    sourceReference: String(payload.sourceReference || ""),
    idempotencyKey: cleanIdempotencyKey,
    reason: String(payload.reason || "").trim(),
    notes: String(payload.notes || "").trim(),
    occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
    recordedBy: actorId
  }).save();

  // Persist updated product stock & book cost
  if (!payload.skipProductStockMutation) {
    productDoc.stockCount = stockAfter;
    productDoc.storeStock = Math.max(0, Number(productDoc.storeStock ?? stockBefore ?? 0) + signedQuantity);
  }
  productDoc.reservedStock = reservedAfter;
  productDoc.inventoryBookUnitCost = inventoryBookUnitCostAfter;

  // Replenish optical lens matrix stock if coordinates or batch updates are provided
  if (productDoc.opticsSpecs?.matrixStock) {
    if (payload.gridCoords && payload.gridCoords.sph) {
      const key = `${payload.gridCoords.sph}_${payload.gridCoords.cyl || "0.00"}`;
      productDoc.opticsSpecs.matrixStock[key] = Math.max(0, (Number(productDoc.opticsSpecs.matrixStock[key]) || 0) + signedQuantity);
      productDoc.markModified("opticsSpecs.matrixStock");
    }
    if (payload.matrixUpdates && typeof payload.matrixUpdates === "object") {
      for (const [key, qtyDelta] of Object.entries(payload.matrixUpdates)) {
        productDoc.opticsSpecs.matrixStock[key] = Math.max(0, (Number(productDoc.opticsSpecs.matrixStock[key]) || 0) + Number(qtyDelta));
      }
      productDoc.markModified("opticsSpecs.matrixStock");
    }
  }

  if (movementType === "supplier_receipt") {
    productDoc.lastPurchaseCost = unitCost;
    productDoc.replacementUnitCost = unitCost;
    productDoc.lastPurchaseCurrency =
      payload.originalCurrency || payload.currency || currency;
    productDoc.lastPurchaseOriginalUnitCost =
      payload.originalUnitCost !== undefined && payload.originalUnitCost !== null
        ? Number(payload.originalUnitCost)
        : unitCost;
    productDoc.lastPurchaseExchangeRate = Number(payload.exchangeRateUsed || 1);
    productDoc.lastPurchaseRateDate = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();
    // Update catalog costPrice to current book cost so legacy views stay informed without losing snapshots
    productDoc.costPrice = inventoryBookUnitCostAfter;
  } else if (productDoc.inventoryBookUnitCost !== null && Number(productDoc.costPrice || 0) === 0) {
    productDoc.costPrice = inventoryBookUnitCostAfter;
  }

  await productDoc.save();

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.INVENTORY_MOVEMENT_RECORDED, {
    subdomain,
    movement: movementDoc.toObject(),
    product: productDoc.toObject()
  });

  const movObj = {
    ...movementDoc.toObject(),
    physicalStockBefore: movementDoc.stockBefore,
    physicalStockAfter: movementDoc.stockAfter,
    quantityDelta: movementDoc.signedQuantity,
    totalCostImpact: movementDoc.totalCost
  };

  return {
    movement: movObj,
    product: productDoc.toObject(),
    deduplicated: false,
    duplicate: false
  };
}

/**
 * C2: Receive goods from a Supplier Shipment (full or partial receipt, with discrepancies/rejections).
 * Only confirmed receipt creates inventory-in movements!
 * Never marks the supplier shipment as paid.
 */
async function receiveSupplierShipment(subdomain, shipmentId, payload = {}, actor = null) {
  const SupplierShipment = getSupplierShipmentModel(subdomain);
  const validShipmentId = validateObjectId(shipmentId, "معرف شحنة المورد");

  const shipmentDoc = await SupplierShipment.findById(validShipmentId);
  if (!shipmentDoc) {
    throw createFinanceError("شحنة المورد غير موجودة", 404);
  }
  if (shipmentDoc.status === "cancelled") {
    throw createFinanceError("لا يمكن استلام بضائع لشحنة ملغاة", 400);
  }
  if (!Array.isArray(shipmentDoc.purchaseLines) || shipmentDoc.purchaseLines.length === 0) {
    throw createFinanceError("لا توجد بنود منتجات مرتبطة بهذه الشحنة لاستلامها", 400);
  }

  const cleanIdempotencyKey = payload.idempotencyKey
    ? String(payload.idempotencyKey).trim()
    : null;

  if (cleanIdempotencyKey) {
    const existingReceipt = (shipmentDoc.receivingRecords || []).find(
      (r) => r.idempotencyKey && r.idempotencyKey === cleanIdempotencyKey
    );
    if (existingReceipt) {
      return {
        shipment: shipmentDoc.toObject(),
        receiptRecord: existingReceipt,
        movements: [],
        deduplicated: true,
        duplicate: true
      };
    }
  }

  const receiptId = `RCV-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;

  const requestedLines = Array.isArray(payload.lines) ? payload.lines : null;
  const receivedAt = payload.receivedAt ? new Date(payload.receivedAt) : new Date();
  const actorId = actor?._id || actor?.userId || null;

  const createdMovements = [];
  const receiptLineRecords = [];

  for (const pLine of shipmentDoc.purchaseLines) {
    const remainingReceivable = Math.max(
      0,
      Number(pLine.quantity || 0) -
        Number(pLine.receivedQuantity || 0) -
        Number(pLine.rejectedQuantity || 0)
    );

    let reqLine = null;
    if (requestedLines) {
      reqLine = requestedLines.find(
        (rl) =>
          (rl.lineId && rl.lineId === pLine.lineId) ||
          (rl.productId && String(rl.productId) === String(pLine.productId))
      );
      if (!reqLine) continue;
    }

    const receivedNowQty = reqLine
      ? Math.max(0, Math.round(Number(reqLine.receivedQuantity ?? reqLine.receivedNowQty ?? 0)))
      : remainingReceivable;

    const rejectedNowQty = reqLine
      ? Math.max(0, Math.round(Number(reqLine.rejectedQuantity ?? reqLine.rejectedNowQty ?? 0)))
      : 0;

    if (receivedNowQty === 0 && rejectedNowQty === 0 && !reqLine?.discrepancyNote) {
      continue;
    }

    if (
      payload.allowOverReceipt !== true &&
      Number(pLine.receivedQuantity || 0) +
        Number(pLine.rejectedQuantity || 0) +
        receivedNowQty +
        rejectedNowQty >
        Number(pLine.quantity || 0)
    ) {
      throw createFinanceError(
        `إجمالي الكمية المستلمة والمرفوضة للبند "${pLine.productNameSnapshot}" يتجاوز الكمية المطلوبة في الشحنة (${pLine.quantity})`,
        400,
        "OVER_RECEIPT_NOT_ALLOWED"
      );
    }

    let movementDoc = null;
    if (receivedNowQty > 0) {
      const lineIdemKey = cleanIdempotencyKey
        ? `ship_rcv:${shipmentDoc._id}:${cleanIdempotencyKey}:${pLine.lineId}`
        : `ship_rcv:${shipmentDoc._id}:${receiptId}:${pLine.lineId}`;

      const movRes = await recordInventoryMovement(
        subdomain,
        {
          productId: pLine.productId,
          movementType: "supplier_receipt",
          direction: "in",
          quantity: receivedNowQty,
          unitCost: pLine.unitCost,
          currency: pLine.currency || shipmentDoc.currency || "EGP",
          originalCurrency:
            pLine.originalCurrency || shipmentDoc.originalCurrency || pLine.currency || "EGP",
          originalUnitCost:
            pLine.originalUnitCost !== null && pLine.originalUnitCost !== undefined
              ? pLine.originalUnitCost
              : pLine.unitCost,
          exchangeRateUsed: pLine.exchangeRateUsed || shipmentDoc.exchangeRateUsed || 1,
          shipmentId: shipmentDoc._id,
          sourceType: "supplier_shipment",
          sourceId: String(shipmentDoc._id),
          sourceLineId: pLine.lineId,
          sourceReference: shipmentDoc.referenceId,
          gridCoords: pLine.gridCoords || reqLine?.gridCoords,
          matrixUpdates: pLine.matrixUpdates || reqLine?.matrixUpdates,
          idempotencyKey: lineIdemKey,
          reason: "استلام بضاعة من شحنة مورد",
          notes: String(reqLine?.discrepancyNote || payload.notes || "").trim(),
          occurredAt: receivedAt
        },
        actor
      );
      movementDoc = movRes.movement;
      createdMovements.push(movementDoc);
    }

    pLine.receivedQuantity = Number(pLine.receivedQuantity || 0) + receivedNowQty;
    pLine.rejectedQuantity = Number(pLine.rejectedQuantity || 0) + rejectedNowQty;
    if (reqLine?.discrepancyNote) {
      pLine.discrepancyNote = String(reqLine.discrepancyNote).trim();
    }

    receiptLineRecords.push({
      lineId: pLine.lineId,
      productId: pLine.productId,
      productNameSnapshot: pLine.productNameSnapshot,
      expectedQty: pLine.quantity,
      receivedNowQty,
      rejectedNowQty,
      unitCost: pLine.unitCost,
      currency: pLine.currency || shipmentDoc.currency || "EGP",
      originalCurrency: pLine.originalCurrency || pLine.currency || "EGP",
      originalUnitCost: pLine.originalUnitCost ?? pLine.unitCost,
      exchangeRateUsed: pLine.exchangeRateUsed || 1,
      discrepancyNote: String(reqLine?.discrepancyNote || "").trim(),
      movementId: movementDoc ? movementDoc._id : null
    });
  }

  if (receiptLineRecords.length === 0) {
    throw createFinanceError(
      "لم يتم تحديد أي كميات مستلمة أو مرفوضة صالحة للتسجيل في هذه العملية",
      400,
      "EMPTY_RECEIPT_LINES"
    );
  }

  const receiptRecord = {
    receiptId,
    idempotencyKey: cleanIdempotencyKey,
    receivedAt,
    receivedBy: actorId,
    notes: String(payload.notes || "").trim(),
    lines: receiptLineRecords
  };

  shipmentDoc.receivingRecords.push(receiptRecord);

  // Determine updated shipment receiving status
  let totalExpected = 0;
  let totalReceived = 0;
  let totalAccounted = 0;
  for (const l of shipmentDoc.purchaseLines) {
    totalExpected += Number(l.quantity || 0);
    totalReceived += Number(l.receivedQuantity || 0);
    totalAccounted += Number(l.receivedQuantity || 0) + Number(l.rejectedQuantity || 0);
  }

  if (totalReceived > 0 && totalAccounted >= totalExpected) {
    shipmentDoc.status = "received";
    shipmentDoc.receivedAt = receivedAt;
  } else if (totalReceived > 0 || totalAccounted > 0) {
    shipmentDoc.status = "partially_received";
  }

  shipmentDoc.updatedBy = actorId;
  await shipmentDoc.save();

  await recordFinanceAudit(subdomain, {
    action: "supplier_shipment_received",
    entityType: "supplier_shipment",
    entityId: String(shipmentDoc._id),
    referenceCode: shipmentDoc.referenceId,
    summary: `استلام بضائع للشحنة ${shipmentDoc.referenceId} (${shipmentDoc.status === "received" ? "استلام كامل" : "استلام جزئي"})`,
    afterState: {
      status: shipmentDoc.status,
      receiptRecord
    },
    actor,
    activityPayload: {
      eventType: "shipment_received",
      shipmentId: shipmentDoc._id,
      note: `استلام مخزني للشحنة ${shipmentDoc.referenceId} (${receiptId})`
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.INVENTORY_SHIPMENT_RECEIVED, {
    subdomain,
    shipment: shipmentDoc.toObject(),
    receiptRecord,
    movements: createdMovements
  });

  return {
    shipment: shipmentDoc.toObject(),
    receiptRecord,
    movements: createdMovements,
    deduplicated: false
  };
}

/**
 * C3: Record sale consumption for an online order or manual sale and return authoritative COGS per item.
 * Idempotent per `(sourceType, sourceId, productId)`.
 */
async function recordSaleConsumption(
  subdomain,
  {
    sourceType = "online_order",
    sourceId,
    sourceReference = "",
    items = [],
    skipProductStockMutation = false,
    occurredAt = new Date()
  },
  actor = null
) {
  const resultsByProductId = {};
  let totalOrderCogs = 0;

  for (const item of items) {
    const productId = String(item.productId || item._id || "");
    if (!productId || !mongoose.isValidObjectId(productId)) continue;
    const qty = Math.max(1, Math.round(Number(item.quantity || 1)));
    const idemKey = `sale_out:${sourceType}:${sourceId}:${productId}`;

    const movRes = await recordInventoryMovement(
      subdomain,
      {
        productId,
        movementType: "customer_sale",
        direction: "out",
        quantity: qty,
        skipProductStockMutation,
        allowNegativeStock: true,
        sourceType,
        sourceId: String(sourceId),
        sourceLineId: productId,
        sourceReference,
        idempotencyKey: idemKey,
        reason: sourceType === "manual_sale" ? "بيع يدوي / مباشر" : "بيع طلب إلكتروني",
        occurredAt
      },
      actor
    );

    const unitCost = roundMoney(Number(movRes.movement.unitCost || 0));
    const lineCostTotal = roundMoney(Number(movRes.movement.totalCost || unitCost * qty));
    resultsByProductId[productId] = {
      unitCost,
      lineCostTotal,
      costingMethodUsed: movRes.movement.costingMethodUsed,
      movementId: movRes.movement._id,
      deduplicated: movRes.deduplicated
    };
    totalOrderCogs = roundMoney(totalOrderCogs + lineCostTotal);
  }

  return {
    itemsCostMap: resultsByProductId,
    totalOrderCogs
  };
}

/**
 * C1/C3: Record stock restoration when an order is cancelled or returned to sellable inventory.
 * Idempotent per `(sourceType, sourceId, movementType, productId)`.
 */
async function recordOrderReturnOrCancelRestore(
  subdomain,
  {
    order,
    movementType = "customer_return", // "customer_return" | "order_cancellation_restore"
    returnToSellableInventory = true,
    skipProductStockMutation = false,
    reason = "",
    occurredAt = new Date()
  },
  actor = null
) {
  if (!returnToSellableInventory) {
    return { movements: [], skipped: true };
  }

  const movements = [];
  for (const item of order.items || []) {
    if (!item.productId || !mongoose.isValidObjectId(item.productId)) continue;
    const qty = Math.max(1, Math.round(Number(item.quantity || 1)));
    const idemKey = `order_restore:${order._id}:${movementType}:${item.productId}`;

    const movRes = await recordInventoryMovement(
      subdomain,
      {
        productId: item.productId,
        movementType,
        direction: "in",
        quantity: qty,
        unitCost: Number(item.costPrice || 0),
        skipProductStockMutation,
        sourceType: "online_order",
        sourceId: String(order._id),
        sourceLineId: String(item.productId),
        sourceReference: order.orderId || String(order._id),
        idempotencyKey: idemKey,
        reason:
          reason ||
          (movementType === "customer_return"
            ? `مرتجع عميل قابل للبيع للطلب ${order.orderId}`
            : `استرجاع مخزون لإلغاء الطلب ${order.orderId}`),
        occurredAt
      },
      actor
    );
    movements.push(movRes.movement);
  }

  return { movements };
}

/**
 * C1/C4: Record damaged or lost stock write-off.
 */
async function recordDamagedOrLostStock(subdomain, payload = {}, actor = null) {
  const reason = String(payload.reason || payload.notes || "").trim();
  if (!reason) {
    throw createFinanceError("يرجى إدخال سبب تسجيل التالف أو الفاقد المخزني", 400);
  }

  const res = await recordInventoryMovement(
    subdomain,
    {
      productId: payload.productId,
      movementType: "damaged_or_lost",
      direction: "out",
      quantity: payload.quantity,
      sourceType: "damage_report",
      sourceId: payload.referenceCode || `DMG-${Date.now()}`,
      sourceReference: payload.referenceCode || "تقرير تالف/فاقد",
      idempotencyKey: payload.idempotencyKey || null,
      reason,
      notes: String(payload.notes || "").trim(),
      occurredAt: payload.occurredAt || new Date()
    },
    actor
  );

  await recordFinanceAudit(subdomain, {
    action: "inventory_damaged_recorded",
    entityType: "inventory_movement",
    entityId: String(res.movement._id),
    referenceCode: res.movement.movementCode,
    summary: `تسجيل تالف/فاقد للمنتج "${res.movement.productNameSnapshot}" بكمية ${res.movement.quantity} (التكلفة: ${res.movement.totalCost})`,
    afterState: res.movement,
    actor,
    activityPayload: {
      eventType: "inventory_damaged_recorded",
      productId: res.movement.productId,
      quantity: res.movement.quantity,
      amount: res.movement.totalCost,
      currency: res.movement.currency,
      note: reason
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.INVENTORY_DAMAGED_RECORDED, {
    subdomain,
    movement: res.movement
  });

  return res;
}

/**
 * C1/C2: Record customer return or supplier return explicitly from Inventory screen.
 */
async function recordExplicitInventoryReturn(subdomain, payload = {}, actor = null) {
  const returnType =
    payload.returnType === "supplier_return" ? "supplier_return" : "customer_return";
  const reason = String(payload.reason || payload.notes || "").trim();
  if (!reason) {
    throw createFinanceError("يرجى إدخال سبب المرتجع المخزني", 400);
  }

  // If customer return is damaged/non-sellable, do not add to sellable stock (or record receive + immediate damage)
  if (returnType === "customer_return" && payload.sellable === false) {
    return {
      skippedSellableStock: true,
      message: "تم تحديد مرتجع العميل كغير قابل لإعادة البيع، لذلك لم تتم إضافته للرصيد القابل للبيع"
    };
  }

  const direction = returnType === "supplier_return" ? "out" : "in";
  const res = await recordInventoryMovement(
    subdomain,
    {
      productId: payload.productId,
      movementType: returnType,
      direction,
      quantity: payload.quantity,
      unitCost: payload.unitCost !== undefined && payload.unitCost !== "" ? Number(payload.unitCost) : undefined,
      shipmentId: payload.shipmentId || null,
      sourceType: returnType,
      sourceId: String(payload.shipmentId || payload.orderId || `RET-${Date.now()}`),
      sourceReference: String(payload.sourceReference || ""),
      idempotencyKey: payload.idempotencyKey || null,
      reason,
      notes: String(payload.notes || "").trim(),
      occurredAt: payload.occurredAt || new Date()
    },
    actor
  );

  // If supplier_return is linked to a supplierShipment, increment returnedToSupplierQuantity on matching line
  if (returnType === "supplier_return" && payload.shipmentId && mongoose.isValidObjectId(payload.shipmentId)) {
    const SupplierShipment = getSupplierShipmentModel(subdomain);
    const shipDoc = await SupplierShipment.findById(payload.shipmentId);
    if (shipDoc) {
      const line = (shipDoc.purchaseLines || []).find(
        (l) => String(l.productId) === String(payload.productId)
      );
      if (line) {
        line.returnedToSupplierQuantity =
          Number(line.returnedToSupplierQuantity || 0) + Number(res.movement.quantity || 0);
        await shipDoc.save();
      }
    }
  }

  await recordFinanceAudit(subdomain, {
    action: returnType === "supplier_return" ? "supplier_return_recorded" : "customer_return_recorded",
    entityType: "inventory_movement",
    entityId: String(res.movement._id),
    referenceCode: res.movement.movementCode,
    summary: `${returnType === "supplier_return" ? "مرتجع لمورد" : "مرتجع عميل للمخزون"} للمنتج "${res.movement.productNameSnapshot}" بكمية ${res.movement.quantity}`,
    afterState: res.movement,
    actor,
    activityPayload: {
      eventType: returnType === "supplier_return" ? "supplier_return_recorded" : "product_returned",
      productId: res.movement.productId,
      quantity: res.movement.quantity,
      amount: res.movement.totalCost,
      currency: res.movement.currency,
      note: reason
    }
  });

  return res;
}

/**
 * C1/C3/C4: Manual stock adjustment / reconciliation with reason and authorization.
 */
async function recordManualStockAdjustment(subdomain, payload = {}, actor = null) {
  const reason = String(payload.reason || "").trim();
  if (!reason) {
    throw createFinanceError("يلزم إدخال سبب واضح ومعتمد لتسوية أو تعديل المخزون يدوياً", 400);
  }

  const Products = getProductsModel(subdomain);
  const validProductId = validateObjectId(payload.productId, "معرف المنتج");
  const productDoc = await Products.findById(validProductId).lean();
  if (!productDoc) {
    throw createFinanceError("المنتج غير موجود", 404);
  }

  let direction = payload.direction;
  let quantity = Number(payload.quantity || 0);

  // Support reconciliation mode where admin specifies `countedPhysicalStock` or `newPhysicalStock`
  const targetPhysical =
    payload.countedPhysicalStock !== undefined && payload.countedPhysicalStock !== null && payload.countedPhysicalStock !== ""
      ? payload.countedPhysicalStock
      : payload.newPhysicalStock;

  if (targetPhysical !== undefined && targetPhysical !== null && targetPhysical !== "") {
    const counted = validateNonNegativeAmount(targetPhysical, "الرصيد الفعلي المعدود");
    const diff = Math.round(counted - Number(productDoc.stockCount || 0));
    if (diff === 0) {
      return {
        unchanged: true,
        product: productDoc,
        message: "الرصيد الفعلي مطابق للرصيد الدفتري الحالي ولا يحتاج لتسوية"
      };
    }
    direction = diff > 0 ? "in" : "out";
    quantity = Math.abs(diff);
  } else {
    if (!["in", "out"].includes(direction)) {
      direction = quantity >= 0 ? "in" : "out";
    }
    quantity = Math.abs(Math.round(quantity));
  }

  if (quantity <= 0) {
    throw createFinanceError("كمية التسوية يجب أن تكون أكبر من صفر", 400);
  }

  const unitCostVal =
    payload.unitCost !== undefined && payload.unitCost !== ""
      ? payload.unitCost
      : payload.unitCostOverride;

  const res = await recordInventoryMovement(
    subdomain,
    {
      productId: validProductId,
      movementType: "manual_adjustment",
      direction,
      quantity,
      unitCost: unitCostVal !== undefined && unitCostVal !== "" ? Number(unitCostVal) : undefined,
      sourceType: "manual_adjustment",
      sourceId: `ADJ-${Date.now()}`,
      sourceReference: String(payload.referenceCode || "تسوية جرد يدوية"),
      idempotencyKey: payload.idempotencyKey || null,
      reason,
      notes: String(payload.notes || "").trim(),
      occurredAt: payload.occurredAt || new Date()
    },
    actor
  );

  await recordFinanceAudit(subdomain, {
    action: "inventory_manual_adjustment",
    entityType: "inventory_movement",
    entityId: String(res.movement._id),
    referenceCode: res.movement.movementCode,
    summary: `تسوية مخزون يدوية (${direction === "in" ? "+" : "-"}${quantity}) للمنتج "${res.movement.productNameSnapshot}" — السبب: ${reason}`,
    beforeState: { stockBefore: res.movement.stockBefore },
    afterState: { stockAfter: res.movement.stockAfter, movement: res.movement },
    actor,
    activityPayload: {
      eventType: "inventory_adjusted",
      productId: res.movement.productId,
      quantity: res.movement.signedQuantity,
      amount: res.movement.totalCost,
      currency: res.movement.currency,
      note: reason
    }
  });

  await emitFinanceEvent(FINANCE_DOMAIN_EVENTS.INVENTORY_MANUAL_ADJUSTMENT, {
    subdomain,
    movement: res.movement
  });

  return res;
}

/**
 * C1: Reserve or release stock without mutating physical `stockCount`.
 */
async function updateStockReservation(subdomain, payload = {}, actor = null) {
  let action = payload.action === "release" ? "reservation_release" : "reservation_hold";
  let qty = payload.quantity;
  if (payload.quantityDelta !== undefined && payload.quantityDelta !== null) {
    const delta = Number(payload.quantityDelta);
    action = delta < 0 ? "reservation_release" : "reservation_hold";
    qty = Math.abs(delta);
  }
  const res = await recordInventoryMovement(
    subdomain,
    {
      productId: payload.productId,
      movementType: action,
      quantity: qty,
      sourceType: "reservation",
      sourceId: String(payload.sourceId || payload.referenceCode || ""),
      sourceReference: String(payload.sourceReference || payload.referenceCode || ""),
      idempotencyKey: payload.idempotencyKey || null,
      reason: String(payload.reason || (action === "reservation_hold" ? "حجز مخزون" : "فك حجز مخزون"))
    },
    actor
  );
  const physicalStock = Number(res.product.stockCount || 0);
  const reservedStock = Number(res.product.reservedStock || 0);
  const availableStock = Math.max(0, physicalStock - reservedStock);
  return {
    ...res,
    physicalStock,
    reservedStock,
    availableStock
  };
}

/**
 * C4: List filterable inventory movements.
 */
async function listInventoryMovements(
  subdomain,
  {
    productId = "",
    movementType = "",
    sourceType = "",
    startDate = "",
    endDate = "",
    page = 1,
    limit = 50
  } = {}
) {
  const InventoryMovement = getInventoryMovementModel(subdomain);
  const query = {};

  if (productId && mongoose.isValidObjectId(productId)) {
    query.productId = new mongoose.Types.ObjectId(productId);
  }
  if (movementType && movementType !== "all") {
    query.movementType = movementType;
  }
  if (sourceType && sourceType !== "all") {
    query.sourceType = sourceType;
  }
  if (startDate || endDate) {
    query.occurredAt = {};
    if (startDate) query.occurredAt.$gte = new Date(startDate);
    if (endDate) query.occurredAt.$lte = new Date(endDate);
  }

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));

  const [total, movements] = await Promise.all([
    InventoryMovement.countDocuments(query),
    InventoryMovement.find(query)
      .sort({ occurredAt: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean()
  ]);

  return {
    movements,
    total,
    page: p,
    pages: Math.ceil(total / l) || 1
  };
}

/**
 * C4: Inventory Valuation, Current Stock Availability, Low-Stock & Damaged Summary.
 * Keeps distinct values for:
 * - Historical purchase cost (`lastPurchaseCost`)
 * - Inventory book cost under chosen valuation policy (`inventoryBookUnitCost`)
 * - Current replacement cost (`replacementUnitCost`)
 * - Current public selling price (`price`)
 */
async function getInventoryValuationReport(subdomain, { search = "", lowStockOnly = false } = {}) {
  const Products = getProductsModel(subdomain);
  const InventoryMovement = getInventoryMovementModel(subdomain);
  const settings = await getFinanceSettings(subdomain);

  const costingMethod = settings?.inventoryConfig?.costingMethod || "weighted_average";
  const defaultThreshold = Number(settings?.inventoryConfig?.lowStockThresholdDefault ?? 5);

  const query = {};
  if (search && String(search).trim()) {
    const rx = { $regex: String(search).trim(), $options: "i" };
    query.$or = [{ name: rx }, { groupCode: rx }];
  }

  const products = await Products.find(query).sort({ name: 1 }).lean();

  let totalPhysicalUnits = 0;
  let totalReservedUnits = 0;
  let totalAvailableUnits = 0;
  let totalBookValuation = 0;
  let totalReplacementValuation = 0;
  let totalRetailValue = 0;
  const lowStockItems = [];
  const valuationRows = [];

  for (const p of products) {
    const physicalStock = Math.max(0, Number(p.stockCount || 0));
    const reservedStock = Math.max(0, Number(p.reservedStock || 0));
    const availableStock = Math.max(0, physicalStock - reservedStock);
    const threshold =
      p.lowStockThreshold !== undefined && p.lowStockThreshold !== null
        ? Number(p.lowStockThreshold)
        : defaultThreshold;

    const historicalPurchaseCost =
      p.lastPurchaseCost !== null && p.lastPurchaseCost !== undefined
        ? roundMoney(Number(p.lastPurchaseCost))
        : roundMoney(Number(p.costPrice || 0));

    const bookUnitCost = resolveBaselineUnitCost(p);

    const replacementUnitCost =
      p.replacementUnitCost !== null && p.replacementUnitCost !== undefined
        ? roundMoney(Number(p.replacementUnitCost))
        : historicalPurchaseCost || bookUnitCost;

    const sellingPrice = roundMoney(Number(p.price || 0));
    const totalBookValue = roundMoney(physicalStock * bookUnitCost);
    const totalReplacementValue = roundMoney(physicalStock * replacementUnitCost);
    const totalSellingValue = roundMoney(physicalStock * sellingPrice);
    const isLowStock = availableStock <= threshold;

    const row = {
      productId: String(p._id),
      name: p.name,
      groupCode: p.groupCode || "",
      physicalStock,
      reservedStock,
      availableStock,
      lowStockThreshold: threshold,
      isLowStock,
      costingMethod,
      historicalPurchaseCost,
      inventoryBookUnitCost: bookUnitCost,
      replacementUnitCost,
      sellingPrice,
      totalBookValue,
      totalReplacementValue,
      totalSellingValue,
      lastPurchaseCurrency: p.lastPurchaseCurrency || "EGP",
      lastPurchaseOriginalUnitCost: p.lastPurchaseOriginalUnitCost ?? historicalPurchaseCost,
      lastPurchaseExchangeRate: p.lastPurchaseExchangeRate || 1
    };

    if (isLowStock) {
      lowStockItems.push(row);
    }

    if (!lowStockOnly || isLowStock) {
      valuationRows.push(row);
    }

    totalPhysicalUnits += physicalStock;
    totalReservedUnits += reservedStock;
    totalAvailableUnits += availableStock;
    totalBookValuation = roundMoney(totalBookValuation + totalBookValue);
    totalReplacementValuation = roundMoney(totalReplacementValuation + totalReplacementValue);
    totalRetailValue = roundMoney(totalRetailValue + totalSellingValue);
  }

  // Aggregate damaged/lost and returns totals
  const damageAgg = await InventoryMovement.aggregate([
    { $match: { movementType: "damaged_or_lost" } },
    {
      $group: {
        _id: null,
        totalDamagedUnits: { $sum: "$quantity" },
        totalDamagedCost: { $sum: "$totalCost" },
        incidentsCount: { $sum: 1 }
      }
    }
  ]);

  const damagedSummary = damageAgg[0] || {
    totalDamagedUnits: 0,
    totalDamagedCost: 0,
    incidentsCount: 0
  };

  return {
    costingPolicy: {
      costingMethod,
      labelAr:
        costingMethod === "fifo"
          ? "الوارد أولاً يصرف أولاً (FIFO)"
          : "المتوسط المرجح للتكلفة (Weighted Average Cost)"
    },
    summary: {
      productsCount: products.length,
      totalPhysicalUnits,
      totalReservedUnits,
      totalAvailableUnits,
      totalBookValuation,
      totalReplacementValuation,
      totalRetailValue,
      estimatedUnrealizedGrossMargin: roundMoney(totalRetailValue - totalBookValuation),
      lowStockCount: lowStockItems.length,
      damagedUnitsTotal: damagedSummary.totalDamagedUnits,
      damagedCostTotal: roundMoney(damagedSummary.totalDamagedCost),
      damagedIncidentsCount: damagedSummary.incidentsCount
    },
    items: valuationRows,
    lowStockItems
  };
}

module.exports = {
  implemented: true,
  recordInventoryMovement,
  receiveSupplierShipment,
  recordSaleConsumption,
  recordOrderReturnOrCancelRestore,
  recordDamagedOrLostStock,
  recordExplicitInventoryReturn,
  recordManualStockAdjustment,
  updateStockReservation,
  listInventoryMovements,
  getInventoryValuationReport
};
