import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getStreamToken, translateMessage, getAppointmentChatAttachments } from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/token",                   protectRoute, getStreamToken);
router.post("/translate",              protectRoute, translateMessage);
router.get("/appointment-attachments", protectRoute, getAppointmentChatAttachments);

export default router;