import mongoose from "mongoose";
import Service from "../models/Service.js";
import Institute_Service from "../models/InstituteDepartmentService.js";
import Appointment from "../models/Appointment.js";
import Pricing from "../models/Pricing.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import Schedule from "../models/Schedule.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Manila");

const toPhTime = (date) => dayjs(date).tz("Asia/Manila");
const GAP_MINUTES = 5;

function applyTimeToDate(date, timeStr) {
    const [hour, minute] = timeStr.split(":").map(Number);
    return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0);
}

function hasOverlap(existing, start, end) {
    const gapStart = dayjs(start).subtract(GAP_MINUTES, "minute");
    const gapEnd = dayjs(end).add(GAP_MINUTES, "minute");
    return dayjs(existing.start).isBefore(gapEnd) && dayjs(existing.end).isAfter(gapStart);
}

export const bookAppointment = asyncHandler(async (req, res) => {
    const { doctorId, instituteId, serviceId: providedServiceId, start } = req.body;
    const patientId = req.user._id;
    const providerType = doctorId ? "doctor" : "institute";

    let serviceId = providedServiceId;
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        let appointmentService = await Service.findOne({ name: "Appointment" });
        if (!appointmentService) {
            appointmentService = await Service.create({ name: "Appointment", status: "verified" });
        }
        serviceId = appointmentService._id;
    }

    let durationMinutes;
    if (providerType === "doctor") {
        durationMinutes = 30;
    } else {
        const serviceData = await Institute_Service.findOne({ instituteId, serviceId });
        if (!serviceData) return sendError(res, 404, "Service not found for institute.");
        durationMinutes = serviceData.durationMinutes;
    }

    const startTimePH = dayjs(start);
    const startTimeUTC = startTimePH.utc();
    const endTimeUTC = startTimeUTC.add(durationMinutes, "minute");

    const schedule = await Schedule.findOne({ $or: [{ doctorId }, { instituteId }] });
    if (!schedule) return sendError(res, 400, "Provider schedule not found.");

    const endTimePH = endTimeUTC.tz("Asia/Manila");
    const dayOfWeek = startTimePH.day();

    if (!schedule.daysOfWeek.includes(dayOfWeek)) {
        return sendError(res, 400, "Booking outside provider operating days.");
    }

    const dayStart = applyTimeToDate(startTimePH, schedule.startHour);
    const dayEnd = applyTimeToDate(startTimePH, schedule.endHour);

    if (startTimePH.isBefore(dayStart) || endTimePH.isAfter(dayEnd)) {
        return sendError(res, 400, "Booking out of operating hours.");
    }

    const activeStatuses = ["pending_accept", "awaiting_deposit", "booked", "confirmed", "ongoing"];

    const providerAppointments = await Appointment.find({
        $or: [{ doctorId }, { instituteId }],
        status: { $in: activeStatuses },
    });
    if (providerAppointments.some((a) => hasOverlap(a, startTimeUTC, endTimeUTC))) {
        return sendError(res, 400, "Timeslot already taken.");
    }

    const userAppointments = await Appointment.find({ patientId, status: { $in: activeStatuses } });
    if (userAppointments.some((a) => hasOverlap(a, startTimeUTC, endTimeUTC))) {
        return sendError(res, 400, "You already have a booking that overlaps.");
    }

    const pricing = await Pricing.findOne({ providerId: doctorId || instituteId, serviceId });
    if (!pricing) return sendError(res, 400, "Pricing not found for this service.");

    const totalPrice = pricing.price;
    const deposit = totalPrice * 0.1;
    const balance = totalPrice - deposit;

    const appointment = await Appointment.create({
        doctorId: doctorId || null,
        instituteId: instituteId || null,
        patientId,
        serviceId,
        virtual: providerType === "doctor",
        start: startTimeUTC.toDate(),
        end: endTimeUTC.toDate(),
        amount: totalPrice,
        paymentDeposit: deposit,
        balanceAmount: balance,
    });

    return sendSuccess(res, 201, "Appointment booked successfully.", {
        appointment: {
            ...appointment.toObject(),
            phTime: {
                start: startTimeUTC.tz("Asia/Manila").format("YYYY-MM-DD HH:mm"),
                end: endTimeUTC.tz("Asia/Manila").format("YYYY-MM-DD HH:mm"),
            },
        },
    });
});

