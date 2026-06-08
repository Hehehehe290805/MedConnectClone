import mongoose from "mongoose";
import User, { Patient, Doctor, Pharmacy, Institute, Department } from "../models/User.js";
import Admin from "../models/Admin.js";
import AccountRegistry from "../models/AccountRegistry.js";
import DepartmentType from "../models/DepartmentType.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
import { upsertStreamUser } from "../lib/stream.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { normalizePhone } from "../utils/validation.js";
import { notify, notifyAllAdmins } from "../services/notification.service.js";
import { deleteFromS3 } from "../services/s3.js";

async function checkAndRegisterPhone(phone, userId, session, registrantModel = "User") {
    const normalized = normalizePhone(phone);
    if (!normalized) return;

    try {
        const result = await AccountRegistry.findOneAndUpdate(
            { type: "phone", value: normalized },
            { $setOnInsert: { type: "phone", value: normalized, registrant: userId, registrantModel } },
            { upsert: true, new: true, returnDocument: "after", session }
        ).lean();

        if (result.registrant.toString() !== userId.toString()) {
            throw Object.assign(new Error("Phone number is already in use by another account."), { status: 400 });
        }
    } catch (err) {
        if (err.code === 11000) {
            const existing = await AccountRegistry.findOne({ type: "phone", value: normalized }).lean();
            if (existing && existing.registrant.toString() !== userId.toString()) {
                throw Object.assign(new Error("Phone number is already in use by another account."), { status: 400 });
            }
            return;
        }
        throw err;
    }
}

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Promotes a base User doc to a discriminator model by deleting and recreating
// with the same _id. AccountRegistry email entry is upserted to stay consistent.
async function promoteUser(userId, TargetModel, fields, session, registrantModel = "User") {
    await User.deleteOne({ _id: userId }, { session });

    const doc = new TargetModel({ _id: userId, ...fields });
    // password is already hashed — prevent validator and pre-save hook from re-processing it
    doc.$set("password", fields.password);
    doc.unmarkModified("password");

    await doc.save({ session });

    // Upsert email entry: update if exists (email-signup), create if new (phone-signup setting email for first time)
    if (fields.email) {
        await AccountRegistry.findOneAndUpdate(
            { type: "email", value: fields.email.toLowerCase() },
            { registrant: userId, registrantModel },
            { upsert: true, session }
        );
    }
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
    const existing = await User.findById(userId).select("status role email password signupMethod phoneNumber phoneType phoneVerified emailVerified twoFactorEnabled emailNotificationsEnabled");
    if (!existing) return sendError(res, 404, "User not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "User is already onboarded or pending");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role");

    const {
        firstName, lastName, birthDate, sex, bio,
        profilePic, languages, address, phoneNumber, phoneType,
    } = req.body;

    const isPhoneSignup = existing.signupMethod === "phone";
    const onboardingEmail = existing.email || req.body.email?.toLowerCase();
    if (!onboardingEmail) return sendError(res, 400, "Email is required");
    if (!existing.email && req.body.email) {
        const taken = await AccountRegistry.findOne({ type: "email", value: onboardingEmail });
        if (taken) return sendError(res, 400, "Email already in use by another account");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!isPhoneSignup) await checkAndRegisterPhone(phoneNumber, userId, session);

        const promoted = await promoteUser(userId, Patient, {
            email: onboardingEmail,
            password: existing.password,
            role: "patient",
            status: "onBoarded",
            signupMethod: existing.signupMethod || "email",
            phoneNumber: isPhoneSignup ? existing.phoneNumber : phoneNumber,
            phoneType: isPhoneSignup ? existing.phoneType : phoneType,
            phoneVerified: existing.phoneVerified || false,
            emailVerified: isPhoneSignup ? !!req.body.email : (existing.emailVerified ?? false),
            twoFactorEnabled: existing.twoFactorEnabled || false,
            emailNotificationsEnabled: existing.emailNotificationsEnabled ?? true,
            firstName,
            lastName,
            birthDate,
            sex,
            bio,
            profilePic,
            languages,
            address,
        }, session);

        await session.commitTransaction();
        await streamUpsert(promoted);

        return sendSuccess(res, 200, "Onboarding successful", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        if (err.status === 400) return sendError(res, 400, err.message);
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsDoctor = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await User.findById(userId).select("status role email password signupMethod phoneNumber phoneType phoneVerified emailVerified twoFactorEnabled emailNotificationsEnabled");
    if (!existing) return sendError(res, 404, "User not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "User is already onboarded or pending");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role");

    const {
        firstName, lastName, birthDate, sex, bio,
        profilePic, languages, address, phoneNumber, phoneType,
        specialty, subSpecialty,
        licenseNumber, licenseExpiration, licenseImage, legalIDImage,
    } = req.body;

    const isPhoneSignup = existing.signupMethod === "phone";
    const onboardingEmail = existing.email || req.body.email?.toLowerCase();
    if (!onboardingEmail) return sendError(res, 400, "Email is required");
    if (!existing.email && req.body.email) {
        const taken = await AccountRegistry.findOne({ type: "email", value: onboardingEmail });
        if (taken) return sendError(res, 400, "Email already in use by another account");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!isPhoneSignup) await checkAndRegisterPhone(phoneNumber, userId, session);

        const promoted = await promoteUser(userId, Doctor, {
            email: onboardingEmail,
            password: existing.password,
            role: "doctor",
            status: "pending",
            signupMethod: existing.signupMethod || "email",
            phoneNumber: isPhoneSignup ? existing.phoneNumber : phoneNumber,
            phoneType: isPhoneSignup ? existing.phoneType : phoneType,
            phoneVerified: existing.phoneVerified || false,
            emailVerified: isPhoneSignup ? !!req.body.email : (existing.emailVerified ?? false),
            twoFactorEnabled: existing.twoFactorEnabled || false,
            emailNotificationsEnabled: existing.emailNotificationsEnabled ?? true,
            firstName,
            lastName,
            birthDate,
            sex,
            bio,
            profilePic,
            languages,
            address,
            specialty,
            subSpecialty,
            licenseNumber,
            licenseExpiration,
            licenseImage,
            legalIDImage,
        }, session);

        await session.commitTransaction();
        await streamUpsert(promoted);

        // Alert admins that a new doctor account needs review
        notifyAllAdmins("new_account_pending", "New Doctor Account Pending",
            `Dr. ${promoted.firstName} ${promoted.lastName} has submitted their account for review.`
        );

        return sendSuccess(res, 200, "Onboarding submitted for approval", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        if (err.status === 400) return sendError(res, 400, err.message);
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsPharmacy = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await User.findById(userId).select("status role email password signupMethod phoneNumber phoneType phoneVerified emailVerified twoFactorEnabled emailNotificationsEnabled");
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

    const isPhoneSignup = existing.signupMethod === "phone";
    const onboardingEmail = existing.email || req.body.email?.toLowerCase();
    if (!onboardingEmail) return sendError(res, 400, "Email is required");
    if (!existing.email && req.body.email) {
        const taken = await AccountRegistry.findOne({ type: "email", value: onboardingEmail });
        if (taken) return sendError(res, 400, "Email already in use by another account");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!isPhoneSignup) await checkAndRegisterPhone(phoneNumber, userId, session);

        const promoted = await promoteUser(userId, Pharmacy, {
            email: onboardingEmail,
            password: existing.password,
            role: "pharmacy",
            status: "pending",
            signupMethod: existing.signupMethod || "email",
            phoneNumber: isPhoneSignup ? existing.phoneNumber : phoneNumber,
            phoneType: isPhoneSignup ? existing.phoneType : phoneType,
            phoneVerified: existing.phoneVerified || false,
            emailVerified: isPhoneSignup ? !!req.body.email : (existing.emailVerified ?? false),
            twoFactorEnabled: existing.twoFactorEnabled || false,
            emailNotificationsEnabled: existing.emailNotificationsEnabled ?? true,
            pharmacyName,
            pharmacistFirstName,
            pharmacistLastName,
            birthDate,
            sex,
            bio,
            profilePic,
            address,
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

        // Alert admins that a new pharmacy account needs review
        notifyAllAdmins("new_account_pending", "New Pharmacy Account Pending",
            `${promoted.pharmacyName} has submitted their account for review.`
        );

        return sendSuccess(res, 200, "Onboarding submitted for approval", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        if (err.status === 400) return sendError(res, 400, err.message);
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsInstitute = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const existing = await User.findById(userId).select("status role email password signupMethod phoneNumber phoneType phoneVerified emailVerified twoFactorEnabled emailNotificationsEnabled");
    if (!existing) return sendError(res, 404, "User not found");
    if (existing.status !== "notOnBoarded") return sendError(res, 400, "User is already onboarded or pending");
    if (existing.role !== "user") return sendError(res, 400, "Account has already been assigned a role");

    const {
        instituteName, instituteType, bio, profilePic,
        contactFirstName, contactLastName,
        phoneNumber, phoneType, address,
        departments,
        businessPermit, businessPermitExpiration,
        licensingAgency,
        constructionPermit, constructionPermitExpiration,
    } = req.body;

    // constructionPermit required for hospitals
    if (instituteType === "hospital") {
        if (!constructionPermit?.key) return sendError(res, 400, "Construction permit is required for hospitals");
        if (!constructionPermitExpiration) return sendError(res, 400, "Construction permit expiration is required for hospitals");
    }

    const isPhoneSignup = existing.signupMethod === "phone";
    const onboardingEmail = existing.email || req.body.email?.toLowerCase();
    if (!onboardingEmail) return sendError(res, 400, "Email is required");
    if (!existing.email && req.body.email) {
        const taken = await AccountRegistry.findOne({ type: "email", value: onboardingEmail });
        if (taken) return sendError(res, 400, "Email already in use by another account");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!isPhoneSignup) await checkAndRegisterPhone(phoneNumber, userId, session);

        const promoted = await promoteUser(userId, Institute, {
            email: onboardingEmail,
            password: existing.password,
            role: "institute",
            status: "pending",
            signupMethod: existing.signupMethod || "email",
            phoneNumber: isPhoneSignup ? existing.phoneNumber : phoneNumber,
            phoneType: isPhoneSignup ? existing.phoneType : phoneType,
            phoneVerified: existing.phoneVerified || false,
            emailVerified: isPhoneSignup ? !!req.body.email : (existing.emailVerified ?? false),
            twoFactorEnabled: existing.twoFactorEnabled || false,
            emailNotificationsEnabled: existing.emailNotificationsEnabled ?? true,
            instituteName,
            instituteType,
            bio,
            profilePic,
            contactFirstName,
            contactLastName,
            address,
            departments,
            businessPermit,
            businessPermitExpiration,
            licensingAgency,
            ...(instituteType === "hospital" && {
                constructionPermit,
                constructionPermitExpiration,
            }),
        }, session);

        await session.commitTransaction();
        await streamUpsert(promoted);

        // Alert admins that a new institute account needs review
        notifyAllAdmins("new_account_pending", "New Institute Account Pending",
            `${promoted.instituteName} has submitted their account for review.`
        );

        return sendSuccess(res, 200, "Onboarding submitted for approval", { user: promoted });
    } catch (err) {
        await session.abortTransaction();
        if (err.status === 400) return sendError(res, 400, err.message);
        throw err;
    } finally {
        session.endSession();
    }
});

export const onboardAsDepartment = asyncHandler(async (req, res) => {
    const instituteUser = req.user;
    if (instituteUser.role !== "institute") return sendError(res, 403, "Only institutes can create department accounts");
    if (instituteUser.status === "notOnBoarded") return sendError(res, 400, "Complete institute onboarding before creating departments");

    const {
        deptEmail, deptPassword, confirmPassword,
        technologistFirstName, technologistLastName, sex, birthDate, bio,
        profilePic, phoneNumber, phoneType, address,
        departmentTypeId, customDepartmentName,
        technologistLicenseNumber, technologistLicenseExpiration,
        technologistLicenseImage, technologistLegalIDImage,
        initialServices,
    } = req.body;

    if (deptPassword !== confirmPassword) return sendError(res, 400, "Passwords do not match");
    if (!passwordRegex.test(deptPassword)) return sendError(res, 400, "Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 symbol (@$!%*?&)");

    let finalDeptTypeId = departmentTypeId;

    if (customDepartmentName) {
        // Create a new pending DepartmentType
        let deptType = await DepartmentType.findOne({ name: { $regex: new RegExp(`^${customDepartmentName}$`, "i") } });
        if (!deptType) {
            deptType = await DepartmentType.create({
                name: customDepartmentName,
                status: "pending",
                suggestedBy: instituteUser._id,
            });
        }
        finalDeptTypeId = deptType._id.toString();

        // Add to institute's departments if not already there
        const hasCustomDept = instituteUser.departments.some((d) => d.toString() === finalDeptTypeId);
        if (!hasCustomDept) {
            await User.findByIdAndUpdate(instituteUser._id, {
                $push: { departments: finalDeptTypeId }
            });
            instituteUser.departments.push(finalDeptTypeId);
        }
    } else {
        const hasDeptType = instituteUser.departments.some((d) => d.toString() === finalDeptTypeId);
        if (!hasDeptType) return sendError(res, 400, "Department type is not in this institute's registered departments");
    }

    const existingEmail = await AccountRegistry.findOne({ type: "email", value: deptEmail?.toLowerCase() });
    if (existingEmail) return sendError(res, 400, "Email already registered");

    const deptType = await DepartmentType.findById(finalDeptTypeId);
    if (!deptType) return sendError(res, 404, "Department type not found");

    const count = await User.countDocuments({ __t: "Department", departmentType: finalDeptTypeId });
    const seq = String(count + 1).padStart(3, "0");
    const departmentId = `${seq}-${deptType.name}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const deptUser = new Department({
            email: deptEmail,
            password: deptPassword,
            role: "department",
            status: "onBoarded",
            signupMethod: "email",
            emailVerified: true,
            rootInstitute: instituteUser._id,
            departmentType: finalDeptTypeId,
            departmentId,
            technologistFirstName,
            technologistLastName,
            sex,
            birthDate,
            bio,
            profilePic,
            phoneNumber,
            phoneType,
            address,
            technologistLicenseNumber,
            technologistLicenseExpiration,
            technologistLicenseImage,
            technologistLegalIDImage,
        });
        await deptUser.save({ session });
        await checkAndRegisterPhone(phoneNumber, deptUser._id, session);

        // Create initial service claims if provided
        let claimedServiceCount = 0;
        if (Array.isArray(initialServices) && initialServices.length > 0) {
            const serviceDocs = initialServices
                .filter(s => s.serviceId && s.durationMinutes && parseInt(s.durationMinutes) > 0)
                .map(s => ({
                    departmentId: deptUser._id,
                    serviceId: s.serviceId,
                    claimType: "service",
                    durationMinutes: parseInt(s.durationMinutes),
                    status: "pending",
                }));
            if (serviceDocs.length > 0) {
                await InstituteDepartmentService.insertMany(serviceDocs, { session });
                claimedServiceCount = serviceDocs.length;
            }
        }

        await AccountRegistry.create([{
            type: "email",
            value: deptEmail.toLowerCase(),
            registrant: deptUser._id,
            registrantModel: "User",
        }], { session });

        await Institute.findByIdAndUpdate(
            instituteUser._id,
            { $push: { departmentAccounts: deptUser._id } },
            { session }
        );

        await session.commitTransaction();

        try {
            await upsertStreamUser({
                id: deptUser._id.toString(),
                name: `${technologistFirstName} ${technologistLastName}`.trim(),
                image: profilePic?.url || "",
            });
        } catch (err) {
            console.error("Stream upsert error:", err.message);
        }

        // Notify the institute owner that their new department sub-account is active
        notify(instituteUser._id, "account_approved", "Department Account Created",
            `Your department account for ${technologistFirstName} ${technologistLastName} has been created and is now active.`
        );

        // If service claims were submitted, alert admins for review
        if (claimedServiceCount > 0) {
            try {
                notifyAllAdmins("new_account_pending", "New Service Claims Pending",
                    `${technologistFirstName} ${technologistLastName}'s department submitted ${claimedServiceCount} service claim(s) for review.`
                );
            } catch { /* non-fatal */ }
        }

        return sendSuccess(res, 201, "Department account created successfully", { department: deptUser });
    } catch (err) {
        await session.abortTransaction();
        if (err.status === 400) return sendError(res, 400, err.message);
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

    try {
        await checkAndRegisterPhone(phoneNumber, userId, null, "Admin");
    } catch (err) {
        if (err.status === 400) return sendError(res, 400, err.message);
        throw err;
    }

    const updated = await Admin.findByIdAndUpdate(
        userId,
        { firstName, lastName, phoneNumber, phoneType, profilePic, status: "pending" },
        { new: true, runValidators: true }
    ).select("-password");

    // Alert existing admins that a new admin account needs peer approval
    notifyAllAdmins("new_account_pending", "New Admin Account Pending",
        `${updated.firstName} ${updated.lastName} has submitted an admin account for review.`
    );

    return sendSuccess(res, 200, "Admin onboarding submitted for approval", { user: updated });
});

