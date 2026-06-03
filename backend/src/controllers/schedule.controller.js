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

const ALL_STATUSES = [
    "pending_payment", "deposit_paid", "accepted", "ongoing",
    "completed", "awaiting_balance", "fully_paid",
    "cancelled", "rejected", "disputed", "resolved",
];

async function generateAvailableSlots(doctorId, daysAhead = 2) {
    if (!doctorId) return [];

    const availability = await Schedule.findOne({ doctorId });
    if (!availability || !availability.isActive) return [];

    const slotDuration = 30;
    const gap = 5;
    const now = nowPhTime();
    const windowEnd = now.add(daysAhead, "day").toDate();

    // Fetch all active appointments in the window once — avoids N+1 queries per slot
    const existingAppts = await Appointment.find({
        doctorId,
        status: { $in: ["pending_payment", "deposit_paid", "accepted", "ongoing"] },
        start: { $gte: now.toDate() },
        end: { $lte: windowEnd },
    }).select("start end").lean();

    let endHour = availability.endHour;
    if (endHour === "24:00") endHour = "00:00";

    const slots = [];

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

        while (!currentTime.add(slotDuration, "minute").isAfter(end)) {
            // Skip slots that have already started
            if (currentTime.isBefore(now)) {
                currentTime = currentTime.add(slotDuration + gap, "minute");
                continue;
            }

            const slotStart = currentTime.toDate();
            const slotEnd = currentTime.add(slotDuration, "minute").toDate();

            // Check overlap in memory using the pre-fetched appointments
            const hasOverlap = existingAppts.some(a => {
                const gapStart = new Date(slotStart.getTime() - gap * 60000);
                const gapEnd = new Date(slotEnd.getTime() + gap * 60000);
                return new Date(a.start) < gapEnd && new Date(a.end) > gapStart;
            });

            if (!hasOverlap) slots.push({ start: slotStart, end: slotEnd });
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
    title: a.status.charAt(0).toUpperCase() + a.status.slice(1).replace(/_/g, " "),
    type: "appointment",
    phTime: `${toPhTime(a.start).format("YYYY-MM-DD HH:mm")} to ${toPhTime(a.end).format("HH:mm")}`,
});

export const getDoctorCalendar = asyncHandler(async (req, res) => {
    const { daysAhead = 5 } = req.query;
    const doctorId = req.user._id;

    const [slots, appointments] = await Promise.all([
        generateAvailableSlots(doctorId, Number(daysAhead)),
        Appointment.find({ doctorId, status: { $in: ALL_STATUSES }, start: { $gte: new Date() } }),
    ]);

    const events = [...slots.map(formatSlot), ...appointments.map(formatAppointment)];
    return sendSuccess(res, 200, "Doctor calendar fetched", { events, timezone: "Asia/Manila (UTC+8)" });
});

export const getDoctorPublicCalendar = asyncHandler(async (req, res) => {
    const { doctorId, daysAhead = 5 } = req.query;
    if (!doctorId) return sendError(res, 400, "doctorId is required");

    const [slots, appointments] = await Promise.all([
        generateAvailableSlots(doctorId, Number(daysAhead)),
        Appointment.find({
            doctorId,
            status: { $in: ["deposit_paid", "accepted", "ongoing"] },
            start: { $gte: new Date() },
        }),
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
        status: { $in: ALL_STATUSES },
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

    if (!["doctor", "institute"].includes(providerType))
        return sendError(res, 400, "Invalid provider type");

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

    if (!["doctor", "institute"].includes(providerType))
        return sendError(res, 400, "Invalid provider type");

    const query = providerType === "doctor" ? { doctorId: providerId } : { instituteId: providerId };
    const availability = await Schedule.findOne(query);

    return sendSuccess(res, 200, "Availability retrieved", { availability: availability || null });
});
