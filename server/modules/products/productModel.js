const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const storeProductSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "storeCategory", required: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: "storeOffer", default: null },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, default: 0 },
    oldPrice: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 }, // للربح وصافي الدخل
    images: { type: [String], default: [] },
    description: { type: String, default: "" },
    stockCount: { type: Number, default: 0 },
    warrantyPeriodMonths: { type: Number, default: 0, min: 0 }, // مدة الضمان بالأشهر من تاريخ الشراء (0 = بدون ضمان / غير معرف)
    warrantyPolicy: { type: String, default: "", trim: true }, // شروط وتفاصيل الضمان
    specs: { type: Object, default: {} },
    tags: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },

    // Optics Specialized Domain Attributes (تصنيف وخصائص البصريات)
    productType: {
      type: String,
      enum: ["frame", "lens", "sunglass", "contact_lens", "accessory", "general"],
      default: "frame",
      index: true
    },
    opticsSpecs: {
      // إطارات وشنابر (Frames / Sunglasses)
      brand: { type: String, default: "", trim: true },
      modelCode: { type: String, default: "", trim: true },
      eyewearType: { type: String, enum: ["medical", "sun", "reading", ""], default: "medical" },
      frameStyle: { type: String, enum: ["full_rim", "semi_rimless", "rimless", ""], default: "full_rim" },
      frameMaterial: { type: String, default: "" }, // معدن، أسيتات، تيتانيوم، TR90
      frameShape: { type: String, default: "" }, // مستطيل، دائري، أفياتور، كات آي، مربع
      size: { type: String, default: "" }, // مثال: 54-18-140
      color: { type: String, default: "" }, // أسود، ذهبي، بني، شفاف
      gender: { type: String, enum: ["men", "women", "kids", "unisex", ""], default: "unisex" },

      // عدسات طبية وبصرية (Optical Lenses)
      lensType: { type: String, enum: ["single_vision", "bifocal", "progressive", ""], default: "single_vision" },
      lensIndex: { type: String, default: "1.56" }, // 1.50, 1.56, 1.61, 1.67, 1.74
      lensBrand: { type: String, default: "" }, // Crizal, Essilor, Zeiss, Hoya, Commercial
      coatings: { type: [String], default: [] }, // Blue Cut, Anti-Reflective, Photochromic, UV400, Hard Coat
      lensMaterial: { type: String, default: "Plastic (CR-39)" }, // CR-39, Polycarbonate, Glass, High Index
      isMatrixManaged: { type: Boolean, default: false }, // هل تدار بمصفوفة مقاسات SPH x CYL
      matrixStock: { type: Object, default: {} }, // رصيد كل مقاس (مثال: {"-2.00_-0.50": 5})

      // عدسات لاصقة (Contact Lenses)
      replacementDuration: { type: String, default: "" }, // daily, monthly, yearly
      lensColor: { type: String, default: "" }, // clear, hazel, gray, blue, green
      baseCurve: { type: String, default: "" },
      diameter: { type: String, default: "" }
    },
    ratings: { type: Object, default: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    visited: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    sku: { type: String, trim: true, default: "", index: true }, // كود الصنف المرجعي (SKU)
    barcode: { type: String, trim: true, default: "", index: true }, // الباركود المصنعي أو الباركود المولد من الـ ID
    groupCode: { type: String, trim: true, default: "", index: true }, // معرف مجموعة المتغيرات (نفس المنتج بألوان/مقاسات/مواصفات مختلفة)
    // Cross-sell & Suggested Services / Items
    linkedItemIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
      default: []
    },
    relatedItems: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
      default: []
    },
    relatedProducts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
      default: []
    },
    embedding: { type: [Number], default: [] }, // المتجه الدلالي للبحث (Gemini 768-d)
    embeddingModel: { type: String, default: "" }, // اسم موديل التضمين (مثال: gemini-embedding-001)
    embeddingTextHash: { type: String, default: "" }, // بصمة النص المضمن لتجنب إعادة التوليد غير الضرورية
    // Phase A: Shipping configuration per product
    requiresShipping: { type: Boolean, default: true },
    shippingClassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeShippingClass",
      default: null
    },
    shippingMode: {
      type: String,
      enum: ["MAX", "ADD"],
      default: "MAX"
    },
    // Phase B: Optional link to most recent incoming supplier shipment & default product supplier
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplier",
      default: null,
      index: true
    },
    // Multi-Supplier Priority Chain (Waterfall Reordering)
    suppliers: [
      {
        supplierId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "storeSupplier"
        },
        supplierName: { type: String, default: "" },
        phone: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
        priority: { type: Number, default: 1 },
        supplyCost: { type: Number, default: 0 },
        leadTimeHours: { type: Number, default: 24 },
        notes: { type: String, default: "" }
      }
    ],
    criticalStockThreshold: { type: Number, default: 3, min: 0 },
    reorderQuantity: { type: Number, default: 10, min: 1 },
    // Multi-Warehouse Stock (المخزن المحلي للمحل والمخزن الخارجي)
    storeStock: { type: Number, default: 0 },
    externalStock: { type: Number, default: 0 },
    // Damaged / Scrapped items history (سجل التوالف والهدر)
    scrapRecords: [
      {
        quantity: { type: Number, required: true },
        reason: { type: String, default: "كسر أو خدش أثناء التركيب أو النقل" },
        warehouse: { type: String, enum: ["store", "external"], default: "store" },
        unitCost: { type: Number, default: 0 },
        totalLoss: { type: Number, default: 0 },
        recordedBy: { type: String, default: "المسؤول" },
        date: { type: Date, default: Date.now }
      }
    ],
    supplierShipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeSupplierShipment",
      default: null
    },
    lastPurchaseCost: { type: Number, default: null },
    // Phase C: Inventory reservation, reorder threshold, and book/replacement costing
    reservedStock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    inventoryBookUnitCost: { type: Number, default: null },
    replacementUnitCost: { type: Number, default: null },
    // Phase F: Historical foreign-currency purchase snapshot for replacement cost recalculation
    lastPurchaseCurrency: { type: String, default: "EGP", uppercase: true, trim: true },
    lastPurchaseOriginalUnitCost: { type: Number, default: null },
    lastPurchaseExchangeRate: { type: Number, default: 1 },
    lastPurchaseRateDate: { type: Date, default: null }
  },
  { timestamps: true }
);

// Auto-populate barcode with _id if not provided
storeProductSchema.pre("save", function (next) {
  if (!this.barcode || !this.barcode.trim()) {
    if (this._id) {
      this.barcode = this._id.toString();
    }
  }
  next();
});

storeProductSchema.index({ name: "text", description: "text", tags: "text", groupCode: "text", barcode: "text" });
storeProductSchema.index({ categoryId: 1, groupCode: 1 });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  require("../branches/branchModel")(subdomain);
  require("../categories/categoryModel")(subdomain);
  require("../offers/offerModel")(subdomain);
  require("../finance/procurement/supplierModel")(subdomain);
  return connection.models.storeProduct || connection.model("storeProduct", storeProductSchema);
};

