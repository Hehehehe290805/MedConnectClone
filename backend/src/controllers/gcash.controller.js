import multer from "multer";
import QrCode from "qrcode-reader";
import QRCode from "qrcode";
import { Jimp } from "jimp";
import User from "../models/User.js";

// Configure Multer with MEMORY storage (no file saving)
const storage = multer.memoryStorage(); // This keeps file in memory only

// Create multer instance with proper configuration
export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check if the file is an image
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// decode QR from memory buffer
const decodeQR = async (buffer) => {
    const image = await Jimp.read(buffer);

    return new Promise((resolve, reject) => {
        const qr = new QrCode(); // ✅ correct constructor from "qrcode-reader"
        qr.callback = (err, value) => {
            if (err) return reject(err);
            resolve(value?.result || null);
        };
        qr.decode(image.bitmap);
    });
};

// 📥 Upload & extract GCash QR
export const uploadGCashQR = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const qrData = await decodeQR(req.file.buffer);

        if (!qrData) {
            return res.status(400).json({ message: "Invalid QR code." });
        }

        const { accountName, accountNumber } = req.body;

        if (!accountName || !accountNumber) {
            return res.status(400).json({ message: "Account name and number are required." });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    "gcash.qrData": qrData,
                    "gcash.accountName": accountName,
                    "gcash.accountNumber": accountNumber,
                },
            },
            { new: true }
        );

        res.json({
            message: "GCash QR uploaded successfully.",
            gcash: user.gcash,
        });

    } catch (error) {
        console.error("10. GCash upload error:", error);
        // Make sure to return JSON even for errors
        res.status(500).json({ message: "Server error uploading GCash QR." });
    }
};

// 📤 GET user GCash info
export const getGCashInfo = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("gcash");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ gcash: user.gcash });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch GCash info" });
    }
};

export const getGCashQR = async (req, res) => {

    try {
        const { userId } = req.params; // Get the target user ID from URL params

        // Find the target user (doctor, pharmacist, or institute)
        const user = await User.findById(userId).select("gcash role firstName lastName facilityName");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const allowedRoles = ["user", "doctor", "pharmacist", "institute"];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "This user doesn't have a GCash QR" });
        }

        if (!user.gcash || !user.gcash.qrData) {
            return res.status(404).json({ message: "No GCash QR found for this user" });
        }

        const qrString = user.gcash.qrData;

        // Generate QR code image from the stored string
        const dataUrl = await QRCode.toDataURL(qrString);

        // Extract base64 part
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

        // Convert to buffer
        const qrBuffer = Buffer.from(base64Data, "base64");

        // Get user display name for potential use
        const displayName = user.facilityName || `${user.firstName} ${user.lastName}`;

        // Send as image with optional headers
        res.writeHead(200, {
            "Content-Type": "image/png",
            "Content-Length": qrBuffer.length,
            "X-User-Name": displayName, // Optional: send user info in headers
            "X-User-Role": user.role
        });
        res.end(qrBuffer);

    } catch (error) {
        console.error("Error generating QR code:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};