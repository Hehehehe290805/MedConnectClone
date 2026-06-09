import mongoose from "mongoose";
import Service from "../models/Service.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
import Appointment from "../models/Appointment.js";
import Transaction from "../models/Transaction.js";
import Pricing from "../models/Pricing.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import Schedule from "../models/Schedule.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { notify, notifyAllAdmins } from "../services/notification.service.js";
import { attachTextFile } from "./appointmentFile.controller.js";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Manila");

const toPhTime = (date) => dayjs(date).tz("Asia/Manila");
// 5-minute buffer between bookings gives providers a handover gap and prevents
// two appointments from colliding if one runs slightly over time.
const GAP_MINUTES = 5;

// Only these statuses block the slot — completed/cancelled/rejected do not.
const ACTIVE_STATUSES = ["pending_payment", "deposit_paid", "accepted", "ongoing"];

// Returns true when [start, end] overlaps an existing appointment (including the buffer).
// Uses dayjs for correct timezone-aware comparison across DST boundaries.
function hasOverlap(existing, start, end) {
    const gapStart = dayjs(start).subtract(GAP_MINUTES, "minute");
    const gapEnd = dayjs(end).add(GAP_MINUTES, "minute");
    return dayjs(existing.start).isBefore(gapEnd) && dayjs(existing.end).isAfter(gapStart);
}

function applyTimeToDate(date, timeStr) {
    const [hour, minute] = timeStr.split(":").map(Number);
    return dayjs(date).tz("Asia/Manila").hour(hour).minute(minute).second(0).millisecond(0);
}

