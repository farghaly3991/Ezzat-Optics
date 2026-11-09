const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeOfferSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    badge: { type: String, default: "عرض حصري" },
    discountPercentage: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
    bgColor: { type: String, default: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeOffer || connection.model("storeOffer", storeOfferSchema);
};
