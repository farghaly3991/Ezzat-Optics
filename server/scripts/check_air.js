const mongoose = require('mongoose');

async function test() {
  const sourceUri = 'mongodb+srv://miserable:miserable_3991@cluster0.7f94a.mongodb.net/alrehab?retryWrites=true&w=majority&appName=alrehab';
  const targetUri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/multu_tenant_store?appName=farweb';

  const sConn = await mongoose.createConnection(sourceUri).asPromise();
  const tConn = await mongoose.createConnection(targetUri).asPromise();

  const sProdsCount = await sConn.db.collection('products').countDocuments();
  const tProdsCount = await tConn.db.collection('storeproducts').countDocuments();
  console.log('Source products total:', sProdsCount);
  console.log('Target storeproducts total:', tProdsCount);

  // Search for air conditioners in source
  const sConditioners = await sConn.db.collection('products').find({
    $or: [
      { name: { $regex: 'تكييف', $options: 'i' } },
      { description: { $regex: 'تكييف', $options: 'i' } }
    ]
  }).toArray();
  console.log('Source conditioner products found by name/desc regex:', sConditioners.length);

  // Search in target
  const tConditioners = await tConn.db.collection('storeproducts').find({
    $or: [
      { name: { $regex: 'تكييف', $options: 'i' } },
      { description: { $regex: 'تكييف', $options: 'i' } }
    ]
  }).toArray();
  console.log('Target conditioner products found by name/desc regex:', tConditioners.length);

  // Check air conditioning categories
  const sCat = await sConn.db.collection('categories').find({ name: { $regex: 'تكييف', $options: 'i' } }).toArray();
  console.log('Source air conditioner categories:', sCat.map(c => ({ id: c._id, name: c.name })));

  // If there are conditioner categories, let's see how many products have categoryId matching them
  for (const c of sCat) {
    const pCountS = await sConn.db.collection('products').countDocuments({ categoryId: c._id });
    const pCountSStr = await sConn.db.collection('products').countDocuments({ categoryId: String(c._id) });
    const pCountT = await tConn.db.collection('storeproducts').countDocuments({ categoryId: c._id });
    console.log(`Cat "${c.name}" (id: ${c._id}) -> source products with ObjectId: ${pCountS}, with String: ${pCountSStr}, target: ${pCountT}`);
  }

  // Also check subcategories or other conditioner categories like 'حائطي' or 'فري استاند'
  const subCats = await sConn.db.collection('categories').find({
    name: { $in: ['حائطي', 'فري استاند', 'كونسيلد', 'ستائر هوائية'] }
  }).toArray();
  for (const c of subCats) {
    const pCountS = await sConn.db.collection('products').countDocuments({ categoryId: c._id });
    const pCountSStr = await sConn.db.collection('products').countDocuments({ categoryId: String(c._id) });
    const pCountT = await tConn.db.collection('storeproducts').countDocuments({ categoryId: c._id });
    console.log(`SubCat "${c.name}" (id: ${c._id}) -> source ObjectId: ${pCountS}, source String: ${pCountSStr}, target: ${pCountT}`);
  }

  // Let's print out what categories actually have products in source!
  const allSourceProds = await sConn.db.collection('products').find({}, { projection: { categoryId: 1, name: 1 } }).toArray();
  const catDistribution = {};
  allSourceProds.forEach(p => {
    const cid = String(p.categoryId);
    catDistribution[cid] = (catDistribution[cid] || 0) + 1;
  });
  console.log('\nTop category IDs in source products:');
  const catEntries = Object.entries(catDistribution).slice(0, 10);
  for (const [cid, count] of catEntries) {
    let catObj;
    try {
      catObj = await sConn.db.collection('categories').findOne({ _id: new mongoose.Types.ObjectId(cid) });
    } catch {
      catObj = await sConn.db.collection('categories').findOne({ _id: cid });
    }
    console.log(`- Cat "${catObj ? catObj.name : 'Unknown'}" (id: ${cid}): ${count} products`);
  }

  process.exit(0);
}
test();
