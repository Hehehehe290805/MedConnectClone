import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { uploadToS3, getSignedFileUrl } from "../services/s3.js";

const FOLDER_MAP = {
    profilePic: "public/profilepics",
    licenseImage: "private/licenses",
    legalIDImage: "private/legalids",
    businessPermit: "private/permits",
    constructionPermit: "private/permits",
    fdaLicense: "private/permits",
    pharmacistLicenseImage: "private/licenses",
    pharmacistLegalIDImage: "private/legalids",
};

export const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) return sendError(res, 400, "No file provided.");

    const { field } = req.body;
    if (!field || !FOLDER_MAP[field]) {
        return sendError(res, 400, "Invalid or missing field name.");
    }

    const folder = FOLDER_MAP[field];
    const userId = req.user._id.toString();

    const { url, key } = await uploadToS3(
        req.file.buffer,
        req.file.mimetype,
        folder,
        userId,
        req.file.originalname
    );

    return sendSuccess(res, 200, "File uploaded successfully.", { url, key });
});

export const getSignedUrlForFile = asyncHandler(async (req, res) => {
    const { key } = req.query;
    if (!key) return sendError(res, 400, "No key provided.");

    if (!key.startsWith("private/")) {
        return sendError(res, 400, "Only private files require signed URLs.");
    }

    const user = req.user;

    if (user.role !== "admin" && !key.includes(user._id.toString())) {
        return sendError(res, 403, "Access denied.");
    }

    const signedUrl = await getSignedFileUrl(key);
    return sendSuccess(res, 200, "Signed URL generated.", { signedUrl });
});