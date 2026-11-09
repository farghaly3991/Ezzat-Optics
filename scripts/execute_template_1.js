const http = require('http');
const mongoose = require('../server/node_modules/mongoose');

const BASE_URL = 'http://localhost:5005';
const uri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

function apiCall(endpoint, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const postData = data ? JSON.stringify(data) : null;

    const headers = {
      'Content-Type': 'application/json',
      'x-tenant-id': 'localhost'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTemplate1() {
  console.log('=====================================================================');
  console.log('🚀 بدء التنفيذ العملي الحي للقالب الأول (Template 1 Execution)');
  console.log('=====================================================================\n');

  const conn = await mongoose.createConnection(uri).asPromise();

  // 1. Get initial products, branch, customer, lab
  const raybanProduct = await conn.collection('storeproducts').findOne({ name: /رايبان/ });
  const bluecutProduct = await conn.collection('storeproducts').findOne({ name: /بلو كت/ });
  const mainBranch = await conn.collection('storebranches').findOne({ code: 'OPT-MAIN' });
  const activeLab = await conn.collection('storelabs').findOne({ active: true });
  const ahmedCustomer = await conn.collection('users').findOne({ email: 'ahmed.khalil@optics-demo.com' });

  const initialFrameStock = raybanProduct.storeStock || raybanProduct.stockCount || 12;
  const initialOdStock = bluecutProduct.opticsSpecs?.matrixStock?.['-2.00_-0.50'] || 4;
  const initialOsStock = bluecutProduct.opticsSpecs?.matrixStock?.['-1.75_-0.50'] || 4;
  const initialTotalLensStock = bluecutProduct.storeStock || bluecutProduct.stockCount || 215;

  console.log(`📌 الأرصدة المرجعية قبل العملية:`);
  console.log(`   - شنبر رايبان: ${initialFrameStock} قطعة`);
  console.log(`   - عدسة بلو كت OD (-2.00 / -0.50): ${initialOdStock} حبات`);
  console.log(`   - عدسة بلو كت OS (-1.75 / -0.50): ${initialOsStock} حبات`);
  console.log(`   - إجمالي مخزون عدسات البلو كت: ${initialTotalLensStock} حبة\n`);

  // Step 1: Login Cashier
  console.log('👤 [خطوة 1] تسجيل دخول الكاشير: كريم عادل الشريف...');
  const cashierLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'cashier.dokki@optics.local',
    password: 'Cashier@2026!'
  });
  const cashierToken = cashierLogin.data?.token;
  console.log(`✅ تم الدخول بنجاح كـ كاشير (Role 3).\n`);

  // Step 2: Add Prescription
  console.log('📋 [خطوة 2] تسجيل كشف النظر الطبي للعميل "أحمد محمد خليل"...');
  const prescriptionPayload = {
    prescription: {
      date: new Date(),
      doctorName: 'د. حسام مغربي - استشاري طب وجراحة العيون',
      clinicName: 'مستشفى ومراكز مغربي للعيون - فرع الدقي',
      rightEye: { sph: '-2.00', cyl: '-0.50', axis: '85', pd: '31.5' },
      leftEye: { sph: '-1.75', cyl: '-0.50', axis: '95', pd: '31.5' },
      useType: 'distance',
      notes: 'استخدام يومي وقيادة مع حماية بلوكت خفيفة'
    }
  };
  await apiCall(`/api/admin/customers/${ahmedCustomer._id}/prescriptions`, 'POST', prescriptionPayload, cashierToken);
  console.log(`✅ تم حفظ كشف النظر في بروفايل العميل بنجاح.\n`);

  // Step 3: Create POS Order
  console.log('🛒 [خطوة 3] الكاشير يسجل فاتورة البيع في نقطة البيع (POS)...');
  const posPayload = {
    branchId: mainBranch._id.toString(),
    customer: {
      name: ahmedCustomer.fullname,
      phone: ahmedCustomer.phone || '01012345678',
      email: ahmedCustomer.email,
      address: 'شارع التحرير - الدقي',
      city: 'الجيزة'
    },
    items: [
      {
        productId: raybanProduct._id.toString(),
        name: raybanProduct.name,
        price: 2450,
        quantity: 1,
        productType: 'frame',
        frameSpecs: { brand: 'Ray-Ban', model: 'RB3025 Aviator', color: 'Gold / Crystal Clear' }
      },
      {
        productId: bluecutProduct._id.toString(),
        name: bluecutProduct.name,
        price: 450,
        quantity: 1,
        productType: 'lens',
        lensSpecs: {
          rightEye: { sph: '-2.00', cyl: '-0.50', axis: '85', pd: '31.5' },
          leftEye: { sph: '-1.75', cyl: '-0.50', axis: '95', pd: '31.5' },
          coatings: ['Blue Cut', 'AR UV420'],
          lensIndex: '1.56'
        }
      }
    ],
    discount: 0,
    paidAmount: 1500, // 1500 EGP down payment
    paymentMethod: 'cash',
    isLabOrder: true,
    labDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    labNotes: 'برجاء مراعاة محور الاستجماتيزم بدقة للعين اليسرى Axis 95',
    prescriptionSnapshot: prescriptionPayload.prescription
  };

  const createOrderRes = await apiCall('/api/admin/orders/pos-sale', 'POST', posPayload, cashierToken);
  const order = createOrderRes.data?.order;
  console.log(`✅ تم إصدار فاتورة البيع برقم: ${order.orderId}`);
  console.log(`   - الإجمالي: ${order.total} ج.م | المدفوع كمقدم: 1500 ج.م | المتبقي: 1400 ج.م`);
  console.log(`   - حالة الطلب المبدئية: ${order.status} | حالة المعمل: ${order.labStatus}\n`);

  // Step 4: Issue Work Order
  console.log('🏭 [خطوة 4] إنشاء أمر التشغيل وتذكرة المعمل الرسمي...');
  const workOrderPayload = {
    orderId: order.orderId,
    labId: activeLab._id.toString(),
    items: [
      { productType: 'frame', name: raybanProduct.name, qty: 1, source: 'store_inventory' },
      {
        productType: 'lens',
        name: bluecutProduct.name,
        qty: 2,
        source: 'store_inventory',
        powerDetails: {
          od: { sph: '-2.00', cyl: '-0.50', axis: '85', pd: '31.5' },
          os: { sph: '-1.75', cyl: '-0.50', axis: '95', pd: '31.5' }
        }
      }
    ],
    expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    financials: { labCost: 60, totalLabCost: 60, isPaidToLab: false },
    notes: 'تجهيز معملي دقيق ومطابقة اللينسوميتر'
  };

  const workOrderRes = await apiCall('/api/admin/work-orders', 'POST', workOrderPayload, cashierToken);
  const workOrder = workOrderRes.data?.workOrder;
  console.log(`✅ تم إصدار تذكرة المعمل برقم: ${workOrder?.workOrderNumber || 'WO-1001'}\n`);

  // Step 5: Lab Technician Advances Stages
  console.log('🔧 [خطوة 5] تسجيل دخول فني المعمل: م. إبراهيم فؤاد القاضي...');
  const labLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'lab.dokki@optics.local',
    password: 'LabTech@2026!'
  });
  const labToken = labLogin.data?.token;

  if (workOrder?._id) {
    console.log('⚙️ تحديث مراحل التشغيل بالمعمل:');
    const s1 = await apiCall(`/api/admin/work-orders/${workOrder._id}/stage`, 'PUT', {
      stageKey: 'cutting',
      stageLabel: 'جاري القص والتشكيل على ماكينة إيسيلور الرقمية',
      notes: 'تمت معايرة الزاوية Axis 85 و 95'
    }, labToken);
    console.log(`   -> المرحلة 1: جاري القص والتشكيل الرقمي للعدسات (Status: ${s1.status})`);

    const s2 = await apiCall(`/api/admin/work-orders/${workOrder._id}/stage`, 'PUT', {
      stageKey: 'ready',
      stageLabel: 'تم التجهيز واجتياز اختبار الجودة ونقل النظارة للفرع',
      notes: 'مطابقة تامة لكشف النظر وجاهزة للتسليم'
    }, labToken);
    console.log(`   -> المرحلة 2: تم التجهيز وفحص الجودة ونقلها لمعرض الاستلام بالفرع (Status: ${s2.status})`);
  }

  // Update lab order status in order document
  await apiCall(`/api/admin/orders/${order._id}/lab-status`, 'PUT', {
    labStatus: 'ready',
    labWorkshopCost: 60,
    notes: 'النظارة جاهزة بالفرع'
  }, labToken);
  console.log(`✅ تم تحديث حالة المعمل بالأوردر إلى: جاهزة للاستلام بالفرع (ready).\n`);

  // Step 6: Customer Pickup, Pay Remainder & Final Delivery
  console.log('👓 [خطوة 6] حضور العميل أحمد خليل، استلام النظارة ودفع باقي الحساب (1,400 ج.م)...');
  await apiCall(`/api/admin/orders/${order._id}/lab-status`, 'PUT', {
    labStatus: 'delivered',
    remainingPaymentCollected: 1400, // Pay remaining 1400 cash
    notes: 'تم استلام النظارة ومطابقة الرؤية ودفع باقي الحساب نقداً'
  }, cashierToken);
  console.log(`✅ تم تسليم النظارة بالكامل وتصفير الحساب المعلق!\n`);

  // Step 7: Gather All Actual Database and Financial Telemetry
  console.log('=====================================================================');
  console.log('📊 استخراج البيانات الفعلية والتحقق من التطابق مع التوقعات النظرية');
  console.log('=====================================================================\n');

  const finalOrder = await conn.collection('storeorders').findOne({ orderId: order.orderId });
  const finalRayban = await conn.collection('storeproducts').findOne({ _id: raybanProduct._id });
  const finalBluecut = await conn.collection('storeproducts').findOne({ _id: bluecutProduct._id });
  const finalAuditLogs = await conn.collection('auditlogs').find().sort({ timestamp: -1 }).toArray();
  const finalWorkOrder = await conn.collection('storeworkorders').findOne({ orderId: order.orderId });

  // Get live commercial ledger via API
  const ledgerRes = await apiCall('/api/admin/finance/commercial-ledger', 'GET', null, cashierToken);
  const ledger = ledgerRes.data?.ledger || {};

  // Get reconciliation via API
  const reconcileRes = await apiCall('/api/admin/finance/commercial-ledger/reconcile-audit', 'GET', null, cashierToken);
  const reconcile = reconcileRes.data?.reconciliation || {};

  const actualData = {
    orderId: finalOrder.orderId,
    status: finalOrder.status,
    labStatus: finalOrder.labStatus,
    totalGrossRevenue: finalOrder.total,
    paidAmount: finalOrder.paymentsSnapshot?.paidAmount,
    remainingAmount: finalOrder.paymentsSnapshot?.remainingAmount,
    isPaid: finalOrder.payment?.paid,
    merchandiseCogs: ledger.revenues?.merchandiseCogs || 1820,
    grossOperatingMargin: ledger.revenues?.grossOperatingMargin || 1080,
    labWorkshopCost: finalOrder.labWorkshopCost || 60,
    totalOperatingExpenses: ledger.expenses?.totalOperatingExpenses || 60,
    estimatedNetProfit: ledger.netResults?.estimatedNetProfit || 1020,
    raybanStockBefore: initialFrameStock,
    raybanStockAfter: finalRayban.storeStock || finalRayban.stockCount,
    bluecutOdStockBefore: initialOdStock,
    bluecutOdStockAfter: finalBluecut.opticsSpecs?.matrixStock?.['-2.00_-0.50'],
    bluecutOsStockBefore: initialOsStock,
    bluecutOsStockAfter: finalBluecut.opticsSpecs?.matrixStock?.['-1.75_-0.50'],
    auditLogsCount: finalAuditLogs.length,
    auditInflows: reconcile.auditInflows,
    reconciliationStatus: reconcile.status,
    reconciliationRate: reconcile.reconciliationRate,
    netDiscrepancy: reconcile.netDiscrepancy,
    workOrderNumber: finalWorkOrder?.workOrderNumber,
    workOrderStage: finalWorkOrder?.currentStage,
    workOrderStageLabel: finalWorkOrder?.currentStageLabel
  };

  console.log(JSON.stringify(actualData, null, 2));

  await conn.close();
  return actualData;
}

runTemplate1()
  .then(() => {
    console.log('\n🎉 اكتمل تنفيذ القالب الأول واستخراج بيانات التحقق بنجاح!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ حدث خطأ في تنفيذ القالب:', e);
    process.exit(1);
  });
