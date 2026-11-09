const returnsService = require("./returnsService");

// ==========================================
// STOREFRONT CLIENT ENDPOINTS
// ==========================================

exports.createRequest = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const user = req.user;
    const body = req.body || {};

    const request = await returnsService.createClientRequest(subdomain, user, body);
    return res.status(201).json({
      done: true,
      request,
      message:
        request.type === "maintenance"
          ? "تم تسجيل طلب الصيانة بنجاح، سنقوم بالتواصل معك قريباً"
          : "تم تقديم طلب الإرجاع بنجاح، جاري مراجعته لتعيين مندوب الاستلام"
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.getMyRequests = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "سجل الدخول أولاً لعرض طلباتك" });
    }

    const requests = await returnsService.getUserRequests(subdomain, userId);
    return res.json({ done: true, requests });
  } catch (err) {
    next(err);
  }
};

exports.trackRequest = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const { requestNumber } = req.params;

    const request = await returnsService.getRequestByNumber(subdomain, requestNumber);
    if (!request) {
      return res.status(404).json({ error: "طلب الإرجاع أو الصيانة غير موجود" });
    }

    return res.json({ done: true, request });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

exports.listAdminRequests = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const result = await returnsService.getAdminRequests(subdomain, req.query);
    return res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getAdminRequestById = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const getReturnRequestModel = require("./returnModel");
    const ReturnRequest = getReturnRequestModel(subdomain);

    const request = await ReturnRequest.findById(req.params.id).lean();
    if (!request) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    return res.json({ done: true, request });
  } catch (err) {
    next(err);
  }
};

exports.updateAdminRequestStatus = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const request = await returnsService.updateRequestStatus(
      subdomain,
      req.params.id,
      req.body,
      req.user
    );

    return res.json({
      done: true,
      request,
      message: "تم تحديث حالة الطلب وبيانات المندوب بنجاح"
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.processAdminRefund = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const request = await returnsService.processRefund(
      subdomain,
      req.params.id,
      req.body,
      req.user
    );

    return res.json({
      done: true,
      request,
      message: "تم تنفيذ استرداد المبلغ واستعادة المخزون بنجاح"
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.convertToFieldService = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const result = await returnsService.convertToFieldServiceOrder(
      subdomain,
      req.params.id,
      req.body,
      req.user
    );

    return res.status(201).json({
      done: true,
      ...result,
      message: result.customerAccount?.isNew
        ? `تم إصدار أمر الزيارة الميدانية وتفعيل حساب فوري للعميل (اسم المستخدم وكلمة المرور: ${result.customerAccount.phone})`
        : `تم إصدار أمر الخدمة الميدانية بنجاح برقم ${result.order?.orderId}`
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.assignTechnician = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const result = await returnsService.assignTechnicianToRequest(
      subdomain,
      req.params.id,
      req.body,
      req.user
    );
    return res.json({
      done: true,
      ...result,
      message: `تم توكيل مهمة الصيانة للفني «${result.tech.fullname}» بنجاح!`
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.getTechnicianTask = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const token = req.query.token;
    const task = await returnsService.getTechnicianTask(subdomain, req.params.id, token, req.user);
    return res.json({ done: true, task });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
};

exports.updateTechnicianTask = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const token = req.query.token;
    const task = await returnsService.updateTechnicianTask(
      subdomain,
      req.params.id,
      req.body,
      token,
      req.user
    );
    return res.json({
      done: true,
      task,
      message: "تم تحديث حالة وإجراءات مهمة الصيانة بنجاح!"
    });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
};

exports.updateMaintenanceFinancials = async (req, res, next) => {
  try {
    const subdomain = req.subdomain;
    const request = await returnsService.updateMaintenanceFinancials(
      subdomain,
      req.params.id,
      req.body,
      req.user
    );
    return res.json({
      done: true,
      request,
      message: "تم تحديث تكاليف الصيانة وحالة العهدة والتوريد بنجاح!"
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