export const payDeposit = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId, referenceNumber } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "You can only pay for your own appointments");
    if (appointment.status !== "awaiting_deposit") return sendError(res, 400, "Cannot pay deposit at this stage");

    appointment.depositPaid = true;
    appointment.depositRef = referenceNumber;
    appointment.status = "booked";
    await appointment.save();

    return sendSuccess(res, 200, "Deposit paid successfully. Appointment is now booked.", {
        appointment: {
            ...appointment.toObject(),
            phTime: {
                start: toPhTime(appointment.start).format("YYYY-MM-DD HH:mm"),
                end: toPhTime(appointment.end).format("YYYY-MM-DD HH:mm"),
            },
        },
    });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "Not authorized");

    if (["pending_accept", "awaiting_deposit"].includes(appointment.status)) {
        appointment.status = "cancelled_unpaid";
    } else if (appointment.status === "booked") {
        appointment.status = "cancelled";
    } else {
        return sendError(res, 400, "Cannot cancel at this stage");
    }

    await appointment.save();

    return sendSuccess(res, 200, "Appointment cancelled successfully", {
        appointment: {
            ...appointment.toObject(),
            phTime: {
                start: toPhTime(appointment.start).format("YYYY-MM-DD HH:mm"),
                end: toPhTime(appointment.end).format("YYYY-MM-DD HH:mm"),
            },
        },
    });
});

export const submitReview = asyncHandler(async (req, res) => {
    const { appointmentId, rating, review } = req.body;
    const patientId = req.user._id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "You can only review your own appointments");
    if (appointment.status !== "confirm_fully_paid") return sendError(res, 400, "Cannot review incomplete appointment");

    appointment.rating = rating;
    appointment.review = review || "";
    await appointment.save();

    return sendSuccess(res, 200, "Review submitted successfully", { appointment });
});

export const payRemaining = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId, referenceNumber } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "You can only pay for your own appointments");
    if (!appointment.depositPaid) return sendError(res, 400, "Deposit has not been paid yet");
    if (appointment.status !== "completed") return sendError(res, 400, "Cannot pay remaining at this stage");

    appointment.balancePaid = true;
    appointment.balanceRef = referenceNumber;
    appointment.status = "fully_paid";
    await appointment.save();

    return sendSuccess(res, 200, "Remaining balance paid successfully.", {
        appointment: {
            ...appointment.toObject(),
            phTime: {
                start: toPhTime(appointment.start).format("YYYY-MM-DD HH:mm"),
                end: toPhTime(appointment.end).format("YYYY-MM-DD HH:mm"),
            },
        },
    });
});

export const fileComplaint = asyncHandler(async (req, res) => {
    const appointmentId = req.params.id;
    const userId = req.user._id;
    const { complaint } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found.");

    const patientId = appointment.patientId?.toString();
    const doctorId = appointment.doctorId?.toString();
    const instituteId = appointment.instituteId?.toString();

    const isPatient = patientId && patientId === userId.toString();
    const isDoctor = doctorId && doctorId === userId.toString();
    const isInstitute = instituteId && instituteId === userId.toString();

    if (!isPatient && !isDoctor && !isInstitute) return sendError(res, 403, "You are not part of this appointment.");

    appointment.status = "freeze";
    await appointment.save();

    let againstId = isPatient ? (doctorId || instituteId) : patientId;
    if (!againstId) return sendError(res, 400, "Cannot determine target user for complaint.");

    const targetUser = await User.findById(againstId);
    if (!targetUser) return sendError(res, 404, "User to report not found.");

    const report = new Report({ appointmentId, reason: complaint, filedBy: userId, filedAgainst: againstId });
    await report.save();

    return sendSuccess(res, 201, "Complaint filed successfully.");
});

