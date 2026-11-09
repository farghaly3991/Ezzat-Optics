const mongoose = require('../server/node_modules/mongoose');

const uri = 'mongodb+srv://farweb2data:farweb2data_3991@farweb2data.3kjihsz.mongodb.net/optics_store_system?retryWrites=true&w=majority&appName=farweb';

async function diagnose() {
  const conn = await mongoose.createConnection(uri).asPromise();
  console.log('=== 1. USERS & ROLES ===');
  const users = await conn.collection('users').find({ role: { $gte: 2 } }).toArray();
  for (const u of users) {
    console.log(`- ${u.fullname} (${u.email}) | Role: ${u.role} | branchId: ${u.branchId}`);
  }

  console.log('\n=== 2. ORDERS IN STOREORDERS ===');
  const orders = await conn.collection('storeorders').find().toArray();
  console.log(`Total orders: ${orders.length}`);
  for (const o of orders) {
    console.log(`- OrderId: ${o.orderId} | Status: ${o.status} | LabStatus: ${o.labStatus} | Total: ${o.total} | Paid: ${o.payment?.paid} (${o.paymentsSnapshot?.paidAmount}) | Branch: ${o.branchId}`);
  }

  console.log('\n=== 3. AUDIT LOGS IN AUDITLOGS ===');
  const auditlogs = await conn.collection('auditlogs').find().sort({ createdAt: -1 }).toArray();
  console.log(`Total audit logs: ${auditlogs.length}`);
  for (const a of auditlogs) {
    console.log(`- Action: ${a.action} | ActionLabel: ${a.actionLabel} | User: ${a.userName} (${a.userRole}) | Target: ${a.targetType}/${a.targetId} | Date: ${a.createdAt}`);
  }

  console.log('\n=== 4. PROCUREMENT REORDERS IN STOREPROCUREMENTREORDERS ===');
  const reorders = await conn.collection('storeprocurementreorders').find().toArray();
  console.log(`Total reorders: ${reorders.length}`);
  for (const r of reorders) {
    console.log(`- Reorder: ${r.reorderNumber} | Supplier: ${r.supplierName} | Status: ${r.status} | Cost: ${r.totalCost}`);
  }

  console.log('\n=== 5. WORK ORDERS IN STOREWORKORDERS ===');
  const workOrders = await conn.collection('storeworkorders').find().toArray();
  console.log(`Total work orders: ${workOrders.length}`);
  for (const w of workOrders) {
    console.log(`- WO: ${w.workOrderNumber} | Order: ${w.orderId} | Stage: ${w.currentStage} (${w.currentStageLabel}) | Lab: ${w.labId}`);
  }

  console.log('\n=== 6. SUPPLIERS IN STORESUPPLIERS ===');
  const suppliers = await conn.collection('storesuppliers').find().toArray();
  console.log(`Total suppliers: ${suppliers.length}`);
  for (const s of suppliers) {
    console.log(`- Supplier: ${s.name} | Code: ${s.supplierCode} | Phone: ${s.phone}`);
  }

  console.log('\n=== 7. FINANCE AUDITS / PAYMENTS ===');
  const financeAudits = await conn.collection('storefinanceaudits').find().toArray();
  console.log(`Finance audits: ${financeAudits.length}`);
  const financePayments = await conn.collection('storefinancepayments').find().toArray();
  console.log(`Finance payments: ${financePayments.length}`);
  const manualSales = await conn.collection('storemanualsales').find().toArray();
  console.log(`Manual sales: ${manualSales.length}`);

  await conn.close();
}

diagnose().catch(console.error);
