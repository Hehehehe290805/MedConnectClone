import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        rootDepartmentType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DepartmentType",
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

// same name under different department types is allowed
// same name under same department type is not
ServiceSchema.index({ name: 1, rootDepartmentType: 1 }, { unique: true });

const Service = mongoose.model("Service", ServiceSchema);
export default Service;