import cron from "node-cron";
import User from "../models/User.js";
import { Doctor, Pharmacy } from "../models/User.js";
import Admin from "../models/Admin.js";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";
import Schedule from "../models/Schedule.js";
import Pricing from "../models/Pricing.js";
import DoctorSpecialty from "../models/DoctorSpecialty.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
import AccountRegistry from "../models/AccountRegistry.js";
import { logError } from "../utils/logger.js";
import { deleteFromS3 } from "../services/s3.js";
import { notify } from "./notification.service.js";
import { completeDuePharmacyOrders } from "../controllers/pharmacyOrder.controller.js";
import { buildQueueForProvider } from "../controllers/queue.controller.js";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);
dayjs.extend(timezone);
const toPhTime = (d) => dayjs(d).tz("Asia/Manila");

// Returns true if a license_expiring_soon notification was already sent to this user today
async function alreadyNotifiedToday(userId) {
    const startOfDay = dayjs().tz("Asia/Manila").startOf("day").toDate();
    const existing = await Notification.findOne({
        recipient: userId,
        type: "license_expiring_soon",
        createdAt: { $gte: startOfDay },
    });
    return Boolean(existing);
}

// ── CRON: accepted → ongoing ───────────────────────────────────────────────
// Runs every 30 seconds. Keeps latency low so the appointment chat/video
// window opens close to the booked start time.
const checkStartedAppointments = async () => {
    const now = new Date();
    const appointments = await Appointment.find({ status: "accepted", start: { $lte: now } });
    for (const appt of appointments) {
        appt.status = "ongoing";
        await appt.save();
        const msg = appt.virtual
            ? `Your virtual appointment on ${toPhTime(appt.start).format("MMM D [at] h:mm A")} has started. You have 5 minutes to join the video call.`
            : `Your appointment on ${toPhTime(appt.start).format("MMM D [at] h:mm A")} has started.`;
        notify(appt.patientId, "appointment_started", "Appointment Started", msg);
        if (appt.doctorId) notify(appt.doctorId, "appointment_started", "Appointment Started", msg);
        if (appt.instituteId) notify(appt.instituteId, "appointment_started", "Appointment Started", msg);
    }
};

// ── CRON: virtual no-join timeout ────────────────────────────────────────
// Runs every 30 seconds alongside the start checker. Cancels virtual
// appointments where 5+ minutes have passed since start and not both parties
// joined. Patient no-show = deposit forfeited; Provider no-show = full refund.
const checkVirtualNoJoin = async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const timedOut = await Appointment.find({
        status: "ongoing",
        virtual: true,
        start: { $lte: fiveMinAgo },
        $or: [{ patientJoined: false }, { providerJoined: false }],
    });

    for (const appt of timedOut) {
        const providerId = appt.doctorId || appt.instituteId;
        if (!appt.patientJoined && !appt.providerJoined) {
            // Neither joined — cancel, no refund
            appt.status = "cancelled";
            appt.rejectionReason = "Neither party joined the video call within 5 minutes.";
            await appt.save();
            notify(appt.patientId, "appointment_cancelled", "Appointment Cancelled — No-Show",
                `Your appointment was cancelled because neither party joined the video call within 5 minutes. Your deposit is non-refundable.`);
            if (providerId) notify(providerId, "appointment_cancelled", "Appointment Cancelled — No-Show",
                `The appointment was cancelled because neither party joined within 5 minutes.`);
        } else if (!appt.patientJoined) {
            // Patient didn't join — cancel, deposit forfeited to provider
            appt.status = "cancelled";
            appt.rejectionReason = "Patient did not join the video call within 5 minutes.";
            await appt.save();
            const providerNet = Math.round((appt.depositAmount - appt.platformFee) * 100) / 100;
            notify(appt.patientId, "appointment_cancelled", "Appointment Cancelled — You Didn't Join",
                `Your appointment was cancelled because you did not join the video call within 5 minutes. Your deposit of ₱${appt.depositAmount} is non-refundable.`);
            if (providerId) notify(providerId, "appointment_cancelled", "Patient No-Show — Deposit Released",
                `The patient did not join the video call within 5 minutes. The deposit (₱${providerNet} after platform fee) has been released to you.`);
        } else if (!appt.providerJoined) {
            // Provider didn't join — cancel, full refund to patient
            appt.status = "cancelled";
            appt.rejectionReason = "Provider did not join the video call within 5 minutes.";
            await appt.save();
            notify(appt.patientId, "appointment_cancelled", "Appointment Cancelled — Provider No-Show",
                `Your appointment was cancelled because the provider did not join the video call within 5 minutes. Your full deposit of ₱${appt.depositAmount} will be refunded.`);
            if (providerId) notify(providerId, "appointment_cancelled", "Appointment Cancelled — You Didn't Join",
                `The appointment was cancelled because you did not join the video call within 5 minutes. The patient's deposit will be fully refunded.`);
        }
    }
};

