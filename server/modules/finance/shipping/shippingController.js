/**
 * Phase A — Shipping & Pickup Express Controllers (Public & Admin)
 */

const shippingService = require("./shippingService");
const { getFinanceSettings, updateFinanceSettings } = require("../core/settings/financeSettingsService");

// Public Endpoints (Checkout Address Classification & Shipping Preview)
exports.getPublicShippingOptions = async (req, res, next) => {
  try {
    const [classes, financeSettings] = await Promise.all([
      shippingService.listShippingClasses(req.subdomain, { activeOnly: true }),
      getFinanceSettings(req.subdomain)
    ]);

    // Strip internal actualCost from public customer-facing response!
    const publicClasses = classes.map((c) => ({
      _id: c._id,
      code: c.code,
      name: c.name,
      description: c.description,
      customerPrice: c.customerPrice,
      defaultCalculationMode: c.defaultCalculationMode,
      coverageText: c.coverageText,
      coverageRegions: c.coverageRegions
    }));

    res.json({
      done: true,
      shippingClasses: publicClasses,
      pickup: financeSettings.pickup,
      shippingConfig: {
        allowCustomerClassSelection: financeSettings.shippingConfig.allowCustomerClassSelection,
        requireCoverageMatch: financeSettings.shippingConfig.requireCoverageMatch,
        addQuantityBehavior: financeSettings.shippingConfig.addQuantityBehavior
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.classifyAddressPublic = async (req, res, next) => {
  try {
    const { address = "", city = "" } = req.body || {};
    const financeSettings = await getFinanceSettings(req.subdomain);
    const result = await shippingService.classifyCustomerAddress(req.subdomain, {
      address,
      city,
      adminData: req.adminData,
      allowAiFallback: financeSettings.shippingConfig.useAiAddressFallback
    });

    const sanitizeClass = (cls) =>
      cls
        ? {
            _id: cls._id,
            code: cls.code,
            name: cls.name,
            description: cls.description,
            customerPrice: cls.customerPrice,
            defaultCalculationMode: cls.defaultCalculationMode,
            coverageText: cls.coverageText
          }
        : null;

    res.json({
      done: true,
      hasConfiguredClasses: result.hasConfiguredClasses,
      matchedClass: sanitizeClass(result.matchedClass),
      suggestedClass: sanitizeClass(result.suggestedClass),
      isAiSuggestion: Boolean(result.isAiSuggestion),
      ambiguous: result.ambiguous,
      requiresCustomerSelection: result.requiresCustomerSelection,
      confidence: result.confidence || "none",
      matchMethod: result.matchMethod,
      eligibleClasses: (result.eligibleClasses || []).map(sanitizeClass),
      allActiveClasses: (result.allActiveClasses || []).map(sanitizeClass),
      message: result.message
    });
  } catch (err) {
    next(err);
  }
};

exports.previewCheckoutShippingPublic = async (req, res, next) => {
  try {
    const result = await shippingService.previewShippingQuote(
      req.subdomain,
      req.body || {},
      req.adminData
    );

    // Strip internal carrier cost fields from public checkout preview
    const publicLines = (result.quote.lines || []).map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      requiresShipping: l.requiresShipping,
      shippingClassId: l.shippingClassId,
      shippingClassCode: l.shippingClassCode,
      shippingClassName: l.shippingClassName,
      shippingMode: l.shippingMode,
      isShippingBaseLine: l.isShippingBaseLine,
      unitCustomerShipping: l.unitCustomerShipping,
      lineCustomerShipping: l.lineCustomerShipping
    }));

    res.json({
      done: true,
      deliveryMethod: result.quote.deliveryMethod,
      selectedClassId: result.quote.selectedClassId,
      selectedClassCode: result.quote.selectedClassCode,
      selectedClassName: result.quote.selectedClassName,
      matchMethod: result.quote.matchMethod,
      baseShippingAmount: result.quote.baseShippingAmount,
      additiveShippingAmount: result.quote.additiveShippingAmount,
      customerShippingCharge: result.quote.customerShippingCharge,
      freeShippingApplied: result.quote.freeShippingApplied,
      lines: publicLines,
      pickup: result.pickupConfig
    });
  } catch (err) {
    next(err);
  }
};

// Admin Endpoints (Full CRUD, Simulator with actual carrier costs, Actual Cost Recording, Pickup Completion)
exports.listAdminShippingClasses = async (req, res, next) => {
  try {
    const classes = await shippingService.listShippingClasses(req.subdomain, {
      activeOnly: req.query.activeOnly === "true"
    });
    res.json({ done: true, shippingClasses: classes });
  } catch (err) {
    next(err);
  }
};

exports.createAdminShippingClass = async (req, res, next) => {
  try {
    const shippingClass = await shippingService.createShippingClass(
      req.subdomain,
      req.body || {},
      req.user
    );
    res.status(201).json({
      done: true,
      shippingClass,
      message: "تم إضافة فئة الشحن بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updateAdminShippingClass = async (req, res, next) => {
  try {
    const shippingClass = await shippingService.updateShippingClass(
      req.subdomain,
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      done: true,
      shippingClass,
      message: "تم تحديث فئة الشحن بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleAdminShippingClass = async (req, res, next) => {
  try {
    const shippingClass = await shippingService.toggleShippingClassStatus(
      req.subdomain,
      req.params.id,
      req.body?.active,
      req.user
    );
    res.json({
      done: true,
      shippingClass,
      message: shippingClass.active ? "تم تفعيل فئة الشحن" : "تم تعطيل فئة الشحن"
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteAdminShippingClass = async (req, res, next) => {
  try {
    const result = await shippingService.deleteShippingClass(
      req.subdomain,
      req.params.id,
      req.user
    );
    res.json({
      done: true,
      ...result,
      message: "تم حذف فئة الشحن بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.previewAdminShippingCalculation = async (req, res, next) => {
  try {
    const result = await shippingService.previewShippingQuote(
      req.subdomain,
      { ...(req.body || {}), allowPickupPreview: true },
      req.adminData
    );
    res.json({
      done: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

exports.recordAdminOrderActualShippingCost = async (req, res, next) => {
  try {
    const order = await shippingService.recordOrderActualShippingCost(req.subdomain, {
      orderId: req.params.orderId || req.body?.orderId,
      actualCarrierCost: req.body?.actualCarrierCost,
      carrierName: req.body?.carrierName,
      trackingReference: req.body?.trackingReference,
      note: req.body?.note,
      actor: req.user
    });
    res.json({
      done: true,
      order,
      message: "تم تسجيل تكلفة الشحن الفعلية وحفظها في السجل المالي بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.completeAdminOrderPickup = async (req, res, next) => {
  try {
    const order = await shippingService.completeOrderPickup(req.subdomain, {
      orderId: req.params.orderId || req.body?.orderId,
      note: req.body?.note,
      actor: req.user
    });
    res.json({
      done: true,
      order,
      message: "تم تأكيد استلام العميل للطلب من الفرع وإتمام الطلب بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.getAdminFinanceSettings = async (req, res, next) => {
  try {
    const settings = await getFinanceSettings(req.subdomain);
    res.json({ done: true, financeSettings: settings, settings });
  } catch (err) {
    next(err);
  }
};

exports.updateAdminFinanceSettings = async (req, res, next) => {
  try {
    const settings = await updateFinanceSettings(req.subdomain, req.body || {}, req.user);
    res.json({
      done: true,
      financeSettings: settings,
      settings,
      message: "تم تحديث إعدادات ومستوى النظام المالي بنجاح"
    });
  } catch (err) {
    next(err);
  }
};
