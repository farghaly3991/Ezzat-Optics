/**
 * Cloud Sync Engine for EZ Optics Desktop
 * Connects the local offline database to the central online MongoDB Atlas cluster.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Online MongoDB cluster URI (Cloud)
const CLOUD_DB_URI = process.env.CLOUD_DB_URI || 
  process.env.DEFAULT_DB || 
  'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?appName=farweb';

// Collections to sync in a retail / optics business
const CORE_COLLECTIONS = [
  'products',
  'categories',
  'customers',
  'orders',
  'invoices',
  'branches',
  'users',
  'financialaccounts',
  'financialtransactions',
  'suppliers',
  'labs',
  'admindatas'
];

let cachedCloudConn = null;

async function getCloudConnection() {
  if (cachedCloudConn && cachedCloudConn.readyState === 1) {
    return cachedCloudConn;
  }
  cachedCloudConn = await mongoose.createConnection(CLOUD_DB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  }).asPromise();
  return cachedCloudConn;
}

/**
 * 1. Check Online / Cloud connectivity status
 */
router.get('/status', async (req, res) => {
  try {
    const start = Date.now();
    const cloudConn = await getCloudConnection();
    await cloudConn.db.command({ ping: 1 });
    const latency = Date.now() - start;

    return res.json({
      online: true,
      latencyMs: latency,
      cloudDatabase: 'optics_store_system',
      localDatabase: req.database ? 'Local MongoDB' : 'Offline',
      message: 'الاتصال بالسحابة متاح ومستقر'
    });
  } catch (err) {
    return res.json({
      online: false,
      error: err.message,
      message: 'لا يوجد اتصال بالإنترنت أو تعذر الوصول للسيرفر السحابي'
    });
  }
});

/**
 * 2. Execute Sync: Push (Local -> Cloud) or Pull (Cloud -> Local)
 */
router.post('/execute', async (req, res) => {
  const { direction, confirmationText } = req.body;

  if (confirmationText !== 'مزامنة' && confirmationText !== 'تأكيد' && confirmationText !== 'SYNC') {
    return res.status(400).json({ error: 'كلمة التأكيد غير صحيحة. يجب كتابة كلمة "مزامنة" للمتابعة' });
  }

  if (direction !== 'push' && direction !== 'pull') {
    return res.status(400).json({ error: 'اتجاه المزامنة غير صالح (push أو pull)' });
  }

  try {
    const cloudConn = await getCloudConnection();
    const localConn = req.tenantDb || mongoose.connection;

    if (!localConn || localConn.readyState !== 1) {
      return res.status(500).json({ error: 'قاعدة البيانات المحلية غير متصلة' });
    }

    const report = {
      direction,
      startedAt: new Date(),
      collections: {}
    };

    if (direction === 'push') {
      // Push: Read from local, Upsert into Cloud
      for (const colName of CORE_COLLECTIONS) {
        try {
          const localCol = localConn.collection(colName);
          const cloudCol = cloudConn.collection(colName);

          const localDocs = await localCol.find({}).toArray();
          let upsertedCount = 0;

          if (localDocs.length > 0) {
            const bulkOps = localDocs.map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            const bulkRes = await cloudCol.bulkWrite(bulkOps, { ordered: false });
            upsertedCount = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0);
          }

          report.collections[colName] = {
            localCount: localDocs.length,
            syncedToCloud: upsertedCount
          };
        } catch (colErr) {
          report.collections[colName] = { error: colErr.message };
        }
      }
    } else if (direction === 'pull') {
      // Pull: Read from Cloud, Upsert into Local
      for (const colName of CORE_COLLECTIONS) {
        try {
          const cloudCol = cloudConn.collection(colName);
          const localCol = localConn.collection(colName);

          const cloudDocs = await cloudCol.find({}).toArray();
          let upsertedCount = 0;

          if (cloudDocs.length > 0) {
            const bulkOps = cloudDocs.map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            const bulkRes = await localCol.bulkWrite(bulkOps, { ordered: false });
            upsertedCount = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0);
          }

          report.collections[colName] = {
            cloudCount: cloudDocs.length,
            syncedToLocal: upsertedCount
          };
        } catch (colErr) {
          report.collections[colName] = { error: colErr.message };
        }
      }
    }

    report.finishedAt = new Date();
    return res.json({
      success: true,
      message: direction === 'push' 
        ? 'تم رفع وتحديث بيانات الجهاز بنجاح إلى السيرفر السحابي' 
        : 'تم سحب وتحديث بيانات السيرفر السحابي بنجاح إلى جهازك المحلي',
      report
    });
  } catch (err) {
    return res.status(500).json({
      error: 'فشلت عملية المزامنة',
      details: err.message
    });
  }
});

let syncIntervalId = null;

/**
 * Background Auto-Sync Worker
 * Periodically pushes new local transactions, orders, customers to Cloud Atlas every 15 minutes.
 */
function startPeriodicSyncWorker(getLocalConn) {
  if (syncIntervalId) return;
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  syncIntervalId = setInterval(async () => {
    try {
      const localConn = typeof getLocalConn === 'function' ? getLocalConn() : mongoose.connection;
      if (!localConn || localConn.readyState !== 1) return;

      const cloudConn = await getCloudConnection();
      if (!cloudConn || cloudConn.readyState !== 1) return;

      console.log('[AUTO_SYNC] Starting scheduled 15-minute background push to Cloud...');

      for (const colName of CORE_COLLECTIONS) {
        try {
          const localCol = localConn.collection(colName);
          const cloudCol = cloudConn.collection(colName);

          const localDocs = await localCol.find({}).toArray();
          if (localDocs.length > 0) {
            const bulkOps = localDocs.map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            await cloudCol.bulkWrite(bulkOps, { ordered: false });
          }
        } catch (_) {}
      }
      console.log('[AUTO_SYNC] ✓ Background sync to Cloud completed successfully.');
    } catch (err) {
      console.log('[AUTO_SYNC_IDLE] Background sync skipped (offline or cloud busy):', err.message);
    }
  }, INTERVAL_MS);
}

module.exports = router;
module.exports.startPeriodicSyncWorker = startPeriodicSyncWorker;
