import mongoose from "mongoose";

const verificationCodeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false, // null for signup (no user yet)
        default: null,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    code: {
        type: String,
        required: true,
        // stored as bcrypt hash
    },
    type: {
        type: String,
        required: true,
        enum: [
            "signup",
            "phone_signup",
            "update-email-current",
            "update-email-new",
            "update-password",
            "permit-renewal",
            "two_factor",
            "phone_verify",
            "onboarding_email_verify",
        ],
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    previousVerificationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VerificationCode",
        default: null,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }, // TTL — MongoDB removes doc when expiresAt is reached
    },
}, { timestamps: true });

const VerificationCode = mongoose.model("VerificationCode", verificationCodeSchema);
export default VerificationCode;