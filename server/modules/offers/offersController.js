const getOffersModel = require("./offerModel");
const getProductsModel = require("../products/productModel");

exports.listOffers = async (req, res, next) => {
  try {
    const Offers = getOffersModel(req.subdomain);
    const offers = await Offers.find().populate("productIds").sort({ createdAt: -1 }).lean();
    res.json({ done: true, offers });
  } catch (err) {
    next(err);
  }
};

exports.getActiveOffers = async (req, res, next) => {
  try {
    const Offers = getOffersModel(req.subdomain);
    const now = new Date();
    const offers = await Offers.find({ active: true, endDate: { $gte: now } })
      .populate("productIds")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ done: true, offers });
  } catch (err) {
    next(err);
  }
};

exports.createOffer = async (req, res, next) => {
  try {
    const Offers = getOffersModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);
    const body = req.body || {};

    if (!body.title || !body.endDate) {
      return res.status(400).json({ error: "عنوان العرض وتاريخ الانتهاء حقول مطلوبة" });
    }

    const offer = await new Offers(body).save();

    // Link products to offer
    if (Array.isArray(body.productIds) && body.productIds.length > 0) {
      await Products.updateMany({ _id: { $in: body.productIds } }, { $set: { offerId: offer._id } });
    }

    res.json({ done: true, offer, message: "تم إنشاء العرض بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.updateOffer = async (req, res, next) => {
  try {
    const Offers = getOffersModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);
    const body = req.body || {};

    const updated = await Offers.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!updated) return res.status(404).json({ error: "العرض غير موجود" });

    // Re-link products
    if (Array.isArray(body.productIds)) {
      await Products.updateMany({ offerId: updated._id }, { $set: { offerId: null } });
      if (body.productIds.length > 0) {
        await Products.updateMany({ _id: { $in: body.productIds } }, { $set: { offerId: updated._id } });
      }
    }

    res.json({ done: true, offer: updated, message: "تم تحديث العرض بنجاح" });
  } catch (err) {
    next(err);
  }
};

exports.deleteOffer = async (req, res, next) => {
  try {
    const Offers = getOffersModel(req.subdomain);
    const Products = getProductsModel(req.subdomain);

    await Products.updateMany({ offerId: req.params.id }, { $set: { offerId: null } });
    await Offers.findByIdAndDelete(req.params.id);
    res.json({ done: true, message: "تم حذف العرض بنجاح" });
  } catch (err) {
    next(err);
  }
};
