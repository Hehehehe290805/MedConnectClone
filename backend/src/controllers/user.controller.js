import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

// ── BLOCK / UNBLOCK ──────────────────────────────────────────────────────────
export const blockPatient = asyncHandler(async (req, res) => {
    if (req.user.role !== "doctor") return sendError(res, 403, "Only doctors can block patients");
    const { patientId } = req.body;
    if (!patientId) return sendError(res, 400, "patientId is required");

    const patient = await User.findOne({ _id: patientId, role: "patient" });
    if (!patient) return sendError(res, 404, "Patient not found");

    const doctor = await User.findById(req.user._id);
    if (doctor.blockedPatients.some(id => id.toString() === patientId)) {
        return sendError(res, 400, "Patient is already blocked");
    }

    doctor.blockedPatients.push(patientId);
    await doctor.save();

    // Null out all reviews the patient left on this doctor
    await Appointment.updateMany(
        { doctorId: req.user._id, patientId, rating: { $exists: true, $ne: null } },
        { $unset: { rating: "", review: "" } }
    );

    return sendSuccess(res, 200, "Patient blocked and their reviews removed.");
});

export const unblockPatient = asyncHandler(async (req, res) => {
    if (req.user.role !== "doctor") return sendError(res, 403, "Only doctors can unblock patients");
    const { patientId } = req.body;
    if (!patientId) return sendError(res, 400, "patientId is required");

    const doctor = await User.findById(req.user._id);
    const before = doctor.blockedPatients.length;
    doctor.blockedPatients = doctor.blockedPatients.filter(id => id.toString() !== patientId);
    if (doctor.blockedPatients.length === before) return sendError(res, 400, "Patient is not blocked");
    await doctor.save();

    return sendSuccess(res, 200, "Patient unblocked.");
});

export const getBlockedPatients = asyncHandler(async (req, res) => {
    if (req.user.role !== "doctor") return sendError(res, 403, "Only doctors can view their blocked list");
    const doctor = await User.findById(req.user._id)
        .populate("blockedPatients", "firstName lastName profilePic")
        .lean();
    return sendSuccess(res, 200, "Blocked patients fetched", { blocked: doctor.blockedPatients || [] });
});

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
    const user = await User.findById(userId)
        .select("-password -licenseNumber")
        .populate("departmentType", "name")
        .lean();
    if (!user) return sendError(res, 404, "User not found");
    return sendSuccess(res, 200, "User fetched", user);
});
