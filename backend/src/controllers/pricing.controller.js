import Institute_Service from "../models/InstituteDepartmentService.js";
import Pricing from "../models/Pricing.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const setOrUpdatePricing = asyncHandler(async (req, res) => {
    const providerId = req.user._id;
    const { price, serviceId } = req.body;

    const user = await User.findById(providerId).select("role");
    if (!user) return sendError(res, 404, "User not found");

    if (user.role === "doctor") {
        let pricing = await Pricing.findOne({ providerId, serviceId: null });
        if (pricing) {
            pricing.price = price;
        } else {
            pricing = new Pricing({ providerId, price });
        }
        await pricing.save();
        return sendSuccess(res, 200, "Pricing set/updated successfully", { pricing });

    } else if (user.role === "institute") {
        if (!serviceId) return sendError(res, 400, "serviceId is required for institutes");

        const verifiedServiceClaim = await Institute_Service.findOne({
            instituteId: providerId,
            serviceId,
            status: "verified",
        });
        if (!verifiedServiceClaim) return sendError(res, 403, "You can only set pricing for services you have verified claims for");

        let pricing = await Pricing.findOne({ providerId, serviceId });
        if (pricing) {
            pricing.price = price;
        } else {
            pricing = new Pricing({ providerId, serviceId, price });
        }
        await pricing.save();
        return sendSuccess(res, 200, "Pricing set/updated successfully", { pricing });

    } else {
        return sendError(res, 403, "Only doctors and institutes can set pricing");
    }
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
    const pricing = await Pricing.findOne({ providerId: doctorId, serviceId: null });
    return sendSuccess(res, 200, "Doctor appointment price fetched", { pricing: pricing ? [pricing] : [] });
});