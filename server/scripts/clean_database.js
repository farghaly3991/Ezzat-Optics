require('dotenv').config();
const { ensureTenantConnection } = require('../core/database');

async function cleanDb() {
  const conn = await ensureTenantConnection('localhost', process.env.DEFAULT_DB);
  console.log('Connected to DB');

  const collectionsToWipe = [
    'storeorders',
    'storeworkorders',
    'clientprofiles',
    'storeclientprofiles',
    'storecarts',
    'auditlogs',
    'storeactivities',
    'storeprocurementreorders',
    'storemanualsales',
    'storeexpenses',
    'storedesiredproducts',
    'storereturnrequests',
    'storefinancepayments',
    'storefinanceaudits',
    'storeinventorymovements',
    'storesuppliershipments',
    'storenotifications',
    'storeproductwaitlists',
    'storereviews',
    'storeoffers',
    'storestaffdeductions',
    'storeusers'
  ];

  for (const name of collectionsToWipe) {
    try {
      const res = await conn.collection(name).deleteMany({});
      console.log(`Wiped ${name}: deleted ${res.deletedCount} documents.`);
    } catch (e) {
      console.log(`Collection ${name} delete error or does not exist:`, e.message);
    }
  }

  // Clear prescriptions, depositBalance, ordersCount from users
  const userRes = await conn.collection('users').updateMany(
    {},
    {
      $set: {
        prescriptions: [],
        latestPrescription: null,
        ordersCount: 0,
        totalSpent: 0,
        deposits: [],
        depositBalance: 0
      }
    }
  );
  console.log(`Updated users: cleared prescriptions & order data for ${userRes.modifiedCount} users.`);

  // Verify admindatas still intact
  const adminData = await conn.collection('admindatas').findOne({});
  console.log('AdminData preserved with siteName:', adminData?.siteName);
  console.log('NavigationLabels preserved:', Object.keys(adminData?.navigationLabels || {}));
  console.log('ClientProfileConfig preserved:', adminData?.clientProfileConfig?.profileTitle);

  // Verify products & categories
  const prodCount = await conn.collection('storeproducts').countDocuments();
  const catCount = await conn.collection('storecategories').countDocuments();
  const uCount = await conn.collection('users').countDocuments();
  console.log(`Products remaining: ${prodCount}, Categories remaining: ${catCount}, Users remaining: ${uCount}`);

  process.exit(0);
}
cleanDb().catch(console.error);