// ── BOOK ──────────────────────────────────────────────────────────────────────
export const bookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, instituteId, serviceId: providedServiceId, start, preConsultationMarkdown, virtual: patientVirtual } = req.body;
    const patientId = req.user._id;
    const providerType = doctorId ? "doctor" : "institute";

    // Doctor bookings have no service — pricing is keyed by providerId + serviceId: null.
    // Institute bookings require a specific serviceId from their verified service claims.
    const serviceId = providerType === "doctor"
        ? null
        : (mongoose.Types.ObjectId.isValid(providedServiceId) ? providedServiceId : null);

    // Duration
    let durationMinutes;
    if (providerType === "doctor") {
        durationMinutes = 30;
    } else {
        const svcData = await InstituteDepartmentService.findOne({ departmentId: instituteId, serviceId });
        if (!svcData) return sendError(res, 404, "Service not found for institute.");
        durationMinutes = svcData.durationMinutes;
    }

    const startTimePH = dayjs(start).tz("Asia/Manila");
    const startTimeUTC = startTimePH.utc();
    const endTimeUTC = startTimeUTC.add(durationMinutes, "minute");

    const schedule = await Schedule.findOne({ $or: [{ doctorId }, { instituteId }] });
    if (!schedule) return sendError(res, 400, "Provider schedule not found.");

    const endTimePH = endTimeUTC.tz("Asia/Manila");
    const dayOfWeek = startTimePH.day();

    if (!schedule.daysOfWeek.includes(dayOfWeek))
        return sendError(res, 400, "Booking outside provider operating days.");

    let endHour = schedule.endHour;
    if (endHour === "24:00") endHour = "00:00";
    const dayStart = applyTimeToDate(startTimePH, schedule.startHour);
    let dayEnd = applyTimeToDate(startTimePH, endHour);
    if (endHour === "00:00") dayEnd = dayEnd.add(1, "day");

    if (startTimePH.isBefore(dayStart) || endTimePH.isAfter(dayEnd))
        return sendError(res, 400, "Booking out of operating hours.");

    // Overlap checks
    const providerAppts = await Appointment.find({
        $or: [{ doctorId }, { instituteId }],
        status: { $in: ACTIVE_STATUSES },
    });
    if (providerAppts.some((a) => hasOverlap(a, startTimeUTC, endTimeUTC)))
        return sendError(res, 400, "Timeslot already taken.");

    const patientAppts = await Appointment.find({ patientId, status: { $in: ACTIVE_STATUSES } });
    if (patientAppts.some((a) => hasOverlap(a, startTimeUTC, endTimeUTC)))
        return sendError(res, 400, "You already have a booking that overlaps.");

    // Check if the doctor has blocked this patient
    if (doctorId) {
        const doctor = await User.findById(doctorId).select("blockedPatients maxPatientsPerDay").lean();
        if (doctor?.blockedPatients?.some(id => id.toString() === patientId.toString())) {
            return sendError(res, 403, "You are unable to book with this provider.");
        }
        // Check max patients per day
        if (doctor?.maxPatientsPerDay) {
            const dayStart = toPhTime(start).startOf("day").utc().toDate();
            const dayEnd = toPhTime(start).endOf("day").utc().toDate();
            const dayCount = await Appointment.countDocuments({
                doctorId,
                status: { $in: ACTIVE_STATUSES },
                start: { $gte: dayStart, $lte: dayEnd },
            });
            if (dayCount >= doctor.maxPatientsPerDay) {
                return sendError(res, 400, "This doctor has reached their maximum patient limit for the day.");
            }
        }
    }

    let pricing = await Pricing.findOne({ providerId: doctorId || instituteId, serviceId });
    if (!pricing) {
        // For department bookings: fall back to the price stored on the service claim
        // and lazily create the missing Pricing record so future bookings skip this path
        if (providerType === "institute" && svcData?.price) {
            try {
                pricing = await Pricing.findOneAndUpdate(
                    { providerId: instituteId, serviceId },
                    { providerId: instituteId, serviceId, price: svcData.price },
                    { upsert: true, new: true }
                );
            } catch { /* non-fatal */ }
        }
        if (!pricing) return sendError(res, 400, "Pricing not found for this service. The department must set a price when claiming the service.");
    }

    const totalPrice = pricing.price;
    // Platform takes 10% of the total, collected from the 50% deposit.
    // Balance payment (virtual only) carries no additional platform fee.
    const platformFee = Math.round(totalPrice * 0.1 * 100) / 100;
    const depositAmount = Math.round(totalPrice * 0.5 * 100) / 100;
    const balanceAmount = Math.round((totalPrice - depositAmount) * 100) / 100;

    const appointment = await Appointment.create({
        doctorId: doctorId || null,
        instituteId: instituteId || null,
        patientId,
        serviceId,
        virtual: providerType === "doctor" ? (patientVirtual !== false) : false,
        start: startTimeUTC.toDate(),
        end: endTimeUTC.toDate(),
        amount: totalPrice,
        platformFee,
        depositAmount,
        balanceAmount,
        status: "pending_payment",
    });

    // Auto-attach pre-consultation wizard answers as a markdown file so the
    // doctor can review the patient's symptoms before accepting or during the session.
    if (preConsultationMarkdown?.trim()) {
        try {
            await attachTextFile({
                appointmentId: appointment._id,
                uploadedBy: patientId,
                uploaderRole: "patient",
                content: preConsultationMarkdown.trim(),
                filename: "pre-consultation.md",
                fileType: "preconsultation",
            });
        } catch (err) {
            // Non-fatal — booking succeeds even if the file attachment fails

        }
    }

    // Notify doctor/institute
    const providerId = doctorId || instituteId;
    if (providerId) {
        notify(providerId, "appointment_booked", "New Appointment Request",
            `A patient has booked an appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")}. Please wait for the patient to pay the deposit.`);
    }

    return sendSuccess(res, 201, "Appointment booked. Please proceed to pay the deposit.", {
        appointment: {
            ...appointment.toObject(),
            phTime: {
                start: toPhTime(appointment.start).format("YYYY-MM-DD HH:mm"),
                end: toPhTime(appointment.end).format("YYYY-MM-DD HH:mm"),
            },
        },
    });
});

// ── PAY DEPOSIT ───────────────────────────────────────────────────────────────
export const payDeposit = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId, referenceNumber } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "Not authorized");
    if (appointment.status !== "pending_payment") return sendError(res, 400, "Cannot pay deposit at this stage");

    appointment.depositPaid = true;
    appointment.depositRef = referenceNumber;
    appointment.status = "deposit_paid";
    await appointment.save();

    // Deposit is held by the platform until the appointment is completed or cancelled.
    // Transaction record created here for audit trail; payout to provider happens at resolution.
    const providerId = appointment.doctorId || appointment.instituteId;
    await Transaction.create({
        appointmentId: appointment._id,
        payerId: patientId,
        payeeId: providerId,
        amount: appointment.depositAmount,
        platformFee: appointment.platformFee,
        netAmount: Math.round((appointment.depositAmount - appointment.platformFee) * 100) / 100,
        type: "deposit",
        referenceNumber,
    });

    if (providerId) {
        notify(providerId, "payment_received", "Deposit Received (Held)",
            `The patient has paid the deposit (₱${appointment.depositAmount}). The deposit is held by the platform until the appointment is completed. Please accept or reject the appointment.`);
    }
    notify(patientId, "payment_received", "Deposit Confirmed",
        `Your deposit of ₱${appointment.depositAmount} has been recorded and is held by the platform. Reference: ${referenceNumber}`);

    return sendSuccess(res, 200, "Deposit paid. Awaiting provider confirmation.", { appointment });
});

