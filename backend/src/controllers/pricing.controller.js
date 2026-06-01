import Doctor_Specialty from "../models/DoctorSpecialty.js";
import Institute_Service from "../models/InstituteDepartmentService.js";
import Pricing from "../models/Pricing.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const setOrUpdatePricing = asyncHandler(async (req, res) => {
    const providerId = req.user._id;
    const { price, serviceId } = req.body;

    const user = await User.findById(providerId).select("role");
    if (!user) return sendError(res, 404, "User not found");

    let targetServiceId = null;

    if (user.role === "doctor") {
        const consultationService = await Service.findOne({ name: "Appointment" });
        if (!consultationService) return sendError(res, 500, "Appointment service not found in system");
        targetServiceId = consultationService._id;

        const verifiedClaims = await Doctor_Specialty.findOne({ doctorId: providerId, status: "verified" });
        if (!verifiedClaims) return sendError(res, 403, "You need at least one verified specialty or subspecialty to set pricing");

    } else if (user.role === "institute") {
        if (!serviceId) return sendError(res, 400, "serviceId is required for institutes");
        targetServiceId = serviceId;

        const verifiedServiceClaim = await Institute_Service.findOne({
            instituteId: providerId,
            serviceId: targetServiceId,
            status: "verified",
        });
        if (!verifiedServiceClaim) return sendError(res, 403, "You can only set pricing for services you have verified claims for");

    } else {
        return sendError(res, 403, "Only doctors and institutes can set pricing");
    }

    let pricing = await Pricing.findOne({ providerId, serviceId: targetServiceId });
    if (pricing) {
        pricing.price = price;
    } else {
        pricing = new Pricing({ providerId, serviceId: targetServiceId, price });
    }
    await pricing.save();

    return sendSuccess(res, 200, "Pricing set/updated successfully", { pricing });
});

export const getPricing = asyncHandler(async (req, res) => {
    const { providerId, serviceId } = req.query;

    const filter = {};
    if (providerId) filter.providerId = providerId;
    if (serviceId) filter.serviceId = serviceId;

    const pricingList = await Pricing.find(filter)
        .populate("providerId", "firstName lastName profession facilityName role")
        .populate("serviceId", "name");

    return sendSuccess(res, 200, "Pricing fetched", { pricing: pricingList });
});

export const getDoctorAppointmentPrice = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;

    const appointmentService = await Service.findOne({ name: "Appointment" });
    if (!appointmentService) return sendError(res, 500, "Appointment service not found");

    const pricing = await Pricing.findOne({ providerId: doctorId, serviceId: appointmentService._id });

    return sendSuccess(res, 200, "Doctor appointment price fetched", { pricing: pricing ? [pricing] : [] });
});