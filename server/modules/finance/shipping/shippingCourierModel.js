const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const shippingCourierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["internal_staff", "external_carrier", "freelancer"],
      default: "external_carrier",
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      default: null,
      index: true
    },
    phone: {
      type: String,
      default: "",
      trim: true
    },
    defaultCost: {
      type: Number,
      default: 0,
      min: 0
    },
    active: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeShippingCourier || connection.model("storeShippingCourier", shippingCourierSchema);
};
