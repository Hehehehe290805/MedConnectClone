import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { chatbotMessage } from "../controllers/chatbot.controller.js";

const router = express.Router();

router.use(protectRoute);
router.post("/message", chatbotMessage);

export default router;
