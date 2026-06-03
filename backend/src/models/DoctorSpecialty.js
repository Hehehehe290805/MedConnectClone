import mongoose from "mongoose";

const DoctorSpecialtySchema = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        specialtyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Specialty",
        },
        subspecialtyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subspecialty",
        },
        claimType: {
            type: String,
            enum: ["specialty", "subspecialty"],
            required: true,
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

const DoctorSpecialty = mongoose.model("DoctorSpecialty", DoctorSpecialtySchema);
export default DoctorSpecialty;