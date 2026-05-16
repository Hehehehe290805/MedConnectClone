import Schedule from "../models/Schedule.js";
import Appointment from "../models/Appointment.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Manila"); // Philippine Time

const toPhTime = (date) => dayjs(date).tz("Asia/Manila");
const nowPhTime = () => dayjs().tz("Asia/Manila");

// 📅 Generate available slots in PH time
async function generateAvailableSlots(doctorId, daysAhead = 2) {
    if (!doctorId) return [];

    const availability = await Schedule.findOne({ doctorId });
    if (!availability || !availability.isActive) return [];

    const slotDuration = 30; // minutes
    const gap = 5; // minutes between slots
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
                status: {
                    $in: [
                        "pending_accept",
                        "awaiting_deposit",
                        "booked",                 // deposit paid
                        "confirmed",              // deposit confirmed by doctor
                        "ongoing",
                        "completed",
                        "fully_paid",             // waiting for remaining payment
                        "confirm_fully_paid",     // full payment confirmed

                        "cancelled_unpaid",
                        "cancelled",
                        "rejected",
                        "no_show_patient",
                        "no_show_doctor",
                        "no_show_both",
                        "freeze"
                    ]
                },
                $or: [
                    { start: { $lt: slotEnd, $gte: slotStart } },
                    { end: { $gt: slotStart, $lte: slotEnd } },
                    { start: { $lte: slotStart }, end: { $gte: slotEnd } },
                ],
            });

            if (!overlapping) {
                slots.push({ start: slotStart, end: slotEnd });
            }

            currentTime = currentTime.add(slotDuration + gap, "minute");
        }
    }

    return slots;
}

