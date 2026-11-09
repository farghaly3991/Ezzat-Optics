const getAdminDataModel = require("../settings/adminDataModel");
const getBranchModel = require("../branches/branchModel");
const getOrdersModel = require("./orderModel");

const DEFAULT_LEGAL_CONTRACT_TEMPLATE = `عقد بيع بالتقسيط المباشر مع المتجر وإقرار استلام وضمان تضامني

إنه في يوم {{CONTRACT_DATE}}، تم الاتفاق والتراضي بين كل من:

أولاً: {{MERCHANT_NAME}} - الكائن مقره في: {{MERCHANT_ADDRESS}}، هاتف: {{MERCHANT_PHONE}}، ويمثله في هذا العقد المفوض/المدير المسؤول (ويُشار إليه في هذا العقد بـ "الطرف الأول - البائع").

ثانياً: السيد/ {{CUSTOMER_NAME}}، بطاقة رقم قومي: {{CUSTOMER_NATIONAL_ID}}، المقيم في: {{CUSTOMER_ADDRESS}}، هاتف: {{CUSTOMER_PHONE}} (ويُشار إليه في هذا العقد بـ "الطرف الثاني - المشتري").

ثالثاً: السيد/ {{GUARANTOR_NAME}}، بطاقة رقم قومي: {{GUARANTOR_NATIONAL_ID}}، المقيم في: {{GUARANTOR_ADDRESS}}، هاتف: {{GUARANTOR_PHONE}}، صلة القرابة: {{GUARANTOR_RELATION}} (ويُشار إليه في هذا العقد بـ "الطرف الثالث - الضامن المتضامن والكفيل العيني والشخصي").

تمهيد:
يمتلك الطرف الأول السلع والبضائع موضوع هذا العقد، وقد رغب الطرف الثاني في شرائها بنظام التقسيط المباشر وفق الترتيب المالي الوارد بالجدول أدناه وبكفالة وضمانة تضامنية من الطرف الثالث، وبعد أن أقر كافة الأطراف بأهليتهم القانونية المعتبرة شرعاً وقانوناً، تم الاتفاق على الآتي:

البند الأول (موضوع العقد وبيان المبيع):
باع وأسقط وتنازل الطرف الأول بالتقسيط المباشر للطرف الثاني القابل لذلك المنتجات الموضحة بالجدول التالي:
{{ITEMS_TABLE}}

البند الثاني (المعاملة المالية وجدول استحقاق الأقساط):
تم هذا البيع باتفاق قطعي نظير ثمن إجمالي مقسط قدره {{TOTAL_AMOUNT}} {{CURRENCY}}، وتفاصيله المالية كالتالي:
1. إجمالي ثمن المنتجات الأصلي: {{ORIGINAL_AMOUNT}} {{CURRENCY}}.
2. المقدم النقدي المدفوع عند التعاقد: {{DOWN_PAYMENT}} {{CURRENCY}} (تم سدادها في خزينة الطرف الأول بموجب إيصال رسمي).
3. المبلغ المتبقي الخاضع للتقسيط: {{FINANCED_AMOUNT}} {{CURRENCY}}.
4. مدة التقسيط: ({{MONTHS_COUNT}}) شهراً ميلادياً متتالياً.
5. قيمة القسط الشهري المستحق: {{MONTHLY_AMOUNT}} {{CURRENCY}}، يستحق في موعد أقصاه اليوم الخامس من كل شهر ميلادي ابتداءً من {{START_DATE}}.

جدول تواريخ ومبالغ الأقساط الشهرية:
{{PAYMENTS_SCHEDULE}}

البند الثالث (المعاينة والاستلام وفحص المبيع):
يقر الطرف الثاني (المشتري) بأنه عاين المبيع المعاينة التامة النافية للجهالة شرعاً وقانوناً، وتسلمه بحالة تشغيلية ممتازة ومطابقة للمواصفات، وخالية من كافة العيوب الظاهرة، ويسقط حقه في الرجوع على الطرف الأول بأي عيب ناتج عن سوء الاستخدام. وتنتقل تبعة هلاك أو تلف المبيع إلى المشتري من تاريخ استلامه.

البند الرابع (الشرط الفاسخ الصريح وحلول كامل الأقساط):
اتفق الأطراف صراحة على أنه في حالة تخلف الطرف الثاني عن سداد أي قسط في موعد استحقاقه، أو التأخر عن السداد لمدة تتجاوز سبعة أيام، تصبح باقي الأقساط بأكملها حالة الأداء فوراً دون حاجة إلى إنذار أو إعذار أو اتخاذ أي إجراء قضائي، ويحق للطرف الأول استرداد المبيع فوراً أو الرجوع على المشتري والضامن بكامل القيمة المتبقية والمصروفات.

البند الخامس (الكفالة والتضامن التام للطرف الثالث - الضامن):
يقر الطرف الثالث (الضامن) صراحة بأنه كفيل متضامن ومتكافل مع الطرف الثاني في الوفاء بكافة الالتزامات المالية الناشئة عن هذا العقد، ويسقط حقه في تجريد المدين الأصلي أو مطالبة الدائن بالرجوع عليه أولاً، وتعتبر ذمته المالية ملتزمة بذات التزام الطرف الثاني حتى سداد آخر قسط ومخالصة ذمته كتابةً.

البند السادس (الاختصاص القضائي ومحل الإقامة المختار):
يقر كل طرف بأن عنوانه الوارد بصدر هذا العقد هو موطنه المختار لكافة المراسلات والإعلانات القضائية، وتختص محاكم {{CITY_OR_GOVERNORATE}} بنظر أي نزاع قد ينشأ بخصوص هذا العقد.

تحرر هذا العقد من نسختين أصليتين، بيد الطرف الأول نسخة وللطرف الثاني نسخة، ويتم إرفاق صورة طبق الأصل موقعة ومبصومة مع صور بطاقات الرقم القومي وإيصالات الأمانة في الملف الرسمي للطلب.`;

