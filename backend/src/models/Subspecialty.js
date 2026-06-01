import mongoose from "mongoose";

const SubspecialtySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        rootSpecialty: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Specialty",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "verified"],
            default: "pending",
        },
        suggestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        approvedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Admin",
        },
    },
    { timestamps: true }
);

SubspecialtySchema.index({ name: 1, rootSpecialty: 1 }, { unique: true });
const Subspecialty = mongoose.model("Subspecialty", SubspecialtySchema);

export default Subspecialty;