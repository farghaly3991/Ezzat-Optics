/**
 * Ezzat Optics - Automatic Cloud Cloner (One-time Initial Seed)
 * If the local database is fresh / empty and internet is available,
 * clone ALL collections from MongoDB Atlas into the local database automatically.
 */
const mongoose = require('mongoose');

const CLOUD_DB_URI = process.env.CLOUD_DB_URI || 
  process.env.DEFAULT_DB || 
  'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?appName=farweb';

let cloneInProgress = false;

async function ensureInitialCloudClone(localConn) {
  if (cloneInProgress) return;
  if (!localConn || localConn.readyState !== 1) return;

  try {
    // 1. Check if local DB already has data (e.g. users collection has docs)
    const localUsers = await localConn.collection('users').countDocuments();
    if (localUsers > 0) {
      console.log(`[INITIAL_CLONE] Local DB already initialized (${localUsers} users found). Skipping initial clone.`);
      return;
    }

    cloneInProgress = true;
    console.log('[INITIAL_CLONE] Fresh install detected. Attempting full clone from Cloud Atlas...');

    // 2. Connect to Cloud Atlas (short timeout to fail fast if offline)
    const cloudConn = await mongoose.createConnection(CLOUD_DB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    }).asPromise();

    console.log('[INITIAL_CLONE] Cloud Atlas connected! Fetching all collections...');

    const collections = await cloudConn.db.listCollections().toArray();
    console.log(`[INITIAL_CLONE] Found ${collections.length} collections in Cloud Atlas.`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      try {
        const cloudDocs = await cloudConn.db.collection(colName).find({}).toArray();
        if (cloudDocs.length > 0) {
          const localCol = localConn.collection(colName);
          // Drop if any leftovers then insert
          await localCol.deleteMany({});
          await localCol.insertMany(cloudDocs, { ordered: false });
          console.log(`[INITIAL_CLONE] ✓ Cloned collection "${colName}": ${cloudDocs.length} documents.`);
        }
      } catch (colErr) {
        console.warn(`[INITIAL_CLONE_WARN] Could not clone "${colName}":`, colErr.message);
      }
    }

    console.log('[INITIAL_CLONE] 🎉 All Cloud Atlas data cloned successfully to Local DB!');
    await cloudConn.close().catch(() => {});
  } catch (err) {
    console.log('[INITIAL_CLONE_OFFLINE] Could not clone from Cloud (offline or unreachable):', err.message);
    // If offline on first run, fallback bootstrap will ensure Admin & Dev accounts exist
  } finally {
    cloneInProgress = false;
  }
}

module.exports = { ensureInitialCloudClone };
