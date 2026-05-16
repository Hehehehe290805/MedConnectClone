import mongoose from "mongoose";

const SpecialtySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
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

const Specialty = mongoose.model("Specialty", SpecialtySchema);

export default Specialty;
