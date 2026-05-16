import cron from "node-cron";
import { checkNoShows, checkStartedAppointments } from "../controllers/booking.controller.js";
import { logError } from "../utils/logger.js";

export function startCronJobs() {
    // Run every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
        try {
            await checkNoShows();
        } catch (err) {
            console.error("[CRON] Error running no-show checker:", err);
            await logError("CRON", err);
        }
    });

    // Run every 30 seconds - check for appointments that should start
    cron.schedule("*/30 * * * * *", async () => {
        try {
            await checkStartedAppointments();
        } catch (err) {
            console.error("[CRON] Error running appointment start checker:", err);
            await logError("CRON", err);
        }
    });
}
