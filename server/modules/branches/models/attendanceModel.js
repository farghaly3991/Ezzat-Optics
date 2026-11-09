const mongoose = require("mongoose");
const { getMongooseConnection } = require("../../../core/database");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "storeBranch",
      required: true,
      index: true
    },
    // Normalized to midnight (YYYY-MM-DD 00:00:00) for daily querying
    date: {
      type: Date,
      required: true,
      index: true
    },
    checkIn: {
      type: Date,
      default: null
    },
    checkInMethod: {
      type: String,
      enum: ["manual", "qr", "biometric"],
      default: "manual"
    },
    checkOut: {
      type: Date,
      default: null
    },
    checkOutMethod: {
      type: String,
      enum: ["manual", "qr", "biometric"],
      default: "manual"
    },
    totalMinutes: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["present", "late", "early_leave", "absent", "approved_leave"],
      default: "present",
      index: true
    },
    isApprovedLeave: {
      type: Boolean,
      default: false
    },
    leaveReason: {
      type: String,
      default: ""
    },
    notes: {
      type: String,
      default: ""
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    }
  },
  { timestamps: true }
);

// Compound index to ensure 1 attendance record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = (subdomain) => {
  const connection = getMongooseConnection(subdomain);
  return connection.models.storeAttendance || connection.model("storeAttendance", attendanceSchema);
};
