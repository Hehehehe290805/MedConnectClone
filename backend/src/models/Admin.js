import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const imageSchema = new mongoose.Schema({
    url: { type: String },
    key: { type: String },
}, { _id: false });

const adminSchema = new mongoose.Schema({
    firstName: { type: String },
    lastName: { type: String },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return this.isModified("password") ? passwordRegex.test(v) : true;
            },
            message: "Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 symbol (@$!%*?&)",
        },
    },
    profilePic: { type: imageSchema, default: () => ({}) },
    status: {
        type: String,
        enum: ["notOnBoarded", "pending", "onBoarded"],
        default: "notOnBoarded",
    },
    role: {
        type: String,
        default: "admin",
        immutable: true,
    },
    adminCode: { type: String, required: true },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
    },
    pendingDeletion: { type: Boolean, default: false },
    deletionRequestedAt: { type: Date, default: null },
    resetPasswordCode: { type: String, default: null },
    resetPasswordCodeExpiry: { type: Date, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    loginLockedAt: { type: Date, default: null },
    phoneNumber: { type: String },
    phoneType: {
        type: String,
        enum: ["mobile", "telephone"],
        default: "mobile",
    },
}, { timestamps: true });

adminSchema.pre("save", async function (next) {
    try {
        if (this.isModified("password")) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        if (this.isModified("adminCode")) {
            const salt = await bcrypt.genSalt(10);
            this.adminCode = await bcrypt.hash(this.adminCode, salt);
        }
    } catch (error) {
        return next(error);
    }
    next();
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

adminSchema.methods.matchAdminCode = async function (enteredCode) {
    return bcrypt.compare(enteredCode, this.adminCode);
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;