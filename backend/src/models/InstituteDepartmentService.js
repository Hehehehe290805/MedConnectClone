import mongoose from "mongoose";

const InstituteDepartmentServiceSchema = new mongoose.Schema(
    {
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
        },
        claimType: {
            type: String,
            enum: ["service"],
            required: true,
        },
        durationMinutes: {
            type: Number,
            required: true,
        },
        maxPatientsPerDay: {
            type: Number,
        },
        price: {
            type: Number,
        },
        status: {
            type: String,
            enum: ["pending", "verified", "rejected"],
            default: "pending",
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
        },
    },
    { timestamps: true }
);

const InstituteDepartmentService = mongoose.model("InstituteDepartmentService", InstituteDepartmentServiceSchema);
export default InstituteDepartmentService;