// ── CRON: pre-appointment reminders ──────────────────────────────────────
// Runs every minute. Sends a reminder 5 min before virtual appointments and
// 30 min before in-person appointments. Uses a Notification check to avoid
// sending duplicate reminders.
const sendPreAppointmentReminders = async () => {
    const now = new Date();

    // Virtual: 5-minute window [now+4min, now+6min]
    const virtualWindowStart = new Date(now.getTime() + 4 * 60 * 1000);
    const virtualWindowEnd   = new Date(now.getTime() + 6 * 60 * 1000);
    const upcomingVirtual = await Appointment.find({
        status: "accepted",
        virtual: true,
        start: { $gte: virtualWindowStart, $lte: virtualWindowEnd },
    });
    for (const appt of upcomingVirtual) {
        const alreadySent = await Notification.findOne({
            recipient: appt.patientId,
            type: "appointment_started",
            body: { $regex: /5 minutes/ },
            createdAt: { $gte: new Date(now.getTime() - 10 * 60 * 1000) },
        });
        if (alreadySent) continue;
        const msg = `Your virtual appointment starts in about 5 minutes (${toPhTime(appt.start).format("h:mm A")}). Make sure you're ready to join the video call.`;
        notify(appt.patientId, "appointment_started", "Appointment in 5 Minutes", msg);
        const providerId = appt.doctorId || appt.instituteId;
        if (providerId) notify(providerId, "appointment_started", "Appointment in 5 Minutes", msg);
    }

    // Physical: 30-minute window [now+29min, now+31min]
    const physWindowStart = new Date(now.getTime() + 29 * 60 * 1000);
    const physWindowEnd   = new Date(now.getTime() + 31 * 60 * 1000);
    const upcomingPhysical = await Appointment.find({
        status: "accepted",
        virtual: false,
        start: { $gte: physWindowStart, $lte: physWindowEnd },
    });
    for (const appt of upcomingPhysical) {
        const alreadySent = await Notification.findOne({
            recipient: appt.patientId,
            type: "appointment_started",
            body: { $regex: /30 minutes/ },
            createdAt: { $gte: new Date(now.getTime() - 10 * 60 * 1000) },
        });
        if (alreadySent) continue;
        const msg = `Your in-person appointment starts in about 30 minutes (${toPhTime(appt.start).format("h:mm A")}). Please head to the clinic/hospital.`;
        notify(appt.patientId, "appointment_started", "Appointment in 30 Minutes", msg);
        const providerId = appt.doctorId || appt.instituteId;
        if (providerId) notify(providerId, "appointment_started", "Appointment in 30 Minutes",
            `Your appointment starts in about 30 minutes (${toPhTime(appt.start).format("h:mm A")}).`);
    }
};

