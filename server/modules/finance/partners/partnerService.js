const mongoose = require("mongoose");
const { getPartnerModel } = require("./partnerModel");
const getExpenseModel = require("../expenses/expenseModel");
const expensesService = require("../expenses/expensesService");
const { getAuditLogModel } = require("../../audit/auditModel");
const { withTransaction } = require("../../../core/transactionHelper");

/**
 * List all partners with aggregated real-time withdrawal metrics & equity comparisons
 */
async function listPartners(subdomain) {
  const Partner = getPartnerModel(subdomain);
  const Expense = getExpenseModel(subdomain);

  const [partners, withdrawalExpenses] = await Promise.all([
    Partner.find({}).sort({ createdAt: 1 }).lean(),
    Expense.find({
      category: { $in: ["partner_withdrawal", "partner_profit_distribution"] },
      status: { $ne: "cancelled" }
    }).lean()
  ]);

  let totalCapital = 0;
  let totalWithdrawnAll = 0;

  // Compute total withdrawal per partner from live expenses
  const withdrawalByPartner = {};
  withdrawalExpenses.forEach((exp) => {
    const pId = exp.partnerId ? String(exp.partnerId) : null;
    const amount = Number(exp.amount || 0);
    totalWithdrawnAll += amount;

    if (pId) {
      withdrawalByPartner[pId] = (withdrawalByPartner[pId] || 0) + amount;
    } else if (exp.partnerName) {
      withdrawalByPartner[exp.partnerName] = (withdrawalByPartner[exp.partnerName] || 0) + amount;
    }
  });

  const enrichedPartners = partners.map((p) => {
    totalCapital += Number(p.initialCapital || 0);
    const pIdStr = String(p._id);
    const liveWithdrawals = withdrawalByPartner[pIdStr] !== undefined
      ? withdrawalByPartner[pIdStr]
      : (withdrawalByPartner[p.name] || Number(p.totalWithdrawals || 0));

    // Share of total withdrawals taken
    const actualWithdrawalRatio = totalWithdrawnAll > 0
      ? Math.round((liveWithdrawals / totalWithdrawnAll) * 1000) / 10
      : 0;

    // Discrepancy between ownership % and actual withdrawal %
    const varianceRatio = Math.round((actualWithdrawalRatio - p.sharePercentage) * 10) / 10;

    return {
      ...p,
      id: pIdStr,
      liveWithdrawals,
      totalWithdrawals: liveWithdrawals,
      actualWithdrawalRatio,
      varianceRatio,
      withdrawalVariance: varianceRatio,
      statusNote:
        varianceRatio > 5
          ? `سحب أعلى من النسبة المتفق عليها (+${varianceRatio}%)`
          : varianceRatio < -5
          ? `سحب أقل من النسبة المتفق عليها (${varianceRatio}%)`
          : "متطابق مع نسبة المساهمة"
    };
  });

  const totalSharePercentage = partners.reduce((sum, p) => sum + (Number(p.sharePercentage) || 0), 0);

  return {
    summary: {
      partnersCount: partners.length,
      activePartnersCount: partners.filter((p) => p.active !== false).length,
      totalCapital,
      totalInitialCapital: totalCapital,
      totalWithdrawnAll,
      totalWithdrawals: totalWithdrawnAll,
      netRemainingCapital: totalCapital - totalWithdrawnAll,
      totalSharePercentage,
      recentExpensesCount: withdrawalExpenses.length
    },
    partners: enrichedPartners,
    recentWithdrawals: withdrawalExpenses.slice(-10).reverse().map((exp) => ({
      id: String(exp._id),
      expenseCode: exp.expenseCode,
      title: exp.title,
      category: exp.category,
      amount: exp.amount,
      partnerName: exp.partnerName || exp.payeeName || "شريك غير محدد",
      effectiveDate: exp.effectiveDate,
      paymentStatus: exp.paymentStatus,
      notes: exp.notes
    }))
  };
}

/**
 * Create a new partner
 */
