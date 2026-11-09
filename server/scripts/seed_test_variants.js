const fs = require('fs');
const mongoose = require('mongoose');

async function run() {
  const envPath = fs.existsSync('./env.json') ? './env.json' : '../env.json';
  const envJson = require(envPath);
  const uri = envJson.store1?.database || envJson.localhost?.database;

  console.log('Connecting to database...');
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.useDb('multu_tenant_store');

  const Categories = db.collection('storecategories');
  const Products = db.collection('storeproducts');

  // Find a category or use the first available category
  let cat = await Categories.findOne({ active: true, type: { $ne: 'service' } });
  if (!cat) {
    cat = await Categories.findOne({});
  }

  const groupCode = 'samsung-s24-ultra';

  // Remove previous test variants if any
  await Products.deleteMany({ groupCode });

  const baseSpecs = {
    'الشاشة': 'Dynamic AMOLED 2X 6.8 بوصة 120Hz',
    'المعالج': 'Snapdragon 8 Gen 3',
    'الكاميرا': '200 ميجابكسل رئيسية + تقريب بصري 5x',
    'البطارية': '5000 مللي أمبير مع شحن سريع 45W'
  };

  const variants = [
    {
      name: 'سامسونج جالكسي S24 ألترا (تيتانيوم رمادي / 256GB / 12GB RAM)',
      groupCode,
      categoryId: cat._id,
      price: 38500,
      oldPrice: 41000,
      costPrice: 33000,
      stockCount: 15,
      barcode: '8806091876541',
      specs: { ...baseSpecs, 'اللون': 'تيتانيوم رمادي', 'الذاكرة': '256GB', 'الرام': '12GB' },
      images: [
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800',
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800'
      ],
      description: 'هاتف سامسونج الرائد الأحدث Samsung Galaxy S24 Ultra مدعوماً بميزات Galaxy AI المتقدمة وهيكل متين من التيتانيوم.',
      tags: ['سامسونج', 'جالكسي', 'هواتف ذكية', 'تيتانيوم', 'S24 Ultra'],
      active: true,
      requiresShipping: true,
      warrantyPeriodMonths: 24,
      warrantyPolicy: 'ضمان محلي شامل سنتين من الوكيل المعتمد ضد عيوب الصناعة.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'سامسونج جالكسي S24 ألترا (تيتانيوم رمادي / 512GB / 12GB RAM)',
      groupCode,
      categoryId: cat._id,
      price: 42500,
      oldPrice: 45000,
      costPrice: 37000,
      stockCount: 8,
      barcode: '8806091876542',
      specs: { ...baseSpecs, 'اللون': 'تيتانيوم رمادي', 'الذاكرة': '512GB', 'الرام': '12GB' },
      images: [
        'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800'
      ],
      description: 'هاتف سامسونج الرائد الأحدث Samsung Galaxy S24 Ultra بسعة تخزين ضخمة 512GB.',
      tags: ['سامسونج', 'جالكسي', 'هواتف ذكية', 'تيتانيوم', 'S24 Ultra'],
      active: true,
      requiresShipping: true,
      warrantyPeriodMonths: 24,
      warrantyPolicy: 'ضمان محلي شامل سنتين من الوكيل المعتمد ضد عيوب الصناعة.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'سامسونج جالكسي S24 ألترا (تيتانيوم بنفسجي / 256GB / 12GB RAM)',
      groupCode,
      categoryId: cat._id,
      price: 38900,
      oldPrice: 41500,
      costPrice: 33000,
      stockCount: 12,
      barcode: '8806091876543',
      specs: { ...baseSpecs, 'اللون': 'تيتانيوم بنفسجي', 'الذاكرة': '256GB', 'الرام': '12GB' },
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800'
      ],
      description: 'هاتف سامسونج الرائد الأحدث Samsung Galaxy S24 Ultra باللون التيتانيوم البنفسجي المميز.',
      tags: ['سامسونج', 'جالكسي', 'هواتف ذكية', 'تيتانيوم', 'S24 Ultra'],
      active: true,
      requiresShipping: true,
      warrantyPeriodMonths: 24,
      warrantyPolicy: 'ضمان محلي شامل سنتين من الوكيل المعتمد ضد عيوب الصناعة.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: 'سامسونج جالكسي S24 ألترا (تيتانيوم بنفسجي / 512GB / 12GB RAM)',
      groupCode,
      categoryId: cat._id,
      price: 43000,
      oldPrice: 46000,
      costPrice: 37000,
      stockCount: 5,
      barcode: '8806091876544',
      specs: { ...baseSpecs, 'اللون': 'تيتانيوم بنفسجي', 'الذاكرة': '512GB', 'الرام': '12GB' },
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800'
      ],
      description: 'هاتف سامسونج الرائد الأحدث Samsung Galaxy S24 Ultra باللون التيتانيوم البنفسجي وسعة 512GB.',
      tags: ['سامسونج', 'جالكسي', 'هواتف ذكية', 'تيتانيوم', 'S24 Ultra'],
      active: true,
      requiresShipping: true,
      warrantyPeriodMonths: 24,
      warrantyPolicy: 'ضمان محلي شامل سنتين من الوكيل المعتمد ضد عيوب الصناعة.',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const insertRes = await Products.insertMany(variants);
  console.log(`Successfully created ${insertRes.insertedCount} multi-variant products under groupCode: ${groupCode}`);

  const insertedIds = Object.values(insertRes.insertedIds);
  console.log('Sample Product ID for URL testing:', insertedIds[0].toString());

  await conn.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
