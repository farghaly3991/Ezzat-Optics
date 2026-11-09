const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");
const getUsersModel = require("../modules/auth/userModel");

async function listUsers() {
  const SUBDOMAIN = "localhost";
  const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;
  await ensureTenantConnection(SUBDOMAIN, DB_URL);
  const Users = getUsersModel(SUBDOMAIN);

  const users = await Users.find({});
  console.log("All Users count:", users.length);
  for (const u of users) {
    if (u.branchId || u.role > 1) {
      console.log(`[${u._id}] ${u.email} | ${u.fullname} | Role: ${u.role} | Salary: ${u.monthlySalary} | Branch: ${u.branchId}`);
    }
  }
  process.exit(0);
}
listUsers().catch(e => { console.error(e); process.exit(1); });
