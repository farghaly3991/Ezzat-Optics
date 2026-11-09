const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const DEFAULT_SPH_VALUES = [
  "+6.00", "+5.75", "+5.50", "+5.25", "+5.00", "+4.75", "+4.50", "+4.25",
  "+4.00", "+3.75", "+3.50", "+3.25", "+3.00", "+2.75", "+2.50", "+2.25",
  "+2.00", "+1.75", "+1.50", "+1.25", "+1.00", "+0.75", "+0.50", "+0.25",
  "0.00",
  "-0.25", "-0.50", "-0.75", "-1.00", "-1.25", "-1.50", "-1.75", "-2.00",
  "-2.25", "-2.50", "-2.75", "-3.00", "-3.25", "-3.50", "-3.75", "-4.00",
  "-4.25", "-4.50", "-4.75", "-5.00", "-5.25", "-5.50", "-5.75", "-6.00"
];

const DEFAULT_CYL_VALUES = [
  "0.00", "-0.25", "-0.50", "-0.75", "-1.00", "-1.25", "-1.50", "-1.75", "-2.00"
];

const matrixTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    industry: {
      type: String,
      enum: ["optics", "apparel", "electronics", "shoes", "general"],
      default: "optics"
    },
    isDefault: { type: Boolean, default: false },
    // Axis X (Columns, e.g. CYL or Size or Color)
    axisX: {
      key: { type: String, default: "CYL" },
      label: { type: String, default: "الاستجماتيزم (CYL)" },
      unit: { type: String, default: "D" },
      step: { type: Number, default: 0.25 },
      values: { type: [String], default: DEFAULT_CYL_VALUES }
    },
    // Axis Y (Rows, e.g. SPH or Model or Style)
    axisY: {
      key: { type: String, default: "SPH" },
      label: { type: String, default: "الدرجة الكروية (SPH)" },
      unit: { type: String, default: "D" },
      step: { type: Number, default: 0.25 },
      min: { type: Number, default: -6 },
      max: { type: Number, default: 6 },
      values: { type: [String], default: DEFAULT_SPH_VALUES }
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.matrixTemplate || connection.model("matrixTemplate", matrixTemplateSchema);
};

module.exports.DEFAULT_SPH_VALUES = DEFAULT_SPH_VALUES;
module.exports.DEFAULT_CYL_VALUES = DEFAULT_CYL_VALUES;
