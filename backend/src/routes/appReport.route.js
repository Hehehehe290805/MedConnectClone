import express from "express";
import { fileAppReport, getAllAppReports, updateAppReportStatus } from "../controllers/appReport.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminsOnly.middleware.js";

const router = express.Router();

// Any authenticated user can file an app report
router.post("/", protectRoute, fileAppReport);

// Admin-only: list and update app reports
router.get("/", protectRoute, adminOnly, getAllAppReports);
router.patch("/:reportId/status", protectRoute, adminOnly, updateAppReportStatus);

export default router;
