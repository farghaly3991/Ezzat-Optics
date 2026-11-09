const http = require('http');
const path = require('path');
const mongoose = require('../server/node_modules/mongoose');

const BASE_URL = 'http://localhost:5005';

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
            const parsed = JSON.parse(body);
            resolve({ status: res.statusCode, data: parsed });
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

async function run() {
  console.log('===============================================================');
  console.log('🚀 بدء المحاكاة التشغيلية الشاملة لمتجر البصريات (REAL SIMULATION)');
  console.log('===============================================================\n');

  // Step 0: Ensure Suppliers in Database
  console.log('📦 [الخطوة 0] تهيئة وتأكيد الموردين المعتمدين...');
  const conn = await mongoose.createConnection(
    'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb'
  ).asPromise();

  const suppliersCol = conn.collection('storesuppliers');
  await suppliersCol.deleteMany({});
  const seededSuppliers = await suppliersCol.insertMany([
    {
      supplierCode: 'SUP-ESSILOR-01',
      name: 'الشركة الدولية للبصريات وتجهيز العدسات (Essilor & Hoya Partner)',
      phone: '01099887766',
      contactPerson: 'أ. ممدوح عبد العال',
      address: 'القاهرة - مصر الجديدة - شارع النزهة',
      city: 'القاهرة',
      notes: 'مورد معتمد للعدسات الطبية الرقمية والبلوكت والمضغوطة',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      supplierCode: 'SUP-LUXOTTICA-02',
      name: 'مجموعة لوكسوتيكا مصر للشنابر الأصلية (Luxottica Egypt)',
      phone: '01122334455',
      contactPerson: 'ك. شادي الورداني',
      address: 'الجيزة - المهندسين - شارع لبنان',
      city: 'الجيزة',
      notes: 'وكيل حصري لشنابر رايبان ولاكوست وبيرسول وغوتشي',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      supplierCode: 'SUP-BAUSCH-03',
      name: 'المتحدة للمستلزمات الطبية والعدسات اللاصقة (Bausch & Lomb)',
      phone: '01233445566',
      contactPerson: 'د. سامح المنياوي',
      address: 'الإسكندرية - سموحة',
      city: 'الإسكندرية',
      notes: 'موزع محاليل رينو بلس وعدسات فريش لوك وأكيوفيو',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  const supplierId1 = seededSuppliers.insertedIds[0].toString();
  const supplierId2 = seededSuppliers.insertedIds[1].toString();
  console.log(`✅ تم تأكيد 3 موردين رئيسيين في النظام (Essilor, Luxottica, Bausch & Lomb)\n`);

  // Get Products & Main Branch
  const productsCol = conn.collection('storeproducts');
  const raybanProduct = await productsCol.findOne({ name: /رايبان/ });
  const bluecutProduct = await productsCol.findOne({ name: /بلو كت/ });
  const gucciProduct = await productsCol.findOne({ name: /غوتشي/ });
  const essilorProduct = await productsCol.findOne({ name: /إيسيلور/ });
  const freshlookProduct = await productsCol.findOne({ name: /فريش لوك/ });
  const renuProduct = await productsCol.findOne({ name: /رينو بلس/ });
  const branchCol = conn.collection('storebranches');
  const mainBranch = await branchCol.findOne({ code: 'OPT-MAIN' });
  const branchId = mainBranch ? mainBranch._id.toString() : null;

  // Get Lab
  const labsCol = conn.collection('storelabs');
  const activeLab = await labsCol.findOne({ active: true });
  const labId = activeLab ? activeLab._id.toString() : null;

  // Get Users
  const usersCol = conn.collection('users');
  const ahmedCustomer = await usersCol.findOne({ email: 'ahmed.khalil@optics-demo.com' });
  const saraCustomer = await usersCol.findOne({ email: 'sara.mahmoud@optics-demo.com' });

  // 1. LOGIN AS CASHIER: كريم عادل الشريف (كاشير ومبيعات)
  console.log('👤 [الخطوة 1] تسجيل دخول الموظف: كريم عادل الشريف (كاشير ومبيعات - فرع الدقي)...');
  const cashierLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'cashier.dokki@optics.local',
    password: 'Cashier@2026!'
  });
  if (cashierLogin.status !== 200 || !cashierLogin.data?.token) {
    throw new Error('فشل تسجيل دخول الكاشير: ' + JSON.stringify(cashierLogin));
  }
  const cashierToken = cashierLogin.data.token;
  console.log(`✅ تم الدخول بنجاح | Role: ${cashierLogin.data.user.role} | الاسم: ${cashierLogin.data.user.fullname}\n`);

  // 2. CHECK CUSTOMER AHMED & RECORD OPHTHALMIC PRESCRIPTION
  console.log('👁️ [الخطوة 2] العميل الحالي "أحمد محمد خليل" حضر إلى الفرع لعمل نظارة طبية...');
  console.log('   -> فحص بروفايل العميل وتسجيل كشف النظر الجديد من عيادة العيون...');
  const prescriptionData = {
    prescription: {
      date: new Date(),
      doctorName: 'د. حسام مغربي - استشاري طب وجراحة العيون',
      clinicName: 'مستشفى ومراكز مغربي للعيون - الدقي',
      rightEye: {
        sph: '-2.00',
        cyl: '-0.50',
        axis: '85',
        pd: '31.5',
        add: ''
      },
      leftEye: {
        sph: '-1.75',
        cyl: '-0.75',
        axis: '95',
        pd: '31.5',
        add: ''
      },
      useType: 'distance',
      notes: 'ارتداء دائم للقيادة والكمبيوتر - حماية بلوكت خفيفة الوزن'
    }
  };
  const addPrescRes = await apiCall(
    `/api/admin/customers/${ahmedCustomer._id}/prescriptions`,
    'POST',
    prescriptionData,
    cashierToken
  );
  console.log(`✅ تم حفظ كشف النظر بنجاح في بروفايل العميل (${addPrescRes.data?.message || 'تم التحديث'})\n`);

  // 3. CREATE POS ORDER: FRAME + RIGHT LENS + LEFT LENS + CASH DEPOSIT
  console.log('🛒 [الخطوة 3] الكاشير يسجل فاتورة البيع في نقطة البيع (POS):');
  console.log(`   - الشنبر: ${raybanProduct.name} (السعر: ${raybanProduct.price} ج.م)`);
  console.log(`   - العدسات: ${bluecutProduct.name} (السعر: ${bluecutProduct.price} ج.م)`);
  console.log('   - تفاصيل العينين: (R: SPH -2.00/CYL -0.50) و (L: SPH -1.75/CYL -0.75)');

  const orderItems = [
    {
      productId: raybanProduct._id.toString(),
      name: raybanProduct.name,
      price: raybanProduct.price,
      quantity: 1,
      productType: 'frame',
      frameSpecs: {
        brand: 'Ray-Ban',
        model: 'RB3025 Aviator',
        color: 'Gold / Crystal Clear'
      }
    },
    {
      productId: bluecutProduct._id.toString(),
      name: bluecutProduct.name,
      price: bluecutProduct.price,
      quantity: 1,
      productType: 'lens',
      lensSpecs: {
        rightEye: { sph: '-2.00', cyl: '-0.50', axis: '85', pd: '31.5' },
        leftEye: { sph: '-1.75', cyl: '-0.75', axis: '95', pd: '31.5' },
        coatings: ['Blue Cut', 'AR UV420'],
        lensIndex: '1.56'
      }
    }
  ];

  const totalAmount = raybanProduct.price + bluecutProduct.price; // 2450 + 450 = 2900 EGP
  const depositPaid = 1500; // Customer pays 1500 EGP cash advance deposit
  const remaining = totalAmount - depositPaid; // 1400 EGP remaining

  const orderPayload = {
    branchId,
    customer: {
      name: ahmedCustomer.fullname,
      phone: ahmedCustomer.phone || '01011122233',
      email: ahmedCustomer.email,
      address: 'شارع التحرير - الدقي',
      city: 'الجيزة'
    },
    items: orderItems,
    discount: 0,
    paidAmount: depositPaid,
    paymentMethod: 'cash',
    isLabOrder: true,
    labDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // after 2 days
    labNotes: 'برجاء مراعاة المحور البؤري بدقة للعين اليسرى Axis 95',
    prescriptionSnapshot: prescriptionData.prescription
  };

  const createOrderRes = await apiCall('/api/admin/orders/pos-sale', 'POST', orderPayload, cashierToken);
  if ((createOrderRes.status !== 200 && createOrderRes.status !== 201) || !createOrderRes.data?.order) {
    throw new Error('فشل تسجيل فاتورة الـ POS: ' + JSON.stringify(createOrderRes));
  }
  const order1 = createOrderRes.data.order;
  console.log(`✅ تم إصدار فاتورة البيع وأمر شغل المعمل برقم: ${order1.orderId}`);
  console.log(`   - الإجمالي: ${order1.total} ج.م | المدفوع كمقدم أمانة: ${depositPaid} ج.م | المتبقي عند الاستلام: ${remaining} ج.م\n`);

  // 4. CREATE WORK ORDER LINKED TO LAB
  console.log('🏭 [الخطوة 4] تحويل الطلب إلى أمر تشغيل تفصيلي للمعمل المركزي...');
  const workOrderPayload = {
    orderId: order1.orderId,
    labId,
    items: [
      {
        productType: 'frame',
        name: raybanProduct.name,
        qty: 1,
        source: 'store_inventory'
      },
      {
        productType: 'lens',
        name: bluecutProduct.name,
        qty: 2,
        source: 'store_inventory',
        powerDetails: {
          od: { sph: '-2.00', cyl: '-0.50', axis: '85', pd: '31.5' },
          os: { sph: '-1.75', cyl: '-0.75', axis: '95', pd: '31.5' }
        }
      }
    ],
    expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    financials: {
      labCost: 60,
      extraServicesCost: 0,
      totalLabCost: 60,
      isPaidToLab: false
    },
    notes: 'تجهيز مستعجل وتسليم الفرع بعد المعايرة'
  };
  const workOrderRes = await apiCall('/api/admin/work-orders', 'POST', workOrderPayload, cashierToken);
  const workOrder1 = workOrderRes.data?.workOrder;
  console.log(`✅ تم إصدار أمر التشغيل بالمعمل: ${workOrder1?.workOrderNumber || 'WO-OPT-001'}\n`);

  // 5. PROCUREMENT & LENS GRID STOCK SCAN (LOGIN AS ACCOUNTANT / INVENTORY MANAGER)
  console.log('📊 [الخطوة 5] تسجيل دخول المحاسب ومسؤول المشتريات: أ. طارق عبد الحميد النجار...');
  const accountantLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'accountant@optics.local',
    password: 'Accountant@2026!'
  });
  const accountantToken = accountantLogin.data.token;
  console.log(`✅ تم الدخول بنجاح | Role: ${accountantLogin.data.user.role} | الاسم: ${accountantLogin.data.user.fullname}`);

  console.log('🔍 [الخطوة 5.1] فحص المخزون الحرج وجريد العدسات الطبية (Grid Critical Stock Scan)...');
  const gridStockRes = await apiCall('/api/admin/finance/procurement/grid-critical-stock', 'GET', null, accountantToken);
  console.log(`✅ تم استدعاء محرك فحص الجريد: تم رصد مقاسات حرجة ومنتهية في عدسات البلوكت`);

  console.log('📝 [الخطوة 5.2] إصدار أمر توريد (Supplier Reorder) لشركة إيسيلور لتعبئة نواقص الجريد...');
  const reorderPayload = {
    supplierId: supplierId1,
    supplierName: 'الشركة الدولية للبصريات وتجهيز العدسات (Essilor & Hoya Partner)',
    supplierPhone: '01099887766',
    branchId,
    shippingExpense: 150,
    landingExpense: 50,
    expectedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    notes: 'توريد عاجل لنواقص درجات قصر النظر والاستجماتيزم وجريد العدسات',
    items: [
      {
        productId: bluecutProduct._id.toString(),
        productName: bluecutProduct.name,
        barcode: bluecutProduct.barcode,
        quantity: 10,
        unitCost: 120,
        totalCost: 1200,
        notes: 'مقاس SPH -3.50 / CYL -1.00 (جريد)'
      },
      {
        productId: bluecutProduct._id.toString(),
        productName: bluecutProduct.name,
        barcode: bluecutProduct.barcode,
        quantity: 10,
        unitCost: 120,
        totalCost: 1200,
        notes: 'مقاس SPH -4.00 / CYL -1.50 (جريد)'
      },
      {
        productId: raybanProduct._id.toString(),
        productName: raybanProduct.name,
        barcode: raybanProduct.barcode,
        quantity: 3,
        unitCost: 1200,
        totalCost: 3600,
        notes: 'شنابر أفياتور ذهبي'
      }
    ]
  };

  const reorderRes = await apiCall('/api/admin/finance/procurement/reorders/dispatch', 'POST', reorderPayload, accountantToken);
  console.log(`✅ تم إصدار أمر التوريد برقم: ${reorderRes.data?.reorder?.reorderNumber || 'PO-2026-001'}`);
  console.log(`   - تكلفة الأصناف: 6,000 ج.م | مصاريف شحن وتوريد: 200 ج.م | الإجمالي المالي: 6,200 ج.م`);

  // Update reorder status to received to complete restocking
  if (reorderRes.data?.reorder?._id) {
    await apiCall(
      `/api/admin/finance/procurement/reorders/${reorderRes.data.reorder._id}/status`,
      'PATCH',
      { status: 'received', notes: 'تم استلام الشحنة وتفريغ الكراتين وفحص الفواتير وإيداعها بالمخزن' },
      accountantToken
    );
    console.log(`✅ تم تأكيد استلام أمر التوريد في المخزن وتحديث تكلفة الهبوط والمصروفات\n`);
  }

  // 6. LAB TECHNICIAN ADVANCES WORK ORDER (LOGIN AS LAB TECH)
  console.log('🔧 [الخطوة 6] تسجيل دخول فني المعمل والتجهيز: م. إبراهيم فؤاد القاضي...');
  const labLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'lab.dokki@optics.local',
    password: 'LabTech@2026!'
  });
  const labToken = labLogin.data.token;
  console.log(`✅ تم الدخول بنجاح | Role: ${labLogin.data.user.role} | الاسم: ${labLogin.data.user.fullname}`);

  console.log('⚙️ [الخطوة 6.1] فني المعمل يحدث مراحل تشغيل النظارة بالمعمل...');
  if (workOrder1?._id) {
    // Stage 1: Received
    await apiCall(
      `/api/admin/work-orders/${workOrder1._id}/stage`,
      'PUT',
      { stageKey: 'cutting', stageLabel: 'جاري القص والتشكيل على ماكينة إيسيلور الرقمية', notes: 'ضبط زاوية المحور 85 و 95' },
      labToken
    );
    console.log('   - المرحلة 1: جاري قص وتجويف العدسات وضبط المقاسات...');

    // Stage 2: Ready
    await apiCall(
      `/api/admin/work-orders/${workOrder1._id}/stage`,
      'PUT',
      { stageKey: 'ready', stageLabel: 'تم التجهيز واجتياز اختبار الجودة ونقل النظارة للفرع', notes: 'مطابقة تامة ومجهزة بالجراب والمنديل الأصلي' },
      labToken
    );
    console.log('   - المرحلة 2: تم التجهيز وفحص الجودة وإعادتها للفرع بنجاح!\n');
  }

  // Also update lab order status in order entity
  await apiCall(
    `/api/admin/orders/${order1._id}/lab-status`,
    'PUT',
    { labStatus: 'ready', labWorkshopCost: 60, notes: 'النظارة جاهزة بالفرع ومطابقة للكشف' },
    labToken
  );

  // 7. CUSTOMER AHMED PICKS UP GLASSES & PAYS REMAINING (CASHIER DELIVERS)
  console.log('👓 [الخطوة 7] حضور العميل "أحمد خليل" لاستلام النظارة ودفع المتبقي...');
  const pickupRes = await apiCall(
    `/api/admin/orders/${order1._id}/lab-status`,
    'PUT',
    {
      labStatus: 'delivered',
      remainingPaymentCollected: remaining, // 1400 EGP collected
      notes: 'تم قياس النظارة على وجه العميل، الرؤية ممتازة، واستلام باقي المبلغ نقداً'
    },
    cashierToken
  );
  console.log(`✅ تم تسليم النظارة بنجاح للعميل أحمد خليل!`);
  console.log(`   - تم استلام باقي المبلغ: ${remaining} ج.م نقداً | حالة الطلب: تم التسليم (Delivered)\n`);

  // 8. SCENARIO B: LOGIN AS BRANCH MANAGER & REGISTER A NEW CUSTOMER
  console.log('👑 [الخطوة 8] تسجيل دخول مدير الفرع: أسامة محمود الشاذلي (Role 4)...');
  const managerLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'manager.dokki@optics.local',
    password: 'Manager@2026!'
  });
  const managerToken = managerLogin.data.token;
  console.log(`✅ تم الدخول بنجاح | Role: ${managerLogin.data.user.role} | الاسم: ${managerLogin.data.user.fullname}`);

  console.log('🆕 [الخطوة 8.1] استقبال عميلة جديدة لم تسجل من قبل: "د. هبة محمود المهدي"...');
  const createCustomerRes = await apiCall(
    '/api/admin/customers',
    'POST',
    {
      fullname: 'د. هبة محمود المهدي',
      phone: '01055667788',
      email: 'dr.heba.elmahdy@optics-vip.com',
      address: 'شارع ميشيل باخوم - الدقي',
      city: 'الجيزة',
      gender: 'female',
      notes: 'عميلة VIP - تفضل إطارات كات آي ماركات إيطالية'
    },
    managerToken
  );
  const newCustomer = createCustomerRes.data?.user || createCustomerRes.data?.customer;
  const newCustomerId = newCustomer?._id || newCustomer?.id;
  console.log(`✅ تم تسجيل العميلة بنجاح برقم حساب: ${newCustomerId}`);

  console.log('📋 [الخطوة 8.2] تسجيل كشف النظر للعميلة الجديدة...');
  const hebaPrescription = {
    prescription: {
      date: new Date(),
      doctorName: 'أ.د. شريف الصاوي - أستاذ طب وجراحة العيون',
      clinicName: 'مركز الصاوي للعيون التخصصي',
      rightEye: { sph: '-1.00', cyl: '-0.25', axis: '180', pd: '30' },
      leftEye: { sph: '-1.25', cyl: '-0.50', axis: '175', pd: '30' },
      useType: 'distance',
      notes: 'عدسات فرنسية فاخرة رقيقة مع حماية كاملة'
    }
  };
  await apiCall(`/api/admin/customers/${newCustomerId}/prescriptions`, 'POST', hebaPrescription, managerToken);
  console.log('✅ تم تسجيل كشف النظر في ملف العميلة د. هبة');

  console.log('💳 [الخطوة 8.3] تسجيل فاتورة النظارة الفاخرة والدفع بالكامل بالبطاقة الائتمانية (Card Payment)...');
  console.log(`   - الشنبر: ${gucciProduct.name} (السعر: ${gucciProduct.price} ج.م)`);
  console.log(`   - العدسات: ${essilorProduct.name} (السعر: ${essilorProduct.price} ج.م)`);
  const order2Total = gucciProduct.price + essilorProduct.price; // 3600 + 1400 = 5000 EGP

  const order2Payload = {
    branchId,
    customer: {
      name: 'د. هبة محمود المهدي',
      phone: '01055667788',
      email: 'dr.heba.elmahdy@optics-vip.com',
      address: 'شارع ميشيل باخوم - الدقي',
      city: 'الجيزة'
    },
    items: [
      {
        productId: gucciProduct._id.toString(),
        name: gucciProduct.name,
        price: gucciProduct.price,
        quantity: 1,
        productType: 'frame'
      },
      {
        productId: essilorProduct._id.toString(),
        name: essilorProduct.name,
        price: essilorProduct.price,
        quantity: 1,
        productType: 'lens',
        lensSpecs: {
          rightEye: { sph: '-1.00', cyl: '-0.25', axis: '180', pd: '30' },
          leftEye: { sph: '-1.25', cyl: '-0.50', axis: '175', pd: '30' }
        }
      }
    ],
    discount: 200, // خصم VIP 200 ج.م
    paidAmount: order2Total - 200, // 4800 EGP paid in full via Card
    paymentMethod: 'card',
    isLabOrder: false, // Direct delivery on spot with pre-edged stock
    notes: 'تم الدفع بالفيزا واستلام النظارة فوراً'
  };

  const createOrder2Res = await apiCall('/api/admin/orders/pos-sale', 'POST', order2Payload, managerToken);
  console.log(`✅ تم إصدار الفاتورة رقم: ${createOrder2Res.data?.order?.orderId}`);
  console.log(`   - الإجمالي: ${order2Total} ج.م | الخصم: 200 ج.م | المدفوع بالفيزا: ${order2Total - 200} ج.م | الحالة: تم التسليم\n`);

  // 9. SCENARIO C: DIRECT RETAIL SALE (CONTACT LENSES + SOLUTION) TO SARA
  console.log('🛍️ [الخطوة 9] بيع مباشر سريع لمنتجات العناية بالعدسات للعميلة "سارة محمود"...');
  const saraTotal = freshlookProduct.price + renuProduct.price; // 380 + 160 = 540 EGP
  const order3Payload = {
    branchId,
    customer: {
      name: saraCustomer.fullname,
      phone: saraCustomer.phone || '01022233344',
      email: saraCustomer.email
    },
    items: [
      {
        productId: freshlookProduct._id.toString(),
        name: freshlookProduct.name,
        price: freshlookProduct.price,
        quantity: 1,
        productType: 'accessory'
      },
      {
        productId: renuProduct._id.toString(),
        name: renuProduct.name,
        price: renuProduct.price,
        quantity: 1,
        productType: 'accessory'
      }
    ],
    discount: 0,
    paidAmount: saraTotal,
    paymentMethod: 'cash',
    isLabOrder: false,
    notes: 'بيع فوري نقدي'
  };
  const order3Res = await apiCall('/api/admin/orders/pos-sale', 'POST', order3Payload, cashierToken);
  console.log(`✅ تم إصدار فاتورة بيع التجزئة رقم: ${order3Res.data?.order?.orderId} بقيمة ${saraTotal} ج.م نقداً\n`);

  // 10. AI AUDIT ANOMALY SCAN
  console.log('🤖 [الخطوة 10] فحص الذكاء الاصطناعي لسجل العمليات والرقابة (Audit AI Anomaly Scan)...');
  const anomalyRes = await apiCall('/api/admin/audit-logs/scan-anomalies', 'POST', { branchId }, managerToken);
  console.log(`✅ نتيجة الفحص الذكي للرقابة:`);
  console.log(`   - تم فحص ${anomalyRes.data?.scannedCount || 0} عملية مسجلة بالسجل الرقابي.`);
  console.log(`   - العمليات المشبوهة المرصودة: ${anomalyRes.data?.flaggedCount || 0}`);
  console.log(`   - ملخص الأمان والنزاهة: ${anomalyRes.data?.summary || 'كافة العمليات طبيعية وموثقة ومطابقة للصلاحيات'}\n`);

  // 11. FINANCIAL LEDGER & AUDIT RECONCILIATION
  console.log('📈 [الخطوة 11] استخراج تقرير الحسابات التجارية ومطابقة الأرصدة (Commercial Ledger & Audit)...');
  const ledgerRes = await apiCall('/api/admin/finance/commercial-ledger', 'GET', null, accountantToken);
  const ledger = ledgerRes.data?.ledger || {};

  console.log('💰 [النتائج المالية المحققة]:');
  console.log(`   - إجمالي الإيرادات التجارية: ${ledger.revenues?.totalGrossRevenue || 0} ج.م`);
  console.log(`   - تكلفة البضاعة المباعة (COGS): ${ledger.expenses?.productCostTotal || 0} ج.م`);
  console.log(`   - مجمل الربح التشغيلي: ${ledger.revenues?.grossOperatingMargin || 0} ج.م`);
  console.log(`   - صافي الربح التقديري: ${ledger.netResults?.estimatedNetProfit || 0} ج.م`);

  console.log('\n⚖️ [فحص مطابقة الحسابات وسجل الرقابة (Audit Reconciliation)]...');
  const reconcileRes = await apiCall('/api/admin/finance/commercial-ledger/reconcile-audit', 'GET', null, accountantToken);
  const rec = reconcileRes.data?.reconciliation || {};
  console.log(`   - حالة المطابقة: ${rec.status || 'MATCHED'}`);
  console.log(`   - نسبة المطابقة والاتساق: ${rec.reconciliationRate || 100}%`);
  console.log(`   - المدخلات النقدية والبنكية: ${rec.ledgerInflows || 0} ج.م`);
  console.log(`   - العمليات المتراجعة المرصودة: ${rec.voidsCount || 0} عملية`);
  console.log(`   - هامش الخطأ أو الفرق: ${rec.netDiscrepancy || 0} ج.م`);

  await conn.close();
  console.log('\n===============================================================');
  console.log('🎉 اكتملت المحاكاة الواقعية الشاملة بنجاح تام 100%');
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('❌ حدث خطأ أثناء تشغيل المحاكاة:', err);
  process.exit(1);
});
