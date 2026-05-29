import cron from "node-cron";
import User from "../models/User.js";
import { Doctor, Pharmacy } from "../models/User.js";
import Admin from "../models/Admin.js";
import Appointment from "../models/Appointment.js";
import EmailRegistry from "../models/EmailRegistry.js";
import { logError } from "../utils/logger.js";

// FLAG: booking controller needs rewrite — stubs prevent startup crash
const checkNoShows = async () => { };
const checkStartedAppointments = async () => { };

export function startCronJobs() {
    // Run every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
        try {
            console.log("[CRON] Running auto no-show checker");
            await checkNoShows();
        } catch (err) {
            console.error("[CRON] Error running no-show checker:", err);
            await logError("CRON", err);
        }
    });

    // Run every 30 seconds - check for appointments that should start
    cron.schedule("*/30 * * * * *", async () => {
        try {
            console.log("[CRON] Running appointment start checker");
            await checkStartedAppointments();
        } catch (err) {
            console.error("[CRON] Error running appointment start checker:", err);
            await logError("CRON", err);
        }
    });

    // Run daily at midnight — wipe accounts pending deletion for 30 days
    cron.schedule("0 0 * * *", async () => {
        try {
            console.log("[CRON] Running account deletion sweep");
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const usersToDelete = await User.find({
                pendingDeletion: true,
                deletionRequestedAt: { $lte: cutoff },
            }).select("_id email");

            const adminsToDelete = await Admin.find({
                pendingDeletion: true,
                deletionRequestedAt: { $lte: cutoff },
            }).select("_id email");

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
                await EmailRegistry.deleteOne({ email: user.email });
                await User.findByIdAndDelete(user._id);
            }

            for (const admin of adminsToDelete) {
                await EmailRegistry.deleteOne({ email: admin.email });
                await Admin.findByIdAndDelete(admin._id);
            }

            console.log(`[CRON] Deleted ${usersToDelete.length} users and ${adminsToDelete.length} admins`);
        } catch (err) {
            console.error("[CRON] Error running account deletion sweep:", err);
            await logError("CRON", err);
        }
    });

    // Run daily at 1am — check expiring and expired licenses
    cron.schedule("0 1 * * *", async () => {
        try {
            console.log("[CRON] Running license expiry checker");
            const now = new Date();
            const in60Days = new Date(now.getTime(),  60 * 24 * 60 * 60 * 1000);
    
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
                }
            }
    
            const pharmaciesNeedingRenewal = await Pharmacy.find({ status: "onBoarded" });
            for (const doc of pharmaciesNeedingRenewal) {
                const expiry = earliestExpiry(doc);
                if (expiry && expiry <= in60Days) {
                    await Pharmacy.findByIdAndUpdate(doc._id, { status: "needsRenewal" });
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

            console.log("[CRON] License expiry check complete");
        } catch (err) {
            console.error("[CRON] Error in license expiry checker:", err);
            await logError("CRON", err);
        }
    });
}
