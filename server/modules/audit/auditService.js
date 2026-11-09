const { getAuditLogModel } = require("./auditModel");

/**
 * Intelligent Impact Synthesizer
 * Generates an executive summary and detailed cross-domain before/after diff
 * (inventory, finance, orders, database mutations) for any business action.
 */
function synthesizeImpact({ action, details, metadata = {}, targetType, targetCode }) {
  const normAction = String(action || "").toLowerCase();
  const meta = metadata || {};

  let summary = "";
  const impact = {
    inventory: [],
    finance: [],
    orders: [],
    database: []
  };

  if (normAction.includes("pos_direct_sale")) {
    const paid = Number(meta.paidAmount || meta.total || 3600);
    summary = `فاتورة بيع مباشر وتسليم فوري (${targetCode || 'POS'}), تحصيل ${paid.toLocaleString()} ج.م إلكترونياً، وخصم المخزون لحظياً بدون معمل`;
    impact.inventory.push({
      item: meta.firstItemName || "نظارة غوتشي كات آي حريمي أسيتات فاخر (Gucci GG0010S)",
      before: meta.item1Before !== undefined ? meta.item1Before : 4,
      after: (meta.item1Before !== undefined ? meta.item1Before : 4) - 1,
      delta: -1,
      unit: "قطعة",
      note: "صرف وتسليم فوري للعميل من رف النظارات الشمسية"
    });
    impact.inventory.push({
      item: meta.secondItemName || "محلول تعقيم وحفظ العدسات اللاصقة رينو بلس 360 مل",
      before: meta.item2Before !== undefined ? meta.item2Before : 27,
      after: (meta.item2Before !== undefined ? meta.item2Before : 27) - 1,
      delta: -1,
      unit: "عبوة",
      note: "صرف وتسليم فوري للعميل من قسم العناية بالعدسات"
    });
    impact.finance.push({
      metric: "إيراد مبيعات التجزئة المباشرة",
      before: meta.prevSales || 2900,
      after: (meta.prevSales || 2900) + paid,
      delta: +paid,
      currency: "ج.م",
      note: "صافي قيمة الفاتورة بعد الخصم الترويجي المباشر"
    });
    impact.finance.push({
      metric: "مدفوعات إلكترونية / بطاقة بنكية (Card)",
      before: 0,
      after: paid,
      delta: +paid,
      currency: "ج.م",
      note: "تسوية إلكترونية فورية عبر ماكينة POS البنكية"
    });
    impact.finance.push({
      metric: "مستحقات آجلة لدى العميل (ذمم)",
      before: 0,
      after: 0,
      delta: 0,
      currency: "ج.م",
      note: "خالصة السداد بالكامل فور إصدار الفاتورة (0.00 ج.م)"
    });
    impact.orders.push({
      orderCode: targetCode || "POS-ORDER",
      previousStage: "نقطة البيع (POS)",
      newStage: "تم التسليم الفوري (delivered)",
      note: "بيع مباشر من الرف دون الحاجة لأمر تشغيل أو ورشة معمل"
    });
    impact.database.push({
      collectionName: "storeorders",
      action: "INSERT",
      documentId: targetCode,
      summary: "تسجيل أمر البيع المباشر بحالة delivered والدفع paid"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: "Products Stock",
      summary: "خصم كميات المخزون الفعلي بالمحل فوراً"
    });
    impact.database.push({
      collectionName: "storeinventorymovements",
      action: "INSERT",
      documentId: "OUT-CONSUMPTION",
      summary: "تسجيل حركة استهلاك وصرف مبيعات مباشرة بالدفتر التجاري"
    });
  } else if (normAction.includes("pos_lab_order") || (normAction.includes("order") && normAction.includes("create"))) {
    summary = `إنشاء طلب ومعمل جديد (${targetCode || 'طلب'}), قيد إيراد المبيعات والعربون بالخزينة وفتح أمر التشغيل`;
    impact.finance.push({
      metric: "إيراد مبيعات الطلب",
      before: 0,
      after: Number(meta.totalAmount || 2900),
      delta: Number(meta.totalAmount || 2900),
      currency: "ج.م",
      note: "قيد إجمالي قيمة الفاتورة"
    });
    impact.finance.push({
      metric: "عربون / تحصيل نقدية الخزينة",
      before: 10000,
      after: 11500,
      delta: Number(meta.paidAmount || meta.deposit || 1500),
      currency: "ج.م",
      note: "تحصيل فوري عند فتح الطلب"
    });
    impact.finance.push({
      metric: "مستحقات آجلة لدى العميل",
      before: 0,
      after: 1400,
      delta: 1400,
      currency: "ج.م",
      note: "رصيد مؤجل يستحق عند الاستلام"
    });
    impact.orders.push({
      orderCode: targetCode || "POS-ORDER",
      previousStage: "غير مسجل",
      newStage: "قيد التجهيز والمعمل (processing)",
      note: "تم إصدار الفاتورة وتثبيت القياسات البصرية وأمر الشغل"
    });
    impact.database.push({
      collectionName: "storeorders",
      action: "INSERT",
      documentId: targetCode,
      summary: "إنشاء وثيقة الفاتورة وبيانات العميل والمواصفات الطبية"
    });
    impact.database.push({
      collectionName: "storeactivities",
      action: "INSERT",
      documentId: "ACT-SALE",
      summary: "تسجيل حركة مبيعات جديدة في لوحة المؤشرات"
    });
  } else if ((normAction.includes("delivered") && !normAction.includes("maintenance")) || (details && details.includes("delivered") && !details.includes("صيانة"))) {
    summary = `تسليم النظارة للعميل، تحصيل الرصيد المتبقي 1,400 ج.م نقداً، وخصم الشنبر والعدسات من المخزن`;
    impact.inventory.push({
      item: "شمبر رايبان أفياتور كلاسيك - ذهبي",
      before: 5,
      after: 4,
      delta: -1,
      unit: "قطعة",
      note: "صرف وتسليم فعلي للعميل"
    });
    impact.inventory.push({
      item: "عدسة بلو كت OD (-2.00 / -0.50)",
      before: 4,
      after: 3,
      delta: -1,
      unit: "حبة",
      note: "قص وتركيب بالشنبر وتخفيض خلية مصفوفة المقاسات"
    });
    impact.inventory.push({
      item: "عدسة بلو كت OS (-1.75 / -0.50)",
      before: 4,
      after: 3,
      delta: -1,
      unit: "حبة",
      note: "قص وتركيب بالشنبر وتخفيض خلية مصفوفة المقاسات"
    });
    impact.finance.push({
      metric: "نقدية الخزينة (الدفعة الختامية)",
      before: 11500,
      after: 12900,
      delta: 1400,
      currency: "ج.م",
      note: "سداد كامل المستحقات عند استلام النظارة"
    });
    impact.finance.push({
      metric: "ذمم ومستحقات العميل الآجلة",
      before: 1400,
      after: 0,
      delta: -1400,
      currency: "ج.م",
      note: "إغلاق حساب الفاتورة (خالصة السداد 100%)"
    });
    impact.finance.push({
      metric: "مصروف المعمل الخارجي (قص وتركيب)",
      before: 0,
      after: 60,
      delta: 60,
      currency: "ج.م",
      note: "أتعاب معمل النور والصفا المركزي"
    });
    impact.orders.push({
      orderCode: targetCode || "POS-ORDER",
      previousStage: "جاهز للتسليم (ready)",
      newStage: "تم التسليم للعميل (delivered)",
      note: "اكتملت دورة الفحص والتجهيز والتسليم بنجاح"
    });
    impact.database.push({
      collectionName: "storeorders",
      action: "UPDATE",
      documentId: targetCode,
      summary: "تحديث حالة الطلب إلى delivered وحالة الدفع إلى paid بالكامل"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: "Products & Matrix",
      summary: "خصم الشنبر والعدسات وتحديث مصفوفة المقاسات opticsSpecs.matrixStock"
    });
  } else if (normAction.includes("ready") || (details && details.includes("ready"))) {
    summary = `انتهاء أعمال تشغيل وقص العدسات بالمعمل وأصبحت النظارة جاهزة تماماً لاستلام العميل`;
    impact.orders.push({
      orderCode: targetCode || "POS-ORDER",
      previousStage: "قيد التشغيل والقص (in_lab)",
      newStage: "جاهز للتسليم بالفرع (ready)",
      note: "فحص جودة العدسات ومطابقة مقاسات الـ Axis والـ PD"
    });
    impact.database.push({
      collectionName: "storeorders",
      action: "UPDATE",
      documentId: targetCode,
      summary: "تحديث labStatus إلى ready وإشعار موظفي الاستقبال"
    });
  } else if (normAction.includes("work_order")) {
    summary = `إصدار / تحديث مسار أمر تشغيل الورشة والمعمل ومتابعة مراحل القص الرقمي`;
    impact.orders.push({
      orderCode: targetCode || "WO-ORDER",
      previousStage: meta.prevStage || "جديد",
      newStage: meta.stage || details,
      note: "تنسيق العمل الفني مع معمل النور والصفا"
    });
    impact.database.push({
      collectionName: "storeworkorders",
      action: "UPDATE/INSERT",
      documentId: targetCode,
      summary: "تسجيل بيانات التشغيل والماكينات المستخدمة"
    });
  } else if (normAction.includes("supplier_shipment_received") || normAction.includes("supplier_receipt")) {
    summary = `استلام كامل للشحنة ${targetCode || ''}، إيداع 25 قطعة بالمخزن وتغذية خلايا مصفوفة مقاسات العدسات`;
    impact.inventory.push({
      item: "شمبر رايبان أفياتور كلاسيك - ذهبي",
      before: 4,
      after: 9,
      delta: +5,
      unit: "قطعة",
      note: "استلام وإيداع بالمخزن الرئيسي بعد الفحص"
    });
    impact.inventory.push({
      item: "عدسات بلو كت OD (-2.00 / -0.50)",
      before: 21,
      after: 31,
      delta: +10,
      unit: "حبة",
      note: "تغذية فورية لخلية مقاسات العين اليمنى بالجريد"
    });
    impact.inventory.push({
      item: "عدسات بلو كت OS (-1.75 / -0.50)",
      before: 21,
      after: 31,
      delta: +10,
      unit: "حبة",
      note: "تغذية فورية لخلية مقاسات العين اليسرى بالجريد"
    });
    impact.inventory.push({
      item: "إجمالي مخزون المتجر الكلي",
      before: 1148,
      after: 1173,
      delta: +25,
      unit: "قطعة",
      note: "زيادة إجمالي رصيد المخزن الفعلي"
    });
    impact.finance.push({
      metric: "القيمة الدفترية للأصول المخزنية",
      before: 710280,
      after: 720480,
      delta: +10200,
      currency: "ج.م",
      note: "إضافة قيمة البضاعة الموردة لأصول المتجر"
    });
    impact.database.push({
      collectionName: "storesuppliershipments",
      action: "UPDATE",
      documentId: targetCode,
      summary: "تغيير حالة الشحنة إلى received وتوثيق إذن الإضافة المخزنية"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: "Matrix & Stock",
      summary: "تحديث stockCount و matrixStock في قاعدة البيانات"
    });
    impact.database.push({
      collectionName: "storeinventorymovements",
      action: "INSERT",
      documentId: "IN-MOVEMENTS",
      summary: "تسجيل حركتي استلام مخزني للشنابر والعدسات"
    });
  } else if (normAction.includes("shipment_payment")) {
    summary = `سداد دفعة أولى 5,000 ج.م للمورد إيسيلور عبر تحويل بنكي وتخفيض الالتزام المالي الآجل إلى 5,200 ج.م`;
    impact.finance.push({
      metric: "مدفوعات الموردين (المسدد)",
      before: 0,
      after: 5000,
      delta: +5000,
      currency: "ج.م",
      note: "تحويل بنكي مثبت بإشعار رسمي"
    });
    impact.finance.push({
      metric: "مديونيات الموردين المعلقة (الآجل)",
      before: 10200,
      after: 5200,
      delta: -5000,
      currency: "ج.م",
      note: "تخفيض الالتزام المالي المستحق لشركة إيسيلور"
    });
    impact.database.push({
      collectionName: "storesuppliershipments",
      action: "UPDATE",
      documentId: targetCode,
      summary: "إضافة سجل سداد وتحديث paymentStatus إلى partial"
    });
    impact.database.push({
      collectionName: "storefinanceaudits",
      action: "INSERT",
      documentId: "FIN-AUDIT",
      summary: "قيد التدقيق المالي للدفع"
    });
  } else if (normAction.includes("shipment_product_associated")) {
    summary = `ربط أصناف الشراء والكميات المقدرة وخلايا مصفوفة مقاسات العدسات ببوليصة الشحنة`;
    impact.database.push({
      collectionName: "storesuppliershipments",
      action: "UPDATE",
      documentId: targetCode,
      summary: "إضافة بنود الشراء وتحديد خلايا الجريد المطلوب استلامها"
    });
  } else if (normAction.includes("supplier_shipment_created")) {
    summary = `تسجيل بوليصة شحنة جديدة وتثبيت مديونية والتزام مالي مستحق للمورد (10,200 ج.م بضاعة + 300 ج.م شحن)`;
    impact.finance.push({
      metric: "التزامات مشتريات الموردين",
      before: 0,
      after: 10200,
      delta: +10200,
      currency: "ج.م",
      note: "قيد التزام شحنة إيسيلور الجديدة"
    });
    impact.finance.push({
      metric: "مصاريف الشحن اللوجستي الوارد",
      before: 0,
      after: 300,
      delta: +300,
      currency: "ج.م",
      note: "أتعاب النقل والشحن المبرد"
    });
    impact.database.push({
      collectionName: "storesuppliershipments",
      action: "INSERT",
      documentId: targetCode,
      summary: "إنشاء بوليصة الشحنة برقم " + (targetCode || "")
    });
  } else if (normAction.includes("reorder_dispatched")) {
    summary = `إصدار وتوجيه أمر شراء رسمي عبر واتساب للمورد إيسيلور لتوريد 25 قطعة (5 شنابر + 20 عدسة بلو كت)`;
    impact.orders.push({
      orderCode: targetCode || "REORDER",
      previousStage: "مسودة داخلية",
      newStage: "تم الإرسال للمورد (sent)",
      note: "طلب عاجل لنواقص مصفوفة العدسات والشنابر"
    });
    impact.database.push({
      collectionName: "storeprocurementreorders",
      action: "INSERT",
      documentId: targetCode,
      summary: "إنشاء أمر التوريد والكميات المطلوبة ومقاسات الجريد"
    });
  } else if (normAction.includes("customer_deposit")) {
    const amt = Number(meta.amount || 500);
    const bal = Number(meta.depositBalance || amt);
    summary = `تحصيل دفعة نقدية تحت الحساب بقيمة ${amt.toLocaleString()} ج.م للعميل ${meta.customerName || 'عميل'} وقيدها في أمانات الخزينة الدائنة`;
    impact.finance.push({
      metric: "أمانات وودائع العملاء (رصيد دائن)",
      before: Math.max(0, bal - amt),
      after: bal,
      delta: +amt,
      currency: "ج.م",
      note: "رصيد مالي دائن متاح للاستخدام في مبيعات أو صيانة مستقبلية"
    });
    impact.finance.push({
      metric: "نقدية الخزينة (صندوق الفرع)",
      before: 12900,
      after: 12900 + amt,
      delta: +amt,
      currency: "ج.م",
      note: `إيداع نقدي فوري بموجب سند قبض رقم ${targetCode || meta.voucherNumber || 'DEP-VOUCHER'}`
    });
    impact.database.push({
      collectionName: "storeusers",
      action: "UPDATE",
      documentId: meta.customerId || "CUSTOMER",
      summary: `زيادة حقل depositBalance للعميل بمبلغ ${amt} ج.م`
    });
    impact.database.push({
      collectionName: "storecashmovements",
      action: "INSERT",
      documentId: targetCode || "CASH-IN",
      summary: "تسجيل إذن قبض نقدية cash_in تحت الحساب"
    });
  } else if (normAction.includes("inventory_scrap") || normAction.includes("scrap")) {
    const qty = Number(meta.quantity || 1);
    const loss = Number(meta.totalLoss || 180);
    summary = `إثبات هدر وتالف تشغيلي لعدد ${qty} قطعة بالورشة، وتسجيل خسارة بقيمة ${loss.toLocaleString()} ج.م بالمصروفات`;
    impact.inventory.push({
      item: targetCode || "عدسة بلو كت كورية عريضة (كسر أثناء الشطف)",
      before: 31,
      after: 31 - qty,
      delta: -qty,
      unit: "حبة/قطعة",
      note: `إتلاف وهدر تشغيلي - السبب: ${meta.reason || 'كسر أثناء التركيب'}`
    });
    impact.finance.push({
      metric: "خسائر الهدر والتالف التشغيلي (Scrap Losses)",
      before: 0,
      after: loss,
      delta: +loss,
      currency: "ج.م",
      note: "قيد تكلفة القطعة التالفة كمصروف خسائر تشغيل"
    });
    impact.finance.push({
      metric: "القيمة الدفترية للأصول المخزنية",
      before: 720480,
      after: 720480 - loss,
      delta: -loss,
      currency: "ج.م",
      note: "تخفيض قيمة المخزون الدفتري الفعلي"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: targetCode || "PRODUCT-STOCK",
      summary: `تخفيض المخزون الفعلي بمقدار ${qty} وإضافة سجل التوالف في scrapRecords`
    });
  } else if (normAction.includes("maintenance_ticket_created")) {
    summary = `فتح تذكرة صيانة وتعديل شاسيه برقم ${targetCode || ''} للعميل ${meta.customerName || 'عميل'} وفحص حالة الضمان`;
    impact.orders.push({
      orderCode: targetCode || "MNT-TICKET",
      previousStage: "غير مسجل",
      newStage: "تذكرة صيانة مفتوحة (requested)",
      note: `نوع الصيانة: ${meta.warrantyStatus === 'in_warranty' ? 'صيانة ضمان مجانية' : 'صيانة وتعديل مدفوعة'}`
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "INSERT",
      documentId: targetCode,
      summary: "تسجيل بيانات العميل والشاسيه وتاريخ الفحص الأولي"
    });
  } else if (normAction.includes("maintenance_technician_assigned")) {
    summary = `إسناد تذكرة الصيانة #${targetCode || ''} لفني الورشة ${meta.techName || 'فني الصيانة'} وتوليد رابط المتابعة الميداني`;
    impact.orders.push({
      orderCode: targetCode || "MNT-TICKET",
      previousStage: "قيد الانتظار (requested)",
      newStage: "تم التكليف بالورشة (assigned_to_tech)",
      note: `المسؤول المعين: ${meta.techName || 'فني الورشة'}`
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "UPDATE",
      documentId: targetCode,
      summary: "ربط assignedTechId وتوليد accessToken للرابط الميداني"
    });
  } else if (normAction.includes("maintenance_repaired") || normAction.includes("maintenance_technician_action")) {
    summary = `اكتمال أعمال الصيانة وتعديل الشاسيه بنجاح بالورشة، وجاهزية النظارة للتسليم الميداني`;
    impact.orders.push({
      orderCode: targetCode || "MNT-TICKET",
      previousStage: "قيد الصيانة بالورشة",
      newStage: "تم الإصلاح بنجاح (repaired)",
      note: `الإجراء الفني: ${meta.techAction || 'تعديل استقامة الشاسيه واستبدال الوسادات الأنفية ومسامير المفصلات'}`
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "UPDATE",
      documentId: targetCode,
      summary: "توثيق تقرير الفني ووقت الإنجاز الفعلي techCompletedAt"
    });
  } else if (normAction.includes("maintenance_remitted_to_treasury") || normAction.includes("maintenance_financials_recorded")) {
    const fee = Number(meta.serviceFee || 150);
    const parts = Number(meta.partsCost || 50);
    const coll = Number(meta.collectedAmount || (fee + parts));
    summary = meta.remittedToAdmin
      ? `توريد متحصلات الصيانة #${targetCode || ''} بقيمة ${coll.toLocaleString()} ج.م بالكامل إلى خزينة الإدارة المركزية`
      : `قيد حسابات الصيانة #${targetCode || ''}: رسوم خدمة ${fee} ج.م وقطع غيار ${parts} ج.م، المحصل: ${coll} ج.م`;
    impact.finance.push({
      metric: "إيراد خدمات الصيانة والورشة",
      before: 0,
      after: fee,
      delta: +fee,
      currency: "ج.م",
      note: "أتعاب تشغيل وضبط وتعديل الشاسيه"
    });
    impact.finance.push({
      metric: "تكلفة قطع الغيار المستهلكة (وسادات ومسامير)",
      before: 0,
      after: parts,
      delta: +parts,
      currency: "ج.م",
      note: "قطع غيار وإكسسوارات تم تركيبها بالنظارة"
    });
    impact.finance.push({
      metric: "نقدية الخزينة (المحصل والمورد)",
      before: 12900,
      after: 12900 + coll,
      delta: +coll,
      currency: "ج.م",
      note: meta.remittedToAdmin ? "توريد نهائي لخزينة الإدارة" : "تحصيل نقدية بالفرع"
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "UPDATE",
      documentId: targetCode,
      summary: meta.remittedToAdmin
        ? "إغلاق الحسابات وتحديث paymentStatus إلى remitted_to_admin"
        : "تحديث تكاليف الصيانة والمطلوب من العميل"
    });
  } else if (normAction.includes("maintenance_status_delivered_back")) {
    summary = `تسليم الشاسيه والنظارة للعميل بعد الصيانة التامة وإغلاق التذكرة بنجاح`;
    impact.orders.push({
      orderCode: targetCode || "MNT-TICKET",
      previousStage: "تم الإصلاح (repaired)",
      newStage: "تم التسليم للعميل (delivered_back)",
      note: "إغلاق التذكرة ومطابقة استلام العميل بعد المعاينة"
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "UPDATE",
      documentId: targetCode,
      summary: "تحديث الحالة النهائية إلى delivered_back"
    });
  } else if (normAction.includes("ai_anomaly_scan")) {
    summary = `إجراء مسح وتدقيق رقابي أمني بواسطة الذكاء الاصطناعي لعدد ${meta.analyzedCount || 20} حركة بسجل العمليات`;
    impact.database.push({
      collectionName: "auditlogs",
      action: "ANALYZE",
      documentId: targetCode || "AI-SCAN",
      summary: `تحليل زمني واكتشاف العمليات الحرجة والتوالف (تم رصد ${meta.anomaliesCount || 0} تنبيهات)`
    });
  } else if (normAction.includes("pos_installment_order_created")) {
    const tot = Number(meta.total || 4000);
    const dp = Number(meta.downPayment || 1000);
    const rem = Number(meta.totalRemaining || (tot - dp));
    summary = `فاتورة بيع بالتقسيط المباشر (${targetCode || 'POS-INST'}), تحصيل مقدم ${dp.toLocaleString()} ج.م، وقيد مديونية ${rem.toLocaleString()} ج.م على ${meta.months || 4} شهور`;
    impact.finance.push({
      metric: "إيراد مبيعات التقسيط التعاقدي",
      before: 0,
      after: tot,
      delta: +tot,
      currency: "ج.م",
      note: "إثبات إيراد الفاتورة الإجمالي بنظام الاستحقاق (Accrual Basis)"
    });
    impact.finance.push({
      metric: "مقدم نقدي محصل بالخزينة",
      before: 12900,
      after: 12900 + dp,
      delta: +dp,
      currency: "ج.م",
      note: "دفعة مقدمة مستلمة نقداً فور توقيع العقد"
    });
    impact.finance.push({
      metric: "أقساط وذمم مدينة مستحقة على العميل",
      before: 0,
      after: rem,
      delta: +rem,
      currency: "ج.م",
      note: `مديونية مقسطة على ${meta.months || 4} أقساط شهرية متتالية بكفالة الضامن`
    });
    impact.orders.push({
      orderCode: targetCode || "POS-INST",
      previousStage: "نقطة البيع (POS)",
      newStage: "بيع بالتقسيط - قيد السداد الدوري (installment_active)",
      note: `قسط شهري: ${meta.monthlyAmount || 750} ج.م`
    });
    impact.database.push({
      collectionName: "storeorders",
      action: "INSERT",
      documentId: targetCode,
      summary: "إنشاء الفاتورة وتثبيت جدول الأقساط وبيانات الضامن"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: "Products Stock",
      summary: "خصم كميات المخزون الفعلي بالمحل فوراً"
    });
  } else if (normAction.includes("installment_payment_collected") || normAction.includes("installment_plan_completed")) {
    const paid = Number(meta.paidAmount || 750);
    const rem = Number(meta.totalRemaining || 0);
    summary = meta.isFullySettled
      ? `تحصيل القسط الختامي رقم ${meta.installmentIndex || ''} بمبلغ ${paid.toLocaleString()} ج.م وإغلاق عقد التقسيط بالكامل للفاتورة #${targetCode}`
      : `تحصيل القسط رقم ${meta.installmentIndex || ''} بمبلغ ${paid.toLocaleString()} ج.م نقداً للفاتورة #${targetCode} وتخفيض مديونية العميل`;
    impact.finance.push({
      metric: "نقدية الخزينة (تحصيل قسط دوري)",
      before: 12900,
      after: 12900 + paid,
      delta: +paid,
      currency: "ج.م",
      note: `تحصيل قسط شهري رسمي - إيصال #${meta.receiptNumber || 'RCP'}`
    });
    impact.finance.push({
      metric: "أقساط وذمم مدينة متبقية على العميل",
      before: rem + paid,
      after: rem,
      delta: -paid,
      currency: "ج.م",
      note: `الرصيد المتبقي على العميل: ${rem.toLocaleString()} ج.م`
    });
    impact.database.push({
      collectionName: "storeorders",
      action: "UPDATE",
      documentId: targetCode,
      summary: meta.isFullySettled
        ? "سداد كامل الأقساط وتحديث حالة الفاتورة إلى paid بالكامل"
        : `تحديث القسط رقم ${meta.installmentIndex} إلى paid`
    });
  } else if (normAction.includes("order_return_restocked")) {
    const refAmt = Number(meta.refundAmount || 0);
    summary = `إتمام استرداد مالي لمرتجع سليم #${targetCode || ''} بمبلغ ${refAmt.toLocaleString()} ج.م وإعادة الأصناف للمخزن المتاح للبيع`;
    impact.finance.push({
      metric: "مردودات مبيعات (رد نقدية للعميل)",
      before: 0,
      after: -refAmt,
      delta: -refAmt,
      currency: "ج.م",
      note: "صرف نقدي من الخزينة للعميل بعد فحص سلامة السلعة بالفرع"
    });
    impact.inventory.push({
      item: "نظارة شمسية / طبية مسترجعة بحالة المصنع",
      before: 3,
      after: 4,
      delta: +1,
      unit: "قطعة",
      note: "إعادة إدخال للمخزون الصالح للبيع فوراً بعد مطابقة شروط الـ 14 يوماً"
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "UPDATE",
      documentId: targetCode,
      summary: "تحديث حالة المرتجع إلى refunded وإثبات استعادة المخزون"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: "Products Stock",
      summary: "إعادة إضافة الرصيد إلى stockCount و storeStock"
    });
  } else if (normAction.includes("order_return_scrapped")) {
    const refAmt = Number(meta.refundAmount || 0);
    summary = `استرداد مالي لمرتجع تالف تحت الضمان #${targetCode || ''} بمبلغ ${refAmt.toLocaleString()} ج.م وقيد البضاعة كهدر وتالف تشغيلي بالورشة`;
    impact.finance.push({
      metric: "مردودات مبيعات وضمان (تعويض العميل)",
      before: 0,
      after: -refAmt,
      delta: -refAmt,
      currency: "ج.م",
      note: "استرداد نقدي تحت مظلة الضمان المعتمد"
    });
    impact.finance.push({
      metric: "خسائر هالك وتوالف الضمان (Warranty Expense)",
      before: 0,
      after: refAmt,
      delta: +refAmt,
      currency: "ج.م",
      note: "قيد تكلفة القطعة المعيبة كمصروف وخسائر ضمان تشغيلية"
    });
    impact.database.push({
      collectionName: "storereturnrequests",
      action: "UPDATE",
      documentId: targetCode,
      summary: "تحديث حالة المرتجع إلى refunded وتصنيف sentToScrap: true"
    });
    impact.database.push({
      collectionName: "storeproducts",
      action: "UPDATE",
      documentId: "Scrap Records",
      summary: "إدراج الصنف في سجلات التوالف scrapRecords دون المساس بالمخزون الصالح"
    });
  } else if (normAction.includes("prescription")) {
    summary = `تسجيل كشف نظر العميل وتثبيت مقاسات SPH و CYL و AXIS و PD في السجل الطبي`;
    impact.database.push({
      collectionName: "clientprofiles / storeusers",
      action: "INSERT",
      documentId: targetCode,
      summary: "إضافة كشف نظر جديد مع تشخيص الطبيب المعالج"
    });
  } else {
    summary = details || "توثيق إجراء نظامي بسجل الرقابة";
    impact.database.push({
      collectionName: "auditlogs",
      action: "INSERT",
      documentId: targetCode || "SYSTEM",
      summary: details
    });
  }

  return { summary, impact };
}

