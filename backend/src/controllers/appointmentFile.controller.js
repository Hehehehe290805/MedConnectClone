import Appointment from "../models/Appointment.js";
import AppointmentFile from "../models/AppointmentFile.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { uploadToS3, deleteFromS3, getSignedFileUrl } from "../services/s3.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard limit

// Resolve the calling user's role within the appointment.
// Returns null if the user is not a participant.
function resolveParticipantRole(appointment, userId) {
    const id = userId.toString();
    if (appointment.patientId?.toString() === id) return "patient";
    if (appointment.doctorId?.toString() === id) return "doctor";
    // Departments are linked via instituteId (the department IS the service provider)
    if (appointment.instituteId?.toString() === id) return "department";
    return null;
}

// ── LIST ──────────────────────────────────────────────────────────────────────

export const listAppointmentFiles = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    const role = resolveParticipantRole(appointment, req.user._id);
    if (!role && req.user.role !== "admin") {
        return sendError(res, 403, "Not a participant of this appointment");
    }

    const files = await AppointmentFile.find({ appointmentId }).sort({ createdAt: 1 }).lean();
    return sendSuccess(res, 200, "Files fetched", { files });
});

// ── UPLOAD ────────────────────────────────────────────────────────────────────

export const uploadAppointmentFile = asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { fileType = "document", description } = req.body;

    if (!req.file) return sendError(res, 400, "No file provided");
    if (req.file.size > MAX_BYTES) return sendError(res, 400, "File exceeds the 5 MB limit");

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    const role = resolveParticipantRole(appointment, req.user._id);
    if (!role) return sendError(res, 403, "Not a participant of this appointment");

    // Determine allowed file types per role
    const allowedByRole = {
        patient: ["image", "document", "note"],
        doctor:  ["note", "image", "document"],
        department: ["lab_report", "image", "document"],
    };
    if (!allowedByRole[role]?.includes(fileType)) {
        return sendError(res, 400, `${role} accounts cannot upload fileType "${fileType}"`);
    }

    const folder = `private/appointment-files/${appointmentId}`;
    const { key } = await uploadToS3(
        req.file.buffer,
        req.file.mimetype,
        folder,
        req.user._id.toString(),
        req.file.originalname
    );

    const file = await AppointmentFile.create({
        appointmentId,
        uploadedBy: req.user._id,
        uploaderRole: role,
        fileType,
        originalName: req.file.originalname,
        s3Key: key,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        description: description?.trim() || undefined,
    });

    return sendSuccess(res, 201, "File uploaded", { file });
});

// ── ATTACH TEXT (used internally by booking for pre-consultation) ─────────────

// Accepts a plain markdown string, stores it as a .md file in S3, and creates
// the AppointmentFile record. Called from bookAppointment when preConsultationMarkdown
// is included in the request body.
export async function attachTextFile({ appointmentId, uploaderRole, uploadedBy, content, filename, fileType }) {
    const buffer = Buffer.from(content, "utf-8");
    const folder = `private/appointment-files/${appointmentId}`;
    const { key } = await uploadToS3(buffer, "text/markdown", folder, uploadedBy.toString(), filename);

    return AppointmentFile.create({
        appointmentId,
        uploadedBy,
        uploaderRole,
        fileType,
        originalName: filename,
        s3Key: key,
        mimeType: "text/markdown",
        sizeBytes: buffer.byteLength,
    });
}

// ── SIGNED URL ────────────────────────────────────────────────────────────────

export const getAppointmentFileUrl = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    const file = await AppointmentFile.findById(fileId);
    if (!file) return sendError(res, 404, "File not found");

    const appointment = await Appointment.findById(file.appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    const role = resolveParticipantRole(appointment, req.user._id);
    if (!role && req.user.role !== "admin") {
        return sendError(res, 403, "Not a participant of this appointment");
    }

    const url = await getSignedFileUrl(file.s3Key);
    return sendSuccess(res, 200, "Signed URL generated", { url, file });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

export const deleteAppointmentFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;

    const file = await AppointmentFile.findById(fileId);
    if (!file) return sendError(res, 404, "File not found");

    // Only the uploader or an admin can delete a file
    const isOwner = file.uploadedBy.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
        return sendError(res, 403, "Only the uploader or an admin can delete this file");
    }

    // Pre-consultation files are auto-generated and should not be deleted by users
    if (file.fileType === "preconsultation" && req.user.role !== "admin") {
        return sendError(res, 403, "Pre-consultation records cannot be deleted");
    }

    try { await deleteFromS3(file.s3Key); } catch { /* non-fatal */ }
    await AppointmentFile.findByIdAndDelete(fileId);

    return sendSuccess(res, 200, "File deleted");
});
