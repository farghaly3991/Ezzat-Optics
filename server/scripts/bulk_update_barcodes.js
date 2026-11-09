const fs = require('fs');
const mongoose = require('mongoose');

async function run() {
  const envPath = fs.existsSync('./env.json') ? './env.json' : '../env.json';
  const envJson = require(envPath);
  const uri = envJson.store1?.database || envJson.localhost?.database;
  console.log('Connecting to URI (masked):', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'none');

  const conn = await mongoose.createConnection(uri).asPromise();
  console.log('Connected default DB name:', conn.name);

  // List collections in default DB
  const collections = await conn.db.listCollections().toArray();
  console.log('Collections in conn.db:', collections.map(c => c.name));

  // If storeproducts exists in conn.db
  let coll = conn.db.collection('storeproducts');
  let count = await coll.countDocuments();
  console.log('Count in', conn.name, 'storeproducts:', count);

  if (count === 0) {
    // Check other databases
    const adminDb = conn.db.admin();
    const dbs = await adminDb.listDatabases();
    console.log('All DBs on cluster:', dbs.databases.map(d => d.name));

    for (const d of dbs.databases) {
      if (d.name.includes('store') || d.name.includes('mult')) {
        const testDb = conn.useDb(d.name);
        const testColls = await testDb.db.listCollections().toArray();
        const pCount = testColls.some(c => c.name === 'storeproducts') 
          ? await testDb.collection('storeproducts').countDocuments()
          : 0;
        console.log(`DB "${d.name}" has storeproducts count:`, pCount);
        if (pCount > 0) {
          coll = testDb.collection('storeproducts');
          count = pCount;
          break;
        }
      }
    }
  }

  if (count > 0) {
    const filter = {
      $or: [{ barcode: { $exists: false } }, { barcode: '' }, { barcode: null }]
    };
    const matched = await coll.countDocuments(filter);
    console.log('Matched unbarcoded:', matched);

    const res = await coll.updateMany(
      filter,
      [{ $set: { barcode: { $toString: '$_id' } } }]
    );
    console.log('Update completed. Matched:', res.matchedCount, 'Modified:', res.modifiedCount);

    const sample = await coll.findOne({}, { projection: { name: 1, barcode: 1 } });
    console.log('Sample product after update:', sample);
  }

  await conn.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
