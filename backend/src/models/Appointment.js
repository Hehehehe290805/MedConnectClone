import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  doctorId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  patientId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  serviceId:   { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
  virtual:     { type: Boolean, default: true },

  start: { type: Date, required: true },
  end:   { type: Date, required: true },

  status: {
    type: String,
    enum: [
      "pending_payment",   // awaiting patient deposit
      "deposit_paid",      // deposit received, awaiting doctor action
      "accepted",          // doctor accepted, appointment confirmed
      "rejected",          // doctor rejected — auto-deleted after 24hrs
      "cancelled",         // patient cancelled (deposit non-refundable)
      "ongoing",           // start time reached (cron-triggered)
      "completed",         // end time passed OR both clicked complete
      "awaiting_balance",  // virtual only — waiting for remaining 50%
      "fully_paid",        // remaining balance paid (or in-person complete)
      "missed_by_patient", // virtual only — patient missed, eligible for one paid rebook
      "missed_by_provider",// virtual only — provider missed, eligible for one free rebook + cashback
      "missed_by_both",    // virtual only — both missed, eligible for one free rebook
      "disputed",          // report filed within 8hrs of start
      "resolved",          // admin resolved dispute
    ],
    default: "pending_payment",
  },

  // Payment — all computed at booking time
  amount:        { type: Number, required: true },  // total price
  platformFee:   { type: Number, required: true },  // 10% of amount
  depositAmount: { type: Number, required: true },  // 50% of amount
  depositPaid:   { type: Boolean, default: false },
  depositRef:    { type: String },
  balanceAmount: { type: Number, required: true },  // 50% of amount
  balancePaid:   { type: Boolean, default: false },
  balanceRef:    { type: String },

  // For cron auto-delete (24hrs after rejection)
  rejectedAt: { type: Date },

  // Rejection reason
  rejectionReason: { type: String },

  // Review (submitted after fully_paid)
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },

  // Virtual call join tracking — populated when each party clicks "Join Call"
  patientJoined:  { type: Boolean, default: false },
  providerJoined: { type: Boolean, default: false },

  // Virtual missed appointment rebooking
  missedBy: {
    type: String,
    enum: ["patient", "provider", "both", null],
    default: null,
  },
  missedAt: { type: Date },
  rebookDeadline: { type: Date },
  rebookUsed: { type: Boolean, default: false },
  rebooked: { type: Boolean, default: false },
  rebookedAt: { type: Date },
  rebookFeePaid: { type: Boolean, default: false },
  rebookFeeRef: { type: String },
  cashbackAmount: { type: Number, default: 0 },

}, { timestamps: true });

const Appointment = mongoose.model("Appointment", AppointmentSchema);
export default Appointment;
