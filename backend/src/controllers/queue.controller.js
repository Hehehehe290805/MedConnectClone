import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import AppointmentQueue from "../models/AppointmentQueue.js";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { notify } from "../services/notification.service.js";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

// Snap a JS Date to UTC midnight of the Asia/Manila calendar date
function toQueueDate(date) {
    return dayjs(date).tz(PH_TZ).startOf("day").utc().toDate();
}

// Re-number live slot positions 1..N in order, skipping cancelled/done slots.
// This helper only updates the numeric positions and does not emit notifications
// or adjust currentStart timing.
async function renumberSlots(queue) {
    let pos = 1;
    for (const slot of queue.slots) {
        if (slot.status === "cancelled" || slot.status === "done") {
            // keep their existing position frozen — they've left the live queue
        } else {
            slot.position = pos++;
        }
    }
}

// Send position-threshold notifications (2, 5, 10) for a given slot.
async function notifyPositionIfThreshold(slot, queueDate) {
    const thresholds = [2, 5, 10];
    if (!thresholds.includes(slot.position)) return;
    const dateStr = dayjs(queueDate).tz(PH_TZ).format("MMM D, YYYY");
    const msg = `You are now #${slot.position} in the queue for your appointment on ${dateStr}. ${
        slot.position === 2 ? "You're almost up — please be ready!" :
        slot.position === 5 ? "5 patients ahead of you." :
        "10 patients ahead of you."
    }`;
    notify(slot.patientId, "queue_position_update", "Queue Update", msg);
}

// ── Build / Rebuild Queue ────────────────────────────────────────────────────
// POST /api/queue/build
// Called by the daily 6 AM cron (providerId passed directly) or by the
// provider manually. Builds (or rebuilds) the queue for today.
export const buildQueue = asyncHandler(async (req, res) => {
    const providerId = req.user._id;

    if (!["doctor", "department"].includes(req.user.role)) {
        return sendError(res, 403, "Only doctors and departments can build a queue");
    }

    const todayDate = toQueueDate(new Date());
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);

    // Accepted appointments for today, sorted by start time
    const filter = {
        status: "accepted",
        start: { $gte: todayDate, $lt: tomorrowDate },
    };
    if (req.user.role === "doctor") filter.doctorId = providerId;
    else filter.instituteId = providerId;

    const appointments = await Appointment.find(filter).sort({ start: 1 });

    const slots = appointments.map((appt, idx) => ({
        appointmentId: appt._id,
        position: idx + 1,
        type: "booked",
        status: "waiting",
        patientId: appt.patientId,
        originalStart: appt.start,
        currentStart: appt.start,
    }));

    const queue = await AppointmentQueue.findOneAndUpdate(
        { providerId, date: todayDate },
        { $set: { slots, isActive: slots.length > 0 } },
        { upsert: true, new: true }
    );

    return sendSuccess(res, 200, "Queue built", { queue });
});

// ── Internal build used by cron ──────────────────────────────────────────────
export async function buildQueueForProvider(providerId, role) {
    const todayDate = toQueueDate(new Date());
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);

    const filter = {
        status: "accepted",
        start: { $gte: todayDate, $lt: tomorrowDate },
    };
    if (role === "doctor") filter.doctorId = providerId;
    else filter.instituteId = providerId;

    const appointments = await Appointment.find(filter).sort({ start: 1 });
    if (appointments.length === 0) return;

    const slots = appointments.map((appt, idx) => ({
        appointmentId: appt._id,
        position: idx + 1,
        type: "booked",
        status: "waiting",
        patientId: appt.patientId,
        originalStart: appt.start,
        currentStart: appt.start,
    }));

    await AppointmentQueue.findOneAndUpdate(
        { providerId, date: todayDate },
        { $set: { slots, isActive: true } },
        { upsert: true, new: true }
    );
}

