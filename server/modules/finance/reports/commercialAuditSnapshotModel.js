const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const commercialAuditSnapshotSchema = new mongoose.Schema(
  {
    snapshotNumber: { type: String, required: true, index: true },
    periodPreset: { type: String, default: "all_time" },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null },
    branchName: { type: String, default: "كافة الأفرع" },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    generatedByName: { type: String, default: "الإدارة المالية" },

    // 1. Revenues Breakdown
    revenues: {
      onlineStoreSales: { type: Number, default: 0 },
      posDirectSales: { type: Number, default: 0 },
      totalMerchandiseSales: { type: Number, default: 0 },
      merchandiseCogs: { type: Number, default: 0 },
      merchandiseGrossProfit: { type: Number, default: 0 },

      installmentCashCollected: { type: Number, default: 0 }, // مقدمات وأقساط محصلة
      installmentCompletedProfit: { type: Number, default: 0 }, // أرباح الأقساط المكتملة تحديداً (الفوائد المحققة)

      maintenanceRevenue: { type: Number, default: 0 }, // رسوم الصيانة
      maintenancePartsCost: { type: Number, default: 0 }, // تكلفة قطع الغيار
      maintenanceNetProfit: { type: Number, default: 0 }, // صافي ربح الصيانة

      servicesRevenue: { type: Number, default: 0 },

      customerShippingCollected: { type: Number, default: 0 },
      carrierActualShippingCost: { type: Number, default: 0 },
      shippingProfitOrSubsidy: { type: Number, default: 0 }, // أرباح أو دعم الشحن

      totalGrossRevenue: { type: Number, default: 0 }, // إجمالي الإيرادات الكلية
      totalGrossOperatingProfit: { type: Number, default: 0 } // مجمل الربح التشغيلي قبل المصروفات العامة
    },

    // 2. Assets & Merchandise Valuation
    assets: {
      totalProductsCount: { type: Number, default: 0 },
      totalStockUnits: { type: Number, default: 0 },
      inventoryCostValue: { type: Number, default: 0 }, // القيمة الفعلية بسعر التكلفة
      inventoryRetailValue: { type: Number, default: 0 }, // القيمة البيعية السوقية التقديرية
      potentialInventoryProfit: { type: Number, default: 0 }
    },

    // 3. Expenses & Liabilities Breakdown
    expenses: {
      salariesBase: { type: Number, default: 0 }, // المرتبات الأساسية
      salariesDeductions: { type: Number, default: 0 }, // الخصومات والجزاءات
      salariesNetPaid: { type: Number, default: 0 }, // صافي المرتبات بعد الخصومات

      independentCouriersCost: { type: Number, default: 0 }, // تكلفة الدليفري المستقل

      rentExpenses: { type: Number, default: 0 }, // الإيجارات
      utilitiesExpenses: { type: Number, default: 0 }, // المرافق والفواتير
      generalOperatingExpenses: { type: Number, default: 0 }, // المصروفات العامة والنثريات
      totalOperatingExpenses: { type: Number, default: 0 }, // إجمالي المصروفات التشغيلية

      installmentOutstandingReceivables: { type: Number, default: 0 }, // أقساط مستحقة لم تسدد بعد
      supplierPayablesPending: { type: Number, default: 0 } // مستحقات الموردين المؤجلة
    },

    // 4. Net Results
    netResults: {
      estimatedNetProfit: { type: Number, default: 0 },
      netProfitMarginPercent: { type: Number, default: 0 },
      cashInHandEstimated: { type: Number, default: 0 }
    },

    // 5. AI Insight
    aiInsight: {
      summary: { type: String, default: "" },
      strengths: [{ type: String }],
      risksAndWarnings: [{ type: String }],
      recommendations: [{ type: String }],
      generatedAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return (
    connection.models.commercialAuditSnapshot ||
    connection.model("commercialAuditSnapshot", commercialAuditSnapshotSchema)
  );
};
