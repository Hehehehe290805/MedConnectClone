import express from "express";
import multer from "multer";
import { uploadFile, getSignedUrlForFile } from "../controllers/upload.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// multer — memory storage, 5MB limit, images only
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed."), false);
        }
        cb(null, true);
    },
});

router.post("/", protectRoute, upload.single("file"), uploadFile);
router.get("/signed-url", protectRoute, getSignedUrlForFile);

export default router;