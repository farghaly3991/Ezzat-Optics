/**
 * Ensures baseline Admin & Developer accounts exist in any new/offline database.
 */
const bcrypt = require('bcryptjs');

async function ensureDefaultOfflineAccounts(conn) {
  try {
    const User = conn.model('User') || conn.collection('users');
    const userCollection = conn.collection('users');

    // 1. Super Admin (Role 5)
    const existingAdmin = await userCollection.findOne({ phone: '01000000000' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await userCollection.insertOne({
        fullname: 'المدير العام للبصريات',
        phone: '01000000000',
        email: 'admin@optics.local',
        password: hashedPassword,
        role: 5,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('[OFFLINE_BOOTSTRAP] Created default Super Admin: 01000000000 / admin123');
    }

    // 2. Developer Admin (Role 6)
    const existingDev = await userCollection.findOne({ phone: '01000000006' });
    if (!existingDev) {
      const hashedDevPassword = await bcrypt.hash('dev123', 10);
      await userCollection.insertOne({
        fullname: 'المطور العام للنظام (Role 6)',
        phone: '01000000006',
        email: 'developer@system.local',
        password: hashedDevPassword,
        role: 6,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('[OFFLINE_BOOTSTRAP] Created default Developer Admin: 01000000006 / dev123');
    }
  } catch (err) {
    console.warn('[OFFLINE_BOOTSTRAP_WARN]', err.message);
  }
}

module.exports = { ensureDefaultOfflineAccounts };
