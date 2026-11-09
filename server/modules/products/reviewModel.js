const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeReviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "storeProduct", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    username: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" }
  },
  { timestamps: true }
);

storeReviewSchema.index({ productId: 1, userId: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.model("storeReview", storeReviewSchema);
};
