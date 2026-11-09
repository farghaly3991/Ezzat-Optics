const partnerService = require("./partnerService");

exports.listPartners = async (req, res, next) => {
  try {
    const result = await partnerService.listPartners(req.subdomain);
    res.json({ done: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.createPartner = async (req, res, next) => {
  try {
    const partner = await partnerService.createPartner(req.subdomain, req.body, req.user);
    res.status(201).json({
      done: true,
      partner,
      message: "تم إضافة الشريك بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePartner = async (req, res, next) => {
  try {
    const partner = await partnerService.updatePartner(req.subdomain, req.params.id, req.body, req.user);
    res.json({
      done: true,
      partner,
      message: "تم تحديث بيانات الشريك بنجاح"
    });
  } catch (err) {
    next(err);
  }
};

exports.recordPartnerWithdrawal = async (req, res, next) => {
  try {
    const result = await partnerService.recordPartnerWithdrawal(req.subdomain, req.body, req.user);
    res.status(201).json({
      done: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};