async function createPartner(subdomain, data = {}, user = {}) {
  const Partner = getPartnerModel(subdomain);
  const { name, phone, email, sharePercentage, initialCapital, notes } = data;

  if (!name || !name.trim()) {
    throw new Error("اسم الشريك مطلوب");
  }

  const partner = await Partner.create({
    name: name.trim(),
    phone: phone ? phone.trim() : "",
    email: email ? email.trim() : "",
    sharePercentage: Math.min(Math.max(Number(sharePercentage) || 0, 0), 100),
    initialCapital: Math.max(Number(initialCapital) || 0, 0),
    notes: notes ? notes.trim() : ""
  });

  // Audit log
  try {
    const AuditLog = getAuditLogModel(subdomain);
    await AuditLog.create({
      userId: user?._id || null,
      userName: user?.fullname || "النظام المالي",
      userRole: user?.role || "admin",
      action: "create_partner",
      actionLabel: "إضافة شريك جديد للمتجر",
      targetType: "finance",
      targetId: String(partner._id),
      targetCode: partner.name,
      details: `تم إضافة الشريك: ${partner.name} بنسبة مساهمة ${partner.sharePercentage}% ورأس مال ${partner.initialCapital} ج.م`
    });
  } catch (err) {
    console.warn("[AUDIT_PARTNER_WARN]:", err.message);
  }

  return partner;
}

/**
 * Update partner details
 */
async function updatePartner(subdomain, partnerId, data = {}, user = {}) {
  const Partner = getPartnerModel(subdomain);
  const partner = await Partner.findById(partnerId);
  if (!partner) {
    throw new Error("الشريك غير موجود");
  }

  if (data.name) partner.name = data.name.trim();
  if (data.phone !== undefined) partner.phone = data.phone.trim();
  if (data.email !== undefined) partner.email = data.email.trim();
  if (data.sharePercentage !== undefined) {
    partner.sharePercentage = Math.min(Math.max(Number(data.sharePercentage) || 0, 0), 100);
  }
  if (data.initialCapital !== undefined) {
    partner.initialCapital = Math.max(Number(data.initialCapital) || 0, 0);
  }
  if (data.active !== undefined) partner.active = Boolean(data.active);
  if (data.notes !== undefined) partner.notes = data.notes.trim();

  await partner.save();
  return partner;
}

/**
 * Record a Partner Withdrawal (مسحوبات شخصية للشريك)
 * Runs in an ACID transaction: creates expense + updates partner total withdrawals + logs audit.
 */
async function recordPartnerWithdrawal(subdomain, data = {}, user = {}) {
  const { partnerId, amount, title, notes, effectiveDate, paymentMethod = "cash" } = data;

  if (!partnerId) {
    throw new Error("يرجى تحديد الشريك");
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    throw new Error("يرجى إدخال مبلغ صحيح للمسحوبات");
  }

  const Partner = getPartnerModel(subdomain);
  const partner = await Partner.findById(partnerId);
  if (!partner) {
    throw new Error("الشريك المحدد غير موجود");
  }

  return await withTransaction(subdomain, async (session) => {
    // 1. Create Expense
    const expenseData = {
      title: title || `مسحوبات الشريك: ${partner.name}`,
      category: "partner_withdrawal",
      amount: amt,
      partnerId: partner._id,
      partnerName: partner.name,
      partnerSharePercent: partner.sharePercentage,
      payeeName: partner.name,
      payeePhone: partner.phone,
      effectiveDate: effectiveDate || new Date(),
      notes: notes || `مسحوبات شخصية للشريك ${partner.name}`,
      payImmediately: true,
      paidAmount: amt,
      paymentMethod
    };

    const expenseResult = await expensesService.createExpense(subdomain, expenseData, user, { session });

    // 2. Update Partner Record
    partner.totalWithdrawals = (partner.totalWithdrawals || 0) + amt;
    await partner.save({ session });

    // 3. Log Audit
    try {
      const AuditLog = getAuditLogModel(subdomain);
      await AuditLog.create(
        [
          {
            userId: user?._id || null,
            userName: user?.fullname || "النظام المالي",
            userRole: user?.role || "admin",
            action: "partner_withdrawal",
            actionLabel: "تسجيل مسحوبات شريك",
            targetType: "finance",
            targetId: String(partner._id),
            targetCode: expenseResult.expenseCode || "",
            details: `تم صرف مسحوبات بقيمة ${amt.toLocaleString()} ج.م للشريك: ${partner.name} (طريقة الدفع: ${paymentMethod})`,
            metadata: { partnerId: String(partner._id), partnerName: partner.name, amount: amt }
          }
        ],
        { session: session || undefined }
      );
    } catch (auditErr) {
      console.warn("[AUDIT_WITHDRAWAL_WARN]:", auditErr.message);
    }

    return {
      success: true,
      message: `تم تسجيل مسحوبات بقيمة ${amt.toLocaleString()} ج.م للشريك ${partner.name} بنجاح`,
      expense: expenseResult,
      partner
    };
  });
}

module.exports = {
  listPartners,
  createPartner,
  updatePartner,
  recordPartnerWithdrawal
};
