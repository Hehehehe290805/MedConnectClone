import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
    {
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
            required: true,
        },
        filedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        filedAgainst: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reason: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "resolved", "cancelled"],
            default: "pending",
        },
        outcome: {
            type: String,
            // "provider_right" covers doctor, institute, and pharmacy disputes
            enum: ["patient_right", "provider_right", "split", null],
            default: null,
        },
        adminNote: {
            type: String,
            trim: true,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

const Report = mongoose.model("Report", ReportSchema);
export default Report;
