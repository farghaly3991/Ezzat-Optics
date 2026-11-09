require('dotenv').config();
const bcrypt = require('bcryptjs');
const { ensureTenantConnection } = require('../core/database');

async function seedStaff() {
  const conn = await ensureTenantConnection('localhost', process.env.DEFAULT_DB);
  const branch = await conn.collection('storebranches').findOne({ isMain: true });
  const branchId = branch ? branch._id : null;

  const staffUsers = [
    {
      fullname: 'أسامة محمود الشاذلي',
      email: 'manager.dokki@optics.local',
      password: await bcrypt.hash('Manager@2026!', 10),
      phone: '01023456781',
      role: 4,
      roleName: 'مدير فرع الدقي',
      branchId,
      status: 'active',
      createdAt: new Date(),
      prescriptions: [],
      ordersCount: 0,
      totalSpent: 0
    },
    {
      fullname: 'كريم عادل الشريف',
      email: 'cashier.dokki@optics.local',
      password: await bcrypt.hash('Cashier@2026!', 10),
      phone: '01123456782',
      role: 3,
      roleName: 'مسؤول مبيعات وكاشير',
      branchId,
      status: 'active',
      createdAt: new Date(),
      prescriptions: [],
      ordersCount: 0,
      totalSpent: 0
    },
    {
      fullname: 'م. إبراهيم فؤاد القاضي',
      email: 'lab.dokki@optics.local',
      password: await bcrypt.hash('LabTech@2026!', 10),
      phone: '01223456783',
      role: 2,
      roleName: 'أخصائي معمل وتجهيز وصيانة',
      branchId,
      status: 'active',
      createdAt: new Date(),
      prescriptions: [],
      ordersCount: 0,
      totalSpent: 0
    },
    {
      fullname: 'أ. طارق عبد الحميد النجار',
      email: 'accountant@optics.local',
      password: await bcrypt.hash('Accountant@2026!', 10),
      phone: '01523456784',
      role: 4,
      roleName: 'محاسب ومسؤول الخزينة والمشتريات',
      branchId,
      status: 'active',
      createdAt: new Date(),
      prescriptions: [],
      ordersCount: 0,
      totalSpent: 0
    }
  ];

  for (const staff of staffUsers) {
    const existing = await conn.collection('users').findOne({ email: staff.email });
    if (!existing) {
      await conn.collection('users').insertOne(staff);
      console.log('Inserted staff user:', staff.fullname, staff.email);
    } else {
      await conn.collection('users').updateOne(
        { email: staff.email },
        { $set: { role: staff.role, branchId, status: 'active', fullname: staff.fullname, phone: staff.phone } }
      );
      console.log('Updated staff user:', staff.fullname, staff.email);
    }
  }

  console.log('All staff seeded successfully!');
  process.exit(0);
}
seedStaff().catch(console.error);
