import User from "../models/User.js";
import PermitRenewal from "../models/PermitRenewal.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { createAndSendCode, verifyCode } from "../services/verification.js";
import { notifyAllAdmins } from "../services/notification.service.js";

const blockedFromSubmit = ["pendingRenewal", "pendingRenewalExpired", "pending"];
const canSubmit = ["onBoarded", "needsRenewal", "suspended"];

// checks all relevant expiry dates for the doc after proposed updates
// returns "pendingRenewal" if all expiries are in the future, "pendingRenewalExpired" if any have passed
function resolveNextStatus(doc, proposedUpdates) {
    const now = new Date();

    const expiryFields = [
        "licenseExpiration",
        "businessPermitExpiration",
        "fdaLicenseExpiration",
        "pharmacistLicenseExpiration",
    ];

    for (const field of expiryFields) {
        // use proposed value if being updated, otherwise use existing value on doc
        const value = proposedUpdates[field] !== undefined ? proposedUpdates[field] : doc[field];
        if (value && new Date(value) <= now) return "pendingRenewalExpired";
    }

    return "pendingRenewal";
}

export const requestDoctorLicense = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role !== "doctor") return sendError(res, 403, "Not a doctor account.");
    if (blockedFromSubmit.includes(user.status)) {
        return sendError(res, 400, "Renewal already submitted and awaiting approval.");
    }
    if (!canSubmit.includes(user.status)) {
        return sendError(res, 400, "Account is not eligible for license renewal.");
    }

    const { licenseNumber, licenseExpiration, licenseImage } = req.body;

    await createAndSendCode(user.email, "permit-renewal", {
        type: "doctor-license",
        licenseNumber, licenseExpiration, licenseImage,
    }, null, user._id);
    return sendSuccess(res, 200, "Verification code sent to your email.");
});

export const requestPharmacistLicense = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role !== "pharmacy") return sendError(res, 403, "Not a pharmacy account.");
    if (blockedFromSubmit.includes(user.status)) {
        return sendError(res, 400, "Renewal already submitted and awaiting approval.");
    }
    if (!canSubmit.includes(user.status)) {
        return sendError(res, 400, "Account is not eligible for license renewal.");
    }

    const { pharmacistLicenseNumber, pharmacistLicenseExpiration, pharmacistLicenseImage } = req.body;

    await createAndSendCode(user.email, "permit-renewal", {
        type: "pharmacy-license",
        pharmacistLicenseNumber, pharmacistLicenseExpiration, pharmacistLicenseImage,
    }, null, user._id);
    return sendSuccess(res, 200, "Verification code sent to your email.");
});

export const requestBusinessPermit = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role !== "pharmacy") return sendError(res, 403, "Not a pharmacy account.");
    if (blockedFromSubmit.includes(user.status)) {
        return sendError(res, 400, "Renewal already submitted and awaiting approval.");
    }
    if (!canSubmit.includes(user.status)) {
        return sendError(res, 400, "Account is not eligible for permit renewal.");
    }

    const { businessPermit, businessPermitExpiration } = req.body;

    await createAndSendCode(user.email, "permit-renewal", {
        type: "business-permit",
        businessPermit, businessPermitExpiration,
    }, null, user._id);
    return sendSuccess(res, 200, "Verification code sent to your email.");
});

export const requestFdaLicense = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role !== "pharmacy") return sendError(res, 403, "Not a pharmacy account.");
    if (blockedFromSubmit.includes(user.status)) {
        return sendError(res, 400, "Renewal already submitted and awaiting approval.");
    }
    if (!canSubmit.includes(user.status)) {
        return sendError(res, 400, "Account is not eligible for license renewal.");
    }

    const { fdaLicense, fdaLicenseExpiration } = req.body;

    await createAndSendCode(user.email, "permit-renewal", {
        type: "fda-license",
        fdaLicense, fdaLicenseExpiration,
    }, null, user._id);
    return sendSuccess(res, 200, "Verification code sent to your email.");
});

const permitUpdateMap = {
    "doctor-license": (payload) => ({
        licenseNumber: payload.licenseNumber,
        licenseExpiration: payload.licenseExpiration,
        licenseImage: payload.licenseImage,
    }),
    "pharmacy-license": (payload) => ({
        pharmacistLicenseNumber: payload.pharmacistLicenseNumber,
        pharmacistLicenseExpiration: payload.pharmacistLicenseExpiration,
        pharmacistLicenseImage: payload.pharmacistLicenseImage,
    }),
    "business-permit": (payload) => ({
        businessPermit: payload.businessPermit,
        businessPermitExpiration: payload.businessPermitExpiration,
    }),
    "fda-license": (payload) => ({
        fdaLicense: payload.fdaLicense,
        fdaLicenseExpiration: payload.fdaLicenseExpiration,
    }),
};

export const verifyPermitRenewal = asyncHandler(async (req, res) => {
    const { code } = req.body;
    const user = req.user;

    const record = await verifyCode(user.email, "permit-renewal", code, user._id);
    const { type, ...permitData } = record.payload;

    const buildUpdates = permitUpdateMap[type];
    if (!buildUpdates) return sendError(res, 400, "Invalid permit type in verification payload.");

    const updates = buildUpdates(permitData);

    // resolve status using all existing expiry dates + proposed update
    updates.status = resolveNextStatus(user, updates);

    const updated = await User.findByIdAndUpdate(user._id, updates, { new: true, runValidators: true })
        .select("-password");

    return sendSuccess(res, 200, "Permit renewal submitted for approval.", { user: updated });
});

// ── NEW STAGED RENEWAL ENDPOINTS ──────────────────────────────────────────

export const requestRenewal = asyncHandler(async (req, res) => {
    const user = req.user;
    const { type, newImage, newLicenseNumber, licenseCode, newExpiration } = req.body;

    if (!type || !newExpiration) return sendError(res, 400, "type and newExpiration are required");

    // block if there is already a pending renewal of this type
    const existing = await PermitRenewal.findOne({ userId: user._id, type, status: "pending" });
    if (existing) return sendError(res, 400, "A renewal request for this document is already pending approval");

    const renewal = new PermitRenewal({
        userId: user._id,
        type,
        newImage: newImage || undefined,
        newLicenseNumber: newLicenseNumber || undefined,
        licenseCode: licenseCode || undefined,
        newExpiration,
    });
    await renewal.save();

    // Alert admins that a renewal is waiting for review
    const label = type.replace(/_/g, " ");
    notifyAllAdmins("renewal_submitted", "New Renewal Request",
        `A ${label} renewal has been submitted and is awaiting your approval.`
    );

    return sendSuccess(res, 201, "Renewal request submitted", { renewal });
});

export const getMyRenewals = asyncHandler(async (req, res) => {
    const renewals = await PermitRenewal.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return sendSuccess(res, 200, "Renewals fetched", { renewals });
});