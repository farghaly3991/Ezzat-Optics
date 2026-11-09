const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    image: {
      type: String,
      default: ""
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      default: "",
      trim: true
    },
    whatsapp: {
      type: String,
      default: "",
      trim: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    isMain: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

branchSchema.index({ code: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeBranch || connection.model("storeBranch", branchSchema);
};
