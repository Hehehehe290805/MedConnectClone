import mongoose from "mongoose";
import User, { Patient, Doctor, Pharmacy } from "../models/User.js";
import Admin from "../models/Admin.js";
import EmailRegistry from "../models/EmailRegistry.js";
import { upsertStreamUser } from "../lib/stream.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

// Promotes a base User doc to a discriminator model by deleting and recreating
// with the same _id. EmailRegistry is untouched — ref stays valid.
async function promoteUser(userId, TargetModel, fields, session, registrantModel = "User") {
    await User.deleteOne({ _id: userId }, { session });

    const doc = new TargetModel({ _id: userId, ...fields });
    // password is already hashed — prevent validator and pre-save hook from re-processing it
    doc.$set("password", fields.password);
    doc.unmarkModified("password");

    await doc.save({ session });

    await EmailRegistry.findOneAndUpdate(
        { email: fields.email },
        { registrantModel },
        { session }
    );
    return doc;
}

const streamUpsert = async (user) => {
    try {
        const name = user.firstName
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : user.pharmacyName || "Unknown";
        await upsertStreamUser({
            id: user._id.toString(),
            name,
            image: user.profilePic?.url || "",
        });
    } catch (err) {
        // non-fatal — log and continue
        console.error("Stream upsert error:", err.message);
    }
};

export const onboardAsPatient = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await User.findById(userId).select("status role email password");
    if (!existing) return sendError(res, 404, "User not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "User is already onboarded or pending");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role");

    const {
        firstName, lastName, birthDate, sex, bio,
        profilePic, languages, address, phoneNumber, phoneType,
    } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const promoted = await promoteUser(userId, Patient, {
            email: existing.email,
            password: existing.password,
            role: "patient",
            status: "onBoarded",
            firstName,
            lastName,
            birthDate,
            sex,
            bio,
            profilePic,
            languages,
            address,
            phoneNumber,
            phoneType,
        }, session);

        await session.commitTransaction();
        await streamUpsert(promoted);

        return sendSuccess(res, 200, "Onboarding successful", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsDoctor = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await User.findById(userId).select("status role email password");
    if (!existing) return sendError(res, 404, "User not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "User is already onboarded or pending");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role");

    const {
        firstName, lastName, birthDate, sex, bio,
        profilePic, languages, address, phoneNumber, phoneType,
        specialty, subSpecialty,
        licenseNumber, licenseExpiration, licenseImage, legalIDImage,
    } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const promoted = await promoteUser(userId, Doctor, {
            email: existing.email,
            password: existing.password,
            role: "doctor",
            status: "pending",
            firstName,
            lastName,
            birthDate,
            sex,
            bio,
            profilePic,
            languages,
            address,
            phoneNumber,
            phoneType,
            specialty,
            subSpecialty: subSpecialty || [],
            licenseNumber,
            licenseExpiration,
            licenseImage,
            legalIDImage,
        }, session);

        await session.commitTransaction();
        await streamUpsert(promoted);

        return sendSuccess(res, 200, "Onboarding submitted for approval", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsPharmacy = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await User.findById(userId).select("status role email password");
    if (!existing) return sendError(res, 404, "User not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "User is already onboarded or pending");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role");

    const {
        pharmacyName, pharmacistFirstName, pharmacistLastName,
        birthDate, sex, bio, profilePic, address, phoneNumber, phoneType,
        businessPermit, businessPermitExpiration, fdaLicense, fdaLicenseExpiration,
        pharmacistLicenseNumber, pharmacistLicenseExpiration,
        pharmacistLicenseImage, pharmacistLegalIDImage,
    } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const promoted = await promoteUser(userId, Pharmacy, {
            email: existing.email,
            password: existing.password,
            role: "pharmacy",
            status: "pending",
            pharmacyName,
            pharmacistFirstName,
            pharmacistLastName,
            birthDate,
            sex,
            bio,
            profilePic,
            address,
            phoneNumber,
            phoneType,
            businessPermit,
            businessPermitExpiration,
            fdaLicense,
            fdaLicenseExpiration,
            pharmacistLicenseNumber,
            pharmacistLicenseExpiration,
            pharmacistLicenseImage,
            pharmacistLegalIDImage,
        }, session);

        await session.commitTransaction();
        await streamUpsert(promoted);

        return sendSuccess(res, 200, "Onboarding submitted for approval", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsAdmin = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // admin doc created at signup — just update personal fields
    const existing = await Admin.findById(userId).select("status");
    if (!existing) return sendError(res, 404, "Admin account not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "Account is already onboarded or pending");

    const { firstName, lastName, phoneNumber, phoneType, profilePic } = req.body;

    const updated = await Admin.findByIdAndUpdate(
        userId,
        { firstName, lastName, phoneNumber, phoneType, profilePic, status: "pending" },
        { new: true, runValidators: true }
    ).select("-password");

    return sendSuccess(res, 200, "Admin onboarding submitted for approval", { user: updated });
});