export const getUserAppointments = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const appointments = await Appointment.find({
        $or: [{ doctorId: userId }, { patientId: userId }, { instituteId: userId }],
        status: { $in: ["pending_accept", "awaiting_deposit", "booked", "confirmed", "ongoing", "marked_complete", "completed", "fully_paid", "confirm_fully_paid", "cancelled_unpaid", "cancelled", "rejected", "no_show_patient", "no_show_doctor", "no_show_both", "freeze"] },
    })
        .populate("doctorId", "firstName lastName email profilePic")
        .populate("patientId", "firstName lastName email profilePic")
        .populate("instituteId", "facilityName email profilePic")
        .populate("serviceId", "name")
        .sort({ start: 1 });

    const formatted = appointments.map((a) => ({
        ...a.toObject(),
        role:
            a.doctorId && String(a.doctorId._id) === String(userId) ? "doctor"
                : a.instituteId && String(a.instituteId._id) === String(userId) ? "institute"
                    : "patient",
    }));

    return sendSuccess(res, 200, "Appointments fetched", { appointments: formatted, timezone: "Asia/Manila (UTC+8)" });
});

export const markAttendance = asyncHandler(async (req, res) => {
    const appointmentId = req.params.id;
    const userId = req.user._id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found.");

    const isPatient = appointment.patientId?.toString() === userId;
    const isDoctor = appointment.doctorId?.toString() === userId;
    const isInstitute = appointment.instituteId?.toString() === userId;

    if (!isPatient && !isDoctor && !isInstitute) return sendError(res, 403, "You are not part of this appointment.");

    if (isPatient) appointment.patientPresent = true;
    if (isDoctor) appointment.doctorPresent = true;
    if (isInstitute) appointment.institutePresent = true;

    const providerPresent = appointment.doctorPresent || appointment.institutePresent;
    if (appointment.patientPresent && providerPresent && appointment.status === "booked") {
        appointment.status = "ongoing";
    }

    await appointment.save();
    return sendSuccess(res, 200, "Attendance marked successfully.", { appointment });
});

export const completeAppointment = asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.patientId.toString() !== patientId.toString()) return sendError(res, 403, "Only the patient can mark appointment as completed");
    if (!["confirmed", "ongoing", "confirm_fully_paid", "marked_complete"].includes(appointment.status)) {
        return sendError(res, 400, "Appointment cannot be completed at this stage");
    }

    appointment.status = "completed";
    await appointment.save();

    return sendSuccess(res, 200, "Appointment marked as completed.", { appointment });
});

// Cron job functions — not HTTP handlers, no asyncHandler needed
export const checkNoShows = async () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const appointments = await Appointment.find({
        $or: [
            { start: { $lte: fiveMinutesAgo }, status: { $in: ["booked", "confirmed"] } },
            { end: { $lte: now }, status: { $in: ["ongoing"] } },
        ],
    });

    for (const appointment of appointments) {
        if (appointment.bothPresent && appointment.end <= now && appointment.status === "ongoing") {
            appointment.status = "completed";
            await appointment.save();
            continue;
        }
        if (appointment.bothPresent || appointment.status === "ongoing" || appointment.status === "completed") continue;
        if (appointment.start <= fiveMinutesAgo && ["booked", "confirmed"].includes(appointment.status)) {
            if (!appointment.doctorPresent && !appointment.patientPresent) appointment.status = "no_show_both";
            else if (appointment.doctorPresent && !appointment.patientPresent) appointment.status = "no_show_patient";
            else if (!appointment.doctorPresent && appointment.patientPresent) appointment.status = "no_show_doctor";
            await appointment.save();
        }
    }
};

export const checkStartedAppointments = async () => {
    const now = new Date();
    const appointments = await Appointment.find({ start: { $lte: now }, status: "confirmed" })
        .populate("doctorId", "_id")
        .populate("patientId", "_id");

    for (const appointment of appointments) {
        const doctorId = appointment.doctorId._id.toString();
        const patientId = appointment.patientId._id.toString();
        const channelId = [doctorId, patientId].sort().join("-");
        const callUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/call/${channelId}`;
        appointment.status = "ongoing";
        appointment.videoCallLink = callUrl;
        await appointment.save();
    }
};