import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getDoctors = asyncHandler(async (req, res) => {
    const doctors = await User.find({ status: "onBoarded", role: "doctor" })
        .select("-password -licenseNumber")
        .lean();
    return sendSuccess(res, 200, "Doctors fetched", { data: doctors });
});

export const getInstitutes = asyncHandler(async (req, res) => {
    const institutes = await User.find({ status: "onBoarded", role: "institute" })
        .select("-password")
        .lean();
    return sendSuccess(res, 200, "Institutes fetched", { data: institutes });
});

export const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password -licenseNumber").lean();
    if (!user) return sendError(res, 404, "User not found");
    return sendSuccess(res, 200, "User fetched", user);
});
