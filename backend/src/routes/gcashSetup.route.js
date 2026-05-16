import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
    upload,
    uploadGCashQR, getGCashInfo, getGCashQR
} from "../controllers/gcash.controller.js";

const router = express.Router();

// 📥 Upload & extract GCash QR — only authenticated users
router.post("/gcash/upload", protectRoute, upload.single("file"), uploadGCashQR);
router.get("/gcash/qr/:userId", getGCashQR);

// 📤 Get user GCash info
router.get("/gcash", protectRoute, getGCashInfo);

export default router;
