import Schedule from "../models/Schedule.js";
import Appointment from "../models/Appointment.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Manila");

const toPhTime = (date) => dayjs(date).tz("Asia/Manila");
const nowPhTime = () => dayjs().tz("Asia/Manila");

const ALL_ACTIVE_STATUSES = [
    "pending_accept", "awaiting_deposit", "booked", "confirmed", "ongoing",
    "completed", "fully_paid", "confirm_fully_paid", "cancelled_unpaid",
    "cancelled", "rejected", "no_show_patient", "no_show_doctor", "no_show_both", "freeze",
];

async function generateAvailableSlots(doctorId, daysAhead = 2) {
    if (!doctorId) return [];

    const availability = await Schedule.findOne({ doctorId });
    if (!availability || !availability.isActive) return [];

    const slotDuration = 30;
    const gap = 5;
    const slots = [];
    const now = nowPhTime();

    let endHour = availability.endHour;
    if (endHour === "24:00") endHour = "00:00";

    for (let i = 0; i < daysAhead; i++) {
        const day = now.add(i, "day").startOf("day");
        const weekday = day.day();
        if (!availability.daysOfWeek.includes(weekday)) continue;

        let start = day
            .hour(Number(availability.startHour.split(":")[0]))
            .minute(Number(availability.startHour.split(":")[1]))
            .second(0);

        let end = day
            .hour(Number(endHour.split(":")[0]))
            .minute(Number(endHour.split(":")[1]))
            .second(0);

        if (endHour === "00:00") end = end.add(1, "day");

        let currentTime = start.clone();

        while (currentTime.add(slotDuration, "minute").isBefore(end)) {
            const slotStart = currentTime.toDate();
            const slotEnd = currentTime.add(slotDuration, "minute").toDate();

            const overlapping = await Appointment.findOne({
                doctorId,
                status: { $in: ALL_ACTIVE_STATUSES },
                $or: [
                    { start: { $lt: slotEnd, $gte: slotStart } },
                    { end: { $gt: slotStart, $lte: slotEnd } },
                    { start: { $lte: slotStart }, end: { $gte: slotEnd } },
                ],
            });

            if (!overlapping) slots.push({ start: slotStart, end: slotEnd });
            currentTime = currentTime.add(slotDuration + gap, "minute");
        }
    }

    return slots;
}

const formatSlot = (s) => ({
    start: toPhTime(s.start).format(),
    end: toPhTime(s.end).format(),
    title: "Available",
    type: "availability",
    phTime: `${toPhTime(s.start).format("YYYY-MM-DD HH:mm")} to ${toPhTime(s.end).format("HH:mm")}`,
});

const formatAppointment = (a) => ({
    start: toPhTime(a.start).format(),
    end: toPhTime(a.end).format(),
    title: a.status.charAt(0).toUpperCase() + a.status.slice(1),
    type: "appointment",
    phTime: `${toPhTime(a.start).format("YYYY-MM-DD HH:mm")} to ${toPhTime(a.end).format("HH:mm")}`,
});

export const getDoctorCalendar = asyncHandler(async (req, res) => {
    const { daysAhead = 5 } = req.query;
    const doctorId = req.user._id;
    if (!doctorId) return sendError(res, 400, "doctorId is required");

    const [slots, appointments] = await Promise.all([
        generateAvailableSlots(doctorId, Number(daysAhead)),
        Appointment.find({ doctorId, status: { $in: ALL_ACTIVE_STATUSES }, start: { $gte: new Date() } }),
    ]);

    const events = [...slots.map(formatSlot), ...appointments.map(formatAppointment)];
    return sendSuccess(res, 200, "Doctor calendar fetched", { events, timezone: "Asia/Manila (UTC+8)" });
});

export const getDoctorPublicCalendar = asyncHandler(async (req, res) => {
    const { doctorId, daysAhead = 5 } = req.query;
    if (!doctorId) return sendError(res, 400, "doctorId is required");

    const [slots, appointments] = await Promise.all([
        generateAvailableSlots(doctorId, Number(daysAhead)),
        Appointment.find({ doctorId, status: { $in: ["booked", "confirmed", "cancelled", "completed"] }, start: { $gte: new Date() } }),
    ]);

    const events = [...slots.map(formatSlot), ...appointments.map(formatAppointment)];
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    return sendSuccess(res, 200, "Doctor public calendar fetched", { events, timezone: "Asia/Manila (UTC+8)" });
});