// 🧑‍⚕️ Doctor's private calendar (for logged-in doctor)
export async function getDoctorCalendar(req, res) {
    try {
        const { daysAhead = 5 } = req.query;
        const doctorId = req.user?.id;
        if (!doctorId) return res.status(400).json({ message: "doctorId is required" });

        const slots = await generateAvailableSlots(doctorId, Number(daysAhead));
        const appointments = await Appointment.find({
            doctorId,
            status: {
                $in: [
                    "pending_accept",
                    "awaiting_deposit",
                    "booked",                 // deposit paid
                    "confirmed",              // deposit confirmed by doctor
                    "ongoing",
                    "completed",
                    "fully_paid",             // waiting for remaining payment
                    "confirm_fully_paid",     // full payment confirmed

                    "cancelled_unpaid",
                    "cancelled",
                    "rejected",
                    "no_show_patient",
                    "no_show_doctor",
                    "no_show_both",
                    "freeze"
                ]
            },
            start: { $gte: new Date() },
        });

        const events = [
            ...slots.map((s) => ({
                start: toPhTime(s.start).format(),
                end: toPhTime(s.end).format(),
                title: "Available",
                type: "availability",
                phTime:
                    toPhTime(s.start).format("YYYY-MM-DD HH:mm") +
                    " to " +
                    toPhTime(s.end).format("HH:mm"),
            })),
            ...appointments.map((a) => ({
                start: toPhTime(a.start).format(),
                end: toPhTime(a.end).format(),
                title: a.status.charAt(0).toUpperCase() + a.status.slice(1),
                type: "appointment",
                phTime:
                    toPhTime(a.start).format("YYYY-MM-DD HH:mm") +
                    " to " +
                    toPhTime(a.end).format("HH:mm"),
            })),
        ];

        res.status(200).json({
            success: true,
            events,
            timezone: "Asia/Manila (UTC+8)",
        });
    } catch (error) {
        console.error("Error fetching doctor calendar:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// 🌐 Public calendar (anyone can view)
export async function getDoctorPublicCalendar(req, res) {
    try {
        const { doctorId, daysAhead = 5 } = req.query;
        if (!doctorId) return res.status(400).json({ message: "doctorId is required" });

        const slots = await generateAvailableSlots(doctorId, Number(daysAhead));
        const appointments = await Appointment.find({
            doctorId,
            status: { $in: ["booked", "confirmed", "cancelled", "completed"] },
            start: { $gte: new Date() },
        });

        const events = [
            ...slots.map((s) => ({
                start: toPhTime(s.start).format(),
                end: toPhTime(s.end).format(),
                title: "Available",
                type: "availability",
                phTime:
                    toPhTime(s.start).format("YYYY-MM-DD HH:mm") +
                    " to " +
                    toPhTime(s.end).format("HH:mm"),
            })),
            ...appointments.map((a) => ({
                start: toPhTime(a.start).format(),
                end: toPhTime(a.end).format(),
                title: a.status.charAt(0).toUpperCase() + a.status.slice(1),
                type: "appointment",
                phTime:
                    toPhTime(a.start).format("YYYY-MM-DD HH:mm") +
                    " to " +
                    toPhTime(a.end).format("HH:mm"),
            })),
        ];

        events.sort((a, b) => new Date(a.start) - new Date(b.start));

        res.status(200).json({
            success: true,
            events,
            timezone: "Asia/Manila (UTC+8)",
        });
    } catch (error) {
        console.error("Error fetching doctor public schedule:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getInstitutePublicCalendar(req, res) {
    try {
        const { instituteId } = req.query;
        if (!instituteId) return res.status(400).json({ message: "instituteId is required" });

        const appointments = await Appointment.find({
            instituteId,
            status: {
                $in: [
                    "pending_accept",
                    "awaiting_deposit",
                    "booked",                 // deposit paid
                    "confirmed",              // deposit confirmed by doctor
                    "ongoing",
                    "completed",
                    "fully_paid",             // waiting for remaining payment
                    "confirm_fully_paid",     // full payment confirmed

                    "cancelled_unpaid",
                    "cancelled",
                    "rejected",
                    "no_show_patient",
                    "no_show_doctor",
                    "no_show_both",
                    "freeze"
                ]
            },
            start: { $gte: new Date() },
        });

        const events = appointments.map((a) => ({
            start: toPhTime(a.start).format(),
            end: toPhTime(a.end).format(),
            title: a.status.charAt(0).toUpperCase() + a.status.slice(1),
            type: "appointment",
            phTime:
                toPhTime(a.start).format("YYYY-MM-DD HH:mm") +
                " to " +
                toPhTime(a.end).format("HH:mm"),
        }));

        events.sort((a, b) => new Date(a.start) - new Date(b.start));

        res.status(200).json({
            success: true,
            events,
            timezone: "Asia/Manila (UTC+8)",
        });
    } catch (error) {
        console.error("Error fetching institute public schedule:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
    
export async function setAvailability(req, res) {
    try {
        const providerId = req.user._id; // Logged in user
        const providerType = req.user.role; // Assuming role is either "doctor" or "institute"
        const { startHour, endHour, daysOfWeek, isActive } = req.body;

        if (!startHour || !endHour || !daysOfWeek) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (!["doctor", "institute"].includes(providerType)) {
            return res.status(400).json({ message: "Invalid provider type" });
        }

        const query = providerType === "doctor"
            ? { doctorId: providerId }
            : { instituteId: providerId };

        const update = {
            startHour,
            endHour,
            daysOfWeek,
            isActive
        };

        const availability = await Schedule.findOneAndUpdate(
            query,
            update,
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: `${providerType} availability set successfully`,
            availability
        });

    } catch (error) {
        console.error("Error setting availability:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
export async function getAvailability(req, res) {
    try {
        const providerId = req.user._id; // Logged in user
        const providerType = req.user.role; // Assuming role is either "doctor" or "institute"

        if (!["doctor", "institute"].includes(providerType)) {
            return res.status(400).json({ message: "Invalid provider type" });
        }

        const query = providerType === "doctor"
            ? { doctorId: providerId }
            : { instituteId: providerId };

        const availability = await Schedule.findOne(query);

        if (!availability) {
            return res.status(200).json({
                success: true,
                message: "No availability schedule found",
                availability: null
            });
        }

        res.status(200).json({
            success: true,
            message: "Availability retrieved successfully",
            availability
        });

    } catch (error) {
        console.error("Error getting availability:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const acceptAppointment = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const { appointmentId } = req.body;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        if (appointment.doctorId.toString() !== doctorId.toString())
            return res.status(403).json({ message: "Only the assigned doctor can accept this appointment" });

        if (appointment.status !== "pending_accept") {
            return res.status(400).json({ message: "Appointment cannot be accepted at this stage" });
        }

        appointment.status = "awaiting_deposit";
        await appointment.save();

        res.status(200).json({ success: true, message: "Appointment accepted. Awaiting patient deposit.", appointment });
    } catch (err) {
        console.error("Error accepting appointment:", err);
        res.status(500).json({ message: "Server error" });
    }
};
export const rejectAppointment = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const { appointmentId, reason } = req.body;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        if (appointment.doctorId.toString() !== doctorId.toString())
            return res.status(403).json({ message: "Only the assigned doctor can reject this appointment" });

        if (appointment.status !== "pending_accept") {
            return res.status(400).json({ message: "Only appointments pending acceptance can be rejected" });
        }

        appointment.status = "rejected";
        appointment.rejectionReason = reason || "No reason provided";
        await appointment.save();

        res.status(200).json({ success: true, message: "Appointment rejected.", appointment });
    } catch (err) {
        console.error("Error rejecting appointment:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const confirmDeposit = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const { appointmentId } = req.body;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        if (appointment.doctorId.toString() !== doctorId.toString())
            return res.status(403).json({ message: "Only the assigned doctor can confirm deposit" });

        if (!appointment.depositPaid || appointment.status !== "booked") {
            return res.status(400).json({ message: "Deposit not yet paid or appointment not in correct status" });
        }

        appointment.status = "confirmed";
        await appointment.save();

        res.status(200).json({ success: true, message: "Deposit confirmed. Appointment is now confirmed.", appointment });
    } catch (err) {
        console.error("Error confirming deposit:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const markComplete = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const { appointmentId } = req.body;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        if (appointment.doctorId.toString() !== doctorId.toString())
            return res.status(403).json({ message: "Only the assigned doctor can mark appointment as completed" });

        if (!["confirmed", "ongoing", "confirm_fully_paid"].includes(appointment.status)) {
            return res.status(400).json({ message: "Appointment cannot be completed at this stage" });
        }

        appointment.status = "marked_complete";
        await appointment.save();

        res.status(200).json({ success: true, message: "Appointment marked as completed.", appointment });
    } catch (err) {
        console.error("Error completing appointment:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const confirmFullPayment = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const { appointmentId } = req.body;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        if (appointment.doctorId.toString() !== doctorId.toString())
            return res.status(403).json({ message: "Only the assigned doctor can confirm full payment" });

        if (!appointment.balancePaid || appointment.status !== "fully_paid") {
            return res.status(400).json({ message: "Full payment not yet made or appointment not in correct status" });
        }

        appointment.status = "confirm_fully_paid";
        await appointment.save();

        res.status(200).json({ success: true, message: "Full payment confirmed. Appointment is fully paid.", appointment });
    } catch (err) {
        console.error("Error confirming full payment:", err);
        res.status(500).json({ message: "Server error" });
    }
};
