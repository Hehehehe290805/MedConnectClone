import Schedule from "../models/Schedule.js";
import Appointment from "../models/Appointment.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
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

    if (!["doctor", "institute", "department"].includes(providerType))
        return sendError(res, 400, "Invalid provider type");

    // departments store their schedule with instituteId field (same as institutes)
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

    if (!["doctor", "institute", "department"].includes(providerType))
        return sendError(res, 400, "Invalid provider type");

    const query = providerType === "doctor" ? { doctorId: providerId } : { instituteId: providerId };
    const availability = await Schedule.findOne(query);

    return sendSuccess(res, 200, "Availability retrieved", { availability: availability || null });
});

// Public endpoint: returns available queue slots for a department+service combo
export const getDepartmentAvailability = asyncHandler(async (req, res) => {
    const { departmentId, serviceId, daysAhead = 14 } = req.query;
    if (!departmentId) return sendError(res, 400, "departmentId is required");
    if (!serviceId) return sendError(res, 400, "serviceId is required");

    const [schedule, serviceClaim] = await Promise.all([
        Schedule.findOne({ instituteId: departmentId }),
        InstituteDepartmentService.findOne({ departmentId, serviceId, status: "verified" }),
    ]);

    if (!schedule || !schedule.isActive)
        return sendError(res, 400, "This department has no active schedule.");
    if (!serviceClaim)
        return sendError(res, 404, "Service not found or not yet approved for this department.");

    const { maxPatientsPerDay, durationMinutes, price } = serviceClaim;
    const now = nowPhTime();

    const startHourNum = Number(schedule.startHour.split(":")[0]);
    const startMinNum = Number(schedule.startHour.split(":")[1]);
    const endHourNum = Number(schedule.endHour.split(":")[0]);
    const endMinNum = Number(schedule.endHour.split(":")[1]);

    const availableDates = [];

    for (let i = 0; i < Number(daysAhead); i++) {
        const day = now.add(i, "day").startOf("day");
        const weekday = day.day();
        if (!schedule.daysOfWeek.includes(weekday)) continue;

        const dayStart = day.hour(startHourNum).minute(startMinNum).second(0);
        if (dayStart.isBefore(now)) continue;

        const dateStr = day.format("YYYY-MM-DD");

        const bookingsCount = await Appointment.countDocuments({
            instituteId: departmentId,
            serviceId,
            status: { $in: ["pending_payment", "deposit_paid", "accepted", "ongoing"] },
            start: { $gte: day.toDate(), $lt: day.add(1, "day").toDate() },
        });

        if (maxPatientsPerDay && bookingsCount >= maxPatientsPerDay) continue;

        const nextQueueNumber = bookingsCount + 1;
        const estimatedMinutes = startHourNum * 60 + startMinNum + bookingsCount * durationMinutes;
        const estimatedHour = Math.floor(estimatedMinutes / 60);
        const estimatedMin = estimatedMinutes % 60;
        const estimatedStartDt = day.hour(estimatedHour).minute(estimatedMin).second(0);

        // Skip this date if the estimated booking would run past the schedule's end hour
        const scheduleEndDt = day.hour(endHourNum).minute(endMinNum).second(0);
        const estimatedEndDt = estimatedStartDt.add(durationMinutes, "minute");
        if (estimatedEndDt.isAfter(scheduleEndDt)) continue;

        availableDates.push({
            date: dateStr,
            bookingsCount,
            remainingSlots: maxPatientsPerDay ? maxPatientsPerDay - bookingsCount : null,
            nextQueueNumber,
            estimatedStartISO: estimatedStartDt.toISOString(),
            estimatedStartDisplay: estimatedStartDt.format("h:mm A"),
        });
    }

    return sendSuccess(res, 200, "Department availability fetched", {
        schedule: { startHour: schedule.startHour, endHour: schedule.endHour, daysOfWeek: schedule.daysOfWeek },
        service: { durationMinutes, maxPatientsPerDay, price },
        availableDates,
    });
});
