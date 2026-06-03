import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
    url: { type: String },
    key: { type: String },
}, { _id: false });

const PermitRenewalSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                "doctor_license",
                "pharmacist_license",
                "pharmacy_business_permit",
                "pharmacy_fda_license",
                "technologist_license",
                "institute_business_permit",
                "institute_construction_permit",
            ],
        },
        newImage: { type: imageSchema },
        newLicenseNumber: { type: String },
        // Permanent identifier (e.g. PRC registration number) — submitted for verification,
        // never written back to the user record because it never changes.
        licenseCode: { type: String },
        newExpiration: { type: Date, required: true },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
        },
        rejectionReason: { type: String },
    },
    { timestamps: true }
);

const PermitRenewal = mongoose.model("PermitRenewal", PermitRenewalSchema);
export default PermitRenewal;
