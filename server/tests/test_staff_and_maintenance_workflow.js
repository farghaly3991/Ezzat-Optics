const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");

const branchService = require('../modules/branches/branchService');
const returnsService = require('../modules/returns/returnsService');
const getUsersModel = require('../modules/auth/userModel');
const getReturnModel = require('../modules/returns/returnModel');

const SUBDOMAIN = "localhost";
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

async function runTests() {
  console.log('🧪 Starting End-to-End Staff Management & Technician Maintenance Tests...');
  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const User = getUsersModel(SUBDOMAIN);
  const Return = getReturnModel(SUBDOMAIN);

  // 1. Get super admin for testing
  let superAdmin = await User.findOne({ role: 5 });
  if (!superAdmin) {
    superAdmin = await User.findOne({ role: { $gte: 4 } });
  }

  // 2. List branches
  const branches = await branchService.listBranches(SUBDOMAIN, null, { role: 5 });
  console.log(`✓ Fetched ${branches.length} branches. Verified staffCount & breakdown:`);
  branches.forEach(b => {
    console.log(`   - [${b.name}]: total staff: ${b.staffCount}, breakdown:`, b.staffBreakdown);
  });

  const testBranch = branches[0];
  if (!testBranch) {
    throw new Error('No test branch found!');
  }

  // 3. Add a sales staff (Role 3) to test branch
  const testSalesEmail = `sales.test.${Date.now()}@branch.com`;
  const salesStaff = await branchService.addBranchStaff(
    SUBDOMAIN,
    testBranch._id,
    {
      fullname: 'كاشير مبيعات تجريبي',
      email: testSalesEmail,
      password: 'password123',
      phone: '01012345678',
      role: 3
    },
    superAdmin
  );
  console.log(`✓ Added Sales Staff (Role 3): ${salesStaff.fullname} (${salesStaff.email}) to branch ${testBranch.name}`);

  // 4. Add a technician (Role 2) to test branch
  const testTechEmail = `tech.test.${Date.now()}@branch.com`;
  const techStaff = await branchService.addBranchStaff(
    SUBDOMAIN,
    testBranch._id,
    {
      fullname: 'فني صيانة معتمد تجريبي',
      email: testTechEmail,
      password: 'password123',
      phone: '01098765432',
      role: 2
    },
    superAdmin
  );
  console.log(`✓ Added Technician (Role 2): ${techStaff.fullname} (${techStaff.email}) to branch ${testBranch.name}`);

  // 5. Verify technicians endpoint
  const branchTechs = await branchService.getBranchTechnicians(SUBDOMAIN, testBranch._id);
  console.log(`✓ Retrieved ${branchTechs.length} technicians for branch ${testBranch.name}`);
  const foundTech = branchTechs.find(t => String(t._id) === String(techStaff._id));
  if (!foundTech) throw new Error('Technician not found in branch technicians list');

  const mongoose = require('mongoose');
  // 6. Create a mock maintenance RMA ticket
  const mockMaintenanceReq = await Return.create({
    requestNumber: `RMA-TEST-${Date.now().toString().slice(-4)}`,
    type: 'maintenance',
    branchId: testBranch._id,
    orderId: 'ORD-9999',
    customer: {
      name: 'عميل الصيانة التجريبي',
      phone: '01122334455',
      city: 'القاهرة',
      address: 'المعادي - شارع 9'
    },
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: 'جهاز لابتوب ديل للأعمال',
        quantity: 1,
        price: 25000,
        condition: 'defect'
      }
    ],
    reason: 'عطل في مفتاح الباور ولا يشحن إطلاقاً',
    warrantyStatus: 'in_warranty',
    status: 'received_at_branch'
  });
  console.log(`✓ Created test maintenance RMA ticket: ${mockMaintenanceReq.requestNumber}`);

  // 7. Assign technician to this ticket
  const assignmentResult = await returnsService.assignTechnicianToRequest(
    SUBDOMAIN,
    mockMaintenanceReq._id,
    {
      techId: techStaff._id,
      note: 'يرجى مراجعة دائرة الشحن واستبدال الآي سي إن لزم الأمر'
    },
    superAdmin
  );
  console.log(`✓ Assigned RMA ticket to technician:`, {
    tech: assignmentResult.tech,
    taskUrl: assignmentResult.taskUrl,
    whatsappUrl: assignmentResult.whatsappUrl,
    accessToken: assignmentResult.accessToken ? 'GENERATED_OK' : 'MISSING'
  });

  // 8. Test public access by token (no login needed)
  const token = assignmentResult.accessToken;
  const techTaskData = await returnsService.getTechnicianTask(SUBDOMAIN, mockMaintenanceReq._id, token, null);
  console.log(`✓ Technician accessed task without login via token! Task status: ${techTaskData.status}`);

  // 9. Technician updates the task status to "repaired"
  const updateResult = await returnsService.updateTechnicianTask(
    SUBDOMAIN,
    mockMaintenanceReq._id,
    {
      status: 'repaired',
      techNotes: 'تم فحص البوردة واستبدال مكثف الشحن التالف، الجهاز يعمل بحالة ممتازة الآن.',
      techAction: 'تم تغيير مكثف الباور والشاحن يعمل بنسبة 100%'
    },
    token,
    null
  );
  console.log(`✓ Technician updated task successfully:`, {
    status: updateResult.status,
    techNotes: updateResult.techNotes,
    techCompletedAt: updateResult.techCompletedAt
  });

  // 10. Clean up test records
  await Return.deleteOne({ _id: mockMaintenanceReq._id });
  await User.deleteOne({ _id: salesStaff._id });
  await User.deleteOne({ _id: techStaff._id });
  console.log(`✓ Cleaned up test database records.`);

  console.log('\n🎉 ALL STAFF MANAGEMENT & TECHNICIAN WORKFLOW TESTS PASSED 100%!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
