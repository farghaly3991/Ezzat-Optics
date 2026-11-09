const mongoose = require('../server/node_modules/mongoose');

const uri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

async function wipeDatabase() {
  console.log('Connecting to MongoDB for Database Clean Reset...');
  const conn = await mongoose.createConnection(uri).asPromise();

  // Collections to completely wipe (Transactions, logs, operational movements)
  const collectionsToWipe = [
    'storeorders',
    'storeworkorders',
    'auditlogs',
    'storeactivities',
    'storeexpenses',
    'storesuppliershipments',
    'storeprocurementreorders',
    'storefinanceaudits',
    'storefinancepayments',
    'storemanualsales',
    'storeinventorymovements',
    'storeinventorycostlayers',
    'storecarts',
    'storedesiredproducts',
    'storeproductwaitlists',
    'storereturnrequests',
    'storenotifications',
    'storestaffreviews',
    'storereviews',
    'storecommercialauditsnapshots',
    'commercialauditsnapshots'
  ];

  console.log('\n--- 1. مسح كافة المعاملات والحركات المالية والطلبات واللوجز ---');
  for (const colName of collectionsToWipe) {
    try {
      const col = conn.collection(colName);
      const count = await col.countDocuments();
      if (count > 0) {
        await col.deleteMany({});
        console.log(`🧹 مسح ${count} وثيقة من جدول: ${colName}`);
      }
    } catch (e) {
      console.warn(`تخطي جدول ${colName}: ${e.message}`);
    }
  }

  // 2. Reset Users (Keep staff and customers, reset transactional balances and prescriptions)
  console.log('\n--- 2. تنظيف حسابات المستخدمين (تصفير الأمانات والكشوفات التجريبية) ---');
  const usersCol = conn.collection('users');
  const usersUpdateResult = await usersCol.updateMany(
    {},
    {
      $set: {
        depositBalance: 0,
        prescriptions: [],
        wishlist: []
      }
    }
  );
  console.log(`✅ تم تصفير الأمانات والكشوفات لـ ${usersUpdateResult.matchedCount} مستخدم (موظفين وعملاء).`);

  // 3. Reset Products (Reset salesCount and scrapRecords, preserve base stock and matrix)
  console.log('\n--- 3. إعادة ضبط المنتجات والعدسات للحالة الأصلية ---');
  const productsCol = conn.collection('storeproducts');
  const productsUpdateResult = await productsCol.updateMany(
    {},
    {
      $set: {
        salesCount: 0,
        scrapRecords: [],
        reservedStock: 0
      }
    }
  );

  // Reset standard test baseline products
  await productsCol.updateOne(
    { name: /رايبان/ },
    { $set: { stockCount: 5, storeStock: 5 } }
  );
  await productsCol.updateOne(
    { name: /بلو كت/ },
    {
      $set: {
        stockCount: 212,
        storeStock: 212,
        "opticsSpecs.matrixStock.-2.00_-0.50": 4,
        "opticsSpecs.matrixStock.-1.75_-0.50": 4
      }
    }
  );
  console.log(`✅ تم تصفير سجلات المبيعات والتوالف وضبط أرصدة الاختبار لـ ${productsUpdateResult.matchedCount} منتج.`);

  // 4. Verify preserved master data
  console.log('\n--- 4. التحقق من البيانات الثابتة المحفوظة ---');
  const preservedSummary = {
    products: await conn.collection('storeproducts').countDocuments(),
    categories: await conn.collection('storecategories').countDocuments(),
    branches: await conn.collection('storebranches').countDocuments(),
    labs: await conn.collection('storelabs').countDocuments(),
    suppliers: await conn.collection('storesuppliers').countDocuments(),
    users: await conn.collection('users').countDocuments(),
    staff: await conn.collection('users').countDocuments({ role: { $gte: 2 } }),
    customers: await conn.collection('users').countDocuments({ role: 1 }),
    adminSettings: await conn.collection('admindatas').countDocuments()
  };

  console.log('بيانات النظام الثابتة المحفوظة بنجاح:');
  console.log(`- المنتجات والعدسات: ${preservedSummary.products}`);
  console.log(`- التصنيفات والأقسام: ${preservedSummary.categories}`);
  console.log(`- الفروع: ${preservedSummary.branches}`);
  console.log(`- الورش والمعامل: ${preservedSummary.labs}`);
  console.log(`- الموردين: ${preservedSummary.suppliers}`);
  console.log(`- إجمالي المستخدمين: ${preservedSummary.users} (طاقم العمل: ${preservedSummary.staff} | العملاء: ${preservedSummary.customers})`);
  console.log(`- إعدادات المتجر: ${preservedSummary.adminSettings}`);

  console.log('\n--- 5. التحقق من تصفير المعاملات تماماً (0 Transactions) ---');
  const transactionCheck = {
    orders: await conn.collection('storeorders').countDocuments(),
    workOrders: await conn.collection('storeworkorders').countDocuments(),
    auditLogs: await conn.collection('auditlogs').countDocuments(),
    expenses: await conn.collection('storeexpenses').countDocuments(),
    shipments: await conn.collection('storesuppliershipments').countDocuments(),
    reorders: await conn.collection('storeprocurementreorders').countDocuments()
  };
  console.log(transactionCheck);

  await conn.close();
  console.log('\n🎉 اكتمل تصفير ومسح قاعدة البيانات من الصفر تماماً مع بقاء الثوابت 100%!');
}

wipeDatabase().catch(console.error);