export const getInstitutePublicCalendar = asyncHandler(async (req, res) => {
    const { instituteId } = req.query;
    if (!instituteId) return sendError(res, 400, "instituteId is required");

    const appointments = await Appointment.find({
        instituteId,
        status: { $in: ALL_ACTIVE_STATUSES },
        start: { $gte: new Date() },
    });

    const events = appointments.map(formatAppointment);
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    return sendSuccess(res, 200, "Institute public calendar fetched", { events, timezone: "Asia/Manila (UTC+8)" });
});

export const setAvailability = asyncHandler(async (req, res) => {
    const providerId = req.user._id;
    const providerType = req.user.role;
    const { startHour, endHour, daysOfWeek, isActive } = req.body;

    if (!["doctor", "institute"].includes(providerType)) {
        return sendError(res, 400, "Invalid provider type");
    }

    const query = providerType === "doctor" ? { doctorId: providerId } : { instituteId: providerId };
    const availability = await Schedule.findOneAndUpdate(
        query,
        { startHour, endHour, daysOfWeek, isActive },
        { upsert: true, new: true }
    );

    return sendSuccess(res, 200, `${providerType} availability set successfully`, { availability });
});

export const getAvailability = asyncHandler(async (req, res) => {
    const providerId = req.user._id;
    const providerType = req.user.role;

    if (!["doctor", "institute"].includes(providerType)) {
        return sendError(res, 400, "Invalid provider type");
    }

    const query = providerType === "doctor" ? { doctorId: providerId } : { instituteId: providerId };
    const availability = await Schedule.findOne(query);

    return sendSuccess(res, 200, "Availability retrieved successfully", { availability: availability || null });
});

export const acceptAppointment = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.doctorId.toString() !== doctorId.toString()) return sendError(res, 403, "Only the assigned doctor can accept this appointment");
    if (appointment.status !== "pending_accept") return sendError(res, 400, "Appointment cannot be accepted at this stage");

    appointment.status = "awaiting_deposit";
    await appointment.save();

    return sendSuccess(res, 200, "Appointment accepted. Awaiting patient deposit.", { appointment });
});

export const rejectAppointment = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { appointmentId, reason } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.doctorId.toString() !== doctorId.toString()) return sendError(res, 403, "Only the assigned doctor can reject this appointment");
    if (appointment.status !== "pending_accept") return sendError(res, 400, "Only appointments pending acceptance can be rejected");

    appointment.status = "rejected";
    appointment.rejectionReason = reason || "No reason provided";
    await appointment.save();

    return sendSuccess(res, 200, "Appointment rejected.", { appointment });
});

export const confirmDeposit = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.doctorId.toString() !== doctorId.toString()) return sendError(res, 403, "Only the assigned doctor can confirm deposit");
    if (!appointment.depositPaid || appointment.status !== "booked") return sendError(res, 400, "Deposit not yet paid or appointment not in correct status");

    appointment.status = "confirmed";
    await appointment.save();

    return sendSuccess(res, 200, "Deposit confirmed. Appointment is now confirmed.", { appointment });
});

export const markComplete = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.doctorId.toString() !== doctorId.toString()) return sendError(res, 403, "Only the assigned doctor can mark appointment as completed");
    if (!["confirmed", "ongoing", "confirm_fully_paid"].includes(appointment.status)) return sendError(res, 400, "Appointment cannot be completed at this stage");

    appointment.status = "marked_complete";
    await appointment.save();

    return sendSuccess(res, 200, "Appointment marked as completed.", { appointment });
});

export const confirmFullPayment = asyncHandler(async (req, res) => {
    const doctorId = req.user._id;
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return sendError(res, 404, "Appointment not found");
    if (appointment.doctorId.toString() !== doctorId.toString()) return sendError(res, 403, "Only the assigned doctor can confirm full payment");
    if (!appointment.balancePaid || appointment.status !== "fully_paid") return sendError(res, 400, "Full payment not yet made or appointment not in correct status");

    appointment.status = "confirm_fully_paid";
    await appointment.save();

    return sendSuccess(res, 200, "Full payment confirmed. Appointment is fully paid.", { appointment });
});