// ── CRON: ongoing → completed/awaiting_balance + reject cleanup ───────────
// Runs every 5 minutes. The 5-min granularity is acceptable here since the
// appointment is already in progress — users see "completed" shortly after
// the booked end time. Auto-deletes rejected appointments after 24 h so the
// collection doesn't accumulate dead records indefinitely.
const checkEndedAppointments = async () => {
    const now = new Date();

    // Ongoing → complete
    const ended = await Appointment.find({ status: "ongoing", end: { $lte: now } });
    for (const appt of ended) {
        appt.status = appt.virtual ? "awaiting_balance" : "fully_paid";
        await appt.save();
        const baseMsg = `Your appointment on ${toPhTime(appt.start).format("MMM D")} is now complete.`;
        const patientMsg = appt.virtual ? `${baseMsg} Please pay the remaining balance.` : baseMsg;
        notify(appt.patientId, "appointment_completed", "Appointment Completed", patientMsg);
        const providerId = appt.doctorId || appt.instituteId;
        if (providerId) {
            notify(providerId, "appointment_completed", "Appointment Completed",
                appt.virtual ? `${baseMsg} Awaiting patient balance payment.` : baseMsg);
        }
    }

    // Auto-delete rejected appointments older than 24hrs
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await Appointment.deleteMany({ status: "rejected", rejectedAt: { $lte: cutoff } });
};

