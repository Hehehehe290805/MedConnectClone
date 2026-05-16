import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema({
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User",  unique: true },
    instituteId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    startHour: { type: String, required: true }, // e.g., "09:00"
    endHour: { type: String, required: true },   // e.g., "17:00"
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sunday
    isActive: { type: Boolean, default: true }, // toggle to close for long periods
});

const Schedule = mongoose.model("DoctorSchedule", ScheduleSchema);
export default Schedule;
