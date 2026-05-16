import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  // Appointment participants
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service" }, 
  virtual: { type: Boolean, default: true }, 

  // Schedule
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  
  videoCallLink: { 
    type: String,
    default: null 
  },
  
  // Status tracking
  status: {
    type: String,
    enum: [
      "pending_accept", 
      "awaiting_deposit",
      "booked",                 // deposit paid
      "confirmed",              // deposit confirmed by doctor
      "ongoing",
      "marked_complete",
      "completed",
      "fully_paid",             // waiting for remaining payment
      "confirm_fully_paid",     // full payment confirmed
      
      "cancelled_unpaid",
      "cancelled",
      "rejected",
      "no_show_patient",
      "no_show_doctor",
      "no_show_both",
      "freeze",
    ],
    default: "pending_accept",
  },

  // Payment
  amount: { type: Number, required: true },      // total price at booking time

  // Deposit
  paymentDeposit: { type: Number, required: true }, // 10% of total amount
  depositPaid: { type: Boolean, default: false },
  depositRef: { type: String },                    // GCash reference for deposit
  balanceAmount: { type: Number, default: 0 },    // remaining 90% payment
  balancePaid: { type: Boolean, default: false },
  balanceRef: { type: String },                   // GCash reference for remaining

  // Presence tracking
  patientPresent: { type: Boolean, default: false },
  doctorPresent: { type: Boolean, default: false },
  institutePresent: { type: Boolean, default: false },
  bothPresent: { type: Boolean, default: false },

  // Rejection & cancellation
  rejectionReason: { type: String },

  // Review
  rating: { type: Number, min: 1, max: 5 }, // star rating
  review: { type: String }, // textual feedback

}, { timestamps: true });

const Appointment = mongoose.model("Appointment", AppointmentSchema);
export default Appointment;
