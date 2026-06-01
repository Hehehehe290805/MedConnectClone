import mongoose from "mongoose";

const DepartmentTypeSchema = new mongoose.Schema(
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

const DepartmentType = mongoose.model("DepartmentType", DepartmentTypeSchema);
export default DepartmentType;