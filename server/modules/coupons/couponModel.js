const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeCouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["discount", "fixed"], default: "discount" }, // نسبة أو قيمة
    discount: { type: Number, default: 0 }, // النسبة المئوية إذا كانت type === 'discount'
    value: { type: Number, default: 0 }, // القيمة الثابتة إذا كانت type === 'fixed'
    minOrderValue: { type: Number, default: 0 },
    allowedUses: { type: Number, default: 0 }, // 0 تعني غير محدود
    usedCount: { type: Number, default: 0 },
    expiration: { type: Date, default: null },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.model("storeCoupon", storeCouponSchema);
};
