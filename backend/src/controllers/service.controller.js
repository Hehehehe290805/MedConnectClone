import DepartmentType from "../models/DepartmentType.js";
import Service from "../models/Service.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { notifyAllAdmins } from "../services/notification.service.js";

export const getDepartmentTypes = asyncHandler(async (req, res) => {
    const items = await DepartmentType.find({ status: "verified" }).sort({ name: 1 });
    return sendSuccess(res, 200, "Department types fetched", { items });
});

export const getServicesByDepartmentType = asyncHandler(async (req, res) => {
    const { departmentTypeId } = req.params;
    if (!departmentTypeId) return sendError(res, 400, "Department type ID is required");
    const items = await Service.find({ rootDepartmentType: departmentTypeId, status: "verified" }).sort({ name: 1 });
    return sendSuccess(res, 200, "Services fetched", { items });
});

export const suggestService = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { name, type, rootDepartmentTypeId } = req.body;

    const validTypes = ["departmentType", "service"];
    if (!validTypes.includes(type)) return sendError(res, 400, "Invalid type", { validTypes });

    if (type === "service" && !rootDepartmentTypeId) {
        return sendError(res, 400, "Missing required fields", { missingFields: ["rootDepartmentTypeId"] });
    }

    let Model;
    let extra = {};

    if (type === "departmentType") {
        Model = DepartmentType;
    } else {
        Model = Service;
        const rootDepartmentType = await DepartmentType.findById(rootDepartmentTypeId);
        if (!rootDepartmentType) return sendError(res, 404, "Root department type not found");
        extra.rootDepartmentType = rootDepartmentTypeId;
    }

    const exists = await Model.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        ...(type === "service" ? { rootDepartmentType: rootDepartmentTypeId } : {}),
    });

    if (exists) return sendError(res, 400, `${type} already exists or is pending approval`);

    const newItem = new Model({ name, status: "pending", suggestedBy: userId, ...extra });
    await newItem.save();

    return sendSuccess(res, 201, `${type.charAt(0).toUpperCase() + type.slice(1)} suggested successfully`, { item: newItem });
});

export const getMyDepartmentServices = asyncHandler(async (req, res) => {
    const claims = await InstituteDepartmentService.find({ departmentId: req.user._id })
        .populate("serviceId", "name");
    return sendSuccess(res, 200, "Services fetched", { services: claims });
});

export const getDepartmentPublicServices = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    if (!departmentId) return sendError(res, 400, "departmentId is required");
    const claims = await InstituteDepartmentService.find({ departmentId, status: "verified" })
        .populate("serviceId", "name")
        .select("serviceId durationMinutes maxPatientsPerDay price");
    return sendSuccess(res, 200, "Services fetched", { services: claims });
});

export const claimService = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { targetId, durationMinutes, maxPatientsPerDay, price } = req.body;

    if (!durationMinutes) return sendError(res, 400, "durationMinutes is required");

    const service = await Service.findById(targetId);
    if (!service) return sendError(res, 404, "Service not found");
    if (service.status !== "verified") return sendError(res, 400, "Cannot claim a service that is not verified");

    const existing = await InstituteDepartmentService.findOne({ departmentId: userId, serviceId: targetId });
    if (existing) return sendError(res, 400, "You already claimed this service");

    const newClaim = await InstituteDepartmentService.create({
        departmentId: userId,
        serviceId: targetId,
        claimType: "service",
        durationMinutes,
        ...(maxPatientsPerDay ? { maxPatientsPerDay: parseInt(maxPatientsPerDay) } : {}),
        ...(price ? { price: parseFloat(price) } : {}),
        status: "pending",
    });

    try {
        await notifyAllAdmins("new_account_pending", "New Service Claim",
            `A department has submitted a service claim for "${service.name}" — pending review.`);
    } catch { /* non-fatal */ }

    return sendSuccess(res, 201, "Service claimed successfully. Waiting for admin approval.", { item: newClaim });
});

export const deleteServiceClaim = asyncHandler(async (req, res) => {
    const departmentId = req.user._id;
    const { claimId } = req.params;

    const claim = await InstituteDepartmentService.findOne({ _id: claimId, departmentId });
    if (!claim) return sendError(res, 404, "Claim not found");

    await claim.deleteOne();
    return sendSuccess(res, 200, "Claim removed");
});