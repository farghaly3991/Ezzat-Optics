const mongoose = require('mongoose');

const SOURCE_URI = 'mongodb+srv://miserable:miserable_3991@cluster0.7f94a.mongodb.net/alrehab?retryWrites=true&w=majority&appName=alrehab';
const TARGET_URI = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/multu_tenant_store?appName=farweb';

async function step1_fetchSource() {
  console.log('1. Connecting to source (alrehab)...');
  await mongoose.connect(SOURCE_URI);
  console.log('Connected to source!');

  const categories = await mongoose.connection.db.collection('categories').find({}).toArray();
  const products = await mongoose.connection.db.collection('products').find({}).toArray();

  console.log(`Fetched ${categories.length} categories and ${products.length} products.`);
  await mongoose.disconnect();
  return { categories, products };
}

async function step2_insertTarget(categories, products) {
  console.log('\n2. Connecting to target (multu_tenant_store)...');
  await mongoose.connect(TARGET_URI);
  console.log('Connected to target!');
  const db = mongoose.connection.db;

  const categoryIdMap = new Map();
  const transformedCategories = categories.map((c, idx) => {
    let validId;
    try {
      validId = new mongoose.Types.ObjectId(c._id);
    } catch {
      validId = new mongoose.Types.ObjectId();
    }
    categoryIdMap.set(String(c._id), validId);

    return {
      _id: validId,
      name: c.name ? c.name.trim() : 'بدون اسم',
      slug: c.name ? c.name.trim().toLowerCase().replace(/\s+/g, '-') : `cat-${idx + 1}`,
      image: c.image || '',
      icon: '',
      specs: c.specs && typeof c.specs === 'object' ? c.specs : {},
      tags: Array.isArray(c.tags) ? c.tags.map(t => String(t).trim()).filter(Boolean) : [],
      active: true,
      order: idx,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      updatedAt: new Date()
    };
  });

  const transformedProducts = products.map((p) => {
    let validId;
    try {
      validId = new mongoose.Types.ObjectId(p._id);
    } catch {
      validId = new mongoose.Types.ObjectId();
    }

    let validCatId = null;
    if (p.categoryId) {
      validCatId = categoryIdMap.get(String(p.categoryId));
      if (!validCatId) {
        try {
          validCatId = new mongoose.Types.ObjectId(p.categoryId);
        } catch {
          validCatId = transformedCategories[0]?._id;
        }
      }
    } else {
      validCatId = transformedCategories[0]?._id;
    }

    let ratingAvg = 0;
    let ratingCount = 0;
    if (p.ratings && typeof p.ratings === 'object') {
      let totalStars = 0;
      for (let star = 1; star <= 5; star++) {
        const cnt = Number(p.ratings[star]) || 0;
        totalStars += star * cnt;
        ratingCount += cnt;
      }
      if (ratingCount > 0) {
        ratingAvg = Math.round((totalStars / ratingCount) * 10) / 10;
      }
    }

    return {
      _id: validId,
      categoryId: validCatId,
      offerId: null,
      name: p.name ? p.name.trim() : 'منتج بدون اسم',
      price: Number(p.price) || 0,
      oldPrice: Number(p.oldPrice) || 0,
      costPrice: Math.round((Number(p.price) || 0) * 0.75),
      images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
      description: p.description || '',
      stockCount: p.stockCount !== undefined ? Number(p.stockCount) : 10,
      specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
      tags: Array.isArray(p.tags) ? p.tags.map(t => String(t).trim()).filter(Boolean) : [],
      active: true,
      featured: false,
      ratings: p.ratings || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      ratingAvg,
      ratingCount,
      visited: Number(p.visited) || 0,
      salesCount: 0,
      embedding: [],
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: new Date()
    };
  });

  console.log(`Writing ${transformedCategories.length} categories to 'storecategories'...`);
  const catOps = transformedCategories.map(c => ({
    updateOne: {
      filter: { _id: c._id },
      update: { $set: c },
      upsert: true
    }
  }));
  await db.collection('storecategories').bulkWrite(catOps);
  console.log('Categories write complete!');

  console.log(`Writing ${transformedProducts.length} products to 'storeproducts'...`);
  const prodOps = transformedProducts.map(p => ({
    updateOne: {
      filter: { _id: p._id },
      update: { $set: p },
      upsert: true
    }
  }));
  await db.collection('storeproducts').bulkWrite(prodOps);
  console.log('Products write complete!');

  const finalCatCount = await db.collection('storecategories').countDocuments();
  const finalProdCount = await db.collection('storeproducts').countDocuments();

  console.log(`\n=== FINAL COUNTS IN MULTI-TENANT STORE ===`);
  console.log(`storecategories: ${finalCatCount}`);
  console.log(`storeproducts: ${finalProdCount}`);

  await mongoose.disconnect();
}

async function main() {
  const data = await step1_fetchSource();
  await step2_insertTarget(data.categories, data.products);
  console.log('All done successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
