import express from "express";
import { getAnalytics } from "../controllers/analytics.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminsOnly.middleware.js";

const router = express.Router();

router.use(protectRoute, adminOnly);

router.get("/", getAnalytics);

export default router;
