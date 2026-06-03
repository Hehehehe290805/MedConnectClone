import express from "express";
import multer from "multer";
import {
    listAppointmentFiles,
    uploadAppointmentFile,
    getAppointmentFileUrl,
    deleteAppointmentFile,
} from "../controllers/appointmentFile.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Files are received in memory and passed to S3 — no disk writes
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — also enforced in controller
    fileFilter: (req, file, cb) => {
        const allowed = [
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "application/pdf",
            "text/plain", "text/markdown",
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Unsupported file type. Allowed: images, PDF, text, markdown."), false);
        }
    },
});

router.use(protectRoute);

// Specific literal-segment routes must come before param routes or Express
// will match the param route first (e.g. /signed/<id> → /:appointmentId).
router.get("/signed/:fileId",             getAppointmentFileUrl);
router.delete("/file/:fileId",            deleteAppointmentFile);

router.get("/:appointmentId",             listAppointmentFiles);
router.post("/:appointmentId", upload.single("file"), uploadAppointmentFile);

export default router;
