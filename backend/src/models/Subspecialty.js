import mongoose from "mongoose";
import Specialty from "./Specialty.js";

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
            validate: {
                validator: async function (specialtyId) {
                    // Check if the specialty exists
                    const specialty = await Specialty.findById(specialtyId);
                    return specialty !== null;
                },
                message: "Root specialty does not exist"
            }
        },
        status: {
            type: String,
            enum: ["pending", "verified"],
            default: "pending",
        },
        approvedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
        },
    },
    { timestamps: true }
);

const Subspecialty = mongoose.model("Subspecialty", SubspecialtySchema);

export default Subspecialty;