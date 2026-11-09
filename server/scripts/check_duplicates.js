const envJson = require('../env.json');
const { ensureTenantConnection } = require('../core/database');
const getProductsModel = require('../modules/products/productModel');

async function checkDuplicates() {
  await ensureTenantConnection('localhost', envJson.localhost.database);
  const Products = getProductsModel('localhost');

  const dupsWithinSameBranch = await Products.aggregate([
    { $group: { _id: { name: '$name', branchId: '$branchId' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Duplicate products within same branch:', dupsWithinSameBranch.length);
  if (dupsWithinSameBranch.length > 0) {
    console.log('Sample within same branch:', JSON.stringify(dupsWithinSameBranch.slice(0, 5), null, 2));
  }

  const dupsAcrossBranches = await Products.aggregate([
    { $group: { _id: '$name', count: { $sum: 1 }, branches: { $addToSet: '$branchId' } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Products with duplicate name across DB:', dupsAcrossBranches.length);
  if (dupsAcrossBranches.length > 0) {
    console.log('Sample across DB:', JSON.stringify(dupsAcrossBranches.slice(0, 5), null, 2));
  }

  // Also check products by code
  const codeDups = await Products.aggregate([
    { $match: { code: { $exists: true, $ne: "" } } },
    { $group: { _id: { code: '$code', branchId: '$branchId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Duplicate codes within same branch:', codeDups.length);

  process.exit(0);
}

checkDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
