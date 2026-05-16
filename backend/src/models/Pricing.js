import mongoose from "mongoose";

const PricingSchema = new mongoose.Schema(
    {
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
        }, 
        price: {
            type: Number,
            required: true
        },
    },
    { timestamps: true }
);

const Pricing = mongoose.model("Pricing", PricingSchema);

export default Pricing;
