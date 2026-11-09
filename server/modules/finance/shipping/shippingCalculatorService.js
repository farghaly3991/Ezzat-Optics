/**
 * Phase A — Authoritative Cart & Order Shipping Calculator Service
 *
 * Implements the exact MAX/ADD cart shipping calculation algorithm (Section 4.3):
 * 1. Obtain the applicable customer-facing shipping price for every shippable cart line
 *    using the server's current valid shipping configuration.
 * 2. Find the cart line with the highest applicable customer-facing shipping price.
 *    Use that price once as the initial shipping value.
 * 3. Exclude that initial base contribution from further addition so it is never counted twice.
 * 4. Iterate over the remaining cart lines:
 *    - For a `MAX` line, add zero.
 *    - For an `ADD` line, add that line's applicable shipping charge to the initial value.
 * 5. The final customer shipping charge is the initial value plus all eligible `ADD` contributions.
 * 6. If no products require shipping, the shipping charge is zero.
 *
 * Quantity Handling (Documented & Tested):
 * - In the existing store (`StoreContext.jsx` & `publicOrders.js`), each unique product in the cart
 *   is represented as a single cart line `{ productId, quantity }`.
 * - This calculator first consolidates any duplicate `productId` entries into a single cart line
 *   with summed `quantity` so input representation never skews results.
 * - For `MAX` lines: `quantity > 1` never multiplies the base shipping charge.
 * - For `ADD` lines:
 *   - Default mode (`addQuantityBehavior: "per_line"`): consistent with the existing store's
 *     cart-line semantics and steps 1–5 above, each `ADD` cart line contributes its applicable
 *     shipping charge once per cart line.
 *   - Optional mode (`addQuantityBehavior: "per_unit"`): when explicitly enabled in settings/options,
 *     an `ADD` line contributes per unit (`unitCustomerShipping * quantity`, or `unitCustomerShipping * (quantity - 1)`
 *     if 1 unit of that `ADD` line was already used as the initial highest base).
 */

const mongoose = require("mongoose");
const getShippingClassModel = require("./shippingClassModel");
const getProductsModel = require("../../products/productModel");
const {
  classifyCustomerAddress,
  validateShippingClassForAddress,
  buildClassCoverageIndex,
  scoreClassAgainstAddress,
  normalizeGeoText,
  detectDictionaryLocations
} = require("./addressCoverageService");
const { roundMoney, createFinanceError } = require("../shared/validators");

/**
 * Pure algorithmic calculation over normalized cart lines (can be unit-tested directly or called by DB service).
 */
