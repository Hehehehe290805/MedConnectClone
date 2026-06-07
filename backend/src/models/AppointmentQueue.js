import mongoose from "mongoose";

const slotSchema = new mongoose.Schema({
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    position:      { type: Number, required: true },          // 1-based
    type:          { type: String, enum: ["booked", "walkin", "emergency"], required: true },
    status:        { type: String, enum: ["waiting", "active", "done", "skipped", "cancelled"], default: "waiting" },
    patientId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalStart: { type: Date, required: true },
    currentStart:  { type: Date, required: true },
}, { _id: false });

const AppointmentQueueSchema = new mongoose.Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },        // UTC midnight of the queue day (Asia/Manila)
    slots: [slotSchema],
    isActive: { type: Boolean, default: false },
}, {
    timestamps: true,
});

// One queue per provider per day
AppointmentQueueSchema.index({ providerId: 1, date: 1 }, { unique: true });

const AppointmentQueue = mongoose.model("AppointmentQueue", AppointmentQueueSchema);
export default AppointmentQueue;
