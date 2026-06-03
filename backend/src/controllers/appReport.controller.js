import AppReport from "../models/AppReport.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { notifyAllAdmins } from "../services/notification.service.js";

// Any authenticated user can submit a bug report or feedback
export const fileAppReport = asyncHandler(async (req, res) => {
    const { category, subject, description } = req.body;

    if (!category || !subject?.trim() || !description?.trim()) {
        return sendError(res, 400, "category, subject, and description are required");
    }

    const report = await AppReport.create({
        reporter: req.user._id,
        category,
        subject: subject.trim(),
        description: description.trim(),
    });

    // Notify all admins so the issue appears in their Reports tab immediately
    notifyAllAdmins("dispute_admin_alert", "New App Report Submitted",
        `A user submitted a ${category} report: "${subject.trim().slice(0, 60)}"`
    );

    return sendSuccess(res, 201, "Report submitted. Thank you for your feedback.", { report });
});

// Admin: fetch all app reports, newest first
export const getAllAppReports = asyncHandler(async (req, res) => {
    const reports = await AppReport.find({})
        .sort({ createdAt: -1 })
        .populate("reporter", "firstName lastName email instituteName pharmacyName role")
        .lean();
    return sendSuccess(res, 200, "App reports fetched", { reports });
});

// Admin: advance a report's status (pending → viewed → resolved)
export const updateAppReportStatus = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { status, adminNote } = req.body;

    const allowed = ["pending", "viewed", "resolved"];
    if (!allowed.includes(status)) {
        return sendError(res, 400, `status must be one of: ${allowed.join(", ")}`);
    }

    const report = await AppReport.findByIdAndUpdate(
        reportId,
        {
            status,
            ...(adminNote ? { adminNote: adminNote.trim() } : {}),
            ...(status === "resolved" ? { resolvedBy: req.user._id } : {}),
        },
        { new: true, runValidators: true }
    );

    if (!report) return sendError(res, 404, "Report not found");

    return sendSuccess(res, 200, "Report status updated", { report });
});
