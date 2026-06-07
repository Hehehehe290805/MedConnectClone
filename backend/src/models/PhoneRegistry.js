import mongoose from "mongoose";

const phoneRegistrySchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    registrant: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "registrantModel",
        required: true,
    },
    registrantModel: {
        type: String,
        enum: ["User", "Admin"],
        required: true,
    },
}, { timestamps: true });

const PhoneRegistry = mongoose.model("PhoneRegistry", phoneRegistrySchema);
export default PhoneRegistry;
