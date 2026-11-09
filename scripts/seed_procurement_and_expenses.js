const mongoose = require('../server/node_modules/mongoose');

const uri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

async function seedProcurementAndExpenses() {
  const conn = await mongoose.createConnection(uri).asPromise();
  console.log('Connected to MongoDB for Procurement & Expenses Enrichment...');

  // 1. Get Branch, Supplier, Products
  const branch = await conn.collection('storebranches').findOne({ code: 'OPT-MAIN' });
  const branchId = branch?._id;
  const supplier1 = await conn.collection('storesuppliers').findOne({ supplierCode: 'SUP-ESSILOR-01' });
  const supplier2 = await conn.collection('storesuppliers').findOne({ supplierCode: 'SUP-LUXOTTICA-02' });
  const bluecutProduct = await conn.collection('storeproducts').findOne({ name: /بلو كت/ });
  const raybanProduct = await conn.collection('storeproducts').findOne({ name: /رايبان/ });
  const lacosteProduct = await conn.collection('storeproducts').findOne({ name: /لاكوست/ });

  // 2. Seed a Supplier Shipment in `storesuppliershipments` (Powering Finance -> Procurement Panel)
  const shipmentsCol = conn.collection('storesuppliershipments');
  await shipmentsCol.deleteMany({});
  await shipmentsCol.insertOne({
    shipmentCode: 'SHP-2026-001',
    supplierId: supplier1?._id,
    supplierSnapshot: {
      name: supplier1?.name || 'الشركة الدولية للبصريات وتجهيز العدسات (Essilor)',
      contactPerson: supplier1?.contactPerson || 'أ. ممدوح عبد العال',
      phone: supplier1?.phone || '01099887766',
      email: 'orders@essilor-eg.com'
    },
    branchId,
    status: 'received',
    paymentStatus: 'paid',
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    expectedDate: new Date(),
    actualDeliveryDate: new Date(),
    notes: 'توريد عدسات رقمية حماية شاشات وبلو كت مقاسات استجماتيزم',
    shippingCarrier: 'شركة أرامكس للشحن السريع',
    trackingNumber: 'ARX-99881122EG',
    landingExpenseAllocated: 250,
    shippingExpenseAllocated: 150,
    items: [
      {
        productId: bluecutProduct?._id,
        name: bluecutProduct?.name || 'زوج عدسات بلو كت حماية شاشات مضغوطة 1.56',
        barcode: bluecutProduct?.barcode || 'LENS-BC-156-STD',
        quantity: 20,
        unitCost: 120,
        totalCost: 2400,
        landedUnitCost: 140,
        landedTotalCost: 2800,
        status: 'received'
      },
      {
        productId: lacosteProduct?._id,
        name: lacosteProduct?.name || 'شمبر لاكوست هاف فريم تيتانيوم',
        barcode: lacosteProduct?.barcode || 'FRAME-LAC-2840',
        quantity: 5,
        unitCost: 900,
        totalCost: 4500,
        landedUnitCost: 950,
        landedTotalCost: 4750,
        status: 'received'
      }
    ],
    totalMerchandiseCost: 6900,
    totalLandedCost: 7550,
    totalPaid: 7550,
    balanceDue: 0,
    payments: [
      {
        amount: 7550,
        paidAt: new Date(),
        paymentMethod: 'bank_transfer',
        reference: 'TRF-BNK-992281',
        notes: 'سداد كامل مستحقات الشحنة عبر التحويل البنكي لحساب شركة إيسيلور'
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('✅ تم تسجيل شحنة مورد معتمدة (SHP-2026-001) في لوحة المشتريات والالتزامات.');

  // 3. Seed Supplier Reorder in `storeprocurementreorders`
  const reordersCol = conn.collection('storeprocurementreorders');
  await reordersCol.deleteMany({});
  await reordersCol.insertOne({
    reorderCode: 'PO-2026-001',
    supplierId: supplier1?._id,
    supplierName: supplier1?.name || 'الشركة الدولية للبصريات وتجهيز العدسات',
    supplierPhone: supplier1?.phone || '01099887766',
    supplierWhatsapp: '201099887766',
    items: [
      {
        productId: bluecutProduct?._id,
        name: 'زوج عدسات بلو كت حماية شاشات مقاس SPH -3.50 / CYL -1.00',
        quantity: 10,
        unitCost: 120,
        stockAtOrder: 0,
        criticalStockThreshold: 3
      },
      {
        productId: bluecutProduct?._id,
        name: 'زوج عدسات بلو كت حماية شاشات مقاس SPH -4.00 / CYL -1.50',
        quantity: 10,
        unitCost: 120,
        stockAtOrder: 0,
        criticalStockThreshold: 3
      }
    ],
    totalQuantity: 20,
    totalEstimatedCost: 2400,
    notes: 'أمر توريد عاجل لنواقص درجات قصر النظر والاستجماتيزم وجريد العدسات',
    status: 'completed',
    channel: 'whatsapp_direct',
    sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('✅ تم تسجيل أمر توريد في جدول التوريدات الذكية (PO-2026-001).');

  // 4. Update one order item to have `isRequestedSupply: true` so it appears in Backorders (نواقص التوريد)
  const ordersCol = conn.collection('storeorders');
  const pendingOrder = await ordersCol.findOne({ status: 'preparing' });
  if (pendingOrder) {
    await ordersCol.updateOne(
      { _id: pendingOrder._id },
      {
        $set: {
          'items.1.isRequestedSupply': true,
          'items.1.supplyStatus': 'requested',
          'items.1.supplierId': supplier1?._id,
          'items.1.supplierName': supplier1?.name,
          'items.1.supplierPhone': supplier1?.phone
        }
      }
    );
    console.log(`✅ تم ربط بند عدسة خاص في الطلب ${pendingOrder.orderId} كطلب توريد خارجي ليظهر في تبويب نواقص التوريد.`);
  }

  // 5. Seed Real Operating Expenses in `storeexpenses` (Rent, Electricity, Lab Fees)
  const expensesCol = conn.collection('storeexpenses');
  await expensesCol.deleteMany({});
  await expensesCol.insertMany([
    {
      expenseCode: 'EXP-2026-001',
      title: 'إيجار فرع الدقي الرئيسي عن الشهر الحالي',
      category: 'rent',
      amount: 15000,
      paidAmount: 15000,
      status: 'paid',
      effectiveDate: new Date(),
      dueDate: new Date(),
      branchId,
      notes: 'سداد إيجار مقر المركز بشارع التحرير',
      paymentMethod: 'bank_transfer',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      expenseCode: 'EXP-2026-002',
      title: 'فاتورة الكهرباء والتكييف المركزي لمعمل القص ومعرض النظارات',
      category: 'utilities',
      amount: 2200,
      paidAmount: 2200,
      status: 'paid',
      effectiveDate: new Date(),
      dueDate: new Date(),
      branchId,
      notes: 'سداد فاتورة شركة الكهرباء نقداً من الخزينة',
      paymentMethod: 'cash',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      expenseCode: 'EXP-2026-003',
      title: 'تكاليف تجهيز وقص عدسات رقمية خاصة بالمعمل الخارجي',
      category: 'lab_workshop',
      amount: 450,
      paidAmount: 450,
      status: 'paid',
      effectiveDate: new Date(),
      dueDate: new Date(),
      branchId,
      notes: 'مصاريف قص بؤري وتفريغ شنبر ريم لس',
      paymentMethod: 'cash',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);
  console.log('✅ تم تسجيل 3 مصروفات تشغيلية واقعية (إيجار، كهرباء، ورشة) في سجل المصروفات والمالية.');

  await conn.close();
  console.log('🎉 تم الانتهاء بنجاح من تغذية كافة الجداول المالية والتوريدية!');
}

seedProcurementAndExpenses().catch(console.error);
