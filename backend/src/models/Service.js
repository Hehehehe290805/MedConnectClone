import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
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

const Service = mongoose.model("Service", ServiceSchema);

export default Service;