/**
 * Format currency number
 */
function fmt(num, currency = "ج.م") {
  return `${Number(num || 0).toLocaleString()} ${currency}`;
}

/**
 * Generate full contract text for a specific order
 */
async function generateInstallmentContract(subdomain, orderId, customTemplate = null) {
  const Orders = getOrdersModel(subdomain);
  const AdminData = getAdminDataModel(subdomain);
  const Branch = getBranchModel(subdomain);

  const [order, adminData] = await Promise.all([
    Orders.findOne({
      $or: [
        { orderId: orderId },
        ...(require("mongoose").isValidObjectId(orderId) ? [{ _id: orderId }] : [])
      ]
    }).populate("branchId").lean(),
    AdminData.findOne({}).lean()
  ]);

  if (!order || !order.installment || !order.installment.isInstallment) {
    throw new Error("طلب التقسيط غير موجود أو ليس مسجلاً بنظام التقسيط");
  }

  const branch = order.branchId || {};
  const inst = order.installment;
  const plan = inst.plan || {};
  const guarantor = inst.guarantor || {};
  const customer = order.customer || {};
  const currency = adminData?.currency || "ج.م";

  // Template to use
  let template = customTemplate || adminData?.installmentContractTemplate || DEFAULT_LEGAL_CONTRACT_TEMPLATE;
  if (!template || !template.trim()) {
    template = DEFAULT_LEGAL_CONTRACT_TEMPLATE;
  }

  // Format Items Table
  let itemsTable = "";
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsTable = order.items
      .map((it, idx) => `  ${idx + 1}. ${it.name} (الكمية: ${it.quantity} قطعة) - السعر: ${fmt(it.price, currency)}`)
      .join("\n");
  } else {
    itemsTable = "  1. منتجات وأجهزة كهربائية / إلكترونية وفق فاتورة البيع المرفقة.";
  }

  // Format Payments Schedule Table
  let paymentsSchedule = "";
  if (Array.isArray(inst.payments) && inst.payments.length > 0) {
    paymentsSchedule = inst.payments
      .map((p) => {
        const d = p.dueDate ? new Date(p.dueDate).toLocaleDateString("ar-EG") : "-";
        return `  • القسط رقم (${p.installmentIndex}): استحقاق ${d} بمبلغ ${fmt(p.amount, currency)}`;
      })
      .join("\n");
  } else {
    paymentsSchedule = `  • قسط شهري بقيمة ${fmt(plan.monthlyAmount, currency)} لمدة ${plan.months} شهر`;
  }

  const contractDate = new Date(order.createdAt || Date.now()).toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const startDateStr = plan.startDate
    ? new Date(plan.startDate).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
    : contractDate;

  const financedAmt = Math.max(0, (plan.totalAmount || 0) - (plan.downPayment || 0));

  // City / Jurisdiction
  const city = branch.city || customer.city || adminData?.address || "القاهرة";

  // Replace placeholders
  let contractText = template
    .replace(/{{CONTRACT_DATE}}/g, contractDate)
    .replace(/{{MERCHANT_NAME}}/g, branch.name || adminData?.siteName || "إدارة المتجر")
    .replace(/{{MERCHANT_ADDRESS}}/g, branch.address || adminData?.address || "المقر الرئيسي")
    .replace(/{{MERCHANT_PHONE}}/g, branch.phone || adminData?.phone || "01000000000")
    .replace(/{{CUSTOMER_NAME}}/g, customer.name || "السيد العميل")
    .replace(/{{CUSTOMER_NATIONAL_ID}}/g, customer.nationalId || "(مرفق صورة البطاقة الشخصية)")
    .replace(/{{CUSTOMER_ADDRESS}}/g, customer.address || customer.city || "جمهورية مصر العربية")
    .replace(/{{CUSTOMER_PHONE}}/g, customer.phone || "01000000000")
    .replace(/{{GUARANTOR_NAME}}/g, guarantor.name || "(الضامن المذكور في طلب التعاقد)")
    .replace(/{{GUARANTOR_NATIONAL_ID}}/g, guarantor.nationalId || "(مرفق صورة بطاقة الضامن)")
    .replace(/{{GUARANTOR_ADDRESS}}/g, guarantor.address || "العنوان المعتمد بالبطاقة")
    .replace(/{{GUARANTOR_PHONE}}/g, guarantor.phone || "-")
    .replace(/{{GUARANTOR_RELATION}}/g, guarantor.relationship || "كفيل متضامن")
    .replace(/{{ITEMS_TABLE}}/g, itemsTable)
    .replace(/{{PAYMENTS_SCHEDULE}}/g, paymentsSchedule)
    .replace(/{{TOTAL_AMOUNT}}/g, Number(plan.totalAmount || order.total || 0).toLocaleString())
    .replace(/{{ORIGINAL_AMOUNT}}/g, Number(plan.originalAmount || order.subtotal || 0).toLocaleString())
    .replace(/{{DOWN_PAYMENT}}/g, Number(plan.downPayment || 0).toLocaleString())
    .replace(/{{FINANCED_AMOUNT}}/g, Number(financedAmt).toLocaleString())
    .replace(/{{MONTHS_COUNT}}/g, String(plan.months || 6))
    .replace(/{{MONTHLY_AMOUNT}}/g, Number(plan.monthlyAmount || 0).toLocaleString())
    .replace(/{{START_DATE}}/g, startDateStr)
    .replace(/{{CITY_OR_GOVERNORATE}}/g, city)
    .replace(/{{CURRENCY}}/g, currency);

  const contractNumber = `CNT-INST-${order.orderId}`;

  // Update order with generated contract
  await Orders.updateOne(
    { _id: order._id },
    {
      $set: {
        "installment.legalContractText": contractText,
        "installment.contractNumber": contractNumber,
        "installment.contractGeneratedAt": new Date()
      }
    }
  );

  return {
    contractNumber,
    contractText,
    generatedAt: new Date(),
    orderId: order.orderId,
    customer,
    guarantor,
    plan
  };
}

/**
 * Get active template
 */
async function getContractTemplate(subdomain) {
  const AdminData = getAdminDataModel(subdomain);
  const adminData = await AdminData.findOne({}).lean();
  return adminData?.installmentContractTemplate || DEFAULT_LEGAL_CONTRACT_TEMPLATE;
}

/**
 * Update active template in site data
 */
async function updateContractTemplate(subdomain, newTemplate) {
  const AdminData = getAdminDataModel(subdomain);
  await AdminData.updateOne(
    {},
    { $set: { installmentContractTemplate: String(newTemplate || "").trim() } },
    { upsert: true }
  );
  return { done: true, message: "تم تحديث صيغة عقد التقسيط المعتمدة في النظام بنجاح" };
}

module.exports = {
  DEFAULT_LEGAL_CONTRACT_TEMPLATE,
  generateInstallmentContract,
  getContractTemplate,
  updateContractTemplate
};
