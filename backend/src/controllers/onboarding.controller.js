import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";

// ✅ Define required fields per role
const roleFieldMap = {
    user: ["firstName", 
        "lastName", 
        "birthDate", 
        "sex",
        "bio", 
        "languages", 
        "location", 
        "gcash.qrData",
        "gcash.accountName",
        "gcash.accountNumber",
    ],
    doctor: [
        "firstName",
        "lastName",
        "birthDate",
        "sex",
        "bio",
        "languages",
        "location",
        "profession",
        "licenseNumber",
        "gcash.qrData",
        "gcash.accountName",
        "gcash.accountNumber",
    ],
    pharmacist: [
        "firstName",
        "lastName",
        "birthDate",
        "bio",
        "languages",
        "location",
        "licenseNumber",
        "gcash.qrData",
        "gcash.accountName",
        "gcash.accountNumber",
    ],
    institute: [
        "facilityName",
        "bio",
        "languages",
        "location",
        "gcash.qrData",
        "gcash.accountName",
        "gcash.accountNumber",
    ],
    admin: ["firstName", "lastName", "birthDate", "bio", "languages", "location", "adminCode"],
};

// ✅ Helper to check nested required fields
function getMissingFields(role, body) {
    const required = roleFieldMap[role] || [];
    const missing = [];

    required.forEach((field) => {
        const parts = field.split(".");
        let value = body;
        for (const p of parts) {
            value = value?.[p];
        }
        if (!value) missing.push(field);
    });

    return missing;
}

// ✅ Common onboarding helper
async function onboardHelper(req, res, role, status = "pending", extraFields = {}) {
    const userId = req.user._id;
    const existingUser = await User.findById(userId).select("status");
    if (!existingUser) return res.status(404).json({ message: "User not found" });

    if (existingUser.status === "onBoarded" || existingUser.status === "pending") {
        return res.status(400).json({ message: "User is already onboarded or has a pending request" });
    }

    const missingFields = getMissingFields(role, req.body);
    if (missingFields.length > 0) {
        return res.status(400).json({ message: "All fields are required", missingFields });
    }

    const updateData = { ...req.body, status, role, ...extraFields };

    // 🩺 Auto set pharmacist profession
    if (role === "pharmacist") {
        updateData.profession = "Pharmacist";
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    try {
        await upsertStreamUser({
            id: updatedUser._id.toString(),
            name: updatedUser.firstName
                ? `${updatedUser.firstName} ${updatedUser.lastName || ""}`.trim()
                : updatedUser.facilityName || "Unknown",
            image: updatedUser.profilePic || "",
        });
    } catch (streamError) {
        console.log("Stream update error:", streamError.message);
    }

    return res.status(200).json({ success: true, user: updatedUser });
}

// 🧭 Public endpoints for onboarding
export async function onboard(req, res) {
    return onboardHelper(req, res, "user", "onBoarded");
}
export async function onboardAsDoctor(req, res) {
    return onboardHelper(req, res, "doctor", "pending", { profession: req.body.profession });
}
export async function onboardAsPharmacist(req, res) {
    return onboardHelper(req, res, "pharmacist", "pending");
}
export async function onboardAsInstitute(req, res) {
    return onboardHelper(req, res, "institute", "pending", { facilityName: req.body.facilityName });
}
export async function onboardAsAdmin(req, res) {
    return onboardHelper(req, res, "admin", "pending", { adminCode: req.body.adminCode });
}

export async function changeRole(req, res) {
    try {
        const userId = req.user._id;
        const { role } = req.body;

        // Check if user exists and is eligible for role change
        const existingUser = await User.findById(userId).select("role status firstName lastName birthDate bio languages location");
        if (!existingUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Only allow role change from "user" to professional roles
        if (existingUser.role !== "user") {
            return res.status(400).json({
                message: "Role change not allowed",
                details: "You can only change roles if you are currently a regular user."
            });
        }

        if (existingUser.status === "pending") {
            return res.status(400).json({ message: "You have a pending request" });
        }

        // Only validate ROLE-SPECIFIC required fields, not basic user fields
        const roleSpecificMissingFields = getRoleSpecificMissingFields(role, req.body);
        if (roleSpecificMissingFields.length > 0) {
            return res.status(400).json({
                message: "Missing required fields for this role",
                missingFields: roleSpecificMissingFields
            });
        }

        // Prepare update data
        const updateData = {
            role,
            status: "pending"
        };

        // Apply role-specific transformations
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
                // Remove first and last name for institute
                updateData.firstName = undefined;
                updateData.lastName = undefined;
                break;

            case "admin":
                updateData.adminCode = req.body.adminCode;
                break;

            default:
                return res.status(400).json({ message: "Invalid role specified" });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        );

        // Update Stream chat profile
        try {
            await upsertStreamUser({
                id: updatedUser._id.toString(),
                name: updatedUser.firstName
                    ? `${updatedUser.firstName} ${updatedUser.lastName || ""}`.trim()
                    : updatedUser.facilityName || "Unknown",
                image: updatedUser.profilePic || "",
            });
        } catch (streamError) {
            console.log("Stream update error:", streamError.message);
        }

        return res.status(200).json({
            success: true,
            message: "Role change request submitted for approval",
            user: updatedUser
        });

    } catch (error) {
        console.error("Error in changeRole controller:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Helper function that only checks role-specific fields
function getRoleSpecificMissingFields(role, body) {
    const roleSpecificFieldMap = {
        doctor: ["profession", "licenseNumber", "gcash.accountName", "gcash.accountNumber"],
        pharmacist: ["licenseNumber", "gcash.accountName", "gcash.accountNumber"],
        institute: ["facilityName", "gcash.accountName", "gcash.accountNumber"],
        admin: ["adminCode"]
    };

    const required = roleSpecificFieldMap[role] || [];
    const missing = [];

    required.forEach((field) => {
        const parts = field.split(".");
        let value = body;
        for (const p of parts) {
            value = value?.[p];
        }
        if (!value) missing.push(field);
    });

    return missing;
}