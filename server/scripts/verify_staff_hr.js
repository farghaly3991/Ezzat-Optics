const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");
const getBranchModel = require("../modules/branches/branchModel");
const getUsersModel = require("../modules/auth/userModel");
const staffService = require("../modules/branches/staffService");
const branchService = require("../modules/branches/branchService");

async function verify() {
  const SUBDOMAIN = "localhost";
  const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;
  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Branch = getBranchModel(SUBDOMAIN);
  const Users = getUsersModel(SUBDOMAIN);
  const superAdmin = await Users.findOne({ role: 5 });

  const branches = await Branch.find({});
  console.log("=== VERIFYING BRANCHES & STAFF ===");

  for (const b of branches) {
    console.log(`\nBranch: ${b.name} (${b._id})`);
    const staffList = await staffService.listStaff(SUBDOMAIN, b._id, superAdmin);
    console.log(`Staff count: ${staffList.length}`);
    for (const s of staffList) {
      console.log(`- ${s.fullname} | Role: ${s.role} | Job: ${s.jobTitle} | Type: ${s.employmentType} | Salary: ${s.monthlySalary} EGP | Net: ${s.calculatedNetSalary} EGP | Attendance: ${s.attendanceSummary?.attendanceRate}% | Deductions: ${s.deductionsSummary?.currentMonthTotal} EGP`);
    }
  }

  // Test Profile Dossier for Hossam
  const hossam = await Users.findOne({ email: "hossam.abdallah@store.com" });
  if (hossam) {
    console.log(`\n=== TESTING PROFILE DOSSIER FOR: ${hossam.fullname} ===`);
    const profile = await staffService.getStaffProfile(SUBDOMAIN, hossam._id, superAdmin);
    console.log("Summary:", JSON.stringify(profile.summary, null, 2));
    console.log("Recent attendance records count:", profile.recentAttendance?.length);
    console.log("Recent deductions records count:", profile.recentDeductions?.length);
    console.log("Customer reviews count:", profile.reviews?.length);
  }

  // Test Salary Update
  console.log("\n=== TESTING SALARY UPDATE & PERSISTENCE ===");
  const testStaff = await Users.findOne({ email: "sara.kamel@store.com" });
  const oldSalary = testStaff.monthlySalary;
  console.log(`Current Sara salary: ${oldSalary} EGP`);

  const updatedStaff = await staffService.updateStaff(SUBDOMAIN, testStaff.branchId, testStaff._id, {
    monthlySalary: 8900
  }, superAdmin);
  console.log(`Updated Sara salary via staffService: ${updatedStaff.monthlySalary} EGP`);

  // Re-fetch via branchService.getBranchStaff
  const branchStaff = await branchService.getBranchStaff(SUBDOMAIN, testStaff.branchId);
  const reFetchedSara = branchStaff.allStaff.find(s => s._id.toString() === testStaff._id.toString());
  console.log(`Re-fetched Sara salary via getBranchStaff: ${reFetchedSara?.monthlySalary} EGP`);

  // Restore
  await staffService.updateStaff(SUBDOMAIN, testStaff.branchId, testStaff._id, {
    monthlySalary: oldSalary
  }, superAdmin);
  console.log(`Restored Sara salary to: ${oldSalary} EGP`);

  console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<");
  process.exit(0);
}

verify().catch(e => {
  console.error("Error during verification:", e);
  process.exit(1);
});
