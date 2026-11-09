/**
 * Multi-Supplier Waterfall Procurement Controller
 */

const supplyWaterfallService = require("./supplyWaterfallService");
const getProcurementReorderModel = require("./procurementReorderModel");
const { buildWhatsAppDirectLink } = require("../../product-requests/notificationService");

exports.redirectToReorderWhatsApp = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { reorderCode } = req.params;
    const ProcurementReorder = getProcurementReorderModel(subdomain);
    const reorder = await ProcurementReorder.findOne({ reorderCode: String(reorderCode || "").toUpperCase().trim() }).lean();
    if (!reorder) {
      return res.status(404).send("أمر التوريد غير موجود");
    }
    const phone = reorder.supplierWhatsapp || reorder.supplierPhone || "201099887766";
    const waUrl = buildWhatsAppDirectLink(phone, reorder.messageText || `أمر توريد رقم ${reorder.reorderCode}`);
    return res.redirect(302, waUrl);
  } catch (err) {
    console.error("[REDIRECT_REORDER_WA_ERR]", err);
    return res.status(500).send("تعذر توجيه رابط واتساب");
  }
};

exports.createWaterfallRequest = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const actor = req.user ? { userId: req.user._id, role: req.user.role, fullname: req.user.fullname } : null;
    const result = await supplyWaterfallService.createWaterfallRequest(subdomain, req.body, actor);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error("[CREATE_WATERFALL_ERR]", err);
    return res.status(400).json({ error: err.message || "تعذر إنشاء طلب التوريد" });
  }
};

exports.getSupplyRequestByToken = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { token } = req.params;
    const data = await supplyWaterfallService.getSupplyRequestByToken(subdomain, token);
    return res.json({ success: true, request: data });
  } catch (err) {
    console.error("[GET_WATERFALL_TOKEN_ERR]", err);
    return res.status(404).json({ error: err.message || "طلب التوريد غير متوفر أو الرابط غير صالح" });
  }
};

exports.respondSupplyRequest = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { token } = req.params;
    const { action, notes } = req.body;
    const result = await supplyWaterfallService.respondSupplyRequest(subdomain, token, { action, notes });
    return res.json(result);
  } catch (err) {
    console.error("[RESPOND_WATERFALL_ERR]", err);
    return res.status(400).json({ error: err.message || "تعذر تسجيل الرد على طلب التوريد" });
  }
};

exports.listWaterfallRequests = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const { status, limit, page, search } = req.query;
    const data = await supplyWaterfallService.listWaterfallRequests(subdomain, { status, limit, page, search });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("[LIST_WATERFALL_ERR]", err);
    return res.status(500).json({ error: err.message || "تعذر استرجاع طلبات التوريد" });
  }
};

exports.getSupplierPerformanceStats = async (req, res) => {
  try {
    const subdomain = req.subdomain;
    const stats = await supplyWaterfallService.getSupplierPerformanceStats(subdomain);
    return res.json({ success: true, stats });
  } catch (err) {
    console.error("[WATERFALL_STATS_ERR]", err);
    return res.status(500).json({ error: err.message || "تعذر جلب إحصائيات الموردين" });
  }
};
