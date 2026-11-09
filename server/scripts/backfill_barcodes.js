const envJson = require('../env.json');
const mongoose = require('mongoose');
const serverModule = require('../server');
const getProductsModel = require('../modules/products/productModel');

async function run() {
  const uri = envJson.store1?.database || envJson.localhost?.database;
  const conn = await mongoose.createConnection(uri).asPromise();
  serverModule.setMongooseConnection('store1', conn);

  const Products = getProductsModel('store1');
  const count = await Products.countDocuments({});
  console.log('Total products in store1:', count);

  const unbarcoded = await Products.find({
    $or: [{ barcode: { $exists: false } }, { barcode: '' }, { barcode: null }]
  });

  console.log('Products missing barcode:', unbarcoded.length);
  let updatedCount = 0;
  for (const p of unbarcoded) {
    p.barcode = p._id.toString();
    await p.save();
    updatedCount++;
  }
  console.log(`Updated ${updatedCount} products with default barcode = _id`);
  await conn.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