function runMaxAddShippingAlgorithm(normalizedLines = [], options = {}) {
  const {
    deliveryMethod = "delivery",
    addQuantityBehavior = "per_line",
    freeShippingThreshold = 0,
    respectFreeShippingThreshold = false,
    merchandiseSubtotal = 0
  } = options;

  if (deliveryMethod === "pickup") {
    const pickupLines = normalizedLines.map((line) => ({
      ...line,
      isShippable: false,
      isShippingBaseLine: false,
      lineCustomerShipping: 0,
      lineEstimatedCarrierCost: 0
    }));
    return {
      deliveryMethod: "pickup",
      shippableLinesCount: 0,
      baseLineProductId: "",
      baseShippingAmount: 0,
      additiveShippingAmount: 0,
      customerShippingCharge: 0,
      estimatedCarrierCost: 0,
      freeShippingApplied: false,
      addQuantityBehavior,
      lines: pickupLines
    };
  }

  // Filter shippable lines
  const shippableIndices = [];
  normalizedLines.forEach((line, idx) => {
    if (line.requiresShipping !== false) {
      shippableIndices.push(idx);
    }
  });

  if (shippableIndices.length === 0) {
    const zeroLines = normalizedLines.map((line) => ({
      ...line,
      isShippable: false,
      isShippingBaseLine: false,
      lineCustomerShipping: 0,
      lineEstimatedCarrierCost: 0
    }));
    return {
      deliveryMethod: "delivery",
      shippableLinesCount: 0,
      baseLineProductId: "",
      baseShippingAmount: 0,
      additiveShippingAmount: 0,
      customerShippingCharge: 0,
      estimatedCarrierCost: 0,
      freeShippingApplied: false,
      addQuantityBehavior,
      lines: zeroLines
    };
  }

  // Step 2: Find the shippable cart line with the highest applicable customer-facing shipping price.
  // Tie-breaking rule:
  // When two shippable lines tie for the highest customer shipping price, prefer a `MAX` line over
  // an `ADD` line as the initial base so that the `ADD` line's additive charge is not lost.
  // If modes are also equal, preserve original cart order (lowest index).
  let baseLineIndex = shippableIndices[0];
  for (const idx of shippableIndices) {
    const candidate = normalizedLines[idx];
    const currentBest = normalizedLines[baseLineIndex];

    const candPrice = roundMoney(candidate.unitCustomerShipping || 0);
    const bestPrice = roundMoney(currentBest.unitCustomerShipping || 0);

    if (candPrice > bestPrice) {
      baseLineIndex = idx;
    } else if (candPrice === bestPrice && idx !== baseLineIndex) {
      const candMode = candidate.shippingMode === "ADD" ? "ADD" : "MAX";
      const bestMode = currentBest.shippingMode === "ADD" ? "ADD" : "MAX";
      if (candMode === "MAX" && bestMode === "ADD") {
        baseLineIndex = idx;
      }
    }
  }

  const baseLine = normalizedLines[baseLineIndex];
  const baseShippingAmount = roundMoney(baseLine.unitCustomerShipping || 0);
  const baseCarrierCost = roundMoney(baseLine.unitEstimatedCarrierCost || 0);

  // Steps 3 & 4: Exclude initial base contribution so it is never counted twice,
  // and iterate over remaining lines (MAX -> +0, ADD -> +applicable charge).
  let additiveShippingAmount = 0;
  let additiveCarrierCost = 0;

  const computedLines = normalizedLines.map((line, idx) => {
    if (line.requiresShipping === false) {
      return {
        ...line,
        isShippable: false,
        isShippingBaseLine: false,
        lineCustomerShipping: 0,
        lineEstimatedCarrierCost: 0
      };
    }

    const qty = Math.max(1, Number(line.quantity || 1));
    const unitCust = roundMoney(line.unitCustomerShipping || 0);
    const unitCarrier = roundMoney(line.unitEstimatedCarrierCost || 0);
    const mode = line.shippingMode === "ADD" ? "ADD" : "MAX";

    if (idx === baseLineIndex) {
      // Base line: its initial unit contribution is `baseShippingAmount`.
      // In default "per_line" mode, the base line contributes no further ADD amount.
      // In optional "per_unit" mode, if the base line itself is ADD with qty > 1, remaining (qty - 1) units add.
      const extraUnits = mode === "ADD" && addQuantityBehavior === "per_unit" ? Math.max(0, qty - 1) : 0;
      const extraCust = roundMoney(unitCust * extraUnits);
      const extraCarrier = roundMoney(unitCarrier * extraUnits);

      additiveShippingAmount = roundMoney(additiveShippingAmount + extraCust);
      additiveCarrierCost = roundMoney(additiveCarrierCost + extraCarrier);

      return {
        ...line,
        shippingMode: mode,
        isShippable: true,
        isShippingBaseLine: true,
        lineCustomerShipping: roundMoney(baseShippingAmount + extraCust),
        lineEstimatedCarrierCost: roundMoney(baseCarrierCost + extraCarrier)
      };
    }

    if (mode === "MAX") {
      return {
        ...line,
        shippingMode: "MAX",
        isShippable: true,
        isShippingBaseLine: false,
        lineCustomerShipping: 0,
        lineEstimatedCarrierCost: 0
      };
    }

    // Mode === "ADD" on a non-base line
    const multiplier = addQuantityBehavior === "per_unit" ? qty : 1;
    const lineCust = roundMoney(unitCust * multiplier);
    const lineCarrier = roundMoney(unitCarrier * multiplier);

    additiveShippingAmount = roundMoney(additiveShippingAmount + lineCust);
    additiveCarrierCost = roundMoney(additiveCarrierCost + lineCarrier);

    return {
      ...line,
      shippingMode: "ADD",
      isShippable: true,
      isShippingBaseLine: false,
      lineCustomerShipping: lineCust,
      lineEstimatedCarrierCost: lineCarrier
    };
  });

  let customerShippingCharge = roundMoney(baseShippingAmount + additiveShippingAmount);
  const estimatedCarrierCost = roundMoney(baseCarrierCost + additiveCarrierCost);
  let freeShippingApplied = false;

  if (
    respectFreeShippingThreshold &&
    Number(freeShippingThreshold) > 0 &&
    Number(merchandiseSubtotal) >= Number(freeShippingThreshold)
  ) {
    customerShippingCharge = 0;
    freeShippingApplied = true;
  }

  return {
    deliveryMethod: "delivery",
    shippableLinesCount: shippableIndices.length,
    baseLineProductId: String(baseLine.productId || ""),
    baseShippingAmount,
    additiveShippingAmount,
    customerShippingCharge,
    estimatedCarrierCost,
    freeShippingApplied,
    addQuantityBehavior,
    lines: computedLines
  };
}

