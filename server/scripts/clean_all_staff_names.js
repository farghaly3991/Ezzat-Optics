const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const envJson = require("../env.json");
const { ensureTenantConnection } = require("../core/database");
const getUsersModel = require("../modules/auth/userModel");

async function cleanAllStaff() {
  const SUBDOMAIN = "localhost";
  const DB_URL = envJson[SUBDOMAIN]?.database || envJson.localhost?.database;
  await ensureTenantConnection(SUBDOMAIN, DB_URL);
  const Users = getUsersModel(SUBDOMAIN);

  const allStaff = await Users.find({ branchId: { $ne: null } });
  console.log("Total branch staff found:", allStaff.length);

  // 1. Update duplicate Hossam Abdallahs
  const hossams = allStaff.filter(u => u.fullname === "م. حسام الدين عبد الله");
  if (hossams.length > 1) {
    if (hossams[1]) {
      hossams[1].fullname = "م. محمود طاهر القاضي";
      hossams[1].jobTitle = "مهندس فحص وتغذية طاقة";
      hossams[1].employmentType = "permanent";
      hossams[1].monthlySalary = 9800;
      await hossams[1].save();
      console.log("Renamed duplicate 1 to Mahmoud Taher");
    }
    if (hossams[2]) {
      hossams[2].fullname = "م. ياسر سراج الدين";
      hossams[2].jobTitle = "فني دوائر إلكترونية ولحام دقيق";
      hossams[2].employmentType = "permanent";
      hossams[2].monthlySalary = 9000;
      await hossams[2].save();
      console.log("Renamed duplicate 2 to Yasser Serageldin");
    }
  }

  // 2. Update 'كاشير مبيعات تجريبي'
  const cashiers = allStaff.filter(u => u.fullname.includes("تجريبي") || u.fullname.includes("كاشير مبيعات"));
  const cashierNames = [
    { name: "ياسمين خالد العطار", title: "أخصائية مبيعات وخزينة", salary: 7200 },
    { name: "مروان أشرف صبحي", title: "أخصائي مبيعات واستقبال", salary: 6800 }
  ];
  for (let i = 0; i < cashiers.length; i++) {
    const item = cashierNames[i] || { name: "عمر شريف الدالي", title: "مسؤول مبيعات", salary: 7000 };
    cashiers[i].fullname = item.name;
    cashiers[i].jobTitle = item.title;
    cashiers[i].employmentType = "permanent";
    cashiers[i].monthlySalary = item.salary;
    await cashiers[i].save();
    console.log("Renamed cashier to:", item.name);
  }

  // 3. Update branch managers and unassigned titles/salaries
  for (const s of allStaff) {
    if (s.fullname.includes("أحمد المهدي")) {
      s.jobTitle = "مدير الفرع الرئيسي (القاهرة)";
      s.employmentType = "permanent";
      s.monthlySalary = 14000;
      await s.save();
    } else if (s.fullname.includes("حسام الدين السكندري")) {
      s.jobTitle = "مدير فرع الإسكندرية";
      s.employmentType = "permanent";
      s.monthlySalary = 13000;
      await s.save();
    } else if (s.fullname.includes("كريم عبد الشكور")) {
      s.jobTitle = "مدير فرع الجيزة والشيخ زايد";
      s.employmentType = "permanent";
      s.monthlySalary = 13000;
      await s.save();
    } else if (s.fullname.includes("سارة محمود")) {
      s.jobTitle = "مسؤولة مبيعات وخزينة";
      s.employmentType = "permanent";
      s.monthlySalary = 7500;
      await s.save();
    } else if (s.fullname.includes("إبراهيم خليل")) {
      s.jobTitle = "فني صيانة وضبط جودة معتمد";
      s.employmentType = "permanent";
      s.monthlySalary = 8800;
      await s.save();
    }
  }

  console.log("All staff names, job titles, and salaries updated cleanly!");
  process.exit(0);
}

cleanAllStaff().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
