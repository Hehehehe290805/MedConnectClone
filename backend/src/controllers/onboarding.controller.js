import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

const roleFieldMap = {
    user: ["firstName", "lastName", "birthDate", "sex", "bio", "languages", "location", "gcash.qrData", "gcash.accountName", "gcash.accountNumber"],
    doctor: ["firstName", "lastName", "birthDate", "sex", "bio", "languages", "location", "profession", "licenseNumber", "gcash.qrData", "gcash.accountName", "gcash.accountNumber"],
    pharmacist: ["firstName", "lastName", "birthDate", "bio", "languages", "location", "licenseNumber", "gcash.qrData", "gcash.accountName", "gcash.accountNumber"],
    institute: ["facilityName", "bio", "languages", "location", "gcash.qrData", "gcash.accountName", "gcash.accountNumber"],
    admin: ["firstName", "lastName", "birthDate", "bio", "languages", "location", "adminCode"],
};

function getMissingFields(role, body) {
    const required = roleFieldMap[role] || [];
    return required.filter((field) => {
        const parts = field.split(".");
        let value = body;
        for (const p of parts) value = value?.[p];
        return !value;
    });
}

const streamUpsert = async (user) => {
    try {
        await upsertStreamUser({
            id: user._id.toString(),
            name: user.firstName
                ? `${user.firstName} ${user.lastName || ""}`.trim()
                : user.facilityName || "Unknown",
            image: user.profilePic || "",
        });
    } catch (err) {
        console.log("Stream update error:", err.message);
    }
};

async function onboardHelper(req, res, role, status = "pending", extraFields = {}) {
    const userId = req.user._id;
    const existingUser = await User.findById(userId).select("status");
    if (!existingUser) return sendError(res, 404, "User not found");

    if (["onBoarded", "pending"].includes(existingUser.status)) {
        return sendError(res, 400, "User is already onboarded or has a pending request");
    }

    const missingFields = getMissingFields(role, req.body);
    if (missingFields.length > 0) {
        return sendError(res, 400, "All fields are required", { missingFields });
    }

    const updateData = { ...req.body, status, role, ...extraFields };
    if (role === "pharmacist") updateData.profession = "Pharmacist";

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) return sendError(res, 404, "User not found");

    await streamUpsert(updatedUser);
    return sendSuccess(res, 200, "Onboarding successful", { user: updatedUser });
}

export const onboard = asyncHandler((req, res) => onboardHelper(req, res, "user", "onBoarded"));
export const onboardAsDoctor = asyncHandler((req, res) => onboardHelper(req, res, "doctor", "pending", { profession: req.body.profession }));
export const onboardAsPharmacist = asyncHandler((req, res) => onboardHelper(req, res, "pharmacist", "pending"));
export const onboardAsInstitute = asyncHandler((req, res) => onboardHelper(req, res, "institute", "pending", { facilityName: req.body.facilityName }));
export const onboardAsAdmin = asyncHandler((req, res) => onboardHelper(req, res, "admin", "pending", { adminCode: req.body.adminCode }));

const roleSpecificFieldMap = {
    doctor: ["profession", "licenseNumber", "gcash.accountName", "gcash.accountNumber"],
    pharmacist: ["licenseNumber", "gcash.accountName", "gcash.accountNumber"],
    institute: ["facilityName", "gcash.accountName", "gcash.accountNumber"],
    admin: ["adminCode"],
};

function getRoleSpecificMissingFields(role, body) {
    const required = roleSpecificFieldMap[role] || [];
    return required.filter((field) => {
        const parts = field.split(".");
        let value = body;
        for (const p of parts) value = value?.[p];
        return !value;
    });
}

export const changeRole = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { role } = req.body;

    const existingUser = await User.findById(userId).select("role status");
    if (!existingUser) return sendError(res, 404, "User not found");

    if (existingUser.role !== "user") {
        return sendError(res, 400, "Role change only allowed from regular user");
    }
    if (existingUser.status === "pending") {
        return sendError(res, 400, "You have a pending request");
    }

    const missingFields = getRoleSpecificMissingFields(role, req.body);
    if (missingFields.length > 0) {
        return sendError(res, 400, "Missing required fields for this role", { missingFields });
    }

    const updateData = { role, status: "pending" };

    switch (role) {
        case "doctor":
            updateData.profession = req.body.profession;
            updateData.licenseNumber = req.body.licenseNumber;
            updateData.gcash = req.body.gcash;
            break;
        case "pharmacist":
            updateData.profession = "Pharmacist";
            updateData.licenseNumber = req.body.licenseNumber;
            updateData.gcash = req.body.gcash;
            break;
        case "institute":
            updateData.facilityName = req.body.facilityName;
            updateData.gcash = req.body.gcash;
            updateData.firstName = undefined;
            updateData.lastName = undefined;
            break;
        case "admin":
            updateData.adminCode = req.body.adminCode;
            break;
        default:
            return sendError(res, 400, "Invalid role specified");
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
    await streamUpsert(updatedUser);

    return sendSuccess(res, 200, "Role change request submitted for approval", { user: updatedUser });
});