export const deleteDepartmentAccount = asyncHandler(async (req, res) => {
    const instituteUser = req.user;
    if (instituteUser.role !== "institute") return sendError(res, 403, "Only institutes can delete department accounts");

    const { deptId } = req.params;

    // Verify this dept belongs to the institute
    const owned = instituteUser.departmentAccounts?.some((id) => id.toString() === deptId);
    if (!owned) return sendError(res, 403, "This department does not belong to your institute");

    const dept = await User.findById(deptId).lean();
    if (!dept) return sendError(res, 404, "Department account not found");

    // Clean up private S3 files (non-fatal)
    const s3Keys = [
        dept.technologistLicenseImage?.key,
        dept.technologistLegalIDImage?.key,
        dept.profilePic?.key,
    ].filter(Boolean);
    for (const key of s3Keys) {
        try { await deleteFromS3(key); } catch {}
    }

    // Remove all account registry entries for this department
    await AccountRegistry.deleteMany({ registrant: dept._id });

    // Delete the department user
    await User.deleteOne({ _id: deptId });

    // Pull from institute's departmentAccounts
    await Institute.findByIdAndUpdate(
        instituteUser._id,
        { $pull: { departmentAccounts: dept._id } }
    );

    return sendSuccess(res, 200, "Department account deleted successfully");
});