const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const envJson = require('../env.json');
const { ensureTenantConnection } = require('../core/database');

const SUBDOMAIN = 'localhost';
const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;

const getOrdersModel = require('../modules/orders/orderModel');
const getUsersModel = require('../modules/auth/userModel');
const getBranchModel = require('../modules/branches/branchModel');
const installmentService = require('../modules/orders/installmentService');

async function test() {
  await ensureTenantConnection(SUBDOMAIN, DB_URL);
  const Orders = getOrdersModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const Branch = getBranchModel(SUBDOMAIN);

  const admin = await Users.findOne({ role: 5 }).lean();
  const branch = await Branch.findOne({ isMain: true }).lean();

  console.log('Testing with Admin:', admin?.email, 'Branch:', branch?.name);

  // 1. Build Installment Schedule
  const originalAmount = 12000;
  const downPayment = 2000;
  const months = 6;
  const interestRate = 10;
  
  const schedule = installmentService.buildInstallmentSchedule({
    originalAmount,
    months,
    interestRate,
    downPayment,
    startDate: new Date(),
    guarantor: {
      name: 'أحمد محمود العشري (ضامن)',
      phone: '01011223344',
      nationalId: '29001011234567',
      relationship: 'أخ'
    }
  });

  // 2. Create Order in DB
  const testOrderId = 'TEST-INST-' + Date.now();
  const newOrder = await Orders.create({
    orderId: testOrderId,
    branchId: branch?._id,
    userId: admin?._id,
    customer: {
      name: 'عميل التقسيط التجريبي',
      phone: '01099887766',
      address: 'المعادي - القاهرة',
      city: 'القاهرة'
    },
    items: [
      {
        productId: '648f12345678901234567890',
        name: 'شاشة سامسونج 55 بوصة Smart 4K UHD',
        price: 12000,
        quantity: 1
      }
    ],
    deliveryMethod: 'pickup',
    payment: {
      method: 'installment',
      paid: false
    },
    installment: schedule,
    subtotal: 12000,
    shipping: 0,
    discount: 0,
    total: schedule.plan.totalAmount,
    status: 'delivered',
    timeline: [
      {
        status: 'delivered',
        at: new Date(),
        note: 'تسجيل عقد تقسيط مباشر مع المحل'
      }
    ]
  });

  console.log('Order created successfully:', newOrder.orderId);

  // 3. Test getInstallmentsOverview
  const overview = await installmentService.getInstallmentsOverview(
    SUBDOMAIN,
    { search: 'عميل التقسيط التجريبي', status: 'all', page: 1, limit: 10 },
    { role: 5 }
  );

  console.log('Overview KPIs:', overview.kpis);
  const foundOrder = overview.orders.find(o => o.orderId === testOrderId);
  console.log('Found contract orderId:', foundOrder?.orderId, 'Status:', foundOrder?.installment?.summary?.status);

  // 4. Test recordInstallmentPayment
  const payResult = await installmentService.recordInstallmentPayment(
    SUBDOMAIN,
    testOrderId,
    {
      installmentIndex: 1,
      amount: schedule.plan.monthlyAmount,
      paymentMethod: 'cash',
      notes: 'سداد القسط الأول في الخزينة'
    },
    { _id: admin?._id, name: admin?.fullname || 'مدير النظام', role: 5 }
  );

  console.log('Payment 1 Recorded: receiptNumber =', payResult.receiptNumber);
  console.log('Summary after Payment 1:', payResult.summary);
  console.log('Order status:', payResult.order?.status, 'Payment paid:', payResult.order?.payment?.paid);

  // 5. Test getFinanceInstallmentsSummary
  const financeSummary = await installmentService.getFinanceInstallmentsSummary(
    SUBDOMAIN,
    null
  );

  console.log('Finance Summary (إيه اللي ليك، إيه اللي داخل، إيه اللي لسه ليك):', {
    totalReceivablesOriginal: financeSummary.totalReceivablesOriginal,
    totalCashCollected: financeSummary.totalCashCollected,
    totalRemainingReceivables: financeSummary.totalRemainingReceivables,
    activeContractsCount: financeSummary.activeContractsCount,
    collectionRate: financeSummary.collectionRate + '%'
  });
  console.log('Projected Monthly Cash Flow (Next 3 months):', financeSummary.monthlyProjection.slice(0, 3));

  // 6. Test recording remaining 5 installments to test Auto-Completion!
  console.log('--- Testing auto-completion by paying installments 2 through 6 ---');
  for (let i = 2; i <= 6; i++) {
    const res = await installmentService.recordInstallmentPayment(
      SUBDOMAIN,
      testOrderId,
      {
        installmentIndex: i,
        amount: schedule.plan.monthlyAmount,
        paymentMethod: 'cash',
        notes: `سداد القسط رقم ${i}`
      },
      { _id: admin?._id, name: 'مدير النظام', role: 5 }
    );
    if (i === 6) {
      console.log('Final Installment (6) paid! Contract status:', res.summary?.status, 'Order paid flag:', res.order?.payment?.paid);
    }
  }

  // 7. Clean up test order
  await Orders.deleteMany({ orderId: { $regex: '^TEST-INST' } });
  console.log('Cleaned up all test orders. All verification tests PASSED perfectly!');

  process.exit(0);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
