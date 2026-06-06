import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { uploadToS3, getSignedFileUrl } from "../services/s3.js";
import PharmacyOrder from "../models/PharmacyOrder.js";

const FOLDER_MAP = {
    profilePic: "public/profilepics",
    licenseImage: "private/licenses",
    legalIDImage: "private/legalids",
    businessPermit: "private/permits",
    constructionPermit: "private/permits",
    fdaLicense: "private/permits",
    pharmacistLicenseImage: "private/licenses",
    pharmacistLegalIDImage: "private/legalids",
    technologistLicenseImage: "private/licenses",
    technologistLegalIDImage: "private/legalids",
    pharmacyProductImage: "public/pharmacy-products",
    prescriptionImage: "private/prescriptions",
};

export const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) return sendError(res, 400, "No file provided.");

    const { field } = req.body;
    if (!field || !FOLDER_MAP[field]) {
        return sendError(res, 400, "Invalid or missing field name.");
    }

    const folder = FOLDER_MAP[field];
    const userId = req.user._id.toString();

    let uploaded;
    try {
        uploaded = await uploadToS3(
            req.file.buffer,
            req.file.mimetype,
            folder,
            userId,
            req.file.originalname
        );
    } catch (error) {
        if (error.message?.includes("AWS_")) {
            return sendError(res, 503, "Image uploads are unavailable because backend S3 configuration is incomplete.");
        }
        throw error;
    }

    return sendSuccess(res, 200, "File uploaded successfully.", uploaded);
});

export const getSignedUrlForFile = asyncHandler(async (req, res) => {
    const { key } = req.query;
    if (!key) return sendError(res, 400, "No key provided.");

    if (!key.startsWith("private/")) {
        return sendError(res, 400, "Only private files require signed URLs.");
    }

    const user = req.user;

    let canAccess = user.role === "admin" || key.includes(user._id.toString());

    if (!canAccess && user.role === "pharmacy" && key.startsWith("private/prescriptions/")) {
        const order = await PharmacyOrder.findOne({
            pharmacyId: user._id,
            "prescriptionImage.key": key,
        }).select("_id");
        canAccess = Boolean(order);
    }

    if (!canAccess) {
        return sendError(res, 403, "Access denied.");
    }

    const signedUrl = await getSignedFileUrl(key);
    return sendSuccess(res, 200, "Signed URL generated.", { signedUrl });
});
