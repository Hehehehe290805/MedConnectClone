import mongoose from "mongoose";

const emailRegistrySchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
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

const EmailRegistry = mongoose.model("EmailRegistry", emailRegistrySchema);
export default EmailRegistry;