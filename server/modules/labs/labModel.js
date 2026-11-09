const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const DEFAULT_STAGES = [
  { key: "received", label: "استلام أمر الشغل", order: 1 },
  { key: "processing", label: "جاري التجهيز والقص", order: 2 },
  { key: "assembly", label: "التركيب والمعايرة الدقيقة", order: 3 },
  { key: "ready", label: "جاهز للاستلام من المعمل", order: 4 },
  { key: "delivered", label: "تم الاستلام بالفرع وجاهز للعميل", order: 5 }
];

const storeLabSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    whatsappPhone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "القاهرة", trim: true },
    specialty: { type: String, default: "معمل عدسات وبصريات متكامل", trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null, index: true },
    customStages: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          order: { type: Number, default: 1 }
        }
      ],
      default: DEFAULT_STAGES
    },
    rating: {
      score: { type: Number, default: 5, min: 1, max: 5 },
      reviewsCount: { type: Number, default: 0 }
    },
    stats: {
      totalOrders: { type: Number, default: 0 },
      completedOrders: { type: Number, default: 0 },
      avgTurnaroundHours: { type: Number, default: 24 },
      onTimeRate: { type: Number, default: 98 }
    },
    pricingNotes: { type: String, default: "" },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeLab || connection.model("storeLab", storeLabSchema);
};
