/**
 * Retroactive Audit Log Enricher
 * Iterates over all existing audit logs in MongoDB and enriches them
 * with `impactSummary` and `deepImpact` (inventory, finance, orders, database mutations).
 */

const mongoose = require('../server/node_modules/mongoose');
const { synthesizeImpact } = require('../server/modules/audit/auditService');

const uri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

async function enrichAllExistingLogs() {
  console.log('🔄 جاري الاتصال بقاعدة البيانات لتحديث السجلات السابقة بأثر العمليات والتحولات...');
  const conn = await mongoose.createConnection(uri).asPromise();
  const collection = conn.collection('auditlogs');

  const logs = await collection.find({}).toArray();
  console.log(`📌 تم العثور على ${logs.length} سجل رقابة. جاري المعالجة والإثراء...`);

  let updatedCount = 0;
  for (const log of logs) {
    const synthesized = synthesizeImpact({
      action: log.action,
      details: log.details,
      metadata: log.metadata || {},
      targetType: log.targetType,
      targetCode: log.targetCode
    });

    const needsDeepImpact = !log.deepImpact || (log.deepImpact.inventory?.length === 0 && log.deepImpact.finance?.length === 0 && synthesized.impact.inventory?.length > 0);

    await collection.updateOne(
      { _id: log._id },
      {
        $set: {
          impactSummary: synthesized.summary || log.impactSummary,
          deepImpact: needsDeepImpact ? synthesized.impact : (log.deepImpact || synthesized.impact)
        }
      }
    );
    updatedCount++;
  }

  console.log(`✅ تم تحديث وإثراء جميع السجلات السابقة بنجاح! (تم تحديث ${updatedCount} سجل)`);
  process.exit(0);
}

enrichAllExistingLogs().catch(err => {
  console.error('❌ خطأ أثناء الإثراء:', err);
  process.exit(1);
});