export function startCronJobs() {
    // Run every 30 seconds — transition accepted → ongoing + virtual no-join timeout
    cron.schedule("*/30 * * * * *", async () => {
        try {
            await checkStartedAppointments();
            await checkVirtualNoJoin();
        } catch (err) {
            console.error("[CRON] Appointment start checker:", err.message);
            await logError("CRON", err);
        }
    });

    // Run every minute — pre-appointment reminders (5 min virtual, 30 min physical)
    cron.schedule("* * * * *", async () => {
        try {
            await sendPreAppointmentReminders();
            await completeDuePharmacyOrders();
        } catch (err) {
            console.error("[CRON] Minute cron:", err.message);
            await logError("CRON", err);
        }
    });

    // Run every 5 minutes — transition ongoing → complete + delete old rejected
    cron.schedule("*/5 * * * *", async () => {
        try {
            await checkEndedAppointments();
        } catch (err) {
            console.error("[CRON] Appointment end checker:", err.message);
            await logError("CRON", err);
        }
    });

    // ── CRON: 30-day soft-delete sweep ────────────────────────────────────
    // Users who requested deletion but did NOT log back in within 30 days are
    // hard-deleted here. The 30-day window is intentional — it lets users
    // cancel accidental deletions by simply logging back in (see auth.controller deleteMe).
    cron.schedule("0 0 * * *", async () => {
        try {

            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            // Also hard-delete rejected accounts older than 30 days
            const rejectedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const rejectedUsers = await User.find({
                status: "rejected",
                updatedAt: { $lte: rejectedCutoff },
            }).select("_id email profilePic licenseImage legalIDImage businessPermit fdaLicense pharmacistLicenseImage pharmacistLegalIDImage constructionPermit technologistLicenseImage technologistLegalIDImage");

            for (const user of rejectedUsers) {
                for (const key of [
                    user.profilePic?.key, user.licenseImage?.key, user.legalIDImage?.key,
                    user.businessPermit?.key, user.fdaLicense?.key, user.pharmacistLicenseImage?.key,
                    user.pharmacistLegalIDImage?.key, user.constructionPermit?.key,
                    user.technologistLicenseImage?.key, user.technologistLegalIDImage?.key,
                ].filter(Boolean)) {
                    try { await deleteFromS3(key); } catch { /* non-fatal */ }
                }
                await Promise.all([
                    AccountRegistry.deleteMany({ registrant: user._id }),
                    Schedule.deleteOne({ $or: [{ doctorId: user._id }, { instituteId: user._id }] }),
                    Pricing.deleteMany({ providerId: user._id }),
                    DoctorSpecialty.deleteMany({ doctorId: user._id }),
                    InstituteDepartmentService.deleteMany({ departmentId: user._id }),
                    Notification.deleteMany({ recipient: user._id }),
                ]);
                await User.findByIdAndDelete(user._id);
            }
            if (rejectedUsers.length) {

            }

            const usersToDelete = await User.find({
                pendingDeletion: true,
                deletionRequestedAt: { $lte: cutoff },
            }).select("_id email profilePic licenseImage legalIDImage businessPermit fdaLicense pharmacistLicenseImage pharmacistLegalIDImage constructionPermit technologistLicenseImage technologistLegalIDImage");

            const adminsToDelete = await Admin.find({
                pendingDeletion: true,
                deletionRequestedAt: { $lte: cutoff },
            }).select("_id email profilePic");

            for (const user of usersToDelete) {
                // per transaction rule: only delete appointment if both parties are being deleted
                const userIds = [...usersToDelete, ...adminsToDelete].map(u => u._id);
                await Appointment.deleteMany({
                    $and: [
                        { $or: [{ patientId: user._id }, { doctorId: user._id }] },
                        { $or: [{ patientId: { $in: userIds }, doctorId: { $in: userIds } },
                            ],
                        },
                    ],
                });

                // delete S3 files
                const s3Keys = [
                    user.profilePic?.key,
                    user.licenseImage?.key,
                    user.legalIDImage?.key,
                    user.businessPermit?.key,
                    user.fdaLicense?.key,
                    user.pharmacistLicenseImage?.key,
                    user.pharmacistLegalIDImage?.key,
                    user.constructionPermit?.key,
                    user.technologistLicenseImage?.key,
                    user.technologistLegalIDImage?.key,
                ].filter(Boolean);
                for (const key of s3Keys) await deleteFromS3(key);

                await Promise.all([
                    AccountRegistry.deleteMany({ registrant: user._id }),
                    Schedule.deleteOne({ $or: [{ doctorId: user._id }, { instituteId: user._id }] }),
                    Pricing.deleteMany({ providerId: user._id }),
                    DoctorSpecialty.deleteMany({ doctorId: user._id }),
                    InstituteDepartmentService.deleteMany({ departmentId: user._id }),
                    Notification.deleteMany({ recipient: user._id }),
                ]);
                await User.findByIdAndDelete(user._id);
            }

            for (const admin of adminsToDelete) {
                // Admin profilePic is in a separate collection — delete S3 object here
                if (admin.profilePic?.key) await deleteFromS3(admin.profilePic.key);
                await AccountRegistry.deleteMany({ registrant: admin._id });
                await Admin.findByIdAndDelete(admin._id);
            }


        } catch (err) {
            console.error("[CRON] Deletion sweep error:", err.message);
            await logError("CRON", err);
        }
    });

    // ── CRON: license expiry checker ──────────────────────────────────────
    // Runs at 1 AM daily (offset from midnight sweep to stagger DB load).
    // Transitions: onBoarded → needsRenewal (60 days before expiry),
    //              needsRenewal → suspended (if expiry has now passed without renewal).
    cron.schedule("0 1 * * *", async () => {
        try {

            const now = new Date();
            const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    
            // helper — earliest expiry date for a doc
            const earliestExpiry = (doc) => {
                const dates = [doc.licenseExpiration, doc.businessPermitExpiration, doc.fdaLicenseExpiration]
                        .filter(Boolean);
                return dates.length ? new Date(Math.min(...dates.map(d => new Date(d)))) : null;
            };
    
            // onBoarded → needsRenewal (60 days before earliest expiry)
            const doctorsNeedingRenewal = await Doctor.find({ status: "onBoarded" });
            for (const doc of doctorsNeedingRenewal) {
                const expiry = earliestExpiry(doc);
                if (expiry && expiry <= in60Days) {
                    await Doctor.findByIdAndUpdate(doc._id, { status: "needsRenewal" });
                    if (!(await alreadyNotifiedToday(doc._id))) {
                        notify(doc._id, "license_expiring_soon", "License Expiring Soon",
                            `Your license or permit expires on ${expiry.toDateString()}. Submit a renewal as soon as possible to avoid suspension.`);
                    }
                }
            }

            const pharmaciesNeedingRenewal = await Pharmacy.find({ status: "onBoarded" });
            for (const doc of pharmaciesNeedingRenewal) {
                const expiry = earliestExpiry(doc);
                if (expiry && expiry <= in60Days) {
                    await Pharmacy.findByIdAndUpdate(doc._id, { status: "needsRenewal" });
                    if (!(await alreadyNotifiedToday(doc._id))) {
                        notify(doc._id, "license_expiring_soon", "License Expiring Soon",
                            `Your license or permit expires on ${expiry.toDateString()}. Submit a renewal as soon as possible to avoid suspension.`);
                    }
                }
            }

            // needsRenewal users — send daily reminders (once per day, idempotent)
            const alreadyNeedsRenewal = await User.find({
                status: "needsRenewal",
                $or: [
                    { licenseExpiration: { $gt: now, $lte: in60Days } },
                    { businessPermitExpiration: { $gt: now, $lte: in60Days } },
                    { fdaLicenseExpiration: { $gt: now, $lte: in60Days } },
                ],
            });
            for (const doc of alreadyNeedsRenewal) {
                if (!(await alreadyNotifiedToday(doc._id))) {
                    const expiry = earliestExpiry(doc);
                    if (expiry) {
                        notify(doc._id, "license_expiring_soon", "License Expiring Soon — Reminder",
                            `Reminder: Your license or permit expires on ${expiry.toDateString()}. Please submit a renewal to avoid suspension.`);
                    }
                }
            }

            // needsRenewal → suspended (expiry passed, never submitted)
            const expiredNeedingRenewal = await User.find({
                status: "needsRenewal",
                $or: [
                    { licenseExpiration: { $lte: now } },
                    { businessPermitExpiration: { $lte: now } },
                    { fdaLicenseExpiration: { $lte: now } },
                ],
            });
            for (const doc of expiredNeedingRenewal) {
                await User.findByIdAndUpdate(doc._id, { status: "suspended" });
                notify(doc._id, "license_expired", "Account Suspended — License Expired",
                    "Your license or permit has expired and your account is now suspended. Please contact support or submit a renewal.");
            }

            // pendingRenewal → pendingRenewalExpired (expiry passed before admin approved)
            const expiredPendingRenewal = await User.find({
                status: "pendingRenewal",
                $or: [
                    { licenseExpiration: { $lte: now } },
                    { businessPermitExpiration: { $lte: now } },
                    { fdaLicenseExpiration: { $lte: now } },
                ],
            });
            for (const doc of expiredPendingRenewal) {
                await User.findByIdAndUpdate(doc._id, { status: "pendingRenewalExpired" });
            }


        } catch (err) {
            console.error("[CRON] License expiry checker error:", err.message);
            await logError("CRON", err);
        }
    });

    // ── CRON: read notification cleanup ──────────────────────────────────────
    // Runs at 2 AM daily. Deletes notifications that have been read for over
    // 30 days — read status flips updatedAt, so we use that as the read timestamp.
    cron.schedule("0 2 * * *", async () => {
        try {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const result = await Notification.deleteMany({
                isRead: true,
                updatedAt: { $lte: cutoff },
            });
            if (result.deletedCount > 0) {

            }
        } catch (err) {

            await logError("CRON", err);
        }
    });

    // ── CRON: daily queue build at 6 AM Asia/Manila ───────────────────────
    cron.schedule("0 22 * * *", async () => {
        try {
            const todayPH   = dayjs().tz("Asia/Manila").startOf("day");
            const tomorrowPH = todayPH.add(1, "day");

            const doctorAppointments = await Appointment.find({
                status: "accepted",
                doctorId: { $exists: true, $ne: null },
                start: { $gte: todayPH.utc().toDate(), $lt: tomorrowPH.utc().toDate() },
            }).distinct("doctorId");

            for (const docId of doctorAppointments) {
                try { await buildQueueForProvider(docId, "doctor"); } catch (e) {
                    console.error("[CRON] Queue build failed for doctor:", e.message);
                }
            }

            const deptAppointments = await Appointment.find({
                status: "accepted",
                instituteId: { $exists: true, $ne: null },
                start: { $gte: todayPH.utc().toDate(), $lt: tomorrowPH.utc().toDate() },
            }).distinct("instituteId");

            for (const deptId of deptAppointments) {
                try { await buildQueueForProvider(deptId, "department"); } catch (e) {
                    console.error("[CRON] Queue build failed for department:", e.message);
                }
            }
        } catch (err) {
            console.error("[CRON] Daily queue build error:", err.message);
            await logError("CRON", err);
        }
    });
}
