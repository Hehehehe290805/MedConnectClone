import mongoose from "mongoose";

// Unified registry for both email addresses and phone numbers.
// Replaces the separate EmailRegistry and PhoneRegistry collections.
// Compound unique index ensures each email/phone can only belong to one account.
const accountRegistrySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["email", "phone"],
        required: true,
    },
    value: {
        type: String,
        required: true,
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

accountRegistrySchema.index({ type: 1, value: 1 }, { unique: true });

const AccountRegistry = mongoose.model("AccountRegistry", accountRegistrySchema);
export default AccountRegistry;
