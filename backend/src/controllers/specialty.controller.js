import DoctorSpecialty from "../models/DoctorSpecialty.js";
import Specialty from "../models/Specialty.js";
import Subspecialty from "../models/Subspecialty.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getSpecialties = asyncHandler(async (req, res) => {
    const items = await Specialty.find({ status: { $in: ["verified", "pending"] } }).sort({ name: 1 });
    return sendSuccess(res, 200, "Specialties fetched", { items });
});

export const getSubspecialtiesBySpecialty = asyncHandler(async (req, res) => {
    const { specialtyId } = req.params;
    if (!specialtyId) return sendError(res, 400, "Specialty ID is required");
    const items = await Subspecialty.find({ rootSpecialty: specialtyId, status: { $in: ["verified", "pending"] } }).sort({ name: 1 });
    return sendSuccess(res, 200, "Subspecialties fetched", { items });
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

export const getDoctorSpecialties = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;

    const doctorSpecialties = await DoctorSpecialty.find({ doctorId })
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

// Returns verified specialties for any doctor — used by profile pages
export const getDoctorSpecialtiesById = asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    if (!doctorId) return sendError(res, 400, "Doctor ID is required");

    const items = await DoctorSpecialty.find({ doctorId, status: "verified" })
        .populate("specialtyId", "name")
        .populate("subspecialtyId", "name")
        .lean();

    const specialties = items.map((item) => ({
        _id: item._id,
        name: item.subspecialtyId?.name || item.specialtyId?.name || "Unknown",
        type: item.claimType,
    }));

    return sendSuccess(res, 200, "Doctor specialties fetched", { specialties });
});

export const suggestSpecialty = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { name, type, rootSpecialtyId } = req.body;

    const validTypes = ["specialty", "subspecialty"];
    if (!validTypes.includes(type)) return sendError(res, 400, "Invalid type", { validTypes });

    if (type === "subspecialty" && !rootSpecialtyId) {
        return sendError(res, 400, "Missing required fields", { missingFields: ["rootSpecialtyId"] });
    }

    let Model;
    let extra = {};

    if (type === "specialty") {
        Model = Specialty;
    } else {
        Model = Subspecialty;
        const rootSpecialty = await Specialty.findById(rootSpecialtyId);
        if (!rootSpecialty) return sendError(res, 404, "Root specialty not found");
        extra.rootSpecialty = rootSpecialtyId;
    }

    const exists = await Model.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        ...(type === "subspecialty" ? { rootSpecialty: rootSpecialtyId } : {}),
    });

    if (exists) return sendError(res, 400, `${type} already exists or is pending approval`);

    const newItem = new Model({ name, status: "pending", suggestedBy: userId, ...extra });
    await newItem.save();

    return sendSuccess(res, 201, `${type.charAt(0).toUpperCase() + type.slice(1)} suggested successfully`, { item: newItem });
});

export const claimSpecialty = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { targetId, type } = req.body;

    const validTypes = ["specialty", "subspecialty"];
    if (!validTypes.includes(type)) return sendError(res, 400, "Invalid type", { validTypes });

    const TargetModel = type === "specialty" ? Specialty : Subspecialty;
    const target = await TargetModel.findById(targetId);
    if (!target) return sendError(res, 404, `${type} not found`);
    if (target.status !== "verified") return sendError(res, 400, `Cannot claim ${type} that is not verified`);

    const query = { doctorId: userId };
    if (type === "specialty") query.specialtyId = targetId;
    else query.subspecialtyId = targetId;

    const existingLink = await DoctorSpecialty.findOne(query);
    if (existingLink) return sendError(res, 400, `You already claimed this ${type}`);

    const newClaim = await DoctorSpecialty.create({
        doctorId: userId,
        status: "pending",
        claimType: type,
        ...(type === "specialty" ? { specialtyId: targetId, subspecialtyId: null } : { subspecialtyId: targetId, specialtyId: null }),
    });

    return sendSuccess(res, 201, `Successfully claimed ${type}. Waiting for admin approval.`, { item: newClaim });
});

export const deleteSpecialtyClaim = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { claimId } = req.params;

    const claim = await DoctorSpecialty.findOne({ _id: claimId, doctorId });
    if (!claim) return sendError(res, 404, "Claim not found");

    // Guard: must keep at least one verified specialty
    if (claim.claimType === "specialty" && claim.status === "verified") {
        const verifiedSpecialtyCount = await DoctorSpecialty.countDocuments({
            doctorId,
            claimType: "specialty",
            status: "verified",
        });
        if (verifiedSpecialtyCount <= 1) {
            return sendError(res, 400, "You must keep at least one verified specialty.");
        }
    }

    await claim.deleteOne();
    return sendSuccess(res, 200, "Claim removed");
});