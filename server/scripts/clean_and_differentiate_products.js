/**
 * Differentiate products across branches so no identical names exist across DB,
 * and ensure every single product in the DB has a valid branchId assigned.
 */

const envJson = require('../env.json');
const { ensureTenantConnection } = require('../core/database');
const getProductsModel = require('../modules/products/productModel');
const getBranchModel = require('../modules/branches/branchModel');

async function cleanAndDifferentiate() {
  console.log('Connecting to database...');
  await ensureTenantConnection('localhost', envJson.localhost.database);

  const Products = getProductsModel('localhost');
  const Branch = getBranchModel('localhost');

  const branches = await Branch.find().lean();
  console.log(`Found ${branches.length} branches:`, branches.map(b => `${b.code}: ${b.name}`));

  const mainBranch = branches.find(b => b.isMain) || branches[0];
  const alexBranch = branches.find(b => b.code.includes('ALEX')) || branches[1];
  const gizaBranch = branches.find(b => b.code.includes('GIZA')) || branches[2];

  // 1. Ensure any orphan products have main branch
  const orphanRes = await Products.updateMany(
    { $or: [{ branchId: null }, { branchId: { $exists: false } }] },
    { $set: { branchId: mainBranch._id } }
  );
  console.log(`Updated ${orphanRes.modifiedCount} orphan products to Main Branch.`);

  // 2. Differentiate Alexandria products
  if (alexBranch) {
    const alexProds = await Products.find({ branchId: alexBranch._id });
    console.log(`Updating ${alexProds.length} products for Alexandria branch...`);
    for (const prod of alexProds) {
      if (!prod.name.includes('(الإسكندرية)')) {
        prod.name = `${prod.name} (الإسكندرية)`;
        await prod.save();
      }
    }
    console.log('✓ Alexandria products labeled.');
  }

  // 3. Differentiate Giza products
  if (gizaBranch) {
    const gizaProds = await Products.find({ branchId: gizaBranch._id });
    console.log(`Updating ${gizaProds.length} products for Giza branch...`);
    for (const prod of gizaProds) {
      if (!prod.name.includes('(الشيخ زايد)')) {
        prod.name = `${prod.name} (الشيخ زايد)`;
        await prod.save();
      }
    }
    console.log('✓ Giza products labeled.');
  }

  // 4. Verify no identical names across the entire database
  const dupsAcrossAll = await Products.aggregate([
    { $group: { _id: '$name', count: { $sum: 1 }, branches: { $addToSet: '$branchId' } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Final duplicate count across entire database:', dupsAcrossAll.length);
  if (dupsAcrossAll.length === 0) {
    console.log('🎉 100% OF PRODUCTS NOW HAVE COMPLETELY UNIQUE NAMES ACROSS ALL BRANCHES!');
  } else {
    console.log('Remaining dups:', dupsAcrossAll);
  }

  process.exit(0);
}

cleanAndDifferentiate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
