const mongoose = require('mongoose');
require('dotenv').config({ path: 'server/.env' });
const { ensureTenantConnection } = require('../core/database');
const getCategoryModel = require('../modules/categories/categoryModel');
const getProductsModel = require('../modules/products/productModel');
const getOrderModel = require('../modules/orders/orderModel');

async function seedServices() {
  const subdomain = 'localhost';
  const dbName = process.env.DEFAULT_DB || 'store_demo';
  console.log(`Connecting to tenant DB [${dbName}] on [${subdomain}]...`);
  const conn = await ensureTenantConnection(subdomain, dbName);

  const Categories = getCategoryModel(subdomain);
  const Products = getProductsModel(subdomain);
  const Orders = getOrderModel(subdomain);

  // 1. Create or update Service Category
  let serviceCat = await Categories.findOne({ name: 'خدمات التكييف والتبريد' });
  if (!serviceCat) {
    serviceCat = await Categories.create({
      name: 'خدمات التكييف والتبريد',
      type: 'service',
      description: 'خدمات فك وتركيب وصيانة دورية وشحن فريون معتمدة لأجهزة التكييف',
      specs: {
        service_type: 'نوع الخدمة',
        ac_type: 'نوع التكييف المدعوم',
        capacity: 'القدرة التبريدية',
        location_type: 'مكان التنفيذ'
      },
      tags: ['صيانة تكييف', 'تركيب تكييف', 'تنظيف كيميائي', 'شحن فريون R410', 'ضمان معتمد', 'فحص دوري'],
      image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800',
      active: true
    });
    console.log('Created service category:', serviceCat.name, serviceCat._id);
  } else {
    serviceCat.type = 'service';
    serviceCat.active = true;
    serviceCat.specs = {
      service_type: 'نوع الخدمة',
      ac_type: 'نوع التكييف المدعوم',
      capacity: 'القدرة التبريدية',
      location_type: 'مكان التنفيذ'
    };
    serviceCat.tags = ['صيانة تكييف', 'تركيب تكييف', 'تنظيف كيميائي', 'شحن فريون R410', 'ضمان معتمد', 'فحص دوري'];
    await serviceCat.save();
    console.log('Updated service category:', serviceCat.name, serviceCat._id);
  }

  // 2. Define 3 Services
  const servicesData = [
    {
      name: 'خدمة تركيب تكييف سبليت معتمد مع تمديد مواسير النحاس',
      categoryId: serviceCat._id,
      price: 850,
      oldPrice: 1000,
      costPrice: 400,
      stockCount: 999,
      requiresShipping: false,
      active: true,
      warrantyPeriodMonths: 12,
      warrantyPolicy: 'ضمان عام كامل على سلامة التركيب وعدم تسريب الفريون',
      tags: ['تركيب تكييف', 'ضمان معتمد'],
      specs: {
        service_type: 'تركيب جديد وتثبيت',
        ac_type: 'سبليت حائطي',
        capacity: '1.5 إلى 3 حصان',
        location_type: 'سكني / تجاري'
      },
      description: 'خدمة تركيب وتثبيت الوحدتين الداخلية والخارجية باحترافية متناهية، تشمل مد مواسير النحاس وعمل الفاكيوم بدقة وشحن الفريون مع تسليم فحص تبريد شامل وضمان معتمد لمدة 12 شهراً.',
      images: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800']
    },
    {
      name: 'خدمة صيانة دورية وتنظيف كيميائي عميق للتكييف',
      categoryId: serviceCat._id,
      price: 450,
      oldPrice: 550,
      costPrice: 150,
      stockCount: 999,
      requiresShipping: false,
      active: true,
      warrantyPeriodMonths: 3,
      warrantyPolicy: 'ضمان نظافة المبخر وتسليك خط التصريف ورفع كفاءة التبريد',
      tags: ['صيانة تكييف', 'تنظيف كيميائي', 'فحص دوري'],
      specs: {
        service_type: 'صيانة دورية وتنظيف',
        ac_type: 'جميع الموديلات',
        capacity: 'جميع القدرات',
        location_type: 'موقع العميل'
      },
      description: 'غسيل كيميائي شامل للكويل الداخلي والخارجي بجهاز الضغط العالي، مع تعقيم المبخر وفلاتر الهواء وتسليك حوض ومجرى الصرف وفحص ضغط غاز التبريد لتوفير استهلاك الكهرباء ورفع البرودة.',
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800']
    },
    {
      name: 'خدمة فحص تسريب وشحن فريون أصلي R410A / R22',
      categoryId: serviceCat._id,
      price: 650,
      oldPrice: 750,
      costPrice: 280,
      stockCount: 999,
      requiresShipping: false,
      active: true,
      warrantyPeriodMonths: 6,
      warrantyPolicy: 'ضمان 6 أشهر على ثبات ضغط الشحنة وجودة اللحام',
      tags: ['شحن فريون R410', 'صيانة تكييف'],
      specs: {
        service_type: 'فحص تسريب وشحن فريون',
        ac_type: 'سبليت وشباك',
        capacity: 'حتى 3 حصان',
        location_type: 'موقع العميل'
      },
      description: 'كشف تسريب غاز التبريد بواسطة النيتروجين المضغوط، إصلاح ولحام مناطق التسريب، عمل تفريغ هوائي (فاكيوم) للدورة ثم إعادة شحن الفريون الأصلي بالميزان الرقمي بدقة متناهية.',
      images: ['https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800']
    }
  ];

  const createdServices = [];
  for (const sData of servicesData) {
    let sDoc = await Products.findOne({ name: sData.name });
    if (!sDoc) {
      sDoc = await Products.create(sData);
      console.log('Created service product:', sDoc.name, sDoc._id);
    } else {
      Object.assign(sDoc, sData);
      await sDoc.save();
      console.log('Updated service product:', sDoc.name, sDoc._id);
    }
    createdServices.push(sDoc);
  }

  // 3. Link these services to AC / Appliances products
  const serviceIds = createdServices.map((s) => s._id);

  // Find physical AC or electronic products
  const physicalProducts = await Products.find({
    categoryId: { $ne: serviceCat._id }
  }).limit(10);

  if (physicalProducts.length > 0) {
    console.log(`Linking ${createdServices.length} services to ${physicalProducts.length} physical products...`);
    for (const prod of physicalProducts) {
      prod.linkedItemIds = serviceIds;
      await prod.save();
    }
    console.log('Successfully linked services to products!');

    // In turn, link one physical product into each service as complementary hardware/supplies
    for (const srv of createdServices) {
      srv.linkedItemIds = [physicalProducts[0]._id];
      await srv.save();
    }
  }

  // 4. Create a sample service order to demonstrate the pipeline
  let sampleServiceOrder = await Orders.findOne({ orderId: 'ORD-SRV-9001' });
  if (!sampleServiceOrder) {
    sampleServiceOrder = await Orders.create({
      orderId: 'ORD-SRV-9001',
      subdomain,
      customer: {
        name: 'م. أحمد ممدوح',
        phone: '01019887766',
        governorate: 'القاهرة',
        city: 'مدينة نصر',
        address: 'شارع عباس العقاد - عمارة 14 - الدور 4'
      },
      items: [
        {
          productId: createdServices[0]._id,
          name: createdServices[0].name,
          price: createdServices[0].price,
          quantity: 1,
          isService: true,
          categoryType: 'service'
        },
        {
          productId: createdServices[1]._id,
          name: createdServices[1].name,
          price: createdServices[1].price,
          quantity: 1,
          isService: true,
          categoryType: 'service'
        }
      ],
      orderType: 'service',
      hasServices: true,
      subtotal: 1300,
      shipping: 0,
      total: 1300,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'confirmed',
      notes: 'تأكيد موعد الزيارة يوم السبت الساعة 12 ظهراً لتنفيذ التركيب والصيانة',
      statusTimeline: [
        {
          status: 'new',
          note: 'تم تسجيل حجز الخدمة بنجاح وهو في انتظار تأكيد موعد الزيارة',
          at: new Date(Date.now() - 3600 * 1000 * 6)
        },
        {
          status: 'confirmed',
          note: 'تم الاتصال بالعميل وتأكيد موعد الزيارة يوم السبت 12:00 ظهراً',
          at: new Date(Date.now() - 3600 * 1000 * 2)
        }
      ]
    });
    console.log('Created sample service order: ORD-SRV-9001');
  }

  console.log('Done seeding services successfully!');
  await conn.close();
}

seedServices().catch(console.error);
