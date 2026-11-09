const mongoose = require('mongoose');

async function syncParents() {
  const sourceUri = 'mongodb+srv://miserable:miserable_3991@cluster0.7f94a.mongodb.net/alrehab?retryWrites=true&w=majority&appName=alrehab';
  const targetUri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/multu_tenant_store?appName=farweb';

  const sConn = await mongoose.createConnection(sourceUri).asPromise();
  const tConn = await mongoose.createConnection(targetUri).asPromise();

  const sCats = await sConn.db.collection('categories').find({ parent: { $ne: null } }).toArray();
  console.log('Categories with parent in source:', sCats.length);

  let updated = 0;
  for (const sc of sCats) {
    let pId = sc.parent;
    if (typeof pId === 'string' && mongoose.Types.ObjectId.isValid(pId)) {
      pId = new mongoose.Types.ObjectId(pId);
    }
    const res = await tConn.db.collection('storecategories').updateOne(
      { _id: sc._id },
      { $set: { parentId: pId } }
    );
    if (res.modifiedCount > 0) updated++;
  }
  console.log('Updated parentId in target storecategories:', updated);

  // Check children of 'أجهزة تكييف منزلي ومركزي'
  const mainCond = await tConn.db.collection('storecategories').findOne({ name: 'أجهزة تكييف منزلي ومركزي' });
  if (mainCond) {
    const children = await tConn.db.collection('storecategories').find({ parentId: mainCond._id }).toArray();
    console.log('Children of أجهزة تكييف منزلي ومركزي:', children.map(c => ({ id: c._id, name: c.name })));
    const childIds = children.map(c => c._id);
    const prodCount = await tConn.db.collection('storeproducts').countDocuments({ categoryId: { $in: [mainCond._id, ...childIds] } });
    console.log('Total products for main conditioner category + children:', prodCount);
  }

  process.exit(0);
}

syncParents().catch(console.error);
