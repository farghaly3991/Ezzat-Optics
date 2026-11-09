const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../core/database");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
    image: { type: String, default: "" },
    warrantyPeriodMonths: { type: Number, default: 0 },
    warrantyPolicy: { type: String, default: "" },
    // Phase A: Financial & Shipping Line Snapshots
    oldPrice: { type: Number, default: 0 },
    unitDiscount: { type: Number, default: 0 },
    allocatedOrderDiscount: { type: Number, default: 0 },
    grossLineTotal: { type: Number, default: 0 },
    netLineValue: { type: Number, default: 0 },
    lineCostTotal: { type: Number, default: 0 },
    requiresShipping: { type: Boolean, default: true },
    isService: { type: Boolean, default: false },
    categoryType: { type: String, enum: ["product", "service"], default: "product" },
    shippingClassId: { type: String, default: null },
    shippingClassCode: { type: String, default: "" },
    shippingClassName: { type: String, default: "" },
    shippingMode: { type: String, enum: ["MAX", "ADD", "NONE"], default: "MAX" },
    unitCustomerShipping: { type: Number, default: 0 },
    lineCustomerShipping: { type: Number, default: 0 },
    unitEstimatedCarrierCost: { type: Number, default: 0 },
    lineEstimatedCarrierCost: { type: Number, default: 0 },
    isShippingBaseLine: { type: Boolean, default: false },

    // Optics Item Specifics
    productType: { type: String, enum: ["frame", "lens", "sunglass", "contact_lens", "accessory", "general"], default: "frame" },
    lensSpecs: {
      eye: { type: String, default: "both" }, // right, left, both
      sph: { type: String, default: "" },
      cyl: { type: String, default: "" },
      axis: { type: String, default: "" },
      add: { type: String, default: "" },
      lensType: { type: String, default: "" },
      lensIndex: { type: String, default: "" },
      coatings: { type: [String], default: [] }
    },
    frameSpecs: {
      brand: { type: String, default: "" },
      modelCode: { type: String, default: "" },
      color: { type: String, default: "" },
      size: { type: String, default: "" }
    },
    unitSlotKey: { type: String, default: "" }, // e.g. "OD", "OS"
    unitSlotLabel: { type: String, default: "" }, // e.g. "العين اليمنى", "العين اليسرى"
    isRequestedSupply: { type: Boolean, default: false }, // هل تم طلبه لعدم توفره بالمخزن؟
    supplyStatus: {
      type: String,
      enum: ["in_stock", "requested", "ordered", "arrived"],
      default: "in_stock"
    },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "storeSupplier", default: null },
    supplierName: { type: String, default: "" },
    supplierPhone: { type: String, default: "" }
  },
  { _id: false }
);

const storeOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    visitorId: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    cartId: { type: String, default: "" },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, default: "", trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, default: "" },
      notes: { type: String, default: "" }
    },
    deliveryMethod: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery"
    },
    orderType: {
      type: String,
      enum: ["product", "service", "mixed"],
      default: "product",
      index: true
    },
    hasServices: {
      type: Boolean,
      default: false,
      index: true
    },
    pickupCompletedAt: { type: Date, default: null },
    pickupCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },
    posCashierId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },
    items: { type: [orderItemSchema], default: [] },
    payment: {
      method: { type: String, enum: ["cod", "cash", "card", "wallet", "kiosk", "installment", "bank_transfer"], default: "cod" },
      paid: { type: Boolean, default: false },
      gatewayRef: { type: String, default: "" },
      transactionId: { type: String, default: "" }
    },
    installment: {
      isInstallment: { type: Boolean, default: false, index: true },
      plan: {
        months: { type: Number, default: 0 },
        interestRate: { type: Number, default: 0 },
        originalAmount: { type: Number, default: 0 },
        interestAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        downPayment: { type: Number, default: 0 },
        downPaymentPaid: { type: Boolean, default: false },
        monthlyAmount: { type: Number, default: 0 },
        startDate: { type: Date, default: null }
      },
      summary: {
        totalRequired: { type: Number, default: 0 },
        totalPaid: { type: Number, default: 0 },
        totalRemaining: { type: Number, default: 0 },
        paidInstallmentsCount: { type: Number, default: 0 },
        remainingInstallmentsCount: { type: Number, default: 0 },
        nextDueDate: { type: Date, default: null },
        status: {
          type: String,
          enum: ["active", "completed", "defaulted", "cancelled"],
          default: "active",
          index: true
        }
      },
      guarantor: {
        nationalId: { type: String, default: "" },
        name: { type: String, default: "" },
        phone: { type: String, default: "" },
        relationship: { type: String, default: "" }
      },
      payments: [
        {
          installmentIndex: { type: Number, required: true },
          dueDate: { type: Date, required: true },
          amount: { type: Number, required: true },
          paidAmount: { type: Number, default: 0 },
          status: {
            type: String,
            enum: ["pending", "paid", "late", "partially_paid"],
            default: "pending"
          },
          paidAt: { type: Date, default: null },
          paymentMethod: { type: String, enum: ["cash", "card", "wallet", "bank_transfer"], default: "cash" },
          collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
          collectedByName: { type: String, default: "" },
          notes: { type: String, default: "" },
          receiptNumber: { type: String, default: "" }
        }
      ],
      documents: [
        {
          docType: {
            type: String,
            enum: [
              "signed_contract",
              "customer_id_front",
              "customer_id_back",
              "guarantor_id_front",
              "guarantor_id_back",
              "utility_bill",
              "promissory_note",
              "other"
            ],
            default: "other"
          },
          title: { type: String, default: "" },
          url: { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
          uploadedByName: { type: String, default: "" },
          notes: { type: String, default: "" }
        }
      ],
      legalContractText: { type: String, default: "" },
      contractNumber: { type: String, default: "" },
      contractGeneratedAt: { type: Date, default: null }
    },
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    coupon: { type: String, default: "" },
    shippingSnapshot: {
      deliveryMethod: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
      selectedClassId: { type: String, default: null },
      selectedClassCode: { type: String, default: "" },
      selectedClassName: { type: String, default: "" },
      matchMethod: { type: String, default: "default_fallback" },
      baseShippingAmount: { type: Number, default: 0 },
      baseLineProductId: { type: String, default: "" },
      additiveShippingAmount: { type: Number, default: 0 },
      freeShippingApplied: { type: Boolean, default: false },
      customerShippingCharge: { type: Number, default: 0 },
      estimatedCarrierCost: { type: Number, default: 0 },
      actualCarrierCost: { type: Number, default: null },
      actualCostStatus: {
        type: String,
        enum: ["unknown", "confirmed", "not_applicable"],
        default: "unknown"
      },
      carrierName: { type: String, default: "" },
      trackingReference: { type: String, default: "" },
      actualCostRecordedAt: { type: Date, default: null },
      actualCostRecordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
      actualCostNote: { type: String, default: "" },
      costHistory: {
        type: [
          {
            previousActualCost: { type: Number, default: null },
            newActualCost: { type: Number, required: true },
            carrierName: { type: String, default: "" },
            trackingReference: { type: String, default: "" },
            note: { type: String, default: "" },
            recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
            recordedAt: { type: Date, default: Date.now }
          }
        ],
        default: []
      }
    },
    financialSnapshot: {
      currency: { type: String, default: "EGP" },
      exchangeRate: { type: Number, default: 1 },
      grossMerchandiseSubtotal: { type: Number, default: 0 },
      merchandiseGrossSubtotal: { type: Number, default: 0 },
      discountTotal: { type: Number, default: 0 },
      orderDiscountTotal: { type: Number, default: 0 },
      netMerchandiseTotal: { type: Number, default: 0 },
      merchandiseNetTotal: { type: Number, default: 0 },
      productCostTotal: { type: Number, default: 0 },
      totalProductCostSnapshot: { type: Number, default: 0 },
      customerShippingTotal: { type: Number, default: 0 },
      customerShippingCharge: { type: Number, default: 0 },
      estimatedShippingCostTotal: { type: Number, default: 0 },
      estimatedCarrierCost: { type: Number, default: 0 },
      actualShippingCostTotal: { type: Number, default: null },
      actualCarrierCost: { type: Number, default: null },
      finalOrderTotal: { type: Number, default: 0 },
      estimatedGrossMargin: { type: Number, default: 0 },
      confirmedGrossMargin: { type: Number, default: null },
      snapshotCreatedAt: { type: Date, default: Date.now },
      calculatedAt: { type: Date, default: Date.now }
    },
    status: {
      type: String,
      enum: [
        "new",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "shipped",
        "delivered",
        "cancelled",
        "returned"
      ],
      default: "new"
    },

    // Optics Lab Workshop & Financial Deposit Tracking
    isLabOrder: { type: Boolean, default: false, index: true },
    labStatus: {
      type: String,
      enum: ["not_applicable", "pending_lab", "in_lab", "ready", "delivered"],
      default: "not_applicable",
      index: true
    },
    labDeliveryDate: { type: Date, default: null },
    labNotes: { type: String, default: "" },
    labWorkshopCost: { type: Number, default: 0 },
    labWorkshopNotes: { type: String, default: "" },
    stockDeducted: { type: Boolean, default: false },
    prescriptionSnapshot: {
      sphR: { type: String, default: "" },
      cylR: { type: String, default: "" },
      axisR: { type: String, default: "" },
      addR: { type: String, default: "" },
      pdR: { type: String, default: "" },
      sphL: { type: String, default: "" },
      cylL: { type: String, default: "" },
      axisL: { type: String, default: "" },
      addL: { type: String, default: "" },
      pdL: { type: String, default: "" },
      ipd: { type: String, default: "" },
      doctorName: { type: String, default: "" },
      usageType: { type: String, default: "distance" }
    },
    paymentsSnapshot: {
      totalAmount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 },
      previousDepositDeducted: { type: Number, default: 0 },
      paymentMethod: { type: String, default: "cash" }
    },
    courier: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      type: { type: String, enum: ["internal_staff", "external_carrier", "freelancer"], default: "external_carrier" },
      courierId: { type: mongoose.Schema.Types.ObjectId, ref: "storeShippingCourier", default: null },
      assignedAt: { type: Date, default: null },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null }
    },
    actualShippingCost: { type: Number, default: null },
    shippingCostNotes: { type: String, default: "" },
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "storeWorkOrder", default: null },
    expenses: [
      {
        title: { type: String, required: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ["lab", "shipping", "commission", "material", "other"], default: "lab" },
        notes: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    totalExpenses: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    timeline: {
      type: [
        {
          status: { type: String, required: true },
          at: { type: Date, default: Date.now },
          note: { type: String, default: "" }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeOrder || connection.model("storeOrder", storeOrderSchema);
};