// ── ACCEPT (Doctor or Institute) ─────────────────────────────────────────────
export const acceptAppointment = asyncHandler(async (req, res) => {
    const providerId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    // The provider can be a doctor (doctorId) or an institute/department (instituteId)
    const isProvider =
        appointment.doctorId?.toString() === providerId.toString() ||
        appointment.instituteId?.toString() === providerId.toString();
    if (!isProvider) return sendError(res, 403, "Not authorized");
    if (appointment.status !== "deposit_paid") return sendError(res, 400, "Appointment cannot be accepted at this stage");

    appointment.status = "accepted";
    await appointment.save();

    notify(appointment.patientId, "appointment_accepted", "Appointment Confirmed",
        `Your appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")} has been confirmed.`);

    return sendSuccess(res, 200, "Appointment accepted.", { appointment });
});

// ── REJECT (Doctor or Institute) ─────────────────────────────────────────────
export const rejectAppointment = asyncHandler(async (req, res) => {
    const providerId = req.user._id;
    const { appointmentId, reason } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    const isProvider =
        appointment.doctorId?.toString() === providerId.toString() ||
        appointment.instituteId?.toString() === providerId.toString();
    if (!isProvider) return sendError(res, 403, "Not authorized");
    if (appointment.status !== "deposit_paid") return sendError(res, 400, "Appointment cannot be rejected at this stage");

    appointment.status = "rejected";
    appointment.rejectionReason = reason || "No reason provided";
    appointment.rejectedAt = new Date();
    await appointment.save();

    // Provider rejected — full deposit refund to patient
    notify(appointment.patientId, "appointment_rejected", "Appointment Rejected — Deposit Refunded",
        `Your appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")} was rejected.${reason ? ` Reason: ${reason}` : ""} Your deposit of ₱${appointment.depositAmount} will be fully refunded.`);

    return sendSuccess(res, 200, "Appointment rejected.", { appointment });
});

// ── CANCEL (Patient) ──────────────────────────────────────────────────────────
export const cancelAppointment = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "Not authorized");
    // Patients may cancel up to and including the accepted stage; no cancellation once ongoing.
    if (!["pending_payment", "deposit_paid", "accepted"].includes(appointment.status))
        return sendError(res, 400, "Cannot cancel at this stage");

    appointment.status = "cancelled";
    await appointment.save();

    const providerId = appointment.doctorId || appointment.instituteId;
    if (appointment.depositPaid && providerId) {
        // Patient cancelled after paying deposit — deposit is forfeited to the provider
        const providerNet = Math.round((appointment.depositAmount - appointment.platformFee) * 100) / 100;
        notify(providerId, "appointment_cancelled", "Appointment Cancelled — Deposit Released",
            `The patient cancelled their appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")}. The deposit (₱${appointment.depositAmount} → ₱${providerNet} after platform fee) has been released to you.`);
        notify(patientId, "appointment_cancelled", "Appointment Cancelled",
            `Your appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")} was cancelled. Your deposit of ₱${appointment.depositAmount} is non-refundable.`);
    } else {
        if (providerId) {
            notify(providerId, "appointment_cancelled", "Appointment Cancelled",
                `The patient cancelled their appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")} before paying the deposit.`);
        }
        notify(patientId, "appointment_cancelled", "Appointment Cancelled",
            `Your appointment on ${toPhTime(appointment.start).format("MMM D, YYYY [at] h:mm A")} has been cancelled.`);
    }

    return sendSuccess(res, 200, "Appointment cancelled.", { appointment });
});

// ── COMPLETE (Either party) ───────────────────────────────────────────────────
export const completeAppointment = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    const isParticipant =
        appointment.patientId?.toString() === userId.toString() ||
        appointment.doctorId?.toString() === userId.toString() ||
        appointment.instituteId?.toString() === userId.toString();
    if (!isParticipant) return sendError(res, 403, "Not authorized");
    if (appointment.status !== "ongoing") return sendError(res, 400, "Can only complete an ongoing appointment");

    // Virtual → awaiting balance; in-person → fully paid
    appointment.status = appointment.virtual ? "awaiting_balance" : "fully_paid";
    await appointment.save();

    const providerId = appointment.doctorId || appointment.instituteId;
    notify(appointment.patientId, "appointment_completed", "Appointment Completed",
        appointment.virtual
            ? "Your appointment is complete. Please pay the remaining balance."
            : "Your appointment is complete. Thank you!");
    if (providerId) {
        notify(providerId, "appointment_completed", "Appointment Completed",
            appointment.virtual
                ? "Appointment marked complete. Waiting for patient to pay the balance."
                : "Appointment complete.");
    }

    return sendSuccess(res, 200, "Appointment marked as completed.", { appointment });
});

