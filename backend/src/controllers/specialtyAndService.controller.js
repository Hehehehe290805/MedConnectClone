import Doctor_Specialty from "../models/Doctor_Specialty.js";
import Institute_Service from "../models/Institute_Service.js";
import Service from "../models/Service.js";
import Specialty from "../models/Specialty.js";
import Subspecialty from "../models/Subspecialty.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

async function fetchHelper(res, type, filter = {}) {
    let Model;
    switch (type) {
        case "specialty": Model = Specialty; break;
        case "subspecialty": Model = Subspecialty; break;
        case "service": Model = Service; break;
        default: return sendError(res, 400, "Invalid type");
    }
    const items = await Model.find(filter).sort({ name: 1 });
    return sendSuccess(res, 200, `${type}s fetched`, { items });
}

export const getSpecialties = asyncHandler((req, res) =>
    fetchHelper(res, "specialty", { status: "verified" })
);

export const getSubspecialtiesBySpecialty = asyncHandler(async (req, res) => {
    const { specialtyId } = req.params;
    if (!specialtyId) return sendError(res, 400, "Specialty ID is required");
    return fetchHelper(res, "subspecialty", { rootSpecialty: specialtyId, status: "verified" });
});

export const getSpecialtyBySubspecialty = asyncHandler(async (req, res) => {
    const { subspecialtyId } = req.params;
    if (!subspecialtyId) return sendError(res, 400, "Subspecialty ID is required");

    const subspecialty = await Subspecialty.findById(subspecialtyId)
        .populate("rootSpecialty", "name")
        .lean();

    if (!subspecialty) return sendError(res, 404, "Subspecialty not found");
    if (!subspecialty.rootSpecialty) return sendError(res, 404, "Root specialty not found");

    return sendSuccess(res, 200, "Root specialty fetched", { name: subspecialty.rootSpecialty.name });
});

export const getServices = asyncHandler((req, res) => fetchHelper(res, "service"));

export const getDoctorSpecialties = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;

    const doctorSpecialties = await Doctor_Specialty.find({ doctorId })
        .populate("specialtyId", "name")
        .populate("subspecialtyId", "name rootSpecialty")
        .lean();

    const pending = [];
    const verified = [];

    doctorSpecialties.forEach((item) => {
        const mappedItem = {
            _id: item._id,
            name: item.subspecialtyId?.name || item.specialtyId?.name || "Unknown",
            type: item.claimType,
        };
        if (item.status === "pending") pending.push(mappedItem);
        else if (item.status === "verified") verified.push(mappedItem);
    });

    return sendSuccess(res, 200, "Doctor specialties fetched", { pending, verified });
});

export const suggest = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { name, type, rootSpecialtyId } = req.body;

    const validTypes = ["specialty", "subspecialty", "service"];
    if (!validTypes.includes(type)) return sendError(res, 400, "Invalid type", { validTypes });

    if (type === "subspecialty" && !rootSpecialtyId) {
        return sendError(res, 400, "Missing required fields", { missingFields: ["rootSpecialtyId"] });
    }

    let Model;
    let extra = {};

    switch (type) {
        case "specialty":
            Model = Specialty;
            break;
        case "subspecialty":
            Model = Subspecialty;
            const rootSpecialty = await Specialty.findById(rootSpecialtyId);
            if (!rootSpecialty) return sendError(res, 404, "Root specialty not found");
            extra.rootSpecialty = rootSpecialtyId;
            break;
        case "service":
            Model = Service;
            break;
    }

    const exists = await Model.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        ...(type === "subspecialty" ? { rootSpecialty: rootSpecialtyId } : {}),
    });

    if (exists) return sendError(res, 400, `${type} already exists or is pending approval`);

    const newItem = new Model({ name, status: "pending", suggestedBy: userId, ...extra });
    await newItem.save();

    return sendSuccess(res, 201, `${type.charAt(0).toUpperCase() + type.slice(1)} suggested successfully, pending admin approval`, { item: newItem });
});

export const claim = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { targetId, type, durationMinutes } = req.body;

    const validTypes = ["specialty", "subspecialty", "service"];
    if (!validTypes.includes(type)) return sendError(res, 400, "Invalid type", { validTypes });

    const user = await User.findById(userId).select("role status");
    if (!user) return sendError(res, 404, "User not found");

    const requiredRole = ["specialty", "subspecialty"].includes(type) ? "doctor" : "institute";
    if (user.role !== requiredRole) return sendError(res, 403, `Only ${requiredRole}s can claim ${type}s`);
    if (user.status !== "onBoarded") return sendError(res, 403, `Your account must be onBoarded to claim ${type}s`);

    if (type === "service" && !durationMinutes) {
        return sendError(res, 400, "durationMinutes is required for service claims");
    }

    let LinkModel;
    let TargetModel;
    const linkData = { status: "pending", approvedBy: null, claimType: type };

    if (type === "service") linkData.durationMinutes = durationMinutes;

    switch (type) {
        case "specialty":
            TargetModel = Specialty;
            LinkModel = Doctor_Specialty;
            linkData.doctorId = userId;
            linkData.specialtyId = targetId;
            linkData.subspecialtyId = null;
            break;
        case "subspecialty":
            TargetModel = Subspecialty;
            LinkModel = Doctor_Specialty;
            linkData.doctorId = userId;
            linkData.specialtyId = null;
            linkData.subspecialtyId = targetId;
            break;
        case "service":
            TargetModel = Service;
            LinkModel = Institute_Service;
            linkData.instituteId = userId;
            linkData.serviceId = targetId;
            break;
    }

    const targetExists = await TargetModel.findById(targetId);
    if (!targetExists) return sendError(res, 404, `${type} not found`);
    if (targetExists.status !== "verified") return sendError(res, 400, `Cannot claim ${type} that is not verified`);

    let existingLink;
    if (type === "service") {
        existingLink = await LinkModel.findOne({ instituteId: userId, serviceId: targetId });
    } else {
        const query = { doctorId: userId };
        if (type === "specialty") query.specialtyId = targetId;
        else query.subspecialtyId = targetId;
        existingLink = await LinkModel.findOne(query);
    }

    if (existingLink) return sendError(res, 400, `You already claimed this ${type}`);

    const newClaim = await LinkModel.create(linkData);
    return sendSuccess(res, 201, `Successfully claimed ${type}. Waiting for admin approval.`, { item: newClaim });
});

export const autoClaimAppointmentService = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const user = await User.findById(userId).select("role status approvedBy");
    if (!user) return sendError(res, 404, "User not found");
    if (user.role !== "doctor") return sendError(res, 403, "Only doctors can auto-claim appointment service");
    if (user.status !== "onBoarded") return sendError(res, 403, "Your account must be onBoarded to claim services");

    let appointmentService = await Service.findOne({ name: "Appointment" });
    if (!appointmentService) {
        appointmentService = await Service.create({
            name: "Appointment",
            description: "Medical consultation appointment",
            status: "verified",
            category: "consultation",
            durationMinutes: 30,
        });
    }

    const existingClaim = await Institute_Service.findOne({ doctorId: userId, serviceId: appointmentService._id });
    if (existingClaim) {
        return sendSuccess(res, 200, "Appointment service already claimed", { claim: existingClaim, service: appointmentService });
    }

    const autoClaim = await Institute_Service.create({
        doctorId: userId,
        serviceId: appointmentService._id,
        status: "verified",
        approvedBy: user.approvedBy || null,
        claimType: "service",
        durationMinutes: 30,
    });

    return sendSuccess(res, 201, "Appointment service automatically claimed and verified", { claim: autoClaim, service: appointmentService });
});