// ── Add Walk-in / Emergency ──────────────────────────────────────────────────
// POST /api/queue/walkin
// Body: { patientFirstName, patientLastName, type: "walkin"|"emergency" }
export const addWalkin = asyncHandler(async (req, res) => {
    const providerId = req.user._id;

    if (!["doctor", "department"].includes(req.user.role)) {
        return sendError(res, 403, "Only doctors and departments can add walk-ins");
    }

    const { patientFirstName, patientLastName, type } = req.body;
    if (!patientFirstName || !patientLastName) {
        return sendError(res, 400, "Patient first and last name are required");
    }
    if (!["walkin", "emergency"].includes(type)) {
        return sendError(res, 400, "Type must be walkin or emergency");
    }

    const todayDate = toQueueDate(new Date());
    const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);

    // Build a minimal Appointment record for the walk-in
    const now = new Date();
    const apptData = {
        patientId: providerId,   // placeholder — walk-in has no real patient account
        status: "accepted",
        virtual: false,
        start: now,
        end: new Date(now.getTime() + 30 * 60 * 1000), // 30-min placeholder
        amount: 0,
        platformFee: 0,
        depositAmount: 0,
        balanceAmount: 0,
        depositPaid: true,
        balancePaid: true,
    };
    if (req.user.role === "doctor") apptData.doctorId = providerId;
    else apptData.instituteId = providerId;

    const newAppt = await Appointment.create(apptData);

    let queue = await AppointmentQueue.findOne({ providerId, date: todayDate });
    if (!queue) {
        queue = new AppointmentQueue({ providerId, date: todayDate, slots: [], isActive: true });
    }

    if (type === "emergency") {
        // Revert the currently active slot's appointment back to "accepted"
        const activeSlot = queue.slots.find(s => s.status === "active");
        if (activeSlot) {
            await Appointment.findByIdAndUpdate(activeSlot.appointmentId, { status: "accepted" });
            activeSlot.status = "waiting";
        }

        // Insert emergency at position 1, push all others back
        const emergencySlot = {
            appointmentId: newAppt._id,
            position: 1,
            type: "emergency",
            status: "waiting",
            patientId: providerId,   // walk-in has no real patient account
            originalStart: now,
            currentStart: now,
        };

        // Shift all non-done/cancelled slots up by 1
        for (const slot of queue.slots) {
            if (slot.status !== "done" && slot.status !== "cancelled") {
                slot.position += 1;
            }
        }
        queue.slots.unshift(emergencySlot);
        queue.isActive = true;

        // Notify all patients behind the emergency about their new position
        for (const slot of queue.slots) {
            if (slot.status === "waiting" && slot.position > 1) {
                await notifyPositionIfThreshold(slot, todayDate);
            }
        }
    } else {
        // Walk-in: append to end (after last non-done/cancelled slot)
        const maxPos = queue.slots.reduce((max, s) => {
            if (s.status !== "done" && s.status !== "cancelled") return Math.max(max, s.position);
            return max;
        }, 0);

        queue.slots.push({
            appointmentId: newAppt._id,
            position: maxPos + 1,
            type: "walkin",
            status: "waiting",
            patientId: providerId,
            originalStart: now,
            currentStart: now,
        });
        queue.isActive = true;
    }

    await queue.save();
    return sendSuccess(res, 200, `${type === "emergency" ? "Emergency" : "Walk-in"} patient added`, { queue });
});

// ── Get Today's Queue ────────────────────────────────────────────────────────
// GET /api/queue/today
export const getTodayQueue = asyncHandler(async (req, res) => {
    const providerId = req.user._id;

    if (!["doctor", "department"].includes(req.user.role)) {
        return sendError(res, 403, "Only doctors and departments can view their queue");
    }

    const todayDate = toQueueDate(new Date());
    const queue = await AppointmentQueue.findOne({ providerId, date: todayDate })
        .populate("slots.appointmentId", "patientId start end virtual status")
        .lean();

    if (!queue) {
        return sendSuccess(res, 200, "No queue for today", { queue: null });
    }

    return sendSuccess(res, 200, "Queue fetched", { queue });
});

// ── Get Patient Position ─────────────────────────────────────────────────────
// GET /api/queue/position?appointmentId=
export const getPatientPosition = asyncHandler(async (req, res) => {
    const { appointmentId } = req.query;
    if (!appointmentId) {
        return sendError(res, 400, "appointmentId query param is required");
    }

    // Find the appointment to get the provider
    const appt = await Appointment.findById(appointmentId);
    if (!appt) return sendError(res, 404, "Appointment not found");

    const todayDate = toQueueDate(new Date());
    const providerId = appt.doctorId || appt.instituteId;
    const queue = await AppointmentQueue.findOne({ providerId, date: todayDate }).lean();

    if (!queue) return sendSuccess(res, 200, "Queue not found for today", { position: null, ahead: null });

    const slot = queue.slots.find(s => s.appointmentId.toString() === appointmentId);
    if (!slot) return sendSuccess(res, 200, "Appointment not in queue", { position: null, ahead: null });

    // Count active "waiting" slots with a lower position
    const ahead = queue.slots.filter(s =>
        s.status === "waiting" && s.position < slot.position
    ).length;

    return sendSuccess(res, 200, "Position fetched", {
        position: slot.position,
        status: slot.status,
        ahead,
    });
});

