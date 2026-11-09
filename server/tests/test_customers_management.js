/**
 * Test: Customer Management (Pagination, Search, Edit, Password Change, Delete, and Order Protection)
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { getMongooseConnection, ensureTenantConnection } = require("../core/database");
const getUsersModel = require("../modules/auth/userModel");
const getOrdersModel = require("../modules/orders/orderModel");
const authController = require("../modules/auth/authController");

async function runCustomerTest() {
  const subdomain = "localhost";
  console.log("🚀 Starting Customer Management Integration Test...");

  const DB_URL = envJson[subdomain]?.database || envJson.localhost?.database;
  await ensureTenantConnection(subdomain, DB_URL);
  const Users = getUsersModel(subdomain);
  const Orders = getOrdersModel(subdomain);

  // Clean test customer data
  const testPhone = "01011223344";
  await Users.deleteMany({ phone: testPhone });
  await Orders.deleteMany({ "customer.phone": testPhone });

  // 1. Create a customer and an order
  const user = await Users.create({
    fullname: "سمير محمود تجريبي",
    phone: testPhone,
    email: `${testPhone}@phone.store`,
    password: testPhone,
    city: "الجيزة",
    address: "الدقي",
    role: "user"
  });

  console.log("✅ Created mock customer:", user._id.toString());

  const order = await Orders.create({
    orderId: `ORD-TEST-${Date.now().toString().slice(-4)}`,
    userId: user._id,
    customer: {
      name: user.fullname,
      phone: user.phone,
      address: user.address,
      city: user.city
    },
    total: 1200,
    status: "delivered"
  });
  console.log("✅ Created mock order linked to customer:", order.orderId);

  // 2. Test listCustomers with pagination and search
  const mockReqList = {
    subdomain,
    query: {
      page: 1,
      limit: 10,
      search: "سمير"
    }
  };

  let listResData = null;
  const mockResList = {
    json: (payload) => { listResData = payload; return mockResList; }
  };

  await authController.listCustomers(mockReqList, mockResList, (err) => { if (err) throw err; });

  if (!listResData?.done || !Array.isArray(listResData.customers)) {
    throw new Error("listCustomers failed: " + JSON.stringify(listResData));
  }
  const found = listResData.customers.find(c => String(c._id) === String(user._id));
  if (!found) {
    throw new Error("Expected to find customer 'سمير' in search results");
  }
  if (found.ordersCount !== 1 || found.totalSpent !== 1200) {
    throw new Error(`Orders stats mismatch: expected ordersCount 1 and totalSpent 1200, got count ${found.ordersCount} and spent ${found.totalSpent}`);
  }
  console.log("✅ listCustomers test passed with pagination and order aggregation stats:", {
    total: listResData.pagination.total,
    ordersCount: found.ordersCount,
    totalSpent: found.totalSpent
  });

  // 3. Test updateCustomer
  const mockReqUpdate = {
    subdomain,
    params: { id: user._id.toString() },
    body: {
      fullname: "سمير محمود المعدل",
      city: "الإسكندرية"
    }
  };
  let updateResData = null;
  const mockResUpdate = {
    json: (payload) => { updateResData = payload; return mockResUpdate; },
    status: () => mockResUpdate
  };

  await authController.updateCustomer(mockReqUpdate, mockResUpdate, (err) => { if (err) throw err; });
  if (!updateResData?.done) {
    throw new Error("updateCustomer failed: " + JSON.stringify(updateResData));
  }
  const updatedUser = await Users.findById(user._id);
  if (updatedUser.fullname !== "سمير محمود المعدل" || updatedUser.city !== "الإسكندرية") {
    throw new Error("Customer profile update failed in database!");
  }
  console.log("✅ updateCustomer test passed!");

  // 4. Test updateCustomerPassword
  const mockReqPass = {
    subdomain,
    params: { id: user._id.toString() },
    body: { newPassword: "newsecretpass999" }
  };
  let passResData = null;
  const mockResPass = {
    json: (payload) => { passResData = payload; return mockResPass; },
    status: () => mockResPass
  };

  await authController.updateCustomerPassword(mockReqPass, mockResPass, (err) => { if (err) throw err; });
  if (!passResData?.done) {
    throw new Error("updateCustomerPassword failed: " + JSON.stringify(passResData));
  }
  const userWithNewPass = await Users.findById(user._id);
  const isMatch = await bcrypt.compare("newsecretpass999", userWithNewPass.password);
  if (!isMatch) {
    throw new Error("New password hash check failed!");
  }
  console.log("✅ updateCustomerPassword test passed with bcrypt hash verified!");

  // 5. Test deleteCustomer and verify Order is PRESERVED!
  const mockReqDel = {
    subdomain,
    params: { id: user._id.toString() }
  };
  let delResData = null;
  const mockResDel = {
    json: (payload) => { delResData = payload; return mockResDel; },
    status: () => mockResDel
  };

  await authController.deleteCustomer(mockReqDel, mockResDel, (err) => { if (err) throw err; });
  if (!delResData?.done) {
    throw new Error("deleteCustomer failed: " + JSON.stringify(delResData));
  }
  const deletedCheck = await Users.findById(user._id);
  if (deletedCheck !== null) {
    throw new Error("User document was not deleted!");
  }
  const preservedOrder = await Orders.findOne({ orderId: order.orderId });
  if (!preservedOrder) {
    throw new Error("FATAL: Order was deleted when customer was deleted! Accounting integrity violated!");
  }
  console.log("✅ deleteCustomer test passed: Customer removed, order PRESERVED for analytics & accounting!");

  // Cleanup order
  await Orders.deleteOne({ _id: order._id });

  console.log("\n🎉 ALL CUSTOMER MANAGEMENT INTEGRATION TESTS PASSED 100%!");
  process.exit(0);
}

runCustomerTest().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