// ── PAY BALANCE (Patient, virtual only) ───────────────────────────────────────
export const payBalance = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId, referenceNumber } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "Not authorized");
    if (appointment.status !== "awaiting_balance") return sendError(res, 400, "Cannot pay balance at this stage");

    appointment.balancePaid = true;
    appointment.balanceRef = referenceNumber;
    appointment.status = "fully_paid";
    await appointment.save();

    const providerId = appointment.doctorId || appointment.instituteId;
    await Transaction.create({
        appointmentId: appointment._id,
        payerId: patientId,
        payeeId: providerId,
        amount: appointment.balanceAmount,
        platformFee: 0,  // platform fee already taken from deposit
        netAmount: appointment.balanceAmount,
        type: "balance",
        referenceNumber,
    });

    if (providerId) {
        notify(providerId, "payment_received", "Balance Payment Received",
            `The patient has paid the remaining balance (₱${appointment.balanceAmount}). Reference: ${referenceNumber}`);
    }
    notify(patientId, "payment_received", "Balance Payment Confirmed",
        `Your balance payment of ₱${appointment.balanceAmount} has been recorded. Reference: ${referenceNumber}`);

    return sendSuccess(res, 200, "Balance paid. Appointment fully paid.", { appointment });
});

// ── DISPUTE ───────────────────────────────────────────────────────────────────
export const fileDispute = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { appointmentId, complaint } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");

    const isPatient = appointment.patientId?.toString() === userId.toString();
    const isDoctor = appointment.doctorId?.toString() === userId.toString();
    const isInstitute = appointment.instituteId?.toString() === userId.toString();
    if (!isPatient && !isDoctor && !isInstitute) return sendError(res, 403, "Not part of this appointment");

    if (!["ongoing", "completed", "awaiting_balance", "fully_paid"].includes(appointment.status))
        return sendError(res, 400, "Cannot dispute at this stage");

    // Dispute window is 8 hours from appointment start. After that the parties
    // are expected to have resolved matters directly; admin queue would be stale.
    const hoursSinceStart = (Date.now() - new Date(appointment.start).getTime()) / (1000 * 60 * 60);
    if (hoursSinceStart > 8)
        return sendError(res, 400, "Dispute window has closed (8 hours from appointment start)");

    const againstId = isPatient
        ? (appointment.doctorId || appointment.instituteId)
        : appointment.patientId;

    appointment.status = "disputed";
    await appointment.save();

    await Report.create({
        appointmentId,
        reason: complaint,
        filedBy: userId,
        filedAgainst: againstId,
    });

    notify(againstId, "dispute_filed", "Dispute Filed Against You",
        "A dispute has been filed regarding your recent appointment. An admin will review and resolve it.");

    // Alert all admins so the dispute appears in their Reports tab immediately
    notifyAllAdmins("dispute_admin_alert", "New Dispute Filed",
        `A dispute has been filed regarding an appointment and requires admin review.`
    );

    return sendSuccess(res, 201, "Dispute filed. An admin will review your case.", { appointment });
});

// ── JOIN CALL (Virtual only) ──────────────────────────────────────────────────
// Marks the current user as having joined the video call. Both parties must join
// within 5 minutes of the appointment start; the cron job handles timeouts.
export const joinCall = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (!appointment.virtual) return sendError(res, 400, "Not a virtual appointment");
    if (appointment.status !== "ongoing") return sendError(res, 400, "Appointment is not ongoing");

    const isPatient  = appointment.patientId?.toString()   === userId.toString();
    const isProvider = appointment.doctorId?.toString()    === userId.toString() ||
                       appointment.instituteId?.toString() === userId.toString();
    if (!isPatient && !isProvider) return sendError(res, 403, "Not part of this appointment");

    if (isPatient)  appointment.patientJoined  = true;
    if (isProvider) appointment.providerJoined = true;
    await appointment.save();

    return sendSuccess(res, 200, "Joined the call.", { appointment });
});

