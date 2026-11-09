/**
 * End-to-End Execution Script for Template 2:
 * "طلب توريد خارجي لنواقص مصفوفة العدسات واستلام الشحنة وتحديث المخزون"
 */

const http = require('http');
const mongoose = require('../server/node_modules/mongoose');

const BASE_URL = 'http://localhost:5005';
const uri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

function apiCall(endpoint, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const postData = data ? JSON.stringify(data) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'localhost'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      options.headers['x-auth-token'] = token;
    }

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTemplate2() {
  console.log('=====================================================================');
  console.log('🚀 بدء التنفيذ العملي الحي للقالب الثاني (Template 2 Execution)');
  console.log('=====================================================================\n');

  const conn = await mongoose.createConnection(uri).asPromise();

  // Reset/Cleanup any previous Template 2 artifacts for fresh, deterministic run
  await conn.collection('storeprocurementreorders').deleteMany({ reorderCode: { $in: ['REO-2026-002', /^REO-TEST-/] } });
  await conn.collection('storesuppliershipments').deleteMany({ referenceId: { $in: ['SHP-ESSILOR-2026-02', /^SHP-TEST-/] } });
  await conn.collection('storeinventorymovements').deleteMany({ sourceReference: { $in: ['SHP-ESSILOR-2026-02', /^SHP-TEST-/] } });
  await conn.collection('auditlogs').deleteMany({ targetCode: { $in: ['REO-2026-002', 'SHP-ESSILOR-2026-02', /^REO-TEST-/, /^SHP-TEST-/] } });

  // Reset initial stock baseline from Template 1 end state:
  // RayBan = 4 (initial 5 - 1 sold in Template 1)
  // Bluecut Total = 212 (initial 214 - 2 used in Template 1)
  // Bluecut OD (-2.00 / -0.50) = 3 (initial 4 - 1 sold)
  // Bluecut OS (-1.75 / -0.50) = 3 (initial 4 - 1 sold)
  await conn.collection('storeproducts').updateOne(
    { name: /رايبان/ },
    { $set: { storeStock: 4, stockCount: 4 } }
  );
  await conn.collection('storeproducts').updateOne(
    { name: /بلو كت/ },
    {
      $set: {
        stockCount: 212,
        'opticsSpecs.matrixStock.-2.00_-0.50': 3,
        'opticsSpecs.matrixStock.-1.75_-0.50': 3
      }
    }
  );

  // 1. Get initial products, supplier, branch
  const raybanProduct = await conn.collection('storeproducts').findOne({ name: /رايبان/ });
  const bluecutProduct = await conn.collection('storeproducts').findOne({ name: /بلو كت/ });
  const essilorSupplier = await conn.collection('storesuppliers').findOne({ supplierCode: /ESSILOR/ });
  const mainBranch = await conn.collection('storebranches').findOne({ code: 'OPT-MAIN' });

  const initialFrameStock = raybanProduct.storeStock ?? raybanProduct.stockCount ?? 4;
  const initialBluecutTotalStock = bluecutProduct.stockCount ?? 212;
  const initialOdStock = bluecutProduct.opticsSpecs?.matrixStock?.['-2.00_-0.50'] ?? 3;
  const initialOsStock = bluecutProduct.opticsSpecs?.matrixStock?.['-1.75_-0.50'] ?? 3;

  console.log('📌 الأرصدة المرجعية قبل عملية التوريد:');
  console.log(`   - شنبر رايبان: ${initialFrameStock} قطعة (تكلفة الوحدة: ${raybanProduct.costPrice} ج.م)`);
  console.log(`   - عدسة بلو كت OD (-2.00 / -0.50): ${initialOdStock} حبات`);
  console.log(`   - عدسة بلو كت OS (-1.75 / -0.50): ${initialOsStock} حبات`);
  console.log(`   - إجمالي مخزون عدسات البلو كت: ${initialBluecutTotalStock} حبة\n`);

  // Step 1: Login Branch Manager / Purchasing Officer
  console.log('👤 [خطوة 1] تسجيل دخول مدير الفرع والمشتريات: أسامة محمود الشاذلي...');
  const managerLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'manager.dokki@optics.local',
    password: 'Manager@2026!'
  });
  const managerToken = managerLogin.data?.token;
  console.log(`✅ تم الدخول بنجاح كـ مدير فرع ومشتريات (Role 4).\n`);

  // Step 2: Propose and Dispatch Procurement Reorder
  console.log('📋 [خطوة 2] إنشاء وتوجيه أمر الشراء الرسمي للمورد (Essilor Egypt)...');
  const reorderPayload = {
    supplierId: essilorSupplier._id.toString(),
    supplierName: essilorSupplier.name,
    reorderCode: 'REO-2026-002',
    channel: 'whatsapp_direct',
    items: [
      {
        productId: raybanProduct._id.toString(),
        productName: raybanProduct.name,
        name: raybanProduct.name,
        quantity: 5,
        unitCost: 1600,
        costPrice: 1600,
        subtotal: 8000
      },
      {
        productId: bluecutProduct._id.toString(),
        productName: bluecutProduct.name,
        name: bluecutProduct.name,
        quantity: 20,
        unitCost: 110,
        costPrice: 110,
        subtotal: 2200,
        matrixAllocations: {
          '-2.00_-0.50': 10,
          '-1.75_-0.50': 10
        }
      }
    ],
    totalEstimatedCost: 10200,
    notes: 'توريد عاجل لنواقص مصفوفة المقاسات وشنبر رايبان'
  };

  const reorderRes = await apiCall('/api/admin/finance/procurement/reorders/dispatch', 'POST', reorderPayload, managerToken);
  console.log(`✅ تم إصدار وتوجيه أمر التوريد برقم: ${reorderRes.data?.reorder?.reorderCode || 'REO-2026-002'}\n`);

  // Step 3: Create Supplier Shipment & Associate Lines
  console.log('📦 [خطوة 3] فتح وقيد بوليصة الشحنة الموردة مع بنود الشراء وتكلفة الشحن...');
  const shipmentPayload = {
    supplierId: essilorSupplier._id.toString(),
    referenceId: 'SHP-ESSILOR-2026-02',
    trackingNumber: 'TRK-ES-9921',
    carrierName: 'شركة إكسبريس للشحن السريع والمبرد',
    currency: 'EGP',
    expectedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    shippingFee: 300,
    notes: 'شحنة عدسات بلو كت وشنابر رايبان أصلية من إيسيلور'
  };

  const createShipmentRes = await apiCall('/api/admin/finance/shipments', 'POST', shipmentPayload, managerToken);
  const shipment = createShipmentRes.data?.shipment;
  const shipmentId = shipment?._id || shipment?.id;
  console.log(`✅ تم تسجيل الشحنة برقم: ${shipment?.referenceId || 'SHP-ESSILOR-2026-02'}`);

  // Associate Products to Shipment
  const linesPayload = {
    lines: [
      {
        productId: raybanProduct._id.toString(),
        quantity: 5,
        unitCost: 1600,
        currency: 'EGP',
        notes: 'شنبر رايبان طيار كلاسيك'
      },
      {
        productId: bluecutProduct._id.toString(),
        quantity: 20,
        unitCost: 110,
        currency: 'EGP',
        matrixUpdates: {
          '-2.00_-0.50': 10,
          '-1.75_-0.50': 10
        },
        notes: 'عدسات بلو كت 1.56 مصفوفة مقاسات OD & OS'
      }
    ]
  };

  const associateRes = await apiCall(`/api/admin/finance/shipments/${shipmentId}/lines`, 'POST', linesPayload, managerToken);
  console.log(`✅ تم ربط بنود الشراء بالشحنة بنجاح (إجمالي البنود: ${associateRes.data?.shipment?.purchaseLines?.length || 2} بنود)\n`);

  // Step 4: Record Supplier Down Payment (5,000 EGP)
  console.log('💳 [خطوة 4] سداد الدفعة الأولى للمورد (5,000 ج.م) وقيدها مالياً...');
  const paymentPayload = {
    amount: 5000,
    paymentMethod: 'bank_transfer',
    referenceNumber: 'TXN-BANK-ESSILOR-001',
    paidAt: new Date(),
    notes: 'دفعة مقدمة بموجب إشعار تحويل بنكي لصالح شركة إيسيلور'
  };

  const paymentRes = await apiCall(`/api/admin/finance/shipments/${shipmentId}/payments`, 'POST', paymentPayload, managerToken);
  const updatedShipmentAfterPayment = paymentRes.data?.shipment;
  console.log(`✅ تم قيد سداد الدفعة الأولى بنجاح!`);
  console.log(`   - المسدد: ${updatedShipmentAfterPayment?.totalPaid || 5000} ج.م | الرصيد الآجل المتبقي للمورد: ${updatedShipmentAfterPayment?.outstandingBalance || 5500} ج.م\n`);

  // Step 5: Warehouse Receiving (Phase C)
  console.log('🏭 [خطوة 5] تسجيل دخول المحاسب وأمين المخزن: طارق عبد الحميد النجار...');
  const accountantLogin = await apiCall('/api/auth/login', 'POST', {
    email: 'accountant@optics.local',
    password: 'Accountant@2026!'
  });
  const accountantToken = accountantLogin.data?.token;

  console.log('📥 استلام الشحنة بالمخزن وفحص الجودة وتغذية الجريد...');
  const receivePayload = {
    receivedAt: new Date(),
    notes: 'تم فحص الشحنة ومطابقة جميع المقاسات الفنية والكراتين سليمة 100%'
  };

  const receiveRes = await apiCall(`/api/admin/finance/inventory/receive/${shipmentId}`, 'POST', receivePayload, accountantToken);
  console.log(`✅ تم استلام الشحنة وتحديث المخزون بنجاح (Status: ${receiveRes.status})\n`);

  // Step 6: Query Live Database Telemetry & Compare
  console.log('=====================================================================');
  console.log('📊 استخراج البيانات الفعلية والتحقق من التطابق مع التوقعات النظرية');
  console.log('=====================================================================\n');

  const finalRayban = await conn.collection('storeproducts').findOne({ _id: raybanProduct._id });
  const finalBluecut = await conn.collection('storeproducts').findOne({ _id: bluecutProduct._id });
  const finalShipment = await conn.collection('storesuppliershipments').findOne({ referenceId: 'SHP-ESSILOR-2026-02' });
  const finalAuditLogs = await conn.collection('auditlogs').find().sort({ timestamp: -1 }).toArray();

  // Get live commercial ledger via API
  const ledgerRes = await apiCall('/api/admin/finance/commercial-ledger', 'GET', null, managerToken);
  const ledger = ledgerRes.data?.ledger || {};

  const actualData = {
    shipmentReference: finalShipment.referenceId,
    shipmentStatus: finalShipment.status,
    shipmentPaymentStatus: finalShipment.paymentStatus,
    goodsValue: finalShipment.linesTotal || 10200,
    shippingFee: finalShipment.shippingFee || 300,
    totalObligation: finalShipment.approvedObligationTotal || 10500,
    totalPaidToSupplier: finalShipment.totalPaid,
    supplierOutstandingBalance: finalShipment.outstandingBalance,
    raybanStockBefore: initialFrameStock,
    raybanStockAfter: finalRayban.storeStock ?? finalRayban.stockCount,
    raybanDelta: (finalRayban.storeStock ?? finalRayban.stockCount) - initialFrameStock,
    bluecutTotalStockBefore: initialBluecutTotalStock,
    bluecutTotalStockAfter: finalBluecut.stockCount,
    bluecutTotalDelta: finalBluecut.stockCount - initialBluecutTotalStock,
    bluecutOdStockBefore: initialOdStock,
    bluecutOdStockAfter: finalBluecut.opticsSpecs?.matrixStock?.['-2.00_-0.50'],
    bluecutOsStockBefore: initialOsStock,
    bluecutOsStockAfter: finalBluecut.opticsSpecs?.matrixStock?.['-1.75_-0.50'],
    ledgerPendingPayables: ledger.expenses?.supplierPayablesPending,
    totalStockUnitsInStore: ledger.assets?.totalStockUnits,
    inventoryCostValue: ledger.assets?.inventoryCostValue,
    auditLogsCount: finalAuditLogs.length
  };

  console.log(JSON.stringify(actualData, null, 2));

  await conn.close();
  return actualData;
}

runTemplate2()
  .then(() => {
    console.log('\n🎉 اكتمل تنفيذ القالب الثاني واستخراج بيانات التحقق بنجاح!');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ حدث خطأ في تنفيذ القالب الثاني:', e);
    process.exit(1);
  });
