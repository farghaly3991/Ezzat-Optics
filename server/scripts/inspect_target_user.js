const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");
const getUsersModel = require("../modules/auth/userModel");
const getBranchModel = require("../modules/branches/branchModel");
const getAttendanceModel = require("../modules/branches/models/attendanceModel");
const getDeductionModel = require("../modules/branches/models/deductionModel");

async function check() {
  const SUBDOMAIN = "localhost";
  const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;
  await ensureTenantConnection(SUBDOMAIN, DB_URL);

  const Users = getUsersModel(SUBDOMAIN);
  const Branch = getBranchModel(SUBDOMAIN);
  const Attendance = getAttendanceModel(SUBDOMAIN);
  const Deduction = getDeductionModel(SUBDOMAIN);

  const targetEmail = "tech.test.1793469487841@branch.com";
  console.log("Checking exact email:", targetEmail);
  const user = await Users.findOne({ email: targetEmail });
  
  if (user) {
    console.log("Found user:", {
      _id: user._id,
      email: user.email,
      fullname: user.fullname,
      branchId: user.branchId,
      role: user.role,
      jobTitle: user.jobTitle,
      employmentType: user.employmentType,
      monthlySalary: user.monthlySalary,
      shiftHours: user.shiftHours,
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd
    });

    const attendances = await Attendance.find({ employeeId: user._id });
    console.log("Attendance count for user:", attendances.length);

    const deductions = await Deduction.find({ employeeId: user._id });
    console.log("Deductions count for user:", deductions.length);
  } else {
    console.log("User NOT found with exact email. Let's find all users with role 2, 3, or 4:");
    const all = await Users.find({ branchId: { $ne: null } });
    console.log(all.map(u => ({ id: u._id, email: u.email, name: u.fullname, salary: u.monthlySalary, branch: u.branchId })));
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