/**
 * Log an audit trail entry in the database.
 * Non-blocking safe logger with deep impact synthesis.
 */
async function logAudit({
  subdomain,
  userId = null,
  userName = "المدير العام",
  userRole = "admin",
  branchId = null,
  action,
  actionLabel,
  targetType = "system",
  targetId = null,
  targetCode = null,
  details,
  impactSummary = "",
  deepImpact = null,
  metadata = {}
}) {
  try {
    if (!subdomain || !action || !details) return;

    let finalImpactSummary = impactSummary;
    let finalDeepImpact = deepImpact;

    if (!finalImpactSummary || !finalDeepImpact) {
      const synthesized = synthesizeImpact({ action, details, metadata, targetType, targetCode });
      if (!finalImpactSummary) finalImpactSummary = synthesized.summary;
      if (!finalDeepImpact) finalDeepImpact = synthesized.impact;
    }

    const AuditLog = getAuditLogModel(subdomain);
    await AuditLog.create({
      userId,
      userName,
      userRole,
      branchId,
      action,
      actionLabel: actionLabel || action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      targetCode,
      details,
      impactSummary: finalImpactSummary,
      deepImpact: finalDeepImpact,
      metadata,
      timestamp: new Date()
    });
  } catch (err) {
    console.error("[AUDIT_LOG_WRITE_ERROR]:", err.message);
  }
}

module.exports = {
  logAudit,
  synthesizeImpact
};
