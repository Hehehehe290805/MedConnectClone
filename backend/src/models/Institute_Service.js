import mongoose from "mongoose";

const Institute_ServiceSchema = new mongoose.Schema(
    {
        instituteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
        }, 
        claimType: { 
            type: String,
            enum: ["service"],
            required: true,
        },
        durationMinutes: {
            type: Number, 
            required: true
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

const Institute_Service = mongoose.model("Institute_Service", Institute_ServiceSchema);

export default Institute_Service;