// ── Advance Queue ────────────────────────────────────────────────────────────
// POST /api/queue/advance
// Doctor marks the current active slot done and activates the next waiting slot.
export const advanceQueue = asyncHandler(async (req, res) => {
    const providerId = req.user._id;

    if (!["doctor", "department"].includes(req.user.role)) {
        return sendError(res, 403, "Only doctors and departments can advance the queue");
    }

    const todayDate = toQueueDate(new Date());
    const queue = await AppointmentQueue.findOne({ providerId, date: todayDate });
    if (!queue) return sendError(res, 404, "No queue found for today");

    const activeSlot = queue.slots.find(s => s.status === "active");
    if (!activeSlot) {
        // No active slot — activate the first waiting slot (starting the queue)
        const firstWaiting = queue.slots
            .filter(s => s.status === "waiting")
            .sort((a, b) => a.position - b.position)[0];

        if (!firstWaiting) {
            return sendError(res, 400, "No waiting patients in queue");
        }
        firstWaiting.status = "active";
        await queue.save();
        return sendSuccess(res, 200, "Queue started", { queue });
    }

    // Verify the current appointment is in a terminal-enough state to advance
    const currentAppt = await Appointment.findById(activeSlot.appointmentId);
    const advanceable = ["completed", "awaiting_balance", "fully_paid", "cancelled", "rejected"];
    if (currentAppt && !advanceable.includes(currentAppt.status)) {
        return sendError(res, 400, "Current appointment must be completed, awaiting balance, or fully paid before advancing");
    }

    // Mark active slot as done
    activeSlot.status = "done";

    // Find next waiting slot
    const nextWaiting = queue.slots
        .filter(s => s.status === "waiting")
        .sort((a, b) => a.position - b.position)[0];

    if (nextWaiting) {
        nextWaiting.status = "active";
        nextWaiting.currentStart = new Date();
    } else {
        queue.isActive = false;
    }

    await queue.save();
    return sendSuccess(res, 200, nextWaiting ? "Advanced to next patient" : "Queue complete", { queue });
});

// ── No-Show ──────────────────────────────────────────────────────────────────
// POST /api/queue/no-show
// Body: { outcome: "skip" | "cancel" }
// Doctor triggers a no-show on the currently active slot.
// skip  → move to end of queue (status: skipped)
// cancel → cancel the appointment (status: cancelled, no refund)
export const handleNoShow = asyncHandler(async (req, res) => {
    const providerId = req.user._id;

    if (!["doctor", "department"].includes(req.user.role)) {
        return sendError(res, 403, "Only doctors and departments can trigger a no-show");
    }

    const { outcome } = req.body;
    if (!["skip", "cancel"].includes(outcome)) {
        return sendError(res, 400, "outcome must be 'skip' or 'cancel'");
    }

    const todayDate = toQueueDate(new Date());
    const queue = await AppointmentQueue.findOne({ providerId, date: todayDate });
    if (!queue) return sendError(res, 404, "No queue found for today");

    const activeSlot = queue.slots.find(s => s.status === "active");
    if (!activeSlot) return sendError(res, 400, "No active slot in queue");

    const appt = await Appointment.findById(activeSlot.appointmentId);

    if (outcome === "cancel") {
        // Cancel the appointment — no refund
        if (appt && !["cancelled", "completed", "fully_paid", "awaiting_balance"].includes(appt.status)) {
            appt.status = "cancelled";
            appt.rejectionReason = "Patient did not show up for their appointment.";
            await appt.save();
        }

        activeSlot.status = "cancelled";

        // Notify the patient (only real patient accounts — walk-ins have no account)
        if (appt && appt.patientId.toString() !== providerId.toString()) {
            notify(
                appt.patientId,
                "appointment_cancelled",
                "Appointment Cancelled — No-Show",
                "Your appointment was cancelled because you did not show up. Your deposit is non-refundable."
            );
        }

        // Activate the next waiting slot
        const nextWaiting = queue.slots
            .filter(s => s.status === "waiting")
            .sort((a, b) => a.position - b.position)[0];

        if (nextWaiting) nextWaiting.status = "active";
        else queue.isActive = false;

        await queue.save();
        return sendSuccess(res, 200, "No-show patient's appointment cancelled", { queue });
    }

    // outcome === "skip" → move to end
    const maxPos = queue.slots.reduce((max, s) => Math.max(max, s.position), 0);
    activeSlot.status = "skipped";
    activeSlot.position = maxPos + 1;

    // Notify the skipped patient
    if (appt && appt.patientId.toString() !== providerId.toString()) {
        notify(
            appt.patientId,
            "queue_position_update",
            "Queue Update — Moved to End",
            "You were marked as a no-show and have been moved to the end of the queue. Please check in with the provider."
        );
    }

    // Activate the next waiting slot
    const nextWaiting = queue.slots
        .filter(s => s.status === "waiting")
        .sort((a, b) => a.position - b.position)[0];

    if (nextWaiting) nextWaiting.status = "active";
    else queue.isActive = false;

    await queue.save();
    return sendSuccess(res, 200, "Patient moved to end of queue", { queue });
});