// ── SUBMIT REVIEW ─────────────────────────────────────────────────────────────
export const submitReview = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId, rating, review } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "Not authorized");
    if (appointment.status !== "fully_paid") return sendError(res, 400, "Can only review a fully paid appointment");
    if (appointment.rating) return sendError(res, 400, "Review already submitted");

    appointment.rating = rating;
    appointment.review = review || "";
    await appointment.save();

    return sendSuccess(res, 200, "Review submitted.", { appointment });
});

// ── MY APPOINTMENTS ───────────────────────────────────────────────────────────
export const getMyAppointments = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const appointments = await Appointment.find({
        $or: [{ doctorId: userId }, { patientId: userId }, { instituteId: userId }],
    })
        .populate("doctorId", "firstName lastName email profilePic")
        .populate("patientId", "firstName lastName email profilePic")
        .populate("instituteId", "instituteName email profilePic")
        .populate("serviceId", "name")
        .sort({ start: 1 });

    const formatted = appointments.map((a) => ({
        ...a.toObject(),
        role:
            a.doctorId && a.doctorId._id?.toString() === userId.toString() ? "doctor"
                : a.instituteId && a.instituteId._id?.toString() === userId.toString() ? "institute"
                    : "patient",
        phTime: {
            start: toPhTime(a.start).format("YYYY-MM-DD HH:mm"),
            end: toPhTime(a.end).format("YYYY-MM-DD HH:mm"),
        },
    }));

    return sendSuccess(res, 200, "Appointments fetched", { appointments: formatted });
});

// ── PROVIDER REVIEWS ─────────────────────────────────────────────────────────
export const getProviderReviews = asyncHandler(async (req, res) => {
    const { providerId } = req.params;

    const appointments = await Appointment.find({
        $or: [{ doctorId: providerId }, { instituteId: providerId }],
        rating: { $exists: true, $ne: null },
    })
        .populate("patientId", "firstName lastName")
        .select("rating review start patientId")
        .sort({ start: -1 })
        .lean();

    if (!appointments.length) {
        return sendSuccess(res, 200, "No reviews yet", {
            averageRating: null,
            reviewCount: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            reviews: [],
        });
    }

    const sum = appointments.reduce((s, a) => s + a.rating, 0);
    const averageRating = Math.round((sum / appointments.length) * 10) / 10;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const a of appointments) distribution[a.rating] = (distribution[a.rating] || 0) + 1;

    const reviews = appointments.map((a) => ({
        _id: a._id,
        rating: a.rating,
        review: a.review || "",
        // first name + last initial for privacy
        patientName: a.patientId
            ? `${a.patientId.firstName} ${(a.patientId.lastName || "").charAt(0)}.`
            : "Anonymous",
        date: a.start,
    }));

    return sendSuccess(res, 200, "Reviews fetched", {
        averageRating,
        reviewCount: appointments.length,
        distribution,
        reviews,
    });
});

// ── DELETE REVIEW (doctor removes a review from their profile) ────────────────
export const deleteReview = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({ _id: appointmentId, doctorId });
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (!appointment.rating) return sendError(res, 400, "No review on this appointment");

    appointment.rating = undefined;
    appointment.review = undefined;
    await appointment.save();

    return sendSuccess(res, 200, "Review deleted.");
});

// ── TRANSACTION HISTORY ───────────────────────────────────────────────────────
export const getTransactionHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const role = req.user.role;

    let query;
    if (role === "institute") {
        const deptIds = req.user.departmentAccounts || [];
        if (req.query.departmentId) {
            const reqDeptId = req.query.departmentId;
            const isOwned = deptIds.some((id) => id.toString() === reqDeptId);
            if (!isOwned) return sendError(res, 403, "Department not found under your account");
            query = { payeeId: reqDeptId };
        } else {
            query = { payeeId: { $in: deptIds } };
        }
    } else {
        query = { $or: [{ payerId: userId }, { payeeId: userId }] };
    }

    const transactions = await Transaction.find(query)
        .populate({
            path: "appointmentId",
            select: "start end status virtual amount doctorId patientId",
            populate: [
                { path: "doctorId", select: "firstName lastName" },
                { path: "patientId", select: "firstName lastName" },
            ],
        })
        .populate("payerId", "firstName lastName instituteName pharmacyName")
        .populate("payeeId", "firstName lastName instituteName pharmacyName")
        .sort({ createdAt: -1 });

    return sendSuccess(res, 200, "Transaction history fetched", { transactions });
});
