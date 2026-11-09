const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    image: { type: String, default: "" },
    icon: { type: String, default: "" },
    specs: { type: Object, default: {} },
    tags: { type: [String], default: [] },
    type: {
      type: String,
      enum: ["product", "service"],
      default: "product",
      index: true
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "storeCategory", default: null },
    matrixTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "matrixTemplate", default: null },
    layoutMode: { type: String, enum: ["standard", "matrix_grid"], default: "standard" },
    allowMultiVariants: { type: Boolean, default: true },
    hasGridSpecs: { type: Boolean, default: false },
    gridConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        axisX: {
          key: "CYL",
          label: "الاستجماتيزم (CYL)",
          unit: "D",
          step: 0.25,
          values: ["0.00", "-0.25", "-0.50", "-0.75", "-1.00", "-1.25", "-1.50", "-1.75", "-2.00"]
        },
        axisY: {
          key: "SPH",
          label: "الدرجة الكروية (SPH)",
          unit: "D",
          step: 0.25,
          values: [
            "+6.00", "+5.75", "+5.50", "+5.25", "+5.00", "+4.75", "+4.50", "+4.25",
            "+4.00", "+3.75", "+3.50", "+3.25", "+3.00", "+2.75", "+2.50", "+2.25",
            "+2.00", "+1.75", "+1.50", "+1.25", "+1.00", "+0.75", "+0.50", "+0.25",
            "0.00",
            "-0.25", "-0.50", "-0.75", "-1.00", "-1.25", "-1.50", "-1.75", "-2.00",
            "-2.25", "-2.50", "-2.75", "-3.00", "-3.25", "-3.50", "-3.75", "-4.00",
            "-4.25", "-4.50", "-4.75", "-5.00", "-5.25", "-5.50", "-5.75", "-6.00"
          ]
        },
        unitSlots: [
          { key: "OD", label: "العين اليمنى (OD)", required: false, isDefault: true },
          { key: "OS", label: "العين اليسرى (OS)", required: false, isDefault: true }
        ],
        allowMultiUnits: true,
        defaultUnitCount: 2
      }
    },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeCategory || connection.model("storeCategory", storeCategorySchema);
};
