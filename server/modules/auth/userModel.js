const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getMongooseConnection } = require("../../core/database");

const usersSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    fullname: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    // Role: 5 = Super Admin, 4 = Branch Admin / Manager, 3 = Staff / Cashier, 2 = Maintenance Tech / Courier, 1 = Regular Customer
    role: { type: mongoose.Schema.Types.Mixed, default: 1 },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "storeBranch", default: null, index: true },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "storeProduct" }],
    active: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    hasOnlineAccount: { type: Boolean, default: false },

    // Customer Optical Profile & Clinical Records (سجل فحص وكشف النظر للعميل)
    birthDate: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    nextCheckupDate: { type: Date, default: null },
    checkupPeriodMonths: { type: Number, default: 12 }, // مدة الفحص الدوري بالشهور
    prescriptions: [
      {
        date: { type: Date, default: Date.now },
        doctorName: { type: String, default: "" },
        clinicName: { type: String, default: "" },
        // قياسات العين اليمنى (OD - Right Eye)
        rightEye: {
          sph: { type: String, default: "" },
          cyl: { type: String, default: "" },
          axis: { type: String, default: "" },
          add: { type: String, default: "" },
          pd: { type: String, default: "" },
          prism: { type: String, default: "" },
          base: { type: String, default: "" }
        },
        // قياسات العين اليسرى (OS - Left Eye)
        leftEye: {
          sph: { type: String, default: "" },
          cyl: { type: String, default: "" },
          axis: { type: String, default: "" },
          add: { type: String, default: "" },
          pd: { type: String, default: "" },
          prism: { type: String, default: "" },
          base: { type: String, default: "" }
        },
        ipd: { type: String, default: "" }, // المسافة الإجمالية بين البؤبؤين
        usageType: {
          type: String,
          enum: ["distance", "reading", "bifocal", "progressive", "general"],
          default: "distance"
        },
        notes: { type: String, default: "" },
        prescriptionImage: { type: String, default: "" } // صورة مرفقة للكشف الورقي
      }
    ],
    // رصيد الدفعات تحت الحساب (Customer Deposit Balance - مبالغ مقدمة بدون حجز صنف)
    depositBalance: { type: Number, default: 0, min: 0 },

    // Staff HR & Operations Profile
    employmentType: {
      type: String,
      enum: ["permanent", "permanent_salaried", "per_task", "per_task_freelance"],
      default: "permanent"
    },
    monthlySalary: { type: Number, default: 0, min: 0 },
    workDays: {
      type: [String],
      default: ["sat", "sun", "mon", "tue", "wed", "thu"]
    },
    shiftHours: { type: Number, default: 8, min: 0, max: 24 },
    shiftStart: { type: String, default: "09:00" },
    shiftEnd: { type: String, default: "17:00" },
    isAttendanceRequired: { type: Boolean, default: true },
    qrAttendanceCode: { type: String, default: null, index: true },
    jobTitle: { type: String, default: "" },
    nationalId: { type: String, default: "" },
    emergencyPhone: { type: String, default: "" }
  },
  { timestamps: true }
);

usersSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

usersSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.users || connection.model("users", usersSchema);
};
