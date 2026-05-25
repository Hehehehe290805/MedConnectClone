import multer from "multer";
import QrCode from "qrcode-reader";
import QRCode from "qrcode";
import { Jimp } from "jimp";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed!"), false);
    },
});

const decodeQR = async (buffer) => {
    const image = await Jimp.read(buffer);
    return new Promise((resolve, reject) => {
        const qr = new QrCode();
        qr.callback = (err, value) => {
            if (err) return reject(err);
            resolve(value?.result || null);
        };
        qr.decode(image.bitmap);
    });
};

export const uploadGCashQR = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!req.file) return sendError(res, 400, "No file uploaded");

    const qrData = await decodeQR(req.file.buffer);
    if (!qrData) return sendError(res, 400, "Invalid QR code.");

    const { accountName, accountNumber } = req.body;
    if (!accountName || !accountNumber) return sendError(res, 400, "Account name and number are required.");

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: { "gcash.qrData": qrData, "gcash.accountName": accountName, "gcash.accountNumber": accountNumber } },
        { new: true }
    );

    return sendSuccess(res, 200, "GCash QR uploaded successfully.", { gcash: user.gcash });
});

export const getGCashInfo = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("gcash");
    if (!user) return sendError(res, 404, "User not found");
    return sendSuccess(res, 200, "GCash info fetched", { gcash: user.gcash });
});

export const getGCashQR = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select("gcash role firstName lastName facilityName");
    if (!user) return sendError(res, 404, "User not found");

    const allowedRoles = ["user", "doctor", "pharmacist", "institute"];
    if (!allowedRoles.includes(user.role)) return sendError(res, 403, "This user doesn't have a GCash QR");
    if (!user.gcash?.qrData) return sendError(res, 404, "No GCash QR found for this user");

    const dataUrl = await QRCode.toDataURL(user.gcash.qrData);
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const qrBuffer = Buffer.from(base64Data, "base64");
    const displayName = user.facilityName || `${user.firstName} ${user.lastName}`;

    res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": qrBuffer.length,
        "X-User-Name": displayName,
        "X-User-Role": user.role,
    });
    res.end(qrBuffer);
});