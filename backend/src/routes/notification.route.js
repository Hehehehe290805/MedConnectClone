import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
    getNotifications,
    getUnreadCount,
    markOneRead,
    markAllRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/",              getNotifications);
router.get("/unread-count",  getUnreadCount);
router.patch("/:id/read",    markOneRead);
router.patch("/read-all",    markAllRead);

export default router;