/**
 * Authoritative server-side cart/order shipping calculation against tenant database.
 */
async function calculateOrderShippingAuthoritative(subdomain, {
  items = [],
  deliveryMethod = "delivery",
  address = "",
  city = "",
  selectedShippingClassId = null,
  selectedShippingClassCode = null,
  requireValidClassWhenConfigured = false,
  addQuantityBehavior = null,
  respectFreeShippingThreshold = null,
  freeShippingThreshold = null,
  fallbackShippingCost = 50,
  adminData = null,
  allowAiFallback = true,
  aiClassifierFn = null
} = {}) {
  const cleanDeliveryMethod = deliveryMethod === "pickup" ? "pickup" : "delivery";

  const Products = getProductsModel(subdomain);
  const ShippingClass = getShippingClassModel(subdomain);

  const allClasses = await ShippingClass.find().lean();
  const activeClasses = allClasses.filter((c) => c.active);
  const classMapById = new Map(allClasses.map((c) => [String(c._id), c]));
  const classMapByCode = new Map(allClasses.map((c) => [String(c.code).toUpperCase(), c]));

  // 1. Consolidate cart items by productId (preserving order of first appearance)
  const consolidatedMap = new Map();
  for (const raw of Array.isArray(items) ? items : []) {
    const pid = String(raw.productId || raw._id || "").trim();
    const qty = Math.max(1, Number(raw.quantity || 1));
    const key = pid || `inline_${consolidatedMap.size}`;
    if (consolidatedMap.has(key)) {
      const existing = consolidatedMap.get(key);
      existing.quantity += qty;
    } else {
      consolidatedMap.set(key, { ...raw, productId: pid, quantity: qty });
    }
  }

  const consolidatedInputs = Array.from(consolidatedMap.values());

  // 2. Resolve destination shipping class when deliveryMethod === "delivery"
  let destinationClass = null;
  let matchMethod = cleanDeliveryMethod === "pickup" ? "pickup" : "default_fallback";
  let addressClassification = null;

  if (cleanDeliveryMethod === "delivery") {
    if (selectedShippingClassId || selectedShippingClassCode) {
      destinationClass = await validateShippingClassForAddress(subdomain, {
        shippingClassId: selectedShippingClassId,
        shippingClassCode: selectedShippingClassCode,
        address,
        city,
        requireCoverageMatch: true
      });
      matchMethod = "customer_selected";
    } else if (activeClasses.length > 0 && (address || city)) {
      addressClassification = await classifyCustomerAddress(subdomain, {
        address,
        city,
        adminData,
        allowAiFallback,
        aiClassifierFn
      });
      if (addressClassification.matchedClass) {
        destinationClass = addressClassification.matchedClass;
        matchMethod = addressClassification.matchMethod || "deterministic";
      }
    }
  }

  const combinedAddressNorm = normalizeGeoText([city, address].filter(Boolean).join(" ، "));
  const addressDict = detectDictionaryLocations([city, address].filter(Boolean).join(" ، "));

  // 3. Resolve each cart line against DB Product & ShippingClass
  const normalizedLines = [];
  let merchandiseSubtotal = 0;

  for (const item of consolidatedInputs) {
    let prod = null;
    if (item.productDoc && item.productDoc._id) {
      prod = item.productDoc;
    } else if (item.productId && mongoose.isValidObjectId(item.productId)) {
      prod = await Products.findById(item.productId).lean();
    }

    // Allow inline product specs for preview/calculator unit tests if no DB doc exists
    const effectiveProd = prod || item;
    if (!effectiveProd) continue;

    const unitPrice = roundMoney(Number(effectiveProd.price ?? item.price ?? 0));
    const costPrice = roundMoney(Number(effectiveProd.costPrice ?? item.costPrice ?? 0));
    const oldPrice = roundMoney(Number(effectiveProd.oldPrice ?? item.oldPrice ?? 0));
    const qty = Math.max(1, Number(item.quantity || 1));
    merchandiseSubtotal = roundMoney(merchandiseSubtotal + unitPrice * qty);

    const requiresShipping = effectiveProd.requiresShipping !== false;
    if (!requiresShipping || cleanDeliveryMethod === "pickup") {
      normalizedLines.push({
        productId: String(effectiveProd._id || item.productId || ""),
        name: effectiveProd.name || item.name || "منتج",
        price: unitPrice,
        oldPrice,
        costPrice,
        quantity: qty,
        image: effectiveProd.images?.[0] || item.image || "",
        requiresShipping: false,
        shippingClassId: null,
        shippingClassCode: "",
        shippingClassName: "",
        shippingMode: "NONE",
        unitCustomerShipping: 0,
        unitEstimatedCarrierCost: 0
      });
      continue;
    }

    // Resolve product's associated shipping class
    let productClass = null;
    const rawProdClassId = effectiveProd.shippingClassId?._id || effectiveProd.shippingClassId;
    if (rawProdClassId && classMapById.has(String(rawProdClassId))) {
      const candidate = classMapById.get(String(rawProdClassId));
      if (candidate.active) {
        productClass = candidate;
      }
    } else if (effectiveProd.shippingClassCode && classMapByCode.has(String(effectiveProd.shippingClassCode).toUpperCase())) {
      const candidate = classMapByCode.get(String(effectiveProd.shippingClassCode).toUpperCase());
      if (candidate.active) {
        productClass = candidate;
      }
    }

    // Determine effective class for this line:
    // - If the product is explicitly associated with an active shipping class (`productClass`),
    //   use `productClass` so mixed-class carts (e.g., Product A = 40 MAX, Product B = 65 MAX, Product C = 30 ADD -> 95)
    //   use each product's configured shipping class price.
    // - If the product has no shipping class assigned, use the destination shipping class
    //   resolved from the customer's address or explicit checkout selection.
    const applicableClass = productClass || destinationClass;

    // If active shipping classes exist in the store, none is linked to the product,
    // and destination address could not be matched to any class:
    if (!applicableClass && activeClasses.length > 0 && requireValidClassWhenConfigured) {
      throw createFinanceError(
        addressClassification?.message ||
          "يرجى اختيار فئة الشحن المناسبة لوجهتك أو توضيح العنوان (المحافظة والمدينة) لإتمام الطلب",
        400,
        "SHIPPING_CLASS_REQUIRED"
      );
    }

    const rawMode =
      effectiveProd.shippingMode ||
      applicableClass?.defaultCalculationMode ||
      "MAX";
    const shippingMode = rawMode === "ADD" ? "ADD" : "MAX";

    // Resolve unit shipping price & carrier cost
    let unitCustomerShipping = 0;
    let unitEstimatedCarrierCost = 0;

    if (applicableClass) {
      unitCustomerShipping = roundMoney(Number(applicableClass.customerPrice || 0));
      unitEstimatedCarrierCost = roundMoney(Number(applicableClass.actualCost || 0));
    } else if (typeof effectiveProd.customerShippingPrice === "number") {
      unitCustomerShipping = roundMoney(effectiveProd.customerShippingPrice);
      unitEstimatedCarrierCost = roundMoney(Number(effectiveProd.actualShippingCost || 0));
    } else if (activeClasses.length === 0) {
      // Legacy fallback when store has no shipping classes configured yet
      unitCustomerShipping = roundMoney(Number(fallbackShippingCost ?? 50));
      unitEstimatedCarrierCost = 0;
    }

    normalizedLines.push({
      productId: String(effectiveProd._id || item.productId || ""),
      name: effectiveProd.name || item.name || "منتج",
      price: unitPrice,
      oldPrice,
      costPrice,
      quantity: qty,
      image: effectiveProd.images?.[0] || item.image || "",
      requiresShipping: true,
      shippingClassId: applicableClass ? String(applicableClass._id) : null,
      shippingClassCode: applicableClass ? applicableClass.code : "",
      shippingClassName: applicableClass ? applicableClass.name : "",
      shippingMode,
      unitCustomerShipping,
      unitEstimatedCarrierCost
    });
  }

  const effectiveAddQtyBehavior = addQuantityBehavior === "per_unit" ? "per_unit" : "per_line";
  const calcResult = runMaxAddShippingAlgorithm(normalizedLines, {
    deliveryMethod: cleanDeliveryMethod,
    addQuantityBehavior: effectiveAddQtyBehavior,
    freeShippingThreshold: Number(freeShippingThreshold || 0),
    respectFreeShippingThreshold: Boolean(respectFreeShippingThreshold),
    merchandiseSubtotal
  });

  // Determine primary class summary for order-level snapshot
  const baseLineObj = calcResult.lines.find((l) => l.isShippingBaseLine) || null;
  const primaryClassId = destinationClass
    ? String(destinationClass._id)
    : baseLineObj?.shippingClassId || null;
  const primaryClassCode = destinationClass
    ? destinationClass.code
    : baseLineObj?.shippingClassCode || "";
  const primaryClassName = destinationClass
    ? destinationClass.name
    : baseLineObj?.shippingClassName || "";

  return {
    ...calcResult,
    merchandiseSubtotal,
    selectedClassId: primaryClassId,
    selectedClassCode: primaryClassCode,
    selectedClassName: primaryClassName,
    matchMethod,
    addressClassification
  };
}

module.exports = {
  runMaxAddShippingAlgorithm,
  calculateOrderShippingAuthoritative
};
