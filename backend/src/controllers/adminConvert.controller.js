// POST /api/onboarding/admin/convert
// Called when user selects Admin role during onboarding
// Verifies adminCode, converts base User doc to Admin doc (delete + recreate pattern — same as promoteUser)
import mongoose from "mongoose";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import EmailRegistry from "../models/EmailRegistry.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const convertToAdmin = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { adminCode } = req.body;

    if (!adminCode) return sendError(res, 400, "Admin code is required.");

    const existing = await User.findById(userId).select("status role email password");
    if (!existing) return sendError(res, 404, "User not found.");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role.");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "Account is already onboarded or pending.");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await User.deleteOne({ _id: userId }, { session });

        const admin = new Admin({
            _id: userId,
            email: existing.email,
            password: existing.password,
            adminCode,
            status: "notOnBoarded",
        });
        // password is already hashed — skip validator and pre-save hook
        admin.$set("password", existing.password);
        admin.unmarkModified("password");
        await admin.save({ session });

        await EmailRegistry.findOneAndUpdate(
            { email: existing.email },
            { registrantModel: "Admin" },
            { session }
        );

        await session.commitTransaction();

        return sendSuccess(res, 200, "Admin account created. Please complete your profile.", {
            userId: admin._id,
        });
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
});